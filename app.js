const WebProfileSelector = (() => {
  const PROFILES_URL = 'https://realcoolclint.github.io/tranquility-core/profiles-public.json';
  // REPLACE: identifiant unique de l'app ex: 'ts_session_reviewer'
  const LS_KEY  = 'ts_session_rendezvous';
  // REPLACE: clé app dans appPermissions ex: 'reviewer'
  const APP_KEY = 'rendezvous';
  let _selectedProfile  = null;
  let _selectedDuration = '7days';

  function readSession() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s.expiresAt && new Date(s.expiresAt) < new Date()) {
        localStorage.removeItem(LS_KEY);
        return null;
      }
      return s;
    } catch(e) { return null; }
  }

  function writeSession(profile, durationChoice) {
    const expiresAt = (() => {
      if (durationChoice === 'always') return null;
      const d = new Date();
      if (durationChoice === 'today') d.setHours(23, 59, 59, 0);
      if (durationChoice === '7days') d.setDate(d.getDate() + 7);
      return d.toISOString();
    })();
    const session = {
      version:          2,
      writtenBy:        APP_KEY,
      writtenAt:        new Date().toISOString(),
      expiresAt,
      profileId:        profile.id,
      profileName:      profile.firstName,
      profileRole:      profile.role,
      profileAvatar:    profile.avatar || null,
      profileInitiales: profile.initiales,
      profileColor:     profile.color || '#2563eb'
    };
    localStorage.setItem(LS_KEY, JSON.stringify(session));
    return session;
  }

  async function syncProfiles() {
    try {
      const res = await fetch(PROFILES_URL);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const src = Array.isArray(data) ? data : (data.profiles || []);
      const profiles = src.filter(p => p.appPermissions && p.appPermissions[APP_KEY]);
      return { online: true, profiles };
    } catch(e) {
      return { online: false, profiles: [] };
    }
  }

  async function init() {
    const session = readSession();
    if (session) { _notifyReady(session); return; }
    show();
    const { online, profiles } = await syncProfiles();
    _updateOfflineBadge(!online);
    render(profiles);
  }

  function render(profiles) {
    const grid  = document.getElementById('ps-profiles-grid');
    const empty = document.getElementById('ps-empty-state');
    if (!grid) return;
    grid.innerHTML = '';
    if (!profiles || profiles.length === 0) {
      if (empty) empty.removeAttribute('hidden');
      return;
    }
    if (empty) empty.setAttribute('hidden', '');
    profiles.forEach(profile => {
      const card = document.createElement('div');
      card.className = 'ps-profile-card';
      const initiales = profile.initiales || (profile.firstName||'').slice(0,1).toUpperCase();
      const color = profile.color || '#2563eb';
      const isAdmin = profile.role === 'admin';
      card.innerHTML = `
        <div class="ps-check">&#10003;</div>
        <div class="ps-avatar-wrap">
          <img class="ps-avatar" src="${profile.avatar||''}" alt="${profile.firstName||''}"
            onerror="this.style.display='none';this.nextElementSibling.classList.remove('ps-hidden')" />
          <div class="ps-avatar-fallback ps-hidden" style="background-color:${color}">${initiales}</div>
        </div>
        <div class="ps-profile-name">${profile.firstName||''}</div>
        ${isAdmin ? '<span style="display:inline-block;background:transparent;border:1px solid #2563eb;color:#2563eb;font-family:Lato,sans-serif;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding:1px 6px;border-radius:3px;white-space:nowrap;margin-top:2px;">ADMIN</span>' : ''}
      `;
      card.addEventListener('click', () => {
        document.querySelectorAll('.ps-profile-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        _selectedProfile = profile;
        const btn = document.getElementById('ps-connect-btn');
        if (btn) btn.removeAttribute('disabled');
      });
      grid.appendChild(card);
    });
    const oldBtn = document.getElementById('ps-connect-btn');
    if (oldBtn) {
      const newBtn = oldBtn.cloneNode(true);
      oldBtn.parentNode.replaceChild(newBtn, oldBtn);
      newBtn.addEventListener('click', connect);
    }
    document.querySelectorAll('input[name="ps-duration"]').forEach(i => {
      i.addEventListener('change', () => { _selectedDuration = i.value; });
    });
  }

  async function connect() {
    if (!_selectedProfile) return;
    const btn = document.getElementById('ps-connect-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'CONNEXION…'; }
    const session = writeSession(_selectedProfile, _selectedDuration);
    hide();
    _notifyReady(session);
  }

  async function changeProfile() {
    const { online, profiles } = await syncProfiles();
    _updateOfflineBadge(!online);
    render(profiles);
    show();
  }

  function show() {
    const el = document.getElementById('profile-selector-screen');
    if (el) el.classList.add('active');
  }

  function hide() {
    const el = document.getElementById('profile-selector-screen');
    if (el) el.classList.remove('active');
  }

  function _updateOfflineBadge(isOffline) {
    const badge = document.getElementById('ps-offline-badge');
    if (!badge) return;
    if (isOffline) badge.removeAttribute('hidden');
    else badge.setAttribute('hidden', '');
  }

  function _notifyReady(session) {
    window._activeSession = session;
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.add('ready');
    _updateHeader(session);
    if (typeof WebProfileSelector.onSessionReady === 'function') {
      WebProfileSelector.onSessionReady(session);
    }
  }

  function _updateHeader(session) {
    const wrap = document.getElementById('top-bar-profile');
    if (wrap) wrap.style.display = 'flex';
    const img      = document.getElementById('header-profile-avatar');
    const fallback = document.getElementById('header-profile-fallback');
    if (session.profileAvatar && img) {
      img.src = session.profileAvatar;
      img.style.display = 'block';
      if (fallback) fallback.style.display = 'none';
    } else if (fallback) {
      if (img) img.style.display = 'none';
      fallback.textContent = session.profileInitiales || '?';
      fallback.style.backgroundColor = session.profileColor || '#2563eb';
      fallback.style.display = 'flex';
    }
    const avatarBtn = document.getElementById('profile-avatar-btn');
    if (avatarBtn) {
      const newBtn = avatarBtn.cloneNode(true);
      avatarBtn.parentNode.replaceChild(newBtn, avatarBtn);
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        changeProfile();
      });
    }
  }

  return { init, show, hide, changeProfile, onSessionReady: null };
})();

function showVitrine() {
  WebProfileSelector.hide();
  switchView('main');
}

function showProfileSelector() {
  WebProfileSelector.init();
}

window.onMercuryComplete = function() {
  // A1 : afficher la vitrine publique d'abord
  const appContainer = document.querySelector('.app-container');
  if (appContainer) appContainer.classList.add('ready');
  showVitrine();
};

function showNotification(message) {
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    document.body.removeChild(existingNotification);
  }

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentElement) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  const target = document.getElementById(viewName + 'View');
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
}

// ============================================================
// CODE MÉTIER — à implémenter ici
// ============================================================
// WebProfileSelector.onSessionReady = function(session) {
//   // session.profileId, session.profileName, session.profileRole disponibles
//   // Initialiser l'app ici
// };

// ============================================================
// NAVIGATION — décommenter et adapter si multi-vues
// ============================================================
// document.addEventListener('DOMContentLoaded', function() {
//   document.querySelectorAll('.nav-btn').forEach(function(btn) {
//     btn.addEventListener('click', function(e) {
//       e.preventDefault();
//       if (btn.dataset.view) switchView(btn.dataset.view);
//     });
//   });
// });
