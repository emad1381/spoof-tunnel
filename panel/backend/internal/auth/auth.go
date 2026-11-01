package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrTokenExpired       = errors.New("token expired")
)

// jwtSecret is generated at startup
var jwtSecret []byte

func init() {
	jwtSecret = make([]byte, 32)
	if _, err := rand.Read(jwtSecret); err != nil {
		panic(err)
	}
}

// SetSecret allows setting a persistent JWT secret
func SetSecret(secret string) {
	jwtSecret = []byte(secret)
}

// HashPassword creates a bcrypt hash
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword verifies a password against a hash
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Claims for JWT
type Claims struct {
	TokenVersion uint   `json:"token_version"`
	UserID       uint   `json:"user_id"`
	Username     string `json:"username"`
	jwt.RegisteredClaims
}

// GenerateToken creates a JWT token
func GenerateToken(userID uint, username string, versions ...uint) (string, error) {
	version := uint(0)
	if len(versions) > 0 {
		version = versions[0]
	}
	claims := &Claims{
		TokenVersion: version,
		UserID:       userID,
		Username:     username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ValidateToken parses and validates a JWT token
func ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrTokenExpired
	}

	return claims, nil
}

// GenerateRandomString creates a random hex string
func GenerateRandomString(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)[:length]
}

// GenerateRandomPort generates a random port between 10000-60000
func GenerateRandomPort() int {
	for attempt := 0; attempt < 32; attempt++ {
		value, err := rand.Int(rand.Reader, big.NewInt(50000))
		if err != nil {
			panic(err)
		}
		port := 10000 + int(value.Int64())
		listener, err := net.Listen("tcp4", fmt.Sprintf("0.0.0.0:%d", port))
		if err == nil {
			_ = listener.Close()
			return port
		}
	}
	panic("cannot find an available panel port")
}
