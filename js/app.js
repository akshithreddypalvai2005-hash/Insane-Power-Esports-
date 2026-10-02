/**
 * INSANE POWER ESPORTS - FREE FIRE WEEKLY WARS MASTER APP
 * 48-Slot (4 Groups x 12 Squads) Line-Wise Allocation & Day-Specific IDP Security System
 * Google Sign-In + REST API Hybrid Client
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? `${window.location.origin}/api`
  : '/api';

let pendingGoogleUser = null;
let _serverFilledSlots = 0; // server-authoritative slot count
let _authorizedAdminEmails = ['akshithreddypalvai2005@gmail.com'];

document.addEventListener('DOMContentLoaded', async () => {
  initSeedData();
  initThreeJS();
  initCountdown();
  initNavigation();
  initAuthSystem();
  initGoogleAuth();
  // Sync tournament data and admin emails from server before first render
  await syncFromServer();
  renderWeeklyWars();
  renderSquadBuilder();
  renderIdpPortal();
  renderLeaderboard();
  renderFaqs();
  renderAdminPortal();
  setupModals();
  setupCard3DTilt();
});

// Sync authoritative data from server API
async function syncFromServer() {
  try {
    const [statusRes, emailsRes, leadRes] = await Promise.all([
      fetch(`${API_BASE}/tournaments/status`).catch(() => null),
      fetch(`${API_BASE}/admin/emails`).catch(() => null),
      fetch(`${API_BASE}/leaderboard`).catch(() => null)
    ]);
    if (statusRes && statusRes.ok) {
      const statusData = await statusRes.json();
      if (statusData.success) {
        _serverFilledSlots = statusData.filledSlots;
        // Sync registrations to localStorage from server
        if (Array.isArray(statusData.registrations)) {
          localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(statusData.registrations));
        }
      }
    }
    if (emailsRes && emailsRes.ok) {
      const emailsData = await emailsRes.json();
      if (emailsData.success && Array.isArray(emailsData.emails)) {
        _authorizedAdminEmails = emailsData.emails;
      }
    }
    if (leadRes && leadRes.ok) {
      const leadData = await leadRes.json();
      if (leadData.success && leadData.leaderboard) {
        localStorage.setItem(STANDINGS_STORAGE_KEY, JSON.stringify(leadData.leaderboard));
      }
    }
  } catch (err) {
    // Offline or server not running – use localStorage fallback
    const localRegs = JSON.parse(localStorage.getItem(REGISTRATION_STORAGE_KEY) || '[]');
    _serverFilledSlots = localRegs.length;
  }
}

// Seed Initial Players and IDP settings if empty
function initSeedData() {
  if (!localStorage.getItem(USERS_STORAGE_KEY)) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(IP_DATA.seedPlayers));
  }
  if (!localStorage.getItem(IDP_SETTINGS_STORAGE_KEY)) {
    localStorage.setItem(IDP_SETTINGS_STORAGE_KEY, JSON.stringify(IP_DATA.idpSettings));
  }
}

// Storage Helpers
function getAllUsers() {
  return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
}

function getAllSquads() {
  return JSON.parse(localStorage.getItem(SQUADS_STORAGE_KEY) || '[]');
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem(CURRENT_USER_SESSION_KEY) || 'null');
}

function getIdpSettings() {
  return JSON.parse(localStorage.getItem(IDP_SETTINGS_STORAGE_KEY) || JSON.stringify(IP_DATA.idpSettings));
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_SESSION_KEY);
  }
  updateAuthUI();
  renderSquadBuilder();
  renderIdpPortal();
  renderAdminPortal();
}

// Toast Notifications
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  
  const icon = type === 'success' 
    ? '<i class="fa-solid fa-circle-check text-amber-400 text-lg"></i>' 
    : type === 'error' 
    ? '<i class="fa-solid fa-triangle-exclamation text-red-500 text-lg"></i>' 
    : '<i class="fa-solid fa-circle-info text-cyan-400 text-lg"></i>';

  toast.innerHTML = `
    ${icon}
    <div class="flex-1 text-xs font-heading font-medium tracking-wide">
      <p class="text-slate-100">${message}</p>
    </div>
    <button class="text-slate-400 hover:text-white" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.35s ease';
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// ==================== AUTH SYSTEM (LOGIN, SIGNUP, GOOGLE AUTH) ====================
function initAuthSystem() {
  const loginForm = document.getElementById('auth-login-form');
  const signupForm = document.getElementById('auth-signup-form');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabSignup = document.getElementById('auth-tab-signup');
  const loginPane = document.getElementById('auth-pane-login');
  const signupPane = document.getElementById('auth-pane-signup');
  const gProfileForm = document.getElementById('google-profile-form');

  if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('bg-amber-500', 'text-black');
      tabLogin.classList.remove('text-slate-400');
      tabSignup.classList.remove('bg-amber-500', 'text-black');
      tabSignup.classList.add('text-slate-400');
      loginPane.classList.remove('hidden');
      signupPane.classList.add('hidden');
    });

    tabSignup.addEventListener('click', () => {
      tabSignup.classList.add('bg-amber-500', 'text-black');
      tabSignup.classList.remove('text-slate-400');
      tabLogin.classList.remove('bg-amber-500', 'text-black');
      tabLogin.classList.add('text-slate-400');
      signupPane.classList.remove('hidden');
      loginPane.classList.add('hidden');
    });
  }

  // Signup form handler
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('signup-username').value.trim().toLowerCase();
      const name = document.getElementById('signup-name').value.trim();
      const ign = document.getElementById('signup-ign').value.trim();
      const uid = document.getElementById('signup-uid').value.trim();
      const phone = document.getElementById('signup-phone').value.trim();

      if (!username || !name || !ign || !uid || !phone) {
        showToast('Please fill all mandatory profile fields!', 'error');
        return;
      }

      // Try Backend API first, fallback to localStorage
      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, name, ign, uid, phone })
        });
        const data = await res.json();
        if (data.success) {
          const users = getAllUsers();
          users.push(data.user);
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
          setCurrentUser(data.user);
          closeAuthModal();
          signupForm.reset();
          showToast(`Welcome @${username}! Account registered successfully.`, 'success');
          return;
        } else {
          showToast(data.message || 'Registration failed', 'error');
          return;
        }
      } catch (err) {
        // Fallback local registration
        const users = getAllUsers();
        if (users.some(u => u.username.toLowerCase() === username)) {
          showToast(`Username @${username} is already taken!`, 'error');
          return;
        }
        if (users.some(u => u.uid === uid)) {
          showToast(`Free Fire UID ${uid} is already registered!`, 'error');
          return;
        }

        const newUser = {
          id: `u_${Date.now()}`,
          username,
          name,
          ign,
          uid,
          phone,
          authProvider: 'local',
          role: 'Player',
          registeredAt: new Date().toISOString().split('T')[0]
        };

        users.push(newUser);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        setCurrentUser(newUser);
        closeAuthModal();
        signupForm.reset();
        showToast(`Welcome @${username}! Account registered successfully.`, 'success');
      }
    });
  }

  // Login form handler
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('login-username').value.trim().toLowerCase();
      
      // Try backend API first
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: input, email: input })
        });
        const data = await res.json();
        if (data.success) {
          setCurrentUser(data.user);
          closeAuthModal();
          loginForm.reset();
          showToast(data.message || `Welcome back, ${data.user.name || data.user.ign}!`, 'success');
          return;
        } else {
          showToast(data.message || 'Login failed', 'error');
          return;
        }
      } catch (err) {
        // Fallback local check
      }

      const users = getAllUsers();
      const user = users.find(u => 
        u.username.toLowerCase() === input || 
        (u.email && u.email.toLowerCase() === input)
      );

      if (!user) {
        showToast(`Account "${input}" not found. Please create an account!`, 'error');
        return;
      }

      setCurrentUser(user);
      closeAuthModal();
      loginForm.reset();
      showToast(`Welcome back, ${user.name || user.ign}!`, 'success');
    });
  }

  // Google Profile Completion Form
  if (gProfileForm) {
    gProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pendingGoogleUser) return;

      const username = document.getElementById('g-profile-username').value.trim().toLowerCase();
      const ign = document.getElementById('g-profile-ign').value.trim();
      const uid = document.getElementById('g-profile-uid').value.trim();
      const phone = document.getElementById('g-profile-phone').value.trim();

      if (!username || !ign || !uid || !phone) {
        showToast('Please fill all profile fields!', 'error');
        return;
      }

      const payload = {
        googleId: pendingGoogleUser.sub || pendingGoogleUser.email,
        name: pendingGoogleUser.name,
        email: pendingGoogleUser.email,
        photoUrl: pendingGoogleUser.picture || '',
        username,
        ign,
        uid,
        phone
      };

      try {
        const res = await fetch(`${API_BASE}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.user) {
          const users = getAllUsers();
          users.push(data.user);
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
          setCurrentUser(data.user);
          closeGoogleProfileModal();
          showToast(`Google account linked! Welcome @${data.user.username}`, 'success');
          return;
        }
      } catch (err) {
        // Fallback local registration
        const newUser = {
          id: `u_g_${Date.now()}`,
          username,
          name: pendingGoogleUser.name,
          email: pendingGoogleUser.email,
          photoUrl: pendingGoogleUser.picture || '',
          ign,
          uid,
          phone,
          authProvider: 'google',
          role: 'Player',
          registeredAt: new Date().toISOString().split('T')[0]
        };

        const users = getAllUsers();
        users.push(newUser);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        setCurrentUser(newUser);
        closeGoogleProfileModal();
        showToast(`Google account linked! Welcome @${newUser.username}`, 'success');
      }
    });
  }

  updateAuthUI();
}

// ==================== FIREBASE REAL GOOGLE AUTH ====================
const firebaseConfig = {
  apiKey: "AIzaSyCS7uEh8f4OGucyV1msLrIAnYPZ4l_AxSI",
  authDomain: "insane-power-esports.firebaseapp.com",
  projectId: "insane-power-esports",
  storageBucket: "insane-power-esports.firebasestorage.app",
  messagingSenderId: "772945508588",
  appId: "1:772945508588:web:d7d3d948af5aa6482e0dc9",
  measurementId: "G-XJPS3823JR"
};

let firebaseApp = null;
let firebaseAuth = null;
let googleAuthProvider = null;

function initGoogleAuth() {
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }
      firebaseAuth = firebase.auth();
      googleAuthProvider = new firebase.auth.GoogleAuthProvider();
      googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
      console.log('⚡ Firebase Auth initialized successfully for Insane Power Esports');
    }
  } catch (err) {
    console.error('Firebase Auth init error:', err);
  }
}

// Google Sign-In Button Click Handler (Real Firebase Popup)
window.handleGoogleSignInClick = async function() {
  closeAuthModal();

  if (typeof firebase !== 'undefined' && firebaseAuth && googleAuthProvider) {
    try {
      showToast('Opening Google Sign-In...', 'info');
      const result = await firebaseAuth.signInWithPopup(googleAuthProvider);
      const user = result.user;
      
      const payload = {
        email: (user.email || '').toLowerCase().trim(),
        name: user.displayName || user.email.split('@')[0],
        photoUrl: user.photoURL || '',
        googleId: user.uid
      };
      
      await handleGoogleUserPayload(payload);
      return;
    } catch (err) {
      console.error('Firebase Google Sign-In error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        showToast('Google Sign-In was cancelled', 'info');
        return;
      }
      if (err.code === 'auth/configuration-not-found') {
        showToast('Google Sign-In not enabled yet in Firebase. Enable it in Authentication > Sign-in method!', 'error');
        promptCustomGoogleLogin();
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        showToast('Domain not authorized in Firebase Console (Authentication > Settings > Authorized domains)', 'error');
        promptCustomGoogleLogin();
        return;
      }
      showToast(err.message || 'Google Sign-In failed', 'error');
      return;
    }
  }

  // Fallback if offline or Firebase not loaded
  promptCustomGoogleLogin();
};

function promptCustomGoogleLogin() {
  const email = prompt("Enter your Google Account Email to continue with Google:", "player@gmail.com");
  if (!email || !email.includes('@')) {
    if (email !== null) showToast("Valid email is required for Google Sign-In", "error");
    return;
  }
  const name = prompt("Enter your Name:", email.split('@')[0].toUpperCase());
  if (!name) return;

  handleGoogleUserPayload({
    email: email.trim().toLowerCase(),
    name: name.trim(),
    googleId: `g_${Date.now()}`,
    photoUrl: ""
  });
}

async function handleGoogleUserPayload(googleUser) {
  const email = googleUser.email.trim().toLowerCase();

  // Try backend API registration/login
  try {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(googleUser)
    });
    const data = await res.json();

    if (data.success) {
      if (data.needsProfileCompletion) {
        pendingGoogleUser = { ...googleUser, ...data };
        const userEl = document.getElementById('g-profile-username');
        if (userEl) userEl.value = data.suggestedUsername || email.split('@')[0];
        openGoogleProfileModal();
        return;
      }

      setCurrentUser(data.user);
      closeAuthModal();
      showToast(`Welcome, ${data.user.name || data.user.ign}!`, 'success');
      return;
    }
  } catch (err) {
    console.error('Backend Google Auth error:', err);
  }

  // Local fallback
  const users = getAllUsers();
  let user = users.find(u => u.email && u.email.toLowerCase() === email);

  if (user) {
    setCurrentUser(user);
    closeAuthModal();
    showToast(`Welcome back, ${user.name || user.ign}!`, 'success');
    return;
  }

  // Check if organizer email
  if (email === 'akshithreddypalvai2005@gmail.com' || _authorizedAdminEmails.includes(email)) {
    const adminUser = {
      id: `u_admin_${Date.now()}`,
      username: email.split('@')[0],
      name: googleUser.name || 'Akshith Reddy',
      email: email,
      ign: 'IP・ADMIN',
      uid: '1000000001',
      phone: '+91 98765 00000',
      authProvider: 'google',
      role: 'Organizer / Head Admin',
      createdAt: new Date().toISOString()
    };
    users.push(adminUser);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    setCurrentUser(adminUser);
    closeAuthModal();
    showToast(`Welcome Organizer!`, 'success');
    return;
  }

  // New Google user needs to specify Free Fire IGN and UID
  pendingGoogleUser = googleUser;
  const suggestedUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 15);
  const userEl = document.getElementById('g-profile-username');
  if (userEl) userEl.value = suggestedUsername;
  openGoogleProfileModal();
}

function openGoogleProfileModal() {
  const modal = document.getElementById('google-profile-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeGoogleProfileModal() {
  const modal = document.getElementById('google-profile-modal');
  if (modal) modal.classList.add('hidden');
  pendingGoogleUser = null;
}

function updateAuthUI() {
  const user = getCurrentUser();
  const authBtnContainer = document.getElementById('header-auth-container');
  const mobileAuthContainer = document.getElementById('mobile-auth-container');
  const adminBadge = isCurrentUserAdmin()
    ? `<span class="bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] font-tech font-bold px-1.5 py-0.5 rounded ml-1">ADMIN</span>`
    : '';

  if (authBtnContainer) {
    if (user) {
      authBtnContainer.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="px-3 py-1.5 bg-slate-900 border border-amber-500/30 rounded-lg flex items-center gap-2 shadow-sm">
            <span class="w-2 h-2 rounded-full ${isCurrentUserAdmin() ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}"></span>
            <div class="text-left">
              <div class="flex items-center">
                <span class="text-xs font-tech font-bold text-amber-400 leading-tight">@${user.username}</span>
                ${adminBadge}
              </div>
              <span class="text-[11px] text-slate-300 font-heading block leading-none font-semibold">${user.ign || user.name}</span>
            </div>
          </div>
          <button onclick="logoutUser()" class="text-slate-400 hover:text-red-400 text-xs font-tech px-2.5 py-2 border border-slate-800 rounded-lg bg-slate-900/80" title="Logout">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      `;
    } else {
      authBtnContainer.innerHTML = `
        <button onclick="openAuthModal()" class="btn-esports-secondary px-3.5 py-2 rounded-lg text-xs font-heading font-bold flex items-center gap-2">
          <i class="fa-solid fa-user-plus text-amber-400"></i> Player Login / Sign Up
        </button>
      `;
    }
  }

  if (mobileAuthContainer) {
    if (user) {
      mobileAuthContainer.innerHTML = `
        <div class="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-amber-500/30">
          <div>
            <span class="text-xs font-tech font-bold text-amber-400 block">Logged in: @${user.username}</span>
            <span class="text-[11px] text-slate-300 block font-heading font-semibold">${user.ign} (UID: ${user.uid})</span>
          </div>
          <button onclick="logoutUser()" class="btn-esports-secondary px-3 py-1 rounded text-xs font-tech text-red-400 font-bold">
            Logout
          </button>
        </div>
      `;
    } else {
      mobileAuthContainer.innerHTML = `
        <button onclick="openAuthModal()" class="w-full btn-esports-secondary py-2.5 rounded-lg text-xs font-heading font-bold text-center">
          <i class="fa-solid fa-user-plus mr-1"></i> Player Login / Sign Up
        </button>
      `;
    }
  }

  // Toggle Admin Nav Button visibility: only show if user is authorized organizer
  const adminNav = document.getElementById('admin-nav-link');
  const mobileAdminNav = document.getElementById('mobile-admin-nav-link');
  const isAdm = isCurrentUserAdmin();

  if (adminNav) {
    if (isAdm) {
      adminNav.classList.remove('hidden');
    } else {
      adminNav.classList.add('hidden');
    }
  }

  if (mobileAdminNav) {
    if (isAdm) {
      mobileAdminNav.classList.remove('hidden');
    } else {
      mobileAdminNav.classList.add('hidden');
    }
  }

  // Toggle Room ID & Pass (IDP) button visibility: only registered players (or admin) can see it
  const idpNav = document.getElementById('nav-idp-link');
  const mobileIdpNav = document.getElementById('mobile-nav-idp-link');
  const footerIdpNav = document.getElementById('footer-idp-link');

  const allRegs = JSON.parse(localStorage.getItem(REGISTRATION_STORAGE_KEY) || '[]');
  const isRegisteredPlayer = user ? allRegs.some(r =>
    (r.iglUsername && r.iglUsername.toLowerCase() === user.username.toLowerCase()) ||
    (Array.isArray(r.players) && r.players.some(p => p.username && p.username.toLowerCase() === user.username.toLowerCase()))
  ) : false;
  const canSeeIdp = isRegisteredPlayer || isAdm;

  [idpNav, mobileIdpNav, footerIdpNav].forEach(el => {
    if (!el) return;
    if (canSeeIdp) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

function logoutUser() {
  setCurrentUser(null);
  showToast('Logged out successfully', 'info');
}

// ==================== SPA NAVIGATION ====================
function initNavigation() {
  const links = document.querySelectorAll('[data-route]');
  const sections = document.querySelectorAll('.page-section');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  function navigateTo(route) {
    sections.forEach(sec => {
      if (sec.id === `view-${route}`) {
        sec.classList.remove('hidden');
      } else {
        sec.classList.add('hidden');
      }
    });

    links.forEach(l => {
      if (l.dataset.route === route) {
        l.classList.add('active');
      } else {
        l.classList.remove('active');
      }
    });

    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
      mobileMenu.classList.add('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (route === 'register') renderSquadBuilder();
    if (route === 'idp') renderIdpPortal();
    if (route === 'leaderboard') renderLeaderboard();
    if (route === 'admin') renderAdminPortal();
  }

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.dataset.route;
      if (route) {
        navigateTo(route);
        history.pushState(null, null, `#${route}`);
      }
    });
  });

  const currentHash = window.location.hash.replace('#', '') || 'home';
  navigateTo(currentHash);

  window.addEventListener('popstate', () => {
    const hash = window.location.hash.replace('#', '') || 'home';
    navigateTo(hash);
  });
}

// ==================== 3D EFFECTS DISABLED ====================
function initThreeJS() {
  const container = document.getElementById('three-canvas-container');
  if (container) {
    container.innerHTML = '';
    container.style.display = 'none';
  }
}

function initParticlesFallback() {}
function initParticlesOnCanvas() {}
function initParticles() {}

function setupCard3DTilt() {
  // Clear any existing inline transforms on cards
  document.querySelectorAll('.card-3d').forEach(card => {
    card.style.transform = 'none';
  });
  document.querySelectorAll('.card-glare').forEach(glare => {
    glare.style.display = 'none';
  });
}


// ==================== MATCH COUNTDOWN ====================
function initCountdown() {
  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minsEl = document.getElementById('cd-mins');
  const secsEl = document.getElementById('cd-secs');

  if (!daysEl) return;

  function getNextWarDate() {
    const now = new Date();
    const resultDate = new Date();
    resultDate.setDate(now.getDate() + ((7 + 4 - now.getDay()) % 7 || 7));
    resultDate.setHours(18, 0, 0, 0);
    if (resultDate <= now) {
      resultDate.setDate(resultDate.getDate() + 7);
    }
    return resultDate;
  }

  const targetDate = getNextWarDate();

  function update() {
    const now = new Date().getTime();
    const diff = targetDate - now;

    if (diff <= 0) {
      daysEl.innerText = "00";
      hoursEl.innerText = "00";
      minsEl.innerText = "00";
      secsEl.innerText = "00";
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    daysEl.innerText = String(d).padStart(2, '0');
    hoursEl.innerText = String(h).padStart(2, '0');
    minsEl.innerText = String(m).padStart(2, '0');
    secsEl.innerText = String(s).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

// ==================== WEEKLY WARS CARD RENDERING ====================
function renderWeeklyWars() {
  const container = document.getElementById('weekly-wars-container');
  const warsListContainer = document.getElementById('wars-list-container');
  if (!container && !warsListContainer) return;

  // Use server count if available, otherwise localStorage
  const existingRegs = JSON.parse(localStorage.getItem(REGISTRATION_STORAGE_KEY) || '[]');
  const filledCount = _serverFilledSlots > 0 ? _serverFilledSlots : existingRegs.length;

  const html = IP_DATA.tournaments.map(t => {
    const totalSlots = t.totalSlots || 48;
    const fillPercent = Math.round((filledCount / totalSlots) * 100);

    return `
      <div class="glass-panel p-6 sm:p-8 relative overflow-hidden border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between">
        
        <div class="absolute top-0 right-0 bg-amber-500 text-black text-xs font-heading font-extrabold px-3 py-1 rounded-bl-lg tracking-wider uppercase">
          48 SLOTS (4 GROUPS)
        </div>

        <div>
          <div class="flex items-center gap-3 mb-4">
            <span class="px-3 py-1 text-xs font-tech font-bold uppercase rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <i class="fa-solid fa-fire text-red-500 mr-1"></i> ${t.game}
            </span>
            <span class="text-xs text-slate-400 font-tech">
              <i class="fa-regular fa-clock text-amber-400 mr-1"></i> 4 Match Days @ 6:00 PM IST
            </span>
          </div>

          <h3 class="text-2xl font-display font-extrabold text-white mb-2">
            ${t.title}
          </h3>

          <p class="text-slate-300 text-sm mb-4 leading-relaxed font-normal">
            ${t.description}
          </p>

          <!-- 4-Day Group Slot Division Matrix -->
          <div class="mb-6 space-y-2">
            <span class="text-xs font-tech text-amber-400 uppercase font-bold block">4-DAY GROUP ALLOCATION (12 SQUADS PER DAY):</span>
            <div class="grid grid-cols-2 gap-2 text-xs font-tech">
              <div class="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                <div class="text-amber-400 font-bold">DAY 1 (GROUP A)</div>
                <div class="text-slate-400 text-[11px]">Slots 1 - 12 (Thu)</div>
              </div>
              <div class="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                <div class="text-amber-400 font-bold">DAY 2 (GROUP B)</div>
                <div class="text-slate-400 text-[11px]">Slots 13 - 24 (Fri)</div>
              </div>
              <div class="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                <div class="text-amber-400 font-bold">DAY 3 (GROUP C)</div>
                <div class="text-slate-400 text-[11px]">Slots 25 - 36 (Sat)</div>
              </div>
              <div class="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                <div class="text-amber-400 font-bold">DAY 4 (GROUP D)</div>
                <div class="text-slate-400 text-[11px]">Slots 37 - 48 (Sun)</div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-6 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <div>
              <div class="text-xs text-slate-400 uppercase font-tech font-semibold">Prize Pool</div>
              <div class="text-xl font-heading font-extrabold text-amber-400">${t.prizePool}</div>
            </div>
            <div>
              <div class="text-xs text-slate-400 uppercase font-tech font-semibold">Entry Fee</div>
              <div class="text-xl font-heading font-extrabold text-emerald-400">${t.entryFee}</div>
            </div>
          </div>
        </div>

        <div>
          <!-- Slot Capacity Bar -->
          <div class="mb-6 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
            <div class="flex justify-between text-xs font-tech font-semibold mb-2">
              <span class="text-slate-300">Booked: <strong class="text-white">${filledCount} / ${totalSlots} Slots</strong></span>
              <span class="${totalSlots - filledCount <= 5 ? 'text-red-400 font-bold' : 'text-amber-400 font-bold'}">
                ${totalSlots - filledCount} Slots Left
              </span>
            </div>
            <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
              <div class="bg-gradient-to-r from-amber-500 to-red-500 h-full rounded-full transition-all duration-500" style="width: ${fillPercent}%;"></div>
            </div>
          </div>

          <div class="flex gap-3">
            <button onclick="goToRegistration('${t.id}')" class="flex-1 btn-esports-primary py-3 px-4 rounded-lg font-heading font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2">
              <i class="fa-solid fa-crosshairs"></i> Register 12-Man Slot
            </button>
            <button onclick="openTournamentDetails('${t.id}')" class="btn-esports-secondary py-3 px-4 rounded-lg font-heading font-bold text-xs">
              <i class="fa-solid fa-circle-info mr-1"></i> Details
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (container) container.innerHTML = html;
  if (warsListContainer) warsListContainer.innerHTML = html;
}

function goToRegistration(tournamentId = '') {
  const sections = document.querySelectorAll('.page-section');
  sections.forEach(sec => {
    if (sec.id === 'view-register') {
      sec.classList.remove('hidden');
    } else {
      sec.classList.add('hidden');
    }
  });

  const links = document.querySelectorAll('[data-route]');
  links.forEach(l => {
    if (l.dataset.route === 'register') {
      l.classList.add('active');
    } else {
      l.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
  history.pushState(null, null, '#register');
  renderSquadBuilder();
}

// Tournament Details Modal
function openTournamentDetails(tournamentId) {
  const tourney = IP_DATA.tournaments.find(t => t.id === tournamentId) || IP_DATA.tournaments[0];
  if (!tourney) return;

  const modal = document.getElementById('tournament-details-modal');
  const modalContent = document.getElementById('tournament-modal-body');

  modalContent.innerHTML = `
    <div class="relative mb-6 rounded-xl overflow-hidden h-40">
      <img src="${tourney.bannerImage}" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
      <div class="absolute bottom-4 left-4 right-4 flex justify-between items-end">
        <div>
          <span class="px-2.5 py-1 text-xs font-tech font-bold uppercase rounded-md bg-amber-500 text-black">
            ${tourney.game}
          </span>
          <h2 class="text-xl font-heading font-extrabold text-white mt-1">${tourney.title}</h2>
        </div>
        <div class="text-right">
          <span class="text-xs text-slate-400 block font-tech font-semibold">PRIZE POOL</span>
          <span class="text-xl font-heading font-extrabold text-amber-400">${tourney.prizePool}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
      <div>
        <div class="text-xs text-slate-400 font-tech">TOTAL SLOTS</div>
        <div class="text-sm font-bold text-white">48 Squads</div>
      </div>
      <div>
        <div class="text-xs text-slate-400 font-tech">STRUCTURE</div>
        <div class="text-sm font-bold text-white">4 Days (12/Day)</div>
      </div>
      <div>
        <div class="text-xs text-slate-400 font-tech">ENTRY FEE</div>
        <div class="text-sm font-bold text-emerald-400">${tourney.entryFee}</div>
      </div>
      <div>
        <div class="text-xs text-slate-400 font-tech">GUN ATTR</div>
        <div class="text-sm font-bold text-red-400">OFF</div>
      </div>
    </div>

    <div class="mb-6 space-y-4">
      <div>
        <h4 class="text-sm font-heading font-bold text-amber-400 mb-2 uppercase tracking-wide">
          <i class="fa-solid fa-trophy mr-1.5"></i> Prize Distribution
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${tourney.prizeBreakdown.map(p => `
            <div class="flex justify-between items-center p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-tech">
              <span class="font-semibold text-slate-300">${p.rank}</span>
              <span class="font-bold text-amber-400">${p.prize}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <h4 class="text-sm font-heading font-bold text-amber-400 mb-2 uppercase tracking-wide">
          <i class="fa-solid fa-calendar-days mr-1.5"></i> 4-Day Group Breakdown
        </h4>
        <div class="grid grid-cols-2 gap-2 text-xs font-tech">
          ${tourney.groupSchedule.map(g => `
            <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span class="text-amber-400 font-bold block">${g.group} (${g.slots})</span>
              <span class="text-slate-400">${g.day}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-3 pt-4 border-t border-slate-800">
      <button onclick="closeTournamentModal()" class="px-5 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-heading font-bold text-xs">
        Close
      </button>
      <button onclick="closeTournamentModal(); goToRegistration('${tourney.id}')" class="btn-esports-primary px-6 py-2 rounded-lg font-heading font-bold text-xs">
        Proceed to Registration
      </button>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closeTournamentModal() {
  const modal = document.getElementById('tournament-details-modal');
  if (modal) modal.classList.add('hidden');
}

function setupModals() {
  const tModal = document.getElementById('tournament-details-modal');
  if (tModal) {
    tModal.addEventListener('click', (e) => {
      if (e.target === tModal) closeTournamentModal();
    });
  }

  const pModal = document.getElementById('pass-modal');
  if (pModal) {
    pModal.addEventListener('click', (e) => {
      if (e.target === pModal) closePassModal();
    });
  }

  const aModal = document.getElementById('auth-modal');
  if (aModal) {
    aModal.addEventListener('click', (e) => {
      if (e.target === aModal) closeAuthModal();
    });
  }
}

// ==================== SQUAD BUILDER & 48-SLOT REGISTRATION ====================
function renderSquadBuilder() {
  const container = document.getElementById('squad-builder-container');
  if (!container) return;

  const user = getCurrentUser();

  if (!user) {
    container.innerHTML = `
      <div class="glass-panel p-8 sm:p-12 text-center rounded-2xl border border-white/10">
        <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 text-xl">
          <i class="fa-solid fa-lock"></i>
        </div>
        <h3 class="font-display font-extrabold text-2xl text-white mb-2">CAPTAIN LOGIN REQUIRED</h3>
        <p class="text-slate-300 text-xs sm:text-sm max-w-md mx-auto mb-6">
          To register for Weekly Wars, every squad member must create an account first. The Captain will enter their registered usernames to form the permanent roster.
        </p>
        <button onclick="openAuthModal()" class="btn-esports-primary px-7 py-3 rounded-lg font-heading font-bold text-xs uppercase tracking-wider">
          <i class="fa-solid fa-user-plus mr-1.5"></i> Login / Sign Up As Captain
        </button>
      </div>
    `;
    return;
  }

  const allSquads = getAllSquads();
  const existingSquad = allSquads.find(s => s.iglUsername === user.username || s.players.some(p => p.username === user.username));

  if (existingSquad) {
    const registrations = JSON.parse(localStorage.getItem(REGISTRATION_STORAGE_KEY) || '[]');
    const myRegistration = registrations.find(r => r.squadId === existingSquad.squadId && r.tourneyId === 'ww-ff-12');

    container.innerHTML = `
      <div class="glass-panel p-6 sm:p-8 rounded-2xl border border-amber-500/30">
        
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-4 mb-6">
          <div>
            <span class="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-tech font-bold uppercase border border-emerald-500/40">
              <i class="fa-solid fa-shield-halved mr-1"></i> VERIFIED PERMANENT SQUAD
            </span>
            <h3 class="font-display font-black text-2xl sm:text-3xl text-white mt-1">${existingSquad.teamName} <span class="text-amber-400">[${existingSquad.teamTag}]</span></h3>
            <span class="text-xs font-tech text-slate-400">Created by Captain @${existingSquad.iglUsername}</span>
          </div>

          <div class="mt-3 sm:mt-0">
            ${myRegistration ? `
              <div class="text-right">
                <span class="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-tech font-bold uppercase border border-emerald-500/40 block">
                  <i class="fa-solid fa-circle-check mr-1"></i> REGISTERED: SLOT #${myRegistration.slotNumber}
                </span>
                <span class="text-[11px] font-tech text-amber-300 block mt-1">${myRegistration.group}</span>
              </div>
            ` : `
              <span class="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-tech font-bold uppercase border border-amber-500/40">
                READY FOR REGISTRATION (48 SLOTS)
              </span>
            `}
          </div>
        </div>

        <div class="mb-8">
          <span class="text-xs font-tech text-slate-400 uppercase tracking-wider block mb-3 font-semibold">LOCKED SQUAD ROSTER (${existingSquad.players.length} PLAYERS)</span>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            ${existingSquad.players.map((p, idx) => `
              <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-tech text-amber-400 uppercase font-bold block">${idx === 0 ? 'IGL / CAPTAIN' : p.role}</span>
                  <h5 class="font-heading font-bold text-white text-sm leading-tight">${p.ign}</h5>
                  <span class="text-xs font-tech text-slate-400">@${p.username}</span>
                </div>
                <div class="text-right">
                  <span class="text-[10px] font-tech text-slate-500 block">UID</span>
                  <span class="text-xs font-tech font-bold text-slate-300">${p.uid}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="bg-slate-950/80 p-5 rounded-xl border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h4 class="font-heading font-bold text-base text-white">Free Fire MAX Weekly Wars - Season 12</h4>
            <p class="text-xs text-slate-400 font-tech">48 Total Slots (12 Squads per Day) &bull; Line-wise Slot Booking &bull; Entry: 100% Free</p>
          </div>

          <div class="flex gap-2">
            ${myRegistration ? `
              <button onclick="viewExistingPass('${existingSquad.squadId}')" class="btn-esports-primary px-5 py-2.5 rounded-lg font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <i class="fa-solid fa-ticket"></i> View Pass
              </button>
              <a href="#idp" data-route="idp" class="btn-esports-secondary px-4 py-2.5 rounded-lg font-heading font-bold text-xs uppercase flex items-center gap-2">
                <i class="fa-solid fa-key text-amber-400"></i> Go To IDP
              </a>
            ` : `
              <button onclick="registerPermanentSquad('${existingSquad.squadId}', 'ww-ff-12')" class="btn-esports-primary px-6 py-3 rounded-lg font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <i class="fa-solid fa-bolt"></i> 1-Click Register Squad
              </button>
            `}
          </div>
        </div>

      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="glass-panel p-6 sm:p-8 rounded-2xl border border-amber-500/30">
      
      <div class="border-b border-white/10 pb-4 mb-6">
        <span class="text-xs font-tech text-amber-400 uppercase tracking-widest font-bold">CAPTAIN SQUAD BUILDER</span>
        <h3 class="font-display font-black text-2xl sm:text-3xl text-white">FORM YOUR <span class="text-amber-400">PERMANENT SQUAD</span></h3>
        <p class="text-xs text-slate-300 mt-1">
          Every player must be registered on this website. Enter your teammates' registered usernames (@username) to fetch their verified Free Fire IGN and UID. Once formed, this squad will be permanently locked and can be reused for all 48-slot Weekly Wars tournaments.
        </p>
      </div>

      <form id="create-squad-form" class="space-y-5">
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Squad / Guild Name <span class="text-red-500">*</span></label>
            <input type="text" id="squad-team-name" required placeholder="e.g. INSANE FORCE" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
          </div>
          <div>
            <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Squad Tag <span class="text-red-500">*</span></label>
            <input type="text" id="squad-team-tag" required placeholder="e.g. INF" maxlength="5" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech uppercase focus:border-amber-400 focus:outline-none">
          </div>
        </div>

        <div class="bg-slate-900/90 p-3.5 rounded-xl border border-amber-500/30">
          <span class="text-[10px] font-tech text-amber-400 uppercase font-bold block mb-1">CAPTAIN (IGL) - LOGGED IN</span>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-tech">
            <div>
              <span class="text-slate-500">Username:</span>
              <strong class="text-white block">@${user.username}</strong>
            </div>
            <div>
              <span class="text-slate-500">Free Fire IGN:</span>
              <strong class="text-amber-300 block">${user.ign}</strong>
            </div>
            <div>
              <span class="text-slate-500">Free Fire UID:</span>
              <strong class="text-slate-300 block">${user.uid}</strong>
            </div>
          </div>
        </div>

        <div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Player 2 Username <span class="text-red-500">*</span></label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-slate-500 text-xs font-tech">@</span>
            <input type="text" id="p2-username" required placeholder="viper_sniper" oninput="validatePlayerInput('p2', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
          </div>
          <div id="p2-status" class="mt-1.5 text-xs font-tech text-slate-400">
            <span class="text-slate-500">Type registered username (e.g. viper_sniper)</span>
          </div>
        </div>

        <div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Player 3 Username <span class="text-red-500">*</span></label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-slate-500 text-xs font-tech">@</span>
            <input type="text" id="p3-username" required placeholder="blaze_rusher" oninput="validatePlayerInput('p3', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
          </div>
          <div id="p3-status" class="mt-1.5 text-xs font-tech text-slate-400">
            <span class="text-slate-500">Type registered username</span>
          </div>
        </div>

        <div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Player 4 Username <span class="text-red-500">*</span></label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-slate-500 text-xs font-tech">@</span>
            <input type="text" id="p4-username" required placeholder="shadow_ff" oninput="validatePlayerInput('p4', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
          </div>
          <div id="p4-status" class="mt-1.5 text-xs font-tech text-slate-400">
            <span class="text-slate-500">Type registered username</span>
          </div>
        </div>

        <div class="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/80">
          <label class="block text-xs font-tech text-slate-400 uppercase mb-1">5th Player (Substitute) Username (Optional)</label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-slate-500 text-xs font-tech">@</span>
            <input type="text" id="p5-username" placeholder="cyborg_sub" oninput="validatePlayerInput('p5', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
          </div>
          <div id="p5-status" class="mt-1.5 text-xs font-tech text-slate-400">
            <span class="text-slate-500">Optional 5th player username</span>
          </div>
        </div>

        <button type="submit" class="w-full btn-esports-primary py-3.5 rounded-lg font-heading font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
          <i class="fa-solid fa-lock"></i> Create & Lock Permanent Squad
        </button>

      </form>

    </div>
  `;

  const squadForm = document.getElementById('create-squad-form');
  if (squadForm) {
    squadForm.addEventListener('submit', handleCreatePermanentSquad);
  }
}

// Live Validation of Player Username
window.validatePlayerInput = async function(prefix, username) {
  const statusEl = document.getElementById(`${prefix}-status`);
  if (!statusEl) return;

  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser) {
    statusEl.innerHTML = `<span class="text-slate-500">Type registered username</span>`;
    return;
  }

  const currentUser = getCurrentUser();
  if (currentUser && currentUser.username.toLowerCase() === cleanUser) {
    statusEl.innerHTML = `<span class="text-red-400 font-bold"><i class="fa-solid fa-circle-xmark"></i> Cannot add captain's own username as teammate!</span>`;
    return;
  }

  // Try API search
  let player = null;
  try {
    const res = await fetch(`${API_BASE}/users/search?username=${encodeURIComponent(cleanUser)}`);
    const data = await res.json();
    if (data.success && data.user) {
      player = data.user;
    }
  } catch (err) {
    // Local fallback
    const users = getAllUsers();
    player = users.find(u => u.username.toLowerCase() === cleanUser);
  }

  if (!player) {
    statusEl.innerHTML = `
      <span class="text-red-400 font-semibold flex items-center gap-1.5">
        <i class="fa-solid fa-circle-xmark"></i> User @${cleanUser} is not registered on the website. They must sign up first!
      </span>
    `;
    return;
  }

  const allSquads = getAllSquads();
  const alreadyInSquad = allSquads.find(s => s.players.some(p => p.username.toLowerCase() === cleanUser));
  if (alreadyInSquad) {
    statusEl.innerHTML = `
      <span class="text-red-400 font-semibold flex items-center gap-1.5">
        <i class="fa-solid fa-lock"></i> @${cleanUser} is already locked to squad "${alreadyInSquad.teamName}"!
      </span>
    `;
    return;
  }

  statusEl.innerHTML = `
    <div class="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-500/30">
      <i class="fa-solid fa-circle-check"></i>
      <span>Verified: <strong>${player.ign}</strong> (UID: ${player.uid})</span>
    </div>
  `;
};

// Handle Permanent Squad Creation
async function handleCreatePermanentSquad(e) {
  e.preventDefault();

  const user = getCurrentUser();
  if (!user) {
    showToast('Please login as Captain first!', 'error');
    return;
  }

  const teamName = document.getElementById('squad-team-name').value.trim();
  const teamTag = document.getElementById('squad-team-tag').value.trim().toUpperCase();
  const p2User = document.getElementById('p2-username').value.trim().toLowerCase();
  const p3User = document.getElementById('p3-username').value.trim().toLowerCase();
  const p4User = document.getElementById('p4-username').value.trim().toLowerCase();
  const p5User = document.getElementById('p5-username')?.value.trim().toLowerCase();

  const users = getAllUsers();
  const p2 = users.find(u => u.username.toLowerCase() === p2User);
  const p3 = users.find(u => u.username.toLowerCase() === p3User);
  const p4 = users.find(u => u.username.toLowerCase() === p4User);
  const p5 = p5User ? users.find(u => u.username.toLowerCase() === p5User) : null;

  if (!p2 || !p3 || !p4) {
    showToast('Please verify all 3 mandatory squad teammates are registered users!', 'error');
    return;
  }

  const usernames = [user.username.toLowerCase(), p2User, p3User, p4User, ...(p5User ? [p5User] : [])];
  const uniqueUsers = new Set(usernames);
  if (uniqueUsers.size !== usernames.length) {
    showToast('Duplicate players detected! All players must be distinct registered users.', 'error');
    return;
  }

  const payload = {
    teamName,
    teamTag,
    iglUsername: user.username,
    playerUsernames: [p2User, p3User, p4User, ...(p5User ? [p5User] : [])]
  };

  try {
    const res = await fetch(`${API_BASE}/squads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success && data.squad) {
      const allSquads = getAllSquads();
      allSquads.push(data.squad);
      localStorage.setItem(SQUADS_STORAGE_KEY, JSON.stringify(allSquads));
      showToast(`Permanent Squad "${teamName}" created and locked successfully!`, 'success');
      renderSquadBuilder();
      return;
    } else {
      showToast(data.message || 'Error creating squad', 'error');
      return;
    }
  } catch (err) {
    // Local fallback
    const newSquad = {
      squadId: `SQ-${Date.now().toString().slice(-6)}`,
      teamName,
      teamTag,
      iglUsername: user.username,
      captainPhone: user.phone,
      createdAt: new Date().toLocaleDateString(),
      players: [
        { role: 'Captain / IGL', username: user.username, ign: user.ign, uid: user.uid, phone: user.phone },
        { role: 'Player 2', username: p2.username, ign: p2.ign, uid: p2.uid, phone: p2.phone },
        { role: 'Player 3', username: p3.username, ign: p3.ign, uid: p3.uid, phone: p3.phone },
        { role: 'Player 4', username: p4.username, ign: p4.ign, uid: p4.uid, phone: p4.phone },
        ...(p5 ? [{ role: 'Substitute', username: p5.username, ign: p5.ign, uid: p5.uid, phone: p5.phone }] : [])
      ]
    };

    const allSquads = getAllSquads();
    allSquads.push(newSquad);
    localStorage.setItem(SQUADS_STORAGE_KEY, JSON.stringify(allSquads));

    showToast(`Permanent Squad "${teamName}" created and locked successfully!`, 'success');
    renderSquadBuilder();
  }
}

// 48-Slot Line-wise Tournament Registration (12 Squads per Day)
window.registerPermanentSquad = async function(squadId, tourneyId) {
  const allSquads = getAllSquads();
  const squad = allSquads.find(s => s.squadId === squadId);
  const tourney = IP_DATA.tournaments.find(t => t.id === tourneyId) || IP_DATA.tournaments[0];

  if (!squad) return;

  const existingRegs = JSON.parse(localStorage.getItem(REGISTRATION_STORAGE_KEY) || '[]');
  const isAlreadyReg = existingRegs.some(r => r.squadId === squadId && r.tourneyId === tourney.id);

  if (isAlreadyReg) {
    showToast('Your squad is already registered for this tournament!', 'info');
    return;
  }

  if (existingRegs.length >= 48) {
    showToast('All 48 slots are completely FULL for Season 12!', 'error');
    return;
  }

  // Try API first
  try {
    const res = await fetch(`${API_BASE}/tournaments/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squadId, tourneyId: tourney.id })
    });
    const data = await res.json();
    if (data.success && data.registration) {
      existingRegs.push(data.registration);
      localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(existingRegs));
      tourney.filledSlots = Math.min(tourney.totalSlots, existingRegs.length);
      renderWeeklyWars();
      renderSquadBuilder();
      renderIdpPortal();
      updateAuthUI();
      showToast(`Registered! Slot #${data.registration.slotNumber} assigned to ${squad.teamName}`, 'success');
      renderPassModal(data.registration);
      return;
    }
  } catch (err) {
    // Local fallback
  }

  const assignedSlot = existingRegs.length + 1;
  const registrationId = `FF-${Date.now().toString().slice(-6)}`;

  let assignedGroup = "";
  let groupIndex = 1;
  let matchDaySchedule = "";

  if (assignedSlot <= 12) {
    assignedGroup = "Day 1 - Group A (Slots 1-12)";
    groupIndex = 1;
    matchDaySchedule = "Thursday @ 6:00 PM IST";
  } else if (assignedSlot <= 24) {
    assignedGroup = "Day 2 - Group B (Slots 13-24)";
    groupIndex = 2;
    matchDaySchedule = "Friday @ 6:00 PM IST";
  } else if (assignedSlot <= 36) {
    assignedGroup = "Day 3 - Group C (Slots 25-36)";
    groupIndex = 3;
    matchDaySchedule = "Saturday @ 6:00 PM IST";
  } else {
    assignedGroup = "Day 4 - Group D (Slots 37-48)";
    groupIndex = 4;
    matchDaySchedule = "Sunday @ 6:00 PM IST";
  }

  const newReg = {
    regId: registrationId,
    squadId: squad.squadId,
    tourneyId: tourney.id,
    tourneyName: tourney.title,
    game: tourney.game,
    teamName: squad.teamName,
    teamTag: squad.teamTag,
    iglUsername: squad.iglUsername,
    captainName: squad.players[0].ign,
    captainIgn: squad.players[0].ign,
    captainUid: squad.players[0].uid,
    captainPhone: squad.captainPhone,
    players: squad.players,
    slotNumber: assignedSlot,
    group: assignedGroup,
    groupIndex: groupIndex,
    matchDay: matchDaySchedule,
    registeredAt: new Date().toLocaleString(),
    status: 'CONFIRMED'
  };

  existingRegs.push(newReg);
  localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(existingRegs));

  tourney.filledSlots = Math.min(tourney.totalSlots, existingRegs.length);
  renderWeeklyWars();
  renderSquadBuilder();
  renderIdpPortal();
  updateAuthUI();

  showToast(`Registered! Slot #${assignedSlot} assigned to ${squad.teamName} [${assignedGroup}]`, 'success');
  renderPassModal(newReg);
};

window.viewExistingPass = function(squadId) {
  const existingRegs = JSON.parse(localStorage.getItem(REGISTRATION_STORAGE_KEY) || '[]');
  const reg = existingRegs.find(r => r.squadId === squadId);
  if (reg) {
    renderPassModal(reg);
  } else {
    showToast('No pass found for this squad.', 'error');
  }
};

// ==================== DAY-SPECIFIC IDP PORTAL ====================
function renderIdpPortal() {
  const container = document.getElementById('idp-portal-container');
  if (!container) return;

  const idp = getIdpSettings();
  const user = getCurrentUser();
  const allRegs = JSON.parse(localStorage.getItem(REGISTRATION_STORAGE_KEY) || '[]');

  const activeDaySquads = allRegs.filter(r => r.groupIndex === idp.activeDay);

  const dayNames = {
    1: "Day 1 - Group A (Slots 1-12)",
    2: "Day 2 - Group B (Slots 13-24)",
    3: "Day 3 - Group C (Slots 25-36)",
    4: "Day 4 - Group D (Slots 37-48)"
  };

  const activeDayTitle = dayNames[idp.activeDay] || `Day ${idp.activeDay}`;

  let userReg = null;
  let isEligibleToday = false;

  if (user) {
    userReg = allRegs.find(r => r.iglUsername === user.username || r.players.some(p => p.username === user.username));
    if (userReg && userReg.groupIndex === idp.activeDay) {
      isEligibleToday = true;
    }
  }

  container.innerHTML = `
    <!-- Active Match Day Banner -->
    <div class="glass-panel p-6 sm:p-8 rounded-2xl border border-amber-500/30 mb-8 relative overflow-hidden">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 mb-6">
        <div>
          <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 text-red-400 text-xs font-tech font-bold uppercase border border-red-500/40">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span> TODAY'S ACTIVE MATCH LOBBY
          </span>
          <h2 class="font-display font-extrabold text-3xl text-white mt-1">FREE FIRE <span class="text-amber-400">ROOM ID & PASSWORD</span></h2>
          <p class="text-xs text-slate-300 font-tech mt-1">
            Active Schedule: <strong class="text-amber-400">${activeDayTitle}</strong> | Match Time: <strong>${idp.matchTime}</strong>
          </p>
        </div>

        <div class="text-left md:text-right">
          <span class="text-xs font-tech text-slate-400 uppercase block font-semibold">SECURITY STATUS</span>
          <span class="px-3 py-1 rounded-lg ${idp.isReleased ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'} text-xs font-tech font-bold uppercase inline-block mt-1">
            ${idp.isReleased ? 'CREDENTIALS RELEASED' : 'PENDING 15-MIN RELEASE'}
          </span>
        </div>
      </div>

      <!-- IDP CREDENTIALS BOX -->
      ${!user ? `
        <div class="bg-slate-900/90 p-8 rounded-xl border border-slate-800 text-center">
          <i class="fa-solid fa-lock text-3xl text-amber-400 mb-2"></i>
          <h4 class="font-heading font-bold text-lg text-white mb-1">CAPTAIN LOGIN REQUIRED</h4>
          <p class="text-xs text-slate-400 max-w-md mx-auto mb-4 font-tech">
            Custom room ID & Password are only accessible by the 12 verified Captains of today's scheduled group.
          </p>
          <button onclick="openAuthModal()" class="btn-esports-primary px-6 py-2.5 rounded-lg font-heading font-bold text-xs uppercase">
            Login As Captain
          </button>
        </div>
      ` : !userReg ? `
        <div class="bg-slate-900/90 p-8 rounded-xl border border-slate-800 text-center">
          <i class="fa-solid fa-ban text-3xl text-red-400 mb-2"></i>
          <h4 class="font-heading font-bold text-lg text-white mb-1">SQUAD NOT REGISTERED</h4>
          <p class="text-xs text-slate-400 max-w-md mx-auto mb-4 font-tech">
            You are logged in as @${user.username}, but your squad is not registered for Free Fire Weekly Wars Season 12.
          </p>
          <a href="#register" data-route="register" class="btn-esports-primary px-6 py-2.5 rounded-lg font-heading font-bold text-xs uppercase inline-block">
            Register Your Squad Now
          </a>
        </div>
      ` : isEligibleToday ? `
        <div class="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 p-6 sm:p-8 rounded-xl border border-emerald-500/50 shadow-2xl">
          <div class="flex items-center gap-3 text-emerald-400 font-tech font-bold text-xs uppercase mb-4">
            <i class="fa-solid fa-circle-check text-base"></i>
            <span>ACCESS GRANTED: Captain of "${userReg.teamName}" (Assigned Slot #${userReg.slotNumber})</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div class="bg-slate-950 p-5 rounded-xl border border-amber-500/40 text-center">
              <span class="text-xs font-tech text-slate-400 uppercase tracking-widest block mb-1">CUSTOM ROOM ID</span>
              <div class="text-3xl sm:text-4xl font-display font-black text-amber-400 tracking-wider my-2" id="idp-room-id">${idp.roomId || '8492019'}</div>
              <button onclick="copyToClipboard('${idp.roomId || '8492019'}', 'Room ID copied!')" class="btn-esports-secondary px-4 py-1.5 rounded-md text-xs font-tech font-bold uppercase inline-flex items-center gap-1.5">
                <i class="fa-solid fa-copy text-amber-400"></i> Copy Room ID
              </button>
            </div>

            <div class="bg-slate-950 p-5 rounded-xl border border-amber-500/40 text-center">
              <span class="text-xs font-tech text-slate-400 uppercase tracking-widest block mb-1">ROOM PASSWORD</span>
              <div class="text-3xl sm:text-4xl font-display font-black text-white tracking-wider my-2" id="idp-room-pass">${idp.roomPass || 'IP777'}</div>
              <button onclick="copyToClipboard('${idp.roomPass || 'IP777'}', 'Password copied!')" class="btn-esports-secondary px-4 py-1.5 rounded-md text-xs font-tech font-bold uppercase inline-flex items-center gap-1.5">
                <i class="fa-solid fa-copy text-amber-400"></i> Copy Password
              </button>
            </div>
          </div>

          <div class="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs font-tech text-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span class="text-amber-400 font-bold block mb-0.5">SLOT DISCIPLINE:</span>
              <span>You must sit strictly in <strong>Slot #${userReg.slotNumber}</strong> with your 4 verified players. Gun Attributes are OFF.</span>
            </div>
            <a href="https://chat.whatsapp.com/invite/sample" target="_blank" class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors flex items-center gap-1.5 text-xs">
              <i class="fa-brands fa-whatsapp"></i> WhatsApp Slot Group
            </a>
          </div>
        </div>
      ` : `
        <div class="bg-slate-900/90 p-8 rounded-xl border border-red-500/30 text-center">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-red-600/20 border border-red-500 flex items-center justify-center text-red-400 text-xl">
            <i class="fa-solid fa-lock"></i>
          </div>
          <h4 class="font-heading font-bold text-xl text-white mb-1">ACCESS LOCKED — NOT YOUR MATCH DAY</h4>
          <p class="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed mb-4 font-tech">
            Your squad <strong class="text-amber-400">"${userReg.teamName}"</strong> is scheduled for <strong class="text-white">${userReg.group}</strong> (${userReg.matchDay}).
            <br>
            Today's custom room credentials are strictly accessible only by the 12 Captains of <strong class="text-amber-400">${activeDayTitle}</strong>. Your IDP will unlock on your match day!
          </p>
          <div class="inline-flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 text-xs font-tech text-slate-400">
            <i class="fa-regular fa-calendar-check text-amber-400"></i>
            <span>Your Assigned Slot: <strong class="text-white">#${userReg.slotNumber}</strong> | Match Day: <strong class="text-white">${userReg.matchDay}</strong></span>
          </div>
        </div>
      `}
    </div>

    <!-- Today's 12 Registered Squads List -->
    <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
      <div class="p-4 bg-slate-900/90 border-b border-white/10 flex justify-between items-center">
        <div>
          <h3 class="font-heading font-bold text-sm text-white">Today's 12 Squads: ${activeDayTitle}</h3>
          <span class="text-xs font-tech text-slate-400">Authorized squads in today's custom room</span>
        </div>
        <span class="text-xs font-tech text-amber-400 font-bold">${activeDaySquads.length}/12 Slots Filled</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-950 text-xs font-tech text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th class="py-3 px-4">SLOT</th>
              <th class="py-3 px-4">TEAM NAME</th>
              <th class="py-3 px-4">CAPTAIN IGN</th>
              <th class="py-3 px-4">IGL USERNAME</th>
              <th class="py-3 px-4">STATUS</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 font-tech text-xs">
            ${activeDaySquads.length === 0 ? `
              <tr>
                <td colspan="5" class="py-8 text-center text-slate-500 font-tech">No squads registered in this group yet.</td>
              </tr>
            ` : activeDaySquads.map(s => `
              <tr class="border-b border-slate-800/80 hover:bg-slate-900/50">
                <td class="py-3 px-4 font-bold text-amber-400">#${s.slotNumber}</td>
                <td class="py-3 px-4 font-heading font-bold text-white text-sm">${s.teamName} <span class="text-slate-500 font-normal">(${s.teamTag})</span></td>
                <td class="py-3 px-4 text-slate-200">${s.captainIgn}</td>
                <td class="py-3 px-4 text-amber-400">@${s.iglUsername}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/40">
                    MATCH READY
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.copyToClipboard = function(text, successMsg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg || 'Copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
};

// ==================== MATCH PASS MODAL ====================
function renderPassModal(reg) {
  const modal = document.getElementById('pass-modal');
  const body = document.getElementById('pass-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div id="printable-pass" class="pass-ticket p-6 rounded-2xl relative overflow-hidden text-left border-2 border-amber-500 shadow-2xl">
      <div class="flex justify-between items-start border-b border-white/10 pb-4 mb-4">
        <div class="flex items-center gap-3">
          <img src="assets/images/logo.png" alt="Insane Power Esports" class="w-12 h-12 object-contain">
          <div>
            <h3 class="font-display font-extrabold text-xl text-amber-400">INSANE POWER ESPORTS</h3>
            <span class="text-xs font-tech text-slate-400">OFFICIAL 48-SLOT WEEKLY WAR MATCH PASS</span>
          </div>
        </div>
        <div class="text-right">
          <span class="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-tech font-bold uppercase rounded-md border border-emerald-500/40">
            ${reg.status}
          </span>
          <div class="text-xs font-tech text-slate-400 mt-1">PASS ID: <strong class="text-white">${reg.regId}</strong></div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="md:col-span-2 space-y-3">
          <div>
            <span class="text-xs text-slate-400 font-tech uppercase">EVENT</span>
            <div class="text-base font-heading font-extrabold text-white">${reg.tourneyName}</div>
          </div>

          <div class="grid grid-cols-2 gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <div>
              <span class="text-xs text-slate-400 font-tech uppercase">TEAM NAME</span>
              <div class="text-sm font-heading font-bold text-amber-300">${reg.teamName} [${reg.teamTag}]</div>
            </div>
            <div>
              <span class="text-xs text-slate-400 font-tech uppercase">SCHEDULED MATCH DAY</span>
              <div class="text-sm font-heading font-bold text-slate-200">${reg.matchDay}</div>
            </div>
          </div>

          <div>
            <span class="text-xs text-slate-400 font-tech uppercase block mb-1">VERIFIED FREE FIRE ROSTER</span>
            <div class="grid grid-cols-2 gap-1.5 text-xs text-slate-300 font-tech">
              ${reg.players.map(p => `
                <div class="bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800/80 flex justify-between">
                  <span>${p.ign} (@${p.username})</span>
                  <span class="text-amber-400 font-semibold">${p.uid}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="bg-slate-950/90 p-4 rounded-xl border border-amber-500/30 flex flex-col items-center justify-center text-center">
          <div class="text-xs font-tech text-slate-400 uppercase font-semibold">ASSIGNED SLOT</div>
          <div class="text-4xl font-display font-black text-amber-400 my-1">#${reg.slotNumber}</div>
          <div class="text-xs font-tech font-bold text-amber-200 px-2 py-0.5 bg-amber-500/20 rounded-md border border-amber-500/30 mb-3">
            ${reg.group}
          </div>

          <div class="bg-white p-2 rounded-lg shadow-md mb-2">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=IP-FF-WAR-${reg.regId}-SLOT${reg.slotNumber}" alt="Pass QR" class="w-16 h-16">
          </div>
          <span class="text-[10px] text-slate-400 font-tech">SCAN FOR ENTRY</span>
        </div>
      </div>

      <div class="bg-amber-500/10 border-l-4 border-amber-400 p-3 rounded-lg text-xs text-slate-300 mb-6 font-tech">
        <p class="font-bold text-amber-300 mb-0.5"><i class="fa-solid fa-bell mr-1"></i> ID & PASSWORD RELEASE NOTICE:</p>
        <p>Your Room ID & Password will unlock on the website's IDP page 15 minutes before your group's match time (${reg.matchDay}). Sit strictly in Slot #${reg.slotNumber}.</p>
      </div>

      <div class="flex flex-wrap gap-3 justify-between items-center pt-2 border-t border-slate-800">
        <a href="https://chat.whatsapp.com/invite/sample" target="_blank" class="px-4 py-2 rounded-lg text-xs font-heading font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30 flex items-center gap-2">
          <i class="fa-brands fa-whatsapp text-emerald-400"></i> Join WhatsApp Slot Group
        </a>
        <button onclick="window.print()" class="btn-esports-primary px-5 py-2 rounded-lg text-xs font-heading font-bold flex items-center gap-2">
          <i class="fa-solid fa-print"></i> Print / Download Pass
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closePassModal() {
  const modal = document.getElementById('pass-modal');
  if (modal) modal.classList.add('hidden');
}

// ==================== POINTS TABLE / LEADERBOARD ====================
function renderLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;

  const savedStandings = JSON.parse(localStorage.getItem(STANDINGS_STORAGE_KEY) || 'null');
  const isPublished = savedStandings ? savedStandings.isPublished : IP_DATA.leaderboards.isPublished;
  const standings = savedStandings ? savedStandings.standings : IP_DATA.leaderboards.standings;
  const mvp = savedStandings ? savedStandings.mvp : IP_DATA.leaderboards.mvp;
  const imageUrl = savedStandings?.imageUrl || null;
  const season = savedStandings?.season || "FREE FIRE WEEKLY WARS - SEASON 12 FINALS";

  if (!isPublished || (!imageUrl && (!standings || standings.length === 0))) {
    container.innerHTML = `
      <div class="glass-panel p-12 text-center rounded-2xl border border-white/10">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl">
          <i class="fa-solid fa-clock-rotate-left"></i>
        </div>
        <h3 class="font-display font-extrabold text-2xl text-white mb-2">POINTS TABLE WILL BE UPLOADED AFTER MATCHES</h3>
        <p class="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
          Matches for the current weekly cycle are underway. Official standings, Booyahs, Kill Points, and the tournament MVP leaderboard will be published right here after all 4 match days conclude.
        </p>
        <div class="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs font-tech text-amber-400">
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span>Scoring Standard: Official Free Fire Esports Rulebook</span>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <!-- HEADER -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
      <div>
        <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-tech font-bold uppercase border border-amber-500/40">
          <i class="fa-solid fa-trophy"></i> OFFICIAL STANDINGS
        </span>
        <h2 class="font-display font-black text-2xl sm:text-3xl text-white mt-1">${season}</h2>
      </div>
      ${imageUrl ? `
        <div class="flex items-center gap-2">
          <a href="${imageUrl}" target="_blank" download="InsanePower_PointsTable.png" class="btn-esports-secondary px-4 py-2 rounded-lg text-xs font-tech font-bold uppercase inline-flex items-center gap-1.5 shadow-md">
            <i class="fa-solid fa-download text-amber-400"></i> Download
          </a>
          <a href="${imageUrl}" target="_blank" class="btn-esports-primary px-4 py-2 rounded-lg text-xs font-tech font-bold uppercase inline-flex items-center gap-1.5 shadow-md">
            <i class="fa-solid fa-expand"></i> View Fullscreen
          </a>
        </div>
      ` : ''}
    </div>

    ${imageUrl ? `
      <!-- UPLOADED POINTS TABLE IMAGE GRAPHIC -->
      <div class="glass-panel p-4 sm:p-6 rounded-2xl border border-amber-500/40 mb-8 shadow-2xl relative overflow-hidden bg-slate-950/80">
        <div class="flex items-center justify-between text-xs font-tech text-amber-400 uppercase font-bold mb-3 px-1">
          <span class="flex items-center gap-1.5">
            <i class="fa-solid fa-circle-check text-emerald-400"></i> OFFICIAL MATCH RESULT SCOREBOARD
          </span>
          <span class="text-slate-400 text-[11px] font-normal hidden sm:inline">Click image to open high-resolution view</span>
        </div>
        <a href="${imageUrl}" target="_blank" class="block cursor-zoom-in group rounded-xl overflow-hidden border border-slate-800 bg-black/90 hover:border-amber-500/50 transition-colors">
          <img src="${imageUrl}" alt="Official Points Table" class="w-full h-auto object-contain rounded-xl max-h-[850px] mx-auto group-hover:scale-[1.005] transition-transform duration-300">
        </a>
      </div>
    ` : ''}

    ${mvp ? `
      <div class="glass-panel p-6 border border-amber-500/30 rounded-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-full border-2 border-amber-400 p-1 bg-slate-900 overflow-hidden relative">
            <img src="assets/images/logo.png" alt="${mvp.name || mvp.ign}" class="w-full h-full object-contain rounded-full">
            <div class="absolute bottom-0 right-0 bg-amber-400 text-black text-[9px] font-black px-1 rounded-full font-tech">MVP</div>
          </div>
          <div>
            <span class="text-xs font-tech text-amber-400 uppercase tracking-widest block font-bold">WEEKLY WAR TOURNAMENT MVP</span>
            <h3 class="text-xl font-heading font-extrabold text-white">${mvp.name || mvp.ign}</h3>
            <span class="text-xs font-tech text-slate-400">${mvp.team}</span>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-3 text-center bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-800">
          <div>
            <span class="text-[10px] text-slate-400 font-tech">KILLS</span>
            <div class="text-base font-heading font-extrabold text-amber-400">${mvp.kills}</div>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 font-tech">DAMAGE</span>
            <div class="text-base font-heading font-extrabold text-slate-100">${mvp.damage}</div>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 font-tech">MATCHES</span>
            <div class="text-base font-heading font-extrabold text-slate-100">${mvp.matches || 4}</div>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 font-tech">RATING</span>
            <div class="text-base font-heading font-extrabold text-emerald-400">${mvp.rating || '9.8'}</div>
          </div>
        </div>
      </div>
    ` : ''}

    ${standings && standings.length > 0 ? `
      <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-950 text-xs font-tech text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th class="py-3.5 px-4 text-center">RANK</th>
                <th class="py-3.5 px-4">TEAM NAME</th>
                <th class="py-3.5 px-4 text-center">MATCHES</th>
                <th class="py-3.5 px-4 text-center">BOOYAHS</th>
                <th class="py-3.5 px-4 text-center">PLACE PTS</th>
                <th class="py-3.5 px-4 text-center">KILL PTS</th>
                <th class="py-3.5 px-4 text-center">TOTAL PTS</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-tech text-xs">
              ${standings.map(s => {
                let rankBadge = `<span class="font-tech font-bold text-slate-400">#${s.rank}</span>`;
                let rowClass = "leaderboard-row";

                if (s.rank === 1) {
                  rankBadge = `<span class="w-6 h-6 rounded-full bg-amber-400 text-black font-tech font-extrabold inline-flex items-center justify-center">1</span>`;
                  rowClass += " rank-1";
                } else if (s.rank === 2) {
                  rankBadge = `<span class="w-6 h-6 rounded-full bg-slate-300 text-black font-tech font-extrabold inline-flex items-center justify-center">2</span>`;
                  rowClass += " rank-2";
                } else if (s.rank === 3) {
                  rankBadge = `<span class="w-6 h-6 rounded-full bg-amber-700 text-white font-tech font-extrabold inline-flex items-center justify-center">3</span>`;
                  rowClass += " rank-3";
                }

                return `
                  <tr class="${rowClass}">
                    <td class="py-3 px-4 text-center">${rankBadge}</td>
                    <td class="py-3 px-4 font-heading font-bold text-slate-100 text-sm">
                      ${s.team}
                    </td>
                    <td class="py-3 px-4 text-center text-slate-300">${s.matches}</td>
                    <td class="py-3 px-4 text-center text-amber-400 font-bold">${s.booyahs || 0}</td>
                    <td class="py-3 px-4 text-center text-slate-300">${s.placePts}</td>
                    <td class="py-3 px-4 text-center text-slate-300">${s.killPts}</td>
                    <td class="py-3 px-4 text-center font-extrabold text-amber-400 text-sm bg-slate-900/30">${s.totalPts}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

// ==================== RULES & FAQS ====================
function renderFaqs() {
  const container = document.getElementById('faqs-container');
  if (!container) return;

  container.innerHTML = IP_DATA.faqs.map((faq, idx) => `
    <div class="glass-panel rounded-xl border border-white/10 p-4 transition-all">
      <button class="w-full flex justify-between items-center text-left font-heading font-bold text-sm text-slate-200 hover:text-amber-400" onclick="toggleFaq(${idx})">
        <span>${faq.q}</span>
        <i id="faq-icon-${idx}" class="fa-solid fa-chevron-down text-xs text-amber-400 transition-transform duration-300"></i>
      </button>
      <div id="faq-ans-${idx}" class="hidden mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 font-tech leading-relaxed">
        ${faq.a}
      </div>
    </div>
  `).join('');
}

function toggleFaq(idx) {
  const ans = document.getElementById(`faq-ans-${idx}`);
  const icon = document.getElementById(`faq-icon-${idx}`);
  if (ans.classList.contains('hidden')) {
    ans.classList.remove('hidden');
    icon.classList.add('rotate-180');
  } else {
    ans.classList.add('hidden');
    icon.classList.remove('rotate-180');
  }
}

// ==================== AUTHORIZED ADMIN EMAIL HELPERS ====================
function isCurrentUserAdmin() {
  const user = getCurrentUser();
  if (!user || !user.email) return false;
  const userEmail = user.email.trim().toLowerCase();
  return _authorizedAdminEmails.map(e => e.toLowerCase()).includes(userEmail);
}

window.quickAdminLogin = function() {
  const users = getAllUsers();
  let adminUser = users.find(u => u.email && u.email.toLowerCase() === 'akshithreddypalvai2005@gmail.com');
  if (!adminUser) {
    adminUser = {
      id: "u_admin_1",
      username: "akshith_admin",
      name: "Akshith Reddy",
      email: "akshithreddypalvai2005@gmail.com",
      ign: "IP・AKSHITH",
      uid: "1000000001",
      phone: "+91 98765 00000",
      authProvider: "google",
      role: "Organizer / Head Admin",
      createdAt: new Date().toISOString()
    };
    users.push(adminUser);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }
  setCurrentUser(adminUser);
  showToast('Logged in as Head Organizer (akshithreddypalvai2005@gmail.com)', 'success');
  renderAdminPortal();
};

window.handleAddAdminEmail = async function() {
  const input = document.getElementById('new-admin-email-input');
  if (!input) return;
  const newEmail = input.value.trim().toLowerCase();
  if (!newEmail || !newEmail.includes('@') || !newEmail.includes('.')) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  const currentUser = getCurrentUser();
  try {
    const res = await fetch(`${API_BASE}/admin/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Email': currentUser?.email || 'akshithreddypalvai2005@gmail.com'
      },
      body: JSON.stringify({ newEmail, adminEmail: currentUser?.email })
    });
    const data = await res.json();
    if (data.success) {
      _authorizedAdminEmails = data.emails;
      input.value = '';
      showToast(`Admin access granted to ${newEmail}!`, 'success');
      renderAdminPortal();
    } else {
      showToast(data.message || 'Failed to add admin email', 'error');
    }
  } catch (err) {
    if (!_authorizedAdminEmails.includes(newEmail)) {
      _authorizedAdminEmails.push(newEmail);
      showToast(`Admin access added to ${newEmail}`, 'success');
      renderAdminPortal();
    }
  }
};

window.handleRemoveAdminEmail = async function(emailToRemove) {
  if (emailToRemove.toLowerCase() === 'akshithreddypalvai2005@gmail.com') {
    showToast('Cannot remove the primary organizer email', 'error');
    return;
  }
  if (!confirm(`Are you sure you want to revoke admin access for ${emailToRemove}?`)) {
    return;
  }

  const currentUser = getCurrentUser();
  try {
    const res = await fetch(`${API_BASE}/admin/emails/${encodeURIComponent(emailToRemove)}`, {
      method: 'DELETE',
      headers: {
        'X-Admin-Email': currentUser?.email || 'akshithreddypalvai2005@gmail.com'
      }
    });
    const data = await res.json();
    if (data.success) {
      _authorizedAdminEmails = data.emails;
      showToast(`Admin access revoked for ${emailToRemove}`, 'info');
      renderAdminPortal();
    }
  } catch (err) {
    _authorizedAdminEmails = _authorizedAdminEmails.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());
    renderAdminPortal();
  }
};

// ==================== ADMIN / ORGANIZER PORTAL ====================
function renderAdminPortal() {
  const container = document.getElementById('admin-view-container');
  if (!container) return;

  const user = getCurrentUser();
  const isAdmin = isCurrentUserAdmin();

  if (!isAdmin) {
    // Show ACCESS RESTRICTED SCREEN
    container.innerHTML = `
      <div class="glass-panel p-8 sm:p-12 text-center rounded-2xl border border-red-500/40 max-w-xl mx-auto my-8">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 text-2xl">
          <i class="fa-solid fa-user-shield"></i>
        </div>
        <span class="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[11px] font-tech font-bold uppercase tracking-wider">
          Restricted Organizer Portal
        </span>
        <h2 class="font-display font-extrabold text-2xl sm:text-3xl text-white mt-3 mb-2">
          ADMIN ACCESS RESTRICTED
        </h2>
        <p class="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
          This Control Center is strictly confidential and reserved for official tournament organizers with authorized email addresses.
        </p>

        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-tech text-left mb-6">
          <span class="text-slate-400 uppercase text-[10px] block font-semibold mb-2">AUTHORIZED ORGANIZER EMAILS:</span>
          <div class="flex flex-wrap gap-2">
            ${_authorizedAdminEmails.map(e => `
              <span class="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold flex items-center gap-1.5">
                <i class="fa-solid fa-envelope text-[10px]"></i> ${e}
              </span>
            `).join('')}
          </div>
        </div>

        ${user ? `
          <div class="bg-red-950/40 border border-red-500/40 p-3 rounded-lg text-xs font-tech text-red-300 mb-6">
            Currently logged in as: <strong>@${user.username}</strong> (${user.email || 'No email registered'}).
            <br>This account is not on the authorized organizer email list.
          </div>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button onclick="openAuthModal()" class="btn-esports-primary px-6 py-2.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider">
              <i class="fa-solid fa-right-to-bracket mr-1.5"></i> Switch To Organizer Account
            </button>
            <button onclick="logoutUser()" class="btn-esports-secondary px-5 py-2.5 rounded-lg text-xs font-heading font-bold uppercase">
              Logout
            </button>
          </div>
        ` : `
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button onclick="handleGoogleSignInClick()" class="btn-google py-2.5 px-5 flex items-center justify-center gap-2 text-xs font-bold uppercase">
              <svg class="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Sign In with Google
            </button>
            <button onclick="quickAdminLogin()" class="btn-esports-primary px-5 py-2.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-key"></i> Organizer Login (akshith)
            </button>
          </div>
        `}
      </div>
    `;
    return;
  }

  // User IS an authorized organizer! Render full admin suite:
  container.innerHTML = `
    <div class="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <span class="text-xs font-tech text-emerald-400 uppercase font-bold tracking-widest flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          VERIFIED ORGANIZER ACCESS
        </span>
        <h1 class="font-display font-black text-3xl text-white mt-1">
          ADMIN <span class="text-amber-400">CONTROL CENTER</span>
        </h1>
        <p class="text-xs text-slate-400 font-tech mt-1">
          Logged in as: <strong class="text-white">${user.name || user.username}</strong> (<strong class="text-amber-400">${user.email}</strong>)
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span class="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-tech font-bold">
          <i class="fa-solid fa-shield-check mr-1"></i> HEAD ADMIN
        </span>
        <button onclick="logoutUser()" class="btn-esports-secondary px-3 py-1.5 rounded-lg text-xs font-tech text-red-400 hover:text-red-300">
          Logout
        </button>
      </div>
    </div>

    <div class="space-y-8">

      <!-- CARD 1: MANAGE AUTHORIZED ADMIN EMAILS -->
      <div class="glass-panel p-6 sm:p-8 rounded-2xl border border-amber-500/40">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-display font-bold text-xl text-white flex items-center gap-2">
            <i class="fa-solid fa-envelope-circle-check text-amber-400"></i> Authorized Organizer Emails
          </h3>
          <span class="text-xs font-tech text-slate-400">${_authorizedAdminEmails.length} Authorized</span>
        </div>
        <p class="text-xs text-slate-400 mb-5">
          Only users logging in with the email addresses below can view or control this Admin window. You can add more admin emails anytime.
        </p>

        <!-- Current Emails List -->
        <div class="flex flex-wrap gap-2.5 mb-6">
          ${_authorizedAdminEmails.map(e => `
            <div class="bg-slate-900 border ${e.toLowerCase() === 'akshithreddypalvai2005@gmail.com' ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700'} px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-tech">
              <i class="fa-solid fa-envelope ${e.toLowerCase() === 'akshithreddypalvai2005@gmail.com' ? 'text-amber-400' : 'text-slate-400'}"></i>
              <span class="font-bold ${e.toLowerCase() === 'akshithreddypalvai2005@gmail.com' ? 'text-amber-300' : 'text-slate-200'}">${e}</span>
              ${e.toLowerCase() === 'akshithreddypalvai2005@gmail.com' ? `
                <span class="text-[9px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-bold uppercase">Primary</span>
              ` : `
                <button onclick="handleRemoveAdminEmail('${e}')" class="text-slate-500 hover:text-red-400 transition-colors ml-1" title="Revoke Admin Access">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              `}
            </div>
          `).join('')}
        </div>

        <!-- Add Email Form -->
        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <label class="block text-xs font-tech text-slate-400 uppercase mb-2">
            <i class="fa-solid fa-user-plus mr-1 text-amber-400"></i> Grant Admin Access to Another Email
          </label>
          <div class="flex flex-col sm:flex-row gap-2">
            <input type="email" id="new-admin-email-input" placeholder="e.g. co-organizer@gmail.com"
              class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
            <button onclick="handleAddAdminEmail()" class="btn-esports-primary px-5 py-2 rounded-lg text-xs font-heading font-bold uppercase tracking-wider whitespace-nowrap">
              + Add Admin Email
            </button>
          </div>
        </div>
      </div>

      <!-- CARD 2: IDP DISPATCH -->
      <div class="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10">
        <h3 class="font-display font-bold text-xl text-white mb-2">
          <i class="fa-solid fa-key text-amber-400 mr-2"></i> Day-Wise Room ID & Password Dispatch
        </h3>
        <p class="text-xs text-slate-400 mb-6 font-normal">
          Select which match day is active today and enter the Custom Room ID and Password. Only the 12 Captains assigned to the active day will receive access.
        </p>

        <form id="admin-idp-form" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Active Match Day</label>
              <select id="admin-idp-day" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
                <option value="1">Day 1 - Group A (Slots 1 to 12)</option>
                <option value="2">Day 2 - Group B (Slots 13 to 24)</option>
                <option value="3">Day 3 - Group C (Slots 25 to 36)</option>
                <option value="4">Day 4 - Group D (Slots 37 to 48)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Scheduled Match Time</label>
              <input type="text" id="admin-idp-time" placeholder="e.g. 6:00 PM IST" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Custom Room ID</label>
              <input type="text" id="admin-idp-room" placeholder="e.g. 8492019" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Custom Room Password</label>
              <input type="text" id="admin-idp-pass" placeholder="e.g. IP777" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
            </div>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <input type="checkbox" id="admin-idp-release" class="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900">
            <label for="admin-idp-release" class="text-xs font-tech text-slate-300">Release ID & Password Immediately to Active 12 Captains</label>
          </div>

          <button type="submit" class="btn-esports-primary py-3 px-6 rounded-lg font-heading font-bold text-xs uppercase tracking-wider">
            Save & Update Day IDP
          </button>
        </form>
      </div>

      <!-- CARD 3: POINTS TABLE -->
      <div class="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10">
        <h3 class="font-display font-bold text-xl text-white mb-2">
          <i class="fa-solid fa-trophy text-amber-400 mr-2"></i> Post-Match Points Table Upload
        </h3>
        <p class="text-xs text-slate-400 mb-6 font-normal">
          Upload the points table graphic/image or enter standings after today's 12-squad matches conclude.
        </p>

        <form id="admin-points-form" class="space-y-4">
          <div>
            <label class="block text-xs font-tech text-slate-400 uppercase mb-1">Tournament Edition Title</label>
            <input type="text" id="admin-points-season" placeholder="e.g. FREE FIRE WEEKLY WARS - SEASON 12 FINALS" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
          </div>

          <!-- POINTS TABLE IMAGE UPLOAD SECTION -->
          <div class="p-4 rounded-xl border-2 border-dashed border-amber-500/40 bg-slate-950/70 hover:border-amber-400 transition-colors" id="admin-points-dropzone">
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-tech text-amber-400 uppercase font-bold">
                <i class="fa-solid fa-image mr-1.5"></i> Upload Points Table Image
              </label>
              <span class="text-[10px] font-tech text-slate-400 uppercase">PNG, JPG, WEBP</span>
            </div>
            <p class="text-xs text-slate-400 mb-3 font-normal">
              Select or drop your points table image graphic. It will be published live in high definition on the official Points Table page!
            </p>

            <div class="flex flex-wrap items-center gap-3">
              <label for="admin-points-image-input" class="cursor-pointer btn-esports-primary px-4 py-2.5 rounded-lg text-xs font-heading font-bold uppercase inline-flex items-center gap-2">
                <i class="fa-solid fa-cloud-arrow-up text-sm"></i> Choose Image File
                <input type="file" id="admin-points-image-input" accept="image/*" class="hidden">
              </label>
              <button type="button" id="admin-points-image-clear-btn" class="hidden btn-esports-secondary px-3.5 py-2 rounded-lg text-xs font-tech text-red-400 font-bold uppercase inline-flex items-center gap-1.5">
                <i class="fa-solid fa-trash-can"></i> Remove Image
              </button>
              <span id="admin-points-image-status" class="text-xs font-tech text-slate-400">No image selected</span>
            </div>

            <!-- Image Preview Box -->
            <div id="admin-points-image-preview-container" class="hidden mt-4 pt-3 border-t border-slate-800">
              <div class="text-[11px] font-tech text-slate-400 mb-2 flex items-center justify-between">
                <span><i class="fa-solid fa-eye text-amber-400 mr-1"></i> Image Preview:</span>
                <span id="admin-points-image-dimensions" class="text-amber-400 font-bold"></span>
              </div>
              <div class="rounded-lg overflow-hidden border border-amber-500/30 bg-black/80 max-h-80 flex items-center justify-center p-2">
                <img id="admin-points-image-preview" src="" alt="Points Table Preview" class="max-h-72 w-auto object-contain rounded shadow-lg">
              </div>
            </div>
          </div>

          <div class="pt-1">
            <span class="text-xs font-tech text-slate-400 uppercase font-bold block mb-2">
              <i class="fa-solid fa-star text-amber-400 mr-1"></i> Optional MVP & Additional Details
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-tech text-slate-400 uppercase mb-1">MVP Player IGN (Optional)</label>
              <input type="text" id="admin-points-mvp-ign" placeholder="e.g. IP・THUNDER" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-tech text-slate-400 uppercase mb-1">MVP Team Name (Optional)</label>
              <input type="text" id="admin-points-mvp-team" placeholder="e.g. TOTAL DOMINANCE" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-tech text-slate-400 uppercase mb-1">MVP Total Kills (Optional)</label>
              <input type="number" id="admin-points-mvp-kills" placeholder="e.g. 24" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-tech text-slate-400 uppercase mb-1">MVP Total Damage (Optional)</label>
              <input type="text" id="admin-points-mvp-damage" placeholder="e.g. 4,850" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-tech focus:border-amber-400 focus:outline-none">
            </div>
          </div>

          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="block text-xs font-tech text-slate-400 uppercase">
                Squad Standings Data (Optional CSV Format)
              </label>
              <span class="text-[10px] text-amber-400 font-tech">Format: TeamName, Matches, Booyahs, PlacePts, KillPts, TotalPts</span>
            </div>
            <textarea id="admin-points-raw-data" rows="4" placeholder="Optional if image is uploaded above. E.g.:&#10;TOTAL DOMINANCE, 4, 2, 28, 36, 64&#10;GODLIKE SQUAD, 4, 1, 22, 30, 52" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"></textarea>
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" class="btn-esports-primary py-3 px-6 rounded-lg font-heading font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
              <i class="fa-solid fa-cloud-arrow-up"></i> Publish Points Table Live
            </button>
            <button type="button" id="admin-points-clear-live-btn" class="btn-esports-secondary py-3 px-5 rounded-lg font-heading font-bold text-xs uppercase tracking-wider text-red-400 hover:text-white hover:bg-red-600/30 border border-red-500/40 flex items-center justify-center gap-2">
              <i class="fa-solid fa-trash-can"></i> Remove / Reset Live Points Table
            </button>
          </div>
        </form>
      </div>

    </div>
  `;

  attachAdminFormListeners();
}

// Attach event listeners for Admin IDP and Points forms
function attachAdminFormListeners() {
  const idpForm = document.getElementById('admin-idp-form');
  const pointsForm = document.getElementById('admin-points-form');

  if (idpForm) {
    const currentIdp = getIdpSettings();
    const daySelect = document.getElementById('admin-idp-day');
    const timeInput = document.getElementById('admin-idp-time');
    const roomInput = document.getElementById('admin-idp-room');
    const passInput = document.getElementById('admin-idp-pass');
    const releaseCheckbox = document.getElementById('admin-idp-release');

    if (daySelect) daySelect.value = currentIdp.activeDay || 1;
    if (timeInput) timeInput.value = currentIdp.matchTime || '6:00 PM IST';
    if (roomInput) roomInput.value = currentIdp.roomId || '';
    if (passInput) passInput.value = currentIdp.roomPass || '';
    if (releaseCheckbox) releaseCheckbox.checked = currentIdp.isReleased || false;

    idpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const activeDay = parseInt(daySelect.value);
      const matchTime = timeInput.value.trim();
      const roomId = roomInput.value.trim();
      const roomPass = passInput.value.trim();
      const isReleased = releaseCheckbox.checked;

      const user = getCurrentUser();
      const updated = {
        activeDay,
        matchTime,
        roomId,
        roomPass,
        isReleased,
        adminEmail: user?.email || 'akshithreddypalvai2005@gmail.com'
      };

      try {
        const res = await fetch(`${API_BASE}/admin/idp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Email': user?.email || 'akshithreddypalvai2005@gmail.com'
          },
          body: JSON.stringify(updated)
        });
        const data = await res.json();
        if (!data.success) {
          showToast(data.message || 'Admin auth failed', 'error');
          return;
        }
      } catch (err) {}

      localStorage.setItem(IDP_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      renderIdpPortal();
      showToast(`IDP Settings updated! Day ${activeDay} credentials are live.`, 'success');
    });
  }

  if (pointsForm) {
    let uploadedPointsTableImage = "";
    const savedStandings = JSON.parse(localStorage.getItem(STANDINGS_STORAGE_KEY) || 'null');
    const imageInput = document.getElementById('admin-points-image-input');
    const previewContainer = document.getElementById('admin-points-image-preview-container');
    const previewImg = document.getElementById('admin-points-image-preview');
    const statusText = document.getElementById('admin-points-image-status');
    const clearBtn = document.getElementById('admin-points-image-clear-btn');
    const dimText = document.getElementById('admin-points-image-dimensions');
    const dropzone = document.getElementById('admin-points-dropzone');
    const seasonInput = document.getElementById('admin-points-season');
    const ignInput = document.getElementById('admin-points-mvp-ign');
    const teamInput = document.getElementById('admin-points-mvp-team');
    const killsInput = document.getElementById('admin-points-mvp-kills');
    const damageInput = document.getElementById('admin-points-mvp-damage');

    // Prepopulate existing data if present
    if (savedStandings) {
      if (seasonInput && savedStandings.season) seasonInput.value = savedStandings.season;
      if (savedStandings.mvp) {
        if (ignInput) ignInput.value = savedStandings.mvp.ign || savedStandings.mvp.name || '';
        if (teamInput) teamInput.value = savedStandings.mvp.team || '';
        if (killsInput) killsInput.value = savedStandings.mvp.kills || '';
        if (damageInput) damageInput.value = savedStandings.mvp.damage || '';
      }
      if (savedStandings.imageUrl) {
        uploadedPointsTableImage = savedStandings.imageUrl;
        if (previewImg) previewImg.src = uploadedPointsTableImage;
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (clearBtn) clearBtn.classList.remove('hidden');
        if (statusText) statusText.innerHTML = `<span class="text-amber-400 font-bold"><i class="fa-solid fa-image"></i> Current Live Image</span>`;
        if (previewImg) {
          previewImg.onload = () => {
            if (dimText) dimText.textContent = `${previewImg.naturalWidth} x ${previewImg.naturalHeight}px`;
          };
        }
      }
    }

    function handleImageFile(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file (PNG, JPG, WEBP)!', 'error');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        showToast('Image size exceeds 25MB limit. Please choose a smaller file.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        uploadedPointsTableImage = evt.target.result;
        if (previewImg) previewImg.src = uploadedPointsTableImage;
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (clearBtn) clearBtn.classList.remove('hidden');
        if (statusText) statusText.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fa-solid fa-circle-check"></i> ${file.name}</span>`;
        if (previewImg) {
          previewImg.onload = () => {
            if (dimText) dimText.textContent = `${previewImg.naturalWidth} x ${previewImg.naturalHeight}px`;
          };
        }
        showToast('Points table image loaded successfully!', 'success');
      };
      reader.readAsDataURL(file);
    }

    if (imageInput) {
      imageInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        handleImageFile(file);
      });
    }

    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('border-amber-400', 'bg-slate-900/90');
        }, false);
      });
      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('border-amber-400', 'bg-slate-900/90');
        }, false);
      });
      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt && dt.files && dt.files[0];
        handleImageFile(file);
      }, false);
    }

    async function clearAndUnpublishPointsTable() {
      uploadedPointsTableImage = "";
      if (imageInput) imageInput.value = "";
      if (previewContainer) previewContainer.classList.add('hidden');
      if (clearBtn) clearBtn.classList.add('hidden');
      if (statusText) statusText.textContent = "No image selected";
      if (seasonInput) seasonInput.value = "";
      if (ignInput) ignInput.value = "";
      if (teamInput) teamInput.value = "";
      if (killsInput) killsInput.value = "";
      if (damageInput) damageInput.value = "";
      const rawEl = document.getElementById('admin-points-raw-data');
      if (rawEl) rawEl.value = "";

      const user = getCurrentUser();
      const cleared = {
        season: 'FREE FIRE WEEKLY WARS - SEASON 12 FINALS',
        isPublished: false,
        imageUrl: null,
        mvp: null,
        standings: [],
        adminEmail: user?.email || 'akshithreddypalvai2005@gmail.com'
      };

      try {
        await fetch(`${API_BASE}/admin/leaderboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Email': user?.email || 'akshithreddypalvai2005@gmail.com'
          },
          body: JSON.stringify(cleared)
        });
      } catch (err) {}

      localStorage.setItem(STANDINGS_STORAGE_KEY, JSON.stringify(cleared));
      renderLeaderboard();
      showToast('Points Table removed! Live table has been reset.', 'info');
    }

    const clearLiveBtn = document.getElementById('admin-points-clear-live-btn');
    if (clearLiveBtn) {
      clearLiveBtn.addEventListener('click', async () => {
        await clearAndUnpublishPointsTable();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        uploadedPointsTableImage = "";
        if (imageInput) imageInput.value = "";
        if (previewContainer) previewContainer.classList.add('hidden');
        if (clearBtn) clearBtn.classList.add('hidden');
        if (statusText) statusText.textContent = "No image selected";

        // Immediately update live table if an image was currently published
        const cur = JSON.parse(localStorage.getItem(STANDINGS_STORAGE_KEY) || 'null');
        if (cur && cur.imageUrl) {
          await clearAndUnpublishPointsTable();
        } else {
          showToast('Image removed from form', 'info');
        }
      });
    }

    pointsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const season = (seasonInput && seasonInput.value.trim()) || 'FREE FIRE WEEKLY WARS - SEASON 12 FINALS';
      const ign = ignInput ? ignInput.value.trim() : '';
      const team = teamInput ? teamInput.value.trim() : '';
      const kills = killsInput ? killsInput.value.trim() : '';
      const damage = damageInput ? damageInput.value.trim() : '';
      const raw = document.getElementById('admin-points-raw-data')?.value.trim() || '';

      const user = getCurrentUser();

      let standings = [];
      if (raw) {
        const lines = raw.split('\n');
        lines.forEach((line, idx) => {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            standings.push({
              rank: idx + 1,
              team: parts[0],
              matches: parseInt(parts[1]) || 4,
              booyahs: parseInt(parts[2]) || 0,
              placePts: parseInt(parts[3]) || 0,
              killPts: parseInt(parts[4]) || 0,
              totalPts: parseInt(parts[5]) || ((parseInt(parts[3]) || 0) + (parseInt(parts[4]) || 0))
            });
          }
        });
      }

      if (!uploadedPointsTableImage && standings.length === 0) {
        await clearAndUnpublishPointsTable();
        return;
      }

      const published = {
        season,
        isPublished: true,
        imageUrl: uploadedPointsTableImage || null,
        mvp: ign ? { ign, name: ign, team, kills, damage, matches: 4, rating: '9.8' } : null,
        standings,
        adminEmail: user?.email || 'akshithreddypalvai2005@gmail.com'
      };

      try {
        const res = await fetch(`${API_BASE}/admin/leaderboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Email': user?.email || 'akshithreddypalvai2005@gmail.com'
          },
          body: JSON.stringify(published)
        });
        const data = await res.json();
        if (!data.success) {
          showToast(data.message || 'Admin auth failed', 'error');
          return;
        }
      } catch (err) {}

      localStorage.setItem(STANDINGS_STORAGE_KEY, JSON.stringify(published));
      renderLeaderboard();
      showToast('Points Table successfully published live!', 'success');
    });
  }
}

// Keep initAdminPortal as alias for compatibility
function initAdminPortal() {
  renderAdminPortal();
}
