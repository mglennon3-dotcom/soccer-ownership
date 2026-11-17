/* Why people join. Every player and every coach weighs a set of factors,
   with their own priorities: two that matter most to them, the rest less. Money is one factor among them. A big enough
   offer can make up for a weak spot, but not for everything: some people won't come at any price. */
"use strict";

const P_FACTORS = [["money", "Wages"], ["time", "Playing time"], ["form", "Formation fit"], ["prest", "Club prestige"], ["fac", "Training facilities"], ["home", "Close to home"], ["proj", "The project"]];
const S_FACTORS = [["money", "Salary"], ["prest", "Club prestige"], ["fac", "Facilities"], ["budget", "Budgets"], ["squad", "The squad"], ["proj", "Owner's ambition"], ["auto", "Freedom to work"], ["vision", "Shared vision"]];
const FACTOR_HELP = {
  money: "The wage on offer against what he's after.", time: "Whether he'd start: the players ahead of him at his position.",
  form: "How many places the manager's formation has for his position.", prest: "The club's standing against what he's used to.",
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

/* ---------- players ---------- */
function playerFactors(p, c) {
  const from = p.club >= 0 ? CL(p.club) : null, refRep = from ? from.rep : p.club === -2 ? clamp(p.ovr - 20, 5, 90) : clamp(p.ovr - 35, 3, 60);
  const others = c.squad.map(P).filter(q => q !== p && !q.acad && q.pos === p.pos && !q.inj).map(q => q.ovr).sort((a, b) => b - a);
  const slots = FORMS[mgr().form || "4-4-2"].filter(s => s === p.pos).length, ahead = others.filter(o => o > p.ovr).length;
  const half = p.half || (from ? from.half : (p.half = pick(["N", "S"])));
  const expFac = clamp(Math.round((p.ovr - 40) / 5), 0, 10), tl = c.fac.train.lvl;
  return {
    time: ahead < Math.max(1, slots) ? 1 : ahead < slots + 1 ? .55 : ahead < slots + 2 ? .25 : .05,
    form: slots >= 2 ? 1 : slots === 1 ? .65 : .1,
    prest: clamp(.5 + (c.rep - refRep) / 25, 0, 1),
    fac: clamp(.5 + (tl - expFac) / 6, 0, 1),
    home: p.nat === "ENG" ? (half === c.half ? .9 : .35) : .3 + prefsOf(p, P_FACTORS).open * .5,
    proj: projectF(),
  };
}
/* The least he'd sign for: the wage that gets his overall appeal to his threshold, or null if no wage would. */
function playerAsk(p, c = my()) {
  const pr = prefsOf(p, P_FACTORS), f = playerFactors(p, c), base = demandWage(p, c);
  let other = 0; for (const [k, w] of Object.entries(pr.pri)) if (k !== "money") other += w * f[k];
  const need = (pr.thr - other) / pr.pri.money;
  if (need > 1) return null;
  return Math.ceil(base * Math.max(.85, ratioFor(Math.max(0, need)) + .001) / 100) * 100;
}
function playerAppeal(p, wage, c = my()) {
  const pr = prefsOf(p, P_FACTORS), f = { ...playerFactors(p, c), money: moneyF(wage / demandWage(p, c)) };
  return { f, pr, score: sum(Object.entries(pr.pri), ([k, w]) => w * f[k]) };
}

/* ---------- staff ---------- */
function staffFactors(s) {
  const c = my(), T = c.tier, typWages = 24 * wageFor(TIER_LVL[T]);
  const fac = s.role === "manager" ? clamp(.5 + (c.fac.train.lvl - s.rep / 10) / 5, 0, 1) : s.role === "youth" ? clamp(.5 + (c.fac.acad.lvl - s.rep / 10) / 5, 0, 1) : clamp(.5 + budgetFactor(c.budget.scout, scoutRef(T)) / 6, 0, 1);
  const budget = s.role === "manager" ? clamp(.5 + Math.log2(Math.max(1, c.budget.wages) / typWages) * .5, 0, 1) : s.role === "youth" ? (c.fac.acad.lvl ? clamp(.5 + budgetFactor(c.budget.acad, acadRef(c.fac.acad.lvl)) / 6, 0, 1) : .1) : clamp(.5 + Math.log2(Math.max(1, c.budget.transfer) / (typWages * .8)) * .4, 0, 1);
  const xi = pickXI(c), q = avg(xi.map(o => roleRating(o.p, o.slot)));
  const squad = s.role === "manager" ? clamp(.5 + (q - TIER_LVL[T]) / 12 + styleFit(xi, s.phil) * .25, 0, 1) : clamp(.5 + (q - TIER_LVL[T]) / 15, 0, 1);
  return { prest: clamp(.5 + (TIER_REP[T] + c.rep * .3 - s.rep) / 30, 0, 1), fac, budget, squad, proj: projectF(), auto: meddleF(), vision: visionMatch(s) };
}
function staffAsk(s) {
  const pr = prefsOf(s, S_FACTORS), f = staffFactors(s);
  let other = 0; for (const [k, w] of Object.entries(pr.pri)) if (k !== "money") other += w * f[k];
  const need = (pr.thr - other) / pr.pri.money;
  if (need > 1) return null;
  return Math.ceil(s.demand * Math.max(.85, ratioFor(Math.max(0, need)) + .001) / 1000) * 1000;
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
