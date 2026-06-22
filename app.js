const MagicLinkAuth = (() => {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MAGIC_LINK_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/request-magic-link';

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

  document.addEventListener('DOMContentLoaded', function() {
    const emailEl = document.getElementById('magic-email');
    const submitBtn = document.getElementById('magic-submit');
    if (emailEl) emailEl.addEventListener('input', _updateSubmitBtn);
    if (submitBtn) submitBtn.addEventListener('click', _submitMagicLink);
  });

  return { show, hide };
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
