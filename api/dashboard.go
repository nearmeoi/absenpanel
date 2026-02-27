package api

import (
	"fmt"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"absenpanel/config"

	"github.com/gin-gonic/gin"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

var startTime = time.Now()

type StatsResponse struct {
	CPU    float64  `json:"cpu"`
	Memory MemInfo  `json:"memory"`
	Disk   DiskInfo `json:"disk"`
	Uptime string   `json:"uptime"`
	OS     string   `json:"os"`
	Arch   string   `json:"arch"`
}

type MemInfo struct {
	Used  uint64  `json:"used"`
	Total uint64  `json:"total"`
	Pct   float64 `json:"percent"`
}

type DiskInfo struct {
	Used  uint64  `json:"used"`
	Total uint64  `json:"total"`
	Pct   float64 `json:"percent"`
}

func GetStats(c *gin.Context) {
	// CPU
	cpuPct, _ := cpu.Percent(500*time.Millisecond, false)
	cpuVal := 0.0
	if len(cpuPct) > 0 {
		cpuVal = cpuPct[0]
	}

	// Memory
	memStat, _ := mem.VirtualMemory()
	memInfo := MemInfo{}
	if memStat != nil {
		memInfo = MemInfo{Used: memStat.Used, Total: memStat.Total, Pct: memStat.UsedPercent}
	}

	// Disk
	diskStat, _ := disk.Usage("/")
	diskInfo := DiskInfo{}
	if diskStat != nil {
		diskInfo = DiskInfo{Used: diskStat.Used, Total: diskStat.Total, Pct: diskStat.UsedPercent}
	}

	// Uptime
	hostInfo, _ := host.Info()
	uptimeStr := ""
	if hostInfo != nil {
		secs := hostInfo.Uptime
		days := secs / 86400
		hours := (secs % 86400) / 3600
		mins := (secs % 3600) / 60
		uptimeStr = formatUptime(days, hours, mins)
	}

	c.JSON(http.StatusOK, StatsResponse{
		CPU:    cpuVal,
		Memory: memInfo,
		Disk:   diskInfo,
		Uptime: uptimeStr,
		OS:     runtime.GOOS,
		Arch:   runtime.GOARCH,
	})
}

func formatUptime(days, hours, mins uint64) string {
	parts := []string{}
	if days > 0 {
		parts = append(parts, fmt.Sprintf("%dd", days))
	}
	if hours > 0 {
		parts = append(parts, fmt.Sprintf("%dh", hours))
	}
	parts = append(parts, fmt.Sprintf("%dm", mins))
	return strings.Join(parts, " ")
}

// Bot status via PM2
func GetBotStatus(c *gin.Context) {
	out, err := exec.Command("pm2", "jlist").Output()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "unknown", "error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", out)
}

func BotStart(c *gin.Context) {
	out, err := exec.Command("pm2", "start", config.Cfg.BotName).CombinedOutput()
	respondCmd(c, out, err)
}

func BotStop(c *gin.Context) {
	out, err := exec.Command("pm2", "stop", config.Cfg.BotName).CombinedOutput()
	respondCmd(c, out, err)
}

func BotRestart(c *gin.Context) {
	out, err := exec.Command("pm2", "restart", config.Cfg.BotName).CombinedOutput()
	respondCmd(c, out, err)
}

func BotKill(c *gin.Context) {
	out, err := exec.Command("pm2", "delete", config.Cfg.BotName).CombinedOutput()
	respondCmd(c, out, err)
}

func respondCmd(c *gin.Context, out []byte, err error) {
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "output": string(out), "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "output": string(out)})
}

func GetBotLogs(c *gin.Context) {
	lines := c.DefaultQuery("lines", "50")
	out, err := exec.Command("pm2", "logs", config.Cfg.BotName, "--nostream", "--lines", lines).CombinedOutput()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"logs": "Failed to get logs: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"logs": string(out)})
}
