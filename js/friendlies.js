/* Pre-season friendlies and transfer requests. */
"use strict";

/* ---------- pre-season friendlies ----------
   One in each pre-season week if you like (all eight), arranged any time before that week is played. Away, the host pays you a fee: bigger clubs pay more, and every
   club pays more the keener it is to face a side of your ability (a much stronger club gets little from playing you;
   neighbours like a local game). Home, you keep a reduced gate; bigger visitors draw bigger crowds but take a third of
   it as an appearance fee. Friendlies don't count in players' records. A side with fewer than two starts the season
   rusty for its first four league games; three or more gives it a small edge. */
const MAX_FRIENDLIES = 8;  // one per pre-season week (SUMMER_WEEKS, defined later in season.js)
// Your side's level (cached for a moment: the friendlies page asks it for every club in the game).
let ML_ = { t: 0 };
const myLevel = c => { const k = c.id + ":" + c.squad.length + ":" + G.week; if (ML_.k === k && Date.now() - ML_.t < 2000) return ML_.v; const v = avg(pickXI(c).map(o => o.p.ovr)); ML_ = { k, v, t: Date.now() }; return v; };
// How keen club x is to play you: 0.1-1.2.
function friendlyInterest(x, c = my()) {
  const gap = x.lvl - myLevel(c);  // how much stronger they are
  let i = 1 - Math.max(0, gap - 4) / 18 - Math.max(0, -gap - 2) / 10;
  if (x.region === c.region) i += .25; else if (x.half === c.half) i += .08;
  i += (c.media || 10) / 400;
  if (x.abroad) i = Math.max(i + .3, .3);  // clubs abroad like an English side on a pre-season tour, whatever its level
  return clamp(i, .03, 1.2);
}
const TOUR_FEE = [0, 400e3, 200e3, 100e3, 50e3, 25e3, 12e3, 6e3];
function awayFee(x, c = my()) {
  const gate = Math.min(x.cap, x.fans * .6) * REF_TICKET[x.tier] * .5;  // a friendly crowd at friendly prices
  // A club abroad pays a tour fee that covers the trip, and pays it whoever you are: an English side sells tickets.
  // It's set by your standing: several times what an English club of any size would pay a side at your level.
  if (x.abroad) return Math.round(TOUR_FEE[c.tier] * (1 + c.rep / 100) * (.8 + .4 * friendlyInterest(x, c)) / 500) * 500;
  return Math.max(250, Math.round(gate * .35 * Math.pow(friendlyInterest(x, c), 1.5) / 50) * 50);  // little interest, little crowd, little fee
}
function homeFriendly(x, c = my()) {
  const draw = clamp(.35 + (x.rep - c.rep) / 80 + (x.region === c.region ? .1 : 0), .25, 1.2);
  const crowd = Math.min(capacity(c), Math.round(c.fans * draw + x.fans * .02));
  const gate = crowd * c.prices.ticket * .6, fee = x.tier < c.tier ? Math.round(gate / 3) : 0;
  return { crowd, gate: Math.round(gate), fee };
}
/* Opponents worth asking: neighbours, plenty of clubs around your level, a few from every division above you (the
   nearest first), and a couple of clubs abroad for a pre-season tour. The list is fixed for the pre-season (G.fOpts)
   so it doesn't reshuffle while you work through it. */
function friendlyOptions() {
  if (G.fOpts && G.fOpts.y === G.year && G.fOpts.v === 2) return G.fOpts.ids.map(CL).filter(x => x && (!x.gone || x.abroad));
  const c = my(), lv = myLevel(c), all = G.clubs.filter(x => !x.gone && !isMine(x)), taken = new Set();
  const take = l => l.filter(x => !taken.has(x.id)).map(x => (taken.add(x.id), x));
  const near = take(all.filter(x => x.region === c.region).sort((a, b) => Math.abs(a.lvl - lv) - Math.abs(b.lvl - lv)).slice(0, 6));
  const level = take(all.filter(x => !taken.has(x.id)).sort((a, b) => Math.abs(a.lvl - lv) - Math.abs(b.lvl - lv)).slice(0, 12));  // the closest to your level, however weak you are
  // Every division above: three from each, those nearest you (same region, then same half) first.
  const above = [];
  for (let t = c.tier - 1; t >= 1; t--) above.push(...take(shuffle(all.filter(x => x.tier === t && !taken.has(x.id)))
    .sort((a, b) => (b.region === c.region) - (a.region === c.region) || (b.half === c.half) - (a.half === c.half)).slice(0, 3)));
  const tour = take(shuffle((G.foreign || []).map(CL).filter(Boolean)).slice(0, 3));
  const list = [...near, ...level, ...above, ...tour];
  G.fOpts = { y: G.year, v: 2, ids: list.map(x => x.id) };
  return list;
}
// Every club you could ask: all of England's (except yours) and every club abroad. Most won't be keen; you can still ask.
const friendlyAll = () => G.clubs.filter(x => !isMine(x) && (x.abroad ? (G.foreign || []).includes(x.id) : !x.gone));
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
  if (p.acad || p.loan || p.age > 33 || p.req || lastDealY(p) === G.year || p.inW === windowId() || p.keep) return null;  // not in the season he signed or re-signed
  const why = [], xi = pickXI(c).map(o => o.p), med = avg(xi.map(q => q.ovr)), games = ((G.leagues[c.lg].tab || {})[c.id] || {}).p || 0;
  let s = 0;
  if (games >= 10 && !xi.includes(p) && p.ovr >= med && p.s.app < games * .3) { s += 2; why.push("playing time"); }
  // Ambition: a player far too good for the division wants to play higher. In the Premier Division there's nowhere
  // higher: he only wants a club that wins things and plays in Europe, so a successful club (champions or top-four
  // recently, in Europe, or near the top now) gives him none. Lower down, a club going up (top of the table, or just
  // promoted) holds him a while longer.
  { const H = G.history || [], pos = G.leagues[c.lg].tab ? table(c.lg).findIndex(r => r.id === c.id) + 1 : 0;
    const winning = c.tier === 1 ? (inEurope(c) || H.slice(0, 2).some(h => h.club === c.name && h.tier === 1 && h.pos <= 4) || (pos && pos <= 4)) : (H[0] && H[0].up) || (pos && pos <= 2);
    const over = p.ovr - TIER_LVL[c.tier];
    if (c.tier === 1 ? !winning && over >= 6 : over >= 10 && !(winning && over < 16)) { s += 1 + Math.max(0, over - 10) / 6; why.push(c.tier === 1 ? "wanting to win trophies and play in Europe" : "ambition"); } }
  // He agreed his wage: no complaint about it until he's played a season on it.
  if ((p.wage < wageAt(p.ovr, my().tier) * .6 && settledPay(p)) || p.payGrudge) { s += 1 + (p.payGrudge || 0) * .5; why.push("wages"); }
  if (p.blocked) { s += p.blocked * 1.2; why.push("a blocked move"); }
  if (p.nfs && nfsGrudge(p, c)) { s += 1; why.push("being made not for sale"); }
  // The manager's system: no place for his position, or a style that doesn't suit him, matters to those who care.
  const pr = prefsOf(p, P_FACTORS), fit = systemFit(p), cares = 1 + (pr.pri.form + pr.pri.time) * 3;
  if (fit.slots === 0) { s += .8 * cares; why.push("having no place in the manager's system"); }
  else if (fit.style < -.4) { s += .5 * cares; why.push("a style of play that doesn't suit him"); }
  if (p.bond) s = Math.max(0, s - p.bond * .25);  // your congratulations (or criticism) colour how he feels
  return s ? { s, why } : null;
}
/* Pay rises: every four weeks a player paid well under his worth (under 80% of the going rate for his rating) may ask
   for one, up to the going rate. Give it, meet him halfway (he'll take it, a little grudgingly), or refuse (he's
   unsettled and the grievance stays). Left unanswered, your head of recruitment decides on the wage budget. */
// A player who joined this season (summer or January) doesn't ask for a new deal until next season.
// The season he signed, joined, or last had his pay settled (a new deal or a rise).
const lastDealY = p => Math.max(p.dealY || 0, ...(p.payLog || []).filter(x => ["signed", "new deal", "pay rise", "first professional contract", "contract renewal"].includes(x.why)).map(x => x.y), ...(G.tlog || []).filter(m => m.kind === "in" && m.id === p.id).map(m => m.y));
// He agreed his wage when he signed or re-signed, so he doesn't ask for more until the season after next: a full
// season on the deal after the one he joined in. A breakout season can still bring a demand the season after.
const settledPay = p => G.year - lastDealY(p) >= 2;
const joinedThisSeason = p => (p.payLog || []).some(x => x.why === "signed" && x.y === G.year) || (G.tlog || []).some(m => m.kind === "in" && m.id === p.id && m.y === G.year);
function payReviews() {
  const c = my(); if (G.phase === "playoffs" || G.week % 4 !== 0) return;
  let n = 0;
  for (const p of c.squad.map(P)) {
    if (n >= 2) break;
    if (p.acad || p.loan || p.age > 35 || p.payY === G.year || joinedThisSeason(p) || G.inbox.some(m => m.key === "raise" && !m.done && m.data.pid === p.id)) continue;
    const form = Math.max(0, seasonForm(p)), star = form >= .9 && p.s.app >= 10;
    // A breakout season: he wants paying like the player he's become, and he'll threaten to go if you won't.
    // What he asks for: what it would take to keep him (the figure on his contract page), plus 10-20% for the season he's had.
    // Never more than a quarter over the going rate for his level, however good the season.
    const keep = star ? renewTerms(p).min : null, ask = star ? Math.round(Math.min(Math.max(p.wage * 1.15, (keep || demandWage(p, c) * 1.2) * (1.1 + form * .1)), Math.max(p.wage * 1.15, demandWage(p, c) * 1.25)) / 100) * 100 : 0;
    // A player who took less to join (he wanted to come) honours it: no breakout demand until the season after next.
    const gaveUp = p.keen && p.keen.club === c.id && G.year - (p.keen.y || 0) < 2;
    if (star && !gaveUp && G.year > lastDealY(p) && p.wage < ask / 1.15 && R() < .5) {
      const half = Math.round((p.wage + ask) / 2 / 100) * 100;
      p.payY = G.year; n++;
      addChoice("raise", `${p.name} wants a new deal after ${formWord(form) || "a great season"}`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}: ${p.s.g} goals and ${p.s.a} assists in ${p.s.app} games. He earns ${pw(p.wage)} and wants ${pw(ask)}. His agent says he'll hand in a transfer request if he doesn't get it.`,
        [`Give him ${pw(ask)}`, `Offer ${pw(half)}`, "Refuse"], { pid: p.id, worth: ask, half, threat: true }, 1);
      continue;
    }
    if (!settledPay(p)) continue;
    const worth = Math.round(demandWage(p, c) / 100) * 100; if (p.wage >= worth * .8 || R() > .35) continue;
    p.payY = G.year; n++;
    const half = Math.round((p.wage + worth) / 2 / 100) * 100, room = c.budget.wages - wageBill(c) >= worth - p.wage;
    addChoice("raise", `${p.name} asks for a pay rise`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}. He earns ${pw(p.wage)}; players of his standard get about ${pw(worth)}. He wants that.`,
      [`Give him ${pw(worth)}`, `Meet him halfway (${pw(half)})`, "Refuse"], { pid: p.id, worth, half }, room ? 0 : 2);
  }
}
DECIDE.raise = (m, i) => {
  const p = G.players[m.data.pid]; if (!p || p.club !== G.club) return;
  const was = p.wage;
  // A pay rise comes with a new contract: four years (three if you met him halfway), or longer if he already had it.
  if (i === 0) { p.wage = Math.max(p.wage, m.data.worth); logPay(p, was, "pay rise"); p.unsettled = 0; p.payGrudge = 0; p.dealY = G.year; p.yrs = Math.max(p.yrs, 4); p.expiring = false; news(`${p.name} gets his pay rise: ${pw(p.wage)} on a new deal with ${p.yrs} years to run.`); }
  else if (i === 1 && !(m.data.threat && R() < .4)) { p.wage = Math.max(p.wage, m.data.half); logPay(p, was, "pay rise"); p.dealY = G.year; p.yrs = Math.max(p.yrs, 3); p.expiring = false; news(`${p.name} accepts ${pw(p.wage)} on a new deal with ${p.yrs} years to run, though he wanted more.`); }
  else if (m.data.threat) {
    // He carries out the threat (a half-hearted offer can do it too).
    p.req = G.year; p.list = true; p.unsettled = Math.max(p.unsettled || 0, 10); p.payGrudge = (p.payGrudge || 0) + 1;
    news(`${p.name} hands in a transfer request after ${i === 1 ? "your offer fell short" : "his demands were turned down"}. He's on the transfer list.`, true);
  }
  else { p.unsettled = Math.max(p.unsettled || 0, 6); p.payGrudge = (p.payGrudge || 0) + 1; news(`${p.name}'s request for a pay rise is turned down. He's unsettled.`, true); }
};
function requestsCheck() {
  payReviews();
  const c = my(); if (G.phase === "playoffs" || G.week % 4 !== 2) return;
  for (const p of c.squad.map(P)) {
    // Loyal players (and fan favourites) put up with more before asking to leave; mercenaries ask sooner.
    const u = unhappiness(p, c), stay = (1.6 - 1.2 * loyaltyOf(p)) * (1 - Math.min(1, loveOf(p, c.id) / LEGEND) * .4);
    if (!u || R() > clamp(u.s * .07 * stay, 0, .35 * Math.max(1, stay))) continue;
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
