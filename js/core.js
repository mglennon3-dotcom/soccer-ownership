/* Core: the pyramid, players rated 1-100, talent generation and development.
   Everything here is plain data and logic (no DOM), so tools/sim.js can run whole careers in Node. */
"use strict";

const VERSION = "0.4.1";
let G = null;  // the saved game

const P = id => G.players[id];
const CL = id => G.clubs[id];
const my = () => G.clubs[G.club];
const isMine = c => c && c.id === G.club;
const normal = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const r1 = v => Math.round(v * 10) / 10;
/* The scale. Attributes, ratings and potential are held in half-points on a 100 scale: 200 steps. Everything shown
   is out of 20 (r20), and that's also all anyone in the game sees: your manager, your scouts and AI clubs pick and
   judge players on the 20-point figures. Only matches and development use the exact values. */
const rh = v => Math.round(v * 2) / 2;
const r20 = v => clamp(Math.round(v / 5), 1, 20);
const snap20 = v => clamp(Math.round(v / 5) * 5, 5, 100);
const est20 = ([a, b]) => r20(a) === r20(b) ? `${r20(a)}` : `${r20(a)}–${r20(b)}`;

/* ---------- the pyramid: Touchline Manager's six English tiers, plus a regional seventh tier where new clubs start ---------- */
const LEAGUES = {
  L1:  { name: "Premier Division",        tier: 1, size: 20, auto: 0, po: null,   down: 3 },
  L2:  { name: "First Division",          tier: 2, size: 24, auto: 2, po: [3, 6], down: 3 },
  L3:  { name: "Second Division",         tier: 3, size: 24, auto: 2, po: [3, 6], down: 4 },
  L4:  { name: "Third Division",          tier: 4, size: 24, auto: 3, po: [4, 7], down: 2 },
  L5:  { name: "National Division",       tier: 5, size: 24, auto: 1, po: [2, 5], down: 4 },
  L6N: { name: "National Division North", tier: 6, size: 24, auto: 1, po: [2, 5], down: 3, half: "N" },
  L6S: { name: "National Division South", tier: 6, size: 24, auto: 1, po: [2, 5], down: 3, half: "S" },
  L7N: { name: "Regional League North",   tier: 7, size: 20, auto: 2, po: [3, 6], down: 3, half: "N" },
  L7S: { name: "Regional League South",   tier: 7, size: 20, auto: 2, po: [3, 6], down: 3, half: "S" },
};
const LG_KEYS = Object.keys(LEAGUES);
const ABOVE = { L2: "L1", L3: "L2", L4: "L3", L5: "L4", L6N: "L5", L6S: "L5", L7N: "L6N", L7S: "L6S" };
const leagueFor = (tier, half) => LG_KEYS.find(k => LEAGUES[k].tier === tier && (!LEAGUES[k].half || LEAGUES[k].half === half));
const TIER_NAME = ["", "Premier Division", "First Division", "Second Division", "Third Division", "National Division", "National North/South", "Regional League"];

/* Typical starter's rating (out of 100) at a mid-table club in each tier. A top-flight starter is about 79;
   the regional seventh tier sits in the mid-40s. */
const TIER_LVL = [0, 79, 71, 65, 60, 55, 50, 44];
/* Minimum ground capacity to be promoted into each tier (ground grading). */
const GROUND_REQ = [0, 20000, 12000, 8000, 5000, 4000, 2000, 0];

/* ---------- attributes (1-100) ---------- */
const OUT_KEYS = ["pac", "str", "sta", "tac", "mar", "hea", "pas", "vis", "tec", "dri", "fin", "cmp"];
const GK_KEYS = ["ss", "han", "aer", "dis", "cmp"];
const ATTR = { pac: "Pace", str: "Strength", sta: "Stamina", tac: "Tackling", mar: "Marking", hea: "Heading", pas: "Passing", vis: "Vision",
  tec: "Technique", dri: "Dribbling", fin: "Finishing", cmp: "Composure", ss: "Shot-stopping", han: "Handling", aer: "Aerial command", dis: "Distribution" };
const POS = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"];
const POS_NAME = { GK: "Goalkeeper", CB: "Centre-back", FB: "Full-back", DM: "Defensive midfielder", CM: "Central midfielder", AM: "Attacking midfielder", W: "Winger", ST: "Striker" };
const POS_LINE = { GK: "GK", CB: "DEF", FB: "DEF", DM: "MID", CM: "MID", AM: "MID", W: "ATT", ST: "ATT" };
// How each position's rating is built from attributes (weights sum to 1).
const POS_W = {
  GK: { ss: .4, han: .2, aer: .15, dis: .1, cmp: .15 },
  CB: { tac: .25, mar: .25, hea: .2, str: .15, pac: .1, cmp: .05 },
  FB: { pac: .22, tac: .2, mar: .15, sta: .15, pas: .14, dri: .14 },
  DM: { tac: .25, pas: .2, mar: .15, sta: .15, str: .1, vis: .1, cmp: .05 },
  CM: { pas: .25, vis: .18, tec: .15, sta: .15, tac: .12, cmp: .15 },
  AM: { vis: .22, pas: .18, tec: .2, dri: .18, fin: .12, cmp: .1 },
  W:  { pac: .25, dri: .25, tec: .15, pas: .12, fin: .1, sta: .13 },
  ST: { fin: .3, cmp: .18, pac: .14, hea: .12, dri: .12, str: .14 },
};
const keysOf = pos => pos === "GK" ? GK_KEYS : OUT_KEYS;
const SQUAD_MIX = { GK: 3, CB: 4, FB: 4, DM: 2, CM: 3, AM: 2, W: 3, ST: 3 };  // 24

const FORMS = {
  "4-4-2":   ["GK", "FB", "CB", "CB", "FB", "W", "CM", "CM", "W", "ST", "ST"],
  "4-3-3":   ["GK", "FB", "CB", "CB", "FB", "DM", "CM", "CM", "W", "ST", "W"],
  "4-2-3-1": ["GK", "FB", "CB", "CB", "FB", "DM", "DM", "W", "AM", "W", "ST"],
  "4-1-2-1-2": ["GK", "FB", "CB", "CB", "FB", "DM", "CM", "CM", "AM", "ST", "ST"],
  "3-5-2":   ["GK", "CB", "CB", "CB", "FB", "DM", "CM", "CM", "FB", "ST", "ST"],
  "3-4-3":   ["GK", "CB", "CB", "CB", "FB", "CM", "CM", "FB", "W", "ST", "W"],
  "5-3-2":   ["GK", "FB", "CB", "CB", "CB", "FB", "CM", "DM", "CM", "ST", "ST"],
};
const FORM_KEYS = Object.keys(FORMS);

/* ---------- player ratings ---------- */
function roleRating(p, role) {
  if ((role === "GK") !== (p.pos === "GK")) return 15;
  let r = 0; for (const [k, w] of Object.entries(POS_W[role])) r += (p.at[k] ?? 30) * w;
  return p.pos === role ? r : r * (POS_LINE[p.pos] === POS_LINE[role] ? .96 : .9);
}
function setOvr(p) { p.ovr = clamp(rh(roleRating(p, p.pos)), 1, 100); if (p.ovr > (p.peak || 0)) p.peak = p.ovr; }
/* Attributes for a target rating: the position's key attributes sit above the player's other ones, each player has
   his own shape (noise), and the whole set is shifted so the position rating lands on the target. */
function genAttrs(pos, target, lean) {
  const at = {}, W = POS_W[pos];
  for (const k of keysOf(pos)) at[k] = target + (W[k] ? 3 : -11) + normal() * 6 + ((lean && lean[k]) || 0);
  for (let i = 0; i < 5; i++) {
    let r = 0; for (const [k, w] of Object.entries(W)) r += at[k] * w;
    const d = target - r; for (const k of keysOf(pos)) at[k] = clamp(at[k] + d, 1, 100);
  }
  for (const k of keysOf(pos)) at[k] = rh(at[k]);
  return at;
}
/* Growth and decline move every attribute by about the same amount, so a player keeps his shape. Pace and stamina
   go first with age. */
function shiftPlayer(p, pts) {
  if (!pts) return;
  for (const k of keysOf(p.pos)) {
    let d = pts * (1 + normal() * .25);
    if (pts < 0 && (k === "pac" || k === "sta")) d *= 1.6;
    if (pts < 0 && (k === "vis" || k === "cmp" || k === "pas")) d *= .5;
    p.at[k] = clamp(rh(p.at[k] + d), 1, 100);
  }
  setOvr(p);
}

/* ---------- talent ----------
   Potential is the ceiling a player can reach with good coaching and regular football; most never reach it.
   Two sources:
   - the ordinary draw: a bell curve whose centre an academy can move (facilities, staff, budget), with a 10.5 spread.
     Even the best academy in the game centres around 57, so a potential of 85+ is about one graduate in 250 there,
     and far rarer at an ordinary club.
   - exceptional talents: about one youngster in 2,000 (a bit more at elite academies). Their potential is 90-100,
     skewed hard toward the bottom of that range, so across the whole game a 95+ talent appears every eight years or
     so and a potential 100, a generational player, once in a few decades. tools/sim.js measures this.
   Every potential is capped at 94 outside the exceptional draw. */
const EXC_RATE = .0005;
function drawPotential(mean, excMult = 1) {
  if (R() < EXC_RATE * excMult) return Math.min(100, rh(90 + 10.5 * Math.pow(R(), 3)));
  return clamp(rh(mean + normal() * 10.5), 25, 94);
}

/* ---------- money ----------
   Real-world euros. A regional-league player earns a few thousand a year; a Premier Division star several million. */
function wageFor(ovr) {
  let w = 3000 * Math.pow(1.12, ovr - 30);
  if (ovr > 72) w *= Math.pow(1.12, ovr - 72);  // the top of the game pays far more
  return Math.max(1000, Math.round(w / 100) * 100);
}
function valueOf(p) {
  let v = wageFor(p.ovr) * 3 * Math.pow(1.025, p.ovr - 50) * clamp((p.ovr - 35) / 25, .2, 1);
  if (p.age < 24) v *= 1 + Math.max(0, p.pot - p.ovr) * .04;
  if (p.age > 28) v *= Math.max(.12, 1 - (p.age - 28) * .13);
  if (p.yrs <= 1) v *= .75;
  return Math.max(0, Math.round(v / 1000) * 1000);
}

/* ---------- players ---------- */
function nameFor(nat) { const N = NAMES[nat] || NAMES.ENG; return pick(N[0]) + " " + pick(N[1]); }
function makePlayer(o) {
  const p = { id: G.nextPid++, name: nameFor(o.nat || "ENG"), nat: o.nat || "ENG", pos: o.pos, age: o.age, club: o.club ?? -1,
    at: genAttrs(o.pos, o.ovr, o.lean), ovr: 0, pot: 0, peak: 0, gs: clamp(Math.round(50 + normal() * 15), 10, 95),  // gs: professionalism, how well he uses his chances to develop
    wage: 0, yrs: ri(1, 3), inj: 0, acad: !!o.acad, s: { app: 0, g: 0, a: 0 }, tot: [0, 0], hist: [], pn: normal(), list: false, keep: false };
  setOvr(p);
  p.pot = Math.max(p.ovr, o.pot ?? p.ovr);
  p.wage = o.wage ?? wageFor(p.ovr);
  G.players[p.id] = p;
  return p;
}
/* Potential for a senior player made at world creation or as an import: a little room to grow while young.
   Never exceptional: those come only through youth intakes. */
function seniorPot(ovr, age) { return age >= 27 ? ovr : clamp(ovr + rh(Math.abs(normal()) * (27 - age) * 1.3), ovr, Math.max(ovr, 94)); }

/* ---------- staff knowledge of a player ----------
   Ratings of your own players are exact. Potential is never known: your staff estimate it, as a range whose width
   comes from their judgement (youth manager for academy players, manager for the rest of your squad, recruitment head
   for everyone else). Each player's error is fixed (p.pn), so the estimate doesn't jump around week to week. */
function potEstimate(p) {
  let judge = 35;
  if (p.club === G.club) judge = p.acad ? staffAttr("youth", "judge", 35) : staffAttr("manager", "dev", 35);
  else judge = staffAttr("recruit", "judge", 25) + scoutBoost();
  const sd = clamp((100 - judge) / 9, 1, 9), est = clamp(p.pot + p.pn * sd, p.ovr, 100), w = Math.max(1, sd * 1.2);
  return [snap20(Math.max(p.ovr, est - w)), snap20(Math.min(100, est + w))];
}
function ovrEstimate(p) {
  if (p.club === G.club || (p.club >= 0 && CL(p.club).lg === my().lg)) return [snap20(p.ovr), snap20(p.ovr)];
  const sd = clamp((100 - staffAttr("recruit", "judge", 25) - scoutBoost()) / 18, .5, 5), w = Math.max(1, sd);
  const est = p.ovr + p.pn * sd * .5;
  return [snap20(est - w), snap20(est + w)];
}

/* ---------- development ----------
   Yearly growth is a share of the gap to potential, larger when young, scaled by conditions: playing time, training
   facilities, the coach's development rating and the player's own professionalism. Young players who don't play lose
   some potential. Called 16 times a season (dt = 1/16 of a year). */
const GROW_AGE = { 15: .32, 16: .32, 17: .31, 18: .29, 19: .27, 20: .24, 21: .2, 22: .17, 23: .13, 24: .09, 25: .07, 26: .05, 27: .03 };
function envOf(c) {
  if (!c) return { train: 0, dev: 35, acad: 0, ydev: 30 };
  if (isMine(c)) return { train: c.fac.train.lvl, dev: staffAttr("manager", "dev", 30), acad: c.fac.acad.lvl, ydev: staffAttr("youth", "dev", 25) };
  return { train: c.train, dev: c.coach.dev, acad: c.acadLvl, ydev: c.coach.dev };
}
function develop(p, dt, teamGames) {
  const c = p.club >= 0 ? CL(p.club) : null, e = envOf(c);
  if (p.age <= 27 && p.pot > p.ovr) {
    let play;
    if (p.acad) play = .55 + e.acad * .03;  // academy football: better at a better academy
    else play = teamGames > 3 ? clamp(p.s.app / teamGames, 0, 1) : .5;
    const cond = (.35 + .65 * play) * (.62 + e.train * .045 + (p.acad ? e.ydev : e.dev) * .004) * (.7 + p.gs / 167);
    const gain = (p.pot - (p.ovr + (p.frac || 0))) * (GROW_AGE[p.age] || 0) * cond * dt;
    p.frac = (p.frac || 0) + gain;
    const whole = Math.trunc(p.frac);
    if (whole) { const before = p.ovr; shiftPlayer(p, whole); p.frac -= (p.ovr - before) || whole; }
    // Unused talent fades: a 19-23-year-old outside the side loses some ceiling.
    if (!p.acad && p.age >= 19 && p.age <= 23 && teamGames > 8 && play < .2) { p.pfade = (p.pfade || 0) + 2 * dt * (1 - play * 5); if (p.pfade >= 1) { p.pfade--; p.pot = Math.max(p.ovr, p.pot - 1); } }
  }
  if (p.age >= 30) {
    const loss = (p.age - 29) * .55 * dt * (1.25 - p.gs / 200) * (1 + normal() * .3);
    p.dfrac = (p.dfrac || 0) + loss;
    if (p.dfrac >= 1) { const w = Math.floor(p.dfrac); p.dfrac -= w; shiftPlayer(p, -w); p.pot = Math.min(p.pot, p.ovr); }
  }
}

/* ---------- AI clubs ---------- */
const COACH_FIRST = ["Steve", "Gary", "Paul", "Mark", "Neil", "Darren", "Ian", "Graham", "Tony", "Kevin", "Lee", "Martin", "Simon", "Rob", "Chris"];
function aiCoach(rep) { return { age: ri(34, 60), name: pick(COACH_FIRST) + " " + pick(NAMES.ENG[1]), style: pick(Object.keys(STYLES)), form: pick(FORM_KEYS), tac: clamp(Math.round(rep * .7 + 15 + normal() * 10), 10, 95), dev: clamp(Math.round(40 + normal() * 15), 10, 95) }; }
function townName() {
  const K = COUNTRY.ENG;
  for (let g = 0; g < 500; g++) { let t = pick(K.pre) + pick(K.suf); t = t[0].toUpperCase() + t.slice(1); if (!TOWN_BLOCK.has(t) && !G.towns[t]) { G.towns[t] = 1; return t; } }
  return pick(K.pre) + pick(K.suf) + " " + ri(2, 9);
}
function shortFor(t) {
  const shorts = new Set(G.clubs.filter(c => !c.gone).map(c => c.short));
  const base = stripAcc(t).replace(/[^A-Za-z]/g, "").toUpperCase(); let s = base.slice(0, 3), k = 3;
  while (shorts.has(s) && k < base.length) { s = base.slice(0, 2) + base[k]; k++; }
  return s;
}
// Reputation 1-100, mostly from tier: a Premier Division giant is 90+, a regional club 5-15.
const TIER_REP = [0, 78, 58, 45, 36, 28, 20, 11];
function newClub(lg, rank) {
  const L = LEAGUES[lg], half = L.half || pick(["N", "S"]), regions = COUNTRY.ENG.regions.filter(r => r[3] === half);
  const t = townName(), n = L.size, spread = (n / 2 - rank) / (n / 2);  // +1 top of the division, -1 bottom
  const rep = clamp(Math.round(TIER_REP[L.tier] + spread * (L.tier === 1 ? 14 : 5) + normal() * 2), 3, 99);
  const c = { id: G.clubs.length, name: pick(COUNTRY.ENG.fmt).replace("{t}", t), town: t, short: shortFor(t), half, region: pick(regions)[0],
    lg, tier: L.tier, rep, color: CLUB_COLORS[G.clubs.length % CLUB_COLORS.length], coach: aiCoach(rep), squad: [],
    lvl: TIER_LVL[L.tier] + spread * (L.tier === 1 ? 6 : 3.5),  // the standard the club recruits to
    train: clamp(Math.round(9 - L.tier * 1.2 + spread * 1.5 + normal()), 0, 10), acadLvl: clamp(Math.round(8.5 - L.tier * 1.1 + normal() * 1.5), 0, 10),
    cap: Math.round(STADIUM_T[L.tier] * (1 + spread * .4) * rf(.8, 1.2) / 100) * 100,
    fans: Math.round(FAN_T[L.tier] * (1 + spread * .45) * rf(.8, 1.2)), gone: false, founded: G.year - ri(30, 140), trophies: [] };
  c.own = newOwner(c);
  G.clubs.push(c);
  return c;
}
const STADIUM_T = [0, 42000, 22000, 11000, 7000, 4500, 3000, 1200];
const FAN_T = [0, 38000, 18000, 8500, 5200, 2600, 1300, 450];
function genSquad(c) {
  for (const [pos, n] of Object.entries(SQUAD_MIX)) for (let i = 0; i < n; i++) {
    const age = i === n - 1 && R() < .4 ? ri(17, 21) : ri(19, 34);
    let ovr = Math.round(c.lvl + 2 - i * 3 + normal() * 2.5 - (age < 21 ? 5 : 0));
    ovr = clamp(ovr, 20, 93);
    const nat = R() < (c.tier <= 2 ? .55 : c.tier <= 4 ? .8 : .95) ? "ENG" : pickNat("ENG");
    const p = makePlayer({ pos, ovr, age, nat, club: c.id, pot: seniorPot(ovr, age) });
    p.yrs = ri(1, 4);
    c.squad.push(p.id);
  }
}

/* ---------- the world ---------- */
function newWorld(o) {
  G = { v: 1, year: 2026, phase: "summer", week: 0, club: null, nextPid: 1, players: {}, clubs: [], towns: {}, leagues: {}, fa: [],
    news: [], inbox: [], nextMsg: 1, history: [], hof: [], wonders: [], cand: null, owner: null, seed: R() };
  for (const k of LG_KEYS) { const ids = []; for (let i = 0; i < LEAGUES[k].size; i++) ids.push(newClub(k, i).id); G.leagues[k] = { key: k, clubs: ids }; }
  for (const c of G.clubs) genSquad(c);
  // A pool of unattached players: the trialists and journeymen a new club can sign.
  for (let i = 0; i < 160; i++) { const ovr = ri(30, 62), age = ri(19, 34); const p = makePlayer({ pos: pick(POS), ovr, age, nat: R() < .75 ? "ENG" : pickNat("ENG"), pot: seniorPot(ovr, age) }); toFreeAgent(p); }
  if (o) foundClub(o);
  return G;
}
function toFreeAgent(p) { leaveClub(p); p.club = -1; p.acad = false; p.yrs = 0; p.list = false; p.keep = false; p.faY = G.year; if (!G.fa.includes(p.id)) G.fa.push(p.id); }
function leaveClub(p) { if (p.club >= 0) { const c = CL(p.club); c.squad = c.squad.filter(id => id !== p.id); } }
function moveTo(p, c) { leaveClub(p); G.fa = G.fa.filter(id => id !== p.id); p.club = c.id; p.list = false; p.keep = false; p.acad = false; c.squad.push(p.id); p.hist.push([G.year, c.short]); }
function retire(p) {
  if (p.peak >= 80 || p.tot[0] >= 400) G.hof.push({ name: p.name, pos: p.pos, nat: p.nat, peak: p.peak, apps: p.tot[0], goals: p.tot[1], y: G.year, clubs: [...new Set(p.hist.map(h => h[1]))].slice(-5) });
  leaveClub(p); G.fa = G.fa.filter(id => id !== p.id); delete G.players[p.id];
}

/* ---------- your club ---------- */
const WEALTH = {
  local:   { l: "Local businessperson", amt: 2.5e6, d: "A few million behind you. Every euro has to earn its keep." },
  wealthy: { l: "Wealthy investor",     amt: 30e6,  d: "Enough to build a proper ground and push through the non-league." },
  billion: { l: "Billionaire consortium", amt: 600e6, d: "Money is no object. Patience and good hires still are." },
};
function foundClub(o) {
  const lg = o.half === "N" ? "L7N" : "L7S", L = G.leagues[lg];
  // The newest club replaces the weakest one in its regional league, which folds.
  const outId = L.clubs[L.clubs.length - 1], out = CL(outId);
  for (const id of out.squad.slice()) toFreeAgent(P(id));
  out.squad = []; out.gone = true; L.clubs = L.clubs.filter(id => id !== outId);
  const regions = COUNTRY.ENG.regions.filter(r => r[3] === o.half);
  G.board = { own: 100, inv: [], dir: {}, offers: [] }; G.sTrust = { rel: 50, members: 0, seat: false }; G.net = { partner: null, feeders: [] }; G.loans = [];
  const c = { id: G.clubs.length, name: o.name, town: o.town || o.name.split(" ")[0], short: shortFor(o.short || o.name), half: o.half, region: o.region || pick(regions)[0],
    lg, tier: 7, rep: 4, media: 8, color: o.color || "#b42323", coach: null, squad: [], lvl: TIER_LVL[7] - 3, train: 0, acadLvl: 0, cap: 0, fans: 120, gone: false, founded: G.year, trophies: [],
    cash: 0, mood: 60, morale: 55,
    prices: { ticket: 8, conc: 3, shirt: 40, suite: 2500 },
    budget: { wages: 300000, transfer: 60000, acad: 0, scout: 10000 },
    fac: { stadium: { own: false, cap: 0, amen: 1, host: 0, build: null, suites: 0, pitch: 100, ptype: "grass", relay: null }, train: { lvl: 0, build: null }, acad: { lvl: 0, build: null } },
    deals: [], offers: [], staff: { manager: null, youth: null, recruit: null }, fin: newLedger(), finLast: null, spentT: 0 };
  c.short = shortFor(o.short || o.name);
  G.clubs.push(c); L.clubs.push(c.id); G.club = c.id;
  G.owner = { name: o.owner || "The owner", wealth: WEALTH[o.wealth].amt, kind: o.wealth, invested: 0 };
  invest(Math.min(G.owner.wealth, Math.round(WEALTH[o.wealth].amt * .08)), true);
  // An open trial day: the founding squad is whoever turned up.
  for (const [pos, n] of Object.entries({ GK: 2, CB: 3, FB: 3, DM: 1, CM: 3, AM: 1, W: 2, ST: 3 })) for (let i = 0; i < n; i++) {
    const age = ri(17, 31), ovr = clamp(Math.round(33 + normal() * 4 - (age < 20 ? 3 : 0)), 22, 44);
    const p = makePlayer({ pos, ovr, age, nat: R() < .9 ? "ENG" : pickNat("ENG"), club: c.id, pot: seniorPot(ovr, age), wage: 1500 });
    p.yrs = ri(1, 2); c.squad.push(p.id); p.hist.push([G.year, c.short]);
  }
  setGround(c, 0);
  news(`${c.name} are founded. ${c.squad.length} players from an open trial day make up the first squad, and the club will play at ${HOSTS[0].name} while it has no ground of its own.`, true);
  return c;
}
function newLedger() { return { equity: 0, borrow: 0, repay: 0, dividend: 0, feeders: 0, directors: 0, events: 0, suites: 0, gate: 0, conc: 0, merch: 0, spons: 0, tv: 0, prize: 0, sales: 0, wages: 0, staff: 0, fac: 0, rent: 0, acad: 0, scout: 0, buys: 0, build: 0, interest: 0, invest: 0 }; }
