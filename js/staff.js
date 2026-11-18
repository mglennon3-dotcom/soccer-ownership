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
    phil: STYLES, focus: { youth: "Gives young players a chance", results: "Picks his strongest side every week", balanced: "Balances results and development" } },
  youth: { l: "Youth manager", attrs: { dev: "Youth development", judge: "Judging potential", reach: "Youth scouting" },
    phil: { technical: { l: "Technical", d: "Brings through ball players: passing, technique, vision." }, physical: { l: "Physical", d: "Brings through athletes: pace, strength, stamina." }, balanced: { l: "Balanced", d: "No particular type." } },
    focus: { local: "Local talent: cheap, homegrown, a smaller pool", wide: "Searches nationally and abroad: a bigger pool, costs more" } },
  recruit: { l: "Head of recruitment", attrs: { judge: "Judging ability", neg: "Negotiation", net: "Contacts" },
    phil: { potential: { l: "Youth & potential", d: "Buys young players to develop and sell on." }, proven: { l: "Proven quality", d: "Buys experienced players who help now." },
      value: { l: "Value for money", d: "Hunts bargains: the most rating per euro." }, fit: { l: "Fit the manager", d: "Buys players suited to the manager's style." } },
    focus: { domestic: "England only", europe: "England and Europe", world: "Worldwide" } },
};
const STAFF_FIRST = ["Alan", "Brendan", "Carlos", "Dean", "Eddie", "Frank", "Gareth", "Harry", "Ivan", "Jens", "Kenny", "Luis", "Mick", "Nigel", "Oscar", "Pep", "Ronnie", "Sean", "Thomas", "Vincent", "Warren", "Zoltan", "Andy", "Bruno", "Claire", "Dani", "Emma", "Fiona", "Hannah", "Jo", "Kate", "Lucy", "Marta", "Nina", "Rachel", "Sam"];

function staffWage(role, rep) { const w = 15000 * Math.pow(1.075, rep) * (role === "manager" ? 1 : .4); return Math.round(w / 1000) * 1000; }
function genStaff(role, rep) {
  const R0 = ROLES_STAFF[role], s = { role, name: pick(STAFF_FIRST) + " " + pick(pick([NAMES.ENG, NAMES.ENG, NAMES.ESP, NAMES.GER, NAMES.ITA, NAMES.NED, NAMES.SCA]).slice(1)[0]),
    age: ri(32, 64), rep, at: {}, phil: pick(Object.keys(R0.phil)), focus: pick(Object.keys(R0.focus)), trust: 60, yrs: 0, wage: 0 };
  for (const k of Object.keys(R0.attrs)) s.at[k] = clamp(rh(rep * .75 + 18 + normal() * 11), 5, 99);
  if (role === "manager") s.form = pick(FORM_KEYS);
  s.demand = Math.round(staffWage(role, rep) * rf(.85, 1.2) / 1000) * 1000;
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
  s.wage = wage; s.yrs = yrs; s.expiring = false; s.trust = clamp(60 + Math.round((wage / ask - 1) * 40), 40, 80); s.since = G.year;
  c.staff[s.role] = s;
  hiredExPro(s);
  (G.filled ||= {})[s.role] = true; if (G.pools && G.pools[s.role]) G.pools[s.role].list = G.pools[s.role].list.filter(x => x !== s);
  news(`${s.name} is appointed ${ROLES_STAFF[s.role].l.toLowerCase()} on ${money(wage)} a year for ${yrs} year${yrs > 1 ? "s" : ""}.`, true);
  if (s.role === "manager") c.form = s.form;
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
function trust(role, d, why) {
  const s = staffOf(role); if (!s) return;
  s.trust = clamp(s.trust + d, 0, 100);
  if (why && Math.abs(d) >= 5) news(`${s.name} (${ROLES_STAFF[role].l.toLowerCase()}): ${why}`, d <= -8);
  if (s.trust < 20) { news(`${s.name} has resigned as ${ROLES_STAFF[role].l.toLowerCase()}, saying the club isn't run the way he was promised.`, true); my().staff[role] = null; }
}
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
    s.trust = clamp(s.trust + (visionMatch(s) - .5) * 12, 0, 100);
    s.rep = clamp(Math.round(s.rep + ((G.history[0] || {}).up ? 3 : 0) + (staffAvg(s) - s.rep * .75 - 18) * .1), 1, 99);
    const moved = Object.keys(s.at).map(k => s.at[k] - s.prev[k]).reduce((a, b) => a + b, 0);
    if (Math.abs(moved) >= 4) news(`${s.name} has ${moved > 0 ? "improved" : "declined"} over the season (${ROLES_STAFF[role].l.toLowerCase()}).`);
  }
  for (const [k, d] of Object.entries((G.board || {}).dir || {})) { if (!d) continue; d.age = (d.age || ri(35, 55)) + 1; if (d.age >= 68 || (d.age >= 60 && R() < .12)) { G.board.dir[k] = null; news(`${d.name} retires as ${DIRECTORS[k].l.toLowerCase()}.`, true); } else d.skill = clamp(rh(d.skill + (d.age < 45 ? rf(0, 2) : d.age < 56 ? rf(-.5, 1) : -rf(.5, 2))), 5, 99); }
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
function candidates(role) {
  const P = (G.pools ||= {}), now = G.year * 100 + (G.phase === "summer" ? G.week : 10 + G.week);
  let U = P[role];
  if (!U || !U.u) U = P[role] = { t: now, u: 1, list: [] };  // older saves: the universe starts now
  if (now - U.t >= 6 || U.list.length < STAFF_UNIVERSE) {
    if (now - U.t >= 6) U.list = U.list.filter(s => s.age < 68 && R() > .1);
    while (U.list.length < STAFF_UNIVERSE) U.list.push(genStaff(role, staffLevel()));
    const a = attraction(); let w = U.list.filter(s => !wontCome(s)).length;
    for (let k = 0; w < 10 && k < 60; k++) { const s = genStaff(role, clamp(Math.round(a - 4 - k / 3 - R() * 10), 3, 95)); U.list.push(s); if (!wontCome(s)) w++; }
    U.t = now;
  }
  return [...exProCands(role), ...U.list];  // former players moving into coaching (your own favourites first), then everyone else
}
