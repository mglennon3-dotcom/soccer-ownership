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
  if (typeof aiListings === "function" && G.club != null) aiListings();
  for (const p of Object.values(G.players)) p.s = { app: 0, g: 0, a: 0 };
  const c = my(); c.att = []; c.hgs = null; c.morale = 55;
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
  buzzWeek(c); buildWeek(c); aiBuildWeek(); pitchWeek(c, c._home); c._home = false; fansWeek(c); weeklyAccounts(c);
  for (const o of c.offers) o.exp--;
  c.offers = c.offers.filter(o => o.exp > 0);
  if (G.phase !== "playoffs" || G.week === 0) refreshOffers(c);
  if (G.saleOffers) { for (const o of G.saleOffers) o.exp--; G.saleOffers = G.saleOffers.filter(o => o.exp > 0); if (!G.saleOffers.length) G.saleOffers = null; }
  mediaWeek(); trustWeek(c); poachWeek(); staffTrustWeek(); recoverWeek(); forcedWeek(); if (!windowOpen() && loansOpen()) loanOffersWeek(c); requestsCheck(); bidForMyClub();
  settleInbox();
  if (c.cash < -Math.max(250000, TV[c.tier]) && !G.warnedDebt) { G.warnedDebt = true; news(`The club is ${money(-c.cash)} overdrawn and paying 10% interest. Put money in from Finances or cut costs.`, true); }
  if (c.cash >= 0) G.warnedDebt = false;
}
function summerWeek() {
  if (G.week === 1) partnerWindow();
  if (G.week === 2 || G.week === 5) foreignLoans();
  friendlyWeek();
  marketWeek(); youthScoutWeek();
  G.week++;
  if (G.week >= SUMMER_WEEKS) {
    G.phase = "season"; G.week = 0; trimVeterans(); sellSeasonTickets(my());
    if (my().offers.length) { my().offers = []; news("The commercial window closes for the season: offers not taken have lapsed. Sponsors can be signed again next pre-season."); }
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
  if (w === JAN[0]) { partnerWindow(); aiListings(); }
  if (w === JAN[0] || w === JAN[2]) foreignLoans();
  if (JAN.includes(w)) marketWeek();
  awayHelpWeek();
  youthScoutWeek();
  if (w % 3 === 2) devTick(1 / 16);
  G.week++;
  if (G.week >= SEASON_WEEKS) startPlayoffs();
}
function afterMatch(r, k) {
  const c = my(); if (r.h !== c.id && r.a !== c.id) return;
  const home = r.h === c.id, gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg, opp = CL(home ? r.a : r.h);
  let crowd = null; if (home) { crowd = homeGameMoney(c, opp, true); c._home = true; } else { awayTrip(c, opp); awayRefundCheck(c, opp, gf, ga); }
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
// Your play-off: which league, and where you stand in it (semi to play, final to play, out, or won).
function myPlayoff() {
  const e = Object.entries(G.po || {}).find(([, x]) => x.semis.flat().includes(G.club)); if (!e) return null;
  const [k, x] = e, semi = x.semis.find(s => s.includes(G.club));
  if (G.week === 0) return { k, stage: "semi", h: semi[0], a: semi[1] };
  if (x.final && x.final.includes(G.club)) return { k, stage: "final", h: x.final[0], a: x.final[1] };
  return { k, stage: "out", opp: semi[0] === G.club ? semi[1] : semi[0] };
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
    ids.forEach((id, i) => { const x = CL(id); if (!isMine(x)) x.push = i < Math.max(2, Math.round(ids.length * .25)); });
    if (champ.id === G.club) news(`CHAMPIONS! ${mine.name} win the ${L.name}.`, true);
    if (ABOVE[k]) {
      const up = ids.slice(0, L.auto); if (G.po[k] && G.po[k].win != null) up.push(G.po[k].win);
      // Promoted clubs go up whatever their ground holds. AI clubs grow their grounds as they rise.
      const final = up;
      for (const id of up) { const c = CL(id); if (!isMine(c)) c.cap = Math.max(c.cap, Math.min(aiSite(c), Math.round(STADIUM_T[LEAGUES[ABOVE[k]].tier] * rf(.5, .8) / 100) * 100)); }
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
  seasonTax(mine);
  { const f0 = mine.fin, inc = ledgerIncome(f0), net = inc - (ledgerCosts(f0) - f0.build - f0.acad), r = spendRule(mine, net, inc);
    mine.ded = r.pen; if (r.pen) news(`The league docks you ${r.pen} points for next season: over three seasons you lost ${Math.round(r.ratio * 100)}% of your income, past the 35% the spending rule allows.`, true); }
  // History
  const f = mine.fin;
  G.history.unshift({ club: mine.name, obj: (G.objRes || []).map(o => (o.met ? "✓ " : "✗ ") + o.t), cups: [...Object.entries(G.cups || {}).map(([k, K]) => { if (K.win === G.club) return CUP_DEF[k].name + ": winners"; const last = K.log.filter(x => x.h === G.club || x.a === G.club).pop(); return last ? `${CUP_DEF[k].name}: ${last.r.toLowerCase()}` : null; }),
    ...Object.values(G.cont || {}).map(K => { if (!K.teams.includes(G.club)) return null; if (K.win === G.club) return CONT[K.key].name + ": winners"; const r = K.ko.filter(R => R.ties.some(t => t.h === G.club || t.a === G.club)).pop(); return `${CONT[K.key].name}: ${r ? r.n.toLowerCase() : "group stage"}`; })].filter(Boolean), y: G.year, lg: report.lg, tier: report.tier, pos, size, pts: report.pts, up: wentUp, down: wentDown, po: G.po[report.lg] && G.po[report.lg].semis.flat().includes(G.club),
    inc: ledgerIncome(f), cost: ledgerCosts(f), att: Math.round(avg(mine.att || [])), st: stHolders(mine), stp: mine.st && mine.st.y === G.year ? mine.st.price : null, fans: mine.fans, cash: mine.cash, mgr: mgr().name,
    top: Object.values(G.players).filter(p => p.club === G.club).sort((a, b) => b.s.g - a.s.g)[0]?.name || "" });
  investorsSummer({ up: wentUp, down: wentDown }); fanCultureSummer(mine, wentUp, wentDown); wageClauses(mine, wentUp, wentDown);
  endLoans();
  G.meddle = (G.meddle || 0) * .6;
  mine.fac.stadium.held = 0;  // interference is slowly forgotten
  mine.finLast = mine.fin; mine.fin = newLedger(); mine.spentT = 0;
  // Parachute payments move on a season; a club that has had them all stops getting them.
  for (const c of G.clubs) if (c.para && ++c.para.i >= c.para.n) delete c.para;
  // Apply the moves
  for (const [id, to] of moves) {
    const c = CL(id), from = c.lg;
    if (to !== "OUT") { const ft = LEAGUES[from].tier;
      if (to) delete c.para;  // promoted: the parachute stops
      else if (PARA[ft]) { const up = G.year - (c.tierSince ?? -99) + 1, n = ft === 1 && up < 2 ? 2 : PARA[ft].length, np = { from: ft, i: 0, n };
        if (!c.para || TV[ft] * PARA[ft][0] > paraOf(c)) c.para = np; }
      c.tierSince = G.year + 1; }
    G.leagues[from].clubs = G.leagues[from].clubs.filter(x => x !== id);
    if (to === "OUT") { c.gone = true; for (const pid of c.squad.slice()) toFreeAgent(P(pid)); c.squad = []; continue; }
    const dest = to || leagueFor(LEAGUES[from].tier + 1, c.half);
    c.lg = dest; c.tier = LEAGUES[dest].tier; G.leagues[dest].clubs.push(id);
    if (isMine(c) && !to && c.para && c.para.i === 0 && c.para.from === LEAGUES[from].tier) news(`Parachute payments: as a relegated club you'll receive ${paraPlan(c).map(money).join(", then ")} over the next ${paraPlan(c).length} seasons, unless you go straight back up.`, true);
    if (isMine(c)) {
      if (to) { moodHit(c, 18); news(`PROMOTED! ${c.name} will play in the ${LEAGUES[dest].name} next season.`, true);
        const g = gradingCost(c, LEAGUES[dest].tier); if (g) { spend("grading", g); news(`The ${LEAGUES[dest].name} requires ground-grading works before the season: ${money(g)}${c.fac.stadium.own ? "" : " (your share of the work at your landlord's ground)"}.`, true); } }
      else { moodHit(c, -15); news(`Relegated. ${c.name} drop into the ${LEAGUES[dest].name}.`, true); }
    }
  }
  balanceHalves("L6N", "L6S"); balanceHalves("L7N", "L7S");
  for (const k of ["L7N", "L7S"]) while (G.leagues[k].clubs.length < LEAGUES[k].size) { const c = newClub(k, LEAGUES[k].size - 1); c.half = LEAGUES[k].half; genSquad(c); G.leagues[k].clubs.push(c.id); c.founded = G.year; }
  // Standing: reputation drifts toward the club's division, plus a little for finishing high.
  for (const k of LG_KEYS) { const ids = G.leagues[k].clubs, n = ids.length; ids.forEach(id => { const c = CL(id); const prev = table2(k, id, n); c.rep = clamp(Math.round(c.rep + (TIER_REP[c.tier] + prev - c.rep) * .3), 1, 99); }); }
  (G.repLog ||= []).push([G.year, my().rep]);  // the prestige tracker's season-by-season line
  ownersSummer();
  diversitySummer();
  yearTurnover();
  acadDropouts(mine);
  feedersSummer();
  staffSummer();
  if (G.sTrust && G.sTrust.freeze === G.year) G.sTrust.freeze = 0;
  G.cupsLast = G.cups; G.contLast = G.cont; G.friendlies = []; G.fAsked = []; G.fOpts = null; mine.prep = 0;
  G.poLast = G.po; G.year++; G.phase = "summer"; G.week = 0; G.po = null;
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
    // He has his say too: the least he'd re-sign for, or he won't (no place in the system, no football, a bigger club calls).
    const want = p.keep || wantsRenewal(p, core.has(p.id)), un = want ? unhappiness(p, mine) : null;
    const ask = want ? (un && R() < clamp(un.s * .22, 0, .75) ? null : playerAsk(p, mine)) : undefined;  // an unhappy player may simply say no
    if (ask === null) { logMove("expired", p, { wage: p.wage }); toFreeAgent(p); gone.push(`${p.name} (turned down a new deal${un ? `: ${un.why[0]}` : ""})`); continue; }
    if (ask !== undefined) { p.yrs = ri(1, 3); p.wage = Math.max(p.wage, Math.round(ask / 100) * 100); kept.push(`${p.name} (${p.yrs} yr, ${pw(p.wage)})`); }
    else { logMove("expired", p, { wage: p.wage }); toFreeAgent(p); gone.push(p.name); }
  }
  if (kept.length || gone.length) addMsg({ type: "contracts", title: `Contracts: ${kept.length} renewed, ${gone.length} released`, body: (kept.length ? `New contracts: ${kept.join(", ")}. ` : "") + (gone.length ? `Leaving: ${gone.join(", ")}.` : "") });
  for (const s of Object.values(mine.staff).filter(Boolean)) { s.yrs--; if (s.yrs <= 0) { const role = s.role; news(`${s.name}'s contract as ${ROLES_STAFF[role].l.toLowerCase()} has ended. Renew it from the Staff page within the summer or ${pr(s, "he")} goes.`, true); s.yrs = 0; s.expiring = true; } }
  // Youth pedigree: your own graduates who were first-team regulars this season build the academy's name.
  { const grads = mine.squad.map(P).filter(p => p && p.yAcad === mine.id && !p.acad && p.s.app >= 20).length;
    const before = youthPedigree(mine); mine.ypd = Math.round(clamp(before * .92 + grads * .6, -3, 10) * 10) / 10;
    if (grads && Math.floor(mine.ypd) > Math.floor(before)) news(`${grads} academy graduate${grads > 1 ? "s were" : " was a"} first-team regular${grads > 1 ? "s" : ""} this season: the academy's reputation grows, and better players will want to join.`); }
  for (const p of Object.values(G.players)) {
    // Progression: one compact row a season [season, age, rating, club, apps, goals, assists, potential], last ten kept.
    const club = p.loanedAt && p.loanedAt.y === G.year ? `${p.loanedAt.short} (loan)` : p.club >= 0 ? CL(p.club).short : p.club === -2 ? "ABR" : "FA";
    (p.prog ||= []).push([G.year, p.age, p.ovr, club, p.s.app, p.s.g, p.s.a, p.pot]); if (p.prog.length > 10) p.prog.shift();
    p.tot[0] += p.s.app; p.tot[1] += p.s.g; p.age++;
    // AI wages drift toward what the club pays for the player's rating: about a third of the gap a year, down as he declines, up as he improves.
    if (p.club >= 0 && !isMine(CL(p.club)) && !p.acad && !p.loan) { const go = aiWage(p, CL(p.club)); p.wage = Math.round((p.wage + (go - p.wage) * .35) / 100) * 100; }
    if (p.club >= 0 && !isMine(CL(p.club)) && !p.acad) { p.yrs--; if (p.yrs <= 0) { if (R() < (p.ovr >= CL(p.club).lvl - 3 ? .95 : .6) && p.age < 34) p.yrs = ri(1, 3); else { leaveClub(p); toFreeAgent(p); } } }
    // Veterans nobody signs hang up their boots sooner.
    const ch = p.age >= 39 ? 1 : p.club < 0 && p.age >= 33 ? Math.min(1, .4 + (p.age - 33) * .2) : p.age >= 33 ? (p.age - 32) * .14 * (p.ovr > 75 ? .7 : 1) : 0;
    if (R() < ch) { if (p.club === G.club) news(`${p.name} retires, aged ${p.age}.`); retire(p); }
    // Three summers without a club and he's out of the game for good (no newcomer replaces him: he was never missed).
    else if (p.club === -1 && G.year - (p.faY ?? G.year) >= 3) retire(p, true);
  }
  // Academy graduates: AI clubs keep the good ones; yours are decided by your youth manager (or you, on the Academy page).
  for (const c of G.clubs) {
    if (c.gone) continue;
    for (const id of c.squad.slice()) { const p = P(id); if (!p.acad || p.age < 19) continue;
      if (isMine(c)) { if (p.keep || p.ovr >= TIER_LVL[c.tier] - 8 || potEstimate(p)[0] >= TIER_LVL[c.tier] + 4) { p.acad = false; p.yrs = 2; p.wage = Math.max(p.wage, demandWage(p, c)); news(`Academy graduate ${p.name} (${p.pos}, ${r20(p.ovr)}) signs a professional contract.`, true); } else { leaveClub(p); toFreeAgent(p); news(`${p.name} is released by the academy.`); } }
      else if (p.ovr >= c.lvl - 12 || p.pot >= c.lvl + 3) { p.acad = false; p.yrs = ri(2, 3); p.wage = aiWage(p, c); } else { leaveClub(p); toFreeAgent(p); } }
    youthIntake(c);
  }
  // The free-agent pool is kept to a sensible size: the least employable drift out of the game.
  if (G.fa.length > 600) { const keep = G.fa.map(P).sort((a, b) => b.ovr - a.ovr); for (const p of keep.slice(600)) retire(p, true); }
  // Talent moves up: players far better than their club are bought by a club at their level.
  for (const p of Object.values(G.players)) {
    if (p.club < 0 || p.acad || p.age > 30 || p.loan) continue; const c = CL(p.club); if (isMine(c)) continue;
    if (p.ovr > c.lvl + 7 && R() < .5) { const buyer = buyerFor(p, c.tier); if (buyer) { moveTo(p, buyer); p.wage = aiWage(p, buyer); p.yrs = ri(2, 4); } }
  }
  // Good free agents don't stay unemployed: a club at their level takes them on.
  for (const p of G.fa.map(P).filter(p => p && p.ovr >= 55 && p.age <= 33)) { const b = buyerFor(p, 8); if (b) { moveTo(p, b); p.wage = aiWage(p, b); p.yrs = ri(1, 3); } }
  for (const c of G.clubs) if (!c.gone && !isMine(c)) aiSquadCheck(c, false);
  freshFreeAgents();
  foreignSummer();
  wonderWatch();
}
function wantsRenewal(p, core) {
  const c = my(), s = staffOf("recruit");
  const useful = core || p.ovr >= TIER_LVL[c.tier] - 6 || (p.age <= 22 && potEstimate(p)[1] >= TIER_LVL[c.tier]);
  if (!s) return pickXI(c).some(o => o.p === p);
  if (s.phil === "potential" && p.age >= 30) return false;
  return useful && wageBill(c) + Math.max(0, demandWage(p, c) - p.wage) <= c.budget.wages * 1.05;
}
// The club below a player's level that would buy him: one whose standard matches his rating.
function buyerFor(p, belowTier) {
  // The closest few clubs by standard; a player better than every club goes to one of the strongest.
  // Clubs bound by the spending rule don't take on more pay once their wage bill is well past what they can afford.
  const cs = G.clubs.filter(c => !c.gone && !isMine(c) && c.tier < belowTier).sort((a, b) => Math.abs(a.lvl - p.ovr) - Math.abs(b.lvl - p.ovr)).slice(0, 10).filter(ruleRoom).slice(0, 6);
  return cs.length && Math.abs(cs[0].lvl - p.ovr) < 5 || (cs.length && p.ovr > cs[0].lvl) ? pick(cs) : null;
}

/* ---------- youth intakes ---------- */
/* Where an intake centres: the academy's level matters most (better coaching, better players choose it), and so does the
   club's division (a bigger club draws better players). Most still won't make it: a typical player's potential sits a few
   divisions below the first team; the best in ten reaches about the club's own level, the best in a hundred well above. */
const youthBase = (c, lvl) => 40 + lvl * 2.2 + (7 - c.tier) * 1.2 + youthPedigree(c);  // on the old scale; each draw is converted
/* Youth pedigree: some clubs have always produced players, whatever their division; a few never have. AI clubs have it
   from history (about 1 in 8 renowned, 1 in 10 poor). Yours is earned: it grows as your own graduates become
   first-team regulars (20+ games in a season) and fades slowly without them. Points of potential on every intake. */
const youthPedigree = c => c.ypd ??= isMine(c) ? 0 : R() < .12 ? Math.round(rf(4, 9) * 10) / 10 : R() < .11 ? Math.round(rf(-3, -1) * 10) / 10 : Math.round(rf(-.5, 1.5) * 10) / 10;
const pedigreeWord = c => { const v = youthPedigree(c); return v >= 4 ? ["Renowned for developing youth", "good"] : v >= 2 ? ["A good record with youth", "good"] : v <= -1 ? ["A poor record with youth", "warn"] : null; };
const GOLD_RATE = .006;
const gemMult = c => 1 + Math.max(0, youthPedigree(c)) / 5;
// An AI club's youth scouting (its youth manager's scouting, as yours has): how well it finds players (staff-style 0-100). Better at clubs known for youth
// and further up the pyramid; it lifts their intakes like a youth manager's scouting does yours.
// Mostly set by the club's level (bigger clubs, better scouts), with a spread; clubs renowned for youth rate well anywhere.
const YSCOUT_T = [0, 74, 62, 52, 46, 40, 34, 28];
const aiYouthScout = c => c.yscout ??= clamp(Math.round(YSCOUT_T[c.tier] + normal() * 7 + youthPedigree(c) * 3), 5, 97);
function intakeSpec(c) {
  if (isMine(c)) {
    const lvl = c.fac.acad.lvl; if (!lvl) return null;
    const y = staffOf("youth"), bf = budgetFactor(c.budget.acad, acadRef(lvl)), wide = y && y.focus === "wide";
    return { n: Math.max(3, Math.round(2 + lvl * .45 + (y ? y.at.reach / 40 : 0) + bf * .4 + (wide ? 1 : 0))),
      mean: youthBase(c, lvl) + vpt("youth") * .4 + (y ? (y.at.reach - 50) * .05 + (y.at.judge - 50) * .03 : -3) + bf + (wide ? 1.5 : 0),
      exc: 1 + lvl * .1 + (wide ? .5 : 0), phil: y ? y.phil : "balanced", wide };
  }
  return { n: Math.round(2 + c.acadLvl * .3 + aiYouthScout(c) / 50 + R()), mean: youthBase(c, c.acadLvl) + (aiYouthScout(c) - 50) * .05, exc: 1 + c.acadLvl * .1, phil: "balanced", wide: c.tier <= 2 };
}
const LEAN = { technical: { pas: 5, tec: 6, vis: 5, dri: 3, str: -4, pac: -2 }, physical: { pac: 5, str: 6, sta: 5, hea: 3, tec: -4, vis: -3 }, balanced: null };
function youthIntake(c) {
  const s = intakeSpec(c); if (!s) return;
  const got = [];
  // A golden generation: now and then an academy, often a modest one, turns up several gems in one intake.
  const gold = R() < GOLD_RATE * gemMult(c) ? Math.min(s.n, ri(2, 4)) : 0;
  for (let i = 0; i < s.n; i++) {
    const pot = Math.round(oldToNew(i < gold ? clamp(rh(s.mean + 18 + R() * 22), 8, 94) : drawPotential(s.mean, s.exc, gemMult(c)))), age = ri(15, 16);
    const ovr = clamp(Math.round(pot * rf(.48, .6) + normal() * 3), 12, pot);
    const nat = s.wide && R() < .3 ? pickNat("ENG") : "ENG";
    const p = makePlayer({ pos: pick(["GK", "CB", "CB", "FB", "DM", "CM", "AM", "W", "ST", "ST"]), ovr, age, nat, club: c.id, pot, acad: true, lean: LEAN[s.phil], wage: 500 }); p.yAcad = c.id;
    p.yrs = 3; c.squad.push(p.id); p.hist.push([G.year, c.short]); got.push(p);
    if (pot >= 95) G.wonders.push({ id: p.id, name: p.name, pot, club: c.id, y: G.year });
  }
  if (gold) { (G.golden ||= []).push({ club: c.id, y: G.year, n: gold });
    if (isMine(c)) news(`A golden generation: the coaches think this year's intake holds ${gold} exceptional prospects.`, true);
    else if (c.lg === my().lg) news(`${c.name}'s academy is said to have a golden generation coming through.`); }
  if (isMine(c)) {
    const best = got.slice().sort((a, b) => potEstimate(b)[1] - potEstimate(a)[1])[0];
    const y = staffOf("youth");
    addMsg({ type: "intake", title: `Youth intake: ${got.length} new player${got.length > 1 ? "s" : ""}`, body: best ? `${y ? y.name + " rates" : "The coaches rate"} ${best.name} (${best.pos}, ${best.age}) the pick of the group, potential ${est20(potEstimate(best))}.` : "", pid: best && best.id });
  }
}
/* ---------- youth scouting ----------
   Besides the summer intake, the youth manager brings in players his scouts find, three times a year: late summer,
   January and a spring trial day. How many, and how good, depends on his scouting reach and eye for potential, the
   academy budget and level, and whether he looks locally or nationally and abroad. Trialists cost nothing; players from
   other academies cost a little compensation. */
const YOUTH_SCOUT = [["summer", 4, "Late-summer scouting"], ["season", 20, "January scouting"], ["season", 34, "Spring trial day"]];
const YOUTH_COMP = [0, 60e3, 40e3, 25e3, 15e3, 8e3, 5e3, 3e3];
/* Academy players who stop improving drift away. Each summer, a player of 16 or older who's been with you a year and gained
   less than 3 rating points may leave: likelier the less he improved, once he's 18, when his prospects look bleak and
   with no youth manager; a good youth manager keeps more of them. A player your staff still rate highly asks first (you can try to talk him round); the rest
   move to another club's academy (a little compensation) or give up the game. */
function acadDropouts(c) {
  const y = staffOf("youth"), keep = y ? staffAvg(y) / 100 * .12 + (y.at.dev - 50) / 100 * .1 : -.08, asked = [];
  for (const p of c.squad.map(P).filter(p => p && p.acad && p.age >= 16 && p.club === c.id)) {
    const rows = p.prog || []; if (rows.length < 2 || p.stayY === G.year) continue;
    const gain = rows[rows.length - 1][2] - rows[rows.length - 2][2]; if (gain >= 3) continue;
    const [a, b] = potEstimate(p), mid = (a + b) / 2, rated = mid >= TIER_LVL[c.tier] - 6, bleak = mid < TIER_LVL[c.tier] - 12;
    if (R() > clamp(.28 + (3 - gain) * .1 + (p.age >= 18 ? .1 : 0) + (bleak ? .1 : 0) - keep, .05, .75)) continue;
    if (rated && asked.length < 3) { asked.push(p.id); addChoice("acadLeave", `${p.name} (${p.pos}, ${p.age}) wants to leave the academy`, `He feels he's stopped improving (${gain > 0 ? `up only ${gain} in a year` : "no better than a year ago"}) and wants a fresh start elsewhere. ${y ? y.name + " still rates him" : "The coaches still rate him"}: potential ${est20([a, b])}. You can let him go, or try to talk him round.`, ["Let him go", "Talk him round"], { pid: p.id }, 0); }
    else acadLeave(p, c);
  }
}
function acadLeave(p, c) {
  const to = R() < .65 ? pick(G.clubs.filter(x => !x.gone && !x.abroad && !isMine(x) && Math.abs(x.tier - c.tier) <= 2)) : null;
  if (to) { leaveClub(p); moveTo(p, to); p.acad = true; const fee = Math.round(YOUTH_COMP[c.tier] * rf(.3, .7) / 500) * 500; if (fee) earn("sales", fee); logMove("out", p, { club: to.name, fee, wage: 0, by: "academy" });
    news(`Academy player ${p.name} (${p.age}) leaves for ${to.name}${to.name.endsWith("s") ? "'" : "'s"} academy${fee ? `: ${money(fee)} compensation` : ""}. He'd stopped improving here.`); }
  else { leaveClub(p); toFreeAgent(p); news(`Academy player ${p.name} (${p.age}) leaves the club. He'd stopped improving and wants to try something else.`); }
}
function youthScoutWeek() {
  const c = my(), y = staffOf("youth"), lvl = c.fac.acad.lvl; if (!y || !lvl) return;
  const r = YOUTH_SCOUT.find(([ph, w]) => G.phase === ph && G.week === w); if (!r) return;
  const sp = intakeSpec(c), bf = budgetFactor(c.budget.acad, acadRef(lvl)), wide = y.focus === "wide", trial = r[1] === 34;
  const room = 14 + lvl * 2 - c.squad.filter(id => P(id).acad).length;  // a bigger academy holds more players
  const n = Math.min(room, clamp(Math.round(.5 + y.at.reach / 45 + bf * .3 + lvl * .15 + (wide ? .8 : 0) + rf(-.6, .6)), 1, 4)), got = [];
  if (n <= 0) return;
  const asks = [];
  for (let i = 0; i < n; i++) {
    const from = trial ? "trial" : wide && R() < .35 ? "abroad" : R() < .5 ? "academy" : "trial";
    const pot = Math.round(oldToNew(drawPotential(sp.mean - 2 + (y.at.judge - 50) * .04 + (from === "academy" ? 1 : 0), sp.exc, gemMult(c)))), age = trial ? ri(15, 16) : ri(15, 17);
    const ovr = clamp(Math.round(pot * rf(.48, .6) + (age - 15) * 2 + normal() * 3), 12, pot);
    const fee = from === "trial" ? 0 : Math.round(YOUTH_COMP[c.tier] * rf(.6, 1.4) * (from === "abroad" ? 1.5 : 1) / 500) * 500;
    // Trialists join straight away. A player from another academy (or abroad) costs compensation, so he waits for your say:
    // until then he's nobody's (club -3).
    const p = makePlayer({ pos: pick(["GK", "CB", "CB", "FB", "DM", "CM", "AM", "W", "ST", "ST"]), ovr, age, nat: from === "abroad" ? pickNat("ENG") : "ENG", club: fee ? -3 : c.id, pot, acad: true, lean: LEAN[sp.phil], wage: 500 });
    p.yrs = 3;
    if (fee) { asks.push({ p, from, fee }); continue; }
    joinAcademy(p, c); got.push({ p, from, fee });
  }
  const where = { trial: "from a trial", academy: "from another academy", abroad: "from abroad" };
  if (got.length) addMsg({ type: "intake", title: `${r[2]}: ${got.length} player${got.length > 1 ? "s" : ""} join${got.length > 1 ? "" : "s"} the academy`,
    body: got.map(({ p, from }) => `${p.name} (${p.pos}, ${p.age}) ${where[from]}, potential ${est20(potEstimate(p))}`).join("; ") + "." + (asks.length ? ` ${y.name} also wants to sign ${asks.length} player${asks.length > 1 ? "s" : ""} who would cost compensation: see your inbox.` : ""),
    pid: got.slice().sort((a, b) => potEstimate(b.p)[1] - potEstimate(a.p)[1])[0].p.id });
  for (const { p, from, fee } of asks)
    addChoice("ySign", `${y.name} wants to sign ${p.name} (${p.pos}, ${p.age}) ${where[from]}`, `${y.name} rates his potential ${est20(potEstimate(p))} (rating now ${r20(p.ovr)}). His ${from === "abroad" ? "club abroad" : "academy"} wants ${money(fee)} in compensation. If you don't answer within three weeks, the chance goes.`, [`Sign him (${money(fee)})`, "Pass"], { pid: p.id, fee, from }, 1);
}
function joinAcademy(p, c) {
  p.club = c.id; c.squad.push(p.id); p.hist.push([G.year, c.short]); p.yAcad = c.id;
  if (p.pot >= 95) G.wonders.push({ id: p.id, name: p.name, pot: p.pot, club: c.id, y: G.year });
}
/* ---------- overruling the youth manager ----------
   The youth manager judges each academy player as at graduation: keep him if he's close to first-team level or his
   potential (as estimated) is clearly above the division; ready for a pro contract if close to first-team level, or 18+
   with that potential. Going against that costs trust (scaled by how she or he takes a hands-on owner), and counts as
   stepping in: releasing a player rated highly (4 each), promoting one not ready (2), keeping one marked to go (1), or
   turning down a signing asked for (0.5). A bulk action costs at most 10. */
const youthRates = (p, c = my()) => p.ovr >= TIER_LVL[c.tier] - 8 || potEstimate(p)[0] >= TIER_LVL[c.tier] + 4;
const youthReady = (p, c = my()) => p.ovr >= TIER_LVL[c.tier] - 8 || (p.age >= 18 && potEstimate(p)[0] >= TIER_LVL[c.tier] + 4);
const YOUTH_COST = { release: 4, promote: 2, keep: 1, pass: .5 };
function youthOverrides(kind, ps) { return ps.filter(p => kind === "release" ? youthRates(p) : kind === "promote" ? !youthReady(p) : kind === "keep" ? !youthRates(p) : true); }
function overruleYouth(kind, ps) {
  const y = staffOf("youth"), bad = youthOverrides(kind, ps); if (!y || !bad.length) return;
  const d = Math.min(10, bad.length * YOUTH_COST[kind]), names = bad.map(p => p.name).join(", "), one = bad.length === 1;
  G.meddle = (G.meddle || 0) + .15 * bad.length;
  const why = kind === "release" ? `rated ${names} and didn't want ${one ? "him" : "them"} released.` : kind === "promote" ? `doesn't think ${names} ${one ? "is" : "are"} ready for the first team.` : kind === "keep" ? `would have let ${names} go.` : `wanted to sign ${names}.`;
  if (d * tolF(y) < 5) news(`${y.name} (youth manager): ${why}`);  // smaller hits get a word in the news too
  meddled("youth", -d, kind === "release" ? `rated ${names} and didn't want ${one ? "him" : "them"} released.` : kind === "promote" ? `doesn't think ${names} ${one ? "is" : "are"} ready for the first team.` : kind === "keep" ? `would have let ${names} go.` : `wanted to sign ${names}.`);
}
DECIDE.ySign = (m, i) => {
  const p = G.players[m.data.pid]; if (!p || p.club !== -3) return;
  if (i === 0) { const c = my(); spend("acad", m.data.fee); joinAcademy(p, c); logMove("youth", p, { club: m.data.from === "abroad" ? "a club abroad" : "another academy", fee: m.data.fee, by: "you" }); news(`${p.name} (${p.pos}, ${p.age}) joins the academy for ${money(m.data.fee)} in compensation.`); }
  else { if (!m.auto) overruleYouth("pass", [p]); delete G.players[p.id]; news(m.auto ? `The chance to sign ${p.name} for the academy has gone.` : `You pass on ${p.name}.`); }
};
/* New faces among the free agents each summer: players released by clubs outside the game's leagues, back from abroad
   or out of university football, so the pool is never only veterans. Topped up to about 130 aged 29 or under, mostly
   at lower-division level with a few better ones. */
// Veterans without a club beyond about sixty retire, the least employable first.
function trimVeterans() { const v = G.fa.map(P).filter(p => p && p.age >= 33).sort((a, b) => b.ovr - a.ovr); for (const p of v.slice(60)) retire(p, true); }
function freshFreeAgents(target = 130) {
  trimVeterans();
  const young = G.fa.map(P).filter(p => p && p.age <= 29).length;
  for (let i = young; i < target; i++) {
    const age = ri(18, 29), ovr = clamp(Math.round(rf(30, 58) + (R() < .12 ? rf(5, 14) : 0)), 25, 75);
    toFreeAgent(makePlayer({ pos: pick(POS), ovr, age, nat: R() < .75 ? "ENG" : pickNat("ENG"), pot: seniorPot(ovr, age) }));
  }
}
/* Promotion and relegation clauses: every contract at your club pays 25% more after a promotion and 25% less after a
   relegation (loanees are paid by their own clubs; academy players are on youth terms). Money-motivated players don't
   take a cut quietly: the greedier they are, the likelier they hand in a transfer request, and the rest grumble. */
const CLAUSE = .25;
function wageClauses(c, up, down) {
  if (!up && !down) return;
  const ps = c.squad.map(P).filter(p => p && !p.acad && !(p.loan && p.loan.to === c.id)), before = wageBill(c), quit = [];
  for (const p of ps) {
    p.wage = Math.round(p.wage * (up ? 1 + CLAUSE : 1 - CLAUSE) / 100) * 100;
    if (down) {
      const pr = prefsOf(p, P_FACTORS), greed = wageMult(p, c);
      if (pr.top.includes("money") || greed > 1.1) {
        p.payGrudge = (p.payGrudge || 0) + 1; p.unsettled = Math.max(p.unsettled || 0, 6);
        if (!p.keep && !p.req && R() < clamp((greed - 1) * 2.5 + (pr.top[0] === "money" ? .3 : .1), .1, .85)) { p.req = G.year; p.list = true; quit.push(p.name); }
      }
    }
  }
  news(up ? `Promotion clauses kick in: ${ps.length} players' wages rise by 25% (the wage bill goes from ${money(before)} to ${money(wageBill(c))} a year).`
    : `Relegation clauses kick in: ${ps.length} players' wages fall by 25% (the wage bill goes from ${money(before)} to ${money(wageBill(c))} a year).${quit.length ? ` Money-motivated players won't take the cut: ${quit.join(", ")} hand${quit.length > 1 ? "" : "s"} in transfer request${quit.length > 1 ? "s" : ""}.` : ""}`, true);
}
function wonderWatch() { G.wonders = G.wonders.filter(w => G.players[w.id]); }

/* ---------- AI squads ---------- */
function aiSquadCheck(c, light) {
  const sq = () => c.squad.map(P).filter(p => !p.acad && !p.loan);
  // Too many: release the weakest
  capSquad(c);
  // Too few at a position: sign
  for (const [pos, n] of Object.entries(SQUAD_MIX)) {
    let have = sq().filter(p => p.pos === pos && (!p.retiring)).length, guard = 0;
    while (have < n - (light ? 1 : 0) && guard++ < 4) { aiSign(c, pos); have++; }
  }
  // Too weak: replace the weakest regular if he's well below the standard
  if (!light) for (const pos of POS) {
    const ps = sq().filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr), need = Math.ceil(SQUAD_MIX[pos] / 2);
    const weak = ps[need - 1]; if (weak && weak.ovr < c.lvl - 6 + Math.max(0, ownStyle(c).spend) * .5 && R() < clamp(.6 + ownStyle(c).spend * .05, .35, .9) && aiBill(c) < aiBudget(c)) aiSign(c, pos);
  }
}
function aiSign(c, pos) {
  // c.lvl already carries the owner's spending; a big spender also aims a little higher and buys more readily.
  const sp = ownStyle(c).spend, target = Math.round(c.lvl + sp * .3 + normal() * 4.5);
  let p = null;
  const fas = G.fa.map(P).filter(q => q.pos === pos && q.ovr >= target - 5 && q.ovr <= target + 4 && q.age <= 33);
  if (fas.length) p = fas.sort((a, b) => b.ovr - a.ovr)[0];
  else if (R() < clamp(.5 + sp * .07, .15, .9)) {
    const lower = G.clubs.filter(x => !x.gone && !isMine(x) && x.tier > c.tier && x.tier <= c.tier + 2);
    const pool = []; for (const x of lower) for (const id of x.squad) { const q = P(id); if (q.pos === pos && !q.acad && !q.loan && q.inW !== windowId() && q.ovr >= target - 2 && q.ovr <= target + 5 && q.age <= 30) pool.push(q); }
    if (pool.length) p = pick(pool);
  }
  if (!p) { const ovr = clamp(target, 20, 93), age = ri(21, 30); p = makePlayer({ pos, ovr, age, nat: R() < (c.tier <= 2 ? .5 : .85) ? "ENG" : pickNat("ENG"), pot: seniorPot(ovr, age) }); }
  moveTo(p, c); p.wage = aiWage(p, c); p.yrs = ri(1, 4);
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
    if (m.type === "war" && m.age >= 2) warSell(m, true);
    if (m.type === "choice" && m.age >= 3) { m.auto = true; answerChoice(m, m.dflt); } }
}
