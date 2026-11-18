/* The boardroom: what the club is worth, who owns it, the directors who run the business side, the supporters'
   trust, bank loans, and the objectives you set each season. */
"use strict";

/* ---------- valuation ---------- */
function valuation(c = my()) {
  const S = c.fac.stadium, income = (c.finLast ? ledgerIncome(c.finLast) : TV[c.tier] + sponsorTotal(c) + matchdayForecast(c).gate * 23);
  const ground = S.own ? S.cap * perSeat(S.cap) * .6 + sum(Object.keys(S.vent || {}), k => VENTURES[k].cost(c) * .5) : 0;
  const facilities = (c.fac.train.lvl ? facCost("train", c.fac.train.lvl) * 1.4 : 0) + (c.fac.acad.lvl ? facCost("acad", c.fac.acad.lvl) * 1.4 : 0);
  const squad = sum(c.squad, id => valueOf(P(id))) * .7, brand = TV[c.tier] * 1.5 + c.fans * 400 * (1 + (c.media || 10) / 100);
  return Math.max(50000, Math.round((income * 1.2 + ground + facilities + squad + brand - debtOf() + Math.max(0, c.cash)) / 1e4) * 1e4);
}

/* ---------- investors ----------
   Sell part of the club for cash. You keep control while you own more than half. Investors judge you each summer;
   unhappy ones with a big enough stake can block big spending, and the ones who want out must be bought out or they
   sell to a rival owner. Private equity takes a dividend. */
const INVESTOR = {
  silent:    { l: "Silent partner", d: "Wants a quiet life and a return one day. Rarely complains.", prem: .95, temper: .4 },
  local:     { l: "Local business consortium", d: "Cares about the town: happy fans, a good name, community work.", prem: 1, temper: .8 },
  pe:        { l: "Private equity fund", d: "Pays a premium, takes a 4% dividend, and wants profits and higher prices.", prem: 1.2, temper: 1.4 },
  celebrity: { l: "Celebrity investor", d: "Brings the cameras: a bigger media profile. Wants success to be seen with.", prem: 1.05, temper: 1.1 },
  fans:      { l: "Supporters' trust", d: "The fans' own stake. Loyal, but watches ticket prices closely.", prem: 1, temper: .6 },
};
const ownPct = () => G.board ? G.board.own : 100;
function investmentOffers() {
  const v = valuation(), room = ownPct() - 51; if (room < 5) return [];
  return ["silent", "local", "pe", "celebrity"].sort(() => R() - .5).slice(0, 3).map(type => {
    const pct = Math.min(room, ri(5, type === "pe" ? 35 : 20));
    return { type, pct, amt: Math.round(v * pct / 100 * INVESTOR[type].prem * rf(.9, 1.1) / 1e4) * 1e4, name: type === "celebrity" ? nameFor(pick(ALL_NATS)) : pick(BRANDS) + " " + pick(OWNER_CORP) };
  });
}
function sellStake(o) {
  G.board.own -= o.pct; G.board.inv.push({ ...o, mood: 60, since: G.year });
  my().cash += o.amt; book("equity", o.amt);
  if (o.type === "celebrity") bumpMedia(10);
  news(`${o.name} (${INVESTOR[o.type].l.toLowerCase()}) buy ${o.pct}% of the club for ${money(o.amt)}. You keep ${G.board.own}%.`, true);
  G.board.offers = [];
}
const buyBackPrice = i => Math.round(valuation() * i.pct / 100 * 1.1 / 1e4) * 1e4;
function buyBack(idx) {
  const i = G.board.inv[idx], cost = buyBackPrice(i);
  G.owner.wealth -= cost; G.board.own += i.pct; G.board.inv.splice(idx, 1);
  news(`You buy back ${i.name}'s ${i.pct}% stake for ${money(cost)} of your own money.`, true);
}
function investorMood(type, d) { for (const i of (G.board || {}).inv || []) if (!type || i.type === type) i.mood = clamp(i.mood + d * (INVESTOR[i.type].temper), 0, 100); }
// Unhappy investors holding a quarter of the club between them can block big projects and big loans.
function boardBlocks(cost) {
  if (!G.board || cost < Math.max(500000, valuation() * .1)) return null;
  const angry = G.board.inv.filter(i => i.mood < 35), pct = sum(angry, i => i.pct);
  return pct >= 25 ? `The board won't approve it: ${angry.map(i => i.name).join(" and ")} (${pct}% between them) are unhappy with how the club is run.` : null;
}
function investorsSummer(report) {
  const B = G.board; if (!B) return;
  const f = my().finLast, profit = f ? ledgerIncome(f) - ledgerCosts(f) : 0;
  for (const i of B.inv) {
    let d = report.up ? 12 : report.down ? -15 : 0;
    d += (G.objRes || []).reduce((s, o) => s + (o.met ? 4 : -5), 0);
    if (i.type === "pe") d += (profit > 0 ? 6 : -8) + vpt("finance");
    if (i.type === "local" || i.type === "fans") d += (my().mood - 50) / 8;
    i.mood = clamp(i.mood + d * INVESTOR[i.type].temper * .6, 0, 100);
    if (i.type === "pe") { const div = Math.round(i.amt * .04); spend("dividend", div); news(`${i.name} take a ${money(div)} dividend.`); }
    if (i.mood < 20 && !G.inbox.some(m => m.key === "invExit" && !m.done && m.data.name === i.name))
      addChoice("invExit", `${i.name} want out`, `They'll sell their ${i.pct}% to a rival owner unless you buy them out for ${money(buyBackPrice(i))}.`, ["Buy them out", "Let them sell"], { name: i.name }, 1);
  }
}
DECIDE.invExit = (m, k) => {
  const B = G.board, idx = B.inv.findIndex(i => i.name === m.data.name); if (idx < 0) return;
  if (k === 0 && G.owner.wealth >= buyBackPrice(B.inv[idx])) return buyBack(idx);
  const i = B.inv[idx], st = pick(["stripper", "gambler", "meddler", "moneyball"]);
  i.name = newOwner(my(), st).name; i.type = "pe"; i.mood = 40; i.rival = st;
  news(`${m.data.name} sell their ${i.pct}% to ${i.name}, a ${OWNER_STYLES[st].l.toLowerCase()}. Expect a difficult boardroom.`, true);
};

/* ---------- directors ----------
   Business-side staff, each with a skill out of 100 (shown out of 20):
   finance (cheaper loans, lower running costs), commercial (better sponsors and merchandise), operations
   (cheaper, quicker building, a pitch that lasts). */
const DIRECTORS = {
  finance: { l: "Finance director", d: "Cheaper loans and lower running costs." },
  commercial: { l: "Commercial director", d: "Better sponsorship offers and merchandise sales." },
  ops: { l: "Operations director", d: "Cheaper, quicker building work and better pitch care." },
};
const dirSkill = k => G.board && G.board.dir[k] ? G.board.dir[k].skill : 0;
function directorCands(k) {
  const out = []; for (let i = 0; i < 5; i++) { const skill = Math.round(clamp(30 + normal() * 16 + (8 - my().tier) * 3, 8, 98) * 2) / 2; out.push({ role: k, name: nameFor("ENG"), age: ri(30, 60), skill, wage: Math.round(20000 * Math.pow(1.045, skill) * (1 + (7 - my().tier) * .25) / 1000) * 1000 }); }
  return out.sort((a, b) => b.skill - a.skill);
}
const dirWages = () => G.board ? sum(Object.values(G.board.dir).filter(Boolean), d => d.wage) : 0;
// Effects, each scaling with skill: up to 2.5 points off loan rates, 10% off upkeep, 20% on sponsors, 15% off building.
const loanCut = () => dirSkill("finance") / 100 * .025;
const upkeepMult = () => (1 - dirSkill("finance") / 1000) * (1 - vpt("finance") * .02);
const commMult = () => 1 + dirSkill("commercial") / 500;
const buildMult = () => 1 - dirSkill("ops") * .0015;
const wearMult = () => 1 - dirSkill("ops") * .003;

/* ---------- the supporters' trust ----------
   The organised fans. Membership grows with your support and how they feel about you. They make demands; give them a
   seat on the board and they're easier to live with; ignore them while the fans are angry and they protest. */
function trustRel(d, msg) { const T = G.sTrust; T.rel = clamp(T.rel + d, 0, 100); if (msg) news(msg); }
function trustWeek(c) {
  const T = G.sTrust; T.members = Math.round(c.fans * (.04 + T.rel / 500));
  if (vpt("fans")) { moodHit(c, vpt("fans") * .03); T.rel = clamp(T.rel + vpt("fans") * .02, 0, 100); }
  T.rel = clamp(T.rel + (c.mood - 50) * .02 + (T.seat ? .1 : 0), 0, 100);
  if (G.phase === "season" && c.mood < 30 && T.rel < 35 && R() < .2) { T.protest = 2; moodHit(c, -1); news(`Supporters protest outside the ground before the game. The trust says the club has stopped listening.`, true); bumpMedia(2); }
  if (T.protest) T.protest--;
  if (G.phase === "season" && R() < .06 && !G.inbox.some(m => m.key === "trustAsk" && !m.done)) trustDemand(c);
}
const TRUST_ASKS = [
  { k: "freeze", t: "Freeze ticket prices next season", d: "Prices can't go up next summer." },
  { k: "u18", t: "Half-price tickets for under-18s", d: "A little less at the gate; more young fans for the future." },
  { k: "fanzone", t: "Build a fan zone", d: c => c.fac.stadium.own ? `About ${money(VENTURES.fanzone.cost(c))} to build at the ground, then ${money(ventUp(c, "fanzone"))} a year to keep up. Fans love it: more atmosphere, more spending, more turnout.` : `You rent your ground, so it would be a pop-up you hire each home game: about ${money(-fzGame(c, FAN_T[c.tier], .5) > 0 ? -fzGame(c, FAN_T[c.tier], .5) : 0)} a game net at a typical crowd, for half the effect of a permanent one.`, cond: c => !has(c, "fanzone") && !c.fac.stadium.popup },
  { k: "accounts", t: "Publish the club's accounts", d: "Transparency. Private equity investors dislike it." },
  { k: "seat", t: "A seat on the board", d: "A trust director at board meetings.", cond: () => !G.sTrust.seat },
  { k: "stake", t: "Sell the trust a 5% stake", d: c => `They'd pay about ${money(valuation(c) * .05)}. A loyal shareholder.`, cond: () => ownPct() > 56 && G.sTrust.rel >= 55 },
];
function trustDemand(c) {
  const opts = TRUST_ASKS.filter(a => !a.cond || a.cond(c)); if (!opts.length) return;
  const a = pick(opts);
  addChoice("trustAsk", `The supporters' trust asks: ${a.t.toLowerCase()}`, typeof a.d === "function" ? a.d(c) : a.d, ["Agree", "Refuse"], { k: a.k }, 1);
}
DECIDE.trustAsk = (m, i) => {
  const c = my(), k = m.data.k;
  if (i === 1) { trustRel(-8); moodHit(c, -2); return; }
  trustRel(10); moodHit(c, 3);
  if (k === "freeze") G.sTrust.freeze = G.year + 1;
  if (k === "u18") { G.sTrust.u18 = true; }
  if (k === "fanzone") { if (c.fac.stadium.own) buildVenture("fanzone"); else { c.fac.stadium.popup = true; news("A pop-up fan zone will run at home games."); } moodHit(c, 4); }
  if (k === "accounts") investorMood("pe", -6);
  if (k === "seat") { G.sTrust.seat = true; news("A supporters' trust director joins the board.", true); }
  if (k === "stake") { const amt = Math.round(valuation(c) * .05 / 1e4) * 1e4; sellStake({ type: "fans", pct: 5, amt, name: `${c.town} Supporters' Trust` }); }
};
function meetTrust() { const T = G.sTrust; T.met = G.year; trustRel(6, "You meet the supporters' trust. They appreciate being heard."); }

/* ---------- loans ----------
   The bank lends against what the club is worth, at a rate set by the division, the debt you already carry and your
   finance director. Repaid weekly over the term; pay off early for a 2% fee. You can also lend the club your own
   money interest-free and take it back later. */
const debtOf = () => sum(G.loans || [], l => l.left);
function loanTerms(amt, years) {
  const v = valuation(), ratio = (debtOf() + amt) / v;
  const rate = Math.max(.02, .045 + my().tier * .004 + Math.max(0, ratio - .15) * .12 - loanCut());
  const n = years * 52, r = rate / 52, weekly = amt * r / (1 - Math.pow(1 + r, -n));
  return { amt, years, rate, weekly, max: Math.max(0, Math.round((v * (my().fac.stadium.own ? .45 : .3) - debtOf()) / 1e4) * 1e4) };
}
function takeLoan(amt, years) {
  const t = loanTerms(amt, years);
  (G.loans ||= []).push({ id: Date.now() % 1e9, amt, left: amt, rate: t.rate, weekly: t.weekly, years, y: G.year, lender: pick(["Northern Bank", "Crown Mutual", "Albion Credit", "Sterling Capital"]) });
  my().cash += amt; book("borrow", amt);
  news(`The club borrows ${money(amt)} over ${years} years at ${(t.rate * 100).toFixed(1)}%.`, true);
}
function loansWeek(c) {
  for (const l of G.loans || []) {
    const int = l.left * l.rate / 52, pay = Math.min(l.left + int, l.weekly);
    spend("interest", int); spend("repay", pay - int); l.left = Math.max(0, l.left - (pay - int));
  }
  G.loans = (G.loans || []).filter(l => l.left > 1);
  // The overdraft: a club deep in the red for two months goes into administration.
  const limit = Math.max(300000, (c.finLast ? ledgerIncome(c.finLast) : 300000) * .3);
  G.redWeeks = c.cash < -limit ? (G.redWeeks || 0) + 1 : 0;
  if (G.redWeeks === 6) news(`WARNING: the club is ${money(-c.cash)} overdrawn, beyond the bank's ${money(limit)} limit. Two more weeks and it goes into administration.`, true);
  if (G.redWeeks >= 8) myAdministration(c);
}
/* Stadium finance: big stadium projects can be part-paid with a long loan secured on the ground (a little cheaper
   than ordinary borrowing). The lender will finance up to the share you choose, as long as total debt stays within
   about 60% of what the club will be worth with the new ground. */
// Secured on the ground: judged against what the club will be worth with it, so a bit cheaper than ordinary borrowing.
const stadiumRate = (cost, amt) => Math.max(.02, .04 + my().tier * .004 + Math.max(0, (debtOf() + amt) / (valuation() + cost * .7) - .3) * .08 - loanCut());
const stadiumFinMax = cost => Math.max(0, Math.round(((valuation() + cost * .7) * .6 - debtOf()) / 1e4) * 1e4);
function stadiumLoan(cost, label) {
  const f = G.stFin || {}; if (!f.share || cost < 100000) return 0;
  const amt = Math.min(Math.round(cost * f.share / 1e4) * 1e4, stadiumFinMax(cost)); if (amt < 50000) return 0;
  const rate = stadiumRate(cost, amt), n = (f.years || 25) * 52, r = rate / 52;
  (G.loans ||= []).push({ id: Date.now() % 1e9, amt, left: amt, rate, weekly: amt * r / (1 - Math.pow(1 + r, -n)), years: f.years || 25, y: G.year, lender: "Stadium finance (" + pick(["Northern Bank", "Crown Mutual", "Albion Credit", "Sterling Capital"]) + ")", stadium: true });
  my().cash += amt; book("borrow", amt);
  news(`${money(amt)} of ${label} is financed over ${f.years || 25} years at ${(rate * 100).toFixed(1)}%.`, true);
  const ratio = debtOf() / Math.max(1, valuation() + cost * .7); if (ratio > .5) { investorMood(null, -Math.round((ratio - .5) * 20)); news(`The club's debts are now ${Math.round(ratio * 100)}% of what it's worth. Investors are uneasy.`, true); }
  return amt;
}
function repayLoan(id) { const l = G.loans.find(x => x.id === id); const cost = l.left * 1.02; spend("repay", cost); G.loans = G.loans.filter(x => x !== l); news(`You pay off the ${money(l.amt)} loan early (${money(cost)}).`); }
function ownerLend(amt) { amt = Math.min(amt, G.owner.wealth); G.owner.wealth -= amt; G.owner.lent = (G.owner.lent || 0) + amt; my().cash += amt; book("borrow", amt); news(`You lend the club ${money(amt)}, interest-free.`); }
function ownerRecall(amt) { amt = Math.min(amt, G.owner.lent || 0, Math.max(0, my().cash)); G.owner.wealth += amt; G.owner.lent -= amt; my().cash -= amt; book("repay", amt); news(`The club repays you ${money(amt)}.`); }
function myAdministration(c) {
  G.redWeeks = 0; c.admin = G.year;
  if (G.leagues[c.lg].tab && G.leagues[c.lg].tab[c.id]) G.leagues[c.lg].tab[c.id].pts -= 10;
  for (const r of ["manager", "recruit", "youth"]) trust(r, -15, null);
  moodHit(c, -20); investorMood(null, -25); bumpMedia(8);
  const sell = c.squad.map(P).filter(p => !p.acad).sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 2);
  for (const p of sell) sellToAI(p, false, Math.round(valueOf(p) * .7 / 1000) * 1000);
  c.cash = Math.min(c.cash + 0, c.cash); c.budget.transfer = 0;
  news(`ADMINISTRATION. ${c.name} are docked ten points, the administrators sell ${sell.map(p => p.name).join(" and ")}, and the transfer budget is frozen.`, true);
}

/* ---------- objectives ----------
   Set before the season starts. They're announced: ambitious targets excite the supporters now and hurt more if
   missed; meeting them pleases fans, staff and investors. The manager tells you if he thinks a target is unrealistic. */
const OBJ = {
  lg: { l: "League", opts: { title: "Win the league", up: "Win promotion", po: "Reach the play-offs", top: "Finish in the top half", safe: "Avoid relegation", none: "No target" } },
  cup: { l: "National Cup", opts: { win: "Win it", final: "Reach the final", qf: "Reach the quarter-finals", r3: "Reach the third round", tie: "Win a tie", none: "No target" } },
  fin: { l: "Finances", opts: { profit: "Make a profit", even: "Lose no more than 10% of income", none: "No target" } },
  youth: { l: "Youth", opts: { y3: "Three academy debuts", y1: "One academy debut", none: "No target" } },
};
// The finishing position each league target needs.
function lgTarget(k, lg) { const L = LEAGUES[lg], n = G.leagues[lg].clubs.length; return { title: 1, up: Math.max(1, L.auto), po: L.po ? L.po[1] : Math.max(1, L.auto), top: Math.floor(n / 2), safe: n - L.down, none: n }[k]; }
// Where the squad should finish: its rank by team rating in the division.
function expectedPos(c = my()) { const L = G.leagues[c.lg], s = id => avg(pickXI(CL(id)).map(o => roleRating(o.p, o.slot))); return L.clubs.map(id => [id, s(id)]).sort((a, b) => b[1] - a[1]).findIndex(x => x[0] === c.id) + 1; }
function setObjectives(o) {
  const c = my(); G.obj = { ...o, y: G.year, exp: expectedPos(c) };
  const tgt = lgTarget(o.lg, c.lg), stretch = G.obj.exp - tgt;  // places better than the squad suggests
  if (o.lg !== "none") { moodHit(c, clamp(stretch, -3, 6)); G.hype = Math.max(0, Math.round(stretch / 3)); }
  if (staffOf("manager") && stretch > 6) trust("manager", -6, `thinks "${OBJ.lg.opts[o.lg].toLowerCase()}" is unrealistic with this squad.`);
  else if (staffOf("manager") && o.lg !== "none" && stretch <= 0) trust("manager", 2, null);
  if (o.youth !== "none" && mgr().focus === "youth") trust("manager", 3, null);
  news(`You set the season's targets: ${Object.entries(o).filter(([, v]) => v !== "none").map(([k, v]) => OBJ[k].opts[v].toLowerCase()).join(", ") || "none"}.`, true);
}
function judgeObjectives(report) {
  const o = G.obj, c = my(); G.objRes = [];
  if (!o || o.y !== report.y) return;
  const res = (k, met) => { if (o[k] === "none") return; G.objRes.push({ k, t: OBJ[k].opts[o[k]], met }); };
  res("lg", report.pos <= lgTarget(o.lg, report.lg) || (o.lg === "up" && report.up) || (o.lg === "po" && report.po));
  // Judged by the furthest round the club played in (so a club with a first-round bye isn't asked for an extra round).
  const NC_ROUNDS = ["First round", "Second round", "Third round", "Fourth round", "Fifth round", "Quarter-finals", "Semi-finals", "Final"];
  const nc = G.cups && G.cups.NC, mine = nc ? nc.log.filter(x => x.h === c.id || x.a === c.id) : [], furthest = Math.max(-1, ...mine.map(x => NC_ROUNDS.indexOf(x.r)));
  res("cup", { win: !!nc && nc.win === c.id, final: furthest >= 7, qf: furthest >= 5, r3: furthest >= 2, tie: mine.some(x => x.w === c.id), none: true }[o.cup]);
  const f = c.finLast, net = f ? ledgerIncome(f) - ledgerCosts(f) + (f.build || 0) : 0;  // building work isn't counted against you
  res("fin", o.fin === "profit" ? net > 0 : net > -(f ? ledgerIncome(f) * .1 : 0));
  const debuts = c.squad.map(P).filter(p => p.age <= 21 && p.hist.length && p.hist[0][1] === c.short && p.debut === report.y).length;
  res("youth", debuts >= (o.youth === "y3" ? 3 : 1));
  const hype = G.hype || 0;
  for (const r of G.objRes) {
    if (r.met) { moodHit(c, r.k === "lg" ? 6 : 3); if (r.k === "lg") trust("manager", 5, null); }
    else { moodHit(c, -(r.k === "lg" ? 5 + hype * 2 : 2)); if (r.k === "lg") trust("manager", -4, null); }
  }
  if (G.objRes.length) addMsg({ type: "objectives", title: `Targets: ${G.objRes.filter(r => r.met).length} of ${G.objRes.length} met`, body: G.objRes.map(r => `${r.t}: ${r.met ? "met" : "missed"}`).join(". ") + "." });
  G.hype = 0;
}
