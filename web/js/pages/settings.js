// ═══════════════════════════════════════
// Settings Page Module
// ═══════════════════════════════════════

registerPage('settings', {
    title: 'Settings',

    render() {
        return `
            <!-- Change Password -->
            <div class="card" style="max-width:480px;margin-bottom:20px">
                <div class="card-header">
                    <span class="card-title"><i class="ph ph-lock"></i> Change Password</span>
                </div>
                <form id="changePassForm" onsubmit="return settingsChangePass(event)">
                    <div class="form-group">
                        <label class="form-label">Current Password</label>
                        <input type="password" class="form-input" id="oldPass" placeholder="••••••••" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">New Password</label>
                        <input type="password" class="form-input" id="newPass" placeholder="Min. 6 characters" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm New Password</label>
                        <input type="password" class="form-input" id="confirmPass" placeholder="••••••••" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary" id="changePassBtn">
                        <i class="ph ph-check"></i> Update Password
                    </button>
                </form>
            </div>

            <!-- Panel Info -->
            <div class="card" style="max-width:480px">
                <div class="card-header">
                    <span class="card-title">Panel Info</span>
                </div>
                <div style="font-size:13px;color:var(--text-secondary)">
                    <p>AbsenPanel v1.0.0</p>
                    <p style="margin-top:8px">Built with Go + Vanilla JS</p>
                </div>
            </div>
        `;
    }
});

async function settingsChangePass(e) {
    e.preventDefault();
    const oldPass = document.getElementById('oldPass').value;
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmPass').value;
    const btn = document.getElementById('changePassBtn');

    if (newPass !== confirmPass) {
        showToast('Passwords do not match', 'error');
        return false;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner"></i> Updating...';

    try {
        const res = await apiFetch('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
        });
        if (res.success) {
            showToast('Password updated successfully!', 'success');
            document.getElementById('changePassForm').reset();
        } else {
            showToast(res.error || 'Failed to update password', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-check"></i> Update Password';
    return false;
}
