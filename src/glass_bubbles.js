/* ═══ Liquid Glass background (index_glass.html only) ═══
   Silver backdrop with two large clear glass droplets rising slowly, wobbling a little like liquid.
   Drawn the same way by the shell AND by each embedded page: droplet positions are a pure
   function of the clock and of the shell window size, so a droplet passing from the sidebar
   into a page continues seamlessly, and the frosted glass cards inside a page blur the
   droplets behind them. Follows the light/dark theme; still when animations are off. */
(function () {
  const top = (() => { try { return window.parent && window.parent !== window && window.parent.innerWidth ? window.parent : window; } catch (e) { return window; } })();
  const inFrame = top !== window, root = document.documentElement;
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none';
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  let SW = 0, SH = 0, W = 0, H = 0, ox = 0, oy = 0, B = [], raf = 0;
  const TAU = Math.PI * 2, now = () => (Date.now() / 1000) % 86400;

  function size() {
    SW = top.innerWidth; SH = top.innerHeight; W = innerWidth; H = innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ox = oy = 0;
    if (inFrame) { try { const b = window.frameElement.getBoundingClientRect(); ox = b.left; oy = b.top; } catch (e) {} }
    const m = Math.min(SW, SH);   // two large droplets, sized to the shell window
    B = [{ R: Math.max(90, Math.min(210, m * .22)), x0: .26, y0: .30, v: 9, amp: 70, ph: 0, fq: .06, wob: .5 },
         { R: Math.max(60, Math.min(140, m * .14)), x0: .74, y0: .82, v: 13, amp: 90, ph: 2.1, fq: .05, wob: .6 }];
  }

  function backdrop(dark) {
    const g = ctx.createLinearGradient(-ox, -oy, SW - ox, SH - oy);
    if (dark) { g.addColorStop(0, '#0B2752'); g.addColorStop(.55, '#071C3D'); g.addColorStop(1, '#041127'); }
    else { g.addColorStop(0, '#F1F2F5'); g.addColorStop(.5, '#DADDE2'); g.addColorStop(1, '#BDC2CA'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cx = SW * .3 - ox, cy = SH * .16 - oy, rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(SW, SH) * .75);
    rg.addColorStop(0, dark ? 'rgba(76,141,255,.20)' : 'rgba(255,255,255,.8)'); rg.addColorStop(1, dark ? 'rgba(76,141,255,0)' : 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }

  function ell(x, y, rx, ry, a0, a1) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, a0 || 0, a1 == null ? TAU : a1); }

  /* one clear glass droplet: soft shadow, nearly clear body darker at the rim (lens), bright
     specular rim top-left, caustic crescent at the bottom, faint colour fringes, a small sheen */
  function droplet(x, y, R, sq, dark) {
    const rx = R * (1 + sq), ry = R * (1 - sq);
    let g = ctx.createRadialGradient(x, y + R * .28, R * .2, x, y + R * .28, R * 1.25);
    g.addColorStop(0, dark ? 'rgba(0,0,0,.20)' : 'rgba(40,46,58,.15)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ell(x, y + R * .28, rx * 1.25, ry * 1.1); ctx.fillStyle = g; ctx.fill();
    g = ctx.createRadialGradient(x - rx * .25, y - ry * .3, R * .1, x, y, R);
    if (dark) { g.addColorStop(0, 'rgba(255,255,255,.13)'); g.addColorStop(.62, 'rgba(255,255,255,.04)'); g.addColorStop(1, 'rgba(170,205,255,.24)'); }
    else { g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(.62, 'rgba(255,255,255,.10)'); g.addColorStop(.88, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(100,108,124,.38)'); }
    ell(x, y, rx, ry); ctx.fillStyle = g; ctx.fill();
    const lw = Math.max(1, R * .035);
    ell(x, y, rx * .99, ry * .99, .12 * Math.PI, .72 * Math.PI); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = dark ? 'rgba(0,0,0,.28)' : 'rgba(70,76,92,.24)'; ctx.stroke();   // darker lens edge, bottom-right
    g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.35, 'rgba(255,255,255,.22)'); g.addColorStop(.65, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(255,255,255,.7)');
    ell(x, y, rx - lw / 2, ry - lw / 2); ctx.lineWidth = lw; ctx.strokeStyle = g; ctx.stroke();
    ell(x, y + ry * .06, rx * .8, ry * .78, .18 * Math.PI, .82 * Math.PI); ctx.lineWidth = Math.max(1, R * .06); ctx.strokeStyle = dark ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.42)'; ctx.stroke();
    ctx.lineWidth = Math.max(1, R * .025);
    ell(x, y, rx * .965, ry * .965, 1.05 * Math.PI, 1.42 * Math.PI); ctx.strokeStyle = 'rgba(70,150,255,.28)'; ctx.stroke();
    ell(x, y, rx * .965, ry * .965, .06 * Math.PI, .38 * Math.PI); ctx.strokeStyle = 'rgba(255,165,70,.22)'; ctx.stroke();
    const hx = x - rx * .4, hy = y - ry * .46;
    g = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * .26);
    g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-.6); ctx.scale(1, .5); ell(0, 0, R * .26, R * .26); ctx.restore(); ctx.fillStyle = g; ctx.fill();
  }

  function draw(t) {
    const dark = root.getAttribute('data-theme') === 'dark';
    backdrop(dark);
    B.forEach(b => {
      const span = SH + 2 * b.R, y = (((b.y0 * span - b.v * t) % span) + span) % span - b.R;
      const x = b.x0 * SW + Math.sin(t * b.fq + b.ph) * b.amp, lx = x - ox, ly = y - oy;
      if (lx < -b.R * 1.4 || lx > W + b.R * 1.4 || ly < -b.R * 1.4 || ly > H + b.R * 1.4) return;
      droplet(lx, ly, b.R, .035 * Math.sin(t * b.wob * 1.3 + b.ph), dark);
    });
  }

  const hiddenFrame = () => { try { return inFrame && window.frameElement && window.frameElement.hidden; } catch (e) { return false; } };
  function step() { if (hiddenFrame() || document.hidden) { raf = 0; return; } draw(now()); raf = requestAnimationFrame(step); }
  function run() {
    cancelAnimationFrame(raf); raf = 0;
    if (root.getAttribute('data-motion') === 'on' && !document.hidden && !hiddenFrame()) raf = requestAnimationFrame(step); else draw(now());
  }
  size(); run();
  addEventListener('resize', () => { size(); run(); });
  document.addEventListener('visibilitychange', run);
  addEventListener('message', e => { if (e.data && e.data.type === 'tm1-show') setTimeout(() => { size(); run(); }, 0); });   // tab shown again
  new MutationObserver(run).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
})();
