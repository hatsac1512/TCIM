/* ═══ Liquid Glass interactions (index_glass.html only) ═══
   After Apple's "Liquid Glass" demo video (Chan Karunamuni on X). Applied to the controls only —
   never to the data marks, so charts and tables read exactly as before.
   1. Liquid selection. In each segmented control (dashboard tabs, indicator selector, Workspace menu,
      Country Submission answers) the selection is ONE glass droplet that flows to the new choice:
      the leading edge runs ahead and the trailing edge follows (the droplet stretches), it thins while
      stretched (volume is kept), its glass rim brightens while moving, then it settles with a small
      wobble and takes the colour of the new choice. The white labels are a copy of the labels clipped
      to the droplet, so a label under the droplet is white and outside it dark — also mid-move.
   2. Press. A control squeezes a little and light blooms from the point pressed, then springs back.
   3. Light. KPI cards carry a soft highlight that follows the pointer (light bending in the glass).
   Follows the motion setting (html[data-motion]): with animations off the droplet simply jumps.
   Without this script the CSS selected states still work (progressive enhancement). */
(function () {
  const root = document.documentElement;
  const motion = () => root.getAttribute('data-motion') === 'on';
  const GROUPS = '.seg-nav,.isel,.sb-nav,.seg', ITEM = 'button,label';

  /* spring easing for the Web Animations API (falls back to an overshooting cubic-bezier) */
  const SPRING = (() => {
    const z = .62, zw = 6.2, w = zw / z, wd = w * Math.sqrt(1 - z * z), p = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; p.push(i === 40 ? 1 : +(1 - Math.exp(-zw * t) * (Math.cos(wd * t) + zw / wd * Math.sin(wd * t))).toFixed(4)); }
    const s = 'linear(' + p.join(', ') + ')';
    try { return CSS.supports('animation-timing-function', s) ? s : 'cubic-bezier(.3,1.5,.5,1)'; } catch (e) { return 'cubic-bezier(.3,1.5,.5,1)'; }
  })();

  const css = document.createElement('style');
  css.textContent = `
.liq-on{position:relative;isolation:isolate;--liq-sh:0 1px 2px rgba(0,0,0,.18),0 6px 16px rgba(30,35,45,.30)}
:root[data-theme="dark"] .liq-on{--liq-sh:0 1px 2px rgba(0,0,0,.4),0 6px 18px rgba(0,0,0,.5)}
.liq-on>button,.liq-on>label{position:relative;z-index:1}
/* the selected look is carried by the droplet; the selected label's own dark text fades out under it */
.liq-on>.on,.liq-on>label:has(input:checked){background:transparent!important;box-shadow:none!important;color:transparent!important;transition:color .2s ease .16s}
.liq-drop{position:absolute;left:0;top:0;z-index:0;pointer-events:none;border-radius:999px;box-shadow:var(--liq-sh);will-change:transform,width,height}
.liq-drop i{position:absolute;inset:0;border-radius:inherit}
.liq-fill{background-color:var(--c,#50555C);background-image:linear-gradient(180deg,rgba(255,255,255,.17),rgba(255,255,255,0) 50%,rgba(0,0,0,.14));
  opacity:calc(1 - .22 * var(--g,0));transition:background-color .35s ease}
.liq-lens{background:radial-gradient(120% 90% at 30% 0%,rgba(255,255,255,.5),rgba(255,255,255,0) 55%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -1px 1px rgba(255,255,255,.22),inset 2px 0 2px -1px rgba(70,150,255,.5),inset -2px 0 2px -1px rgba(255,160,70,.45);
  opacity:calc(.32 + .68 * var(--g,0))}
.liq-ink{position:absolute!important;margin:0!important;z-index:2;pointer-events:none;background:none!important;border-color:transparent!important;
  box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;animation:none!important;transition:none!important}
.liq-ink *{color:#fff!important;background:transparent!important;box-shadow:none!important;border-color:transparent!important;animation:none!important;transition:none!important}
.liq-ink .nb{background:#fff!important;color:#3E4248!important}
/* per choice colour of the droplet (white text on it: 5:1 or more) */
.seg-nav>.vb,.isel>button,.sb-nav>.nv{--liq-c:#50555C}
:root[data-theme="dark"] .seg-nav>.vb,:root[data-theme="dark"] .isel>button,:root[data-theme="dark"] .sb-nav>.nv{--liq-c:#0B67B0}
.seg>label{--liq-c:#0B67B0}
.seg>label.o-full,.seg>label.o-available,.seg>label.o-yes{--liq-c:#177336}
.seg>label.o-no,.seg>label.o-not_available,.seg>label.o-nr{--liq-c:#B5231C}
/* press: light blooms from the point pressed */
.btn,.b,.vb,.isel button,.icb,.seg label,.srt,.nv{position:relative;isolation:isolate}
.liq-glow{position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;
  background:radial-gradient(circle at var(--px) var(--py),rgba(255,255,255,.9),rgba(160,200,255,.32) 34%,rgba(255,255,255,0) 64%) var(--px) var(--py)/30% 30% no-repeat;
  animation:liq-glow .7s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes liq-glow{0%{opacity:0;background-size:30% 30%}22%{opacity:1}100%{opacity:0;background-size:280% 280%}}`;
  document.head.appendChild(css);

  /* ── 1. Liquid selection ── */
  const groups = new Map();
  const HARD = [480, .6], SOFT = [190, .78];   // [stiffness, damping ratio]: leading edge, trailing edge
  const EDGES = ['x0', 'x1', 'y0', 'y1'];

  const itemsOf = g => [...g.children].filter(e => e.matches(ITEM) && !e.hidden);
  const isSel = e => e.classList.contains('on') || !!e.querySelector('input:checked');
  const sigOf = list => list.map(e => e.textContent.trim()).join('|');

  function attach(s) {
    const g = s.g;
    s.drop = document.createElement('span'); s.drop.className = 'liq-drop'; s.drop.setAttribute('aria-hidden', 'true');
    s.drop.innerHTML = '<i class="liq-fill"></i><i class="liq-lens"></i>';
    g.prepend(s.drop); g.classList.add('liq-on');
    clone(s);
  }
  function clone(s) {   // white copy of the labels, clipped to the droplet
    const g = s.g;
    if (s.ink) s.ink.remove();
    const ink = g.cloneNode(true);
    ink.removeAttribute('id'); ink.removeAttribute('hidden'); ink.classList.remove('liq-on', 'mo-i'); ink.classList.add('liq-ink');   // a group copied while hidden (menu before login) must not stay hidden
    ink.setAttribute('aria-hidden', 'true'); ink.inert = true;
    ink.querySelectorAll('.liq-drop,.liq-ink,.liq-glow,input').forEach(e => e.remove());   // no radio copies: they would join the real groups
    ink.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    ink.querySelectorAll('[onclick]').forEach(e => e.removeAttribute('onclick'));
    g.appendChild(ink); s.ink = ink; s.sig = sigOf(itemsOf(g));
    size(s);
  }
  function size(s) {
    const g = s.g, cs = getComputedStyle(g);
    s.bl = parseFloat(cs.borderLeftWidth) || 0; s.bt = parseFloat(cs.borderTopWidth) || 0;
    s.ow = g.offsetWidth; s.oh = g.offsetHeight;   // what scan() compares, to notice a resize
    s.iw = (parseFloat(cs.width) || g.offsetWidth) + .5; s.ih = parseFloat(cs.height) || g.offsetHeight;   // +.5px: widths are rounded, and a copy even slightly narrower wraps its last label onto a hidden line
    Object.assign(s.ink.style, { left: -s.bl + 'px', top: -s.bt + 'px', width: s.iw + 'px', height: s.ih + 'px' });
  }
  function target(s, snap) {
    const sel = itemsOf(s.g).find(isSel);
    if (!sel || !s.g.offsetWidth) { s.drop.style.opacity = sel ? '' : '0'; s.ink.style.clipPath = 'inset(50%)'; s.sel = sel || null; if (!sel) s.cur = null; return; }
    const t = { x0: sel.offsetLeft, y0: sel.offsetTop, x1: sel.offsetLeft + sel.offsetWidth, y1: sel.offsetTop + sel.offsetHeight };
    s.drop.style.opacity = '';
    s.drop.style.setProperty('--c', getComputedStyle(sel).getPropertyValue('--liq-c').trim() || '#50555C');
    const moved = !s.tgt || EDGES.some(k => Math.abs(s.tgt[k] - t[k]) > .5);
    s.tgt = t; s.sel = sel;
    if (snap || !s.cur || !motion()) { s.cur = Object.assign({}, t); s.vel = { x0: 0, x1: 0, y0: 0, y1: 0 }; cancelAnimationFrame(s.raf); s.raf = 0; draw(s); return; }
    if (moved && !s.raf) { s.last = performance.now(); s.raf = requestAnimationFrame(n => step(s, n)); }
  }
  function step(s, now) {
    const c = s.cur, v = s.vel, t = s.tgt, dt = Math.min(.05, (now - s.last) / 1000); s.last = now;
    const dx = (t.x0 + t.x1) - (c.x0 + c.x1), dy = (t.y0 + t.y1) - (c.y0 + c.y1);
    const K = { x0: dx < 0 ? HARD : SOFT, x1: dx > 0 ? HARD : SOFT, y0: dy < 0 ? HARD : SOFT, y1: dy > 0 ? HARD : SOFT };
    for (let n = Math.max(1, Math.ceil(dt * 240)), h = dt / n; n--;)
      EDGES.forEach(k => { const [kk, z] = K[k]; v[k] += (-kk * (c[k] - t[k]) - 2 * z * Math.sqrt(kk) * v[k]) * h; c[k] += v[k] * h; });
    if (c.x1 - c.x0 < 12) c.x1 = c.x0 + 12; if (c.y1 - c.y0 < 12) c.y1 = c.y0 + 12;
    draw(s);
    if (EDGES.every(k => Math.abs(c[k] - t[k]) < .3 && Math.abs(v[k]) < 6)) { Object.assign(c, t); EDGES.forEach(k => { v[k] = 0; }); draw(s); s.raf = 0; }
    else s.raf = requestAnimationFrame(n => step(s, n));
  }
  function draw(s) {
    const c = s.cur, t = s.tgt, v = s.vel;
    let w = c.x1 - c.x0, h = c.y1 - c.y0;
    const px = Math.min((t.x1 - t.x0) * .1, Math.max(0, h - (t.y1 - t.y0)) * .05);   // stretched one way → thinner the other way
    const py = Math.min((t.y1 - t.y0) * .12, Math.max(0, w - (t.x1 - t.x0)) * .05);
    const x = c.x0 + px, y = c.y0 + py; w -= 2 * px; h -= 2 * py;
    const g = Math.min(1, Math.hypot(v.x0 + v.x1, v.y0 + v.y1) / 1800);   // speed → clearer glass
    const r = Math.min(w, h) / 2, X = x + s.bl, Y = y + s.bt;              // the copy's frame starts at the border edge
    Object.assign(s.drop.style, { transform: 'translate(' + x + 'px,' + y + 'px)', width: w + 'px', height: h + 'px' });
    s.drop.style.setProperty('--g', g.toFixed(3));
    s.ink.style.clipPath = 'inset(' + Y + 'px ' + (s.iw - X - w) + 'px ' + (s.ih - Y - h) + 'px ' + X + 'px round ' + r + 'px)';
  }

  function scan() {
    document.querySelectorAll(GROUPS).forEach(g => {
      if (g.classList.contains('liq-ink') || g.closest('.liq-ink')) return;
      let s = groups.get(g);
      if (!s) { s = { g }; groups.set(g, s); attach(s); ro.observe(g); target(s, true); return; }
      if (!s.drop.isConnected || s.drop.parentNode !== g) { g.prepend(s.drop); g.classList.add('liq-on'); clone(s); }   // content was rebuilt
      else if (s.sig !== sigOf(itemsOf(g)) || !s.ink.isConnected) clone(s);
      const sel = itemsOf(g).find(isSel);
      if (sel !== s.sel || !s.tgt) target(s, false);
      else if (s.ow !== g.offsetWidth || s.oh !== g.offsetHeight) { size(s); target(s, true); }
    });
    groups.forEach((s, g) => { if (!g.isConnected) { groups.delete(g); ro.unobserve(g); } });
  }
  const ro = new ResizeObserver(es => es.forEach(e => { const s = groups.get(e.target); if (s && s.ink) { size(s); target(s, true); } }));
  let pend = 0;
  const later = () => { if (!pend) pend = requestAnimationFrame(() => { pend = 0; scan(); }); };
  const mine = n => n.nodeType === 1 && /\bliq-(glow|ink|drop)\b/.test(n.className);   // our own nodes: ignore
  new MutationObserver(recs => {
    if (recs.some(r => {
      const t = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (t && t.closest('.liq-ink,.liq-drop')) return false;
      if (r.type === 'childList') { const ns = [...r.addedNodes, ...r.removedNodes]; return !ns.length || !ns.every(mine); }
      return !(t && mine(t));
    })) later();
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  document.addEventListener('change', later, true);
  setInterval(() => { if (!document.hidden) scan(); }, 800);   // answers set by code (radio.checked = …) fire no event
  scan();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => groups.forEach(s => { size(s); target(s, true); }));

  /* ── 2. Press: squeeze + light bloom ── */
  const PRESS = '.btn,.b,.vb,.isel button,.nv,.icb,.seg label,.kpi[onclick],.srt';
  document.addEventListener('pointerdown', e => {
    if (!motion() || e.button > 0) return;
    const el = e.target.closest(PRESS);
    if (!el || el.disabled || el.closest('fieldset:disabled,.liq-ink')) return;
    const r = el.getBoundingClientRect(), glow = document.createElement('span');
    glow.className = 'liq-glow'; glow.setAttribute('aria-hidden', 'true');
    glow.style.setProperty('--px', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    glow.style.setProperty('--py', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    glow.addEventListener('animationend', () => glow.remove());
    el.appendChild(glow);
    if (el.parentElement && el.parentElement.classList.contains('liq-on')) return;   // in a liquid group the droplet does the moving
    const k = 1 - Math.max(.02, Math.min(.06, 4 / Math.max(r.width, r.height)));
    const down = el.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + k + ')' }], { duration: 150, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    const up = () => {
      removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
      el.animate([{ transform: 'scale(' + k + ')' }, { transform: 'scale(1)' }], { duration: 620, easing: SPRING });
      down.cancel();
    };
    addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  }, true);

  /* ── 3. Light following the pointer on KPI cards ── */
  let hot = null;
  document.addEventListener('pointermove', e => {
    const k = motion() && e.target.closest ? e.target.closest('.kpi') : null;
    if (hot && hot !== k) { hot.style.removeProperty('--mx'); hot.style.removeProperty('--my'); }
    hot = k; if (!k) return;
    const r = k.getBoundingClientRect();
    k.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); k.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
  }, { passive: true });
})();
