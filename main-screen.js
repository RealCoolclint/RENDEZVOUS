// ============================================================
// ÉCRAN PRINCIPAL — ÉTAPE B : RANGÉE DE TUILES
// Données : window.TranquilityFleet (carousel-data.js)
// Entrées : document 'r6:ready' / 'r6:logout' (app.js)
// Sortie  : document 'main:select' { id }
// ============================================================

(function() {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const STATE_LABELS = {
    open: 'Ouverte',
    locked: 'Verrouillée',
    preparation: 'En préparation'
  };

  let selectedId = null;
  let tiles = [];
  let els = null;

  function getHost() {
    const screen = document.getElementById('mainScreen');
    return screen ? screen.querySelector('.main-row-host') : null;
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function(key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function chevron(direction) {
    const svg = svgEl('svg', { viewBox: '0 0 24 24', width: '18', height: '18', 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgEl('path', {
      d: direction === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
    return svg;
  }

  function lockIcon() {
    const svg = svgEl('svg', { viewBox: '0 0 24 24', width: '14', height: '14', 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgEl('rect', {
      x: '5', y: '11', width: '14', height: '10', rx: '2',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2'
    }));
    svg.appendChild(svgEl('path', {
      d: 'M8 11V7a4 4 0 0 1 8 0v4',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round'
    }));
    return svg;
  }

  function stateOf(app, userApps) {
    if (app.status === 'preparation') return 'preparation';
    return userApps.indexOf(app.id) !== -1 ? 'open' : 'locked';
  }

  function orderedApps(userApps) {
    const fleet = Array.isArray(window.TranquilityFleet) ? window.TranquilityFleet : [];
    const items = fleet
      .filter(function(app) { return app && app.id; })
      .map(function(app) { return { app: app, state: stateOf(app, userApps) }; });
    const open = items.filter(function(item) { return item.state === 'open'; });
    const others = items.filter(function(item) { return item.state !== 'open'; });
    return open.concat(others);
  }

  function fleetTitle(prenom) {
    if (!prenom) return 'Ta flotte';
    const elision = /^[aeiouyàâäéèêëîïôöùûü]/i.test(prenom);
    return (elision ? 'Flotte d’' : 'Flotte de ') + prenom;
  }

  function fleetSubtitle(openCount, affectation) {
    const base = openCount + (openCount > 1 ? ' apps' : ' app') + ' pour toi';
    return affectation ? base + ' · Affectation ' + affectation : base;
  }

  function buildTile(item) {
    const app = item.app;
    const name = app.name || app.id;

    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'main-tile';
    tile.dataset.appId = app.id;
    tile.dataset.state = item.state;
    tile.setAttribute('aria-label', name + ', ' + STATE_LABELS[item.state].toLowerCase());

    const disc = document.createElement('span');
    disc.className = 'main-tile-disc';
    disc.setAttribute('aria-hidden', 'true');

    if (app.poster) {
      const img = document.createElement('img');
      img.className = 'main-tile-img';
      img.src = app.poster;
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      disc.appendChild(img);
    } else {
      disc.classList.add('main-tile-disc--empty');
      const fallback = document.createElement('span');
      fallback.className = 'main-tile-fallback';
      fallback.textContent = name;
      disc.appendChild(fallback);
    }

    if (item.state === 'locked') {
      const lock = document.createElement('span');
      lock.className = 'main-tile-lock';
      lock.appendChild(lockIcon());
      disc.appendChild(lock);
    }

    const label = document.createElement('span');
    label.className = 'main-tile-name';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = name;

    const state = document.createElement('span');
    state.className = 'main-tile-state';
    state.setAttribute('aria-hidden', 'true');
    state.textContent = item.state === 'open' ? '' : STATE_LABELS[item.state];

    tile.appendChild(disc);
    tile.appendChild(label);
    tile.appendChild(state);
    return tile;
  }

  function buildShell() {
    const root = document.createElement('div');
    root.className = 'main-row';

    const head = document.createElement('div');
    head.className = 'main-row-head';

    const titles = document.createElement('div');
    titles.className = 'main-row-titles';
    const title = document.createElement('h2');
    title.className = 'main-row-title';
    title.id = 'main-row-title';
    const subtitle = document.createElement('p');
    subtitle.className = 'main-row-subtitle';
    titles.appendChild(title);
    titles.appendChild(subtitle);

    const controls = document.createElement('div');
    controls.className = 'main-row-controls';
    const counter = document.createElement('span');
    counter.className = 'main-row-counter';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'main-row-nav';
    prev.setAttribute('aria-label', 'App précédente');
    prev.appendChild(chevron('prev'));
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'main-row-nav';
    next.setAttribute('aria-label', 'App suivante');
    next.appendChild(chevron('next'));
    controls.appendChild(counter);
    controls.appendChild(prev);
    controls.appendChild(next);

    head.appendChild(titles);
    head.appendChild(controls);

    const group = document.createElement('div');
    group.className = 'main-tiles';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', 'main-row-title');

    root.appendChild(head);
    root.appendChild(group);

    prev.addEventListener('click', function() { step(-1, false); });
    next.addEventListener('click', function() { step(1, false); });
    group.addEventListener('click', function(e) {
      const tile = e.target.closest('.main-tile');
      if (tile && group.contains(tile)) select(tile.dataset.appId, { focus: false });
    });
    group.addEventListener('keydown', onKeydown);

    return { root: root, title: title, subtitle: subtitle, counter: counter, group: group };
  }

  function indexOfSelected() {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].dataset.appId === selectedId) return i;
    }
    return -1;
  }

  function scrollTileIntoView(tile, instant) {
    const group = els.group;
    if (group.scrollWidth <= group.clientWidth) return;
    const left = tile.offsetLeft - (group.clientWidth - tile.offsetWidth) / 2;
    const max = group.scrollWidth - group.clientWidth;
    group.scrollTo({
      left: Math.max(0, Math.min(max, left)),
      behavior: instant || prefersReducedMotion() ? 'auto' : 'smooth'
    });
  }

  function applySelection(instant) {
    const index = indexOfSelected();
    tiles.forEach(function(tile, i) {
      const isSelected = i === index;
      tile.classList.toggle('is-selected', isSelected);
      tile.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      tile.tabIndex = isSelected ? 0 : -1;
    });
    els.counter.textContent = pad2(index + 1) + ' / ' + pad2(tiles.length);
    if (index !== -1) scrollTileIntoView(tiles[index], instant);
  }

  function select(id, options) {
    const opts = options || {};
    if (!els || !id) return;
    const changed = id !== selectedId;
    selectedId = id;
    applySelection(!!opts.instant);
    if (opts.focus) {
      const tile = tiles[indexOfSelected()];
      if (tile) tile.focus({ preventScroll: true });
    }
    if (changed) {
      document.dispatchEvent(new CustomEvent('main:select', { detail: { id: id } }));
    }
  }

  function step(delta, focus) {
    if (tiles.length === 0) return;
    const total = tiles.length;
    const index = ((indexOfSelected() + delta) % total + total) % total;
    select(tiles[index].dataset.appId, { focus: focus });
  }

  function onKeydown(e) {
    if (tiles.length === 0) return;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
        step(-1, true);
        break;
      case 'ArrowRight':
        step(1, true);
        break;
      case 'Home':
        select(tiles[0].dataset.appId, { focus: true });
        break;
      case 'End':
        select(tiles[tiles.length - 1].dataset.appId, { focus: true });
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  }

  function render(detail) {
    const host = getHost();
    if (!host) return;

    const userApps = Array.isArray(detail.apps) ? detail.apps : [];
    const items = orderedApps(userApps);
    const openCount = items.filter(function(item) { return item.state === 'open'; }).length;

    const hadFocus = !!(els && els.group.contains(document.activeElement));

    host.replaceChildren();
    els = buildShell();
    els.title.textContent = fleetTitle(cleanText(detail.prenom));
    els.subtitle.textContent = fleetSubtitle(openCount, cleanText(detail.affectation));

    tiles = items.map(buildTile);
    tiles.forEach(function(tile) { els.group.appendChild(tile); });
    host.appendChild(els.root);

    if (tiles.length === 0) {
      selectedId = null;
      els.counter.textContent = '00 / 00';
      return;
    }

    const keep = tiles.some(function(tile) { return tile.dataset.appId === selectedId; });
    select(keep ? selectedId : tiles[0].dataset.appId, { instant: true, focus: hadFocus });
  }

  function clear() {
    const host = getHost();
    if (host) host.replaceChildren();
    els = null;
    tiles = [];
    selectedId = null;
  }

  document.addEventListener('r6:ready', function(e) {
    render((e && e.detail) || {});
  });
  document.addEventListener('r6:logout', clear);

  // MODE APERÇU — local uniquement, ?preview=1
  const isLocalHost = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  const wantsPreview = new URLSearchParams(location.search).get('preview') === '1';
  if (isLocalHost && wantsPreview) {
    const runPreview = function() {
      document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
      const connected = document.getElementById('connectedView');
      if (connected) connected.classList.add('active');
      document.dispatchEvent(new CustomEvent('r6:ready', {
        detail: {
          niveau: 'N2',
          apps: ['reviewer', 'manifest', 'codex'],
          affectation: 'GUMDROP',
          email: 'preview@local',
          prenom: 'Antoine'
        }
      }));
    };
    // onMercuryComplete rebascule sur la vitrine : l'aperçu doit passer après.
    const previousMercury = window.onMercuryComplete;
    window.onMercuryComplete = function() {
      if (typeof previousMercury === 'function') previousMercury();
      runPreview();
    };
  }
})();
