package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/exec"

	"github.com/creack/pty"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func TerminalHandler(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("[TERMINAL] Upgrade error:", err)
		return
	}
	defer conn.Close()

	// Start a bash shell with PTY
	shell := "/bin/bash"
	if _, err := os.Stat(shell); err != nil {
		shell = "/bin/sh"
	}

	cmd := exec.Command(shell)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		log.Println("[TERMINAL] PTY start error:", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Failed to start terminal: "+err.Error()))
		return
	}
	defer ptmx.Close()

	// PTY → WebSocket (terminal output)
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if err != nil {
				conn.WriteMessage(websocket.TextMessage, []byte("\r\n[Terminal disconnected]"))
				return
			}
			if err := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				return
			}
		}
	}()

	// WebSocket → PTY (user input)
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		// Handle resize messages (JSON format: {"type":"resize","cols":80,"rows":24})
		if len(msg) > 0 && msg[0] == '{' {
			handleResize(ptmx, msg)
			continue
		}

		if _, err := ptmx.Write(msg); err != nil {
			break
		}
	}

	cmd.Process.Kill()
}

func handleResize(ptmx *os.File, msg []byte) {
	// Simple JSON parse for resize
	type ResizeMsg struct {
		Type string `json:"type"`
		Cols uint16 `json:"cols"`
		Rows uint16 `json:"rows"`
	}

	var resize ResizeMsg
	if err := json.Unmarshal(msg, &resize); err != nil {
		return
	}

	if resize.Type == "resize" {
		pty.Setsize(ptmx, &pty.Winsize{Rows: resize.Rows, Cols: resize.Cols})
	}
}
