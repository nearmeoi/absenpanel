// ═══════════════════════════════════════
// Console Page Module — Persistent Terminal
// Terminal WebSocket survives page navigation
// ═══════════════════════════════════════

let term = null;
let fitAddon = null;
let termWs = null;
let termConnected = false;

function createTerminal() {
    term = new Terminal({
        theme: {
            background: '#0a0e1a',
            foreground: '#e2e8f0',
            cursor: '#3b82f6',
            cursorAccent: '#0a0e1a',
            selectionBackground: 'rgba(59, 130, 246, 0.3)',
            black: '#1e293b', red: '#ef4444', green: '#22c55e',
            yellow: '#f59e0b', blue: '#3b82f6', magenta: '#a855f7',
            cyan: '#06b6d4', white: '#e2e8f0',
            brightBlack: '#64748b', brightRed: '#f87171', brightGreen: '#4ade80',
            brightYellow: '#fbbf24', brightBlue: '#60a5fa', brightMagenta: '#c084fc',
            brightCyan: '#22d3ee', brightWhite: '#f8fafc'
        },
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 14,
        lineHeight: 1.3,
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 5000
    });

    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
}

function connectTerminal() {
    if (termWs && termWs.readyState === WebSocket.OPEN) return;

    const token = getToken();
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    termWs = new WebSocket(`${wsProtocol}//${location.host}/api/terminal?token=${token}`);

    const statusEl = document.getElementById('connStatus');
    const reconnBtn = document.getElementById('termReconnBtn');

    termWs.onopen = () => {
        termConnected = true;
        if (statusEl) { statusEl.textContent = 'Connected'; statusEl.style.color = 'var(--success)'; }
        if (reconnBtn) reconnBtn.style.display = 'none';
        termWs.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    termWs.onmessage = (e) => {
        if (e.data instanceof Blob) {
            e.data.text().then(text => term.write(text));
        } else {
            term.write(e.data);
        }
    };

    termWs.onclose = () => {
        termConnected = false;
        if (statusEl) { statusEl.textContent = 'Disconnected'; statusEl.style.color = 'var(--danger)'; }
        if (reconnBtn) reconnBtn.style.display = '';
        term.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
    };

    termWs.onerror = () => {
        if (statusEl) { statusEl.textContent = 'Error'; statusEl.style.color = 'var(--danger)'; }
        if (reconnBtn) reconnBtn.style.display = '';
    };

    term.onData(data => {
        if (termWs && termWs.readyState === WebSocket.OPEN) {
            termWs.send(data);
        }
    });
}

function reconnectTerminal() {
    if (termWs) {
        termWs.close();
        termWs = null;
    }
    term.clear();
    term.write('\x1b[33m[Reconnecting...]\x1b[0m\r\n');
    connectTerminal();
}

registerPage('console', {
    title: 'Console',
    topbarActions: `
        <button class="btn btn-ghost" onclick="term.clear()">Clear</button>
        <button class="btn btn-success" id="termReconnBtn" style="display:none" onclick="reconnectTerminal()"><i class="ph ph-arrows-clockwise"></i> Reconnect</button>
        <button class="btn btn-warning" onclick="consoleBotRestart()"><i class="ph ph-arrows-clockwise"></i> Restart Bot</button>
    `,

    render() {
        return `
            <div id="console-persistent" style="padding:0">
                <div class="terminal-wrapper">
                    <div class="terminal-toolbar">
                        <div class="dots">
                            <div class="dot red"></div>
                            <div class="dot yellow"></div>
                            <div class="dot green"></div>
                        </div>
                        <span style="font-size:12px;color:var(--text-muted)" id="connStatus">Connecting...</span>
                    </div>
                    <div class="terminal-body" id="terminal"></div>
                </div>
            </div>
        `;
    },

    init() {
        if (!term) {
            createTerminal();
        }
        term.open(document.getElementById('terminal'));
        fitAddon.fit();

        if (!termConnected && (!termWs || termWs.readyState !== WebSocket.OPEN)) {
            connectTerminal();
        }

        // Resize handler
        this._resizeHandler = () => {
            fitAddon.fit();
            if (termWs && termWs.readyState === WebSocket.OPEN) {
                termWs.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
            }
        };
        window.addEventListener('resize', this._resizeHandler);
    },

    onShow() {
        // Re-attach terminal to DOM if it was hidden
        setTimeout(() => {
            if (fitAddon) fitAddon.fit();
            const statusEl = document.getElementById('connStatus');
            const reconnBtn = document.getElementById('termReconnBtn');
            if (termConnected) {
                if (statusEl) { statusEl.textContent = 'Connected'; statusEl.style.color = 'var(--success)'; }
                if (reconnBtn) reconnBtn.style.display = 'none';
            } else {
                if (statusEl) { statusEl.textContent = 'Disconnected'; statusEl.style.color = 'var(--danger)'; }
                if (reconnBtn) reconnBtn.style.display = '';
            }
        }, 50);
    }
});

async function consoleBotRestart() {
    try {
        const res = await apiFetch('/api/bot/restart', { method: 'POST' });
        showToast(res.success ? 'Bot restarted' : 'Failed', res.success ? 'success' : 'error');
    } catch (e) {
        showToast('Failed: ' + e.message, 'error');
    }
}
