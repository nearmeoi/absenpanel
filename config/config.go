package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port      int
	Env       string
	JWTSecret string
	DBPath    string
	AdminUser string
	AdminPass string
	BotDir    string
	BotName   string
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

var Cfg *Config

func Load() *Config {
	port, _ := strconv.Atoi(getEnv("PANEL_PORT", "3001"))
	Cfg = &Config{
		Port:      port,
		Env:       getEnv("PANEL_ENV", "development"),
		JWTSecret: getEnv("PANEL_JWT_SECRET", "absenpanel-secret-change-me"),
		DBPath:    getEnv("PANEL_DB_PATH", "./data/panel.db"),
		AdminUser: getEnv("PANEL_ADMIN_USER", "admin"),
		AdminPass: getEnv("PANEL_ADMIN_PASS", "admin"),
		BotDir:    getEnv("BOT_DIR", "/home/ubuntu/absenbot"),
		BotName:   getEnv("BOT_PM2_NAME", "absenbot"),
	}
	return Cfg
}
