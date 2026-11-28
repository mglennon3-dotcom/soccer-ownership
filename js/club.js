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
// Central and merit money are pitched so a typical club, paying typical wages, roughly breaks even.
const TV = [0, 28e6, 18e6, 2e6, 150e3, 84e3, 45e3, 8e3];  // central money per season
const PRIZE_TOP = [0, 12e6, 500e3, 100e3, 50e3, 42e3, 20e3, 6e3];  // merit money for finishing top; scales down the table
/* Match-day operations: stewards, policing, turnstiles, cleaning and ground staff. Every home game costs about 30% of
   the going ticket price per person through the gate, whatever you charge. */
const MD_OPS = .3;
const opsCost = (c, crowd) => Math.round(crowd * REF_TICKET[c.tier] * MD_OPS);

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
  if (i === "home" && S.rebuilding) return;  // the ground is a building site
  if (S.own) S.away = i === "home" ? null : i; else S.host = i;
  c.cap = capacity(c);
}
const ground = c => atHome(c) ? { name: c.fac.stadium.name || `${c.town} Park`, cap: groundCap(c), amen: c.fac.stadium.amen, rent: 0 } : HOSTS[c.fac.stadium.own ? c.fac.stadium.away : c.fac.stadium.host];
const capacity = c => ground(c).cap;
// New stadium: cost per seat rises with size (bigger stands, more seats, more cover).
/* Real-world money, dearer per seat the bigger the ground: about €3,500 a seat for 10,000 (AFC Wimbledon's 9,000 cost
   ~€35M), ~€7,000 for 30,000 (~€210M), ~€15,000 for 52,000 (Everton's cost ~€900M), ~€20,000 for 62,000 (Tottenham's
   cost £1bn, ~€1.2bn), capped at €26,000 a seat (a 90,000 national stadium, ~€2.3bn). */
const perSeat = cap => Math.min(26000, 3000 + 4.4e-6 * cap * cap);
// What a ground is worth on the books, for club valuations (the replacement cost, written down).
const valSeat = cap => 650 + cap * .055;
/* How long building takes, like real life: construction grows with size (about a year for a small ground, nearly four
   for a 60,000 one). A season is 54 weeks. */
const groundWeeks = cap => Math.round(45 + cap / 400);
const planWeeks = () => 0;
const BUILD_SIZES = [1500, 3000, 6000, 12000, 25000, 45000, 65000];
function newStadiumQuote(cap) { return { cap, cost: Math.round((1.5e6 + cap * perSeat(cap)) / 1e4) * 1e4, weeks: groundWeeks(cap), plan: planWeeks(cap) }; }
function expandQuote(c, add) { const cur = c.fac.stadium.cap, to = cur + add; return { add, cost: Math.round(add * perSeat(to) * 1.1 / 1e4) * 1e4, weeks: Math.round(20 + add / 300) }; }
function amenQuote(c) { const l = c.fac.stadium.amen; return l >= 5 ? null : { lvl: l + 1, cost: Math.round(c.fac.stadium.cap * 90 * l * Math.pow(1.6, l) / 1e4) * 1e4 + 50000, weeks: 10 + l * 4 }; }
/* Old grounds cost more to keep up: each stand's upkeep rises after 20 years, about doubling by 100 (repairs, safety
   work, worn concrete and roofs). Rebuilding a stand resets it. */
const ageUpF = yrs => clamp(1 + Math.max(0, yrs - 20) * .012, 1, 2);
const standUpkeepF = S => { const st = Object.entries(standsOf(S)), t = sum(st, ([, x]) => x.cap) || 1; return sum(st, ([k, x]) => x.cap * ageUpF(G.year - standYr(S, k))) / t; };
const stadiumUpkeep = c => { const S = c.fac.stadium; return S.own ? Math.round((S.cap * 22 + S.amen * S.cap * 8) * standUpkeepF(S) + (S.suites || 0) * boxUpkeep(c) + corpSeats(c) * corpUpkeep(c)) : 0; };

/* Training ground and academy: levels 0-10. Level 0 means hired council pitches / no academy at all. */
const facCost = (kind, lvl) => Math.round((kind === "acad" ? 100000 : 80000) * Math.pow(1.85, lvl - 1) / 1e4) * 1e4;
const facWeeks = lvl => 8 + lvl * 5;
const facUpkeep = (kind, lvl) => lvl === 0 ? (kind === "train" ? 20000 : 0) : Math.round((kind === "acad" ? 25000 : 18000) * Math.pow(1.55, lvl - 1));
const FAC_NAME = { train: "Training ground", acad: "Academy" };
const TRAIN_DESC = ["Hired council pitches", "Basic grass pitches and a portacabin", "Floodlit pitches and changing rooms", "A modest training base", "A good base with a gym", "Several pitches, gym and physio", "A modern complex with sports science", "An excellent complex", "A superb complex", "One of the best in the country", "World class"];
const ACAD_DESC = ["No academy", "Evening sessions for local young players", "A small youth set-up", "A recognised academy", "A solid academy", "A good academy", "A category-two academy", "A strong category-two academy", "A category-one academy", "An elite academy", "World class"];

function startBuild(kind, q) {
  const c = my(), block = boardBlocks(q.cost); if (block) { news(block, true); return block; }
  q = { ...q, cost: Math.round(q.cost * buildMult() * (1 - vpt("facilities") * .02) / 1e4) * 1e4, weeks: Math.max(2, Math.round(q.weeks)) };
  if (kind === "stadium") c.fac.stadium.build = { ...q, left: q.weeks, total: q.weeks };
  else c.fac[kind].build = { lvl: q.lvl, cost: q.cost, left: q.weeks, total: q.weeks };
  spend("build", q.cost); if (kind === "stadium") stadiumLoan(q.cost, q.label || "the work");
  news(`Work starts: ${q.label}. ${money(q.cost)}, about ${q.weeks} weeks.`, true);
}
function buildWeek(c) {
  const S = c.fac.stadium;
  if (S.build && S.build.type === "reground" && !S.rebuilding && S.build.total - S.build.left >= (S.build.plan || 0)) { S.rebuilding = true; S.away = S.build.host ?? tempHost(c); c.cap = capacity(c); news(`Planning is approved and ${S.name} closes for rebuilding. Home games move to ${HOSTS[S.away].name}.`, true); }
  if (S.build && --S.build.left <= 0) {
    const b = S.build; S.build = null;
    if (b.type === "new") { S.own = true; S.cap = b.cap; S.site = newSite(b.cap); S.stands = b.stands ? JSON.parse(JSON.stringify(b.stands)) : null; standsOf(S); if (b.family) S.stands[b.family].family = true; if (b.corp) S.stands.W.corp = Math.min(b.corp, Math.floor(S.stands.W.cap * .15)); syncCap(S); S.amen = 2; S.name = b.name; S.pitch = 100; S.ptype = "grass"; S.suites = b.suites || 0; news(`${S.name} is open: ${b.cap.toLocaleString("en-GB")} capacity. ${c.name} have a home of their own.`, true); }
    if (b.type === "new" || b.type === "move" || b.type === "reground") { setHoney(c); moodHit(c, 5); news("The new ground is open: supporters are queuing for tickets, and the excitement should last a couple of seasons.", true); }
    if (b.type === "new") { openGround(S); S.vent = Object.fromEntries((b.vent || []).map(k => [k, { y: G.year }])); S.site = Math.max(S.site, S.cap + usedSpace(S)); if (has(c, "fanzone")) S.popup = false; }
    else if (b.type === "expand") { const st = standsOf(S), side = b.side || Object.keys(st).sort((x, y) => st[x].cap - st[y].cap)[0]; st[side].cap += b.add; st[side].ext = G.year; syncCap(S); news(`The ${SIDES[side]} extension is open (+${b.add.toLocaleString("en-GB")}). Capacity is now ${S.cap.toLocaleString("en-GB")}.`, true); }
    else if (b.type === "rebuild") { const st = standsOf(S), old = st[b.side]; st[b.side] = { cap: b.cap, type: b.to, roof: b.roof, yr: G.year, family: old.family || false, ...(b.side === "W" && old.corp ? { corp: Math.min(old.corp, Math.floor(b.cap * .15)) } : {}) }; syncCap(S); news(`The new ${SIDES[b.side]} is open: ${b.cap.toLocaleString("en-GB")} ${b.to === "terrace" ? "on a terrace" : "seats"}${b.roof ? ", covered" : ", open to the sky"}. Capacity is now ${S.cap.toLocaleString("en-GB")}.`, true); }
    else if (b.type === "move") moveIn(c, b);
    else if (b.type === "reground") { closeGround(S); S.stands = JSON.parse(JSON.stringify(b.stands)); openGround(S); S.vent = Object.fromEntries((b.vent || []).map(k => [k, { y: G.year }])); if (b.family) S.stands[b.family].family = true; if (b.corp) S.stands.W.corp = Math.min(b.corp, Math.floor(S.stands.W.cap * .15)); syncCap(S); if (b.suites != null) S.suites = Math.min(b.suites, Math.floor(S.cap / 250)); S.amen = Math.max(S.amen || 1, 2); S.pitch = 100; if (b.name) S.name = b.name; S.away = null; S.rebuilding = false; news(`${S.name} reopens, rebuilt from the ground up: ${S.cap.toLocaleString("en-GB")} capacity. The club moves back home.`, true); }
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
/* The catchment: how many people live within reach of the ground. A big city region (London above all, then Manchester
   and the North West, Birmingham and the West Midlands) has far more potential supporters than the rural South West
   or East Anglia, and a ground in the city centre or the terraced streets reaches more of them than one in a village
   or out in the country. It scales the support a club can grow to, and how fast it grows. Averages about 1. */
const REGION_POP = { London: 1.6, "North West": 1.3, "West Midlands": 1.25, Yorkshire: 1.1, "South East": 1.1, "East Midlands": .95, "North East": .9, "East Anglia": .8, "South West": .8 };
const LOC_POP = { city: 1.25, inner: 1.15, sub: 1, ind: 1, retail: 1, market: .85, village: .6, rural: .7 };
const catchment = c => (REGION_POP[c.region] ?? (BIG_CITY.has(c.region) ? 1.3 : .95)) * (LOC_POP[locOf(c)] || 1);
const catchWord = c => { const k = catchment(c); return k >= 1.5 ? "a huge catchment" : k >= 1.15 ? "a big catchment" : k >= .9 ? "an average catchment" : k >= .65 ? "a small catchment" : "a tiny catchment"; };
function fanTarget(c) { return (1 + .1 * honey(c)) * FAN_T[c.tier] * (.55 + c.rep / 60) * (.8 + c.mood / 250) * (hostileOf(c) ? .93 : 1) * (1 + commK(c) * .04) * catchment(c); }
function fansWeek(c) {
  const t = fanTarget(c);
  const fam = familyOn(c) ? 1.3 : 1;  // a family stand brings the next generation in
  const up = (1 + fanShare(c, "fair")) * fam, dn = (1 - fanShare(c, "loyal") * .7) * (1 + fanShare(c, "fair") * .8);  // fair-weather swing, loyal stay
  c.fans = Math.max(50, Math.round(c.fans + (t * (fam > 1 ? 1.04 : 1) - c.fans) * (t > c.fans ? .012 * up * Math.sqrt(catchment(c)) : .004 * dn)));  // a small catchment grows more slowly too
}
/* ---------- supporter culture ----------
   Your support is a mix of four kinds (shares add to 100), and it shifts with how the club is run:
   - Hardcore: loud and partisan. A bigger home advantage. Grows with terraces and long, honest seasons.
   - Loyal: stick with you. Bad results hurt the mood less, and the support shrinks more slowly.
   - Fair-weather: come for success. Mood and numbers swing harder both ways. Grows with promotions and titles.
   - Community: local families. Notice prices more; cheap tickets and a family stand win them over. */
const FAN_KINDS = { hard: ["Hardcore", "Loud and partisan: a bigger home advantage."], loyal: ["Loyal", "Stand by the club: bad results hurt less, and they don't drift away."],
  fair: ["Fair-weather", "Come for success: mood and numbers swing harder both ways."], comm: ["Community", "Local families: they want fair prices, and reward cheap tickets and a family stand."] };
const fanMix = c => c.fanMix ||= isMine(c) ? { hard: 20, loyal: 25, fair: 20, comm: 35 } : seedFanMix(c);
const fanShare = (c, k) => fanMix(c)[k] / 100;
const normMix = m => { const t = sum(Object.values(m), x => Math.max(5, x)); for (const k in m) m[k] = Math.round(Math.max(5, m[k]) / t * 100); return m; };
/* Every other club's support has its own character: old clubs have more loyal and hardcore fans, bigger divisions draw
   more fair-weather fans, small-town clubs more families, and the owner leaves his mark. */
function seedFanMix(c) {
  const age = G.year - (c.founded || G.year), st = c.own ? c.own.style : "local", up = 7 - (c.tier || 7);
  const m = { hard: 18 + rf(-8, 14), loyal: 20 + Math.min(12, age / 10) + rf(-6, 8), fair: 12 + up * 2.5 + rf(-6, 8), comm: 32 - up * 2 + rf(-8, 8) };
  if (drawOf(c) >= 1.5) { m.loyal += 8; m.hard += 5; }  // a big old following stays through thin times
  if (st === "fanowned") { m.comm += 10; m.loyal += 6; } if (st === "explayer" || st === "dynasty") m.loyal += 6; if (st === "hostile") m.hard += 8;
  if (["sugar", "celebrity", "crypto"].includes(st)) m.fair += 8; if (st === "local" || st === "academy") m.comm += 4; if (st === "stripper" || st === "absentee") m.loyal -= 4;
  return normMix(m);
}
/* Outliers: a few clubs draw far more support than their division would suggest (a sleeping giant, a famous old
   name, a big city), and a few far less (a village club, a works team). c.draw is that pull, and it lasts. */
const seedDraw = () => { const r = R(); return r < .05 ? Math.round(rf(2, 3.5) * 100) / 100 : r < .1 ? Math.round(rf(.45, .65) * 100) / 100 : Math.round(Math.exp(normal() * .12) * 100) / 100; };
const drawOf = c => c.draw ?? (c.draw = isMine(c) ? 1 : seedDraw());
const drawWord = c => { const d = drawOf(c); return d >= 1.8 ? ["Huge following for the division", "good"] : d >= 1.3 ? ["Big following", "good"] : d <= .7 ? ["Small following", "warn"] : null; };
/* Popularity: a club's standing above or below its division and its media profile. Popular clubs sell more shirts
   (and the more supporters, the more shirts). */
function clubPop(c) {
  const media = isMine(c) ? ((c.media ?? 10) - 10) / 150 : (((OWNER_STYLES[(c.own || {}).style] || {}).media) || 0) * .02;
  return clamp(1 + (c.rep - TIER_REP[c.tier]) / 80, .7, 1.5) * (1 + media);
}
const topFan = c => { const m = fanMix(c); return Object.keys(m).sort((a, b) => m[b] - m[a])[0]; };
/* Each summer an AI club's support moves like yours: promotion brings fair-weather fans and a bigger crowd, relegation
   sends them away and leaves the loyal, steady seasons build loyalty, and the owner's prices move the families. The
   fanbase also drifts toward its division's size: fast for fair-weather support on the way up, slowly for loyal
   support on the way down. */
function aiFansSummer(c) {
  const m = fanMix(c), last = c.lastTier ?? c.tier, up = c.tier < last, down = c.tier > last; c.upNow = up; const pr = (OWNER_STYLES[(c.own || {}).style] || {}).prices || 1;
  if (up) m.fair += 4; if (down) { m.fair -= 4; m.loyal += 2; } if (!up && !down) m.loyal += 1;
  if (pr < .9) m.comm += 2; else if (pr > 1.2) { m.comm -= 2; m.fair += 1; }
  if (c.push) m.fair += 1;
  normMix(m);
  const f = m.fair / 100, l = m.loyal / 100, t = FAN_T[c.tier] * clamp(1 + (c.rep - TIER_REP[c.tier]) / 60, .6, 1.8) * drawOf(c) * catchment(c);
  c.fans = Math.max(50, Math.round(c.fans + (t - c.fans) * (t > c.fans ? .15 * (1 + f) * Math.sqrt(catchment(c)) : .08 * (1 - l * .7) * (1 + f * .8))));
  c.lastTier = c.tier;
}
function moodHit(c, d) {
  if (isMine(c)) d *= d < 0 ? (1 - fanShare(c, "loyal") * .8) * (1 + fanShare(c, "fair") * .8) : 1 + fanShare(c, "fair") * .5;
  c.mood = clamp(c.mood + d, 0, 100);
}
// Each summer the mix shifts a little with the season and the way the club is run.
function fanCultureSummer(c, up, down) {
  const m = fanMix(c), S = c.fac.stadium, r = c.prices.ticket / ticketRef(c), old = { ...m };
  if (up) m.fair += 4; if (down) { m.fair -= 4; m.loyal += 2; }
  if (!up && !down) m.loyal += 1;
  if (c.mood >= 65) m.loyal += 1; if (c.mood < 35) m.fair -= 1;
  if (typeof terraceShare === "function" && S.own && standShare(c, x => x.type === "terrace") > .25) m.hard += 2;
  if (typeof familyOn === "function" && familyOn(c)) m.comm += 2;
  if (r < .9) m.comm += 2; else if (r > 1.2) { m.comm -= 2; m.fair += 1; }
  m.comm += Math.round(commK(c) * 1.5);  // a funded community foundation brings families in
  if (fzK(c) >= 1) { m.hard += 1; m.comm += 1; }  // the fan zone: a louder core and more families
  if (atHome(c) && c.fac.stadium.own) for (const [f, v] of Object.entries(LOC(c).mix)) m[f] = (m[f] || 0) + v;  // where the ground stands
  const t = sum(Object.values(m), x => Math.max(5, x)); for (const k in m) m[k] = Math.round(Math.max(5, m[k]) / t * 100);
  const big = Object.keys(m).sort((a, b) => (m[b] - old[b]) - (m[a] - old[a]))[0];
  if (m[big] - old[big] >= 2) news(`Your support is changing: more ${FAN_KINDS[big][0].toLowerCase()} supporters this year (${m[big]}% now).`);
}
const moodWord = m => m >= 75 ? ["Buoyant", "good"] : m >= 58 ? ["Happy", "good"] : m >= 42 ? ["Steady", ""] : m >= 28 ? ["Restless", "warn"] : ["Angry", "bad"];

/* Attendance: regulars (the fanbase, turning out by mood) plus casual fans, both put off by expensive tickets,
   capped by the ground. A big or local opponent brings more. */
/* A club's going rate for a ticket: its division's typical price, scaled by how many want tickets (supporters against
   seats: a club that sells out could charge more), how big its support is and what kind of fans they are, how big and
   talked-about the club is, and how happy the fans are. About
   two-thirds of the division's price for a small, empty-grounded club, up to nearly double for a sold-out giant. */
// Supporters per seat, against what's normal in his division (the median club, worked out once a season).
const seatsOf = c => Math.max(1, isMine(c) ? capacity(c) : c.cap || 1);
function fansPerSeatNorm(t) {
  const N = (G._fps && G._fps.y === G.year) ? G._fps : (G._fps = { y: G.year });
  return N[t] ??= (() => { const r = G.clubs.filter(c => !c.gone && !c.abroad && c.tier === t).map(c => c.fans / seatsOf(c)).sort((a, b) => a - b); return r.length ? r[r.length >> 1] : 1; })();
}
/* Honeymoons: a spell when supporters are excited and want to be there. More of them come, more want tickets (the going
   rate rises) and the following grows faster, each fading to nothing over its length. The strongest one counts.
     ground:  a new ground opens: full strength, two seasons, and a 3% bump in supporters on the day
     promo:   promotion: 60%, one season, +2% supporters
     owner:   a new owner: 50%, one season, +1% supporters
     star:    a star signing for the club's level: 20-60%, about four months */
const HM = { ground: [1, 2, .03], promo: [.6, 1, .02], owner: [.5, 1, .01], star: [.4, .3, 0] };
const wkIdx = () => G.phase === "summer" ? G.week : G.phase === "playoffs" ? YEAR_TICKS() : SUMMER_WEEKS + G.week;  // the play-offs close the season
function honey(c) {
  if (!c) return 0; if (c.honey && !c.hm) c.hm = [{ k: "ground", s: 1, y: c.honey.y, w: c.honey.w, len: 2 }];
  let best = 0; for (const h of c.hm || []) { const w = (G.year - h.y) * YEAR_TICKS() + wkIdx() - h.w, v = w < 0 ? 0 : h.s * Math.max(0, 1 - w / (YEAR_TICKS() * h.len)); if (v > best) best = v; }
  return best;
}
function addHoney(c, k, s) { const [s0, len, bump] = HM[k]; c.hm = (c.hm || []).filter(h => (G.year - h.y) * YEAR_TICKS() + wkIdx() - h.w < YEAR_TICKS() * h.len && h.k !== k);
  c.hm.push({ k, s: s ?? s0, y: G.year, w: wkIdx(), len }); if (bump) c.fans = Math.round(c.fans * (1 + bump)); }
const setHoney = c => addHoney(c, "ground");
function ticketK(c) {
  const want = c.abroad || !c.tier ? 1 : clamp(Math.sqrt(c.fans / seatsOf(c) / fansPerSeatNorm(c.tier)), .75, 1.45);
  const pop = 1 + (clubPop(c) - 1) * .6, mood = .92 + (c.mood ?? 50) / 600;
  // The size of the support against the division's norm, and who they are: hardcore and loyal fans pay to watch their
  // club, community families notice prices and fair-weather fans drift if it's dear.
  const size = c.abroad || !c.tier ? 1 : clamp(Math.pow(c.fans / FAN_T[c.tier], .12), .85, 1.2);
  const who = 1 + (fanShare(c, "hard") - .2) * .5 + (fanShare(c, "loyal") - .25) * .25 - (fanShare(c, "comm") - .35) * .35 - (fanShare(c, "fair") - .2) * .15;
  return want * pop * mood * size * who * (1 + .15 * honey(c));
}
// Each division centred on its typical price: the middle club pays about that, the rest spread around it.
function ticketNorm(t) {
  const N = (G._tkn && G._tkn.y === G.year) ? G._tkn : (G._tkn = { y: G.year });
  return N[t] ??= (() => { const r = G.clubs.filter(c => !c.gone && !c.abroad && c.tier === t).map(ticketK).sort((a, b) => a - b); return r.length ? r[r.length >> 1] : 1; })();
}
function ticketRef(c) {
  return Math.max(2, Math.round(REF_TICKET[c.tier] * clamp(ticketK(c) / (c.abroad || !c.tier ? 1 : ticketNorm(c.tier)), .65, 1.85)));
}
function priceFactor(price, ref, el = 1.3) { return clamp(Math.pow(ref / Math.max(.5, price), el), 0, 1.35); }
function crowdFor(c, opp, price = c.prices.ticket) {
  const pf = priceFactor(price * (G.sTrust && G.sTrust.u18 ? .93 : 1), ticketRef(c), 1.3 + fanShare(c, "comm") * .8);  // families notice prices
  const turn = Math.min(1, clamp(.5 + c.mood / 250 + terraceShare(c) * .05 + fzK(c) * .03, .35, .95) * (1 + .1 * honey(c))) * pf;
  const draw = opp ? clamp(.85 + (opp.rep - c.rep) / 60 + (opp.half === c.half ? .05 : 0), .8, 1.6) : 1;
  const away = opp ? Math.round(Math.min(opp.fans * .06, 1500 * (8 - c.tier))) : 0;
  const wx = G.wx ? 1 - (1 - wxAt(c).crowd) * openShare(c) : 1, protest = G.sTrust && G.sTrust.protest ? .85 : 1, derby = opp ? [1, 1.15, 1.3][derbyLevel(c, opp)] : 1;
  const loc = atHome(c) ? LOC(c).att * (locOf(c) === "rural" && has(c, "park") ? 1.05 : 1) : 1;  // the setting: transport links (a car park makes up for open country)
  return Math.min(capacity(c), Math.round((c.fans * turn + c.fans * .35 * pf * draw + away) * wx * protest * derby * loc));
}
/* Children (1.2.41): under-12s get in free, 12-18s pay half, on match tickets and season tickets alike. How many come
   depends on the support: about 7% of a crowd under 12 and 8% aged 12-18, more with a community following, more again
   with a family stand. ticketYield is what an average head in the crowd pays, as a share of the adult price. */
const kidShare = c => { const comm = fanShare(c, "comm") || 0, fam = c.fac && familyOn(c) ? 1 : 0; return { u12: .07 + comm * .06 + fam * .04, teen: .08 + comm * .04 + fam * .02 }; };
const ticketYield = c => { const k = kidShare(c); return 1 - k.u12 - k.teen * .5; };
function concessionsFor(c, crowd, price = c.prices.conc) {
  const am = ground(c).amen, buy = clamp(1.6 * Math.pow(REF_CONC[c.tier] / Math.max(.3, price), 1.4), 0, 2.6) * (.65 + am * .12);
  const lc = atHome(c) ? LOC(c).conc : 1, gross = crowd * buy * price * lc, cut = atHome(c) ? 1 : .5;  // a landlord keeps half the bar takings
  // Stock and staff cost about 30% of the going rate an item: very cheap food and drink sells out at a loss.
  return { gross, net: crowd * buy * lc * (price - REF_CONC[c.tier] * .3) * cut };
}
function merchFor(c, price = c.prices.shirt) {  // per week
  const units = commMult() * c.fans * .007 * Math.min(3, Math.pow(REF_SHIRT[c.tier] / Math.max(5, price), 1.7)) * (.8 + c.mood / 250) * merchMult(c) * (familyOn(c) ? 1.12 : 1) * clubPop(c);
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
const stRef = c => Math.round(ticketRef(c) * homeGames(c) * .75 / 5) * 5;
const stPrice = c => c.prices.st ?? stRef(c);
function stDemand(c, price = stPrice(c)) {
  const per = price / homeGames(c), pf = priceFactor(per, ticketRef(c) * .75, 1.6);
  return Math.min(Math.round(capacity(c) * .7), Math.round(c.fans * clamp(.12 + c.mood / 400, .08, .4) * pf));
}
function sellSeasonTickets(c) {
  const n = stDemand(c), price = stPrice(c); c.st = { y: G.year, n, price };
  if (n) { const yld = ticketYield(c); earn("stix", n * price * yld); news(`Season tickets: ${n.toLocaleString("en-GB")} sold at ${money(price)} (children under 12 free, 12-18s half), ${money(n * price * yld)} up front (${Math.round(n / capacity(c) * 100)}% of the ground).`, true); }
  const r = price / Math.max(1, stRef(c)); if (r < .8) moodHit(c, 2); else if (r > 1.3) moodHit(c, -3);
}
// Holders at a league game: most of them turn up.
const stHolders = c => c.st && c.st.y === G.year ? c.st.n : 0;
function matchdayForecast(c, t = c.prices.ticket, k = c.prices.conc) {
  const avgOpp = { rep: c.rep, fans: FAN_T[c.tier], half: "" }, hold = Math.round((G.phase === "summer" ? stDemand(c) : stHolders(c)) * .92);
  const crowd = Math.max(Math.min(capacity(c), hold), crowdFor(c, avgOpp, t)), con = concessionsFor(c, crowd, k);
  return { crowd, gate: Math.max(0, crowd - hold) * t * (1 - .2 * terraceShare(c)) * ticketYield(c), conc: con.net, rent: ground(c).rent + (atHome(c) ? c.fac.stadium.lease || 0 : 0), ops: opsCost(c, crowd), hold };
}

/* ---------- sponsors ---------- */
const SLOTS = {
  fanzone: { l: "Fan zone naming", share: .03, need: c => has(c, "fanzone") },
  shirt: { l: "Front-of-shirt", share: .35 }, kit: { l: "Kit supplier", share: .22 }, sleeve: { l: "Sleeve", share: .1 },
  stadium: { l: "Stadium naming rights", share: .22, need: c => c.fac.stadium.own }, train: { l: "Training ground naming", share: .06, need: c => c.fac.train.lvl >= 2 },
};
// Sponsors' names (made up: a hundred of them), paired with a line of business (BRAND_KIND).
const BRANDS = ["Apex", "Northwind", "Halcyon", "Brightline", "Vantage", "Crestmark", "Silverleaf", "Ironclad", "Bluewater", "Summit", "Kestrel", "Meridian", "Harbour", "Oakridge", "Redline", "Lumen", "Granite", "Fairway", "Beacon", "Sterling", "Ashgrove", "Blackthorn", "Bramblewood", "Castlegate", "Clearwater", "Coldharbour", "Copperfield", "Corrie", "Crownpoint", "Daybreak", "Deepdale", "Driftwood", "Eastgate", "Elmstead", "Emberline", "Evergreen", "Falconer", "Fenwick", "Fieldstone", "Firethorn", "Foxglove", "Frontier", "Glenmoor", "Goldcrest", "Greystone", "Hallmark", "Hartwell", "Hawthorn", "Heathfield", "Highmoor", "Hollybrook", "Horizon", "Inglewood", "Juniper", "Keystone", "Kingsmead", "Lakeside", "Larkspur", "Linden", "Lodestar", "Longbridge", "Marlowe", "Mayfield", "Millbrook", "Moorgate", "Nettlefield", "Northgate", "Oakhurst", "Old Mill", "Orchard", "Paragon", "Pennant", "Pinecrest", "Quayside", "Ravenscroft", "Redbrook", "Riverside", "Rowan", "Saltmarsh", "Sandpiper", "Seaview", "Sentinel", "Shire", "Skylark", "Southbank", "Stonebridge", "Swallowtail", "Thistle", "Thornbury", "Torchlight", "Trident", "Valewood", "Watermark", "Wayfarer", "Westbury", "Whitecliff", "Wildflower", "Willowbrook", "Windmill", "Yeoman"];
const BRAND_KIND = ["Insurance", "Motors", "Energy", "Bank", "Telecom", "Logistics", "Brewery", "Bet", "Homes", "Foods", "Air", "Digital", "Building Society", "Tyres"];
/* Lower down the pyramid most sponsors are local: a garage or a builder in the town, a family firm, the pub. The chance
   a sponsor is local, by division (the Premier Division's are all national brands); kits likewise come from smaller makers. */
const LOCAL_SPONS = [0, 0, .1, .25, .45, .65, .8, .9], LOCAL_KIT = [0, 0, 0, .1, .3, .5, .7, .8];
const LOCAL_TRADE = ["Motors", "Builders", "Roofing", "Plumbing & Heating", "Electrical", "Carpets", "Scaffolding", "Glazing", "Landscaping", "Removals", "Taxis", "Coaches", "Butchers", "Bakery", "Fish & Chips", "Funeral Directors", "Solicitors", "Estate Agents", "Accountants", "Dental Practice", "Opticians", "Garden Centre", "Haulage", "Skip Hire", "Tyres & Exhausts", "Print & Signs", "Farm Supplies", "Building Supplies", "Driving School", "Caravan Park"];
const PUBS = ["The Red Lion", "The Royal Oak", "The White Hart", "The Crown", "The Plough", "The Swan", "The Bell", "The King's Head", "The Black Horse", "The Queen's Arms", "The Fox & Hounds", "The Railway Tavern", "The Golden Lion", "The Wheatsheaf", "The Cricketers"];
function localSponsor(c) {
  const town = c.town || c.name.split(" ")[0], sur = pick(NAMES.ENG[1]), r = R();
  return r < .35 ? `${town} ${pick(LOCAL_TRADE)}` : r < .65 ? `${sur} ${pick(["& Sons", "Bros", "& Co", "Family"])} ${pick(LOCAL_TRADE)}` : r < .85 ? `${sur}'s ${pick(LOCAL_TRADE)}` : `${pick(PUBS)}, ${town}`;
}
const localKit = () => pick(["Matchday Teamwear", "County Kitwear", "Touchline Sports", "Grassroots Kit Co", "Sunday League Sports", "Terrace Teamwear", "Clubhouse Kit", "Local Leisure Sports"]);
const KIT_BRANDS = ["Strider", "Volta", "Kinetic", "Arcus", "Tempo", "Fieldcraft", "Nova Sport", "Pulse", "Sprintline", "Ridge"];
const COMM_T = [0, 27e6, 1.75e6, 400e3, 175e3, 154e3, 80e3, 25e3];  // a typical club's commercial value by tier, per year
// A derby: same area, same division. A grudge match counts as one too: the next game against a club whose owner you've
// fired back at, and every game against one you've feuded with three times or more (a lasting rivalry).
const feudOf = id => { const f = ((G.club != null && my().feud) || {})[id]; return f && (f.g || f.n >= 3) ? f : null; };
const grudge = (c, o) => !!o && !!((isMine(c) && feudOf(o.id)) || (isMine(o) && feudOf(c.id)));
/* Derbies are between genuine neighbours. In the same division: within about 40 km, fierce within about 20 km. Up to
   two divisions apart: within about 25 km (fierce within 12). London, the biggest city, has the most: its clubs are all
   close together. A grudge match counts as a fierce one. Level: 0 none, 1 a local derby, 2 a fierce one. */
/* Derbies are historical: worked out once from where the clubs are (G.derby, pair -> 1 local, 2 fierce), then kept
   whatever divisions the clubs end up in. Hatred runs deep. Neighbours become rivals: within about 40 km of a club in
   the same division (fierce within 20), or within 25 km of one up to two divisions away (fierce within 12). London is
   full of derbies (any two London clubs within two divisions are rivals), so each London club's fiercest are its two nearest (same division counting as nearer). Clubs that
   keep fighting for the title against each other grow into rivals too (see titleRivals). A grudge match is fierce. */
const pairKey = (a, b) => a.id < b.id ? a.id + "-" + b.id : b.id + "-" + a.id;
function geoDerby(c, o) {
  const km = roadKm(c, o), d = Math.abs(c.tier - o.tier);
  if (c.region === "London" && o.region === "London" && d <= 2) return d === 0 ? (km <= 20 ? 2 : 1) : km <= 12 ? 2 : 1;  // one city: every London club within two divisions is at least a local derby
  return d === 0 ? (km <= 20 ? 2 : km <= 40 ? 1 : 0) : d <= 2 ? (km <= 12 ? 2 : km <= 25 ? 1 : 0) : 0;
}
function buildDerbies() {
  const D = G.derby = {}, cs = G.clubs.filter(x => !x.gone && !x.abroad);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = cs[i], b = cs[j]; if (a.region !== b.region && roadKm(a, b) > 40) continue; const l = geoDerby(a, b); if (l) D[pairKey(a, b)] = l; }
  // London: a club's two nearest are fierce, the rest local (a pair stays fierce if either side counts it among its two).
  const lon = cs.filter(x => x.region === "London"), fierce = new Set();
  for (const c of lon) for (const o of lon.filter(o => o !== c && D[pairKey(c, o)]).sort((a, b) => (roadKm(c, a) + Math.abs(a.tier - c.tier) * 10) - (roadKm(c, b) + Math.abs(b.tier - c.tier) * 10)).slice(0, 2)) fierce.add(pairKey(c, o));
  for (const c of lon) for (const o of lon) if (c.id < o.id && D[pairKey(c, o)]) D[pairKey(c, o)] = fierce.has(pairKey(c, o)) ? 2 : 1;
}
function derbyLevel(c, o) {
  if (!o || !c || c === o) return 0; if (grudge(c, o)) return 2; if (c.abroad || o.abroad) return 0;
  if (!G.derby) buildDerbies(); return G.derby[pairKey(c, o)] || 0;
}
/* Title rivals: two clubs finishing in the Premier Division's top three together three times within eight seasons
   become rivals; five times, fierce ones. */
function titleRivals(ids) {
  const top = ids.slice(0, 3).map(CL), T = G.titleRiv ||= {};
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) { const a = top[i], b = top[j], k = pairKey(a, b);
    T[k] = (T[k] || []).filter(y => y > G.year - 8).concat([G.year]); const n = T[k].length, was = (G.derby || {})[k] || 0, now = n >= 5 ? 2 : n >= 3 ? 1 : 0;
    if (now > was) { (G.derby ||= {})[k] = now; if (isMine(a) || isMine(b) || now === 2) news(`${a.name} and ${b.name}: years of fighting for the title have made them ${now === 2 ? "bitter rivals" : "rivals"}.`, isMine(a) || isMine(b)); } }
}
const isDerby = (c, o) => derbyLevel(c, o) > 0;
/* Every competitive result against each club, kept for good (G.h2h[id] = [won, drawn, lost]). */
function h2hAdd(id, res) { const H = (G.h2h ||= {}), r = H[id] ||= [0, 0, 0]; r[res === "W" ? 0 : res === "D" ? 1 : 2]++; }
/* Your derbies, fiercest and nearest first, with why each one is a derby. */
function myDerbies() {
  const c = my(), T = G.titleRiv || {};
  return G.clubs.filter(x => (!x.gone || x.abroad) && !isMine(x) && derbyLevel(c, x) > 0).map(x => {  // a grudge abroad counts too
    const lvl = derbyLevel(c, x), km = x.abroad ? null : roadKm(c, x), title = (T[pairKey(c, x)] || []).length;
    const why = grudge(c, x) ? "Grudge" : x.own && x.own.target === c.id ? "Hostile neighbour" : title >= 3 && !geoDerby(c, x) ? "Title rivals" : c.region === "London" && x.region === "London" ? "London neighbours" : "Neighbours";
    return { x, lvl, km, why, rec: (G.h2h || {})[x.id] || [0, 0, 0] };
  }).sort((a, b) => b.lvl - a.lvl || (a.km ?? 999) - (b.km ?? 999));
}
/* What brands will pay a year: your division, standing, support and mood, and, within a season, how you're doing
   (league position) and how many come through the gate. */
function commercialValue(c) {
  const t = G.leagues[c.lg] && G.leagues[c.lg].tab && G.leagues[c.lg].tab[c.id] && G.leagues[c.lg].tab[c.id].p >= 6 ? table(c.lg) : null;
  const posF = t ? 1 + (.5 - t.findIndex(r => r.id === c.id) / (t.length - 1)) * .3 : 1;  // top +15%, bottom -15%
  const att = (c.att || []).length ? avg(c.att.slice(-8)) : 0, attF = att ? clamp(Math.sqrt(att / Math.max(1, FAN_T[c.tier] * .6)), .8, 1.25) : 1;
  return (1 + vpt("commercial") * .025) * (1 + commK(c) * .03) * mediaMult(c) * commMult() * sponsorSqueeze(c) * COMM_T[c.tier] * (.6 + c.rep / 60) * Math.sqrt(Math.max(.15, c.fans / FAN_T[c.tier])) * (.85 + c.mood / 333) * posF * attF;
}
// How far you've outgrown a deal: what the slot would fetch now against what it pays.
const dealGrowth = (c, d) => commercialValue(c) * SLOTS[d.slot].share / Math.max(1, d.amt);
/* Brands remember a club that walks out on its sponsors. Each deal broken early adds to their wariness (more for more of
   the deal left unpaid); it fades by about 40% each summer. While they're wary, fewer brands make offers, they offer less,
   and they rarely come to you unprompted. */
const brandWary = () => clamp(G.wary || 0, 0, 1);
/* And they remember a good partner. Every deal that runs its full term adds goodwill (it fades by about 30% each summer;
   breaking a deal halves it). With goodwill, brands offer more (up to about 20% more), a fourth brand joins in, brands
   come to you unprompted more often, and a sponsor whose deal has run its course offers to renew at a premium. */
const brandGood = () => clamp(G.goodwill || 0, 0, .6);
const brandMult = () => (1 + brandGood() * .35) * (1 - brandWary() * .35);
function makeOffers(slot) {
  const c = my(), w = brandWary(), base = commercialValue(c) * SLOTS[slot].share * brandMult(), out = [], n = Math.max(1, 3 - Math.round(w * 3) + (brandGood() >= .25 && w < .1 ? 1 : 0));
  // A sponsor whose deal is ending (or has just ended) offers to carry on, a little above the going rate.
  const cur = c.deals.find(d => d.slot === slot && (d.yrs <= 1 || dealGrowth(c, d) >= 1.25)), past = (G.lastBrand || {})[slot], renew = cur ? cur.brand : past && past.y >= G.year - 1 ? past.brand : null;
  if (renew && w < .5) { const yrs = ri(2, 4), amt = Math.round(base * rf(1.05, 1.15) * (1 - (yrs - 1) * .04) / 500) * 500; out.push({ slot, brand: renew, amt, yrs, bonus: Math.round(amt * rf(.15, .4) / 500) * 500, exp: 6, renew: true }); }
  for (let i = 0; i < n; i++) {
    const yrs = ri(1, 4), amt = Math.round(base * rf(.7, 1.12) * (1 - (yrs - 1) * .04) / 500) * 500;  // longer deals pay a little less a year
    const brand = slot === "kit" ? (R() < LOCAL_KIT[c.tier] ? localKit() : pick(KIT_BRANDS)) : R() < LOCAL_SPONS[c.tier] ? localSponsor(c) : pick(BRANDS) + " " + pick(BRAND_KIND);
    out.push({ slot, brand, amt, yrs, bonus: Math.round(amt * rf(.1, .4) / 500) * 500, exp: 6 });
  }
  return out.sort((a, b) => b.amt - a.amt);
}
// Commercial deals are done in the off-season only: offers, signings and replacing a sponsor all wait for pre-season.
const commOpen = () => G.phase === "summer";
function refreshOffers(c, force) {
  if (!commOpen()) return;
  for (const s of Object.keys(SLOTS)) {
    if (SLOTS[s].need && !SLOTS[s].need(c)) continue;
    const deal = c.deals.find(d => d.slot === s), have = c.offers.filter(o => o.slot === s);
    // Offers come when the slot is free, and on request in a deal's last year or once you've outgrown it by a quarter
    // (a new deal replaces the old one from signing). Outgrow it by half and brands come to you.
    const grown = deal && deal.yrs > 0 ? dealGrowth(c, deal) : 0;
    if (((!deal || deal.yrs <= 0) && !have.length) || (force === s && (!deal || deal.yrs <= 1 || grown >= 1.25))) { c.offers = c.offers.filter(o => o.slot !== s).concat(makeOffers(s)); }
    else if (!force && grown >= 1.5 && !have.length && G.phase !== "playoffs" && R() < .08 * (1 - brandWary()) * (1 + brandGood() * 2)) { c.offers = c.offers.concat(makeOffers(s)); news(`Brands have noticed how the club has grown: there are new offers for your ${SLOTS[s].l.toLowerCase()} deal, worth about ${Math.round((grown - 1) * 100)}% more than ${deal.brand} pay.`, true); }
  }
}
/* Breaking a sponsor deal early costs you: half of what it still had to pay (its remaining years, the current one
   counted from where the season is). */
const breakFee = d => { if (!d || d.yrs <= 0) return 0; const left = Math.max(0, d.yrs - 1) + (G.phase === "season" ? 1 - G.week / SEASON_WEEKS : 1); return Math.round(d.amt * left * .5 / 500) * 500; };
function acceptOffer(o) {
  const c = my(), old = c.deals.find(d => d.slot === o.slot && d.yrs > 0), fee = old && old.brand === o.brand ? 0 : breakFee(old);  // renewing with the same brand breaks nothing
  if (old && fee) { spend("breaks", fee); news(`${o.brand} replace ${old.brand}. Breaking ${old.brand}'s deal costs ${money(fee)} in compensation, and other brands take note.`, true);
    const left = fee / Math.max(1, old.amt * .5);  // years of the deal walked out on
    G.wary = clamp((G.wary || 0) + .12 + left * .08, 0, 1); G.goodwill = (G.goodwill || 0) * .5; (G.broken ||= []).unshift({ y: G.year, brand: old.brand, slot: old.slot }); G.broken.length = Math.min(G.broken.length, 10); }
  if (old && old.brand === o.brand && old.yrs > 0) G.goodwill = clamp((G.goodwill || 0) + .05, 0, 1);  // renewing early with a sponsor: a good relationship, never a broken one
  c.deals = c.deals.filter(d => d.slot !== o.slot).concat({ ...o, exp: undefined });
  c.offers = c.offers.filter(x => x.slot !== o.slot);
  if (o.slot === "stadium") c.fac.stadium.name = `The ${o.brand.split(" ")[0]} Stadium`;
  if (G.lastBrand && G.lastBrand[o.slot]) delete G.lastBrand[o.slot];
  news(`${o.brand} ${o.renew ? "renew with a" : "sign a"} ${o.yrs}-year ${SLOTS[o.slot].l.toLowerCase()} deal worth ${money(o.amt)} a year (${money(o.bonus)} bonus for promotion).`, true);
}
const sponsorTotal = c => sum(c.deals, d => d.amt);

/* ---------- the weekly accounts ---------- */
// What the club actually pays its players a year: the squad's wages, less the part of a borrowed player's wage his own
// club still pays, plus the part you still pay for players you've lent out.
const wageBill = c => sum(c.squad, id => P(id).wage) + loanWageAdj(c);
const staffBill = c => sum(Object.values(c.staff).filter(Boolean), s => s.wage);
const upkeep = c => c.fac.stadium.soldOld ? facUpkeep("train", c.fac.train.lvl) + facUpkeep("acad", c.fac.acad.lvl) : upkeepMult() * (stadiumUpkeep(c) + (c.fac.stadium.heat ? heatQuote(c).upkeep : 0)) + ventureUpkeep(c) + facUpkeep("train", c.fac.train.lvl) + facUpkeep("acad", c.fac.acad.lvl);
/* Transfer fees are amortised, as real clubs account for them: the cash goes when you pay, but the accounts (and the
   spending rule) charge the fee in equal parts over his contract, week by week. A new contract spreads what's left over
   the new length. If he's sold, released or leaves, whatever hasn't been charged yet is written off then, so a sale
   shows as the profit or loss against his book value. */
const YEAR_TICKS = () => SUMMER_WEEKS + SEASON_WEEKS;
const yearTick = () => G.phase === "summer" ? G.week : SUMMER_WEEKS + Math.min(G.week, SEASON_WEEKS - 1);
const bookValue = p => (p.am && p.am.book) || 0;
const amortPer = p => bookValue(p) / Math.max(1, (p.yrs || 0) * YEAR_TICKS() - yearTick());
function amortWeek(c) {
  for (const p of c.squad.map(P).concat((G.loanList || []).map(id => G.players[id]).filter(p => p && p.loan && p.loan.from === c.id))) {
    if (!bookValue(p)) continue; const x = Math.min(p.am.book, amortPer(p)); p.am.book -= x; book("amort", x); if (p.am.book < 1) delete p.am; }
}
// He leaves your books (sold, released, retired, gone at the end of his contract): write off what's left.
function amortLeave(p) { if (bookValue(p) && G.club != null) book("writeoff", p.am.book); delete p.am; }
function weeklyAccounts(c) {
  amortWeek(c);
  spend("wages", wageBill(c) / YEAR_TICKS());
  spend("staff", staffBill(c) / YEAR_TICKS());
  spend("fac", upkeep(c) / YEAR_TICKS());
  spend("acad", c.budget.acad / YEAR_TICKS());
  spend("scout", c.budget.scout / YEAR_TICKS());
  spend("util", utilities(c) / YEAR_TICKS()); insureWeek(c); if (G.phase === "season" && fzK(c)) moodHit(c, fzK(c) * .04); if (c.budget.comm) { spend("comm", c.budget.comm / YEAR_TICKS()); moodHit(c, commK(c) * .05); }
  earn("spons", sponsorTotal(c) / YEAR_TICKS());
  earn("merch", merchFor(c));
  ventureBuildWeek(c); earn("events", ventureWeek(c)); concertWeek(c); plotWeek(c); coachBondWeek(c);
  if (G.phase === "season") earn("suites", suitesLet(c) * c.prices.suite / SEASON_WEEKS);
  corpWeek(c);
  if (G.phase === "season") { earn("tv", TV[c.tier] / 46); if (paraOf(c)) earn("para", paraOf(c) / 46); }
  if (c.cash < 0) spend("interest", -c.cash * .1 / YEAR_TICKS());  // an overdraft at 10% a year
  feedersWeek(); loansWeek(c);
}
function homeGameMoney(c, opp, league) {
  const hold = league ? Math.round(stHolders(c) * .92) : 0;  // season-ticket holders at a league game: already paid
  const crowd = Math.max(Math.min(capacity(c), hold), crowdFor(c, opp)), con = concessionsFor(c, crowd), paying = Math.max(0, crowd - hold);
  const tp = c.prices.ticket * (1 - .2 * terraceShare(c)) * ticketYield(c);  // terrace tickets sell a fifth cheaper; children pay less
  if (terraceShare(c)) moodHit(c, terraceShare(c) * .15);
  const pop = fzK(c) === .5 ? fzGame(c, crowd, .5) : 0;
  earn("gate", paying * tp); earn("conc", con.net); earn("events", ventureGame(c, crowd) + pop); spend("rent", ground(c).rent + (atHome(c) ? c.fac.stadium.lease || 0 : 0)); spend("mdops", opsCost(c, crowd));
  // Home games on their own, for the per-game view (the season's gate total also holds away shares and friendly fees).
  const H = (c.hgs ||= { n: 0, crowd: 0, gate: 0, conc: 0, vent: 0, rent: 0 }); H.n++; H.crowd += crowd; H.gate += paying * tp; H.hold = (H.hold || 0) + hold; H.stg = (H.stg || 0) + (league && stHolders(c) ? c.st.n * c.st.price / homeGames(c) : 0); H.conc += con.net; H.vent += ventureGame(c, crowd) + pop; H.ops = (H.ops || 0) + opsCost(c, crowd); H.rent += ground(c).rent;
  // Prices supporters think unfair cost goodwill; cheap tickets earn a little.
  const r = c.prices.ticket / ticketRef(c), cm = 1 + fanShare(c, "comm") * 1.5; if (r > 1.25) moodHit(c, -(r - 1.25) * 3 * cm); else if (r < .8) moodHit(c, .3 * cm);
  c.att = c.att || []; c.att.push(crowd);
  return crowd;
}
const ledgerIncome = f => (f.para || 0) + (f.insclaim || 0) + (f.oldground || 0) + f.gate + (f.stix || 0) + f.conc + (f.suites || 0) + (f.events || 0) + f.merch + f.spons + f.tv + f.prize + f.sales + (f.network || 0);
const ledgerCosts = f => f.wages + f.staff + f.fac + f.rent + (f.mdops || 0) + (f.travel || 0) + (f.refunds || 0) + (f.medical || 0) + (f.insure || 0) + (f.util || 0) + (f.grading || 0) + (f.comm || 0) + (f.tax || 0) + f.acad + f.scout + (f.amort || 0) + (f.writeoff || 0) + f.build + f.interest + (f.dividend || 0) + (f.feeders || 0) + (f.directors || 0) + (f.breaks || 0);

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
// The going rate for a box moves with the club's ticket going rate: when supporters will pay more, so will businesses.
const suiteRef = c => Math.round(REF_SUITE[c.tier] * ticketRef(c) / REF_TICKET[c.tier] / 500) * 500;
function suitesLet(c, price = c.prices.suite) { return Math.min(c.fac.stadium.suites || 0, Math.floor(suiteDemand(c) * priceFactor(price, suiteRef(c), 1.5))); }
/* The price for each that makes the most money, judged on the same forecasts the Prices page shows. Match tickets and
   season tickets stop where supporters start to mind (20% and 30% over the going rate): beyond that the press and the
   supporters complain, their mood suffers every week and the crowds shrink over time. Nothing goes beyond twice the going
   rate (boxes 60% over it): past that the forecasts aren't to be trusted. A match ticket counts the bar as well (a fuller ground buys more), and a
   season ticket the match-day takings it gives up (holders don't pay on the day). */
function bestPrice(c, k) {
  const P = c.prices, keep = { ...P }, G0 = homeGames(c);
  const R = { ticket: [ticketRef(c), 1, 1.2], st: [stRef(c), 5, 1.3], conc: [REF_CONC[c.tier], .5, 2], shirt: [REF_SHIRT[c.tier], 1, 2], suite: [suiteRef(c), 500, 1.6] }[k];
  const val = p => { P[k] = p;
    if (k === "ticket") { const f = matchdayForecast(c, p); return f.gate + f.conc - f.ops; }
    if (k === "st") { const f = matchdayForecast(c); return stDemand(c, p) * p + G0 * (f.gate + f.conc - f.ops); }
    if (k === "conc") return matchdayForecast(c, P.ticket, p).conc;
    if (k === "shirt") return merchFor(c, p);
    return suitesLet(c, p) * p; };
  let best = null, bv = -Infinity;
  for (let i = 0; i <= 240; i++) { const p = Math.max(R[1], Math.round(R[0] * (.25 + (R[2] - .25) * i / 240) / R[1]) * R[1]); const v = val(p); if (v > bv) { bv = v; best = p; } }
  Object.assign(P, keep); return best;
}
/* Building a box: real-world money, about six seasons' rent at the going rate plus the structure (a top-division box
   runs to €1-2M; one at a non-league ground a few tens of thousands). Built with a new ground they cost 15% less.
   Running one (cleaning, catering staff, heating) costs about a twelfth of its rent, at least €1,000 a season. */
const boxCost = (c, cap) => Math.round((20000 + suiteRef(c) * 6 + cap * 2) / 1e3) * 1e3;
const boxUpkeep = c => Math.round(clamp(suiteRef(c) / 12, 1000, 20000));
function suiteQuote(c, n = 4) { const room = suiteMax(c) - (c.fac.stadium.suites || 0); if (room <= 0) return null; n = Math.min(n, room); return { add: n, cost: Math.round(n * boxCost(c, c.fac.stadium.cap) / 1e4) * 1e4, weeks: 10 + n * 2 }; }

/* ---------- pitch size ----------
   Within the laws a ground can mark out a tight pitch or an expansive one. Both teams play on it, but some styles love
   it and some hate it: on a tight pitch long balls and second balls (direct), a compact block (defensive) and pressing
   thrive, while passing and wing play are cramped; an expansive pitch is the reverse, and a pressing side runs itself
   ragged on it. Your players train on it, so a non-standard pitch gives you a small extra edge at home. The top two
   divisions insist on the standard size; the size can only be changed in the summer, when the pitch is marked out
   again, and an expansive pitch needs a little room on the site (the stands sit further back). */
const PSIZE = {
  tight: { l: "Tight", dim: "100 × 64 m", d: "Suits direct, defensive and pressing sides; cramps possession and wing play.",
    m: { direct: .05, defensive: .05, press: .03, possession: -.05, wing: -.06, counter: -.03 }, shut: { direct: .02, defensive: .03 } },
  std: { l: "Standard", dim: "105 × 68 m", d: "The modern norm: no side is favoured.", m: {}, shut: {} },
  wide: { l: "Expansive", dim: "110 × 72 m", d: "Suits possession, wing play and counter-attacks; a pressing side tires and a compact block is stretched.",
    m: { possession: .05, wing: .06, counter: .04, direct: -.03, defensive: -.05, press: -.03 }, shut: {}, room: 600 },
};
const PSIZE_STD_TIER = 2;  // the Premier and First Divisions: standard size only
// The size in force at a ground: yours as set (standard in the top two divisions), everyone else standard.
const psizeOf = c => isMine(c) && atHome(c) && c.fac.stadium.own && c.tier > PSIZE_STD_TIER ? c.fac.stadium.psize || "std" : "std";
const psizeCost = c => Math.round(PITCH.grass.cost(c) * .4 / 1000) * 1000;
const psizeOK = (c, k) => c.fac.stadium.own && c.tier > PSIZE_STD_TIER && G.phase === "summer" && k !== (c.fac.stadium.psize || "std") && (!PSIZE[k].room || siteRoom(c.fac.stadium) >= PSIZE[k].room);
function setPsize(k) {
  const c = my(), S = c.fac.stadium, cost = psizeCost(c); spend("build", cost); S.psize = k;
  news(`The pitch is marked out again: ${PSIZE[k].l.toLowerCase()} (${PSIZE[k].dim}), for ${money(cost)}.`, true);
  // The manager's view: does it suit the way he plays?
  const m = staffOf("manager"); if (m) { const f = (PSIZE[k].m[m.phil] || 0); if (f > 0) trust("manager", 4, `likes the ${PSIZE[k].l.toLowerCase()} pitch: it suits his ${STYLES[m.phil].l.toLowerCase()} football.`);
    else if (f < 0) trust("manager", -5, `isn't happy with the ${PSIZE[k].l.toLowerCase()} pitch: it works against his ${STYLES[m.phil].l.toLowerCase()} football.`); }
}

/* ---------- the pitch ----------
   Your own pitch wears with every home game (a hybrid surface about half as fast) and recovers slowly, faster over
   the summer. A worn pitch blunts passing football at home (and suits direct sides), causes more injuries and annoys supporters, until you
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
  // During the season, a pitch that gets poor (and again if it turns into a mudbath) comes to you as a decision.
  if (G.phase !== "summer" && !S.relay) for (const lim of [50, 35]) if (before >= lim && S.pitch < lim && !G.inbox.some(m => m.key === "relayAsk" && !m.done)) {
    const t = S.ptype || "grass"; addChoice("relayAsk", `The pitch is ${pitchWord(S.pitch)[0].toLowerCase()} (${Math.round(S.pitch)}/100)`, `The groundsman says it will only get worse with every home game: it blunts passing football, causes more injuries and annoys supporters. Re-laying it with ${PITCH[t].l.toLowerCase()} costs ${money(PITCH[t].cost(c))} and takes about three weeks; otherwise it's re-laid in the summer.`,
      [`Re-lay it now (${money(PITCH[t].cost(c))})`, "Wait for the summer"], { type: t }, 1); break; }
  if (pitchWord(before)[0] !== pitchWord(S.pitch)[0] && S.pitch < before && S.pitch < 65) news(`The groundsman reports the pitch is now ${pitchWord(S.pitch)[0].toLowerCase()} (${Math.round(S.pitch)}/100).`, S.pitch < 50);
}
function relayPitch(type, auto) {
  const c = my(), S = c.fac.stadium, cost = PITCH[type].cost(c);
  spend("build", cost); S.relay = { type, left: G.phase === "summer" ? 2 : 3 };
  news(`The pitch is being re-laid with ${PITCH[type].l.toLowerCase()} (${money(cost)})${auto ? " as it is every summer, ready for the new season" : ""}.`, true);
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
  fanzone: { l: "Fan zone", d: "Food, drink, music and big screens outside the ground before kick-off. Fans arrive earlier and spend more (it runs at a small loss at tiny crowds); louder support at home, a little more turnout, more hardcore and family fans, happier supporters, and a naming-rights slot for sponsors.",
    cost: c => 60000 + c.fans * 8 + (c.fac.stadium.cap || 0) * 10, upkeep: c => 3000 + (c.fac.stadium.cap || 0) * 1.5, game: (c, crowd) => fzGame(c, crowd, 1) },
  tenant:{ l: "Tenant team", d: "Rent the ground to a rugby or women's side: weekly rent, but the pitch wears faster.", cost: c => 30000, upkeep: 0,
    week: c => 400 + c.fac.stadium.cap * .35, wear: .9 },
};
const has = (c, k) => !!(c.fac && (c.fac.stadium.vent || {})[k]);
/* The fan zone: a permanent one at your own ground (full effect), or a pop-up you hire at a rented ground (half the
   effect, and the hire costs more per game). What a home game makes from it: fans spending before kick-off, less the
   staff, security and entertainment. */
const fzK = c => !isMine(c) ? 0 : has(c, "fanzone") && atHome(c) ? 1 : c.fac.stadium.popup && !atHome(c) ? .5 : 0;
const fzGame = (c, crowd, k) => Math.round(k * crowd * .35 * REF_CONC[c.tier] * .9 - (k >= 1 ? 150 + crowd * REF_TICKET[c.tier] * .03 : 300 + crowd * REF_TICKET[c.tier] * .04));
/* Land: extras take room on the site, measured in places a stand could have held there. Tours and a tenant team use
   what's already there; suites and corporate seats sit inside the stands. */
const VENT_SPACE = { shop: () => 150, mega: () => 600, park: cap => 300 + cap * .15, conf: () => 800, tours: () => 0, hotel: () => 2500, fanzone: cap => 300 + cap * .03, tenant: () => 0 };
const ventSpace = (k, cap) => Math.round((VENT_SPACE[k] || (() => 0))(cap) / 50) * 50;
const usedSpace = S => sum([...Object.keys(S.vent || {}), ...Object.keys(S.ventB || {})], k => ventSpace(k, S.cap));
const ventureOK = (c, k) => c.fac.stadium.own && !(c.fac.stadium.ventB || {})[k] && (!VENTURES[k].need || VENTURES[k].need(c)) && (has(c, k) || ventSpace(k, c.fac.stadium.cap) <= siteRoom(c.fac.stadium));
// Extras chosen for a ground being designed: priced at 85% (built with the ground), and they need room on the plot.
const designShell = (d, cap) => ({ fac: { stadium: { cap, amen: 3, suites: 0, own: true, vent: Object.fromEntries((d.vent || []).map(k => [k, {}])) } }, fans: my().fans, tier: my().tier, rep: my().rep, trophies: my().trophies, media: my().media });
const designVentCost = (d, cap) => { const sh = designShell(d, cap); return sum(d.vent || [], k => VENTURES[k].cost(sh) * .85); };
const designSpace = (d, cap) => sum(d.vent || [], k => ventSpace(k, cap));
const designVentOK = (d, cap, k) => !VENTURES[k].need || VENTURES[k].need(designShell(d, cap));
/* Ventures take time to build: a tenant team's deal is done in a fortnight, a hotel takes a year. Paid for up front; no
   income (and no upkeep) until it opens. Built with a new ground, they open with it. */
const VENT_WEEKS = { tenant: 2, park: 6, shop: 8, fanzone: 8, tours: 12, conf: 20, mega: 26, hotel: 52 };
const ventBuilding = S => S.ventB || {};
function buildVenture(k) {
  const c = my(), V = VENTURES[k], cost = Math.round(V.cost(c) / 1e4) * 1e4, wk = VENT_WEEKS[k] || 8;
  spend("build", cost); (c.fac.stadium.ventB ||= {})[k] = { left: wk, cost };
  news(`Work starts on the ${V.l.toLowerCase()} (${money(cost)}): it should open in about ${wk} week${wk > 1 ? "s" : ""}.`, true);
}
// Each week: building work moves on, and anything finished opens.
function ventureBuildWeek(c) { const B = c.fac.stadium.ventB; if (!B) return;
  for (const [k, b] of Object.entries(B)) { if (--b.left > 0) continue; delete B[k];
    (c.fac.stadium.vent ||= {})[k] = { y: G.year }; if (k === "fanzone") c.fac.stadium.popup = false; news(`The ${VENTURES[k].l.toLowerCase()} opens at the ground.`, true); } }
function closeVenture(k) { const c = my(); delete c.fac.stadium.vent[k]; news(`${VENTURES[k].l} closes.`); if (k === "fanzone") { moodHit(c, -3); trustRel(-5); } }
const ventUp = (c, k) => typeof VENTURES[k].upkeep === "function" ? VENTURES[k].upkeep(c) : VENTURES[k].upkeep;
const ventureUpkeep = c => sum(Object.keys(c.fac.stadium.vent || {}), k => ventUp(c, k));
const merchMult = c => (has(c, "shop") ? 1.4 : 1) * (has(c, "mega") ? 1.5 : 1);
function ventureWeek(c) {
  if (!c.fac.stadium.own) return 0;
  let t = 0; for (const k of Object.keys(c.fac.stadium.vent || {})) { const V = VENTURES[k]; if (V.week) t += V.week(c); if (V.wear) c.fac.stadium.pitch = Math.max(5, c.fac.stadium.pitch - V.wear * rf(.6, 1.4)); }
  return t;
}
const ventureGame = (c, crowd) => atHome(c) ? sum(Object.keys(c.fac.stadium.vent || {}), k => VENTURES[k].game ? VENTURES[k].game(c, crowd) : 0) : 0;
/* Hiring out the ground: concerts, other sports, fight nights, a charity tournament. Each needs a big enough ground,
   happens at its own time of year, pays by the size of the ground and the club's standing, and wears the pitch (a
   baseball diamond or monster trucks far more than a boxing ring on boards). Set how many of each you want on the
   Ventures tab; they're booked into the year as dates come up. Fees are in line with what real grounds charge. */
const CONCERT_MIN = 15000;
const HIRE = {
  concert: { l: "Summer concerts", d: "Stadium tours by the big acts.", min: 15000, max: 4, when: "summer", wear: [6, 10],
    fee: c => (c.fac.stadium.cap * 9 + 50000) * (.8 + c.rep / 250), news: (c, f) => `A sold-out concert at ${c.fac.stadium.name} earns the club ${money(f)}. The groundsman is less pleased.` },
  boxing: { l: "Boxing fight nights", d: "A world-title fight under the lights: the ring sits on boards, so the pitch barely suffers.", min: 20000, max: 2, when: "any", wear: [1, 3],
    fee: c => c.fac.stadium.cap * 30 * (.8 + c.rep / 250), news: (c, f) => `A world-title fight night at ${c.fac.stadium.name}: ${money(f)} for the club.` },
  rugby: { l: "Rugby internationals and cup finals", d: "The national rugby sides and the big finals need a neutral ground.", min: 25000, max: 3, when: "season", wear: [5, 8],
    fee: c => c.fac.stadium.cap * 14 * (.8 + c.rep / 250), news: (c, f) => `A rugby international fills ${c.fac.stadium.name}: ${money(f)} for the club, and a chewed-up pitch.` },
  nfl: { l: "American football", d: "A regular-season NFL game, played in the autumn. The league only comes to big, modern grounds; good for the club's profile abroad.", min: 55000, max: 2, when: "autumn", wear: [8, 12], tier: 2,
    fee: c => c.fac.stadium.cap * 60 * (.8 + c.rep / 250), after: c => { c.fans = Math.round(c.fans * 1.003); }, news: (c, f) => `An NFL game at ${c.fac.stadium.name} pays the club ${money(f)} and puts the ground on American television.` },
  baseball: { l: "Baseball", d: "A two-game MLB series in the summer. A diamond is dug into the pitch: it takes weeks to recover.", min: 50000, max: 1, when: "summer", wear: [18, 25], tier: 2,
    fee: c => c.fac.stadium.cap * 80 * (.8 + c.rep / 250), news: (c, f) => `Major League Baseball comes to ${c.fac.stadium.name}: ${money(f)} for the club. The infield dirt will take a while to get out of the pitch.` },
  trucks: { l: "Monster trucks and motocross", d: "Ramps, mud and engines. Pays reasonably; the pitch hates it.", min: 15000, max: 1, when: "summer", wear: [15, 22],
    fee: c => c.fac.stadium.cap * 10 * (.8 + c.rep / 250), news: (c, f) => `Monster trucks at ${c.fac.stadium.name}: ${money(f)} for the club, and a pitch that looks like a ploughed field.` },
  charity: { l: "Charity football tournament", d: "Local sides, celebrities and former players. The gate goes to charity: no money for the club, but the supporters and the town love it.", min: 0, max: 1, when: "summer", wear: [3, 5],
    fee: () => 0, after: c => { moodHit(c, 3); trustRel(3); c.fans = Math.round(c.fans * 1.004); },
    news: c => `${c.fac.stadium.name} hosts a charity football tournament. The gate goes to local causes; supporters and the town are delighted.` },
};
const hireFee = (c, k) => Math.round(HIRE[k].fee(c) / 1000) * 1000;
const hireOK = (c, k) => c.fac.stadium.cap >= HIRE[k].min && (!HIRE[k].tier || c.tier <= HIRE[k].tier);
const concertFee = c => hireFee(c, "concert");
// The weeks each kind can be held in: pre-season, the season (not the Christmas fixtures), or the autumn.
const hireWeeks = k => ({ summer: [1, SUMMER_WEEKS - 1, "summer"], season: [3, 40, "season"], autumn: [6, 16, "season"], any: [1, 40, null] })[HIRE[k].when];
/* Loyalty to the manager. Each week a player's bond with the manager grows: faster for a regular in the side, faster
   with a manager who motivates well, slowly for one out of the team, and it frays when he's unsettled. When the manager
   goes (sacked, poached, retired, resigned, replaced), the players closest to him take it hard: the more popular he was
   across the dressing room, the bigger the upheaval: unsettled players, a hit to morale, and some asking to leave,
   especially to follow him to his new club. A new manager starts from nothing. */
const mgrKey = s => s ? `${s.name}|${s.since}` : null;
const mgrPop = c => { const ps = c.squad.map(P).filter(p => p && !p.acad && p.cb && p.cb.k === mgrKey(staffOf("manager"))).sort((a, b) => b.ovr - a.ovr).slice(0, 18); return ps.length ? avg(ps.map(p => p.cb.v)) : 0; };
function coachBondWeek(c) {
  if (G.phase === "summer" && G.week === 0) return;
  const m = staffOf("manager"), k = mgrKey(m), last = G.mgrWas;
  // He's gone (or been replaced): the fallout, once.
  if (last && last.k !== k) mgrFallout(c, last);
  G.mgrWas = m ? { k, name: m.name, him: pr(m, "him"), pop: mgrPop(c), to: null } : null;
  if (!m) return;
  const xi = new Set(pickXI(c).map(o => o.p.id)), mot = clamp(((m.at && m.at.mot) || 50) / 60, .5, 1.6);
  // A manager already in post when this came in: the bonds he's built so far, from how long he's been here.
  // Each player's own affinity for managers: loyal types bond more, and some just click with a manager more than others.
  const aff = p => p.aff ??= Math.round(rf(.4, 1.3) * (.6 + loyaltyOf(p) * .8) * 100) / 100;
  if (!G.cbInit) { G.cbInit = true; const yrs = Math.max(0, G.year - (m.since || G.year)); for (const p of c.squad.map(P)) if (p && !p.acad && !p.cb) p.cb = { k, v: clamp(yrs * (xi.has(p.id) ? .2 : .08) * mot * aff(p), 0, .9) }; }
  for (const p of c.squad.map(P)) { if (!p || p.acad || (p.loan && p.loan.from === c.id)) continue;
    if (!p.cb || p.cb.k !== k) p.cb = { k, v: 0 };
    p.cb.v = clamp(p.cb.v + (xi.has(p.id) ? .01 : .003) * mot * aff(p) - (p.unsettled > 0 ? .01 : 0), 0, 1); }
  G.mgrWas.pop = mgrPop(c);
}
function mgrFallout(c, last) {
  const close = c.squad.map(P).filter(p => p && !p.acad && p.cb && p.cb.k === last.k && p.cb.v >= .5).sort((a, b) => b.cb.v - a.cb.v);
  if (!close.length || last.pop < .25) return;
  const pop = last.pop, dest = last.to != null ? CL(last.to) : null, asked = [];
  c.morale = clamp((c.morale || 55) - Math.round(pop * 18), 20, 95);
  for (const p of close) {
    if (R() > p.cb.v * pop * 1.4) continue;  // close to him, but takes it in his stride
    p.unsettled = Math.max(p.unsettled || 0, Math.round(4 + p.cb.v * 12));
    p.mgrGrief = { t: G.year * 100 + G.week, v: p.cb.v, name: last.name, to: last.to };
    // The closest may ask to leave straight away (to follow him, if he's gone to another club), up to three at once.
    if (asked.length < 3 && !p.req && p.age <= 33 && R() < p.cb.v * pop * (dest ? 1.1 : .7)) { asked.push(p); p.req = G.year;
      const why = dest ? `wanting to follow ${last.name} to ${dest.name}` : `${last.name} leaving`;
      addChoice("treq", `${p.name} hands in a transfer request`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}. He's unhappy about ${why}.`,
        ["Accept: put him on the transfer list", `Offer a new deal (${pw(newDealWage(p))})`, "Refuse", "Ask what it would take to keep him"], { pid: p.id, why: ["the manager leaving"] }, 0); } }
  news(`${last.name}'s departure shakes the dressing room: ${close.length} player${close.length > 1 ? "s were" : " was"} close to ${last.him || "him"}${asked.length ? `, and ${asked.map(p => p.name).join(", ")} ${asked.length > 1 ? "want" : "wants"} to leave` : ""}.${dest ? ` Some would follow ${last.him || "him"} to ${dest.name}.` : ""}`, true);
}
function concertWeek(c) {
  const S = c.fac.stadium; if (!S.own || !atHome(c) || G.phase === "playoffs") return;
  if (S.concerts && !S.hire) { S.hire = { concert: S.concerts }; delete S.concerts; }
  const H = S.hire || {}, D = S.hd ||= {};
  for (const k of Object.keys(H)) {
    const V = HIRE[k]; if (!V || !hireOK(c, k)) continue;
    const [a, b, ph] = hireWeeks(k), want = H[k] || 0, held = D[k] || 0;
    if (held >= want || (ph && G.phase !== ph) || G.week < a || G.week > b) continue;
    // Spread across the window: dates come up at random, but anything still unbooked happens before the window closes.
    const left = b - G.week + 1; if (R() > Math.max(.25, (want - held) / left)) continue;
    const fee = hireFee(c, k); if (fee) earn("events", fee); D[k] = held + 1; S.pitch = Math.max(5, S.pitch - rf(...V.wear)); if (V.after) V.after(c);
    news(V.news(c, fee));
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
/* Building work closes the stand it's on (an extension, roof, conversion or rebuild) until it's finished. */
const closedSide = S => S.build && S.build.side && ["expand", "roof", "convert", "rebuild"].includes(S.build.type) ? S.build.side : null;
const groundCap = c => { const S = c.fac.stadium, shut = closedSide(S); return sum(Object.entries(standsOf(S)), ([k, x]) => k === shut || (x.type === "terrace" && c.tier <= ALL_SEATER) ? 0 : x.cap); };
const closedTerraces = c => c.tier <= ALL_SEATER ? sum(Object.values(standsOf(c.fac.stadium)), x => x.type === "terrace" ? x.cap : 0) : 0;
const standShare = (c, f) => { const l = Object.values(standsOf(c.fac.stadium)), t = sum(l, x => x.cap) || 1; return sum(l.filter(f), x => x.cap) / t; };
const terraceShare = c => atHome(c) && c.fac.stadium.own && c.tier > ALL_SEATER ? standShare(c, x => x.type === "terrace") : 0;
const openShare = c => atHome(c) && c.fac.stadium.own ? standShare(c, x => !x.roof) : .5;
const familyOn = c => atHome(c) && c.fac.stadium.own && Object.values(standsOf(c.fac.stadium)).some(x => x.family);
const corpSeats = c => atHome(c) && c.fac.stadium.own && closedSide(c.fac.stadium) !== "W" ? (standsOf(c.fac.stadium).W || {}).corp || 0 : 0;
/* Hospitality quietens a ground: corporate seats and boxes (about a dozen guests each) take places that would have
   held vocal home supporters. The share of the crowd they make up trims the home advantage a little (a ground that
   is 10% hospitality loses about a tenth of a typical home advantage). */
const hospShare = c => atHome(c) && c.fac.stadium.own ? Math.min(.5, (corpSeats(c) + (c.fac.stadium.suites || 0) * 12) / Math.max(1, c.fac.stadium.cap)) : 0;
const corpMax = c => Math.floor(((standsOf(c.fac.stadium).W || {}).cap || 0) * .15);
const REF_CORP = [0, 9000, 3500, 1800, 1100, 700, 400, 250];  // a corporate seat for the season
/* Fitting a corporate seat: a padded seat plus its share of the lounge, bar and kitchen behind it, real-world money of
   about four seasons' rent (some €36,000 a seat in the top division); 15% less built with a new ground. Each costs about
   a tenth of its rent a season to run (catering staff, hosts). */
const corpCost = c => Math.round(500 + REF_CORP[c.tier] * 4);
const corpUpkeep = c => Math.round(REF_CORP[c.tier] / 10);
const corpLet = c => Math.min(corpSeats(c), Math.floor(suiteDemand(c) * 15));
// Quotes.
function groundQuote(d) {
  const st = Object.values(d.stands), tot = sum(st, x => x.cap || 0);
  const cost = 1.5e6 + sum(st, x => (x.cap || 0) * perSeat(tot) * TYPE_F[x.type] * roofF(x.roof)) + (d.corp || 0) * corpCost(my()) * .85 + (d.suites || 0) * boxCost(my(), tot) * .85 + (d.family ? 25000 : 0);
  return { cap: tot, cost: Math.round((cost + designVentCost(d, tot)) / 1e4) * 1e4, weeks: groundWeeks(tot) + planWeeks(tot), plan: planWeeks(tot), space: tot + designSpace(d, tot), vent: (d.vent || []).slice() };
}
function standQuote(c, side, add) {
  const x = standsOf(c.fac.stadium)[side], to = c.fac.stadium.cap + add;
  return { side, add, cost: Math.round(add * perSeat(to) * TYPE_F[x.type] * roofF(x.roof) * 1.1 / 1e4) * 1e4, weeks: Math.round(20 + add / 300) };
}
/* The site: how big a ground the land will take (access, neighbours, planning), set when the ground is first built
   with room to grow, never more than 90,000. Extensions and rebuilds have to fit on it. */
const SITE_MAX = 90000;
// Some grounds are hemmed in by streets and houses, most have some room, a few sit on plenty of land.
const newSite = cap => { const r = R(), s = r < .25 ? cap * rf(1, 1.1) : r < .75 ? cap * rf(1.2, 1.8) + 1000 : cap * rf(2, 3) + 3000; return clamp(Math.round(s / 500) * 500, cap, SITE_MAX); };
// What work in progress will need when it's finished (grandfathered: a site is never smaller than that).
function buildNeeds(S) {
  const b = S.build; if (!b) return 0; const st = standsOf(S);
  if (b.type === "expand") return S.cap + b.add + usedSpace(S);
  if (b.type === "rebuild") return S.cap - (st[b.side] || {}).cap + b.cap + usedSpace(S);
  if (b.type === "reground") return b.space || b.cap;
  return 0;
}
const siteCap = S => S.site ??= Math.max(S.cap, newSite(S.cap));
const siteRoom = S => Math.max(0, siteCap(S) - S.cap - usedSpace(S));
/* ---------- ground ages ----------
   Every ground has an opening year (and, for yours, each stand its own build year). Your club keeps a history of its
   grounds. AI grounds age too: an old ground is out of date, and its club is likelier to move. */
const groundAge = c => G.year - (isMine(c) ? (c.fac.stadium.opened ?? G.year) : aiOpened(c));
const aiOpened = c => c.opened ??= Math.max(c.founded || G.year - 100, G.year - ri(3, 110));
const standYr = (S, k) => (standsOf(S)[k] || {}).yr ?? S.opened ?? G.year;
function closeGround(S, to) { if (S.own && S.opened != null) (S.hist ||= []).push({ name: S.name, from: S.opened, to: to ?? G.year, cap: S.cap }); }
function openGround(S) { S.opened = G.year; for (const k in standsOf(S)) S.stands[k].yr = G.year; }

/* ---------- moving to a new ground ----------
   When the site is too small, buy land elsewhere and build a new ground there. Three kinds of site: in town near the
   old ground (a bit more room, dear land), the edge of town (plenty of room), or out of town (all the room you could
   want, cheap land, but a long way from your supporters). You keep playing at the old ground while the new one goes
   up; on moving day the old ground's land is sold. Supporters judge the move by distance: a short hop is exciting, a
   long one feels like the club leaving them. Loyal and hardcore fans take it hardest; families drift away. */
// How big a plot each kind of site can offer, as a multiple of your current site (or your support, if that's bigger): town-centre land is scarce (about
// double), the edge of town has room for a good deal more (six to eight times), and out by the bypass there's room for
// anything you want to build (up to the 90,000 limit).
const SITE_KINDS = {
  near: { l: "In town, near the current ground", km: [1, 3], grow: [1.6, 2.2], land: 180 },
  edge: { l: "On the edge of town", km: [4, 9], grow: [6, 8], land: 90 },
  far:  { l: "Out of town, by the bypass", km: [12, 30], grow: [99, 99], land: 35 },
};
function newSites(c) {
  const S = c.fac.stadium; if (G.sites && G.sites.y === G.year && G.sites.club === c.id) return G.sites.list;
  // Sized from the club's stature as well as its ground: a club that has outgrown a small old site finds plots to match
  // its support (whichever is bigger).
  const base = Math.max(siteCap(S), supportSize(c)), cramped = ["city", "inner"].includes(locOf(c));
  // In a crowded city there's little land near the old ground: what's readily for sale in town is little more than the
  // site you have now (you can still buy more, at the price).
  const list = Object.entries(SITE_KINDS).map(([k, K]) => { const site = clamp(Math.round((k === "near" && cramped ? siteCap(S) * rf(1.1, 1.4) : base * rf(...K.grow)) / 500) * 500, siteCap(S) + 1000, SITE_MAX);
    return { k, l: K.l, km: ri(...K.km), site, rate: K.land }; });
  G.sites = { y: G.year, club: c.id, list }; return list;
}
// Plot sizes on offer at a site: from a little more than you have now up to the most the site allows, in steps that
// grow (each about double the last when the range is wide), so a small club sees sensible sizes as well as big ones.
function plotSizes(c, site) {
  const lo = Math.min(site.site, Math.max(c.fac.stadium.cap + 1000, siteCap(c.fac.stadium) + 500)), hi = site.site, n = clamp(Math.ceil(Math.log2(hi / lo)) + 1, 2, 7), out = [];
  for (let i = 0; i < n; i++) out.push(Math.round(lo * Math.pow(hi / lo, i / (n - 1)) / 500) * 500); return [...new Set(out)]; }
/* Planning: a plot much bigger than the club's support needs (more than twice the crowd it could draw) takes longer to
   get through the council, about ten weeks more for each doubling beyond that, and the supporters' trust has doubts. */
const supportSize = c => Math.max(2000, Math.round(c.fans * 1.2));
const planExtra = (c, plot) => { const r = plot / supportSize(c); return r <= 2 ? 0 : Math.round(Math.log2(r / 2) * 10); };
// Land: priced per place the plot can hold, a little dearer per place for a big plot, dearer in the bigger divisions.
/* ---------- where each ground stands ----------
   Eight settings. Each changes what land around the ground costs (land: the local price of town land there; resi: what
   the houses next door cost on top; anger: how much buying them out upsets people), how often vacant land comes up next
   door and what it is, the crowd (att: turnout; parking matters out in the country), the noise (adv: home advantage),
   spending at the ground (conc), and the kind of supporters it draws over time (mix: a yearly nudge). */
const LOCS = {
  city:   { l: "City centre", d: "Offices, shops and flats all round: the best transport links, the dearest land.", land: 1.6, resi: 4, anger: .7, vac: .15, kinds: ["an abandoned warehouse", "a disused car park"], att: 1.05, adv: 0, conc: 1.05, mix: { fair: 1 } },
  inner:  { l: "Inner city, terraced streets", d: "Victorian terraces right up to the stands: a loud, loyal neighbourhood, and clearing houses is bitterly resented.", land: 1.1, resi: 2.5, anger: 1.3, vac: .25, kinds: ["an abandoned warehouse", "an old factory site", "a disused car park"], att: 1, adv: .25, conc: 1, mix: { hard: 1, loyal: 1 } },
  sub:    { l: "Suburban", d: "Semi-detached homes and schools: an ordinary neighbourhood.", land: 1, resi: 2, anger: 1, vac: .3, kinds: ["an empty field", "a disused car park"], att: 1, adv: 0, conc: 1, mix: { comm: 1 } },
  ind:    { l: "Industrial, docks or riverside", d: "Warehouses, rail yards and wasteland: room to grow and parking, but little life around the ground.", land: .8, resi: 1, anger: .3, vac: .7, kinds: ["an abandoned warehouse", "an old factory site", "a disused car park"], att: 1, adv: -.1, conc: .97, mix: { fair: 1 } },
  retail: { l: "Retail park, ring road", d: "Car parks and big-box shops: easy to get to and park, not much matchday atmosphere.", land: .9, resi: 1, anger: .3, vac: .6, kinds: ["a disused car park", "an empty field"], att: 1.02, adv: -.25, conc: 1.08, mix: { comm: 1, hard: -1 } },
  market: { l: "Market town", d: "Small-town streets around the ground: strong local loyalty.", land: .9, resi: 2, anger: 1, vac: .35, kinds: ["an empty field", "an abandoned warehouse"], att: 1, adv: .1, conc: 1, mix: { loyal: 1 } },
  village:{ l: "Village", d: "Cottages, the pub, open fields beyond: houses are dear and the village won't have them cleared, but fields often come up.", land: .7, resi: 2.5, anger: 1.3, vac: .7, kinds: ["an empty field"], att: .97, adv: .1, conc: .97, mix: { loyal: 1, comm: 1 } },
  rural:  { l: "Open country", d: "Farmland by a main road: the cheapest land and plenty of it, but hard to reach without a car park.", land: .5, resi: 1, anger: .3, vac: .9, kinds: ["an empty field"], att: .95, adv: -.1, conc: .97, mix: { fair: 1 } },
};
const BIG_CITY = new Set(["London", "North West", "West Midlands", "Yorkshire", "Madrid", "Catalonia", "Berlin", "Ruhr", "Lombardy", "Lazio", "Campania", "Île-de-France", "Lisbon", "Porto", "Holland", "Brussels", "Istanbul", "Athens", "Prague"]);
// Where a ground stands: given once (by region, division, and whether the club has moved), changed only by a move.
function assignLoc(c) {
  const big = BIG_CITY.has(c.region), t = c.tier || 7, moved = c.moved || (c.fac && c.fac.stadium && c.fac.stadium.km);
  const w = t <= 2 ? { city: big ? 3 : 1, inner: 4, sub: 1.5, ind: 1.5, retail: .5, market: big ? 0 : .5, village: 0, rural: 0 }
    : t <= 4 ? { city: big ? 1 : .3, inner: 2, sub: 2.5, ind: 1.5, retail: 1, market: big ? .5 : 2.5, village: big ? 0 : .3, rural: .1 }
    : { city: 0, inner: big ? 1 : .5, sub: big ? 3 : 2, ind: .5, retail: .5, market: big ? .5 : 3, village: big ? .5 : 3, rural: .5 };
  if (moved) { w.ind += 2; w.retail += 2; w.city *= .3; w.inner *= .3; }
  return wpick(Object.keys(w), k => w[k]);
}
const locOf = c => LOCS[c.loc ||= assignLoc(c)] ? c.loc : (c.loc = assignLoc(c));
const LOC = c => LOCS[locOf(c)];
// Moving: a short hop keeps the same kind of neighbourhood; the edge of town is industrial, a retail park or suburbs;
// out of town it's a retail park or open country.
const locForMove = (c, kind) => kind === "near" ? locOf(c) : kind === "edge" ? wpick(["ind", "retail", "sub"], k => ({ ind: 2, retail: 1.5, sub: 1 })[k]) : wpick(["retail", "rural"], k => ({ retail: 1, rural: 1.5 })[k]);
// A club's setting colours its support once, when first placed (other clubs); yours drifts each summer (fanCultureSummer).
function locMix(c, k = 3) { const m = fanMix(c), x = LOC(c).mix; for (const f in x) m[f] = (m[f] || 0) + x[f] * k; normMix(m); }

/* Land prices by location: London is about six times the national average, the South East and the big northern and
   Midland cities two to three times, rural regions about average. A club's standing adds a little on top (a bigger club
   needs a better-connected site): each division up about 1.3 times. Capitals and big-city regions abroad are dear too. */
const REGION_LAND = { London: 6, "South East": 2.5, "West Midlands": 1.8, "North West": 1.8, "South West": 1.3, Yorkshire: 1.4, "East Midlands": 1.2, "East Anglia": 1.2, "North East": 1,
  Madrid: 4, Catalonia: 4, Berlin: 3, Bavaria: 3, Lombardy: 3.5, Lazio: 3, "Île-de-France": 5, Lisbon: 3, Holland: 3.5, Brussels: 3, Istanbul: 3.5, Athens: 2.5, Prague: 2.5 };
const regionLand = c => REGION_LAND[c.region] || 1;
const landK = c => regionLand(c) * Math.pow(1.3, 7 - clamp(c.tier, 1, 7));
// What land in the club's area costs, for the page: "about six times the national average".
const landWord = c => { const r = regionLand(c); return r >= 5 ? "some of the dearest land in the country" : r >= 2.5 ? "dear land, well above the national average" : r >= 1.5 ? "city land, above the national average" : "land at about the national average"; };
// Land: priced by the kind of site (town land dearest, out of town cheapest) and the area (landK); any size up to 90,000.
const landCost = (c, site, plot) => Math.round(plot * site.rate * landK(c) * (site.k === "near" ? LOC(c).land : 1) * Math.pow(plot / 10000, .08) / 1e4) * 1e4;
const plotMin = c => Math.max(c.fac.stadium.cap + 1000, siteCap(c.fac.stadium) + 500);
const oldGroundValue = c => Math.round(siteCap(c.fac.stadium) * 150 * landK(c) * LOC(c).land / 1e4) * 1e4;
// (Old saves: a lease-back taken out before 0.46.5 is still charged per home game until moving day.)
const leaseFee = sell => Math.round(sell * .004 / 100) * 100;
/* Buying the land first: pay for the plot now and the planning application goes in straight away (its extra weeks
   count down while you wait); build on it when you're ready, whatever size of ground you want to start with, and
   extend it later up to what the plot takes. The supporters hear about the plan when you buy. You can sell the plot
   back (for 85% of what you paid) while nothing's built on it. */
const ownPlot = c => c.fac.stadium.plot || null;
/* Buying the land next door: the ground is surrounded by homes. A little land (a yard, a car park, a few houses) goes at
   about RESI times ordinary town land; the more of the neighbourhood you take compared with the footprint you started
   with, the dearer every further piece (whole streets have to be bought out) and the more it upsets the supporters and
   the town: a small old ground in the middle of a village can't grow much this way without a fight. Supporters would
   much rather the club moved a short way than displaced its neighbours. */
const adjBase = S => S.site0 || siteCap(S);  // the site before you started buying up the neighbourhood
// How far beyond the original footprint a purchase reaches, averaged over the piece: 1 for the first bit, rising after.
const adjSpread = (S, add) => Math.max(1, (siteCap(S) + add / 2) / adjBase(S));
// Suggested amounts (you can ask for any): up to what's readily for sale (as big as the site, or your support).
const adjEasy = c => Math.max(siteCap(c.fac.stadium), supportSize(c));
const adjMax = c => Math.max(0, SITE_MAX - siteCap(c.fac.stadium));
const adjOpts = c => { const max = Math.min(adjMax(c), adjEasy(c)); if (max < 500) return [];
  return [...new Set([.1, .25, .5, 1].map(f => Math.round(Math.max(500, max * f) / 500) * 500).filter(n => n <= max))]; };
// Price: the ground is surrounded by housing, so the land next door costs RESI times ordinary town land in the area.
const RESI = 2.5;
const adjCost = (c, add) => { const S = c.fac.stadium; return Math.round(add * SITE_KINDS.near.land * LOC(c).land * LOC(c).resi * landK(c) * Math.pow((siteCap(S) + add) / 10000, .08) * Math.pow(adjSpread(S, add), 1.1) / 1e4) * 1e4; };
// The anger: nothing for a sliver, then rising with how much of the neighbourhood you take (mood points).
const adjAnger = (c, add) => { const r = add / adjBase(c.fac.stadium); return r < .05 ? 0 : Math.min(25, Math.round(r * 6 * adjSpread(c.fac.stadium, add) ** .5 * LOC(c).anger)); };
const adjDone = () => false;
/* Not everything next door is homes: now and then an empty field, an abandoned warehouse, a disused car park or an old
   factory site comes up for sale beside the ground. It's ordinary land (cheaper than town land; a building to clear
   costs a little more), nobody is displaced, so nobody minds. A new chance comes each season (about two in five). */
const VACANT = [["an empty field", .6, 0], ["an abandoned warehouse", .9, .15], ["a disused car park", .8, .05], ["an old factory site", .85, .2]];
function vacantNow(c) {
  const S = c.fac.stadium; if (!S.own || siteCap(S) >= SITE_MAX) return null;
  if (S.vacY !== G.year) { S.vacY = G.year; if (!S.vac && R() < LOC(c).vac) { const kinds = VACANT.filter(v => LOC(c).kinds.includes(v[0])), [l, k, clear] = pick(kinds.length ? kinds : VACANT); S.vac = { l, k, clear, size: clamp(Math.round(siteCap(S) * rf(.15, .6) / 500) * 500, 500, SITE_MAX - siteCap(S)) }; } }
  return S.vac || null;
}
const vacantCost = (c, v) => Math.round(v.size * SITE_KINDS.near.land * landK(c) * LOC(c).land * v.k * (1 + v.clear) / 1e4) * 1e4;
function buyVacant(c) {
  const S = c.fac.stadium, v = S.vac; if (!v) return; const cost = vacantCost(c, v);
  spend("build", cost); S.site = siteCap(S) + v.size; delete S.vac;
  news(`You buy ${v.l} next to ${S.name} for ${money(cost)}${v.clear ? " (clearing it included)" : ""}: the site now takes a ground of up to ${S.site.toLocaleString("en-GB")}. Nobody minds.`, true);
}
function buyAdjacent(c, add) {
  const S = c.fac.stadium, cost = adjCost(c, add), anger = adjAnger(c, add); S.site0 ||= siteCap(S); spend("build", cost); S.site = siteCap(S) + add; S.adjY = G.year;
  news(`You buy the land next to ${S.name} for ${money(cost)}: the site now takes a ground of up to ${S.site.toLocaleString("en-GB")}.`, true);
  if (anger) { moodHit(c, -anger); trustRel(-Math.round(anger * .6));
    news(anger >= 10 ? `Families who have lived around ${S.name} for generations are bought out of their homes, and the town is up in arms. The supporters' trust says it would far rather the club moved a short way than displaced its neighbours.` : `Some of the neighbours sell up and move away. Supporters grumble about the club pushing out locals.`, anger >= 10); }
}
function mvChoice(c) {
  const P0 = ownPlot(c); if (P0) return { pick: { ...P0, owned: true }, plots: [P0.site], plot: P0.site };
  const sites = newSites(c), pick = sites.find(x => x.k === G.moveK) || sites[1], plots = plotSizes(c, pick), plot = G.plotN >= Math.min(plots[0], plotMin(c)) && G.plotN <= SITE_MAX ? G.plotN : plots[Math.min(1, plots.length - 1)];
  return { pick, plots, plot };
}
function buyPlot(c, site, plot) {
  const S = c.fac.stadium, cost = landCost(c, site, plot), plan = planExtra(c, plot);
  spend("build", cost); S.plot = { k: site.k, l: site.l, km: site.km, site: plot, rate: site.rate, paid: cost, y: G.year, plan, planT: plan };
  G.sites = null; moveAnnounced(c, site.km, { k: site.k, km: site.km, site: plot });
  news(`You buy land ${site.km} km away (${site.l.toLowerCase()}) for ${money(cost)}: room for a ground of up to ${plot.toLocaleString("en-GB")}. ${plan ? `The planning application goes in now: about ${plan} weeks.` : "Planning permission should be a formality."} Build on it whenever you're ready.`, true);
  if (plan) { trustRel(-Math.min(10, Math.round(plan / 4))); news(`The council will take its time over a ${plot.toLocaleString("en-GB")}-capacity plot for a club that draws about ${supportSize(c).toLocaleString("en-GB")}. The supporters' trust asks whether the club can ever fill it.`, true); }
}
function sellPlot(c) { const S = c.fac.stadium, P0 = S.plot; if (!P0) return; const back = Math.round(P0.paid * .85 / 1e4) * 1e4; earn("oldground", back); delete S.plot; news(`You sell the land ${P0.km} km away for ${money(back)}.`, true); }
// While you hold a plot, its planning application moves on week by week.
function plotWeek(c) { const P0 = c.fac.stadium.plot; if (P0 && P0.plan > 0 && --P0.plan === 0) news(`Planning permission is granted for the ground on your land ${P0.km} km away: you can build whenever you're ready.`, true); }
function moveQuote(c, d, site, plot) { const kind = site.k; const q = groundQuote(d), land = site.owned ? 0 : landCost(c, site, plot), sell = oldGroundValue(c), px = site.owned ? site.plan || 0 : planExtra(c, plot); return { ...q, land, cost: Math.round((q.cost + land) / 1e4) * 1e4, weeks: q.weeks + 4 + px, plan: (q.plan || 0) + px, px, km: site.km, kind, site: plot, sell, lease: leaseFee(sell) }; }
// How supporters take it: positive for a short move, increasingly negative with distance.
/* What the supporters make of a site: a mood score (positive: they like it) and the reasons. Distance is the start
   (a short hop is exciting, further away hurts), weighted by who the supporters are and where the club stands:
   - loyal and hardcore fans hate leaving; fair-weather fans care more about the club growing than where it plays;
   - families and community fans like the parking and easy access of the edge of town or a retail park;
   - if the club can't fit in everyone who wants a ticket, a site with room for them all is a big draw;
   - a crumbling old ground makes moving easier to accept, a brand-new one makes it baffling;
   - a club on the way up has fans who back a bigger project; one going down sees the owner walking away;
   - supporters of a cramped city club are used to the idea of moving; a village or market town wants to stay put. */
function sitePref(c, x) {
  const m = fanMix(c), roots = (m.hard + m.loyal) / 100, fam = m.comm / 100, fair = m.fair / 100, why = [], note = (d, t) => why.push([Math.abs(d), t]);
  const ups = isMine(c) ? G.history.slice(0, 3).filter(h => h.up).length - G.history.slice(0, 3).filter(h => h.down).length : (c.upNow ? 1 : 0) - ((c.lastTier ?? c.tier) < c.tier ? 1 : 0);
  const age = groundAge(c), S = c.fac && c.fac.stadium, plain = isMine(c) ? (S && S.own ? (S.amen || 1) <= 1 : true) : age >= 50;
  const setK = { city: .8, inner: .9, sub: 1, ind: 1, retail: 1, market: 1.2, village: 1.35, rural: 1.1 }[locOf(c)] || 1;
  let w = (.55 + roots * 1.3) * (1 - fair * .8) * setK * Math.pow(.85, ups) * (age >= 60 && plain ? .85 : 1);
  w = clamp(w, .3, 2.2);
  let mood = x.km <= 3 ? 4 : -(x.km <= 9 ? 4 + x.km * .6 : 8 + x.km * .45) * w;
  if (x.km > 3) { if (roots >= .5) note(-mood * .5, "the loyal core want to stay close"); else if (fair >= .3) note(3, "fair-weather fans mind the distance less"); }
  if (x.k !== "near" && fam >= .3) { const d = fam * (x.k === "edge" ? 12 : 8); mood += d; note(d, "families like the parking and easy access"); }
  const capNow = isMine(c) ? (S && S.own ? siteCap(S) : capacity(c)) : (c.site || c.cap), want = c.fans * 1.15;
  if (want > capNow * 1.05) { const short = want - capNow, fits = clamp(((x.site || capNow) - capNow) / short, 0, 1), k = clamp(short / Math.max(1, capNow), .2, 1);
    mood += 9 * fits * k; if (fits >= .9) note(9 * k, "room for everyone who wants a ticket"); else if (fits < .4) note(9 * k, "too small for everyone who wants a ticket"); }
  if (age >= 60 && plain && x.km > 3) { mood += 2; note(2.5, "the old ground is crumbling"); }
  if (age < 10 && x.km > 3) { mood -= 3; note(3, "why leave a ground that's nearly new?"); }
  if (ups > 0 && x.km > 3) note(2, "promotions have them backing the project"); else if (ups < 0 && x.km > 3) { mood -= 2; note(2.5, "relegation makes it feel like the owner walking away"); }
  if (x.km > 3 && setK >= 1.2) note(2.2, `${locOf(c) === "village" ? "the village" : "the town"} wants its club to stay`);
  return { mood: Math.round(mood * 10) / 10, why: why.sort((a, b) => b[0] - a[0]).map(w => w[1]) };
}
// The share of the support lost by moving far away: worse the more the supporters oppose it.
const siteLoss = (c, x, mood) => x.km <= 9 ? 0 : Math.min(.3, x.km * .008 * (.6 + fanShare(c, "comm") + fanShare(c, "loyal") * .5) * clamp(-mood / 14, 0, 1.6));
const moveMood = (c, km) => km <= 3 ? 4 : -(km <= 9 ? 4 + km * .6 : 8 + km * .45) * fanCare(c) / 1.5;
function moveAnnounced(c, km, site) {
  const p = site ? sitePref(c, site) : { mood: moveMood(c, km), why: [] };
  if (p.mood > 0) { moodHit(c, Math.min(4, p.mood * .5)); trustRel(2); news(`Supporters welcome the plans for a new ground ${km <= 3 ? "just down the road" : `${km} km away`}${p.why.length ? ` (${p.why[0]})` : ""}.`); return; }
  moodHit(c, p.mood * .4); trustRel(-Math.round(Math.min(km * .5, -p.mood * .6))); bumpMedia(2);
  news(`The supporters' trust ${p.mood <= -10 ? "is furious about" : "has doubts about"} the plan to move the club ${km} km away${p.why.length ? `: ${p.why[0]}` : ""}.`, p.mood <= -10);
}
function moveIn(c, b) {
  const S = c.fac.stadium, old = S.name, sell = b.sold ? b.sell : oldGroundValue(c); closeGround(S);
  if (b.kind) { const was = LOC(c).l; c.loc = locForMove(c, b.kind); if (LOC(c).l !== was) news(`The new ground's setting: ${LOC(c).l.toLowerCase()}. ${LOC(c).d}`, true); }
  S.name = b.name; S.stands = JSON.parse(JSON.stringify(b.stands)); if (b.family) S.stands[b.family].family = true; if (b.corp) S.stands.W.corp = Math.min(b.corp, Math.floor(S.stands.W.cap * .15));
  syncCap(S); if (b.suites != null) S.suites = Math.min(b.suites, Math.floor(S.cap / 250)); openGround(S); S.vent = Object.fromEntries((b.vent || []).map(k => [k, { y: G.year }])); S.site = b.site; S.rebuilding = false; S.soldOld = false; S.amen = Math.max(S.amen || 1, 3); S.heat = false; S.pitch = 100; S.away = null; S.km = (S.km || 0) + b.km; S.lease = 0;
  const pf = b.kind ? sitePref(c, { k: b.kind, km: b.km, site: b.site }) : { mood: moveMood(c, b.km) };
  if (!b.sold) earn("oldground", sell); moodHit(c, pf.mood);
  const lost = siteLoss(c, { km: b.km }, pf.mood);
  if (lost > 0) { c.fans = Math.round(c.fans * (1 - lost)); trustRel(-Math.round(Math.min(b.km * .4, -pf.mood * .5)));
    const m = fanMix(c); m.comm = Math.max(5, m.comm - 4); m.fair += 3; normMix(m);
    news(`The club moves to ${S.name}, ${b.km} km from ${old}. Some supporters won't make the journey: about ${Math.round(lost * 100)}% of the support drifts away. ${b.sold ? "" : `${old} is sold for ${money(sell)}.`}`, true); }
  else news(`The club moves into ${S.name}${b.km > 3 ? `, ${b.km} km from ${old}` : ""}. ${S.cap.toLocaleString("en-GB")} capacity.${b.sold ? "" : ` ${old} is sold for ${money(sell)}.`}`, true);
}
// Demolish a stand and build a new one in its place: clearing the old one, then the new stand at the going rate.
function rebuildQuote(c, side, cap, type, roof) {
  const S = c.fac.stadium, x = standsOf(S)[side], to = S.cap - x.cap + cap, demo = 20000 + x.cap * 40;
  return { side, cap, to: type, roof, demo: Math.round(demo / 1e3) * 1e3, cost: Math.round((demo + cap * perSeat(to) * TYPE_F[type] * roofF(roof) * 1.15) / 1e4) * 1e4, weeks: Math.round(26 + cap / 300) };
}
// Knock the whole ground down and build a new one on the site; the club plays at a rented ground meanwhile.
function regroundQuote(c, d) { const q = groundQuote(d), demo = 100000 + c.fac.stadium.cap * 30; return { ...q, demo: Math.round(demo / 1e4) * 1e4, cost: Math.round((q.cost + demo) / 1e4) * 1e4, weeks: q.weeks + 6 }; }
// Where you'd play meanwhile: the smallest rented ground that holds most of your crowd.
const tempHost = c => { const need = Math.min(c.fac.stadium.cap * .6, 30000); const i = HOSTS.findIndex(h => h.cap >= need); return i < 0 ? HOSTS.length - 1 : i; };
const roofQuote = (c, side) => { const n = standsOf(c.fac.stadium)[side].cap; return { side, cost: Math.round((50000 + n * 260) / 1e4) * 1e4, weeks: Math.round(12 + n / 1500) }; };
const convertQuote = (c, side) => { const x = standsOf(c.fac.stadium)[side], to = x.type === "terrace" ? "seat" : "terrace"; return { side, to, cost: Math.round((40000 + x.cap * (to === "seat" ? 320 : 120)) / 1e4) * 1e4, weeks: Math.round(8 + x.cap / 2500) }; };
const corpQuote = (c, n) => ({ add: n, cost: Math.round(n * corpCost(c) / 1000) * 1000, weeks: 6 + Math.round(n / 100) });
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
/* Auto-registration (on unless you turn it off): while a window is open the list is always your best 25 seniors by rating,
   refreshed every week and whenever someone signs; when the window closes it's frozen until the next one. Ticking or
   unticking a player yourself turns it off. */
const autoRegOn = () => G.autoReg !== false;
function syncReg(c = my()) { if (c && autoRegOn() && windowOpen()) c.reg = autoRegList(c); }
function autoRegister(c, quiet) {
  if (autoRegOn()) c.reg = autoRegList(c);
  const L = regList(c), add = c.squad.map(P).filter(p => !regExempt(p) && !L.includes(p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, REG_MAX - L.length);
  for (const p of add) L.push(p.id);
  const out = c.squad.map(P).filter(p => !isReg(p, c));
  if (!quiet && (add.length || out.length)) news(`Squad registered: ${L.length} of ${REG_MAX}${add.length ? `, adding ${add.map(p => p.name).join(", ")}` : ""}.${out.length ? ` Not registered (can't play until the next window): ${out.map(p => p.name).join(", ")}.` : ""}`, !!out.length);
}
// A newcomer is registered if there's a place for him (an emergency signing always is).
function registerNew(p, c = my(), force) { if (regExempt(p)) return; syncReg(c); const L = regList(c); if (L.includes(p.id)) return; if (L.length < REG_MAX || force) L.push(p.id); else news(`${p.name} has signed but the 25-man list is full: he can't play until you register him (unregister someone while the window is open).`, true); }
function toggleReg(p, c = my()) {
  if (!windowOpen()) return "Registrations can only change while a transfer window is open.";
  if (regExempt(p)) return `${p.name} doesn't need registering (under-21s and academy players can always play).`;
  const L = regList(c);
  if (L.includes(p.id)) { c.reg = L.filter(id => id !== p.id); return null; }
  if (L.length >= REG_MAX) return "The list is full: unregister someone first.";
  L.push(p.id); return null;
}

/* ---------- the other costs of running a club ----------
   Team travel to every away game (a coach in the non-league; coach and hotel further up; flights in Europe), medical
   bills for serious injuries, insurance on players' wages (it pays out on long injuries), utilities for the ground and
   training base, ground-grading works the league demands on promotion, a community foundation if you fund one, and
   corporation tax on profits (losses carry forward). */
const TRAVEL = [0, 45000, 14000, 6000, 3500, 1800, 900, 450];
const tripF = (c, opp) => opp.abroad ? 3 : opp.region === c.region ? .6 : opp.half && c.half && opp.half !== c.half ? 1.6 : 1;
const awayTrip = (c, opp) => spend("travel", Math.round(TRAVEL[c.tier] * tripF(c, opp)));
// Supporters who make the trip: a share of the support, more for a short hop, fewer for a long haul.
const travellers = (c, opp) => Math.round(Math.min(c.fans * .06 * (tripF(c, opp) < 1 ? 1.4 : tripF(c, opp) > 1.5 ? .6 : 1), 1500 * (8 - c.tier), (opp.cap || 5000) * .1));
const MED = [0, 250000, 60000, 25000, 12000, 5000, 2000, 800];  // a serious injury's treatment, per five weeks out
const medBill = (c, wks) => Math.round(MED[c.tier] * wks / 5 / 100) * 100;
const INSURE = .03;  // premium: 3% of the wage bill a year; long injuries (6+ weeks) pay 70% of wages after the fourth week
const insureWeek = c => { spend("insure", wageBill(c) * INSURE / YEAR_TICKS()); let back = 0;
  for (const id of c.squad) { const p = P(id); if (p && p.inj > 0 && (p.injT || 0) >= 6 && p.injT - p.inj >= 4) back += p.wage / YEAR_TICKS() * .7; } if (back) earn("insclaim", back); };
const utilities = c => (atHome(c) && !c.fac.stadium.soldOld ? 6000 + groundCap(c) * 6 : 2500) + (c.fac.train.lvl ? 4000 * c.fac.train.lvl : 1500);
const GRADE = [0, 4e6, 1.5e6, 600e3, 250e3, 90e3, 30e3, 0];  // works the league demands on arriving in a division
const gradingCost = (c, t) => Math.round(GRADE[t] * (isMine(c) ? (c.fac.stadium.own ? 1 : .3) : .7));
const COMM_REF = [0, 2e6, 400e3, 150e3, 70e3, 30e3, 12e3, 5e3];  // what a club in each division usually puts into its foundation
const commK = c => isMine(c) && c.budget.comm ? clamp(c.budget.comm / COMM_REF[c.tier], 0, 2) : 0;
const TAX = .25;
function seasonTax(c) {
  const f = c.fin, profit = ledgerIncome(f) - ledgerCosts(f), carry = G.taxLoss || 0;
  if (profit <= 0) { G.taxLoss = carry - profit; return 0; }
  const taxable = Math.max(0, profit - carry); G.taxLoss = Math.max(0, carry - profit);
  const tax = Math.round(taxable * TAX); if (tax) { spend("tax", tax); news(`Corporation tax on the season's profit: ${money(tax)}${carry ? ` (after ${money(Math.min(carry, profit))} of earlier losses set against it)` : ""}.`); }
  return tax;
}
/* Away days. Fans ask for help with coaches to long trips (the other half of the country, or abroad); after a heavy away defeat you can refund the
   supporters who travelled. Loyal and hardcore fans care most. */
const fanCare = c => 1 + fanShare(c, "loyal") + fanShare(c, "hard");
/* Road distance between two grounds, from their regions' positions (straight line plus a quarter for the roads); within
   the same region about 20-60 km. */
const regionLL = c => { const K = COUNTRY[c.abroad ? c.country : "ENG"], r = K && K.regions.find(x => x[0] === c.region); return r ? [r[1], r[2]] : null; };
function roadKm(a, b) {
  const fx = (G.kmFix || {})[pairKey(a, b)]; if (fx != null) return fx;  // a distance set by hand
  const p = regionLL(a), q = regionLL(b); if (!p || !q) return 300;
  if (a.region === b.region && !!a.abroad === !!b.abroad) { const x = Math.min(a.id, b.id), y = Math.max(a.id, b.id), h = x * 73 + y * 37 + x * y; return a.region === "London" ? 5 + h % 31 : 15 + h % 46; }  // the same both ways; a city is closer together than a county
  const rad = Math.PI / 180, dLat = (q[0] - p[0]) * rad, dLon = (q[1] - p[1]) * rad, h = Math.sin(dLat / 2) ** 2 + Math.cos(p[0] * rad) * Math.cos(q[0] * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 1.25 / 5) * 5;
}
function awayHelpWeek() {
  const c = my(), nf = nextFixture(); if (!nf || nf.a !== c.id || nf.w > G.week + 1 || G.awayAsk === G.year * 100 + nf.w) return;
  // Only for genuinely long trips (about 250 km or more by road, or abroad), now and then, and not more than once in eight weeks.
  const opp = CL(nf.h), km = roadKm(c, opp); if ((km < 250 && !opp.abroad) || R() > .35 || (G.awayAskW != null && G.awayAskY === G.year && nf.w - G.awayAskW < 8)) return;
  G.awayAsk = G.year * 100 + nf.w; G.awayAskW = nf.w; G.awayAskY = G.year;
  const n = travellers(c, opp), cost = Math.round(n * (tripF(c, opp) > 1.5 ? 25 : 12) / 100) * 100; if (cost < 200) return;
  addChoice("awayHelp", `Supporters ask for help getting to ${opp.name} (${km.toLocaleString("en-GB")} km)`, `About ${n.toLocaleString("en-GB")} fans want to make the ${km.toLocaleString("en-GB")} km trip${opp.abroad ? ` to ${COUNTRY[opp.country].name}` : ` to ${opp.region}`}. The supporters' trust asks the club to put on coaches: ${money(cost)} to pay for them all, or half that to share the cost.`,
    ["Pay for the coaches", "Pay half", "Can't help this time"], { cost }, 1);
}
function awayRefundCheck(c, opp, gf, ga) {
  const d = ga - gf; if (G.refundY === G.year || !(d >= 5 || (d === 4 && R() < .4) || (d === 3 && isDerby(c, opp) && R() < .5))) return;
  G.refundY = G.year;  // at most once a season
  const n = travellers(c, opp), cost = Math.round(n * REF_TICKET[opp.tier] / 100) * 100; if (cost < 100) return;
  addChoice("awayRefund", `${n.toLocaleString("en-GB")} fans travelled to see a ${ga}-${gf} defeat at ${opp.name}`, `Some clubs refund the supporters who made the trip after a humiliation like that. Refunding their tickets would cost ${money(cost)}.`,
    ["Refund the travelling fans", "Apologise, no refund"], { cost }, 1);
}

/* ---------- parachute payments ----------
   A club relegated from the professional divisions keeps a share of the TV money of the division it left, to soften the fall.
   From the Premier: 55%, 45% and 20% over three seasons (two seasons if it was only up for one). From the First Division:
   20% then 10%; from the Second and Third: 30% then 15%. Payments stop if the club goes back up. */
const PARA = { 1: [.55, .45, .2], 2: [.2, .1], 3: [.3, .15], 4: [.3, .15] };
const paraOf = c => c.para && PARA[c.para.from] && c.para.i < c.para.n ? Math.round(TV[c.para.from] * PARA[c.para.from][c.para.i]) : 0;
const paraPlan = c => c.para ? PARA[c.para.from].slice(c.para.i, c.para.n).map(f => Math.round(TV[c.para.from] * f)) : [];

/* ---------- season forecast ----------
   Where this season's accounts are heading: what has already happened, plus the rest of the season at today's rates and
   budgets. Assumes your head of recruitment uses the wage and transfer budgets while a window is still to come, a
   typical crowd at the remaining home games and merit money for your current league position. Cup runs, Europe,
   player sales and building work aren't forecast. */
function euroForecast(c) {
  const R = { n: 0, home: 0, inc: 0, travel: 0, name: "" };
  for (const K of Object.values(G.cont || {})) {
    if (!K.teams || !K.teams.includes(c.id) || K.md >= 6) continue;
    const D = CONT[K.key], g = K.groups.findIndex(x => x.includes(c.id)), i = K.groups[g].indexOf(c.id); R.name = D.name;
    for (let md = K.md; md < 6; md++) {
      const pr = GROUP_MD[md].find(p => p.includes(i)); if (!pr) continue; const opp = CL(K.groups[g][pr[0] === i ? pr[1] : pr[0]]); R.n++;
      R.inc += (D.win + D.draw) / 3;  // an even record: a third of the games won, a third drawn
      if (pr[0] === i) { const crowd = Math.min(capacity(c), Math.round(crowdFor(c, opp) * 1.2)); R.home++;
        R.inc += crowd * c.prices.ticket * 1.3 + concessionsFor(c, crowd).net - ground(c).rent - opsCost(c, crowd); }
      else R.travel += Math.round(TRAVEL[c.tier] * tripF(c, opp));
    }
  }
  return R;
}
function seasonForecast(c = my()) {
  const f = c.fin, summer = G.phase === "summer", sw = summer ? Math.max(0, SUMMER_WEEKS - G.week) : 0;
  const se = summer ? SEASON_WEEKS : G.phase === "season" ? Math.max(0, SEASON_WEEKS - G.week) : 0, W = sw + se;
  const L = G.leagues[c.lg]; let home = 0, away = 0;
  for (const r of (L.rounds || []).slice(L.next || 0)) for (const [h, a] of r) { if (h === c.id) home++; else if (a === c.id) away++; }
  const windowAhead = summer || (G.phase === "season" && G.week <= JAN[JAN.length - 1]);
  const bill = windowAhead ? Math.max(wageBill(c), c.budget.wages) : wageBill(c);
  const m = matchdayForecast(c), vg = ventureGame(c, m.crowd) + (fzK(c) === .5 ? fzGame(c, m.crowd, .5) : 0), H = c.hgs || { n: 0 };
  // Once a few home games are played, this season's real takings per game replace the typical-crowd estimate.
  const perGame = H.n >= 3 ? (H.gate + H.conc + H.vent) / H.n : m.gate + m.conc + vg;
  const ids = table(c.lg).map(r => r.id), pos = G.phase === "summer" ? Math.ceil(ids.length / 2) : ids.indexOf(c.id) + 1;
  const ventWeek = atHome(c) ? sum(Object.keys(c.fac.stadium.vent || {}), k => VENTURES[k].week ? VENTURES[k].week(c) : 0) : 0;
  const rest = {
    "Gate, food & drink": home * perGame,
    "Partner club fees": sum(partners(), p => CL(p.id) ? affilFee(CL(p.id), c) : 0) / YEAR_TICKS() * W,
    "Season tickets": summer && !(c.st && c.st.y === G.year) ? stDemand(c) * stPrice(c) : 0,
    "Sponsorship": sponsorTotal(c) / YEAR_TICKS() * W, "Merchandise": merchFor(c) * W, "TV money": (TV[c.tier] + paraOf(c)) / 46 * se,
    "Suites & ventures": suitesLet(c) * c.prices.suite / SEASON_WEEKS * se + ventWeek * W,
    "League merit money": G.phase === "playoffs" ? 0 : PRIZE_TOP[c.tier] * (1 - (pos - 1) / Math.max(1, ids.length)),
  };
  const out = {
    "Player wages": bill / YEAR_TICKS() * W, "Staff wages": staffBill(c) / YEAR_TICKS() * W,
    // Amortised: this season's share of the fees already on the books, and of the transfer budget still to spend
    // (spread over a typical three-year deal). The cash itself goes when the deals are done.
    "Transfer fees (spread over contracts)": sum(c.squad.map(P).concat((G.loanList || []).map(id => G.players[id]).filter(p => p && p.loan && p.loan.from === c.id)), p => Math.min(bookValue(p), amortPer(p) * W))
      + (windowAhead ? Math.max(0, c.budget.transfer - (c.spentT || 0) - pendFees()) / 3 * W / YEAR_TICKS() : 0),
    "Academy & scouting": (c.budget.acad + c.budget.scout) / YEAR_TICKS() * W, "Community foundation": (c.budget.comm || 0) / YEAR_TICKS() * W,
    "Ground: rent, match-day staff, upkeep": home * (m.rent + m.ops) + upkeep(c) / YEAR_TICKS() * W, "Utilities & insurance": (utilities(c) + bill * INSURE) / YEAR_TICKS() * W,
    // Deals agreed for January that you made yourself (club cash, outside the budgets): the fee, and his wages from then on.
    "Agreed signings for January": G.phase === "season" ? sum(incoming().filter(p => toMeWhen(p) === "jan" && !p.toMe.rec), p => p.toMe.fee / 3 * Math.max(0, SEASON_WEEKS - Math.max(G.week, JAN[0])) / YEAR_TICKS() + p.toMe.wage / YEAR_TICKS() * Math.max(0, SEASON_WEEKS - Math.max(G.week, JAN[0]))) : 0,
    "Away travel": away * TRAVEL[c.tier], "Feeder funding": feederFunding() / YEAR_TICKS() * W, "Interest": Math.max(0, -c.cash) * .1 / YEAR_TICKS() * W + sum(G.loans || [], l => (l.rate || 0) * (l.left || 0)) / YEAR_TICKS() * W,
  };
  // Europe: the group games still to play (home gates, an even share of the results money, away travel). Knockout
  // rounds aren't forecast: they count once you're through, as they happen.
  { const E = euroForecast(c); if (E.n) { rest[`${E.name} group games (${E.home} at home)`] = E.inc; out["Away travel"] += E.travel; } }
  const sofar = ledgerIncome(f) - ledgerCosts(f), inc = sum(Object.values(rest), v => v);
  // Corporation tax on a profit, after losses carried forward (see seasonTax).
  { const pre = sofar + inc - sum(Object.values(out), v => v); out["Corporation tax"] = pre > 0 ? Math.max(0, pre - (G.taxLoss || 0)) * TAX : 0; }
  const cost = sum(Object.values(out), v => v), net = sofar + inc - cost;
  const ratio = c.tier <= 4 ? spendRolling(c, ledgerIncome(f) + inc - (ledgerCosts(f) - f.build - f.acad + cost - (c.budget.acad / YEAR_TICKS() * W)), ledgerIncome(f) + inc).ratio : 0;
  return { sofar, rest, out, inc, cost, net, W, home, pos, windowAhead, ratio };
}

/* Each summer every sponsor deal has a year less to run. One that reaches the end has been honoured in full: the brand
   leaves on good terms (goodwill) and will offer to renew. */
function dealsSeasonEnd(c = my()) {
  for (const d of c.deals) {
    d.yrs--;
    if (d.yrs <= 0) { G.goodwill = clamp((G.goodwill || 0) + .05, 0, .6); (G.lastBrand ||= {})[d.slot] = { brand: d.brand, y: G.year };
      news(`${d.brand}'s ${SLOTS[d.slot].l.toLowerCase()} deal has run its full term. They'd like to talk about a renewal, and other brands notice a club that honours its deals.`, true); }
  }
  c.deals = c.deals.filter(d => d.yrs > 0);
}

/* Every summer the pitch is re-laid with the same surface unless it's still in excellent condition (80+), paid for and
   ready before the season starts. */
function summerRelay(c = my()) {
  const S = c.fac.stadium; if (!S.own || S.relay || S.pitch >= 80 || S.rebuilding) return;
  relayPitch(S.ptype || "grass", true);
}
