package l3

import (
	"encoding/base64"
	"fmt"
	"net"
	"regexp"
)

// Config describes one authenticated IPv4 point-to-point TUN link.
type Config struct {
	Role        string `json:"role"`
	LocalIP     string `json:"local_ip"`
	PeerIP      string `json:"peer_ip"`
	SpoofSource string `json:"spoof_source"`
	PeerSpoof   string `json:"peer_spoof"`
	Send        string `json:"send"`
	Receive     string `json:"receive"`
	SendPort    int    `json:"send_port"`
	ReceivePort int    `json:"receive_port"`
	Interface   string `json:"interface"`
	Address     string `json:"address"`
	PeerAddress string `json:"peer_address"`
	MTU         int    `json:"mtu"`
	PSK         string `json:"psk"`
}

var ifaceName = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_-]{0,14}$`)

func Protocol(s string) int {
	switch s {
	case "icmp":
		return 1
	case "tcp":
		return 6
	case "udp":
		return 17
	case "ipip":
		return 4
	case "experimental":
		return 253
	}
	return 0
}
func (c Config) Validate() error {
	if c.Role != "local" && c.Role != "remote" {
		return fmt.Errorf("role must be local or remote")
	}
	for _, v := range []string{c.LocalIP, c.PeerIP, c.SpoofSource, c.PeerSpoof} {
		ip := net.ParseIP(v)
		if ip == nil || ip.To4() == nil || ip.IsUnspecified() || ip.IsMulticast() {
			return fmt.Errorf("endpoint and spoof addresses must be unicast IPv4")
		}
	}
	if c.LocalIP == c.PeerIP {
		return fmt.Errorf("real endpoints must differ")
	}
	if c.SpoofSource == c.PeerSpoof {
		return fmt.Errorf("use distinct spoof source addresses")
	}
	if Protocol(c.Send) == 0 || Protocol(c.Receive) == 0 {
		return fmt.Errorf("unsupported carrier")
	}
	if c.SendPort < 1 || c.SendPort > 65535 || c.ReceivePort < 1 || c.ReceivePort > 65535 {
		return fmt.Errorf("carrier ports must be 1–65535")
	}
	if !ifaceName.MatchString(c.Interface) {
		return fmt.Errorf("interface must be 1–15 safe characters starting with a letter")
	}
	ip, network, err := net.ParseCIDR(c.Address)
	if err != nil || ip.To4() == nil {
		return fmt.Errorf("TUN address must be IPv4 CIDR")
	}
	peer := net.ParseIP(c.PeerAddress)
	if peer == nil || peer.To4() == nil || !network.Contains(peer) || peer.Equal(ip) {
		return fmt.Errorf("TUN peer must be a different address in the same subnet")
	}
	if network.Contains(net.ParseIP(c.LocalIP)) || network.Contains(net.ParseIP(c.PeerIP)) {
		return fmt.Errorf("TUN subnet must not contain real server endpoints")
	}
	ones, _ := network.Mask.Size()
	if ones < 16 || ones > 30 {
		return fmt.Errorf("TUN subnet prefix must be /16 through /30")
	}
	if c.MTU < 576 || c.MTU > 1300 {
		return fmt.Errorf("MTU must be 576–1300")
	}
	key, err := base64.StdEncoding.DecodeString(c.PSK)
	if err != nil || len(key) != 32 {
		return fmt.Errorf("PSK must be a base64-encoded 32-byte key")
	}
	return nil
}
