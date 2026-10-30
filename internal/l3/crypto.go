package l3

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"sync"
	"time"
)

const headerSize = 36

var errFrame = errors.New("invalid, expired, unauthenticated or replayed frame")

type replay struct {
	max   uint64
	seen  [1024]uint64
	until int64
}
type Codec struct {
	mu      sync.Mutex
	tx, rx  []byte
	session [16]byte
	seq     uint64
	peers   map[[16]byte]*replay
}

func derive(key []byte, label string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(label))
	return h.Sum(nil)
}
func NewCodec(psk, role string) (*Codec, error) {
	key, err := base64.StdEncoding.DecodeString(psk)
	if err != nil || len(key) != 32 {
		return nil, errFrame
	}
	a, b := "emad-l3-v1/local-to-remote", "emad-l3-v1/remote-to-local"
	if role == "remote" {
		a, b = b, a
	}
	c := &Codec{tx: derive(key, a), rx: derive(key, b), peers: make(map[[16]byte]*replay)}
	if _, err = rand.Read(c.session[:]); err != nil {
		return nil, err
	}
	return c, nil
}
func aead(key []byte, session []byte) cipher.AEAD {
	b, _ := aes.NewCipher(derive(key, string(session)))
	a, _ := cipher.NewGCM(b)
	return a
}
func (c *Codec) Seal(kind byte, payload []byte) []byte {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.seq++
	h := make([]byte, headerSize)
	copy(h, "EML1")
	copy(h[4:20], c.session[:])
	binary.BigEndian.PutUint64(h[20:28], c.seq)
	binary.BigEndian.PutUint64(h[28:36], uint64(time.Now().Unix()))
	nonce := make([]byte, 12)
	copy(nonce[4:], h[20:28])
	plain := append([]byte{kind}, payload...)
	return aead(c.tx, c.session[:]).Seal(h, nonce, plain, h)
}
func (c *Codec) Open(frame []byte) (byte, []byte, error) {
	if len(frame) < headerSize+17 || string(frame[:4]) != "EML1" {
		return 0, nil, errFrame
	}
	now := time.Now().Unix()
	stamp := int64(binary.BigEndian.Uint64(frame[28:36]))
	if stamp < now-120 || stamp > now+30 {
		return 0, nil, errFrame
	}
	var session [16]byte
	copy(session[:], frame[4:20])
	seq := binary.BigEndian.Uint64(frame[20:28])
	if seq == 0 {
		return 0, nil, errFrame
	}
	nonce := make([]byte, 12)
	copy(nonce[4:], frame[20:28])
	plain, err := aead(c.rx, session[:]).Open(nil, nonce, frame[headerSize:], frame[:headerSize])
	if err != nil || len(plain) == 0 {
		return 0, nil, errFrame
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	r := c.peers[session]
	if r == nil {
		for id, p := range c.peers {
			if p.until < now {
				delete(c.peers, id)
			}
		}
		if len(c.peers) >= 64 {
			return 0, nil, errFrame
		}
		r = &replay{}
		c.peers[session] = r
	}
	if seq <= r.max && r.max-seq >= 1024 {
		return 0, nil, errFrame
	}
	if r.seen[seq%1024] == seq {
		return 0, nil, errFrame
	}
	r.seen[seq%1024] = seq
	if seq > r.max {
		r.max = seq
	}
	if stamp+121 > r.until {
		r.until = stamp + 121
	}
	return plain[0], plain[1:], nil
}
