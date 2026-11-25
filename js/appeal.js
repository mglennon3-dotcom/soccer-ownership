/* Why people join. Every player and every coach weighs a set of factors,
   with their own priorities: two that matter most to them, the rest less. Money is one factor among them. A big enough
   offer can make up for a weak spot, but not for everything: some people won't come at any price. */
"use strict";

const P_FACTORS = [["money", "Wages"], ["time", "Playing time"], ["form", "Fits the manager's system"], ["prest", "Club prestige"], ["fac", "Training facilities"], ["home", "Close to home"], ["proj", "The project"]];
const S_FACTORS = [["money", "Salary"], ["prest", "Club prestige"], ["fac", "Facilities"], ["budget", "Budgets"], ["squad", "The squad"], ["proj", "Owner's ambition"], ["auto", "Freedom to work"], ["vision", "Shared vision"]];
const FACTOR_HELP = {
  money: "The wage on offer against what he's after.", time: "Whether he'd start: the players ahead of him at his position.",
  form: "How many places the manager's formation has for his position, whether the style of play suits his game and his type, and whether his type clicks with the players around him.", prest: "The club's standing against what he's used to.",
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
function projectF() { const ups = G.history.slice(0, 4).filter(h => h.up).length, downs = G.history.slice(0, 4).filter(h => h.down).length; return clamp(Math.log10(Math.max(1, G.owner.wealth) / 1e5) / 5 + ups * .15 - downs * .15 + (ownType().appeal || 0), 0, 1); }
/* How a club is doing (-1 to +1): this season's table once a few games are in (a title race or promotion push up, a
   relegation fight down), last season's finish before then (champions, promoted, top four up; relegated or near the
   bottom down), and a little for playing in Europe. Players weigh it when deciding to join, stay or re-sign, at your
   club and at AI clubs. fight: in or near the relegation places, with ten games played. Worked out once a week. */
let SIT = null;
function clubSit(c) {
  const key = `${G.year}.${G.phase}.${G.week}`; if (!SIT || SIT.k !== key) SIT = { k: key, m: new Map() };
  if (!c || c.abroad || c.gone || !c.lg || !LEAGUES[c.lg]) return { m: 0, fight: false };
  let r = SIT.m.get(c.id); if (r) return r;
  const L = LEAGUES[c.lg], games = ((G.leagues[c.lg] && G.leagues[c.lg].tab || {})[c.id] || {}).p || 0;
  let now = 0, w = 0, fight = false;
  if ((G.phase === "season" || G.phase === "playoffs") && games >= 6) {
    const t = table(c.lg), n = t.length, pos = t.findIndex(x => x.id === c.id) + 1, dn = L.down || 0;
    w = clamp((games - 6) / 14, 0, 1);
    now = c.tier === 1 ? (pos <= 2 ? 1 : pos <= 4 ? .6 : pos <= 6 ? .3 : 0) : (pos <= 2 ? 1 : pos <= 6 && ABOVE[c.lg] ? .4 : 0);
    if (dn && pos > n - dn) now = -1; else if (dn && pos > n - dn - 3) now = -.5;
    fight = !!dn && games >= 10 && pos > n - dn - 2;
  }
  const f = c.lastF; let last = 0;
  if (f && f.y >= G.year - 1) last = f.up || f.pos === 1 ? .6 : f.down ? -.6 : f.tier === 1 && f.pos <= 4 ? .4 : f.pos > f.n - 4 ? -.3 : 0;
  r = { m: clamp(now * w + last * (1 - w * .6) + (inEurope(c) ? .2 : 0), -1, 1), fight };
  SIT.m.set(c.id, r); return r;
}
/* How a player rates an AI club, on the same factors and with his own priorities as he rates yours, money aside (AI
   clubs pay the going rate): playing time there, the manager's formation and style (his type against the style, how
   he'd click with their eleven), the club's standing and how it's doing, and home. Returned against his threshold:
   above 0 he's keen, below it he'd rather not. Used when AI clubs sign players and when their players re-sign. */
function aiAppeal(p, c) {
  /* Stepping down, the same rule as for your club: within his room he weighs it like any move; past it only a
     money-motivated player (or one with a tie to the club) can be tempted, never more than two divisions past it, never
     the very best, and only by a huge wage that only a big-spending owner pays. */
  if (p.club !== c.id && !c.abroad) { const past = c.tier - naturalTier(p) - joinRoom(p);
    if (past > 0 && (past > 2 || !tempted(p, c) || (ownStyle(c).spend < 3 && !affinity(p, c)))) return -1; }
  const pr = prefsOf(p, P_FACTORS), form = (c.coach && c.coach.form) || "4-4-2", style = baseStyle(c), mo = clubSit(c).m;
  const slots = (FORMS[form] || []).filter(s => s === p.pos).length;
  let ahead = 0; for (const id of c.squad) { const q = P(id); if (q && q !== p && !q.acad && q.pos === p.pos && q.ovr > p.ovr) ahead++; }
  const t = typeParts(c, p, style) || { st: 0, mates: .8 };
  const from = p.club >= 0 && p.club !== c.id ? CL(p.club) : null, refRep = from ? from.rep : c.rep, half = p.half || (from ? from.half : null);
  const f = {
    money: .55 + Math.max(0, ownStyle(c).spend) * .05, fac: .5,  // a big-spending owner pays over the odds
    time: ahead < Math.max(1, slots) ? 1 : ahead < slots + 1 ? .55 : ahead < slots + 2 ? .25 : .05,
    form: clamp((slots >= 2 ? .85 : slots === 1 ? .6 : .1) + t.st * .15 + clamp((t.mates - .8) / 2.5, -1, 1) * .15, 0, 1),
    prest: clamp(.5 + (c.rep - refRep) / 25 + mo * .12, 0, 1),
    home: p.nat === "ENG" ? (homeOf(p) === c.region ? 1 : half && half === c.half ? .7 : .35) : .3 + pr.open * .5,
    proj: clamp(.5 + mo * .4, 0, 1),
  };
  return sum(Object.entries(pr.pri), ([k, w]) => w * f[k]) - pr.thr;
}
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
/* How well the manager's system suits him (-1 badly, +1 well):
   - slots: places for his position in the formation;
   - style: the style's key attributes against his own average, and whether his type suits the style (the same
     style grid the match engine uses);
   - mates: whether his type clicks with the players around him in the first eleven (the same pairings grid). */
function systemFit(p, c = my()) {
  const slots = FORMS[mgr().form || "4-4-2"].filter(s => s === p.pos).length, phil = mgr().phil;
  const keys = STYLES[phil] ? STYLES[phil].keys : [], all = avg(OUT_KEYS.map(k => p.at[k]));
  const attr = p.pos === "GK" || !keys.length ? 0 : clamp((avg(keys.map(k => p.at[k])) - all) / 8, -1, 1);
  const t = typeParts(c, p, phil) || { st: 0, mates: 0 };
  // Most players have a pairing or two that works, so a typical one sits near 0; it takes both his game and his type
  // against the style to make him feel it doesn't suit him.
  return { slots, style: clamp(attr * .6 + t.st * .4, -1, 1), type: t.st, mates: clamp((t.mates - .8) / 2.5, -1, 1) };
}

/* ---------- players ---------- */
function playerFactors(p, c) {
  const from = p.club >= 0 ? CL(p.club) : null, refRep = from ? from.rep : p.club === -2 ? clamp(oldEq(p.ovr) - 20, 5, 90) : clamp(oldEq(p.ovr) - 35, 3, 60);
  const others = c.squad.map(P).filter(q => q !== p && !q.acad && q.pos === p.pos && !q.inj).map(q => q.ovr).sort((a, b) => b - a);
  const slots = FORMS[mgr().form || "4-4-2"].filter(s => s === p.pos).length, ahead = others.filter(o => o > p.ovr).length;
  const half = p.half || (from ? from.half : (p.half = pick(["N", "S"])));
  const expFac = clamp(Math.round((oldEq(p.ovr) - 40) / 5), 0, 10), tl = c.fac.train.lvl, mo = clubSit(c).m;
  return {
    time: ahead < Math.max(1, slots) ? 1 : ahead < slots + 1 ? .55 : ahead < slots + 2 ? .25 : .05,
    // The manager's system: places for his position, and whether the style suits his game (for your club, your manager's).
    form: clamp((slots >= 2 ? 1 : slots === 1 ? .65 : .1) + (isMine(c) ? (sf => sf.style * .25 + sf.mates * .15)(systemFit(p, c)) : 0), 0, 1),
    prest: clamp(.5 + (c.rep - refRep) / 25 + mo * .12, 0, 1),  // standing, plus how the club is doing
    fac: clamp(.5 + (tl - expFac) / 6, 0, 1),
    home: p.nat === "ENG" ? (homeOf(p) === c.region ? 1 : half === c.half ? .7 : .35) : .3 + prefsOf(p, P_FACTORS).open * .5,
    proj: clamp(projectF() + mo * .12, 0, 1),
  };
}
/* The least he'd sign for: the wage that gets his overall appeal to his threshold, or null if no wage would. */
function playerAsk(p, c = my()) {
  const pr = prefsOf(p, P_FACTORS), f = playerFactors(p, c), base = demandWage(p, c);
  let other = 0; for (const [k, w] of Object.entries(pr.pri)) if (k !== "money") other += w * f[k];
  const need = (pr.thr - other) / pr.pri.money;
  if (need > 1) return null;
  // In a relegation fight, an ambitious player good enough for the division won't come until it's settled.
  if (p.club !== G.club && relFightNo(p, c)) return null;
  // Stepping down a division he's paid as at his own level, plus 15% for each division he drops, and at least 10% over
  // what he earns now. No discount, however much he likes the club. Dropping further than he'd normally go (a player in
  // his prime leaving the division he belongs in, a star of any age) has a price too, but a huge one: at least double,
  // more the further he drops and the better he is.
  const drop = p.club === G.club ? 0 : Math.max(0, c.tier - naturalTier(p));
  if (drop) { const own = hugeWage(p, c), w0 = base * Math.max(1, ratioFor(Math.max(0, need)) + .001);
    return Math.ceil(Math.max(own, w0, p.club >= 0 ? p.wage * 1.1 : 0) / 100) * 100; }
  const floor = keenFloor(p, need), want = Math.ceil(base * (floor < .85 ? floor : Math.max(.85, ratioFor(Math.max(0, need)) + .001)) / 100) * 100;
  // Under contract elsewhere, he won't move for much less than he earns, unless he's keen and money isn't what drives him.
  return p.club >= 0 ? Math.max(want, Math.ceil(p.wage * (floor < .85 ? Math.max(.75, floor + .15) : .95) / 100) * 100) : want;
}
/* How far below his going rate he'll go. Most players won't take less than 85%. One who already wants to join for
   other reasons (playing time, ambition, the project, the system, coming home: "need" below zero means those alone
   win him over) and isn't driven by money will take a real discount, down to about 55% for the keenest. */
function keenFloor(p, need) {
  const money = prefsOf(p, P_FACTORS).pri.money; if (need >= 0 || money >= .3) return .85;
  return clamp(.85 - Math.min(1, -need) * .45 * (1 - money / .3), .55, .85);
}
const keenToJoin = (p, c = my()) => { if (p.club !== G.club && c.tier > naturalTier(p)) return false; const pr = prefsOf(p, P_FACTORS), f = playerFactors(p, c); let other = 0; for (const [k, w] of Object.entries(pr.pri)) if (k !== "money") other += w * f[k]; return keenFloor(p, (pr.thr - other) / pr.pri.money) < .8; };
/* Did he take less than his going rate because he wanted to come? His going rate here is the division's wage for his
   rating, plus what money-minded players add, less what a free agent still unsigned knocks off (that's need, not
   wanting to come). Anything 10% or more below that is his choice: noted, with what drew him. Call before he moves. */
const KEEN_WHY = { time: "the chance to play regularly", form: "how he'd fit the manager's system", prest: "the club's standing", fac: "the training facilities", home: "being close to home", proj: "the club's project" };
function tookLess(p, c, wage) {
  if (p.acad || !wage) return null;
  const pr = prefsOf(p, P_FACTORS), greed = clamp(1 + (pr.pri.money - .14) * 1.6, 1, 1.35);
  const going = wageAt(p.ovr, c.tier) * (p.club === -2 ? 1.15 : 1) * greed * faDiscount(p), pct = Math.round((1 - wage / going) * 100);
  if (pct < 10) return null;
  const f = playerFactors(p, c), top = Object.entries(pr.pri).filter(([k]) => k !== "money" && KEEN_WHY[k]).map(([k, w]) => [k, w * f[k]]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => KEEN_WHY[k]);
  const aff = affinity(p, c), why = [...(aff ? [aff === "grew up supporting the club" ? "he grew up supporting the club" : aff === "came through the club's academy" ? "he came through the academy here" : "he was a favourite here"] : []), ...top].slice(0, 2);
  return { y: G.year, club: c.id, pct, going: Math.round(going / 100) * 100, why };
}
const keenLine = k => `Took ${k.pct}% less than his going rate (${pw(k.going)}) to join: he wanted to play for you${k.why.length ? `, for ${k.why.join(" and ")}` : ""}.`;
function playerAppeal(p, wage, c = my()) {
  const pr = prefsOf(p, P_FACTORS), f = { ...playerFactors(p, c), money: moneyF(wage / demandWage(p, c)) };
  // An ambitious player won't join a club in a relegation fight, whatever the terms (refusalReason says so).
  return { f, pr, p, score: p.club !== G.club && relFightNo(p, c) ? 0 : sum(Object.entries(pr.pri), ([k, w]) => w * f[k]) };
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
/* Someone in a job already has a division to lose. Stepping down one division is fine; two or three costs a lot more
   than he earns now (half as much again per extra division); four or more and he stays where he is. */
const empDrop = s => { if (s.emp == null || s === staffOf(s.role)) return 0; const x = CL(s.emp); return x ? my().tier - (x.abroad ? 1 : x.tier) : 0; };
const dropPremium = s => { const d = empDrop(s); return d >= 2 ? 1 + .5 * (d - 1) : 1; };
/* How far below his level he'll go: two divisions (three once he's 58), less the higher he stands within his own
   level. The very best in a division won't leave it; the elite of the top flight won't drop at all. */
const repExcess = s => Math.max(0, s.rep - (TIER_REP[repTier(s.rep)] - 4));
const dropRoom = s => Math.max(0, (s.age >= 58 ? 3 : 2) - Math.floor(repExcess(s) / 6));
const staffDrop = s => Math.max(0, my().tier - repTier(s.rep));  // divisions below his level
const staffDropOK = s => { const c = my(); if (empDrop(s) >= 4 && !isLegendOf(s, c.id)) return false; return s === staffOf(s.role) || isLegendOf(s, c.id) || (s.ex && s.ex.favOf.includes(c.id)) || staffDrop(s) <= dropRoom(s); };
// Dropping below his level costs: a quarter more per division (on top of anything for leaving a job).
const levelPremium = s => s === staffOf(s.role) || isLegendOf(s, my().id) ? 1 : 1 + staffDrop(s) * .25;
/* What he'll ask is set mostly by the job, not his name: the going rate for this role at a club of your division and
   standing, plus a premium for being better than that level (up to 2.5×), never more than his own market rate.
   Someone already earning more in a higher division won't take a pay cut to join you, and leaving a job or dropping
   divisions costs extra on top. */
// The job's standing: your division, moved by your own standing in it (the biggest club in the land pays the most).
const jobRep = (c = my()) => clamp(TIER_REP[c.tier] + clamp(c.rep - TIER_REP[c.tier], -10, 25), 1, 99);
const jobRate = role => staffWage(role, jobRep());
function effDemand(s) {
  const mine = s === staffOf(s.role), above = !mine && s.emp != null && empDrop(s) >= 1;
  // Quality and dropping below his level together come to at most 2.5× the going rate.
  let base = above ? s.demand * levelPremium(s) : Math.min(s.demand, jobRate(s.role) * skillPayF(staffR200(s), jobRep()) * Math.min(2.5, clamp(1 + (s.rep - jobRep()) / 40, 1, 2.5) * levelPremium(s)));
  // The manager is always the best-paid job at the club: the others are capped at the going rate for a manager.
  if (s.role !== "manager" && !above) base = Math.min(base, jobRate("manager") * .9);
  return base * (s.emp != null && !mine ? 1.15 : 1) * dropPremium(s);
}
function staffAsk(s) {
  if (!staffDropOK(s)) return null;
  const pr = prefsOf(s, S_FACTORS), f = staffFactors(s);
  let other = 0; for (const [k, w] of Object.entries(pr.pri)) if (k !== "money") other += w * f[k];
  const need = (pr.thr - other) / pr.pri.money;
  if (need > 1) return null;
  return Math.ceil(effDemand(s) * Math.max(.85, ratioFor(Math.max(0, need)) + .001) / 1000) * 1000;
}
function staffAppeal(s, wage) {
  const pr = prefsOf(s, S_FACTORS), f = { ...staffFactors(s), money: moneyF(wage / effDemand(s)) };
  return { f, pr, score: sum(Object.entries(pr.pri), ([k, w]) => w * f[k]) };
}
/* Why someone said no: what he cares about most and what let you down. */
const relFightNo = (p, c) => c.tier < 7 && clubSit(c).fight && p.ovr >= TIER_LVL[c.tier] && prefsOf(p, P_FACTORS).top.some(k => k === "prest" || k === "proj");
function refusalReason(a, factors, who) {
  if (factors === P_FACTORS && !who && a.p && a.p.club !== G.club && relFightNo(a.p, my())) return "He's ambitious and won't join a club in a relegation fight: ask again once it's settled.";
  const name = Object.fromEntries(factors), worst = Object.entries(a.f).filter(([k]) => a.pr.pri[k] > .14).sort((x, y) => x[1] - y[1])[0];
  return `${who ? pr(who, "He") : "He"} cares most about ${name[a.pr.top[0]].toLowerCase()} and ${name[a.pr.top[1]].toLowerCase()}${worst && worst[1] < .45 ? `, and isn't convinced by the ${name[worst[0]].toLowerCase()}` : ""}.`;
}
