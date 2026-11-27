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
  for (const p of Object.values(G.players)) if (p.r0 == null) p.r0 = r20(p.ovr);  // a first season's arrows start here
  for (const k of LG_KEYS) {
    const L = G.leagues[k]; L.rounds = roundRobin(shuffle(L.clubs.slice())); L.next = 0; L.tab = {};
    for (const id of L.clubs) L.tab[id] = { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
  }
  G.myRes = []; G.po = null;
  for (const c of G.clubs) if (!c.gone && c.ded && G.leagues[c.lg].tab[c.id]) G.leagues[c.lg].tab[c.id].pts -= c.ded;  // administration
  for (const k of LG_KEYS) G.leagues[k].pend = [];
  for (const id of G.foreign || []) CL(id).gp = 0;
  startCups(); startContinental();
  if (G.club != null) { const c = my(), cr = clubSeasonForm(c);
    if (cr && cr.y === G.year) news(`Something isn't right at the club going into the season: ${cr.why}. Results may suffer${cr.left ? " for a while" : ""}.`, true);
    else if (cr) news(`The problems from last season haven't gone away: ${cr.why}.`, true);
    else if (c.surge === G.year) news("Pre-season has gone brilliantly: there's a buzz about the squad.", true); }
  if (typeof aiListings === "function" && G.club != null) aiListings();
  // Last season's minutes targets: how they went (the manager's report), then they're cleared.
  if (G.club != null) { const T = Object.values(G.players).filter(p => p.minT && p.club === G.club);
    if (T.length) news(`Minutes targets last season: ${T.map(p => `${p.name} ${((p.s && p.s.min) || 0).toLocaleString("en-GB")} of ${p.minT.toLocaleString("en-GB")}${((p.s && p.s.min) || 0) >= p.minT ? " ✓" : ""}`).join(", ")}. Set new ones on their player cards.`, true);
    for (const p of Object.values(G.players)) delete p.minT; }
  for (const p of Object.values(G.players)) p.s = { app: 0, g: 0, a: 0, min: 0 };
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
  syncReg(c);
  if (G.phase === "summer") summerWeek();
  else if (G.phase === "season") seasonWeek();
  else if (G.phase === "playoffs") playoffWeek();
  buzzWeek(c); buildWeek(c); aiBuildWeek(); pitchWeek(c, c._home); c._home = false; fansWeek(c); weeklyAccounts(c);
  for (const o of c.offers) o.exp--;
  c.offers = c.offers.filter(o => o.exp > 0);
  if (G.phase !== "playoffs" || G.week === 0) refreshOffers(c);
  if (G.saleOffers) { for (const o of G.saleOffers) o.exp--; G.saleOffers = G.saleOffers.filter(o => o.exp > 0); if (!G.saleOffers.length) G.saleOffers = null; }
  mediaWeek(); trustWeek(c); poachWeek(); staffTrustWeek(); recoverWeek(); forcedWeek(); if (!windowOpen() && loansOpen()) loanOffersWeek(c); requestsCheck(); bidForMyClub();
  youthTieAsk(c); euroYouthAsk(c); coverAsk(c); turn18Ask(); achWeek(c); ventWeek(c); settleInbox();
  if (c.cash < -Math.max(250000, TV[c.tier]) && !G.warnedDebt) { G.warnedDebt = true; news(`The club is ${money(-c.cash)} overdrawn and paying 10% interest. Put money in from Finances or cut costs.`, true); }
  if (c.cash >= 0) G.warnedDebt = false;
}
/* Before a domestic cup tie against a club from a lower division, the manager asks whether to rotate in the youngsters
   (your five highest-potential players 21 or under who aren't regulars, academy lads included). Not asked when your
   standing instruction already covers the game. */
function youthTieAsk(c) {
  for (const { k, K, t } of (typeof myCupTie === "function" ? myCupTie() : [])) {
    const D = CUP_DEF[k], wk = D.weeks[K.round], opp = CL(t.h === c.id ? t.a : t.h), gap = opp.tier - c.tier, key = `${k}.${K.round}.${G.year}`;
    if (wk !== G.week || gap < 1 || (G.ytAsked || []).includes(key)) continue;
    const lesser = k !== "NC" || !/quarter|semi|final/i.test(K.name || ""); if (G.youthCups && lesser) continue;
    (G.ytAsked ||= []).push(key); if (G.ytAsked.length > 20) G.ytAsked.shift();
    const m = mgr(), them = teamAvg20(opp), us = teamAvg20(c);
    addChoice("ytie", `${D.name} ${(K.name || "").toLowerCase()}: ${opp.name}, ${gap} division${gap > 1 ? "s" : ""} below us`, `${t.h === c.id ? "At home" : "Away"} this week. ${opp.name} are in the ${TIER_NAME[opp.tier]}: their side is rated about ${them}, ours ${us}. ${m.name ? m.name : "The manager"} asks: should we rotate in the youngsters? He'd start our five highest-potential players 21 or under who aren't regulars, academy lads included.`,
      ["Yes, give the youngsters a game", "No, play our strongest side"], { opp: opp.id, w: wk, comp: k }, 1);
  }
}
DECIDE.ytie = (m, i) => { G.ytie = i === 0 ? { opp: m.data.opp, w: m.data.w, y: G.year } : null; news(i === 0 ? `The youngsters get their chance against ${CL(m.data.opp).name}.` : `The strongest side for the tie against ${CL(m.data.opp).name}.`); };
function summerWeek() {
  if (G.week === 0) summerRelay();
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
  if (w === JAN[0]) { partnerWindow(); aiListings(); levelSample(); }
  if (w === JAN[0] || w === JAN[2]) foreignLoans();
  chargesWeek();
  // In the Regional League's relegation places: a warning (dropping out of the pyramid ends the game).
  if (G.phase === "season" && my().tier === 7 && [30, 38, 43].includes(G.week)) { const L = LEAGUES[my().lg], ids = table(my().lg).map(r => r.id), pos = ids.indexOf(G.club) + 1;
    if (L.down && pos > ids.length - L.down - 1) news(`Danger: ${ord(pos)} in the ${L.name}. Finish in the bottom ${L.down} and the club drops out of the league system altogether: that's the end of your time as owner.`, true); }
  if (JAN.includes(w)) marketWeek(); else { offWindowBids(); headOffWindow(my()); faPickup(.6); faDrain(); }  // free agents sign any time
  awayHelpWeek();
  youthScoutWeek();
  if (w % 3 === 2) devTick(1 / 16);
  G.week++;
  if (G.week === JAN[0]) completeAgreed();  // the January window opens: sales agreed since the summer go through
  if (G.week >= SEASON_WEEKS) startPlayoffs();
}
function afterMatch(r, k) {
  const c = my(); if (r.h !== c.id && r.a !== c.id) return;
  const home = r.h === c.id, gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg, opp = CL(home ? r.a : r.h);
  let crowd = null; if (home) { crowd = homeGameMoney(c, opp, true); c._home = true; } else { awayTrip(c, opp); awayRefundCheck(c, opp, gf, ga); }
  const res = gf > ga ? "W" : gf < ga ? "L" : "D", m = mgr().at.mot, derby = [1, 1.5, 2][derbyLevel(c, opp)];
  c.morale = clamp(c.morale + (res === "W" ? 4 : res === "L" ? -5 + m / 25 : 0) + (55 + vpt("results") - c.morale) * .1, 20, 95);
  moodHit(c, (res === "W" ? 1.6 : res === "L" ? -1.6 : 0) * derby);
  h2hAdd(opp.id, res); G.myRes.push({ w: G.week, comp: k, derby: derby > 1, home, opp: opp.id, gf, ga, res, crowd, ev: r.ev, fit: r.fit[home ? 0 : 1], plan: r.plan && r.plan[home ? 0 : 1], edge: r.edge == null ? null : r.edge * (home ? 1 : -1) });
  // The grudge match is played: the press come back for your reaction (unless it was a draw).
  const fd = (c.feud || {})[opp.id];
  if (fd && fd.g) { fd.g = false; const own = opp.own ? opp.own.name : "their owner", score = `${gf}–${ga}`;
    if (res === "W") addChoice("pressGrudge", `Press: You beat ${opp.name} ${score}. Anything to say to ${own}?`, "The grudge match is done, and the reporters want a reaction.", ["Let the football do the talking", "Who's the vanity project now?"], { club: opp.id, res }, 0);
    else if (res === "L") addChoice("pressGrudge", `Press: ${opp.name} beat you ${ga}–${gf}. Anything to say to ${own}?`, "They got one over on you, and the reporters want a reaction.", ["Fair play to them", "One game changes nothing"], { club: opp.id, res }, 0);
    else news(`The grudge match with ${opp.name} ends ${score}: honours even.`); }
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

/* ---------- accomplishments ----------
   Each player's honours (p.acc: [season, kind, text]): the Golden Boot (most league goals in his division), most league
   assists, the Golden Glove (most league clean sheets, goalkeepers), and the team's titles, promotions and cups for
   those who played their part (10+ games that season for the league, 5+ for a cup). */
function accAdd(p, kind, text) { if (p) (p.acc ||= []).push([G.year, kind, text]); }
const accSquad = (c, min) => c.squad.map(P).filter(p => p && !p.acad && !(p.loan && p.loan.from === c.id) && seasonAt(p, c.id)[0] >= min);
function seasonAwards(k) {
  const L = LEAGUES[k], ps = G.leagues[k].clubs.flatMap(id => CL(id).squad.map(P)).filter(p => p && p.ls && p.ls.y === G.year), lbl = seasonLabel(G.year);
  const best = (f, ok = () => true) => { const q = ps.filter(ok), top = Math.max(0, ...q.map(f)); return top > 0 ? q.filter(p => f(p) === top) : []; };
  for (const p of best(p => p.ls.g)) accAdd(p, "boot", `Golden Boot, ${L.name} ${lbl} (${p.ls.g} goals)`);
  for (const p of best(p => p.ls.a)) accAdd(p, "assist", `Most assists, ${L.name} ${lbl} (${p.ls.a})`);
  for (const p of best(p => p.ls.cs, p => p.pos === "GK")) accAdd(p, "glove", `Golden Glove, ${L.name} ${lbl} (${p.ls.cs} clean sheets)`);
}

/* ---------- the end of the season ---------- */
function endSeason() {
  // Each player's shown rating as the season ends: the squad page's arrows show movement since then.
  for (const p of Object.values(G.players)) p.r0 = r20(p.ovr);
  qualify();  // Champions Cup and Continental Shield places for next season, from this table and the National Cup
  const moves = [], mine = my(), report = { y: G.year };
  for (const k of LG_KEYS) {
    const L = LEAGUES[k], t = table(k), ids = t.map(r => r.id);
    const champ = CL(ids[0]); champ.trophies.push([G.year, L.name]); seasonAwards(k);
    for (const p of accSquad(champ, 10)) accAdd(p, "title", `${L.name} champions ${seasonLabel(G.year)}`);
    if (L.tier === 1) titleRivals(ids);
    ids.forEach((id, i) => { const x = CL(id); if (!isMine(x)) x.push = i < Math.max(2, Math.round(ids.length * .25)); x.lastF = { y: G.year, tier: L.tier, pos: i + 1, n: ids.length }; });
    if (champ.id === G.club) news(`CHAMPIONS! ${mine.name} win the ${L.name}.`, true);
    if (ABOVE[k]) {
      const up = ids.slice(0, L.auto); if (G.po[k] && G.po[k].win != null) up.push(G.po[k].win);
      // Promoted clubs go up whatever their ground holds. Only one too small for the league's ground rules adds (temporary)
      // seating to reach the minimum; otherwise they grow it later, if ever.
      const final = up;
      for (const id of up) { const c = CL(id), min = Math.round(STADIUM_T[LEAGUES[ABOVE[k]].tier] * .3 / 100) * 100; if (!isMine(c) && c.cap < min) c.cap = Math.min(Math.max(aiSite(c), min), min); }
      for (const id of final) { addHoney(CL(id), "promo"); moves.push([id, ABOVE[k]]); for (const p of accSquad(CL(id), 10)) accAdd(p, "promo", `Promoted from the ${L.name} ${seasonLabel(G.year)}${ids[0] === id ? "" : G.po[k] && G.po[k].win === id ? " (play-offs)" : ""}`); }
    }
    if (L.down && L.tier < 7) for (const id of ids.slice(-L.down)) moves.push([id, null]);
    // The bottom of the Regional League drops out of the pyramid. If that's your club, it's the end: game over.
    if (L.tier === 7) { if (ids.slice(-L.down).includes(G.club) && !G.noGameOver) G.ended = { y: G.year, kind: "out", pos: ids.indexOf(G.club) + 1, lg: k, n: ids.length };
      const drop = ids.filter(id => id !== G.club).slice(-L.down); for (const id of drop) moves.push([id, "OUT"]); }
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
  if (G.wary) G.wary = G.wary < .03 ? 0 : Math.round(G.wary * .6 * 100) / 100;  // brands' wariness after broken deals fades
  if (G.goodwill) G.goodwill = Math.round(G.goodwill * .7 * 100) / 100;  // and goodwill from honoured deals fades
  dealsSeasonEnd(mine);
  { const f0 = mine.fin, inc = ledgerIncome(f0), net = inc - (ledgerCosts(f0) - f0.build - f0.acad), r = spendRule(mine, net, inc);
    mine.ded = r.pen; if (r.pen) charge(mine, r.pen, "breaking the spending rule"); scrJudgeMine(mine, f0); if (scrLive()) ssrTest(mine); if (r.pen) news(`The league docks you ${r.pen} points for next season: over three seasons you lost ${Math.round(r.ratio * 100)}% of your income, past the 35% the spending rule allows.`, true); }
  // History
  const f = mine.fin;
  if (G.history[0] && G.history[0].y === G.year && G.history[0].club === mine.name) G.history.shift();  // (a retried season's end: written once)
  G.history.unshift({ club: mine.name, obj: (G.objRes || []).map(o => (o.met ? "✓ " : "✗ ") + o.t), cups: [...Object.entries(G.cups || {}).map(([k, K]) => { if (K.win === G.club) return CUP_DEF[k].name + ": winners"; const last = K.log.filter(x => x.h === G.club || x.a === G.club).pop(); return last ? `${CUP_DEF[k].name}: ${last.r.toLowerCase()}` : null; }),
    ...Object.values(G.cont || {}).map(K => { if (!K.teams.includes(G.club)) return null; if (K.win === G.club) return CONT[K.key].name + ": winners"; const r = K.ko.filter(R => R.ties.some(t => t.h === G.club || t.a === G.club)).pop(); return `${CONT[K.key].name}: ${r ? r.n.toLowerCase() : "group stage"}`; })].filter(Boolean), y: G.year, lg: report.lg, tier: report.tier, pos, size, pts: report.pts, up: wentUp, down: wentDown, po: G.po[report.lg] && G.po[report.lg].semis.flat().includes(G.club),
    inc: ledgerIncome(f), cost: ledgerCosts(f), att: Math.round(avg(mine.att || [])), st: stHolders(mine), stp: mine.st && mine.st.y === G.year ? mine.st.price : null, fans: mine.fans, cash: mine.cash, mgr: mgr().name,
    top: Object.values(G.players).filter(p => p.club === G.club).sort((a, b) => b.s.g - a.s.g)[0]?.name || "" }); achSeason(G.history[0], mine);
  if (ownType().subs) { const subs = Math.round(mine.fans * .4 * ownType().subs / 100) * 100; if (subs > 0) { earn("equity", subs); news(`The trust's members renew their subscriptions: ${money(subs)} for the club.`); } }
  if (G.sTrust && G.sTrust.books) { trustRel(2); news(`The club publishes its accounts for ${seasonLabel(G.year - 1)}: income ${money(ledgerIncome(mine.finLast || mine.fin))}. The supporters' trust welcomes the openness.`); }
  for (const p of mine.squad.map(P)) if (p && p.blocked) p.blocked = Math.max(0, p.blocked - 1);  // a blocked move fades with time
  // Promises to players: a title challenge and Europe (top four), or promotion, judged now.
  for (const p of mine.squad.map(P)) if (p && p.ambPromise && p.ambPromise.y === G.year) { const h = G.history[0] || {}, kept = p.ambPromise.tier === 1 ? h.pos <= 4 : h.up;
    if (kept) { p.bond = (p.bond || 0) + 1; news(`${p.name}: you kept your promise, and he's glad he stayed.`); } else { p.unsettled = Math.max(p.unsettled || 0, 16); p.payGrudge = (p.payGrudge || 0) + 1; news(`${p.name} reminds you of your promise: the club didn't deliver, and he's unsettled.`, true); }
    delete p.ambPromise; }
  investorsSummer({ up: wentUp, down: wentDown }); fanCultureSummer(mine, wentUp, wentDown); wageClauses(mine, wentUp, wentDown);
  endLoans();
  G.meddle = (G.meddle || 0) * .6;
  mine.fac.stadium.held = 0; mine.fac.stadium.hd = {};
  if (mine.tier <= PSIZE_STD_TIER && (mine.fac.stadium.psize || "std") !== "std") { mine.fac.stadium.psize = "std"; news(`League rules: in the ${TIER_NAME[mine.tier]} the pitch must be the standard size, so it's marked out again at 105 × 68 m.`, true); }  // interference is slowly forgotten
  mine.finLast = mine.fin; mine.fin = newLedger(); mine.spentT = 0;
  summerRelay(mine);  // the pitch is re-laid the moment the season ends, so it's under way as pre-season starts
  completeAgreed(mine);  // the summer window opens: sales agreed during the season go through, before contracts run out
  addMsg({ type: "info", title: "Pre-season: arrange your friendlies", body: "Each of the eight pre-season weeks can have a friendly. Away games earn a fee from the host, home games a gate; with fewer than two, the side starts the season rusty for its first four league games, and three or more gives it a small edge.", go: "league", goL: "Arrange friendlies" });
  // Parachute payments move on a season; a club that has had them all stops getting them.
  for (const c of G.clubs) if (c.para && ++c.para.i >= c.para.n) delete c.para;
  try { if (scrLive()) plAccounts(); } catch (e) { console.error("accounts test", e); }  // the Premier Division's accounts test, on the season just played there
  // The season's shocks, in the top two divisions and yours.
  for (const k of LG_KEYS) { const L = LEAGUES[k]; if (L.tier > 2 && k !== mine.lg) continue; const ids = table(k).map(r => r.id), n = ids.length;
    ids.forEach((id, i) => { const c = CL(id), e = (G.expRank || {})[id]; if (!e) return; const pos = i + 1;
      if (pos === 1 && e >= 7) story(`Shock champions: ${c.name}, expected around ${ord(e)}, win the ${L.name}.`, "shock", 3);
      else if (e <= 4 && pos > n - (L.down || 3) - 2) story(`${c.name}, expected to finish around ${ord(e)}, ${pos > n - (L.down || 3) ? "are relegated" : "end up in a relegation fight"} (${ord(pos)}).`, "shock", 3);
      else if (e >= n - 5 && pos <= (L.tier === 1 ? 4 : 2)) story(`${c.name}, tipped to struggle, finish ${ord(pos)} in the ${L.name}.`, "shock", 2); }); }
  // Apply the moves
  for (const [id, to] of moves) {
    const c = CL(id), from = c.lg;
    if (!from || !LEAGUES[from] || (to !== "OUT" && !LEAGUES[to || leagueFor(LEAGUES[from].tier + 1, c.half)])) continue;  // (a club already moved, or with nowhere to go)
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
  for (const [id, to] of moves) { const c = CL(id); if (c.lastF && to !== "OUT") c.lastF[to ? "up" : "down"] = true; }
  try { relegationExodus(moves.filter(([, to]) => to === null).map(([id]) => id)); } catch (e) { console.error("relegation sales", e); }
  // Full-time or part-time: a club promoted out of National North/South goes full-time, one relegated into it part-time.
  for (const [id, to] of moves) { if (to === "OUT") continue; const c = CL(id); if (!c || c.gone) continue; const was = to ? c.tier + 1 : c.tier - 1;
    if ((was >= 6) !== (c.tier >= 6)) try { contractSwitch(c, c.tier < 6); } catch (e) { console.error("contract switch", e); } }
  balanceHalves("L6N", "L6S"); balanceHalves("L7N", "L7S");
  for (const k of ["L7N", "L7S"]) while (G.leagues[k].clubs.length < LEAGUES[k].size) { const c = newClub(k, LEAGUES[k].size - 1); c.half = LEAGUES[k].half; squadFromFA(c); G.leagues[k].clubs.push(c.id); c.founded = G.year; }
  // Standing: reputation drifts toward the club's division, plus a little for finishing high.
  for (const k of LG_KEYS) { const ids = G.leagues[k].clubs, n = ids.length; ids.forEach(id => { const c = CL(id); const prev = table2(k, id, n); c.rep = clamp(Math.round(c.rep + (TIER_REP[c.tier] + prev - c.rep) * .3), 1, 99); }); }
  (G.repLog ||= []).push([G.year, my().rep]);  // the prestige tracker's season-by-season line
  linkCheck();
  ownersSummer();
  diversitySummer();
  yearTurnover();
  acadDropouts(mine);
  feedersSummer();
  staffSummer();
  if (G.sTrust && G.sTrust.freeze === G.year) { G.sTrust.freeze = 0; delete G.sTrust.fp; }
  G.cupsLast = G.cups; G.contLast = G.cont; G.friendlies = []; G.fAsked = []; G.fOpts = null; mine.prep = 0;
  G.poLast = G.po; G.year++; G.phase = "summer"; G.week = 0; G.po = null;
  startSeason();
  completeIncoming();  // agreed deals and pre-contracts go through as the summer window opens, before pre-season week 1
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
  if (staffOf("manager")) trust("manager", clamp(Math.round(diff / 2), -6, 8) + (up ? 8 : 0), null, "How the season went");
}

/* How long your head of recruitment renews for: long deals for young players and the core of the side, shorter as
   they age (one year at a time from 32), a year longer for a player you've protected; never more than he'd sign. */
function autoYears(p, T, core) {
  const base = p.age <= 23 ? 4 : p.age <= 28 ? 3 : p.age <= 30 ? 2 : 1;
  return clamp(base + (core ? 1 : 0) + (p.keep ? 1 : 0) - (R() < .3 ? 1 : 0), 1, (T && T.maxY) || 3);
}
// AI clubs: the same rules, with "core" meaning he's among the club's best 18 seniors.
function aiYears(p, c) {
  const sen = c ? c.squad.map(P).filter(q => q && !q.acad && q.id !== p.id).map(q => q.ovr).sort((a, b) => b - a) : [];
  return autoYears(p, { maxY: p.age >= 32 ? 2 : p.age >= 30 ? 3 : 5 }, p.ovr >= (sen[17] ?? 0));
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
    // His answer weighs everything he cares about, his loyalty and the fans, as when you offer him a deal yourself.
    const want = p.keep || wantsRenewal(p, core.has(p.id)), T = want ? renewTerms(p) : null, un = T && T.no ? unhappiness(p, mine) : null;
    // She won't pay more than half as much again as his going rate to keep him: above that, he goes.
    const greedy = T && !T.no && T.min > Math.max(p.wage, demandWage(p, mine) * 1.5);
    const ask = want ? (T.no || greedy ? null : T.min) : undefined;
    if (ask === null) { logMove("expired", p, { wage: p.wage }); toFreeAgent(p); const why = greedy ? `wanted ${pw(T.min)}, more than he's worth to us` : `turned down a new deal${un ? `: ${un.why[0]}` : loyaltyOf(p) <= .25 ? ": a mercenary, off to the highest bidder" : ""}`; gone.push(`${p.name} (${why})`); continue; }
    if (ask !== undefined) { const was = p.wage; p.yrs = autoYears(p, T, core.has(p.id)); p.wage = Math.max(p.wage, Math.round(ask / 100) * 100); logPay(p, was, "contract renewal"); kept.push(`${p.name} (${p.yrs} yr, ${pw(p.wage)})`); }
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
    // (when his season is split by club, the loan club's own row carries the loan; this one is his own club's)
    const splitLoan = p.loanedAt && p.loanedAt.y === G.year && p.sc && p.sc.y === G.year && Object.keys(p.sc.by).some(cid => +cid !== p.club && CL(+cid) && CL(+cid).short === p.loanedAt.short);
    const club = p.loanedAt && p.loanedAt.y === G.year && !splitLoan ? `${p.loanedAt.short} (loan)` : p.club >= 0 ? CL(p.club).short : p.club === -2 ? "ABR" : "FA";
    const by = p.sc && p.sc.y === G.year ? Object.entries(p.sc.by).filter(([cid]) => +cid !== p.club) : [];  // moved mid-season: a row for each club
    const lo = p.loanedAt && p.loanedAt.y === G.year ? p.loanedAt.short : null;  // a loan club's row is marked as the loan
    for (const [cid, v] of by) { const sh = CL(+cid) ? CL(+cid).short : "—"; (p.prog ||= []).push([G.year, p.age, p.ovr, sh === lo ? `${sh} (loan)` : sh, v[0], v[1], v[2], p.pot, 0, null]); }
    const here = by.length && p.club >= 0 ? seasonAt(p, p.club) : [p.s.app, p.s.g, p.s.a];
    (p.prog ||= []).push([G.year, p.age, p.ovr, club, here[0], here[1], here[2], p.pot, 0, p.wage]);  // [8] spare, [9] his wage that season if (p.prog.length > 10) p.prog.shift();
    p.tot[0] += p.s.app; p.tot[1] += p.s.g; p.age++;
    if (p.acad && p.age === 18 && p.club === G.club) (G.turn18 ||= []).push(p.id);  // your academy players turning 18: you're asked (see turn18Ask)
    // AI wages drift toward what the club pays for the player's rating: about a third of the gap a year, down as he declines, up as he improves.
    if (p.club >= 0 && !isMine(CL(p.club)) && !p.acad && !p.loan && p.stunC !== p.club) { /* a statement signing keeps his huge wage while he stays */ const go = aiWage(p, CL(p.club)); p.wage = Math.round((p.wage + (go - p.wage) * .35) / 100) * 100; }
    if (p.club >= 0 && !isMine(CL(p.club)) && !p.acad) { const stays = p.age < 34 && renewsAI(p) && !(p.toMe && p.toMe.pre); p.yrs--; if (p.yrs <= 0) { if (stays) { p.yrs = aiYears(p, CL(p.club)); if (p.renewW) p.wage = p.renewW; delete p.renewW; } else { leaveClub(p); toFreeAgent(p); } } }
    // Veterans nobody signs hang up their boots sooner.
    const ch = p.age >= 39 ? 1 : p.club < 0 && p.age >= 33 ? Math.min(1, .4 + (p.age - 33) * .2) : p.age >= 33 ? (p.age - 32) * .14 * (p.ovr > 75 ? .7 : 1) : 0;
    if (R() < ch) { if (p.club === G.club) news(`${p.name} retires, aged ${p.age}.`); retire(p); }
    // Three summers without a club and he's out of the game for good (no newcomer replaces him: he was never missed).
    else if (p.club === -1 && p.age >= 24 && G.year - (p.faY ?? G.year) >= 3) retire(p, true);  // youngsters keep trying
  }
  // A generational talent this summer? Rare: about once every seven years (five to ten), at one academy somewhere: better academies and clubs with
  // a youth record are likelier, but anyone can be lucky.
  G.genClub = null;
  if (R() < .14) { const cs = G.clubs.filter(x => !x.gone && !x.abroad && (isMine(x) ? x.fac.acad.lvl : x.acadLvl) > 0);
    if (cs.length) G.genClub = wpick(cs, x => ((isMine(x) ? x.fac.acad.lvl : x.acadLvl) + 1) * (1 + Math.max(0, youthPedigree(x)) / 3)).id; }
  // Academy graduates: AI clubs keep the good ones; yours are decided by your youth manager (or you, on the Academy page).
  for (const c of G.clubs) {
    if (c.gone && !c.abroad) continue;  // clubs abroad have academies too
    for (const id of c.squad.slice()) { const p = P(id); if (!p.acad || p.age < 19) continue;
      if (isMine(c)) { if (p.keep || p.ovr >= TIER_LVL[c.tier] - 8 || potEstimate(p)[0] >= TIER_LVL[c.tier] + 4) { p.acad = false; p.yrs = 2; const was = p.wage; p.wage = Math.max(p.wage, demandWage(p, c)); logPay(p, was, "first professional contract"); news(`Academy graduate ${p.name} (${p.pos}, ${r20(p.ovr)}) signs a professional contract.`, true); } else { leaveClub(p); toFreeAgent(p); news(`${p.name} is released by the academy.`); } }
      else if (p.ovr >= c.lvl - 12 || p.pot >= c.lvl + 3) { p.acad = false; p.yrs = aiYears(p, c); p.wage = aiWage(p, c); } else { leaveClub(p); toFreeAgent(p); } }
    youthIntake(c);
  }
  // The free-agent pool is kept to a sensible size: the least employable drift out of the game. Only players 24 and
  // over below the National Division's standard are trimmed (the best 600 of them stay); anyone better stays on the
  // market through the summer (faDrain moves them on once the window shuts), and under-24s still have a chance to make it.
  { const weak = G.fa.map(P).filter(p => p && p.age >= 24 && naturalTier(p) >= 6).sort((a, b) => b.ovr - a.ovr); for (const p of weak.slice(600)) retire(p, true); }
  // Talent moves up: players far better than their club are bought by a club at their level.
  for (const p of Object.values(G.players)) {
    if (p.club < 0 || p.acad || p.age > 30 || p.loan) continue; const c = CL(p.club); if (isMine(c)) continue;
    // A great season gets him noticed sooner: clubs a division up come in for a player only a little better than his club.
    const sf = seasonForm(p), hot = sf >= .5 && p.ovr > c.lvl + 3 && c.tier > 1;
    if ((p.ovr > c.lvl + 7 || hot) && R() < (hot ? .4 + Math.min(.3, (sf - .5) * .4) : .5)) { const buyer = buyerFor(p, c.tier, 1, hot ? 3 : 0); if (buyer) { aiTransfer(p, buyer); p.wage = offerWage(p, buyer); p.yrs = aiYears(p, buyer); } }
  }
  // Good free agents don't stay unemployed: a club at their level takes them on.
  { const fresh = G.fa.map(P).filter(p => faFresh(p) && p.age < 32 && p.ovr >= TIER_LVL[Math.min(6, my().tier + 1)]).sort((a, b) => b.ovr - a.ovr);
    if (fresh.length) news(`Out of contract and looking for clubs: ${fresh.length} player${fresh.length > 1 ? "s" : ""} under 32 who could play at your level or near it${fresh.length ? `, among them ${fresh.slice(0, 4).map(p => `${p.name} (${p.pos}, ${p.age}, rated ${r20(p.ovr)})`).join(", ")}` : ""}. Clubs move in after three weeks: see Market → Free agents.`, true); }
  for (const p of G.fa.map(P).filter(p => p && !faFresh(p) && p.ovr >= 55 && p.age <= 33)) { const b = buyerFor(p, 8); if (b) { moveTo(p, b); p.wage = aiWage(p, b); p.yrs = aiYears(p, b); } }
  for (const c of G.clubs) if (!c.gone && !isMine(c)) aiSquadCheck(c, false);
  freshFreeAgents();
  foreignSummer(); aiListings();
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
/* The least a club will pay a fee for: a player near its division's standard (Premier Division: about a 10; one of the
   weakest sides there, about a 9). Below that it goes for a free agent or its academy instead. */
const feeFloor = c => c.abroad ? 0 : TIER_LVL[c.tier] - ((c.lvl || TIER_LVL[c.tier]) < TIER_LVL[c.tier] - 4 ? 8 : 6);
/* Where a player goes is his choice. Every club that wants him (he'd be one of its better players, he's at least its
   division's standard, it can pay the fee and his wage within the rules) offers him its own wage; he weighs the offers
   on his own priorities (aiAppeal): most pick a club at their level, where they'd play and the standing suits them; a
   money-motivated one may take the biggest wage, further down if need be (within the usual step-down rules). */
const offerWage = (p, x) => Math.min(wageCap(x), !x.abroad && hugeAsk(p, x) ? hugeWage(p, x) : aiWage(p, x));
function playerChooses(p, clubs, feeF = 1, reach = 0) {
  // A club whose top wage is well below what he's worth at his own level isn't in the running.
  clubs = clubs.filter(x => x.abroad || wageCap(x) >= wageAt(p.ovr, naturalTier(p)) * .6);
  // The clubs closest to his level, and any big-spending owner who wants him, make offers.
  const wants = clubs.filter(x => x !== (p.club >= 0 ? CL(p.club) : null) && p.ovr >= (x.lvl || 0) - 2 - reach && p.ovr >= feeFloor(x));  // a hot prospect: clubs a little above him want him too
  const near = wants.slice().sort((a, b) => Math.abs(a.lvl - p.ovr) - Math.abs(b.lvl - p.ovr)).slice(0, 10), rich = wants.filter(x => ownStyle(x).spend >= 3 && !near.includes(x)).slice(0, 4);
  const offers = [...near, ...rich].filter(x => canAfford(x, aiFee(p, x) * feeF) && fitsRules(x, offerWage(p, x), aiFee(p, x) * feeF, 3) && (x.abroad || x.tier > 4 || reckless(x) || ruleRoom(x)))
    .map(x => [x, aiAppeal(p, x, offerWage(p, x)) + normal() * .03]).filter(([, a]) => a > -1);
  return offers.length ? offers.sort((a, b) => b[1] - a[1])[0][0] : null;
}
function buyerFor(p, belowTier, feeF = 1, reach = 0) {
  // Clubs in the divisions above (rivals of his club rarely deal with it); he chooses among those that want him.
  const seller = p.club >= 0 ? CL(p.club) : null;
  return playerChooses(p, G.clubs.filter(c => !c.gone && !isMine(c) && c.tier < belowTier && !(seller && R() < [0, .7, .9][derbyLevel(seller, c)])), feeF, reach);
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
// [label, colour, what it means for the club's academy intakes]
const pedigreeWord = c => { const v = youthPedigree(c); return v >= 4 ? ["Renowned for developing youth", "good", "its intakes have much higher potential, and more gems"] : v >= 2 ? ["A good record with youth", "good", "its intakes have a little higher potential"] : v <= -1 ? ["A poor record with youth", "warn", "its intakes have a little lower potential than its academy level suggests"] : null; };
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
    // A generational talent (the rare summer one is drawn, see endSeason): a ceiling of 18.5+ and already among the best (14-17 at 16).
    const gen = i === 0 && G.genClub === c.id, potG = gen ? Math.round(from20(rf(18.6, 20))) : pot;
    const wonder = gen, ovr = wonder ? clamp(Math.round(from20(Math.max(14, to20(potG) - rf(2.5, 4)))), 12, potG) : clamp(Math.round(pot * rf(.48, .6) + normal() * 3), 12, pot);
    const nat = c.abroad ? (R() < .85 ? c.country : pickNat(c.country)) : s.wide && R() < .3 ? pickNat("ENG") : "ENG";
    const p = makePlayer({ pos: pick(["GK", "CB", "CB", "FB", "DM", "CM", "AM", "W", "ST", "ST"]), ovr, age, nat, club: c.id, pot: potG, acad: true, lean: LEAN[s.phil], wage: 500 }); p.yAcad = c.id;
    p.gt = wonder ? "wonder" : undefined; p.wk2 = true; if (!wonder) growthType(p);
    if (wonder) news(`${isMine(c) ? "Your" : `${c.name}'s`} academy has produced a generational talent: ${p.name} (${p.pos}, ${p.age}) is already one of the best in the world.`, isMine(c));
    p.yrs = 3; c.squad.push(p.id); p.hist.push([G.year, c.short]); got.push(p);
    if (potG >= 95) G.wonders.push({ id: p.id, name: p.name, pot: potG, club: c.id, y: G.year });
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
/* What an academy player is worth in compensation, buying or selling: the division's base, rising steeply with his
   potential (each point above 8 adds one and a half times the base), so a prospect with potential 16 costs about 13
   times one with potential 8. The same scale whether you sign one from another academy or lose one of yours. */
const youthFee = (pot, tier) => Math.round(YOUTH_COMP[tier] * (1 + Math.max(0, to20(pot) - 8) * 1.5) / 500) * 500;
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
    if (rated && asked.length < 3) { asked.push(p.id); addChoice("acadLeave", `${p.name} (${p.pos}, ${p.age}) wants to leave the academy`, `Rated ${r20(p.ovr)} now. He feels he's stopped improving (${gain > 0 ? `up only ${gain} in a year` : "no better than a year ago"}) and wants a fresh start elsewhere. ${y ? y.name + " still rates him" : "The coaches still rate him"}: potential ${est20([a, b])}. You can let him go, or try to talk him round.`, ["Let him go", "Talk him round"], { pid: p.id }, 0); }
    else acadLeave(p, c);
  }
}
function acadLeave(p, c) {
  const to = R() < .65 ? pick(G.clubs.filter(x => !x.gone && !x.abroad && !isMine(x) && Math.abs(x.tier - c.tier) <= 2)) : null;
  if (to) { leaveClub(p); moveTo(p, to); p.acad = true; const fee = Math.round(youthFee(p.pot, c.tier) * rf(.4, .7) / 500) * 500; if (fee) earn("sales", fee);  // he'd stopped improving: below his full worth logMove("out", p, { club: to.name, fee, wage: 0, by: "academy" });
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
    const fee = from === "trial" ? 0 : Math.round(youthFee(pot, c.tier) * rf(.85, 1.15) * (from === "abroad" ? 1.25 : 1) / 500) * 500;  // better prospects cost more
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
  meddled("youth", -d, kind === "release" ? `rated ${names} and didn't want ${one ? "him" : "them"} released.` : kind === "promote" ? `doesn't think ${names} ${one ? "is" : "are"} ready for the first team.` : kind === "keep" ? `would have let ${names} go.` : `wanted to sign ${names}.`, "Academy decisions overruled");
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
// Each summer the veterans nobody wants retire. (The pool fills from released players and academy leavers: no players
// are invented.)
function freshFreeAgents() {
  trimVeterans(); return;
  const young = G.fa.map(P).filter(p => p && p.age <= 29).length;
  for (let i = young; i < target; i++) {
    const age = ri(18, 29), ovr = clamp(Math.round(rf(24, 50) + (R() < .1 ? rf(5, 12) : 0)), 20, 66);
    toFreeAgent(makePlayer({ pos: pick(POS), ovr, age, nat: R() < .75 ? "ENG" : pickNat("ENG"), pot: seniorPot(ovr, age) }));
  }
}
/* Promotion and relegation clauses: every contract at your club pays 25% more after a promotion and 25% less after a
   relegation (loanees are paid by their own clubs; academy players are on youth terms). Money-motivated players don't
   take a cut quietly: the greedier they are, the likelier they hand in a transfer request, and the rest grumble. */
const CLAUSE = .25;
/* Full-time and part-time contracts (1.2.19). A club promoted into the National Division turns professional: every
   contract becomes full-time, and anyone paid below the division's standard for his rating is raised to it. A club
   relegated into National North/South goes part-time: contracts drop to part-time terms, cut to the standard there if
   paid above it (after any relegation clause). A money-minded player may not stand for the cut and asks to leave.
   Loanees count with the club that holds their contract. */
function contractSwitch(c, ft) {
  const ref = isMine(c) ? { tier: c.tier, id: -9 } : c, ps = c.squad.map(P).filter(p => p && !p.acad && !(p.loan && p.loan.to === c.id));
  for (const q of G.clubs.length ? Object.values(G.players) : []) if (q && q.loan && q.loan.from === c.id && q.club !== c.id && !ps.includes(q)) ps.push(q);
  const before = isMine(c) ? wageBill(c) : 0, quit = []; let n = 0;
  for (const p of ps) {
    const std = aiWage(p, ref), was = p.wage;
    if (ft ? p.wage < std : p.wage > std) { p.wage = std; n++; logPay(p, was, ft ? "full-time contract" : "part-time contract"); }
    if (!ft && was > std * 1.15 && !p.keep && !p.req) { const pr = prefsOf(p, P_FACTORS), cut = 1 - std / was;
      if (R() < clamp(cut * 1.2 + (pr.top.includes("money") ? .25 : 0) - (loyaltyOf(p) - .5) * .5, 0, .85)) { p.req = G.year; p.list = true; if (isMine(c)) { p.unsettled = Math.max(p.unsettled || 0, 6); quit.push(p.name); } } }
  }
  if (!isMine(c)) return;
  news(ft ? `Full-time football: every contract at ${c.name} becomes full-time.${n ? ` ${n} player${n === 1 ? " is" : "s are"} raised to the ${TIER_NAME[c.tier]} standard for their rating (the wage bill goes from ${money(before)} to ${money(wageBill(c))} a year).` : ""}`
    : `Part-time football: every contract at ${c.name} goes part-time.${n ? ` ${n} player${n === 1 ? " drops" : "s drop"} to the ${TIER_NAME[c.tier]} standard for their rating (the wage bill goes from ${money(before)} to ${money(wageBill(c))} a year).` : ""}${quit.length ? ` ${quit.join(", ")} won't accept part-time money and ${quit.length === 1 ? "asks" : "ask"} to leave.` : ""}`, true);
}
const contractType = p => { const c = p.loan ? CL(p.loan.from) : p.club >= 0 ? CL(p.club) : null; return !c || c.abroad ? "" : c.tier >= 6 ? "part-time" : "full-time"; };
function wageClauses(c, up, down) {
  if (!up && !down) return;
  const ps = c.squad.map(P).filter(p => p && !p.acad && !(p.loan && p.loan.to === c.id)), before = wageBill(c), quit = [];
  for (const p of ps) {
    { const was = p.wage; p.wage = Math.round(p.wage * (up ? 1 + CLAUSE : 1 - CLAUSE) / 100) * 100; logPay(p, was, up ? "promotion clause" : "relegation clause"); }
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
/* Relegation: players clearly too good for the division below push to leave. At your club the better ones hand in
   transfer requests (loyal players and fan favourites mostly stay; the ambitious ones most want out); at AI clubs up to
   three leave, each choosing among the clubs that want him (playerChooses): most a club at their level, a money-minded
   one perhaps the biggest wage, even a rich club in the new division.
   AI clubs' contracts also pay 25% less after relegation, as yours do. */
/* A forced loan: a relegated club that can't sell a player, or must cut its wage bill to get within its limits, loans
   him out for the season. It's forced on the club, but the player chooses where: every club that will have him (at or
   above his new division, at about his level, not a rival, able to fit its share of his wage) makes an offer, and he
   picks on his own priorities (playing time, standing and form, the system, home; his wage is unchanged). The borrower
   pays a third to a half of it; his club the rest. */
function forcedLoan(p, c) {
  const share = Math.round(rf(.35, .5) * 20) / 20;
  const offers = G.clubs.filter(x => !x.gone && !x.abroad && !isMine(x) && x !== c && x.tier <= c.tier && Math.abs((x.lvl || 0) - p.ovr) <= 6 && !derbyLevel(c, x) && fitsRules(x, p.wage * share, 0, 1))
    .map(x => [x, aiAppeal(p, x, p.wage) + normal() * .03]).filter(([, a]) => a > -1).sort((a, b) => b[1] - a[1]);
  if (!offers.length) return false; const d = offers[0][0];
  aiLoanMove(p, c, d, share);
  if (storyWorthy(c) || storyWorthy(d)) story(`Relegated ${c.name} must loan out ${p.name}: he chooses ${d.name}.`, "clause", 1);
  return true;
}
function relegationExodus(ids) {
  const sold = [];
  for (const id of ids) { const c = CL(id); if (!c || c.gone || c.abroad) continue;
    // Relegation clauses at AI clubs too: every contract pays 25% less in the division below (yours: wageClauses), and a
    // wage far above the new division's level (a Premier contract in the First Division) 40% less.
    // Anything still above the new division's top wage is cut to it; a player who won't accept that asks to leave.
    if (!isMine(c)) for (const q of c.squad.map(P)) if (q && !q.acad && !q.loan && q.wage) { q.wage = Math.round(q.wage * (q.wage > wageAt(q.ovr, c.tier) * 1.5 ? .6 : 1 - CLAUSE) / 100) * 100;
      if (q.wage > wageCap(c)) { q.wage = wageCap(c); if (prefsOf(q, P_FACTORS).top.includes("money") || R() < .4) { q.list = true; q.req = G.year; } } }
    const ps = c.squad.map(P).filter(p => p && !p.acad && !p.loan && p.age <= 33 && p.ovr >= TIER_LVL[c.tier] + 8).sort((a, b) => b.ovr - a.ovr);
    if (isMine(c)) { let n = 0;
      for (const p of ps) { if (n >= 3 || p.req || p.keep) continue;
        const L = loyaltyOf(p), love = Math.min(1, loveOf(p, c.id) / LEGEND), pr = prefsOf(p, P_FACTORS);
        const ch = clamp(.55 - L * .5 - love * .25 + (pr.top.includes("prest") ? .2 : 0) + Math.min(.2, (p.ovr - TIER_LVL[c.tier] - 8) * .02), .05, .85);
        if (R() > ch) continue; n++; p.req = G.year; p.unsettled = Math.max(p.unsettled || 0, 10);
        addChoice("treq", `${p.name} hands in a transfer request`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}. He doesn't want to play in the ${LEAGUES[c.lg].name}: he's unhappy about ambition after relegation.`,
          ["Accept: put him on the transfer list", `Offer a new deal (${pw(newDealWage(p))})`, "Refuse", "Ask what it would take to keep him"], { pid: p.id, why: ["ambition after relegation"] }, 0); } }
    else { let n = 0;
      // Relegated clubs are stripped of their best: a player of the division above's standard almost always goes, others often.
      for (const p of ps) { if (n >= 5 || p.keep || R() > (r20(p.ovr) >= 16 ? 1 : p.ovr >= TIER_LVL[c.tier - 1] - 3 ? .92 : .5)) continue;
        const b = playerChooses(p, G.clubs.filter(x => !x.gone && !x.abroad && !isMine(x) && x !== c && x.tier <= c.tier && x.tier >= c.tier - 2));
        if (!b) { if (p.ovr >= TIER_LVL[c.tier - 1] - 3 && R() < (r20(p.ovr) >= 16 ? 1 : .7)) forcedLoan(p, c); continue; }  // a world-class player always goes: sold or loaned
        aiTransfer(p, b); p.wage = offerWage(p, b); p.yrs = aiYears(p, b); n++; if (c.lg === my().lg || b.lg === my().lg || c.tier <= 2) sold.push(`${p.name} (${c.name} to ${b.name})`); } }
  }
  // Still over its limits (wage budget, squad cost rule): the club must loan out its highest earners, up to four.
  for (const id of ids) { const c = CL(id); if (!c || c.gone || c.abroad || isMine(c) || c.tier > 5) continue;  // Football League clubs (relegated as far as the National Division)
    for (let k = 0; k < 4; k++) { const over = aiBill(c) > aiBudget(c) * 1.05 || (c.tier <= 4 && squadRoom(c) < 0); if (!over) break;
      const p = c.squad.map(P).filter(q => q && !q.acad && !q.loan && !q.forcedTried).sort((a, b) => b.wage - a.wage)[0]; if (!p) break;
      p.forcedTried = true; forcedLoan(p, c); }
    for (const q of c.squad.map(P)) if (q) delete q.forcedTried; }
  if (sold.length) news(`Relegated clubs lose their best players: ${sold.slice(0, 5).join(", ")}${sold.length > 5 ? ` and ${sold.length - 5} more` : ""}.`);
}
// A club joining the pyramid from below signs its first squad from the free agents (no players are invented; only if
// the pool has run dry is anyone made up).
function squadFromFA(c) {
  for (const [pos, n] of Object.entries(SQUAD_MIX)) for (let i = 0; i < n; i++) {
    const q = G.fa.map(P).filter(x => x && x.pos === pos && x.age <= 33 && x.ovr <= TIER_LVL[c.tier] + 10).sort((a, b) => b.ovr - a.ovr)[0];
    if (q) { moveTo(q, c); q.wage = aiWage(q, c); q.yrs = ri(1, 2); } }
  if (c.squad.length < 16) genSquad(c);
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
// An AI club short of a player promotes its best academy prospect at that position, if he's anywhere near ready.
function promoteAcad(c, pos, target) {
  const a = c.squad.map(P).filter(q => q && q.acad && q.pos === pos && q.age >= 17 && (q.ovr >= target - 12 || q.pot >= target)).sort((x, y) => y.ovr + y.pot * .3 - x.ovr - x.pot * .3)[0];
  if (!a) return false; a.acad = false; a.yrs = aiYears(a, c); a.wage = aiWage(a, c); return true;
}
/* Short of budget for a player he wants: an owner who doesn't mind losing money may put in more (a billionaire
   benefactor or a gambler readily, a lifelong fan rarely, an asset stripper never). The extra comes out of his pocket at
   the year's end, like any loss. These are the clubs at every level that outspend everyone to try to go up quickly. */
function ownerTopUp(c, fee) {
  const short = fee - tbOf(c); if (short <= 0) return true;
  if (!c.own || c.abroad || c.emb || c.own.style === "fanowned") return false;
  const lw = ownStyle(c).loss || 0; if (lw <= 0) return false;
  // However rich he is, he puts in at most about his willingness to lose times half the club's income in a season.
  if (!c.topY || c.topY.y !== G.year) c.topY = { y: G.year, amt: 0 };
  if (c.topY.amt + short > aiIncome(c) * lw * (c.tier >= 5 ? .3 : .5) || short > c.own.wealth * .04 || R() > clamp(.05 + lw * .45, 0, .8)) return false;
  c.tb = tbOf(c) + short; c.topY.amt += short; c.topUp = (c.topUp || 0) + short; return true;
}
function aiSign(c, pos) {
  // c.lvl already carries the owner's spending; a big spender also aims a little higher and buys more readily.
  // At the salary cap (and not cooking the books) he can only add cheaper players.
  const sp = ownStyle(c).spend, target = Math.round(c.lvl + sp * .3 + normal() * 4.5 - (!c.cook && !c.abroad && aiBill(c) > salaryCap(c.tier) * .95 ? 5 : 0) - (c.emb ? 5 : 0));  // under an embargo: whoever will come for nothing
  let p = null;
  // Players choose too: one who rates the club below what he wants (playing time, the system, standing, how it's
  // doing, home, on his own priorities) may turn it down, so a struggling club finds the better players harder to get.
  const wont = q => { if (!c.abroad && wageCap(c) < wageAt(q.ovr, naturalTier(q)) * .6) return true;  // can't pay him near his worth
    const a = aiAppeal(q, c); return a <= -1 || a < 0 && R() < clamp(-a * 5, 0, .8); };
  // The rules (squad cost, UEFA, a non-league owner's limit): his wage plus a year's share of the fee must fit.
  const estW = q => offerWage(q, c), fits = (q, fee) => fitsRules(c, estW(q), fee, 3);
  const fas = G.fa.map(P).filter(q => !faFresh(q) && q.pos === pos && q.ovr >= target - 5 && q.ovr <= target + 4 && q.age <= 33 && !wont(q) && fits(q, 0));
  const tf = q => typeFit(c, q, baseStyle(c)) * 2;  // how he'd fit the side and the style
  // The best free agent and the best player he could buy: he takes the free agent unless the other is clearly better.
  let fa = fas.length ? fas.sort((a, b) => b.ovr + tf(b) - a.ovr - tf(a))[0] : null;
  if (R() < clamp(.55 + sp * .07, .2, .92)) {
    // The four professional divisions also shop abroad, from clubs no bigger than they are: imports cost a fee that leaves the country.
    // At home they buy from their own division, the one above (only a player who isn't first choice there) and the two below; a seller keeps
    // at least 20 players.
    // A big-spending owner (benefactor, gambler, celebrity) reaches two divisions up, first-choice players included.
    const big = sp >= 3, lower = G.clubs.filter(x => !isMine(x) && x !== c && (x.abroad ? c.tier <= 4 && x.rep <= c.rep + 3 : !x.gone && x.tier >= c.tier - (big ? 2 : 1) && x.tier <= c.tier + 2 && x.squad.length >= 20));
    const pool = []; for (const x of lower) for (const id of x.squad) { const q = P(id); if (q.pos === pos && (x.abroad || x.tier >= c.tier || big || !xiSet(x).has(q.id) && q.ovr <= (c.lvl || 0) + 2) && q.ovr >= feeFloor(c) && !q.acad && !q.loan && q.inW !== windowId() && !q.toMe && q.ovr >= target - 2 && q.ovr <= target + 5 && q.age <= 30) pool.push(q); }
    const willing = pool.filter(q => !wont(q) && fits(q, aiFee(q, c))), scored = willing.map(q => [q, q.ovr + tf(q) + normal() * 2]).sort((a, b) => b[1] - a[1]);
    const best = scored.find(([q]) => canAfford(c, aiFee(q, c)));
    // The one he really wants is beyond the budget: the owner may find the money.
    const dream = scored[0] && !canAfford(c, aiFee(scored[0][0], c)) && (!best || scored[0][1] > best[1] + 2) && ownerTopUp(c, aiFee(scored[0][0], c)) ? scored[0] : null;
    const pickd = dream || best;
    if (pickd && (!fa || pickd[1] > fa.ovr + tf(fa) + 1)) p = pickd[0];
  }
  if (!p && fa) p = fa;
  if (!p && promoteAcad(c, pos, target)) return;  // an academy player gets his chance
  if (!p && windowOpen() && R() < .6 && aiBorrow(c, pos, target)) return;  // or a loan from a bigger club
  // A cheaper free agent, a level or two below what he wanted.
  if (!p) { const cheap = G.fa.map(P).filter(q => q && !faFresh(q) && q.pos === pos && q.ovr >= target - 14 && q.ovr < target - 5 && q.age <= 33 && !wont(q) && fits(q, 0)); if (cheap.length) p = cheap.sort((a, b) => b.ovr + tf(b) - a.ovr - tf(a))[0]; }
  /* Nobody at all: the best free agent who'll come, at any level, or the gap stays open until the next window (the
     academy and loans having been tried). No players are invented: they come from the world as it began, from
     academies and from youth scouting. */
  if (!p) { const any = G.fa.map(P).filter(q => q && !faFresh(q) && q.pos === pos && q.age <= 34 && !wont(q) && fits(q, 0)); if (any.length) p = any.sort((a, b) => b.ovr + tf(b) - a.ovr - tf(a))[0]; }
  if (!p) return;
  else aiTransfer(p, c);
  p.wage = aiWage(p, c); p.yrs = aiYears(p, c);
  if (!c.abroad && hugeAsk(p, c)) p.wage = Math.min(wageCap(c), Math.max(p.wage, Math.round(hugeWage(p, c) / 100) * 100));  // stepping down past his room: paid like it (within the division's top wage)
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

/* ---------- academy players turning 18 ----------
   Each summer, for every academy player who has turned 18: offer him a professional contract or release him. Your youth
   manager says what he'd do; if you don't answer, that's what happens. */
// Your youth manager's view of an academy player, as of now.
function youthAdvice(p, c = my()) {
  const y = staffOf("youth"); if (!y) return "You have no youth manager to advise you.";
  const rates = youthRates(p, c), ready = youthReady(p);
  return `${y.name}: ${rates ? (ready ? "rates him and thinks he's ready for a professional contract." : "rates him, though he isn't ready for the first team yet: a contract keeps him.") : "wouldn't keep him."}`;
}
function turn18Ask() {
  const c = my(), y = staffOf("youth");
  for (const id of (G.turn18 || []).splice(0)) {
    const p = G.players[id]; if (!p || !p.acad || p.club !== c.id) continue;
    const rates = youthRates(p, c), ready = youthReady(p), wage = Math.round(demandWage(p, c) / 100) * 100;
    // The youth manager's view is read when the card is shown (youthAdvice), so a manager hired since still gets his say.
    addChoice("turn18", `${p.name} has turned 18: professional contract or release?`, `${POS_NAME[p.pos]}, rated ${r20(p.ovr)}, potential ${est20(potEstimate(p))}.`,
      [`Offer a professional contract (${pw(wage)}, 2 years)`, "Release him"], { pid: p.id, wage }, rates ? 0 : 1);
  }
}
DECIDE.turn18 = (m, i) => {
  const p = G.players[m.data.pid], c = my(); if (!p || !p.acad || p.club !== c.id) return;
  if (!m.auto) overruleYouth(i === 0 ? "promote" : "release", [p]);
  if (i === 0) { const was = p.wage; p.acad = false; p.yrs = 2; p.wage = Math.max(p.wage, m.data.wage); logPay(p, was, "first professional contract"); p.dealY = G.year; news(`${p.name} signs his first professional contract: ${pw(p.wage)} for 2 years.`, true); }
  else { leaveClub(p); toFreeAgent(p); news(`${p.name} is released from the academy.`); }
};

/* ---------- injury cover ----------
   When injuries leave the formation short of players for a position (fewer fit, registered first-teamers who play
   there than it needs), the manager asks: bring in an academy player who plays there, or move someone across? Your
   answer holds until enough of them are fit again (or the formation changes). */
const naturalFit = (c, pos) => c.squad.map(P).filter(p => p && avail(p) && !p.acad && p.pos === pos && isReg(p, c) && !(p.loan && p.loan.from === c.id));
function coverAsk(c) {
  if (G.phase === "summer" && G.week < SUMMER_WEEKS - 2) return;
  const slots = FORMS[clubForm(c)] || [], need = {}; for (const s of slots) need[s] = (need[s] || 0) + 1;
  const C = (G.cover ||= {});
  for (const pos of Object.keys(C)) if (!need[pos] || naturalFit(c, pos).length >= need[pos]) { if (C[pos].ans) news(`Enough ${POS_NAME[pos].toLowerCase()}s are fit again: the injury cover ends.`); delete C[pos]; }
  for (const [pos, n] of Object.entries(need)) {
    const have = naturalFit(c, pos).length; if (have >= n || C[pos]) continue;
    const acs = c.squad.map(P).filter(p => p && p.acad && p.age >= 16 && avail(p) && p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, n - have), ac = acs[0];
    const xi = pickXI(c, false, { coverOff: true }), oop = xi.find(o => o.slot === pos && o.p.pos !== pos);
    C[pos] = { ans: null };
    if (!ac) continue;  // no academy player for the position: he moves someone across, as he would anyway
    const sw = oop ? `${oop.p.name} (normally a ${POS_NAME[oop.p.pos].toLowerCase()}), rated ${r20(roleRating(oop.p, pos))} there` : "the best of the rest";
    addChoice("cover", `Injuries: ${have ? `only ${have}` : "no"} fit ${POS_NAME[pos].toLowerCase()}${have === 1 ? "" : "s"} for ${n} place${n > 1 ? "s" : ""}`,
      `${mgr().name || "The manager"} asks how to cover it until they're back: bring in academy ${POS_NAME[pos].toLowerCase()}${acs.length > 1 ? "s" : ""} ${acs.map(a => `${a.name} (${a.age}, rated ${r20(a.ovr)}, potential ${est20(potEstimate(a))})`).join(" and ")}, or play ${sw}?`,
      [`Play academy ${acs.length > 1 ? "players" : "player"} ${acs.map(a => a.name).join(" and ")}`, `Play ${oop ? oop.p.name : "someone"} out of position`], { pos, pid: ac.id, pids: acs.map(a => a.id) }, 1);
  }
}
DECIDE.cover = (m, i) => { const C = (G.cover ||= {}), k = m.data.pos; if (!C[k]) return; C[k].ans = i === 0 ? "acad" : "oop"; C[k].pid = m.data.pid; C[k].pids = m.data.pids || [m.data.pid];
  news(i === 0 ? `${G.players[m.data.pid] ? G.players[m.data.pid].name : "An academy player"} comes in at ${POS_NAME[k].toLowerCase()} until the injuries clear.` : `Out of position at ${POS_NAME[k].toLowerCase()} until the injuries clear.`); };

/* ---------- European ties against much weaker sides: rotate in the youngsters? ----------
   Before a European game (group or knockout leg, not the final) against a side rated 3+ points below yours, the
   manager asks, as he does before a cup tie against a lower-division club. */
function euroYouthAsk(c) {
  const us = teamAvg20(c);
  for (const K of Object.values(G.cont || {})) {
    if (!K.teams || !K.teams.includes(c.id) || K.win != null) continue;
    const D = CONT[K.key]; let opp = null, stage = "";
    if (K.md < 6 && CONT_GROUP_WEEKS[K.md] === G.week) { const g = K.groups.findIndex(x => x.includes(c.id)), i = K.groups[g].indexOf(c.id), pr = GROUP_MD[K.md].find(p => p.includes(i)); if (pr) { opp = CL(K.groups[g][pr[0] === i ? pr[1] : pr[0]]); stage = `group game ${K.md + 1}`; } }
    const RD = K.round >= 0 ? K.ko[K.round] : null, t = RD && RD.ties.find(t => (t.h === c.id || t.a === c.id) && t.w == null);
    if (!opp && t && RD.n !== "Final" && CONT_KO[K.round].w.includes(G.week)) { opp = CL(t.h === c.id ? t.a : t.h); stage = `${RD.n.toLowerCase()}, ${CONT_KO[K.round].w.indexOf(G.week) === 0 ? "first" : "second"} leg`; }
    if (!opp) continue;
    const them = teamAvg20(opp), key = `E.${K.key}.${G.year}.${G.week}`;
    if (them > us - 3 || (G.ytAsked || []).includes(key)) continue;
    (G.ytAsked ||= []).push(key); if (G.ytAsked.length > 20) G.ytAsked.shift();
    const m = mgr();
    addChoice("ytie", `${D.name} ${stage}: ${opp.name}, a side rated ${us - them} below ours`, `This week${opp.abroad ? `, ${opp.name} of ${countryOf(opp)}` : ""}: their side is rated about ${them}, ours ${us}. ${m.name ? m.name : "The manager"} asks: should we rotate in the youngsters? He'd start our five highest-potential players 21 or under who aren't regulars, academy lads included.`,
      ["Yes, give the youngsters a game", "No, play our strongest side"], { opp: opp.id, w: G.week, comp: K.key }, 1);
  }
}

/* ---------- achievements ----------
   A card in your inbox (and a news item) the first time the club does something worth remembering: trophies and
   promotions, records, runs and big wins, players' milestones, and the club's own growth. Each is marked once; records
   (biggest win, longest run, record crowd, record fee, best finish) come again whenever they're beaten. The first time
   this runs on a save, what's already been done is noted quietly, so you aren't flooded. */
let ACH_QUIET = false;
/* Who an achievement is about, from its key: a player (by id, or a hat-trick scorer by name), the team and manager
   (trophies, promotions, results, runs), or the head of youth (academy debuts). You can congratulate them on the card. */
function achWho(key) {
  const k = key.split("."), c = my(), byName = n => (c.squad.map(P).find(p => p && p.name === n) || {}).id;
  if (k[0] === "hat") return { pid: byName(k.slice(3).join(".")) };
  if (/^(apps\d+|gls\d+|legend|acc)$/.test(k[0])) return { pid: +k[1] };
  if (k[0] === "debut") return { pid: +k[1], role: "youth" };
  if (k[0] === "acad3") return { role: "youth", team: true };
  if (/^(firstTrophy|firstTitle|firstEuro|tro|double|gk|fierce|euroAway|ddouble|euroKO|euroQual|up|b2b|best|unbeaten|pts100|pts|margin|wrun|urun|csrun)$/.test(k[0])) return { team: true, role: "manager" };
  return null;
}
function ach(key, title, body) {
  const A = (G.achs ||= {}); if (A[key]) return false; A[key] = G.year;
  if (!ACH_QUIET) { addMsg({ type: "ach", title: `🏅 ${title}`, body, who: achWho(key) }); news(`🏅 ${title}`, true); }
  return true;
}
const REC = () => (G.achRec ||= {});
function record(k, v, title, body, min = -Infinity) { const R = REC(); if (v <= (R[k] ?? -Infinity)) return; const had = R[k] != null; R[k] = v; if (had && v >= min && !ACH_QUIET) { addMsg({ type: "ach", title: `🏅 ${title}`, body, who: achWho(k) }); news(`🏅 ${title}`, true); } }
const nth = n => n.toLocaleString("en-GB");
function achWeek(c) {
  if (!G.achInit) { G.achInit = true; ACH_QUIET = true; G.achTro = (c.trophies || []).length; achChecks(c); ACH_QUIET = false; return; }
  achChecks(c);
}
function achChecks(c) {
  const R = REC(), ps = c.squad.map(P).filter(Boolean);
  // Trophies, as they're won
  const T = c.trophies || [], LN = new Set(Object.values(LEAGUES).map(L => L.name)), EU = new Set(Object.values(CONT).map(D => D.name));
  for (let i = G.achTro ?? T.length; i < T.length; i++) {
    const [y, name] = T[i], before = T.slice(0, i), lg = LN.has(name), eu = EU.has(name);
    if (!before.length) ach("firstTrophy", `The first trophy in the club's history: the ${name}`, `${seasonLabel(y)}. Whatever comes next, this was the first.`);
    else if (lg && !before.some(t => LN.has(t[1]))) ach("firstTitle", `Champions for the first time: the ${name}`, `${seasonLabel(y)}: the club's first league title.`);
    else if (eu && !before.some(t => EU.has(t[1]))) ach("firstEuro", `European trophy winners: the ${name}`, `${seasonLabel(y)}: the club's first European trophy.`);
    else ach(`tro.${y}.${name}`, `${name} winners`, `${seasonLabel(y)}: trophy number ${i + 1} for the club.`);
    const same = T.slice(0, i + 1).filter(t => t[0] === y);
    if (same.length >= 2 && same.some(t => LN.has(t[1]))) ach(`double.${y}`, `The double: ${same.map(t => t[1]).join(" and ")}`, `${seasonLabel(y)}: ${same.length} trophies in a season.`);
  }
  G.achTro = T.length;
  // Results (competitive games)
  const res = (G.myRes || []).filter(r => r.comp && r.comp !== "F"), start = G.achRes && G.achRes.y === G.year ? G.achRes.n : 0;
  for (const r of res.slice(start)) {
    const opp = CL(r.opp), m = r.gf - r.ga;
    if (m >= 4) record("margin", m, `Biggest win in the club's history: ${r.gf}–${r.ga} against ${opp.name}`, `${r.label || "League"}, ${seasonLabel(G.year)}.`);
    if (r.res === "W" && CUP_DEF[r.comp] && opp.tier < c.tier) ach(`gk.${G.year}.${r.opp}`, `Giant-killing: ${opp.name} knocked out`, `${CUP_DEF[r.comp].name}: ${r.gf}–${r.ga} against a side ${c.tier - opp.tier} division${c.tier - opp.tier > 1 ? "s" : ""} above us.`);
    if (r.res === "W" && derbyLevel(c, opp) === 2) ach(`fierce.${r.opp}`, `A first win over fierce rivals ${opp.name}`, `${r.gf}–${r.ga}${r.home ? " at home" : " away"}.`);
    if (r.res === "W" && CONT[r.comp] && !r.home && !r.neutral) ach("euroAway", `A first away win in Europe: ${r.gf}–${r.ga} at ${opp.name}`, `${CONT[r.comp].name}, ${seasonLabel(G.year)}.`);
    const mine = (r.ev || []).filter(e => (e.side === 0) === !!r.home || (r.neutral && false)), count = {}; for (const e of mine) count[e.g] = (count[e.g] || 0) + 1;
    for (const [n, k] of Object.entries(count)) if (k >= 3) ach(`hat.${G.year}.${r.w}.${n}`, `Hat-trick: ${n}${k > 3 ? ` (${k} goals)` : ""}`, `Against ${opp.name}, ${r.gf}–${r.ga}.`);
  }
  if (res.length > start) {
    // Runs, over the club's competitive games (kept across seasons)
    // A run makes a card once, the game it passes the old record (and the record keeps growing quietly after that).
    const S = (G.achRun ||= { w: 0, u: 0, cs: 0 }), RUNS = [["w", "wrun", r => r.res === "W", 5, n => [`Club-record winning run: ${n} in a row, and counting`, `Every competition counted.`]],
      ["u", "urun", r => r.res !== "L", 10, n => [`Club-record unbeaten run: ${n} games, and counting`, `Every competition counted.`]], ["cs", "csrun", r => r.ga === 0, 4, n => [`Club-record clean sheets: ${n} in a row, and counting`, `Nothing conceded in ${n} games.`]]];
    for (const r of res.slice(start)) for (const [k, rk, ok, min, txt] of RUNS) {
      if (!ok(r)) { S[k] = 0; continue; } if (S[k] === 0) S["b" + k] = R[rk] ?? 0; S[k]++;
      if (S[k] === S["b" + k] + 1 && S[k] >= min && R[rk] != null) { const [t, b] = txt(S[k]); addMsg({ type: "ach", title: `🏅 ${t}`, body: b, who: achWho(rk) }); news(`🏅 ${t}`, true); }
      R[rk] = Math.max(R[rk] ?? 0, S[k]); }
    // Doing the double over a derby rival (both league games won this season)
    for (const id of new Set(res.filter(r => LEAGUES[r.comp]).map(r => r.opp))) { const two = res.filter(r => LEAGUES[r.comp] && r.opp === id); if (two.length >= 2 && two.every(r => r.res === "W") && isDerby(c, CL(id))) ach(`ddouble.${G.year}.${id}`, `The double over ${CL(id).name}`, `Both league derbies won in ${seasonLabel(G.year)}.`); }
  }
  G.achRes = { y: G.year, n: res.length };
  // Europe
  for (const K of Object.values(G.cont || {})) if ((K.ko || []).some(RD => RD.ties.some(t => t.w === c.id))) ach("euroKO", `Through a European knockout tie for the first time`, `${CONT[K.key].name}, ${seasonLabel(G.year)}.`);
  if (G.qual && [...(G.qual.CC || []), ...(G.qual.CS || [])].includes(c.id)) ach("euroQual", `Qualified for Europe for the first time`, `The ${(G.qual.CC || []).includes(c.id) ? "Champions Cup" : "Continental Shield"} awaits next season.`);
  // Players
  for (const p of ps) {
    const h = (p.cs || {})[c.id] || [0, 0, 0];
    for (const n of [100, 250, 500]) if (h[0] >= n) ach(`apps${n}.${p.id}`, `${p.name}: ${n} games for the club`, `${POS_NAME[p.pos]}, ${p.age}. ${h[1]} goals along the way.`);
    for (const n of [50, 100, 200]) if (h[1] >= n) ach(`gls${n}.${p.id}`, `${p.name}: ${n} goals for the club`, `In ${h[0]} games.`);
    if (p.yAcad === c.id && !p.acad && h[0] >= 1) ach(`debut.${p.id}`, `Academy graduate ${p.name} makes his debut`, `${POS_NAME[p.pos]}, ${p.age}: one of our own.`);
    if (favLevel(p, c.id) === 2) ach(`legend.${p.id}`, `${p.name} is a club legend`, `The supporters will be singing his name for years.`);
    for (const a of (p.acc || []).filter(a => a[0] === G.year && ["boot", "glove", "assist"].includes(a[1]))) ach(`acc.${p.id}.${a[0]}.${a[1]}`, `${p.name}: ${a[2]}`, `An individual honour for one of ours.`);
  }
  if (pickXI(c).filter(o => o.p.yAcad === c.id).length >= 3) ach("acad3", `Three of our own in the starting side`, `${pickXI(c).filter(o => o.p.yAcad === c.id).map(o => o.p.name).join(", ")}: academy graduates in the first team.`);
  for (const h of (G.hof || []).filter(h => h.mine)) ach(`hof.${h.name}`, `${h.name} enters the hall of fame`, `Peak rating ${r20(h.peak)}, ${h.apps} games and ${h.goals} goals in his career.`);
  // Fees, crowds and the club
  const tl = (G.tlog || []).filter(m => m.fee > 0);
  const paid = Math.max(0, ...tl.filter(m => m.kind === "in").map(m => m.fee)), got = Math.max(0, ...tl.filter(m => m.kind === "out").map(m => m.fee));
  if (paid) record("feeIn", paid, `Club-record signing: ${money(paid)}`, `${(tl.find(m => m.kind === "in" && m.fee === paid) || {}).name || ""}.`); if (got) record("feeOut", got, `Club-record sale: ${money(got)}`, `${(tl.find(m => m.kind === "out" && m.fee === got) || {}).name || ""}.`);
  const crowd = Math.max(0, ...(c.att || [])); if (crowd) record("crowd", crowd, `Record crowd: ${nth(crowd)}`, `The biggest home crowd in the club's history.`);
  const stBest = Math.max(stHolders(c) || 0, ...(G.history || []).map(h => h.st || 0));
  for (const n of [10000, 25000, 50000]) if (stBest >= n && (ACH_QUIET || (stHolders(c) || 0) >= n)) ach(`st${n}`, `${nth(n)} season-ticket holders`, `${nth(stHolders(c))} have committed for the season.`);
  for (const n of [10000, 25000, 50000, 100000]) if (c.fans >= n) ach(`fans${n}`, `${nth(n)} supporters`, `The club's following has passed ${nth(n)}.`);
  if (G.leagues[c.lg].clubs.every(id => id === c.id || CL(id).fans < c.fans)) ach(`mostFans.${c.tier}`, `The biggest support in the ${LEAGUES[c.lg].name}`, `${nth(c.fans)} supporters: more than any other club in the division.`);
  for (const n of [10e6, 50e6, 100e6, 250e6, 500e6]) if (c.cash >= n) ach(`cash${n}`, `${money(n)} in the bank`, `Club cash has passed ${money(n)}.`);
  for (const n of [20000, 40000, 60000]) if (capacity(c) >= n) ach(`cap${n}`, `A ${nth(n)}-capacity ground`, `${nth(capacity(c))} can now watch us at home.`);
  for (const [k, l] of [["train", "training ground"], ["acad", "academy"]]) for (const n of [5, 10]) if (c.fac[k].lvl >= n) ach(`${k}${n}`, `The ${l} reaches level ${n}`, n === 10 ? `As good as it gets.` : `Halfway to the best there is.`);
  for (const n of [10, 25, 50]) if ((G.history || []).length >= n) ach(`yrs${n}`, `${n} seasons under your ownership`, `Since ${seasonLabel(G.year - n)}.`);
}
// At the end of a season: promotions, finishes, points, an unbeaten league season, a sold-out season, a first profit.
function achSeason(h, c) {
  if (!G.achInit) return; const prev = (G.history || []).slice(1), lr = (G.myRes || []).filter(r => r.comp === h.lg);
  if (h.up) { ach(`up.${h.y}`, `Promoted from the ${LEAGUES[h.lg].name}`, `${seasonLabel(h.y)}: ${ordinal(h.pos)} with ${h.pts} points.`); if (prev[0] && prev[0].up) ach(`b2b.${h.y}`, `Back-to-back promotions`, `Two seasons, two promotions.`); }
  const rank = x => (x.tier - 1) * 40 + x.pos; if (prev.length && prev.every(x => rank(h) < rank(x))) ach(`best.${h.y}`, `The club's highest-ever finish: ${ordinal(h.pos)} in the ${LEAGUES[h.lg].name}`, `${h.pts} points in ${seasonLabel(h.y)}.`);
  if (lr.length >= 20 && lr.every(r => r.res !== "L")) ach(`unbeaten.${h.y}`, `Unbeaten in the league all season`, `${lr.length} games, not one lost.`);
  if (h.pts >= 100) ach(`pts100.${h.y}`, `A 100-point season`, `${h.pts} points.`); else if (prev.length && prev.every(x => h.pts > x.pts)) ach(`pts.${h.y}`, `Club-record points: ${h.pts}`, `More than in any season before.`);
  const homes = c.att || []; if (homes.length >= 10 && homes.every(a => a >= capacity(c) * .995)) ach(`sellout.${h.y}`, `Sold out all season`, `Every home game full.`);
  if (h.inc > h.cost && !prev.some(x => x.inc > x.cost)) ach("firstProfit", `The club's first profitable season`, `${money(h.inc - h.cost)} in profit.`);
}
