/* Fond cosmos animé — étoiles, poussières, étoile filante (lobby / écran principal). */
(function () {
  'use strict';

  /** Convertit #rgb ou #rrggbb en "r,g,b". */
  function hexToRgbTriplet(value) {
    if (!value || typeof value !== 'string') return null;
    var hex = value.trim();
    if (hex.charAt(0) === '#') hex = hex.slice(1);
    if (hex.length === 3) {
      hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }
    if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return null;
    return (
      parseInt(hex.slice(0, 2), 16) + ',' +
      parseInt(hex.slice(2, 4), 16) + ',' +
      parseInt(hex.slice(4, 6), 16)
    );
  }

  /** Lit --text-primary, --accent, --warning ; repli sur --text-primary si échec. */
  function readPalette() {
    var styles = getComputedStyle(document.documentElement);
    function readVar(name) {
      return hexToRgbTriplet(styles.getPropertyValue(name));
    }
    var primary = readVar('--text-primary');
    if (!primary) return null;
    var accent = readVar('--accent') || primary;
    var warning = readVar('--warning') || primary;
    return {
      primary: primary,
      accent: accent,
      warning: warning,
      dust: [primary, primary, accent, warning]
    };
  }

  function start(canvas) {
    if (!canvas || !canvas.getContext) return function () {};

    var ctx = canvas.getContext('2d');
    if (!ctx) return function () {};

    var colors = readPalette();
    if (!colors) return function () {};

    var W = 0;
    var H = 0;
    var stars = [];
    var dusts = [];
    var shooting = null;
    var lastDustSpawn = 0;
    var rafId = null;
    var stopped = false;
    var resizeObserver = null;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function starCount() {
      return Math.max(60, Math.round(170 * (W * H) / (1440 * 900)));
    }

    function regenerateStars() {
      var n = starCount();
      stars = [];
      var i;
      for (i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 0.2 + Math.random() * 1.2,
          p: Math.random() * Math.PI * 2,
          s: 0.4 + Math.random() * 1.2
        });
      }
    }

    function createDust(x, age) {
      return {
        x: x,
        y: 60 + Math.random() * (H - 120),
        vx: 0.18 + Math.random() * 0.42,
        vy: (Math.random() - 0.5) * 0.08,
        r: 6 + Math.random() * 16,
        a: 0.08 + Math.random() * 0.16,
        wf: 0.004 + Math.random() * 0.008,
        seed: Math.random() * 100,
        age: age,
        color: colors.dust[Math.floor(Math.random() * colors.dust.length)]
      };
    }

    function seedInitialDust() {
      dusts = [];
      var i;
      for (i = 0; i < 12; i++) {
        dusts.push(createDust(Math.random() * W, 200 + Math.random() * 400));
      }
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (W > 0 && H > 0) regenerateStars();
    }

    function isDisplayed() {
      if (document.visibilityState !== 'visible') return false;
      if (!canvas.offsetParent) return false;
      return W > 0 && H > 0;
    }

    function drawStarsTwinkle(t) {
      var i, star, op;
      for (i = 0; i < stars.length; i++) {
        star = stars[i];
        op = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(star.p + t * 0.001 * star.s));
        ctx.fillStyle = 'rgba(' + colors.primary + ',' + op + ')';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawStarsStatic() {
      var i, star;
      ctx.clearRect(0, 0, W, H);
      for (i = 0; i < stars.length; i++) {
        star = stars[i];
        ctx.fillStyle = 'rgba(' + colors.primary + ',0.35)';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function updateDust() {
      var i, d, edge, life, op, grad;
      for (i = dusts.length - 1; i >= 0; i--) {
        d = dusts[i];
        d.age += 1;
        d.x += d.vx;
        d.y += d.vy + Math.sin(d.age * d.wf + d.seed) * 0.12;
        if (d.x > W + 80) {
          dusts.splice(i, 1);
          continue;
        }
        edge = Math.min(1, (d.x + 60) / 260, (W + 60 - d.x) / 260);
        life = Math.min(1, d.age / 180);
        op = Math.max(0, d.a * edge * life * (0.75 + 0.25 * Math.sin(d.age * 0.02 + d.seed)));
        grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        grad.addColorStop(0, 'rgba(' + d.color + ',' + op + ')');
        grad.addColorStop(0.35, 'rgba(' + d.color + ',' + (op * 0.35) + ')');
        grad.addColorStop(1, 'rgba(' + d.color + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function maybeSpawnDust(now) {
      if (now - lastDustSpawn < 900) return;
      lastDustSpawn = now;
      if (dusts.length < 26 && Math.random() < 0.55) {
        dusts.push(createDust(-60, 0));
      }
    }

    function updateShootingStar() {
      if (!shooting) {
        if (Math.random() < 0.004) {
          shooting = {
            x: W * (0.2 + Math.random() * 0.7),
            y: Math.random() * H * 0.35,
            life: 0
          };
        }
        return;
      }
      shooting.life += 1;
      if (shooting.life > 60) {
        shooting = null;
        return;
      }
      var px = shooting.x - shooting.life * 9;
      var py = shooting.y + shooting.life * 4;
      var x2 = px + 120;
      var y2 = py - 120 * 0.44;
      var grad = ctx.createLinearGradient(px, py, x2, y2);
      grad.addColorStop(0, 'rgba(' + colors.primary + ',0.75)');
      grad.addColorStop(1, 'rgba(' + colors.primary + ',0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function tick(t) {
      rafId = null;
      if (stopped) return;
      if (!isDisplayed()) return;

      ctx.clearRect(0, 0, W, H);
      drawStarsTwinkle(t);
      maybeSpawnDust(t);
      updateDust();
      updateShootingStar();

      rafId = requestAnimationFrame(tick);
    }

    function ensureRunning() {
      if (stopped || reducedMotion) return;
      if (!isDisplayed()) return;
      if (rafId == null) rafId = requestAnimationFrame(tick);
    }

    function onVisibility() {
      ensureRunning();
    }

    function onResize() {
      resize();
      if (reducedMotion) {
        drawStarsStatic();
        return;
      }
      ensureRunning();
    }

    resize();
    if (W > 0 && H > 0 && !reducedMotion) seedInitialDust();

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', onResize);
    }
    document.addEventListener('visibilitychange', onVisibility);

    if (reducedMotion) {
      drawStarsStatic();
    } else {
      lastDustSpawn = performance.now();
      ensureRunning();
    }

    return function stop() {
      stopped = true;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.removeEventListener('visibilitychange', onVisibility);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      } else {
        window.removeEventListener('resize', onResize);
      }
    };
  }

  window.TranquilityCosmos = { start: start };

  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('lobby-cosmos');
    if (el) window.TranquilityCosmos.start(el);
  });
})();
