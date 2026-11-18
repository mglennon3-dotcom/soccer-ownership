/* The business: matchday income, prices, sponsors, budgets, facilities and your own money. */
"use strict";

function news(t, hi) { G.news.unshift({ t, hi: !!hi, y: G.year, w: whenLabel() }); if (G.news.length > 200) G.news.length = 200; }
const whenLabel = () => G.phase === "summer" ? `Pre-season wk ${G.week + 1}` : G.phase === "playoffs" ? "Play-offs" : `Wk ${G.week + 1}`;
const seasonLabel = y => `${y}–${String((y + 1) % 100).padStart(2, "0")}`;
function book(k, amt) { const c = my(); c.fin[k] = (c.fin[k] || 0) + amt; }
function earn(k, amt) { my().cash += amt; book(k, amt); }
function spend(k, amt) { my().cash -= amt; book(k, amt); }
function invest(amt, quiet) {
  amt = Math.round(Math.min(amt, G.owner.wealth)); if (amt <= 0) return;
  G.owner.wealth -= amt; G.owner.invested += amt; my().cash += amt; book("invest", amt);
  if (!quiet) news(`You put ${money(amt)} of your own money into the club.`);
}
function withdraw(amt) {
  amt = Math.round(Math.min(amt, Math.max(0, my().cash))); if (amt <= 0) return;
  G.owner.wealth += amt; my().cash -= amt; book("invest", -amt);
  news(`You take ${money(amt)} out of the club.`);
}

/* ---------- reference prices by tier (what supporters expect to pay) ---------- */
const REF_TICKET = [0, 55, 32, 25, 21, 17, 12, 8];
const REF_CONC = [0, 6, 5, 4.5, 4, 3.5, 3, 2.5];
const REF_SHIRT = [0, 80, 65, 58, 52, 48, 44, 40];
const TV = [0, 110e6, 9e6, 1.6e6, 1e6, 120e3, 45e3, 8e3];  // central money per season
const PRIZE_TOP = [0, 40e6, 2e6, 400e3, 200e3, 60e3, 20e3, 6e3];  // merit money for finishing top; scales down the table

/* ---------- grounds ---------- */
// Grounds you can rent. Rent is per home game.
const HOSTS = [
  { name: "the town Recreation Ground", cap: 1200, rent: 600, amen: 1 },
  { name: "a ground-share with a neighbouring club", cap: 3500, rent: 2500, amen: 2 },
  { name: "a ground-share at a Football League stadium", cap: 9000, rent: 9000, amen: 3 },
  { name: "a ground-share at a Premier Division stadium", cap: 30000, rent: 45000, amen: 4 },
];
/* Where you play. Without a ground of your own you rent one (S.host). With one, you play there unless you've moved out
   to a bigger rented ground for a while (S.away), for more seats while yours is too small. */
const atHome = c => c.fac.stadium.own && c.fac.stadium.away == null;
function setGround(c, i) {
  const S = c.fac.stadium;
  if (S.own) S.away = i === "home" ? null : i; else S.host = i;
  c.cap = capacity(c);
}
const ground = c => atHome(c) ? { name: c.fac.stadium.name || `${c.town} Park`, cap: groundCap(c), amen: c.fac.stadium.amen, rent: 0 } : HOSTS[c.fac.stadium.own ? c.fac.stadium.away : c.fac.stadium.host];
const capacity = c => ground(c).cap;
// New stadium: cost per seat rises with size (bigger stands, more seats, more cover).
const perSeat = cap => 650 + cap * .055;
const BUILD_SIZES = [1500, 3000, 6000, 12000, 25000, 45000, 65000];
function newStadiumQuote(cap) { return { cap, cost: Math.round((1.5e6 + cap * perSeat(cap)) / 1e4) * 1e4, weeks: Math.round(26 + cap / 700) }; }
function expandQuote(c, add) { const cur = c.fac.stadium.cap, to = cur + add; return { add, cost: Math.round(add * perSeat(to) * 1.1 / 1e4) * 1e4, weeks: Math.round(14 + add / 600) }; }
function amenQuote(c) { const l = c.fac.stadium.amen; return l >= 5 ? null : { lvl: l + 1, cost: Math.round(c.fac.stadium.cap * 90 * l * Math.pow(1.6, l) / 1e4) * 1e4 + 50000, weeks: 10 + l * 4 }; }
const stadiumUpkeep = c => c.fac.stadium.own ? Math.round(c.fac.stadium.cap * 22 + c.fac.stadium.amen * c.fac.stadium.cap * 8 + (c.fac.stadium.suites || 0) * 6000) : 0;

/* Training ground and academy: levels 0-10. Level 0 means hired council pitches / no academy at all. */
const facCost = (kind, lvl) => Math.round((kind === "acad" ? 100000 : 80000) * Math.pow(1.85, lvl - 1) / 1e4) * 1e4;
const facWeeks = lvl => 8 + lvl * 5;
const facUpkeep = (kind, lvl) => lvl === 0 ? (kind === "train" ? 20000 : 0) : Math.round((kind === "acad" ? 25000 : 18000) * Math.pow(1.55, lvl - 1));
const FAC_NAME = { train: "Training ground", acad: "Academy" };
const TRAIN_DESC = ["Hired council pitches", "Basic grass pitches and a portacabin", "Floodlit pitches and changing rooms", "A modest training base", "A good base with a gym", "Several pitches, gym and physio", "A modern complex with sports science", "An excellent complex", "A superb complex", "One of the best in the country", "World class"];
const ACAD_DESC = ["No academy", "Evening sessions for local boys", "A small youth set-up", "A recognised academy", "A solid academy", "A good academy", "A category-two academy", "A strong category-two academy", "A category-one academy", "An elite academy", "World class"];

function startBuild(kind, q) {
  const c = my(), block = boardBlocks(q.cost); if (block) { news(block, true); return block; }
  q = { ...q, cost: Math.round(q.cost * buildMult() * (1 - vpt("facilities") * .02) / 1e4) * 1e4, weeks: Math.max(2, Math.round(q.weeks * (1 - dirSkill("ops") * .002))) };
  if (kind === "stadium") c.fac.stadium.build = { ...q, left: q.weeks, total: q.weeks };
  else c.fac[kind].build = { lvl: q.lvl, cost: q.cost, left: q.weeks, total: q.weeks };
  spend("build", q.cost);
  news(`Work starts: ${q.label}. ${money(q.cost)}, about ${q.weeks} weeks.`, true);
}
function buildWeek(c) {
  const S = c.fac.stadium;
  if (S.build && --S.build.left <= 0) {
    const b = S.build; S.build = null;
    if (b.type === "new") { S.own = true; S.cap = b.cap; S.stands = b.stands ? JSON.parse(JSON.stringify(b.stands)) : null; standsOf(S); if (b.family) S.stands[b.family].family = true; if (b.corp) S.stands.W.corp = Math.min(b.corp, Math.floor(S.stands.W.cap * .15)); syncCap(S); S.amen = 2; S.name = b.name; S.pitch = 100; S.ptype = "grass"; S.suites = 0; news(`${S.name} is open: ${b.cap.toLocaleString("en-GB")} capacity. ${c.name} have a home of their own.`, true); }
    else if (b.type === "expand") { const st = standsOf(S), side = b.side || Object.keys(st).sort((x, y) => st[x].cap - st[y].cap)[0]; st[side].cap += b.add; syncCap(S); news(`The ${SIDES[side]} extension is open (+${b.add.toLocaleString("en-GB")}). Capacity is now ${S.cap.toLocaleString("en-GB")}.`, true); }
    else if (b.type === "roof") { standsOf(S)[b.side].roof = true; news(`The ${SIDES[b.side]} has a roof: supporters there stay dry.`, true); }
    else if (b.type === "convert") { standsOf(S)[b.side].type = b.to; news(`The ${SIDES[b.side]} is now ${b.to === "seat" ? "all-seated" : "a terrace"}.`, true); }
    else if (b.type === "corp") { const W = standsOf(S).W; W.corp = (W.corp || 0) + b.add; news(`${b.add} corporate seats are ready in the Main stand (${W.corp} in all).`, true); }
    else if (b.type === "heat") { S.heat = true; news("Undersoil heating is installed: frost and snow won't stop games at home any more.", true); }
    else if (b.type === "suites") { S.suites = (S.suites || 0) + b.add; news(`${b.add} new executive suites are ready (${S.suites} in all).`, true); }
    else if (b.type === "amen") { S.amen = b.lvl; news(`Stadium facilities upgraded to level ${b.lvl}.`, true); }
    c.cap = capacity(c);
  }
  for (const k of ["train", "acad"]) { const F = c.fac[k]; if (F.build && --F.build.left <= 0) { F.lvl = F.build.lvl; F.build = null; news(`${FAC_NAME[k]} upgraded to level ${F.lvl}: ${(k === "train" ? TRAIN_DESC : ACAD_DESC)[F.lvl].toLowerCase()}.`, true); } }
}

/* ---------- supporters ---------- */
// Where the fanbase is heading: the division, the club's standing and whether it's winning.
function fanTarget(c) { return FAN_T[c.tier] * (.55 + c.rep / 60) * (.8 + c.mood / 250) * (hostileOf(c) ? .93 : 1); }
function fansWeek(c) {
  const t = fanTarget(c);
  const fam = familyOn(c) ? 1.3 : 1;  // a family stand brings the next generation in
  const up = (1 + fanShare(c, "fair")) * fam, dn = (1 - fanShare(c, "loyal") * .7) * (1 + fanShare(c, "fair") * .8);  // fair-weather swing, loyal stay
  c.fans = Math.max(50, Math.round(c.fans + (t * (fam > 1 ? 1.04 : 1) - c.fans) * (t > c.fans ? .012 * up : .004 * dn)));
}
/* ---------- supporter culture ----------
   Your support is a mix of four kinds (shares add to 100), and it shifts with how the club is run:
   - Hardcore: loud and partisan. A bigger home advantage. Grows with terraces and long, honest seasons.
   - Loyal: stick with you. Bad results hurt the mood less, and the support shrinks more slowly.
   - Fair-weather: come for success. Mood and numbers swing harder both ways. Grows with promotions and titles.
   - Community: local families. Notice prices more; cheap tickets and a family stand win them over. */
const FAN_KINDS = { hard: ["Hardcore", "Loud and partisan: a bigger home advantage."], loyal: ["Loyal", "Stand by the club: bad results hurt less, and they don't drift away."],
  fair: ["Fair-weather", "Come for success: mood and numbers swing harder both ways."], comm: ["Community", "Local families: they want fair prices, and reward cheap tickets and a family stand."] };
const fanMix = c => c.fanMix ||= { hard: 20, loyal: 25, fair: 20, comm: 35 };
const fanShare = (c, k) => isMine(c) ? fanMix(c)[k] / 100 : .25;
function moodHit(c, d) {
  if (isMine(c)) d *= d < 0 ? (1 - fanShare(c, "loyal") * .8) * (1 + fanShare(c, "fair") * .8) : 1 + fanShare(c, "fair") * .5;
  c.mood = clamp(c.mood + d, 0, 100);
}
// Each summer the mix shifts a little with the season and the way the club is run.
function fanCultureSummer(c, up, down) {
  const m = fanMix(c), S = c.fac.stadium, r = c.prices.ticket / REF_TICKET[c.tier], old = { ...m };
  if (up) m.fair += 4; if (down) { m.fair -= 4; m.loyal += 2; }
  if (!up && !down) m.loyal += 1;
  if (c.mood >= 65) m.loyal += 1; if (c.mood < 35) m.fair -= 1;
  if (typeof terraceShare === "function" && S.own && standShare(c, x => x.type === "terrace") > .25) m.hard += 2;
  if (typeof familyOn === "function" && familyOn(c)) m.comm += 2;
  if (r < .9) m.comm += 2; else if (r > 1.2) { m.comm -= 2; m.fair += 1; }
  const t = sum(Object.values(m), x => Math.max(5, x)); for (const k in m) m[k] = Math.round(Math.max(5, m[k]) / t * 100);
  const big = Object.keys(m).sort((a, b) => (m[b] - old[b]) - (m[a] - old[a]))[0];
  if (m[big] - old[big] >= 2) news(`Your support is changing: more ${FAN_KINDS[big][0].toLowerCase()} supporters this year (${m[big]}% now).`);
}
const moodWord = m => m >= 75 ? ["Buoyant", "good"] : m >= 58 ? ["Happy", "good"] : m >= 42 ? ["Steady", ""] : m >= 28 ? ["Restless", "warn"] : ["Angry", "bad"];

/* Attendance: regulars (the fanbase, turning out by mood) plus casual fans, both put off by expensive tickets,
   capped by the ground. A big or local opponent brings more. */
function priceFactor(price, ref, el = 1.3) { return clamp(Math.pow(ref / Math.max(.5, price), el), 0, 1.35); }
function crowdFor(c, opp, price = c.prices.ticket) {
  const pf = priceFactor(price * (G.sTrust && G.sTrust.u18 ? .93 : 1), REF_TICKET[c.tier], 1.3 + fanShare(c, "comm") * .8);  // families notice prices
  const turn = clamp(.5 + c.mood / 250 + terraceShare(c) * .05, .35, .95) * pf;
  const draw = opp ? clamp(.85 + (opp.rep - c.rep) / 60 + (opp.half === c.half ? .05 : 0), .8, 1.6) : 1;
  const away = opp ? Math.round(Math.min(opp.fans * .06, 1500 * (8 - c.tier))) : 0;
  const wx = G.wx ? 1 - (1 - wxAt(c).crowd) * openShare(c) : 1, protest = G.sTrust && G.sTrust.protest ? .85 : 1, derby = opp && isDerby(c, opp) ? 1.25 : 1;
  return Math.min(capacity(c), Math.round((c.fans * turn + c.fans * .35 * pf * draw + away) * wx * protest * derby));
}
function concessionsFor(c, crowd, price = c.prices.conc) {
  const am = ground(c).amen, buy = clamp(1.6 * Math.pow(REF_CONC[c.tier] / Math.max(.3, price), 1.4), 0, 2.6) * (.65 + am * .12);
  const gross = crowd * buy * price, cut = atHome(c) ? 1 : .5;  // a landlord keeps half the bar takings
  // Stock and staff cost about 30% of the going rate an item: very cheap food and drink sells out at a loss.
  return { gross, net: crowd * buy * (price - REF_CONC[c.tier] * .3) * cut };
}
function merchFor(c, price = c.prices.shirt) {  // per week
  const units = commMult() * c.fans * .007 * Math.min(3, Math.pow(REF_SHIRT[c.tier] / Math.max(5, price), 1.7)) * (.8 + c.mood / 250) * merchMult(c) * (familyOn(c) ? 1.12 : 1);
  // Each shirt costs about 45% of the going rate to make and license: the profit is what's left. Too cheap and you sell
  // lots at a loss; too dear and few sell. The best price sits a little above the going rate.
  return units * (price - REF_SHIRT[c.tier] * .45) * shirtBoost(c);
}
/* Forecast for the finance page: a typical home game against an average side. */
/* ---------- season tickets ----------
   Sold in pre-season and paid up front. The going rate is about a quarter off buying every league home game; how many
   sell depends on that price against the going rate, the supporters' mood and the size of your support, up to 70% of
   the ground. Holders turn up to league games without paying on the day (cup games are sold separately). */
const homeGames = c => Math.max(1, (G.leagues[c.lg] ? G.leagues[c.lg].clubs.length : 20) - 1);
const stRef = c => Math.round(REF_TICKET[c.tier] * homeGames(c) * .75 / 5) * 5;
const stPrice = c => c.prices.st ?? stRef(c);
function stDemand(c, price = stPrice(c)) {
  const per = price / homeGames(c), pf = priceFactor(per, REF_TICKET[c.tier] * .75, 1.6);
  return Math.min(Math.round(capacity(c) * .7), Math.round(c.fans * clamp(.12 + c.mood / 400, .08, .4) * pf));
}
function sellSeasonTickets(c) {
  const n = stDemand(c), price = stPrice(c); c.st = { y: G.year, n, price };
  if (n) { earn("stix", n * price); news(`Season tickets: ${n.toLocaleString("en-GB")} sold at ${money(price)}, ${money(n * price)} up front (${Math.round(n / capacity(c) * 100)}% of the ground).`, true); }
  const r = price / Math.max(1, stRef(c)); if (r < .8) moodHit(c, 2); else if (r > 1.3) moodHit(c, -3);
}
// Holders at a league game: most of them turn up.
const stHolders = c => c.st && c.st.y === G.year ? c.st.n : 0;
function matchdayForecast(c, t = c.prices.ticket, k = c.prices.conc) {
  const avgOpp = { rep: c.rep, fans: FAN_T[c.tier], half: "" }, hold = Math.round((G.phase === "summer" ? stDemand(c) : stHolders(c)) * .92);
  const crowd = Math.max(Math.min(capacity(c), hold), crowdFor(c, avgOpp, t)), con = concessionsFor(c, crowd, k);
  return { crowd, gate: Math.max(0, crowd - hold) * t * (1 - .2 * terraceShare(c)), conc: con.net, rent: ground(c).rent, hold };
}

/* ---------- sponsors ---------- */
const SLOTS = {
  shirt: { l: "Front-of-shirt", share: .35 }, kit: { l: "Kit supplier", share: .22 }, sleeve: { l: "Sleeve", share: .1 },
  stadium: { l: "Stadium naming rights", share: .22, need: c => c.fac.stadium.own }, train: { l: "Training ground naming", share: .06, need: c => c.fac.train.lvl >= 2 },
};
const BRANDS = ["Apex", "Northwind", "Halcyon", "Brightline", "Vantage", "Crestmark", "Silverleaf", "Ironclad", "Bluewater", "Summit", "Kestrel", "Meridian", "Harbour", "Oakridge", "Redline", "Lumen", "Granite", "Fairway", "Beacon", "Sterling"];
const BRAND_KIND = ["Insurance", "Motors", "Energy", "Bank", "Telecom", "Logistics", "Brewery", "Bet", "Homes", "Foods", "Air", "Digital", "Building Society", "Tyres"];
const KIT_BRANDS = ["Strider", "Volta", "Kinetic", "Arcus", "Tempo", "Fieldcraft", "Nova Sport", "Pulse", "Sprintline", "Ridge"];
const COMM_T = [0, 90e6, 7e6, 1.6e6, 700e3, 220e3, 80e3, 25e3];  // a typical club's commercial value by tier, per year
const isDerby = (c, o) => o && c.region === o.region && c.lg === o.lg;
/* What brands will pay a year: your division, standing, support and mood, and, within a season, how you're doing
   (league position) and how many come through the gate. */
function commercialValue(c) {
  const t = G.leagues[c.lg] && G.leagues[c.lg].tab && G.leagues[c.lg].tab[c.id] && G.leagues[c.lg].tab[c.id].p >= 6 ? table(c.lg) : null;
  const posF = t ? 1 + (.5 - t.findIndex(r => r.id === c.id) / (t.length - 1)) * .3 : 1;  // top +15%, bottom -15%
  const att = (c.att || []).length ? avg(c.att.slice(-8)) : 0, attF = att ? clamp(Math.sqrt(att / Math.max(1, FAN_T[c.tier] * .6)), .8, 1.25) : 1;
  return (1 + vpt("commercial") * .025) * mediaMult(c) * commMult() * sponsorSqueeze(c) * COMM_T[c.tier] * (.6 + c.rep / 60) * Math.sqrt(Math.max(.15, c.fans / FAN_T[c.tier])) * (.85 + c.mood / 333) * posF * attF;
}
// How far you've outgrown a deal: what the slot would fetch now against what it pays.
const dealGrowth = (c, d) => commercialValue(c) * SLOTS[d.slot].share / Math.max(1, d.amt);
function makeOffers(slot) {
  const c = my(), base = commercialValue(c) * SLOTS[slot].share, out = [];
  for (let i = 0; i < 3; i++) {
    const yrs = ri(1, 4), amt = Math.round(base * rf(.7, 1.12) * (1 - (yrs - 1) * .04) / 500) * 500;  // longer deals pay a little less a year
    const brand = slot === "kit" ? pick(KIT_BRANDS) : pick(BRANDS) + " " + pick(BRAND_KIND);
    out.push({ slot, brand, amt, yrs, bonus: Math.round(amt * rf(.1, .4) / 500) * 500, exp: 6 });
  }
  return out.sort((a, b) => b.amt - a.amt);
}
function refreshOffers(c, force) {
  for (const s of Object.keys(SLOTS)) {
    if (SLOTS[s].need && !SLOTS[s].need(c)) continue;
    const deal = c.deals.find(d => d.slot === s), have = c.offers.filter(o => o.slot === s);
    // Offers come when the slot is free, and on request in a deal's last year or once you've outgrown it by a quarter
    // (a new deal replaces the old one from signing). Outgrow it by half and brands come to you.
    const grown = deal && deal.yrs > 0 ? dealGrowth(c, deal) : 0;
    if (((!deal || deal.yrs <= 0) && !have.length) || (force === s && (!deal || deal.yrs <= 1 || grown >= 1.25))) { c.offers = c.offers.filter(o => o.slot !== s).concat(makeOffers(s)); }
    else if (!force && grown >= 1.5 && !have.length && G.phase !== "playoffs" && R() < .08) { c.offers = c.offers.concat(makeOffers(s)); news(`Brands have noticed how the club has grown: there are new offers for your ${SLOTS[s].l.toLowerCase()} deal, worth about ${Math.round((grown - 1) * 100)}% more than ${deal.brand} pay.`, true); }
  }
}
/* Breaking a sponsor deal early costs you: half of what it still had to pay (its remaining years, the current one
   counted from where the season is). */
const breakFee = d => { if (!d || d.yrs <= 0) return 0; const left = Math.max(0, d.yrs - 1) + (G.phase === "season" ? 1 - G.week / SEASON_WEEKS : 1); return Math.round(d.amt * left * .5 / 500) * 500; };
function acceptOffer(o) {
  const c = my(), old = c.deals.find(d => d.slot === o.slot && d.yrs > 0), fee = breakFee(old);
  if (old && fee) { spend("breaks", fee); news(`${o.brand} replace ${old.brand}. Breaking ${old.brand}'s deal costs ${money(fee)} in compensation.`, true); }
  c.deals = c.deals.filter(d => d.slot !== o.slot).concat({ ...o, exp: undefined });
  c.offers = c.offers.filter(x => x.slot !== o.slot);
  if (o.slot === "stadium") c.fac.stadium.name = `The ${o.brand.split(" ")[0]} Stadium`;
  news(`${o.brand} sign a ${o.yrs}-year ${SLOTS[o.slot].l.toLowerCase()} deal worth ${money(o.amt)} a year (${money(o.bonus)} bonus for promotion).`, true);
}
const sponsorTotal = c => sum(c.deals, d => d.amt);

/* ---------- the weekly accounts ---------- */
// What the club actually pays its players a year: the squad's wages, less the part of a borrowed player's wage his own
// club still pays, plus the part you still pay for players you've lent out.
const wageBill = c => sum(c.squad, id => P(id).wage) + loanWageAdj(c);
const staffBill = c => sum(Object.values(c.staff).filter(Boolean), s => s.wage);
const upkeep = c => upkeepMult() * (stadiumUpkeep(c) + (c.fac.stadium.heat ? heatQuote(c).upkeep : 0)) + ventureUpkeep(c) + facUpkeep("train", c.fac.train.lvl) + facUpkeep("acad", c.fac.acad.lvl);
function weeklyAccounts(c) {
  spend("wages", wageBill(c) / 52);
  spend("staff", staffBill(c) / 52); spend("directors", dirWages() / 52);
  spend("fac", upkeep(c) / 52);
  spend("acad", c.budget.acad / 52);
  spend("scout", c.budget.scout / 52);
  earn("spons", sponsorTotal(c) / 52);
  earn("merch", merchFor(c));
  earn("events", ventureWeek(c)); concertWeek(c);
  if (G.phase === "season") earn("suites", suitesLet(c) * c.prices.suite / SEASON_WEEKS);
  corpWeek(c);
  if (G.phase === "season") earn("tv", TV[c.tier] / 46);
  if (c.cash < 0) spend("interest", -c.cash * .1 / 52);  // an overdraft at 10% a year
  feedersWeek(); loansWeek(c);
}
function homeGameMoney(c, opp, league) {
  const hold = league ? Math.round(stHolders(c) * .92) : 0;  // season-ticket holders at a league game: already paid
  const crowd = Math.max(Math.min(capacity(c), hold), crowdFor(c, opp)), con = concessionsFor(c, crowd), paying = Math.max(0, crowd - hold);
  const tp = c.prices.ticket * (1 - .2 * terraceShare(c));  // terrace tickets sell a fifth cheaper
  if (terraceShare(c)) moodHit(c, terraceShare(c) * .15);
  earn("gate", paying * tp); earn("conc", con.net); earn("events", ventureGame(c, crowd)); spend("rent", ground(c).rent);
  // Home games on their own, for the per-game view (the season's gate total also holds away shares and friendly fees).
  const H = (c.hgs ||= { n: 0, crowd: 0, gate: 0, conc: 0, vent: 0, rent: 0 }); H.n++; H.crowd += crowd; H.gate += paying * tp; H.hold = (H.hold || 0) + hold; H.stg = (H.stg || 0) + (league && stHolders(c) ? c.st.n * c.st.price / homeGames(c) : 0); H.conc += con.net; H.vent += ventureGame(c, crowd); H.rent += ground(c).rent;
  // Prices supporters think unfair cost goodwill; cheap tickets earn a little.
  const r = c.prices.ticket / REF_TICKET[c.tier], cm = 1 + fanShare(c, "comm") * 1.5; if (r > 1.25) moodHit(c, -(r - 1.25) * 3 * cm); else if (r < .8) moodHit(c, .3 * cm);
  c.att = c.att || []; c.att.push(crowd);
  return crowd;
}
const ledgerIncome = f => f.gate + (f.stix || 0) + f.conc + (f.suites || 0) + (f.events || 0) + f.merch + f.spons + f.tv + f.prize + f.sales + (f.network || 0);
const ledgerCosts = f => f.wages + f.staff + f.fac + f.rent + f.acad + f.scout + f.buys + f.build + f.interest + (f.dividend || 0) + (f.feeders || 0) + (f.directors || 0) + (f.breaks || 0);

/* What a sensible academy and scouting budget looks like at each academy level / tier: below it, intakes and
   reports suffer; well above it, they improve a little. */
const acadRef = lvl => lvl ? 25000 * Math.pow(1.5, lvl) : 0;
const scoutRef = tier => [0, 6e6, 1.2e6, 400e3, 180e3, 80e3, 30e3, 10e3][tier];
const budgetFactor = (b, ref) => ref ? clamp(Math.log2(Math.max(1, b) / ref) * 1.5, -4, 3) : 0;
const scoutBoost = () => G.club == null ? 0 : budgetFactor(my().budget.scout, scoutRef(my().tier)) * 3 + (staffOf("recruit") ? staffOf("recruit").at.net * .1 : 0);

/* ---------- executive suites ----------
   Boxes let to local businesses by the season. You set the price; how many are taken depends on the division,
   the club's standing and the price. They need a ground of your own; a stadium can fit one box per 250 seats. */
const REF_SUITE = [0, 150000, 50000, 22000, 13000, 8000, 4500, 2500];
const suiteMax = c => c.fac.stadium.own ? Math.floor(c.fac.stadium.cap / 250) : 0;
const suiteDemand = c => FAN_T[c.tier] / 450 * (.6 + c.rep / 60) * (.8 + c.mood / 250);
function suitesLet(c, price = c.prices.suite) { return Math.min(c.fac.stadium.suites || 0, Math.floor(suiteDemand(c) * priceFactor(price, REF_SUITE[c.tier], 1.5))); }
function suiteQuote(c, n = 4) { const room = suiteMax(c) - (c.fac.stadium.suites || 0); if (room <= 0) return null; n = Math.min(n, room); return { add: n, cost: Math.round(n * (90000 + c.fac.stadium.cap * 3) / 1e4) * 1e4, weeks: 10 + n * 2 }; }

/* ---------- the pitch ----------
   Your own pitch wears with every home game (a hybrid surface about half as fast) and recovers slowly, faster over
   the summer. A worn pitch blunts passing football at home, causes more injuries and annoys supporters, until you
   re-lay it. (While you rent a ground, the pitch is the landlord's problem.) */
const PITCH = { grass: { l: "Natural grass", wear: 2.4, cost: c => 40000 + c.fac.stadium.cap * 4 }, hybrid: { l: "Hybrid (reinforced) grass", wear: 1.1, cost: c => 250000 + c.fac.stadium.cap * 22 } };
const pitchWord = q => q >= 80 ? ["Excellent", "good"] : q >= 65 ? ["Good", "good"] : q >= 50 ? ["Worn", "warn"] : q >= 35 ? ["Poor", "bad"] : ["Mudbath", "bad"];
const pitchOf = c => atHome(c) ? c.fac.stadium.pitch : null;
function pitchWeek(c, homeGame) {
  const S = c.fac.stadium; if (!S.own) return;
  if (S.relay && --S.relay.left <= 0) { S.ptype = S.relay.type; S.pitch = 100; S.relay = null; news(`The new ${PITCH[S.ptype].l.toLowerCase()} pitch is laid.`, true); return; }
  const before = S.pitch;
  if (homeGame && atHome(c)) S.pitch -= PITCH[S.ptype || "grass"].wear * rf(.7, 1.4) * (G.wx ? wxAt(c).wear : 1) * wearMult();
  S.pitch = clamp(S.pitch + (G.phase === "summer" ? 3 : .35), 5, 100);
  if (S.pitch < 40 && homeGame) moodHit(c, -.4);
  if (pitchWord(before)[0] !== pitchWord(S.pitch)[0] && S.pitch < before && S.pitch < 65) news(`The groundsman reports the pitch is now ${pitchWord(S.pitch)[0].toLowerCase()} (${Math.round(S.pitch)}/100).`, S.pitch < 50);
}
function relayPitch(type) {
  const c = my(), S = c.fac.stadium, cost = PITCH[type].cost(c);
  spend("build", cost); S.relay = { type, left: G.phase === "summer" ? 2 : 3 };
  news(`The pitch is being re-laid with ${PITCH[type].l.toLowerCase()} (${money(cost)}).`, true);
}

/* ---------- other uses of the stadium ----------
   Money that doesn't depend on match days: built once you own the ground. Some cost the pitch: concerts and a
   tenant team wear it like extra matches. Incomes scale with the ground, the support and the club's standing. */
const VENTURES = {
  shop:  { l: "Club shop", d: "A shop at the ground: merchandise sales up 40%.", cost: c => 120000 + c.fac.stadium.cap * 6, upkeep: 25000 },
  mega:  { l: "Megastore", d: "A flagship store: merchandise up a further 50%. Needs the club shop.", need: c => has(c, "shop") && c.fac.stadium.cap >= 10000, cost: c => 1.5e6 + c.fac.stadium.cap * 40, upkeep: 220000 },
  park:  { l: "Car park", d: "Parking charges on match days, and rentals the rest of the week.", cost: c => 80000 + c.fac.stadium.cap * 15, upkeep: 15000,
    week: c => 500, game: (c, crowd) => crowd * .22 * 6 },
  conf:  { l: "Conference & events centre", d: "Weddings, dinners, business events. Better with suites and good facilities.", need: c => c.fac.stadium.amen >= 2, cost: c => 400000 + c.fac.stadium.cap * 20, upkeep: 90000,
    week: c => (2500 + (c.fac.stadium.suites || 0) * 450) * (.6 + c.fac.stadium.amen * .2) * (1 + (8 - c.tier) * .04) },
  tours: { l: "Stadium tours & museum", d: "Visitors pay to see the ground. Better with more fans and more history.", need: c => c.fac.stadium.cap >= 5000, cost: c => 250000 + c.fac.stadium.cap * 8, upkeep: 60000,
    week: c => c.fans * .012 * 15 * (1 + c.trophies.length * .08) },
  hotel: { l: "Stadium hotel", d: "A hotel built into a stand. Expensive, but steady money all year.", need: c => c.fac.stadium.cap >= 15000, cost: c => 18e6 + c.fac.stadium.cap * 150, upkeep: 1.2e6,
    week: c => (120 + c.fac.stadium.cap / 300) * 7 * 95 * (.55 + c.rep / 200) },
  tenant:{ l: "Tenant team", d: "Rent the ground to a rugby or women's side: weekly rent, but the pitch wears faster.", cost: c => 30000, upkeep: 0,
    week: c => 400 + c.fac.stadium.cap * .35, wear: .9 },
};
const has = (c, k) => !!(c.fac.stadium.vent || {})[k];
const ventureOK = (c, k) => c.fac.stadium.own && (!VENTURES[k].need || VENTURES[k].need(c));
function buildVenture(k) {
  const c = my(), V = VENTURES[k], cost = Math.round(V.cost(c) / 1e4) * 1e4;
  spend("build", cost); (c.fac.stadium.vent ||= {})[k] = { y: G.year };
  news(`${V.l} opens at the ground (${money(cost)}).`, true);
}
function closeVenture(k) { const c = my(); delete c.fac.stadium.vent[k]; news(`${VENTURES[k].l} closes.`); }
const ventureUpkeep = c => sum(Object.keys(c.fac.stadium.vent || {}), k => VENTURES[k].upkeep);
const merchMult = c => (has(c, "shop") ? 1.4 : 1) * (has(c, "mega") ? 1.5 : 1);
function ventureWeek(c) {
  if (!c.fac.stadium.own) return 0;
  let t = 0; for (const k of Object.keys(c.fac.stadium.vent || {})) { const V = VENTURES[k]; if (V.week) t += V.week(c); if (V.wear) c.fac.stadium.pitch = Math.max(5, c.fac.stadium.pitch - V.wear * rf(.6, 1.4)); }
  return t;
}
const ventureGame = (c, crowd) => atHome(c) ? sum(Object.keys(c.fac.stadium.vent || {}), k => VENTURES[k].game ? VENTURES[k].game(c, crowd) : 0) : 0;
/* Summer concerts: a big ground can host up to four. Each pays by capacity and the club's draw, and costs the pitch
   about eight points. Set how many you want on the Facilities page; they're held during the pre-season. */
const CONCERT_MIN = 15000;
const concertFee = c => Math.round((c.fac.stadium.cap * 9 + 50000) * (.8 + c.rep / 250) / 1000) * 1000;
function concertWeek(c) {
  const S = c.fac.stadium; if (!S.own || S.cap < CONCERT_MIN || G.phase !== "summer") return;
  const want = S.concerts || 0, held = S.held || 0;
  if (held < want && G.week >= 1 && G.week <= 6 && G.week % 1 === 0 && R() < .7) {
    const fee = concertFee(c); earn("events", fee); S.held = held + 1; S.pitch = Math.max(5, S.pitch - rf(6, 10));
    news(`A sold-out concert at ${S.name} earns the club ${money(fee)}. The groundsman is less pleased.`);
  }
}

/* ---------- stands ----------
   A ground of your own is four stands: the Main stand (west), the East, North and South stands. Each has its own
   capacity, is seated or terraced, and covered or open. One can be the family stand; the Main stand can hold
   corporate seats.
   - Terraces cost about half as much a place, make more noise (a bigger home advantage, happier supporters) and sell
     a little cheaper. The Premier and First Divisions are all-seater: terraces are closed there until converted.
   - A roof keeps the crowd coming when the weather turns.
   - A family stand grows the support faster and sells more shirts.
   - Corporate seats (up to 15% of the Main stand) are sold by the season to local businesses. */
const SIDES = { W: "Main stand", E: "East stand", N: "North stand", S: "South stand" };
const ALL_SEATER = 2;  // the Premier and First Divisions
const TYPE_F = { seat: 1, terrace: .55 }, roofF = r => r ? 1.2 : 1;
function standsOf(S) {  // a ground from before stands: four seated, covered stands sharing its capacity
  if (!S.stands && S.own) {
    const f = { W: .35, E: .25, N: .2, S: .2 }; S.stands = {};
    for (const k in SIDES) S.stands[k] = { cap: Math.round(S.cap * f[k]), type: "seat", roof: true };
    S.stands.W.cap += S.cap - sum(Object.values(S.stands), x => x.cap);
  }
  return S.stands || {};
}
const syncCap = S => { S.cap = sum(Object.values(standsOf(S)), x => x.cap); };
const groundCap = c => sum(Object.values(standsOf(c.fac.stadium)), x => x.type === "terrace" && c.tier <= ALL_SEATER ? 0 : x.cap);
const closedTerraces = c => c.tier <= ALL_SEATER ? sum(Object.values(standsOf(c.fac.stadium)), x => x.type === "terrace" ? x.cap : 0) : 0;
const standShare = (c, f) => { const l = Object.values(standsOf(c.fac.stadium)), t = sum(l, x => x.cap) || 1; return sum(l.filter(f), x => x.cap) / t; };
const terraceShare = c => atHome(c) && c.fac.stadium.own && c.tier > ALL_SEATER ? standShare(c, x => x.type === "terrace") : 0;
const openShare = c => atHome(c) && c.fac.stadium.own ? standShare(c, x => !x.roof) : .5;
const familyOn = c => atHome(c) && c.fac.stadium.own && Object.values(standsOf(c.fac.stadium)).some(x => x.family);
const corpSeats = c => atHome(c) && c.fac.stadium.own ? (standsOf(c.fac.stadium).W || {}).corp || 0 : 0;
const corpMax = c => Math.floor(((standsOf(c.fac.stadium).W || {}).cap || 0) * .15);
const REF_CORP = [0, 9000, 3500, 1800, 1100, 700, 400, 250];  // a corporate seat for the season
const corpLet = c => Math.min(corpSeats(c), Math.floor(suiteDemand(c) * 15));
// Quotes.
function groundQuote(d) {
  const st = Object.values(d.stands), tot = sum(st, x => x.cap || 0);
  const cost = 1.5e6 + sum(st, x => (x.cap || 0) * perSeat(tot) * TYPE_F[x.type] * roofF(x.roof)) + (d.corp || 0) * 1800 + (d.family ? 25000 : 0);
  return { cap: tot, cost: Math.round(cost / 1e4) * 1e4, weeks: Math.round(26 + tot / 700) };
}
function standQuote(c, side, add) {
  const x = standsOf(c.fac.stadium)[side], to = c.fac.stadium.cap + add;
  return { side, add, cost: Math.round(add * perSeat(to) * TYPE_F[x.type] * roofF(x.roof) * 1.1 / 1e4) * 1e4, weeks: Math.round(14 + add / 600) };
}
const roofQuote = (c, side) => { const n = standsOf(c.fac.stadium)[side].cap; return { side, cost: Math.round((50000 + n * 260) / 1e4) * 1e4, weeks: Math.round(8 + n / 2000) }; };
const convertQuote = (c, side) => { const x = standsOf(c.fac.stadium)[side], to = x.type === "terrace" ? "seat" : "terrace"; return { side, to, cost: Math.round((40000 + x.cap * (to === "seat" ? 320 : 120)) / 1e4) * 1e4, weeks: Math.round(8 + x.cap / 2500) }; };
const corpQuote = (c, n) => ({ add: n, cost: Math.round(n * 1800 / 1000) * 1000, weeks: 6 });
const familyCost = (c, side) => Math.round((25000 + standsOf(c.fac.stadium)[side].cap * 20) / 1000) * 1000;
function setFamily(c, side) {
  const st = standsOf(c.fac.stadium); for (const k in st) st[k].family = k === side ? !st[k].family : false;
  if (st[side].family) { const f = familyCost(c, side); spend("build", f); news(`The ${SIDES[side]} becomes the family stand (${money(f)} for the facilities): cheaper for children, and a new generation of supporters.`, true); }
  else news(`The ${SIDES[side]} is no longer the family stand.`);
}
// A stand-by-stand plan for a new ground, from a total: a main stand, two sides and ends.
function standPlan(tot) { const f = { W: .35, E: .25, N: .2, S: .2 }, d = { stands: {}, family: "", corp: 0 }; for (const k in SIDES) d.stands[k] = { cap: Math.round(tot * f[k] / 50) * 50, type: "seat", roof: true }; d.stands.W.cap += tot - sum(Object.values(d.stands), x => x.cap); return d; }
function corpWeek(c) { if (G.phase === "season" && corpLet(c)) earn("suites", corpLet(c) * REF_CORP[c.tier] / SEASON_WEEKS); }

/* ---------- squad registration ----------
   No limit on how many players you hold, but only 25 registered seniors can play. Under-21s and academy players don't
   need registering. You change the list only while a transfer window is open; your manager fills any empty places with
   his best unregistered players when a window closes, and a new signing is registered straight away if there's room. */
const REG_MAX = 25;
const regExempt = p => p.acad || p.age <= 21;
const regList = c => { c.reg ||= autoRegList(c); c.reg = c.reg.filter(id => c.squad.includes(id) && !regExempt(P(id))); return c.reg; };
const isReg = (p, c = my()) => regExempt(p) || regList(c).includes(p.id);
function autoRegList(c) { return c.squad.map(P).filter(p => !regExempt(p)).sort((a, b) => b.ovr - a.ovr).slice(0, REG_MAX).map(p => p.id); }
function autoRegister(c, quiet) {
  const L = regList(c), add = c.squad.map(P).filter(p => !regExempt(p) && !L.includes(p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, REG_MAX - L.length);
  for (const p of add) L.push(p.id);
  const out = c.squad.map(P).filter(p => !isReg(p, c));
  if (!quiet && (add.length || out.length)) news(`Squad registered: ${L.length} of ${REG_MAX}${add.length ? `, adding ${add.map(p => p.name).join(", ")}` : ""}.${out.length ? ` Not registered (can't play until the next window): ${out.map(p => p.name).join(", ")}.` : ""}`, !!out.length);
}
// A newcomer is registered if there's a place for him (an emergency signing always is).
function registerNew(p, c = my(), force) { if (regExempt(p)) return; const L = regList(c); if (L.includes(p.id)) return; if (L.length < REG_MAX || force) L.push(p.id); else news(`${p.name} has signed but the 25-man list is full: he can't play until you register him (unregister someone while the window is open).`, true); }
function toggleReg(p, c = my()) {
  if (!windowOpen()) return "Registrations can only change while a transfer window is open.";
  if (regExempt(p)) return `${p.name} doesn't need registering (under-21s and academy players can always play).`;
  const L = regList(c);
  if (L.includes(p.id)) { c.reg = L.filter(id => id !== p.id); return null; }
  if (L.length >= REG_MAX) return "The list is full: unregister someone first.";
  L.push(p.id); return null;
}
