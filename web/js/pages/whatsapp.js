// ═══════════════════════════════════════
// WhatsApp Page Module
// ═══════════════════════════════════════

registerPage('whatsapp', {
    title: 'WhatsApp Session',

    render() {
        return `
            <div class="card" style="max-width:480px">
                <div class="card-header">
                    <span class="card-title">Session Status</span>
                    <span class="status-badge online" id="waStatus">Active</span>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">
                    Manage the WhatsApp session. If the bot disconnects, use Reset to clear the session and re-pair.
                </p>
                <div class="btn-group">
                    <button class="btn btn-danger" onclick="waResetSession()"><i class="ph ph-trash"></i> Reset Session</button>
                    <button class="btn btn-warning" onclick="waRestartBot()"><i class="ph ph-arrows-clockwise"></i> Restart Bot</button>
                </div>
            </div>
        `;
    }
});

async function waResetSession() {
    if (!confirm('This will delete the WhatsApp session. You will need to re-pair the bot. Continue?')) return;
    showToast('Resetting session...', 'success');
    try {
        await apiFetch('/api/bot/stop', { method: 'POST' });
        showToast('Bot stopped. Delete SesiWA via Console, then Start bot.', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function waRestartBot() {
    try {
        const res = await apiFetch('/api/bot/restart', { method: 'POST' });
        showToast(res.success ? 'Bot restarted' : 'Failed', res.success ? 'success' : 'error');
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}
