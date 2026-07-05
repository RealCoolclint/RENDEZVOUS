// ============================================================
// GLASS DRAWER — morph organique depuis le bouton
// ============================================================

const GlassDrawer = (function() {
  const OPEN_MS = 480;
  const CLOSE_MS = 240;
  const PANEL_WIDTH = 440;
  const PANEL_HEIGHT_FALLBACK = 456;
  const VIEWPORT_MARGIN = 24;
  let _activeId = null;

  function _drawer(id) {
    return document.getElementById(id);
  }

  function _panel(drawer) {
    return drawer?.querySelector('.glass-drawer-panel');
  }

  function _bloom(drawer) {
    return drawer?.querySelector('.glass-drawer-bloom');
  }

  function _storedHeight(drawer) {
    const panel = _panel(drawer);
    if (!panel) return PANEL_HEIGHT_FALLBACK;
    const stored = parseFloat(panel.dataset.layoutH || '');
    return stored > 0 ? stored : PANEL_HEIGHT_FALLBACK;
  }

  function _computeLayout(trigger, panelH) {
    const btn = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const panelW = Math.min(PANEL_WIDTH, vw - VIEWPORT_MARGIN * 2);
    const h = Math.min(panelH, vh - VIEWPORT_MARGIN * 2);

    let panelX = btn.left + btn.width / 2 - panelW / 2;
    panelX = Math.max(VIEWPORT_MARGIN, Math.min(panelX, vw - panelW - VIEWPORT_MARGIN));

    const btnCy = btn.top + btn.height / 2;
    let panelY = btnCy - h / 2;
    const fits =
      panelY >= VIEWPORT_MARGIN &&
      panelY + h <= vh - VIEWPORT_MARGIN;

    if (!fits) {
      panelY = (vh - h) / 2;
    }

    panelY = Math.max(VIEWPORT_MARGIN, Math.min(panelY, vh - h - VIEWPORT_MARGIN));

    const originX = btn.left + btn.width / 2 - panelX;
    const originY = btn.top + btn.height / 2 - panelY;
    const morphScale = Math.max(btn.width / panelW, btn.height / h, 0.045);

    return { btn, panelW, panelH: h, panelX, panelY, originX, originY, morphScale };
  }

  function _applyLayout(drawerId, trigger, panelH) {
    const drawer = _drawer(drawerId);
    const panel = _panel(drawer);
    const bloom = _bloom(drawer);
    if (!drawer || !panel || !trigger) return;

    const layout = _computeLayout(trigger, panelH);
    panel.dataset.layoutH = String(layout.panelH);

    drawer.style.setProperty('--panel-x', layout.panelX + 'px');
    drawer.style.setProperty('--panel-y', layout.panelY + 'px');
    drawer.style.setProperty('--panel-w', layout.panelW + 'px');
    drawer.style.setProperty('--origin-x', layout.originX + 'px');
    drawer.style.setProperty('--origin-y', layout.originY + 'px');
    drawer.style.setProperty('--morph-scale', String(layout.morphScale));

    if (bloom) {
      bloom.style.setProperty('--bloom-x', layout.btn.left + 'px');
      bloom.style.setProperty('--bloom-y', layout.btn.top + 'px');
      bloom.style.setProperty('--bloom-w', layout.btn.width + 'px');
      bloom.style.setProperty('--bloom-h', layout.btn.height + 'px');
    }
  }

  function _measurePanel(drawerId) {
    const drawer = _drawer(drawerId);
    const panel = _panel(drawer);
    if (!drawer || !panel) return PANEL_HEIGHT_FALLBACK;

    if (drawer.classList.contains('is-open')) {
      return panel.offsetHeight || PANEL_HEIGHT_FALLBACK;
    }

    drawer.classList.add('is-measuring');
    drawer.setAttribute('aria-hidden', 'false');

    const height = panel.offsetHeight;

    drawer.classList.remove('is-measuring');
    drawer.setAttribute('aria-hidden', 'true');

    return height > 0 ? height : PANEL_HEIGHT_FALLBACK;
  }

  function setOrigin(drawerId, trigger) {
    const drawer = _drawer(drawerId);
    if (!drawer || !trigger) return;
    _applyLayout(drawerId, trigger, _storedHeight(drawer));
  }

  function refit(drawerId) {
    const drawer = _drawer(drawerId);
    const panel = _panel(drawer);
    const trigger = _defaultTrigger(drawerId);
    if (!drawer || !panel || !trigger || !drawer.classList.contains('is-open')) return;

    drawer.classList.add('is-refitting');
    const measured = _measurePanel(drawerId);
    _applyLayout(drawerId, trigger, measured);
    requestAnimationFrame(function() {
      drawer.classList.remove('is-refitting');
    });
  }

  function _defaultTrigger(drawerId) {
    if (drawerId === 'inscription-drawer') {
      return document.getElementById('inscription-trigger')
        || document.querySelector('.vitrine-cta-secondary');
    }
    if (drawerId === 'connect-drawer') {
      return document.getElementById('connect-trigger')
        || document.querySelector('.vitrine-cta-primary');
    }
    return null;
  }

  function _closeInstant(otherId) {
    const other = _drawer(otherId);
    if (!other || !other.classList.contains('is-open')) return;
    other.classList.remove('is-open', 'is-animating', 'is-closing', 'is-measuring', 'is-refitting');
    other.setAttribute('aria-hidden', 'true');
  }

  function open(drawerId, triggerEl, options) {
    const drawer = _drawer(drawerId);
    if (!drawer || drawer.classList.contains('is-open')) return;

    const opts = options || {};
    if (opts.closeOther !== false) {
      if (drawerId === 'inscription-drawer') _closeInstant('connect-drawer');
      if (drawerId === 'connect-drawer') _closeInstant('inscription-drawer');
    }

    const trigger = triggerEl || _defaultTrigger(drawerId);
    const measuredH = _measurePanel(drawerId);
    if (trigger) _applyLayout(drawerId, trigger, measuredH);

    drawer.classList.add('is-animating');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('glass-drawer-open');
    _activeId = drawerId;

    requestAnimationFrame(function() {
      drawer.classList.add('is-open');
    });

    if (typeof opts.onOpen === 'function') opts.onOpen();

    setTimeout(function() {
      drawer.classList.remove('is-animating');
      if (typeof opts.onOpened === 'function') opts.onOpened();
    }, OPEN_MS);
  }

  function close(drawerId, options) {
    const drawer = _drawer(drawerId);
    if (!drawer || !drawer.classList.contains('is-open')) return;

    const opts = options || {};
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = prefersReduced ? 120 : CLOSE_MS;

    const trigger = _defaultTrigger(drawerId);
    if (trigger) setOrigin(drawerId, trigger);

    drawer.classList.add('is-animating', 'is-closing');
    drawer.classList.remove('is-open');
    document.body.classList.add('glass-drawer-closing');

    setTimeout(function() {
      document.body.classList.remove('glass-drawer-closing');
      if (!_anyOpen()) document.body.classList.remove('glass-drawer-open');
      drawer.classList.remove('is-animating', 'is-closing');
      drawer.setAttribute('aria-hidden', 'true');
      if (_activeId === drawerId) _activeId = null;
      if (typeof opts.onClosed === 'function') opts.onClosed();
    }, delay);
  }

  function _anyOpen() {
    return document.querySelector('.glass-drawer.is-open') !== null;
  }

  function closeActive() {
    if (_activeId) close(_activeId);
  }

  function isOpen(drawerId) {
    const drawer = _drawer(drawerId);
    return drawer ? drawer.classList.contains('is-open') : false;
  }

  window.addEventListener('resize', function() {
    document.querySelectorAll('.glass-drawer.is-open').forEach(function(drawer) {
      refit(drawer.id);
    });
  });

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    const openDrawer = document.querySelector('.glass-drawer.is-open');
    if (!openDrawer) return;
    if (openDrawer.hasAttribute('data-no-escape')) return;
    const rgpdView = document.getElementById('inscription-rgpd-view');
    if (openDrawer.id === 'inscription-drawer' && rgpdView && !rgpdView.hasAttribute('hidden')) {
      closeRgpdNotice();
      return;
    }
    if (openDrawer.id === 'inscription-drawer' && typeof closeInscription === 'function') {
      closeInscription();
    } else if (openDrawer.id === 'connect-drawer' && typeof closeConnect === 'function') {
      closeConnect();
    } else {
      close(openDrawer.id);
    }
  });

  return { open, close, closeActive, isOpen, setOrigin, refit, OPEN_MS, CLOSE_MS };
})();
