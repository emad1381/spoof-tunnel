package db

import "testing"

func TestValidate(t *testing.T) {
	c := TunnelInstance{Name: "test", Mode: "local", SendTransport: "tcp", RecvTransport: "udp", ListenAddr: "127.0.0.1:5000", RemoteAddr: "203.0.113.2", RemotePort: 8090, RecvPort: 5001, SpoofIP: "198.51.100.1", SpoofPort: 443}
	if err := c.Validate(); err != nil {
		t.Fatal(err)
	}
	c.RemotePort = 65536
	if c.Validate() == nil {
		t.Fatal("accepted overflowing port")
	}
	c.RemotePort = 8090
	c.SpoofIP = "::1"
	if c.Validate() == nil {
		t.Fatal("accepted IPv6 source")
	}
}
