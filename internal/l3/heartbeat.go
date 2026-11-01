package l3

import "time"

// Keep outstanding probes until the reachability timeout, rather than
// invalidating a valid response each time the three-second ticker fires.
type challenges map[[16]byte]time.Time

func (p challenges) add(challenge [16]byte, now time.Time) {
	for id, sent := range p {
		if now.Sub(sent) >= 15*time.Second {
			delete(p, id)
		}
	}
	p[challenge] = now
}
func (p challenges) accept(payload []byte, now time.Time) (time.Time, bool) {
	if len(payload) != 16 {
		return time.Time{}, false
	}
	var id [16]byte
	copy(id[:], payload)
	sent, ok := p[id]
	if !ok {
		return time.Time{}, false
	}
	delete(p, id)
	return sent, now.Sub(sent) < 15*time.Second
}
