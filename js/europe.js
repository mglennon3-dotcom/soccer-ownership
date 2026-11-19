/* Continental football. Clubs from seven other countries, and two competitions of 32:
   - Champions Cup: the top four in the Premier Division, plus 28 foreign clubs.
   - Continental Shield: 5th and 6th in the Premier Division and the National Cup winners (whatever their division),
     plus 29 foreign clubs. If the cup winners are already in the Champions Cup, 7th goes instead.
   Eight groups of four, home and away; the top two go into two-legged knockout rounds (penalties if level on aggregate)
   and a final at a neutral ground. Prize money for taking part, every win and draw, and each round reached.

   Foreign clubs sit outside the English pyramid and don't play domestic leagues: they're marked `abroad` and `gone`,
   which keeps them out of every domestic loop (tables, transfers, takeovers, the clubs you can buy). Their strength
   and standing drift a little each summer, and their squads are kept up to strength. */
"use strict";

/* The other leagues, in the order of the continental ranking (England first; then Italy, Spain, Germany, France,
   Portugal, Belgium, the Netherlands, Turkey, Greece, Czechia, Poland, Norway, Denmark, Cyprus, Switzerland, Austria,
   Hungary, Croatia, Sweden, Scotland, Romania, Ukraine). [clubs, starting standard of the best club, Champions Cup places,
   Shield places]: the standards are re-set against England each summer (FOREIGN_RANK). The smaller leagues carry only
   the clubs that matter in Europe and in the market. Places follow the ranking: 1st-5th four in the Champions Cup and
   two in the Shield, 6th three and two, 7th-12th two and two, 13th-15th two and one, the rest one and one. That is more
   clubs than either competition holds, so the lower-ranked entrants play off in a summer qualifying round. */
const FOREIGN = {
  ITA: [12, 86, 4, 2], ESP: [12, 87, 4, 2], GER: [12, 86, 4, 2], FRA: [10, 84, 4, 2], POR: [9, 83, 3, 2], BEL: [8, 81, 2, 2], NED: [8, 82, 2, 2],
  TUR: [6, 80, 2, 2], GRE: [5, 78, 2, 2], CZE: [5, 77, 2, 2], POL: [5, 77, 2, 2], SCA: [5, 76, 2, 1], DEN: [5, 76, 2, 1], CYP: [4, 75, 2, 1],
  SUI: [5, 75, 1, 1], AUT: [5, 75, 1, 1], HUN: [4, 74, 1, 1], CRO: [4, 74, 1, 1], SWE: [5, 74, 1, 1], SCO: [5, 74, 1, 1], ROU: [4, 73, 1, 1], UKR: [4, 73, 1, 1],
};
/* Where each league sits against the Premier Division: [the English rank its best club matches, ranks per club below it].
   Italy, Spain and Germany are on a par (their best is as good as England's best, spread across the whole division);
   France a step down (its best about the 4th-6th best in England); Portugal, Belgium and the Netherlands match the
   bottom half of the Premier Division; then the rest by the ranking. Ranks past 20 run on below the Premier Division's
   weakest side (about the First Division's best). */
const FOREIGN_RANK = { ITA: [0, 1.7], ESP: [0, 1.7], GER: [.5, 1.7], FRA: [4, 1.7], POR: [9.5, 1.6], BEL: [10.5, 1.6], NED: [11, 1.6],
  TUR: [13, 2], GRE: [15, 3], CZE: [16, 3], POL: [17, 3], SCA: [18, 3.5], DEN: [18.5, 3.5], CYP: [20, 5],
  // The bottom eight: a club or two near the top of the First Division, the weakest down at Third Division level.
  SUI: [24, 12], AUT: [25, 12], HUN: [28, 14], CRO: [26, 14], SWE: [27, 12], SCO: [22, 15], ROU: [30, 14], UKR: [30, 14] };
const CONT = {
  CC: { name: "Champions Cup", short: "Champions Cup", join: 15e6, win: 2.8e6, draw: .9e6, rounds: [9.6e6, 10.6e6, 12.5e6, 15.5e6], champ: 4.5e6 },
  CS: { name: "Continental Shield", short: "Shield", join: 3.6e6, win: .6e6, draw: .2e6, rounds: [1.2e6, 1.8e6, 2.8e6, 4.6e6], champ: 4e6 },
};
const CONT_GROUP_WEEKS = [4, 8, 12, 16, 20, 24];
const CONT_KO = [{ n: "Round of 16", w: [27, 30] }, { n: "Quarter-finals", w: [32, 34] }, { n: "Semi-finals", w: [37, 39] }, { n: "Final", w: [43] }];

/* ---------- the foreign clubs ---------- */
function foreignTown(K) {
  for (let g = 0; g < 300; g++) { let t = pick(K.pre) + pick(K.suf); t = t[0].toUpperCase() + t.slice(1); if (!TOWN_BLOCK.has(t) && !G.towns[t]) { G.towns[t] = 1; return t; } }
  return pick(K.pre) + pick(K.suf);
}
// Ground and support for a club abroad by its standard: big clubs as before, smaller ones scaled down (never below a few thousand).
const foreignCap = lvl => Math.round(Math.max(15000 + (lvl - 70) * 2800, 15000 * Math.pow(1.07, lvl - 70), 3000) * rf(.8, 1.2) / 500) * 500;
const foreignFans = lvl => Math.round(Math.max(12000 + (lvl - 70) * 2600, 12000 * Math.pow(1.08, lvl - 70), 2000) * rf(.8, 1.2));
function makeForeign() {
  G.foreign = [];
  for (const code of Object.keys(FOREIGN)) makeForeignLeague(code);
  foreignLevels(true); for (const id of G.foreign) foreignSquad(CL(id));
}
function makeForeignLeague(code) {
  const K = COUNTRY[code], [n, top] = FOREIGN[code], made = [];
  for (let i = 0; i < n; i++) {
    const t = foreignTown(K), lvl = top - i * 2.2 + normal() * .8, rep = clamp(Math.round(55 + (lvl - 70) * 2.2), 30, 98);
    const c = { id: G.clubs.length, name: pick(K.fmt).replace("{t}", t), town: t, short: stripAcc(t).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(), country: code,
      abroad: true, gone: true, lg: null, tier: 1, half: null, region: pick(K.regions)[0], rep, lvl, color: CLUB_COLORS[G.clubs.length % CLUB_COLORS.length],
      coach: aiCoach(rep), squad: [], train: clamp(Math.round(lvl / 10), 4, 10), acadLvl: clamp(Math.round(lvl / 11), 3, 10),
      cap: foreignCap(lvl), fans: foreignFans(lvl), founded: G.year - ri(60, 130), trophies: [] };
    c.base = lvl; c.own = newOwner(c);
    G.clubs.push(c); G.foreign.push(c.id); made.push(c);
  }
  return made;
}
// 0.72: a world from before gains the newer leagues, set against England as it is now and given squads.
function addForeignLeagues() {
  const have = new Set((G.foreign || []).map(id => CL(id).country)), made = [];
  for (const code of Object.keys(FOREIGN)) if (!have.has(code)) made.push(...makeForeignLeague(code));
  if (!made.length) return;
  foreignLevels(); for (const c of made) { c.lvl = c.base + normal() * .6; c.rep = clamp(Math.round(55 + (c.lvl - 70) * 2.2), 30, 98); c.cap = foreignCap(c.lvl); c.fans = foreignFans(c.lvl); foreignSquad(c); }
}
/* Each foreign club's standard, from English football as it is now: every club in the top four divisions by its
   average starters, best first (the Premier Division's 20, then the First, Second and Third Divisions' 24 each), read
   off at the league's ranks; rank 20 is the First Division's best, about 68 the Third Division's. A foreign club's starters come out a
   little above its standard; the measured gap (G.fOff) is taken off so the starters themselves match. */
function foreignLevels(snap) {
  const E = [];
  for (let t = 1; t <= 4; t++) { const e = G.clubs.filter(c => !c.gone && !c.abroad && c.tier === t && c.squad.length >= 11).map(c => avg(pickXI(c).map(o => o.p.ovr))).sort((a, b) => b - a);
    E.push(...(e.length >= 10 ? e : Array.from({ length: t === 1 ? 20 : 24 }, (_, k) => TIER_XI[t] + 4 - k * 8 / 24))); }
  const at = r => { const n = E.length - 1; if (r <= n) { const a = Math.floor(r), b = Math.min(n, a + 1); return E[a] + (E[b] - E[a]) * (r - a); } return E[n] - (r - n) * .5; };
  const fc = (G.foreign || []).map(CL).filter(c => c && c.squad.length >= 11);
  if (fc.length && !snap) G.fOff = (G.fOff ?? 1.5) * .5 + avg(fc.map(c => avg(pickXI(c).map(o => o.p.ovr)) - c.lvl)) * .5;
  for (const [code, [top, step]] of Object.entries(FOREIGN_RANK)) {
    const cs = (G.foreign || []).map(CL).filter(c => c && c.country === code).sort((a, b) => (b.base ?? b.lvl) - (a.base ?? a.lvl));
    cs.forEach((c, i) => { c.base = clamp(at(top + i * step) - (G.fOff ?? 1.5), 50, 95); if (snap) { c.lvl = c.base + normal() * .6; c.rep = clamp(Math.round(55 + (c.lvl - 70) * 2.2), 30, 98); c.cap = foreignCap(c.lvl); c.fans = foreignFans(c.lvl); c.coach = aiCoach(c.rep); } });
  }
}
/* Money abroad: a summer transfer budget by size, plus half of last season's sales (the same rule as at home). */
const foreignBudget = c => Math.round(40e6 * Math.pow(1.12, c.lvl - 82) / 1e5) * 1e5;
/* Filling a gap: a free agent who fits the club's standard first (countrymen preferred), otherwise a new player. */
function foreignSignFA(c, pos) {
  const fits = G.fa.map(P).filter(p => p && p.pos === pos && p.age <= 32 && p.ovr >= c.lvl - 7 && p.ovr <= c.lvl + 4);
  if (!fits.length) return false;
  const p = fits.sort((a, b) => (b.ovr + (b.nat === c.country ? 3 : 0)) - (a.ovr + (a.nat === c.country ? 3 : 0)))[0];
  moveTo(p, c); p.wage = aiWage(p, c); p.yrs = ri(1, 3);
  if (G.club != null && (p.hist || []).some(h => h[1] === my().short)) news(`Former ${my().name} player ${p.name} signs for ${c.name} in ${COUNTRY[c.country].name} on a free.`);
  return true;
}
function foreignSquad(c, faOnly) {
  const have = pos => c.squad.map(P).filter(p => p.pos === pos && !p.acad).length;
  for (const [pos, n] of Object.entries(SQUAD_MIX)) for (let i = have(pos); i < n; i++) {
    if (foreignSignFA(c, pos)) continue;
    if (faOnly) break;
    if (R() < .5 && foreignSign(c, pos)) continue;
    const age = ri(19, 33), ovr = clamp(Math.round(c.lvl + 2 - i * 3 + spreadN()), 40, 94);
    const p = makePlayer({ pos, ovr, age, nat: R() < .7 ? c.country : pickNat(c.country), club: c.id, pot: seniorPot(ovr, age) });
    p.yrs = ri(1, 4); c.squad.push(p.id); p.hist.push([G.year, c.short]);
  }
  const sq = c.squad.map(P).filter(p => !p.acad).sort((a, b) => b.ovr - a.ovr);
  for (const p of sq.slice(27)) toFreeAgent(p);  // surplus players look for clubs (some end up in England)
}
// Each summer: standing and strength drift, squads are topped up.
function foreignSummer() {
  for (const id of G.foreign || []) {
    const c = CL(id); c.base ??= c.lvl; c.lvl = clamp(c.lvl + (c.base - c.lvl) * .35 + normal() * 1.2, 50, 95); c.rep = clamp(Math.round(55 + (c.lvl - 70) * 2.2), 30, 98);
    c.tb = foreignBudget(c) + Math.max(0, c.fsold || 0) * .5; c.fsold = 0;
  }
  foreignLevels();
  for (const id of G.foreign || []) { foreignUpgrade(CL(id)); foreignSquad(CL(id)); }
  foreignBuys();
}
/* Foreign clubs shop the way English ones do: a regular well below their standard is replaced, from a club no bigger
   than they are (abroad or in England's top four divisions) when they can afford the fee. */
function foreignUpgrade(c) {
  for (const pos of POS) {
    const ps = c.squad.map(P).filter(p => p && !p.acad && !p.loan && p.pos === pos).sort((a, b) => b.ovr - a.ovr), need = Math.ceil(SQUAD_MIX[pos] / 2), weak = ps[need - 1];
    if (weak && weak.ovr < c.lvl - 5 && R() < .6) foreignSign(c, pos);
  }
}
function foreignSign(c, pos) {
  const target = Math.round(c.lvl + normal() * 4);
  const sellers = G.clubs.filter(x => x !== c && !isMine(x) && (x.abroad ? x.rep <= c.rep + 3 : !x.gone && x.tier <= 4 && (x.rep || 0) <= c.rep + 3));
  const pool = []; for (const x of sellers) for (const id of x.squad) { const q = P(id); if (q && q.pos === pos && !q.acad && !q.loan && q.inW !== windowId() && !q.toMe && q.ovr >= target - 2 && q.ovr <= target + 5 && q.age <= 30 && canAfford(c, aiFee(q))) pool.push(q); }
  if (!pool.length) return false;
  const p = pick(pool), from = CL(p.club); aiTransfer(p, c); p.wage = aiWage(p, c); p.yrs = ri(2, 4);
  if (!from.abroad) { aiSquadCheck(from, true); G.exports = (G.exports || 0) + 1; if (from.lg === (my() || {}).lg || p.ovr >= 85) news(`${p.name} leaves ${from.name} for ${c.name} in ${COUNTRY[c.country].name}.`); }
  else foreignSquad(from);
  return true;
}
/* Stars abroad: each summer the big foreign clubs buy players from the top two English divisions who are clearly better
   than their division's standard, likelier the bigger the gap. Without it the best talent would pile up in England. */
function foreignBuys() {
  const buyers = (G.foreign || []).map(CL).filter(c => c && c.abroad); if (!buyers.length) return;
  for (const c of G.clubs) { if (c.gone || c.abroad || isMine(c) || c.tier > 2) continue;
    const std = TIER_XI[c.tier];  // measured against the division's real level (its average starter), so the biggest clubs lose stars too
    for (const p of c.squad.map(P)) { if (!p || p.acad || p.loan || p.toMe || p.age > 31) continue; const gap = p.ovr - std - 4;
      if (gap <= 0 || R() > Math.min(.06, .01 + gap * .005)) continue;
      const fee = Math.round(aiFee(p) * .7 / 1e4) * 1e4, to = buyers.filter(x => Math.abs(x.lvl - p.ovr) < 6 && x.rep >= (c.rep || 0) - 3 && canAfford(x, fee)); if (!to.length) continue; const b = pick(to);
      aiTransfer(p, b, fee); p.wage = aiWage(p, b); p.yrs = ri(2, 4); aiSquadCheck(c, true); G.exports = (G.exports || 0) + 1;
      if (c.lg === (my() || {}).lg || p.ovr >= 85) news(`${p.name} leaves ${c.name} for ${b.name} in ${COUNTRY[b.country].name}.`); } } }
// During a window foreign clubs plug gaps from the free agents only (new players are made only in the summer).
function foreignJanuary() { for (const id of G.foreign || []) foreignSquad(CL(id), true); }
/* Foreign clubs' own league seasons, in the background: 38 games on the same weeks as a 20-club division. They aren't
   simulated as matches, but the side the manager picks gets the appearances, goals and assists, so players there
   (yours on loan included) play and develop. */
function foreignDomestic(w) {
  if (REST20.has(w)) return;
  for (const id of G.foreign || []) {
    const c = CL(id), xi = pickXI(c); c.gp = (c.gp || 0) + 1;
    for (const { p } of xi) { addStat(p, 0); tire(p, 1); injuryCheck(p, null); }
    for (let i = poisson(1.45); i > 0; i--) { const g = scorer(xi, "g"); if (!g) break; addStat(g, 1); if (R() < .7) { const a = scorer(xi.filter(o => o.p !== g), "a"); if (a) addStat(a, 2); } }
  }
}
const countryOf = c => c.abroad ? COUNTRY[c.country].name : "England";
const divisionOf = c => c.abroad ? `${COUNTRY[c.country].name}` : LEAGUES[c.lg].name;

/* ---------- qualification ---------- */
// From the Premier Division table and the National Cup, for next season.
function qualify() {
  const t = table("L1").map(r => r.id), nc = G.cups && G.cups.NC && G.cups.NC.win;
  const cc = t.slice(0, 4), cs = t.slice(4, 6);
  if (nc != null && !cc.includes(nc) && !cs.includes(nc)) cs.push(nc); else cs.push(t[6]);
  G.qual = { CC: cc, CS: cs, y: G.year + 1 };
  for (const id of [...cc, ...cs]) if (id === G.club) news(`${my().name} have qualified for next season's ${cc.includes(id) ? "Champions Cup" : "Continental Shield"}!`, true);
}
function foreignEntrants() {
  const byC = {}; for (const id of G.foreign) { const c = CL(id); (byC[c.country] ||= []).push(c); }
  const out = { CC: [], CS: [] };
  for (const [code, [, , ncc, ncs]] of Object.entries(FOREIGN)) { const L = (byC[code] || []).sort((a, b) => b.lvl - a.lvl); out.CC.push(...L.slice(0, ncc).map(c => c.id)); out.CS.push(...L.slice(ncc, ncc + ncs).map(c => c.id)); }
  // Entrants come in ranking order (country by country, best first), so the play-offs fall to the lower-ranked ones.
  const slots = { CC: 32 - ((G.qual || {}).CC || []).length, CS: 32 - ((G.qual || {}).CS || []).length };
  G.cqual = [];
  for (const k of ["CC", "CS"]) out[k] = contQualify(k, out[k], slots[k]);
  if (G.cqual.length) news(`European qualifying: ${G.cqual.length} play-offs decided. ${G.cqual.filter(q => q.up).slice(0, 3).map(q => `${CL(q.w).name} (${countryOf(CL(q.w))}) knock out ${CL(q.l).name}`).join("; ") || "The favourites came through"}.`);
  return out;
}
/* Qualifying: the five leagues ranked just below England (Italy, Spain, Germany, France, Portugal) go straight in;
   everyone else plays off over two legs, settled on strength with a good dose of chance, the weakest paired best
   against worst, round after round until the competition is down to 32. */
const CONT_DIRECT = new Set(["ITA", "ESP", "GER", "FRA", "POR"]);
function contQualify(k, ids, slots) {
  const direct = ids.filter(id => CONT_DIRECT.has(CL(id).country)); let pool = ids.filter(id => !CONT_DIRECT.has(CL(id).country));
  while (direct.length + pool.length > slots && pool.length >= 2) {
    const ties = Math.min(direct.length + pool.length - slots, Math.floor(pool.length / 2));
    pool.sort((a, b) => CL(b).lvl - CL(a).lvl);
    const safe = pool.slice(0, pool.length - ties * 2), q = pool.slice(pool.length - ties * 2), won = [];
    for (let i = 0; i < ties; i++) {
      const a = CL(q[i]), b = CL(q[q.length - 1 - i]), pa = 1 / (1 + Math.exp(-(a.lvl - b.lvl) / 4)), aWins = R() < pa, w = aWins ? a : b, l = aWins ? b : a;
      won.push(w.id); G.cqual.push({ k, w: w.id, l: l.id, up: !aWins });
    }
    pool = [...safe, ...won];
  }
  return [...direct, ...pool].slice(0, slots);
}

/* ---------- the competitions ---------- */
function startContinental() {
  G.cont = {};
  if (!G.foreign) return;
  if (!G.qual || G.qual.y !== G.year) {  // a new world: the Premier Division's biggest clubs
    const t = G.leagues.L1.clubs.slice().sort((a, b) => CL(b).rep - CL(a).rep);
    G.qual = { CC: t.slice(0, 4), CS: t.slice(4, 7), y: G.year };
  }
  const fe = foreignEntrants();
  for (const k of ["CC", "CS"]) {
    const teams = [...G.qual[k], ...fe[k]].slice(0, 32), byStrength = teams.slice().sort((a, b) => CL(b).lvl - CL(a).lvl), groups = Array.from({ length: 8 }, () => []);
    for (let pot = 0; pot < 4; pot++) shuffle(byStrength.slice(pot * 8, pot * 8 + 8)).forEach((id, g) => groups[g].push(id));
    G.cont[k] = { key: k, teams, groups, gres: [], md: 0, ko: [], round: -1, win: null };
    if (teams.includes(G.club)) { earn("prize", CONT[k].join); const g = groups.findIndex(x => x.includes(G.club)); news(`${CONT[k].name} draw: ${my().name} are in Group ${"ABCDEFGH"[g]} with ${groups[g].filter(x => x !== G.club).map(id => CL(id).name).join(", ")}. ${money(CONT[k].join)} for taking part.`, true); }
    for (const id of teams) if (!CL(id).abroad) CL(id).rep = Math.min(99, CL(id).rep + 1);
  }
}
const GROUP_MD = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]], [[1, 0], [3, 2]], [[2, 0], [3, 1]], [[3, 0], [2, 1]]];
function groupTable(K, g) {
  const rows = Object.fromEntries(K.groups[g].map(id => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }]));
  for (const r of K.gres) if (r.g === g) { const L = { tab: rows }; tally(L, r); }
  return Object.values(rows).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}
function contWeek(w) {
  for (const K of Object.values(G.cont || {})) {
    const D = CONT[K.key];
    const md = CONT_GROUP_WEEKS.indexOf(w);
    if (md >= 0) {
      K.groups.forEach((grp, g) => { for (const [i, j] of GROUP_MD[md]) {
        const h = grp[i], a = grp[j], r = contMatch(h, a, false, K.key, `Group ${"ABCDEFGH"[g]}`);
        K.gres.push({ g, h, a, hg: r.hg, ag: r.ag });
        for (const [id, gf, ga] of [[h, r.hg, r.ag], [a, r.ag, r.hg]]) if (id === G.club) earn("prize", gf > ga ? D.win : gf === ga ? D.draw : 0);
      } });
      K.md = md + 1;
      if (K.md === 6) contDrawKO(K, 0);
    }
    const RD = K.ko[K.round]; if (!RD) continue;
    const leg = CONT_KO[K.round].w.indexOf(w); if (leg < 0) continue;
    if (CONT_KO[K.round].n === "Final") {
      const t = RD.ties[0], { w: win, r } = playKO(t.h, t.a, true, K.key, `${D.short} final`); t.g1 = [r.hg, r.ag]; t.w = win; t.pens = r.pens;
      K.win = win; const c = CL(win); c.trophies.push([G.year, D.name]); c.rep = Math.min(99, c.rep + 4);
      if (isMine(c)) { earn("prize", D.champ); moodHit(c, 25); bumpMedia(25); news(`EUROPEAN CHAMPIONS! ${c.name} win the ${D.name}!`, true); }
      else news(`${c.name} (${countryOf(c)}) win the ${D.name}.`, t.h === G.club || t.a === G.club);
      continue;
    }
    for (const t of RD.ties) {
      if (leg === 0) { const r = contMatch(t.h, t.a, false, K.key, `${D.short} ${RD.n.toLowerCase()}, first leg`); t.g1 = [r.hg, r.ag]; continue; }
      const r = contMatch(t.a, t.h, false, K.key, `${D.short} ${RD.n.toLowerCase()}, second leg`); t.g2 = [r.ag, r.hg];  // stored from the first leg's home side's view
      const hs = t.g1[0] + t.g2[0], as = t.g1[1] + t.g2[1];
      t.w = hs > as ? t.h : as > hs ? t.a : (t.pens = true, R() < .5 ? t.h : t.a);
      const out = t.w === t.h ? t.a : t.h;
      if (t.w === G.club) { earn("prize", D.rounds[Math.min(K.round + 1, D.rounds.length - 1)]); moodHit(my(), 4); news(`${my().name} are through to the ${D.name} ${CONT_KO[K.round + 1].n.toLowerCase()} (${hs}–${as} on aggregate${t.pens ? ", on penalties" : ""}).`, true); }
      if (out === G.club) news(`${my().name} are out of the ${D.name} (${hs}–${as} on aggregate${t.pens ? ", on penalties" : ""}).`, true);
    }
    if (leg === 1) contDrawKO(K, K.round + 1);
  }
}
// The knockout draw: group winners against runners-up from other groups, winners at home in the second leg.
function contDrawKO(K, round) {
  let ids;
  if (round === 0) {
    const tabs = K.groups.map((_, g) => groupTable(K, g)), win = tabs.map(t => t[0].id), run = shuffle(tabs.map(t => t[1].id));
    for (let i = 0; i < 8; i++) if (run[i] === tabs[i][1].id) { const j = (i + 1) % 8; [run[i], run[j]] = [run[j], run[i]]; }
    K.ko[0] = { n: CONT_KO[0].n, ties: win.map((w, i) => ({ h: run[i], a: w })) };
    for (const id of [...win, ...run]) if (id === G.club) { earn("prize", CONT[K.key].rounds[0]); news(`${my().name} are through to the ${CONT[K.key].name} knockout rounds!`, true); }
    for (const t of K.groups.flat()) if (t === G.club && !win.includes(t) && !run.includes(t)) news(`${my().name} go out of the ${CONT[K.key].name} in the group stage.`, true);
  } else {
    ids = shuffle(K.ko[round - 1].ties.map(t => t.w));
    K.ko[round] = { n: CONT_KO[round].n, ties: [] };
    for (let i = 0; i + 1 < ids.length; i += 2) K.ko[round].ties.push({ h: ids[i], a: ids[i + 1] });
  }
  K.round = round;
  const mine = K.ko[round].ties.find(t => t.h === G.club || t.a === G.club);
  if (mine && round > 0) news(`${CONT[K.key].name} ${K.ko[round].n.toLowerCase()} draw: ${CL(mine.h).name} v ${CL(mine.a).name}.`, true);
}
/* A continental match that isn't decided on its own (group games and single legs). Logs yours, with the gate. */
function contMatch(h, a, neutral, comp, label) {
  const r = playMatch(h, a, neutral);
  if (h === G.club || a === G.club) {
    const c = my(), home = h === G.club, gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg, opp = CL(home ? a : h);
    let crowd = null; if (home) { crowd = Math.min(capacity(c), Math.round(crowdFor(c, opp) * 1.2)); earn("gate", crowd * c.prices.ticket * 1.3); const con = concessionsFor(c, crowd); earn("conc", con.net); spend("rent", ground(c).rent); spend("mdops", opsCost(c, crowd)); c._home = true; } else awayTrip(c, opp);
    c.morale = clamp(c.morale + (gf > ga ? 3 : gf < ga ? -2 : 0), 20, 95);
    G.myRes.push({ w: G.week, comp, label, home, opp: opp.id, gf, ga, res: gf > ga ? "W" : gf < ga ? "L" : "D", crowd, ev: r.ev, fit: r.fit[home ? 0 : 1] });
  }
  return r;
}

/* ---------- loans with foreign clubs ----------
   Each window, a foreign club or two may offer you a young player who isn't in its first team but would help you (you pay
   half his wages), and may ask to borrow one of your young players who isn't getting games (they pay all of his wages,
   and he plays regular football). Loans run to the end of the season. */
function foreignLoans() {
  const c = my(); if (!G.foreign || !c) return;
  const myXI = pickXI(c), lv = avg(myXI.map(o => o.p.ovr)), open = k => G.inbox.filter(m => m.key === k && !m.done).length;
  // Offers to you
  if (open("fLoanIn") < 2 && R() < .6) {
    const cands = [];
    for (const id of G.foreign) { const x = CL(id), xi = new Set(pickXI(x).map(o => o.p.id));
      for (const pid of x.squad) { const p = P(pid); if (!p.acad && !p.loan && p.age <= 22 && !xi.has(p.id) && p.ovr >= lv - 3 && p.ovr <= lv + 8 && canSell(p)) cands.push([p, x]); } }
    for (const [p, x] of shuffle(cands).slice(0, 1 + (R() < .4 ? 1 : 0)))
      addChoice("fLoanIn", `${x.name} (${COUNTRY[x.country].name}) offer ${p.name} on loan`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}, potential ${est20(potEstimate(p))}. Until the end of the season; you'd pay half his ${pw(p.wage)} wage.`, ["Take him", "No thanks"], { pid: p.id, from: x.id }, 1);
  }
  // Requests to borrow yours
  if (open("fLoanOut") < 1 && R() < .5) {
    const xi = new Set(myXI.map(o => o.p.id)), games = (G.leagues[c.lg].tab[c.id] || {}).p || 0;
    const mine = c.squad.map(P).filter(p => !p.acad && !p.loan && p.age <= 22 && !xi.has(p.id) && !p.keep && (games < 5 || p.s.app < games * .3));
    const p = mine.sort((a, b) => b.pot - a.pot)[0]; if (!p) return;
    // Only a club where he'd go straight into the side: better than one of its regulars in his position.
    const x = shuffle(G.foreign.map(CL).filter(x => x.lvl >= p.ovr - 8 && x.lvl <= p.ovr + 2)).find(x => pickXI(x).some(o => o.slot === p.pos && roleRating(o.p, o.slot) < roleRating(p, p.pos) - 1)); if (!x) return;
    addChoice("fLoanOut", `${x.name} (${COUNTRY[x.country].name}) want ${p.name} on loan`, `He isn't getting games here. They'd play him regularly and pay all of his ${pw(p.wage)} wage until the end of the season.`, ["Let him go on loan", "Keep him"], { pid: p.id, to: x.id }, 1);
  }
}
DECIDE.fLoanIn = (m, i) => { const p = G.players[m.data.pid], x = CL(m.data.from); if (i === 0 && p && p.club === x.id && !p.loan) loanIn(p, x); };
DECIDE.fLoanOut = (m, i) => { const p = G.players[m.data.pid], x = CL(m.data.to); if (i === 0 && p && p.club === G.club && !p.loan) loanOut(p, x, 1); };
