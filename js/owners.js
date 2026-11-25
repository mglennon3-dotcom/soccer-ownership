/* Rival owners. Every other club has an owner with a style, a fortune and a temper, and the style drives the club:
   how much it spends over its means, how much it builds, how long its managers last, whether it ends up in
   administration, whether it comes after your staff, your players or your sponsors. Clubs change hands in takeovers. */
"use strict";

/* spend: recruiting standard above or below the club's means (rating points out of 100); build: chance a season of
   improving the ground and facilities; patience: how long a manager survives a bad run (0-1); debt: chance a season
   of administration when overstretched; poach: appetite for other clubs' staff and players; media: profile;
   prices: ticket pricing, which moves their supporters; sells: willingness to cash in on stars; loss: how much he'll lose
   in a season out of his own pocket, as a share of the club's income (below zero: he wants a profit). */
const OWNER_STYLES = {
  local:     { l: "Lifelong fan",        d: "Grew up on the terraces. Modest money, cheap tickets, loyal to his managers.", spend: 0, loss: 0.15, build: .25, patience: .9, debt: .01, poach: .1, media: 0, prices: .85, sells: .3, w: 4 },
  sugar:     { l: "Billionaire benefactor", d: "Money no object. Overpays for players and staff, and wants it now.", spend: 6, loss: 1.5, build: .6, patience: .35, debt: .02, poach: .9, media: 6, prices: 1, sells: .1, w: 1 },
  stripper:  { l: "Asset stripper",      d: "Loads the club with debt, sells the best players, squeezes the fans. Clubs he owns often collapse.", spend: -4, loss: -0.25, build: 0, patience: .6, debt: .25, poach: .2, media: -2, prices: 1.3, sells: 1, w: 1 },
  moneyball: { l: "Data-driven investor", d: "Buys undervalued players young and sells at the peak. Steady, clever, rarely overspends.", spend: 2, loss: 0, build: .3, patience: .7, debt: .01, poach: .4, media: 0, prices: 1, sells: .8, w: 2 },
  developer: { l: "Property developer",  d: "More interested in the land than the team: new stands, hotels, retail. The squad comes second.", spend: -1, loss: 0.05, build: .9, patience: .6, debt: .06, poach: .2, media: 1, prices: 1.15, sells: .6, w: 1.5 },
  celebrity: { l: "Celebrity owner",     d: "A famous face. Huge media profile and sponsors flock to him; fans arrive from everywhere.", spend: 3, loss: 0.5, build: .4, patience: .6, debt: .03, poach: .6, media: 12, prices: 1.05, sells: .4, w: .8 },
  multiclub: { l: "Multi-club group",    d: "One of a network of clubs. Moves players around the group, strong scouting, cold-blooded.", spend: 2, loss: 0.15, build: .4, patience: .5, debt: .02, poach: .7, media: 2, prices: 1.05, sells: .7, w: 1.2 },
  absentee:  { l: "Absent owner",        d: "Bought the club and lost interest. No investment, nobody answers the phone, slow decline.", spend: -3, loss: -0.1, build: .02, patience: .8, debt: .05, poach: 0, media: -3, prices: 1.1, sells: .7, w: 2 },
  gambler:   { l: "Reckless gambler",    d: "Spends what he hasn't got. Boom, then bust.", spend: 5, loss: 1, build: .3, patience: .3, debt: .2, poach: .6, media: 3, prices: 1.1, sells: .2, w: 1 },
  fanowned:  { l: "Supporter-owned",     d: "Run by its fans. Cheap tickets, no debt, slow growth, never sold.", spend: -1, loss: 0, build: .2, patience: .85, debt: 0, poach: .05, media: 1, prices: .8, sells: .5, w: 1.5 },
  meddler:   { l: "Very hands-on",             d: "Picks the team from the directors' box. Sacks managers after three defeats; good staff won't work for him.", spend: 2, loss: 0.3, build: .25, patience: .1, debt: .05, poach: .5, media: 4, prices: 1.05, sells: .4, w: 1.5 },
  dynasty:   { l: "Old-money dynasty",   d: "The same family for a century. Steady and proud, until the old man dies and the heir takes over: he sells up or runs it into the ground.", spend: 1, loss: 0.2, build: .3, patience: .75, debt: .03, poach: .3, media: 2, prices: 1, sells: .4, w: 1.2 },
  hostile:   { l: "Hostile neighbour",   d: "Bought the club next door to beat yours. Goes after your staff, your players, your sponsors and your supporters.", spend: 4, loss: 0.8, build: .5, patience: .4, debt: .04, poach: 1, media: 7, prices: .9, sells: .2, w: 0 },
  crypto:    { l: "Crypto or betting money", d: "Fast money from a crypto exchange or a betting firm. Spends big, and can vanish overnight.", spend: 5, loss: 1, build: .3, patience: .4, debt: .03, poach: .7, media: 4, prices: 1.05, sells: .3, w: .8 },
  explayer:  { l: "Former player",       d: "A club legend who came back as owner. The fans adore him; he hires his old teammates as managers, whether they're any good or not.", spend: 0, loss: 0.2, build: .25, patience: .75, debt: .02, poach: .2, media: 4, prices: .9, sells: .4, w: 1 },
  academy:   { l: "Youth evangelist",    d: "Believes in the academy above all. Brings players through and sells them on.", spend: -1, loss: 0, build: .3, patience: .8, debt: .01, poach: .3, media: 1, prices: .95, sells: .9, w: 1.5 },
};
const OWNER_CORP = ["Holdings", "Capital", "Group", "Partners", "Sports", "Investments", "Global"];
function newOwner(c, style) {
  style = style || wpick(Object.keys(OWNER_STYLES), k => OWNER_STYLES[k].w * (k === "sugar" || k === "celebrity" ? (c.tier <= 3 ? 2 : .7) : 1));
  const corp = ["multiclub", "stripper", "moneyball", "developer"].includes(style) && R() < .6;
  const wealth = style === "fanowned" ? 0 : Math.round(Math.pow(10, rf(5.5, 7.5) + (8 - c.tier) * .22 + (style === "sugar" ? 1.6 : style === "celebrity" ? .7 : 0)));
  const name = corp ? pick(BRANDS) + " " + pick(OWNER_CORP) : style === "fanowned" ? `${c.town} Supporters' Society` : style === "dynasty" ? `The ${pick(NAMES.ENG[1])} family`
    : style === "crypto" ? pick(["Coin", "Chain", "Bet", "Block", "Punt", "Token"]) + pick(["Vault", "Stake", "Hub", "X", "Max", "Rush"]) : nameFor("ENG");
  return { name, style, wealth, since: G.year, flash: R() };
}
// AI grounds have sites too: room to grow, then no further (never past 90,000).
const aiSite = c => c.site ??= Math.max(c.cap || 0, newSite(c.cap || 1000));
/* AI clubs move too: when the ground is nearly as big as its site allows and the support has outgrown it. Owners who
   like building move more often; a property developer looks out of town, a lifelong fan, a former player or the
   supporters themselves stay close. A long move costs them supporters, as it would you. The owner pays the bill, less
   what the old ground sells for. */
/* Whether an AI club moves is a weighing of reasons. Pressures: a hemmed-in site (little or no room left), demand (a
   full ground, fans turned away), a ground too small for the division, an old ground. The owner: builders and
   developers move readily, absent owners rarely, supporter-owned clubs cautiously. Money: a club cutting costs, losing
   money or already in debt holds back. The fans: strong demand pushes it on; a loyal and hardcore support pulls a move
   closer to home. */
function moveOdds(c) {
  const S = ownStyle(c), st = c.own.style, age = groundAge(c), room = (aiSite(c) - c.cap) / Math.max(1, c.cap);
  const att = aiEstimate(c).att, full = att / Math.max(1, c.cap), small = c.cap < STADIUM_T[c.tier] * .65;
  const hemmed = room < .1, cramped = room < .25, demand = full >= .95 || c.fans * 1.25 > c.cap, dated = age >= 70;
  if (!(hemmed || cramped || small || dated) || !(demand || small || dated)) return 0;  // it has to need the room and the fans
  let p = .008 + (hemmed ? .03 : cramped ? .012 : 0) + (full >= .95 ? .03 : full >= .85 ? .012 : 0) + (c.fans * 1.25 > c.cap ? .01 : 0) + (small ? .02 : 0) + Math.max(0, age - 60) * .0006;
  p *= (.3 + S.build * 1.4) * (st === "fanowned" ? .8 : 1);                                        // the owner's appetite for building
  const inc = (c.aiFin || {}).inc || aiIncome(c);
  if (c.cut) p *= .3; if (c.aiFin && c.aiFin.net < -inc * .2) p *= .6; if ((c.debt || 0) > inc) p *= .4;  // money worries
  if (st !== "fanowned" && c.own.wealth > (1.5e6 + c.cap * 1.5 * perSeat(c.cap * 1.5)) * 2) p *= 1.4;  // a rich owner
  return p;
}
/* A new ground is rare: about one every two years across the whole pyramid (one to three years apart), as in England
   since the all-seater rebuilds. When one is
   due, the club with the strongest case (the odds above) gets it. */
function aiMoveCheck(c) {
  if (G.groundNext == null) G.groundNext = G.year + ri(1, 3);
  if (G.year < G.groundNext || G.groundY === G.year) return;
  // A club that has built a new ground won't build another for at least 20 years.
  if (c.abroad || c.build || (c.moved && G.year - c.moved.y < 20) || G.year - aiOpened(c) < 20 || R() > moveOdds(c)) return;
  const S = ownStyle(c), st = c.own.style, roots = fanShare(c, "loyal") + fanShare(c, "hard");  // a loyal, hardcore support wants to stay close
  // The owner's own leaning (a developer likes cheap land far out, a local owner stays close), then what the supporters
  // want: a fan-owned club follows them, most owners listen, a stripper or a fund barely does.
  const lean = st === "developer" ? { near: .5, edge: 2, far: 2.5 } : ["local", "explayer", "fanowned", "dynasty"].includes(st) ? { near: 3, edge: 1.5, far: .3 } : { near: 2, edge: 2, far: 1 };
  const listen = { fanowned: 1.5, local: 1.1, explayer: 1.1, dynasty: 1, developer: .35, stripper: .1, absentee: .3, gambler: .6 }[st] ?? .8;
  const cap = clamp(Math.round(Math.max(c.cap * rf(1.3, 1.8), c.fans * 1.2) / 500) * 500, c.cap + 1000, SITE_MAX);
  const opts = Object.entries(SITE_KINDS).map(([k, K]) => { const km = ri(...K.km), site = clamp(Math.round(cap * rf(1.3, 2) * (k === "near" ? rf(.6, 1) : 1) / 500) * 500, c.cap + 500, SITE_MAX); return { k, km, site, pref: sitePref(c, { k, km, site }) }; });
  const ch = wpick(opts, o => lean[o.k] * Math.exp(clamp(o.pref.mood, -20, 12) / 8 * listen)), kind = ch.k, K = SITE_KINDS[kind], km = ch.km, site = ch.site;
  const cost = 1.5e6 + cap * perSeat(cap) + site * K.land * landK(c) - aiSite(c) * 150 * landK(c);
  // Paid partly by the owner, the rest borrowed against the new ground (supporters' trusts borrow most of it), or
  // all of it borrowed.
  if (!aiFund(c, S, Math.max(0, cost), Infinity, 6)) return;
  // Work starts: a season to build (two for a big ground). They keep playing at the old ground meanwhile.
  // The same building time as yours (construction weeks for that size, plus a few for a move), counted week by week.
  G.groundY = G.year; G.groundNext = G.year + ri(1, 3);
  const wks = groundWeeks(cap) + 4; c.build = { cap, site, km, kind, mood: ch.pref.mood, left: wks, total: wks, open: G.year + Math.floor((wks + G.week) / 54) };
  if (nearMe(c)) news(`${c.name} start building a new ${cap.toLocaleString("en-GB")}-capacity ground ${km <= 3 ? "just down the road" : `${km} km away`}: about ${wks} weeks of work.${squeeze(c) < .95 ? " They'll be spending less on the team while it goes up." : ""}`, c.lg === my().lg);
}
const nearMe = c => c.lg === my().lg || (c.half === my().half && Math.abs(c.tier - my().tier) <= 1) || isDerby(my(), c);
/* While a new ground goes up, the club tightens its belt, depending on who owns it: a billionaire doesn't notice, the
   showmen and gamblers barely, most owners cut back a little, supporters' trusts and developers more, and absent
   owners and asset strippers most. */
const BUILD_SQUEEZE = { sugar: 1, celebrity: .95, gambler: .95, crypto: .95, hostile: .95, multiclub: .9, meddler: .9, explayer: .88, dynasty: .88, moneyball: .85, local: .85, academy: .85, fanowned: .8, developer: .8, absentee: .75, stripper: .7 };
const squeeze = c => c.build ? BUILD_SQUEEZE[(c.own || {}).style] ?? .85 : 1;
// Every week, AI building work moves on, the same as yours.
function boostWeek() { if (G.phase !== "season") return; for (const c of G.clubs) { if (c.bounceW) delete c.bounceW; else if (c.bounce > 0) c.bounce--; if (c.compl) delete c.compl; } }
function aiBuildWeek() { boostWeek(); for (const c of G.clubs) if (c.build && c.build.left != null && !c.gone && --c.build.left <= 0) aiMoveIn(c); }
function aiMoveIn(c) {
  const b = c.build, old = c.cap; c.build = null; setHoney(c); if (b.kind) c.loc = locForMove(c, b.kind);
  (c.grounds ||= []).push({ from: aiOpened(c), to: G.year, cap: old }); c.cap = b.cap; c.site = b.site; c.moved = { y: G.year, km: b.km, from: old }; c.opened = G.year;
  // What the supporters thought of the site decides how many follow (a move they backed costs very few).
  const mood = b.mood ?? moveMood(c, b.km);
  let lost = siteLoss(c, { km: b.km }, mood); if (lost > 0) { c.fans = Math.round(c.fans * (1 - lost)); const m = fanMix(c); m.comm = Math.max(5, m.comm - 4); m.fair += 3; normMix(m); }
  if (mood > 0) c.mood = clamp((c.mood || 60) + Math.min(5, mood), 0, 100);
  if (nearMe(c)) news(`${c.name} move into their new ${b.cap.toLocaleString("en-GB")}-capacity ground${b.km > 3 ? `, ${b.km} km from the old one` : ""}${lost ? `; about ${Math.round(lost * 100)}% of their support won't follow` : ""}.`, c.lg === my().lg);
}
const ownStyle = c => OWNER_STYLES[(c.own || {}).style || "local"];
// What an AI club recruits to: its division and standing, plus what its owner will spend.
function clubStandard(c) { const S = ownStyle(c), rich = clamp(Math.log10(Math.max(1, c.own.wealth) / 1e6) / 3, 0, 1.3); return TIER_LVL[c.tier] + ((G.lvlAdj || [])[c.tier] || 0) + (c.rep - TIER_REP[c.tier]) * (c.tier === 1 ? .45 : .7) + S.spend * (S.spend > 0 ? rich : 1) - (c.ded ? 2 : 0) - (c.cut ? 2.5 : 0) + (c.push && lossTol(c) > .3 ? 1 : 0) - (1 - squeeze(c)) * 8 + (c.chase ? 2 : 0) + clamp((c.feeAvg || 0) / Math.max(1, aiIncome(c)) * 10, 0, 2) - (c.abroad || !c.own ? 0 : clamp((aiBill(c) / Math.max(1, aiBudget(c)) - 1.05) * 12, 0, 6)); }  // a wage bill beyond the budget: he aims lower until it's back in line  // transfer profit is reinvested in the squad

/* Each summer: owners build, spend, sometimes go bust, sometimes sell up. */
// A former player's managers are his old teammates: picked for loyalty, not ability.
// Owners who spend hire better staff and pay above the going rate; tight owners hire cheaper and pay below it.
// What an AI club pays: the going rate scaled by its pay level (set each summer from what it can afford). Clubs abroad
// pay by their owner's spending.
const aiWage = (p, c) => Math.min(500e3 * 52, Math.round(wageAt(p.ovr, c.abroad ? 1 : c.tier) * (c.abroad ? clamp(1 + ownStyle(c).spend * .05, .78, 1.3) : (c.pay ?? 1) * ((G.wInf || [])[c.tier] || 1)) / 100) * 100);  // nobody earns more than €500k a week
/* ---------- AI club money ----------
   Every AI club has a wage budget: on average what a club like yours spends in that division, less under a tight owner,
   more under a spender, and more again while promotion is in reach. The owner covers any loss from his own fortune, up to
   what he'll stand: some won't lose a cent, some will lose a lot. Lose more than that and he orders cuts; run out of money
   and he has to sell, or the club goes into administration. */
// The going wage budget in each division: what its clubs actually pay, worked out afresh each summer.
function calcTierW() { const w = [0]; for (let t = 1; t <= 7; t++) { const cs = G.clubs.filter(c => !c.gone && !c.abroad && c.tier === t && !isMine(c)); w[t] = cs.length ? Math.round(avg(cs.map(aiBill)) / 1e4) * 1e4 : Math.round(24 * wageFor(TIER_LVL[t]) / 1e4) * 1e4; } return w; }
const tierWages = t => (G.tierW ||= calcTierW())[t];
// AI staff pay by skill: each coach against what's normal for an AI coach of his club's standing (same 25%-per-10 rule).
const r200s = v => to20(staffEq(v)) * 10;
const aiCoachPayF = x => x.coach ? clamp(Math.pow(1.25, (r200s((x.coach.tac + x.coach.dev) / 2) - r200s(aiStaffLvl(x.rep))) / 10), .5, 2) : 1;
const aiYouthPayF = x => clamp(Math.pow(1.25, (r200s(aiYouthScout(x)) - r200s(YSCOUT_T[x.tier] + youthPedigree(x) * 3)) / 10), .5, 2);
function aiEstimate(x) {
  const S = x.own ? OWNER_STYLES[x.own.style] : {}, ticket = Math.max(3, Math.round(ticketRef(x) * (S.prices || 1)));
  const pf = priceFactor(ticket, ticketRef(x), 1.3 + fanShare(x, "comm") * .8), sw = 1 + fanShare(x, "loyal") * .15 + fanShare(x, "fair") * (x.push ? .3 : -.15);
  const att = Math.round(Math.min(x.cap || 1e9, (x.fans * .8 * pf + x.fans * .35 * pf * .9) * sw * (1 + .1 * honey(x)) * LOC(x).att));
  const staff = staffWage("manager", x.rep) * aiCoachPayF(x) + staffWage("youth", x.rep) * aiYouthPayF(x) + staffWage("recruit", x.rep);
  const comm = COMM_T[x.tier] * (.6 + x.rep / 60) * Math.sqrt(Math.max(.15, x.fans / FAN_T[x.tier])) * (1 + (S.media || 0) * .02);
  const merch = x.fans * .007 * 52 * REF_SHIRT[x.tier] * .55 * clubPop(x);  // a year's shirt profit: supporters times popularity
  return { ticket, att, staff, comm, merch };
}
// A season's income: TV, the gate (plus bar and shop), sponsors.
// (plus a little for cup runs, merit money and selling players).
function aiIncome(c) { const e = aiEstimate(c); return (TV[c.tier] + paraOf(c) / 1.08 + e.att * e.ticket * 23 * 1.35 + e.comm + e.merch) * 1.08; }
const aiBill = c => sum(c.squad, id => { const p = G.players[id]; return p && !p.acad ? p.wage : 0; });
const aiOps = c => aiEstimate(c).att * REF_TICKET[c.tier] * 23 * MD_OPS;  // match-day operations
// Travel, utilities, insurance and medical bills, and grading works on arriving in a new division.
const aiExtra = c => TRAVEL[c.tier] * 23 + 6000 + (c.cap || 0) * 6 + (c.cap || 0) * 40 * (ageUpF(G.year - aiOpened(c)) - 1) + 4000 * (c.train || 0) + aiBill(c) * INSURE * .7 + MED[c.tier] * 4 + (c.upNow ? gradingCost(c, c.tier) : 0);
// Debt: interest and repayments of about a tenth of what's owed a year (a 25-year stadium loan, roughly).
const aiDebtService = c => (c.debt || 0) * .1;
// Transfer fees, spread over contracts (amortisation): about a tenth of the squad's value a year in the Premier, less further down. At the top this is
// where much of the money goes, so clubs pay players close to the going rate rather than inflating wages.
const AMORT = [0, .07, .04, .02, .01, 0, 0, 0];  // transfer spending matters most at the top
const aiAmort = c => sum(c.squad, id => { const p = G.players[id]; return p && !p.acad && !p.loan ? valueOf(p) : 0; }) * AMORT[c.tier];
const aiCosts = c => aiBill(c) + aiEstimate(c).staff + tierWages(c.tier) * .12 + aiOps(c) + aiExtra(c) + aiDebtService(c) + aiAmort(c);  // wages, staff, ground and running costs
const lossTol = c => { const o = c.own || {}; if (o.tol == null) o.tol = Math.round(((OWNER_STYLES[o.style || "local"].loss || 0) + normal() * .1) * 100) / 100; return o.tol; };
/* Every club budgets to break even: its wage budget is what its income leaves after staff, running and match-day costs.
   The owner then bends it: a profit-seeker budgets for a surplus, a spender for a loss (his tolerance), more again while
   chasing promotion, less while cutting back. A big following, a good ground or a strong commercial pull all show up
   as income, so they show up here. */
// Transfer profit helps, but only so far: wages are a commitment for years, and a big sale isn't repeated every season.
const aiAfford = c => Math.max(tierWages(c.tier) * .5, aiIncome(c) + Math.min(Math.max(0, c.feeAvg || 0), aiIncome(c) * .12) - aiEstimate(c).staff - tierWages(c.tier) * .12 - aiOps(c) - aiExtra(c) - aiDebtService(c) - aiAmort(c));
/* What he aims for. Like real football, most clubs spend beyond their means and the owner covers the gap: the planned
   loss (a share of income) is deepest in the First Division, where everyone gambles on promotion, and smallest at the
   top. Careful owners (supporters' trusts, data-driven investors, youth evangelists) plan a small loss; profit-seekers
   plan a surplus; big spenders lose far more. (His tolerance is separate: how far beyond the plan he'll stand before
   ordering cuts.) */
const TIER_LOSS = [0, .12, .52, .42, .37, .42, .32, .27];
const spendTarget = c => { const l = lossTol(c), st = (c.own || {}).style; if (l < 0) return l;
  const t = TIER_LOSS[c.tier] * (["fanowned", "moneyball", "academy"].includes(st) ? .4 : 1) + (l >= .5 ? l * .3 : 0);
  // In the four professional divisions the spending rule caps losses; reckless owners plan past it anyway.
  return c.tier <= 4 && !reckless(c) ? Math.min(t, SPEND_LIMIT - .05) : t; };
function aiBudget(c) { const b = aiAfford(c) * squeeze(c) * (c.chase ? 1.2 : 1) * clamp(1 + spendTarget(c), .7, 2) * (c.cut ? .85 : 1) * (c.push ? 1 + Math.max(0, lossTol(c)) * .2 : 1);
  // The spending rule: in the professional divisions only reckless owners plan to lose more than it allows.
  if (c.cook) { const cap = salaryCap(c.tier); return Math.max(b, isFinite(cap) ? cap : b) * 2; }  // cooking the books: money no object (players still have to want to come)
  return Math.min(c.tier <= 4 && !reckless(c) ? Math.min(b, aiAfford(c) + aiIncome(c) * (SPEND_LIMIT - .12)) : b, salaryCap(c.tier)); }
/* The salary cap, in the Premier Division only: no AI club's wage bill there may go past twice the division's average (set again each summer
   as wages move). Up to it, how much they spend is the owner's call; only an owner cooking the books goes beyond it. */
const CAP_MULT = 2;
const salaryCap = t => t === 1 ? Math.round((tierWages(t) || 1) * CAP_MULT / 1e4) * 1e4 : Infinity;  // the Premier Division only: below it owners spend what they like
// Pay level: the budget against what its squad would cost at the going rate. Wages drift toward it each year.
const aiGoRate = c => sum(c.squad, id => { const p = G.players[id]; return p && !p.acad && !p.loan ? wageAt(p.ovr, c.tier) : 0; });
const payLevel = c => clamp(aiBudget(c) / Math.max(1, aiGoRate(c)), .5, c.tier === 1 ? 1.2 : 1.45);  // Premier pay is held nearer the going rate
// The most he'll lose in a season: more while chasing promotion.
const lossCap = c => aiIncome(c) * lossTol(c) * (c.push ? 1.6 : 1);
/* A new stand or an extension, paid for at the same prices as yours: the owner puts in part, the rest is borrowed.
   An owner who can't find his share, or a club whose borrowing would pass a year's income, doesn't build. */
function aiExpand(c, S = ownStyle(c)) {
  const to = Math.min(aiSite(c), Math.round(c.cap * rf(1.08, 1.25) / 100) * 100), add = to - c.cap; if (add <= 0) return;
  if (aiFund(c, S, Math.round(add * perSeat(to) * 1.1 / 1e4) * 1e4, 1)) c.cap = to;
}
/* Paying for building work. Usually the owner puts in part and the club borrows the rest, keeping its borrowing under
   `lim` years of income. Some owners borrow the whole lot instead (reckless ones often, a careful one rarely, and
   more often when they can't find their share), and then the limit is three years' income (six for a new ground): the debt can drag the
   club down for years and, with a bad run, into administration. Supporters' trusts borrow most of it, never all. */
function aiFund(c, S, cost, lim, allLim = 3) {
  const fan = c.own.style === "fanowned", inc = (c.aiFin && c.aiFin.inc) || aiIncome(c), debt = c.debt || 0;
  const share = fan ? .8 : clamp(.5 + Math.max(0, lossTol(c)) * -.2 + (S.debt || 0) * 1.2, .3, .8), can = fan || c.own.wealth >= cost * (1 - share);
  if (!fan && R() < clamp((S.debt || 0) * 3 + (can ? .05 : .15), 0, .7) && debt + cost <= inc * allLim) { c.debt = Math.round(debt + cost); c.allLoan = (c.allLoan || 0) + 1; return true; }
  if (!can || debt + cost * share > inc * lim) return false;
  if (!fan) c.own.wealth = Math.round(c.own.wealth - cost * (1 - share));
  c.debt = Math.round(debt + cost * share); return true;
}
function aiAccounts(c) {
  const o = c.own, fees = c.tnet || 0, inc = aiIncome(c) + Math.max(0, fees), cost0 = aiCosts(c) + Math.max(0, -fees), pre = inc - cost0, cost = cost0 + (pre > 0 ? pre * TAX : 0), net = inc - cost, fan = o.style === "fanowned";
  c.aiFin = { y: G.year, inc: Math.round(inc), cost: Math.round(cost), net: Math.round(net), fees: Math.round(fees) }; c.tnet = 0;
  c.fee3 = (c.fee3 || []).concat([Math.round(fees)]).slice(-3);  // the last three seasons' net transfer money (wage controller)
  c.feeAvg = Math.round((c.feeAvg || 0) * .5 + fees * .5);  // selling clubs reinvest: recent transfer profit feeds the wage budget (aiAfford)
  if (c.debt) c.debt = Math.max(0, Math.round(c.debt * .955));
  // Under an embargo every spare penny goes to the creditors; it lifts once the debt is down to half a year's income
  // (after a season at least, three at most).
  if (c.emb) { if (net > 0 && c.debt) c.debt = Math.max(0, Math.round(c.debt - net * .8));
    if (G.year > c.emb.y && ((c.debt || 0) <= inc * .5 || G.year >= c.emb.y + 3)) { delete c.emb; if (c.lg === my().lg) news(`${c.name}'s transfer embargo is lifted.`); } }
  // Cooking the books: losses are hidden (false income, deals off the books), so no spending-rule trouble, no cuts, and the
  // owner doesn't seem to be paying. It all goes on the hidden pile that gets him caught.
  if (c.cook) { c.cook.hid += Math.max(0, -net) + Math.max(0, aiBill(c) - salaryCap(c.tier)); c.psr = []; return; }
  { const r = spendRule(c, net, inc); if (r.pen) { c.ded = Math.max(c.ded || 0, r.pen); if (c.lg === my().lg || c.tier === 1) news(`${c.name} are docked ${r.pen} points for breaking the spending rule (losses of ${Math.round(r.ratio * 100)}% of income over three seasons).`, c.lg === my().lg); }
    else if ((r.ratio > SPEND_LIMIT - .15 || aiBill(c) > aiBudget(c) * 1.15) && c.tier <= 4 && !reckless(c)) { c.cut = Math.max(c.cut || 0, 1); ruleSales(c); } }  // near the limit, or wages well past what the club can afford  // the principal comes down a little each year
  // Heavy debt: two years' income or more puts the club at risk of administration.
  if (c.debt > inc * 2 && R() < Math.min(.25, (c.debt / inc - 2) * .05)) { if (failGate("adm")) { administration(c); return; } rescue(c); }
  if (!fan) o.wealth = Math.round(o.wealth + (net < 0 ? net : net * (o.style === "stripper" ? 1 : .25)));
  o.lost = (o.lost || 0) + Math.max(0, -net);
  const here = c.lg === my().lg || (c.half === my().half && Math.abs(c.tier - my().tier) <= 1);
  if (!fan && o.wealth <= 0) {
    // Out of money: a reckless owner takes the club down with him; anyone else finds a buyer.
    if (["gambler", "crypto", "stripper"].includes(o.style) || -net > inc * .5) { if (failGate("adm")) { administration(c); return; } rescue(c); return; }
    if (!failGate("sale")) { rescue(c); return; }
    const old = o.name; takeover(c); c.cut = 0;
    if (here) news(`${old} have run out of money and are forced to sell ${c.name}. ${c.own.name} take over.`, c.lg === my().lg);
    return;
  }
  if (net < 0 && !c.splash && -net > inc * Math.max(0, spendTarget(c)) + Math.max(0, lossCap(c)) + inc * .1) {
    c.cut = 2;
    const p = c.squad.map(P).filter(p => !p.acad && !p.loan).sort((a, b) => b.wage - a.wage)[0], b = p && buyerFor(p, 8);
    if (b && b !== c) { aiTransfer(p, b); p.wage = aiWage(p, b); p.yrs = aiYears(p, b); }
    if (c.lg === my().lg) news(`${o.name} order cuts at ${c.name} after losing ${money(-net)} last season${b && b !== c ? `: ${p.name} is sold to ${b.name}` : ""}.`);
  } else if (c.cut) c.cut--;
}
const lossWord = c => { const t = spendTarget(c); return t < 0 ? "Wants a profit" : t < .08 ? "Keeps losses small" : t < .2 ? "Covers the usual losses" : t < .5 ? "Will lose a lot" : "Money no object"; };
function coachFor(c) { const co = aiCoach(clamp(c.rep + ownStyle(c).spend * 3, 1, 99)); if (c.own && c.own.style === "explayer") { co.tac = Math.max(5, co.tac - ri(8, 18)); co.mate = true; } return co; }
const hostileOf = c => G.clubs.find(x => !x.gone && x.own && x.own.style === "hostile" && x.own.target === c.id);
/* Keeping the divisions where they belong. Clubs top up their squads towards their standard and keep the better players,
   so left alone every division slowly creeps upward. Each summer the standard each division's clubs aim for is nudged
   so the average starter stays on target (shown: Premier 13, First 10, Second 7, Third 6, National 5, North/South 4,
   Regional 2). */
const TIER_XI = [0, 82.5, 73, 66.8, 61.8, 50, 40, 30];
function levelCheck() { G.lvlAdj ||= [0, 0, 0, 0, 0, 0, 0, 0];
  for (let t = 1; t <= 7; t++) { const cs = G.clubs.filter(c => !c.gone && !c.abroad && !isMine(c) && c.tier === t); if (!cs.length) continue;
    // Judged on the season just played (sampled in midwinter, after the summer's comings and goings), not on squads
    // the morning after the season, before the bigger clubs have taken their pick.
    const now = avg(cs.map(c => avg(pickXI(c).map(o => o.p.ovr)))), mid = (G.xiMid || [])[t], xi = mid ? (now + mid * 2) / 3 : now;
    G.lvlAdj[t] = clamp(G.lvlAdj[t] + (TIER_XI[t] - xi) * .35, -14, 12); }
  G.xiMid = null; wageCheck(); }
function levelSample() { G.xiMid = [0]; for (let t = 1; t <= 7; t++) { const cs = G.clubs.filter(c => !c.gone && !c.abroad && !isMine(c) && c.tier === t); G.xiMid[t] = cs.length ? avg(cs.map(c => avg(pickXI(c).map(o => o.p.ovr)))) : 0; } }
/* Wage inflation, division by division: when money pours in (TV, crowds, transfer fees) players' pay rises with it, and
   when a division is bleeding it falls. Each summer AI pay in a division moves so that about three clubs in ten finish
   a season in the black. */
function wageCheck() { G.wInf ||= [1, 1, 1, 1, 1, 1, 1, 1];
  for (let t = 1; t <= 7; t++) { const cs = G.clubs.filter(c => !c.gone && !c.abroad && !isMine(c) && c.tier === t && c.aiFin && c.aiFin.y === G.year - 1); if (cs.length < 6) continue;
    // Judged with player sales averaged over three seasons (a one-off sale counts a third a year, steady selling counts
    // in full); and it moves gently, at most 3% a year, within 0.7 to 1.6 times the going rate.
    const share = cs.filter(c => c.aiFin.net - (c.aiFin.fees || 0) + avg(c.fee3 && c.fee3.length ? c.fee3 : [c.aiFin.fees || 0]) >= 0).length / cs.length, w0 = G.wInf[t], w = clamp(w0 + clamp((share - .3) * .4, -.03, .03), .7, 1.6); if (Math.abs(w - w0) < .005) continue;
    G.wInf[t] = Math.round(w * 1000) / 1000;
    for (const c of G.clubs) if (!c.gone && !c.abroad && !isMine(c) && c.tier === t) for (const id of c.squad) { const p = G.players[id]; if (p && !p.acad && !p.loan) p.wage = Math.min(500e3 * 52, Math.round(p.wage * G.wInf[t] / w0 / 100) * 100); } } }
function ownersSummer() {
  levelCheck();
  G.tierW = calcTierW();
  for (const c of G.clubs) {
    if (c.gone || isMine(c)) continue;
    c.own ||= newOwner(c); const S = ownStyle(c);
    // Building: ground, training ground, academy.
    if (c.build && c.build.left == null && G.year >= c.build.open) aiMoveIn(c);
    // An academy player good enough for the first team gets a professional contract.
    if (!c.abroad) for (const id of c.squad) { const p = G.players[id]; if (p && p.acad && p.age >= 16 && p.ovr >= TIER_LVL[c.tier] - 4) { p.acad = false; p.wage = aiWage(p, c); p.yrs = aiYears(p, c); } }  // builds started before weekly timing
    aiMoveCheck(c);
    // A new stand or an extension: when the ground is mostly full, there's room on the site, and the owner has the
    // appetite (around ten clubs a season across the whole pyramid). Training facilities improve more often.
    if (R() < S.build * .3 && c.cap < aiSite(c) && aiEstimate(c).att >= c.cap * .85 && !c.build && !c.cut && !c.emb) aiExpand(c, S);
    if (R() < S.build) c.train = Math.min(10, c.train + (R() < .5 ? 1 : 0));
    if (c.own.style === "academy" && R() < .5) c.acadLvl = Math.min(10, c.acadLvl + 1);
    if (S.build < .05 && R() < .3) c.train = Math.max(0, c.train - 1);
    // Supporters follow the owner's pricing.
    c.fans = Math.round(c.fans * (1 + (1 - S.prices) * .05 + S.media * .003));
    // Administration: overstretched clubs with reckless owners collapse.
    c.ded = 0;
    const over = c.lvl > TIER_LVL[c.tier] + 3 || c.own.style === "stripper";
    if (over && R() < S.debt && failGate("adm")) administration(c);
    // Takeovers: a few clubs change hands each summer; supporter-owned clubs never do.
    if (c.own.style === "dynasty" && G.year - c.own.since >= 12 && R() < .1) succession(c);
    else if (c.own.style === "crypto" && R() < .15 && failGate("adm")) cryptoCrash(c);
    else if (c.own.style !== "fanowned" && c.own.style !== "hostile" && R() < .035) takeover(c);
    if (c.own.style === "explayer") c.fans = Math.round(c.fans * 1.03);
    { const was = c.crisis && c.crisis.y < G.year, cr = clubSeasonForm(c); if (cr && cr.y === G.year && (c.lg === my().lg || c.tier === 1)) news(`${c.name} head into the season in crisis: ${cr.why}.`); }
    if (!c.abroad && !c.gone) { aiFansSummer(c); aiAccounts(c); if (!c.gone) { c.pay = Math.round(payLevel(c) * 100) / 100; c.tb = aiTransferBudget(c); } }
    c.lvl = clubStandard(c);
  }
  cookSummer();
  hostileCheck();
  aiListings();
}
/* The old man dies: the heir sells, or takes over and wrecks it. */
function succession(c) {
  const fam = c.own.name, where = c.lg === my().lg || c.half === my().half;
  if (R() < .5) { takeover(c); if (where) news(`The death of its patriarch ends ${fam}'s century at ${c.name}: the heir sells to ${c.own.name}.`, true); }
  else { c.own = { ...c.own, style: pick(["gambler", "absentee", "meddler"]), since: G.year, heir: true }; if (where) news(`${fam}'s heir takes charge at ${c.name}, and he isn't his father: ${OWNER_STYLES[c.own.style].l.toLowerCase()}.`, true); }
}
/* Crypto and betting money: there one day, gone the next. */
function cryptoCrash(c) {
  news(`${c.own.name}, the money behind ${c.name}, has collapsed overnight. The club is left with wages it can't pay.`, c.lg === my().lg || c.half === my().half);
  administration(c);
}
/* A hostile neighbour: once you're noticed, a rich owner may buy a nearby club to take you on. One at a time. */
function hostileCheck() {
  const c = my(); if (hostileOf(c) || G.history.length < 2 || c.rep < 8 || R() > .12) return;
  const near = G.clubs.filter(x => !x.gone && !isMine(x) && x.region === c.region && Math.abs(x.tier - c.tier) <= 1 && x.own.style !== "fanowned");
  const x = near.length ? pick(near) : G.clubs.filter(x => !x.gone && !isMine(x) && x.half === c.half && Math.abs(x.tier - c.tier) <= 1 && x.own.style !== "fanowned")[0];
  if (!x) return;
  x.own = newOwner(x, "hostile"); x.own.wealth = Math.max(x.own.wealth, G.owner.wealth * rf(.8, 2)); x.own.target = c.id; x.rep = Math.min(99, x.rep + 3);
  news(`${x.own.name} buys ${x.name} and tells reporters he'll "put ${c.name} in their place". You have a hostile neighbour.`, true); bumpMedia(5);
}
function administration(c) {
  // The club is sold out of administration to a new owner who clears the debts: the embargo lasts about a season.
  c.ded = 10; c.rep = Math.max(1, c.rep - 4); c.emb = { y: G.year }; c.tb = 0; c.debt = 0;
  const best = c.squad.map(P).filter(p => !p.acad && !p.loan).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  for (const p of best) { const b = buyerFor(p, 8, .6); if (b && b !== c) { aiTransfer(p, b, Math.round(aiFee(p) * .6 / 1e4) * 1e4); p.wage = aiWage(p, b); } }  // a fire sale
  const where = c.lg === my().lg || c.half === my().half;
  news(`${c.name} have gone into administration under ${c.own.name}. They start next season on minus ten points and have sold their best players.`, where);
  c.own = newOwner(c, pick(["local", "fanowned", "moneyball", "absentee"])); delete c.splash;
}
function takeover(c) {
  const old = c.own; c.own = newOwner(c); delete c.splash; addHoney(c, "owner");
  if (c.own.style === "sugar" || c.own.style === "celebrity") c.rep = Math.min(99, c.rep + 3);
  if (c.lg === my().lg || (c.half === my().half && Math.abs(c.tier - my().tier) <= 1) || c.own.style === "sugar")
    news(`Takeover: ${c.own.name} buy ${c.name} from ${old.name}. ${OWNER_STYLES[c.own.style].l}: ${OWNER_STYLES[c.own.style].d.split(".")[0].toLowerCase()}.`, c.lg === my().lg);
}
/* Impatient owners sack managers mid-season when the team is in the bottom third. */
function ownersCheck(w) {
  if (![10, 20, 30].includes(w)) return;
  { const c = my(), f = c.fin, inc = ledgerIncome(f), net = inc - (ledgerCosts(f) - f.build - f.acad);
    const r = spendRolling(c, net, inc);
    if (w >= 20 && c.tier <= 4 && inc > 0 && r.ratio > SPEND_LIMIT) news(`Spending rule warning: counting this season so far, you've lost ${Math.round(r.ratio * 100)}% of your income over three seasons. Above 35% at the season's end, the club will be docked points (stadium, training ground and academy spending don't count).`, true); }
  for (const k of LG_KEYS) {
    const t = table(k), n = t.length;
    t.forEach((r, i) => { const c = CL(r.id); if (!isMine(c)) c.push = i < Math.max(2, Math.round(n * .25)); if (isMine(c) || i < n * .66 || !c.own) return;
      if (R() > ownStyle(c).patience * (1.25 - handsOn(c.own) / 200)) { const old = c.coach.name; c.coach = coachFor(c); newBounce(c, true); if (k === my().lg) news(`${c.name} sack ${old}. ${c.coach.name} takes over.`); } });
  }
}
/* Sponsors: a celebrity or billionaire owner nearby hoovers up local sponsorship. */
function sponsorSqueeze(c) {
  const near = G.clubs.filter(x => !x.gone && !isMine(x) && x.own && x.half === c.half && Math.abs(x.tier - c.tier) <= 1 && OWNER_STYLES[x.own.style].media >= 6);
  return Math.max(.6, (near.length ? Math.max(.7, 1 - near.length * .1) : 1) * (hostileOf(c) ? .88 : 1));
}
/* Poaching: ambitious owners above you come for your staff. */
/* Other clubs coming for your staff: rare (about one approach a season across all your staff), aimed at people who are
   good for your level or doing well, and never the same person twice within a year. */
/* How hands-on an owner is (0-100, shown 1-20): from his style, with some personality. A hands-on owner runs through
   managers faster. Yours is how often you've stepped in. */
const HANDS = { meddler: 90, explayer: 70, sugar: 65, hostile: 65, gambler: 60, celebrity: 55, crypto: 55, multiclub: 50, dynasty: 45, academy: 45, local: 40, moneyball: 35, stripper: 30, fanowned: 30, developer: 25, absentee: 5 };
const handsOn = o => o ? (o.hands ??= clamp(Math.round((HANDS[o.style] ?? 40) + normal() * 8), 1, 100)) : 0;
const myHandsOn = () => clamp(Math.round(10 + (G.meddle || 0) * 15), 1, 100);
function poachWeek() {
  const c = my();
  if (G.phase !== "season" || R() > (Object.values(my().staff).some(s => s && s.praised && G.year * 100 + G.week - s.praised < 20) ? .03 : .02)) return;
  const role = pick(["manager", "manager", "recruit", "youth"]), s = staffOf(role); if (!s) return;
  if (G.inbox.some(m => m.key === "poach" && !m.done)) return;
  const now = G.year * 100 + G.week; if (s.poached && now - s.poached < 100) return;  // a year's peace after an approach
  const pos = table(c.lg).findIndex(r => r.id === c.id), doingWell = pos >= 0 && pos < G.leagues[c.lg].clubs.length / 4;
  if (staffAvg(s) < attraction() + 5 && !doingWell && R() > .3) return;  // ordinary staff at an ordinary club rarely draw interest
  s.poached = now;
  // A hostile neighbour can tempt your staff from your division or one below; from below, only with a much bigger wage.
  const h0 = hostileOf(c), h = h0 && h0.tier <= c.tier + 1 ? h0 : null, q = staffAvg(s), suitors = h && R() < .5 ? [h] : G.clubs.filter(x => !x.gone && !isMine(x) && x.own && x.tier < c.tier && OWNER_STYLES[x.own.style].poach > R() && Math.abs(TIER_REP[x.tier] + 15 - q) < 25);
  if (!suitors.length) return;
  // Compensation: what's left of his contract, and a premium on top that rises with how badly they want him.
  const x = pick(suitors), down = x.tier > c.tier, offer = Math.round(s.wage * rf(1.4, 1.8) / 1000) * 1000, comp = Math.round(s.wage * Math.max(1, s.yrs) * (1.1 + OWNER_STYLES[x.own.style].poach * .5 + R() * .3) / 1000) * 1000;
  addChoice("poach", `${x.name} want to talk to ${s.name}`, `${x.own.name} (${OWNER_STYLES[x.own.style].l.toLowerCase()}) want your ${ROLES_STAFF[role].l.toLowerCase()} and offer ${money(comp)} in compensation (${pr(s, "his")} contract has ${Math.max(1, s.yrs)} year${Math.max(1, s.yrs) > 1 ? "s" : ""} left at ${money(s.wage)}). ${x.name} play in the ${LEAGUES[x.lg].name}. ${down ? `It's a step down, so they're offering ${pr(s, "him")} ${money(offer)} a year, ${Math.round((offer / s.wage - 1) * 100)}% more than you pay: for that ${pr(s, "he")}'d go. Refuse and ${pr(s, "he")}'ll be a little put out.` : `${pr(s, "He")}'d like to go; refuse and ${pr(s, "he")}'ll resent it.`}`,
    [`Let ${pr(s, "him")} go for ${money(comp)}`, `Ask for ${money(Math.round(comp * 1.5 / 1000) * 1000)}`, "Refuse"], { role, club: x.id, comp, max: Math.round(comp * rf(1.1, 1.7) / 1000) * 1000 }, 2);
}
DECIDE.poach = (m, i) => {
  const s = staffOf(m.data.role), x = CL(m.data.club); if (!s) return;
  if (i === 1) {  // you ask for half as much again: they pay it if it's within what they'd go to, otherwise they walk away
    const ask = Math.round(m.data.comp * 1.5 / 1000) * 1000;
    if (ask <= m.data.max) { m.data.comp = ask; i = 0; } else { news(`${x.name} won't pay ${money(ask)} for ${s.name} and pull out. ${s.name} stays, a little disappointed.`); trust(m.data.role, -2, null, "A move elsewhere falling through"); return; }
  }
  if (i === 2) i = 1;
  if (i === 0) { if (m.data.role === "manager" && G.mgrWas) G.mgrWas.to = x.id; my().staff[m.data.role] = null; earn("sales", m.data.comp); x.coach.tac = Math.max(x.coach.tac, s.at.tac || s.at.judge || 50); news(`${s.name} leaves for ${x.name}. The club receives ${money(m.data.comp)}.`, true); }
  else trust(m.data.role, x.tier < my().tier ? -6 : -2, x.tier < my().tier ? `is unhappy you blocked ${pr(s, "his")} move to ${x.name}.` : null, "You blocking a move elsewhere");
};

/* AI clubs transfer-list players they can do without: well below the club's standard and out of the side, ageing
   reserves, and (for owners who like to sell) the odd regular. Listed players go cheaper. Refreshed each summer and
   again in January. */
// Every other club, at home and abroad, lists its spare players (and now and then a starter) each summer and January.
function aiListings() {
  for (const c of G.clubs) {
    if ((c.gone && !c.abroad) || isMine(c)) continue;
    const S = ownStyle(c), xi = new Set(pickXI(c).map(o => o.p.id));
    for (const id of c.squad) { const p = P(id); if (p.acad || p.loan) continue;
      const spare = !xi.has(p.id) && (p.ovr < c.lvl - 5 || p.age >= 31);
      p.list = spare ? R() < .5 : xi.has(p.id) ? R() < S.sells * .03 : false; }
  }
}

/* ---------- keeping the top flight open ----------
   Each summer:
   - Stars at a dominant club (two of the last three titles) start wanting a new challenge: some move to a rival or
     abroad. Yours ask for a transfer.
   - Rivals of a dominant club spend to catch up: ambitious owners in the top half of the Premier push for two seasons.
   - Foreign players in their late twenties and thirties sometimes want to go home. AI clubs sell them to a club in
     their country; yours ask you.
   - Breakouts and slumps: a few players suddenly get much better (and their ceiling rises); a few fall off a cliff. */
const titlesRecent = (c, n = 3) => (c.trophies || []).filter(t => t[1] === "Premier Division" && t[0] >= G.year - n).length;
function diversitySummer() {
  // An ageing core: a team whose starters average 30+ is warned about (yours) or reported (rivals in your league).
  for (const c of G.clubs) { if (c.gone || c.abroad || !(c.lg === my().lg || isMine(c))) continue; const a = xiAge(c);
    if (a >= 30) news(isMine(c) ? `Your manager warns that the starting side is ageing (average ${a.toFixed(1)}): the core will decline together unless it's refreshed.` : `${c.name}'s starting side is ageing (average ${a.toFixed(1)}).`, isMine(c)); }
  const top = G.clubs.filter(c => !c.gone && !c.abroad && c.tier === 1), dyn = top.filter(c => titlesRecent(c) >= 2);
  // Stars want a new challenge.
  for (const c of dyn) {
    const stars = c.squad.map(P).filter(p => p && !p.acad && !p.loan && p.age >= 23 && p.age <= 31 && rating200(p.ovr) >= 150).sort((a, b) => b.ovr - a.ovr).slice(0, 5);
    for (const p of stars) {
      if (R() > .3) continue;
      if (isMine(c)) { if (!G.inbox.some(m => m.key === "treq" && !m.done)) addChoice("treq", `${p.name} wants a new challenge`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}. He's won it all here and wants to prove himself somewhere new.`, ["Accept: put him on the transfer list", `Offer a new deal (${pw(newDealWage(p))})`, "Refuse"], { pid: p.id, why: ["a new challenge"] }, 0); continue; }
      const to = pick(G.clubs.filter(x => (!x.gone || x.abroad) && x !== c && !isMine(x) && (x.abroad ? x.lvl >= p.ovr - 8 : x.tier === 1 && titlesRecent(x) < 2 && canAfford(x, aiFee(p)))));
      if (!to) continue;
      aiTransfer(p, to); p.wage = aiWage(p, to); p.yrs = aiYears(p, to);
      if (c.lg === my().lg || to.lg === my().lg || p.ovr >= 85) news(`${p.name} leaves champions ${c.name} for ${to.name}${to.abroad ? ` in ${COUNTRY[to.country].name}` : ""}, looking for a new challenge.`);
    }
  }
  // Rivals spend to catch up.
  if (dyn.length) { const t = table("L1"); t.slice(0, 10).forEach(r => { const x = CL(r.id); if (isMine(x) || dyn.includes(x) || ownStyle(x).spend < 0) return; if (R() < .5) { x.chase = 2; if (x.lg === my().lg) news(`${x.name}'s owner promises to spend whatever it takes to end ${dyn[0].name}'s run.`); } }); }
  for (const c of G.clubs) if (c.chase) c.chase--;
  // Rich owners' statement signings: now and then a billionaire, celebrity or big-spending owner below the Premier lures
  // a star down (or over from a club abroad) on a huge wage. Only money-motivated players, or ones with an affinity for
  // the club, are tempted.
  for (const c of G.clubs) {
    if (c.gone || c.abroad || isMine(c) || c.tier < 2 || !c.own || !["sugar", "celebrity", "crypto", "gambler"].includes(c.own.style) || c.own.wealth < 100e6 * (c.tier <= 3 ? 1 : .3) || R() > .12) continue;
    let pool = Object.values(G.players).filter(p => p.club >= 0 && p.club !== G.club && !p.acad && !p.loan && p.age <= 32 && !(p.stunY > G.year - 4) && p.ovr >= c.lvl + 6 && hugeAsk(p, c) && willJoin(p, c) && CL(p.club) && (!CL(p.club).gone || CL(p.club).abroad));  // stars abroad can be lured too
    if (!pool.length) continue;
    // There are far more stars abroad than at home: draw from England 60% of the time when both have one.
    { const home = pool.filter(p => !CL(p.club).abroad), away = pool.filter(p => CL(p.club).abroad); if (home.length && away.length) pool = R() < .6 ? home : away; }
    const p = pool.sort((a, b) => b.ovr - a.ovr)[ri(0, Math.min(4, pool.length - 1))], from = CL(p.club), wage = Math.min(500e3 * 52, Math.round(hugeWage(p, c) / 100) * 100)  /* statement wages top out at €500k a week */, why = affinity(p, c);
    if (!c.cook && aiBill(c) + wage > salaryCap(c.tier) && !startCooking(c, true)) continue;  // past the cap only by cooking the books
    aiTransfer(p, c); p.wage = wage; p.yrs = aiYears(p, c); p.stunY = G.year; p.stunC = c.id; c.splash = true; if (from.abroad) { if (!foreignSign(from, p.pos)) foreignSquad(from); } else aiSquadCheck(from, true);  // the seller replaces him with whoever it can afford at its own level: bought (with the fee in hand) or free  // the fee comes out of the budget, however far below zero
    if (c.lg === my().lg || from.lg === my().lg || c.tier <= 2) news(`${c.name} stun football: ${p.name} (${p.pos}, ${p.age}, rated ${r20(p.ovr)}) ${from.abroad ? `joins from ${from.name} (${COUNTRY[from.country].name})` : `drops down from ${from.name}`} on ${money(wage / 52)} a week${why ? `. He ${why}` : ""}.`, c.lg === my().lg);
  }
  // Going home.
  for (const c of G.clubs) {
    if (c.gone || c.abroad) continue;
    for (const p of c.squad.map(P)) {
      if (!p || p.acad || p.loan || p.nat === "ENG" || p.age < 28 || R() > .05) continue;
      const home = G.clubs.filter(x => x.abroad && x.country === p.nat && Math.abs(x.lvl - p.ovr) < 12);
      if (isMine(c)) { if (home.length && !G.inbox.some(m => m.key === "homeGo" && !m.done)) addChoice("homeGo", `${p.name} wants to go home`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}. He misses ${NAT_NAME[p.nat] || "home"} and ${pick(home).name} want him. They'd pay about ${money(valueOf(p) * .8)}.`, ["Let him go", "Persuade him to stay"], { pid: p.id, to: pick(home).id }, 0); continue; }
      if (!home.length) continue;
      const to = pick(home); moveTo(p, to); p.wage = aiWage(p, to); p.yrs = aiYears(p, to);
      if (c.lg === my().lg && p.ovr >= TIER_LVL[c.tier]) news(`${p.name} leaves ${c.name} to go home to ${to.name} in ${COUNTRY[to.country].name}.`);
    }
  }
  // Breakouts and slumps.
  for (const p of Object.values(G.players)) breakSlump(p);
}

/* ---------- the spending rule ----------
   In the four professional divisions a club may lose at most 35% of its income over three seasons, however rich its owner
   (stadium, training ground and academy spending don't count). Breaking it costs points next season: 4 for losses up to
   half of income, 8 up to three-quarters, 12 beyond. */
const SPEND_LIMIT = .35;
const spendPenalty = (tier, net, inc) => { if (tier > 4 || net >= 0 || inc <= 0) return 0; const r = -net / inc; return r <= SPEND_LIMIT ? 0 : r <= .5 ? 4 : r <= .75 ? 8 : 12; };
// Judged over the last three seasons together (as real rules are), so one bad year after relegation isn't fatal.
const spendRolling = (c, net, inc) => { const h = (c.psr || []).slice(-2).concat([[net, inc]]), N = h.reduce((s, x) => s + x[0], 0), I = h.reduce((s, x) => s + x[1], 0); return { N, I, ratio: I > 0 ? Math.max(0, -N / I) : 0 }; };
function spendRule(c, net, inc) { const r = spendRolling(c, net, inc), pen = (c.psr || []).length >= 2 ? spendPenalty(c.tier, r.N, r.I) : 0;  // judged once three seasons are on record
  c.psr = pen ? [] : (c.psr || []).concat([[Math.round(net), Math.round(inc)]]).slice(-3);  // a punished club starts afresh
  return { pen, ratio: r.ratio }; }
// A new manager's first four weeks: usually a lift, but about one time in four the players take against him and it's a dip.
const newBounce = (c, afterGames) => { c.bounce = 4; if (afterGames) c.bounceW = true;  // appointed after this week's games: the count starts next week
  c.bounceS = R() < .25 ? -1 : 1; };
/* A season's form for clubs other than yours: most years a little up or down, carrying a bit over from the last; now
   and then a crisis (a dressing-room revolt, a failed rebuild, chaos in the boardroom, a manager who's lost the
   players) that drags even a giant down the table for one to three seasons, or a surprise season when everything
   clicks. In rating points on the match model: a crisis of 3-5 points takes a title side to mid-table. Your club too:
   however good the squad, a season can go wrong (a new manager ends a crisis that came from the last one losing the
   players, and takes the edge off the others). */
const CRISES = ["a dressing-room revolt", "a rebuild that isn't working", "chaos in the boardroom", "a manager who has lost the players", "an injury-ravaged squad", "a cursed season: nothing goes right"];
function clubSeasonForm(c) {
  let sf = (c.sf || 0) * .35 + normal() * 1.5;
  if (c.crisis && c.crisis.left > 0) { sf += c.crisis.v; c.crisis.left--; if (!c.crisis.left) delete c.crisis; }
  else if (R() < .06) { c.crisis = { v: -rf(5, 8), left: ri(0, 2), why: pick(CRISES), y: G.year }; sf += c.crisis.v; if (!c.crisis.left) c.crisis.last = true; }
  else if (R() < .04) { sf += rf(2, 3); c.surge = G.year; }
  c.sf = Math.round(clamp(sf, -9, 4) * 10) / 10; return c.crisis || null;
}
const clubBoost = c => (c.bounce > 0 ? 1.5 * (c.bounceS || 1) : 0) + (c.sf || 0);
const inEurope = c => Object.values(G.cont || {}).some(K => (K.teams || []).includes(c.id));
// The starting XI's average age, and whether it's an ageing core.
const xiAge = c => avg(pickXI(c).map(o => o.p.age));
// Near the limit, a club sells its dearest players until the wage bill is close to what it can afford (three at most).
/* Selling to cut the wage bill: the dearest players go, but only to a club that wants him and can pay. A seller who has
   to sell takes what he can get: well under his value, down to whatever the buyer has left, and if nobody will pay
   anything he's released (the wages are saved, nothing comes in). */
function ruleSales(c) { const bud = aiBudget(c) * 1.15, sold = [];
  for (let i = 0; i < 3; i++) { if (aiBill(c) <= bud) break;
    const p = c.squad.map(P).filter(p => p && !p.acad && !p.loan).sort((a, b) => b.wage - a.wage)[0]; if (!p) break;
    const ask = Math.round(aiFee(p) * rf(.5, .8) / 1e4) * 1e4;
    const fits = G.clubs.filter(x => x !== c && !isMine(x) && (x.abroad || !x.gone) && !(R() < [0, .7, .9][derbyLevel(c, x)]) && Math.abs((x.abroad ? x.lvl : TIER_XI[x.tier]) - p.ovr) < 8 && tbOf(x) > ask * .3 && (x.abroad || aiBill(x) + aiWage(p, x) <= salaryCap(x.tier)));
    const b = fits.length ? pick(fits) : null;
    if (!b) { leaveClub(p); toFreeAgent(p); sold.push(p.name + " (released: nobody would pay for him)"); continue; }
    const fee = Math.min(ask, Math.max(0, Math.round(tbOf(b) / 1e4) * 1e4));
    aiTransfer(p, b, fee); p.wage = aiWage(p, b); p.yrs = aiYears(p, b); sold.push(`${p.name} to ${b.name}${b.abroad ? ` (${COUNTRY[b.country].name})` : ""}${fee ? ` for ${money(fee)}` : " for nothing"}`); }
  if (sold.length && (c.lg === my().lg || c.tier === 1)) news(`${c.name} sell to stay within the spending rule: ${sold.join(", ")}.`); }
const ruleRoom = c => c.abroad || c.tier > 4 || reckless(c) || aiBill(c) <= aiBudget(c) * 1.2;
// Owners who play by their own rules: reckless styles, and any owner who has made a statement signing. They ignore the
// spending rule when planning, never sell to balance the books, and live with what follows: points deductions, debt,
// administration, or running out of money and having to sell the club.
const reckless = c => !!c.cook || ["gambler", "crypto", "hostile"].includes((c.own || {}).style) || !!c.splash;

/* A player's yearly chance of a sudden breakout or slump (see diversitySummer). */
function breakSlump(p) {
  if (p.club === -2) return;
  const r = R(), up = (p.age <= 27 ? .03 : p.age <= 31 ? .012 : .004) * (p.ovr >= 80 ? .5 : 1), down = p.age >= 29 ? .03 + (p.age - 29) * .01 : .012;
  if (r < up || r < up + down) {
    // The swing is measured on the shown scale: up to three points either way (a 10 can become a 13 or a 7), and the
    // player's potential moves by the same amount.
    // Smaller for low-rated players: a full swing from about 10 up, half at 6, a quarter at 4 and below.
    const s = to20(p.ovr), sp = to20(Math.max(p.pot, p.ovr)), d = (r < up ? 1 : -1) * rf(1, 3) * clamp((s - 2) / 8, .25, 1);
    const ovr = clamp(Math.round(from20(clamp(s + d, 1, 20))), 1, 100), pot = clamp(Math.round(from20(clamp(sp + d, 1, 20))), ovr, 100);
    shiftPlayer(p, ovr - p.ovr); p.pot = Math.max(pot, p.ovr);
    if (p.club === G.club) news(r < up ? `${p.name} has had a breakthrough year: he's suddenly much better (now rated ${r20(p.ovr)}), and the coaches think there's more to come.` : `${p.name} has fallen off a cliff: he's lost a lot of his ability (now rated ${r20(p.ovr)}).`, true);
  }
}
/* An AI club's transfer budget for the season (an estimate from its books): a share of income set by how much its owner
   will lose, squeezed while it builds and cut back when ordered to; rich spenders add some of their own fortune, and an
   owner who has made a statement signing doubles it. */
function aiTransferBudget(c) {
  if (c.abroad || !c.own) return 0;
  const S = ownStyle(c), inc = aiIncome(c), lt = Math.max(0, spendTarget(c));
  const own = S.spend > 0 ? Math.min(c.own.wealth * .02 * S.spend / 6, inc * 2) : 0;
  return Math.round((inc * (.12 + lt * .6) + own) * squeeze(c) * (c.cut ? .5 : 1) * (c.splash ? 2 : 1) / 1e4) * 1e4;
}
/* ---------- real transfer budgets ----------
   Each AI club gets its transfer budget (aiTransferBudget) every summer, to last the season. Fees between clubs are paid
   from it: the seller banks the fee in its accounts and adds half of it to its own budget. A club can't bid, buy from
   another club or sign from outside the game beyond what it has left (clubs abroad are not limited). Fees count in the
   year's accounts. */
const tbOf = c => isMine(c) ? Infinity : c.emb ? 0 : c.abroad ? (c.tb ?? (c.tb = foreignBudget(c))) : (c.tb ?? (c.tb = aiTransferBudget(c)));
const canAfford = (c, fee) => tbOf(c) >= fee;
// Fees between clubs shrink down the pyramid: most non-league moves are free or a token payment.
const FEE_TIER = [0, 1, .85, .6, .4, .2, .1, .05];
const aiFee = p => p.club >= 0 ? Math.round(valueOf(p) * (CL(p.club).abroad ? 1 : FEE_TIER[CL(p.club).tier]) * (p.yrs <= 1 && !renewsAI(p) ? .65 : 1) / 1e3) * 1e3 : 0;
function payFee(buyer, seller, fee) {
  NEXT_FEE = fee || 0;  // the move that follows records it
  if (!fee) return;
  if (buyer && !buyer.abroad && !isMine(buyer)) { buyer.tb = tbOf(buyer) - fee; buyer.tnet = (buyer.tnet || 0) - fee; }
  if (seller && !seller.abroad && !isMine(seller)) { seller.tnet = (seller.tnet || 0) + fee; seller.tb = tbOf(seller) + fee * .5; }
  // Clubs abroad keep a transfer budget too: spent on buying, half of any sale added (and counted toward next summer's).
  if (buyer && buyer.abroad) buyer.tb = tbOf(buyer) - fee;
  if (seller && seller.abroad) { seller.tb = tbOf(seller) + fee * .5; seller.fsold = (seller.fsold || 0) + fee; }
}
// An AI-to-AI move with its fee (the seller is wherever he plays now).
function aiTransfer(p, to, fee = aiFee(p)) { const from = p.club >= 0 ? CL(p.club) : null; payFee(to, from, fee); moveTo(p, to); if (!to.abroad && !isMine(to) && p.ovr >= (to.lvl || 0) + 8) addHoney(to, "star", clamp((p.ovr - to.lvl) / 25, .2, .6)); }

/* Clubs going under is rare: about one administration and one forced sale (an owner out of money having to sell) every
   five years across the whole game, each drawn three to seven years after the last. A club in trouble before one is
   due is rescued the hard way instead: the owner cuts back and sells his dearest players, scrapes together enough to
   carry on, and any debt is partly restructured. */
function failGate(kind) {
  const F = (G.failNext ||= {}); if (F[kind] == null) F[kind] = G.year + ri(1, 6);
  if (G.year < F[kind]) return false;
  F[kind] = G.year + ri(3, 7); return true;
}
function rescue(c) {
  c.cut = Math.max(c.cut || 0, 1); if (c.own) c.own.wealth = Math.max(c.own.wealth, Math.round(aiIncome(c) * .25)); if (c.debt) c.debt = Math.round(c.debt * .7);
  ruleSales(c); if (c.lg === my().lg) news(`${c.name}'s owner ${c.own ? c.own.name : ""} is in financial trouble: cuts are ordered and the best-paid players are up for sale.`);
}

/* Cooking the books. Now and then an owner keeps spending past the cap and the spending rule and hides it: false
   income, deals off the books. It holds for a while (the bigger the hole, the sooner it's found, but there's luck in
   it), then it comes out: the club is thrown down to the bottom division, the owner is forced to sell, and the players'
   contracts are torn up. About once every fifteen years across the game; one club at a time. */
function startCooking(c, splash) {
  if (G.cook || G.year < (G.cookNext ??= G.year + ri(3, 9))) return false;
  if (!c || c.gone || c.abroad || isMine(c) || c.tier > 4 || !c.own || c.own.style === "fanowned") return false;
  c.cook = { since: G.year, hid: 0 }; G.cook = c.id; if (splash) c.splash = true; return true;
}
function cookSummer() {
  if (!G.cook) {  // a new one? the reckless and the big spenders are the likeliest
    if (G.year < (G.cookNext ??= G.year + ri(3, 9)) || R() > .35) return;
    const cand = G.clubs.filter(c => !c.gone && !c.abroad && !isMine(c) && c.tier <= 4 && c.own && c.own.style !== "fanowned" && (reckless(c) || lossTol(c) > .3 || ownStyle(c).spend > 2));
    if (cand.length) startCooking(pick(cand)); return;
  }
  const c = CL(G.cook); if (!c || c.gone || !c.cook) { G.cook = null; return; }
  const yrs = G.year - c.cook.since, hole = c.cook.hid / Math.max(1, aiIncome(c));
  if (R() < clamp(.04 + hole * .25 + yrs * .04, .04, .7)) caughtCooking(c);
}
function caughtCooking(c) {
  const from = LEAGUES[c.lg].name, hole = c.cook.hid, old = c.own.name, dest = leagueFor(7, c.half || pick(["N", "S"]));
  // Down to the bottom. The vacancy is filled from the division below by its biggest club, whose place is filled from
  // the one below that, and so on down, where the disgraced club takes the last place.
  const lgFrom = c.lg; let vac = lgFrom, swap = null; G.leagues[lgFrom].clubs = G.leagues[lgFrom].clubs.filter(x => x !== c.id);
  for (let t = c.tier + 1; t <= 7; t++) {
    const half = LEAGUES[vac].half || c.half || pick(["N", "S"]), src = leagueFor(t, half);
    const up = G.leagues[src].clubs.map(CL).filter(x => !isMine(x)).sort((a, b) => b.rep - a.rep)[0]; if (!up) break;
    G.leagues[src].clubs = G.leagues[src].clubs.filter(x => x !== up.id); up.lg = vac; up.tier = LEAGUES[vac].tier; up.half = LEAGUES[vac].half || up.half; G.leagues[vac].clubs.push(up.id);
    if (!swap) swap = up; vac = src;
  }
  const dest2 = LEAGUES[vac].tier === 7 ? vac : dest;
  c.lg = dest2; c.tier = 7; c.half = LEAGUES[dest2].half || c.half; G.leagues[dest2].clubs.push(c.id); delete c.para;
  if (G.qual) for (const k of ["CC", "CS"]) G.qual[k] = (G.qual[k] || []).filter(x => x !== c.id);
  // Contracts torn up: everyone good enough to play higher leaves for nothing; the rest stay on bottom-division terms.
  const gone = []; for (const p of c.squad.map(P).filter(p => p && !p.acad && !p.loan)) { if (p.ovr > TIER_LVL[6] && !(p.loan)) { leaveClub(p); toFreeAgent(p); gone.push(p); } else p.wage = aiWage(p, c); }
  c.rep = Math.max(5, Math.min(c.rep, TIER_REP[5])); c.debt = 0; c.ded = 0; delete c.splash; delete c.cook; c.chase = 0;
  c.own = newOwner(c, pick(["local", "fanowned", "moneyball"])); aiSquadCheck(c, false); c.lvl = clubStandard(c);
  G.cook = null; G.cookNext = G.year + ri(10, 18);
  news(`SCANDAL: ${c.name}'s owner ${old} has been caught cooking the books, hiding about ${money(hole)} of losses. The club is thrown out of the ${from} into the ${LEAGUES[c.lg].name} and ${old} is forced to sell to ${c.own.name}. ${gone.length} players' contracts are torn up and they're free agents${swap ? `; ${swap.name} move up to take the vacant place in the ${from}, and a club from each division below moves up behind them` : ""}.`, true);
}