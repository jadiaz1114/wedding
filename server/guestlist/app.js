// ============================================================
// Guest list client script.
//
// Shares the same admin token (sessionStorage key) as /admin, so signing
// in on one carries over to the other. Guest names are inserted with
// textContent, never innerHTML — same rule as the admin dashboard.
// ============================================================

(function () {
  const STORAGE_KEY = 'weddingAdminToken';

  const loginView = document.getElementById('loginView');
  const listView = document.getElementById('listView');
  const loginForm = document.getElementById('loginForm');
  const tokenInput = document.getElementById('tokenInput');
  const loginError = document.getElementById('loginError');
  const signOutBtn = document.getElementById('signOutBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const guestBody = document.querySelector('#guestTable tbody');
  const listEmpty = document.getElementById('listEmpty');

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
    listView.hidden = true;
    signOutBtn.hidden = true;
    loginView.hidden = false;
    loginError.hidden = !message;
    loginError.textContent = message || '';
  }

  function showList() {
    loginView.hidden = true;
    listView.hidden = false;
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

  function cell(text, className) {
    const td = document.createElement('td');
    td.textContent = text ?? '';
    if (className) td.className = className;
    return td;
  }

  function qrCell(row) {
    const td = document.createElement('td');
    if (row.attending !== 'Joyfully Accepts') {
      td.textContent = 'Not attending';
      td.className = 'muted';
      return td;
    }
    const wrap = document.createElement('div');
    wrap.className = 'qr-cell';

    const src = '/api/admin/rsvps/' + row.id + '/qrcode.png?token=' + encodeURIComponent(getToken());

    const img = document.createElement('img');
    img.className = 'qr-thumb';
    img.src = src;
    img.alt = 'QR code for ' + row.name;
    img.width = 64;
    img.height = 64;

    const link = document.createElement('a');
    link.className = 'btn btn-ghost';
    link.href = src;
    link.download = row.name.replace(/[^a-z0-9]+/gi, '-') + '-qr.png';
    link.textContent = 'Download';

    wrap.appendChild(img);
    wrap.appendChild(link);
    td.appendChild(wrap);
    return td;
  }

  function renderGuests(rows) {
    guestBody.textContent = '';
    listEmpty.hidden = rows.length > 0;
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.appendChild(cell(row.name));
      tr.appendChild(cell(row.attending));
      tr.appendChild(cell(row.tableNumber || '—', row.tableNumber ? '' : 'muted'));
      tr.appendChild(qrCell(row));
      guestBody.appendChild(tr);
    });
  }

  async function loadData() {
    try {
      const rsvps = await fetchJson('/api/admin/rsvps');
      renderGuests(rsvps);
      showList();
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

  // Support bookmarking with /guestlist?token=... — same pattern as /admin.
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
