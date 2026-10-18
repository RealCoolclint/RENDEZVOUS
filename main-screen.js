// ============================================================
// ÉCRAN PRINCIPAL — ÉTAPES B ET C : RANGÉE DE TUILES, SCÈNE ET FICHE
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
  const SHEET_STATUS_LABELS = {
    open: 'Disponible',
    locked: 'Verrouillée',
    preparation: 'En préparation'
  };
  const APP_URL_PREFIX = 'https://realcoolclint.github.io/';
  const DESKTOP_NOTE = 'Application installée sur ton Mac, ouverture depuis le portail bientôt disponible.';
  const REQUIREMENT_FALLBACK = 'Affectation requise';
  const REQUEST_LABEL = 'Demander une affectation';
  const REQUEST_PENDING_LABEL = 'Envoi...';
  const REQUEST_SENT_LABEL = 'Demande envoyée';
  const REQUEST_SENT_MESSAGE = "Demande transmise — l'équipe Tranquility prend contact avec toi.";
  const REQUEST_ERROR_MESSAGE = 'Erreur réseau, réessaie.';
  const DETAILS_ID = 'main-details';
  const DETAILS_OPEN_LABEL = 'Détails';
  const DETAILS_CLOSE_LABEL = 'Replier les détails';
  const DETAILS_EMPTY_AFFECTATION = 'À définir';
  const TRANSITION_FALLBACK_MS = 400;
  const MEDIA_READY_MAX_MS = 600;
  // Bord extérieur du patch dans chaque vidéo, en % du demi-côté (mesuré sur images extraites, +1 % de marge).
  // À remesurer si une vidéo de patch change.
  const PATCH_EDGES = {
    ark: 99,
    backupflow: 101,
    codex: 95,
    covenant: 78,
    manifest: 93,
    reviewer: 101,
    rover: 97,
    transporter: 101
  };

  let selectedId = null;
  let tiles = [];
  let itemsById = {};
  let els = null;

  // Scène et fiche : même mécanique de fondu que carousel.js
  let stage = null;
  let currentItem = null;
  let targetItem = null;
  let changeToken = 0;
  let isChanging = false;
  let awaitingMedia = false;

  // Demandes d'affectation : les envois réussis sont tracés par R6 (localStorage),
  // seuls les envois en cours restent en mémoire, vidée au logout
  let niveau = null;
  let sessionId = 0;
  let pendingRequests = new Set();
  let previewRequest = null;

  // Panneau Détails : reste ouvert d'une app à l'autre, refermé au logout et par Échap
  let detailsOpen = false;

  function getScreen() {
    return document.getElementById('mainScreen');
  }

  function getHost() {
    const screen = getScreen();
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

  // ---------- Scène et fiche ----------

  function setText(el, value) {
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function carouselIsOpen() {
    const panel = document.getElementById('carousel-panel');
    return !!panel && !panel.hasAttribute('hidden');
  }

  function canPlay() {
    return !document.hidden && !carouselIsOpen();
  }

  // Lecture refusée par le navigateur : le poster reste affiché, sans erreur console
  function playVideo(video) {
    try {
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') promise.catch(function() {});
    } catch (e) {}
  }

  function releaseVideo(video) {
    video.pause();
    if (video.hasAttribute('src')) {
      video.removeAttribute('src');
      video.load();
    }
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

  // Appelle done une seule fois : média de app prêt, ou timer de secours
  function waitForMedia(app, done) {
    const video = stage.video;
    let finished = false;
    let timer = null;
    let img = null;

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('error', finish);
      if (img) img.onload = img.onerror = null;
      done();
    }

    if (app.video) {
      if (video.readyState >= 2) {
        finish();
        return;
      }
      video.addEventListener('loadeddata', finish);
      video.addEventListener('error', finish);
    } else if (app.poster) {
      img = new Image();
      img.onload = img.onerror = finish;
      img.src = app.poster;
      if (img.complete) {
        finish();
        return;
      }
    } else {
      finish();
      return;
    }

    timer = setTimeout(finish, MEDIA_READY_MAX_MS);
  }

  function buildStage() {
    const root = document.createElement('div');
    root.className = 'main-stage';

    const scene = document.createElement('div');
    scene.className = 'main-scene';
    scene.setAttribute('aria-hidden', 'true');

    const media = document.createElement('div');
    media.className = 'main-scene-media';

    const video = document.createElement('video');
    video.className = 'main-scene-video';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.hidden = true;

    const img = document.createElement('img');
    img.className = 'main-scene-img';
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.hidden = true;

    const placeholder = document.createElement('div');
    placeholder.className = 'main-scene-placeholder';
    placeholder.hidden = true;
    const placeholderName = document.createElement('span');
    placeholderName.className = 'main-scene-placeholder-name';
    const placeholderNote = document.createElement('span');
    placeholderNote.className = 'main-scene-placeholder-note';
    placeholderNote.textContent = 'Patch de mission en production';
    placeholder.appendChild(placeholderName);
    placeholder.appendChild(placeholderNote);

    media.appendChild(video);
    media.appendChild(img);
    media.appendChild(placeholder);
    scene.appendChild(media);

    const veil = document.createElement('div');
    veil.className = 'main-veil';
    veil.setAttribute('aria-hidden', 'true');

    const sheet = document.createElement('div');
    sheet.className = 'main-sheet';

    const meta = document.createElement('div');
    meta.className = 'main-sheet-meta';
    const status = document.createElement('span');
    status.className = 'main-sheet-status';
    const type = document.createElement('span');
    type.className = 'main-sheet-type';
    meta.appendChild(status);
    meta.appendChild(type);

    const requirement = document.createElement('p');
    requirement.className = 'main-sheet-requirement';
    requirement.textContent = 'Affectation requise';
    requirement.hidden = true;

    const name = document.createElement('h3');
    name.className = 'main-sheet-name';
    const motto = document.createElement('p');
    motto.className = 'main-sheet-motto';
    const translation = document.createElement('p');
    translation.className = 'main-sheet-translation';
    const mission = document.createElement('p');
    mission.className = 'main-sheet-mission';
    const actions = document.createElement('div');
    actions.className = 'main-actions';
    const note = document.createElement('p');
    note.className = 'main-actions-note';
    note.setAttribute('role', 'status');
    note.setAttribute('aria-live', 'polite');
    actions.appendChild(note);

    sheet.appendChild(meta);
    sheet.appendChild(requirement);
    sheet.appendChild(name);
    sheet.appendChild(motto);
    sheet.appendChild(translation);
    sheet.appendChild(mission);
    sheet.appendChild(actions);

    const details = buildDetails();

    root.appendChild(scene);
    root.appendChild(veil);
    root.appendChild(sheet);
    root.appendChild(details.root);

    return {
      root: root, scene: scene, video: video, img: img,
      placeholder: placeholder, placeholderName: placeholderName,
      status: status, type: type, requirement: requirement,
      name: name, motto: motto, translation: translation, mission: mission,
      actions: actions, note: note, details: details
    };
  }

  function detailsColumn(label) {
    const col = document.createElement('div');
    col.className = 'main-details-col';
    const title = document.createElement('h4');
    title.className = 'main-details-label';
    title.textContent = label;
    col.appendChild(title);
    return col;
  }

  function detailsText(className) {
    const p = document.createElement('p');
    p.className = className;
    return p;
  }

  function buildDetails() {
    const root = document.createElement('section');
    root.id = DETAILS_ID;
    root.className = 'main-details';
    root.setAttribute('aria-label', 'Détails');

    const mottoCol = detailsColumn('Devise');
    const motto = detailsText('main-details-strong');
    const translation = detailsText('main-details-text');
    mottoCol.appendChild(motto);
    mottoCol.appendChild(translation);

    const missionCol = detailsColumn('En mission');
    const detail = detailsText('main-details-text');
    missionCol.appendChild(detail);

    const affectationsCol = detailsColumn('Affectations');
    const chips = document.createElement('ul');
    chips.className = 'main-details-chips';
    affectationsCol.appendChild(chips);

    const platformCol = detailsColumn('Plateforme');
    const type = detailsText('main-details-strong');
    const platformNote = detailsText('main-details-text');
    platformCol.appendChild(type);
    platformCol.appendChild(platformNote);

    root.appendChild(mottoCol);
    root.appendChild(missionCol);
    root.appendChild(affectationsCol);
    root.appendChild(platformCol);

    return {
      root: root, motto: motto, translation: translation, detail: detail,
      chips: chips, type: type, platformNote: platformNote
    };
  }

  // Affectations : uniquement celles que R6 (app.js) déclare pour l'app
  function affectationsOf(app) {
    if (typeof R6 === 'undefined' || !R6 || typeof R6.affectationsFor !== 'function') return [];
    const list = R6.affectationsFor(app.id);
    return Array.isArray(list) ? list : [];
  }

  function renderDetails(app) {
    const details = stage.details;
    setText(details.motto, app.motto);
    setText(details.translation, app.translation);
    setText(details.detail, app.detail);
    setText(details.type, app.type);
    setText(details.platformNote, app.platformNote);

    details.chips.replaceChildren();
    const names = affectationsOf(app)
      .map(function(entry) { return entry && cleanText(entry.nom); })
      .filter(Boolean);
    if (names.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'main-details-chip main-details-chip--empty';
      empty.textContent = DETAILS_EMPTY_AFFECTATION;
      details.chips.appendChild(empty);
      return;
    }
    names.forEach(function(nom) {
      const chip = document.createElement('li');
      chip.className = 'main-details-chip';
      chip.textContent = nom;
      details.chips.appendChild(chip);
    });
  }

  function detailsToggle() {
    return stage ? stage.actions.querySelector('.main-details-toggle') : null;
  }

  function applyDetailsToggleState(button) {
    button.setAttribute('aria-expanded', detailsOpen ? 'true' : 'false');
    button.textContent = detailsOpen ? DETAILS_CLOSE_LABEL : DETAILS_OPEN_LABEL;
  }

  function setDetailsOpen(open) {
    detailsOpen = !!open;
    if (!stage) return;
    stage.root.classList.toggle('is-details-open', detailsOpen);
    const button = detailsToggle();
    if (button) applyDetailsToggleState(button);
  }

  function buildDetailsToggle() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'main-cta main-cta--ghost main-details-toggle';
    button.setAttribute('aria-controls', DETAILS_ID);
    applyDetailsToggleState(button);
    button.addEventListener('click', function() {
      setDetailsOpen(!detailsOpen);
    });
    return button;
  }

  function onDetailsKeydown(e) {
    if (e.key !== 'Escape' || !detailsOpen || !stage || carouselIsOpen()) return;
    const screen = getScreen();
    const target = e.target;
    if (target !== document.body && !(screen && screen.contains(target))) return;
    setDetailsOpen(false);
    const button = detailsToggle();
    if (button) button.focus();
  }

  function ensureStage() {
    if (stage) return stage;
    const screen = getScreen();
    if (!screen) return null;
    stage = buildStage();
    stage.root.classList.toggle('is-details-open', detailsOpen);
    screen.appendChild(stage.root);
    return stage;
  }

  function renderSheet(item) {
    const app = item.app;
    stage.status.textContent = SHEET_STATUS_LABELS[item.state];
    stage.status.setAttribute('data-state', item.state);
    setText(stage.type, app.type);
    stage.requirement.hidden = item.state !== 'locked';
    const requirement = requirementOf(app);
    setText(stage.requirement, requirement ? requirement.label : REQUIREMENT_FALLBACK);
    setText(stage.name, app.name || app.id);
    stage.name.setAttribute('data-initial', stage.name.textContent.trim().charAt(0).toUpperCase());
    setText(stage.motto, app.motto);
    setText(stage.translation, app.translation);
    setText(stage.mission, app.mission);
    renderActions(item);
    renderDetails(app);
  }

  function isAllowedAppUrl(url) {
    return typeof url === 'string' && url.indexOf(APP_URL_PREFIX) === 0;
  }

  // R6 (app.js) est la source de vérité des règles d'affectation
  function requirementOf(app) {
    if (typeof R6 === 'undefined' || !R6 || typeof R6.requirementFor !== 'function') return null;
    return R6.requirementFor(app.id, niveau);
  }

  function sendRequest(appId) {
    if (previewRequest) return previewRequest(appId);
    if (typeof R6 === 'undefined' || !R6 || typeof R6.requestAffectation !== 'function') {
      return Promise.resolve({ ok: false, error: REQUEST_ERROR_MESSAGE });
    }
    return R6.requestAffectation(appId);
  }

  function hasRequested(appId) {
    if (typeof R6 === 'undefined' || !R6 || typeof R6.hasRequested !== 'function') return false;
    return R6.hasRequested(appId);
  }

  function notify(message) {
    if (typeof showNotification === 'function') showNotification(message);
  }

  function applyRequestState(button, appId) {
    if (hasRequested(appId)) {
      button.disabled = true;
      button.textContent = REQUEST_SENT_LABEL;
    } else if (pendingRequests.has(appId)) {
      button.disabled = true;
      button.textContent = REQUEST_PENDING_LABEL;
    } else {
      button.disabled = false;
      button.textContent = REQUEST_LABEL;
    }
  }

  function refreshRequestButton(appId) {
    if (!stage || !currentItem || currentItem.app.id !== appId) return;
    const button = stage.actions.querySelector('.main-cta--request');
    if (button) applyRequestState(button, appId);
  }

  function requestAffectation(appId) {
    if (pendingRequests.has(appId) || hasRequested(appId)) return;
    const session = sessionId;
    pendingRequests.add(appId);
    refreshRequestButton(appId);

    Promise.resolve(sendRequest(appId))
      .catch(function() { return { ok: false, error: REQUEST_ERROR_MESSAGE }; })
      .then(function(result) {
        if (session !== sessionId) return;
        pendingRequests.delete(appId);
        const ok = !!(result && result.ok);
        notify(ok ? REQUEST_SENT_MESSAGE : ((result && result.error) || REQUEST_ERROR_MESSAGE));
        refreshRequestButton(appId);
      });
  }

  // La note est conservée d'un rendu à l'autre : une région aria-live doit exister avant d'être remplie
  function renderActions(item) {
    const app = item.app;
    const name = app.name || app.id;
    const actions = stage.actions;
    const note = stage.note;

    Array.prototype.slice.call(actions.children).forEach(function(child) {
      if (child !== note) child.remove();
    });
    note.textContent = '';

    let cta = null;

    if (item.state === 'open' && app.platform === 'web') {
      if (isAllowedAppUrl(app.url)) {
        cta = document.createElement('a');
        cta.className = 'main-cta';
        cta.href = app.url;
        cta.target = '_blank';
        cta.rel = 'noopener noreferrer';
        cta.textContent = 'Ouvrir ' + name;
      }
    } else if (item.state === 'open' && app.platform === 'desktop') {
      cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'main-cta';
      cta.textContent = 'Ouvrir ' + name;
      cta.addEventListener('click', function() {
        note.textContent = DESKTOP_NOTE;
      });
    } else if (item.state === 'preparation') {
      cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'main-cta main-cta--soon';
      cta.setAttribute('aria-disabled', 'true');
      cta.textContent = 'Bientôt dans la flotte';
    } else if (item.state === 'locked') {
      const requirement = requirementOf(app);
      if (requirement && requirement.canRequest) {
        cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'main-cta main-cta--request';
        applyRequestState(cta, app.id);
        cta.addEventListener('click', function() {
          requestAffectation(app.id);
        });
      } else if (requirement) {
        note.textContent = requirement.note;
      }
    }

    if (cta) actions.insertBefore(cta, note);
    actions.insertBefore(buildDetailsToggle(), note);
  }

  function renderMedia(app) {
    const video = stage.video;
    const img = stage.img;
    const placeholder = stage.placeholder;

    if (app.video) {
      img.hidden = true;
      img.removeAttribute('src');
      placeholder.hidden = true;
      releaseVideo(video);
      if (PATCH_EDGES[app.id]) {
        video.style.setProperty('--main-patch-edge', PATCH_EDGES[app.id] + '%');
      } else {
        video.style.removeProperty('--main-patch-edge');
      }
      video.hidden = false;
      video.poster = app.poster || '';
      if (canPlay()) {
        video.src = app.video;
        video.load();
        playVideo(video);
      }
      return;
    }

    releaseVideo(video);
    video.hidden = true;
    video.removeAttribute('poster');

    if (app.poster) {
      placeholder.hidden = true;
      img.src = app.poster;
      img.hidden = false;
      return;
    }

    img.hidden = true;
    img.removeAttribute('src');
    setText(stage.placeholderName, app.name || app.id);
    placeholder.hidden = false;
  }

  function renderStage() {
    renderSheet(currentItem);
    renderMedia(currentItem.app);
  }

  function cancelChange() {
    changeToken++;
    isChanging = false;
    awaitingMedia = false;
    if (stage) stage.root.classList.remove('is-changing');
  }

  // Retire le noir quand le média de l'app courante est prêt, sauf si token est périmé
  function revealWhenReady(token) {
    awaitingMedia = true;
    waitForMedia(currentItem.app, function() {
      if (token !== changeToken || !stage) return;
      awaitingMedia = false;
      stage.root.classList.remove('is-changing');
      isChanging = false;
    });
  }

  function showOnStage(item) {
    if (!item || !ensureStage()) return;
    const sameApp = !!currentItem && currentItem.app.id === item.app.id;
    if (!sameApp) stage.note.textContent = '';

    if (isChanging) {
      targetItem = item;
      if (awaitingMedia && !sameApp) {
        const token = ++changeToken;
        currentItem = item;
        renderStage();
        revealWhenReady(token);
      } else if (sameApp) {
        currentItem = item;
        renderSheet(item);
      }
      return;
    }

    if (sameApp) {
      currentItem = item;
      renderSheet(item);
      return;
    }

    const token = ++changeToken;
    targetItem = item;

    if (prefersReducedMotion()) {
      currentItem = item;
      renderStage();
      return;
    }

    isChanging = true;
    stage.root.classList.add('is-changing');

    if (!currentItem) {
      currentItem = item;
      renderStage();
      revealWhenReady(token);
      return;
    }

    waitForOpacityTransition(stage.scene, function() {
      if (token !== changeToken) return;
      currentItem = targetItem;
      renderStage();
      revealWhenReady(token);
    });
  }

  function clearStage() {
    cancelChange();
    if (stage) {
      releaseVideo(stage.video);
      stage.root.remove();
    }
    stage = null;
    currentItem = null;
    targetItem = null;
  }

  function pauseStageVideo() {
    if (stage) stage.video.pause();
  }

  function resumeStageVideo() {
    if (!stage || !currentItem || !currentItem.app.video || !canPlay()) return;
    const video = stage.video;
    if (!video.hasAttribute('src')) {
      video.src = currentItem.app.video;
      video.load();
    }
    playVideo(video);
  }

  function onPlaybackConditionsChange() {
    if (canPlay()) resumeStageVideo();
    else pauseStageVideo();
  }

  // ---------- Rangée ----------

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
    showOnStage(itemsById[id]);
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
    itemsById = {};
    items.forEach(function(item) { itemsById[item.app.id] = item; });

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
      clearStage();
      return;
    }

    const keep = tiles.some(function(tile) { return tile.dataset.appId === selectedId; });
    select(keep ? selectedId : tiles[0].dataset.appId, { instant: true, focus: hadFocus });
  }

  function clear() {
    const host = getHost();
    if (host) host.replaceChildren();
    clearStage();
    els = null;
    tiles = [];
    itemsById = {};
    selectedId = null;
    niveau = null;
    detailsOpen = false;
    sessionId++;
    pendingRequests = new Set();
  }

  document.addEventListener('r6:ready', function(e) {
    const detail = (e && e.detail) || {};
    niveau = detail.niveau || null;
    render(detail);
  });
  document.addEventListener('r6:logout', clear);
  document.addEventListener('visibilitychange', onPlaybackConditionsChange);
  document.addEventListener('keydown', onDetailsKeydown);

  // Le panneau du carrousel est un calque fixe : sa vidéo et celle de la scène ne doivent pas jouer ensemble
  const carouselPanel = document.getElementById('carousel-panel');
  if (carouselPanel && typeof MutationObserver === 'function') {
    new MutationObserver(onPlaybackConditionsChange).observe(carouselPanel, {
      attributes: true,
      attributeFilter: ['hidden']
    });
  }

  // MODE APERÇU — local uniquement, ?preview=1
  const isLocalHost = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  const previewParams = new URLSearchParams(location.search);
  const wantsPreview = previewParams.get('preview') === '1';
  if (isLocalHost && wantsPreview) {
    // &niveau=N1|N2|N3|N4 (N2 par défaut), &request=ok|fail (ok par défaut) ; aucun appel au proxy
    const previewNiveau = /^N[1-4]$/.test(previewParams.get('niveau') || '') ? previewParams.get('niveau') : 'N2';
    const previewRequestFails = previewParams.get('request') === 'fail';
    previewRequest = function(appId) {
      return new Promise(function(resolve) {
        setTimeout(function() {
          if (previewRequestFails) {
            resolve({ ok: false, error: REQUEST_ERROR_MESSAGE });
            return;
          }
          if (typeof R6 !== 'undefined' && R6 && typeof R6.markRequested === 'function') R6.markRequested(appId);
          resolve({ ok: true });
        }, 600);
      });
    };
    // &reset=1 : efface les traces de demandes avant le premier affichage
    if (previewParams.get('reset') === '1') {
      try {
        Object.keys(localStorage)
          .filter(function(key) { return key.indexOf('ts_rdv_requested_') === 0; })
          .forEach(function(key) { localStorage.removeItem(key); });
      } catch (e) {}
    }
    const previewDetail = function() {
      const fleetIds = (Array.isArray(window.TranquilityFleet) ? window.TranquilityFleet : [])
        .map(function(app) { return app && app.id; })
        .filter(Boolean);
      if (previewNiveau === 'N1') {
        return { apps: fleetIds.filter(function(id) { return id !== 'ark'; }), affectation: 'COLUMBIA' };
      }
      if (previewNiveau === 'N3') return { apps: ['covenant'], affectation: null };
      if (previewNiveau === 'N4') return { apps: [], affectation: null };
      return { apps: ['reviewer', 'manifest', 'codex'], affectation: 'GUMDROP' };
    };
    const runPreview = function() {
      document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
      const connected = document.getElementById('connectedView');
      if (connected) connected.classList.add('active');
      const data = previewDetail();
      document.dispatchEvent(new CustomEvent('r6:ready', {
        detail: {
          niveau: previewNiveau,
          apps: data.apps,
          affectation: data.affectation,
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
