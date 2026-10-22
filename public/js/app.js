/**
 * ReLoop — Waste Exchange & Recycling Marketplace
 * app.js — All frontend logic, API calls, UI rendering
 */

// ─────────────────────────────────────────────────────────────────
// 1. CONSTANTS & ENVIRONMENT
// ─────────────────────────────────────────────────────────────────

const isLocalFileMode = window.location.protocol === 'file:';

const CAT_ICONS = {
  'Plastic (PET / HDPE)':      '🥤',
  'Paper & Cardboard':          '📦',
  'Metals (Aluminum & Steel)': '⚙️',
  'Glass':                      '🍾',
  'E-Waste (Electronics)':      '💻',
  'Organic Waste':              '🍂'
};
function catIcon(name) { return CAT_ICONS[name] || '♻️'; }

// ─────────────────────────────────────────────────────────────────
// ECO RATING SYSTEM — based on CO₂ offset potential of a listing
// ─────────────────────────────────────────────────────────────────

/**
 * Returns 1–5 star rating based on how much CO₂ the listing diverts.
 * Tiers: <5 kg=1, 5-20=2, 20-50=3, 50-100=4, >100=5
 */
function getEcoStars(co2Saved) {
  const v = parseFloat(co2Saved) || 0;
  if (v >= 100) return 5;
  if (v >= 50)  return 4;
  if (v >= 20)  return 3;
  if (v >= 5)   return 2;
  return 1;
}

const ECO_LABELS = ['', 'Minimal', 'Low', 'Moderate', 'High', 'Excellent'];
const ECO_COLORS = ['', '#9ca3af', '#d97706', '#2563eb', '#16a34a', '#15803d'];

/**
 * Renders a 5-star strip as coloured HTML spans.
 * @param {number} stars  1–5
 * @param {number} size   font-size in px (default 14)
 */
function renderStars(stars, size = 14) {
  const color = ECO_COLORS[stars];
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span style="color:${i <= stars ? color : '#d1d5db'};font-size:${size}px;line-height:1">★</span>`;
  }
  return html;
}

/**
 * Full eco rating badge: stars + label + CO₂ range hint.
 */
function ecoRatingBadge(co2Saved) {
  const stars = getEcoStars(co2Saved);
  const label = ECO_LABELS[stars];
  const color = ECO_COLORS[stars];
  return `
    <span style="display:inline-flex;align-items:center;gap:4px">
      ${renderStars(stars, 13)}
    </span>
    <span style="font-size:.6875rem;font-weight:600;color:${color};margin-left:4px">${label}</span>`;
}

// ─────────────────────────────────────────────────────────────────
// 2. LOCAL MOCK DATABASE (fallback when running as file://)
// ─────────────────────────────────────────────────────────────────

function _initMock() {
  if (localStorage.getItem('rl_mock')) return;
  const db = {
    users: [
      { user_id: 1, name: 'Alice Green', email: 'alice@generator.com', password: 'password123', user_type: 'Generator', eco_points: 20 },
      { user_id: 2, name: 'Bob Clean', email: 'bob@recycler.com', password: 'password123', user_type: 'Recycler', eco_points: 0 },
      { user_id: 3, name: 'Metro Supermarket', email: 'metro@generator.com', password: 'password123', user_type: 'Generator', eco_points: 10 },
      { user_id: 4, name: 'EcoPlast Recycling', email: 'ecoplast@recycler.com', password: 'password123', user_type: 'Recycler', eco_points: 0 }
    ],
    categories: [
      { category_id: 1, name: 'Plastic (PET / HDPE)',      co2_saved_per_kg: 1.50 },
      { category_id: 2, name: 'Paper & Cardboard',          co2_saved_per_kg: 1.10 },
      { category_id: 3, name: 'Metals (Aluminum & Steel)', co2_saved_per_kg: 4.00 },
      { category_id: 4, name: 'Glass',                      co2_saved_per_kg: 0.30 },
      { category_id: 5, name: 'E-Waste (Electronics)',      co2_saved_per_kg: 3.20 },
      { category_id: 6, name: 'Organic Waste',              co2_saved_per_kg: 0.50 }
    ],
    listings: [
      { listing_id: 1, generator_id: 1, category_id: 2, title: 'Bundled Cardboard Boxes (Flat Pack)', weight_kg: 45.00, status: 'Available', created_at: new Date().toISOString() },
      { listing_id: 2, generator_id: 1, category_id: 1, title: 'Clean HDPE Milk Jugs and PET Bottles', weight_kg: 20.00, status: 'Available', created_at: new Date().toISOString() },
      { listing_id: 3, generator_id: 3, category_id: 3, title: 'Scrap Aluminum Cans & Food Tins', weight_kg: 35.50, status: 'Available', created_at: new Date().toISOString() },
      { listing_id: 4, generator_id: 3, category_id: 6, title: 'Kitchen Vegetable & Fruit Scraps', weight_kg: 80.00, status: 'Completed', created_at: new Date().toISOString() }
    ],
    requests: [
      { request_id: 1, listing_id: 4, recycler_id: 2, request_status: 'Completed', created_at: new Date().toISOString() },
      { request_id: 2, listing_id: 1, recycler_id: 2, request_status: 'Pending',   created_at: new Date().toISOString() }
    ],
    _nextId: { user: 5, listing: 5, request: 3 }
  };
  localStorage.setItem('rl_mock', JSON.stringify(db));
}

function _getMock() { _initMock(); return JSON.parse(localStorage.getItem('rl_mock')); }
function _saveMock(db) { localStorage.setItem('rl_mock', JSON.stringify(db)); }

// ─────────────────────────────────────────────────────────────────
// 3. SESSION HELPERS
// ─────────────────────────────────────────────────────────────────

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('reloop_user')) || null; } catch { return null; }
}
function setCurrentUser(u) { localStorage.setItem('reloop_user', JSON.stringify(u)); }
function logout() { localStorage.removeItem('reloop_user'); window.location.href = 'index.html'; }
function requireAuth() {
  const u = getCurrentUser();
  if (!u) { window.location.href = 'index.html'; return null; }
  return u;
}

// ─────────────────────────────────────────────────────────────────
// 4. UTILITIES
// ─────────────────────────────────────────────────────────────────

function escapeHtml(t) {
  if (t == null) return '';
  return String(t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const icons = { success: '✓', error: '✕', info: 'i' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-msg">${escapeHtml(message)}</span><button class="toast-x" onclick="this.closest('.toast').remove()">✕</button>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Navbar ─────────────────────────────────────────────────────
function updateNavbar() {
  const sec = document.getElementById('navUserSection');
  if (!sec) return;
  const u = getCurrentUser();
  if (u) {
    const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const color = u.user_type === 'Generator' ? '#16a34a' : '#2563eb';
    sec.innerHTML = `
      <div class="user-chip">
        <div class="user-av" style="background:${color}">${initials}</div>
        <div class="user-chip-info">
          <span class="user-chip-name">${escapeHtml(u.name)}</span>
          <span class="user-chip-role">${u.user_type} · ${u.eco_points} pts</span>
        </div>
      </div>
      <button onclick="logout()" class="btn btn-ghost btn-sm">Sign out</button>`;
  } else {
    sec.innerHTML = `<a href="index.html" class="btn btn-primary btn-sm">Sign In</a>`;
  }
}

// ── Verification modal ─────────────────────────────────────────
function showVerificationModal(title, html) {
  const overlay = document.getElementById('dbmsVerificationModal');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl  = document.getElementById('modalBody');
  if (overlay && titleEl && bodyEl) {
    titleEl.innerHTML = title;
    bodyEl.innerHTML  = html;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}
function closeVerificationModal() {
  const o = document.getElementById('dbmsVerificationModal');
  if (o) { o.classList.remove('open'); document.body.style.overflow = ''; }
}
function closeListingModal() {
  const o = document.getElementById('listingModal');
  if (o) { o.classList.remove('open'); document.body.style.overflow = ''; }
}
function openListingModal() {
  const o = document.getElementById('listingModal');
  if (o) { o.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

// Close modals on backdrop click / Escape
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeVerificationModal(); closeListingModal(); }
});

function statusBadge(s) {
  const map = { Available:'badge-available', Pending:'badge-pending', Accepted:'badge-accepted', Completed:'badge-completed', Rejected:'badge-rejected' };
  return `<span class="badge ${map[s] || ''}">${escapeHtml(s)}</span>`;
}

// ─────────────────────────────────────────────────────────────────
// 5. API SERVICE LAYER
// ─────────────────────────────────────────────────────────────────

async function _apiFetch(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  return data;
}

const API = {

  // ── Auth ────────────────────────────────────────────────────
  login: async (email, password) => {
    if (!isLocalFileMode) {
      try { return await _apiFetch('POST', '/api/login', { email, password }); } catch {}
    }
    const db = _getMock();
    const u = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);
    return u ? { success: true, user: u } : { error: 'Invalid email or password.' };
  },

  register: async (name, email, password, user_type) => {
    if (!isLocalFileMode) {
      try { return await _apiFetch('POST', '/api/register', { name, email, password, user_type }); } catch {}
    }
    const db = _getMock();
    if (db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return { error: 'An account with this email already exists.' };
    }
    const id = db._nextId.user++;
    const nu = { user_id: id, name: name.trim(), email: email.trim().toLowerCase(), password, user_type, eco_points: 0 };
    db.users.push(nu);
    _saveMock(db);
    return { success: true, user: nu };
  },

  // ── Categories ──────────────────────────────────────────────
  getCategories: async () => {
    if (!isLocalFileMode) {
      try {
        const r = await fetch('/api/categories');
        if (r.ok) return await r.json();
      } catch {}
    }
    return _getMock().categories;
  },

  // ── Listings ────────────────────────────────────────────────
  /**
   * Returns ALL 'Available' listings — including those added by newly
   * registered users. In live mode, the server fetches from D1.
   * In mock mode, reads from the shared localStorage mock DB
   * so newly created listings are immediately visible to all users.
   */
  getListings: async () => {
    if (!isLocalFileMode) {
      try {
        const r = await fetch('/api/listings');
        if (r.ok) return await r.json();
      } catch {}
    }
    const db = _getMock();
    return db.listings
      .filter(l => l.status === 'Available')
      .map(l => {
        const cat = db.categories.find(c => c.category_id === l.category_id) || { name: 'General', co2_saved_per_kg: 1.0 };
        const gen = db.users.find(u => u.user_id === l.generator_id) || { name: 'Unknown', eco_points: 0 };
        return {
          ...l,
          category_name: cat.name,
          co2_saved_per_kg: cat.co2_saved_per_kg,
          potential_co2_saved: (l.weight_kg * cat.co2_saved_per_kg).toFixed(2),
          generator_name: gen.name,
          generator_eco_points: gen.eco_points
        };
      })
      .reverse();
  },

  createListing: async (generator_id, category_id, title, weight_kg) => {
    if (!isLocalFileMode) {
      try {
        const r = await _apiFetch('POST', '/api/listings', { generator_id, category_id, title, weight_kg });
        return r;
      } catch {}
    }
    const db = _getMock();
    const id = db._nextId.listing++;
    const listing = { listing_id: id, generator_id, category_id: parseInt(category_id), title: title.trim(), weight_kg: parseFloat(weight_kg), status: 'Available', created_at: new Date().toISOString() };
    db.listings.push(listing);
    _saveMock(db);
    return { success: true, listing };
  },

  // ── Exchange requests ────────────────────────────────────────
  createRequest: async (listing_id, recycler_id) => {
    if (!isLocalFileMode) {
      try {
        const r = await _apiFetch('POST', '/api/requests', { listing_id, recycler_id });
        return r;
      } catch {}
    }
    const db = _getMock();
    const dup = db.requests.find(r => r.listing_id === listing_id && r.recycler_id === recycler_id && ['Pending','Accepted'].includes(r.request_status));
    if (dup) return { error: 'You already have an active request for this listing.' };
    const listing = db.listings.find(l => l.listing_id === listing_id);
    if (!listing || listing.status !== 'Available') return { error: 'This listing is no longer available.' };
    if (listing.generator_id === recycler_id) return { error: 'You cannot request your own listing.' };
    const id = db._nextId.request++;
    const req = { request_id: id, listing_id, recycler_id, request_status: 'Pending', created_at: new Date().toISOString() };
    db.requests.push(req);
    _saveMock(db);
    return { success: true, request: req };
  },

  // ACID Transaction: accept a request
  acceptRequest: async (request_id, generator_id) => {
    if (!isLocalFileMode) {
      try {
        const r = await _apiFetch('PUT', '/api/requests/accept', { request_id, generator_id });
        return r;
      } catch {}
    }
    const db = _getMock();
    const req = db.requests.find(r => r.request_id === request_id);
    if (!req) return { error: 'Request not found.' };
    const listing = db.listings.find(l => l.listing_id === req.listing_id);
    if (!listing) return { error: 'Listing not found.' };
    if (listing.generator_id !== generator_id) return { error: 'Unauthorized.' };
    if (listing.status !== 'Available') return { error: `ACID Check: Listing is '${listing.status}' — double-booking prevented!` };

    // Atomic batch
    req.request_status = 'Accepted';
    listing.status = 'Accepted';
    let rejected = 0;
    db.requests.forEach(r => {
      if (r.listing_id === listing.listing_id && r.request_id !== request_id && r.request_status === 'Pending') {
        r.request_status = 'Rejected'; rejected++;
      }
    });
    _saveMock(db);
    return {
      success: true,
      message: `Request #${request_id} accepted. ${rejected} competing request(s) auto-rejected.`,
      acid_transaction: {
        status: 'COMMITTED',
        listing_id: listing.listing_id,
        accepted_request_id: request_id,
        competing_requests_rejected: rejected
      }
    };
  },

  // SQL Trigger: complete a request
  completeRequest: async (request_id, user_id) => {
    if (!isLocalFileMode) {
      try {
        const r = await _apiFetch('PUT', '/api/requests/complete', { request_id, user_id });
        return r;
      } catch {}
    }
    const db = _getMock();
    const req = db.requests.find(r => r.request_id === request_id);
    if (!req) return { error: 'Request not found.' };
    if (req.request_status !== 'Accepted') return { error: `Only Accepted requests can be completed. Current: ${req.request_status}` };
    const listing = db.listings.find(l => l.listing_id === req.listing_id);
    const generator = db.users.find(u => listing && u.user_id === listing.generator_id);
    const ptsBefore = generator ? generator.eco_points : 0;

    // Trigger simulation
    req.request_status = 'Completed';
    if (listing) listing.status = 'Completed';
    if (generator) generator.eco_points += 10;

    // Update session if the generator is the current user
    const cur = getCurrentUser();
    if (cur && generator && cur.user_id === generator.user_id) {
      cur.eco_points = generator.eco_points;
      setCurrentUser(cur);
    }
    _saveMock(db);

    return {
      success: true,
      message: "Exchange completed. Trigger 'trg_ExchangeRequests_Completed' fired!",
      trigger_verification: {
        trigger_name: 'trg_ExchangeRequests_Completed',
        generator_id: generator?.user_id,
        eco_points_before: ptsBefore,
        eco_points_after: generator?.eco_points ?? ptsBefore + 10,
        points_awarded_by_trigger: 10,
        listing_status_updated_by_trigger: 'Completed'
      }
    };
  },

  // SQL View: dashboard data
  getDashboardData: async (userId) => {
    if (!isLocalFileMode) {
      try {
        const r = await fetch(`/api/dashboard/${userId}`);
        if (r.ok) return await r.json();
      } catch {}
    }
    const db = _getMock();
    const user = db.users.find(u => u.user_id === userId);
    if (!user) return { error: 'User not found.' };

    let weightDiverted = 0, co2Saved = 0, completedEx = 0;
    if (user.user_type === 'Generator') {
      db.listings.filter(l => l.generator_id === userId && l.status === 'Completed').forEach(l => {
        const cat = db.categories.find(c => c.category_id === l.category_id) || { co2_saved_per_kg: 1 };
        weightDiverted += l.weight_kg;
        co2Saved += l.weight_kg * cat.co2_saved_per_kg;
        completedEx++;
      });
    } else {
      db.requests.filter(r => r.recycler_id === userId && r.request_status === 'Completed').forEach(r => {
        const l = db.listings.find(x => x.listing_id === r.listing_id);
        if (l) {
          const cat = db.categories.find(c => c.category_id === l.category_id) || { co2_saved_per_kg: 1 };
          weightDiverted += l.weight_kg;
          co2Saved += l.weight_kg * cat.co2_saved_per_kg;
          completedEx++;
        }
      });
    }

    const impact = {
      user_id: user.user_id, name: user.name, email: user.email,
      user_type: user.user_type, eco_points: user.eco_points,
      total_listings_posted: db.listings.filter(l => l.generator_id === userId).length,
      completed_exchanges: completedEx,
      total_weight_diverted: weightDiverted.toFixed(2),
      total_co2_saved: co2Saved.toFixed(2)
    };

    let myListings = [], incomingRequests = [], myRequests = [];

    if (user.user_type === 'Generator') {
      myListings = db.listings.filter(l => l.generator_id === userId).map(l => {
        const cat = db.categories.find(c => c.category_id === l.category_id) || { name: 'General', co2_saved_per_kg: 1 };
        return { ...l, category_name: cat.name, potential_co2_saved: (l.weight_kg * cat.co2_saved_per_kg).toFixed(2) };
      }).reverse();

      incomingRequests = db.requests
        .filter(r => {
          const l = db.listings.find(x => x.listing_id === r.listing_id);
          return l && l.generator_id === userId;
        })
        .map(r => {
          const l = db.listings.find(x => x.listing_id === r.listing_id);
          const recycler = db.users.find(u => u.user_id === r.recycler_id) || { name: 'Unknown', email: '' };
          return { ...r, listing_title: l?.title || 'Listing', weight_kg: l?.weight_kg || 0, recycler_name: recycler.name, recycler_email: recycler.email };
        })
        .sort((a, b) => b.request_id - a.request_id);
    } else {
      myRequests = db.requests
        .filter(r => r.recycler_id === userId)
        .map(r => {
          const l = db.listings.find(x => x.listing_id === r.listing_id);
          const cat = l ? (db.categories.find(c => c.category_id === l.category_id) || { name: 'General' }) : { name: 'General' };
          const gen = l ? (db.users.find(u => u.user_id === l.generator_id) || { name: 'Generator', email: '' }) : { name: 'Generator', email: '' };
          return { ...r, listing_title: l?.title || 'Listing', weight_kg: l?.weight_kg || 0, listing_status: l?.status || 'Unknown', category_name: cat.name, generator_name: gen.name, generator_email: gen.email };
        })
        .sort((a, b) => b.request_id - a.request_id);
    }

    return { success: true, impact, myListings, incomingRequests, myRequests };
  }
};

// ─────────────────────────────────────────────────────────────────
// 6. AUTH PAGE
// ─────────────────────────────────────────────────────────────────

function initAuthPage() {
  // Auth forms are now fully handled inline in index.html
  // This function is kept for backward compatibility
}

// ─────────────────────────────────────────────────────────────────
// 7. MARKETPLACE PAGE
// ─────────────────────────────────────────────────────────────────

let _rawListings = [];
let _activeFilter = 'all';

async function initMarketplacePage() {
  const user = requireAuth();
  if (!user) return;
  updateNavbar();

  // Show post listing button for generators
  const actionWrap = document.getElementById('createListingActionContainer');
  if (actionWrap) {
    if (user.user_type === 'Generator') {
      actionWrap.innerHTML = `<button onclick="openListingModal()" class="btn btn-primary">+ Post Listing</button>`;
    } else {
      actionWrap.innerHTML = `<span style="font-size:.8125rem;color:#6b7280;background:#f5f5f7;border:1px solid #e5e7eb;padding:6px 14px;border-radius:8px">
        Recycler view — request any listing below
      </span>`;
    }
  }

  await loadListings();
  await loadCategoriesForModal();
}

async function loadListings() {
  const grid = document.getElementById('listingsGrid');
  if (!grid) return;
  grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏳</div><p class="empty-state-title">Loading…</p></div>`;
  try {
    _rawListings = await API.getListings();
    renderListings();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p class="empty-state-title">Error loading listings</p><p class="empty-state-sub">${escapeHtml(err.message)}</p></div>`;
  }
}

function handleSearchFilter() { renderListings(); }

function filterByCategory(cat, chipEl) {
  _activeFilter = cat.toLowerCase();
  document.querySelectorAll('#categoryChips .chip').forEach(c => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');
  renderListings();
}

function renderListings() {
  const grid   = document.getElementById('listingsGrid');
  const badge  = document.getElementById('listingsCount');
  const search = document.getElementById('searchInput');
  const query  = search ? search.value.trim().toLowerCase() : '';
  const user   = getCurrentUser();
  if (!grid) return;

  const filtered = _rawListings.filter(l => {
    const catMatch = _activeFilter === 'all' || l.category_name.toLowerCase().includes(_activeFilter);
    const qMatch   = !query || l.title.toLowerCase().includes(query) || l.category_name.toLowerCase().includes(query) || l.generator_name.toLowerCase().includes(query);
    return catMatch && qMatch;
  });

  if (badge) badge.textContent = `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><p class="empty-state-title">No listings found</p><p class="empty-state-sub">Try a different search or category filter.</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(l => {
    const isOwner    = user && l.generator_id === user.user_id;
    const isRecycler = user && user.user_type === 'Recycler';
    const stars      = getEcoStars(l.potential_co2_saved);
    const ratingLabel = ECO_LABELS[stars];
    const ratingColor = ECO_COLORS[stars];

    let footer = '';
    if (isOwner) {
      footer = `<div class="own-badge">Your listing</div>`;
    } else if (isRecycler) {
      footer = `<button onclick="handleRequestExchange(${l.listing_id},'${escapeHtml(l.title).replace(/'/g,"\\'")}')" class="btn btn-primary">Request Exchange</button>`;
    } else {
      footer = `<div class="own-badge">Switch to a Recycler account to request</div>`;
    }

    return `
      <div class="listing-card">
        <div class="listing-card-body">
          <div class="listing-card-meta">
            <span class="cat-tag">${catIcon(l.category_name)} ${escapeHtml(l.category_name)}</span>
            <span class="weight-tag">${l.weight_kg} kg</span>
          </div>
          <h3 class="listing-title">${escapeHtml(l.title)}</h3>

          <!-- Eco Rating bar — full width, prominent -->
          <div style="margin-bottom:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af">Eco Impact Rating</span>
              <span style="font-size:.75rem;font-weight:700;color:${ratingColor}">${ratingLabel}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="display:flex;gap:2px">${renderStars(stars, 15)}</div>
              <span style="font-size:.75rem;color:#6b7280;margin-left:2px">${stars}/5 · ${l.potential_co2_saved} kg CO₂</span>
            </div>
            <!-- Progress bar -->
            <div style="margin-top:5px;height:4px;border-radius:99px;background:#e5e7eb;overflow:hidden">
              <div style="height:100%;width:${stars * 20}%;background:${ratingColor};border-radius:99px;transition:width .3s"></div>
            </div>
          </div>

          <div class="listing-stats">
            <div class="stat-item">
              <div class="stat-label">CO₂ Offset</div>
              <div class="stat-val" style="color:${ratingColor}">~${l.potential_co2_saved} kg</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Generator</div>
              <div class="stat-val">${escapeHtml(l.generator_name)}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">CO₂ Rate</div>
              <div class="stat-val">${l.co2_saved_per_kg} kg/kg</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Gen. Score</div>
              <div class="stat-val">🌱 ${l.generator_eco_points} pts</div>
            </div>
          </div>
        </div>
        <div class="listing-card-footer">${footer}</div>
      </div>`;
  }).join('');
}

async function handleRequestExchange(listingId, title) {
  const user = getCurrentUser();
  if (!user) return;
  if (!confirm(`Submit an exchange request for:\n"${title}"?`)) return;

  try {
    const res = await API.createRequest(listingId, user.user_id);
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Request submitted! Track it in your Dashboard.', 'success');
      loadListings();
    }
  } catch (err) {
    showToast('Failed to send request: ' + err.message, 'error');
  }
}

async function loadCategoriesForModal() {
  const sel = document.getElementById('listingCategorySelect');
  if (!sel) return;
  try {
    const cats = await API.getCategories();
    sel.innerHTML = '<option value="">— Select a category —</option>' +
      cats.map(c => `<option value="${c.category_id}">${catIcon(c.name)} ${escapeHtml(c.name)} (${c.co2_saved_per_kg} kg CO₂/kg)</option>`).join('');
  } catch {}
}

function initListingFormHandler() {
  const form = document.getElementById('createListingForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user || user.user_type !== 'Generator') {
      showToast('Only Generators can post listings.', 'error'); return;
    }
    const title    = document.getElementById('listingTitle').value.trim();
    const catId    = parseInt(document.getElementById('listingCategorySelect').value, 10);
    const weight   = parseFloat(document.getElementById('listingWeight').value);
    if (!title || !catId || isNaN(weight) || weight <= 0) {
      showToast('Please fill in all fields correctly.', 'error'); return;
    }
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Publishing…';
    try {
      const res = await API.createListing(user.user_id, catId, title, weight);
      if (res.error) { showToast(res.error, 'error'); }
      else {
        showToast('Listing published! Recyclers can now see it.', 'success');
        form.reset();
        closeListingModal();
        loadListings();
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// 8. DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────────

async function initDashboardPage() {
  const user = requireAuth();
  if (!user) return;
  updateNavbar();

  const roleBox = document.getElementById('roleIndicatorBox');
  if (roleBox) {
    const color = user.user_type === 'Generator' ? '#16a34a' : '#2563eb';
    const bg    = user.user_type === 'Generator' ? '#f0fdf4' : '#eff6ff';
    roleBox.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;font-size:.875rem;font-weight:600;padding:6px 14px;border-radius:999px;border:1.5px solid ${color};color:${color};background:${bg}">${user.user_type === 'Generator' ? '🏭' : '♻️'} ${user.user_type}</span>`;
  }

  await loadDashboardMetrics(user.user_id);
}

async function loadDashboardMetrics(userId) {
  const metricsEl  = document.getElementById('impactMetricsContainer');
  const genSection = document.getElementById('generatorSection');
  const recSection = document.getElementById('recyclerSection');

  try {
    const data = await API.getDashboardData(userId);
    if (data.error) { showToast(data.error, 'error'); return; }
    const { impact, myListings, incomingRequests, myRequests } = data;

    // Render stat cards
    if (metricsEl) {
      metricsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon green">🌱</div>
          <div>
            <div class="stat-val">${impact.eco_points}</div>
            <div class="stat-label">Eco Points</div>
            <div class="stat-note">+10 per SQL trigger · awarded automatically</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">⚖️</div>
          <div>
            <div class="stat-val">${impact.total_weight_diverted} <span class="stat-unit">kg</span></div>
            <div class="stat-label">Weight Diverted</div>
            <div class="stat-note">from SQL View: UserImpactDashboard</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">🌿</div>
          <div>
            <div class="stat-val">${impact.total_co2_saved} <span class="stat-unit">kg</span></div>
            <div class="stat-label">CO₂ Saved</div>
            <div class="stat-note">EPA emission factor</div>
          </div>
        </div>
        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="stat-icon purple" style="flex-shrink:0">⭐</div>
            <div>
              <div class="stat-label">Eco Impact Rating</div>
              <div class="stat-note">based on total CO₂ diverted</div>
            </div>
          </div>
          <div style="width:100%">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
              <div style="display:flex;gap:3px">${renderStars(getEcoStars(impact.total_co2_saved), 16)}</div>
              <span style="font-size:.8125rem;font-weight:700;color:${ECO_COLORS[getEcoStars(impact.total_co2_saved)]}">${ECO_LABELS[getEcoStars(impact.total_co2_saved)]}</span>
            </div>
            <div style="height:5px;border-radius:99px;background:#e5e7eb;overflow:hidden">
              <div style="height:100%;width:${getEcoStars(impact.total_co2_saved)*20}%;background:${ECO_COLORS[getEcoStars(impact.total_co2_saved)]};border-radius:99px"></div>
            </div>
          </div>
        </div>`;
    }

    if (impact.user_type === 'Generator') {
      if (genSection) genSection.style.display = 'block';
      if (recSection) recSection.style.display = 'none';
      renderGeneratorTables(myListings, incomingRequests, impact.user_id);
    } else {
      if (genSection) genSection.style.display = 'none';
      if (recSection) recSection.style.display = 'block';
      renderRecyclerTable(myRequests, impact.user_id);
    }
  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function renderGeneratorTables(myListings, incomingRequests, generatorId) {
  // ── Incoming requests ──
  const reqBody = document.getElementById('incomingRequestsTableBody');
  const pendEl  = document.getElementById('pendingRequestsCount');
  if (reqBody) {
    const pending = (incomingRequests || []).filter(r => r.request_status === 'Pending').length;
    if (pendEl) pendEl.textContent = `${pending} pending`;

    if (!incomingRequests?.length) {
      reqBody.innerHTML = `<tr><td colspan="6" class="table-empty">No exchange requests yet.</td></tr>`;
    } else {
      reqBody.innerHTML = incomingRequests.map(r => {
        const action = r.request_status === 'Pending'
          ? `<button onclick="handleAcceptRequest(${r.request_id},${generatorId})" class="btn btn-blue btn-sm" style="font-size:.8rem;padding:5px 12px">🔒 Accept</button>`
          : statusBadge(r.request_status);
        return `<tr>
          <td><strong>#${r.request_id}</strong></td>
          <td><div style="font-weight:600">${escapeHtml(r.listing_title)}</div><div class="td-sub">${r.weight_kg} kg</div></td>
          <td><div style="font-weight:600">${escapeHtml(r.recycler_name)}</div><div class="td-sub">${escapeHtml(r.recycler_email)}</div></td>
          <td>${fmtDate(r.created_at)}</td>
          <td>${statusBadge(r.request_status)}</td>
          <td>${action}</td>
        </tr>`;
      }).join('');
    }
  }

  // ── My listings ──
  const lstBody = document.getElementById('myListingsTableBody');
  if (lstBody) {
    if (!myListings?.length) {
      lstBody.innerHTML = `<tr><td colspan="5" class="table-empty">No listings yet. <a href="marketplace.html" style="color:var(--primary)">Post one →</a></td></tr>`;
    } else {
      lstBody.innerHTML = myListings.map(l => `<tr>
        <td style="font-weight:600">${escapeHtml(l.title)}</td>
        <td>${catIcon(l.category_name)} ${escapeHtml(l.category_name)}</td>
        <td><strong>${l.weight_kg} kg</strong></td>
        <td style="color:var(--primary)">~${l.potential_co2_saved} kg</td>
        <td>${statusBadge(l.status)}</td>
      </tr>`).join('');
    }
  }
}

function renderRecyclerTable(myRequests, recyclerId) {
  const body = document.getElementById('myRequestsTableBody');
  if (!body) return;

  if (!myRequests?.length) {
    body.innerHTML = `<tr><td colspan="7" class="table-empty">No requests yet. <a href="marketplace.html" style="color:var(--primary)">Browse the marketplace →</a></td></tr>`;
    return;
  }

  body.innerHTML = myRequests.map(r => {
    let action = '';
    if (r.request_status === 'Accepted') {
      action = `<button onclick="handleCompleteRequest(${r.request_id},${recyclerId})" class="btn btn-primary btn-sm" style="font-size:.8rem;padding:5px 12px;background:#16a34a">⚡ Complete</button>`;
    } else if (r.request_status === 'Completed') {
      action = `<span style="font-size:.8125rem;color:var(--primary);font-weight:600">+10 pts ✓</span>`;
    } else {
      action = statusBadge(r.request_status);
    }

    return `<tr>
      <td><strong>#${r.request_id}</strong></td>
      <td style="font-weight:600">${escapeHtml(r.listing_title)}</td>
      <td>${catIcon(r.category_name)} ${escapeHtml(r.category_name)}</td>
      <td><strong>${r.weight_kg} kg</strong></td>
      <td><div style="font-weight:600">${escapeHtml(r.generator_name)}</div><div class="td-sub">${escapeHtml(r.generator_email)}</div></td>
      <td>${statusBadge(r.request_status)}</td>
      <td>${action}</td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────
// 9. DBMS ACTION HANDLERS
// ─────────────────────────────────────────────────────────────────

async function handleAcceptRequest(requestId, generatorId) {
  try {
    const res = await API.acceptRequest(requestId, generatorId);
    if (res.error) { showToast(res.error, 'error', 6000); return; }
    const tx = res.acid_transaction;
    showVerificationModal('🔒 ACID Transaction Committed', `
      <div class="result-block blue">
        <div class="result-block-title">Transaction successfully committed to the database</div>
        <div class="result-rows">
          <div class="result-row"><span class="rk">Lock type</span><code class="rcode">Serialized Atomic Batch (D1)</code></div>
          <div class="result-row"><span class="rk">Transaction status</span><span class="rv" style="font-weight:700;color:#16a34a">COMMITTED</span></div>
          <div class="result-row"><span class="rk">Listing #${tx.listing_id}</span><span class="rv">Status → ${statusBadge('Accepted')}</span></div>
          <div class="result-row"><span class="rk">Request #${tx.accepted_request_id}</span><span class="rv">Status → ${statusBadge('Accepted')}</span></div>
          <div class="result-row"><span class="rk">Competing requests rejected</span><span class="rv"><strong>${tx.competing_requests_rejected}</strong></span></div>
        </div>
      </div>
      <div class="result-block gray">
        <p class="result-note"><strong>Why this matters:</strong> Row-level locks prevent two recyclers from simultaneously claiming the same listing. The <strong>Isolation</strong> property of ACID ensures only one transaction wins — all others see the updated state and are rejected.</p>
      </div>`);
    showToast(res.message, 'success');
    await loadDashboardMetrics(generatorId);
  } catch (err) {
    showToast('Transaction failed: ' + err.message, 'error');
  }
}

async function handleCompleteRequest(requestId, userId) {
  try {
    const res = await API.completeRequest(requestId, userId);
    if (res.error) { showToast(res.error, 'error', 6000); return; }
    const v = res.trigger_verification;
    showVerificationModal('⚡ SQL Trigger Executed', `
      <div class="result-block green">
        <div class="result-block-title">Trigger fired automatically on the database</div>
        <div class="result-rows">
          <div class="result-row"><span class="rk">Trigger name</span><code class="rcode">${v.trigger_name}</code></div>
          <div class="result-row"><span class="rk">Event</span><code class="rcode">AFTER UPDATE OF request_status ON ExchangeRequests</code></div>
          <div class="result-row"><span class="rk">Listing status</span><span class="rv">Auto-updated → ${statusBadge('Completed')}</span></div>
          <div class="result-row"><span class="rk">Generator #${v.generator_id} points</span><span class="rv"><strong>${v.eco_points_before} → ${v.eco_points_after} (+${v.points_awarded_by_trigger})</strong></span></div>
        </div>
      </div>
      <div class="result-block gray">
        <p class="result-note"><strong>Why this matters:</strong> The trigger enforces business logic at the <em>database tier</em> — eco points are awarded automatically regardless of which client or application updates the record. This ensures data integrity even if the application crashes mid-operation.</p>
      </div>`);
    showToast(res.message, 'success');
    // Refresh the dashboard and update session eco_points
    const cur = getCurrentUser();
    if (cur) await loadDashboardMetrics(cur.user_id);
    updateNavbar(); // Refresh eco points in nav chip
  } catch (err) {
    showToast('Failed to complete: ' + err.message, 'error');
  }
}
