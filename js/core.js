/* Core: the pyramid, players rated 1-100, talent generation and development.
   Everything here is plain data and logic (no DOM), so tools/sim.js can run whole careers in Node. */
"use strict";

const VERSION = "0.63.8";
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
/* The displayed scale, division by division: Regional League and National North/South mostly 1-5, National Division
   3-7, Third Division 5-9, Second 6-10, First 9-13, Premier Division 12-20 (stars 18-19, 20 generational). Foreign
   clubs are their countries' top flights and read like the Premier Division.
   Points: [internal (0-100), shown (1-20)], straight lines between them. */
// Anchored on each division's average starter: Premier 13, First 10, Second 7, Third 6, National 5, North/South 4, Regional 2.
// (Pinned to mid-career values: a new world reads a fraction lower, a long career a fraction higher.)
const R20_PTS = [[0, 1], [22, 1], [30, 2], [40, 4], [50, 5], [62.7, 6], [67.3, 7], [73.5, 10], [83, 13], [90, 16.5], [97.5, 20], [100, 20]];
function to20(v) { for (let i = 1; i < R20_PTS.length; i++) { const [a, x] = R20_PTS[i - 1], [b, y] = R20_PTS[i]; if (v <= b) return x + (y - x) * (v - a) / (b - a || 1); } return 20; }
function from20(d) { for (let i = 1; i < R20_PTS.length; i++) { const [a, x] = R20_PTS[i - 1], [b, y] = R20_PTS[i]; if (d <= y && y > x) return a + (b - a) * (d - x) / (y - x); } return 100; }
const r20 = v => clamp(Math.round(to20(v)), 1, 20);
/* Staff ratings are shown on the players' 1-20 scale, matched division by division: the typical staff member at each
   level shows the same rating as that division's typical starting player. (Underneath, staff abilities keep their own
   0-100 range; only the number you see is translated.) Points: [staff value, player-equivalent value]. */
const STAFF_EQ = [[0, 0], [24.3, 30], [29.9, 40], [35.8, 50], [42.3, 62.7], [50.5, 67.3], [62.9, 73.5], [79.4, 83], [100, 100]];
function staffEq(v) { for (let i = 1; i < STAFF_EQ.length; i++) { const [a, x] = STAFF_EQ[i - 1], [b, y] = STAFF_EQ[i]; if (v <= b) return x + (y - x) * (v - a) / (b - a); } return 100; }
const sr20 = v => r20(staffEq(v));
const snap20 = v => clamp(from20(r20(v)), 1, 100);  // the internal value at the middle of a shown point
const s20 = v => clamp(Math.round(v / 5), 1, 20);  // staff and directors keep a straight 1-20 scale: about 10 is average
/* Player wages are shown by the week. */
function pw(annual) { const w = annual / 52; return (w >= 1e6 ? money(w) : "€" + (w < 1000 ? Math.round(w / 10) * 10 : Math.round(w / 50) * 50).toLocaleString("en-GB")) + "/wk"; }
const est20 = ([a, b]) => r20(a) === r20(b) ? `${r20(a)}` : `${r20(a)}–${r20(b)}`;

/* ---------- the pyramid: six English tiers, plus a regional seventh tier where new clubs start ---------- */
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
const TIER_LVL = [0, 79, 71, 65, 60, 48, 38, 28];
/* The lower leagues sit lower on the scale (on the 200 scale: Regional average starter about 60, North/South 80,
   National 100). Pay, values and youth were tuned on the old scale, so those still work from the old-scale
   equivalent: oldEq turns a rating into it, oldToNew goes back. Identical from 60 (120 on the 200 scale) up. */
const LOW_MAP = [[28, 44], [38, 50], [48, 55], [60, 60]];
function oldEq(n) { if (n >= 60) return n; if (n <= 28) return n + 16; for (let i = 1; i < LOW_MAP.length; i++) { const [a, x] = LOW_MAP[i - 1], [b, y] = LOW_MAP[i]; if (n <= a + (b - a)) return x + (y - x) * (n - a) / (b - a); } return n; }
function oldToNew(o) { if (o >= 60) return o; if (o <= 44) return o - 16; for (let i = 1; i < LOW_MAP.length; i++) { const [a, x] = LOW_MAP[i - 1], [b, y] = LOW_MAP[i]; if (o <= y) return a + (b - a) * (o - x) / (y - x); } return o; }

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
function rawRole(p, role) {
  if ((role === "GK") !== (p.pos === "GK")) return 15;
  let r = 0; for (const [k, w] of Object.entries(POS_W[role])) r += (p.at[k] ?? 30) * w;
  return p.pos === role ? r : r * (POS_LINE[p.pos] === POS_LINE[role] ? .96 : .9);
}
// In his own position a player is exactly his rating (the figure on his card), so every screen and the match agree.
const roleRating = (p, role) => p.pos === role && p.ovr != null ? p.ovr : rawRole(p, role);
function setOvr(p) { p.ovr = clamp(rh(rawRole(p, p.pos)), 1, 100); if (p.ovr > (p.peak || 0)) p.peak = p.ovr; }
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
/* A gem: now and then any academy, however humble, turns up a player far above the rest (more often at a club known for
   developing youth). */
const GEM_RATE = .012;
function drawPotential(mean, excMult = 1, gemMult = 1) {
  if (R() < EXC_RATE * excMult) return Math.min(100, rh(90 + 10.5 * Math.pow(R(), 3)));
  if (R() < GEM_RATE * gemMult) return clamp(rh(mean + 18 + R() * 22), 8, 94);
  return clamp(rh(mean + normal() * 10.5), 8, 94);
}

/* ---------- money ----------
   Real-world euros. A regional-league player earns a few thousand a year; a Premier Division star several million. */
/* Full-time pay for a player of a given standard (a year). Up to Second Division level it rises 12% a point; above that
   pay climbs steeply: an average First Division starter about €75k a week, an average Premier starter about €160k,
   the Premier's best €250-300k, and a generational talent €500k a week. */
const WAGE_TOP = [[68, 222e3], [70.5, 1.3e6], [73.5, 3.9e6], [78, 6e6], [83, 8.3e6], [88, 11.5e6], [91, 14.3e6], [95, 19e6], [100, 26e6]];
// Transfer values follow their own curve (the pay scale from before First Division wages rose), so higher wages in the
// First Division don't make its players worth five times more.
const VALUE_TOP = [[72, 350e3], [78, 2.2e6], [83, 5.2e6], [88, 10.5e6], [91, 14.3e6], [95, 19e6], [100, 26e6]];
function valueBase(ovr) {
  if (ovr <= 72) return 3000 * Math.pow(1.12, ovr - 30);
  for (let i = 1; i < VALUE_TOP.length; i++) { const [a, x] = VALUE_TOP[i - 1], [b, y] = VALUE_TOP[i]; if (ovr <= b) return x * Math.pow(y / x, (ovr - a) / (b - a)); }
  return 26e6;
}
function wageBase(ovr) {
  if (ovr <= 68) return 3000 * Math.pow(1.12, ovr - 30);
  for (let i = 1; i < WAGE_TOP.length; i++) { const [a, x] = WAGE_TOP[i - 1], [b, y] = WAGE_TOP[i]; if (ovr <= b) return x * Math.pow(y / x, (ovr - a) / (b - a)); }
  return 26e6;
}
/* Below about the fifth tier players are part-time: they have day jobs, and clubs pay them a fraction of a full-time
   wage (about a third at a Regional League level, rising to the full rate by the National Division). */
const partTimeF = ovr => clamp(.15 + (ovr - 40) * .05, .15, 1);
// (The pay scale before 0.49.1, kept only to move existing contracts across.)
function wageForV1(ovr) { const o = oldEq(ovr); return Math.max(1000, Math.round(wageBase(o) * partTimeF(o) / 100) * 100); }
/* Pay by rating, on the 200-point scale (shown rating x 10), per week: part-time money in the lower leagues, an even
   climb from 50 (a National Division average starter, about €1,000) to 100 (a First Division average starter, about
   €40,000) and 130 (a Premier average starter, about €75,000), then the Premier's best (170-180) on €250-300,000 and
   €500,000 for a 200. */
const PAY200 = [[0, 19], [10, 19], [20, 133], [30, 254], [40, 437], [50, 1015], [60, 2110], [70, 4390], [80, 9130], [90, 19000], [100, 40000], [110, 49300], [120, 60800], [130, 75000], [140, 101000], [150, 137000], [160, 185000], [170, 250000], [180, 300000], [190, 380000], [200, 500000]];
// (The pay scale from 0.49.1-0.49.4, kept to move contracts across.)
const PAY200_V2 = [[0, 19], [10, 19], [20, 133], [30, 254], [40, 437], [50, 1015], [60, 2395], [70, 5650], [80, 13330], [90, 31450], [100, 74200], [120, 131377], [140, 181854], [170, 255733], [190, 365385], [200, 500000]];
const rating200 = ovr => to20(ovr) * 10;
/* The same player costs more in a bigger division. The table is the rate at his natural level (the division whose
   average starter he matches: Premier 130, First 100, Second 70, Third 60, National 50, North/South 40, Regional 20);
   each division above that adds about a quarter, each one below takes about a fifth off. On top of that, each club's
   owner and finances set how far above or below the rate it pays. */
const DIV_AVG200 = [0, 130, 100, 70, 60, 50, 40, 20];
function payTier(ovr) { const r = rating200(ovr); if (r >= 130) return 1; if (r <= 20) return 7;
  for (let t = 1; t < 7; t++) if (r >= DIV_AVG200[t + 1]) return t + (DIV_AVG200[t] - r) / (DIV_AVG200[t] - DIV_AVG200[t + 1]); return 7; }
const divPremium = (ovr, tier) => clamp(Math.pow(1.25, payTier(ovr) - tier), .6, 1.8);
const wageAt = (ovr, tier) => Math.round(wageFor(ovr) * divPremium(ovr, tier) / 100) * 100;
function payOn(T, ovr) {
  const r = clamp(rating200(ovr), 0, 200); let wk = 500000;
  for (let i = 1; i < T.length; i++) { const [a, x] = T[i - 1], [b, y] = T[i]; if (r <= b) { wk = x * Math.pow(y / x, (r - a) / (b - a)); break; } }
  return Math.max(1000, Math.round(wk * 52 / 100) * 100);
}
const wageFor = ovr => payOn(PAY200, ovr);
function valueOf(p) {
  const o = oldEq(p.ovr); let v = valueBase(o) * 3 * Math.pow(1.025, o - 50) * clamp((o - 35) / 25, .2, 1);
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
  // Player development reads a coach's skill against what's usual at his level, so better clubs don't simply develop
  // everyone faster (their better coaching already shows in their standard).
  const rel = c.coach.dev - aiStaffLvl(c.rep || 40) + 40; return { train: c.train, dev: rel, acad: c.acadLvl, ydev: rel };
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
/* An AI club's manager: both his tactics and his player development come from the club's standing (like the staff
   you can hire), with a spread around it, so the best managers are at the biggest clubs. */
const aiStaffLvl = rep => rep * .75 + 18;
function aiCoach(rep) { return { age: ri(34, 60), name: pick(COACH_FIRST) + " " + pick(NAMES.ENG[1]), style: pick(Object.keys(STYLES)), form: pick(FORM_KEYS), tac: clamp(Math.round(aiStaffLvl(rep) + normal() * 9), 5, 97), dev: clamp(Math.round(aiStaffLvl(rep) + normal() * 9), 5, 97) }; }
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
  c.draw = seedDraw(); c.fans = Math.round(c.fans * c.draw); if (c.draw > 1.5) c.cap = Math.min(80000, Math.round(c.cap * Math.min(c.draw, 2) / 100) * 100);
  c.own = newOwner(c);
  G.clubs.push(c);
  return c;
}
const STADIUM_T = [0, 42000, 22000, 11000, 7000, 4500, 3000, 1200];
const FAN_T = [0, 38000, 18000, 8500, 5200, 2600, 1300, 450];
/* How far a player sits from his club's standard: a wide spread, so divisions overlap and every rating is filled,
   with the odd standout well above his team-mates and the odd one well below. */
const spreadN = () => normal() * 4.2 + (R() < .05 ? rf(5, 10) : 0) - (R() < .05 ? rf(4, 8) : 0);
function genSquad(c) {
  for (const [pos, n] of Object.entries(SQUAD_MIX)) for (let i = 0; i < n; i++) {
    const age = i === n - 1 && R() < .4 ? ri(17, 21) : ri(19, 34);
    let ovr = Math.round(c.lvl + 2 - i * 3 + spreadN() - (age < 21 ? 5 : 0));
    ovr = clamp(ovr, 5, 93);
    const nat = R() < (c.tier <= 2 ? .55 : c.tier <= 4 ? .8 : .95) ? "ENG" : pickNat("ENG");
    const p = makePlayer({ pos, ovr, age, nat, club: c.id, pot: seniorPot(ovr, age) });
    p.yrs = ri(1, 4);
    c.squad.push(p.id);
  }
}

/* ---------- the world ---------- */
function newWorld(o) {
  G = { sgrace1: true, brk1: true, list2: true, pay13: true, foreign2: true, intake2: true, fa2: true, pay2: true, pay3: true, pay4: true, pay5: true, pay6: true, pay7: true, fans2: true, foreign3: true, pay8: true, retro40: true, site2: true, reroll1: true, pay9: true, pay10: true, low1: true, pay11: true, pay12: true, spay2: true, spay3: true, aistaff2: true, emerg1: true, v: 1, year: 2026, phase: "summer", week: 0, club: null, nextPid: 1, players: {}, clubs: [], towns: {}, leagues: {}, fa: [],
    news: [], inbox: [], nextMsg: 1, history: [], hof: [], wonders: [], cand: null, owner: null, seed: R() };
  for (const k of LG_KEYS) { const ids = []; for (let i = 0; i < LEAGUES[k].size; i++) ids.push(newClub(k, i).id); G.leagues[k] = { key: k, clubs: ids }; }
  for (const c of G.clubs) genSquad(c);
  makeForeign();
  for (const c of G.clubs) if (!c.gone) c.own ||= newOwner(c);
  // A pool of unattached players: the trialists and journeymen a new club can sign.
  for (let i = 0; i < 160; i++) { const ovr = ri(30, 62), age = ri(19, 34); const p = makePlayer({ pos: pick(POS), ovr, age, nat: R() < .75 ? "ENG" : pickNat("ENG"), pot: seniorPot(ovr, age) }); toFreeAgent(p); }
  if (o) foundClub(o);
  return G;
}
function toFreeAgent(p) { leaveClub(p); p.club = -1; p.acad = false; p.yrs = 0; p.list = false; p.keep = false; p.nfs = false; p.force = false; p.faY = G.year; if (!G.fa.includes(p.id)) G.fa.push(p.id); }
function leaveClub(p) { if (p.club >= 0 && typeof favLeaves === "function") favLeaves(p); if (p.club >= 0) { const c = CL(p.club); c.squad = c.squad.filter(id => id !== p.id); } }
/* Transfer windows: a player who joins a club in a window can't be sold on in the same window. */
const windowId = () => (G.phase === "summer" ? "S" : "J") + G.year;
const canSell = p => !(p.inW && p.inW === windowId() && windowOpen());
/* AI clubs, English and foreign, hold at most 28 senior players (loanees included; academy players don't count). Over
   that, the least valuable of their own players are released, never one who has just arrived or a loanee. */
const AI_MAX = 28;
function capSquad(c, keep) {
  if (!c || isMine(c)) return;
  const seniors = () => c.squad.map(P).filter(p => p && !p.acad);
  while (seniors().length > AI_MAX) {
    const p = seniors().filter(q => q !== keep && !q.loan).sort((a, b) => valueOf(a) - valueOf(b))[0]; if (!p) break;
    leaveClub(p); toFreeAgent(p);
  }
}
function moveTo(p, c) { p.inW = windowId(); p.req = 0; p.blocked = 0; p.unsettled = 0; leaveClub(p); G.fa = G.fa.filter(id => id !== p.id); p.club = c.id; p.list = false; p.keep = false; p.nfs = false; p.force = false; p.acad = false; c.squad.push(p.id); p.hist.push([G.year, c.short]);  if (!isMine(c)) capSquad(c, p); }
/* A retirement makes room for a newcomer: one young player (17-20) joins the free agents for each who retires, a little
   below the level the veteran played at. Clearing out the pool (cull) brings nobody in. */
function newcomerFor(p) {
  const c = p.club >= 0 ? CL(p.club) : null, base = c && !c.abroad ? TIER_LVL[c.tier] : c ? c.lvl : Math.min(p.ovr, 58);
  const age = ri(17, 20), ovr = clamp(Math.round(base - rf(4, 12) - (20 - age) * 1.5 + normal() * 3), 22, 80);
  toFreeAgent(makePlayer({ pos: pick(POS), ovr, age, nat: c && c.abroad ? c.country : R() < .8 ? "ENG" : pickNat("ENG"), pot: seniorPot(ovr, age) }));
}
function retire(p, cull) {
  if (!cull) newcomerFor(p);
  p._retiring = true; onRetire(p);
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
  G.board = { own: 100, inv: [], offers: [] }; G.sTrust = { rel: 50, members: 0, seat: false }; G.net = { partner: null, feeders: [] }; G.loans = [];
  const c = { id: G.clubs.length, name: o.name, town: o.town || o.name.split(" ")[0], short: shortFor(o.short || o.name), half: o.half, region: o.region || pick(regions)[0],
    lg, tier: 7, rep: 4, media: 8, color: o.color || "#b42323", coach: null, squad: [], lvl: TIER_LVL[7] - 3, train: 0, acadLvl: 0, cap: 0, fans: 120, gone: false, founded: G.year, trophies: [],
    cash: 0, mood: 60, morale: 55,
    prices: { ticket: 8, conc: 3, shirt: 40, suite: 2500 },
    budget: { wages: tierWages(7), transfer: 60000, acad: 0, scout: 10000, comm: 0 },
    fac: { stadium: { own: false, cap: 0, amen: 1, host: 0, build: null, suites: 0, pitch: 100, ptype: "grass", relay: null }, train: { lvl: 0, build: null }, acad: { lvl: 0, build: null } },
    deals: [], offers: [], staff: { manager: null, youth: null, recruit: null }, fin: newLedger(), finLast: null, spentT: 0 };
  c.short = shortFor(o.short || o.name);
  G.clubs.push(c); L.clubs.push(c.id); G.club = c.id;
  G.owner = { name: o.owner || "The owner", wealth: WEALTH[o.wealth].amt, kind: o.wealth, invested: 0, vision: o.vision };
  invest(Math.min(G.owner.wealth, Math.round(WEALTH[o.wealth].amt * .08)), true);
  // An open trial day: the founding squad is whoever turned up.
  for (const [pos, n] of Object.entries({ GK: 2, CB: 3, FB: 3, DM: 1, CM: 3, AM: 1, W: 2, ST: 3 })) for (let i = 0; i < n; i++) {
    const age = ri(17, 31), ovr = Math.round(oldToNew(clamp(33 + normal() * 4 - (age < 20 ? 3 : 0), 22, 44)));
    const p = makePlayer({ pos, ovr, age, nat: R() < .9 ? "ENG" : pickNat("ENG"), club: c.id, pot: seniorPot(ovr, age), wage: 1500 });
    p.yrs = ri(1, 2); c.squad.push(p.id); p.hist.push([G.year, c.short]);
  }
  setGround(c, 0);
  news(`${c.name} are founded. ${c.squad.length} players from an open trial day make up the first squad, and the club will play at ${HOSTS[0].name} while it has no ground of its own.`, true);
  return c;
}
function newLedger() { return { para: 0, equity: 0, borrow: 0, repay: 0, dividend: 0, feeders: 0, network: 0, breaks: 0, stix: 0, directors: 0, events: 0, suites: 0, gate: 0, conc: 0, merch: 0, spons: 0, tv: 0, prize: 0, sales: 0, wages: 0, staff: 0, fac: 0, rent: 0, mdops: 0, travel: 0, refunds: 0, medical: 0, insure: 0, insclaim: 0, oldground: 0, util: 0, grading: 0, comm: 0, tax: 0, acad: 0, scout: 0, buys: 0, build: 0, interest: 0, invest: 0 }; }

/* ---------- archetypes ----------
   What kind of player he is in his position, read from which attributes stand out against his own overall (allowing
   for the attributes every player in that position is built around). [name, keys, description, short] */
const ARCHETYPES = {
  GK: [["Shot-stopper", ["ss", "han"], "Keeps the ball out: reflexes and handling first.", "SS"], ["Ball-playing keeper", ["dis", "cmp"], "Starts attacks with his feet.", "BPK"], ["Commanding keeper", ["aer", "han"], "Rules his box and claims every cross.", "CMD"]],
  CB: [["Stopper", ["tac", "str"], "Steps in, wins the ball and the duel.", "STP"], ["Aerial presence", ["hea", "str"], "Dominant in the air at both ends.", "AER"],
    ["Ball-playing defender", ["pas", "cmp", "vis"], "Calm on the ball, breaks lines with his passing.", "BPD"], ["Covering defender", ["pac", "mar"], "Reads danger and has the pace to cover.", "COV"]],
  FB: [["Overlapping full-back", ["pac", "sta", "dri"], "Gets up and down the flank all game.", "OFB"], ["Defensive full-back", ["tac", "mar"], "Defends first, rarely beaten one on one.", "DFB"],
    ["Inverted full-back", ["pas", "tec", "cmp"], "Steps inside to help build play.", "IFB"]],
  DM: [["Ball-winner", ["tac", "sta"], "Hunts the ball and breaks up play.", "BW"], ["Deep-lying playmaker", ["pas", "vis", "cmp"], "Dictates from deep.", "DLP"],
    ["Anchor", ["mar", "str", "hea"], "Holds the position in front of the defence.", "ANC"]],
  CM: [["Box-to-box", ["sta", "tac", "fin"], "Covers every blade of grass, tackles and scores.", "B2B"], ["Playmaker", ["pas", "vis", "tec"], "Sets the tempo and finds the pass.", "PM"],
    ["Ball carrier", ["dri", "pac", "tec"], "Drives forward with the ball at his feet.", "BC"]],
  AM: [["Creator", ["vis", "pas"], "Unlocks defences with the final ball.", "CRE"], ["Shadow striker", ["fin", "cmp"], "Arrives in the box to score.", "SHS"],
    ["Dribbler", ["dri", "tec"], "Beats players in tight spaces.", "DRB"]],
  W: [["Direct winger", ["pac", "dri"], "Takes on the full-back with speed.", "DW"], ["Inside forward", ["fin", "cmp", "dri"], "Cuts inside to shoot.", "IF"],
    ["Wide playmaker", ["pas", "vis", "tec"], "Creates from the flank.", "WPM"], ["Workhorse winger", ["sta", "tac"], "Tracks back and presses all game.", "WW"]],
  ST: [["Poacher", ["fin", "cmp"], "Lives in the box and finishes chances.", "POA"], ["Target man", ["hea", "str"], "Holds the ball up and wins it in the air.", "TM"],
    ["Runner in behind", ["pac", "fin"], "Stretches the defence with his pace.", "RIB"], ["Deep-lying forward", ["pas", "vis", "tec"], "Drops in to link the play.", "DLF"]],
};
function archetypeOf(p) {
  const list = ARCHETYPES[p.pos]; if (!list || !p.at) return null;
  const W = POS_W[p.pos], off = k => W[k] ? 3 : -11;  // the shape every player in this position is generated with
  let best = null, bs = -1e9;
  for (const a of list) { const s = avg(a[1].map(k => (p.at[k] ?? 0) - off(k))); if (s > bs) { bs = s; best = a; } }
  return best;
}
