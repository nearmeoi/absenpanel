package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log"
	"net/http"
	"os/exec"

	"absenpanel/config"

	"github.com/gin-gonic/gin"
)

// DeployWebhook handles GitHub push webhooks and triggers auto-deploy
func DeployWebhook(c *gin.Context) {
	secret := config.Cfg.WebhookSecret
	if secret == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Webhook not configured — set WEBHOOK_SECRET env var"})
		return
	}

	// Read body
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot read body"})
		return
	}

	// Verify GitHub HMAC-SHA256 signature
	signature := c.GetHeader("X-Hub-Signature-256")
	if signature == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No signature"})
		return
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expected)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	// Only deploy on push events
	event := c.GetHeader("X-GitHub-Event")
	if event != "push" {
		c.JSON(http.StatusOK, gin.H{"message": "Ignored event: " + event})
		return
	}

	// Trigger deploy in background (respond immediately)
	go runDeploy()

	c.JSON(http.StatusOK, gin.H{"message": "Deploy triggered ✓"})
}

func runDeploy() {
	appDir := config.Cfg.AppDir
	log.Println("🚀 [deploy] Starting auto-deploy...")

	// Step 1: git pull
	out, err := exec.Command("bash", "-c", "cd "+appDir+" && git pull origin main").CombinedOutput()
	log.Printf("[deploy] git pull: %s", string(out))
	if err != nil {
		log.Printf("[deploy] ❌ git pull FAILED: %v", err)
		return
	}

	// Step 2: go build
	out, err = exec.Command("bash", "-c", "cd "+appDir+" && go build -o absenpanel .").CombinedOutput()
	log.Printf("[deploy] go build: %s", string(out))
	if err != nil {
		log.Printf("[deploy] ❌ Build FAILED: %v", err)
		return
	}

	// Step 3: restart panel via PM2
	out, err = exec.Command("bash", "-c", "pm2 restart absenpanel || pm2 start "+appDir+"/absenpanel --name absenpanel").CombinedOutput()
	log.Printf("[deploy] pm2 restart: %s", string(out))
	if err != nil {
		log.Printf("[deploy] ⚠️ PM2 restart issue: %v", err)
	}

	log.Println("✅ [deploy] Auto-deploy complete!")
}
