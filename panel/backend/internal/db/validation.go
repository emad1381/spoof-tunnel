package db

import (
	"fmt"
	"net"
	"strconv"
	"strings"

	"github.com/ParsaKSH/spoof-tunnel/internal/l3"
)

// Validate checks the actual IPv4 datagram relay contract before persisting it.
func (c *TunnelInstance) Validate() error {
	if len(strings.TrimSpace(c.Name)) == 0 || len(c.Name) > 100 {
		return fmt.Errorf("name must contain 1–100 characters")
	}
	if c.Engine == "tun" {
		return c.L3Config().Validate()
	}
	if c.Engine != "" && c.Engine != "udp-relay" {
		return fmt.Errorf("unknown engine")
	}
	if c.Mode != "local" && c.Mode != "remote" {
		return fmt.Errorf("mode must be local or remote")
	}
	for _, t := range []string{c.SendTransport, c.RecvTransport} {
		switch t {
		case "tcp", "udp", "icmp", "icmpv6":
		default:
			return fmt.Errorf("unsupported transport: %s", t)
		}
	}
	ipv4 := func(name, value string, optional bool) error {
		if value == "" && optional {
			return nil
		}
		ip := net.ParseIP(value)
		if ip == nil || ip.To4() == nil || ip.IsUnspecified() || ip.IsMulticast() {
			return fmt.Errorf("%s must be a unicast IPv4 address", name)
		}
		return nil
	}
	if err := ipv4("spoof_ip", c.SpoofIP, strings.TrimSpace(c.SpoofIPList) != ""); err != nil {
		return err
	}
	if err := ipv4("peer_spoof_ip", c.PeerSpoofIP, true); err != nil {
		return err
	}
	for _, line := range strings.Split(c.SpoofIPList, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if err := ipv4("spoof_ip_list", line, false); err != nil {
			return err
		}
	}
	endpoint := func(name, value string) error {
		host, port, err := net.SplitHostPort(value)
		if err != nil {
			return fmt.Errorf("%s must be IPv4:port", name)
		}
		if host != "" {
			if ip := net.ParseIP(host); ip == nil || ip.To4() == nil {
				return fmt.Errorf("%s requires IPv4", name)
			}
		}
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return fmt.Errorf("%s port must be 1–65535", name)
		}
		return nil
	}
	ports := []int{c.SpoofPort}
	if c.Mode == "local" {
		if err := endpoint("listen_addr", c.ListenAddr); err != nil {
			return err
		}
		if err := ipv4("remote_addr", c.RemoteAddr, false); err != nil {
			return err
		}
		ports = append(ports, c.RemotePort, c.RecvPort)
	} else {
		if err := endpoint("forward_addr", c.ForwardAddr); err != nil {
			return err
		}
		if err := ipv4("client_ip", c.ClientIP, false); err != nil {
			return err
		}
		ports = append(ports, c.ListenPort, c.ClientPort)
	}
	for _, port := range ports {
		if port < 1 || port > 65535 {
			return fmt.Errorf("ports must be 1–65535")
		}
	}
	return nil
}

func (c TunnelInstance) L3Config() l3.Config {
	peer, sendPort, recvPort := c.RemoteAddr, c.RemotePort, c.RecvPort
	if c.Mode == "remote" {
		peer, sendPort, recvPort = c.ClientIP, c.ClientPort, c.ListenPort
	}
	var sources []string
	if strings.TrimSpace(c.SpoofIPList) != "" {
		for _, line := range strings.Split(c.SpoofIPList, "\n") {
			line = strings.TrimSpace(line)
			if line != "" && !strings.HasPrefix(line, "#") {
				sources = append(sources, line)
			}
		}
	}
	return l3.Config{
		Role:         c.Mode,
		LocalIP:      c.LocalIP,
		PeerIP:       peer,
		SpoofSource:  c.SpoofIP,
		SpoofSources: sources,
		PeerSpoof:    c.PeerSpoofIP,
		Send:         c.SendTransport,
		Receive:      c.RecvTransport,
		SendPort:     sendPort,
		ReceivePort:  recvPort,
		Interface:    c.TunInterface,
		Address:      c.TunAddress,
		PeerAddress:  c.TunPeer,
		MTU:          c.TunMTU,
		PSK:          c.PSK,
	}
}
