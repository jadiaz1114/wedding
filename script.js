// ============================================================
// Michelle & Jose — Wedding Invitation
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initCountdown();
  initScrollReveal();
  initGalleryLightbox();
  initSlideshowBooth();
  initWishWall();
  initRsvp();
  initCopyButtons();
});

/* ---------------- NAV ---------------- */
function initNav(){
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));

  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('[data-nav]');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        navAnchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => spy.observe(s));
}

/* ---------------- COUNTDOWN ---------------- */
function initCountdown(){
  const el = document.getElementById('countdown');
  if (!el) return;
  const target = new Date(el.dataset.weddingDate).getTime();

  function tick(){
    const now = Date.now();
    let diff = target - now;
    if (diff < 0) diff = 0;

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    document.getElementById('cd-days').textContent = String(days).padStart(2,'0');
    document.getElementById('cd-hours').textContent = String(hours).padStart(2,'0');
    document.getElementById('cd-mins').textContent = String(mins).padStart(2,'0');
    document.getElementById('cd-secs').textContent = String(secs).padStart(2,'0');
  }
  tick();
  setInterval(tick, 1000);
}

/* ---------------- SCROLL REVEAL ---------------- */
function initScrollReveal(){
  const targets = document.querySelectorAll('.section > .container, .countdown-band');
  targets.forEach(t => t.classList.add('reveal'));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach(t => obs.observe(t));
}

/* ---------------- GALLERY LIGHTBOX ---------------- */
function initGalleryLightbox(){
  const grid = document.getElementById('galleryGrid');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const closeBtn = document.getElementById('lightboxClose');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || '';
    lightbox.hidden = false;
  });
  function close(){ lightbox.hidden = true; lightboxImg.src = ''; }
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

/* ---------------- GUEST PHOTO SLIDESHOW ----------------
   Photos are stored as base64 data URLs in this browser's
   localStorage only (key: "weddingGuestPhotos"). They do NOT
   sync between devices or visitors — this is a per-browser
   photo booth, not a shared cloud gallery. See README.md if
   you want a shared version using a form backend or storage
   service.
--------------------------------------------------------- */
function initSlideshowBooth(){
  const input = document.getElementById('photoUpload');
  const clearBtn = document.getElementById('clearPhotos');
  const stage = document.getElementById('slideshowStage');
  const slideshow = document.getElementById('slideshow');
  const empty = document.getElementById('slideshowEmpty');
  const counter = document.getElementById('ssCounter');
  const prevBtn = document.getElementById('ssPrev');
  const nextBtn = document.getElementById('ssNext');
  const playBtn = document.getElementById('ssPlay');
  if (!input) return;

  const STORAGE_KEY = 'weddingGuestPhotos';
  let photos = [];
  let index = 0;
  let playing = false;
  let timer = null;

  function load(){
    try {
      photos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch(e){ photos = []; }
  }
  function save(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    } catch(e){
      alert("Couldn't save all photos on this device (storage limit reached). Try uploading fewer or smaller photos.");
    }
  }

  function render(){
    stage.innerHTML = '';
    if (photos.length === 0){
      slideshow.hidden = true;
      empty.hidden = false;
      return;
    }
    slideshow.hidden = false;
    empty.hidden = true;
    if (index >= photos.length) index = 0;

    photos.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Guest photo ' + (i + 1);
      if (i === index) img.classList.add('active');
      stage.appendChild(img);
    });
    counter.textContent = (index + 1) + ' / ' + photos.length;
  }

  function go(delta){
    if (photos.length === 0) return;
    index = (index + delta + photos.length) % photos.length;
    render();
  }

  function stopPlay(){
    playing = false;
    playBtn.innerHTML = '&#9658; Play';
    if (timer) clearInterval(timer);
  }

  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    if (files.length === 0) return;
    let remaining = files.length;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        photos.push(reader.result);
        remaining--;
        if (remaining === 0){
          save();
          index = photos.length - 1;
          render();
        }
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  });

  clearBtn.addEventListener('click', () => {
    if (photos.length === 0) return;
    if (!confirm('Remove all photos you added on this device?')) return;
    photos = [];
    localStorage.removeItem(STORAGE_KEY);
    stopPlay();
    render();
  });

  prevBtn.addEventListener('click', () => { stopPlay(); go(-1); });
  nextBtn.addEventListener('click', () => { stopPlay(); go(1); });
  playBtn.addEventListener('click', () => {
    if (playing){
      stopPlay();
    } else {
      if (photos.length < 2) return;
      playing = true;
      playBtn.innerHTML = '&#10074;&#10074; Pause';
      timer = setInterval(() => go(1), 2500);
    }
  });

  load();
  render();
}

/* ---------------- LOVE MESSAGES WALL ----------------
   Submissions POST to Netlify Forms (visible in your Netlify
   dashboard once deployed) AND are added to the wall on this
   visitor's screen immediately for a nice live feel. The wall
   itself is per-browser — to permanently feature messages for
   everyone, copy them from your Netlify dashboard into the
   seed cards in index.html (#wishWall). See README.md.
--------------------------------------------------------- */
function initWishWall(){
  const form = document.getElementById('wishForm');
  const wall = document.getElementById('wishWall');
  const status = document.getElementById('wishStatus');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('wishName').value.trim();
    const message = document.getElementById('wishMessage').value.trim();
    if (!name || !message) return;

    status.textContent = 'Sending...';

    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      });
    } catch (err) {
      // Netlify Forms only works once deployed; fine to ignore locally
    }

    const card = document.createElement('div');
    card.className = 'wish-card';
    const p = document.createElement('p');
    p.textContent = '\u201C' + message + '\u201D';
    const span = document.createElement('span');
    span.textContent = '\u2014 ' + name;
    card.appendChild(p);
    card.appendChild(span);
    wall.prepend(card);

    form.reset();
    status.textContent = 'Thank you for your message!';
    setTimeout(() => status.textContent = '', 4000);
  });
}

/* ---------------- RSVP + GUEST TRACKING ----------------
   Submissions POST to Netlify Forms — once deployed, view all
   responses (name, attending, guest count, meal) in your
   Netlify site dashboard under Forms, or export as CSV. A
   confirmation is also remembered on this device so returning
   guests can see they already responded.
--------------------------------------------------------- */
function initRsvp(){
  const form = document.getElementById('rsvpForm');
  const status = document.getElementById('rsvpStatus');
  const trackerBody = document.getElementById('rsvpTrackerBody');
  if (!form) return;

  const STORAGE_KEY = 'weddingRsvpResponse';

  function renderTracker(){
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved){
        trackerBody.textContent = saved.name + ' — ' + saved.attending + ' (' + saved.guests + ' guest' + (saved.guests === '1' ? '' : 's') + ')';
      }
    } catch(e){ /* noop */ }
  }
  renderTracker();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const record = {
      name: data.get('name'),
      email: data.get('email'),
      attending: data.get('attending'),
      guests: data.get('guests'),
      meal: data.get('meal'),
      note: data.get('note'),
      submittedAt: new Date().toISOString()
    };
    if (!record.name || !record.attending) return;

    status.textContent = 'Sending...';
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString()
      });
    } catch (err) {
      // Netlify Forms only works once deployed; fine to ignore locally
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    renderTracker();
    status.textContent = 'Thank you — your RSVP has been received!';
    form.reset();
  });
}

/* ---------------- COPY TO CLIPBOARD ---------------- */
function initCopyButtons(){
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.copyTarget;
      const target = document.getElementById(targetId);
      const text = target ? target.dataset.copy : '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = original, 1800);
      } catch (e){
        alert(text);
      }
    });
  });
}
