package transport

import (
	"fmt"
	"net"
)

// Sender sends spoofed packets over the wire.
type Sender interface {
	Send(payload []byte, dstIP net.IP, dstPort uint16) error
	Close() error
}

// Receiver listens for incoming spoofed packets.
type Receiver interface {
	Receive() (payload []byte, srcIP net.IP, srcPort uint16, err error)
	Close() error
}

// SenderConfig holds config shared by all senders.
type SenderConfig struct {
	SourceIP   net.IP   // Spoofed source address (single IP, used if SourceIPs is empty)
	SourceIPs  []net.IP // Multiple spoofed source addresses for round-robin
	SourcePort uint16   // Spoofed source port
	MTU        int      // Maximum transmission unit (IP payload)
}

// ReceiverConfig holds config shared by all receivers.
type ReceiverConfig struct {
	ListenPort   uint16 // Port to filter incoming packets on
	PeerSpoofIP  net.IP // Expected source IP for filtering (nil = accept all)
	BufferSize   int    // SO_RCVBUF size
	UseXDP       bool   // Enable XDP/eBPF acceleration
	XDPInterface string // Network interface for XDP (e.g. "eth0")
}

// Validate checks the sender config.
func (c *SenderConfig) Validate() error {
	if c.SourceIP == nil && len(c.SourceIPs) == 0 {
		return ErrNoSourceIP
	}
	if c.MTU == 0 {
		c.MTU = 1400
	}
	if c.MTU < 68 || c.MTU > 1500 {
		return fmt.Errorf("MTU must be 68–1500")
	}
	for _, ip := range c.GetIPList() {
		if ip == nil || ip.To4() == nil || ip.IsUnspecified() || ip.IsMulticast() || ip.Equal(net.IPv4bcast) {
			return fmt.Errorf("source must be unicast IPv4")
		}
	}
	return nil
}

// GetIPList returns the flat list of IPs to use (merges single + multi).
func (c *SenderConfig) GetIPList() []net.IP {
	if len(c.SourceIPs) > 0 {
		return c.SourceIPs
	}
	return []net.IP{c.SourceIP}
}
