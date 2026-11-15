'use strict';
// ARDAN – darmowe wyglądy postaci za poziom (runda 10). 8 wyglądów na klasę: poz. 1 (podstawowy), 5, 15, 30, 45, 60, 70, 80.
// One pixel-art painter for the world, the battle view, the character list and the gallery. Used by engine.js
// (drawHero → ARDAN_SKINS.hero) when loaded; the server only needs the unlock levels (engine SKIN_LV).
(function (root) {
  const LV = [1, 5, 15, 30, 45, 60, 70, 80];
  const WK = { war: 'sw', arc: 'bow', mag: 'staff' };
  // tier looks: body/legs/boots/arm, trim (belts, edges), head gear (helmet | hood | wiz | cowl), hc/hc2 gear colours,
  // visor, plume, horns, pauld (shoulders), cape, robe, tab (tabard), gem (chest), mask, eye (+ eg = glowing eyes),
  // aura (+ au strength), halo, wings, fx particles, wcol (weapon colour in the gallery)
  const T = {
    war: [
      { n: 'Rekrut', body: '#8a3a2e', legs: '#3a2a20', boot: '#2a1c14', hair: '#3a2414', head: 'helmet', hc: '#9aa2ab', hc2: '#c8ced5', wcol: '#b9c2cb' },
      { n: 'Strażnik', body: '#6f7884', legs: '#3d3a36', boot: '#2a1c14', hair: '#3a2414', head: 'helmet', hc: '#a7afb8', hc2: '#d8dee5', nose: true, tab: '#8a2a22', trim: '#5a3a1e', pauld: '#6b4a2b', wcol: '#c8ced5' },
      { n: 'Rycerz', body: '#a9b1ba', legs: '#5a5f68', boot: '#3a3d44', arm: '#9aa2ab', hair: '#3a2414', head: 'helmet', hc: '#b8c0c8', hc2: '#e6ebf0', visor: true, plume: '#c8403a', pauld: '#c3cad2', tab: '#7a1f1a', trim: '#4a2a14', wcol: '#d8dee5' },
      { n: 'Rycerz Zakonu', body: '#c3cad2', legs: '#4a5568', boot: '#2e3440', arm: '#b8c0c8', hair: '#3a2414', head: 'helmet', hc: '#c3cad2', hc2: '#f2f5f8', visor: true, plume: '#e8c25a', pauld: '#d8dee5', ptrim: '#e8c25a', tab: '#2a4a9a', trim: '#e8c25a', cape: '#22388a', gem: '#e8c25a', wcol: '#eef3f8' },
      { n: 'Czarny Rycerz', body: '#2c2e36', legs: '#1e2026', boot: '#141418', arm: '#33363f', hair: '#111', head: 'helmet', hc: '#2c2e36', hc2: '#4a4d58', visor: true, horns: '#d8d2c0', pauld: '#3a3d48', ptrim: '#b02a2a', tab: '#5a1010', trim: '#b02a2a', cape: '#6a1414', eye: '#ff3a2a', eg: true, fx: 'ember', wcol: '#d0453a' },
      { n: 'Złoty Paladyn', body: '#e0b445', legs: '#a8822a', boot: '#7a5a1a', arm: '#d9a93a', hair: '#e8d8a0', head: 'helmet', hc: '#f2c75a', hc2: '#fff2c0', visor: true, plume: '#ffffff', pauld: '#f6d27a', ptrim: '#fff7d6', tab: '#f4f0e6', trim: '#fff2c0', cape: '#f4f0e6', gem: '#6ad0ff', aura: '#ffd86a', au: 0.3, fx: 'holy', wcol: '#ffe08a' },
      { n: 'Władca Płomieni', body: '#2a1a1a', legs: '#1e1010', boot: '#140a0a', arm: '#3a2420', hair: '#111', head: 'helmet', hc: '#2a1a1a', hc2: '#ff7a1a', visor: true, horns: '#ff9a3a', pauld: '#3a2420', ptrim: '#ff7a1a', tab: '#a8300c', trim: '#ff7a1a', cape: '#a8300c', gem: '#ffb030', eye: '#ffb030', eg: true, aura: '#ff6a1a', au: 0.42, fx: 'flame', lava: true, wcol: '#ff8a2a' },
      { n: 'Niebiański Czempion', body: '#eef3fa', legs: '#c8d6e8', boot: '#9fb2c8', arm: '#ffffff', hair: '#fff', head: 'helmet', hc: '#f4f8ff', hc2: '#7fe9ff', visor: true, plume: '#7fe9ff', pauld: '#ffffff', ptrim: '#7fe9ff', tab: '#7fd0ff', trim: '#7fe9ff', cape: '#8fdcff', gem: '#7fe9ff', eye: '#7fe9ff', eg: true, aura: '#7fe9ff', au: 0.55, halo: '#bff4ff', wings: '#e6fbff', fx: 'star', wcol: '#bff4ff' },
    ],
    arc: [
      { n: 'Zwiadowca', body: '#3f7a3a', legs: '#3a2a20', boot: '#2a1c14', hair: '#8a5a2a', head: 'hood', hc: '#2e5e2c', plume: '#c8403a', quiver: '#6b4a2b', wcol: '#9a6b3c' },
      { n: 'Myśliwy', body: '#7a5230', legs: '#4a3420', boot: '#2a1c14', hair: '#8a5a2a', head: 'hood', hc: '#3f6a34', plume: '#e8e0d0', trim: '#c8a060', quiver: '#7a4f2a', wcol: '#a8743f' },
      { n: 'Strażnik Lasu', body: '#2f5a2c', legs: '#3a2e1e', boot: '#2a1c14', arm: '#6b4a2b', hair: '#6a4422', head: 'hood', hc: '#24461f', plume: '#8fbf6a', pauld: '#6b4a2b', trim: '#8a5a2a', cape: '#24461f', quiver: '#5a3a1e', wcol: '#8fbf6a' },
      { n: 'Tropiciel', body: '#2f6a66', legs: '#2a3a3a', boot: '#1e2626', arm: '#6b4a2b', hair: '#3a2414', head: 'hood', hc: '#24504c', mask: '#1e3a38', pauld: '#7a5a3a', ptrim: '#d8b25a', trim: '#d8b25a', cape: '#6b4a2b', quiver: '#4a3020', wcol: '#d8dee5' },
      { n: 'Skrytobójca Nocy', body: '#2a2236', legs: '#1a1424', boot: '#100c16', arm: '#221a2e', hair: '#111', head: 'hood', hc: '#1a1424', mask: '#120e1a', pauld: '#2e2440', ptrim: '#9a5ad8', trim: '#9a5ad8', cape: '#3a1e4a', eye: '#c58cff', eg: true, fx: 'shadow', quiver: '#2a1a34', wcol: '#c58cff' },
      { n: 'Elfi Łucznik', body: '#e8efe0', legs: '#7a9a5a', boot: '#5a4a2a', arm: '#d8e6cc', hair: '#f2e6a8', head: 'hood', hc: '#5fa040', plume: '#f2d04b', pauld: '#d8b25a', trim: '#d8b25a', cape: '#3f8a2c', gem: '#8fff6a', aura: '#9dff7a', au: 0.26, fx: 'leaf', quiver: '#c8a060', wcol: '#f2d04b' },
      { n: 'Strzelec Wichrów', body: '#5aa8d8', legs: '#3a6a90', boot: '#2a4a68', arm: '#e8f6ff', hair: '#e8f6ff', head: 'hood', hc: '#3a7ab0', plume: '#ffffff', pauld: '#e8f6ff', ptrim: '#ffffff', trim: '#ffffff', cape: '#bfe8ff', gem: '#e8ffff', eye: '#e8ffff', eg: true, aura: '#bfe8ff', au: 0.38, fx: 'wind', quiver: '#e8f6ff', wcol: '#e8ffff' },
      { n: 'Gwiezdny Łowca', body: '#1e2450', legs: '#141a3a', boot: '#0e1228', arm: '#2a3266', hair: '#ffe9a8', head: 'hood', hc: '#141a3a', plume: '#ffd84a', pauld: '#2a3266', ptrim: '#ffd84a', trim: '#ffd84a', cape: '#2a1e5a', gem: '#ffd84a', eye: '#ffe08a', eg: true, aura: '#ffd84a', au: 0.55, halo: '#ffe9a8', fx: 'star', quiver: '#ffd84a', wcol: '#ffe9a8' },
    ],
    mag: [
      { n: 'Adept', body: '#4a3a8a', legs: '#3a2a20', boot: '#2a1c14', hair: '#d8d8e8', head: 'wiz', hc: '#3a2a7a', robe: true, trim: 'rgba(255,215,120,0.8)', wcol: '#7fb0ff' },
      { n: 'Uczeń Magii', body: '#2f5aa8', legs: '#2a2a3a', boot: '#1e1e2a', hair: '#d8d8e8', head: 'wiz', hc: '#24468a', hband: '#d8d8e8', robe: true, trim: '#d8d8e8', wcol: '#9fd0ff' },
      { n: 'Mag Ognia', body: '#a8302a', legs: '#3a1a14', boot: '#2a1210', hair: '#3a2414', head: 'wiz', hc: '#7a1a16', hband: '#f2a03a', robe: true, trim: '#f2a03a', gem: '#ffb030', fx: 'ember', wcol: '#ff6a2a' },
      { n: 'Mag Lodu', body: '#bfe0f0', legs: '#7fa8c0', boot: '#5a7a90', hair: '#ffffff', head: 'wiz', hc: '#7fb8e0', hband: '#ffffff', robe: true, trim: '#ffffff', pauld: '#e6f6ff', gem: '#9fe6ff', aura: '#bfe8ff', au: 0.2, fx: 'frost', wcol: '#bff4ff' },
      { n: 'Nekromanta', body: '#1e1e22', legs: '#141416', boot: '#0e0e10', hair: '#cfcfcf', head: 'cowl', hc: '#26262c', robe: true, trim: '#6aff6a', pauld: '#d8d2c0', gem: '#6aff6a', eye: '#7aff5a', eg: true, aura: '#5aff7a', au: 0.22, fx: 'soul', wcol: '#7aff5a' },
      { n: 'Arcymag', body: '#f2ead8', legs: '#b8a888', boot: '#8a7a5a', hair: '#e8e8f0', head: 'wiz', hc: '#6a3a9a', hband: '#d8b25a', robe: true, trim: '#d8b25a', cape: '#6a3a9a', pauld: '#d8b25a', gem: '#c58cff', aura: '#ffd86a', au: 0.32, fx: 'orb', wcol: '#ffd84a' },
      { n: 'Mistrz Otchłani', body: '#2a1240', legs: '#1a0a2a', boot: '#12061e', hair: '#e0c8ff', head: 'cowl', hc: '#1a0a2a', robe: true, trim: '#c58cff', cape: '#12061e', pauld: '#3a1a5a', ptrim: '#c58cff', gem: '#ff4fd8', eye: '#ff4fd8', eg: true, aura: '#9a4aff', au: 0.45, fx: 'void', wcol: '#e08cff' },
      { n: 'Niebiański Mędrzec', body: '#fff8e8', legs: '#e8dcc0', boot: '#c8b890', hair: '#ffffff', head: 'wiz', hc: '#f2d04b', hband: '#7fe9ff', robe: true, trim: '#7fe9ff', cape: '#ffe9a8', pauld: '#fff2b0', ptrim: '#7fe9ff', gem: '#7fe9ff', eye: '#7fe9ff', eg: true, aura: '#fff2b0', au: 0.58, halo: '#fff2b0', fx: 'orb', fx2: 'star', wcol: '#fff2b0' },
    ],
  };
  const rgba = (hex, a) => {
    if (hex[0] !== '#') return hex;
    const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : hex;
    return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
  };
  function tierFor(lvl, choice) { let top = 0; for (let i = 0; i < LV.length; i++) if (lvl >= LV[i]) top = i; return Number.isInteger(choice) && choice >= 0 && choice <= top ? choice : top; }
  function defWeapon(g, x, y, col, wk, dir, t) {
    if (wk === 'bow') {
      const f = dir === 1 ? -1 : 1; g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 2, y - 2); g.quadraticCurveTo(x + 2 + 7 * f, y + 7, x + 2, y + 16); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 2, y - 2); g.lineTo(x + 2, y + 16); g.stroke(); return;
    }
    if (wk === 'staff') {
      g.fillStyle = '#6b4a2b'; g.fillRect(x + 1, y - 4, 3, 22); g.fillStyle = col; g.beginPath(); g.arc(x + 2.5, y - 5, 3.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.25 * Math.sin(t * 5)).toFixed(3) + ')'; g.beginPath(); g.arc(x + 2.5, y - 5, 6, 0, Math.PI * 2); g.fill(); return;
    }
    g.fillStyle = col; g.fillRect(x + 1, y, 3, 13); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 1, y, 1, 12);
    g.fillStyle = '#5a3a1e'; g.fillRect(x - 1, y + 12, 7, 2); g.fillRect(x + 1, y + 14, 3, 4);
  }
  // deterministic pseudo-random for particles
  const hsh = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  function particles(g, x, y, kind, col, t, tier) {
    const n = 4 + tier;
    for (let i = 0; i < n; i++) {
      const r1 = hsh(i, 1), r2 = hsh(i, 2), sp = 0.5 + r2 * 0.6, ph = (t * sp + r1) % 1;
      let px, py, c, sz = 1.5;
      if (kind === 'ember' || kind === 'flame') { px = x + 6 + r1 * 20 + Math.sin(t * 3 + i) * 1.5; py = y + 28 - ph * (kind === 'flame' ? 36 : 28); c = ph < 0.5 ? (kind === 'flame' ? '#ffd84a' : '#ffb347') : '#ff5a1a'; sz = kind === 'flame' ? 2.2 - ph : 1.6; g.globalAlpha = 1 - ph; }
      else if (kind === 'holy' || kind === 'star') { const a = r1 * Math.PI * 2 + t * 0.6; px = x + 16 + Math.cos(a) * (12 + r2 * 6); py = y + 12 + Math.sin(a) * (14 + r2 * 4); const tw = Math.max(0, Math.sin(t * 4 + i * 1.7)); g.globalAlpha = tw; c = kind === 'star' ? '#ffffff' : '#fff2b0'; sz = 1 + tw * 1.2;
        if (kind === 'star') { g.fillStyle = rgba(col || '#ffffff', 0.9 * tw); g.fillRect(px - sz * 1.5, py - 0.5, sz * 3, 1); g.fillRect(px - 0.5, py - sz * 1.5, 1, sz * 3); } }
      else if (kind === 'frost') { px = x + 4 + r1 * 24 + Math.sin(t * 2 + i) * 2; py = y - 4 + ph * 34; c = '#e6fbff'; g.globalAlpha = 1 - ph * 0.6; }
      else if (kind === 'leaf') { px = x + 2 + ((r1 * 28 + t * 8 * sp) % 30); py = y + 2 + ph * 28 + Math.sin(t * 3 + i) * 2; c = i % 2 ? '#8fff6a' : '#5fae3c'; g.globalAlpha = 1 - ph; sz = 2; }
      else if (kind === 'wind') { px = x - 4 + ((ph * 44)); py = y + 6 + r1 * 22; g.globalAlpha = (1 - Math.abs(ph - 0.5) * 2) * 0.8; g.fillStyle = '#ffffff'; g.fillRect(px, py, 6, 1); continue; }
      else if (kind === 'shadow') { px = x + 6 + r1 * 20; py = y + 28 - ph * 20; c = '#5a3a7a'; g.globalAlpha = (1 - ph) * 0.7; sz = 2.5 - ph; }
      else if (kind === 'soul') { const a = t * 1.6 + i * (Math.PI * 2 / n); px = x + 16 + Math.cos(a) * 13; py = y + 20 + Math.sin(a) * 4 - ph * 3; c = '#7aff5a'; g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + i); sz = 1.8; }
      else if (kind === 'void') { const a = t * 1.2 + i * (Math.PI * 2 / n); px = x + 16 + Math.cos(a) * 14; py = y + 15 + Math.sin(a) * 6; c = i % 2 ? '#ff4fd8' : '#9a4aff'; g.globalAlpha = 0.85; sz = 2; }
      else if (kind === 'orb') { if (i > 2) break; const a = t * 1.5 + i * (Math.PI * 2 / 3); px = x + 16 + Math.cos(a) * 14; py = y + 12 + Math.sin(a) * 5; c = col || '#ffd84a'; g.globalAlpha = 1;
        g.fillStyle = rgba(c, 0.35); g.beginPath(); g.arc(px, py, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(px, py, 2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.fillRect(px - 1, py - 1, 1, 1); continue; }
      else continue;
      g.fillStyle = c; g.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
  }
  // the figure in a 32×32 cell (same frame as the engine's drawHuman). o: { cls, tier, dir, walk, flash, lunge, t, wcol, weapon }
  function hero(g, x, y, o) {
    o = o || {};
    const cls = T[o.cls] ? o.cls : 'war', tier = Math.max(0, Math.min(LV.length - 1, o.tier | 0)), s = T[cls][tier];
    const dir = o.dir | 0, walk = o.walk || 0, t = o.t || 0, wk = WK[cls];
    const wcol = o.wcol || s.wcol, weapon = o.weapon ? (wx, wy, col, k, d) => o.weapon(wx, wy, col, k, d) : (wx, wy, col, k, d) => defWeapon(g, wx, wy, col, k, d, t);
    if (o.lunge > 0) { const k = Math.sin((o.lunge / 0.18) * Math.PI) * 4; if (dir === 0) y += k; else if (dir === 3) y -= k; else if (dir === 1) x -= k; else x += k; }
    const P = (px, py, w, h, c) => { g.fillStyle = c; g.fillRect(x + px, y + py, w, h); };
    const bob = walk ? Math.abs(Math.sin(walk)) * 1.5 : 0, leg = walk ? Math.sin(walk) * 2.5 : 0;
    // aura + wings behind everything
    if (s.aura) {
      const pu = 0.8 + 0.2 * Math.sin(t * 3), r = 16 + tier * 1.5;
      const grd = g.createRadialGradient(x + 16, y + 16, 2, x + 16, y + 16, r);
      grd.addColorStop(0, rgba(s.aura, (s.au || 0.3) * pu)); grd.addColorStop(0.6, rgba(s.aura, (s.au || 0.3) * 0.45 * pu)); grd.addColorStop(1, rgba(s.aura, 0));
      g.fillStyle = grd; g.fillRect(x + 16 - r, y + 16 - r, r * 2, r * 2);
      g.strokeStyle = rgba(s.aura, 0.55 * pu); g.lineWidth = 1; g.beginPath(); g.ellipse(x + 16, y + 29, 12 + Math.sin(t * 3), 4, 0, 0, Math.PI * 2); g.stroke();
    }
    if (s.wings) {
      const fl = Math.sin(t * 2.5) * 2;
      for (const sd of [-1, 1]) {
        g.fillStyle = rgba(s.wings, 0.85); g.beginPath(); const bx = x + 16 + sd * 4, by = y + 14 - bob;
        g.moveTo(bx, by); g.lineTo(bx + sd * 16, by - 9 - fl); g.lineTo(bx + sd * 14, by - 2 - fl); g.lineTo(bx + sd * 17, by + 2 - fl); g.lineTo(bx + sd * 12, by + 6); g.lineTo(bx + sd * 13, by + 10); g.lineTo(bx, by + 8); g.closePath(); g.fill();
        g.strokeStyle = rgba(s.hc2 || '#7fe9ff', 0.8); g.lineWidth = 1; g.stroke();
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(x + 16, y + 29, 9, 3, 0, 0, Math.PI * 2); g.fill();
    y -= bob;
    // legs + boots
    P(11, 22, 4, 7 + leg, s.legs); P(17, 22, 4, 7 - leg, s.legs);
    P(11, 26 + leg, 4, 3, s.boot); P(17, 26 - leg, 4, 3, s.boot);
    if (tier >= 3) { P(11, 26 + leg, 4, 1, s.trim || s.hc2 || s.boot); P(17, 26 - leg, 4, 1, s.trim || s.hc2 || s.boot); }
    // cape behind (front / side views)
    const capeWave = Math.sin(t * 3 + (walk || 0)) * 1;
    if (s.cape && dir !== 3) { P(7, 13, 18, 14 + capeWave, s.cape); P(7, 26 + capeWave, 18, 1, 'rgba(0,0,0,0.25)'); }
    if (s.quiver && dir !== 3) P(22, 10, 3, 12, s.quiver);
    if (wcol && dir === 3) weapon(x + 24, y + 6, wcol, wk, dir);
    // torso
    const arm = s.arm || s.body;
    P(9, 13, 14, 10, s.body);
    if (s.robe) { P(8, 20, 16, 8, s.body); P(8, 27, 16, 1, s.trim || 'rgba(0,0,0,.3)'); P(15, 13, 2, 14, s.trim || 'rgba(255,215,120,0.8)'); }
    if (s.tab && dir !== 3) { P(13, 14, 6, 12, s.tab); P(13, 14, 6, 1, s.trim || 'rgba(0,0,0,.2)'); }
    P(9, 21, 14, 2, 'rgba(0,0,0,0.25)');
    if (s.trim && !s.robe) P(9, 20, 14, 2, s.trim);
    if (s.lava) { const a = 0.55 + 0.35 * Math.sin(t * 4); P(10, 16, 1, 5, rgba('#ff7a1a', a)); P(21, 15, 1, 6, rgba('#ff7a1a', a)); P(12, 23, 2, 3, rgba('#ff7a1a', a)); }
    if (s.gem && dir !== 3) { P(15, 15, 2, 2, s.gem); g.fillStyle = rgba(s.gem, 0.35 + 0.2 * Math.sin(t * 4)); g.fillRect(x + 14, y + 14, 4, 4); }
    // arms + hands
    P(6, 14, 3, 8, arm); P(23, 14, 3, 8, arm);
    if (tier >= 2) { P(6, 19, 3, 2, s.trim || s.hc2 || arm); P(23, 19, 3, 2, s.trim || s.hc2 || arm); }
    P(6, 21, 3, 2, '#f0c9a0'); P(23, 21, 3, 2, '#f0c9a0');
    if (s.pauld) { P(5, 12, 5, 4, s.pauld); P(22, 12, 5, 4, s.pauld); P(5, 12, 5, 1, 'rgba(255,255,255,.35)'); P(22, 12, 5, 1, 'rgba(255,255,255,.35)'); if (s.ptrim) { P(5, 15, 5, 1, s.ptrim); P(22, 15, 5, 1, s.ptrim); } }
    // head
    P(10, 3, 12, 11, '#f0c9a0');
    if (s.head !== 'hood' && s.head !== 'cowl') {
      g.fillStyle = s.hair;
      if (dir === 3) P(10, 2, 12, 11, s.hair); else { P(10, 2, 12, 4, s.hair); if (dir === 1) P(17, 2, 5, 9, s.hair); if (dir === 2) P(10, 2, 5, 9, s.hair); }
    }
    let eyesHidden = false;
    if (s.head === 'helmet') {
      if (s.visor) {
        P(9, 1, 14, 12, s.hc); P(10, 1, 12, 1, s.hc2);
        if (dir !== 3) { P(11, 7, 10, 2, '#0d0b10'); if (dir === 0) P(15, 9, 2, 3, 'rgba(0,0,0,.35)'); }
        eyesHidden = true;
        if (s.eye && dir !== 3) { P(12, 7, 2, 2, s.eye); P(18, 7, 2, 2, s.eye); if (s.eg) { g.fillStyle = rgba(s.eye, 0.35 + 0.25 * Math.sin(t * 5)); g.fillRect(x + 10, y + 6, 12, 4); } }
      } else { P(9, 1, 14, 5, s.hc); P(10, 1, 12, 1, s.hc2); if (s.nose && dir === 0) P(15, 5, 2, 5, s.hc); }
      if (s.horns) { P(6, -1, 3, 4, s.horns); P(23, -1, 3, 4, s.horns); P(5, -4, 2, 4, s.horns); P(25, -4, 2, 4, s.horns); }
      if (s.plume) { const w = Math.sin(t * 4) * 1; P(14, -3, 4, 5, s.plume); P(15 + w, -6, 3, 4, s.plume); P(16 + w * 1.5, -8, 2, 3, s.plume); }
    } else if (s.head === 'hood' || s.head === 'cowl') {
      if (dir === 3) P(9, 1, 14, 13, s.hc); else { P(9, 1, 14, 5, s.hc); P(9, 4, 2, 9, s.hc); P(21, 4, 2, 9, s.hc); }
      if (s.head === 'cowl') { P(8, 0, 16, 3, s.hc); if (dir !== 3) { P(11, 5, 10, 6, 'rgba(0,0,0,.55)'); eyesHidden = true; if (s.eye) { P(12, 7, 2, 2, s.eye); P(18, 7, 2, 2, s.eye); if (s.eg) { g.fillStyle = rgba(s.eye, 0.3 + 0.25 * Math.sin(t * 5)); g.fillRect(x + 10, y + 6, 12, 4); } } } }
      if (s.mask && dir !== 3) P(10, 9, 12, 4, s.mask);
      if (s.plume) P(21, -2, 2, 6, s.plume);
      if (s.trim && tier >= 2) P(9, 5, 14, 1, s.trim);
    } else if (s.head === 'wiz') {
      g.fillStyle = s.hc; P(7, 2, 18, 3, s.hc);
      g.beginPath(); g.moveTo(x + 9, y + 3); g.lineTo(x + 23, y + 3); g.lineTo(x + 18 + Math.sin(t * 2) * 1.5, y - 11 - Math.min(4, tier)); g.closePath(); g.fill();
      if (s.hband) P(9, 2, 14, 1, s.hband);
      const st = s.gem || '#ffd25a'; P(15, -3, 2, 2, st); if (tier >= 3) { g.fillStyle = rgba(st, 0.4 + 0.3 * Math.sin(t * 4)); g.fillRect(x + 13, y - 5, 6, 6); }
    }
    if (!eyesHidden && dir !== 3) {
      const ec = s.eye || '#1a1a1a';
      if (dir === 0) { P(13, 8, 2, 2, ec); P(17, 8, 2, 2, ec); } if (dir === 1) P(11, 8, 2, 2, ec); if (dir === 2) P(19, 8, 2, 2, ec);
      if (s.eg && s.eye) { g.fillStyle = rgba(s.eye, 0.3); g.fillRect(x + 11, y + 7, 10, 4); }
    }
    if (s.halo) { g.strokeStyle = rgba(s.halo, 0.75 + 0.2 * Math.sin(t * 3)); g.lineWidth = 1.5; g.beginPath(); g.ellipse(x + 16, y - 6 - (s.head === 'wiz' ? 8 : 0), 7, 2.2, 0, 0, Math.PI * 2); g.stroke(); }
    // back view: cape / quiver over the body
    if (dir === 3) {
      if (s.cape) { P(8, 13, 16, 15 + capeWave, s.cape); P(8, 13, 16, 1, s.trim || 'rgba(0,0,0,.25)'); }
      if (s.quiver) { P(8, 12, 4, 10, s.quiver); P(8, 10, 1, 3, '#e8e0d0'); P(10, 10, 1, 3, '#e8e0d0'); }
    }
    if (wcol && dir !== 3) weapon(dir === 1 ? x + 3 : x + 24, y + 8, wcol, wk, dir);
    if (s.fx) particles(g, x, y, s.fx, s.gem || s.aura, t, tier);
    if (s.fx2) particles(g, x, y, s.fx2, s.aura, t * 0.8, tier - 2);
    if (o.flash) { g.fillStyle = 'rgba(255,80,60,0.45)'; g.fillRect(x + 6, y + 2, 20, 27); }
  }
  // draw a centred figure on a canvas (character list, gallery, "Wygląd" window)
  function draw(cv, cls, tier, o) {
    o = o || {}; const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.imageSmoothingEnabled = false;
    const sc = o.scale || Math.max(1, Math.floor(Math.min(w / 44, h / 50)));
    g.save(); g.translate(Math.round(w / 2 - 16 * sc), Math.round(h / 2 - 14 * sc + (o.dy || 0))); g.scale(sc, sc);
    hero(g, 0, 0, { cls, tier, dir: o.dir | 0, t: o.t || 0, walk: o.walk || 0 });
    g.restore();
  }
  // animate canvases with data-skin="cls:tier" (or a list of { c, cls, tier })
  let animList = [], raf = 0;
  function animate(list) {
    animList = list || []; if (raf || typeof requestAnimationFrame === 'undefined') return;
    let last = 0;
    const loop = (ts) => { raf = requestAnimationFrame(loop); if (ts - last < 66) return; last = ts; animList = animList.filter((x) => x.c.isConnected); if (!animList.length) { cancelAnimationFrame(raf); raf = 0; return; } for (const x of animList) draw(x.c, x.cls, x.tier, Object.assign({ t: ts / 1000 }, x.o)); };
    raf = requestAnimationFrame(loop);
  }
  const names = (cls) => (T[cls] || T.war).map((x) => x.n);
  const S = { LV, T, tierFor, hero, draw, animate, names };
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else root.ARDAN_SKINS = S;
})(typeof window !== 'undefined' ? window : this);
