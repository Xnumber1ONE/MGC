/* =========================================================
   CONFIG
   ========================================================= */
const REPO = "Ham0ZA/MGC";
const BRANCH = "main";
const MEDIA_FOLDER = "src/images/uploads";
const PUBLIC_FOLDER = "/images/uploads";

const COLLECTIONS = {
    reviews: {
        label: "Reviews",
        folder: "src/reviews",
        identifier: "title",
        fields: [
            { name: "title", label: "Game title", widget: "string", required: true },
            { name: "author", label: "Author", widget: "string", required: true },
            {
                name: "meta", label: "Genre", widget: "multiselect", required: true,
                options: ["Action", "RPG", "Soulslike", "Open-World", "Racing", "Adventure", "Shooter", "Strategy", "Simulation", "Sports", "Puzzle", "Horror", "Platformer", "Fighting", "MMO", "Stealth", "Survival", "Rhythm", "Visual Novel", "Party", "Educational"]
            },
            {
                name: "platform", label: "Platform", widget: "multiselect", required: true,
                options: ["PC", "PS5", "Xbox Series X/S", "Nintendo Switch", "Mobile", "PS4", "Xbox One"]
            },
            { name: "cover_image", label: "Cover image", widget: "image", required: true },
            { name: "date", label: "Publish date", widget: "datetime", required: true },
            { name: "excerpt", label: "Short excerpt", widget: "text", required: true },
            { name: "body", label: "Review body", widget: "markdown", required: true, isBody: true },
            { name: "pros", label: "Pros", widget: "list", required: true },
            { name: "cons", label: "Cons", widget: "list", required: true },
            { name: "cta", label: "Rating", widget: "string", required: true },
        ]
    },
    news: {
        label: "News",
        folder: "src/news",
        identifier: "title",
        fields: [
            { name: "title", label: "Title", widget: "string", required: true },
            { name: "date", label: "Publish date", widget: "datetime", required: true },
            { name: "excerpt", label: "Short excerpt", widget: "text", required: true },
            { name: "body", label: "Body", widget: "markdown", required: true, isBody: true },
        ]
    },
    articles: {
        label: "Articles",
        folder: "src/articles",
        identifier: "title",
        fields: [
            { name: "title", label: "Title", widget: "string", required: true },
            { name: "date", label: "Publish date", widget: "datetime", required: true },
            { name: "excerpt", label: "Short excerpt", widget: "text", required: true },
            { name: "body", label: "Body", widget: "markdown", required: true, isBody: true },
        ]
    }
};

/* =========================================================
   STEAMGRIDDB API
   ========================================================= */
const SGDB_PROXY_URL = "https://wispy-night-4eba.hmzmamouni.workers.dev/";

async function sgdb(path) {
    const res = await fetch(`${SGDB_PROXY_URL}?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `SteamGridDB API error ${res.status}`);
    }
    return res.json();
}

/* =========================================================
   GITHUB API HELPERS
   ========================================================= */
const API = "https://api.github.com";

function getToken() { return localStorage.getItem("mgc_gh_token"); }
function setToken(t) { localStorage.setItem("mgc_gh_token", t); }
function clearToken() { localStorage.removeItem("mgc_gh_token"); }

function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64decode(str) { return decodeURIComponent(escape(atob(str.replace(/\n/g, "")))); }

async function gh(path, opts = {}) {
    const res = await fetch(`${API}/repos/${REPO}/contents/${path}`, {
        ...opts,
        headers: {
            "Authorization": `token ${getToken()}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            ...(opts.headers || {})
        }
    });
    if (!res.ok && res.status !== 404) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `GitHub API error ${res.status}`);
    }
    if (res.status === 404) return null;
    return res.json();
}

async function listFolder(folder) {
    const data = await gh(folder);
    if (!data) return [];
    return data.filter(f => f.name.endsWith(".md"));
}

async function getFile(path) {
    const data = await gh(path);
    if (!data) return null;
    return { sha: data.sha, content: b64decode(data.content) };
}

async function putFile(path, content, message, sha) {
    const body = { message, content: b64encode(content), branch: BRANCH };
    if (sha) body.sha = sha;
    return gh(path, { method: "PUT", body: JSON.stringify(body) });
}

async function deleteFile(path, sha, message) {
    return gh(path, { method: "DELETE", body: JSON.stringify({ message, sha, branch: BRANCH }) });
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

async function compressImage(file, maxWidth = 1600, quality = 0.85) {
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
        return { blob: file, ext: file.name.split(".").pop().toLowerCase() };
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;

            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            const checkAlpha = file.type === "image/png" || file.type === "image/webp";
            let transparent = false;
            if (checkAlpha) {
                const data = ctx.getImageData(0, 0, width, height).data;
                const pixels = data.length / 4;
                const step = Math.max(1, Math.floor(pixels / 50000));
                for (let i = 0; i < pixels; i += step) {
                    if (data[i * 4 + 3] < 255) { transparent = true; break; }
                }
            }

            const outputType = transparent ? "image/webp" : "image/jpeg";

            canvas.toBlob(
                (blob) => {
                    if (!blob) return reject(new Error("Canvas toBlob failed"));
                    let ext = "jpg";
                    if (blob.type === "image/png") ext = "png";
                    else if (blob.type === "image/webp") ext = "webp";
                    resolve({ blob, ext });
                },
                outputType,
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };

        img.src = url;
    });
}

async function uploadImage(file) {
    let blob = file;
    let ext = file.name.split(".").pop().toLowerCase();
    try {
        const compressed = await compressImage(file);
        blob = compressed.blob;
        ext = compressed.ext;
    } catch (e) {
        console.warn("Compression skipped:", e);
    }

    const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9.\-_]/g, "-")
        .toLowerCase()
        .slice(0, 60);
    const filename = `${Date.now()}-${baseName}.${ext}`;
    const path = `${MEDIA_FOLDER}/${filename}`;

    const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    const result = await gh(path, {
        method: "PUT",
        body: JSON.stringify({ message: `Upload ${filename}`, content, branch: BRANCH })
    });

    state.pendingUploads.push({
        path: path,
        sha: result.content.sha
    });

    toast("Image uploaded");

    return `${PUBLIC_FOLDER}/${filename}`;
}

/* =========================================================
   FRONT MATTER PARSING
   ========================================================= */
function parseFile(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: content };
    const data = jsyaml.load(match[1]) || {};
    return { data, body: match[2] || "" };
}

function serializeFile(data, body) {
    const yaml = jsyaml.dump(data, { lineWidth: 999, noRefs: true, quotingType: '"' });
    return `---\n${yaml}---\n\n${body}`;
}

function slugify(str) {
    return str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

/* =========================================================
   STATE
   ========================================================= */
const state = {
    collection: "reviews",
    view: "list",
    items: [],
    editing: null,
    loading: false,
    loginError: null,
    pendingUploads: []
};

/* =========================================================
   RENDER
   ========================================================= */
const app = document.getElementById("app");

function render() {
    if (!getToken()) return renderLogin();
    renderAdmin();
}

function renderLogin() {
    app.innerHTML = `
    <div class="login-wrap">
      <div class="login-box">
        <h1>MGC Admin</h1>
        <p>Paste your GitHub Personal Access Token to log in. It needs <strong>Contents: Read & Write</strong> permission on the <code>${REPO}</code> repo.</p>
        ${state.loginError ? `<p style="color:var(--brick)">${state.loginError}</p>` : ""}
        <input type="password" id="token-input" placeholder="github_pat_..." />
        <button class="btn btn-primary" id="login-btn" style="width:100%">Log in</button>
        <p style="margin-top:20px;font-size:0.85rem">
          <a href="https://github.com/settings/tokens?type=beta" target="_blank">Create a token on GitHub →</a>
        </p>
      </div>
    </div>
  `;
    document.getElementById("login-btn").addEventListener("click", async () => {
        const token = document.getElementById("token-input").value.trim();
        if (!token) return;
        setToken(token);
        state.loginError = null;
        try {
            await loadList();
            render();
        } catch (e) {
            clearToken();
            state.loginError = "Invalid token or no access: " + e.message;
            render();
        }
    });
    document.getElementById("token-input").addEventListener("keydown", e => {
        if (e.key === "Enter") document.getElementById("login-btn").click();
    });
}

function renderAdmin() {
    app.innerHTML = `
    <header class="admin-header">
      <h1>MGC Admin</h1>
      <div class="actions">
        <a href="/MGC/" class="btn" target="_blank">View site</a>
        <button class="btn btn-danger" id="logout-btn">Log out</button>
      </div>
    </header>
    <nav class="tabs">
      ${Object.entries(COLLECTIONS).map(([key, c]) => `
        <button class="tab ${state.collection === key ? "active" : ""}" data-collection="${key}">
          ${c.label}
        </button>
      `).join("")}
    </nav>
    <main class="main" id="main"></main>
  `;

    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", async () => {
            if (state.view === "edit" && state.pendingUploads.length) {
                if (!confirm("You have unsaved uploads. Discard them?")) return;
                await cleanupPendingUploads();
            }
            destroyBodyEditor();
            state.collection = tab.dataset.collection;
            state.view = "list";
            state.editing = null;
            await loadList();
            render();
        });
    });

    document.getElementById("logout-btn").addEventListener("click", () => {
        if (!confirm("Log out? You'll need to paste your token again.")) return;
        clearToken();
        render();
    });

    renderMain();
}

function renderMain() {
    destroyBodyEditor();
    const main = document.getElementById("main");
    if (state.loading) {
        main.innerHTML = `<div class="loading">Loading…</div>`;
        return;
    }
    if (state.view === "list") {
        main.innerHTML = renderListView();
        attachListHandlers();
    } else {
        main.innerHTML = renderEditView();
        attachEditHandlers();
    }
}

/* =========================================================
   LIST VIEW
   ========================================================= */
function renderListView() {
    const c = COLLECTIONS[state.collection];
    if (!state.items.length) {
        return `
      <div class="list-header">
        <h2>${c.label}</h2>
        <button class="btn btn-primary" id="new-btn">+ New ${c.label.slice(0, -1)}</button>
      </div>
      <div class="empty">No items yet. Click "New" to add one.</div>
    `;
    }
    return `
    <div class="list-header">
      <h2>${c.label} (${state.items.length})</h2>
      <button class="btn btn-primary" id="new-btn">+ New ${c.label.slice(0, -1)}</button>
    </div>
    ${state.items.map(item => {
        const d = item.data || {};
        const title = d[c.identifier] || item.name.replace(/\.md$/, "");
        const img = d.cover_image ? `<img src="${resolveImage(d.cover_image)}" alt="" />` : `<div style="width:48px;height:64px;background:var(--surface-alt);border-radius:3px;flex-shrink:0"></div>`;
        const date = d.date ? new Date(d.date).toLocaleDateString() : "";
        return `
        <div class="list-item">
          ${img}
          <div class="list-item-info">
            <strong>${escapeHtml(title)}</strong>
            <small>${date}</small>
          </div>
          <div class="list-item-actions">
            <button class="btn" data-edit="${item.path}">Edit</button>
            <button class="btn btn-danger" data-delete="${item.path}">Delete</button>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function attachListHandlers() {
    const newBtn = document.getElementById("new-btn");
    if (newBtn) newBtn.addEventListener("click", () => {
        state.pendingUploads = [];
        state.editing = { path: null, sha: null, data: {}, body: "" };
        state.view = "edit";
        renderMain();
    });

    document.querySelectorAll("[data-edit]").forEach(btn => {
        btn.addEventListener("click", () => {
            const path = btn.dataset.edit;
            const item = state.items.find(i => i.path === path);
            if (item) {
                state.pendingUploads = [];
                state.editing = { path: item.path, sha: item.sha, data: { ...item.data }, body: item.body };
                state.view = "edit";
                renderMain();
            }
        });
    });

    document.querySelectorAll("[data-delete]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const path = btn.dataset.delete;
            const item = state.items.find(i => i.path === path);
            if (!item) return;
            const title = item.data[COLLECTIONS[state.collection].identifier] || path;
            if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
            btn.disabled = true;
            btn.textContent = "Deleting…";
            try {
                await deleteFile(path, item.sha, `Delete ${title}`);
                toast(`Deleted "${title}"`);
                await loadList();
                renderMain();
            } catch (e) {
                toast("Delete failed: " + e.message, "error");
                btn.disabled = false;
                btn.textContent = "Delete";
            }
        });
    });
}

/* =========================================================
   EDIT VIEW
   ========================================================= */
function renderEditView() {
    const c = COLLECTIONS[state.collection];
    const isNew = !state.editing.path;

    const d = { ...state.editing.data };
    const bodyField = c.fields.find(f => f.isBody);
    if (bodyField && state.editing.body) {
        d[bodyField.name] = state.editing.body;
    }

    const fieldsHtml = c.fields.map(f => renderField(f, d)).join("");

    return `
    <div class="list-header">
      <h2>${isNew ? "New " + c.label.slice(0, -1) : "Edit " + c.label.slice(0, -1)}</h2>
      <div style="display:flex;gap:8px">
        <button class="btn" id="cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="save-btn">
          ${isNew ? "Publish" : "Save"}
        </button>
      </div>
    </div>
    <form id="edit-form" onsubmit="return false">
      ${fieldsHtml}
    </form>
  `;
}

function renderField(f, d) {
    const val = d[f.name];
    const req = f.required ? ` <span class="required">*</span>` : "";
    const id = `field-${f.name}`;
    const label = `<label for="${id}">${f.label}${req}</label>`;

    if (f.widget === "string") {
        return `<div class="form-group">${label}<input type="text" id="${id}" data-field="${f.name}" value="${escapeAttr(val || "")}" /></div>`;
    }
    if (f.widget === "text") {
        return `<div class="form-group">${label}<textarea id="${id}" data-field="${f.name}" style="min-height:80px">${escapeHtml(val || "")}</textarea></div>`;
    }
    if (f.widget === "markdown") {
        return `<div class="form-group">${label}
      <div class="hint">Markdown supported. Use the toolbar above or type <code>**bold**</code>, <code># heading</code>, etc.</div>
      <textarea id="${id}" data-field="${f.name}">${escapeHtml(val || "")}</textarea>
    </div>`;
    }
    if (f.widget === "datetime") {
        const dtVal = val ? toLocalDatetime(val) : "";
        return `<div class="form-group">${label}<input type="datetime-local" id="${id}" data-field="${f.name}" value="${dtVal}" /></div>`;
    }
    if (f.widget === "multiselect") {
        const selected = Array.isArray(val) ? val : (val ? [val] : []);
        return `<div class="form-group">${label}
      <div class="chips-select" data-multiselect="${f.name}">
        ${f.options.map(opt => `
          <button type="button" class="chip-opt ${selected.includes(opt) ? "selected" : ""}" data-value="${escapeAttr(opt)}">${escapeHtml(opt)}</button>
        `).join("")}
      </div>
    </div>`;
    }
    if (f.widget === "image") {
        const imgPath = val ? val : "";
        return `<div class="form-group">${label}
      ${imgPath ? `<img src="${resolveImage(imgPath)}" class="img-preview" id="preview-${f.name}" />` : `<div id="preview-${f.name}"></div>`}
      <input type="file" accept="image/*" id="${id}" data-image="${f.name}" />
      ${imgPath ? `<div style="margin-top:8px"><button type="button" class="btn btn-danger" data-clear-image="${f.name}">Remove image</button></div>` : ""}
    </div>`;
    }
    if (f.widget === "list") {
        const items = Array.isArray(val) ? val : [];
        return `<div class="form-group">${label}
      <div id="list-${f.name}" data-list="${f.name}">${items.map(v => listItemHtml(f.name, v)).join("")}</div>
      <button type="button" class="btn" data-add-list="${f.name}" style="margin-top:8px">+ Add item</button>
    </div>`;
    }
    return "";
}

function listItemHtml(fieldName, value) {
    return `<div class="list-widget-item">
    <input type="text" data-list-item="${fieldName}" value="${escapeAttr(value || "")}" />
    <button type="button" data-remove-list-item>✕</button>
  </div>`;
}

/* =========================================================
   EDIT HANDLERS
   ========================================================= */
function attachEditHandlers() {
    const c = COLLECTIONS[state.collection];

    // ---- EasyMDE markdown editor ----
    const bodyField = c.fields.find(f => f.isBody);
    if (bodyField) {
        const bodyTextarea = document.querySelector(`[data-field="${bodyField.name}"]`);
        if (bodyTextarea && typeof EasyMDE !== "undefined") {
            window.__bodyEditor = new EasyMDE({
                element: bodyTextarea,
                spellChecker: false,
                autofocus: false,
                status: false,
                minHeight: "400px",
                placeholder: "Write your review here...",
                toolbar: [
                    "bold", "italic", "heading", "|",
                    "quote", "unordered-list", "ordered-list", "|",
                    "link",
                    {
                        name: "upload-image",
                        action: (editor) => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "image/*";
                            input.onchange = async () => {
                                const file = input.files[0];
                                if (!file) return;
                                toast("Uploading image…", "info");
                                try {
                                    const path = await uploadImage(file);
                                    const url = resolveImage(path);
                                    const cm = editor.codemirror;
                                    const selected = cm.getSelection();
                                    cm.replaceSelection(`![${selected || "image"}](${url})`);
                                } catch (e) {
                                    toast("Upload failed: " + e.message, "error");
                                }
                            };
                            input.click();
                        },
                        className: "fa fa-upload",
                        title: "Upload image from your device"
                    },
                    "|",
                    "preview", "side-by-side", "fullscreen", "|",
                    "guide"
                ]
            });
        }
    }

    // ---- Cancel button ----
    document.getElementById("cancel-btn").addEventListener("click", async () => {
        if (!confirm("Discard changes?")) return;
        destroyBodyEditor();
        await cleanupPendingUploads();
        state.view = "list";
        state.editing = null;
        renderMain();
    });

    // ---- Multi-select chips ----
    document.querySelectorAll("[data-multiselect]").forEach(group => {
        group.querySelectorAll(".chip-opt").forEach(btn => {
            btn.addEventListener("click", () => btn.classList.toggle("selected"));
        });
    });

    // ---- Image field: SteamGridDB picker ----
    document.querySelectorAll("[data-image]").forEach(input => {
        input.style.display = "none";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        btn.textContent = "Pick from SteamGridDB";
        btn.addEventListener("click", openSgdbModal);
        input.parentNode.insertBefore(btn, input);
    });

    // ---- Remove image ----
    document.querySelectorAll("[data-clear-image]").forEach(btn => {
        btn.addEventListener("click", () => {
            const fieldName = btn.dataset.clearImage;
            const input = document.querySelector(`[data-image="${fieldName}"]`);
            if (input) input.dataset.uploadedPath = "";
            const prev = document.getElementById(`preview-${fieldName}`);
            if (prev) prev.innerHTML = "";
            btn.remove();
        });
    });

    // ---- List widget (pros/cons) ----
    document.querySelectorAll("[data-add-list]").forEach(btn => {
        btn.addEventListener("click", () => {
            const fieldName = btn.dataset.addList;
            const wrap = document.getElementById(`list-${fieldName}`);
            const div = document.createElement("div");
            div.innerHTML = listItemHtml(fieldName, "");
            wrap.appendChild(div.firstElementChild);
            attachListWidgetHandlers();
        });
    });
    attachListWidgetHandlers();

    // ---- Save / Publish ----
    document.getElementById("save-btn").addEventListener("click", onSave);

    // ---- SGDB modal wiring ----
    document.getElementById("sgdb-modal-close").addEventListener("click", closeSgdbModal);
    document.getElementById("sgdb-modal").addEventListener("click", e => {
        if (e.target.id === "sgdb-modal") closeSgdbModal();
    });
    document.getElementById("sgdb-search-input").addEventListener("input", debounce(e => {
        const term = e.target.value.trim();
        if (term.length < 3) {
            document.getElementById("sgdb-results").innerHTML = "";
            document.getElementById("sgdb-grids").innerHTML = "";
            document.querySelectorAll(".sgdb-show-more, .sgdb-end-note").forEach(el => el.remove());
            sgdbAllGrids = [];
            sgdbShownCount = 0;
            return;
        }
        // Fresh search clears grids
        document.getElementById("sgdb-grids").innerHTML = "";
        document.querySelectorAll(".sgdb-show-more, .sgdb-end-note").forEach(el => el.remove());
        sgdbAllGrids = [];
        sgdbShownCount = 0;

        searchSgdbGames(term);
    }, 400));
}

function attachListWidgetHandlers() {
    document.querySelectorAll("[data-remove-list-item]").forEach(btn => {
        btn.onclick = () => btn.closest(".list-widget-item").remove();
    });
}

async function onSave() {
    const c = COLLECTIONS[state.collection];
    const isNew = !state.editing.path;
    const btn = document.getElementById("save-btn");
    btn.disabled = true;
    btn.textContent = isNew ? "Publishing…" : "Saving…";

    try {
        const data = {};
        let body = "";

        for (const f of c.fields) {
            if (f.isBody) {
                body = window.__bodyEditor
                    ? window.__bodyEditor.value()
                    : document.querySelector(`[data-field="${f.name}"]`).value;
                continue;
            }
            if (f.widget === "multiselect") {
                const group = document.querySelector(`[data-multiselect="${f.name}"]`);
                data[f.name] = [...group.querySelectorAll(".chip-opt.selected")].map(b => b.dataset.value);
                continue;
            }
            if (f.widget === "list") {
                data[f.name] = [...document.querySelectorAll(`[data-list-item="${f.name}"]`)]
                    .map(inp => inp.value.trim())
                    .filter(Boolean);
                continue;
            }
            if (f.widget === "image") {
                const input = document.querySelector(`[data-image="${f.name}"]`);
                if (input && input.dataset.uploadedPath) {
                    data[f.name] = input.dataset.uploadedPath;
                } else if (state.editing.data[f.name]) {
                    data[f.name] = state.editing.data[f.name];
                } else {
                    data[f.name] = "";
                }
                continue;
            }
            if (f.widget === "datetime") {
                const el = document.querySelector(`[data-field="${f.name}"]`);
                data[f.name] = el.value ? new Date(el.value).toISOString() : "";
                continue;
            }
            const el = document.querySelector(`[data-field="${f.name}"]`);
            if (el) data[f.name] = el.value;
        }

        for (const f of c.fields) {
            if (!f.required) continue;
            const val = f.isBody ? body : data[f.name];
            const empty = val === "" || val == null || (Array.isArray(val) && val.length === 0);
            if (empty) {
                toast(`Missing required field: ${f.label}`, "error");
                btn.disabled = false;
                btn.textContent = isNew ? "Publish" : "Save";
                return;
            }
        }

        let path = state.editing.path;
        if (isNew) {
            const slug = slugify(data[c.identifier] || "untitled");
            path = `${c.folder}/${slug}.md`;
        }

        const content = serializeFile(data, body);
        const message = isNew
            ? `Add ${c.label.slice(0, -1)}: ${data[c.identifier] || path}`
            : `Update ${c.label.slice(0, -1)}: ${data[c.identifier] || path}`;

        if (isNew) {
            const existing = await getFile(path);
            if (existing) {
                toast(`A file named "${path.split("/").pop()}" already exists. Change the title.`, "error");
                btn.disabled = false;
                btn.textContent = "Publish";
                return;
            }
        }

        await putFile(path, content, message, state.editing.sha);

        toast(isNew ? "Published!" : "Saved!");
        destroyBodyEditor();
        state.pendingUploads = [];
        await loadList();
        state.view = "list";
        state.editing = null;
        renderMain();
    } catch (e) {
        toast("Save failed: " + e.message, "error");
        btn.disabled = false;
        btn.textContent = isNew ? "Publish" : "Save";
    }
}

/* =========================================================
   STEAMGRIDDB PICKER MODAL
   ========================================================= */
function openSgdbModal() {
    const modal = document.getElementById("sgdb-modal");
    modal.hidden = false;

    document.getElementById("sgdb-search-input").value = "";
    document.getElementById("sgdb-results").innerHTML = "";
    document.getElementById("sgdb-grids").innerHTML = "";

    // Remove leftover "show more" / end notes
    document.querySelectorAll(".sgdb-show-more, .sgdb-end-note").forEach(el => el.remove());

    sgdbAllGrids = [];
    sgdbShownCount = 0;
    sgdbIsLoadingMore = false;

    // Reset scroll to top
    const modalBody = document.querySelector(".sgdb-modal-body");
    if (modalBody) modalBody.scrollTop = 0;

    attachSgdbInfiniteScroll();
    document.getElementById("sgdb-search-input").focus();
}

function closeSgdbModal() {
    document.getElementById("sgdb-modal").hidden = true;
}

async function searchSgdbGames(term) {
    const resultsDiv = document.getElementById("sgdb-results");
    resultsDiv.innerHTML = `<p>Searching…</p>`;
    try {
        const data = await sgdb(`/search/autocomplete/${encodeURIComponent(term)}`);
        if (!data.data || !data.data.length) {
            resultsDiv.innerHTML = `<p>No games found.</p>`;
            return;
        }
        resultsDiv.innerHTML = data.data.map(game => `
      <div class="sgdb-result-item" data-game-id="${game.id}" data-game-name="${escapeHtml(game.name)}">
        <p>${escapeHtml(game.name)}</p>
      </div>
    `).join("");
        resultsDiv.querySelectorAll(".sgdb-result-item").forEach(item => {
            item.addEventListener("click", () => loadSgdbGrids(item.dataset.gameId, item.dataset.gameName));
        });
    } catch (e) {
        resultsDiv.innerHTML = `<p style="color:var(--brick)">Error: ${escapeHtml(e.message)}</p>`;
    }
}

let sgdbAllGrids = [];
let sgdbShownCount = 0;
let sgdbIsLoadingMore = false;
const SGDB_PAGE_SIZE = 5;

async function loadSgdbGrids(gameId, gameName) {
    const gridsDiv = document.getElementById("sgdb-grids");
    gridsDiv.innerHTML = `<p>Loading covers for ${escapeHtml(gameName)}…</p>`;

    const oldBtn = document.querySelector(".sgdb-show-more");
    if (oldBtn) oldBtn.remove();

    sgdbAllGrids = [];
    sgdbShownCount = 0;
    sgdbIsLoadingMore = false;

    try {
        const data = await sgdb(`/grids/game/${gameId}?dimensions=600x900,342x482`);
        if (!data.data || !data.data.length) {
            gridsDiv.innerHTML = `<p>No grids found for this game.</p>`;
            return;
        }
        sgdbAllGrids = data.data;
        gridsDiv.innerHTML = "";
        renderGridBatch();
    } catch (e) {
        gridsDiv.innerHTML = `<p style="color:var(--brick)">Error: ${escapeHtml(e.message)}</p>`;
    }
}

function renderGridBatch() {
    if (sgdbIsLoadingMore) return;
    if (sgdbShownCount >= sgdbAllGrids.length) return;

    sgdbIsLoadingMore = true;

    const gridsDiv = document.getElementById("sgdb-grids");
    const end = Math.min(sgdbShownCount + SGDB_PAGE_SIZE, sgdbAllGrids.length);
    const batch = sgdbAllGrids.slice(sgdbShownCount, end);

    const html = batch.map(grid => `
      <div class="sgdb-grid-item" data-url="${grid.url}" data-thumb="${grid.thumb}">
        <img src="${grid.thumb}" alt="Cover option" loading="lazy" />
      </div>
    `).join("");

    gridsDiv.insertAdjacentHTML("beforeend", html);

    // Bind click handlers on the new items only
    const allItems = gridsDiv.querySelectorAll(".sgdb-grid-item");
    for (let i = sgdbShownCount; i < end; i++) {
        const item = allItems[i];
        if (item && !item.dataset.bound) {
            item.dataset.bound = "1";
            item.addEventListener("click", () => selectSgdbGrid(item.dataset.url, item.dataset.thumb));
        }
    }

    sgdbShownCount = end;
    sgdbIsLoadingMore = false;

    // If everything is loaded, show a small note
    if (sgdbShownCount >= sgdbAllGrids.length) {
        const note = document.createElement("p");
        note.className = "sgdb-end-note";
        note.textContent = "All covers loaded";
        gridsDiv.insertAdjacentElement("afterend", note);
    }
}

// Attach infinite scroll once
function attachSgdbInfiniteScroll() {
    const modalBody = document.querySelector(".sgdb-modal-body");
    if (!modalBody || modalBody.dataset.scrollBound) return;
    modalBody.dataset.scrollBound = "1";

    modalBody.addEventListener("scroll", () => {
        // Only paginate when grids are showing (not during game search)
        if (!sgdbAllGrids.length) return;

        const nearBottom =
            modalBody.scrollTop + modalBody.clientHeight >=
            modalBody.scrollHeight - 120;

        if (nearBottom) {
            renderGridBatch();
        }
    });
}

function selectSgdbGrid(imageUrl, thumbUrl) {
    const fieldName = "cover_image";
    const input = document.querySelector(`[data-image="${fieldName}"]`);
    const prev = document.getElementById(`preview-${fieldName}`);

    // Store the CDN URL directly — no download, no upload
    if (input) input.dataset.uploadedPath = imageUrl;
    state.editing.data[fieldName] = imageUrl;

    // Update preview immediately
    if (prev) {
        prev.innerHTML = `<img src="${imageUrl}" class="img-preview" id="preview-${fieldName}" />`;
    }

    toast("Cover selected!");
    closeSgdbModal();
}

/* =========================================================
   DATA LOADING
   ========================================================= */
async function loadList() {
    state.loading = true;
    try {
        const c = COLLECTIONS[state.collection];
        const files = await listFolder(c.folder);
        const items = [];
        for (const f of files) {
            const file = await getFile(f.path);
            if (!file) continue;
            const { data, body } = parseFile(file.content);
            items.push({ name: f.name, path: f.path, sha: file.sha, data, body });
        }
        items.sort((a, b) => {
            const da = a.data.date ? new Date(a.data.date) : 0;
            const db = b.data.date ? new Date(b.data.date) : 0;
            return db - da;
        });
        state.items = items;
    } catch (e) {
        toast("Failed to load: " + e.message, "error");
    }
    state.loading = false;
}

/* =========================================================
   UTILITIES
   ========================================================= */
function resolveImage(path) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    const isGitHubPages = location.hostname.endsWith("github.io");
    const base = isGitHubPages ? "/MGC" : "";
    if (path.startsWith("/")) return base + path;
    return base + "/" + path;
}

async function cleanupPendingUploads() {
    if (!state.pendingUploads.length) return;
    const count = state.pendingUploads.length;
    toast(`Removing ${count} unused image${count > 1 ? "s" : ""}…`, "info");
    for (const upload of state.pendingUploads) {
        try {
            await deleteFile(upload.path, upload.sha, `Cleanup unused image: ${upload.path.split("/").pop()}`);
        } catch (e) {
            console.warn("Could not delete pending upload:", upload.path, e);
        }
    }
    state.pendingUploads = [];
}

function destroyBodyEditor() {
    if (window.__bodyEditor) {
        try { window.__bodyEditor.toTextArea(); } catch (e) { }
        window.__bodyEditor = null;
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function toLocalDatetime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let toastTimer;
function toast(msg, type = "success") {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.className = "toast" + (type === "error" ? " error" : type === "info" ? " info" : "");
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 3500);
}

/* =========================================================
   BOOT
   ========================================================= */
(async function boot() {
    if (getToken()) {
        try {
            await loadList();
        } catch (e) {
            state.loginError = "Could not load data: " + e.message;
            clearToken();
        }
    }
    render();
})();