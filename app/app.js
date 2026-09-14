const PASSWORD = '220326';
const ORIGINALS = 54;

let entry = '';
let unlocked = false;
let lightboxOpen = false;
let lbIndex = 0;
let confettiRunning = false;
let cities = [];
let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let mapObj = null;
let mapInit = false;
let pinsAdded = false;
let bookOpen = false;

const $ = (id) => document.getElementById(id);

const loginScreen = $('login-screen');
const loginCard = document.querySelector('.login-card');
const dots = document.querySelectorAll('#pin-dots .dot');
const loginMsg = $('login-msg');
const pinDots = $('pin-dots');
const content = $('content');
const music = $('bg-music');
const musicToggle = $('music-toggle');
const sky = $('sky');
const gallery = $('gallery');
const lightbox = $('lightbox');
const lbImg = $('lb-img');
const lbCaption = $('lb-caption');
const canvas = $('confetti');
const ctx = canvas.getContext('2d');
const heartNav = $('heart-nav');

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shortDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return ''; }
}

function dateRangeLabel(items) {
  const dates = items.map((i) => i.datetime).filter(Boolean).sort();
  if (!dates.length) return '';
  const a = new Date(dates[0]), b = new Date(dates[dates.length - 1]);
  const f = (d) => d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  return a.getTime() === b.getTime() ? f(a) : `${f(a)} – ${f(b)}`;
}

/* ══════════ NUMPAD ══════════ */

function updateDots() {
  dots.forEach((d, i) => d.classList.toggle('filled', i < entry.length));
}

function pressDigit(d, sourceEl) {
  if (entry.length >= 6 || unlocked) return;
  entry += d;
  updateDots();
  spawnMiniHeart(sourceEl);
  if (entry.length === 6) setTimeout(checkPassword, 220);
}

function backspace() {
  if (unlocked) return;
  entry = entry.slice(0, -1);
  updateDots();
}

function checkPassword() {
  if (entry === PASSWORD) {
    loginMsg.textContent = 'Richtig! Willkommen mein Schatz.';
    loginMsg.classList.remove('error');
    unlock();
  } else {
    loginMsg.textContent = "Ups, das war es nicht — versuch's nochmal 💗";
    loginMsg.classList.add('error');
    loginCard.classList.add('shake');
    pinDots.classList.add('shake');
    setTimeout(() => {
      loginCard.classList.remove('shake');
      pinDots.classList.remove('shake');
    }, 550);
    entry = '';
    updateDots();
  }
}

document.querySelectorAll('.key[data-digit]').forEach((btn) => {
  btn.addEventListener('click', () => pressDigit(btn.dataset.digit, btn));
});
$('key-back').addEventListener('click', backspace);

window.addEventListener('keydown', (e) => {
  if (unlocked) {
    if (bookOpen) {
      if (e.key === 'Escape') closeBook();
      if (e.key === 'ArrowRight') turnNext();
      if (e.key === 'ArrowLeft') turnPrev();
      return;
    }
    if (lightboxOpen) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') lbNext();
      if (e.key === 'ArrowLeft') lbPrev();
    }
    return;
  }
  if (/^[0-9]$/.test(e.key)) pressDigit(e.key);
  if (e.key === 'Backspace') backspace();
});

/* ══════════ UNLOCK ══════════ */

function unlock() {
  unlocked = true;
  burstConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 110);

  music.volume = 0.75;
  music.play().catch(() => {});

  setTimeout(() => {
    loginScreen.classList.add('opening');
    content.hidden = false;
    musicToggle.hidden = false;
    heartNav.hidden = false;
    startTypewriter();
    observeReveals();
    initMap();
    initNavSpy();
    drawFlourish();
    setTimeout(() => loginScreen.remove(), 1000);
  }, 700);
}

/* ══════════ MUSIC ══════════ */

musicToggle.addEventListener('click', () => {
  if (music.paused) music.play(); else music.pause();
});
music.addEventListener('play', () => { musicToggle.classList.add('playing'); musicToggle.setAttribute('aria-label', 'Musik pausieren'); });
music.addEventListener('pause', () => { musicToggle.classList.remove('playing'); musicToggle.setAttribute('aria-label', 'Musik abspielen'); });

/* ══════════ FLOATIES: sparse gold petals ══════════ */

const FLOATIES = ['❦', '✦', '❖', '✧'];

function spawnFloaty() {
  if (document.hidden || reduced) return;
  const el = document.createElement('span');
  el.className = 'float-petal';
  el.textContent = FLOATIES[Math.floor(Math.random() * FLOATIES.length)];
  el.style.left = Math.random() * 100 + 'vw';
  el.style.fontSize = (9 + Math.random() * 12) + 'px';
  const dur = 12 + Math.random() * 10;
  el.style.animationDuration = dur + 's';
  sky.appendChild(el);
  setTimeout(() => el.remove(), dur * 1000 + 200);
}

setInterval(spawnFloaty, 1100);
for (let i = 0; i < 6; i++) setTimeout(spawnFloaty, i * 500);

/* ══════════ FLOURISH draw-on ══════════ */

function drawFlourish() {
  const f = document.querySelector('.flourish');
  if (f) f.classList.add('drawn');
}

/* ══════════ TYPEWRITER ══════════ */

const TYPE_LINES = [
  'Hallo mein Schatz…',
  'jedes Mal, wenn ich dich sehe,',
  'kann ich nicht aufhören zu lächeln.',
  'du bist das Beste, was mir je passiert ist.',
  'Ich liebe dich. Bis zum Tod.'
];

function startTypewriter() {
  const el = $('typewriter');
  let line = 0, char = 0, deleting = false;
  function tick() {
    const text = TYPE_LINES[line];
    el.innerHTML = escapeHtml(text.slice(0, char)) + '<span class="caret"></span>';
    if (!deleting) {
      char++;
      if (char > text.length) { deleting = true; setTimeout(tick, 2100); return; }
      setTimeout(tick, 64);
    } else {
      char--;
      if (char < 0) {
        deleting = false;
        line = (line + 1) % TYPE_LINES.length;
        char = 0;
        setTimeout(tick, 380);
        return;
      }
      setTimeout(tick, 26);
    }
  }
  tick();
}

/* ══════════ HEART-LINE NAV (scroll spy) ══════════ */

function initNavSpy() {
  const navDots = document.querySelectorAll('.nav-dot');
  const sections = ['top', 'buecher', 'karte', 'liebling', 'archiv', 'herz']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        navDots.forEach((d) => d.classList.toggle('active', d.dataset.section === en.target.id));
      }
    });
  }, { rootMargin: '-42% 0px -42% 0px' });

  sections.forEach((s) => io.observe(s));
}

/* ══════════ GALLERY ══════════ */

const allPhotos = [];

function buildGallery() {
  gallery.innerHTML = '';
  allPhotos.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'mini-polaroid';
    if (p.feature) card.classList.add('feature');
    card.tabIndex = 0;
    card.style.transform = `rotate(${(Math.random() * 6 - 3).toFixed(2)}deg)`;
    const img = document.createElement('img');
    img.src = p.file;
    img.alt = 'Erinnerung';
    img.loading = 'lazy';
    const cap = document.createElement('p');
    cap.className = 'mini-caption';
    cap.textContent = p.label;
    card.appendChild(img);
    card.appendChild(cap);
    const open = () => openLightbox(idx);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    gallery.appendChild(card);
  });
}

for (let i = 1; i <= ORIGINALS; i++) {
  allPhotos.push({
    file: 'assets/photo-' + String(i).padStart(2, '0') + '.jpg',
    label: '💕 ' + i
  });
}
buildGallery();

fetch('assets/cities.json')
  .then((r) => r.json())
  .then((data) => {
    cities = data;
    cities.forEach((c) => {
      c.items.forEach((item, n) => {
        if (item.kind === 'photo') {
          allPhotos.push({
            file: item.file,
            label: c.city + (item.datetime ? ' · ' + shortDate(item.datetime) : ''),
            feature: n > 0 && n % 9 === 0
          });
        }
      });
    });
    buildGallery();
    buildShelf();
    addPins();
  })
  .catch(() => {
    document.getElementById('bookshelf').parentElement.hidden = true;
    document.querySelector('.map-frame').hidden = true;
  });

function observeReveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

/* ══════════ LIGHTBOX ══════════ */

function showLb() {
  lbImg.src = allPhotos[lbIndex].file;
  lbCaption.textContent = (lbIndex + 1) + ' / ' + allPhotos.length;
  lbImg.style.animation = 'none';
  void lbImg.offsetWidth;
  lbImg.style.animation = '';
}

function openLightbox(i) {
  lbIndex = i;
  showLb();
  lightbox.hidden = false;
  lightboxOpen = true;
}
function lbNext() { lbIndex = (lbIndex + 1) % allPhotos.length; showLb(); }
function lbPrev() { lbIndex = (lbIndex - 1 + allPhotos.length) % allPhotos.length; showLb(); }
function closeLightbox() { lightbox.hidden = true; lightboxOpen = false; }

$('lb-next').addEventListener('click', (e) => { e.stopPropagation(); lbNext(); });
$('lb-prev').addEventListener('click', (e) => { e.stopPropagation(); lbPrev(); });
$('lb-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

/* ══════════ MAP ══════════ */

const PIN_SVG = `<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M17 30 C 9 22 4 17 4 11.5 C 4 6.5 8 3 12.2 3 C 14.4 3 16.2 4 17 4.9 C 17.8 4 18.6 3 21.8 3 C 25.4 3 30 6.5 30 11.5 C 30 17 25 22 17 30 Z"
        fill="#6e1f30" stroke="#c9a26b" stroke-width="1.4"/>
  <ellipse cx="12.5" cy="9.5" rx="3" ry="4.5" fill="#e8cfa0" opacity=".35" transform="rotate(-24 12 9.5)"/>
</svg>`;

function initMap() {
  if (mapInit || typeof L === 'undefined') return;
  mapInit = true;

  mapObj = L.map('map', { scrollWheelZoom: false }).setView([47.98, 8.8], 10);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(mapObj);
  addPins();
  setTimeout(() => mapObj.invalidateSize(), 300);
}

function addPins() {
  if (!mapObj || !cities.length || pinsAdded) return;
  pinsAdded = true;
  const pts = [];
  cities.forEach((c, idx) => {
    if (c.lat == null || c.lon == null) return;
    pts.push([c.lat, c.lon]);
    const icon = L.divIcon({
      className: '',
      html: `<span class="map-pin">${PIN_SVG}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 30],
      popupAnchor: [0, -26]
    });
    const thumbs = c.items.filter((i) => i.kind === 'photo').slice(0, 3);
    const strip = thumbs.map((i) => `<img src="${i.file}" alt="">`).join('');
    const html = `<div class="popup-city">${escapeHtml(c.city)}</div>
      <div style="font-size:12px;color:#7d5a6b;margin-bottom:8px;">${c.count} Erinnerungen · ${dateRangeLabel(c.items)}</div>
      <div class="popup-strip">${strip}</div>
      <button class="popup-open-btn" data-city="${idx}">Buch öffnen</button>`;
    const marker = L.marker([c.lat, c.lon], { icon }).addTo(mapObj);
    marker.bindPopup(html);
    marker.on('popupopen', (e) => {
      const btn = e.popup.getElement().querySelector('.popup-open-btn');
      btn.addEventListener('click', () => {
        mapObj.closePopup();
        openBook(idx);
      });
    });
  });
  if (pts.length) mapObj.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 11 });
}

/* ══════════ BOOKSHELF ══════════ */

function buildShelf() {
  const shelf = $('bookshelf');
  shelf.innerHTML = '';
  cities.forEach((c, idx) => {
    const btn = document.createElement('button');
    btn.className = 'book-item';
    btn.setAttribute('aria-label', `Buch öffnen: ${c.city}, ${c.count} Erinnerungen`);
    const cover = c.items.find((i) => i.kind === 'photo');
    btn.innerHTML = `
      <div class="book-cover">
        <span class="book-num">${c.count}</span>
        <img src="${cover ? cover.file : 'assets/favourite.jpg'}" alt="" loading="lazy">
        <span class="book-city">${escapeHtml(c.city)}</span>
      </div>
      <span class="book-hint">aufklappen</span>`;
    btn.addEventListener('click', () => openBook(idx));
    shelf.appendChild(btn);
  });
}

/* ══════════ BOOK VIEWER ══════════ */

const bookModal = $('book-modal');
const pageLeft = $('page-left');
const pageRight = $('page-right');
const flipLeaf = $('flip-leaf');
const leafFront = flipLeaf.querySelector('.leaf-front');
const leafBack = flipLeaf.querySelector('.leaf-back');
const bookState = { city: null, sheet: 0, sheets: 0, turning: false };

function mediaHTML(item) {
  if (!item) return '';
  if (item.kind === 'video') {
    return `<video src="${item.file}" poster="${item.poster || ''}" controls playsinline preload="metadata"></video>`;
  }
  return `<img src="${item.file}" alt="Erinnerung" loading="lazy">`;
}

function openBook(idx) {
  bookState.city = cities[idx];
  if (!bookState.city) return;
  bookState.sheet = 0;
  bookState.sheets = Math.ceil(bookState.city.items.length / 2);
  bookState.turning = false;
  bookOpen = true;
  $('book-city').textContent = bookState.city.city;
  $('book-count').textContent = `${bookState.city.count} Erinnerungen`;
  $('book-range').textContent = dateRangeLabel(bookState.city.items);
  renderBook();
  bookModal.hidden = false;
  document.body.style.overflow = 'hidden';
  mapObj?.closePopup();
}

function closeBook() {
  bookModal.hidden = true;
  document.body.style.overflow = '';
  bookOpen = false;
  bookModal.querySelectorAll('video').forEach((v) => v.pause());
  pageRight.classList.remove('shading');
  pageLeft.classList.remove('shading');
}

$('book-close').addEventListener('click', closeBook);
bookModal.addEventListener('click', (e) => { if (e.target === bookModal) closeBook(); });

const MONOGRAM = `<div class="page-monogram">
    <div class="monogram">I <span class="monogram-heart">❦</span> D</div>
    <p>unsere geschichte</p>
  </div>`;
const END_NOTE = `<div class="page-end-note">Fortsetzung folgt…</div>`;

function mediaWrap(item) {
  return item ? `<div class="page-media">${mediaHTML(item)}</div>` : '';
}

function leftBase(s) {
  if (s === 0) return MONOGRAM;
  const i = s * 2 - 1;
  return i < bookState.city.items.length ? mediaWrap(bookState.city.items[i]) : END_NOTE;
}

function rightBase(s) {
  if (s >= bookState.sheets) return END_NOTE;
  const i = s * 2;
  return i < bookState.city.items.length ? mediaWrap(bookState.city.items[i]) : END_NOTE;
}

function updateProgress() {
  const s = bookState.sheet, n = bookState.city.items.length;
  if (!n) { $('book-progress').textContent = ''; return; }
  $('book-progress').textContent =
    `${Math.min(s * 2 + 1, n)}–${Math.min(s * 2 + 2, n)} von ${bookState.city.count}`;
}

function updateNav() {
  $('book-prev').disabled = bookState.sheet === 0;
  $('book-next').disabled = bookState.sheet >= bookState.sheets;
}

function updateHotspots() {
  const frontVideo = !!leafFront.querySelector('video');
  const rightVideo = !!pageRight.querySelector('video');
  const leftVideo = !!pageLeft.querySelector('video');
  $('hot-left').classList.toggle('video-page', leftVideo);
  $('hotspot-right').classList.toggle('video-page', rightVideo || frontVideo);
}

function renderIdle(s) {
  pageLeft.innerHTML = leftBase(s);
  pageRight.innerHTML = rightBase(s);
  leafFront.innerHTML = mediaWrap(bookState.city.items[s * 2]);
  leafBack.innerHTML = s * 2 + 1 < bookState.city.items.length
    ? mediaWrap(bookState.city.items[s * 2 + 1]) : END_NOTE;
  flipLeaf.classList.toggle('turned', false);
  updateProgress();
  updateNav();
  updateHotspots();
}

function renderBook() {
  renderIdle(bookState.sheet);
}

function setLeafNoTrans(fn) {
  flipLeaf.classList.add('no-trans');
  fn();
  void flipLeaf.offsetWidth;
  flipLeaf.classList.remove('no-trans');
}

function turnNext() {
  if (!bookState.city || bookState.turning || bookState.sheet >= bookState.sheets) return;
  bookState.turning = true;
  const s = bookState.sheet;
  leafFront.innerHTML = rightBase(s);
  leafBack.innerHTML = s * 2 + 1 < bookState.city.items.length
    ? mediaWrap(bookState.city.items[s * 2 + 1]) : END_NOTE;
  pageRight.innerHTML = rightBase(s + 1);
  pageRight.classList.add('shading');
  flipLeaf.classList.add('turned');
  setTimeout(() => {
    pageRight.classList.remove('shading');
    bookState.sheet = s + 1;
    setLeafNoTrans(() => {
      flipLeaf.classList.remove('turned');
      renderIdle(bookState.sheet);
    });
    bookState.turning = false;
  }, reduced ? 20 : 880);
}

function turnPrev() {
  if (!bookState.city || bookState.sheet === 0 || bookState.turning) return;
  bookState.turning = true;
  const s = bookState.sheet;
  setLeafNoTrans(() => {
    flipLeaf.classList.add('turned');
    leafBack.innerHTML = leftBase(s);
    leafFront.innerHTML = rightBase(s - 1);
  });
  pageLeft.classList.add('shading');
  requestAnimationFrame(() => {
    flipLeaf.classList.remove('turned');
    setTimeout(() => {
      bookState.sheet = s - 1;
      setLeafNoTrans(() => renderIdle(bookState.sheet));
      bookState.turning = false;
    }, reduced ? 20 : 880);
  });
}

$('book-next').addEventListener('click', turnNext);
$('book-prev').addEventListener('click', turnPrev);

$('hot-left').addEventListener('click', () => { if (bookState.sheet > 0) turnPrev(); });
$('hotspot-right').addEventListener('click', () => turnNext());

let touchX = null;
bookModal.addEventListener('touchstart', (e) => {
  touchX = e.touches[0].clientX;
}, { passive: true });
bookModal.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) < 48) return;
  if (dx < 0) turnNext(); else turnPrev();
}, { passive: true });

/* ══════════ CONFETTI (burgundy, gold, ivory) ══════════ */

let confettiPieces = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const CONF_COLORS = ['#6e1f30', '#8c2438', '#c9a26b', '#a87f42', '#f0e2ce', '#4a1420'];

function burstConfetti(x, y, count = 80) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 8;
    confettiPieces.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 6 + Math.random() * 10,
      color: CONF_COLORS[Math.floor(Math.random() * CONF_COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - .5) * 0.3,
      life: 1,
      shape: Math.random() < .5 ? 'heart' : 'circle'
    });
  }
  if (!confettiRunning) { confettiRunning = true; requestAnimationFrame(confettiTick); }
}

function drawHeartPath(c, s) {
  c.beginPath();
  c.moveTo(0, s * 0.35);
  c.bezierCurveTo(0, 0, -s * 0.5, -s * 0.15, -s * 0.5, s * 0.15);
  c.bezierCurveTo(-s * 0.5, s * 0.45, 0, s * 0.6, 0, s * 0.9);
  c.bezierCurveTo(0, s * 0.6, s * 0.5, s * 0.45, s * 0.5, s * 0.15);
  c.bezierCurveTo(s * 0.5, -s * 0.15, 0, 0, 0, s * 0.35);
  c.fill();
}

function confettiTick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  confettiPieces = confettiPieces.filter((p) => p.life > 0);
  confettiPieces.forEach((p) => {
    p.vy += 0.18;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.012;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    if (p.shape === 'heart') {
      ctx.scale(0.12, 0.12);
      drawHeartPath(ctx, p.size * 10);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
  if (confettiPieces.length > 0) {
    requestAnimationFrame(confettiTick);
  } else {
    confettiRunning = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/* ══════════ HIDDEN BUTTON ══════════ */

const hiddenBtn = $('hidden-btn');
const kitzelPopup = $('kitzel-popup');

hiddenBtn.addEventListener('click', () => {
  kitzelPopup.hidden = false;
  burstConfetti(window.innerWidth / 2, window.innerHeight / 2, 110);
});
$('kitzel-close').addEventListener('click', () => { kitzelPopup.hidden = true; });
kitzelPopup.addEventListener('click', (e) => { if (e.target === kitzelPopup) kitzelPopup.hidden = true; });

/* ══════════ SPARKLES ══════════ */

document.addEventListener('click', (e) => {
  const s = document.createElement('span');
  s.className = 'click-sparkle';
  s.textContent = Math.random() < .5 ? '✦' : '❦';
  s.style.left = (e.clientX - 8) + 'px';
  s.style.top = (e.clientY - 8) + 'px';
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 750);
});

function spawnMiniHeart(target) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const h = document.createElement('span');
  h.className = 'mini-heart';
  h.textContent = '❤';
  h.style.left = (rect.left + rect.width / 2 - 7) + 'px';
  h.style.top = (rect.top - 4) + 'px';
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 850);
}

const bigHeart = $('big-heart-btn');
bigHeart.addEventListener('click', (e) => burstConfetti(e.clientX, e.clientY, 55));
bigHeart.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') burstConfetti(window.innerWidth / 2, window.innerHeight / 2, 55);
});