// Package forward implements the reverse-tunnel port forwarder.
//
// This is the missing piece between a TUN-only tunnel and a real client
// entry point. The spoof-l3 TUN engine is a virtual cable between two
// servers: it carries IP packets, but it does NOT listen on a public TCP
// port for end-user clients. A client (phone/laptop) cannot dial a TUN
// address, and it cannot dial a tunnel carrier port either (8090/5001
// are carrier identifiers, not TCP listeners).
//
// The forwarder closes that gap, on the entry side only (typically the
// Iran server):
//
//	client (phone) ──TCP──> Iran public IP:LISTEN_PORT
//	                     ──forwarder──> foreign TUN IP:TARGET_PORT
//	                     ──inside spoof TUN──> 3x-ui / Xray on foreign
//
// It is a plain byte pipe: it never decrypts, parses, or rewrites the
// application protocol. A VLESS handshake passes through untouched, so
// the client config keeps the foreign inbound's UUID/transport/security
// and only its address/port point at the Iran entry.
//
// v1 is TCP only. UDP is deliberately rejected by the API layer: a UDP
// forwarder needs session tracking (source address + timeout + cleanup)
// and must not be faked by a TCP-shaped copy. That is a separate v2.
//
// Safety rules enforced by callers (API), not here:
//   - ListenPort must not collide with any tunnel carrier port on any
//     tunnel on this host, or with another enabled forwarder's
//     ListenPort.
//   - Target is always the tunnel's peer TUN address (TunPeer), never an
//     arbitrary public IP, so a rule cannot be used to proxy elsewhere.
package forward

import (
	"fmt"
	"io"
	"log"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

// Forwarder is one TCP listen -> target pipe.
type Forwarder struct {
	ListenAddr string // e.g. "0.0.0.0:443"
	TargetAddr string // e.g. "10.77.0.2:443" (peer TUN IP + inbound port)

	mu        sync.Mutex
	listener  net.Listener
	done      chan struct{}
	wg        sync.WaitGroup
	listening bool
	lastErr   string
	// Active pipes, so Stop can close idle long-lived connections
	// (e.g. a VLESS session) instead of waiting for them forever.
	conns map[net.Conn]struct{}

	connections int64
	bytesUp     int64 // client -> target
	bytesDown   int64 // target -> client
}

type countingWriter struct {
	w       io.Writer
	counter *int64
}

func (c *countingWriter) Write(p []byte) (int, error) {
	n, err := c.w.Write(p)
	atomic.AddInt64(c.counter, int64(n))
	return n, err
}

// Stats is a snapshot for the panel UI.
type Stats struct {
	Listening   bool   `json:"listening"`
	Connections int64  `json:"connections"`
	BytesUp     int64  `json:"bytes_up"`
	BytesDown   int64  `json:"bytes_down"`
	LastError   string `json:"last_error"`
}

// New returns a stopped forwarder. It binds nothing until Start.
func New(listenAddr, targetAddr string) *Forwarder {
	return &Forwarder{ListenAddr: listenAddr, TargetAddr: targetAddr}
}

// Start binds the listen port and starts accepting. Starting an already
// running forwarder is a no-op.
func (f *Forwarder) Start() error {
	f.mu.Lock()
	if f.listening {
		f.mu.Unlock()
		return nil
	}
	ln, err := net.Listen("tcp", f.ListenAddr)
	if err != nil {
		f.lastErr = err.Error()
		f.mu.Unlock()
		return fmt.Errorf("forward listen %s: %w", f.ListenAddr, err)
	}
	f.listener = ln
	f.done = make(chan struct{})
	f.conns = make(map[net.Conn]struct{})
	f.listening = true
	f.lastErr = ""
	f.mu.Unlock()

	log.Printf("[forward] listening %s -> %s", f.ListenAddr, f.TargetAddr)
	f.wg.Add(1)
	go f.acceptLoop()
	return nil
}

// Stop closes the listener, closes every active pipe, and waits for
// the accept loop and pipes to drain. Stopping a stopped forwarder is
// a no-op. It never waits on an idle connection: Stop closes the pipes'
// connections, and each pipe also watches the stop signal (see pipe),
// so a connection accepted in the narrow window between the snapshot
// and the listener close cannot hang Stop forever.
func (f *Forwarder) Stop() {
	f.mu.Lock()
	if !f.listening {
		f.mu.Unlock()
		return
	}
	ln := f.listener
	done := f.done
	conns := make([]net.Conn, 0, len(f.conns))
	for c := range f.conns {
		conns = append(conns, c)
	}
	f.listening = false
	f.listener = nil
	f.mu.Unlock()

	_ = ln.Close()
	close(done)
	// Unblock idle pipes; their Copy calls then return and wg drains.
	for _, c := range conns {
		_ = c.Close()
	}
	f.wg.Wait()
	log.Printf("[forward] stopped %s -> %s", f.ListenAddr, f.TargetAddr)
}

// ListenAddr returns the actual bound address (useful when the
// configured port was 0 in tests).
func (f *Forwarder) BoundAddr() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.listener == nil {
		return f.ListenAddr
	}
	return f.listener.Addr().String()
}

// Stats returns a point-in-time snapshot.
func (f *Forwarder) Stats() Stats {
	f.mu.Lock()
	defer f.mu.Unlock()
	return Stats{
		Listening:   f.listening,
		Connections: atomic.LoadInt64(&f.connections),
		BytesUp:     atomic.LoadInt64(&f.bytesUp),
		BytesDown:   atomic.LoadInt64(&f.bytesDown),
		LastError:   f.lastErr,
	}
}

func (f *Forwarder) acceptLoop() {
	defer f.wg.Done()
	// Capture the listener and stop channel once: Stop nils f.listener,
	// and re-reading it here would race that write and could call
	// Accept on nil.
	f.mu.Lock()
	ln := f.listener
	done := f.done
	f.mu.Unlock()
	for {
		conn, err := ln.Accept()
		if err != nil {
			select {
			case <-f.done:
				return // intentional Stop
			default:
				f.mu.Lock()
				f.lastErr = err.Error()
				f.mu.Unlock()
				// Brief backoff so a transient accept error cannot spin.
				time.Sleep(100 * time.Millisecond)
				continue
			}
		}
		atomic.AddInt64(&f.connections, 1)
		f.wg.Add(1)
		go f.pipe(conn, done)
	}
}

func (f *Forwarder) pipe(client net.Conn, done chan struct{}) {
	defer f.wg.Done()
	f.mu.Lock()
	f.conns[client] = struct{}{}
	f.mu.Unlock()
	defer func() {
		f.mu.Lock()
		delete(f.conns, client)
		f.mu.Unlock()
	}()
	target, err := net.DialTimeout("tcp", f.TargetAddr, 10*time.Second)
	if err != nil {
		f.mu.Lock()
		f.lastErr = fmt.Sprintf("dial %s: %v", f.TargetAddr, err)
		f.mu.Unlock()
		_ = client.Close()
		return
	}
	f.mu.Lock()
	f.conns[target] = struct{}{}
	f.mu.Unlock()
	defer func() {
		f.mu.Lock()
		delete(f.conns, target)
		f.mu.Unlock()
	}()
	// If Stop fires while this pipe is idle, close both ends so the
	// Copies below return and Stop's wg.Wait cannot hang on it.
	go func() {
		<-done
		_ = client.Close()
		_ = target.Close()
	}()
	copyDone := make(chan struct{}, 2)
	// Count per Write, not at Copy return: live stats must move while
	// a long-lived connection is still open, not only after it closes.
	copyOne := func(dst, src net.Conn, counter *int64) {
		_, _ = io.Copy(&countingWriter{w: dst, counter: counter}, src)
		// Closing one side unblocks the other direction's Copy.
		_ = dst.Close()
		_ = src.Close()
		copyDone <- struct{}{}
	}
	go copyOne(target, client, &f.bytesUp)
	go copyOne(client, target, &f.bytesDown)
	<-copyDone
	_ = client.Close()
	_ = target.Close()
}
