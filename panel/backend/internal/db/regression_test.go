package db

import (
	"path/filepath"
	"testing"
)

func TestDisabledForwardRemainsDisabled(t *testing.T) {
	d, e := InitDB(filepath.Join(t.TempDir(), "test.db"))
	if e != nil {
		t.Fatal(e)
	}
	defer func() { s, _ := d.DB(); s.Close() }()
	r := ForwardRule{InstanceID: 1, Name: "disabled", Protocol: "tcp", ListenPort: 14443, TargetPort: 443, Enabled: false}
	if e = d.Create(&r).Error; e != nil {
		t.Fatal(e)
	}
	var got ForwardRule
	d.First(&got, r.ID)
	if got.Enabled {
		t.Fatal("disabled=false became enabled=true during Create")
	}
}
