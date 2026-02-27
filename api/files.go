package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"absenpanel/config"

	"github.com/gin-gonic/gin"
)

type FileEntry struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
}

func safePath(requestedPath string) (string, error) {
	clean := filepath.Clean(requestedPath)
	full := filepath.Join(config.Cfg.BotDir, clean)
	// Prevent path traversal
	if !strings.HasPrefix(full, config.Cfg.BotDir) {
		return "", fmt.Errorf("access denied")
	}
	return full, nil
}

func ListFiles(c *gin.Context) {
	reqPath := c.DefaultQuery("path", "/")
	fullPath, err := safePath(reqPath)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	entries, err := os.ReadDir(fullPath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Directory not found"})
		return
	}

	files := []FileEntry{}
	for _, e := range entries {
		info, _ := e.Info()
		size := int64(0)
		modTime := ""
		if info != nil {
			size = info.Size()
			modTime = info.ModTime().Format("2006-01-02 15:04")
		}

		// Skip hidden/sensitive directories
		name := e.Name()
		if name == "node_modules" || name == ".git" || name == "SesiWA" {
			continue
		}

		files = append(files, FileEntry{
			Name:    name,
			Path:    filepath.Join(reqPath, name),
			IsDir:   e.IsDir(),
			Size:    size,
			ModTime: modTime,
		})
	}

	// Sort: dirs first, then alphabetical
	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir != files[j].IsDir {
			return files[i].IsDir
		}
		return files[i].Name < files[j].Name
	})

	c.JSON(http.StatusOK, gin.H{"path": reqPath, "files": files})
}

func ReadFile(c *gin.Context) {
	reqPath := c.Query("path")
	fullPath, err := safePath(reqPath)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	info, err := os.Stat(fullPath)
	if err != nil || info.IsDir() {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Limit file size to 1MB
	if info.Size() > 1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 1MB)"})
		return
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"content": string(data), "path": reqPath, "size": info.Size()})
}

type WriteRequest struct {
	Path    string `json:"path" binding:"required"`
	Content string `json:"content" binding:"required"`
}

func WriteFile(c *gin.Context) {
	var req WriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	fullPath, err := safePath(req.Path)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// Block editing sensitive files
	base := filepath.Base(fullPath)
	if base == ".env" || strings.HasPrefix(base, "panel.db") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot edit this file"})
		return
	}

	if err := os.WriteFile(fullPath, []byte(req.Content), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteFile(c *gin.Context) {
	reqPath := c.Query("path")
	fullPath, err := safePath(reqPath)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	if err := os.RemoveAll(fullPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

type MkdirRequest struct {
	Path string `json:"path" binding:"required"`
}

func MakeDir(c *gin.Context) {
	var req MkdirRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	fullPath, err := safePath(req.Path)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	if err := os.MkdirAll(fullPath, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create directory"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Unused import guard
var _ = io.Discard
