package db

import (
	"fmt"
	"github.com/ParsaKSH/spoof-tunnel/panel/internal/auth"
	"gorm.io/gorm"
)

// ChangePassword is shared by HTTP and CLI resets. Increment in SQL so
// concurrent password changes cannot accidentally preserve an older version.
func ChangePassword(database *gorm.DB, user *User, password string) error {
	if len(password) < 12 || len(password) > 72 {
		return fmt.Errorf("password must be 12–72 bytes")
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	return database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(user).Updates(map[string]interface{}{"password_hash": hash, "token_version": gorm.Expr("token_version + 1")}).Error; err != nil {
			return err
		}
		if err := tx.First(user, user.ID).Error; err != nil {
			return err
		}
		return tx.Where("key = ?", "admin_password").Delete(&Setting{}).Error
	})
}
