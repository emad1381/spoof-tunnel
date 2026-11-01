package relay

import (
	"errors"
	"log"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ParsaKSH/spoof-tunnel/internal/transport"
)

// RemoteConfig configures the remote (server) relay.
type RemoteConfig struct {
	ListenPort    uint16
	ForwardAddr   string
	ClientIP      net.IP
	ClientPort    uint16
	SpoofIP       net.IP
	SpoofIPs      []net.IP
	SpoofPort     uint16
	PeerSpoofIP   net.IP
	SendTransport string // "tcp", "udp", "icmp", "icmpv6"
	RecvTransport string // "tcp", "udp", "icmp", "icmpv6"
	XDPInterface  string // network interface for XDP (empty = disabled)
}

type Remote struct {
	cfg       RemoteConfig
	done      chan struct{}
	closeOnce sync.Once
	recver    transport.Receiver
	sender    transport.Sender
	udpConn   *net.UDPConn
	fwdAddr   *net.UDPAddr

	up       atomic.Uint64
	down     atomic.Uint64
	upPkts   atomic.Uint64
	downPkts atomic.Uint64
}

func NewRemote(cfg RemoteConfig) (*Remote, error) {
	if cfg.SendTransport == "" {
		cfg.SendTransport = transport.TransportUDP
	}
	if cfg.RecvTransport == "" {
		cfg.RecvTransport = transport.TransportTCP
	}

	recver, err := transport.NewReceiver(cfg.RecvTransport, transport.ReceiverConfig{
		ListenPort:   cfg.ListenPort,
		PeerSpoofIP:  cfg.PeerSpoofIP,
		BufferSize:   4 * 1024 * 1024,
		UseXDP:       cfg.XDPInterface != "",
		XDPInterface: cfg.XDPInterface,
	})
	if err != nil {
		return nil, err
	}

	fwdAddr, err := net.ResolveUDPAddr("udp4", cfg.ForwardAddr)
	if err != nil {
		recver.Close()
		return nil, err
	}

	udpConn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4zero, Port: 0})
	if err != nil {
		recver.Close()
		return nil, err
	}

	senderCfg := transport.SenderConfig{
		SourcePort: cfg.SpoofPort,
		MTU:        1400,
	}
	if len(cfg.SpoofIPs) > 0 {
		senderCfg.SourceIPs = cfg.SpoofIPs
	} else {
		senderCfg.SourceIP = cfg.SpoofIP
	}

	sender, err := transport.NewSender(cfg.SendTransport, senderCfg)
	if err != nil {
		recver.Close()
		udpConn.Close()
		return nil, err
	}

	return &Remote{
		cfg:     cfg,
		done:    make(chan struct{}),
		recver:  recver,
		sender:  sender,
		udpConn: udpConn,
		fwdAddr: fwdAddr,
	}, nil
}

func (r *Remote) Run() {
	go r.uplinkLoop()
	go r.statsLoop()
	r.downlinkLoop()
}

func (r *Remote) uplinkLoop() {
	for {
		data, _, _, err := r.recver.Receive()
		if err != nil {
			return
		}
		if len(data) == 0 {
			continue
		}
		if _, err := r.udpConn.WriteToUDP(data, r.fwdAddr); err != nil {
			continue
		}
		r.up.Add(uint64(len(data)))
		r.upPkts.Add(1)
	}
}

func (r *Remote) downlinkLoop() {
	buf := make([]byte, 65536)
	for {
		n, _, err := r.udpConn.ReadFromUDP(buf)
		if err != nil {
			if errors.Is(err, net.ErrClosed) {
				return
			}
			continue
		}
		if n == 0 {
			continue
		}
		if err := r.sender.Send(buf[:n], r.cfg.ClientIP, r.cfg.ClientPort); err != nil {
			continue
		}
		r.down.Add(uint64(n))
		r.downPkts.Add(1)
	}
}

func (r *Remote) statsLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.done:
			return
		case <-ticker.C:
			log.Printf("[remote] stats: up=%d pkts (%s) | down=%d pkts (%s)",
				r.upPkts.Load(), formatBytes(r.up.Load()),
				r.downPkts.Load(), formatBytes(r.down.Load()))
		}
	}
}

func (r *Remote) Close() {
	r.closeOnce.Do(func() {
		close(r.done)
		r.recver.Close()
		r.sender.Close()
		r.udpConn.Close()
	})
}

func (r *Remote) Stats() (up, down uint64) {
	return r.up.Load(), r.down.Load()
}
