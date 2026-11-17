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
  for (const k of Object.keys(R0.attrs)) s.at[k] = clamp(Math.round(rep * .75 + 18 + normal() * 11), 5, 99);
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

/* Candidates: a fresh list each time you look, centred on the level the job attracts, with a few long shots. */
function candidates(role) {
  const a = attraction(), out = [];
  for (let i = 0; i < 9; i++) out.push(genStaff(role, clamp(Math.round(a + (i < 6 ? normal() * 8 : 15 + R() * 30)), 3, 95)));
  return out.sort((x, y) => staffAvg(y) - staffAvg(x));
}
function hire(s, wage, yrs) {
  const c = my(), cur = c.staff[s.role];
  if (cur && cur !== s) dismiss(s.role, true);
  const ask = staffAsk(s) || wage;
  s.wage = wage; s.yrs = yrs; s.expiring = false; s.trust = clamp(60 + Math.round((wage / ask - 1) * 40), 40, 80); s.since = G.year;
  c.staff[s.role] = s;
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
