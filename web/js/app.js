// ═══════════════════════════════════════
// AbsenPanel — Shared JS
// ═══════════════════════════════════════

// Auth helper
function getToken() {
    return localStorage.getItem('token');
}

// API fetch with auth
async function apiFetch(url, options = {}) {
    const token = getToken();
    if (!token && !url.includes('/auth/')) {
        window.location.href = '/login';
        throw new Error('Not authenticated');
    }

    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        localStorage.removeItem('token');
        document.cookie = 'token=; path=/; max-age=0';
        window.location.href = '/login';
        throw new Error('Session expired');
    }

    return res.json();
}

// Logout
function logout() {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; max-age=0';
    window.location.href = '/login';
}

// Toast notification
function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}
