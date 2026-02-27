package main

import (
	"fmt"
	"log"
	"os"

	"absenpanel/api"
	"absenpanel/auth"
	"absenpanel/config"
	"absenpanel/database"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	// Init database
	database.Init(cfg.DBPath)
	database.EnsureAdmin(cfg.AdminUser, cfg.AdminPass)

	// Set Gin mode
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Serve static files
	r.Static("/css", "./web/css")
	r.Static("/js", "./web/js")
	r.StaticFile("/favicon.ico", "./web/favicon.ico")

	// Public routes
	r.GET("/login", func(c *gin.Context) { c.File("./web/login.html") })

	// Protected routes
	authorized := r.Group("/")
	authorized.Use(auth.JWTMiddleware(cfg.JWTSecret))
	{
		// Auth API (middleware skips auth for this path but sets jwt_secret)
		authorized.POST("/api/auth/login", auth.LoginHandler)

		// Pages
		authorized.GET("/", func(c *gin.Context) { c.File("./web/dashboard.html") })
		authorized.GET("/console", func(c *gin.Context) { c.File("./web/console.html") })
		authorized.GET("/files", func(c *gin.Context) { c.File("./web/files.html") })
		authorized.GET("/whatsapp", func(c *gin.Context) { c.File("./web/whatsapp.html") })
		authorized.GET("/users", func(c *gin.Context) { c.File("./web/users.html") })
		authorized.GET("/settings", func(c *gin.Context) { c.File("./web/settings.html") })

		// API
		authorized.GET("/api/stats", api.GetStats)
		authorized.GET("/api/bot/status", api.GetBotStatus)
		authorized.POST("/api/bot/start", api.BotStart)
		authorized.POST("/api/bot/stop", api.BotStop)
		authorized.POST("/api/bot/restart", api.BotRestart)
		authorized.POST("/api/bot/kill", api.BotKill)

		// File manager
		authorized.GET("/api/files", api.ListFiles)
		authorized.GET("/api/files/read", api.ReadFile)
		authorized.POST("/api/files/write", api.WriteFile)
		authorized.DELETE("/api/files", api.DeleteFile)
		authorized.POST("/api/files/mkdir", api.MakeDir)

		// Users
		authorized.GET("/api/users", api.ListUsers)

		// Terminal WebSocket
		authorized.GET("/api/terminal", api.TerminalHandler)
	}

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("🚀 AbsenPanel running on http://localhost%s", addr)

	if err := r.Run(addr); err != nil {
		log.Fatal("Failed to start server:", err)
		os.Exit(1)
	}
}
