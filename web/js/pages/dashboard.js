// ═══════════════════════════════════════
// Dashboard Page Module
// ═══════════════════════════════════════

registerPage('dashboard', {
    title: 'Dashboard',
    topbarActions: '<span class="status-badge online" id="botStatus">Online</span>',

    render() {
        return `
            <!-- Bot Control -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
                <div>
                    <h2 style="font-size:18px;font-weight:700;margin-bottom:4px">WhatsApp Bot</h2>
                    <p style="font-size:13px;color:var(--text-muted)" id="uptimeText">Uptime: loading...</p>
                </div>
                <div class="btn-group">
                    <button class="btn btn-success" onclick="dashboardAction('start')"><i class="ph ph-play"></i> Start</button>
                    <button class="btn btn-warning" onclick="dashboardAction('restart')"><i class="ph ph-arrows-clockwise"></i> Restart</button>
                    <button class="btn btn-danger" onclick="dashboardAction('stop')"><i class="ph ph-stop"></i> Stop</button>
                </div>
            </div>

            <!-- Stats -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon cpu"><i class="ph ph-lightning"></i></div>
                    <div>
                        <div class="stat-value" id="cpuVal">—%</div>
                        <div class="stat-label">CPU Usage</div>
                        <div class="progress-bar"><div class="fill blue" id="cpuBar" style="width:0%"></div></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon memory"><i class="ph ph-memory"></i></div>
                    <div>
                        <div class="stat-value" id="memVal">—</div>
                        <div class="stat-label">Memory</div>
                        <div class="stat-sub" id="memSub"></div>
                        <div class="progress-bar"><div class="fill purple" id="memBar" style="width:0%"></div></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon disk"><i class="ph ph-hard-drives"></i></div>
                    <div>
                        <div class="stat-value" id="diskVal">—</div>
                        <div class="stat-label">Disk</div>
                        <div class="stat-sub" id="diskSub"></div>
                        <div class="progress-bar"><div class="fill green" id="diskBar" style="width:0%"></div></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon uptime"><i class="ph ph-clock"></i></div>
                    <div>
                        <div class="stat-value" id="srvUptime">—</div>
                        <div class="stat-label">Server Uptime</div>
                    </div>
                </div>
            </div>

            <!-- Recent Logs -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Recent Logs</span>
                    <a href="/console" data-page="console" class="btn btn-ghost" style="font-size:12px" onclick="event.preventDefault();navigateToPage('console');history.pushState({page:'console'},'','/console')">Open Console →</a>
                </div>
                <div style="background:var(--bg-terminal);border-radius:var(--radius-sm);padding:16px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#94a3b8;max-height:200px;overflow-y:auto" id="logPreview">
                    <div style="color:var(--text-muted)">Loading logs...</div>
                </div>
            </div>
        `;
    },

    init() {
        fetchDashStats();
        fetchDashBotStatus();
        fetchDashLogs();
        addPageInterval(fetchDashStats, 5000);
        addPageInterval(fetchDashBotStatus, 10000);
        addPageInterval(fetchDashLogs, 3000);
    }
});

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(0) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
}

async function fetchDashStats() {
    try {
        const d = await apiFetch('/api/stats');
        document.getElementById('cpuVal').textContent = d.cpu.toFixed(1) + '%';
        document.getElementById('cpuBar').style.width = d.cpu + '%';
        document.getElementById('memVal').textContent = formatBytes(d.memory.used);
        document.getElementById('memSub').textContent = `${formatBytes(d.memory.used)} / ${formatBytes(d.memory.total)}`;
        document.getElementById('memBar').style.width = d.memory.percent + '%';
        document.getElementById('diskVal').textContent = formatBytes(d.disk.used);
        document.getElementById('diskSub').textContent = `${formatBytes(d.disk.used)} / ${formatBytes(d.disk.total)}`;
        document.getElementById('diskBar').style.width = d.disk.percent + '%';
        document.getElementById('srvUptime').textContent = d.uptime || '—';
    } catch (e) { /* ignore on page change */ }
}

async function fetchDashBotStatus() {
    try {
        const data = await apiFetch('/api/bot/status');
        const badge = document.getElementById('botStatus');
        if (!badge) return;
        if (Array.isArray(data) && data.length > 0) {
            const bot = data.find(p => p.name === 'absenbot') || data[0];
            const status = bot.pm2_env?.status || 'unknown';
            badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            badge.className = 'status-badge ' + (status === 'online' ? 'online' : status === 'stopped' ? 'offline' : 'connecting');
            if (bot.pm2_env?.pm_uptime) {
                const upMs = Date.now() - bot.pm2_env.pm_uptime;
                const h = Math.floor(upMs / 3600000);
                const m = Math.floor((upMs % 3600000) / 60000);
                const el = document.getElementById('uptimeText');
                if (el) el.textContent = `Bot uptime: ${h}h ${m}m`;
            }
        } else {
            badge.textContent = 'Offline';
            badge.className = 'status-badge offline';
        }
    } catch (e) { /* ignore */ }
}

async function fetchDashLogs() {
    try {
        const data = await apiFetch('/api/bot/logs?lines=30');
        const preview = document.getElementById('logPreview');
        if (!preview) return;
        if (data.logs) {
            preview.innerHTML = escapeHtml(data.logs).replace(/\n/g, '<br>');
            preview.scrollTop = preview.scrollHeight;
        } else {
            preview.innerHTML = '<div style="color:var(--text-muted)">No logs available</div>';
        }
    } catch (e) { /* ignore */ }
}

async function dashboardAction(action) {
    try {
        const res = await apiFetch(`/api/bot/${action}`, { method: 'POST' });
        showToast(res.success ? `Bot ${action} successful` : `Failed: ${res.error}`, res.success ? 'success' : 'error');
        setTimeout(fetchDashBotStatus, 2000);
    } catch (e) {
        showToast('Action failed: ' + e.message, 'error');
    }
}
