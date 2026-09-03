(function() {
  const ADMIN_LIST_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-list-profiles';
  const ADMIN_UPDATE_URL =
    'https://rendezvous-proxy-tranquility.netlify.app/.netlify/functions/admin-update-profile';
  const STORAGE_KEY = 'admin_secret';

  function _storeAdminSecret(secret) {
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ value: secret, expiresAt: expiresAt }));
  }

  function _readAdminSecret() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.value !== 'string' || typeof parsed.expiresAt !== 'number') {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed.value;
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function _clearAdminSecret() {
    localStorage.removeItem(STORAGE_KEY);
  }

  let selectedAction = null;

  // ATTENTION : cette table est dupliquée depuis AFFECTATIONS dans
  // rendezvous-proxy/netlify/functions/admin-update-profile.js.
  // Si la liste des affectations change côté serveur, penser à synchroniser ici aussi.
  const AFFECTATIONS = {
    "COLUMBIA":       { niveau: "N1", apps: ["backupflow", "transporter", "manifest", "reviewer", "ark", "rover", "covenant"] },
    "GUMDROP":        { niveau: "N2", apps: ["transporter", "reviewer", "ark", "rover", "covenant"] },
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

    let label = '';
    let action = '';
    if (profil.statut === 'pending') {
      label = 'VALIDER';
      action = 'activer';
    } else if (profil.statut === 'active') {
      label = 'ARCHIVER';
      action = 'archiver';
    } else if (profil.statut === 'archived') {
      label = 'RÉACTIVER';
      action = 'reactiver';
    } else {
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ps-connect-btn ps-connect-btn--drawer admin-detail-status-btn';
    btn.dataset.action = action;
    btn.textContent = label;
    btn.addEventListener('click', function() {
      selectedAction = btn.dataset.action;
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
        } else if (selectedAction === 'reactiver') {
          previewEl.textContent = 'Action sélectionnée : réactiver ce profil';
          previewEl.classList.add('admin-detail-action-preview--success');
        }
      }
    });
    container.appendChild(btn);
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

  function showToast(type, message) {
    const container = document.getElementById('toasts');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function() {
      toast.style.transition = 'opacity 300ms ease';
      toast.style.opacity = '0';
      setTimeout(function() {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  async function refreshProfilesList() {
    const secret = _readAdminSecret();
    if (!secret) return;

    try {
      const response = await fetch(ADMIN_LIST_URL, {
        method: 'GET',
        headers: {
          'x-admin-secret': secret
        }
      });

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

      const secret = _readAdminSecret();
      const response = await fetch(ADMIN_UPDATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        if (selectedAction === 'activer') {
          showToast('success', 'Profil validé — email envoyé.');
        } else if (selectedAction === 'reactiver') {
          showToast('success', 'Profil réactivé.');
        } else if (selectedAction === 'archiver') {
          showToast('warning', 'Profil archivé.');
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
        errorEl.textContent = (data && data.error) ? data.error : 'Erreur serveur, réessaie.';
        errorEl.style.display = 'block';
      }
    } catch (_) {
      const errorEl = document.getElementById('admin-detail-action-error');
      if (errorEl) {
        errorEl.textContent = 'Erreur de connexion, réessaie.';
        errorEl.style.display = 'block';
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  }

  async function verifySecret(secret, isAutoCheck) {
    const submitBtn = document.getElementById('admin-secret-submit');
    const input = document.getElementById('admin-secret-input');
    const originalText = submitBtn ? submitBtn.textContent : 'Valider';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Vérification…';
    }

    try {
      const response = await fetch(ADMIN_LIST_URL, {
        method: 'GET',
        headers: {
          'x-admin-secret': secret
        }
      });

      if (response.ok) {
        let result = null;
        try {
          result = await response.json();
        } catch (_) {}

        _storeAdminSecret(secret);
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
        if (isAutoCheck) {
          _clearAdminSecret();
          showAuthError('Ta session a expiré, resaisis le secret.');
          if (input) input.focus();
        } else {
          showAuthError('Secret invalide.');
        }
        return;
      }

      showAuthError('Erreur de connexion, réessaie.');
    } catch (_) {
      showAuthError('Erreur de connexion, réessaie.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
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
    verifySecret(value, false);
  }

  document.addEventListener('DOMContentLoaded', function() {
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

    const stored = _readAdminSecret();
    if (stored) {
      verifySecret(stored, true);
    } else if (input) {
      input.focus();
    }
  });
})();
