//go:build linux

package l3

import (
	"os"
	"testing"
	"time"
)

func TestMultiSourceAllowlist(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("requires CAP_NET_RAW")
	}
	rx, e := NewPacketConn(Config{LocalIP: "127.0.0.1", PeerIP: "127.0.0.1", SpoofSource: "127.0.0.4", PeerSpoof: "127.0.0.2", PeerSpoofs: []string{"127.0.0.2", "127.0.0.3"}, Send: "experimental", Receive: "experimental"})
	if e != nil {
		t.Fatal(e)
	}
	defer rx.Close()
	tx, e := NewPacketConn(Config{LocalIP: "127.0.0.1", PeerIP: "127.0.0.1", SpoofSources: []string{"127.0.0.2", "127.0.0.3"}, PeerSpoof: "127.0.0.4", Send: "experimental", Receive: "experimental"})
	if e != nil {
		t.Fatal(e)
	}
	defer tx.Close()
	tx.Send([]byte("source-one"))
	tx.Send([]byte("source-two"))
	rx.recv.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	a, e := rx.Receive()
	if e != nil {
		t.Fatal(e)
	}
	b, e := rx.Receive()
	if e != nil {
		t.Fatalf("rotation sent 2 packets; received first=%q second=%q error=%v", a, b, e)
	}
	_ = b
}
