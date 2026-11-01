package l3

import (
	"testing"
	"time"
)

func TestDelayedHeartbeatResponse(t *testing.T) {
	probes := make(challenges)
	now := time.Now()
	a, b := [16]byte{1}, [16]byte{2}
	probes.add(a, now)
	probes.add(b, now.Add(3*time.Second))
	if _, ok := probes.accept(a[:], now.Add(3400*time.Millisecond)); !ok {
		t.Fatal("discarded a valid delayed response")
	}
	if _, ok := probes.accept(a[:], now.Add(4*time.Second)); ok {
		t.Fatal("accepted a duplicate heartbeat")
	}
	probes.add(a, now)
	if _, ok := probes.accept(a[:], now.Add(16*time.Second)); ok {
		t.Fatal("accepted an expired heartbeat")
	}
}
