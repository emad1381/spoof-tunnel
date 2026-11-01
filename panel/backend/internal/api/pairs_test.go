package api

import (
	"strings"
	"testing"
)

func TestPairDirection(t *testing.T) {
	l, r, err := buildPair(pairRequest{Name: "test", LocalIP: "203.0.113.1", RemoteIP: "203.0.113.2", LocalSpoof: "198.51.100.1", RemoteSpoof: "198.51.100.2", Listen: "127.0.0.1:5000", Forward: "127.0.0.1:51820", Upload: "tcp", Download: "udp", LocalPort: 5001, RemotePort: 8090})
	if err != nil {
		t.Fatal(err)
	}
	if l.SendTransport != r.RecvTransport || l.RecvTransport != r.SendTransport || l.RemotePort != r.ListenPort || l.RecvPort != r.ClientPort || l.SpoofIP != r.PeerSpoofIP || r.SpoofIP != l.PeerSpoofIP {
		t.Fatal("mismatched pair")
	}
}

func TestPairAllowsPersianNamesByCharacterCount(t *testing.T) {
	_, _, err := buildPair(pairRequest{Name: strings.Repeat("ت", 80), LocalIP: "203.0.113.1", RemoteIP: "203.0.113.2", LocalSpoof: "198.51.100.1", RemoteSpoof: "198.51.100.2", Listen: "127.0.0.1:5000", Forward: "127.0.0.1:51820", Upload: "tcp", Download: "udp", LocalPort: 5001, RemotePort: 8090})
	if err != nil {
		t.Fatal(err)
	}
}
