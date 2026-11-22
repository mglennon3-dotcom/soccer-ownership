/* Selling up and buying another club. Put your club up for sale (or get an unsolicited bid in the summer), take the
   money for your stake, then buy any club whose owner will sell. The world carries on: the club you sold gets its new
   owner's style, and the club you buy keeps its squad, staff, ground and debts become yours to manage. */
"use strict";

const BUYERS = ["sugar", "multiclub", "celebrity", "developer", "stripper", "moneyball", "crypto", "dynasty", "explayer", "gambler"];
function saleOffers() {
  const v = valuation(), stake = ownPct() / 100;
  return shuffle(BUYERS.slice()).slice(0, 3).map(style => ({ style, name: newOwner(my(), style).name, amt: Math.round(v * stake * rf(.85, 1.35) / 1e4) * 1e4, exp: 4 }));
}
// Unsolicited: now and then in the summer, someone wants to buy you out.
function bidForMyClub() {
  if (G.phase !== "summer" || G.week !== 3 || R() > .2 || G.history.length < 2) return;
  const o = saleOffers()[0];
  addChoice("takeover", `Takeover bid: ${money(o.amt)} for your ${ownPct()}%`, `${o.name}, a ${OWNER_STYLES[o.style].l.toLowerCase()}, wants to buy you out. ${OWNER_STYLES[o.style].d} You could then buy another club.`, ["Sell the club", "Not for sale"], o, 1);
}
DECIDE.takeover = (m, i) => { if (i === 0) sellMyClub(m.data); else moodHit(my(), 2); };

function sellMyClub(o) {
  const c = my();
  G.owner.wealth += o.amt + (G.owner.lent || 0); G.owner.lent = 0;
  (G.career ||= []).push({ club: c.name, from: c.ownedFrom ?? c.founded, to: G.year, sold: o.amt, by: o.name, tier: c.tier });
  news(`You sell ${c.name} to ${o.name} for ${money(o.amt)}.`, true);
  toAIClub(c, o);
  G.club = null; G.saleOffers = null;
  for (const m of G.inbox) if (!m.done && (m.type === "choice" || m.type === "bid")) { m.done = true; m.answer = "lapsed"; }
}
/* The club you leave becomes an ordinary AI club under its new owner. Loans and investors go with it. */
function toAIClub(c, o) {
  const m = c.staff.manager;
  c.coach = m ? { name: m.name, age: m.age, style: m.phil, form: m.form, tac: m.at.tac, dev: m.at.dev } : aiCoach(c.rep);
  c.cap = capacity(c); c.train = c.fac.train.lvl; c.acadLvl = c.fac.acad.lvl;
  c.own = newOwner(c, o.style); c.own.name = o.name; c.own.wealth = Math.max(c.own.wealth, o.amt * 3);
  c.lvl = clubStandard(c);
  for (const k of ["fac", "budget", "prices", "staff", "deals", "offers", "fin", "finLast", "att", "spentT", "ask", "cash"]) delete c[k];
}

/* What an AI club's owner wants for it. Some won't sell at any price. */
function aiValue(c) {
  const ground = c.cap * perSeat(c.cap) * .6, squad = sum(c.squad, id => valueOf(P(id))) * .7;
  return Math.round((TV[c.tier] * 1.5 + COMM_T[c.tier] + c.fans * 400 + ground + squad + (c.train + c.acadLvl) * 2e5) / 1e4) * 1e4;
}
const SELL_MULT = { local: 1.2, sugar: 1.7, stripper: .85, moneyball: 1.2, developer: 1.1, celebrity: 1.4, multiclub: 1.3, absentee: .8, gambler: .95, meddler: 1.25, academy: 1.15, dynasty: 1.5, crypto: .9, explayer: 1.3 };
const askPrice = c => SELL_MULT[c.own.style] ? Math.round(aiValue(c) * SELL_MULT[c.own.style] / 1e4) * 1e4 : null;  // supporter-owned and hostile owners won't sell

/* The club you buy becomes yours, as it stands: its squad, its manager (and new recruitment and youth staff of its
   standard), its ground, facilities and sponsors. */
function buyClub(c) {
  const price = askPrice(c); G.owner.wealth -= price;
  const rep = c.rep, old = c.own;
  Object.assign(c, {
    cash: Math.round(aiValue(c) * .05), mood: 55, morale: 55, media: (8 - c.tier) * 6, ownedFrom: G.year,
    prices: { ticket: REF_TICKET[c.tier], conc: REF_CONC[c.tier], shirt: REF_SHIRT[c.tier], suite: REF_SUITE[c.tier] },
    fac: { stadium: { own: true, name: `${c.town} Stadium`, cap: c.cap, amen: clamp(6 - c.tier, 1, 5), host: 0, build: null, suites: Math.floor(c.cap / 250 * (c.tier <= 2 ? .5 : .15)), pitch: 80, ptype: c.tier <= 2 ? "hybrid" : "grass", relay: null, heat: c.tier <= 3, vent: c.tier <= 2 ? { shop: { y: G.year }, park: { y: G.year } } : {} },
      train: { lvl: c.train, build: null }, acad: { lvl: c.acadLvl, build: null } },
    deals: [], offers: [], fin: newLedger(), finLast: null, spentT: 0, att: [],
    staff: { manager: null, youth: null, recruit: null },
  });
  c.budget = { wages: Math.round(wageBill(c) * 1.05), transfer: Math.round(TV[c.tier] * .3), acad: Math.round(acadRef(c.acadLvl)), scout: scoutRef(c.tier) };
  G.club = c.id; addHoney(c, "owner");
  // The manager stays; the other jobs are filled at the club's level.
  const m = genStaff("manager", rep); Object.assign(m, { name: c.coach.name, age: c.coach.age || m.age, phil: c.coach.style, form: c.coach.form, yrs: 2, trust: 55 });
  m.at.tac = c.coach.tac; m.at.dev = c.coach.dev; m.wage = staffWage("manager", rep); c.staff.manager = m;
  for (const r of ["recruit", "youth"]) { const s = genStaff(r, clamp(rep - 5, 3, 95)); s.wage = staffWage(r, s.rep); s.yrs = 2; c.staff[r] = s; }
  for (const slot of ["shirt", "kit", "sleeve", "stadium"]) { const L0 = makeOffers(slot), o = L0[1] || L0[0]; o.yrs = ri(1, 3); acceptOffer(o); }
  delete c.own; delete c.coach;
  G.board = { own: 100, inv: [], offers: [] }; G.sTrust = { rel: 50, members: 0, seat: false }; G.net = { partner: null, feeders: [] };
  G.loans = []; G.wary = 0; G.broken = []; G.obj = null; G.hype = 0; G.meddle = 0; G.myRes = []; G.redWeeks = 0;
  news(`You buy ${c.name} from ${old.name} for ${money(price)}. A new chapter begins in the ${LEAGUES[c.lg].name}.`, true);
}
