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

const FOREIGN = {  // [clubs, standard of the best club (out of 100), Champions Cup places, Shield places]
  ESP: [12, 86, 5, 5], GER: [12, 85, 5, 5], ITA: [12, 85, 5, 5], FRA: [10, 83, 4, 4], POR: [9, 80, 3, 4], NED: [8, 79, 3, 3], BEL: [8, 77, 3, 3],
};
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
function makeForeign() {
  G.foreign = [];
  for (const [code, [n, top]] of Object.entries(FOREIGN)) {
    const K = COUNTRY[code];
    for (let i = 0; i < n; i++) {
      const t = foreignTown(K), lvl = top - i * 1.25 + normal() * .8, rep = clamp(Math.round(55 + (lvl - 70) * 2.2), 30, 98);
      const c = { id: G.clubs.length, name: pick(K.fmt).replace("{t}", t), town: t, short: stripAcc(t).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(), country: code,
        abroad: true, gone: true, lg: null, tier: 1, half: null, region: pick(K.regions)[0], rep, lvl, color: CLUB_COLORS[G.clubs.length % CLUB_COLORS.length],
        coach: aiCoach(rep), squad: [], train: clamp(Math.round(lvl / 10), 4, 10), acadLvl: clamp(Math.round(lvl / 11), 3, 10),
        cap: Math.round((15000 + (lvl - 70) * 2800) * rf(.8, 1.2) / 500) * 500, fans: Math.round((12000 + (lvl - 70) * 2600) * rf(.8, 1.2)), founded: G.year - ri(60, 130), trophies: [] };
      c.own = newOwner(c);
      G.clubs.push(c); G.foreign.push(c.id); foreignSquad(c);
    }
  }
}
function foreignSquad(c) {
  const have = pos => c.squad.map(P).filter(p => p.pos === pos && !p.acad).length;
  for (const [pos, n] of Object.entries(SQUAD_MIX)) for (let i = have(pos); i < n; i++) {
    const age = ri(19, 33), ovr = clamp(Math.round(c.lvl + 2 - i * 3 + normal() * 2.5), 40, 94);
    const p = makePlayer({ pos, ovr, age, nat: R() < .7 ? c.country : pickNat(c.country), club: c.id, pot: seniorPot(ovr, age) });
    p.yrs = ri(1, 4); c.squad.push(p.id); p.hist.push([G.year, c.short]);
  }
  const sq = c.squad.map(P).filter(p => !p.acad).sort((a, b) => b.ovr - a.ovr);
  for (const p of sq.slice(27)) toFreeAgent(p);  // surplus players look for clubs (some end up in England)
}
// Each summer: standing and strength drift, squads are topped up.
function foreignSummer() {
  for (const id of G.foreign || []) {
    const c = CL(id); c.lvl = clamp(c.lvl + normal() * 1.2, 66, 90); c.rep = clamp(Math.round(55 + (c.lvl - 70) * 2.2), 30, 98);
    foreignSquad(c);
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
  return out;
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
    let crowd = null; if (home) { crowd = Math.min(capacity(c), Math.round(crowdFor(c, opp) * 1.2)); earn("gate", crowd * c.prices.ticket * 1.3); const con = concessionsFor(c, crowd); earn("conc", con.net); spend("rent", ground(c).rent); c._home = true; }
    c.morale = clamp(c.morale + (gf > ga ? 3 : gf < ga ? -2 : 0), 20, 95);
    G.myRes.push({ w: G.week, comp, label, home, opp: opp.id, gf, ga, res: gf > ga ? "W" : gf < ga ? "L" : "D", crowd, ev: r.ev, fit: r.fit[home ? 0 : 1] });
  }
  return r;
}
