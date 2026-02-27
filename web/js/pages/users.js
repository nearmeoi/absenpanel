// ═══════════════════════════════════════
// Users Page Module
// ═══════════════════════════════════════

registerPage('users', {
    title: 'Registered Users',

    render() {
        return `
            <div class="card" style="padding:0">
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Template</th>
                            </tr>
                        </thead>
                        <tbody id="userTable">
                            <tr><td colspan="3" style="color:var(--text-muted)">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    init() {
        usersLoad();
    }
});

async function usersLoad() {
    try {
        const data = await apiFetch('/api/users');
        const users = data.users || {};
        const tbody = document.getElementById('userTable');
        if (!tbody) return;
        if (Object.keys(users).length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted)">No users registered</td></tr>';
            return;
        }
        let html = '';
        for (const [phone, user] of Object.entries(users)) {
            const u = typeof user === 'string' ? JSON.parse(user) : user;
            html += `<tr>
                <td>${escapeHtml(phone)}</td>
                <td>${escapeHtml(u.email || '—')}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(u.template || '—')}</td>
            </tr>`;
        }
        tbody.innerHTML = html;
    } catch (e) {
        const tbody = document.getElementById('userTable');
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="color:var(--danger)">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
}
