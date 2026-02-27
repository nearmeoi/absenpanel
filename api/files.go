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

// ── Rename ──

type RenameRequest struct {
	Source  string `json:"source" binding:"required"`
	NewName string `json:"newName" binding:"required"`
}

func RenameFile(c *gin.Context) {
	var req RenameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	srcFull, err := safePath(req.Source)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	parentDir := filepath.Dir(srcFull)
	newFull := filepath.Join(parentDir, filepath.Base(req.NewName))

	if !strings.HasPrefix(newFull, config.Cfg.BotDir) {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	if err := os.Rename(srcFull, newFull); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rename: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ── Copy / Move (Paste) ──

type PasteRequest struct {
	Action      string `json:"action" binding:"required"`
	Source      string `json:"source" binding:"required"`
	Destination string `json:"destination" binding:"required"`
}

func PasteFile(c *gin.Context) {
	var req PasteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	srcFull, err := safePath(req.Source)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	dstDir, err := safePath(req.Destination)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	srcName := filepath.Base(srcFull)
	dstFull := filepath.Join(dstDir, srcName)

	if req.Action == "cut" {
		if err := os.Rename(srcFull, dstFull); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to move: " + err.Error()})
			return
		}
	} else {
		if err := copyPath(srcFull, dstFull); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to copy: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func copyPath(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return copyDir(src, dst)
	}
	return copyFileFn(src, dst)
}

func copyFileFn(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func copyDir(src, dst string) error {
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if err := copyPath(filepath.Join(src, e.Name()), filepath.Join(dst, e.Name())); err != nil {
			return err
		}
	}
	return nil
}
