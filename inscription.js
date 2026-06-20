// ============================================================
// R3 — INSCRIPTION (via GlassDrawer)
// ============================================================

function openInscription(triggerEl) {
  GlassDrawer.open('inscription-drawer', triggerEl, {
    onOpened: function() {
      const firstField = document.getElementById('insc-prenom');
      if (firstField) firstField.focus();
    }
  });

  if (history.pushState) {
    history.pushState({ inscription: true }, '', '#inscription');
  }
}

function closeInscription() {
  GlassDrawer.close('inscription-drawer', {
    onClosed: function() {
      _resetInscriptionForm();
      if (history.pushState && window.location.hash === '#inscription') {
        history.pushState({}, '', window.location.pathname + window.location.search);
      }
    }
  });
}

function _resetInscriptionForm() {
  const formWrap = document.getElementById('inscription-form-wrap');
  const confirmation = document.getElementById('inscription-confirmation');
  const rgpdView = document.getElementById('inscription-rgpd-view');
  const errorEl = document.getElementById('inscription-error');
  if (formWrap) formWrap.removeAttribute('hidden');
  if (confirmation) confirmation.setAttribute('hidden', '');
  if (rgpdView) rgpdView.setAttribute('hidden', '');
  if (errorEl) errorEl.remove();
}

function openRgpdNotice() {
  const formWrap = document.getElementById('inscription-form-wrap');
  const rgpdView = document.getElementById('inscription-rgpd-view');
  if (formWrap) formWrap.setAttribute('hidden', '');
  if (rgpdView) rgpdView.removeAttribute('hidden');
  GlassDrawer.refit('inscription-drawer');
}

function closeRgpdNotice() {
  const formWrap = document.getElementById('inscription-form-wrap');
  const rgpdView = document.getElementById('inscription-rgpd-view');
  if (formWrap) formWrap.removeAttribute('hidden');
  if (rgpdView) rgpdView.setAttribute('hidden', '');
  GlassDrawer.refit('inscription-drawer');
}

function _updateSubmitBtn() {
  const btn = document.getElementById('inscription-submit');
  if (!btn) return;
  const prenom   = (document.getElementById('insc-prenom')?.value || '').trim();
  const nom      = (document.getElementById('insc-nom')?.value || '').trim();
  const email    = (document.getElementById('insc-email')?.value || '').trim();
  const role     = (document.getElementById('insc-role')?.value || '').trim();
  const lien     = (document.getElementById('insc-lien-video')?.value || '').trim();
  const rgpd     = document.getElementById('insc-rgpd')?.checked;
  const emailOk  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  btn.disabled = !(prenom && nom && email && emailOk && role && lien && rgpd);
}

async function soumettreInscription() {
  const btn = document.getElementById('inscription-submit');
  if (btn && btn.disabled) return;

  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'ENVOI...';
  }

  const previousError = document.getElementById('inscription-error');
  if (previousError) previousError.remove();

  const prenom = (document.getElementById('insc-prenom')?.value || '').trim();
  const nom    = (document.getElementById('insc-nom')?.value || '').trim();
  const email  = (document.getElementById('insc-email')?.value || '').trim();
  const role   = (document.getElementById('insc-role')?.value || '').trim();
  const lien   = (document.getElementById('insc-lien-video')?.value || '').trim();

  const demande = {
    prenom, nom, email, role, lienVideo: lien,
    rgpdAccepte: true,
    rgpdTimestamp: new Date().toISOString(),
    statut: 'pending',
    soumisLe: new Date().toISOString()
  };

  try {
    const response = await fetch(
      'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/submit-inscription',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demande)
      }
    );

    let data = null;
    try {
      data = await response.json();
    } catch (_) {}

    if (response.ok && data && data.success === true) {
      const formWrap = document.getElementById('inscription-form-wrap');
      const confirmation = document.getElementById('inscription-confirmation');
      if (formWrap) formWrap.setAttribute('hidden', '');
      if (confirmation) confirmation.removeAttribute('hidden');
      GlassDrawer.refit('inscription-drawer');
      return;
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }

    let errorEl = document.getElementById('inscription-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.id = 'inscription-error';
      errorEl.style.color = 'var(--danger)';
      if (btn && btn.parentNode) btn.parentNode.insertBefore(errorEl, btn);
    }
    errorEl.textContent = (data && data.error) ? data.error : 'Une erreur est survenue, réessaie.';
    GlassDrawer.refit('inscription-drawer');
  } catch (_) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }

    let errorEl = document.getElementById('inscription-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.id = 'inscription-error';
      errorEl.style.color = 'var(--danger)';
      if (btn && btn.parentNode) btn.parentNode.insertBefore(errorEl, btn);
    }
    errorEl.textContent = 'Une erreur est survenue, réessaie.';
    GlassDrawer.refit('inscription-drawer');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const champs = ['insc-prenom', 'insc-nom', 'insc-email', 'insc-role', 'insc-lien-video'];
  champs.forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _updateSubmitBtn);
  });
  const rgpd = document.getElementById('insc-rgpd');
  if (rgpd) rgpd.addEventListener('change', _updateSubmitBtn);

  const rgpdOpen = document.getElementById('rgpd-open-btn');
  if (rgpdOpen) rgpdOpen.addEventListener('click', openRgpdNotice);

  window.addEventListener('popstate', function() {
    if (window.location.hash === '#inscription') {
      if (!GlassDrawer.isOpen('inscription-drawer')) openInscription();
    } else if (GlassDrawer.isOpen('inscription-drawer')) {
      GlassDrawer.close('inscription-drawer', { onClosed: _resetInscriptionForm });
    }
  });

  const _origMercury = window.onMercuryComplete;
  window.onMercuryComplete = function() {
    if (typeof _origMercury === 'function') _origMercury();
    if (window.location.hash === '#inscription') openInscription();
  };

  if (window.location.hash === '#inscription' && document.querySelector('.app-container.ready')) {
    openInscription();
  }
});
