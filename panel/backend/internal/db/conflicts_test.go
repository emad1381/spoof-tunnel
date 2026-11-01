package db

import (
	"encoding/base64"
	"path/filepath"
	"testing"
)

func TestTunnelConflicts(t *testing.T) {
	database, err := InitDB(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { d, _ := database.DB(); d.Close() }()
	a := TunnelInstance{Name: "first", Engine: "tun", Mode: "local", LocalIP: "192.0.2.1", RemoteAddr: "192.0.2.2", SpoofIP: "198.51.100.1", PeerSpoofIP: "198.51.100.2", SendTransport: "icmp", RecvTransport: "icmp", RemotePort: 8090, RecvPort: 5001, TunInterface: "spfirst", TunAddress: "10.77.0.1/30", TunPeer: "10.77.0.2", TunMTU: 1280, PSK: base64.StdEncoding.EncodeToString(make([]byte, 32))}
	if err = SaveTunnel(database, &a, true); err != nil {
		t.Fatal(err)
	}
	b := a
	b.ID = 0
	b.Name = "second"
	b.TunInterface = "spsecond"
	if SaveTunnel(database, &b, true) == nil {
		t.Fatal("overlap accepted")
	}
	b.TunAddress = "10.77.1.1/30"
	b.TunPeer = "10.77.1.2"
	b.TunInterface = a.TunInterface
	if SaveTunnel(database, &b, true) == nil {
		t.Fatal("duplicate interface accepted")
	}
	b.TunInterface = "spsecond"
	if err = SaveTunnel(database, &b, true); err != nil {
		t.Fatal(err)
	}
	if err = SaveTunnel(database, &a, false); err != nil {
		t.Fatal("self update rejected:", err)
	}
}
