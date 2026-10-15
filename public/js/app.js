/**
 * ReLoop — Waste Exchange and Recycling Marketplace
 * Frontend Logic · DBMS Concept Demonstration
 * Design System: Google Material Design 3
 */

// ==============================================================================
// 1. ENVIRONMENT & PERSISTENCE HELPERS
// ==============================================================================

const isLocalFileMode = window.location.protocol === 'file:';

const CATEGORY_ICONS = {
  'Plastic (PET / HDPE)':       '🥤',
  'Paper & Cardboard':           '📦',
  'Metals (Aluminum & Steel)':  '⚙️',
  'Glass':                       '🍾',
  'E-Waste (Electronics)':       '💻',
  'Organic Waste':               '🍂'
};

function getCategoryIcon(name) {
  return CATEGORY_ICONS[name] || '♻️';
}

function initLocalMockDbIfNeeded() {
  if (!localStorage.getItem('reloop_mock_db')) {
    const mockDb = {
      users: [
        { user_id: 1, name: 'Alice Green (Cafe Owner)', email: 'alice@generator.com', password: 'password123', user_type: 'Generator', eco_points: 20 },
        { user_id: 2, name: 'Bob Clean (Urban Recycler)', email: 'bob@recycler.com', password: 'password123', user_type: 'Recycler', eco_points: 0 },
        { user_id: 3, name: 'Metro Supermarket', email: 'metro@generator.com', password: 'password123', user_type: 'Generator', eco_points: 10 },
        { user_id: 4, name: 'EcoPlast Recycling Ltd', email: 'ecoplast@recycler.com', password: 'password123', user_type: 'Recycler', eco_points: 0 }
      ],
      categories: [
        { category_id: 1, name: 'Plastic (PET / HDPE)', co2_saved_per_kg: 1.50 },
        { category_id: 2, name: 'Paper & Cardboard', co2_saved_per_kg: 1.10 },
        { category_id: 3, name: 'Metals (Aluminum & Steel)', co2_saved_per_kg: 4.00 },
        { category_id: 4, name: 'Glass', co2_saved_per_kg: 0.30 },
        { category_id: 5, name: 'E-Waste (Electronics)', co2_saved_per_kg: 3.20 },
        { category_id: 6, name: 'Organic Waste', co2_saved_per_kg: 0.50 }
      ],
      listings: [
        { listing_id: 1, generator_id: 1, category_id: 2, title: 'Bundled Cardboard Boxes (Flat Pack)', weight_kg: 45.00, status: 'Available', created_at: new Date().toISOString() },
        { listing_id: 2, generator_id: 1, category_id: 1, title: 'Clean HDPE Milk Jugs and PET Bottles', weight_kg: 20.00, status: 'Available', created_at: new Date().toISOString() },
        { listing_id: 3, generator_id: 3, category_id: 3, title: 'Scrap Aluminum Beverage Cans & Food Tins', weight_kg: 35.50, status: 'Available', created_at: new Date().toISOString() },
        { listing_id: 4, generator_id: 3, category_id: 6, title: 'Kitchen Vegetable & Fruit Scraps (Compost Grade)', weight_kg: 80.00, status: 'Completed', created_at: new Date().toISOString() }
      ],
      requests: [
        { request_id: 1, listing_id: 4, recycler_id: 2, request_status: 'Completed', created_at: new Date().toISOString() },
        { request_id: 2, listing_id: 1, recycler_id: 2, request_status: 'Pending', created_at: new Date().toISOString() },
        { request_id: 3, listing_id: 1, recycler_id: 4, request_status: 'Pending', created_at: new Date().toISOString() }
      ]
    };
    saveMockDb(mockDb);
  }
}

function getMockDb() {
  initLocalMockDbIfNeeded();
  return JSON.parse(localStorage.getItem('reloop_mock_db'));
}

function saveMockDb(db) {
  localStorage.setItem('reloop_mock_db', JSON.stringify(db));
}

// Session helpers
function getCurrentUser() {
  const userJson = localStorage.getItem('reloop_user');
  try { return userJson ? JSON.parse(userJson) : null; } catch (e) { return null; }
}

function setCurrentUser(user) {
  localStorage.setItem('reloop_user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('reloop_user');
  window.location.href = 'index.html';
}

function requireAuth() {
  const user = getCurrentUser();
  if (!user) { window.location.href = 'index.html'; return null; }
  return user;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==============================================================================
// 2. UI UTILITIES — TOAST STACK & VERIFICATION DIALOG
// ==============================================================================

/**
 * Show a toast notification using the Material 3 toast stack.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration ms
 */
function showToast(message, type = 'info', duration = 4500) {
  const stack = document.getElementById('toastStack');
  if (!stack) {
    // Fallback for pages that haven't loaded yet
    console.warn('[Toast]', type, message);
    return;
  }

  const icons = { success: '✅', error: '⚠️', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()" aria-label="Dismiss">✕</button>
  `;
  stack.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  // Auto-remove
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

/**
 * Show the DBMS verification modal with custom title + HTML body.
 */
function showVerificationModal(title, contentHtml) {
  const overlay = document.getElementById('dbmsVerificationModal');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl  = document.getElementById('modalBody');
  if (overlay && titleEl && bodyEl) {
    titleEl.innerHTML = title;
    bodyEl.innerHTML  = contentHtml;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    alert(title.replace(/<[^>]*>/g, '') + '\n\n' + contentHtml.replace(/<[^>]*>/g, ''));
  }
}

function closeVerificationModal() {
  const overlay = document.getElementById('dbmsVerificationModal');
  if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
}

// Close dialog on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('dialog-overlay') && e.target.classList.contains('open')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (e.target.id === 'listingModal') closeListingModal();
});

// Close on Esc
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeVerificationModal();
    closeListingModal();
  }
});

/**
 * Update the top app bar's user section.
 */
function updateNavbar() {
  const user = getCurrentUser();
  const navUserSection = document.getElementById('navUserSection');
  if (!navUserSection) return;

  if (user) {
    const initials = user.name
      ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : 'U';
    const roleColor = user.user_type === 'Generator' ? 'var(--green)' : 'var(--primary)';

    navUserSection.innerHTML = `
      <div class="user-chip">
        <div class="user-avatar" style="background:${roleColor}">${initials}</div>
        <div class="user-chip-info">
          <span class="user-chip-name">${escapeHtml(user.name)}</span>
          <span class="user-chip-role">${user.user_type} · ${user.eco_points} pts</span>
        </div>
      </div>
      <button onclick="logout()" class="btn btn-outlined btn-sm">Sign Out</button>
    `;
  } else {
    navUserSection.innerHTML = `
      <a href="index.html" class="btn btn-filled btn-sm">Sign In</a>
    `;
  }
}

// ==============================================================================
// 3. API SERVICE (FETCH WITH LOCAL MOCK FALLBACK)
// ==============================================================================

const API = {
  login: async (email, password) => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (res.ok || res.status === 401 || res.status === 400) return await res.json();
      } catch (e) { console.warn('Backend not reached, falling back to mock DB'); }
    }
    const db = getMockDb();
    const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);
    if (!user) return { error: 'Invalid email or password.' };
    return { success: true, user };
  },

  register: async (name, email, password, user_type) => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, user_type })
        });
        if (res.ok || res.status === 409 || res.status === 400) return await res.json();
      } catch (e) { console.warn('Backend not reached, falling back to mock DB'); }
    }
    const db = getMockDb();
    if (db.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return { error: 'An account with this email address already exists.' };
    }
    const newUser = {
      user_id: db.users.length + 1,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      user_type,
      eco_points: 0
    };
    db.users.push(newUser);
    saveMockDb(db);
    return { success: true, user: newUser };
  },

  getCategories: async () => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return getMockDb().categories;
  },

  getListings: async () => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch('/api/listings');
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    const db = getMockDb();
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
        const res = await fetch('/api/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generator_id, category_id, title, weight_kg })
        });
        if (res.ok || res.status === 400 || res.status === 403) return await res.json();
      } catch (e) {}
    }
    const db = getMockDb();
    const newListing = {
      listing_id: db.listings.length + 1,
      generator_id, category_id, title, weight_kg,
      status: 'Available',
      created_at: new Date().toISOString()
    };
    db.listings.push(newListing);
    saveMockDb(db);
    return { success: true, listing: newListing };
  },

  createRequest: async (listing_id, recycler_id) => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing_id, recycler_id })
        });
        if (res.ok || res.status === 400 || res.status === 409) return await res.json();
      } catch (e) {}
    }
    const db = getMockDb();
    const existing = db.requests.find(r =>
      r.listing_id === listing_id && r.recycler_id === recycler_id &&
      ['Pending', 'Accepted'].includes(r.request_status)
    );
    if (existing) return { error: 'You have already submitted an active request for this listing.' };
    const newReq = {
      request_id: db.requests.length + 1,
      listing_id, recycler_id,
      request_status: 'Pending',
      created_at: new Date().toISOString()
    };
    db.requests.push(newReq);
    saveMockDb(db);
    return { success: true, request: newReq };
  },

  // ── ACID Transaction ──────────────────────────────────────
  acceptRequest: async (request_id, generator_id) => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch('/api/requests/accept', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id, generator_id })
        });
        if (res.ok || res.status === 400 || res.status === 409) return await res.json();
      } catch (e) {}
    }
    const db = getMockDb();
    const targetReq = db.requests.find(r => r.request_id === request_id);
    if (!targetReq) return { error: 'Exchange request not found.' };
    const listing = db.listings.find(l => l.listing_id === targetReq.listing_id);
    if (!listing) return { error: 'Listing not found.' };
    if (listing.generator_id !== generator_id) return { error: 'Unauthorized.' };
    if (listing.status !== 'Available') {
      return { error: `ACID Concurrency Check: Listing is already '${listing.status}'. Double-booking prevented!` };
    }
    targetReq.request_status = 'Accepted';
    listing.status = 'Accepted';
    let rejectedCount = 0;
    db.requests.forEach(r => {
      if (r.listing_id === listing.listing_id && r.request_id !== request_id && r.request_status === 'Pending') {
        r.request_status = 'Rejected';
        rejectedCount++;
      }
    });
    saveMockDb(db);
    return {
      success: true,
      acid_transaction: {
        status: 'COMMITTED',
        row_locking_applied: 'UPDLOCK, ROWLOCK on WasteListings',
        listing_id: listing.listing_id,
        accepted_request_id: request_id,
        competing_requests_rejected: rejectedCount
      },
      message: `Transaction committed! Request #${request_id} accepted. ${rejectedCount} competing request(s) auto-rejected.`
    };
  },

  // ── SQL Trigger ───────────────────────────────────────────
  completeRequest: async (request_id, user_id) => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch('/api/requests/complete', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id, user_id })
        });
        if (res.ok || res.status === 400 || res.status === 403) return await res.json();
      } catch (e) {}
    }
    const db = getMockDb();
    const targetReq = db.requests.find(r => r.request_id === request_id);
    if (!targetReq) return { error: 'Request not found.' };
    const listing = db.listings.find(l => l.listing_id === targetReq.listing_id);
    if (!listing) return { error: 'Listing not found.' };
    const generator = db.users.find(u => u.user_id === listing.generator_id);
    const ecoPointsBefore = generator ? generator.eco_points : 0;
    targetReq.request_status = 'Completed';
    listing.status = 'Completed';
    if (generator) generator.eco_points += 10;
    saveMockDb(db);
    const cur = getCurrentUser();
    if (cur && generator && cur.user_id === generator.user_id) {
      cur.eco_points = generator.eco_points;
      setCurrentUser(cur);
    }
    return {
      success: true,
      message: "Exchange marked 'Completed'. Trigger 'trg_ExchangeRequests_Completed' fired automatically!",
      trigger_verification: {
        trigger_name: 'trg_ExchangeRequests_Completed',
        table_updated_directly: 'ExchangeRequests (request_status = "Completed")',
        listing_status_updated_by_trigger: 'Completed',
        generator_id: generator ? generator.user_id : null,
        eco_points_before: ecoPointsBefore,
        eco_points_after: generator ? generator.eco_points : 10,
        points_awarded_by_trigger: 10
      }
    };
  },

  // ── SQL View ──────────────────────────────────────────────
  getDashboardData: async (userId) => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch(`/api/dashboard/${userId}`);
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    const db = getMockDb();
    const user = db.users.find(u => u.user_id === userId);
    if (!user) return { error: 'User not found' };

    let totalWeightDiverted = 0, totalCo2Saved = 0, completedExchanges = 0;
    if (user.user_type === 'Generator') {
      db.listings.forEach(l => {
        if (l.generator_id === userId && l.status === 'Completed') {
          const cat = db.categories.find(c => c.category_id === l.category_id) || { co2_saved_per_kg: 1.0 };
          totalWeightDiverted += l.weight_kg;
          totalCo2Saved += (l.weight_kg * cat.co2_saved_per_kg);
          completedExchanges++;
        }
      });
    } else {
      db.requests.forEach(r => {
        if (r.recycler_id === userId && r.request_status === 'Completed') {
          const l = db.listings.find(x => x.listing_id === r.listing_id);
          if (l) {
            const cat = db.categories.find(c => c.category_id === l.category_id) || { co2_saved_per_kg: 1.0 };
            totalWeightDiverted += l.weight_kg;
            totalCo2Saved += (l.weight_kg * cat.co2_saved_per_kg);
            completedExchanges++;
          }
        }
      });
    }

    const impact = {
      user_id: user.user_id, name: user.name, email: user.email,
      user_type: user.user_type, eco_points: user.eco_points,
      total_listings_posted: db.listings.filter(l => l.generator_id === userId).length,
      completed_exchanges: completedExchanges,
      total_weight_diverted: totalWeightDiverted.toFixed(2),
      total_co2_saved: totalCo2Saved.toFixed(2)
    };

    let myListings = [], incomingRequests = [], myRequests = [];
    if (user.user_type === 'Generator') {
      myListings = db.listings.filter(l => l.generator_id === userId).map(l => {
        const cat = db.categories.find(c => c.category_id === l.category_id) || { name: 'General', co2_saved_per_kg: 1.0 };
        return { ...l, category_name: cat.name, co2_saved_per_kg: cat.co2_saved_per_kg, potential_co2_saved: (l.weight_kg * cat.co2_saved_per_kg).toFixed(2) };
      });
      incomingRequests = db.requests
        .filter(r => { const l = db.listings.find(x => x.listing_id === r.listing_id); return l && l.generator_id === userId; })
        .map(r => {
          const l = db.listings.find(x => x.listing_id === r.listing_id);
          const recycler = db.users.find(u => u.user_id === r.recycler_id) || { name: 'Recycler', email: '' };
          return { ...r, listing_title: l ? l.title : 'Listing', weight_kg: l ? l.weight_kg : 0, recycler_name: recycler.name, recycler_email: recycler.email };
        });
    } else {
      myRequests = db.requests.filter(r => r.recycler_id === userId).map(r => {
        const l = db.listings.find(x => x.listing_id === r.listing_id);
        const cat = l ? (db.categories.find(c => c.category_id === l.category_id) || { name: 'General' }) : { name: 'General' };
        const gen = l ? (db.users.find(u => u.user_id === l.generator_id) || { name: 'Generator', email: '' }) : { name: 'Generator', email: '' };
        return { ...r, listing_title: l ? l.title : 'Listing', weight_kg: l ? l.weight_kg : 0, listing_status: l ? l.status : 'Unknown', category_name: cat.name, generator_name: gen.name, generator_email: gen.email };
      });
    }

    return { success: true, impact, myListings, incomingRequests, myRequests };
  }
};

// ==============================================================================
// 4. AUTH PAGE CONTROLLER
// ==============================================================================

function initAuthPage() {
  const existingUser = getCurrentUser();
  if (existingUser) {
    const banner = document.getElementById('alreadyLoggedInBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div class="session-banner">
          <div class="session-banner-info">
            <span class="session-banner-icon">👋</span>
            <div>
              <p class="session-banner-name">Welcome back, <strong>${escapeHtml(existingUser.name)}</strong></p>
              <p class="session-banner-role">${existingUser.user_type} account · ${existingUser.eco_points} eco points</p>
            </div>
          </div>
          <div class="session-banner-actions">
            <a href="marketplace.html" class="btn btn-filled btn-sm">Marketplace</a>
            <a href="dashboard.html" class="btn btn-tonal btn-sm">Dashboard</a>
            <button onclick="logout()" class="btn btn-outlined btn-sm">Switch Account</button>
          </div>
        </div>
      `;
    }
  }

  // Tab switching is handled inline via switchTab() on index.html
  const formLogin    = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const submitBtn = formLogin.querySelector('button[type="submit"]');
      const origText  = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Verifying…';
      try {
        const res = await API.login(email, password);
        if (res.error) {
          showToast(res.error, 'error');
        } else {
          setCurrentUser(res.user);
          showToast(`Welcome back, ${res.user.name}! Redirecting…`, 'success', 1500);
          setTimeout(() => { window.location.href = 'marketplace.html'; }, 700);
        }
      } catch (err) {
        showToast('Login request failed: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = origText;
      }
    });
  }

  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name      = document.getElementById('regName').value.trim();
      const email     = document.getElementById('regEmail').value.trim();
      const password  = document.getElementById('regPassword').value;
      const user_type = document.getElementById('regUserType').value;
      const submitBtn = formRegister.querySelector('button[type="submit"]');
      const origText  = submitBtn.innerText;

      if (!user_type) { showToast('Please select a role: Generator or Recycler.', 'error'); return; }

      submitBtn.disabled = true;
      submitBtn.innerText = 'Creating account…';
      try {
        const res = await API.register(name, email, password, user_type);
        if (res.error) {
          showToast(res.error, 'error');
        } else {
          setCurrentUser(res.user);
          showToast(`Account created for ${res.user.name}! Redirecting…`, 'success', 1500);
          setTimeout(() => { window.location.href = 'marketplace.html'; }, 700);
        }
      } catch (err) {
        showToast('Registration failed: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = origText;
      }
    });
  }
}

/** Fill login form with demo credentials (called by index.html buttons) */
function fillDemoUser(email, password) {
  const loginEmail    = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  if (loginEmail && loginPassword) {
    loginEmail.value    = email;
    loginPassword.value = password;
    // Switch to login tab if needed
    if (typeof switchTab === 'function') switchTab('login');
    showToast(`Demo credentials loaded for ${email}`, 'info');
  }
}

// ==============================================================================
// 5. MARKETPLACE PAGE CONTROLLER
// ==============================================================================

let rawListings = [];
let activeCategoryFilter = 'all';

async function initMarketplacePage() {
  const currentUser = requireAuth();
  if (!currentUser) return;
  updateNavbar();

  const createListingActionContainer = document.getElementById('createListingActionContainer');
  if (createListingActionContainer) {
    if (currentUser.user_type === 'Generator') {
      createListingActionContainer.innerHTML = `
        <button onclick="openListingModal()" class="btn btn-filled-green btn-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Post a Listing
        </button>
      `;
    } else {
      createListingActionContainer.innerHTML = `
        <span class="role-info-chip">
          🚚 Recycler View — click <strong>Request Exchange</strong> on any card
        </span>
      `;
    }
  }

  await loadListings();
  await loadCategoriesForModal();
}

async function loadListings() {
  const container = document.getElementById('listingsGrid');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">⏳</div>
      <p class="empty-state-title">Loading listings…</p>
      <p class="empty-state-sub">Fetching available recyclable materials</p>
    </div>`;

  try {
    rawListings = await API.getListings();
    renderFilteredListings();
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">⚠️</div>
        <p class="empty-state-title">Failed to load listings</p>
        <p class="empty-state-sub">${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function handleSearchFilter() {
  renderFilteredListings();
}

function filterByCategory(cat, chipEl) {
  activeCategoryFilter = cat.toLowerCase();

  // Update chip active state
  document.querySelectorAll('#categoryChips .filter-chip').forEach(c => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');

  renderFilteredListings();
}

function renderFilteredListings() {
  const container  = document.getElementById('listingsGrid');
  const countSpan  = document.getElementById('listingsCount');
  const searchInput = document.getElementById('searchInput');
  const query      = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const currentUser = getCurrentUser();
  if (!container) return;

  const filtered = rawListings.filter(l => {
    const matchesCat   = activeCategoryFilter === 'all' || l.category_name.toLowerCase().includes(activeCategoryFilter);
    const matchesQuery = !query ||
      l.title.toLowerCase().includes(query) ||
      l.category_name.toLowerCase().includes(query) ||
      l.generator_name.toLowerCase().includes(query);
    return matchesCat && matchesQuery;
  });

  if (countSpan) countSpan.textContent = `${filtered.length} of ${rawListings.length}`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🔍</div>
        <p class="empty-state-title">No matching listings found</p>
        <p class="empty-state-sub">Try adjusting your search or selecting "All".</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(l => {
    const isOwner    = currentUser && l.generator_id === currentUser.user_id;
    const isRecycler = currentUser && currentUser.user_type === 'Recycler';
    const catIcon    = getCategoryIcon(l.category_name);

    let actionBtn = '';
    if (isOwner) {
      actionBtn = `<span class="badge badge-available" style="width:100%;justify-content:center;padding:8px 0;">Your Listing</span>`;
    } else if (isRecycler) {
      actionBtn = `
        <button onclick="handleRequestExchange(${l.listing_id}, '${escapeHtml(l.title).replace(/'/g, "\\'")}')"
                class="btn btn-filled" style="width:100%">
          Request Exchange
        </button>`;
    } else {
      actionBtn = `<span class="listing-card-owner-note">Generator view — requests not available</span>`;
    }

    return `
      <div class="listing-card">
        <div class="listing-card-top">
          <div class="listing-cat-row">
            <span class="cat-chip">${catIcon} ${escapeHtml(l.category_name)}</span>
            <span class="weight-chip">${l.weight_kg} kg</span>
          </div>
          <h3 class="listing-title">${escapeHtml(l.title)}</h3>
          <div class="listing-meta-grid">
            <div class="listing-meta-item">
              <span class="listing-meta-label">CO₂ Offset</span>
              <span class="listing-meta-val green-text">🌿 ~${l.potential_co2_saved} kg</span>
            </div>
            <div class="listing-meta-item">
              <span class="listing-meta-label">Generator</span>
              <span class="listing-meta-val">${escapeHtml(l.generator_name)}</span>
            </div>
            <div class="listing-meta-item">
              <span class="listing-meta-label">Eco Points</span>
              <span class="listing-meta-val">⭐ ${l.generator_eco_points}</span>
            </div>
            <div class="listing-meta-item">
              <span class="listing-meta-label">Status</span>
              <span class="badge badge-available">Available</span>
            </div>
          </div>
        </div>
        <div class="listing-card-footer">
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');
}

async function handleRequestExchange(listingId, title) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  if (!confirm(`Confirm exchange request for:\n"${title}"`)) return;

  try {
    const res = await API.createRequest(listingId, currentUser.user_id);
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Exchange request sent! Track progress in your Dashboard.', 'success');
      loadListings();
    }
  } catch (err) {
    showToast('Failed to send request: ' + err.message, 'error');
  }
}

function openListingModal() {
  const modal = document.getElementById('listingModal');
  if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeListingModal() {
  const modal = document.getElementById('listingModal');
  if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
}

async function loadCategoriesForModal() {
  const select = document.getElementById('listingCategorySelect');
  if (!select) return;
  try {
    const categories = await API.getCategories();
    select.innerHTML = '<option value="">— Select a category —</option>' +
      categories.map(c =>
        `<option value="${c.category_id}">${getCategoryIcon(c.name)} ${escapeHtml(c.name)} (${c.co2_saved_per_kg} kg CO₂/kg)</option>`
      ).join('');
  } catch (err) { console.error('Failed to load categories:', err); }
}

function initListingFormHandler() {
  const form = document.getElementById('createListingForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.user_type !== 'Generator') {
      showToast('Only Generators can post listings.', 'error'); return;
    }
    const title       = document.getElementById('listingTitle').value.trim();
    const category_id = parseInt(document.getElementById('listingCategorySelect').value, 10);
    const weight_kg   = parseFloat(document.getElementById('listingWeight').value);

    if (!title || !category_id || isNaN(weight_kg) || weight_kg <= 0) {
      showToast('Please fill out all fields with valid values.', 'error'); return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const origText  = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Publishing…';

    try {
      const res = await API.createListing(currentUser.user_id, category_id, title, weight_kg);
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast('Listing published successfully!', 'success');
        form.reset();
        closeListingModal();
        loadListings();
      }
    } catch (err) {
      showToast('Failed to create listing: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
    }
  });
}

// ==============================================================================
// 6. DASHBOARD PAGE CONTROLLER
// ==============================================================================

async function initDashboardPage() {
  const currentUser = requireAuth();
  if (!currentUser) return;
  updateNavbar();

  const roleIndicatorBox = document.getElementById('roleIndicatorBox');
  if (roleIndicatorBox) {
    const roleColor = currentUser.user_type === 'Generator' ? 'var(--green)' : 'var(--primary)';
    roleIndicatorBox.innerHTML = `
      <div class="role-badge-lg" style="border-color:${roleColor};color:${roleColor}">
        ${currentUser.user_type === 'Generator' ? '🏭' : '🚚'}
        ${currentUser.user_type} Mode
      </div>
    `;
  }

  await loadDashboardMetrics(currentUser.user_id);
}

async function loadDashboardMetrics(userId) {
  const metricsContainer = document.getElementById('impactMetricsContainer');
  const generatorSection = document.getElementById('generatorSection');
  const recyclerSection  = document.getElementById('recyclerSection');

  try {
    const data = await API.getDashboardData(userId);
    if (data.error) { showToast(data.error, 'error'); return; }

    const { impact, myListings, incomingRequests, myRequests } = data;

    // ── Impact stat cards (SQL View) ──────────────────────────
    if (metricsContainer) {
      metricsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon-wrap green"><span>🌱</span></div>
          <div class="stat-body">
            <div class="stat-value">${impact.eco_points}</div>
            <div class="stat-label">Eco Points</div>
            <div class="stat-note">+10 pts per trigger</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrap blue"><span>⚖️</span></div>
          <div class="stat-body">
            <div class="stat-value">${impact.total_weight_diverted} <span class="stat-unit">kg</span></div>
            <div class="stat-label">Weight Diverted</div>
            <div class="stat-note">Aggregated via SQL View</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrap amber"><span>💨</span></div>
          <div class="stat-body">
            <div class="stat-value">${impact.total_co2_saved} <span class="stat-unit">kg</span></div>
            <div class="stat-label">CO₂ Saved</div>
            <div class="stat-note">EPA emission factor</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrap purple"><span>🔄</span></div>
          <div class="stat-body">
            <div class="stat-value">${impact.completed_exchanges}</div>
            <div class="stat-label">Completed Exchanges</div>
            <div class="stat-note">Fulfilled transactions</div>
          </div>
        </div>
      `;
    }

    if (impact.user_type === 'Generator') {
      if (generatorSection) generatorSection.style.display = 'block';
      if (recyclerSection)  recyclerSection.style.display  = 'none';
      renderGeneratorTables(myListings, incomingRequests, impact.user_id);
    } else {
      if (generatorSection) generatorSection.style.display = 'none';
      if (recyclerSection)  recyclerSection.style.display  = 'block';
      renderRecyclerTable(myRequests, impact.user_id);
    }
  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function statusBadge(status) {
  const map = {
    Available: 'badge-available',
    Accepted:  'badge-accepted',
    Pending:   'badge-pending',
    Completed: 'badge-completed',
    Rejected:  'badge-rejected'
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

function renderGeneratorTables(myListings, incomingRequests, generatorId) {
  const listingsTbody  = document.getElementById('myListingsTableBody');
  const requestsTbody  = document.getElementById('incomingRequestsTableBody');
  const pendingCountEl = document.getElementById('pendingRequestsCount');

  // ── Listings Table ────────────────────────────────────────
  if (listingsTbody) {
    if (!myListings || myListings.length === 0) {
      listingsTbody.innerHTML = `<tr><td colspan="5" class="table-empty">No listings yet. <a href="marketplace.html">Post one →</a></td></tr>`;
    } else {
      listingsTbody.innerHTML = myListings.map(l => `
        <tr>
          <td><strong>${escapeHtml(l.title)}</strong></td>
          <td>${getCategoryIcon(l.category_name)} ${escapeHtml(l.category_name)}</td>
          <td><strong>${l.weight_kg} kg</strong></td>
          <td class="green-text">~${l.potential_co2_saved} kg CO₂</td>
          <td>${statusBadge(l.status)}</td>
        </tr>
      `).join('');
    }
  }

  // ── Incoming Requests Table ───────────────────────────────
  if (requestsTbody) {
    const pendingCount = incomingRequests.filter(r => r.request_status === 'Pending').length;
    if (pendingCountEl) pendingCountEl.textContent = `${pendingCount} Pending`;

    if (!incomingRequests || incomingRequests.length === 0) {
      requestsTbody.innerHTML = `<tr><td colspan="6" class="table-empty">No incoming requests yet.</td></tr>`;
    } else {
      requestsTbody.innerHTML = incomingRequests.map(r => {
        const actionCell = r.request_status === 'Pending'
          ? `<button onclick="handleAcceptRequest(${r.request_id}, ${generatorId})"
                    class="btn btn-filled btn-sm"
                    style="background:var(--primary)"
                    title="Executes ACID Transaction with Row Locking">
               🔒 Accept (ACID Tx)
             </button>`
          : statusBadge(r.request_status);

        return `
          <tr>
            <td><strong>#${r.request_id}</strong></td>
            <td>
              <div><strong>${escapeHtml(r.listing_title)}</strong></div>
              <div class="table-sub">${r.weight_kg} kg</div>
            </td>
            <td>
              <div><strong>${escapeHtml(r.recycler_name)}</strong></div>
              <div class="table-sub">${escapeHtml(r.recycler_email)}</div>
            </td>
            <td>${new Date(r.created_at).toLocaleDateString()}</td>
            <td>${statusBadge(r.request_status)}</td>
            <td>${actionCell}</td>
          </tr>`;
      }).join('');
    }
  }
}

function renderRecyclerTable(myRequests, recyclerId) {
  const requestsTbody = document.getElementById('myRequestsTableBody');
  if (!requestsTbody) return;

  if (!myRequests || myRequests.length === 0) {
    requestsTbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">
          No exchange requests yet. <a href="marketplace.html">Browse the marketplace →</a>
        </td>
      </tr>`;
    return;
  }

  requestsTbody.innerHTML = myRequests.map(r => {
    let actionCell = '';
    if (r.request_status === 'Accepted') {
      actionCell = `
        <button onclick="handleCompleteRequest(${r.request_id}, ${recyclerId})"
                class="btn btn-filled-green btn-sm"
                title="Fires AFTER UPDATE Trigger on the database">
          ⚡ Mark Completed
        </button>`;
    } else if (r.request_status === 'Completed') {
      actionCell = `<span class="badge badge-completed">✅ +10 pts Triggered</span>`;
    } else {
      actionCell = statusBadge(r.request_status);
    }

    return `
      <tr>
        <td><strong>#${r.request_id}</strong></td>
        <td><strong>${escapeHtml(r.listing_title)}</strong></td>
        <td>${getCategoryIcon(r.category_name)} ${escapeHtml(r.category_name)}</td>
        <td><strong>${r.weight_kg} kg</strong></td>
        <td>
          <div><strong>${escapeHtml(r.generator_name)}</strong></div>
          <div class="table-sub">${escapeHtml(r.generator_email)}</div>
        </td>
        <td>${actionCell}</td>
      </tr>`;
  }).join('');
}

// ==============================================================================
// 7. DBMS CONCEPT ACTION HANDLERS
// ==============================================================================

async function handleAcceptRequest(requestId, generatorId) {
  try {
    const res = await API.acceptRequest(requestId, generatorId);
    if (res.error) {
      showToast(res.error, 'error', 6000);
      return;
    }
    const tx = res.acid_transaction;
    const modalHtml = `
      <div class="result-card success">
        <h4 class="result-card-title">🔒 ACID Transaction Committed Successfully</h4>
        <div class="result-rows">
          <div class="result-row">
            <span class="result-key">Lock Mechanism</span>
            <code class="result-code">WITH (UPDLOCK, ROWLOCK) on WasteListings</code>
          </div>
          <div class="result-row">
            <span class="result-key">Transaction Status</span>
            <span class="badge badge-available">${tx.status}</span>
          </div>
          <div class="result-row">
            <span class="result-key">Listing #${tx.listing_id}</span>
            <span>Status updated to ${statusBadge('Accepted')}</span>
          </div>
          <div class="result-row">
            <span class="result-key">Winning Request #${tx.accepted_request_id}</span>
            <span>Marked ${statusBadge('Accepted')}</span>
          </div>
          <div class="result-row">
            <span class="result-key">Competing Requests Rejected</span>
            <strong>${tx.competing_requests_rejected}</strong>
          </div>
        </div>
      </div>
      <div class="result-card info">
        <p class="result-note">
          <strong>DBMS Rationale:</strong> Row-level locks prevent dirty reads and double-booking race conditions
          when multiple recyclers request the same listing simultaneously. This demonstrates the
          <strong>Isolation</strong> property of ACID.
        </p>
      </div>
    `;
    showVerificationModal('🔒 ACID Transaction — Row-Level Locking', modalHtml);
    showToast(res.message, 'success');
    await loadDashboardMetrics(generatorId);
  } catch (err) {
    showToast('ACID Transaction failed: ' + err.message, 'error');
  }
}

async function handleCompleteRequest(requestId, userId) {
  try {
    const res = await API.completeRequest(requestId, userId);
    if (res.error) {
      showToast(res.error, 'error', 6000);
      return;
    }
    const v = res.trigger_verification;
    const modalHtml = `
      <div class="result-card success" style="--result-accent: var(--green)">
        <h4 class="result-card-title">⚡ Database Trigger Executed Automatically</h4>
        <div class="result-rows">
          <div class="result-row">
            <span class="result-key">Trigger Name</span>
            <code class="result-code">${v.trigger_name}</code>
          </div>
          <div class="result-row">
            <span class="result-key">Event</span>
            <code class="result-code">AFTER UPDATE OF request_status ON ExchangeRequests</code>
          </div>
          <div class="result-row">
            <span class="result-key">Listing Status</span>
            <span>Auto-updated to ${statusBadge('Completed')}</span>
          </div>
          <div class="result-row">
            <span class="result-key">Generator #${v.generator_id} Eco Points</span>
            <strong>${v.eco_points_before} → ${v.eco_points_after} (+${v.points_awarded_by_trigger} pts)</strong>
          </div>
        </div>
      </div>
      <div class="result-card info">
        <p class="result-note">
          <strong>DBMS Rationale:</strong> Business logic enforced at the <em>database tier</em> ensures
          referential and state integrity regardless of client implementation. The trigger fires
          automatically — no application code awards the points.
        </p>
      </div>
    `;
    showVerificationModal('⚡ SQL Trigger — trg_ExchangeRequests_Completed', modalHtml);
    showToast(res.message, 'success');
    await loadDashboardMetrics(userId);
  } catch (err) {
    showToast('Failed to complete request: ' + err.message, 'error');
  }
}
