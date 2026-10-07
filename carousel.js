// ============================================================
// R8 LOT 3 — CARROUSEL DÉCOUVRIR LA FLOTTE (D143/D153)
// Données : window.TranquilityFleet (carousel-data.js)
// ============================================================

(function() {
  const fleet = window.TranquilityFleet;
  const panel = document.getElementById('carousel-panel');
  const trigger = document.getElementById('carousel-trigger');
  if (!panel || !trigger || !Array.isArray(fleet) || fleet.length === 0) return;

  const els = {
    counter: document.getElementById('carousel-counter'),
    slide: document.getElementById('carousel-slide'),
    video: document.getElementById('carousel-video'),
    placeholder: document.getElementById('carousel-placeholder'),
    status: document.getElementById('carousel-status'),
    type: document.getElementById('carousel-type'),
    name: document.getElementById('carousel-name'),
    motto: document.getElementById('carousel-motto'),
    translation: document.getElementById('carousel-translation'),
    hook: document.getElementById('carousel-hook'),
    body: document.getElementById('carousel-body'),
    forWho: document.getElementById('carousel-for'),
    prev: document.getElementById('carousel-prev'),
    next: document.getElementById('carousel-next'),
    dots: document.getElementById('carousel-dots'),
    connect: document.getElementById('carousel-connect'),
    close: document.getElementById('carousel-close')
  };

  const STATUS_LABELS = {
    orbite: 'En orbite',
    preparation: 'En préparation'
  };
  const TRANSITION_FALLBACK_MS = 400;
  const SWIPE_MIN_PX = 50;
  const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, video[controls], [tabindex]:not([tabindex="-1"])';

  const total = fleet.length;
  const dotButtons = [];

  let isOpen = false;
  let current = 0;
  let lastFocused = null;
  // Incrémentés pour invalider une fermeture ou un fondu en cours
  let panelToken = 0;
  let changeToken = 0;
  let isChanging = false;
  let targetIndex = 0;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function setText(el, value) {
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function normalizeIndex(index) {
    return ((index % total) + total) % total;
  }

  // Appelle done une seule fois : fin de la transition d'opacité de el, ou timer de secours
  function waitForOpacityTransition(el, done) {
    let finished = false;
    let timer = null;

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      el.removeEventListener('transitionend', onEnd);
      done();
    }

    function onEnd(e) {
      if (e.target === el && e.propertyName === 'opacity') finish();
    }

    el.addEventListener('transitionend', onEnd);
    timer = setTimeout(finish, TRANSITION_FALLBACK_MS);
  }

  // À compléter au prompt 5 (lecture, repli poster)
  function renderMedia(entry) {
    const video = els.video;
    const placeholder = els.placeholder;

    if (entry.video === null) {
      if (placeholder) placeholder.removeAttribute('hidden');
      if (video) video.setAttribute('hidden', '');
      return;
    }

    if (placeholder) placeholder.setAttribute('hidden', '');
    if (video) {
      video.removeAttribute('hidden');
      video.poster = entry.poster;
    }
  }

  function updateDots() {
    dotButtons.forEach(function(dot, i) {
      if (i === current) {
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.removeAttribute('aria-current');
      }
    });
  }

  function renderSlide() {
    const entry = fleet[current];

    setText(els.name, entry.name);
    setText(els.type, entry.type);
    setText(els.motto, entry.motto);
    setText(els.translation, entry.translation);
    setText(els.hook, entry.hook);
    setText(els.body, entry.body);
    setText(els.forWho, entry.forWho);

    if (els.status) {
      setText(els.status, STATUS_LABELS[entry.status] || '');
      els.status.setAttribute('data-status', entry.status);
    }

    setText(els.counter, pad2(current + 1) + ' / ' + pad2(total));
    renderMedia(entry);
    updateDots();
  }

  function cancelChange() {
    changeToken++;
    isChanging = false;
    if (els.slide) els.slide.classList.remove('is-changing');
  }

  function goTo(index) {
    const next = normalizeIndex(index);

    if (isChanging) {
      targetIndex = next;
      return;
    }
    if (next === current) return;

    if (prefersReducedMotion() || !els.slide) {
      current = next;
      renderSlide();
      return;
    }

    const token = ++changeToken;
    isChanging = true;
    targetIndex = next;
    els.slide.classList.add('is-changing');

    waitForOpacityTransition(els.slide, function() {
      if (token !== changeToken) return;
      current = targetIndex;
      renderSlide();
      els.slide.classList.remove('is-changing');
      isChanging = false;
    });
  }

  // Index de référence pour une navigation relative, y compris pendant un fondu
  function baseIndex() {
    return isChanging ? targetIndex : current;
  }

  function goNext() {
    goTo(baseIndex() + 1);
  }

  function goPrev() {
    goTo(baseIndex() - 1);
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    const token = ++panelToken;

    lastFocused = document.activeElement;
    cancelChange();
    current = 0;
    targetIndex = 0;
    renderSlide();

    panel.removeAttribute('hidden');
    panel.setAttribute('tabindex', '-1');
    panel.focus();

    requestAnimationFrame(function() {
      if (token !== panelToken || !isOpen) return;
      panel.classList.add('is-open');
    });
  }

  function closePanel(callback, restoreFocus) {
    if (!isOpen) return;
    isOpen = false;
    const token = ++panelToken;
    const focusTarget = lastFocused;

    function finish() {
      if (token !== panelToken) return;
      panel.setAttribute('hidden', '');
      cancelChange();
      if (restoreFocus && focusTarget && document.contains(focusTarget) && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
      }
      if (typeof callback === 'function') callback();
    }

    panel.classList.remove('is-open');

    if (prefersReducedMotion()) {
      finish();
    } else {
      waitForOpacityTransition(panel, finish);
    }
  }

  function close(callback) {
    closePanel(callback, true);
  }

  function getFocusable() {
    return Array.prototype.filter.call(panel.querySelectorAll(FOCUSABLE_SELECTOR), function(el) {
      return !el.disabled && !el.closest('[hidden]') && el.getClientRects().length > 0;
    });
  }

  function trapTab(e) {
    const focusable = getFocusable();
    if (focusable.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const outside = !panel.contains(active) || active === panel;

    if (e.shiftKey && (outside || active === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (outside || active === last)) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKeydown(e) {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      trapTab(e);
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        goPrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        goNext();
        break;
      case 'Home':
        e.preventDefault();
        goTo(0);
        break;
      case 'End':
        e.preventDefault();
        goTo(total - 1);
        break;
    }
  }

  function buildDots() {
    if (!els.dots) return;
    fleet.forEach(function(entry, i) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', 'Slide ' + (i + 1) + ' sur ' + total + ' : ' + entry.name);
      dot.addEventListener('click', function() {
        goTo(i);
      });
      els.dots.appendChild(dot);
      dotButtons.push(dot);
    });
  }

  function bindSwipe() {
    if (!els.slide) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    els.slide.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    els.slide.addEventListener('touchend', function(e) {
      if (!tracking || !isOpen) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goNext();
        else goPrev();
      }
    }, { passive: true });
  }

  buildDots();
  renderSlide();
  bindSwipe();

  trigger.addEventListener('click', open);
  if (els.prev) els.prev.addEventListener('click', goPrev);
  if (els.next) els.next.addEventListener('click', goNext);
  if (els.close) {
    els.close.addEventListener('click', function() {
      close();
    });
  }
  if (els.connect) {
    els.connect.addEventListener('click', function() {
      closePanel(function() {
        if (typeof window.showProfileSelector === 'function') {
          window.showProfileSelector(document.getElementById('connect-trigger'));
        }
      }, false);
    });
  }
  document.addEventListener('keydown', onKeydown);

  window.TranquilityCarousel = { open: open, close: close };
})();
