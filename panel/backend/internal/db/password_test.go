package db

import (
	"github.com/ParsaKSH/spoof-tunnel/panel/internal/auth"
	"path/filepath"
	"testing"
)

func TestPasswordResetInvalidatesSessionsAndDoesNotPersistPassword(t *testing.T) {
	database, err := InitDB(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { d, _ := database.DB(); d.Close() }()
	hash, _ := auth.HashPassword("original-password")
	user := User{Username: "admin", PasswordHash: hash, TokenVersion: 4}
	database.Create(&user)
	database.Create(&Setting{Key: "admin_password", Value: "legacy-password"})
	if err := ChangePassword(database, &user, "new-test-password"); err != nil {
		t.Fatal(err)
	}
	if user.TokenVersion != 5 || !auth.CheckPassword("new-test-password", user.PasswordHash) {
		t.Fatal("password or token version was not updated")
	}
	var count int64
	database.Model(&Setting{}).Where("key = ?", "admin_password").Count(&count)
	if count != 0 {
		t.Fatal("plaintext retained")
	}
}
