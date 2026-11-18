/* Why people join. Every player and every coach weighs a set of factors,
   with their own priorities: two that matter most to them, the rest less. Money is one factor among them. A big enough
   offer can make up for a weak spot, but not for everything: some people won't come at any price. */
"use strict";

const P_FACTORS = [["money", "Wages"], ["time", "Playing time"], ["form", "Fits the manager's system"], ["prest", "Club prestige"], ["fac", "Training facilities"], ["home", "Close to home"], ["proj", "The project"]];
const S_FACTORS = [["money", "Salary"], ["prest", "Club prestige"], ["fac", "Facilities"], ["budget", "Budgets"], ["squad", "The squad"], ["proj", "Owner's ambition"], ["auto", "Freedom to work"], ["vision", "Shared vision"]];
const FACTOR_HELP = {
  money: "The wage on offer against what he's after.", time: "Whether he'd start: the players ahead of him at his position.",
  form: "How many places the manager's formation has for his position, and whether his style of play suits him.", prest: "The club's standing against what he's used to.",
  fac: "The training ground (managers and players), the academy (youth managers) or the scouting budget (recruitment).",
  home: "Whether the club is in his part of the country. Players from abroad mind less if they're open to moving.",
  proj: "Your fortune, and whether the club is on the way up.", budget: "The budget he'd work with against what's normal in the division.",
  squad: "For a manager: the quality of the squad and how it suits his style. For others: the club's current direction.",
  auto: "Whether you let your staff do their jobs. Every time you overrule them, word gets around.",
  vision: "Whether your vision for the club (Board page) matches his own ideas about how football should be played and run.",
};
function makePri(factors) {
  const pri = {}; for (const [k] of factors) pri[k] = .5 + R() * .6;
  const top = shuffle(factors.map(f => f[0])).slice(0, 2); pri[top[0]] += 2; pri[top[1]] += 1.1;
  const t = sum(Object.values(pri)); for (const k in pri) pri[k] = Math.round(pri[k] / t * 1000) / 1000;
  return { pri, top, thr: r1(rf(.46, .56) * 100) / 100, open: Math.round(rf(.15, 1) * 100) / 100 };
}
const prefsOf = (o, factors) => o.pref || (o.pref = makePri(factors));
const moneyF = ratio => clamp(.5 + (ratio - 1) * 1.5, 0, 1);
const ratioFor = f => 1 + (f - .5) / 1.5;
// The project: deep pockets and a club going up.
function projectF() { const ups = G.history.slice(0, 4).filter(h => h.up).length, downs = G.history.slice(0, 4).filter(h => h.down).length; return clamp(Math.log10(Math.max(1, G.owner.wealth) / 1e5) / 5 + ups * .15 - downs * .15, 0, 1); }
const meddleF = () => clamp(1 - (G.meddle || 0) / 6, 0, 1);

/* ---------- what drives a player ----------
   Every player has a home region (English players: often near where he started) and a personality from his two top
   priorities. They change what he asks to be paid:
   - Money-motivated players want up to a third over the going rate.
   - A player who cares about home takes up to a fifth less to play in his own region.
   And how he feels about the manager's system: no place for his position in the formation, or a style that doesn't
   suit his game, makes a player who cares about playing unhappy, and less willing to sign a new contract. */
const ENG_REGIONS = () => G._regs ||= [...new Set(G.clubs.filter(x => !x.abroad && x.region).map(x => x.region))];
function homeOf(p) {
  if (p.reg !== undefined) return p.reg;
  if (p.nat !== "ENG") return (p.reg = null);
  const first = p.hist && p.hist.length ? G.clubs.find(x => x.short === p.hist[0][1] && !x.abroad) : p.club >= 0 && !CL(p.club).abroad ? CL(p.club) : null;
  return (p.reg = first && R() < .45 ? first.region : pick(ENG_REGIONS()));
}
const PERSONA = { money: "Money-motivated", time: "Wants to play every week", form: "Needs the right system", prest: "Ambitious", fac: "Professional", home: "A home bird", proj: "Wants to be part of something" };
function personaOf(p) { const pr = prefsOf(p, P_FACTORS); return pr.top.map(k => PERSONA[k]); }
function wageMult(p, c) {
  const pr = prefsOf(p, P_FACTORS), greed = clamp(1 + (pr.pri.money - .14) * 1.6, 1, 1.35);
  const home = c && homeOf(p) && homeOf(p) === c.region ? clamp(1 - pr.pri.home * .55, .8, 1) : 1;
  return greed * home;
}
// How well the manager's system suits him: places for his position in the formation, and the style's key attributes
// against his own average (-1 badly, +1 well).
function systemFit(p) {
  const slots = FORMS[mgr().form || "4-4-2"].filter(s => s === p.pos).length;
  if (p.pos === "GK") return { slots, style: 0 };
  const keys = STYLES[mgr().phil] ? STYLES[mgr().phil].keys : [], all = avg(OUT_KEYS.map(k => p.at[k]));
  return { slots, style: keys.length ? clamp((avg(keys.map(k => p.at[k])) - all) / 8, -1, 1) : 0 };
}

/* ---------- players ---------- */
function playerFactors(p, c) {
  const from = p.club >= 0 ? CL(p.club) : null, refRep = from ? from.rep : p.club === -2 ? clamp(p.ovr - 20, 5, 90) : clamp(p.ovr - 35, 3, 60);
  const others = c.squad.map(P).filter(q => q !== p && !q.acad && q.pos === p.pos && !q.inj).map(q => q.ovr).sort((a, b) => b - a);
  const slots = FORMS[mgr().form || "4-4-2"].filter(s => s === p.pos).length, ahead = others.filter(o => o > p.ovr).length;
  const half = p.half || (from ? from.half : (p.half = pick(["N", "S"])));
  const expFac = clamp(Math.round((p.ovr - 40) / 5), 0, 10), tl = c.fac.train.lvl;
  return {
    time: ahead < Math.max(1, slots) ? 1 : ahead < slots + 1 ? .55 : ahead < slots + 2 ? .25 : .05,
    // The manager's system: places for his position, and whether the style suits his game (for your club, your manager's).
    form: clamp((slots >= 2 ? 1 : slots === 1 ? .65 : .1) + (isMine(c) ? systemFit(p).style * .25 : 0), 0, 1),
    prest: clamp(.5 + (c.rep - refRep) / 25, 0, 1),
    fac: clamp(.5 + (tl - expFac) / 6, 0, 1),
    home: p.nat === "ENG" ? (homeOf(p) === c.region ? 1 : half === c.half ? .7 : .35) : .3 + prefsOf(p, P_FACTORS).open * .5,
    proj: projectF(),
  };
}
/* The least he'd sign for: the wage that gets his overall appeal to his threshold, or null if no wage would. */
function playerAsk(p, c = my()) {
  const pr = prefsOf(p, P_FACTORS), f = playerFactors(p, c), base = demandWage(p, c);
  let other = 0; for (const [k, w] of Object.entries(pr.pri)) if (k !== "money") other += w * f[k];
  const need = (pr.thr - other) / pr.pri.money;
  if (need > 1) return null;
  const want = Math.ceil(base * Math.max(.85, ratioFor(Math.max(0, need)) + .001) / 100) * 100;
  return p.club >= 0 ? Math.max(want, Math.ceil(p.wage * .95 / 100) * 100) : want;  // nobody under contract moves for much less than he earns
}
function playerAppeal(p, wage, c = my()) {
  const pr = prefsOf(p, P_FACTORS), f = { ...playerFactors(p, c), money: moneyF(wage / demandWage(p, c)) };
  return { f, pr, score: sum(Object.entries(pr.pri), ([k, w]) => w * f[k]) };
}

/* ---------- staff ---------- */
let SF_XI = null;
function staffFactors(s) {
  const c = my(), T = c.tier, typWages = 24 * wageFor(TIER_LVL[T]);
  const fac = s.role === "manager" ? clamp(.5 + (c.fac.train.lvl - s.rep / 10) / 5, 0, 1) : s.role === "youth" ? clamp(.5 + (c.fac.acad.lvl - s.rep / 10) / 5, 0, 1) : clamp(.5 + budgetFactor(c.budget.scout, scoutRef(T)) / 6, 0, 1);
  const budget = s.role === "manager" ? clamp(.5 + Math.log2(Math.max(1, c.budget.wages) / typWages) * .5, 0, 1) : s.role === "youth" ? (c.fac.acad.lvl ? clamp(.5 + budgetFactor(c.budget.acad, acadRef(c.fac.acad.lvl)) / 6, 0, 1) : .1) : clamp(.5 + Math.log2(Math.max(1, c.budget.transfer) / (typWages * .8)) * .4, 0, 1);
  // The first team is worked out once a week, not once per candidate (there are hundreds of them).
  const key = `${G.year}.${G.phase}.${G.week}.${c.squad.length}.${mgr().form || ""}`;
  if (!SF_XI || SF_XI.key !== key) { const xi0 = pickXI(c); SF_XI = { key, xi: xi0, q: avg(xi0.map(o => roleRating(o.p, o.slot))) }; }
  const xi = SF_XI.xi, q = SF_XI.q;
  const squad = s.role === "manager" ? clamp(.5 + (q - TIER_LVL[T]) / 12 + styleFit(xi, s.phil) * .25, 0, 1) : clamp(.5 + (q - TIER_LVL[T]) / 15, 0, 1);
  // A legend of the club wants to come home: the club's standing and his own fit don't hold him back.
  const home = isLegendOf(s, c.id) ? 1 : s.ex && s.ex.favOf.includes(c.id) ? .5 : 0;
  return { prest: Math.max(home, clamp(.5 + (TIER_REP[T] + c.rep * .3 - s.rep) / 30, 0, 1)), fac, budget, squad, proj: projectF(), auto: clamp(1 - (1 - meddleF()) * tolF(s), 0, 1), vision: Math.max(home * .9, visionMatch(s)) };
}
/* Like players, coaches won't drop far below their standing whatever the money: a reputation belongs to a division,
   and they'll go at most two divisions lower (three once they're 58 and winding down). Your own staff renewing, and
   former players coming home to a club that loves them, are the exceptions. */
const repTier = r => { for (let t = 1; t <= 7; t++) if (r >= TIER_REP[t] - 4) return t; return 7; };
const staffDropOK = s => { const c = my(); return s === staffOf(s.role) || isLegendOf(s, c.id) || (s.ex && s.ex.favOf.includes(c.id)) || c.tier <= repTier(s.rep) + (s.age >= 58 ? 3 : 2); };
function staffAsk(s) {
  if (!staffDropOK(s)) return null;
  const pr = prefsOf(s, S_FACTORS), f = staffFactors(s);
  let other = 0; for (const [k, w] of Object.entries(pr.pri)) if (k !== "money") other += w * f[k];
  const need = (pr.thr - other) / pr.pri.money;
  if (need > 1) return null;
  return Math.ceil(s.demand * Math.max(.85, ratioFor(Math.max(0, need)) + .001) * (s.emp != null && s !== staffOf(s.role) ? 1.15 : 1) / 1000) * 1000;
}
function staffAppeal(s, wage) {
  const pr = prefsOf(s, S_FACTORS), f = { ...staffFactors(s), money: moneyF(wage / s.demand) };
  return { f, pr, score: sum(Object.entries(pr.pri), ([k, w]) => w * f[k]) };
}
/* Why someone said no: what he cares about most and what let you down. */
function refusalReason(a, factors) {
  const name = Object.fromEntries(factors), worst = Object.entries(a.f).filter(([k]) => a.pr.pri[k] > .14).sort((x, y) => x[1] - y[1])[0];
  return `He cares most about ${name[a.pr.top[0]].toLowerCase()} and ${name[a.pr.top[1]].toLowerCase()}${worst && worst[1] < .45 ? `, and isn't convinced by the ${name[worst[0]].toLowerCase()}` : ""}.`;
}
