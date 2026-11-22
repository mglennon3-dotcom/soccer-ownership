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
/* Your depth chart order (Tactics → Depth chart): G.depth[role] lists your players for that position in the order you
   set. Players who join later, or come up from the academy, slot in by their rating there; players who leave drop out. */
function depthSync(c, role) {
  const L = (G.depth || {})[role]; if (!L) return null;
  const ok = p => p && p.club === c.id && (role === "GK") === (p.pos === "GK") && !(p.loan && p.loan.from === c.id) && (!p.acad || p.age >= 16);
  const keep = L.filter(id => ok(G.players[id]));
  for (const p of c.squad.map(P).filter(p => ok(p) && !keep.includes(p.id)).sort((a, b) => roleRating(b, role) - roleRating(a, role))) {
    const r = roleRating(p, role), at = keep.findIndex(id => roleRating(G.players[id], role) < r); keep.splice(at < 0 ? keep.length : at, 0, p.id);
  }
  return (G.depth[role] = keep);
}
/* Academy players: the manager picks one he thinks is ready (close to the standard in his position). He's readier to
   do it in a domestic cup tie or against a clearly weaker side, where an academy player gets a real chance (more so
   for a youth-minded manager); in big games (Europe, play-offs) and against equals he sticks with the seniors. */
function easyGame(c, ctx) {
  if (!ctx || !ctx.opp) return false; if (ctx.kind === "cup") return true; if (ctx.kind === "big") return false;
  const xi = q => avg(q.squad.map(P).filter(p => p && !p.acad && !p.inj).sort((a, b) => b.ovr - a.ovr).slice(0, 11).map(p => p.ovr));
  return xi(ctx.opp) <= xi(c) - 3;
}
function pickXI(c, noForce, ctx) {
  const slots = FORMS[clubForm(c)], youth = isMine(c) ? mgr().focus === "youth" : false, easy = easyGame(c, ctx);
  const acadMin = TIER_LVL[c.tier] - (easy ? 10 : 6) - (youth ? 2 : 0), acadB = !easy ? 0 : (ctx.kind === "cup" ? 8 : 5) + (youth ? 2 : 0);
  // Your instruction: in the lesser cup games, give your high-potential youngsters (21 or under, potential well above
  // their rating) the games: academy lads included.
  const yc = isMine(c) && G.youthCups && ctx && ctx.lesser;
  const pool = c.squad.map(P).filter(p => avail(p) && (!p.acad || p.age >= 16 && (p.ovr >= acadMin || (yc && p.age <= 21))) && (!isMine(c) || isReg(p, c)));
  /* Managers know their own players: they pick on ability in each position, prefer a player in his own position (worth
     one point on the 100 scale, about a tenth of a shown point at the top). */
  // A youth-minded manager reads his side on the shown 20-point ratings: a youngster (21 or under) in his own position
  // gets the place over an older player rated the same, and a high-potential one (potential 4+ points above his
  // rating) gets it even a point below. Within the same shown rating the better player still comes first.
  // How much he backs a youngster grows with the potential your staff see in him (their estimate, as on the Squad page):
  // between two lads of the same rating, the one with more to come plays.
  const potGap = new Map(), gapOf = p => { if (!potGap.has(p.id)) { const [a, b] = potEstimate(p); potGap.set(p.id, r20((a + b) / 2) - r20(p.ovr)); } return potGap.get(p.id); };
  const youngFav = p => p.age <= 21 ? (gapOf(p) >= 4 ? 10 + Math.min(gapOf(p), 14) : 6) : 0;
  // ...the five with the most potential (your staff's estimate) who aren't regulars already start, in their own positions where they can.
  const regs = yc ? new Set(pickXI(c, noForce, { ...ctx, lesser: false }).map(o => o.p.id)) : null;
  const ycSet = yc ? new Set(pool.filter(p => p.age <= 21 && gapOf(p) >= 3 && !regs.has(p.id)).sort((a, b) => (potEstimate(b)[0] + potEstimate(b)[1]) - (potEstimate(a)[0] + potEstimate(a)[1])).slice(0, 5).map(p => p.id)) : null;
  const ycB = p => ycSet && ycSet.has(p.id) ? 260 : 0;  // above your depth chart, below "insist he starts"
  // A club that borrows a player agreed to give him games: yours start in their own position nearly every week.
  // Your pick: a player you insist on starts (in his own position if there's a place, otherwise in the same area).
  const forced = isMine(c) && !noForce ? (p, s) => p.force ? (p.pos === s ? 300 : (s === "GK") === (p.pos === "GK") ? (POS_LINE[p.pos] === POS_LINE[s] ? 250 : 0) : 0) : 0 : () => 0;
  // Your depth chart: the higher you've put a player for a position, the stronger his claim to it (below "insist he starts").
  const dl = isMine(c) && !noForce && G.depth ? Object.fromEntries(Object.keys(G.depth).map(r => [r, depthSync(c, r)])) : {};
  const depthB = (p, s) => { const L = dl[s]; if (!L) return 0; const i = L.indexOf(p.id); return i < 0 ? 0 : Math.max(20, 200 - i * 6); };
  const lent = isMine(c) ? forced : (p, s) => p.loan && p.loan.to === c.id ? (p.loan.from === G.club ? (p.pos === s ? 300 : (s === "GK") === (p.pos === "GK") ? (POS_LINE[p.pos] === POS_LINE[s] ? 250 : 200) : 0) : p.pos === s ? 4 : 0) : 0;
  // Tired players get rested: below 85% sharpness a player starts losing his place to a fresh deputy.
  // How readily his manager rotates: a big rotator rests players from about 94% sharpness, a creature of habit not until
  // about 80% (an AI club's coach is middling unless he has his own setting).
  const rot = (isMine(c) ? rotOf(staffOf("manager")) : (c.coach && c.coach.rot) || 50) / 100;
  const tired = p => Math.max(0, 80 + rot * 14 - (p.fit ?? 100)) * (.1 + rot * .5);
  const score = youth
    ? (p, s) => r20(roleRating(p, s)) * 10 + roleRating(p, s) / 50 + (p.pos === s ? 2 + youngFav(p) : 0) - tired(p) * 2.5 + forced(p, s) * 10 + depthB(p, s) * 10 + (p.acad && p.pos === s ? acadB * 10 : 0) + (p.pos === s ? ycB(p) * 10 : 0) + (p.id % 7) * .0001
    : (p, s) => roleRating(p, s) + (p.pos === s ? 1 : 0) + lent(p, s) + depthB(p, s) - tired(p) + (p.acad && p.pos === s ? acadB : 0) + (p.pos === s ? ycB(p) * 5 : 0) + (p.id % 7) * .0001;
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
// An emergency short contract: part of his rate at this club, never more than about the division's typical wage.
const emergencyWage = (p, c, k) => Math.max(1000, Math.round(Math.min(wageAt(p.ovr, c.tier) * k, wageFor(TIER_LVL[c.tier]) * 1.2) / 100) * 100);
function emergencyXI(c) {
  // No fit keeper: the club signs one from the free agents for the match (and beyond, on a short contract).
  if (!c.squad.some(id => P(id).pos === "GK" && avail(P(id)) && (!P(id).acad || P(id).age >= 17) && isReg(P(id), c))) {
    // The free-agent keeper nearest the club's own level (not the best one going), on an emergency wage.
    const gk = G.fa.map(P).filter(p => p && p.pos === "GK" && p.age <= 36).sort((a, b) => Math.abs(a.ovr - TIER_LVL[c.tier]) - Math.abs(b.ovr - TIER_LVL[c.tier]))[0];
    if (gk) { logMove("in", gk, { club: "Free agent", fee: 0, wage: 0, by: "emergency" }); moveTo(gk, c); registerNew(gk, c, true); gk.wage = emergencyWage(gk, c, .6); gk.yrs = 1; news(`With no fit goalkeeper, ${c.name} sign ${gk.name} from the free agents on a short contract.`, true); }
  }
  const need = 11 - pickXI(c).length; if (need <= 0) return;
  const fa = G.fa.map(P).filter(p => p && p.age <= 34).sort((a, b) => a.wage - b.wage);
  for (const p of fa.slice(0, need)) { logMove("in", p, { club: "Free agent", fee: 0, wage: 0, by: "emergency" }); moveTo(p, c); registerNew(p, c, true); p.wage = emergencyWage(p, c, .5); p.yrs = 1; }
  news(`${c.name} couldn't field eleven players: ${Math.min(need, fa.length)} trialist${need > 1 ? "s" : ""} from the free agents sign short contracts to make up the side.`, true);
}
function playMatch(h, a, neutral, fr, kind) {
  for (const id of [h, a]) if (isMine(CL(id))) emergencyXI(CL(id));  // fr: a friendly, kept out of players' records
  const H = CL(h), A = CL(a), xh = pickXI(H, false, { opp: A, kind, lesser: MATCH_LESSER }), xa = pickXI(A, false, { opp: H, kind, lesser: MATCH_LESSER }), ph = teamPower(H, xh), pa = teamPower(A, xa);
  const sh = STYLES[clubStyle(H)], sa = STYLES[clubStyle(A)], fh = styleFit(xh, clubStyle(H)), fa = styleFit(xa, clubStyle(A));
  const adv = neutral ? 0 : 2 + fanShare(H, "hard") * 2 + (isMine(H) ? terraceShare(H) * 1.2 + fzK(H) * .3 : 0), wx = G.wx ? wxAt(H) : WX.clear;
  const bh = clubBoost(CL(h)), ba = clubBoost(CL(a));
  let lh = 1.3 * Math.exp(.065 * (ph.atk - pa.def + adv + bh - ba)), la = 1.3 * Math.exp(.065 * (pa.atk - ph.def - adv + ba - bh));
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
    const g = scorer(xi, "g"); if (!g) continue; if (!fr) addStat(g, 1); if (!fr && !kind) lsOf(g).g++; let as = null;
    if (R() < .7) { as = scorer(xi.filter(o => o.p !== g), "a"); if (as && !fr) { addStat(as, 2); if (!kind) lsOf(as).a++; } }
    ev.push({ m: ri(1, 90), side, g: g.name, a: as ? as.name : null });
  }
  /* Substitutions: up to three (five in a friendly). The most tired outfield starters come off, each replaced by a
     bench player from the same part of the pitch; the manager spreads the minutes, favouring those who've played least.
     Your own side in competitive games goes by your depth chart instead: the first-choice cover comes on. */
  const subsFor = (c, xi) => {
    const n = fr ? 5 : xi.length >= 11 ? 3 : 0; if (!n) return { off: new Set(), on: [] };
    const used = new Set(xi.map(o => o.p.id)), bench = c.squad.map(P).filter(p => avail(p) && !used.has(p.id) && p.pos !== "GK" && (!p.acad || p.age >= 17) && (!isMine(c) || isReg(p, c)) && !(p.loan && p.loan.from === c.id));
    const off = new Set(), on = [];
    for (const o of xi.filter(o => o.slot !== "GK").sort((a, b) => (a.p.fit ?? 100) - (b.p.fit ?? 100))) {
      if (on.length >= n) break;
      // Your side in a competitive game follows the depth chart: the first-choice cover for that position comes on.
      const dep = isMine(c) && !fr ? (depthSync(c, o.slot) || bench.slice().sort((a, b) => roleRating(b, o.slot) - roleRating(a, o.slot)).map(q => q.id)) : null;
      const pick = (dep && bench.filter(q => !on.includes(q) && (o.slot === "GK") === (q.pos === "GK")).sort((a, b) => (dep.indexOf(a.id) + 1 || 999) - (dep.indexOf(b.id) + 1 || 999))[0])
        || bench.filter(q => !on.includes(q) && POS_LINE[q.pos] === POS_LINE[o.slot]).sort((a, b) => (b.ovr - b.s.app * .5) - (a.ovr - a.s.app * .5))[0]
        || bench.filter(q => !on.includes(q)).sort((a, b) => (b.ovr - b.s.app * .5) - (a.ovr - a.s.app * .5))[0];
      if (!pick) break; off.add(o.p.id); on.push(pick);
    }
    return { off, on };
  };
  for (const [c, xi] of [[H, xh], [A, xa]]) {
    const { off, on: subs } = subsFor(c, xi);
    for (const { p } of xi) { tire(p, off.has(p.id) ? .7 : 1, fr); if (fr) { if (R() < .5) injuryCheck(p, pq); continue; } if (!p.tot[0] && !p.s.app) p.debut = G.year; addStat(p, 0); injuryCheck(p, pq); }
    for (const p of subs) { tire(p, .35, fr); if (fr) continue; if (!p.tot[0] && !p.s.app) p.debut = G.year; addStat(p, 0); p.s.sub = (p.s.sub || 0) + 1; if (p.club >= 0) { const b = scOf(p).by[p.club]; b[3] = (b[3] || 0) + 1; } if (R() < .4) injuryCheck(p, pq); }
  }
  if (!fr && !kind) for (const [xi, conceded] of [[xh, ag], [xa, hg]]) { const gk = xi.find(o => o.slot === "GK"); if (gk && !conceded) lsOf(gk.p).cs++; }  // a league clean sheet for the keeper
  ev.sort((x, y) => x.m - y.m);
  return { h, a, hg, ag, ev, fit: [fh, fa], xg: [r1(lh), r1(la)] };
}
/* Sharpness (fitness, 0-100): a full game costs 6-16 points (less with stamina), a friendly half that; it comes back
   each week, faster with better training. Managers rest players who drop below about 85. */
function tire(p, part, fr) { p.fit = clamp((p.fit ?? 100) - (15 - (p.at.sta || 50) / 10) * part * (fr ? .5 : 1) * (p.pos === "GK" ? .3 : 1), 30, 100); }
/* Each week your picks start that the manager wouldn't have picked himself cost his trust (scaled by his tolerance), and
   count as meddling. */
const MAX_FORCED = 3;
function forcedWeek() {
  const c = my(), m = staffOf("manager"); if (!m || G.phase !== "season") return;
  const picks = c.squad.map(P).filter(p => p.force); if (!picks.length) return;
  const own = new Set(pickXI(c, true).map(o => o.p.id)), xi = new Set(pickXI(c).map(o => o.p.id));
  for (const p of picks) {
    if (!xi.has(p.id) || own.has(p.id)) continue;  // he'd have picked him anyway, or he isn't playing
    G.meddle = (G.meddle || 0) + .05; meddled("manager", -.7, null, "Your team picks over the manager's");
    if (!p.forceNoted) { p.forceNoted = true; news(`${m.name} isn't happy being told to start ${p.name}: ${pr(m, "he")} wouldn't pick him.`, tolOf(m) < 40); }
  }
}
function recoverWeek() {
  for (const c of G.clubs) { if (c.gone && !c.abroad) continue; const back = 8 + (isMine(c) ? c.fac.train.lvl : c.train || 3) * .4 - (G.phase === "season" && inEurope(c) ? 2.5 : 0);
    for (const id of c.squad) { const p = P(id); if (p && p.fit != null && p.fit < 100) p.fit = Math.min(100, p.fit + back); } }
}
/* A game, goal or assist counts for the season and for the club he's playing for (a loan club included), so the
   card can show his career club by club. */
/* League goals, assists and clean sheets this season (p.ls), for the Golden Boot, most assists and Golden Glove. */
const lsOf = p => p.ls && p.ls.y === G.year ? p.ls : (p.ls = { y: G.year, g: 0, a: 0, cs: 0 });
/* Stats by type of game: league (play-offs included; foreign clubs' leagues too), domestic cups, Europe. This season
   (p.ss) and career since they've been kept (p.ct): [apps, goals, assists]. MATCH_CT is set by whoever plays the game. */
let MATCH_CT = "L", MATCH_LESSER = false;  // MATCH_LESSER: a lesser cup game (see playKO)
const ssOf = p => p.ss && p.ss.y === G.year ? p.ss : (p.ss = { y: G.year, L: [0, 0, 0], C: [0, 0, 0], E: [0, 0, 0] });
// This season, club by club (p.sc.by[club] = [apps, goals, assists]): a player who moves mid-season keeps each club's share.
// Started part-way through a season (an old save), his games so far go to the club he's at.
const scOf = p => p.sc && p.sc.y === G.year ? p.sc : (p.sc = { y: G.year, by: p.club >= 0 && p.s && p.s.app ? { [p.club]: [p.s.app, p.s.g, p.s.a, p.s.sub || 0] } : {} });
const seasonAt = (p, cid) => { const S = p.sc && p.sc.y === G.year && p.sc.by[cid]; return S || (p.sc && p.sc.y === G.year ? [0, 0, 0] : p.club === cid ? [p.s.app, p.s.g, p.s.a] : [0, 0, 0]); };
// His season for his current club only (apps, goals, assists, sub appearances): what your squad screens count.
const myS = p => { const v = p.club >= 0 ? seasonAt(p, p.club) : [p.s.app, p.s.g, p.s.a], split = p.sc && p.sc.y === G.year && p.sc.by[p.club];
  return { app: v[0], g: v[1], a: v[2], sub: split ? split[3] || 0 : p.s.sub || 0 }; };
function addStat(p, k) { if (p.club >= 0) (scOf(p).by[p.club] ||= [0, 0, 0])[k]++; const t = MATCH_CT; ssOf(p)[t][k]++; ((p.ct ||= { L: [0, 0, 0], C: [0, 0, 0], E: [0, 0, 0] })[t])[k]++; p.s[["app", "g", "a"][k]]++; if (p.club >= 0) ((p.cs ||= {})[p.club] ||= [0, 0, 0])[k]++; }
function injuryCheck(p, pq) {
  const c = CL(p.club), tl = isMine(c) ? c.fac.train.lvl : c.train, surf = pq != null && pq < 60 ? 1 + (60 - pq) / 50 : 1;
  if (R() < .011 * (1.3 - tl * .05) * surf * (G.phase === "season" && inEurope(c) ? 1.25 : 1)) {
    const wks = R() < .8 ? ri(1, 4) : R() < .8 ? ri(5, 12) : ri(13, 30); p.inj = wks; p.injT = wks;
    if (isMine(c)) { const bill = wks >= 5 ? medBill(c, wks) : 0; if (bill) spend("medical", bill); news(`${p.name} is injured and out for ${wks} week${wks > 1 ? "s" : ""}${bill ? `: treatment costs ${money(bill)}` : ""}.`, wks >= 8); }
  }
}
