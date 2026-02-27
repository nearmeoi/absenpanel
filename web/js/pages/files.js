// ═══════════════════════════════════════
// Files Page Module — Advanced File Manager
// Copy, Cut, Paste, Move, Rename, Delete
// ═══════════════════════════════════════

let fmCurrentPath = '/';
let fmEditingPath = null;
let fmClipboard = null; // { action: 'copy'|'cut', path: string, name: string }

registerPage('files', {
    title: 'File Manager',
    topbarActions: `
        <button class="btn btn-ghost" onclick="fmNavigate('/')"><i class="ph ph-house"></i> Root</button>
        <button class="btn btn-ghost" id="fmPasteBtn" style="display:none" onclick="fmPaste()"><i class="ph ph-clipboard"></i> Paste</button>
    `,

    render() {
        return `
            <div style="margin-bottom:16px;font-size:13px;color:var(--text-muted)" id="fmBreadcrumb">/</div>

            <div class="card" style="padding:0" id="fileListCard">
                <div id="fileList">
                    <div style="padding:20px;color:var(--text-muted)">Loading...</div>
                </div>
            </div>

            <!-- Context Menu -->
            <div class="fm-context-menu" id="fmContextMenu" style="display:none">
                <div class="fm-ctx-item" onclick="fmCopy()"><i class="ph ph-copy"></i> Copy</div>
                <div class="fm-ctx-item" onclick="fmCut()"><i class="ph ph-scissors"></i> Cut</div>
                <div class="fm-ctx-item" onclick="fmRenamePrompt()"><i class="ph ph-pencil"></i> Rename</div>
                <div class="fm-ctx-item fm-ctx-danger" onclick="fmDeleteConfirm()"><i class="ph ph-trash"></i> Delete</div>
            </div>

            <!-- Editor -->
            <div class="card" id="editorCard" style="display:none;margin-top:16px">
                <div class="card-header">
                    <span class="card-title" id="editorTitle">Editing file</span>
                    <div class="btn-group">
                        <button class="btn btn-ghost" onclick="fmCloseEditor()">Cancel</button>
                        <button class="btn btn-primary" onclick="fmSaveFile()"><i class="ph ph-floppy-disk"></i> Save</button>
                    </div>
                </div>
                <textarea class="code-editor" id="fileEditor"></textarea>
            </div>

            <!-- Rename Modal -->
            <div class="modal-overlay" id="fmRenameModal" style="display:none">
                <div class="modal-card">
                    <h3 style="margin-bottom:16px">Rename</h3>
                    <input type="text" class="form-input" id="fmRenameInput" placeholder="New name">
                    <div class="btn-group" style="margin-top:16px;justify-content:flex-end">
                        <button class="btn btn-ghost" onclick="fmCloseRename()">Cancel</button>
                        <button class="btn btn-primary" onclick="fmRenameExec()">Rename</button>
                    </div>
                </div>
            </div>

            <!-- Delete Confirm Modal -->
            <div class="modal-overlay" id="fmDeleteModal" style="display:none">
                <div class="modal-card">
                    <h3 style="margin-bottom:8px"><i class="ph ph-warning" style="color:var(--danger)"></i> Delete</h3>
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Are you sure you want to delete <strong id="fmDeleteName"></strong>? This cannot be undone.</p>
                    <div class="btn-group" style="justify-content:flex-end">
                        <button class="btn btn-ghost" onclick="fmCloseDelete()">Cancel</button>
                        <button class="btn btn-danger" onclick="fmDeleteExec()"><i class="ph ph-trash"></i> Delete</button>
                    </div>
                </div>
            </div>
        `;
    },

    init() {
        fmNavigate(fmCurrentPath);
        document.addEventListener('click', fmHideContextMenu);
        // Keyboard shortcuts
        document.addEventListener('keydown', fmKeyHandler);
    },

    destroy() {
        document.removeEventListener('click', fmHideContextMenu);
        document.removeEventListener('keydown', fmKeyHandler);
    }
});

let fmContextTarget = null; // { path, name, isDir }

function fmKeyHandler(e) {
    if (currentPage !== 'files') return;
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's' && fmEditingPath) {
        e.preventDefault();
        fmSaveFile();
    }
    // Esc to close editor/modals
    if (e.key === 'Escape') {
        fmCloseEditor();
        fmCloseRename();
        fmCloseDelete();
        fmHideContextMenu();
    }
}

function fmFormatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

async function fmNavigate(path) {
    fmCurrentPath = path;
    fmUpdateBreadcrumb();
    fmCloseEditor();

    try {
        const data = await apiFetch(`/api/files?path=${encodeURIComponent(path)}`);
        fmRenderFiles(data.files || []);
    } catch (e) {
        document.getElementById('fileList').innerHTML = `<div style="padding:20px;color:var(--danger)">Error: ${e.message}</div>`;
    }
}

function fmRenderFiles(files) {
    const list = document.getElementById('fileList');
    if (files.length === 0) {
        list.innerHTML = '<div style="padding:20px;color:var(--text-muted)">Empty directory</div>';
        return;
    }

    let html = '';

    // Back button
    if (fmCurrentPath !== '/') {
        const parent = fmCurrentPath.split('/').slice(0, -1).join('/') || '/';
        html += `<div class="file-item" onclick="fmNavigate('${escapeHtml(parent)}')">
            <span class="file-icon"><i class="ph ph-arrow-up"></i></span>
            <span class="file-name">..</span>
            <span class="file-size"></span>
            <span class="file-date"></span>
            <span class="file-actions"></span>
        </div>`;
    }

    for (const f of files) {
        const icon = f.isDir ? '<i class="ph ph-folder"></i>' : fmGetFileIcon(f.name);
        const safePath = escapeHtml(f.path);
        const safeName = escapeHtml(f.name);
        const clickAction = f.isDir ? `fmNavigate('${safePath}')` : `fmOpenFile('${safePath}')`;

        html += `<div class="file-item" onclick="${clickAction}" oncontextmenu="fmShowContextMenu(event, '${safePath}', '${safeName}', ${f.isDir})">
            <span class="file-icon">${icon}</span>
            <span class="file-name">${safeName}</span>
            <span class="file-size">${f.isDir ? '—' : fmFormatSize(f.size)}</span>
            <span class="file-date">${escapeHtml(f.modTime)}</span>
            <span class="file-actions">
                <button class="btn-icon" onclick="event.stopPropagation();fmShowContextMenu(event, '${safePath}', '${safeName}', ${f.isDir})" title="More"><i class="ph ph-dots-three"></i></button>
            </span>
        </div>`;
    }

    list.innerHTML = html;

    // Update paste button visibility
    const pasteBtn = document.getElementById('fmPasteBtn');
    if (pasteBtn) pasteBtn.style.display = fmClipboard ? '' : 'none';
}

function fmGetFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
        js: '<i class="ph ph-file-js"></i>', json: '<i class="ph ph-braces"></i>',
        md: '<i class="ph ph-file-text"></i>', html: '<i class="ph ph-file-html"></i>',
        css: '<i class="ph ph-file-css"></i>', env: '<i class="ph ph-lock"></i>',
        txt: '<i class="ph ph-file-text"></i>', log: '<i class="ph ph-file-text"></i>',
        sh: '<i class="ph ph-terminal-window"></i>', go: '<i class="ph ph-file-code"></i>'
    };
    return icons[ext] || '<i class="ph ph-file"></i>';
}

function fmUpdateBreadcrumb() {
    const parts = fmCurrentPath.split('/').filter(Boolean);
    let html = '<span style="cursor:pointer" onclick="fmNavigate(\'/\')">root</span>';
    let path = '';
    for (const p of parts) {
        path += '/' + p;
        html += ` / <span style="cursor:pointer;color:var(--text)" onclick="fmNavigate('${escapeHtml(path)}')">${escapeHtml(p)}</span>`;
    }
    const el = document.getElementById('fmBreadcrumb');
    if (el) el.innerHTML = html;
}

// ── Context Menu ──
function fmShowContextMenu(e, path, name, isDir) {
    e.preventDefault();
    e.stopPropagation();
    fmContextTarget = { path, name, isDir };
    const menu = document.getElementById('fmContextMenu');
    if (!menu) return;
    menu.style.display = 'block';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
}

function fmHideContextMenu() {
    const menu = document.getElementById('fmContextMenu');
    if (menu) menu.style.display = 'none';
}

// ── Copy / Cut / Paste ──
function fmCopy() {
    if (!fmContextTarget) return;
    fmClipboard = { action: 'copy', ...fmContextTarget };
    showToast(`Copied: ${fmContextTarget.name}`, 'success');
    fmHideContextMenu();
    const pasteBtn = document.getElementById('fmPasteBtn');
    if (pasteBtn) pasteBtn.style.display = '';
}

function fmCut() {
    if (!fmContextTarget) return;
    fmClipboard = { action: 'cut', ...fmContextTarget };
    showToast(`Cut: ${fmContextTarget.name}`, 'success');
    fmHideContextMenu();
    const pasteBtn = document.getElementById('fmPasteBtn');
    if (pasteBtn) pasteBtn.style.display = '';
}

async function fmPaste() {
    if (!fmClipboard) return;
    try {
        const res = await apiFetch('/api/files/paste', {
            method: 'POST',
            body: JSON.stringify({
                action: fmClipboard.action,
                source: fmClipboard.path,
                destination: fmCurrentPath
            })
        });
        if (res.success) {
            showToast(`${fmClipboard.action === 'copy' ? 'Copied' : 'Moved'} successfully`, 'success');
            if (fmClipboard.action === 'cut') fmClipboard = null;
            fmNavigate(fmCurrentPath);
        } else {
            showToast(res.error || 'Paste failed', 'error');
        }
    } catch (e) {
        showToast('Paste failed: ' + e.message, 'error');
    }
}

// ── Rename ──
function fmRenamePrompt() {
    if (!fmContextTarget) return;
    fmHideContextMenu();
    document.getElementById('fmRenameInput').value = fmContextTarget.name;
    document.getElementById('fmRenameModal').style.display = 'flex';
    document.getElementById('fmRenameInput').focus();
}

function fmCloseRename() {
    const el = document.getElementById('fmRenameModal');
    if (el) el.style.display = 'none';
}

async function fmRenameExec() {
    const newName = document.getElementById('fmRenameInput').value.trim();
    if (!newName || !fmContextTarget) return;
    try {
        const res = await apiFetch('/api/files/rename', {
            method: 'POST',
            body: JSON.stringify({
                source: fmContextTarget.path,
                newName: newName
            })
        });
        if (res.success) {
            showToast('Renamed successfully', 'success');
            fmCloseRename();
            fmNavigate(fmCurrentPath);
        } else {
            showToast(res.error || 'Rename failed', 'error');
        }
    } catch (e) {
        showToast('Rename failed: ' + e.message, 'error');
    }
}

// ── Delete with Confirmation ──
function fmDeleteConfirm() {
    if (!fmContextTarget) return;
    fmHideContextMenu();
    document.getElementById('fmDeleteName').textContent = fmContextTarget.name;
    document.getElementById('fmDeleteModal').style.display = 'flex';
}

function fmCloseDelete() {
    const el = document.getElementById('fmDeleteModal');
    if (el) el.style.display = 'none';
}

async function fmDeleteExec() {
    if (!fmContextTarget) return;
    try {
        const res = await apiFetch(`/api/files?path=${encodeURIComponent(fmContextTarget.path)}`, { method: 'DELETE' });
        if (res.success) {
            showToast('Deleted successfully', 'success');
            fmCloseDelete();
            fmNavigate(fmCurrentPath);
        } else {
            showToast(res.error || 'Delete failed', 'error');
        }
    } catch (e) {
        showToast('Delete failed: ' + e.message, 'error');
    }
}

// ── File Editor ──
async function fmOpenFile(path) {
    try {
        const data = await apiFetch(`/api/files/read?path=${encodeURIComponent(path)}`);
        fmEditingPath = path;
        document.getElementById('editorTitle').textContent = path;
        document.getElementById('fileEditor').value = data.content;
        document.getElementById('editorCard').style.display = 'block';
        document.getElementById('editorCard').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        showToast('Cannot open file: ' + e.message, 'error');
    }
}

async function fmSaveFile() {
    if (!fmEditingPath) return;
    try {
        const res = await apiFetch('/api/files/write', {
            method: 'POST',
            body: JSON.stringify({
                path: fmEditingPath,
                content: document.getElementById('fileEditor').value
            })
        });
        showToast(res.success ? 'File saved' : 'Save failed', res.success ? 'success' : 'error');
    } catch (e) {
        showToast('Save failed: ' + e.message, 'error');
    }
}

function fmCloseEditor() {
    const el = document.getElementById('editorCard');
    if (el) el.style.display = 'none';
    fmEditingPath = null;
}
