/* The calendar: an eight-week summer (transfer window, hiring, building), a 46-week season with a January window,
   play-offs, then the summer turnover: promotion and relegation, ageing, retirements, contracts and youth intakes. */
"use strict";

const SUMMER_WEEKS = 8, SEASON_WEEKS = 46, JAN = [20, 21, 22, 23];
const REST20 = new Set([4, 9, 14, 19, 26, 31, 36, 41]);  // 20-club leagues play 38 rounds in 46 weeks
const windowOpen = () => G.phase === "summer" || (G.phase === "season" && JAN.includes(G.week));

/* ---------- fixtures and tables ---------- */
function roundRobin(ids) {
  const a = ids.slice(); if (a.length % 2) a.push(null);
  const n = a.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const rd = []; for (let i = 0; i < n / 2; i++) { const x = a[i], y = a[n - 1 - i]; if (x != null && y != null) rd.push(r % 2 ? [y, x] : [x, y]); }
    rounds.push(rd); a.splice(1, 0, a.pop());
  }
  return rounds.concat(rounds.map(rd => rd.map(([x, y]) => [y, x])));
}
function startSeason() {
  for (const k of LG_KEYS) {
    const L = G.leagues[k]; L.rounds = roundRobin(shuffle(L.clubs.slice())); L.next = 0; L.tab = {};
    for (const id of L.clubs) L.tab[id] = { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
  }
  G.myRes = []; G.po = null;
  for (const c of G.clubs) if (!c.gone && c.ded && G.leagues[c.lg].tab[c.id]) G.leagues[c.lg].tab[c.id].pts -= c.ded;  // administration
  for (const k of LG_KEYS) G.leagues[k].pend = [];
  for (const id of G.foreign || []) CL(id).gp = 0;
  startCups(); startContinental();
  for (const p of Object.values(G.players)) p.s = { app: 0, g: 0, a: 0 };
  const c = my(); c.att = []; c.morale = 55;
}
function tally(L, r) {
  const H = L.tab[r.h], A = L.tab[r.a]; H.p++; A.p++; H.gf += r.hg; H.ga += r.ag; A.gf += r.ag; A.ga += r.hg;
  if (r.hg > r.ag) { H.w++; A.l++; H.pts += 3; H.form.push("W"); A.form.push("L"); }
  else if (r.hg < r.ag) { A.w++; H.l++; A.pts += 3; H.form.push("L"); A.form.push("W"); }
  else { H.d++; A.d++; H.pts++; A.pts++; H.form.push("D"); A.form.push("D"); }
  if (H.form.length > 5) H.form.shift(); if (A.form.length > 5) A.form.shift();
}
const table = k => Object.values(G.leagues[k].tab).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || CL(b.id).rep - CL(a.id).rep);
const posOf = (k, id) => table(k).findIndex(r => r.id === id) + 1;
function nextFixture() {
  const c = my(), L = G.leagues[c.lg];
  if (G.phase !== "season" || !L.rounds) return null;
  for (let w = G.week, n = L.next; w < SEASON_WEEKS && n < L.rounds.length; w++) {
    if (L.clubs.length === 20 && REST20.has(w)) continue;
    const f = L.rounds[n].find(([h, a]) => h === c.id || a === c.id); if (f) return { h: f[0], a: f[1], w }; n++;
  }
  return null;
}

/* ---------- a week ---------- */
function advance() {
  const c = my();
  if (G.ended || G.club == null) return;
  weatherWeek();
  for (const p of Object.values(G.players)) { if (p.inj) p.inj--; if (p.unsettled > 0) p.unsettled--; }
  if (G.phase === "summer") summerWeek();
  else if (G.phase === "season") seasonWeek();
  else if (G.phase === "playoffs") playoffWeek();
  buzzWeek(c); buildWeek(c); pitchWeek(c, c._home); c._home = false; fansWeek(c); weeklyAccounts(c);
  for (const o of c.offers) o.exp--;
  c.offers = c.offers.filter(o => o.exp > 0);
  if (G.phase !== "playoffs" || G.week === 0) refreshOffers(c);
  if (G.saleOffers) { for (const o of G.saleOffers) o.exp--; G.saleOffers = G.saleOffers.filter(o => o.exp > 0); if (!G.saleOffers.length) G.saleOffers = null; }
  mediaWeek(); trustWeek(c); poachWeek(); requestsCheck(); bidForMyClub();
  settleInbox();
  if (c.cash < -Math.max(250000, TV[c.tier]) && !G.warnedDebt) { G.warnedDebt = true; news(`The club is ${money(-c.cash)} overdrawn and paying 10% interest. Put money in from Finances or cut costs.`, true); }
  if (c.cash >= 0) G.warnedDebt = false;
}
function summerWeek() {
  if (G.week === 1) partnerWindow();
  if (G.week === 2 || G.week === 5) foreignLoans();
  friendlyWeek();
  marketWeek();
  G.week++;
  if (G.week >= SUMMER_WEEKS) {
    G.phase = "season"; G.week = 0;
    for (const c of G.clubs) if (!c.gone && !isMine(c)) aiSquadCheck(c, true);
    news(`The ${seasonLabel(G.year)} season begins. ${my().name} are in the ${LEAGUES[my().lg].name}.`, true);
  }
}
function seasonWeek() {
  const w = G.week;
  for (const k of LG_KEYS) {
    const L = G.leagues[k];
    // Games postponed last week (frost, snow) are played first; some go off again.
    const todo = (L.pend || []).splice(0);
    if (L.next < L.rounds.length && !(L.clubs.length === 20 && REST20.has(w))) { todo.push(...L.rounds[L.next]); L.next++; }
    for (const [h, a] of todo) {
      if (postponed(h) && w < SEASON_WEEKS - 1) { L.pend.push([h, a]); if (h === G.club || a === G.club) news(`${CL(h).name} v ${CL(a).name} is postponed: ${wxAt(CL(h)).l.toLowerCase()} has left the pitch unplayable.`, true); continue; }
      const r = playMatch(h, a); tally(L, r); afterMatch(r, k);
    }
  }
  cupWeek(w); contWeek(w); foreignDomestic(w); ownersCheck(w);
  if (w === JAN[0]) partnerWindow();
  if (w === JAN[0] || w === JAN[2]) foreignLoans();
  if (JAN.includes(w)) marketWeek();
  if (w % 3 === 2) devTick(1 / 16);
  G.week++;
  if (G.week >= SEASON_WEEKS) startPlayoffs();
}
function afterMatch(r, k) {
  const c = my(); if (r.h !== c.id && r.a !== c.id) return;
  const home = r.h === c.id, gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg, opp = CL(home ? r.a : r.h);
  let crowd = null; if (home) { crowd = homeGameMoney(c, opp); c._home = true; }
  const res = gf > ga ? "W" : gf < ga ? "L" : "D", m = mgr().at.mot, derby = isDerby(c, opp) ? 2 : 1;
  c.morale = clamp(c.morale + (res === "W" ? 4 : res === "L" ? -5 + m / 25 : 0) + (55 + vpt("results") - c.morale) * .1, 20, 95);
  moodHit(c, (res === "W" ? 1.6 : res === "L" ? -1.6 : 0) * derby);
  G.myRes.push({ w: G.week, comp: k, derby: derby > 1, home, opp: opp.id, gf, ga, res, crowd, ev: r.ev, fit: r.fit[home ? 0 : 1] });
}

/* ---------- play-offs: one-off semi-finals at the higher seed, a final at a neutral ground ---------- */
function startPlayoffs() {
  for (const k of LG_KEYS) { const L = G.leagues[k]; for (const [h, a] of (L.pend || []).splice(0)) { const r = playMatch(h, a); tally(L, r); afterMatch(r, k); } }
  G.phase = "playoffs"; G.week = 0; G.po = {};
  for (const k of LG_KEYS) { const po = LEAGUES[k].po; if (!po) continue; const t = table(k).slice(po[0] - 1, po[1]).map(r => r.id); G.po[k] = { semis: [[t[0], t[3]], [t[1], t[2]]], final: null, win: null, res: [] }; }
  const mine = Object.entries(G.po).find(([, x]) => x.semis.flat().includes(G.club));
  news(mine ? `${my().name} are in the ${LEAGUES[mine[0]].name} play-offs!` : "The regular season is over. The play-offs are next.", !!mine);
}
function koMatch(h, a, neutral, k) {
  const { w, r } = playKO(h, a, neutral, "PO", neutral ? "Play-off final" : "Play-off semi-final");
  G.po[k].res.push({ h, a, hg: r.hg, ag: r.ag, pens: r.pens, w });
  return w;
}
function playoffWeek() {
  if (G.week === 0) { for (const [k, x] of Object.entries(G.po)) x.final = x.semis.map(([h, a]) => koMatch(h, a, false, k)); G.week = 1; return; }
  for (const [k, x] of Object.entries(G.po)) {
    x.win = koMatch(x.final[0], x.final[1], true, k);
    if (x.final.includes(G.club)) news(x.win === G.club ? `Play-off winners! ${my().name} win the ${LEAGUES[k].name} play-off final.` : `Heartbreak: ${my().name} lose the ${LEAGUES[k].name} play-off final.`, true);
  }
  endSeason();
}

/* ---------- development ---------- */
function devTick(dt) {
  const games = {};
  for (const k of LG_KEYS) for (const r of Object.values(G.leagues[k].tab || {})) games[r.id] = r.p;
  for (const id of G.foreign || []) games[id] = CL(id).gp || 0;  // foreign clubs' domestic seasons
  for (const p of Object.values(G.players)) if (p.club !== -2) develop(p, dt, p.club >= 0 ? games[p.club] || 0 : 0);
}

/* ---------- the end of the season ---------- */
function endSeason() {
  qualify();  // Champions Cup and Continental Shield places for next season, from this table and the National Cup
  const moves = [], mine = my(), report = { y: G.year };
  for (const k of LG_KEYS) {
    const L = LEAGUES[k], t = table(k), ids = t.map(r => r.id);
    const champ = CL(ids[0]); champ.trophies.push([G.year, L.name]);
    if (champ.id === G.club) news(`CHAMPIONS! ${mine.name} win the ${L.name}.`, true);
    if (ABOVE[k]) {
      const up = ids.slice(0, L.auto); if (G.po[k] && G.po[k].win != null) up.push(G.po[k].win);
      // Promoted clubs go up whatever their ground holds. AI clubs grow their grounds as they rise.
      const final = up;
      for (const id of up) { const c = CL(id); if (!isMine(c)) c.cap = Math.max(c.cap, Math.round(STADIUM_T[LEAGUES[ABOVE[k]].tier] * rf(.5, .8) / 100) * 100); }
      for (const id of final) moves.push([id, ABOVE[k]]);
    }
    if (L.down && L.tier < 7) for (const id of ids.slice(-L.down)) moves.push([id, null]);
    if (L.tier === 7) { const drop = ids.filter(id => id !== G.club).slice(-L.down); for (const id of drop) moves.push([id, "OUT"]); }
    if (ids.includes(G.club)) { report.lg = k; report.pos = ids.indexOf(G.club) + 1; report.pts = t[report.pos - 1].pts; report.size = ids.length; report.tier = L.tier; }
  }
  // Merit money and sponsor bonuses
  const pos = report.pos, size = report.size, merit = Math.round(PRIZE_TOP[mine.tier] * (1 - (pos - 1) / size) / 1000) * 1000;
  earn("prize", merit);
  const wentUp = moves.some(([id, to]) => id === G.club && to && to !== "OUT");
  const wentDown = moves.some(([id, to]) => id === G.club && to === null);
  if (wentUp) { const b = sum(mine.deals, d => d.bonus); if (b) { earn("spons", b); news(`Sponsors pay ${money(b)} in promotion bonuses.`); } }
  judgeObjectives({ ...report, up: wentUp, po: G.po[report.lg] && G.po[report.lg].semis.flat().includes(G.club) });
  // History
  const f = mine.fin;
  G.history.unshift({ club: mine.name, obj: (G.objRes || []).map(o => (o.met ? "✓ " : "✗ ") + o.t), cups: [...Object.entries(G.cups || {}).map(([k, K]) => { if (K.win === G.club) return CUP_DEF[k].name + ": winners"; const last = K.log.filter(x => x.h === G.club || x.a === G.club).pop(); return last ? `${CUP_DEF[k].name}: ${last.r.toLowerCase()}` : null; }),
    ...Object.values(G.cont || {}).map(K => { if (!K.teams.includes(G.club)) return null; if (K.win === G.club) return CONT[K.key].name + ": winners"; const r = K.ko.filter(R => R.ties.some(t => t.h === G.club || t.a === G.club)).pop(); return `${CONT[K.key].name}: ${r ? r.n.toLowerCase() : "group stage"}`; })].filter(Boolean), y: G.year, lg: report.lg, tier: report.tier, pos, size, pts: report.pts, up: wentUp, down: wentDown, po: G.po[report.lg] && G.po[report.lg].semis.flat().includes(G.club),
    inc: ledgerIncome(f), cost: ledgerCosts(f), att: Math.round(avg(mine.att || [])), fans: mine.fans, cash: mine.cash, mgr: mgr().name,
    top: Object.values(G.players).filter(p => p.club === G.club).sort((a, b) => b.s.g - a.s.g)[0]?.name || "" });
  investorsSummer({ up: wentUp, down: wentDown });
  endLoans();
  G.meddle = (G.meddle || 0) * .6;
  mine.fac.stadium.held = 0;  // interference is slowly forgotten
  mine.finLast = mine.fin; mine.fin = newLedger(); mine.spentT = 0;
  // Apply the moves
  for (const [id, to] of moves) {
    const c = CL(id), from = c.lg;
    G.leagues[from].clubs = G.leagues[from].clubs.filter(x => x !== id);
    if (to === "OUT") { c.gone = true; for (const pid of c.squad.slice()) toFreeAgent(P(pid)); c.squad = []; continue; }
    const dest = to || leagueFor(LEAGUES[from].tier + 1, c.half);
    c.lg = dest; c.tier = LEAGUES[dest].tier; G.leagues[dest].clubs.push(id);
    if (isMine(c)) {
      if (to) { moodHit(c, 18); news(`PROMOTED! ${c.name} will play in the ${LEAGUES[dest].name} next season.`, true); }
      else { moodHit(c, -15); news(`Relegated. ${c.name} drop into the ${LEAGUES[dest].name}.`, true); }
    }
  }
  balanceHalves("L6N", "L6S"); balanceHalves("L7N", "L7S");
  for (const k of ["L7N", "L7S"]) while (G.leagues[k].clubs.length < LEAGUES[k].size) { const c = newClub(k, LEAGUES[k].size - 1); c.half = LEAGUES[k].half; genSquad(c); G.leagues[k].clubs.push(c.id); c.founded = G.year; }
  // Standing: reputation drifts toward the club's division, plus a little for finishing high.
  for (const k of LG_KEYS) { const ids = G.leagues[k].clubs, n = ids.length; ids.forEach(id => { const c = CL(id); const prev = table2(k, id, n); c.rep = clamp(Math.round(c.rep + (TIER_REP[c.tier] + prev - c.rep) * .3), 1, 99); }); }
  ownersSummer();
  yearTurnover();
  feedersSummer();
  staffSummer();
  if (G.sTrust && G.sTrust.freeze === G.year) G.sTrust.freeze = 0;
  G.cupsLast = G.cups; G.contLast = G.cont; G.friendlies = []; G.fAsked = []; G.fOpts = null; mine.prep = 0;
  G.year++; G.phase = "summer"; G.week = 0; G.po = null;
  startSeason();
  refreshOffers(mine);
  seasonReview(report, wentUp, wentDown);
}
const capacity2 = c => isMine(c) ? capacity(c) : c.cap;
function table2(k, id) { const t = G.leagues[k].tab && G.leagues[k].tab[id]; if (!t) return 0; const rows = Object.values(G.leagues[k].tab); const pos = rows.filter(r => r.pts > t.pts).length; return Math.round(4 - pos * 8 / rows.length); }
function balanceHalves(n, s) {
  const N = G.leagues[n], S = G.leagues[s], size = LEAGUES[n].size;
  while (N.clubs.length > size) { const id = N.clubs.filter(x => x !== G.club).sort((a, b) => CL(a).region.localeCompare(CL(b).region))[0]; N.clubs = N.clubs.filter(x => x !== id); S.clubs.push(id); const c = CL(id); c.lg = s; c.half = "S"; }
  while (S.clubs.length > size) { const id = S.clubs.filter(x => x !== G.club)[0]; S.clubs = S.clubs.filter(x => x !== id); N.clubs.push(id); const c = CL(id); c.lg = n; c.half = "N"; }
}
function seasonReview(r, up, down) {
  const c = my(), h = G.history[0];
  addMsg({ type: "review", title: `${seasonLabel(r.y)} in review`, body: `${ord(r.pos)} of ${r.size} in the ${LEAGUES[r.lg].name}, ${r.pts} points${up ? " — promoted" : down ? " — relegated" : ""}. Average crowd ${h.att.toLocaleString("en-GB")}. Income ${money(h.inc)}, costs ${money(h.cost)}.` });
  // Staff react to the season against what the club could expect.
  const exp = Math.round(r.size * .5), diff = exp - r.pos;
  if (staffOf("manager")) trust("manager", clamp(Math.round(diff / 2), -6, 8) + (up ? 8 : 0), null);
}

/* Each summer: everyone a year older, retirements, contracts, youth intakes, squads rebuilt. */
function yearTurnover() {
  loveSeason();
  for (const p of Object.values(G.players)) { p.last = { app: p.s.app, g: p.s.g, a: p.s.a }; if (p.req && !p.list) p.req = 0; }  // a refused request can come again next season  // remembered for next season's market
  const mine = my();
  // Contracts: your head of recruitment renews those he wants (you can flag players to keep); the rest leave.
  // He keeps enough players to field a side: the best 18 seniors are renewed if the wage budget allows.
  const seniors = mine.squad.map(P).filter(p => !p.acad).sort((a, b) => b.ovr - a.ovr), core = new Set(seniors.slice(0, 18).map(p => p.id));
  const kept = [], gone = [];
  for (const p of seniors) {
    p.yrs--;
    if (p.yrs > 0) continue;
    if (p.keep || wantsRenewal(p, core.has(p.id))) { p.yrs = ri(1, 3); p.wage = Math.max(p.wage, Math.round(demandWage(p, mine) * (p.ovr < TIER_LVL[mine.tier] - 6 ? .5 : 1) / 100) * 100); kept.push(`${p.name} (${p.yrs} yr, ${money(p.wage)})`); }
    else { toFreeAgent(p); gone.push(p.name); }
  }
  if (kept.length || gone.length) addMsg({ type: "contracts", title: `Contracts: ${kept.length} renewed, ${gone.length} released`, body: (kept.length ? `New contracts: ${kept.join(", ")}. ` : "") + (gone.length ? `Leaving: ${gone.join(", ")}.` : "") });
  for (const s of Object.values(mine.staff).filter(Boolean)) { s.yrs--; if (s.yrs <= 0) { const role = s.role; news(`${s.name}'s contract as ${ROLES_STAFF[role].l.toLowerCase()} has ended. Renew it from the Staff page within the summer or he goes.`, true); s.yrs = 0; s.expiring = true; } }
  for (const p of Object.values(G.players)) {
    p.tot[0] += p.s.app; p.tot[1] += p.s.g; p.age++;
    if (p.club >= 0 && !isMine(CL(p.club)) && !p.acad) { p.yrs--; if (p.yrs <= 0) { if (R() < (p.ovr >= CL(p.club).lvl - 3 ? .95 : .6) && p.age < 34) p.yrs = ri(1, 3); else { leaveClub(p); toFreeAgent(p); } } }
    const ch = p.age >= 39 ? 1 : p.age >= 33 ? (p.age - 32) * .14 * (p.club < 0 ? 2 : 1) * (p.ovr > 75 ? .7 : 1) : p.club < 0 && G.year - p.faY >= 2 ? .6 : 0;
    if (R() < ch) { if (p.club === G.club) news(`${p.name} retires, aged ${p.age}.`); retire(p); }
  }
  // Academy graduates: AI clubs keep the good ones; yours are decided by your youth manager (or you, on the Academy page).
  for (const c of G.clubs) {
    if (c.gone) continue;
    for (const id of c.squad.slice()) { const p = P(id); if (!p.acad || p.age < 19) continue;
      if (isMine(c)) { if (p.keep || p.ovr >= TIER_LVL[c.tier] - 8 || potEstimate(p)[0] >= TIER_LVL[c.tier] + 4) { p.acad = false; p.yrs = 2; p.wage = Math.max(p.wage, demandWage(p, c)); news(`Academy graduate ${p.name} (${p.pos}, ${r20(p.ovr)}) signs a professional contract.`, true); } else { leaveClub(p); toFreeAgent(p); news(`${p.name} is released by the academy.`); } }
      else if (p.ovr >= c.lvl - 12 || p.pot >= c.lvl + 3) { p.acad = false; p.yrs = ri(2, 3); p.wage = wageFor(p.ovr); } else { leaveClub(p); toFreeAgent(p); } }
    youthIntake(c);
  }
  // The free-agent pool is kept to a sensible size: the least employable drift out of the game.
  if (G.fa.length > 600) { const keep = G.fa.map(P).sort((a, b) => b.ovr - a.ovr); for (const p of keep.slice(600)) retire(p); }
  // Talent moves up: players far better than their club are bought by a club at their level.
  for (const p of Object.values(G.players)) {
    if (p.club < 0 || p.acad || p.age > 30 || p.loan) continue; const c = CL(p.club); if (isMine(c)) continue;
    if (p.ovr > c.lvl + 7 && R() < .5) { const buyer = buyerFor(p, c.tier); if (buyer) { moveTo(p, buyer); p.wage = wageFor(p.ovr); p.yrs = ri(2, 4); } }
  }
  // Good free agents don't stay unemployed: a club at their level takes them on.
  for (const p of G.fa.map(P).filter(p => p && p.ovr >= 55 && p.age <= 33)) { const b = buyerFor(p, 8); if (b) { moveTo(p, b); p.wage = wageFor(p.ovr); p.yrs = ri(1, 3); } }
  for (const c of G.clubs) if (!c.gone && !isMine(c)) aiSquadCheck(c, false);
  foreignSummer();
  wonderWatch();
}
function wantsRenewal(p, core) {
  const c = my(), s = staffOf("recruit");
  const useful = core || p.ovr >= TIER_LVL[c.tier] - 6 || (p.age <= 22 && potEstimate(p)[1] >= TIER_LVL[c.tier]);
  if (!s) return pickXI(c).some(o => o.p === p);
  if (s.phil === "potential" && p.age >= 30) return false;
  return useful && wageBill(c) + Math.max(0, demandWage(p, c) * (p.ovr < TIER_LVL[c.tier] - 6 ? .5 : 1) - p.wage) <= c.budget.wages * 1.05;
}
// The club below a player's level that would buy him: one whose standard matches his rating.
function buyerFor(p, belowTier) {
  // The closest few clubs by standard; a player better than every club goes to one of the strongest.
  const cs = G.clubs.filter(c => !c.gone && !isMine(c) && c.tier < belowTier).sort((a, b) => Math.abs(a.lvl - p.ovr) - Math.abs(b.lvl - p.ovr)).slice(0, 6);
  return cs.length && Math.abs(cs[0].lvl - p.ovr) < 5 || (cs.length && p.ovr > cs[0].lvl) ? pick(cs) : null;
}

/* ---------- youth intakes ---------- */
function intakeSpec(c) {
  if (isMine(c)) {
    const lvl = c.fac.acad.lvl; if (!lvl) return null;
    const y = staffOf("youth"), bf = budgetFactor(c.budget.acad, acadRef(lvl)), wide = y && y.focus === "wide";
    return { n: Math.max(1, Math.round(2 + lvl * .45 + (y ? y.at.reach / 40 : 0) + bf * .4 + (wide ? 1 : 0))),
      mean: 37 + vpt("youth") * .4 + lvl * 1.3 + (y ? (y.at.reach - 50) * .05 + (y.at.judge - 50) * .03 : -3) + bf + (wide ? 1.5 : 0),
      exc: 1 + lvl * .1 + (wide ? .5 : 0), phil: y ? y.phil : "balanced", wide };
  }
  return { n: Math.round(2 + c.acadLvl * .3 + R()), mean: 37 + c.acadLvl * 1.3, exc: 1 + c.acadLvl * .1, phil: "balanced", wide: c.tier <= 2 };
}
const LEAN = { technical: { pas: 5, tec: 6, vis: 5, dri: 3, str: -4, pac: -2 }, physical: { pac: 5, str: 6, sta: 5, hea: 3, tec: -4, vis: -3 }, balanced: null };
function youthIntake(c) {
  const s = intakeSpec(c); if (!s) return;
  const got = [];
  for (let i = 0; i < s.n; i++) {
    const pot = drawPotential(s.mean, s.exc), age = ri(15, 16);
    const ovr = clamp(Math.round(pot * rf(.48, .6) + normal() * 3), 12, pot);
    const nat = s.wide && R() < .3 ? pickNat("ENG") : "ENG";
    const p = makePlayer({ pos: pick(["GK", "CB", "CB", "FB", "DM", "CM", "AM", "W", "ST", "ST"]), ovr, age, nat, club: c.id, pot, acad: true, lean: LEAN[s.phil], wage: 500 });
    p.yrs = 3; c.squad.push(p.id); p.hist.push([G.year, c.short]); got.push(p);
    if (pot >= 95) G.wonders.push({ id: p.id, name: p.name, pot, club: c.id, y: G.year });
  }
  if (isMine(c)) {
    const best = got.slice().sort((a, b) => potEstimate(b)[1] - potEstimate(a)[1])[0];
    const y = staffOf("youth");
    addMsg({ type: "intake", title: `Youth intake: ${got.length} new player${got.length > 1 ? "s" : ""}`, body: best ? `${y ? y.name + " rates" : "The coaches rate"} ${best.name} (${best.pos}, ${best.age}) the pick of the group, potential ${est20(potEstimate(best))}.` : "", pid: best && best.id });
  }
}
function wonderWatch() { G.wonders = G.wonders.filter(w => G.players[w.id]); }

/* ---------- AI squads ---------- */
function aiSquadCheck(c, light) {
  const sq = () => c.squad.map(P).filter(p => !p.acad && !p.loan);
  // Too many: release the weakest
  while (sq().length > 26) { const p = sq().sort((a, b) => valueOf(a) - valueOf(b))[0]; leaveClub(p); toFreeAgent(p); }
  // Too few at a position: sign
  for (const [pos, n] of Object.entries(SQUAD_MIX)) {
    let have = sq().filter(p => p.pos === pos && (!p.retiring)).length, guard = 0;
    while (have < n - (light ? 1 : 0) && guard++ < 4) { aiSign(c, pos); have++; }
  }
  // Too weak: replace the weakest regular if he's well below the standard
  if (!light) for (const pos of POS) {
    const ps = sq().filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr), need = Math.ceil(SQUAD_MIX[pos] / 2);
    const weak = ps[need - 1]; if (weak && weak.ovr < c.lvl - 6 && R() < .6) aiSign(c, pos);
  }
}
function aiSign(c, pos) {
  const target = Math.round(c.lvl + normal() * 3);
  let p = null;
  const fas = G.fa.map(P).filter(q => q.pos === pos && q.ovr >= target - 5 && q.ovr <= target + 4 && q.age <= 33);
  if (fas.length) p = fas.sort((a, b) => b.ovr - a.ovr)[0];
  else if (R() < .5) {
    const lower = G.clubs.filter(x => !x.gone && !isMine(x) && x.tier > c.tier && x.tier <= c.tier + 2);
    const pool = []; for (const x of lower) for (const id of x.squad) { const q = P(id); if (q.pos === pos && !q.acad && !q.loan && q.inW !== windowId() && q.ovr >= target - 2 && q.ovr <= target + 5 && q.age <= 30) pool.push(q); }
    if (pool.length) p = pick(pool);
  }
  if (!p) { const ovr = clamp(target, 20, 93), age = ri(21, 30); p = makePlayer({ pos, ovr, age, nat: R() < (c.tier <= 2 ? .5 : .85) ? "ENG" : pickNat("ENG"), pot: seniorPot(ovr, age) }); }
  moveTo(p, c); p.wage = wageFor(p.ovr); p.yrs = ri(1, 4);
}

/* ---------- inbox ---------- */
function addMsg(m) { m.id = G.nextMsg++; m.y = G.year; m.w = whenLabel(); m.age = 0; G.inbox.unshift(m); if (G.inbox.length > 60) G.inbox.length = 60; return m; }
const openDecisions = () => G.inbox.filter(m => (m.type === "bid" || m.type === "choice") && !m.done);
/* Bids you don't answer within a week are decided by your head of recruitment. */
function settleInbox() {
  for (const m of G.inbox.slice()) { m.age++; if (m.done) continue;
    if (m.type === "bid" && m.age >= 2) { const p = G.players[m.pid], c = my();
      // Turning down a club the player wants to join, he offers the improved deal if the wage budget allows it.
      const deal = m.rec !== "accept" && m.keen && p && p.dealY !== G.year && wageBill(c) + newDealWage(p) - p.wage <= c.budget.wages;
      answerBid(m, m.rec === "accept" ? true : deal ? 2 : false, true); }
    if (m.type === "choice" && m.age >= 3) answerChoice(m, m.dflt); }
}
