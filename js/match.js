/* Matches. You don't pick the team or watch the game: the manager picks his side in his formation and plays his
   style, and you read the result. Strength comes from the XI's ratings in their slots, the manager's tactics, how well
   the squad suits his style, morale and home advantage; goals are Poisson draws from expected goals. */
"use strict";

// What each slot contributes to [attack, midfield, defence].
const SLOT_W = { GK: [0, 0, 1.6], CB: [.05, .2, 1], FB: [.25, .3, .8], DM: [.1, .9, .65], CM: [.35, 1, .3], AM: [.75, .8, .1], W: [1, .45, .1], ST: [1, .2, .03] };
const avail = p => p && !p.inj;
const clubForm = c => isMine(c) ? (mgr().form || "4-4-2") : c.coach.form;
const clubStyle = c => isMine(c) ? mgr().phil : c.coach.style;
const clubTac = c => isMine(c) ? mgr().at.tac : c.coach.tac;

/* The manager's pick: the best player for each slot, hardest slots first. A manager who trusts youth gives
   young players with room to grow the benefit of the doubt. */
function pickXI(c) {
  const slots = FORMS[clubForm(c)], youth = isMine(c) ? mgr().focus === "youth" : false;
  const pool = c.squad.map(P).filter(p => avail(p) && (!p.acad || p.age >= 17 && p.ovr >= TIER_LVL[c.tier] - 6));
  /* Managers know their own players: they pick on ability in each position, prefer a player in his own position (worth
     one point on the 100 scale, about a tenth of a shown point at the top), and a manager who trusts youth gives a
     promising youngster in his own position up to 1.5 more: enough to pick him over a slightly better senior player,
     never over a clearly better one. */
  const score = (p, s) => roleRating(p, s) + (p.pos === s ? 1 : 0) + (youth && p.age <= 21 && p.pos === s ? Math.min(1.5, (p.pot - p.ovr) * .1) : 0) + (p.id % 7) * .0001;
  // The strongest player-position pairs first, across the whole formation (not slot by slot)...
  const pairs = [];
  for (let i = 0; i < slots.length; i++) for (const p of pool) pairs.push([score(p, slots[i]), i, p]);
  pairs.sort((a, b) => b[0] - a[0]);
  const out = Array(11).fill(null), used = new Set();
  for (const [, i, p] of pairs) { if (out[i] || used.has(p.id)) continue; out[i] = p; used.add(p.id); }
  // ...then swap players between positions, and with the bench, while it makes the side better.
  for (let pass = 0, better = true; better && pass < 8; pass++) {
    better = false;
    for (let a = 0; a < 11; a++) for (let b = a + 1; b < 11; b++) {
      const pa = out[a], pb = out[b]; if (!pa || !pb) continue;
      if (score(pa, slots[b]) + score(pb, slots[a]) > score(pa, slots[a]) + score(pb, slots[b]) + 1e-9) { out[a] = pb; out[b] = pa; better = true; }
    }
    for (let a = 0; a < 11; a++) for (const q of pool) {
      if (used.has(q.id)) continue;
      if (!out[a] || score(q, slots[a]) > score(out[a], slots[a]) + 1e-9) { if (out[a]) used.delete(out[a].id); out[a] = q; used.add(q.id); better = true; }
    }
  }
  return out.map((p, i) => p ? { p, slot: slots[i], i } : null).filter(Boolean);
}
/* Style fit: how far the XI's style attributes sit above their own average. +1 is a squad built for the style,
   -1 one that can't play it. */
function styleFit(xi, style) {
  const keys = STYLES[style].keys, f = [];
  for (const { p } of xi) { if (p.pos === "GK") continue; const all = avg(OUT_KEYS.map(k => p.at[k])); f.push(avg(keys.map(k => p.at[k])) - all); }
  return clamp(avg(f) / 6, -1, 1);
}
function teamPower(c, xi) {
  let a = 0, m = 0, d = 0, wa = 0, wm = 0, wd = 0;
  for (const { p, slot } of xi) { const r = roleRating(p, slot) - (p.unsettled > 0 ? 3 : 0), w = SLOT_W[slot]; a += r * w[0]; m += r * w[1]; d += r * w[2]; wa += w[0]; wm += w[1]; wd += w[2]; }
  const missing = 11 - xi.length;  // a side short of players is badly weakened
  const A = a / (wa || 1), M = m / (wm || 1), D = d / (wd || 1);
  const morale = ((isMine(c) ? c.morale : 55) - 55) / 15;  // about +-3
  const tac = (clubTac(c) - 50) / 20 + prepBonus(c);  // about +-2.5, plus pre-season sharpness or rust
  return { atk: .65 * A + .35 * M + morale + tac - missing * 4, def: .7 * D + .3 * M + morale + tac - missing * 4 };
}
function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }
function scorer(xi, kind) {
  const w = kind === "g" ? { ST: 5, W: 3, AM: 3, CM: 1.3, DM: .5, FB: .5, CB: .7, GK: 0 } : { ST: 1.5, W: 3, AM: 3.5, CM: 2.5, DM: 1, FB: 1.5, CB: .4, GK: .05 };
  const k = kind === "g" ? "fin" : "pas";
  const o = xi.length ? wpick(xi, o => w[o.slot] * Math.pow((o.p.at[k] || 30) / 50, 2)) : null;
  return o ? o.p : null;
}
/* A side that can't field eleven (everyone sold, injured or suspended) signs trialists from the free agents to make up
   the numbers, so a match is never played a man short by accident. Only your club can end up here. */
function emergencyXI(c) {
  const need = 11 - pickXI(c).length; if (need <= 0) return;
  const fa = G.fa.map(P).filter(p => p && p.age <= 34).sort((a, b) => a.wage - b.wage);
  for (const p of fa.slice(0, need)) { moveTo(p, c); p.wage = Math.max(1000, Math.round(wageFor(p.ovr) * .5 / 100) * 100); p.yrs = 1; }
  news(`${c.name} couldn't field eleven players: ${Math.min(need, fa.length)} trialist${need > 1 ? "s" : ""} from the free agents sign short contracts to make up the side.`, true);
}
function playMatch(h, a, neutral, fr) {
  for (const id of [h, a]) if (isMine(CL(id))) emergencyXI(CL(id));  // fr: a friendly, kept out of players' records
  const H = CL(h), A = CL(a), xh = pickXI(H), xa = pickXI(A), ph = teamPower(H, xh), pa = teamPower(A, xa);
  const sh = STYLES[clubStyle(H)], sa = STYLES[clubStyle(A)], fh = styleFit(xh, clubStyle(H)), fa = styleFit(xa, clubStyle(A));
  const adv = neutral ? 0 : 2, wx = G.wx ? wxAt(H) : WX.clear;
  let lh = 1.3 * Math.exp(.065 * (ph.atk - pa.def + adv)), la = 1.3 * Math.exp(.065 * (pa.atk - ph.def - adv));
  lh *= sh.for * (1 + .08 * fh) * sa.against * (1 - .06 * fa);
  la *= sa.for * (1 + .08 * fa) * sh.against * (1 - .06 * fh);
  // Bad weather: fewer goals, and passing football suffers most.
  const wf = st => wx.play * (wx.play < 1 && (st === "possession" || st === "wing") ? .96 : 1); lh *= wf(clubStyle(H)); la *= wf(clubStyle(A));
  // A worn home pitch blunts passing football (both sides) and makes the game scrappier.
  const pq = isMine(H) && !neutral ? pitchOf(H) : null;
  if (pq != null && pq < 70) { const k = st => (st === "possession" || st === "wing" || st === "counter" ? .004 : .002) * (70 - pq); lh *= 1 - k(clubStyle(H)); la *= 1 - k(clubStyle(A)); }
  const hg = poisson(clamp(lh, .1, 6)), ag = poisson(clamp(la, .1, 6));
  const ev = [];
  for (const [xi, n, side] of [[xh, hg, 0], [xa, ag, 1]]) for (let i = 0; i < n; i++) {
    const g = scorer(xi, "g"); if (!g) continue; if (!fr) g.s.g++; let as = null;
    if (R() < .7) { as = scorer(xi.filter(o => o.p !== g), "a"); if (as && !fr) as.s.a++; }
    ev.push({ m: ri(1, 90), side, g: g.name, a: as ? as.name : null });
  }
  for (const xi of [xh, xa]) for (const { p } of xi) { if (fr) { if (R() < .5) injuryCheck(p, pq); continue; } if (!p.tot[0] && !p.s.app) p.debut = G.year; p.s.app++; injuryCheck(p, pq); }
  ev.sort((x, y) => x.m - y.m);
  return { h, a, hg, ag, ev, fit: [fh, fa], xg: [r1(lh), r1(la)] };
}
function injuryCheck(p, pq) {
  const c = CL(p.club), tl = isMine(c) ? c.fac.train.lvl : c.train, surf = pq != null && pq < 60 ? 1 + (60 - pq) / 50 : 1;
  if (R() < .011 * (1.3 - tl * .05) * surf) {
    const wks = R() < .8 ? ri(1, 4) : R() < .8 ? ri(5, 12) : ri(13, 30); p.inj = wks;
    if (isMine(c)) news(`${p.name} is injured and out for ${wks} week${wks > 1 ? "s" : ""}.`, wks >= 8);
  }
}
