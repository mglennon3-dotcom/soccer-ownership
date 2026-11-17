/* Pre-season friendlies and transfer requests. */
"use strict";

/* ---------- pre-season friendlies ----------
   One in each pre-season week if you like (all eight), arranged any time before that week is played. Away, the host pays you a fee: bigger clubs pay more, and every
   club pays more the keener it is to face a side of your ability (a much stronger club gets little from playing you;
   neighbours like a local game). Home, you keep a reduced gate; bigger visitors draw bigger crowds but take a third of
   it as an appearance fee. Friendlies don't count in players' records. A side with fewer than two starts the season
   rusty for its first four league games; three or more gives it a small edge. */
const MAX_FRIENDLIES = 8;  // one per pre-season week (SUMMER_WEEKS, defined later in season.js)
const myLevel = c => avg(pickXI(c).map(o => o.p.ovr));
// How keen club x is to play you: 0.1-1.2.
function friendlyInterest(x, c = my()) {
  const gap = x.lvl - myLevel(c);  // how much stronger they are
  let i = 1 - Math.max(0, gap - 4) / 18 - Math.max(0, -gap - 2) / 10;
  if (x.region === c.region) i += .25; else if (x.half === c.half) i += .08;
  i += (c.media || 10) / 400;
  return clamp(i, .03, 1.2);
}
function awayFee(x, c = my()) {
  const gate = Math.min(x.cap, x.fans * .6) * REF_TICKET[x.tier] * .5;  // a friendly crowd at friendly prices
  return Math.max(250, Math.round(gate * .35 * Math.pow(friendlyInterest(x, c), 1.5) / 50) * 50);  // little interest, little crowd, little fee
}
function homeFriendly(x, c = my()) {
  const draw = clamp(.35 + (x.rep - c.rep) / 80 + (x.region === c.region ? .1 : 0), .25, 1.2);
  const crowd = Math.min(capacity(c), Math.round(c.fans * draw + x.fans * .02));
  const gate = crowd * c.prices.ticket * .6, fee = x.tier < c.tier ? Math.round(gate / 3) : 0;
  return { crowd, gate: Math.round(gate), fee };
}
// Opponents worth asking: neighbours, plenty of clubs around your level, and a few big names. The list is fixed for
// the pre-season (G.fOpts) so it doesn't reshuffle while you work through it.
function friendlyOptions() {
  if (G.fOpts && G.fOpts.y === G.year) return G.fOpts.ids.map(CL).filter(x => x && !x.gone);
  const c = my(), lv = myLevel(c), all = G.clubs.filter(x => !x.gone && !isMine(x));
  const near = all.filter(x => x.region === c.region).sort((a, b) => Math.abs(a.lvl - lv) - Math.abs(b.lvl - lv)).slice(0, 6);
  const level = all.filter(x => !near.includes(x)).sort((a, b) => Math.abs(a.lvl - lv) - Math.abs(b.lvl - lv)).slice(0, 14);  // the closest to your level, however weak you are
  const big = all.filter(x => x.tier <= Math.max(1, c.tier - 2) && x.half === c.half && !near.includes(x)).sort((a, b) => a.tier - b.tier).slice(0, 4);
  const list = [...near, ...level, ...big];
  G.fOpts = { y: G.year, ids: list.map(x => x.id) };
  return list;
}
const freeWeeks = () => { const used = new Set((G.friendlies || []).map(f => f.w)); const out = []; for (let w = G.phase === "summer" ? G.week : SUMMER_WEEKS; w < SUMMER_WEEKS; w++) if (!used.has(w)) out.push(w); return out; };
function askFriendly(x, home, week) {
  const c = my(), F = (G.friendlies ||= []), free = freeWeeks();
  const w = free.includes(week) ? week : free[0]; if (w == null) return "Every pre-season week already has a friendly.";
  if ((G.fAsked ||= []).includes(x.id)) return `${x.name} have already given you an answer this summer.`;
  G.fAsked.push(x.id);
  if (R() > Math.min(.95, friendlyInterest(x))) { news(`${x.name} turn down a pre-season friendly.`); return `${x.name} said no.`; }
  F.push({ w, opp: x.id, home, fee: home ? 0 : awayFee(x) });
  news(`Friendly arranged: ${home ? `${x.name} visit` : `away to ${x.name}`} in pre-season week ${w + 1}${home ? "" : ` (they'll pay ${money(awayFee(x))})`}.`);
  return null;
}
function friendlyWeek() {
  const c = my(), f = (G.friendlies || []).find(f => f.w === G.week); if (!f) return;
  const x = CL(f.opp), h = f.home ? c.id : x.id, a = f.home ? x.id : c.id;
  const r = playMatch(h, a, false, true);
  const gf = f.home ? r.hg : r.ag, ga = f.home ? r.ag : r.hg, res = gf > ga ? "W" : gf < ga ? "L" : "D";
  let crowd = null;
  if (f.home) { const m = homeFriendly(x); crowd = m.crowd; earn("gate", m.gate); if (m.fee) spend("rent", m.fee); }
  else earn("gate", f.fee);
  c.morale = clamp(c.morale + (res === "W" ? 1.5 : res === "L" ? -1 : 0), 20, 95);
  if (res === "W" && x.tier < c.tier - 1) { moodHit(c, 2); news(`A pre-season win over ${x.name} has the supporters dreaming.`); }
  c.prep = (c.prep || 0) + 1;
  G.myRes.push({ w: G.week, comp: "F", label: "Friendly", home: f.home, opp: x.id, gf, ga, res, crowd, ev: r.ev, fit: r.fit[f.home ? 0 : 1] });
}
// Rust and sharpness at the start of the season.
const prepBonus = c => !isMine(c) || G.phase !== "season" || G.week > 5 ? 0 : (c.prep || 0) < 2 ? -1.5 : (c.prep || 0) >= 3 ? .5 : 0;

/* ---------- transfer requests ----------
   Players get unhappy: good enough to start but on the bench, far too good for your division, paid well below their
   worth, or kept from a move they wanted. Every four weeks an unhappy player may hand in a transfer request. */
function unhappiness(p, c) {
  if (p.acad || p.loan || p.age > 33 || p.req || p.dealY === G.year || p.inW === windowId() || p.keep) return null;
  const why = [], xi = pickXI(c).map(o => o.p), med = avg(xi.map(q => q.ovr)), games = (G.leagues[c.lg].tab[c.id] || {}).p || 0;
  let s = 0;
  if (games >= 10 && !xi.includes(p) && p.ovr >= med && p.s.app < games * .3) { s += 2; why.push("playing time"); }
  if (p.ovr - TIER_LVL[c.tier] >= 10) { s += 1 + (p.ovr - TIER_LVL[c.tier] - 10) / 6; why.push("ambition"); }
  if (p.wage < wageFor(p.ovr) * .6) { s += 1; why.push("wages"); }
  if (p.blocked) { s += p.blocked * 1.2; why.push("a blocked move"); }
  return s ? { s, why } : null;
}
function requestsCheck() {
  const c = my(); if (G.phase === "playoffs" || G.week % 4 !== 2) return;
  for (const p of c.squad.map(P)) {
    const u = unhappiness(p, c); if (!u || R() > clamp(u.s * .07, 0, .35)) continue;
    p.req = G.year;
    addChoice("treq", `${p.name} hands in a transfer request`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}. He's unhappy about ${u.why.join(" and ")}.`,
      ["Accept: put him on the transfer list", `Offer a new deal (${pw(newDealWage(p))})`, "Refuse"], { pid: p.id, why: u.why }, 0);
    return;  // one at a time
  }
}
DECIDE.treq = (m, i) => {
  const p = G.players[m.data.pid]; if (!p || p.club !== G.club) return;
  if (i === 0) { p.list = true; news(`${p.name} is transfer-listed at his own request.`); return; }
  if (i === 1) {
    // Money and blocked moves are fixed by a better contract; playing time and ambition only sometimes.
    const fixable = m.data.why.every(w => w === "wages" || w === "a blocked move") || R() < .4;
    newDeal(p);
    if (fixable) { p.req = 0; news(`${p.name} withdraws his transfer request.`); }
    else { p.list = true; news(`${p.name} takes the new contract but still wants to leave. He's on the transfer list.`, true); }
    return;
  }
  p.unsettled = Math.max(p.unsettled || 0, 12); moodHit(my(), -1); news(`You refuse ${p.name}'s transfer request. He's unsettled.`, true);
};
