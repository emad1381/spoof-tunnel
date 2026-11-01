package forward

import (
	"io"
	"net"
	"runtime"
	"testing"
	"time"
)

func TestRegressionHalfClose(t *testing.T) {
	ln, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	go func() {
		c, e := ln.Accept()
		if e != nil {
			return
		}
		defer c.Close()
		io.ReadAll(c)
		time.Sleep(50 * time.Millisecond)
		c.Write([]byte("reply-after-eof"))
	}()
	f := New("127.0.0.1:0", ln.Addr().String())
	if e = f.Start(); e != nil {
		t.Fatal(e)
	}
	defer f.Stop()
	c, e := net.Dial("tcp", f.BoundAddr())
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	c.Write([]byte("request"))
	c.(*net.TCPConn).CloseWrite()
	c.SetReadDeadline(time.Now().Add(time.Second))
	b, e := io.ReadAll(c)
	if string(b) != "reply-after-eof" {
		t.Fatalf("half-close lost response: received=%q error=%v", b, e)
	}
}
func TestRegressionCompletedConnectionLeaks(t *testing.T) {
	ln, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	go func() {
		for {
			c, e := ln.Accept()
			if e != nil {
				return
			}
			go func(c net.Conn) { defer c.Close(); b := make([]byte, 1); io.ReadFull(c, b); c.Write(b) }(c)
		}
	}()
	f := New("127.0.0.1:0", ln.Addr().String())
	if e = f.Start(); e != nil {
		t.Fatal(e)
	}
	defer f.Stop()
	time.Sleep(50 * time.Millisecond)
	before := runtime.NumGoroutine()
	for i := 0; i < 30; i++ {
		c, e := net.Dial("tcp", f.BoundAddr())
		if e != nil {
			t.Fatal(e)
		}
		c.Write([]byte("x"))
		b := make([]byte, 1)
		io.ReadFull(c, b)
		c.Close()
	}
	time.Sleep(200 * time.Millisecond)
	after := runtime.NumGoroutine()
	if after-before >= 25 {
		t.Fatalf("30 finished connections left %d goroutines until forwarder stops", after-before)
	}
}
func TestRegressionImmediateStop(t *testing.T) {
	old := runtime.GOMAXPROCS(1)
	defer runtime.GOMAXPROCS(old)
	f := New("127.0.0.1:0", "127.0.0.1:1")
	if e := f.Start(); e != nil {
		t.Fatal(e)
	}
	f.Stop()
}
