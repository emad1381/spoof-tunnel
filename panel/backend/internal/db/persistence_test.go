package db

import (
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
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

func TestLegacyForwardDefaultsAndPlaintextMigration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")
	legacy, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	for _, query := range []string{
		"CREATE TABLE forward_rules (id integer PRIMARY KEY, instance_id integer NOT NULL, name text NOT NULL, protocol text DEFAULT 'tcp', listen_port integer NOT NULL, target_port integer NOT NULL, enabled numeric DEFAULT true, created_at datetime, updated_at datetime)",
		"INSERT INTO forward_rules (id, instance_id, name, listen_port, target_port, enabled) VALUES (1, 1, 'preserved', 15443, 443, true)",
		"CREATE TABLE settings (key text PRIMARY KEY, value text)",
		"INSERT INTO settings VALUES ('admin_password','legacy-recoverable-secret')",
		"INSERT INTO settings VALUES ('jwt_secret','persistent-jwt-secret')",
	} {
		if err = legacy.Exec(query).Error; err != nil {
			t.Fatal(err)
		}
	}
	connection, _ := legacy.DB()
	connection.Close()
	migrated, err := InitDB(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { d, _ := migrated.DB(); d.Close() }()
	var rule ForwardRule
	if err = migrated.First(&rule, 1).Error; err != nil || !rule.Enabled || rule.Name != "preserved" {
		t.Fatalf("lost legacy rule: %+v %v", rule, err)
	}
	disabled := ForwardRule{InstanceID: 1, Name: "disabled", ListenPort: 15444, TargetPort: 443, Enabled: false}
	if err = migrated.Create(&disabled).Error; err != nil {
		t.Fatal(err)
	}
	if disabled.Enabled {
		t.Fatal("migration retained true default")
	}
	var count int64
	migrated.Model(&Setting{}).Where("key = ?", "admin_password").Count(&count)
	if count != 0 {
		t.Fatal("plaintext remained")
	}
	var secret Setting
	migrated.Where("key = ?", "jwt_secret").First(&secret)
	if secret.Value != "persistent-jwt-secret" {
		t.Fatal("lost persistent secret")
	}
}
