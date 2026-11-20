/* Staff: the people you hire to run the football side. You never pick a team or sign a player yourself unless you
   choose to overrule them, so who you hire, and whether their ideas match yours, is most of the game. */
"use strict";

/* How a manager wants to play. Each style leans on four attributes: a squad strong in them makes the style work,
   a squad weak in them makes it backfire. for/against scale expected goals for and against at an average fit. */
const STYLES = {
  possession: { l: "Possession",      keys: ["pas", "tec", "vis", "cmp"], for: 1.02, against: .9,  d: "Keeps the ball and starves opponents. Needs passers." },
  press:      { l: "High press",      keys: ["sta", "pac", "tac", "str"], for: 1.1,  against: 1.03, d: "Wins it back high up the pitch. Needs fit, aggressive runners." },
  counter:    { l: "Counter-attack",  keys: ["pac", "dri", "fin", "vis"], for: 1.0,  against: .95, d: "Sits off and breaks quickly. Needs pace and finishing." },
  direct:     { l: "Direct",          keys: ["hea", "str", "pac", "fin"], for: 1.05, against: 1.02, d: "Long balls into the channels. Needs strong, aerial players." },
  defensive:  { l: "Defensive",       keys: ["tac", "mar", "hea", "str"], for: .85,  against: .82, d: "Hard to beat, few goals at either end. Needs defenders." },
  wing:       { l: "Wing play",       keys: ["pac", "dri", "pas", "hea"], for: 1.06, against: 1.0, d: "Width and crosses. Needs quick wide players and a target in the box." },
};
const ROLES_STAFF = {
  manager: { l: "Manager", attrs: { tac: "Tactics", mot: "Motivation", dev: "Player development" },
    phil: STYLES, focus: { youth: "Gives young players a chance", results: "Picks the strongest side every week", balanced: "Balances results and development" } },
  youth: { l: "Youth manager", attrs: { dev: "Youth development", judge: "Judging potential", reach: "Youth scouting" },
    phil: { technical: { l: "Technical", d: "Brings through ball players: passing, technique, vision." }, physical: { l: "Physical", d: "Brings through athletes: pace, strength, stamina." }, balanced: { l: "Balanced", d: "No particular type." } },
    focus: { local: "Local talent: cheap, homegrown, a smaller pool", wide: "Searches nationally and abroad: a bigger pool, costs more" } },
  recruit: { l: "Head of recruitment", attrs: { judge: "Judging ability", neg: "Negotiation", net: "Contacts" },
    phil: { potential: { l: "Youth & potential", d: "Buys young players to develop and sell on." }, proven: { l: "Proven quality", d: "Buys experienced players who help now." },
      value: { l: "Value for money", d: "Hunts bargains: the most rating per euro." }, fit: { l: "Fit the manager", d: "Buys players suited to the manager's style." } },
    focus: { domestic: "England only", europe: "England and Europe", world: "Worldwide" } },
};
/* Staff can be men or women: a woman's first name means she, a man's he, and Dani, Jo and Sam could be either. The
   text uses pr(s, "he") etc. so each one is called the right thing. */
const STAFF_F = new Set(["Claire", "Emma", "Fiona", "Hannah", "Kate", "Lucy", "Marta", "Nina", "Rachel"]), STAFF_EITHER = new Set(["Dani", "Jo", "Sam"]);
const sexOf = s => s.g ??= (n => STAFF_F.has(n) ? "f" : STAFF_EITHER.has(n) ? (R() < .5 ? "f" : "m") : "m")((s.name || "").split(" ")[0]);
const PRON = { m: { he: "he", He: "He", him: "him", his: "his", His: "His", himself: "himself" }, f: { he: "she", He: "She", him: "her", his: "her", His: "Her", himself: "herself" } };
const pr = (s, k) => PRON[s && s.name ? sexOf(s) : "m"][k];
const STAFF_FIRST = ["Alan", "Brendan", "Carlos", "Dean", "Eddie", "Frank", "Gareth", "Harry", "Ivan", "Jens", "Kenny", "Luis", "Mick", "Nigel", "Oscar", "Pep", "Ronnie", "Sean", "Thomas", "Vincent", "Warren", "Zoltan", "Andy", "Bruno", "Claire", "Dani", "Emma", "Fiona", "Hannah", "Jo", "Kate", "Lucy", "Marta", "Nina", "Rachel", "Sam"];

/* What staff of a given reputation earn a year, tied to players' pay: a reputation belongs to a level of football (the
   divisions' standings), and a manager earns about what a star player there does.
   Heads of recruitment and youth managers earn the same as each other, 45% of a manager. */
const REP_LVL = [[0, 40], [11, 44], [20, 50], [28, 55], [36, 60], [45, 65], [58, 71], [78, 79], [99, 90]];
function repLevel(rep) { for (let i = 1; i < REP_LVL.length; i++) { const [a, x] = REP_LVL[i - 1], [b, y] = REP_LVL[i]; if (rep <= b) return x + (y - x) * (rep - a) / (b - a); } return 88; }
// Up to the Second Division a manager earns a little more than a star player; above that the stars pull away, until
// the very best manager earns about a third of what the best player in the world does.
// Non-league staff (a reputation below the Football League) are part-time: a manager earns about what a typical player
// there does, not a star; full-time pay comes in through the Third Division.
const partTime = rep => repLevel(rep) < 58;
/* Staff pay follows player pay. A reputation belongs to a level (Premier 78, First 58, Second 45, Third 36, National 28,
   North/South 20, Regional 11), and the going rate for a manager there is about 1.3x what an average starter at that
   level earns (a little less in the part-time lower leagues, and tapering at the very top so the best manager in the
   game earns about a third of the best player). Youth managers and heads of recruitment earn 45% of that. */
const REP_R200 = [[0, 0], [11, 20], [20, 40], [28, 50], [36, 60], [45, 70], [58, 100], [78, 130], [99, 170]];
const STAFF_PAYF = [[0, 1], [28, 1.15], [45, 1.3], [78, 1.3], [99, .52]];
const interpAt = (T, x) => { if (x <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) { const [a, u] = T[i - 1], [b, v] = T[i]; if (x <= b) return u + (v - u) * (x - a) / (b - a); } return T[T.length - 1][1]; };
/* Skill moves pay: against what's usual for his reputation (on the 200 scale), each 10 points better adds about a
   quarter, each 10 worse takes about a fifth off, between about half and double. */
const staffR200 = s => to20(staffEq(staffAvg(s))) * 10;
const skillPayF = (r200, rep) => clamp(Math.pow(1.25, (r200 - interpAt(REP_R200, clamp(rep, 0, 99))) / 10), .5, 2);
const staffMarket = s => staffWage(s.role, s.rep) * skillPayF(staffR200(s), s.rep);
function staffWage(role, rep) {
  const r = interpAt(REP_R200, clamp(rep, 0, 99)); let wk = 500000;
  for (let i = 1; i < PAY200.length; i++) { const [a, x] = PAY200[i - 1], [b, y] = PAY200[i]; if (r <= b) { wk = x * Math.pow(y / x, (r - a) / (b - a)); break; } }
  return Math.max(1000, Math.round(wk * 52 * interpAt(STAFF_PAYF, rep) * (role === "manager" ? 1 : .45) / 1000) * 1000);
}

/* Staff, like players: young coaches (a third are 26-35) start lower, being short of experience, but have more room to
   grow, the younger the more; now and then one is a real prospect. Older ones are what they are. */
function genStaff(role, rep) {
  const r = R(), age = r < .35 ? ri(26, 35) : r < .75 ? ri(36, 50) : ri(51, 66), green = Math.max(0, 38 - age);
  rep = Math.max(3, Math.round(rep - green * 1.0));
  const R0 = ROLES_STAFF[role], s = { role, name: pick(STAFF_FIRST) + " " + pick(pick([NAMES.ENG, NAMES.ENG, NAMES.ESP, NAMES.GER, NAMES.ITA, NAMES.NED, NAMES.SCA]).slice(1)[0]),
    age, rep, at: {}, phil: pick(Object.keys(R0.phil)), focus: pick(Object.keys(R0.focus)), trust: 60, yrs: 0, wage: 0 };
  for (const k of Object.keys(R0.attrs)) s.at[k] = clamp(rh(rep * .75 + 18 - green * .4 + normal() * 11), 5, 99);
  // Room to grow: under 40, from his best attribute up by (40 - age) x 0.8-2, plus a little luck; a rare prospect more.
  if (age < 40) { const top = Math.max(...Object.values(s.at)); s.ceil = clamp(rh(top + (40 - age) * rf(.8, 2) + Math.abs(normal()) * 8 + (R() < .04 ? 15 : 0)), top, 99); }
  if (role === "manager") s.form = pick(FORM_KEYS);
  s.demand = Math.round(staffMarket(s) * rf(.85, 1.2) / 1000) * 1000;
  s.tol = clamp(Math.round(15 + R() * 80), 5, 100);
  return s;
}
const staffOf = role => my() && my().staff[role];
const staffAttr = (role, k, dflt) => { const s = G && G.club != null ? staffOf(role) : null; return s ? s.at[k] : dflt; };
const staffAvg = s => Math.round(avg(Object.values(s.at)));

/* How attractive the job is: the club's standing, its facilities, and an owner with deep pockets. Staff with a bigger
   reputation than this want paying more to come, and the very best won't drop down at all. */
function attraction() {
  const c = my();
  return clamp(TIER_REP[c.tier] + c.rep * .3 + c.fac.train.lvl * 1.5 + c.fac.acad.lvl * .5 + Math.log10(Math.max(1, G.owner.wealth) / 1e6) * 3, 3, 100);
}
// What it takes to get him: see appeal.js. null means he won't come whatever you offer.
const askingWage = s => staffAsk(s);
const wontCome = s => staffAsk(s) == null;

function hire(s, wage, yrs) {
  const c = my(), cur = c.staff[s.role];
  if (cur && cur !== s) dismiss(s.role, true);
  const ask = staffAsk(s) || wage;
  if (s.emp != null) poachPay(s, s.compOffer);  // he was working elsewhere: his club gets compensation
  s.poached = G.year * 100 + G.week;  // nobody comes for a new appointment in his first year
  s.wage = wage; s.yrs = yrs; s.expiring = false; s.trust = clamp(60 + Math.round((wage / ask - 1) * 40), 40, 80); s.since = G.year; s.tlog = [];
  { const r = wage / ask; s.tbase = { t: s.trust, y: G.year, k: `When you hired ${pr(s, "him")}: ${r >= 1.05 ? `you paid ${Math.round((r - 1) * 100)}% over ${pr(s, "his")} asking` : r <= .95 ? `you paid ${Math.round((1 - r) * 100)}% under ${pr(s, "his")} asking` : `you paid ${pr(s, "his")} asking`} (60 is the usual start)` }; }
  c.staff[s.role] = s;
  hiredExPro(s);
  (G.filled ||= {})[s.role] = true; if (G.pools && G.pools[s.role]) G.pools[s.role].list = G.pools[s.role].list.filter(x => x !== s);
  news(`${s.name} is appointed ${ROLES_STAFF[s.role].l.toLowerCase()} on ${money(wage)} a year for ${yrs} year${yrs > 1 ? "s" : ""}.`, true);
  if (s.role === "manager") { c.form = s.form; if (G.phase === "season") newBounce(c); }
}
// Releasing staff early costs half their remaining contract.
const payoff = s => Math.round(s.wage * Math.max(0, s.yrs - (G.phase === "season" ? G.week / 46 : 0)) * .5);
function dismiss(role, quiet) {
  const c = my(), s = c.staff[role]; if (!s) return;
  const pay = payoff(s); spend("staff", pay);
  c.staff[role] = null;
  if (!quiet) news(`${s.name} leaves as ${ROLES_STAFF[role].l.toLowerCase()}${pay ? `, with ${money(pay)} compensation` : ""}.`, true);
}
/* Trust: how a staff member feels about working for you. Overruling them, starving their budgets or a poor run
   wears it down; below 20 they walk out. */
/* Openness to a hands-on owner (shown 1-20): how much an owner stepping in bothers him. High: he shrugs off your
   interventions; low: every one stings, and he's quicker to walk. It also decides how much a hands-on owner puts him
   off joining. */
const tolOf = s => s ? (s.tol ??= clamp(Math.round(15 + R() * 80), 5, 100)) : 50;
const tolF = s => 1.6 - tolOf(s) / 100 * 1.2;  // 5 → ×1.5, 50 → ×1.0, 95 → ×0.5
const tolWord = s => { const t = s20(tolOf(s)); return t >= 15 ? ["Welcomes it", "good"] : t >= 9 ? ["Fine with some", ""] : t >= 5 ? ["Wary", "warn"] : ["Wants full control", "bad"]; };
// Potential: what his average could still reach. His development ceiling, but only the young keep growing: under 40 fully,
// in his forties about half of it; from 50 he has peaked.
function staffPot(s) { const avgNow = staffAvg(s), room = Math.max(0, staffCeil(s) - Math.max(...Object.values(s.at))); return Math.round(avgNow + room * (s.age < 40 ? 1 : s.age < 50 ? .5 : 0)); }
/* Like a player's, a coach's potential is an estimate: a range, wider the more room he has left to grow and narrower
   once he works for you. Each person's error is fixed (s.pn) so the range holds still. Returns [low, high] on 0-100. */
function staffPotRange(s) {
  const avgNow = staffAvg(s), pot = staffPot(s); if (pot <= avgNow) return [avgNow, avgNow];
  s.pn ??= clamp(Math.round(normal() * 100) / 100, -2, 2);
  const mine = Object.values(my().staff || {}).includes(s), sd = Math.max(3, (pot - avgNow) * .4) * (mine ? .6 : 1);
  const est = clamp(pot + s.pn * sd * .6, avgNow, 99);
  return [Math.round(Math.max(avgNow, est - sd)), Math.round(Math.min(99, est + sd))];
}
const staffPot20 = s => { const [a, b] = staffPotRange(s).map(sr20); return a === b ? `${a}` : `${a}–${b}`; };
// A trust hit caused by you stepping in, scaled by his tolerance.
// A promise to leave him to it (made from his card) holds for the season: stepping in after it costs twice as much.
function meddled(role, d, why, k) { const s = staffOf(role); if (!s) return; const broke = d < 0 && s.promise === G.year;
  if (broke && !s.promiseBroken) { s.promiseBroken = true; news(`${s.name} reminds you that you promised to leave ${pr(s, "him")} to it.`, true); }
  trust(role, d < 0 ? d * tolF(s) * (broke ? 2 : 1) : d, why, broke ? "Breaking your promise not to interfere" : k); }
/* Why he feels as he does: every change to his trust is noted by cause, season by season (Staff → his tab). */
function trustNote(s, d, k) { if (!k || !d) return; const L = (s.tlog ||= []), e = L.find(x => x.y === G.year && x.k === k);
  if (e) { e.d += d; e.n++; } else L.push({ y: G.year, k, d, n: 1 }); if (L.length > 40) L.splice(0, L.length - 40); }
function trust(role, d, why, k) {
  const s = staffOf(role); if (!s) return;
  const t0 = s.trust; s.trust = clamp(s.trust + d, 0, 100); trustNote(s, s.trust - t0, k);
  if (why && Math.abs(d) >= 5) news(`${s.name} (${ROLES_STAFF[role].l.toLowerCase()}): ${why}`, d <= -8);
  if (s.trust < 20) { news(`${s.name} has resigned as ${ROLES_STAFF[role].l.toLowerCase()}, saying the club isn't run the way ${pr(s, "he")} was promised.`, true); my().staff[role] = null; }
}
// Grudges fade: a staff member's trust drifts back toward 60 a little each week.
function staffTrustWeek() { for (const s of Object.values(my().staff).filter(Boolean)) if (s.trust < 60) { const t0 = s.trust; s.trust = Math.min(60, s.trust + .3); trustNote(s, s.trust - t0, "Time: grudges fading"); } }
const trustWord = t => t >= 75 ? ["Loyal", "good"] : t >= 55 ? ["Content", "good"] : t >= 40 ? ["Uneasy", "warn"] : ["Unhappy", "bad"];

/* The caretaker: if you have no manager, the club captain picks the side. */
const CARETAKER = { name: "Caretaker (club captain)", at: { tac: 20, mot: 30, dev: 15 }, phil: "direct", focus: "results", form: "4-4-2" };
const mgr = () => staffOf("manager") || CARETAKER;

/* ---------- staff careers ----------
   Staff develop and decline like players. Each has a hidden ceiling. Under 40 they learn quickly, through their forties
   they level off, and from their late fifties they slip. A better environment helps: the training ground for a manager,
   the academy for a youth manager, the scouting budget for recruitment, and a higher division for everyone. From 60
   they may retire; nobody works past 70. */
function staffCeil(s) { return s.ceil ?? (s.ceil = clamp(rh(Math.max(...Object.values(s.at)) + Math.abs(normal()) * 12), 20, 99)); }
function ageStaff(s, env) {
  s.age++; s.prev = { ...s.at }; const ceil = staffCeil(s);
  for (const k of Object.keys(s.at)) {
    let d = s.age < 40 ? rf(.5, 3) : s.age < 50 ? rf(-.5, 1.5) : s.age < 57 ? rf(-1, .8) : -rf(.5, (s.age - 54) * .45);
    if (d > 0) d *= clamp((ceil - s.at[k]) / 15, 0, 1.2) * (.7 + env * .6);
    s.at[k] = clamp(rh(s.at[k] + d), 3, 99);
  }
  return s.age >= 70 || (s.age >= 60 && R() < (s.age - 59) * .1);
}
function staffSummer() {
  const c = my();
  for (const role of ["manager", "recruit", "youth"]) {
    const s = c.staff[role]; if (!s) continue;
    const env = role === "manager" ? c.fac.train.lvl / 10 : role === "youth" ? c.fac.acad.lvl / 10 : clamp(.5 + budgetFactor(c.budget.scout, scoutRef(c.tier)) / 6, 0, 1);
    const up = (7 - c.tier) * .04;
    if (ageStaff(s, clamp(env + up, 0, 1.2))) { c.staff[role] = null; news(`${s.name} retires as ${ROLES_STAFF[role].l.toLowerCase()} at ${s.age}. The job is vacant.`, true); continue; }
    { const t0 = s.trust; s.trust = clamp(s.trust + (visionMatch(s) - .5) * 12, 0, 100); trustNote(s, s.trust - t0, visionMatch(s) >= .5 ? "How the club is run: a good fit" : "How the club is run: a poor fit"); }
    s.rep = clamp(Math.round(s.rep + ((G.history[0] || {}).up ? 3 : 0) + (staffAvg(s) - s.rep * .75 - 18) * .1), 1, 99);
    const moved = Object.keys(s.at).map(k => s.at[k] - s.prev[k]).reduce((a, b) => a + b, 0);
    if (Math.abs(moved) >= 4) news(`${s.name} has ${moved > 0 ? "improved" : "declined"} over the season (${ROLES_STAFF[role].l.toLowerCase()}).`);
  }
  for (const U of Object.values(G.pools || {})) for (const s of U.list || []) s.age++;  // the staff universe ages too
  // Rival managers age and retire too.
  for (const x of G.clubs) { if (x.gone || isMine(x) || !x.coach) continue; const co = x.coach; co.age = (co.age || ri(36, 62)) + 1;
    co.tac = clamp(rh(co.tac + (co.age < 45 ? rf(0, 2) : co.age < 57 ? rf(-1, 1) : -rf(.5, 2.5))), 5, 99); co.dev = clamp(rh(co.dev + (co.age < 45 ? rf(0, 1.5) : co.age < 57 ? rf(-1, 1) : -rf(.5, 2))), 5, 99);
    if (co.age >= 70 || (co.age >= 60 && R() < (co.age - 59) * .1)) { x.coach = coachFor(x); if (x.lg === c.lg) news(`${x.name}'s manager ${co.name} retires. ${x.coach.name} replaces him.`); } }
}

/* ---------- your vision as owner ----------
   How you want the club run: a style of football, a way of recruiting, and ten points spread across six priorities.
   Staff whose ideas match it are keener to join and grow happier working for you; staff whose ideas clash slowly sour.
   Each point also brings a small, steady benefit in that area. */
const PRIORITIES = {
  results:    { l: "Winning now", d: "Dressing-room confidence: team morale settles about one point higher per point." },
  youth:      { l: "Youth development", d: "Each point raises the quality of academy intakes a little." },
  finance:    { l: "Sound finances", d: "Each point trims running costs by 2%; investors who want profits approve." },
  fans:       { l: "The supporters", d: "Each point lifts supporters' mood a little every week and warms the supporters' trust." },
  commercial: { l: "Commercial growth", d: "Each point adds about 2.5% to what sponsors offer." },
  facilities: { l: "Facilities", d: "Each point takes 2% off building costs." },
};
const VISION_POINTS = 10;
const vision = () => (G.owner.vision ||= { style: "any", recruit: "any", pri: { results: 2, youth: 2, finance: 2, fans: 2, commercial: 1, facilities: 1 } });
const vpt = k => G && G.owner ? (vision().pri[k] || 0) : 0;
// How well a member of staff's ideas fit yours, 0-1.
function visionMatch(s) {
  const v = vision(), P = v.pri;
  if (s.role === "manager") {
    const style = v.style === "any" ? .65 : s.phil === v.style ? 1 : .2;
    const focus = s.focus === "youth" ? .3 + P.youth * .17 : s.focus === "results" ? .3 + P.results * .17 : .6;
    return clamp(style * .6 + focus * .4, 0, 1);
  }
  if (s.role === "recruit") {
    const want = v.recruit !== "any" ? v.recruit : P.youth >= 3 ? "potential" : P.finance >= 3 ? "value" : P.results >= 3 ? "proven" : null;
    return want ? (s.phil === want ? 1 : s.phil === "fit" ? .5 : .25) : .65;
  }
  const local = s.focus === "local" ? .4 + P.fans * .1 + P.finance * .05 : .4 + P.youth * .1;
  return clamp(.3 + P.youth * .12 + local * .3, 0, 1);
}
const matchWord = m => m >= .75 ? ["Shares your vision", "good"] : m >= .5 ? ["Partly shares your vision", ""] : ["Different ideas from yours", "warn"];

/* The candidate pools: kept for six weeks rather than redrawn every time you look. A role you've never filled draws
   from a bigger pool (20); later searches find 12. */
/* The staff universe: well over a hundred people for each role, from part-timers to the best in the game, kept from
   week to week. Every six weeks some take jobs elsewhere or retire and new names come in. Whether one would join you
   is up to him (see appeal.js); there are always at least ten who would. */
const STAFF_UNIVERSE = 110;
function staffLevel() { const a = attraction(), r = R(); return clamp(Math.round(r < .45 ? a + normal() * 12 : r < .75 ? 3 + R() * Math.max(5, a) : a + R() * (95 - a)), 3, 95); }
// A club whose standing suits a reputation: where someone of that standing would be working.
function employerFor(rep) {
  const l = G.clubs.filter(x => (!x.gone || x.abroad) && !isMine(x) && Math.abs((x.abroad ? x.rep : TIER_REP[x.tier] + 6) - rep) < 10);
  return l.length ? pick(l).id : null;
}
// Other clubs' managers as candidates you could approach.
function coachCands() {
  return G.clubs.filter(x => (!x.gone || x.abroad) && !isMine(x) && x.coach).map(x => {
    const co = x.coach, rep = clamp(Math.round(x.abroad ? x.rep : TIER_REP[x.tier] + (co.tac - 50) / 4 + 6), 3, 95), m = genStaff("manager", rep);
    Object.assign(m, { name: co.name, age: co.age || m.age, phil: co.style, form: co.form, emp: x.id, coachOf: x.id });
    m.at.tac = co.tac; if (co.dev != null) m.at.dev = co.dev;
    return m;
  });
}
/* Poaching: what his club wants to let him go. A year or two of his wages, more for a bigger club and for its manager. */
const poachFee = s => { const x = CL(s.emp); return Math.round(s.demand * (1.2 + (x && x.abroad ? .5 : 0) + (s.coachOf != null ? .6 : 0) + Math.max(0, s.rep - 40) / 60) / 1000) * 1000; };
// The least their club will take: somewhere between two-thirds of the asking compensation and all of it (fixed per person).
const poachMin = s => s.compMin ??= Math.round(poachFee(s) * rf(.65, 1) / 1000) * 1000;
function poachPay(s, offer) {
  const x = CL(s.emp), fee = offer ?? poachFee(s); spend("staff", fee);
  if (s.coachOf != null && x && x.coach) { x.coach = coachFor(x); }
  news(`You pay ${x ? x.name : `${pr(s, "his")} club`} ${money(fee)} in compensation to bring ${s.name} in.`, true);
  const U = (G.pools || {})[s.role]; if (U && U.emp) U.emp = U.emp.filter(y => y !== s);
  s.emp = null; s.coachOf = null;
}
function candidates(role) {
  const P = (G.pools ||= {}), now = G.year * 100 + (G.phase === "summer" ? G.week : 10 + G.week);
  let U = P[role];
  if (!U || !U.u || U.u < 2) U = P[role] = { t: now, u: 2, list: [] };
  if (!U.pay3) { U.pay3 = true; for (const s of U.list) s.demand = Math.round(staffMarket(s) * rf(.85, 1.2) / 1000) * 1000; }  // older saves (and the 0.30 redraw: more young coaches)
  if (now - U.t >= 6 || U.list.length < STAFF_UNIVERSE) {
    if (now - U.t >= 6) U.list = U.list.filter(s => s.age < 68 && R() > .1);
    while (U.list.length < STAFF_UNIVERSE) U.list.push(genStaff(role, staffLevel()));
    const a = attraction(); let w = U.list.filter(s => !wontCome(s)).length;
    for (let k = 0; w < 10 && k < 60; k++) { const s = genStaff(role, clamp(Math.round(a - 4 - k / 3 - R() * 10), 3, 95)); U.list.push(s); if (!wontCome(s)) w++; }
    U.t = now;
  }
  // About a third of the universe is in work somewhere: you can approach them, but their club wants compensation.
  // Managers in work are the real managers of other clubs (refreshed with the universe).
  for (const s of U.list) if (s.emp === undefined) s.emp = role !== "manager" && R() < .3 ? employerFor(s.rep) : null;
  if (role === "manager" && (!U.empT || now - U.empT >= 6)) { U.emp = coachCands(); U.empT = now; }
  return [...exProCands(role), ...U.list, ...(role === "manager" ? U.emp || [] : [])];  // former players moving into coaching (your own favourites first), then everyone else
}

/* Putting it right, from his card. Each can be tried once a season: a talk (helps most when the grievance has stopped),
   a pay rise of 10% (on a contract that runs on), a promise to leave him to it for the rest of the season, and for the
   manager, handing team selection back to him (clears your "insist he starts" picks and your depth chart order). */
function staffMend(role, how) {
  const s = staffOf(role); if (!s) return; s.mend ||= {}; if (s.mend[how] === G.year) return;
  const recentBad = (s.tlog || []).filter(x => x.y === G.year && x.d < 0 && !/Time/.test(x.k)).reduce((a, x) => a + x.d, 0);
  if (how === "talk") { const d = Math.round((s.trust < 40 ? 7 : 5) * (recentBad < -10 ? .6 : 1) + rf(-1, 2)); trust(role, d, null, "Clearing the air with you"); news(`You sit down with ${s.name}. ${d >= 5 ? `It helps: ${pr(s, "he")} feels listened to.` : `${pr(s, "He")} appreciates it, but it'll take more than words.`}`); }
  if (how === "pay") { const old = s.wage; s.wage = Math.round(s.wage * 1.1 / 100) * 100; trust(role, 8, null, "Your pay rise"); news(`You give ${s.name} a pay rise: ${pw(old)} to ${pw(s.wage)}.`); }
  if (how === "promise") { s.promise = G.year; s.promiseBroken = false; trust(role, 6, null, "Your promise not to interfere"); news(`You promise ${s.name} you won't interfere this season. Break it and ${pr(s, "he")}'ll take it badly.`); }
  if (how === "hands") { const c = my(); let n = 0; for (const p of c.squad.map(P)) if (p.force) { p.force = false; n++; } if (G.depth && Object.keys(G.depth).length) { G.depth = {}; n++; }
    trust(role, n ? 5 : 1, null, "Handing team selection back"); news(`You leave team selection to ${s.name}${n ? ": your picks and your depth chart order are cleared" : ""}.`); }
  s.mend[how] = G.year;
}
