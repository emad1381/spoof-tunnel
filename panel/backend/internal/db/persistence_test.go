package db

import (
	"path/filepath"
	"testing"
)

func TestMigrationPreservesData(t *testing.T) {
	path := filepath.Join(t.TempDir(), "panel.db")
	first, err := InitDB(path)
	if err != nil {
		t.Fatal(err)
	}
	if err = first.Create(&User{Username: "admin", PasswordHash: "fixture", TokenVersion: 3}).Error; err != nil {
		t.Fatal(err)
	}
	if err = first.Create(&Setting{Key: "web_path", Value: "persisted-path"}).Error; err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := first.DB()
	sqlDB.Close()
	second, err := InitDB(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { d, _ := second.DB(); d.Close() }()
	var user User
	if err = second.First(&user).Error; err != nil || user.Username != "admin" || user.TokenVersion != 3 {
		t.Fatalf("lost user: %+v %v", user, err)
	}
	var setting Setting
	if err = second.Where("key = ?", "web_path").First(&setting).Error; err != nil || setting.Value != "persisted-path" {
		t.Fatalf("lost setting: %+v %v", setting, err)
	}
}
