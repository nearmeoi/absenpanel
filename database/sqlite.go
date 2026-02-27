package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func Init(dbPath string) {
	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}

	// Create tables
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS panel_users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		log.Fatal("Failed to create tables:", err)
	}

	log.Println("📦 Database initialized")
}

func EnsureAdmin(username, password string) {
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM panel_users WHERE username = ?", username).Scan(&count)
	if count == 0 {
		hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		DB.Exec("INSERT INTO panel_users (username, password) VALUES (?, ?)", username, string(hash))
		log.Printf("👤 Admin user '%s' created", username)
	}
}

func ValidateUser(username, password string) bool {
	var hash string
	err := DB.QueryRow("SELECT password FROM panel_users WHERE username = ?", username).Scan(&hash)
	if err != nil {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func ChangePassword(username, oldPassword, newPassword string) error {
	if !ValidateUser(username, oldPassword) {
		return fmt.Errorf("invalid current password")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password")
	}
	_, err = DB.Exec("UPDATE panel_users SET password = ? WHERE username = ?", string(hash), username)
	if err != nil {
		return fmt.Errorf("failed to update password")
	}
	return nil
}
