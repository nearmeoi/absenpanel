package auth

import (
	"net/http"
	"strings"
	"time"

	"absenpanel/database"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func LoginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username and password required"})
		return
	}

	if !database.ValidateUser(req.Username, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"username": req.Username,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	})

	secret := c.MustGet("jwt_secret").(string)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": tokenString})
}

func JWTMiddleware(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("jwt_secret", secret)

		// Allow login page and static assets
		path := c.Request.URL.Path
		if path == "/login" || path == "/api/auth/login" ||
			strings.HasPrefix(path, "/css/") || strings.HasPrefix(path, "/js/") ||
			path == "/favicon.ico" {
			c.Next()
			return
		}

		// Check Authorization header
		authHeader := c.GetHeader("Authorization")
		tokenString := ""

		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// Also check cookie
		if tokenString == "" {
			if cookie, err := c.Cookie("token"); err == nil {
				tokenString = cookie
			}
		}

		if tokenString == "" {
			// If it's a page request, redirect to login
			if c.GetHeader("Accept") != "" && !strings.Contains(c.GetHeader("Accept"), "application/json") {
				c.Redirect(http.StatusFound, "/login")
				c.Abort()
				return
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
			c.Abort()
			return
		}

		// Validate token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			if !strings.Contains(c.GetHeader("Accept"), "application/json") {
				c.Redirect(http.StatusFound, "/login")
				c.Abort()
				return
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		claims := token.Claims.(jwt.MapClaims)
		c.Set("username", claims["username"])
		c.Next()
	}
}

type ChangePasswordRequest struct {
	OldPassword string `json:"oldPassword" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required"`
}

func ChangePasswordHandler(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Old and new password required"})
		return
	}

	if len(req.NewPassword) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be at least 6 characters"})
		return
	}

	username, _ := c.Get("username")
	if err := database.ChangePassword(username.(string), req.OldPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
