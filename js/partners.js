/* Your network: a bigger partner club that lends you players, and up to three feeder clubs in lower divisions that
   you fund. Feeders take your young players on loan first, get stronger with your money, and give you first refusal
   on their best youngsters. Loans last until the end of the season. */
"use strict";

const MAX_FEEDERS = 3;
const net = () => G.net || (G.net = { partner: null, feeders: [] });
const isFeeder = id => net().feeders.some(f => f.id === id);

/* ---------- loans ---------- */
// share: the part of his wage the borrowing club pays.
function loanOut(p, to, share = .5) {
  const c = my(); p.loan = { from: c.id, to: to.id, share };
  c.squad = c.squad.filter(id => id !== p.id); to.squad.push(p.id); p.club = to.id;
  (G.loanList ||= []).push(p.id);
  news(`${p.name} goes on loan to ${to.name}${to.abroad ? ` in ${COUNTRY[to.country].name}` : ""} for the rest of the season. They pay ${share >= 1 ? "all" : "half"} his wages.`);
}
// Loan targets: young players a club would lend (not in its first team), from English or foreign clubs.
const loanable = p => p.club >= 0 && p.club !== G.club && !p.loan && !p.acad && p.age <= 23 && (!CL(p.club).gone || CL(p.club).abroad);
// Clubs lend to clubs within three divisions of their own (clubs abroad count as top flight).
const lendsTo = (from, c = my()) => c.tier - (from.abroad ? 1 : from.tier) <= 3;
const inTheirXI = p => pickXI(CL(p.club)).some(o => o.p === p);
/* Borrowing: you name the share of his wages you'll pay. Each club has a figure in mind for this window (lower for your
   partner club and for youngsters who need games, higher abroad); offer at least that and he comes. Below it they
   tell you what they want, and after three tries they stop listening. Some won't lend him at all. */
function loanTerms(p) {
  const w = windowId(); if (p.lt && p.lt.w === w) return p.lt;
  const from = CL(p.club), partner = net().partner && net().partner.id === from.id;
  const v = .55 + normal() * .15 - (partner ? .25 : 0) + (from.abroad ? .05 : 0) - (p.age <= 20 ? .1 : 0);
  return p.lt = { w, min: clamp(Math.round(v * 10) / 10, 0, 1), tries: 0, no: R() < (partner ? .05 : .2) };
}
function askLoan(p, share) {
  const from = CL(p.club), T = loanTerms(p);
  if (!lendsTo(from)) return { ok: false, t: `${from.name} won't send ${p.name} that far down: they lend to clubs within three divisions of their own.` };
  if (T.no) return { ok: false, t: `${from.name} want to keep ${p.name}: he isn't available on loan.` };
  if (share >= T.min) { loanIn(p, from, share); return { ok: true, t: `${from.name} agree: ${p.name} joins on loan until the end of the season. You pay ${Math.round(share * 100)}% of his wages (${pw(p.wage * share)}).` }; }
  if (++T.tries >= 3) { T.no = true; return { ok: false, t: `${from.name} have had enough of haggling: ${p.name} isn't available to you this window.` }; }
  return { ok: false, t: `${from.name} say no: they want you to pay at least ${Math.round(T.min * 100)}% of his wages (${pw(p.wage * T.min)}). ${3 - T.tries} more ${3 - T.tries === 1 ? "try" : "tries"} before they give up.` };
}
function loanIn(p, from, share = .5) {
  const c = my(); p.loan = { from: from.id, to: c.id, share };
  from.squad = from.squad.filter(id => id !== p.id); c.squad.push(p.id); p.club = c.id;
  (G.loanList ||= []).push(p.id);
  news(`${p.name} (${p.pos}, ${r20(p.ovr)}) joins on loan from ${from.name} until the end of the season; you pay ${Math.round(share * 100)}% of his wages.`, true);
}
function endLoans() {
  for (const id of G.loanList || []) {
    const p = G.players[id]; if (!p || !p.loan) continue;
    const at = CL(p.club), home = CL(p.loan.from);
    if (at) at.squad = at.squad.filter(x => x !== id);
    if (home && (!home.gone || home.abroad)) { home.squad.push(id); p.club = home.id; } else toFreeAgent(p);  // foreign clubs count as still going
    if (home && isMine(home)) news(`${p.name} returns from his loan at ${at ? at.name : "his loan club"} (${p.s.app} games).`);
    p.loan = null;
  }
  G.loanList = [];
}
// Your share of wages: a loanee in costs you his share; a player out on loan still costs you the rest.
function loanWageAdj(c) {
  let t = 0;
  for (const id of G.loanList || []) { const p = G.players[id]; if (!p || !p.loan) continue;
    if (p.loan.to === c.id) t -= p.wage * (1 - p.loan.share);
    if (p.loan.from === c.id) t += p.wage * (1 - p.loan.share); }
  return t;
}

/* ---------- the partner club ----------
   A club at least two divisions above. They agree if you're a club worth having in their network. Each window they
   offer a young player or two on loan; in return they expect first look at your best youngsters. */
function partnerCands() {
  const c = my(); return G.clubs.filter(x => !x.gone && !isMine(x) && x.tier <= c.tier - 2 && !isFeeder(x.id)).sort((a, b) => a.tier - b.tier || b.rep - a.rep);
}
function partnerChance(x) { const c = my(); return clamp(.25 + (c.rep - x.rep + 40) / 80 + (c.fac.train.lvl - 3) * .04 + (x.own && x.own.style === "multiclub" ? .2 : 0), .05, .95); }
function approachPartner(x) {
  if (R() < partnerChance(x)) { net().partner = { id: x.id, rel: 60, since: G.year }; news(`${x.name} agree a partnership. Expect loan offers each window.`, true); return true; }
  net().asked = G.year; news(`${x.name} turn down a partnership for now.`); return false;
}
function partnerWindow() {
  const N = net(); if (!N.partner) return; const x = CL(N.partner.id), c = my();
  if (!x || x.gone || x.tier >= c.tier) { news(`The partnership with ${x ? x.name : "your partner"} lapses: they're no longer above you.`); N.partner = null; return; }
  const myXI = avg(pickXI(c).map(o => o.p.ovr));
  const cands = x.squad.map(P).filter(p => !p.acad && !p.loan && p.age <= 23 && p.ovr >= myXI - 2 && !pickXI(x).some(o => o.p === p)).sort((a, b) => b.pot - a.pot).slice(0, 2);
  for (const p of cands) if (!G.inbox.some(m => m.key === "pLoan" && !m.done && m.data.pid === p.id))
    addChoice("pLoan", `${x.name} offer ${p.name} on loan`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}, potential ${est20(potEstimate(p))}. You'd pay half his ${pw(p.wage)} wage.`, ["Take him", "No thanks"], { pid: p.id, from: x.id }, 1);
}
DECIDE.pLoan = (m, i) => { const p = G.players[m.data.pid], x = CL(m.data.from); if (i === 0 && p && p.club === x.id) { loanIn(p, x); if (net().partner) net().partner.rel += 3; } };

/* ---------- feeders ---------- */
function feederCands() { const c = my(); return G.clubs.filter(x => !x.gone && !isMine(x) && x.tier > c.tier && !isFeeder(x.id) && (x.half === c.half || x.tier <= 5)).sort((a, b) => a.tier - b.tier || b.rep - a.rep); }
function addFeeder(x) { net().feeders.push({ id: x.id, fund: Math.round(TV[x.tier] * .3 / 1000) * 1000, rel: 55, since: G.year }); news(`${x.name} become a feeder club.`, true); }
function dropFeeder(id) { net().feeders = net().feeders.filter(f => f.id !== id); news(`${CL(id).name} are no longer a feeder club.`); }
const feederFunding = () => sum(net().feeders, f => f.fund);
/* Funding each summer: the feeder recruits to a higher standard and improves its facilities; the relationship grows. */
function feedersSummer() {
  const c = my();
  for (const f of net().feeders.slice()) {
    const x = CL(f.id); if (!x || x.gone || x.tier <= c.tier) { news(`${x ? x.name : "A feeder"} can no longer be a feeder club.`); dropFeeder(f.id); continue; }
    const ref = TV[x.tier] + 24 * wageFor(TIER_LVL[x.tier]) * .1, k = clamp(f.fund / ref, 0, 3);
    x.lvl += k * 1.5; if (R() < k * .3) x.train = Math.min(10, x.train + 1); if (R() < k * .25) x.acadLvl = Math.min(10, x.acadLvl + 1);
    f.rel = clamp(f.rel + (k - .5) * 10, 0, 100);
    // First refusal on their best youngster.
    const y = x.squad.map(P).filter(p => p.age <= 21 && !p.loan).sort((a, b) => b.pot - a.pot)[0];
    if (y && y.pot >= TIER_LVL[c.tier] - 2) { const fee = Math.round(valueOf(y) * (1 - f.rel / 250) / 1000) * 1000;
      addChoice("fFirst", `First refusal: ${y.name} from ${x.name}`, `${POS_NAME[y.pos]}, ${y.age}, rated ${r20(y.ovr)}, potential ${est20(potEstimate(y))}. Yours for ${money(fee)}, below his value, before anyone else hears about him.`, ["Sign him", "Pass"], { pid: y.id, fee, from: x.id }, 1); }
  }
}
DECIDE.fFirst = (m, i) => { const p = G.players[m.data.pid]; if (i !== 0 || !p || p.club !== m.data.from) return; signPlayer(p, m.data.fee, Math.max(p.wage, demandWage(p, my())), false); };
// What's spent on feeders each week.
function feedersWeek() { if (net().feeders.length) spend("feeders", feederFunding() / 52); }
