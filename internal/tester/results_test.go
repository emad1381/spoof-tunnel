package tester

import (
	"testing"
)

func TestPreviewIsBoundedButExportIncludesEveryResult(t *testing.T) {
	r := NewRunner()
	r.SetTmpDir(t.TempDir())
	r.state = TesterState{Status: "running", Mode: "receiver"}
	r.received = make(map[uint32]int)
	r.recvCfgPkt = 1
	for i := uint32(1); i <= 1000; i++ {
		r.received[i] = 1
		r.receivedOrder = append(r.receivedOrder, i)
	}
	r.recvPassed = 1000
	preview, err := r.ResultsLimit(200)
	if err != nil || len(preview) != 200 {
		t.Fatalf("preview: %d %v", len(preview), err)
	}
	if r.State().PassedCount != 1000 {
		t.Fatal("preview changed total count")
	}
	all, err := r.Results()
	if err != nil || len(all) != 1000 {
		t.Fatalf("export: %d %v", len(all), err)
	}
	if preview[0].IP != "0.0.0.1" {
		t.Fatal("preview order changed")
	}
	r.flushInterimResults(1, 0)
	r.state.Status = "done"
	preview, err = r.ResultsLimit(200)
	if err != nil || len(preview) != 200 {
		t.Fatalf("file preview: %d %v", len(preview), err)
	}
	all, err = r.Results()
	if err != nil || len(all) != 1000 {
		t.Fatalf("file export: %d %v", len(all), err)
	}
}
