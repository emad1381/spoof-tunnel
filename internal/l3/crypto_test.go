package l3

import (
	"encoding/base64"
	"testing"
)

func TestAuthenticatedFrames(t *testing.T) {
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	a, _ := NewCodec(key, "local")
	b, _ := NewCodec(key, "remote")
	frame := a.Seal(1, []byte("TCP and UDP can be carried as IP"))
	tampered := append([]byte(nil), frame...)
	tampered[len(tampered)-1] ^= 1
	if _, _, err := b.Open(tampered); err == nil {
		t.Fatal("accepted modified ciphertext")
	}
	kind, data, err := b.Open(frame)
	if err != nil || kind != 1 || string(data) != "TCP and UDP can be carried as IP" {
		t.Fatal("roundtrip", err)
	}
	if _, _, err = b.Open(frame); err == nil {
		t.Fatal("accepted replay")
	}
	if _, _, err = a.Open(frame); err == nil {
		t.Fatal("accepted reflection")
	}
	other := make([]byte, 32)
	other[0] = 1
	wrong, _ := NewCodec(base64.StdEncoding.EncodeToString(other), "remote")
	if _, _, err = wrong.Open(a.Seal(2, []byte("probe"))); err == nil {
		t.Fatal("accepted wrong key")
	}
}
func TestReordering(t *testing.T) {
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	a, _ := NewCodec(key, "local")
	b, _ := NewCodec(key, "remote")
	frames := make([][]byte, 1100)
	for i := range frames {
		frames[i] = a.Seal(1, []byte{byte(i)})
	}
	for _, i := range []int{0, 4, 2, 3, 1, 1099, 1098} {
		if _, _, err := b.Open(frames[i]); err != nil {
			t.Fatalf("reordered %d: %v", i, err)
		}
	}
	if _, _, err := b.Open(frames[5]); err == nil {
		t.Fatal("accepted frame outside replay window")
	}
}
