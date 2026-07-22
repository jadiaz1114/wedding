// ============================================================
// Admin dashboard client script.
//
// This page holds no guest data by itself — it only renders what the
// token-protected /api/admin/* endpoints return, so all guest text
// (name, note, message) is inserted with textContent, never innerHTML.
// ============================================================

(function () {
  const STORAGE_KEY = 'weddingAdminToken';

  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const tokenInput = document.getElementById('tokenInput');
  const loginError = document.getElementById('loginError');
  const signOutBtn = document.getElementById('signOutBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const summaryEl = document.getElementById('summary');
  const rsvpBody = document.querySelector('#rsvpTable tbody');
  const wishBody = document.querySelector('#wishTable tbody');
  const godparentBody = document.querySelector('#godparentTable tbody');
  const rsvpEmpty = document.getElementById('rsvpEmpty');
  const wishEmpty = document.getElementById('wishEmpty');
  const godparentEmpty = document.getElementById('godparentEmpty');
  const rsvpCsvLink = document.getElementById('rsvpCsvLink');
  const wishCsvLink = document.getElementById('wishCsvLink');
  const godparentCsvLink = document.getElementById('godparentCsvLink');
  const deleteRsvpsBtn = document.getElementById('deleteRsvpsBtn');
  const deleteWishesBtn = document.getElementById('deleteWishesBtn');
  const deleteGodparentsBtn = document.getElementById('deleteGodparentsBtn');

  function getToken() {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  }
  function setToken(token) {
    sessionStorage.setItem(STORAGE_KEY, token);
  }
  function clearToken() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function showLogin(message) {
    dashboardView.hidden = true;
    signOutBtn.hidden = true;
    loginView.hidden = false;
    loginError.hidden = !message;
    loginError.textContent = message || '';
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    signOutBtn.hidden = false;
  }

  async function fetchJson(path) {
    const res = await fetch(path, { headers: { 'x-admin-token': getToken() } });
    if (res.status === 403 || res.status === 503) {
      clearToken();
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Access denied.');
    }
    if (!res.ok) throw new Error('Something went wrong loading data.');
    return res.json();
  }

  function cell(text) {
    const td = document.createElement('td');
    td.textContent = text ?? '';
    return td;
  }

  function formatDate(value) {
    if (!value) return '';
    // SQLite's datetime('now') stores UTC as 'YYYY-MM-DD HH:MM:SS'.
    const d = new Date(value.replace(' ', 'T') + 'Z');
    return isNaN(d) ? value : d.toLocaleString();
  }

  function tableNumberCell(row) {
    const td = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'table-num-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'table-num-input';
    input.placeholder = '—';
    input.maxLength = 20;
    input.value = row.tableNumber || '';

    const status = document.createElement('span');
    status.className = 'table-num-status';

    let saved = input.value;
    async function save() {
      const value = input.value.trim();
      if (value === saved) return;
      status.textContent = 'Saving…';
      try {
        const res = await fetch('/api/admin/rsvps/' + row.id + '/table', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': getToken() },
          body: JSON.stringify({ tableNumber: value })
        });
        if (!res.ok) throw new Error();
        saved = value;
        status.textContent = 'Saved';
        setTimeout(() => { if (status.textContent === 'Saved') status.textContent = ''; }, 1500);
      } catch (err) {
        status.textContent = 'Error';
      }
    }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });

    wrap.appendChild(input);
    wrap.appendChild(status);
    td.appendChild(wrap);
    return td;
  }

  function renderRsvps(rows) {
    rsvpBody.textContent = '';
    rsvpEmpty.hidden = rows.length > 0;
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.appendChild(cell(row.name));
      tr.appendChild(cell(row.attending));
      tr.appendChild(cell(row.meal));
      tr.appendChild(cell(row.note));
      tr.appendChild(tableNumberCell(row));
      tr.appendChild(cell(formatDate(row.createdAt)));
      rsvpBody.appendChild(tr);
    });
  }

  function renderWishes(rows) {
    wishBody.textContent = '';
    wishEmpty.hidden = rows.length > 0;
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.appendChild(cell(row.name));
      tr.appendChild(cell(row.message));
      tr.appendChild(cell(formatDate(row.createdAt)));
      wishBody.appendChild(tr);
    });
  }

  function renderGodparents(rows) {
    godparentBody.textContent = '';
    godparentEmpty.hidden = rows.length > 0;
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.appendChild(cell(row.name));
      tr.appendChild(cell(row.plusOne));
      tr.appendChild(cell(row.message));
      tr.appendChild(cell(formatDate(row.createdAt)));
      godparentBody.appendChild(tr);
    });
  }

  function renderSummary(rsvps, wishes, godparents) {
    const accepted = rsvps.filter((r) => r.attending === 'Joyfully Accepts').length;
    const declined = rsvps.filter((r) => r.attending === 'Regretfully Declines').length;
    const stats = [
      ['RSVPs', rsvps.length],
      ['Attending', accepted],
      ['Declined', declined],
      ['Messages', wishes.length],
      ['Godparent RSVPs', godparents.length]
    ];
    summaryEl.textContent = '';
    stats.forEach(([label, value]) => {
      const div = document.createElement('div');
      div.className = 'stat';
      const num = document.createElement('div');
      num.className = 'stat-num';
      num.textContent = String(value);
      const lab = document.createElement('div');
      lab.className = 'stat-label';
      lab.textContent = label;
      div.appendChild(num);
      div.appendChild(lab);
      summaryEl.appendChild(div);
    });
  }

  async function loadData() {
    const token = getToken();
    rsvpCsvLink.href = '/api/admin/rsvps.csv?token=' + encodeURIComponent(token);
    wishCsvLink.href = '/api/admin/wishes.csv?token=' + encodeURIComponent(token);
    godparentCsvLink.href = '/api/admin/godparents.csv?token=' + encodeURIComponent(token);
    try {
      const [rsvps, wishes, godparents] = await Promise.all([
        fetchJson('/api/admin/rsvps'),
        fetchJson('/api/admin/wishes'),
        fetchJson('/api/admin/godparents')
      ]);
      renderSummary(rsvps, wishes, godparents);
      renderRsvps(rsvps);
      renderWishes(wishes);
      renderGodparents(godparents);
      showDashboard();
    } catch (err) {
      showLogin(err.message || 'Access denied. Check your token and try again.');
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = tokenInput.value.trim();
    if (!value) return;
    setToken(value);
    tokenInput.value = '';
    loadData();
  });

  signOutBtn.addEventListener('click', () => {
    clearToken();
    showLogin();
  });

  refreshBtn.addEventListener('click', loadData);

  async function deleteAll(button, label, endpoint) {
    const count = document.querySelectorAll('#' + button.dataset.table + ' tbody tr').length;
    const noun = count === 1 ? label.replace(/s$/, '') : label;
    if (!confirm('Delete all ' + count + ' ' + noun + '? This cannot be undone.')) return;

    button.disabled = true;
    try {
      const res = await fetch(endpoint, { method: 'DELETE', headers: { 'x-admin-token': getToken() } });
      if (!res.ok) throw new Error();
      await loadData();
    } catch (err) {
      alert('Something went wrong deleting ' + label + '. Please try again.');
    } finally {
      button.disabled = false;
    }
  }

  deleteRsvpsBtn.dataset.table = 'rsvpTable';
  deleteWishesBtn.dataset.table = 'wishTable';
  deleteGodparentsBtn.dataset.table = 'godparentTable';

  deleteRsvpsBtn.addEventListener('click', () => deleteAll(deleteRsvpsBtn, 'RSVPs', '/api/admin/rsvps'));
  deleteWishesBtn.addEventListener('click', () => deleteAll(deleteWishesBtn, 'Love Messages', '/api/admin/wishes'));
  deleteGodparentsBtn.addEventListener('click', () => deleteAll(deleteGodparentsBtn, 'Godparent RSVPs', '/api/admin/godparents'));

  // Support bookmarking with /admin?token=... — read it once, store it,
  // then strip it from the URL bar/history so the secret doesn't linger
  // somewhere it could be shoulder-surfed, screenshotted, or shared.
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (urlToken) {
    setToken(urlToken);
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (getToken()) {
    loadData();
  } else {
    showLogin();
  }
})();
