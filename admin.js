(function() {
  const ADMIN_LIST_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-list-profiles';
  const ADMIN_UPDATE_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-update-profile';
  const ADMIN_SESSION_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-session';
  const ADMIN_CHANGE_SECRET_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-change-secret';
  const ADMIN_REQUEST_RESET_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-request-reset';
  const ADMIN_COMPLETE_RESET_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-complete-reset';
  const ADMIN_PASSKEY_REGISTER_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-passkey-register';
  const ADMIN_PASSKEY_MANAGE_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-passkey-manage';
  const ADMIN_PASSKEY_LOGIN_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-passkey-login';
  const LOGIN_PASSKEY_RENEW_MS = 100000;
  const SESSION_KEY = 'admin_session';
  const LEGACY_SECRET_KEY = 'admin_secret';
  let pendingResetToken = null;
  let passkeyOptions = null;
  let passkeyChallengeToken = null;
  let passkeySecret = null;
  let passkeyAddTimer = null;
  let passkeyAddGeneration = 0;
  let passkeyListGeneration = 0;
  let passkeyConfirm = null;
  let loginPasskeyOptions = null;
  let loginPasskeyChallengeToken = null;
  let loginPasskeyRenewTimer = null;
  let loginPasskeyGeneration = 0;
  let loginPasskeyVerifying = false;
  let loginPasskeyVerifyTicket = null;

  function _storeAdminSession(token, expiresAt) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ value: token, expiresAt: expiresAt }));
  }

  function _readAdminSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.value !== 'string' || typeof parsed.expiresAt !== 'number') {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed.value;
    } catch (_) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function _clearAdminSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  let selectedAction = null;

  // ATTENTION : cette table est dupliquée depuis AFFECTATIONS dans
  // rendezvous-proxy/netlify/functions/admin-update-profile.js.
  // Si la liste des affectations change côté serveur, penser à synchroniser ici aussi.
  const AFFECTATIONS = {
    "COLUMBIA":       { niveau: "N1", apps: ["backupflow", "transporter", "manifest", "reviewer", "ark", "rover", "covenant", "codex"] },
    "GUMDROP":        { niveau: "N2", apps: ["transporter", "reviewer", "ark", "rover", "covenant", "codex"] },
    "CHARLIE BROWN":  { niveau: "N2", apps: ["reviewer", "covenant"] },
    "YANKEE CLIPPER": { niveau: "N2", apps: ["reviewer", "transporter", "rover", "manifest"] },
    "ODYSSEY":        { niveau: "N2", apps: ["reviewer", "covenant", "manifest"] },
    "CASPER":         { niveau: "N2", apps: ["reviewer", "covenant"] },
    "KITTY HAWK":     { niveau: "N2", apps: ["reviewer", "covenant"] }
  };

  function showAuthError(message) {
    const errorEl = document.getElementById('admin-secret-error');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function hideAuthError() {
    const errorEl = document.getElementById('admin-secret-error');
    if (!errorEl) return;
    errorEl.style.display = 'none';
  }

  function showAdminContent() {
    _stopLoginPasskey();
    const backdrop = document.getElementById('admin-auth-backdrop');
    const screen = document.getElementById('admin-auth-screen');
    const content = document.getElementById('admin-content');
    if (backdrop) backdrop.style.display = 'none';
    if (screen) screen.style.display = 'none';
    if (content) content.style.display = 'block';
  }

  function _statusBadgeInfo(statut) {
    if (statut === 'active') {
      return { className: 'status-active-profile', label: 'Actif' };
    }
    if (statut === 'archived') {
      return { className: 'status-archived-profile', label: 'Archivé' };
    }
    return { className: 'status-pending', label: 'Pending' };
  }

  function renderProfiles(filterStatus) {
    const listEl = document.getElementById('profiles-list');
    if (!listEl) return;

    listEl.textContent = '';

    const profiles = Array.isArray(window.adminProfiles) ? window.adminProfiles : [];
    const filtered = profiles.filter(function(profil) {
      return profil && profil.statut === filterStatus;
    });

    if (filtered.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'text-tertiary';
      emptyMsg.textContent = 'Aucun profil dans cette catégorie.';
      listEl.appendChild(emptyMsg);
      return;
    }

    filtered.forEach(function(profil) {
      const card = document.createElement('div');
      card.className = 'app-card';
      card.dataset.profileId = profil.id;

      const nameEl = document.createElement('span');
      nameEl.className = 'app-card-name';
      nameEl.textContent = (profil.prenom || '') + ' ' + (profil.nom || '');

      const badgeInfo = _statusBadgeInfo(profil.statut);
      const badgeEl = document.createElement('span');
      badgeEl.className = 'fleet-card-status ' + badgeInfo.className;
      badgeEl.textContent = badgeInfo.label;

      card.appendChild(nameEl);
      card.appendChild(badgeEl);
      listEl.appendChild(card);
    });
  }

  function _setDetailAppsCheckboxes(apps) {
    const grid = document.getElementById('admin-detail-apps-grid');
    if (!grid) return;
    const appList = Array.isArray(apps) ? apps : [];
    grid.querySelectorAll('input[type="checkbox"][data-app]').forEach(function(checkbox) {
      checkbox.checked = appList.includes(checkbox.dataset.app);
    });
  }

  function _setSelectValue(selectEl, value) {
    if (!selectEl || value == null || value === '') return;
    selectEl.value = value;
  }

  function applyDetailMode() {
    const customToggle = document.getElementById('admin-detail-toggle-custom');
    const exceptionBanner = document.getElementById('admin-detail-exception-banner');
    const affectationBlock = document.getElementById('admin-detail-affectation-block');
    const niveauSelect = document.getElementById('admin-detail-niveau-select');
    const affectationSelect = document.getElementById('admin-detail-affectation-select');
    const grid = document.getElementById('admin-detail-apps-grid');
    const appCheckboxes = grid
      ? grid.querySelectorAll('input[type="checkbox"][data-app]')
      : [];

    const isCustom = customToggle && customToggle.checked;

    if (isCustom) {
      if (exceptionBanner) exceptionBanner.style.display = 'block';
      if (affectationBlock) affectationBlock.style.display = 'none';
      if (niveauSelect) niveauSelect.removeAttribute('disabled');
      appCheckboxes.forEach(function(checkbox) {
        checkbox.removeAttribute('disabled');
      });
      return;
    }

    if (exceptionBanner) exceptionBanner.style.display = 'none';
    if (affectationBlock) affectationBlock.style.display = '';
    if (niveauSelect) niveauSelect.setAttribute('disabled', 'disabled');
    appCheckboxes.forEach(function(checkbox) {
      checkbox.setAttribute('disabled', 'disabled');
    });

    const affectation = affectationSelect ? affectationSelect.value : '';
    const config = AFFECTATIONS[affectation];
    if (config) {
      if (niveauSelect) niveauSelect.value = config.niveau;
      appCheckboxes.forEach(function(checkbox) {
        checkbox.checked = config.apps.includes(checkbox.dataset.app);
      });
    }
  }

  function renderStatusActionButton(profil) {
    const container = document.getElementById('admin-detail-status-actions');
    if (!container) return;

    container.textContent = '';

    let actions = [];
    if (profil.statut === 'pending') {
      actions = [
        { label: 'VALIDER', action: 'activer' },
        { label: 'SUPPRIMER', action: 'supprimer' }
      ];
    } else if (profil.statut === 'active') {
      actions = [
        { label: 'MODIFIER', action: 'modifier' },
        { label: 'ARCHIVER', action: 'archiver' }
      ];
    } else if (profil.statut === 'archived') {
      actions = [{ label: 'RÉACTIVER', action: 'reactiver' }];
    } else {
      return;
    }

    actions.forEach(function(item) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ps-connect-btn ps-connect-btn--drawer admin-detail-status-btn';
      if (item.action === 'archiver' || item.action === 'supprimer') {
        btn.classList.add('admin-detail-status-btn--warning');
      }
      btn.dataset.action = item.action;
      btn.textContent = item.label;
      btn.addEventListener('click', function() {
        selectedAction = btn.dataset.action;
        container.querySelectorAll('.admin-detail-status-btn').forEach(function(b) {
          b.classList.remove('is-selected');
        });
        btn.classList.add('is-selected');
        const errorEl = document.getElementById('admin-detail-action-error');
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.style.display = 'none';
        }
        const previewEl = document.getElementById('admin-detail-action-preview');
        if (previewEl) {
          previewEl.style.display = 'block';
          previewEl.classList.remove(
            'admin-detail-action-preview--success',
            'admin-detail-action-preview--warning'
          );
          if (selectedAction === 'activer') {
            previewEl.textContent = 'Action sélectionnée : valider ce profil';
            previewEl.classList.add('admin-detail-action-preview--success');
          } else if (selectedAction === 'archiver') {
            previewEl.textContent = 'Action sélectionnée : archiver ce profil';
            previewEl.classList.add('admin-detail-action-preview--warning');
          } else if (selectedAction === 'supprimer') {
            previewEl.textContent = 'Action sélectionnée : supprimer définitivement cette demande';
            previewEl.classList.add('admin-detail-action-preview--warning');
          } else if (selectedAction === 'reactiver') {
            previewEl.textContent = 'Action sélectionnée : réactiver ce profil';
            previewEl.classList.add('admin-detail-action-preview--success');
          } else if (selectedAction === 'modifier') {
            previewEl.textContent = 'Action sélectionnée : modifier l\'affectation de ce profil';
          }
        }
      });
      container.appendChild(btn);
    });
  }

  function openProfileDetail(profil, cardElement) {
    window.currentDetailProfile = profil;

    const titleEl = document.getElementById('admin-detail-title');
    const emailEl = document.getElementById('admin-detail-email');
    const roleEl = document.getElementById('admin-detail-role');
    const customToggle = document.getElementById('admin-detail-toggle-custom');
    const affectationSelect = document.getElementById('admin-detail-affectation-select');
    const niveauSelect = document.getElementById('admin-detail-niveau-select');

    if (titleEl) {
      titleEl.textContent = (profil.prenom || '') + ' ' + (profil.nom || '');
    }
    if (emailEl) emailEl.textContent = profil.email || '';
    if (roleEl) roleEl.textContent = profil.role || '';

    const hasAffectation =
      typeof profil.affectation === 'string' && profil.affectation.trim() !== '';

    if (hasAffectation) {
      if (customToggle) customToggle.checked = false;
      _setSelectValue(affectationSelect, profil.affectation);
      _setSelectValue(niveauSelect, profil.niveau);
      _setDetailAppsCheckboxes(profil.apps);
    } else {
      if (customToggle) customToggle.checked = true;
      _setSelectValue(niveauSelect, profil.niveau);
      _setDetailAppsCheckboxes(profil.apps);
    }

    applyDetailMode();

    selectedAction = null;
    const actionErrorEl = document.getElementById('admin-detail-action-error');
    if (actionErrorEl) {
      actionErrorEl.textContent = '';
      actionErrorEl.style.display = 'none';
    }
    const actionPreviewEl = document.getElementById('admin-detail-action-preview');
    if (actionPreviewEl) {
      actionPreviewEl.textContent = '';
      actionPreviewEl.style.display = 'none';
      actionPreviewEl.classList.remove(
        'admin-detail-action-preview--success',
        'admin-detail-action-preview--warning'
      );
    }
    renderStatusActionButton(profil);

    if (typeof GlassDrawer !== 'undefined') {
      GlassDrawer.open('admin-detail-drawer', cardElement);
    }
  }

  function showToast(type, message, duration) {
    const container = document.getElementById('toasts');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);

    const visibleMs = (typeof duration === 'number' && Number.isFinite(duration) && duration > 0)
      ? duration
      : 3000;

    setTimeout(function() {
      toast.style.transition = 'opacity 300ms ease';
      toast.style.opacity = '0';
      setTimeout(function() {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, visibleMs);
  }

  async function refreshProfilesList() {
    const token = _readAdminSession();
    if (!token) return;

    try {
      const response = await fetch(ADMIN_LIST_URL, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      if (response.status === 401) {
        _clearAdminSession();
        return;
      }

      if (!response.ok) return;

      let result = null;
      try {
        result = await response.json();
      } catch (_) {}

      window.adminProfiles = (result && result.profiles) ? result.profiles : [];

      const activeTab = document.querySelector('.admin-tab.tab-active');
      const filter = activeTab && activeTab.dataset.filter ? activeTab.dataset.filter : 'pending';
      renderProfiles(filter);
    } catch (_) {}
  }

  function _showSessionExpiredDetailError() {
    const errorEl = document.getElementById('admin-detail-action-error');
    if (errorEl) {
      errorEl.textContent = 'Ta session a expiré, recharge la page et resaisis le secret (code RDV-101).';
      errorEl.style.display = 'block';
    }
  }

  async function submitDetailSave() {
    const saveBtn = document.getElementById('admin-detail-save-btn');
    if (saveBtn && saveBtn.disabled) return;

    const profil = window.currentDetailProfile;
    if (!profil || profil.id == null || String(profil.id).trim() === '') return;

    const originalText = saveBtn ? saveBtn.textContent : 'Enregistrer';

    if (selectedAction === null) {
      const errorEl = document.getElementById('admin-detail-action-error');
      if (errorEl) {
        errorEl.textContent = 'Sélectionne une action avant d\'enregistrer.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = selectedAction === 'activer'
        ? 'Envoi de l\'email en cours…'
        : 'Enregistrement…';
    }

    try {
      const body = {
        id: window.currentDetailProfile.id,
        action: selectedAction
      };

      const customToggle = document.getElementById('admin-detail-toggle-custom');
      const isCustom = customToggle && customToggle.checked;

      if (!isCustom) {
        const affectationSelect = document.getElementById('admin-detail-affectation-select');
        body.affectation = affectationSelect ? affectationSelect.value : '';
      } else {
        const niveauSelect = document.getElementById('admin-detail-niveau-select');
        body.niveau = niveauSelect ? niveauSelect.value : '';
        body.apps = [];
        const grid = document.getElementById('admin-detail-apps-grid');
        if (grid) {
          grid.querySelectorAll('input[type="checkbox"][data-app]:checked').forEach(function(checkbox) {
            body.apps.push(checkbox.dataset.app);
          });
        }
      }

      const token = _readAdminSession();
      if (!token) {
        _clearAdminSession();
        _showSessionExpiredDetailError();
        return;
      }

      const response = await fetch(ADMIN_UPDATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(body)
      });

      if (response.status === 401) {
        _clearAdminSession();
        _showSessionExpiredDetailError();
        return;
      }

      if (response.ok) {
        if (selectedAction === 'activer') {
          showToast('success', 'Profil validé — email envoyé.');
        } else if (selectedAction === 'reactiver') {
          showToast('success', 'Profil réactivé.');
        } else if (selectedAction === 'archiver') {
          showToast('warning', 'Profil archivé.');
        } else if (selectedAction === 'supprimer') {
          showToast('warning', 'Demande supprimée.');
        } else if (selectedAction === 'modifier') {
          showToast('success', 'Affectation mise à jour.');
        }
        await refreshProfilesList();
        if (typeof GlassDrawer !== 'undefined') {
          GlassDrawer.close('admin-detail-drawer');
        }
        return;
      }

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}

      const errorEl = document.getElementById('admin-detail-action-error');
      if (errorEl) {
        errorEl.textContent = (data && data.error) ? data.error : 'Erreur inattendue, réessaie (code RDV-901).';
        errorEl.style.display = 'block';
      }
    } catch (_) {
      const errorEl = document.getElementById('admin-detail-action-error');
      if (errorEl) {
        errorEl.textContent = 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie (code RDV-102).';
        errorEl.style.display = 'block';
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  }

  async function openAdminWithToken(token, isAutoCheck) {
    const submitBtn = document.getElementById('admin-secret-submit');
    const input = document.getElementById('admin-secret-input');
    const originalText = submitBtn ? submitBtn.textContent : 'Valider';

    // Hors démarrage, verifySecret gère déjà l'état du bouton.
    if (isAutoCheck && submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Vérification…';
    }

    try {
      const response = await fetch(ADMIN_LIST_URL, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      if (response.ok) {
        let result = null;
        try {
          result = await response.json();
        } catch (_) {}

        window.adminProfiles = (result && result.profiles) ? result.profiles : [];
        showAdminContent();
        renderProfiles('pending');

        const requestedId = new URLSearchParams(window.location.search).get('profileId');
        if (requestedId) {
          const profil = window.adminProfiles.find(function(p) {
            return p && String(p.id) === String(requestedId);
          });
          const targetTabs = profil
            ? Array.prototype.filter.call(
                document.querySelectorAll('.admin-tab'),
                function(btn) { return btn.dataset.filter === profil.statut; }
              )
            : [];

          if (profil && targetTabs.length > 0) {
            document.querySelectorAll('.admin-tab').forEach(function(btn) {
              btn.classList.toggle('tab-active', btn.dataset.filter === profil.statut);
            });
            renderProfiles(profil.statut);

            const listEl = document.getElementById('profiles-list');
            const card = listEl
              ? listEl.querySelector('.app-card[data-profile-id="' + String(requestedId).replace(/"/g, '\\"') + '"]')
              : null;
            if (card) {
              openProfileDetail(profil, card);

              const cleanParams = new URLSearchParams(window.location.search);
              cleanParams.delete('profileId');
              const query = cleanParams.toString();
              history.replaceState(
                history.state,
                '',
                window.location.pathname + (query ? '?' + query : '') + window.location.hash
              );
            }
          }
        }
        return;
      }

      if (response.status === 401) {
        _clearAdminSession();
        showAuthError('Ta session a expiré, resaisis le secret (code RDV-101).');
        if (input) input.focus();
        return;
      }

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      showAuthError(_securityErrorText(data));
    } catch (_) {
      showAuthError('Impossible de joindre le serveur. Vérifie ta connexion et réessaie (code RDV-102).');
    } finally {
      if (isAutoCheck && submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  async function verifySecret(secret) {
    const submitBtn = document.getElementById('admin-secret-submit');
    const originalText = submitBtn ? submitBtn.textContent : 'Valider';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Vérification…';
    }

    try {
      const response = await fetch(ADMIN_SESSION_URL, {
        method: 'POST',
        headers: {
          'x-admin-secret': secret
        }
      });

      if (response.status === 200) {
        let result = null;
        try {
          result = await response.json();
        } catch (_) {}

        const token = result ? result.token : null;
        const expiresAt = result ? result.expiresAt : null;
        if (typeof token !== 'string' || token === '' || typeof expiresAt !== 'number') {
          showAuthError('Erreur inattendue, réessaie (code RDV-901).');
          return;
        }

        _storeAdminSession(token, expiresAt);
        _hideAllSecrets();
        await openAdminWithToken(token, false);
        return;
      }

      if (response.status === 401) {
        showAuthError('Secret invalide (code RDV-401).');
        return;
      }

      if (response.status === 429) {
        showAuthError('Trop d\'essais, réessaie dans quelques minutes (code RDV-402).');
        return;
      }

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      showAuthError(_securityErrorText(data));
    } catch (_) {
      showAuthError('Impossible de joindre le serveur. Vérifie ta connexion et réessaie (code RDV-102).');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  function _applySecretToggle(button, revealed) {
    if (!button) return null;
    const field = document.getElementById(button.getAttribute('aria-controls'));
    if (!field) return null;
    const value = field.value;
    field.type = revealed ? 'text' : 'password';
    if (field.value !== value) field.value = value;
    button.textContent = revealed ? 'CACHER' : 'VOIR';
    button.setAttribute('aria-pressed', revealed ? 'true' : 'false');
    button.setAttribute('aria-label', revealed ? 'Masquer le secret' : 'Afficher le secret');
    return field;
  }

  function _toggleSecret(button) {
    const field = document.getElementById(button.getAttribute('aria-controls'));
    if (!field) return;
    const revealed = field.type === 'password';
    _applySecretToggle(button, revealed);
    const end = field.value.length;
    field.focus();
    if (typeof field.setSelectionRange === 'function') {
      try {
        field.setSelectionRange(end, end);
      } catch (_) {}
    }
  }

  function _hideAllSecrets() {
    document.querySelectorAll('.secret-toggle-btn').forEach(function(button) {
      _applySecretToggle(button, false);
    });
  }

  function _resetSecurityFields() {
    ['admin-security-current', 'admin-security-new', 'admin-security-confirm', 'admin-passkeys-secret'].forEach(function(id) {
      const field = document.getElementById(id);
      if (field) field.value = '';
    });
    _hideAllSecrets();
  }

  function _showSecurityError(message) {
    const errorEl = document.getElementById('admin-security-error');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function _hideSecurityError() {
    const errorEl = document.getElementById('admin-security-error');
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  function _securityErrorText(data) {
    if (!data || typeof data.code !== 'string' || !data.code) {
      return 'Erreur inattendue, réessaie (code RDV-901).';
    }
    if (data.code === 'RDV-101') {
      return 'Ta session a expiré, recharge la page et resaisis le secret (code RDV-101).';
    }
    if (data.code === 'RDV-401') {
      return 'Secret actuel incorrect (code RDV-401).';
    }
    const serverError = typeof data.error === 'string' ? data.error : '';
    if (!serverError) {
      return '(code ' + data.code + ')';
    }
    if (serverError.indexOf(data.code) !== -1) {
      return serverError;
    }
    const trimmed = serverError.replace(/\s+$/, '');
    const last = trimmed.charAt(trimmed.length - 1);
    if (last === '…' || last === '?' || last === '!') {
      return serverError + ' (code ' + data.code + ')';
    }
    const base = last === '.' ? trimmed.slice(0, -1) : trimmed;
    return base + ' (code ' + data.code + ').';
  }

  function _b64urlToBuffer(value) {
    if (typeof value !== 'string' || value === '') return new ArrayBuffer(0);
    const padLength = (4 - (value.length % 4)) % 4;
    let padding = '';
    for (let i = 0; i < padLength; i++) padding += '=';
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function _bufferToB64url(buffer) {
    const bytes = buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function _passkeyNetworkError() {
    return 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie (code RDV-102).';
  }

  function _showPasskeyError(message) {
    const errorEl = document.getElementById('admin-passkeys-error');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function _hidePasskeyError() {
    const errorEl = document.getElementById('admin-passkeys-error');
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  function _passkeySecretToggle() {
    return document.querySelector('[aria-controls="admin-passkeys-secret"]');
  }

  function _clearPasskeySecretField() {
    const field = document.getElementById('admin-passkeys-secret');
    if (field) field.value = '';
    _applySecretToggle(_passkeySecretToggle(), false);
  }

  function _clearPasskeyAddTimer() {
    if (passkeyAddTimer !== null) {
      clearTimeout(passkeyAddTimer);
      passkeyAddTimer = null;
    }
  }

  function _cancelPasskeyAdd() {
    passkeyAddGeneration += 1;
    passkeyOptions = null;
    passkeyChallengeToken = null;
    passkeySecret = null;
    _clearPasskeyAddTimer();
    _clearPasskeySecretField();
    const confirmBtn = document.getElementById('admin-passkeys-add-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'VALIDER';
    }
    const form = document.getElementById('admin-passkeys-add-form');
    if (form) form.hidden = true;
    const addBtn = document.getElementById('admin-passkeys-add');
    if (addBtn) addBtn.hidden = false;
  }

  function _passkeysUnsupported() {
    return typeof window.PublicKeyCredential === 'undefined' || !navigator.credentials;
  }

  function _formatPasskeyAddedAt(createdAt) {
    try {
      const date = new Date(createdAt);
      if (Number.isNaN(date.getTime())) return 'Ajouté le';
      const parts = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(date);
      const bag = {};
      parts.forEach(function(part) {
        bag[part.type] = part.value;
      });
      return 'Ajouté le ' + (bag.day || '') + '/' + (bag.month || '') + '/' + (bag.year || '') + ' à ' + (bag.hour || '') + ':' + (bag.minute || '');
    } catch (_) {
      return 'Ajouté le';
    }
  }

  function _passkeyDeviceId(device) {
    if (!device || typeof device !== 'object') return null;
    if (typeof device.id === 'string' && device.id !== '') return device.id;
    if (typeof device.id === 'number' && Number.isFinite(device.id)) return device.id;
    return null;
  }

  function _clearPasskeyListPresentation() {
    passkeyConfirm = null;
    const list = document.getElementById('admin-passkeys-list');
    if (list) list.replaceChildren();
    const countEl = document.getElementById('admin-passkeys-count');
    if (countEl) countEl.textContent = '';
    const emptyEl = document.getElementById('admin-passkeys-empty');
    if (emptyEl) emptyEl.hidden = true;
    const addBtn = document.getElementById('admin-passkeys-add');
    if (addBtn) addBtn.disabled = false;
  }

  function _buildPasskeyRemoveButton(deviceId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-passkey-btn admin-passkey-btn--danger';
    button.textContent = 'RETIRER';
    button.addEventListener('click', function() {
      const actions = button.parentElement;
      const row = actions ? actions.parentElement : null;
      if (!row) return;
      _openPasskeyRemoveConfirm(row, deviceId);
    });
    return button;
  }

  function _restorePasskeyConfirmRow() {
    const current = passkeyConfirm;
    passkeyConfirm = null;
    if (!current || !current.row || !current.row.isConnected) return;
    const actions = current.row.querySelector('.admin-passkey-actions');
    if (!actions) return;
    actions.replaceChildren(_buildPasskeyRemoveButton(current.id));
  }

  function _releasePasskeyRemoveButtons(confirmBtn, cancelBtn) {
    if (confirmBtn && confirmBtn.isConnected) confirmBtn.disabled = false;
    if (cancelBtn && cancelBtn.isConnected) cancelBtn.disabled = false;
  }

  function _openPasskeyRemoveConfirm(row, deviceId) {
    _restorePasskeyConfirmRow();
    const actions = row.querySelector('.admin-passkey-actions');
    if (!actions) return;
    const text = document.createElement('span');
    text.className = 'admin-passkey-confirm-text';
    text.textContent = 'RETIRER CET APPAREIL ?';
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'admin-passkey-btn admin-passkey-btn--danger';
    confirmBtn.textContent = 'CONFIRMER';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'admin-passkey-btn';
    cancelBtn.textContent = 'ANNULER';
    cancelBtn.addEventListener('click', function() {
      _restorePasskeyConfirmRow();
    });
    confirmBtn.addEventListener('click', function() {
      if (confirmBtn.disabled) return;
      _submitPasskeyRemove(deviceId, confirmBtn, cancelBtn);
    });
    actions.replaceChildren();
    actions.appendChild(text);
    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    passkeyConfirm = { row: row, id: deviceId };
  }

  async function _submitPasskeyRemove(deviceId, confirmBtn, cancelBtn) {
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    const token = _readAdminSession();
    if (!token) {
      _showPasskeyError(_securityErrorText({ code: 'RDV-101' }));
      _releasePasskeyRemoveButtons(confirmBtn, cancelBtn);
      return;
    }
    try {
      const response = await fetch(ADMIN_PASSKEY_MANAGE_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'remove', id: deviceId })
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (
        response.status === 200 &&
        data &&
        data.success === true &&
        Array.isArray(data.devices)
      ) {
        _hidePasskeyError();
        _renderPasskeys(data.devices, data.max);
        showToast('success', 'Appareil retiré. Pour couper aussi les sessions déjà ouvertes, change le secret.');
        return;
      }
      _showPasskeyError(_securityErrorText(data));
      if (data && data.code === 'RDV-101') _clearAdminSession();
      if (data && data.code === 'RDV-412') _loadPasskeys(true);
      _releasePasskeyRemoveButtons(confirmBtn, cancelBtn);
    } catch (_) {
      _showPasskeyError(_passkeyNetworkError());
      _releasePasskeyRemoveButtons(confirmBtn, cancelBtn);
    }
  }

  function _renderPasskeys(devices, max) {
    passkeyConfirm = null;
    const list = document.getElementById('admin-passkeys-list');
    if (list) list.replaceChildren();
    const items = Array.isArray(devices) ? devices : [];
    items.forEach(function(device) {
      if (!device || typeof device !== 'object') return;
      const row = document.createElement('li');
      row.className = 'admin-passkey-row';
      const name = document.createElement('span');
      name.className = 'admin-passkey-name';
      name.textContent = typeof device.name === 'string' ? device.name : '';
      const date = document.createElement('span');
      date.className = 'admin-passkey-date';
      date.textContent = _formatPasskeyAddedAt(device.createdAt);
      const actions = document.createElement('div');
      actions.className = 'admin-passkey-actions';
      const deviceId = _passkeyDeviceId(device);
      if (deviceId !== null) actions.appendChild(_buildPasskeyRemoveButton(deviceId));
      row.appendChild(name);
      row.appendChild(date);
      row.appendChild(actions);
      if (list) list.appendChild(row);
    });
    const n = list ? list.children.length : 0;
    const hasMax = typeof max === 'number' && Number.isFinite(max);
    const countEl = document.getElementById('admin-passkeys-count');
    if (countEl) {
      const noun = n >= 2 ? 'APPAREILS' : 'APPAREIL';
      let text = n + ' ' + noun;
      if (hasMax) {
        text += ' SUR ' + String(max);
        if (n >= max) text += ' · LIMITE ATTEINTE';
      }
      countEl.textContent = text;
    }
    const emptyEl = document.getElementById('admin-passkeys-empty');
    if (emptyEl) emptyEl.hidden = n !== 0;
    const addBtn = document.getElementById('admin-passkeys-add');
    if (addBtn) addBtn.disabled = hasMax && n >= max;
  }

  async function _loadPasskeys(keepError) {
    const generation = ++passkeyListGeneration;
    const token = _readAdminSession();
    if (!token) {
      if (generation !== passkeyListGeneration) return;
      _showPasskeyError(_securityErrorText({ code: 'RDV-101' }));
      _clearPasskeyListPresentation();
      return;
    }
    try {
      const response = await fetch(ADMIN_PASSKEY_MANAGE_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'list' })
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (generation !== passkeyListGeneration) return;
      if (response.status === 200 && data && Array.isArray(data.devices)) {
        if (!keepError) _hidePasskeyError();
        _renderPasskeys(data.devices, data.max);
        return;
      }
      _showPasskeyError(_securityErrorText(data));
      if (data && data.code === 'RDV-101') _clearAdminSession();
      _clearPasskeyListPresentation();
    } catch (_) {
      if (generation !== passkeyListGeneration) return;
      _showPasskeyError(_passkeyNetworkError());
      _clearPasskeyListPresentation();
    }
  }

  function _openPasskeyAddForm() {
    const addBtn = document.getElementById('admin-passkeys-add');
    if (addBtn && addBtn.disabled) return;
    _hidePasskeyError();
    if (_passkeysUnsupported()) {
      _showPasskeyError('Ce navigateur ne sait pas utiliser Touch ID pour l\'admin. Ouvre l\'admin dans Safari ou Opera (code RDV-201).');
      return;
    }
    const form = document.getElementById('admin-passkeys-add-form');
    if (form) form.hidden = false;
    if (addBtn) addBtn.hidden = true;
    const field = document.getElementById('admin-passkeys-secret');
    if (field) field.focus();
  }

  function _startPasskeyAddTimer() {
    _clearPasskeyAddTimer();
    passkeyAddTimer = setTimeout(function() {
      passkeyAddTimer = null;
      _cancelPasskeyAdd();
      _showPasskeyError('Délai dépassé, recommence l\'ajout de l\'appareil (code RDV-410).');
    }, 100000);
  }

  function _restorePasskeyValidateButton() {
    const confirmBtn = document.getElementById('admin-passkeys-add-confirm');
    if (!confirmBtn) return;
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'VALIDER';
  }

  async function _requestPasskeyOptions() {
    const confirmBtn = document.getElementById('admin-passkeys-add-confirm');
    if (confirmBtn && confirmBtn.disabled) return;
    if (confirmBtn && (confirmBtn.textContent || '').trim() !== 'VALIDER') return;
    const field = document.getElementById('admin-passkeys-secret');
    const secret = field ? (field.value || '').trim() : '';
    if (secret === '') {
      _showPasskeyError('Retape le secret.');
      return;
    }
    const token = _readAdminSession();
    if (!token) {
      _showPasskeyError(_securityErrorText({ code: 'RDV-101' }));
      return;
    }
    _hidePasskeyError();
    const generation = passkeyAddGeneration;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'VÉRIFICATION…';
    }
    try {
      const response = await fetch(ADMIN_PASSKEY_REGISTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'x-admin-secret': secret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ step: 'options' })
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (generation !== passkeyAddGeneration) return;
      if (
        response.status === 200 &&
        data &&
        data.options &&
        typeof data.options === 'object' &&
        typeof data.challengeToken === 'string' &&
        data.challengeToken !== ''
      ) {
        passkeyOptions = data.options;
        passkeyChallengeToken = data.challengeToken;
        passkeySecret = secret;
        _clearPasskeySecretField();
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'POSER LE DOIGT';
        }
        _startPasskeyAddTimer();
        return;
      }
      _showPasskeyError(_securityErrorText(data));
      if (data && data.code === 'RDV-101') _clearAdminSession();
      _clearPasskeySecretField();
      _restorePasskeyValidateButton();
    } catch (_) {
      if (generation !== passkeyAddGeneration) return;
      _showPasskeyError(_passkeyNetworkError());
      _clearPasskeySecretField();
      _restorePasskeyValidateButton();
    }
  }

  function _publicKeyFromOptions(options) {
    if (!options || typeof options !== 'object' || typeof options.challenge !== 'string') {
      throw new Error('options');
    }
    const publicKey = Object.assign({}, options);
    publicKey.challenge = _b64urlToBuffer(options.challenge);
    if (options.user && typeof options.user === 'object') {
      publicKey.user = Object.assign({}, options.user);
      publicKey.user.id = _b64urlToBuffer(typeof options.user.id === 'string' ? options.user.id : '');
    }
    if (Array.isArray(options.excludeCredentials)) {
      publicKey.excludeCredentials = options.excludeCredentials.map(function(cred) {
        const copy = Object.assign({}, cred);
        copy.id = _b64urlToBuffer(cred && typeof cred.id === 'string' ? cred.id : '');
        return copy;
      });
    }
    return publicKey;
  }

  function _passkeyCreationErrorText(error) {
    const name = error && typeof error.name === 'string' ? error.name : '';
    if (name === 'NotAllowedError') {
      return 'Touch ID a été annulé ou le délai est dépassé. Rien n\'a été enregistré (code RDV-202).';
    }
    if (name === 'InvalidStateError') {
      return 'Cet appareil est déjà enregistré (code RDV-203).';
    }
    return 'Touch ID n\'a pas pu s\'ouvrir sur cet appareil. Réessaie. Si ça bloque encore, ouvre l\'admin dans Safari (code RDV-204).';
  }

  function _rejectPasskeyCreation(error, generation) {
    if (generation !== passkeyAddGeneration) return;
    _showPasskeyError(_passkeyCreationErrorText(error));
    _cancelPasskeyAdd();
  }

  function _serializePasskeyCredential(credential) {
    const response = credential.response || {};
    let transports = [];
    if (typeof response.getTransports === 'function') {
      try {
        const listed = response.getTransports();
        if (Array.isArray(listed)) transports = listed;
      } catch (_) {}
    }
    let clientExtensionResults = {};
    if (typeof credential.getClientExtensionResults === 'function') {
      try {
        const results = credential.getClientExtensionResults();
        if (results && typeof results === 'object') clientExtensionResults = results;
      } catch (_) {}
    }
    const payload = {
      id: credential.id,
      rawId: _bufferToB64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: _bufferToB64url(response.clientDataJSON),
        attestationObject: _bufferToB64url(response.attestationObject),
        transports: transports
      },
      clientExtensionResults: clientExtensionResults
    };
    if (credential.authenticatorAttachment) {
      payload.authenticatorAttachment = credential.authenticatorAttachment;
    }
    return payload;
  }

  async function _verifyPasskeyRegistration(credential, generation) {
    const secret = passkeySecret;
    const challengeToken = passkeyChallengeToken;
    const token = _readAdminSession();
    if (generation !== passkeyAddGeneration) return;
    if (!token) {
      _showPasskeyError(_securityErrorText({ code: 'RDV-101' }));
      _cancelPasskeyAdd();
      return;
    }
    if (!secret || !challengeToken) {
      _cancelPasskeyAdd();
      return;
    }
    const confirmBtn = document.getElementById('admin-passkeys-add-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'ENREGISTREMENT…';
    }
    try {
      const response = await fetch(ADMIN_PASSKEY_REGISTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'x-admin-secret': secret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          step: 'verify',
          challengeToken: challengeToken,
          response: _serializePasskeyCredential(credential)
        })
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (generation !== passkeyAddGeneration) return;
      if (response.status === 200 && data && data.success === true) {
        const name = typeof data.name === 'string' ? data.name : '';
        showToast('success', 'Appareil ajouté : ' + name + '. Une alerte est partie vers l\'adresse de secours.');
        _cancelPasskeyAdd();
        _loadPasskeys();
        return;
      }
      _showPasskeyError(_securityErrorText(data));
      if (data && data.code === 'RDV-101') _clearAdminSession();
      _cancelPasskeyAdd();
    } catch (_) {
      if (generation !== passkeyAddGeneration) return;
      _showPasskeyError(_passkeyNetworkError());
      _cancelPasskeyAdd();
    }
  }

  function _onPasskeyAddConfirmClick() {
    const confirmBtn = document.getElementById('admin-passkeys-add-confirm');
    if (!confirmBtn || confirmBtn.disabled) return;
    if ((confirmBtn.textContent || '').trim() === 'POSER LE DOIGT') {
      const generation = passkeyAddGeneration;
      let publicKey;
      try {
        publicKey = _publicKeyFromOptions(passkeyOptions);
      } catch (_) {
        _rejectPasskeyCreation({ name: 'OperationError' }, generation);
        return;
      }
      let creation;
      try {
        creation = navigator.credentials.create({ publicKey: publicKey });
      } catch (error) {
        _rejectPasskeyCreation(error, generation);
        return;
      }
      confirmBtn.disabled = true;
      Promise.resolve(creation).then(function(credential) {
        if (generation !== passkeyAddGeneration) return;
        if (!credential) {
          _rejectPasskeyCreation({ name: 'NotAllowedError' }, generation);
          return;
        }
        _verifyPasskeyRegistration(credential, generation);
      }, function(error) {
        _rejectPasskeyCreation(error, generation);
      });
      return;
    }
    _requestPasskeyOptions();
  }

  function _clearLoginPasskeyRenewTimer() {
    if (loginPasskeyRenewTimer !== null) {
      clearTimeout(loginPasskeyRenewTimer);
      loginPasskeyRenewTimer = null;
    }
  }

  function _setLoginPasskeyButton(disabled, text) {
    const button = document.getElementById('admin-passkey-login-btn');
    if (!button) return;
    button.disabled = disabled;
    if (typeof text === 'string') button.textContent = text;
  }

  function _loginAuthScreenVisible() {
    const authScreen = document.getElementById('admin-auth-screen');
    if (!authScreen) return false;
    return window.getComputedStyle(authScreen).display !== 'none';
  }

  function _adminContentVisible() {
    const content = document.getElementById('admin-content');
    if (!content) return false;
    return window.getComputedStyle(content).display !== 'none';
  }

  function _stopLoginPasskey() {
    loginPasskeyGeneration += 1;
    _clearLoginPasskeyRenewTimer();
    loginPasskeyOptions = null;
    loginPasskeyChallengeToken = null;
    _setLoginPasskeyButton(true);
  }

  async function _prepareLoginPasskey(fromClick) {
    if (_passkeysUnsupported()) {
      _setLoginPasskeyButton(false);
      return;
    }
    if (document.hidden || !_loginAuthScreenVisible() || _adminContentVisible()) return;

    loginPasskeyGeneration += 1;
    const generation = loginPasskeyGeneration;
    _clearLoginPasskeyRenewTimer();
    loginPasskeyOptions = null;
    loginPasskeyChallengeToken = null;
    _setLoginPasskeyButton(true, 'PRÉPARATION…');

    try {
      const response = await fetch(ADMIN_PASSKEY_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ step: 'options' })
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (generation !== loginPasskeyGeneration) return;
      if (
        response.status === 200 &&
        data &&
        data.options &&
        typeof data.options.challenge === 'string' &&
        data.options.challenge !== '' &&
        typeof data.challengeToken === 'string' &&
        data.challengeToken !== ''
      ) {
        loginPasskeyOptions = data.options;
        loginPasskeyChallengeToken = data.challengeToken;
        _setLoginPasskeyButton(false, 'TOUCH ID');
        loginPasskeyRenewTimer = setTimeout(function() {
          loginPasskeyRenewTimer = null;
          _prepareLoginPasskey(false);
        }, LOGIN_PASSKEY_RENEW_MS);
        return;
      }
      _setLoginPasskeyButton(false, 'TOUCH ID');
      if (fromClick) showAuthError(_securityErrorText(data));
    } catch (_) {
      if (generation !== loginPasskeyGeneration) return;
      _setLoginPasskeyButton(false, 'TOUCH ID');
      if (fromClick) showAuthError(_passkeyNetworkError());
    }
  }

  function _serializePasskeyAssertion(credential) {
    const response = credential.response || {};
    let clientExtensionResults = {};
    if (typeof credential.getClientExtensionResults === 'function') {
      try {
        const results = credential.getClientExtensionResults();
        if (results && typeof results === 'object') clientExtensionResults = results;
      } catch (_) {}
    }
    let userHandle = null;
    if (response.userHandle && response.userHandle.byteLength) {
      userHandle = _bufferToB64url(response.userHandle);
      if (userHandle === '') userHandle = null;
    }
    const payload = {
      id: credential.id,
      rawId: _bufferToB64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: _bufferToB64url(response.clientDataJSON),
        authenticatorData: _bufferToB64url(response.authenticatorData),
        signature: _bufferToB64url(response.signature),
        userHandle: userHandle
      },
      clientExtensionResults: clientExtensionResults
    };
    if (credential.authenticatorAttachment) {
      payload.authenticatorAttachment = credential.authenticatorAttachment;
    }
    return payload;
  }

  function _failLoginPasskeyGet(error, generation) {
    if (generation !== loginPasskeyGeneration) return;
    const name = error && typeof error.name === 'string' ? error.name : '';
    if (name === 'NotAllowedError') {
      showAuthError('Touch ID a été annulé ou n\'a pas abouti. Réessaie, ou connecte-toi avec le secret (code RDV-202).');
    } else {
      showAuthError('Touch ID n\'a pas pu s\'ouvrir sur cet appareil. Réessaie. Si ça bloque encore, ouvre l\'admin dans Safari, ou connecte-toi avec le secret (code RDV-204).');
    }
    loginPasskeyVerifying = false;
    _prepareLoginPasskey(false);
  }

  async function _verifyLoginPasskey(credential, challengeToken, generation) {
    try {
      const response = await fetch(ADMIN_PASSKEY_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          step: 'verify',
          challengeToken: challengeToken,
          response: _serializePasskeyAssertion(credential)
        })
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (generation !== loginPasskeyGeneration) return;
      const token = data && data.token;
      const expiresAt = data && data.expiresAt;
      if (
        response.status === 200 &&
        typeof token === 'string' &&
        token !== '' &&
        typeof expiresAt === 'number'
      ) {
        _storeAdminSession(token, expiresAt);
        const input = document.getElementById('admin-secret-input');
        if (input) input.value = '';
        _hideAllSecrets();
        _stopLoginPasskey();
        await openAdminWithToken(token, false);
        return;
      }
      showAuthError(_securityErrorText(data));
      _prepareLoginPasskey(false);
    } catch (_) {
      if (generation !== loginPasskeyGeneration) return;
      showAuthError(_passkeyNetworkError());
      _prepareLoginPasskey(false);
    }
  }

  function _onPasskeyLoginClick() {
    const button = document.getElementById('admin-passkey-login-btn');
    if (!button || button.disabled) return;
    hideAuthError();
    if (_passkeysUnsupported()) {
      showAuthError('Ce navigateur ne sait pas utiliser Touch ID pour l\'admin. Ouvre l\'admin dans Safari ou Opera, ou connecte-toi avec le secret (code RDV-201).');
      return;
    }
    if (!loginPasskeyOptions) {
      _prepareLoginPasskey(true);
      return;
    }

    const generation = loginPasskeyGeneration;
    let assertion;
    try {
      const publicKey = Object.assign({}, loginPasskeyOptions);
      publicKey.challenge = _b64urlToBuffer(loginPasskeyOptions.challenge);
      if (Array.isArray(loginPasskeyOptions.allowCredentials)) {
        publicKey.allowCredentials = loginPasskeyOptions.allowCredentials.map(function(cred) {
          const copy = Object.assign({}, cred);
          copy.id = _b64urlToBuffer(cred && typeof cred.id === 'string' ? cred.id : '');
          return copy;
        });
      }
      assertion = navigator.credentials.get({ publicKey: publicKey });
    } catch (error) {
      _failLoginPasskeyGet(error, generation);
      return;
    }

    const challengeToken = loginPasskeyChallengeToken;
    loginPasskeyOptions = null;
    loginPasskeyChallengeToken = null;
    _clearLoginPasskeyRenewTimer();
    const verifyTicket = {};
    loginPasskeyVerifyTicket = verifyTicket;
    loginPasskeyVerifying = true;
    button.disabled = true;
    button.textContent = 'TOUCH ID…';

    Promise.resolve(assertion).then(function(credential) {
      if (generation !== loginPasskeyGeneration) return;
      if (!credential) {
        _failLoginPasskeyGet({ name: 'NotAllowedError' }, generation);
        return;
      }
      return _verifyLoginPasskey(credential, challengeToken, generation);
    }, function(error) {
      if (generation !== loginPasskeyGeneration) return;
      _failLoginPasskeyGet(error, generation);
    }).then(function() {
      if (loginPasskeyVerifyTicket === verifyTicket) loginPasskeyVerifying = false;
    }, function() {
      if (loginPasskeyVerifyTicket === verifyTicket) loginPasskeyVerifying = false;
    });
  }

  function openSecurityDrawer(triggerEl) {
    _resetSecurityFields();
    _hideSecurityError();
    if (typeof GlassDrawer !== 'undefined') {
      GlassDrawer.open('admin-security-drawer', triggerEl);
    }
    const currentField = document.getElementById('admin-security-current');
    if (currentField) currentField.focus();
    _loadPasskeys();
  }

  function closeSecurityDrawer() {
    if (typeof GlassDrawer !== 'undefined') {
      GlassDrawer.close('admin-security-drawer');
    }
    _resetSecurityFields();
    passkeyListGeneration += 1;
    _cancelPasskeyAdd();
    _hidePasskeyError();
    _restorePasskeyConfirmRow();
  }

  // GlassDrawer.close accepte onClosed, mais Échap appelle close(id) sans
  // options, et aucun enregistrement public ne couvre tous les chemins.
  // On observe la perte de is-open, retirée par close() quel que soit l'appelant.
  function _watchSecurityDrawerClose() {
    const drawer = document.getElementById('admin-security-drawer');
    if (!drawer || typeof MutationObserver === 'undefined') return;

    let wasOpen = drawer.classList.contains('is-open');
    const observer = new MutationObserver(function() {
      const isOpen = drawer.classList.contains('is-open');
      if (wasOpen && !isOpen) {
        _resetSecurityFields();
        _hideSecurityError();
        passkeyListGeneration += 1;
        _cancelPasskeyAdd();
        _hidePasskeyError();
        _restorePasskeyConfirmRow();
      }
      wasOpen = isOpen;
    });
    observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });
  }

  async function submitSecretChange() {
    const saveBtn = document.getElementById('admin-security-save');
    if (saveBtn && saveBtn.disabled) return;

    const currentField = document.getElementById('admin-security-current');
    const newField = document.getElementById('admin-security-new');
    const confirmField = document.getElementById('admin-security-confirm');
    if (!currentField || !newField || !confirmField) return;

    const currentSecret = (currentField.value || '').trim();
    const newSecret = newField.value;
    const confirmSecret = confirmField.value;

    if (currentSecret === '' || newSecret === '' || confirmSecret === '') {
      _showSecurityError('Remplis les trois champs.');
      return;
    }

    const token = _readAdminSession();
    if (!token) {
      _showSecurityError('Ta session a expiré, recharge la page et resaisis le secret (code RDV-101).');
      return;
    }

    const originalText = saveBtn ? saveBtn.textContent : 'ENREGISTRER';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'VÉRIFICATION…';
    }

    try {
      const response = await fetch(ADMIN_CHANGE_SECRET_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'x-admin-secret': currentSecret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newSecret: newSecret,
          confirmSecret: confirmSecret
        })
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}

      if (
        response.status === 200 &&
        data &&
        typeof data.token === 'string' &&
        data.token !== '' &&
        typeof data.expiresAt === 'number' &&
        Number.isFinite(data.expiresAt)
      ) {
        _storeAdminSession(data.token, data.expiresAt);
        _resetSecurityFields();
        if (typeof GlassDrawer !== 'undefined') {
          GlassDrawer.close('admin-security-drawer');
        }
        showToast('success', 'Secret admin changé. Les autres sessions admin sont fermées.');
        return;
      }

      _showSecurityError(_securityErrorText(data));
      if (data && data.code === 'RDV-101') {
        _clearAdminSession();
      }
    } catch (_) {
      _showSecurityError('Impossible de joindre le serveur. Vérifie ta connexion et réessaie (code RDV-102).');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  }

  function _clearResetFields() {
    ['admin-reset-new', 'admin-reset-confirm'].forEach(function(id) {
      const field = document.getElementById(id);
      if (field) field.value = '';
    });
    const errorEl = document.getElementById('admin-reset-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
    _hideAllSecrets();
  }

  function showResetError(message) {
    const errorEl = document.getElementById('admin-reset-error');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function showResetScreen() {
    _stopLoginPasskey();
    const authScreen = document.getElementById('admin-auth-screen');
    const resetScreen = document.getElementById('admin-reset-screen');
    const backdrop = document.getElementById('admin-auth-backdrop');
    const content = document.getElementById('admin-content');
    if (authScreen) authScreen.style.display = 'none';
    if (resetScreen) resetScreen.style.display = 'flex';
    if (backdrop) backdrop.style.display = '';
    if (content) content.style.display = 'none';
    _clearResetFields();
    const newField = document.getElementById('admin-reset-new');
    if (newField) newField.focus();
  }

  function showAuthScreenFromReset() {
    pendingResetToken = null;
    _clearResetFields();
    const resetScreen = document.getElementById('admin-reset-screen');
    const authScreen = document.getElementById('admin-auth-screen');
    if (resetScreen) resetScreen.style.display = 'none';
    if (authScreen) authScreen.style.display = 'flex';
    const input = document.getElementById('admin-secret-input');
    if (input) input.focus();
    _prepareLoginPasskey(false);
  }

  function consumeResetLink() {
    if (location.hash.indexOf('#reset=') !== 0) return false;
    let token = '';
    try {
      token = decodeURIComponent(location.hash.slice('#reset='.length));
    } catch (_) {
      token = '';
    }
    history.replaceState(history.state, '', location.pathname + location.search);
    if (token === '') return false;
    pendingResetToken = token;
    showResetScreen();
    return true;
  }

  async function requestAdminReset() {
    const forgotBtn = document.getElementById('admin-forgot-btn');
    if (forgotBtn && forgotBtn.disabled) return;

    const originalText = forgotBtn ? forgotBtn.textContent : 'SECRET OUBLIÉ';
    if (forgotBtn) {
      forgotBtn.disabled = true;
      forgotBtn.textContent = 'ENVOI…';
    }

    try {
      const response = await fetch(ADMIN_REQUEST_RESET_URL, {
        method: 'POST'
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}

      if (response.status === 200) {
        hideAuthError();
        const serverMessage = data && typeof data.message === 'string' ? data.message : '';
        showToast(
          'success',
          serverMessage !== ''
            ? serverMessage
            : 'Un lien vient d\'être envoyé à l\'adresse de secours de l\'admin. Il est valable 15 minutes.'
        );
        return;
      }

      showAuthError(_securityErrorText(data));
    } catch (_) {
      showAuthError('Impossible de joindre le serveur. Vérifie ta connexion et réessaie (code RDV-102).');
    } finally {
      if (forgotBtn) {
        forgotBtn.disabled = false;
        forgotBtn.textContent = originalText;
      }
    }
  }

  async function submitAdminReset() {
    const saveBtn = document.getElementById('admin-reset-save');
    if (saveBtn && saveBtn.disabled) return;

    const newField = document.getElementById('admin-reset-new');
    const confirmField = document.getElementById('admin-reset-confirm');
    if (!newField || !confirmField) return;

    const newSecret = newField.value;
    const confirmSecret = confirmField.value;

    if (newSecret === '' || confirmSecret === '') {
      showResetError('Remplis les deux champs.');
      return;
    }

    if (pendingResetToken === null) {
      showResetError('Ce lien n\'est plus disponible. Demande un nouveau lien depuis l\'écran de connexion (code RDV-103).');
      return;
    }

    const originalText = saveBtn ? saveBtn.textContent : 'ENREGISTRER';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'VÉRIFICATION…';
    }

    try {
      const response = await fetch(ADMIN_COMPLETE_RESET_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + pendingResetToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newSecret: newSecret,
          confirmSecret: confirmSecret
        })
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}

      if (
        response.status === 200 &&
        data &&
        typeof data.token === 'string' &&
        data.token !== '' &&
        typeof data.expiresAt === 'number' &&
        Number.isFinite(data.expiresAt)
      ) {
        const sessionToken = data.token;
        _storeAdminSession(sessionToken, data.expiresAt);
        pendingResetToken = null;
        newField.value = '';
        confirmField.value = '';
        const resetScreen = document.getElementById('admin-reset-screen');
        if (resetScreen) resetScreen.style.display = 'none';
        showToast('success', 'Nouveau secret enregistré. Les autres sessions admin sont fermées et les appareils Touch ID ont été effacés : ajoute de nouveau cet appareil depuis SÉCURITÉ.', 8000);
        _hideAllSecrets();
        await openAdminWithToken(sessionToken, false);
        return;
      }

      showResetError(_securityErrorText(data));
      if (data && (data.code === 'RDV-103' || data.code === 'RDV-104')) {
        pendingResetToken = null;
      }
    } catch (_) {
      showResetError('Impossible de joindre le serveur. Vérifie ta connexion et réessaie (code RDV-102).');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  }

  function submitSecret() {
    const submitBtn = document.getElementById('admin-secret-submit');
    if (submitBtn && submitBtn.disabled) return;

    const input = document.getElementById('admin-secret-input');
    if (!input) return;
    const value = (input.value || '').trim();
    if (!value) return;
    hideAuthError();
    verifySecret(value);
  }

  document.addEventListener('DOMContentLoaded', function() {
    const resetLinkAtLoad = consumeResetLink();
    window.addEventListener('hashchange', consumeResetLink);

    localStorage.removeItem(LEGACY_SECRET_KEY);

    const submitBtn = document.getElementById('admin-secret-submit');
    const input = document.getElementById('admin-secret-input');

    if (submitBtn) {
      submitBtn.addEventListener('click', submitSecret);
    }

    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          submitSecret();
        }
      });
    }

    document.querySelectorAll('.admin-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.admin-tab').forEach(function(btn) {
          btn.classList.remove('tab-active');
        });
        tab.classList.add('tab-active');
        renderProfiles(tab.dataset.filter);
      });
    });

    const profilesList = document.getElementById('profiles-list');
    if (profilesList) {
      profilesList.addEventListener('click', function(e) {
        const card = e.target.closest('.app-card');
        if (!card || !profilesList.contains(card)) return;

        const profileId = card.dataset.profileId;
        if (!profileId) return;

        const profiles = Array.isArray(window.adminProfiles) ? window.adminProfiles : [];
        const profil = profiles.find(function(p) {
          return p && String(p.id) === String(profileId);
        });
        if (profil) {
          openProfileDetail(profil, card);
        }
      });
    }

    const closeDetailBtn = document.getElementById('admin-detail-close-btn');
    const closeDetailBackdrop = document.getElementById('admin-detail-close-backdrop');
    if (closeDetailBtn) {
      closeDetailBtn.addEventListener('click', function() {
        if (typeof GlassDrawer !== 'undefined') {
          GlassDrawer.close('admin-detail-drawer');
        }
      });
    }
    if (closeDetailBackdrop) {
      closeDetailBackdrop.addEventListener('click', function() {
        if (typeof GlassDrawer !== 'undefined') {
          GlassDrawer.close('admin-detail-drawer');
        }
      });
    }

    const customToggle = document.getElementById('admin-detail-toggle-custom');
    const affectationSelect = document.getElementById('admin-detail-affectation-select');
    if (customToggle) {
      customToggle.addEventListener('change', applyDetailMode);
    }
    if (affectationSelect) {
      affectationSelect.addEventListener('change', function() {
        const toggle = document.getElementById('admin-detail-toggle-custom');
        if (toggle && !toggle.checked) {
          applyDetailMode();
        }
      });
    }

    const saveDetailBtn = document.getElementById('admin-detail-save-btn');
    if (saveDetailBtn) {
      saveDetailBtn.addEventListener('click', submitDetailSave);
    }

    const securityBtn = document.getElementById('admin-security-btn');
    if (securityBtn) {
      securityBtn.addEventListener('click', function() {
        if (typeof GlassDrawer !== 'undefined' && GlassDrawer.isOpen('admin-detail-drawer')) {
          GlassDrawer.close('admin-detail-drawer');
        }
        openSecurityDrawer(securityBtn);
      });
    }

    _watchSecurityDrawerClose();

    const securityCloseBtn = document.getElementById('admin-security-close-btn');
    const securityCloseBackdrop = document.getElementById('admin-security-close-backdrop');
    if (securityCloseBtn) {
      securityCloseBtn.addEventListener('click', closeSecurityDrawer);
    }
    if (securityCloseBackdrop) {
      securityCloseBackdrop.addEventListener('click', closeSecurityDrawer);
    }

    const securitySaveBtn = document.getElementById('admin-security-save');
    if (securitySaveBtn) {
      securitySaveBtn.addEventListener('click', submitSecretChange);
    }

    const passkeyAddBtn = document.getElementById('admin-passkeys-add');
    if (passkeyAddBtn) {
      passkeyAddBtn.addEventListener('click', _openPasskeyAddForm);
    }

    const passkeyAddConfirmBtn = document.getElementById('admin-passkeys-add-confirm');
    if (passkeyAddConfirmBtn) {
      passkeyAddConfirmBtn.addEventListener('click', _onPasskeyAddConfirmClick);
    }

    const passkeyAddCancelBtn = document.getElementById('admin-passkeys-add-cancel');
    if (passkeyAddCancelBtn) {
      passkeyAddCancelBtn.addEventListener('click', _cancelPasskeyAdd);
    }

    const passkeySecretField = document.getElementById('admin-passkeys-secret');
    if (passkeySecretField) {
      passkeySecretField.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        const confirmBtn = document.getElementById('admin-passkeys-add-confirm');
        if (!confirmBtn || confirmBtn.disabled) return;
        if ((confirmBtn.textContent || '').trim() !== 'VALIDER') return;
        _requestPasskeyOptions();
      });
    }

    ['admin-security-current', 'admin-security-new', 'admin-security-confirm'].forEach(function(id) {
      const field = document.getElementById(id);
      if (!field) return;
      field.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          submitSecretChange();
        }
      });
    });

    const forgotBtn = document.getElementById('admin-forgot-btn');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', requestAdminReset);
    }

    const resetSaveBtn = document.getElementById('admin-reset-save');
    if (resetSaveBtn) {
      resetSaveBtn.addEventListener('click', submitAdminReset);
    }

    const resetBackBtn = document.getElementById('admin-reset-back');
    if (resetBackBtn) {
      resetBackBtn.addEventListener('click', showAuthScreenFromReset);
    }

    ['admin-reset-new', 'admin-reset-confirm'].forEach(function(id) {
      const field = document.getElementById(id);
      if (!field) return;
      field.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          submitAdminReset();
        }
      });
    });

    document.querySelectorAll('.secret-toggle-btn').forEach(function(button) {
      button.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener('keyup', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        _toggleSecret(button);
      });
      button.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.detail === 0) return;
        _toggleSecret(button);
      });
    });

    const passkeyLoginBtn = document.getElementById('admin-passkey-login-btn');
    if (passkeyLoginBtn) {
      passkeyLoginBtn.addEventListener('click', _onPasskeyLoginClick);
    }

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        _stopLoginPasskey();
      } else {
        _prepareLoginPasskey(false);
      }
    });

    if (!resetLinkAtLoad) {
      const token = _readAdminSession();
      if (token) {
        openAdminWithToken(token, true);
      } else if (input) {
        input.focus();
      }
      _prepareLoginPasskey(false);
    }
  });
})();
