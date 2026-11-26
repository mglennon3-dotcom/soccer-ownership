/* Matches. You don't pick the team or watch the game: the manager picks his side in his formation and plays his
   style, and you read the result. Strength comes from the XI's ratings in their slots, the manager's tactics, how well
   the squad suits his style, morale and home advantage; goals are Poisson draws from expected goals. */
"use strict";

// What each slot contributes to [attack, midfield, defence].
const SLOT_W = { GK: [0, 0, 1.6], CB: [.05, .2, 1], FB: [.25, .3, .8], DM: [.1, .9, .65], CM: [.35, 1, .3], AM: [.75, .8, .1], W: [1, .45, .1], ST: [1, .2, .03] };
const avail = p => p && !p.inj;
// An academy player good enough for the first team (your youth manager's 'ready' bar): he's in your depth charts and can be picked.
const acadOK = (p, c) => !!p && p.acad && p.age >= 16 && typeof youthReady === "function" && youthReady(p, c);
// ...and, for each position, your best academy player (any age) even if he isn't there yet: in the depth chart, marked academy.
const acadDepth = (p, c) => !!p && p.acad && (acadOK(p, c) || c.squad.map(P).filter(q => q && q.acad && q.pos === p.pos && !(q.loan && q.loan.from === c.id)).sort((a, b) => b.ovr - a.ovr || a.id - b.id)[0] === p);
const clubForm = c => isMine(c) ? (mgr().form || "4-4-2") : c.coach.form;
const baseStyle = c => isMine(c) ? mgr().phil : c.coach.style;
const clubStyle = c => (MATCH_ST && MATCH_ST[c.id]) || baseStyle(c);  // the style for this game (the manager's plan), else his usual one
const clubTac = c => isMine(c) ? mgr().at.tac : c.coach.tac;

/* The manager's pick: the best player for each slot, hardest slots first. A manager who trusts youth gives
   young players with room to grow the benefit of the doubt. */
/* Your depth chart order (Tactics → Depth chart): G.depth[role] lists your players for that position in the order you
   set. Players who join later, or come up from the academy, slot in by their rating there; players who leave drop out. */
/* Only players from that line of the team (defence, midfield, attack) go in a position's depth chart, unless you've
   added one from another line yourself (G.depthX[role]): no strikers at centre-back by default. */
const depthLine = (p, role) => POS_LINE[p.pos] === POS_LINE[role] || ((G.depthX || {})[role] || []).includes(p.id);
function depthSync(c, role) {
  const L = (G.depth || {})[role]; if (!L) return null;
  const ok = p => p && p.club === c.id && (role === "GK") === (p.pos === "GK") && depthLine(p, role) && !(p.loan && p.loan.from === c.id) && (!p.acad || acadOK(p, c) || (acadDepth(p, c) && p.pos === role));
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
/* Minutes targets: from his player card you tell the manager how many minutes a player should get this season (for
   his development). The manager keeps him on pace through the season: a little behind and he comes off the bench
   first; a game or more behind and he starts. Starts and sub appearances both count. */
const MIN_TARGETS = [0, 450, 900, 1350, 1800, 2250, 2700, 3150];
const seasonFrac = () => G.phase === "season" ? clamp(G.week / (SEASON_WEEKS - 2), 0, 1) : G.phase === "playoffs" ? 1 : 0;
const minBehind = p => p.minT && p.club === G.club ? p.minT * seasonFrac() - ((p.s && p.s.min) || 0) : 0;
function pickXI(c, noForce, ctx) {
  const slots = FORMS[clubForm(c)], youth = isMine(c) ? mgr().focus === "youth" : false, easy = easyGame(c, ctx);
  const acadMin = TIER_LVL[c.tier] - (easy ? 10 : 6) - (youth ? 2 : 0) - (embargoed(c) ? 4 : 0), acadB = !easy ? 0 : (ctx.kind === "cup" ? 8 : 5) + (youth ? 2 : 0);
  // Your instruction: in the lesser cup games, give your high-potential youngsters (21 or under, potential well above
  // their rating) the games: academy lads included.
  const yc = isMine(c) && ctx && !ctx.noYc && ((G.youthCups && ctx.lesser) || (G.ytie && ctx.opp && G.ytie.opp === ctx.opp.id && G.ytie.w === G.week && G.ytie.y === G.year));
  const cov = isMine(c) && !(ctx && ctx.coverOff) ? G.cover || {} : {}, covId = new Set(Object.values(cov).filter(v => v.ans === "acad").flatMap(v => v.pids || [v.pid]));  // injury cover: your academy pick
  const pool = c.squad.map(P).filter(p => avail(p) && (!p.acad || (p.age >= 16 && (p.ovr >= acadMin || (yc && p.age <= 21) || covId.has(p.id) || (isMine(c) && p.minT))) || (isMine(c) && acadDepth(p, c))) && (!isMine(c) || isReg(p, c)));
  // In an easy game the nudge for academy players goes to the two best of them only (the ones he thinks are nearly ready),
  // and it's worth a point or two on the shown scale: enough to choose a lad over a senior of about his level, never over
  // a clearly better one.
  const acadPick = new Set(acadB ? pool.filter(p => p.acad).sort((a, b) => b.ovr - a.ovr).slice(0, 2).map(p => p.id) : []);
  // Your minutes target: a game or more behind pace and he starts (in his own position, or the same area of the team).
  const minB = isMine(c) && !noForce ? (p, s) => { const b = minBehind(p); return b < 90 ? 0 : (s === "GK") !== (p.pos === "GK") ? 0 : (p.pos === s ? 1 : POS_LINE[p.pos] === POS_LINE[s] ? .8 : 0) * Math.min(260, 120 + b / 90 * 30); } : () => 0;
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
  const regs = yc ? new Set(pickXI(c, noForce, { ...ctx, lesser: false, noYc: true }).map(o => o.p.id)) : null;
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
  const rot = clamp((isMine(c) ? rotOf(staffOf("manager")) : (c.coach && c.coach.rot) || 50) / 100, 0, 1);  // his own habit, whatever the style
  const tired = p => Math.max(0, 80 + rot * 14 - (p.fit ?? 100)) * (.1 + rot * .5);
  // Your instruction from his player card: he starts the domestic cup games (or the European games) (when fit and registered), ahead of any
  // youth rotation or other pick: in his own position, or failing that in the same area of the team.
  const cupB = isMine(c) && !noForce && (MATCH_CT === "C" || MATCH_CT === "E") ? (p, s) => (MATCH_CT === "C" ? p.cupStart : p.euroStart) ? (p.pos === s ? 5000 : (s === "GK") === (p.pos === "GK") && POS_LINE[p.pos] === POS_LINE[s] ? 4000 : 0) : 0 : () => 0;
  const score = youth
    ? (p, s) => r20(roleRating(p, s)) * 10 + roleRating(p, s) / 50 + (p.pos === s ? 2 + youngFav(p) : 0) - tired(p) * 2.5 + forced(p, s) * 10 + cupB(p, s) * 10 + depthB(p, s) * 10 + minB(p, s) * 10 + (acadPick.has(p.id) && p.pos === s ? acadB * 2 : 0) + (p.pos === s ? ycB(p) * 10 : 0) + (covId.has(p.id) && cov[s] && (cov[s].pids || [cov[s].pid]).includes(p.id) ? 2600 : 0) + (p.id % 7) * .0001
    : (p, s) => roleRating(p, s) + (p.pos === s ? 1 : 0) + lent(p, s) + cupB(p, s) + depthB(p, s) + minB(p, s) - tired(p) + (acadPick.has(p.id) && p.pos === s ? acadB : 0) + (p.pos === s ? ycB(p) * 5 : 0) + (covId.has(p.id) && cov[s] && (cov[s].pids || [cov[s].pid]).includes(p.id) ? 1300 : 0) + (p.id % 7) * .0001;
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
/* How the eleven's types fit together: partnerships that click (a stopper with a covering defender, a big man with a
   little man, a playmaker with a ball-winner to mind him) and ones that don't (two ball-playing centre-backs with nobody
   to win a header, a midfield of passers with nobody to win it back, nobody to score the goals). Each is worth a little
   in attack or defence; together at most a little over half as much as morale. Returns { atk, def, good: [...], bad: [...] }. */
/* ---------- how the types fit together ----------
   For each type: the styles it suits (+) or doesn't (-), the teammates it clicks with (w) and clashes with (x). Pairings
   run both ways (one side listing it is enough). Attackers pair with attackers and midfielders; defenders and keepers with
   defenders and midfielders; midfielders with everyone. */
const CHEM_T = {
  POA: ["+possession +wing -press -counter -defensive", "TM DLF CRE DRB DW WPM PM BC", "POA SHS WW IF DES DLP"],
  TM: ["+direct +wing -possession -press -counter", "POA RIB SHS DW B2B", "TM DLF DRB IF PM DLP DES"],
  RIB: ["+press +counter +direct -possession -defensive", "TM DLF CRE WPM DW PM BC DLP", "RIB DRB WW"],
  DLF: ["+possession +counter +press -direct -wing", "RIB POA SHS IF B2B BC DES", "TM DLF CRE DW"],
  CRE: ["+possession +counter -direct -defensive", "POA RIB SHS IF DW WW BW B2B ANC DES", "DLF WPM PM"],
  SHS: ["+counter +direct +wing +press -defensive", "TM DLF CRE DW WPM PM DLP", "POA IF B2B"],
  DRB: ["+possession +counter -press -direct", "POA WW B2B BW DES", "TM RIB DW BC WPM"],
  DW: ["+counter +wing +press -possession", "TM POA RIB CRE SHS PM", "DLF DRB"],
  IF: ["+possession +counter -wing", "DLF CRE BC PM", "TM SHS POA"],
  WPM: ["+possession +wing -press -direct", "POA RIB SHS B2B BW DES", "CRE DRB"],
  WW: ["+press +defensive -wing", "DRB CRE PM DLP B2B", "POA RIB"],
  B2B: ["+press +direct -possession -defensive", "TM DLF CRE DRB WPM WW PM DLP ANC COV", "SHS BC B2B"],
  PM: ["+possession +counter -direct -defensive", "POA RIB SHS DW IF WW B2B BW ANC BPD IFB DES", "TM CRE PM"],
  BC: ["+counter +press -defensive", "POA RIB DLF IF BW DLP ANC DES", "DRB B2B BC IFB"],
  DLP: ["+possession +counter -press -direct", "RIB SHS WW B2B BC BW DES ANC BPD IFB BPK", "POA TM DLP"],
  DES: ["+press +counter -direct -defensive", "DLF CRE DRB WPM PM DLP BC OFB", "POA TM DES BW ANC"],
  BW: ["+press +counter", "CRE DRB WPM PM DLP BC OFB BPD", "BW DES"],
  ANC: ["+direct +defensive -press", "CRE PM DLP B2B BC OFB SS CMD", "ANC DES"],
  OFB: ["+press +wing -defensive", "BW ANC DES DFB COV SS", ""],
  DFB: ["+counter +defensive -wing", "OFB", "DFB"],
  IFB: ["+possession -direct -wing", "PM DLP BPD BPK", "SS BC IFB"],
  STP: ["+press +defensive", "COV BPD", ""],
  AER: ["+direct +defensive -possession -press", "BPD COV", "BPK CMD"],
  BPD: ["+possession +wing -direct", "AER STP PM DLP BW IFB BPK CMD", "SS"],
  COV: ["+press +counter -defensive -direct", "STP AER OFB B2B CMD", ""],
  SS: ["+counter +defensive -press", "OFB ANC", "BPD IFB"],
  BPK: ["+possession +press -direct", "BPD IFB DLP", "AER"],
  CMD: ["+direct +defensive -possession", "BPD COV ANC", "AER"],
};
const CHEM_STYLE = {}, CHEM_PAIR = {};
for (const [k, [st, w, x]] of Object.entries(CHEM_T)) {
  CHEM_STYLE[k] = Object.fromEntries(st.split(" ").filter(Boolean).map(t => [t.slice(1), t[0] === "+" ? 1 : -1]));
  for (const [list, v] of [[w, 1], [x, -1]]) for (const o of list.split(" ").filter(Boolean)) { CHEM_PAIR[k + "|" + o] = v; CHEM_PAIR[o + "|" + k] = v; }
}
const ARCH_NAME = Object.fromEntries(Object.values(ARCHETYPES).flat().map(a => [a[3], a[0]]));
const CREATORS = ["PM", "DLP", "CRE", "WPM", "DLF", "IFB"], WINNERS = ["BW", "ANC", "B2B", "DES"], SCORERS = ["POA", "RIB", "SHS", "IF", "TM"];
const SLOT_LINE = { GK: 0, CB: 1, FB: 1, DM: 2, CM: 2, AM: 3, W: 3, ST: 3 }, ATK_SHARE = [0, 0, .5, 1];
const ringLine = slot => SLOT_LINE[slot] === 3 ? "att" : SLOT_LINE[slot] === 2 ? "mid" : "def";
// how close two players are: the same position counts most, the same line next, then the line next to it
const pairW = (a, b) => a === b ? .5 : SLOT_LINE[a] === SLOT_LINE[b] ? .35 : Math.abs(SLOT_LINE[a] - SLOT_LINE[b]) === 1 ? .25 : .15;
/* How the eleven fit together, playing a given style. Team effect: { atk, def, good, bad } (at most +-2.5 each); per
   player, the ring on the tactics board: seg[pid] = { tl, tr, br, st }: an attacker's top left is the other attackers, a
   defender's (or the keeper's) the other defenders, top right the midfielders; a midfielder's top left the attackers, top
   right the midfielders, bottom right the defence; st the style. */
function archChem(xi, style) {
  const n = {}, A = xi.map(o => ({ ...o, a: archetypeOf(o.p) })), seg = {}; for (const o of A) if (o.a) n[o.a[3]] = (n[o.a[3]] || 0) + 1;
  const has = (...k) => k.reduce((s, x) => s + (n[x] || 0), 0), lab = o => `${o.p.name.split(" ").slice(-1)[0]} (${o.a[0].toLowerCase()})`;
  let atk = 0, def = 0; const good = [], bad = [], seen = new Set();
  for (const o of A) seg[o.p.id] = { tl: 0, tr: 0, br: 0, st: 0, mid: ringLine(o.slot) === "mid", why: [] };
  const split = (v, ...slots) => { const s = avg(slots.map(x => ATK_SHARE[SLOT_LINE[x]])); atk += v * s; def += v * (1 - s) * .67; };  // the back line has more pairings: each counts a little less
  const mark = (o, q, v, t) => { const L = ringLine(o.slot), OL = ringLine(q.slot), s = seg[o.p.id];
    const k = L === "mid" ? { att: "tl", mid: "tr", def: "br" }[OL] : OL === "mid" ? "tr" : OL === L ? "tl" : null; if (k) s[k] += v; s.why.push([v > 0, t]); };
  // pairs
  for (let x = 0; x < A.length; x++) for (let y = x + 1; y < A.length; y++) { const p = A[x], q = A[y]; if (!p.a || !q.a) continue;
    const kp = p.a[3], kq = q.a[3], v = CHEM_PAIR[kp + "|" + kq]; if (!v) continue;
    // A pairing is open to the lines that work together: attackers don't pair with defenders or the keeper.
    if (Math.abs(SLOT_LINE[p.slot] - SLOT_LINE[q.slot]) > 1 && !(Math.min(SLOT_LINE[p.slot], SLOT_LINE[q.slot]) === 0 && Math.max(SLOT_LINE[p.slot], SLOT_LINE[q.slot]) === 2)) continue;
    const t = `${lab(p)} and ${lab(q)}${v > 0 ? " click" : " clash"}`, key = [kp, kq].sort().join("|");
    mark(p, q, v, t); mark(q, p, v, t); if (seen.has(key)) continue; seen.add(key); split(v * pairW(p.slot, q.slot), p.slot, q.slot); (v > 0 ? good : bad).push(t); }
  // pairings that only clash when something's missing
  const mids = A.filter(o => ringLine(o.slot) === "mid" && o.a).map(o => o.a[3]), pms = mids.filter(m => m === "PM" || m === "DLP").length;
  const cond = (o, k, t, w) => { const s = seg[o.p.id]; s[k]--; s.why.push([false, t]); if (seen.has(t)) return; seen.add(t); split(-w, o.slot); bad.push(t); };
  const twin = k => A.filter(o => o.a && o.a[3] === k);
  for (const o of A) { if (!o.a) continue; const k = o.a[3];
    if ((k === "POA" || k === "RIB") && !mids.some(m => ["PM", "DLP", "BC"].includes(m))) cond(o, "tr", "No passer in midfield to supply the strikers", .25);
    if ((k === "DLF" || k === "WPM") && pms >= 2) cond(o, "tr", `Two playmakers in midfield crowd the ${o.a[0].toLowerCase()}`, .25);
    const sv = style && (CHEM_STYLE[k] || {})[style]; if (sv) { seg[o.p.id].st = sv; split(sv * .15, o.slot); seg[o.p.id].why.push([sv > 0, `${sv > 0 ? "Suits" : "Doesn't suit"} ${STYLES[style].l.toLowerCase()}`]); } }
  const pairRule = (k, ok, t) => { const tw = twin(k); if (tw.length >= 2 && !ok) for (const o of tw) cond(o, "tl", t, .35); };
  pairRule("OFB", has("BW", "ANC", "DFB"), "Both full-backs bomb on with nobody holding: exposed on the break");
  pairRule("STP", has("COV"), "Two stoppers: both step out, nobody covering");
  pairRule("AER", has("COV"), "Two aerial centre-backs with no cover: beaten for pace");
  pairRule("BPD", has("STP", "AER"), "Two ball-playing centre-backs: nobody to win a header or a duel");
  pairRule("COV", has("AER"), "Two covering defenders: nobody good in the air");
  for (const o of twin("BPK")) if (!has("BPD", "IFB")) cond(o, "tl", "A ball-playing keeper with nobody to pass to", .25);
  // the side as a whole
  const add = (a, d, t) => { atk += a; def += d; bad.push(t); }, cr = has(...CREATORS), win = has(...WINNERS);
  if (!has("AER", "CMD", "TM", "ANC")) add(0, -.4, "Weak in the air: nobody to deal with crosses and set pieces");
  if (cr >= 2 && !win) add(0, -1, "A side of passers: nobody to win the ball back");
  if (!cr) add(-1, 0, "Nobody to make the pass: no playmaker anywhere in the side");
  if (cr >= 4) add(0, -.4, "Too many playmakers: everyone wants the ball, nobody wants to chase it");
  if (!has(...SCORERS)) add(-.8, 0, "No natural goalscorer in the side");
  return { atk: clamp(atk, -1.1, 1.1), def: clamp(def, -1.1, 1.1), good, bad, seg };
}
/* Formations suit some styles and not others: +1 suits, -1 doesn't. A side in a formation that suits its style scores a
   little more and concedes a little less. */
const FORM_STYLE = {
  "4-4-2": { possession: -1, press: 0, counter: 1, direct: 1, defensive: 1, wing: 1 },
  "4-3-3": { possession: 1, press: 1, counter: 0, direct: -1, defensive: -1, wing: 1 },
  "4-2-3-1": { possession: 1, press: 0, counter: 1, direct: -1, defensive: 0, wing: 0 },
  "3-5-2": { possession: 1, press: 0, counter: 0, direct: 1, defensive: 0, wing: -1 },
  "3-4-3": { possession: 0, press: 1, counter: -1, direct: 0, defensive: -1, wing: 1 },
  "5-3-2": { possession: -1, press: -1, counter: 1, direct: 1, defensive: 1, wing: -1 },
};
const formStyle = (f, s) => (FORM_STYLE[f] || {})[s] || 0;
// How hard each style runs its players: pressing wears them out over a season, sitting deep spares them.
const STYLE_TIRE = { press: 1.25, wing: 1.05, direct: 1, possession: .95, counter: .95, defensive: .9 };
/* How well a player would fit into a side: his type's pairings with the eleven (the lines he'd work with) and with the
   style. Roughly -4 to +4. Used by AI clubs and your head of recruitment when choosing between signings. */
const TF_XI = new Map();
function typeFit(c, p, style) { const t = typeParts(c, p, style); return t ? clamp(t.st * .8 + t.mates, -4, 4) : 0; }
// The two halves of it: his type against the style (-1, 0 or +1), and his pairings with the eleven (roughly -3 to +3).
function typeParts(c, p, style) {
  const a = archetypeOf(p); if (!a) return null; const k = a[3], key = `${G.year}:${G.phase}:${G.week}`;
  let e = TF_XI.get(c.id); if (!e || e.k !== key) { e = { k: key, xi: pickXI(c, true).map(o => ({ slot: o.slot, id: o.p.id, a: archetypeOf(o.p) })) }; TF_XI.set(c.id, e); if (TF_XI.size > 400) TF_XI.clear(); }
  const st = (CHEM_STYLE[k] || {})[style] || 0; let s = 0; const L = SLOT_LINE[p.pos];
  for (const q of e.xi) { if (q.id === p.id || !q.a || q.slot === p.pos && e.xi.filter(x => x.slot === p.pos).length < 2) continue; const v = CHEM_PAIR[k + "|" + q.a[3]]; if (!v) continue;
    const QL = SLOT_LINE[q.slot]; if (Math.abs(L - QL) > 1 && !(Math.min(L, QL) === 0 && Math.max(L, QL) === 2)) continue; s += v * pairW(p.pos, q.slot) * 2; }
  return { st, mates: s };
}
/* An AI manager each summer: if his squad suits another style clearly better than his own, a good tactician is likely to
   change to it (a poor one sticks with what he knows), and he picks a formation that suits the style. */
function aiStyleCheck(c) {
  if (isMine(c) || !c.coach || !c.squad || c.squad.length < 14) return;
  const xi = pickXI(c, true), t = clamp(to20(c.coach.tac || 50), 1, 20);
  const sc = s => styleFit(xi, s) + .12 * xi.reduce((a, o) => { const k = archetypeOf(o.p); return a + (k ? (CHEM_STYLE[k[3]] || {})[s] || 0 : 0); }, 0);
  const cur = c.coach.style, best = Object.keys(STYLES).sort((a, b) => sc(b) - sc(a))[0];
  if (best !== cur && sc(best) - sc(cur) > .35 && R() < t / 20) { c.coach.style = best; G._styleSw = (G._styleSw || 0) + 1;
    if (c.lg === my().lg) news(`${c.coach.name} changes ${c.name}'s style to ${STYLES[best].l.toLowerCase()}: it suits his squad better.`); }
  if (formStyle(c.coach.form, c.coach.style) < 0 || (formStyle(c.coach.form, c.coach.style) === 0 && R() < t / 40)) {
    const fs = Object.keys(FORM_STYLE).filter(f => formStyle(f, c.coach.style) > 0); if (fs.length && R() < .3 + t / 30) c.coach.form = pick(fs); }
}
/* ---------- styles against each other ----------
   +1: the first style has the edge over the second; -1 the second does; "q": the players decide it (whichever side suits
   its own style better). The side with the edge scores more and concedes less; a squad built for its style makes more of
   it. Some matchups make for open games, some for tight ones. */
const MATCHUP = {
  possession: { possession: "q", press: "q", counter: -1, direct: 1, defensive: -1, wing: 1 },
  press: { possession: "q", press: "q", counter: -1, direct: -1, defensive: 1, wing: 1 },
  counter: { possession: 1, press: 1, counter: 0, direct: -1, defensive: -1, wing: 0 },
  direct: { possession: -1, press: 1, counter: 1, direct: 0, defensive: -1, wing: 0 },
  defensive: { possession: 1, press: -1, counter: 1, direct: 1, defensive: 0, wing: -1 },
  wing: { possession: -1, press: -1, counter: 0, direct: 0, defensive: 1, wing: 0 },
};
const MATCHUP_WHY = { "possession|direct": "the long balls never come back", "possession|wing": "the wingers never see the ball", "counter|possession": "caught on the break",
  "defensive|possession": "can't break down the low block", "press|defensive": "pinned in their own half", "press|wing": "the wingers are closed down before they can cross",
  "counter|press": "space in behind the high line", "direct|press": "straight over the press", "defensive|counter": "nothing to counter", "direct|counter": "pinned back fighting for second balls",
  "defensive|direct": "big defenders win every long ball", "wing|defensive": "round the back of the low block", "wing|direct": "the flanks are open against a narrow side",
  "possession|press": "the better footballers", "press|possession": "the better pressers", "possession|possession": "the better footballers", "press|press": "the better pressers" };
const TEMPO = { "press|press": 1.06, "counter|possession": 1.06, "defensive|defensive": .92, "defensive|possession": .92 };
// The edge of style s (fit f) over style o (fit g): +1, 0 or -1.
function styleEdge(s, o, f, g) { const m = MATCHUP[s][o]; if (m !== "q") return m; if (f == null || g == null) return 0; return f - g > .1 ? 1 : g - f > .1 ? -1 : 0; }
/* The manager's plan for a game: his usual style, unless the matchup is against him and he sees it. His tactics (out of
   20) decide how often he spots it, whether he picks the right answer, and how well the side plays a style it isn't
   built for. Returns { st, cost, switched }. */
function matchPlan(c, opp, xi) {
  const base = baseStyle(c), ob = baseStyle(opp), t = clamp(to20(clubTac(c) || 50), 1, 20), cost = .08 - .07 * (t - 1) / 19;
  const keep = { st: base, cost: 0, switched: false };
  if (styleEdge(base, ob) >= 0 || R() > .95 * (t - 1) / 19) return keep;
  const val = s => styleEdge(s, ob) + styleFit(xi, s) * .5 - (s === base ? 0 : cost * 6);
  const others = Object.keys(STYLES).filter(s => s !== base);
  let pickS = others.sort((a, b) => val(b) - val(a))[0];
  const wrong = Math.max(0, (16 - t) / 11 * .4);
  if (R() < wrong) pickS = pick(others); else if (val(pickS) <= val(base)) return keep;
  return { st: pickS, cost, switched: true };
}
function teamPower(c, xi) {
  let a = 0, m = 0, d = 0, wa = 0, wm = 0, wd = 0;
  for (const { p, slot } of xi) { const r = roleRating(p, slot) - (p.unsettled > 0 ? 3 : 0) - Math.max(0, 85 - (p.fit ?? 100)) * .08, w = SLOT_W[slot]; a += r * w[0]; m += r * w[1]; d += r * w[2]; wa += w[0]; wm += w[1]; wd += w[2]; }
  const missing = 11 - xi.length;  // a side short of players is badly weakened
  const A = a / (wa || 1), M = m / (wm || 1), D = d / (wd || 1);
  const morale = ((isMine(c) ? c.morale : 55) - 55) / 15;  // about +-3
  const tac = (clubTac(c) - 50) / 20 + prepBonus(c);  // about +-2.5, plus pre-season sharpness or rust
  const ch = archChem(xi, clubStyle(c));
  return { atk: .65 * A + .35 * M + morale + tac + ch.atk - missing * 4, def: .7 * D + .3 * M + morale + tac + ch.def - missing * 4 };
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
  MATCH_ST = null;
  const H = CL(h), A = CL(a), xh = pickXI(H, false, { opp: A, kind, lesser: MATCH_LESSER }), xa = pickXI(A, false, { opp: H, kind, lesser: MATCH_LESSER });
  // Each manager's plan for the game (he may change his style for a bad matchup), then each side's strength playing it.
  const plH = matchPlan(H, A, xh), plA = matchPlan(A, H, xa); MATCH_ST = { [h]: plH.st, [a]: plA.st };
  const ph = teamPower(H, xh), pa = teamPower(A, xa);
  const sh = STYLES[clubStyle(H)], sa = STYLES[clubStyle(A)], fh = styleFit(xh, clubStyle(H)), fa = styleFit(xa, clubStyle(A));
  const adv = neutral ? 0 : 2 + fanShare(H, "hard") * 2 + LOC(H).adv + (isMine(H) ? terraceShare(H) * 1.2 + fzK(H) * .3 - hospShare(H) * 3 : 0), wx = G.wx ? wxAt(H) : WX.clear;
  const bh = clubBoost(CL(h)), ba = clubBoost(CL(a));
  let lh = 1.3 * Math.exp(.065 * (ph.atk - pa.def + adv + bh - ba)), la = 1.3 * Math.exp(.065 * (pa.atk - ph.def - adv + ba - bh));
  lh *= sh.for * (1 + .04 * fh) * sa.against * (1 - .03 * fa);
  { // the matchup: the side with the edge scores more and concedes less (more so with a squad built for its style),
    // and some matchups make for an open game or a tight one; a style the side isn't built for costs a little
    const e = styleEdge(plH.st, plA.st, fh, fa), amp = f => clamp(1 + .5 * f, .5, 1.5);
    if (e > 0) { la *= 1 - .05 * amp(fh); } else if (e < 0) { lh *= 1 - .05 * amp(fa); }
    const tp = TEMPO[[plH.st, plA.st].sort().join("|")] || 1;
    MATCH_EDGE = { e, tp, plH, plA };
    const fH = formStyle(clubForm(H), plH.st), fA = formStyle(clubForm(A), plA.st);
    lh *= (1 + .04 * fH) * (1 - .03 * fA); la *= (1 + .04 * fA) * (1 - .03 * fH);
    lh *= tp * (1 - plH.cost) * (e > 0 ? 1 + .08 * amp(fh) : 1); la *= tp * (1 - plA.cost) * (e < 0 ? 1 + .08 * amp(fa) : 1); }
  la *= sa.for * (1 + .04 * fa) * sh.against * (1 - .03 * fh);
  // Bad weather: fewer goals, and passing football suffers most.
  const wf = st => wx.play * (wx.play < 1 && (st === "possession" || st === "wing") ? .96 : 1); lh *= wf(clubStyle(H)); la *= wf(clubStyle(A));
  // A worn home pitch (both sides play on it): passing football suffers most, a pressing or counter-attacking side a
  // little, a defensive one not at all, and a direct side gains (long balls over the bumps; the passers can't settle).
  const pq = isMine(H) && !neutral ? pitchOf(H) : null;
  if (pq != null && pq < 70) { const PK = { possession: -.005, wing: -.004, counter: -.003, press: -.002, defensive: 0, direct: .002 }, k = st => 1 + (PK[st] ?? -.002) * (70 - pq);
    lh *= k(clubStyle(H)); la *= k(clubStyle(A)); }
  // Pitch size (your ground only): each side's style for or against it; a tight pitch helps a compact side keep the
  // other out; you know your own pitch.
  const pz = neutral ? null : PSIZE[psizeOf(H)];
  if (pz && pz !== PSIZE.std) { const sH = clubStyle(H), sA = clubStyle(A);
    lh *= (1 + (pz.m[sH] || 0)) * (1 - (pz.shut[sA] || 0)) * 1.02; la *= (1 + (pz.m[sA] || 0)) * (1 - (pz.shut[sH] || 0)); }
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
    const used = new Set(xi.map(o => o.p.id)), bench = c.squad.map(P).filter(p => avail(p) && !used.has(p.id) && p.pos !== "GK" && (!p.acad || p.age >= 17 || (isMine(c) && p.minT && p.age >= 16)) && (!isMine(c) || isReg(p, c)) && !(p.loan && p.loan.from === c.id));
    const off = new Set(), on = [];
    for (const o of xi.filter(o => o.slot !== "GK").sort((a, b) => (a.p.fit ?? 100) - (b.p.fit ?? 100))) {
      if (on.length >= n) break;
      // Your side in a competitive game follows the depth chart: the first-choice cover for that position comes on.
      const dep = isMine(c) && !fr ? (depthSync(c, o.slot) || bench.slice().sort((a, b) => roleRating(b, o.slot) - roleRating(a, o.slot)).map(q => q.id)) : null;
      const behind = isMine(c) && !fr ? bench.filter(q => !on.includes(q) && minBehind(q) > 0 && (o.slot === "GK") === (q.pos === "GK") && POS_LINE[q.pos] === POS_LINE[o.slot]).sort((a, b) => minBehind(b) - minBehind(a))[0] : null;
      const pick = behind || (dep && bench.filter(q => !on.includes(q) && (o.slot === "GK") === (q.pos === "GK")).sort((a, b) => (dep.indexOf(a.id) + 1 || 999) - (dep.indexOf(b.id) + 1 || 999))[0])
        || bench.filter(q => !on.includes(q) && POS_LINE[q.pos] === POS_LINE[o.slot]).sort((a, b) => (b.ovr - b.s.app * .5) - (a.ovr - a.s.app * .5))[0]
        || bench.filter(q => !on.includes(q)).sort((a, b) => (b.ovr - b.s.app * .5) - (a.ovr - a.s.app * .5))[0];
      if (!pick) break; off.add(o.p.id); on.push(pick);
    }
    return { off, on };
  };
  for (const [c, xi] of [[H, xh], [A, xa]]) {
    const { off, on: subs } = subsFor(c, xi);
    const offAt = [...off].map(() => ri(55, 80)).sort((a, b) => a - b), offMin = new Map([...off].map((id, i) => [id, offAt[i]]));
    const ragged = (pz === PSIZE.wide && clubStyle(c) === "press" ? 1.25 : 1) * (STYLE_TIRE[clubStyle(c)] || 1);
    for (const { p } of xi) { tire(p, (off.has(p.id) ? .7 : 1) * ragged, fr); if (fr) { if (R() < .5) injuryCheck(p, pq); continue; } if (!p.tot[0] && !p.s.app) p.debut = G.year; addStat(p, 0); p.s.min = (p.s.min || 0) + (offMin.get(p.id) || 90); injuryCheck(p, pq); }
    for (const [i, p] of subs.entries()) { tire(p, .35, fr); if (fr) continue; p.s.min = (p.s.min || 0) + 90 - (offAt[i] || 70); if (!p.tot[0] && !p.s.app) p.debut = G.year; addStat(p, 0); p.s.sub = (p.s.sub || 0) + 1; if (p.club >= 0) { const b = scOf(p).by[p.club]; b[3] = (b[3] || 0) + 1; } if (R() < .4) injuryCheck(p, pq); }
  }
  if (!fr && !kind) for (const [xi, conceded] of [[xh, ag], [xa, hg]]) { const gk = xi.find(o => o.slot === "GK"); if (gk && !conceded) lsOf(gk.p).cs++; }  // a league clean sheet for the keeper
  ev.sort((x, y) => x.m - y.m);
  MATCH_ST = null;
  return { h, a, hg, ag, ev, fit: [fh, fa], xg: [r1(lh), r1(la)], plan: [plH.switched ? plH.st : null, plA.switched ? plA.st : null], edge: MATCH_EDGE.e };
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
let MATCH_CT = "L", MATCH_LESSER = false, MATCH_ST = null, MATCH_EDGE = null;  // MATCH_LESSER: a lesser cup game (see playKO)
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
