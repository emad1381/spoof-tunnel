//go:build linux && cgo

package transport

import (
	"net"
	"os"
	"sync"
	"testing"
	"time"
)

func TestNativeReceiverCloseJoinsOwner(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("requires CAP_NET_RAW")
	}
	for _, protocol := range []string{"tcp", "icmp", "icmpv6"} {
		t.Run(protocol, func(t *testing.T) {
			receiver, err := NewReceiver(protocol, ReceiverConfig{ListenPort: 49873, PeerSpoofIP: net.ParseIP("127.0.0.2")})
			if err != nil {
				t.Fatal(err)
			}
			time.Sleep(10 * time.Millisecond)
			done := make(chan struct{})
			go func() { receiver.Close(); close(done) }()
			select {
			case <-done:
			case <-time.After(3 * time.Second):
				t.Fatal("receiver did not join native receive call")
			}
			if err := receiver.Close(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
func TestUDPReceiverCloseDuringTraffic(t *testing.T) {
	receiver, err := NewUDPReceiver(ReceiverConfig{})
	if err != nil {
		t.Fatal(err)
	}
	sender, err := net.DialUDP("udp4", nil, receiver.udpConn.LocalAddr().(*net.UDPAddr))
	if err != nil {
		t.Fatal(err)
	}
	defer sender.Close()
	var group sync.WaitGroup
	group.Add(1)
	go func() {
		defer group.Done()
		for i := 0; i < 1000; i++ {
			sender.Write([]byte("traffic"))
		}
	}()
	receiver.Close()
	group.Wait()
	receiver.Close()
}
func TestSenderCloseDuringSend(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("requires CAP_NET_RAW")
	}
	sender, err := NewUDPSender(SenderConfig{SourceIP: net.ParseIP("127.0.0.2"), SourcePort: 48731})
	if err != nil {
		t.Fatal(err)
	}
	var group sync.WaitGroup
	group.Add(1)
	go func() {
		defer group.Done()
		for i := 0; i < 100; i++ {
			_ = sender.Send([]byte("local-test"), net.ParseIP("127.0.0.1"), 48732)
		}
	}()
	sender.Close()
	group.Wait()
	sender.Close()
}
