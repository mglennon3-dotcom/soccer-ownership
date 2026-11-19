/* The boardroom: what the club is worth, who owns it, the supporters'
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

/* The finance trust vision point (vpt) still trims upkeep; there are no directors any more. */
const loanCut = () => 0;
const upkeepMult = () => 1 - vpt("finance") * .02;
const commMult = () => 1;
const buildMult = () => 1;
const wearMult = () => 1;

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
   The bank lends against what the club is worth, at a rate set by the division and the debt you already carry.
   Repaid weekly over the term; pay off early for a 2% fee. You can also lend the club your own
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
   Set before the season starts and announced to the fans. Each target comes in four levels worked out from the club's
   situation (modest, fair, ambitious, hardest), like staff targets. What counts is the level set and the level reached:
   meeting a harder level lifts the club's standing (reputation) and brings in more new supporters; a missed target earns
   half the credit of the level it did reach, less a penalty for each level short. Finishing where the squad suggested
   (or better) is never a failure in the league. On top of the targets, finishing above or below where the squad suggests
   moves reputation and support too. */
const ORD = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const CUP_TXT = { 1: "Win a tie", 2: "Reach the third round", 3: "Reach the fourth round", 4: "Reach the fifth round", 5: "Reach the quarter-finals", 6: "Reach the semi-finals", 7: "Reach the final", 8: "Win it" };
// Cup levels by division (round reached: 1 = won a tie ... 8 = won it): the bigger the club, the further it's expected to go.
const cupLevels = t => t <= 2 ? [3, 4, 6, 8] : t <= 4 ? [2, 3, 5, 7] : [1, 2, 3, 5];
const OBJ = {
  lg: { l: "League", hi: false, txt: v => { const c = my(), L = LEAGUES[c.lg]; return `Finish ${ORD(v)} or better${v <= Math.max(1, L.auto) ? (v === 1 ? " (champions)" : " (promotion)") : L.po && v <= L.po[1] ? " (play-offs)" : v <= G.leagues[c.lg].clubs.length - L.down ? "" : ""}`; },
    // Around where the squad suggests (two places worse, one, four and eight better), four distinct places, never bottom.
    levels: (c, exp) => { const n = G.leagues[c.lg].clubs.length, v = [exp + 2, exp - 1, exp - 4, exp - 8];
      v[0] = Math.min(n - 1, v[0]); for (let i = 1; i < 4; i++) v[i] = Math.min(v[i - 1] - 1, v[i]);
      v[3] = Math.max(1, v[3]); for (let i = 2; i >= 0; i--) v[i] = Math.max(v[i + 1] + 1, v[i]); return v; } },
  cup: { l: "National Cup", show: () => CUP_DEF.NC.tiers.includes(my().tier), txt: v => CUP_TXT[v], levels: c => cupLevels(c.tier) },
  cup2: { l: () => my().tier <= 4 ? "League Cup" : "National Trophy", show: () => CUP_DEF[my().tier <= 4 ? "LC" : "TR"].tiers.includes(my().tier), txt: v => CUP_TXT[v], levels: c => cupLevels(c.tier) },
  eu: { l: () => euKey() ? CONT[euKey()].name : "Europe", show: () => !!euKey(), txt: v => ({ 1: "Get out of the group", 2: "Reach the quarter-finals", 3: "Reach the semi-finals", 5: "Win it" })[v], levels: () => [1, 2, 3, 5] },
  fin: { l: "Finances: the season's result", txt: v => v > 0 ? `A profit of ${v}% of income` : v === 0 ? "Break even" : `Lose no more than ${-v}% of income`, levels: () => [-20, -10, 0, 10] },
  wages: { l: "Finances: player wages", hi: false, txt: v => `Wages under ${v}% of income`, levels: () => [75, 65, 55, 45] },
  youth: { l: "Youth: academy debuts", txt: v => `${v} academy debut${v > 1 ? "s" : ""}`, levels: () => [1, 2, 3, 5] },
  grads: { l: "Youth: a graduate's league games", txt: v => `An academy graduate plays ${v} league games`, levels: c => { const n = (G.leagues[c.lg].clubs.length - 1) * 2; return [.2, .4, .6, .8].map(f => Math.round(n * f)); } },
};
const objLabel = k => typeof OBJ[k].l === "function" ? OBJ[k].l() : OBJ[k].l;
// The text of a set target (old saves stored option names).
const objText = (k, lv, o = G.obj) => typeof lv === "number" && lv && o && o.v && o.v[k] ? OBJ[k].txt(o.v[k][lv - 1]) || "No target" : typeof lv === "string" ? lv : "No target";
// The European competition you're in (or have qualified for) this season, if any.
function euKey() { const id = G.club;
  for (const [k, K] of Object.entries(G.cont || {})) if (K.teams && K.teams.includes(id) && G.phase !== "summer") return k;
  if (G.qual && G.qual.y === G.year) { if (G.qual.CC.includes(id)) return "CC"; if (G.qual.CS.includes(id)) return "CS"; }
  return null; }
// Where the squad should finish: its rank by team rating in the division.
function expectedPos(c = my()) { const L = G.leagues[c.lg], s = id => avg(pickXI(CL(id)).map(o => roleRating(o.p, o.slot))); return L.clubs.map(id => [id, s(id)]).sort((a, b) => b[1] - a[1]).findIndex(x => x[0] === c.id) + 1; }
function clubTargetLevels(c = my(), exp = expectedPos(c)) { return Object.fromEntries(Object.entries(OBJ).filter(([, D]) => !D.show || D.show()).map(([k, D]) => [k, D.levels(c, exp)])); }
// o: { key: level (0 = none) }.
function setObjectives(o) {
  const c = my(), exp = expectedPos(c), v = clubTargetLevels(c, exp);
  G.obj = { ...o, v, y: G.year, exp, debt0: debtOf(), tier: c.tier };
  const lgPos = o.lg ? v.lg[o.lg - 1] : null, stretch = lgPos ? exp - lgPos : 0;  // places better than the squad suggests
  if (lgPos) { moodHit(c, clamp(stretch, -3, 6)); G.hype = Math.max(0, Math.round(stretch / 3)); }
  if (staffOf("manager") && stretch > 6) trust("manager", -6, `thinks "${objText("lg", o.lg).toLowerCase()}" is unrealistic with this squad.`);
  else if (staffOf("manager") && lgPos && stretch <= 0) trust("manager", 2, null);
  if ((o.youth || o.grads) && mgr().focus === "youth") trust("manager", 3, null);
  news(`You set the season's targets: ${Object.keys(OBJ).filter(k => o[k]).map(k => objText(k, o[k]).toLowerCase()).join(", ") || "none"}.`, true);
}
// The furthest round a club reached in a domestic cup (0 = first round ... 7 = final), or -1 if it didn't play in it.
function cupFurthest(key, id) {
  const K = G.cups && G.cups[key], R = ["First round", "Second round", "Third round", "Fourth round", "Fifth round", "Quarter-finals", "Semi-finals", "Final"];
  const mine = K ? K.log.filter(x => x.h === id || x.a === id) : []; return { K, mine, far: Math.max(-1, ...mine.map(x => R.indexOf(x.r))) };
}
function cupMet(key, v, id) {
  const { K, mine, far } = cupFurthest(key, id);
  return { win: !!K && K.win === id, final: far >= 7, sf: far >= 6, qf: far >= 5, r5: far >= 4, r4: far >= 3, r3: far >= 2, tie: mine.some(x => x.w === id), none: true }[v];
}
// What the club achieved for each target, on the same scale as its levels.
function clubAchieved(c, report, o) {
  const { K, mine, far } = cupFurthest("NC", c.id), cupV = key => { const r = cupFurthest(key, c.id); if (!r.mine.length) return null; return r.K && r.K.win === c.id ? 8 : Math.max(r.far, r.mine.some(x => x.w === c.id) ? 1 : 0); };
  const EK = Object.values(G.cont || {}).find(K => K.teams && K.teams.includes(c.id)), euFar = EK ? Math.max(-1, ...EK.ko.map((R, i) => R.ties.some(t => t.h === c.id || t.a === c.id) ? i : -1)) : null;
  const f = c.finLast, inc = f ? ledgerIncome(f) : 0, net = f ? inc - ledgerCosts(f) + (f.build || 0) : 0;  // building work isn't counted against you
  const debuts = c.squad.map(P).filter(p => p.age <= 21 && p.hist.length && p.hist[0][1] === c.short && p.debut === report.y).length;
  return {
    lg: report.up ? Math.min(report.pos, Math.max(1, LEAGUES[report.lg].auto)) : report.pos,
    cup: cupV("NC"), cup2: cupV((o.tier || c.tier) <= 4 ? "LC" : "TR"),
    eu: EK ? (EK.win === c.id ? 5 : euFar + 1) : null,
    fin: inc ? Math.round(net / inc * 100) : 0, wages: inc && f ? Math.round(f.wages / inc * 100) : 100,
    youth: debuts, grads: Math.max(0, ...c.squad.map(P).filter(p => p.yAcad === c.id && !p.acad).map(p => p.s.app || 0)),
  };
}
// Old saves stored option names: map them onto levels.
const OLD_LV = { lg: { title: 4, up: 4, po: 3, top: 2, safe: 1 }, cup: { win: 4, final: 4, sf: 3, qf: 3, r5: 2, r4: 2, r3: 1, tie: 1 }, fin: { big: 4, profit: 3, even: 2, loss20: 1, rule: 1, wages: 1, debt: 1 }, youth: { y5: 4, y3: 3, y2: 2, y1: 1, reg: 1, sale: 1 } };
function judgeObjectives(report) {
  const o = G.obj, c = my(); G.objRes = [];
  G.sLast = staffProgress(c);  // last season's figures, shown when you set next season's staff targets
  if (!o || o.y !== report.y) { judgeStaffObjectives(null); return; }
  if (!o.v) { for (const k of Object.keys(o)) if (OLD_LV[k]) o[k] = OLD_LV[k][o[k]] || 0; o.cup2 = 0; o.eu = 0; o.v = clubTargetLevels(c, o.exp || report.pos); }
  const got = clubAchieved(c, report, o), d = (o.exp || report.pos) - report.pos;
  let rep = 0, fans = 0;
  for (const k of Object.keys(OBJ)) {
    const lv = o[k]; if (!lv || !o.v[k] || got[k] == null) continue;  // no target, or not in that cup
    const vals = o.v[k], hi = OBJ[k].hi !== false, now = got[k], reached = vals.filter(x => hi ? now >= x : now <= x).length, met = reached >= lv;
    let score = met ? LVL_SCORE[lv] : LVL_SCORE[reached] * .5 - .35 * (lv - reached);
    let t = objText(k, lv);
    if (k === "lg" && !met && d >= 0) { score = Math.max(0, score); t += " (but no worse than the squad suggested)"; }
    G.objRes.push({ k, t, lv, met, reached, score });
    moodHit(c, Math.round(score * 6)); rep += score * 1.5; fans += score * .04;
    if (k === "lg") trust("manager", met ? 5 : d >= 0 ? 0 : -4, null);
  }
  // Beating (or falling short of) what the squad suggested.
  rep += clamp(d * .4, -3, 3); fans += clamp(d * .006, -.03, .04);
  const before = c.fans; c.rep = clamp(Math.round((c.rep + rep) * 10) / 10, 1, 99); c.fans = Math.max(50, Math.round(c.fans * (1 + fans)));
  const dF = c.fans - before, why = `${d > 0 ? `finishing ${d} place${d > 1 ? "s" : ""} above` : d < 0 ? `finishing ${-d} place${d < -1 ? "s" : ""} below` : "finishing where"} the squad suggested`;
  if (G.objRes.length) addMsg({ type: "objectives", title: `Targets: ${G.objRes.filter(r => r.met).length} of ${G.objRes.length} met`, body: G.objRes.map(r => `${r.t} (${LVL_NAME[r.lv].toLowerCase()}): ${r.met ? "met" : "missed"}${r.reached > r.lv ? `, reaching the ${LVL_NAME[r.reached].toLowerCase()} level` : ""}`).join(". ") + `. With ${why}, the club's standing ${rep >= .05 ? `rises (+${rep.toFixed(1)} prestige)` : rep <= -.05 ? `falls (${rep.toFixed(1)} prestige)` : "holds steady"} and the support ${dF >= 0 ? `grows by ${dF.toLocaleString("en-GB")}` : `shrinks by ${(-dF).toLocaleString("en-GB")}`}.` });
  G.hype = 0; judgeStaffObjectives(o.exp ? d : null);
}
/* ---------- staff targets ----------
   Set in week 1 of pre-season, each one optional. Every target comes in four levels worked out from the club's
   situation: modest, fair, ambitious and hardest. What counts is the level you set and the level reached: meeting a
   harder target is rewarded more (the hardest most of all), and falling short costs more the further short of it you
   finish. Measured over the season; recruitment counts every signing and sale this season.
     Manager: the top scorer's goals, league goals, league clean sheets, the top assister's assists, minutes for under-21s, and the squad's
       total growth (shown rating points gained by the players here at the start of the season).
     Head of recruitment: a player for a chosen position rated at least a level; an under-21 with potential of at least
       a level; total player sales.
     Youth manager: a new academy player with potential of at least a level; one academy player's growth; the academy's
       average growth. */
const LVL_NAME = ["No target", "Modest", "Fair", "Ambitious", "Hardest"];
function staffTargetLevels(c = my()) {
  const n = Math.max(1, (G.leagues[c.lg].clubs.length - 1) * 2);
  // Ratings scaled to your division: its starting players' 25th percentile, median, 75th and 90th (shown, each a step up).
  const xs = G.leagues[c.lg].clubs.flatMap(id => pickXI(CL(id)).map(o => to20(o.p.ovr))).sort((a, b) => a - b), q = f => xs.length ? xs[Math.min(xs.length - 1, Math.floor(f * xs.length))] : 10;
  const ladder = (fs, add = 0) => { const out = []; for (const f of fs) out.push(clamp(Math.max(Math.round(q(f)) + add, out.length ? out[out.length - 1] + 1 : 1), 1, 20)); return out; };
  const inc = c.finLast ? ledgerIncome(c.finLast) : TV[c.tier] + COMM_T[c.tier], r = v => Math.round(v);
  return {
    manager: { top: ["Top scorer's goals", [10, 15, 20, 30]], goals: ["League goals", [n * 1.1, n * 1.3, n * 1.55, n * 1.85].map(r)], cs: ["League clean sheets", [n * .2, n * .27, n * .35, n * .45].map(r)],
      assists: ["Top assister's assists", [6, 10, 14, 20]], ymin: ["Minutes for under-21s", [n * 90 * 1.5, n * 90 * 3, n * 90 * 5, n * 90 * 7].map(v => Math.round(v / 100) * 100)], grow: ["Squad growth (rating points, total)", [2, 4, 6, 9]] },
    recruit: { pos: ["Sign a player for the position, rated at least", ladder([.25, .5, .75, .9])], u21: ["Sign an under-21 with potential of at least", ladder([.5, .75, .9, .97])],
      sales: ["Player sales of at least", [.02, .05, .1, .2].map(f => Math.round(inc * f / 1e4) * 1e4)] },
    youth: { find: ["A new academy player with potential of at least", ladder([.25, .5, .75, .9])], one: ["One academy player grows by (points)", [1, 1.5, 2.5, 4]], avg: ["Academy average growth (points)", [.3, .6, 1, 1.5]] },
  };
}
// Staff targets can be set in week 1 of pre-season (and, the summer they arrived, any week of it).
const staffTargetsOpen = () => G.phase === "summer" && (G.week === 0 || G.sgrace === G.year);
const mins = p => ((p.s.app || 0) - (p.s.sub || 0)) * 90 + (p.s.sub || 0) * 25;
function staffProgress(c = my()) {
  const S = G.sobj || {}, y = G.year, base = S.base || {}, lg = (G.myRes || []).filter(r => r.comp === c.lg), sq = c.squad.map(P).filter(Boolean);
  const ins = (G.tlog || []).filter(m => m.kind === "in" && m.y === y), outs = (G.tlog || []).filter(m => m.kind === "out" && m.y === y);
  const gain = p => base[p.id] != null ? to20(p.ovr) - to20(base[p.id]) : null;
  const acad = sq.filter(p => p.acad || p.yAcad === c.id), ag = acad.map(gain).filter(v => v != null), r1 = v => Math.round(v * 10) / 10;
  const pos = S.recruit && S.recruit.posK;
  return {
    manager: { top: Math.max(0, ...sq.map(p => p.s.g || 0)), goals: sum(lg, r => r.gf), cs: lg.filter(r => r.ga === 0).length, assists: Math.max(0, ...sq.map(p => p.s.a || 0)), ymin: sum(sq.filter(p => p.age <= 21), mins),
      grow: r1(sum(sq.filter(p => !p.acad), p => Math.max(0, gain(p) || 0))) },
    recruit: { pos: Math.max(0, ...ins.filter(m => !pos || m.pos === pos).map(m => m.r || 0)), u21: Math.max(0, ...ins.filter(m => m.age <= 20 && G.players[m.id]).map(m => r20(G.players[m.id].pot))), sales: sum(outs, m => m.fee || 0) },
    youth: { find: Math.max(0, ...acad.filter(p => base[p.id] == null).map(p => r20(p.pot))), one: r1(Math.max(0, ...ag)), avg: ag.length ? r1(avg(ag)) : 0 },
  };
}
// Each set target: { role, k, label, lv (set), v (the four level values), now, got (level reached), met }.
function staffTargets(c = my()) {
  const S = G.sobj; if (!S || S.y !== G.year) return [];
  const now = staffProgress(c), out = [];
  for (const role of ["manager", "recruit", "youth"]) for (const [k, T] of Object.entries(S[role] || {})) {
    if (!T || !T.lv || !T.v) continue; const v = now[role][k], got = T.v.filter(x => v >= x).length;
    out.push({ role, k, label: T.label + (k === "pos" && S.recruit.posK ? ` (${POS_NAME[S.recruit.posK].toLowerCase()})` : ""), lv: T.lv, v: T.v, now: v, got, met: got >= T.lv });
  }
  return out;
}
// One member of staff's targets (the others' stay as they are). Growth is measured from the first targets set this season.
function setStaffObjectives(role, T) {
  const c = my(), S = G.sobj && G.sobj.y === G.year ? G.sobj : { y: G.year, base: Object.fromEntries(c.squad.map(P).filter(Boolean).map(p => [p.id, p.ovr])) };
  S[role] = T; G.sobj = S;
  const n = staffTargets(c).filter(t => t.role === role).length, s = staffOf(role); if (n && s) news(`You set ${n} target${n > 1 ? "s" : ""} for ${s.name} this season.`, true);
}
const fmtT = (k, v) => k === "sales" ? money(v) : v;
function judgeStaffObjectives(d) {
  const list = staffTargets();
  staffSeasonVerdict(list, d);
  if (!list.length) return;
  for (const t of list) if (staffOf(t.role)) trust(t.role, t.met ? 2 + t.lv : -2 - Math.min(3, t.lv - t.got), null);
  addMsg({ type: "objectives", title: `Staff targets: ${list.filter(t => t.met).length} of ${list.length} met`, body: list.map(t => `${ROLES_STAFF[t.role].l}: ${t.label} ${fmtT(t.k, t.v[t.lv - 1])} (${LVL_NAME[t.lv].toLowerCase()}): ${fmtT(t.k, t.now)}, ${t.met ? "met" : "missed"}${t.got > t.lv ? `, beating the ${LVL_NAME[t.got].toLowerCase()} level` : ""}`).join(". ") + "." });
}
/* How each member of staff's season went, from -1 (awful) to +1 (tremendous). A met target scores by its level (modest
   .25, fair .45, ambitious .7, hardest 1); a missed one earns half the score of the level it did reach, less .35 for
   each level short (so falling one short of the hardest scores about nothing, and reaching nothing is the worst). For the manager, the
   league finish against where the squad suggested counts too (six places either way is the top or bottom). Skills and
   ceiling move on a curve: up to about two shown points for a tremendous season, as far down for an awful one. */
const LVL_SCORE = [0, .25, .45, .7, 1];
function staffSeasonVerdict(list, d) {
  for (const role of ["manager", "recruit", "youth"]) {
    const s = staffOf(role); if (!s || !s.at) continue;
    const parts = list.filter(t => t.role === role).map(t => t.met ? LVL_SCORE[t.lv] : LVL_SCORE[t.got] * .5 - .35 * (t.lv - t.got));
    if (role === "manager" && d != null) parts.push(clamp(d / 6, -1, 1));
    if (!parts.length) continue;
    const score = clamp(avg(parts), -1, 1); if (Math.abs(score) < .15) continue;
    const shift = Math.sign(score) * Math.pow(Math.abs(score), 1.4) * 1.5;  // up to about 2 points on the shown 20 scale
    const before = staffAvg(s);
    for (const k of Object.keys(s.at)) s.at[k] = staffShift(s.at[k], shift * rf(.7, 1.3));
    s.ceil = Math.max(staffShift(staffCeil(s), shift * 1.2), Math.max(...Object.values(s.at)));
    const word = score >= .7 ? "a tremendous season" : score >= .35 ? "a very good season" : score > 0 ? "a good season" : score <= -.7 ? "an awful season" : score <= -.35 ? "a poor season" : "a disappointing season";
    const a = sr20(before), b = sr20(staffAvg(s));
    news(`${s.name} (${ROLES_STAFF[role].l.toLowerCase()}) had ${word}: ${a === b ? `ratings edge ${shift > 0 ? "up" : "down"}` : `ratings ${shift > 0 ? "rise" : "fall"} from ${a} to ${b}`}, ${shift > 0 ? "with more room to grow" : "with a lower ceiling"}.`, true);
  }
}
// A staff skill (0-100) moved by a number of points on the shown 20 scale.
function staffShift(v, d) { const want = to20(staffEq(v)) + d; let lo = 1, hi = 99; for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (to20(staffEq(mid)) < want) lo = mid; else hi = mid; } return clamp(Math.round((lo + hi) / 2), 1, 99); }
