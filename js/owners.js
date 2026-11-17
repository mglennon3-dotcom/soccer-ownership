/* Rival owners. Every other club has an owner with a style, a fortune and a temper, and the style drives the club:
   how much it spends over its means, how much it builds, how long its managers last, whether it ends up in
   administration, whether it comes after your staff, your players or your sponsors. Clubs change hands in takeovers. */
"use strict";

/* spend: recruiting standard above or below the club's means (rating points out of 100); build: chance a season of
   improving the ground and facilities; patience: how long a manager survives a bad run (0-1); debt: chance a season
   of administration when overstretched; poach: appetite for other clubs' staff and players; media: profile;
   prices: ticket pricing, which moves their supporters; sells: willingness to cash in on stars. */
const OWNER_STYLES = {
  local:     { l: "Lifelong fan",        d: "Grew up on the terraces. Modest money, cheap tickets, loyal to his managers.", spend: 0, build: .25, patience: .9, debt: .01, poach: .1, media: 0, prices: .85, sells: .3, w: 4 },
  sugar:     { l: "Billionaire benefactor", d: "Money no object. Overpays for players and staff, and wants it now.", spend: 6, build: .6, patience: .35, debt: .02, poach: .9, media: 6, prices: 1, sells: .1, w: 1 },
  stripper:  { l: "Asset stripper",      d: "Loads the club with debt, sells the best players, squeezes the fans. Clubs he owns often collapse.", spend: -4, build: 0, patience: .6, debt: .25, poach: .2, media: -2, prices: 1.3, sells: 1, w: 1 },
  moneyball: { l: "Data-driven investor", d: "Buys undervalued players young and sells at the peak. Steady, clever, rarely overspends.", spend: 2, build: .3, patience: .7, debt: .01, poach: .4, media: 0, prices: 1, sells: .8, w: 2 },
  developer: { l: "Property developer",  d: "More interested in the land than the team: new stands, hotels, retail. The squad comes second.", spend: -1, build: .9, patience: .6, debt: .06, poach: .2, media: 1, prices: 1.15, sells: .6, w: 1.5 },
  celebrity: { l: "Celebrity owner",     d: "A famous face. Huge media profile and sponsors flock to him; fans arrive from everywhere.", spend: 3, build: .4, patience: .6, debt: .03, poach: .6, media: 12, prices: 1.05, sells: .4, w: .8 },
  multiclub: { l: "Multi-club group",    d: "One of a network of clubs. Moves players around the group, strong scouting, cold-blooded.", spend: 2, build: .4, patience: .5, debt: .02, poach: .7, media: 2, prices: 1.05, sells: .7, w: 1.2 },
  absentee:  { l: "Absent owner",        d: "Bought the club and lost interest. No investment, nobody answers the phone, slow decline.", spend: -3, build: .02, patience: .8, debt: .05, poach: 0, media: -3, prices: 1.1, sells: .7, w: 2 },
  gambler:   { l: "Reckless gambler",    d: "Spends what he hasn't got. Boom, then bust.", spend: 5, build: .3, patience: .3, debt: .2, poach: .6, media: 3, prices: 1.1, sells: .2, w: 1 },
  fanowned:  { l: "Supporter-owned",     d: "Run by its fans. Cheap tickets, no debt, slow growth, never sold.", spend: -1, build: .2, patience: .85, debt: 0, poach: .05, media: 1, prices: .8, sells: .5, w: 1.5 },
  meddler:   { l: "Meddler",             d: "Picks the team from the directors' box. Sacks managers after three defeats; good staff won't work for him.", spend: 2, build: .25, patience: .1, debt: .05, poach: .5, media: 4, prices: 1.05, sells: .4, w: 1.5 },
  dynasty:   { l: "Old-money dynasty",   d: "The same family for a century. Steady and proud, until the old man dies and the heir takes over: he sells up or runs it into the ground.", spend: 1, build: .3, patience: .75, debt: .03, poach: .3, media: 2, prices: 1, sells: .4, w: 1.2 },
  hostile:   { l: "Hostile neighbour",   d: "Bought the club next door to beat yours. Goes after your staff, your players, your sponsors and your supporters.", spend: 4, build: .5, patience: .4, debt: .04, poach: 1, media: 7, prices: .9, sells: .2, w: 0 },
  crypto:    { l: "Crypto or betting money", d: "Fast money from a crypto exchange or a betting firm. Spends big, and can vanish overnight.", spend: 5, build: .3, patience: .4, debt: .03, poach: .7, media: 4, prices: 1.05, sells: .3, w: .8 },
  explayer:  { l: "Former player",       d: "A club legend who came back as owner. The fans adore him; he hires his old teammates as managers, whether they're any good or not.", spend: 0, build: .25, patience: .75, debt: .02, poach: .2, media: 4, prices: .9, sells: .4, w: 1 },
  academy:   { l: "Youth evangelist",    d: "Believes in the academy above all. Brings players through and sells them on.", spend: -1, build: .3, patience: .8, debt: .01, poach: .3, media: 1, prices: .95, sells: .9, w: 1.5 },
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
const ownStyle = c => OWNER_STYLES[(c.own || {}).style || "local"];
// What an AI club recruits to: its division and standing, plus what its owner will spend.
function clubStandard(c) { const S = ownStyle(c), rich = clamp(Math.log10(Math.max(1, c.own.wealth) / 1e6) / 3, 0, 1.3); return TIER_LVL[c.tier] + (c.rep - TIER_REP[c.tier]) * (c.tier === 1 ? .45 : .7) + S.spend * (S.spend > 0 ? rich : 1) - (c.ded ? 2 : 0); }

/* Each summer: owners build, spend, sometimes go bust, sometimes sell up. */
// A former player's managers are his old teammates: picked for loyalty, not ability.
function coachFor(c) { const co = aiCoach(c.rep); if (c.own && c.own.style === "explayer") { co.tac = Math.max(5, co.tac - ri(8, 18)); co.mate = true; } return co; }
const hostileOf = c => G.clubs.find(x => !x.gone && x.own && x.own.style === "hostile" && x.own.target === c.id);
function ownersSummer() {
  for (const c of G.clubs) {
    if (c.gone || isMine(c)) continue;
    c.own ||= newOwner(c); const S = ownStyle(c);
    // Building: ground, training ground, academy.
    if (R() < S.build) { c.cap = Math.round(c.cap * rf(1.05, 1.2) / 100) * 100; c.train = Math.min(10, c.train + (R() < .5 ? 1 : 0)); }
    if (c.own.style === "academy" && R() < .5) c.acadLvl = Math.min(10, c.acadLvl + 1);
    if (S.build < .05 && R() < .3) c.train = Math.max(0, c.train - 1);
    // Supporters follow the owner's pricing.
    c.fans = Math.round(c.fans * (1 + (1 - S.prices) * .05 + S.media * .003));
    // Administration: overstretched clubs with reckless owners collapse.
    c.ded = 0;
    const over = c.lvl > TIER_LVL[c.tier] + 3 || c.own.style === "stripper";
    if (over && R() < S.debt) administration(c);
    // Takeovers: a few clubs change hands each summer; supporter-owned clubs never do.
    if (c.own.style === "dynasty" && G.year - c.own.since >= 12 && R() < .1) succession(c);
    else if (c.own.style === "crypto" && R() < .15) cryptoCrash(c);
    else if (c.own.style !== "fanowned" && c.own.style !== "hostile" && R() < .035) takeover(c);
    if (c.own.style === "explayer") c.fans = Math.round(c.fans * 1.03);
    c.lvl = clubStandard(c);
  }
  hostileCheck();
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
  c.ded = 10; c.rep = Math.max(1, c.rep - 4);
  const best = c.squad.map(P).filter(p => !p.acad && !p.loan).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  for (const p of best) { const b = buyerFor(p, 8); if (b && b !== c) { moveTo(p, b); p.wage = wageFor(p.ovr); } }
  const where = c.lg === my().lg || c.half === my().half;
  news(`${c.name} have gone into administration under ${c.own.name}. They start next season on minus ten points and have sold their best players.`, where);
  c.own = newOwner(c, pick(["local", "fanowned", "moneyball", "absentee"]));
}
function takeover(c) {
  const old = c.own; c.own = newOwner(c);
  if (c.own.style === "sugar" || c.own.style === "celebrity") c.rep = Math.min(99, c.rep + 3);
  if (c.lg === my().lg || (c.half === my().half && Math.abs(c.tier - my().tier) <= 1) || c.own.style === "sugar")
    news(`Takeover: ${c.own.name} buy ${c.name} from ${old.name}. ${OWNER_STYLES[c.own.style].l}: ${OWNER_STYLES[c.own.style].d.split(".")[0].toLowerCase()}.`, c.lg === my().lg);
}
/* Impatient owners sack managers mid-season when the team is in the bottom third. */
function ownersCheck(w) {
  if (![10, 20, 30].includes(w)) return;
  for (const k of LG_KEYS) {
    const t = table(k), n = t.length;
    t.forEach((r, i) => { const c = CL(r.id); if (isMine(c) || i < n * .66 || !c.own) return;
      if (R() > ownStyle(c).patience) { const old = c.coach.name; c.coach = coachFor(c); if (k === my().lg) news(`${c.name} sack ${old}. ${c.coach.name} takes over.`); } });
  }
}
/* Sponsors: a celebrity or billionaire owner nearby hoovers up local sponsorship. */
function sponsorSqueeze(c) {
  const near = G.clubs.filter(x => !x.gone && !isMine(x) && x.own && x.half === c.half && Math.abs(x.tier - c.tier) <= 1 && OWNER_STYLES[x.own.style].media >= 6);
  return Math.max(.6, (near.length ? Math.max(.7, 1 - near.length * .1) : 1) * (hostileOf(c) ? .88 : 1));
}
/* Poaching: ambitious owners above you come for your staff. */
function poachWeek() {
  const c = my();
  if (G.phase !== "season" || R() > .03) return;
  const role = pick(["manager", "manager", "recruit", "youth"]), s = staffOf(role); if (!s) return;
  if (G.inbox.some(m => m.key === "poach" && !m.done)) return;
  const h = hostileOf(c), q = staffAvg(s), suitors = h && R() < .5 ? [h] : G.clubs.filter(x => !x.gone && !isMine(x) && x.own && x.tier < c.tier && OWNER_STYLES[x.own.style].poach > R() && Math.abs(TIER_REP[x.tier] + 15 - q) < 25);
  if (!suitors.length) return;
  // Compensation: what's left of his contract, and a premium on top that rises with how badly they want him.
  const x = pick(suitors), comp = Math.round(s.wage * Math.max(1, s.yrs) * (1.1 + OWNER_STYLES[x.own.style].poach * .5 + R() * .3) / 1000) * 1000;
  addChoice("poach", `${x.name} want to talk to ${s.name}`, `${x.own.name} (${OWNER_STYLES[x.own.style].l.toLowerCase()}) want your ${ROLES_STAFF[role].l.toLowerCase()} and offer ${money(comp)} in compensation (his contract has ${Math.max(1, s.yrs)} year${Math.max(1, s.yrs) > 1 ? "s" : ""} left at ${money(s.wage)}). ${x.name} play in the ${LEAGUES[x.lg].name}. He'd like to go; refuse and he'll resent it.`,
    ["Let him go", "Refuse"], { role, club: x.id, comp }, 1);
}
DECIDE.poach = (m, i) => {
  const s = staffOf(m.data.role), x = CL(m.data.club); if (!s) return;
  if (i === 0) { my().staff[m.data.role] = null; earn("sales", m.data.comp); x.coach.tac = Math.max(x.coach.tac, s.at.tac || s.at.judge || 50); news(`${s.name} leaves for ${x.name}. The club receives ${money(m.data.comp)}.`, true); }
  else trust(m.data.role, -10, `is unhappy you blocked his move to ${x.name}.`);
};
