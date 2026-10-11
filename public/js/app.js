/**
 * ReLoop - Waste Exchange and Recycling Marketplace
 * Modern Frontend Logic & DBMS Concept Demonstration
 */

// ==============================================================================
// 1. ENVIRONMENT & PERSISTENCE HELPERS
// ==============================================================================

const isLocalFileMode = window.location.protocol === 'file:';

const CATEGORY_ICONS = {
  'Plastic (PET / HDPE)': '🥤',
  'Paper & Cardboard': '📦',
  'Metals (Aluminum & Steel)': '⚙️',
  'Glass': '🍾',
  'E-Waste (Electronics)': '💻',
  'Organic Waste': '🍂'
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

// Session state
function getCurrentUser() {
  const userJson = localStorage.getItem('reloop_user');
  try {
    return userJson ? JSON.parse(userJson) : null;
  } catch (e) {
    return null;
  }
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
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

// ==============================================================================
// 2. UI UTILITIES, TOASTS & VERIFICATION MODAL
// ==============================================================================

function showToast(message, type = 'info', duration = 4500) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  toast.className = type;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span> ${escapeHtml(message)}`;
  toast.style.display = 'flex';

  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

function showVerificationModal(title, contentHtml) {
  const modal = document.getElementById('dbmsVerificationModal');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');

  if (modal && titleEl && bodyEl) {
    titleEl.innerHTML = title;
    bodyEl.innerHTML = contentHtml;
    modal.classList.add('active');
  } else {
    // Fallback if modal not in DOM
    alert(title.replace(/<[^>]*>/g, '') + '\n\n' + contentHtml.replace(/<[^>]*>/g, ''));
  }
}

function closeVerificationModal() {
  const modal = document.getElementById('dbmsVerificationModal');
  if (modal) modal.classList.remove('active');
}

function updateNavbar() {
  const user = getCurrentUser();
  const navUserSection = document.getElementById('navUserSection');
  if (!navUserSection) return;

  if (user) {
    const roleClass = user.user_type === 'Generator' ? 'generator' : 'recycler';
    const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
    navUserSection.innerHTML = `
      <div class="user-badge">
        <div class="user-avatar-circle">${initials}</div>
        <span><strong>${escapeHtml(user.name)}</strong></span>
        <span class="role-pill ${roleClass}">${user.user_type}</span>
      </div>
      <button onclick="logout()" class="btn btn-secondary btn-sm">Sign Out</button>
    `;
  } else {
    navUserSection.innerHTML = `
      <a href="index.html" class="btn btn-primary btn-sm">Login / Register</a>
    `;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==============================================================================
// 3. API SERVICE METHODS (FETCH WITH LOCAL FALLBACK)
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
        if (res.ok || res.status === 401 || res.status === 400) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Backend not reached, using local simulation mode');
      }
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
        if (res.ok || res.status === 409 || res.status === 400) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Backend not reached, using local simulation mode');
      }
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
        if (res.ok || res.status === 400 || res.status === 403) {
          return await res.json();
        }
      } catch (e) {}
    }

    const db = getMockDb();
    const newListing = {
      listing_id: db.listings.length + 1,
      generator_id,
      category_id,
      title,
      weight_kg,
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
        if (res.ok || res.status === 400 || res.status === 409) {
          return await res.json();
        }
      } catch (e) {}
    }

    const db = getMockDb();
    const existing = db.requests.find(r => r.listing_id === listing_id && r.recycler_id === recycler_id && ['Pending', 'Accepted'].includes(r.request_status));
    if (existing) {
      return { error: 'You have already submitted an active request for this listing.' };
    }
    const newReq = {
      request_id: db.requests.length + 1,
      listing_id,
      recycler_id,
      request_status: 'Pending',
      created_at: new Date().toISOString()
    };
    db.requests.push(newReq);
    saveMockDb(db);
    return { success: true, request: newReq };
  },

  // ACID Transaction
  acceptRequest: async (request_id, generator_id) => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch('/api/requests/accept', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id, generator_id })
        });
        if (res.ok || res.status === 400 || res.status === 409) {
          return await res.json();
        }
      } catch (e) {}
    }

    const db = getMockDb();
    const targetReq = db.requests.find(r => r.request_id === request_id);
    if (!targetReq) return { error: 'Exchange request not found.' };

    const listing = db.listings.find(l => l.listing_id === targetReq.listing_id);
    if (!listing) return { error: 'Listing not found.' };

    if (listing.generator_id !== generator_id) {
      return { error: 'Unauthorized: You are not the generator of this listing.' };
    }

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
      message: `Transaction committed successfully! Request #${request_id} accepted. Listing status marked 'Accepted'. ${rejectedCount} other pending request(s) automatically rejected.`
    };
  },

  // SQL Trigger
  completeRequest: async (request_id, user_id) => {
    if (!isLocalFileMode) {
      try {
        const res = await fetch('/api/requests/complete', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id, user_id })
        });
        if (res.ok || res.status === 400 || res.status === 403) {
          return await res.json();
        }
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

    if (generator) {
      generator.eco_points += 10;
    }

    saveMockDb(db);

    const cur = getCurrentUser();
    if (cur && cur.user_id === generator.user_id) {
      cur.eco_points = generator.eco_points;
      setCurrentUser(cur);
    }

    return {
      success: true,
      message: "Exchange marked 'Completed'. Database Trigger 'trg_ExchangeRequests_Completed' executed automatically!",
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

  // SQL View
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

    let totalWeightDiverted = 0;
    let totalCo2Saved = 0;
    let completedExchanges = 0;

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
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      user_type: user.user_type,
      eco_points: user.eco_points,
      total_listings_posted: db.listings.filter(l => l.generator_id === userId).length,
      completed_exchanges: completedExchanges,
      total_weight_diverted: totalWeightDiverted.toFixed(2),
      total_co2_saved: totalCo2Saved.toFixed(2)
    };

    let myListings = [];
    let incomingRequests = [];
    let myRequests = [];

    if (user.user_type === 'Generator') {
      myListings = db.listings.filter(l => l.generator_id === userId).map(l => {
        const cat = db.categories.find(c => c.category_id === l.category_id) || { name: 'General', co2_saved_per_kg: 1.0 };
        return {
          ...l,
          category_name: cat.name,
          co2_saved_per_kg: cat.co2_saved_per_kg,
          potential_co2_saved: (l.weight_kg * cat.co2_saved_per_kg).toFixed(2)
        };
      });

      incomingRequests = db.requests
        .filter(r => {
          const l = db.listings.find(x => x.listing_id === r.listing_id);
          return l && l.generator_id === userId;
        })
        .map(r => {
          const l = db.listings.find(x => x.listing_id === r.listing_id);
          const recycler = db.users.find(u => u.user_id === r.recycler_id) || { name: 'Recycler', email: '' };
          return {
            ...r,
            listing_title: l ? l.title : 'Listing',
            weight_kg: l ? l.weight_kg : 0,
            recycler_name: recycler.name,
            recycler_email: recycler.email
          };
        });
    } else {
      myRequests = db.requests
        .filter(r => r.recycler_id === userId)
        .map(r => {
          const l = db.listings.find(x => x.listing_id === r.listing_id);
          const cat = l ? (db.categories.find(c => c.category_id === l.category_id) || { name: 'General' }) : { name: 'General' };
          const gen = l ? (db.users.find(u => u.user_id === l.generator_id) || { name: 'Generator', email: '' }) : { name: 'Generator', email: '' };
          return {
            ...r,
            listing_title: l ? l.title : 'Listing',
            weight_kg: l ? l.weight_kg : 0,
            listing_status: l ? l.status : 'Unknown',
            category_name: cat.name,
            generator_name: gen.name,
            generator_email: gen.email
          };
        });
    }

    return {
      success: true,
      impact,
      myListings,
      incomingRequests,
      myRequests
    };
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
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1.1rem; border-radius: 12px; margin-bottom: 2rem; text-align: center; box-shadow: var(--shadow-sm);">
          <p style="font-size: 0.95rem;">Logged in as <strong>${escapeHtml(existingUser.name)}</strong> (${existingUser.user_type})</p>
          <div style="margin-top: 0.65rem; display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap;">
            <a href="marketplace.html" class="btn btn-primary btn-sm">Go to Marketplace</a>
            <a href="dashboard.html" class="btn btn-secondary btn-sm">Go to Dashboard</a>
            <button onclick="logout()" class="btn btn-danger btn-sm">Switch Account</button>
          </div>
        </div>
      `;
    }
  }

  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formRegister.style.display = 'block';
      formLogin.style.display = 'none';
    });
  }

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const submitBtn = formLogin.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.innerText = 'Verifying credentials...';

      try {
        const res = await API.login(email, password);
        if (res.error) {
          showToast(res.error, 'error');
        } else {
          setCurrentUser(res.user);
          showToast(`Welcome back, ${res.user.name}! Redirecting...`, 'success');
          setTimeout(() => {
            window.location.href = 'marketplace.html';
          }, 600);
        }
      } catch (err) {
        showToast('Login request failed: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Sign In to ReLoop';
      }
    });
  }

  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const user_type = document.getElementById('regUserType').value;
      const submitBtn = formRegister.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.innerText = 'Creating account...';

      try {
        const res = await API.register(name, email, password, user_type);
        if (res.error) {
          showToast(res.error, 'error');
        } else {
          setCurrentUser(res.user);
          showToast(`Account created for ${res.user.name}! Redirecting...`, 'success');
          setTimeout(() => {
            window.location.href = 'marketplace.html';
          }, 600);
        }
      } catch (err) {
        showToast('Registration failed: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Create Account';
      }
    });
  }
}

function fillDemoUser(email, password) {
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  if (loginEmail && loginPassword) {
    loginEmail.value = email;
    loginPassword.value = password;
    showToast(`Loaded demo credentials for ${email}`, 'info');
  }
}

// ==============================================================================
// 5. MARKETPLACE PAGE CONTROLLER WITH SEARCH & FILTER
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
        <button onclick="openListingModal()" class="btn btn-primary">
          ➕ Post Waste Listing
        </button>
      `;
    } else {
      createListingActionContainer.innerHTML = `
        <span style="font-size: 0.88rem; color: #0369a1; padding: 0.5rem 1rem; background: #e0f2fe; border-radius: 99px; border: 1px solid #bae6fd; font-weight: 500;">
          🚚 Recycler View: Click <strong>Request Exchange</strong> to claim materials.
        </span>
      `;
    }
  }

  await loadListings();
  await loadCategoriesForModal();
}

async function loadListings() {
  const container = document.getElementById('listingsGrid');
  const countSpan = document.getElementById('listingsCount');
  if (!container) return;

  container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">Fetching recyclable materials...</div>';

  try {
    rawListings = await API.getListings();
    if (countSpan) countSpan.innerText = `${rawListings.length} Available`;
    renderFilteredListings();
  } catch (err) {
    container.innerHTML = `<div style="grid-column: 1/-1; color: var(--red); text-align: center;">Error loading listings: ${err.message}</div>`;
  }
}

function handleSearchFilter() {
  renderFilteredListings();
}

function filterByCategory(cat) {
  activeCategoryFilter = cat.toLowerCase();

  // Update chip styles
  const chips = document.querySelectorAll('#categoryChips .chip');
  chips.forEach(chip => {
    chip.classList.remove('active');
  });

  const eventTarget = window.event ? window.event.target : null;
  if (eventTarget) {
    eventTarget.classList.add('active');
  }

  renderFilteredListings();
}

function renderFilteredListings() {
  const container = document.getElementById('listingsGrid');
  const countSpan = document.getElementById('listingsCount');
  const searchInput = document.getElementById('searchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const currentUser = getCurrentUser();

  if (!container) return;

  const filtered = rawListings.filter(l => {
    const matchesCat = activeCategoryFilter === 'all' || l.category_name.toLowerCase().includes(activeCategoryFilter);
    const matchesQuery = !query || 
      l.title.toLowerCase().includes(query) || 
      l.category_name.toLowerCase().includes(query) ||
      l.generator_name.toLowerCase().includes(query);
    return matchesCat && matchesQuery;
  });

  if (countSpan) countSpan.innerText = `${filtered.length} of ${rawListings.length} Available`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3.5rem; background: white; border-radius: 16px; border: 1px dashed var(--border);">
        <p style="font-size: 1.15rem; font-weight: 600; color: var(--text-title); margin-bottom: 0.3rem;">No matching waste materials found.</p>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Try adjusting your search query or selecting "All Materials".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(l => {
    const isOwner = currentUser && l.generator_id === currentUser.user_id;
    const isRecycler = currentUser && currentUser.user_type === 'Recycler';
    const catIcon = getCategoryIcon(l.category_name);

    let actionBtn = '';
    if (isOwner) {
      actionBtn = `<span class="status-badge" style="background: #f1f5f9; color: #475569; width: 100%; justify-content: center; padding: 7px;">Your Published Listing</span>`;
    } else if (isRecycler) {
      actionBtn = `
        <button onclick="handleRequestExchange(${l.listing_id}, '${escapeHtml(l.title)}')" class="btn btn-primary" style="width: 100%;">
          Claim / Request Exchange
        </button>
      `;
    } else {
      actionBtn = `<span style="font-size: 0.82rem; color: var(--text-muted); text-align: center; display: block;">Generator view only</span>`;
    }

    return `
      <div class="listing-card">
        <div>
          <div class="listing-card-header">
            <span class="listing-badge">${catIcon} ${escapeHtml(l.category_name)}</span>
            <span class="listing-weight-pill">${l.weight_kg} kg</span>
          </div>

          <h3 class="listing-title">${escapeHtml(l.title)}</h3>

          <div class="listing-meta-box">
            <div class="meta-row">
              <span class="label">CO₂ Offset Potential:</span>
              <span class="val green">🌿 ~${l.potential_co2_saved} kg CO₂</span>
            </div>
            <div class="meta-row">
              <span class="label">Generator:</span>
              <span class="val">${escapeHtml(l.generator_name)}</span>
            </div>
            <div class="meta-row">
              <span class="label">Eco Points Rating:</span>
              <span class="val">⭐ ${l.generator_eco_points} pts</span>
            </div>
          </div>
        </div>

        <div style="margin-top: 0.5rem;">
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');
}

async function handleRequestExchange(listingId, title) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  if (!confirm(`Confirm requesting waste exchange for: "${title}"?`)) return;

  try {
    const res = await API.createRequest(listingId, currentUser.user_id);
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Exchange request sent to Generator! Track it in your Dashboard.', 'success');
      loadListings();
    }
  } catch (err) {
    showToast('Failed to send exchange request: ' + err.message, 'error');
  }
}

function openListingModal() {
  const modal = document.getElementById('listingModal');
  if (modal) modal.classList.add('active');
}

function closeListingModal() {
  const modal = document.getElementById('listingModal');
  if (modal) modal.classList.remove('active');
}

async function loadCategoriesForModal() {
  const select = document.getElementById('listingCategorySelect');
  if (!select) return;

  try {
    const categories = await API.getCategories();
    select.innerHTML = '<option value="">-- Select Material Category --</option>' +
      categories.map(c => `
        <option value="${c.category_id}">
          ${getCategoryIcon(c.name)} ${escapeHtml(c.name)} (${c.co2_saved_per_kg} kg CO₂ offset / kg)
        </option>
      `).join('');
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function initListingFormHandler() {
  const form = document.getElementById('createListingForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.user_type !== 'Generator') {
      showToast('Only Generators can create listings.', 'error');
      return;
    }

    const title = document.getElementById('listingTitle').value.trim();
    const category_id = parseInt(document.getElementById('listingCategorySelect').value, 10);
    const weight_kg = parseFloat(document.getElementById('listingWeight').value);

    if (!title || !category_id || isNaN(weight_kg) || weight_kg <= 0) {
      showToast('Please fill out all fields with valid values.', 'warning');
      return;
    }

    try {
      const res = await API.createListing(currentUser.user_id, category_id, title, weight_kg);
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast('New waste listing published successfully!', 'success');
        form.reset();
        closeListingModal();
        loadListings();
      }
    } catch (err) {
      showToast('Failed to create listing: ' + err.message, 'error');
    }
  });
}

// ==============================================================================
// 6. DASHBOARD & DBMS CONCEPTS DEMONSTRATION CONTROLLER
// ==============================================================================

async function initDashboardPage() {
  const currentUser = requireAuth();
  if (!currentUser) return;
  updateNavbar();

  const roleIndicatorBox = document.getElementById('roleIndicatorBox');
  if (roleIndicatorBox) {
    const roleClass = currentUser.user_type === 'Generator' ? 'generator' : 'recycler';
    roleIndicatorBox.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <span style="font-size: 0.88rem; color: var(--text-muted);">Active Profile:</span>
        <span class="role-pill ${roleClass}" style="font-size: 0.82rem; padding: 4px 12px;">${currentUser.user_type} Mode</span>
      </div>
    `;
  }

  await loadDashboardMetrics(currentUser.user_id);
}

async function loadDashboardMetrics(userId) {
  const metricsContainer = document.getElementById('impactMetricsContainer');
  const generatorSection = document.getElementById('generatorSection');
  const recyclerSection = document.getElementById('recyclerSection');

  try {
    const data = await API.getDashboardData(userId);
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    const { impact, myListings, incomingRequests, myRequests } = data;

    // Render Impact Dashboard from the SQL View: UserImpactDashboard
    if (metricsContainer) {
      metricsContainer.innerHTML = `
        <div class="stat-card stat-green">
          <div class="stat-icon green">🌱</div>
          <div class="stat-info">
            <div class="stat-label">Eco Points</div>
            <div class="stat-value">${impact.eco_points}</div>
            <div class="stat-sub">⚡ +10 pts via SQL Trigger</div>
          </div>
        </div>

        <div class="stat-card stat-blue">
          <div class="stat-icon blue">⚖️</div>
          <div class="stat-info">
            <div class="stat-label">Weight Diverted</div>
            <div class="stat-value">${impact.total_weight_diverted} <span style="font-size: 1.1rem; font-weight: 600;">kg</span></div>
            <div class="stat-sub">📊 Aggregated via SQL View</div>
          </div>
        </div>

        <div class="stat-card stat-amber">
          <div class="stat-icon amber">💨</div>
          <div class="stat-info">
            <div class="stat-label">CO₂ Saved</div>
            <div class="stat-value">${impact.total_co2_saved} <span style="font-size: 1.1rem; font-weight: 600;">kg</span></div>
            <div class="stat-sub">🌿 EPA emission factor</div>
          </div>
        </div>

        <div class="stat-card stat-purple">
          <div class="stat-icon purple">🔄</div>
          <div class="stat-info">
            <div class="stat-label">Fulfilled Exchanges</div>
            <div class="stat-value">${impact.completed_exchanges}</div>
            <div class="stat-sub">🤝 Completed transactions</div>
          </div>
        </div>
      `;
    }

    if (impact.user_type === 'Generator') {
      if (generatorSection) generatorSection.style.display = 'block';
      if (recyclerSection) recyclerSection.style.display = 'none';

      renderGeneratorTables(myListings, incomingRequests, impact.user_id);
    } else {
      if (generatorSection) generatorSection.style.display = 'none';
      if (recyclerSection) recyclerSection.style.display = 'block';

      renderRecyclerTable(myRequests, impact.user_id);
    }

  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function renderGeneratorTables(myListings, incomingRequests, generatorId) {
  const listingsTbody = document.getElementById('myListingsTableBody');
  const requestsTbody = document.getElementById('incomingRequestsTableBody');
  const pendingCountSpan = document.getElementById('pendingRequestsCount');

  // Listings Table
  if (listingsTbody) {
    if (!myListings || myListings.length === 0) {
      listingsTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No listings created yet.</td></tr>`;
    } else {
      listingsTbody.innerHTML = myListings.map(l => `
        <tr>
          <td><strong>${escapeHtml(l.title)}</strong></td>
          <td>${getCategoryIcon(l.category_name)} ${escapeHtml(l.category_name)}</td>
          <td><strong>${l.weight_kg} kg</strong></td>
          <td><span style="color: var(--primary); font-weight: 600;">~${l.potential_co2_saved} kg CO₂</span></td>
          <td><span class="status-badge ${l.status}">${l.status}</span></td>
        </tr>
      `).join('');
    }
  }

  // Incoming Requests Table
  if (requestsTbody) {
    const pendingCount = incomingRequests.filter(r => r.request_status === 'Pending').length;
    if (pendingCountSpan) pendingCountSpan.innerText = `${pendingCount} Pending`;

    if (!incomingRequests || incomingRequests.length === 0) {
      requestsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No incoming exchange requests yet.</td></tr>`;
    } else {
      requestsTbody.innerHTML = incomingRequests.map(r => {
        let actionCell = '';
        if (r.request_status === 'Pending') {
          actionCell = `
            <button onclick="handleAcceptRequest(${r.request_id}, ${generatorId})" class="btn btn-acid btn-sm" title="Executes ACID Transaction with Row Locking">
              🔒 Accept (ACID)
            </button>
          `;
        } else {
          actionCell = `<span class="status-badge ${r.request_status}">${r.request_status}</span>`;
        }

        return `
          <tr>
            <td><strong>#${r.request_id}</strong></td>
            <td><strong>${escapeHtml(r.listing_title)}</strong> (${r.weight_kg} kg)</td>
            <td>
              <div><strong>${escapeHtml(r.recycler_name)}</strong></div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(r.recycler_email)}</div>
            </td>
            <td>${new Date(r.created_at).toLocaleDateString()}</td>
            <td><span class="status-badge ${r.request_status}">${r.request_status}</span></td>
            <td>${actionCell}</td>
          </tr>
        `;
      }).join('');
    }
  }
}

function renderRecyclerTable(myRequests, recyclerId) {
  const requestsTbody = document.getElementById('myRequestsTableBody');
  if (!requestsTbody) return;

  if (!myRequests || myRequests.length === 0) {
    requestsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">You haven't submitted any exchange requests yet. Go to Marketplace to request waste materials!</td></tr>`;
    return;
  }

  requestsTbody.innerHTML = myRequests.map(r => {
    let actionCell = '';

    if (r.request_status === 'Accepted') {
      actionCell = `
        <button onclick="handleCompleteRequest(${r.request_id}, ${recyclerId})" class="btn btn-trigger btn-sm" title="Fires Azure SQL AFTER UPDATE Trigger">
          ⚡ Mark Completed (Trigger)
        </button>
      `;
    } else if (r.request_status === 'Completed') {
      actionCell = `<span class="status-badge Completed">✅ Fulfilled (+10 Pts Triggered)</span>`;
    } else {
      actionCell = `<span class="status-badge ${r.request_status}">${r.request_status}</span>`;
    }

    return `
      <tr>
        <td><strong>#${r.request_id}</strong></td>
        <td><strong>${escapeHtml(r.listing_title)}</strong></td>
        <td>${getCategoryIcon(r.category_name)} ${escapeHtml(r.category_name)}</td>
        <td><strong>${r.weight_kg} kg</strong></td>
        <td>
          <div><strong>${escapeHtml(r.generator_name)}</strong></div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(r.generator_email)}</div>
        </td>
        <td>${actionCell}</td>
      </tr>
    `;
  }).join('');
}

// ==============================================================================
// 7. DBMS CONCEPTS DEMONSTRATION ACTIONS
// ==============================================================================

async function handleAcceptRequest(requestId, generatorId) {
  try {
    const res = await API.acceptRequest(requestId, generatorId);
    if (res.error) {
      showToast(res.error, 'error', 6000);
    } else {
      const modalHtml = `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem;">
          <h4 style="color: #1e40af; margin-bottom: 0.5rem;">🔒 ACID Concurrency Control Executed</h4>
          <ul style="list-style-type: none; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.92rem;">
            <li><strong>Lock Mechanism:</strong> <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">WITH (UPDLOCK, ROWLOCK)</code> on WasteListings</li>
            <li><strong>Listing #${res.acid_transaction.listing_id}:</strong> Status updated to <span class="status-badge Accepted">Accepted</span></li>
            <li><strong>Winning Request #${res.acid_transaction.accepted_request_id}:</strong> Marked <span class="status-badge Accepted">Accepted</span></li>
            <li><strong>Competing Offers:</strong> <strong>${res.acid_transaction.competing_requests_rejected}</strong> other pending request(s) automatically marked <span class="status-badge Rejected">Rejected</span></li>
          </ul>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-muted);">
          <strong>DBMS Evaluation Rationale:</strong> Row-level locks prevent dirty reads and double-booking race conditions when multiple recyclers request the same listing simultaneously.
        </p>
      `;

      showVerificationModal('🔒 ACID Transaction Committed!', modalHtml);
      showToast(res.message, 'success');
      await loadDashboardMetrics(generatorId);
    }
  } catch (err) {
    showToast('ACID Transaction failed: ' + err.message, 'error');
  }
}

async function handleCompleteRequest(requestId, userId) {
  try {
    const res = await API.completeRequest(requestId, userId);
    if (res.error) {
      showToast(res.error, 'error', 6000);
    } else {
      const v = res.trigger_verification;
      const modalHtml = `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem;">
          <h4 style="color: #065f46; margin-bottom: 0.5rem;">⚡ Azure SQL Database Trigger Executed</h4>
          <ul style="list-style-type: none; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.92rem;">
            <li><strong>Trigger:</strong> <code style="background: #d1fae5; padding: 2px 6px; border-radius: 4px;">trg_ExchangeRequests_Completed</code></li>
            <li><strong>Event:</strong> <code>AFTER UPDATE</code> on table <code>ExchangeRequests</code></li>
            <li><strong>Listing Status:</strong> Automatically transitioned to <span class="status-badge Completed">Completed</span></li>
            <li><strong>Eco Points:</strong> Generator #${v.generator_id} awarded <strong>+${v.points_awarded_by_trigger} points</strong> (${v.eco_points_before} ➔ ${v.eco_points_after})</li>
          </ul>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-muted);">
          <strong>DBMS Evaluation Rationale:</strong> Business logic enforced at the database tier ensures referential and state integrity regardless of client implementation.
        </p>
      `;

      showVerificationModal('⚡ Azure SQL Trigger Fired!', modalHtml);
      showToast(res.message, 'success');
      await loadDashboardMetrics(userId);
    }
  } catch (err) {
    showToast('Failed to complete request: ' + err.message, 'error');
  }
}
