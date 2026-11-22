/* Cups. One-off knockout ties, penalties if level, semi-finals and finals at a neutral ground.
   - National Cup: every club in the pyramid. Lower clubs play the early rounds; the biggest get byes.
   - League Cup: tiers 1-4.
   - National Trophy: tiers 5-7, the non-league clubs' own cup.
   Prize money for every round won; a home tie keeps the gate, an away tie pays a share of it. Beating a club from
   a higher division delights your supporters. */
"use strict";

const CUP_DEF = {
  NC: { name: "National Cup", tiers: [1, 2, 3, 4, 5, 6, 7], weeks: [3, 7, 11, 15, 19, 25, 31, 38], neutral: 2,
        prize: [3e3, 6e3, 15e3, 40e3, 100e3, 400e3, 1e6, 2.5e6], win: 4e6 },
  LC: { name: "League Cup", tiers: [1, 2, 3, 4], weeks: [2, 6, 10, 14, 22, 29, 36], neutral: 1,
        prize: [20e3, 30e3, 50e3, 100e3, 200e3, 400e3, 800e3], win: 1.5e6 },
  TR: { name: "National Trophy", tiers: [5, 6, 7], weeks: [5, 9, 13, 17, 23, 30, 37], neutral: 1,
        prize: [3e3, 5e3, 8e3, 15e3, 25e3, 50e3, 100e3], win: 250e3 },
};
const roundName = n => n === 2 ? "Final" : n === 4 ? "Semi-finals" : n === 8 ? "Quarter-finals" : n === 16 ? "Fifth round" : n === 32 ? "Fourth round" : n === 64 ? "Third round" : n === 128 ? "Second round" : "First round";
function startCups() {
  G.cups = {};
  for (const [k, D] of Object.entries(CUP_DEF)) {
    const ids = G.clubs.filter(c => !c.gone && D.tiers.includes(c.tier)).map(c => c.id);
    G.cups[k] = { key: k, alive: ids, round: 0, ties: null, log: [], win: null };
    drawCup(k);
  }
}
function drawCup(k) {
  const K = G.cups[k], n = K.alive.length; if (n < 2) return;
  let pow = 1; while (pow * 2 <= n) pow *= 2;
  let players;
  if (pow === n) players = shuffle(K.alive.slice());
  else {
    // Only enough ties to get down to a power of two: the lowest-ranked clubs play, the rest go through.
    const need = (n - pow) * 2, order = K.alive.slice().sort((a, b) => CL(b).tier - CL(a).tier || CL(a).rep - CL(b).rep);
    players = shuffle(order.slice(0, need));
  }
  K.ties = []; for (let i = 0; i + 1 < players.length; i += 2) K.ties.push({ h: players[i], a: players[i + 1] });
  K.name = roundName(pow === n ? n : pow * 2);
  const mine = K.ties.find(t => t.h === G.club || t.a === G.club);
  if (mine) news(`${CUP_DEF[k].name} ${K.name.toLowerCase()} draw: ${CL(mine.h).name} v ${CL(mine.a).name}.`, true);
}
const myCupTie = () => Object.entries(G.cups || {}).map(([k, K]) => K.ties && K.ties.find(t => t.h === G.club || t.a === G.club) ? { k, K, t: K.ties.find(t => t.h === G.club || t.a === G.club) } : null).filter(Boolean);
function cupWeek(w) {
  for (const [k, D] of Object.entries(CUP_DEF)) {
    const K = G.cups && G.cups[k]; if (!K || K.win != null || D.weeks[K.round] !== w || !K.ties) continue;
    const neutral = K.alive.length <= Math.pow(2, D.neutral);  // the final (and the National Cup semi-finals) at a neutral ground
    const out = new Set();
    for (const t of K.ties) {
      const { w: win, r } = playKO(t.h, t.a, neutral, k, K.name);
      out.add(win === t.h ? t.a : t.h);
      K.log.push({ r: K.name, h: t.h, a: t.a, hg: r.hg, ag: r.ag, pens: r.pens, w: win });
      if (win === G.club) {
        const prize = Math.round(D.prize[Math.min(K.round, D.prize.length - 1)] * (K.alive.length === 2 ? 0 : 1));
        if (prize) earn("prize", prize);
        const opp = CL(win === t.h ? t.a : t.h), gap = my().tier - opp.tier;
        if (gap > 0) { moodHit(my(), 3 * gap); bumpMedia(3 * gap); news(`GIANT-KILLING! ${my().name} knock ${opp.name}, ${gap} division${gap > 1 ? "s" : ""} above, out of the ${D.name}.`, true); }
      }
    }
    K.alive = K.alive.filter(id => !out.has(id)); K.round++;
    if (K.alive.length === 1) {
      K.win = K.alive[0]; K.ties = null; const c = CL(K.win); c.trophies.push([G.year, D.name]); for (const p of accSquad(c, 5)) accAdd(p, "cup", `${D.name} winner ${seasonLabel(G.year)}`);
      if (isMine(c)) { earn("prize", D.win); moodHit(c, 15); bumpMedia(15); news(`CUP WINNERS! ${c.name} win the ${D.name} and ${money(D.win)}.`, true); }
      else news(`${c.name} win the ${D.name}.`);
    } else drawCup(k);
  }
}
/* A knockout tie (cups and play-offs). Logs your result and handles your gate. */
function playKO(h, a, neutral, comp, label) {
  MATCH_CT = CUP_DEF[comp] ? "C" : typeof CONT !== "undefined" && CONT[comp] ? "E" : "L"; const r = playMatch(h, a, neutral, false, CUP_DEF[comp] && !/final/i.test(label || "") ? "cup" : "big"); MATCH_CT = "L"; let w = r.hg > r.ag ? h : r.ag > r.hg ? a : null; r.pens = false;
  if (w == null) { w = R() < .5 ? h : a; r.pens = true; }
  if (h === G.club || a === G.club) {
    const c = my(), home = h === G.club, gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg, opp = CL(home ? a : h);
    let crowd = null;
    if (home && !neutral) { crowd = homeGameMoney(c, opp); c._home = true; }
    else if (!neutral) { const share = Math.round(Math.min(opp.cap, opp.fans * 1.2) * ticketRef(opp) * .45); earn("gate", share); awayTrip(c, opp); awayRefundCheck(c, opp, gf, ga); }
    else { earn("gate", Math.round(Math.min(40000, (c.fans + opp.fans) * .8) * REF_TICKET[Math.min(c.tier, opp.tier)] * .4)); awayTrip(c, opp); }
    c.morale = clamp(c.morale + (w === G.club ? 4 : -3), 20, 95);
    h2hAdd(opp.id, gf === ga ? "D" : w === G.club ? "W" : "L"); G.myRes.push({ w: G.phase === "playoffs" ? SEASON_WEEKS + G.week : G.week, comp, label, home: home && !neutral, neutral, opp: opp.id, gf, ga, res: w === G.club ? "W" : "L", pens: r.pens, crowd, ev: r.ev, fit: r.fit[home ? 0 : 1] });
  }
  return { w, r };
}
