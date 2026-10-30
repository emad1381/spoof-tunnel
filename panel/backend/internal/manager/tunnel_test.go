//go:build linux

package manager

import (
	"encoding/base64"
	"github.com/ParsaKSH/spoof-tunnel/panel/internal/db"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRestartWaitsAndConfigIsPrivate(t *testing.T) {
	dir := t.TempDir()
	database, err := db.InitDB(filepath.Join(dir, "panel.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { d, _ := database.DB(); d.Close() }()
	script := []byte("#!/bin/sh\ntrap 'exit 0' INT TERM\nwhile :; do sleep 0.05; done\n")
	if err = os.WriteFile(filepath.Join(dir, "spoof-l3"), script, 0700); err != nil {
		t.Fatal(err)
	}
	c := db.TunnelInstance{Name: "test", Engine: "tun", Mode: "local", LocalIP: "192.0.2.1", RemoteAddr: "192.0.2.2", SpoofIP: "198.51.100.1", PeerSpoofIP: "198.51.100.2", SendTransport: "icmp", RecvTransport: "icmp", RemotePort: 8090, RecvPort: 5001, TunInterface: "emadtest", TunAddress: "10.77.0.1/30", TunPeer: "10.77.0.2", TunMTU: 1280, PSK: base64.StdEncoding.EncodeToString(make([]byte, 32))}
	if err = database.Create(&c).Error; err != nil {
		t.Fatal(err)
	}
	m := NewManager(database, filepath.Join(dir, "spoof"), dir)
	defer m.StopAll()
	if err = m.StartInstance(c.ID); err != nil {
		t.Fatal(err)
	}
	if err = m.StartInstance(c.ID); err == nil {
		t.Fatal("duplicate start accepted")
	}
	time.Sleep(100 * time.Millisecond)
	if err = m.RestartInstance(c.ID); err != nil {
		t.Fatal(err)
	}
	if status, _ := m.InstanceStatus(c.ID); status != StatusRunning {
		t.Fatalf("new process status: %s", status)
	}
	if err = m.StopInstance(c.ID); err != nil {
		t.Fatal(err)
	}
	if status, _ := m.InstanceStatus(c.ID); status != StatusStopped {
		t.Fatalf("stop status: %s", status)
	}
	info, err := os.Stat(m.configFilePath(c.ID))
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("config permissions: %v %v", info, err)
	}
}
