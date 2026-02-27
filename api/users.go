package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

type BotUser struct {
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Name     string `json:"name,omitempty"`
	Template string `json:"template,omitempty"`
}

func ListUsers(c *gin.Context) {
	usersFile := filepath.Join(basePath, "users.json")

	data, err := os.ReadFile(usersFile)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"users": []BotUser{}})
		return
	}

	var users map[string]json.RawMessage
	if err := json.Unmarshal(data, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users, "count": len(users)})
}
