// ═══════════════════════════════════════
// AbsenPanel — SPA Router
// Handles client-side navigation without
// full page reloads to preserve WebSocket
// ═══════════════════════════════════════

const pages = {};
let currentPage = null;
let pageIntervals = [];

function registerPage(name, config) {
    pages[name] = config;
}

function initRouter() {
    // Intercept sidebar link clicks
    document.querySelectorAll('#sidebarNav a[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateToPage(page);
            history.pushState({ page }, '', link.href);
        });
    });

    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
        const page = e.state?.page || getPageFromPath(location.pathname);
        navigateToPage(page, false);
    });

    // Initial page load
    const page = getPageFromPath(location.pathname);
    navigateToPage(page);
}

function getPageFromPath(path) {
    const map = {
        '/': 'dashboard',
        '/console': 'console',
        '/files': 'files',
        '/whatsapp': 'whatsapp',
        '/users': 'users',
        '/settings': 'settings'
    };
    return map[path] || 'dashboard';
}

function navigateToPage(pageName, updateHistory = true) {
    const page = pages[pageName];
    if (!page) return;

    // Cleanup previous page intervals (but NOT terminal)
    pageIntervals.forEach(id => clearInterval(id));
    pageIntervals = [];

    // Call previous page's destroy (if it has one, but not console — terminal persists)
    if (currentPage && currentPage !== 'console' && pages[currentPage]?.destroy) {
        pages[currentPage].destroy();
    }
    // If leaving console, just hide it (don't destroy terminal)
    if (currentPage === 'console' && pageName !== 'console') {
        const consoleEl = document.getElementById('console-persistent');
        if (consoleEl) consoleEl.style.display = 'none';
    }

    currentPage = pageName;

    // Update sidebar active state
    document.querySelectorAll('#sidebarNav a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === pageName);
    });

    // Update topbar
    document.getElementById('pageTitle').textContent = page.title || pageName;
    document.getElementById('topbarActions').innerHTML = page.topbarActions || '';

    // If console page and terminal already exists, just show it
    if (pageName === 'console') {
        const consoleEl = document.getElementById('console-persistent');
        if (consoleEl) {
            document.getElementById('pageContent').innerHTML = '';
            document.getElementById('pageContent').appendChild(consoleEl);
            consoleEl.style.display = '';
            if (page.onShow) page.onShow();
            return;
        }
    }

    // Render page content
    document.getElementById('pageContent').innerHTML = page.render();

    // Initialize page
    if (page.init) page.init();
}

// Helper to register polling intervals that auto-clear on page change
function addPageInterval(fn, ms) {
    const id = setInterval(fn, ms);
    pageIntervals.push(id);
    return id;
}
