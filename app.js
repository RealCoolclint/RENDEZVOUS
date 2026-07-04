const MagicLinkAuth = (() => {
  const LS_KEY = 'ts_session_rendezvous';
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MAGIC_LINK_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/request-magic-link';
  const VERIFY_MAGIC_LINK_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/verify-magic-link';

  function _decodeToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padding = base64.length % 4;
      if (padding) base64 += '='.repeat(4 - padding);
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        localStorage.removeItem(LS_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function writeSession(sessionToken, email) {
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const session = {
      version: 3,
      writtenBy: 'rendezvous',
      writtenAt: new Date().toISOString(),
      expiresAt,
      token: sessionToken,
      email
    };
    localStorage.setItem(LS_KEY, JSON.stringify(session));
    return session;
  }

  function logout() {
    localStorage.removeItem(LS_KEY);
    const wrap = document.getElementById('top-bar-profile');
    if (wrap) wrap.style.display = 'none';
    showNotification('Déconnecté.');
  }

  function _updateHeader(session) {
    const wrap = document.getElementById('top-bar-profile');
    if (wrap) wrap.style.display = 'flex';
    const img = document.getElementById('header-profile-avatar');
    const fallback = document.getElementById('header-profile-fallback');
    if (img) img.style.display = 'none';
    if (fallback) {
      fallback.textContent = (session.email || '?').charAt(0).toUpperCase();
      fallback.style.display = 'flex';
    }
    const avatarBtn = document.getElementById('profile-avatar-btn');
    if (avatarBtn) {
      const newBtn = avatarBtn.cloneNode(true);
      avatarBtn.parentNode.replaceChild(newBtn, avatarBtn);
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        logout();
      });
    }
  }

  async function _checkTokenInUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    function _cleanTokenFromUrl() {
      if (history.replaceState) {
        history.replaceState({}, '', window.location.pathname + window.location.hash);
      }
    }

    try {
      const response = await fetch(
        VERIFY_MAGIC_LINK_URL + '?token=' + encodeURIComponent(token)
      );

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}

      _cleanTokenFromUrl();

      if (response.ok && data && data.success === true && data.token) {
        const decoded = _decodeToken(data.token);
        if (!decoded || !decoded.email) {
          showNotification('Lien invalide ou expiré.');
          return;
        }
        const session = writeSession(data.token, decoded.email);
        _updateHeader(session);
        showNotification('Connecté.');
        return;
      }

      showNotification('Lien invalide ou expiré.');
    } catch {
      _cleanTokenFromUrl();
      showNotification('Lien invalide ou expiré.');
    }
  }

  function _updateSubmitBtn() {
    const btn = document.getElementById('magic-submit');
    const emailEl = document.getElementById('magic-email');
    if (!btn || !emailEl) return;
    const email = (emailEl.value || '').trim();
    btn.disabled = !EMAIL_REGEX.test(email);
  }

  function _resetForm() {
    const emailEl = document.getElementById('magic-email');
    const formWrap = document.getElementById('magic-form-wrap');
    const confirmation = document.getElementById('magic-confirmation');
    const errorEl = document.getElementById('magic-error');
    const btn = document.getElementById('magic-submit');

    if (emailEl) emailEl.value = '';
    if (formWrap) formWrap.removeAttribute('hidden');
    if (confirmation) confirmation.setAttribute('hidden', '');
    if (errorEl) errorEl.remove();
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Recevoir le lien';
    }
  }

  function show(triggerEl) {
    if (typeof GlassDrawer !== 'undefined') {
      GlassDrawer.open('connect-drawer', triggerEl);
      if (history.pushState) {
        history.pushState({ connect: true }, '', '#connexion');
      }
    }
  }

  function hide() {
    if (typeof GlassDrawer !== 'undefined') {
      GlassDrawer.close('connect-drawer', {
        onClosed: function() {
          if (history.pushState && window.location.hash === '#connexion') {
            history.pushState({}, '', window.location.pathname + window.location.search);
          }
          _resetForm();
        }
      });
    }
  }

  async function _submitMagicLink() {
    const btn = document.getElementById('magic-submit');
    if (btn && btn.disabled) return;

    const originalText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'ENVOI...';
    }

    const previousError = document.getElementById('magic-error');
    if (previousError) previousError.remove();

    const email = (document.getElementById('magic-email')?.value || '').trim();

    try {
      const response = await fetch(MAGIC_LINK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}

      if (response.ok && data && data.success === true) {
        const formWrap = document.getElementById('magic-form-wrap');
        const confirmation = document.getElementById('magic-confirmation');
        if (formWrap) formWrap.setAttribute('hidden', '');
        if (confirmation) confirmation.removeAttribute('hidden');
        GlassDrawer.refit('connect-drawer');
        return;
      }

      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }

      let errorEl = document.getElementById('magic-error');
      if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.id = 'magic-error';
        errorEl.style.color = 'var(--danger)';
        if (btn && btn.parentNode) btn.parentNode.insertBefore(errorEl, btn);
      }
      errorEl.textContent = (data && data.error) ? data.error : 'Une erreur est survenue, réessaie.';
      GlassDrawer.refit('connect-drawer');
    } catch (_) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }

      let errorEl = document.getElementById('magic-error');
      if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.id = 'magic-error';
        errorEl.style.color = 'var(--danger)';
        if (btn && btn.parentNode) btn.parentNode.insertBefore(errorEl, btn);
      }
      errorEl.textContent = 'Une erreur est survenue, réessaie.';
      GlassDrawer.refit('connect-drawer');
    }
  }

  async function initSession() {
    const session = readSession();
    if (session) {
      _updateHeader(session);
    } else {
      await _checkTokenInUrl();
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    const emailEl = document.getElementById('magic-email');
    const submitBtn = document.getElementById('magic-submit');
    if (emailEl) emailEl.addEventListener('input', _updateSubmitBtn);
    if (submitBtn) submitBtn.addEventListener('click', _submitMagicLink);
  });

  return { show, hide, logout, initSession };
})();

function showVitrine() {
  MagicLinkAuth.hide();
  switchView('main');
}

function showProfileSelector(triggerEl) {
  MagicLinkAuth.show(triggerEl);
}

function closeConnect() {
  MagicLinkAuth.hide();
}

window.onMercuryComplete = function() {
  // A1 : afficher la vitrine publique d'abord
  const appContainer = document.querySelector('.app-container');
  if (appContainer) appContainer.classList.add('ready');
  showVitrine();
};

const _origMercury = window.onMercuryComplete;
window.onMercuryComplete = function() {
  if (typeof _origMercury === 'function') _origMercury();
  MagicLinkAuth.initSession();
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

document.addEventListener('DOMContentLoaded', function() {
  window.addEventListener('popstate', function() {
    if (typeof GlassDrawer === 'undefined') return;
    if (window.location.hash === '#connexion') {
      if (!GlassDrawer.isOpen('connect-drawer')) {
        MagicLinkAuth.show(document.getElementById('connect-trigger'));
      }
    } else if (GlassDrawer.isOpen('connect-drawer')) {
      GlassDrawer.close('connect-drawer');
    }
  });

  if (window.location.hash === '#connexion' && document.querySelector('.app-container.ready')) {
    MagicLinkAuth.show(document.getElementById('connect-trigger'));
  }
});

// ============================================================
// R6 — LOGIQUE VUE CONNECTÉE
// ============================================================

const R6 = (() => {

  // Table de correspondance affectation → niveau + nom métier
  // Source de vérité : D20→D31 (Plan Directeur V5.62)
  const AFFECTATIONS = {
    "COLUMBIA":       { niveau: "N1", metier: "Cellule Vidéo" },
    "GUMDROP":        { niveau: "N2", metier: "Rédaction vidéo" },
    "CHARLIE BROWN":  { niveau: "N2", metier: "Réseaux sociaux" },
    "YANKEE CLIPPER": { niveau: "N2", metier: "DA / Studio" },
    "ODYSSEY":        { niveau: "N2", metier: "Opérations spéciales" },
    "CASPER":         { niveau: "N2", metier: "Édition web et print" },
    "KITTY HAWK":     { niveau: "N2", metier: "Marchés hors captifs" }
  };

  // Table inverse : app → liste des affectations qui y donnent accès
  // Utilisée pour le badge "Affectation [Nom] requise"
  const APP_TO_AFFECTATIONS = {
    "backupflow":  ["COLUMBIA"],
    "transporter": ["COLUMBIA", "GUMDROP", "YANKEE CLIPPER"],
    "manifest":    ["COLUMBIA", "YANKEE CLIPPER", "ODYSSEY"],
    "reviewer":    ["COLUMBIA", "GUMDROP", "CHARLIE BROWN", "YANKEE CLIPPER", "ODYSSEY", "CASPER", "KITTY HAWK"],
    "ark":         ["COLUMBIA", "GUMDROP"],
    "rover":       ["COLUMBIA", "GUMDROP", "YANKEE CLIPPER"],
    "covenant":    ["COLUMBIA", "GUMDROP", "CHARLIE BROWN", "ODYSSEY", "CASPER", "KITTY HAWK"]
  };

  // Décode le payload du JWT de session (déjà présent dans MagicLinkAuth._decodeToken
  // mais on recopie ici pour garder R6 autonome)
  function _decodeJwt(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padding = base64.length % 4;
      if (padding) base64 += '='.repeat(4 - padding);
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  // Rendu d'une carte selon l'état (déverrouillée ou verrouillée)
  function _renderCard(card, appId, userApps, niveau, affectation) {
    const badgeEl = card.querySelector('.app-card-badge');
    const ctaEl   = card.querySelector('.app-card-cta');
    if (!badgeEl || !ctaEl) return;

    const hasAccess = Array.isArray(userApps) && userApps.includes(appId);

    if (hasAccess) {
      // Carte déverrouillée — pas de badge, pas de CTA
      card.classList.remove('locked');
      badgeEl.innerHTML = '';
      ctaEl.innerHTML   = '';
      return;
    }

    // Carte verrouillée — badge + CTA selon niveau
    card.classList.add('locked');

    if (niveau === 'N4') {
      // N4 — badge "Accès individuel requis" + texte statique (D36 + D37)
      badgeEl.innerHTML = `
        <div class="affectation-badge">
          <span class="affectation-badge-main">Accès individuel requis</span>
        </div>`;
      ctaEl.innerHTML = `
        <span class="affectation-readonly">Accès en lecture — aucune action requise</span>`;

    } else if (niveau === 'N3') {
      // N3 — badge "Accès individuel requis" + CTA demande (D36)
      badgeEl.innerHTML = `
        <div class="affectation-badge">
          <span class="affectation-badge-main">Accès individuel requis</span>
        </div>`;
      ctaEl.innerHTML = `
        <button class="affectation-cta" type="button">Demander une affectation</button>`;

    } else {
      // N1 / N2 — badge "Affectation [Nom] requise" + nom métier + CTA (D33)
      // On cherche la première affectation qui donne accès à cette app
      const affectationsRequises = APP_TO_AFFECTATIONS[appId] || [];
      const principale = affectationsRequises[0] || null;
      const metier = principale && AFFECTATIONS[principale]
        ? AFFECTATIONS[principale].metier
        : '';
      const badgeMain = principale
        ? 'Affectation ' + principale + ' requise'
        : 'Affectation requise';

      badgeEl.innerHTML = `
        <div class="affectation-badge">
          <span class="affectation-badge-main">${badgeMain}</span>
          ${metier ? '<span class="affectation-badge-sub">' + metier + '</span>' : ''}
        </div>`;
      ctaEl.innerHTML = `
        <button class="affectation-cta" type="button">Demander une affectation</button>`;
    }
  }

  // Point d'entrée principal — appelé après connexion réussie
  function init(session) {
    const payload = _decodeJwt(session.token);
    if (!payload) return;

    const niveau      = payload.niveau || null;
    const userApps    = Array.isArray(payload.apps) ? payload.apps : [];
    const affectation = payload.affectation || null;

    // Rendu de toutes les cartes
    document.querySelectorAll('.app-grid .app-card').forEach(function(card) {
      const appId = card.dataset.appId;
      if (!appId) return;
      _renderCard(card, appId, userApps, niveau, affectation);
    });

    // Bascule vers la vue connectée
    switchView('connected');
  }

  return { init };

})();

// Hook — R6.init() déclenché après toute connexion réussie
// Wrapping de MagicLinkAuth.initSession (async, exposé)
// Couvre les deux cas : session existante au chargement ET magic link live
const _origInitSession = MagicLinkAuth.initSession.bind(MagicLinkAuth);
MagicLinkAuth.initSession = async function() {
  await _origInitSession();
  try {
    const raw = localStorage.getItem('ts_session_rendezvous');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s && s.token && (!s.expiresAt || new Date(s.expiresAt) > new Date())) {
      R6.init(s);
    }
  } catch {}
};

// ============================================================
