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
  const c = my(); logMove("loanout", p, { club: to.name, share, wage: p.wage, by: "you" }); p.loan = { from: c.id, to: to.id, share };
  c.squad = c.squad.filter(id => id !== p.id); to.squad.push(p.id); p.club = to.id; capSquad(to, p);
  (G.loanList ||= []).push(p.id);
  p.loanList = false;
  news(`${p.name} goes on loan to ${to.name}${to.abroad ? ` in ${COUNTRY[to.country].name}` : ""} for the rest of the season. They pay ${share >= 1 ? "all" : Math.round(share * 100) + "%"} of his wages.`);
}
// Loan targets: young players a club would lend (not in its first team), from English or foreign clubs.
const loanable = p => p.club >= 0 && p.club !== G.club && !p.loan && !p.acad && p.age <= 23 && (!CL(p.club).gone || CL(p.club).abroad);
// What your club pays him a year: his full wage, or your share of it while he is on loan to you.
const myWage = p => p.loan && p.loan.to === G.club ? p.wage * p.loan.share : p.wage;
/* A loan is about games at the right level: any club, however big, lends a player to a club in the division that suits
   his ability, or one below it, but not further down (he'd learn nothing). */
// ...but a youngster already good enough to start for an average side in his own division only goes to that division.
const lendsTo = (p, c = my()) => { const nt = naturalTier(p); return c.tier - nt <= (p.ovr >= TIER_XI[nt] - 1 ? 0 : 1); };
const inTheirXI = p => pickXI(CL(p.club)).some(o => o.p === p);
// Non-league football (the National Division and below) allows loans all season; above that, only in a window.
const loansOpen = () => windowOpen() || (G.club != null && my().tier >= 5);
/* Borrowing: you name the share of his wages you'll pay. Each club has a figure in mind for this window (lower for your
   partner club and for youngsters who need games, higher abroad); offer at least that and he comes. Below it they
   tell you what they want, and after three tries they stop listening. Some won't lend him at all. */
function playerLoanTerms(p, from = CL(p.club)) {
  const w = windowId(), partner = isPartner(from.id);
  // A partner never refuses, whatever was decided before (an older save, or terms set before the partnership began).
  if (p.lt && p.lt.w === w) { if (partner) { p.lt.no = false; p.lt.min = Math.min(p.lt.min, .5); } return p.lt; }
  const v = .55 + normal() * .15 - (partner ? .25 : 0) + (from.abroad ? .05 : 0) - (p.age <= 20 ? .1 : 0);
  // A partner club always lends you its young players out of its first team, and never asks more than half his wages.
  return p.lt = { w, min: clamp(Math.round(v * 10) / 10, 0, partner ? .5 : 1), tries: 0, no: !partner && R() < .2 };
}
// What his club wants you to pay in wages to borrow him this window, or null if he isn't available to you.
const loanPay = p => { if (p.club < 0 || !lendsTo(p)) return null; const T = playerLoanTerms(p); return T.no ? null : Math.round(p.wage * T.min / 100) * 100; };
function askLoan(p, share) {
  const from = CL(p.club), T = playerLoanTerms(p);
  if (!lendsTo(p)) return { ok: false, t: `${from.name} won't send ${p.name} that far down: he's a ${TIER_NAME[naturalTier(p)]} player and they want him playing at that level.` };
  if (T.no) return { ok: false, t: `${from.name} want to keep ${p.name}: he isn't available on loan.` };
  if (share >= T.min) { loanIn(p, from, share); return { ok: true, t: `${from.name} agree: ${p.name} joins on loan until the end of the season. You pay ${Math.round(share * 100)}% of his wages (${pw(p.wage * share)}).` }; }
  if (++T.tries >= 3) { T.no = true; return { ok: false, t: `${from.name} have had enough of haggling: ${p.name} isn't available to you this window.` }; }
  return { ok: false, t: `${from.name} say no: they want you to pay at least ${Math.round(T.min * 100)}% of his wages (${pw(p.wage * T.min)}). ${3 - T.tries} more ${3 - T.tries === 1 ? "try" : "tries"} before they give up.` };
}
/* A loan agreed before shares could be negotiated was fixed at half his wages: you get one chance to renegotiate it,
   on the same terms as a new loan (offer at least what his club has in mind; three tries). */
function redoLoan(p, share) {
  const from = CL(p.loan.from), T = playerLoanTerms(p, from), was = p.loan.share;
  if (share >= T.min) { p.loan.share = share; p.loan.redo = false; return { ok: true, t: `${from.name} agree: you now pay ${Math.round(share * 100)}% of ${p.name}'s wages (${pw(p.wage * share)}), down from ${Math.round(was * 100)}%.` }; }
  if (++T.tries >= 3) { p.loan.redo = false; return { ok: false, t: `${from.name} won't discuss it any more: you keep paying ${Math.round(was * 100)}% of his wages.` }; }
  return { ok: false, t: `${from.name} say no: they want you to pay at least ${Math.round(T.min * 100)}% (${pw(p.wage * T.min)}). ${3 - T.tries} more ${3 - T.tries === 1 ? "try" : "tries"}.` };
}
function loanIn(p, from, share = .5, how) {
  const c = my(); logMove("loanin", p, { club: clubLabel(from), share, wage: p.wage, by: how || "you" }); p.loan = { from: from.id, to: c.id, share, neg: true };
  from.squad = from.squad.filter(id => id !== p.id); c.squad.push(p.id); p.club = c.id; registerNew(p, c);
  (G.loanList ||= []).push(p.id);
  news(`${p.name} (${p.pos}, ${r20(p.ovr)}) joins on loan from ${from.name} until the end of the season; you pay ${Math.round(share * 100)}% of his wages.`, true);
}
function endLoans() {
  for (const id of G.loanList || []) {
    const p = G.players[id]; if (!p || !p.loan) continue;
    const at = CL(p.club), home = CL(p.loan.from);
    if (at) p.loanedAt = { y: G.year, short: at.short };  // the season's progression row names the loan club
    if (home && isMine(home)) logMove("loanback", p, { club: at ? at.name : "" }); else if (at && isMine(at)) logMove("loanend", p, { club: home ? home.name : "" });
    if (at) at.squad = at.squad.filter(x => x !== id);
    if (home && (!home.gone || home.abroad)) { home.squad.push(id); p.club = home.id; p.loan = null; capSquad(home, p); } else toFreeAgent(p);  // foreign clubs count as still going
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

/* ---------- partner clubs ----------
   You can be a feeder to up to three bigger clubs: English clubs in any division above you, or clubs abroad. A club
   agrees if you're worth having in its network (your standing against theirs, your training ground, and multi-club
   owners are keener). Each window a partner offers a young player or two on loan, at a wage share it's happy with;
   in return they expect first look at your best youngsters. A partnership lapses if they're no longer above you. */
const MAX_PARTNERS = 3;
const partners = () => { const N = net(); if (!N.partners) { N.partners = N.partner ? [N.partner] : []; delete N.partner; } return N.partners; };
const isPartner = id => partners().some(x => x.id === id);
const clubWhere = x => x.abroad ? COUNTRY[x.country].name : LEAGUES[x.lg].name;
const aboveMe = (x, c = my()) => x.abroad ? x.lvl > c.lvl + 2 : x.tier < c.tier;
function partnerCands() {
  const c = my(); return G.clubs.filter(x => (!x.gone || x.abroad) && !isMine(x) && aboveMe(x, c) && !isFeeder(x.id) && !isPartner(x.id)).sort((a, b) => b.rep - a.rep);
}
function partnerChance(x) { const c = my(); return clamp(.25 + (c.rep - x.rep + 40) / 80 + (c.fac.train.lvl - 3) * .04 + (x.own && x.own.style === "multiclub" ? .2 : 0) - (x.abroad ? .05 : 0), .05, .95); }
const askedPartner = x => ((net().askedIds || {})[x.id]) === G.year;
function approachPartner(x) {
  (net().askedIds ||= {})[x.id] = G.year;
  if (R() < partnerChance(x)) { partners().push({ id: x.id, rel: 60, since: G.year }); news(`${x.name}${x.abroad ? ` (${COUNTRY[x.country].name})` : ""} agree a partnership: you're now one of their feeder clubs. Expect loan offers each window.`, true); return true; }
  news(`${x.name} turn down a partnership for now.`); return false;
}
/* Being a feeder pays: each partner pays you a yearly affiliation fee, set by your division (more from a club abroad
   or in the Premier Division, less from a club just above you), paid weekly. */
const AFFIL_FEE = [0, 1.5e6, 750e3, 350e3, 150e3, 60e3, 30e3, 15e3];
// The yearly fee a partner pays: by your division and how far above you they are, then by the club itself: a bigger,
// better-known club pays more, a multi-club group or big-spending owner more again, a careful one less.
const AFFIL_STYLE = { multiclub: 1.25, sugar: 1.2, celebrity: 1.15, crypto: 1.1, gambler: 1.05, moneyball: .85, fanowned: .8, academy: .9 };
const affilFee = (x, c = my()) => Math.round(AFFIL_FEE[c.tier] * (x.abroad || x.tier === 1 ? 1.5 : x.tier <= c.tier - 3 ? 1 : .6)
  * clamp(.7 + ((x.rep || 50) - 60) / 80, .6, 1.4) * (AFFIL_STYLE[(x.own || {}).style] || 1) / 1000) * 1000;
function partnersWeek() { const c = my(), t = sum(partners(), p => CL(p.id) ? affilFee(CL(p.id), c) : 0); if (t) earn("network", t / 52); }
function endPartner(id) { net().partners = partners().filter(x => x.id !== id); news(`The partnership with ${CL(id).name} ends.`); }
function partnerWindow() {
  const c = my(), myXI = avg(pickXI(c).map(o => o.p.ovr));
  for (const pt of partners().slice()) {
    const x = CL(pt.id);
    if (!x || (x.gone && !x.abroad) || !aboveMe(x, c)) { net().partners = partners().filter(y => y !== pt); news(`The partnership with ${x ? x.name : "a partner"} lapses: they're no longer above you.`); continue; }
    const xi = new Set(pickXI(x).map(o => o.p.id));
    const cands = x.squad.map(P).filter(p => !p.acad && !p.loan && p.age <= 23 && p.ovr >= myXI - 2 && lendsTo(p, c) && !xi.has(p.id)).sort((a, b) => b.pot - a.pot).slice(0, 2);
    for (const p of cands) if (!G.inbox.some(m => m.key === "pLoan" && !m.done && m.data.pid === p.id)) {
      const T = playerLoanTerms(p, x), share = Math.max(0, Math.min(.5, T.min)); T.no = false; T.min = share;  // the offer and his card agree
      addChoice("pLoan", `${clubLabel(x)} offer ${p.name} on loan`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}, potential ${est20(potEstimate(p))}. You'd pay ${Math.round(share * 100)}% of his ${pw(p.wage)} wage (${pw(p.wage * share)}).`, ["Take him", "No thanks"], { pid: p.id, from: x.id, share }, 1);
    }
  }
}
DECIDE.pLoan = (m, i) => { const p = G.players[m.data.pid], x = CL(m.data.from); if (i === 0 && p && p.club === x.id) { loanIn(p, x, m.data.share ?? .5, "partner"); const pt = partners().find(y => y.id === x.id); if (pt) pt.rel += 3; } };

/* ---------- feeders ---------- */
function feederCands() { const c = my(); return G.clubs.filter(x => !x.gone && !isMine(x) && x.tier > c.tier && !isFeeder(x.id) && !isPartner(x.id) && (x.half === c.half || x.tier <= 5)).sort((a, b) => a.tier - b.tier || b.rep - a.rep); }
/* What a feeder wants from you each year: set by its division and its needs (a fixed ask; you pay it or don't have
   the arrangement). */
const feederRef = x => TV[x.tier] + 24 * wageBase(TIER_LVL[x.tier]) * .1;
const feederAsk = x => x.feedAsk ??= Math.round(feederRef(x) * rf(.6, 1.1) / 1000) * 1000;
function addFeeder(x) { net().feeders.push({ id: x.id, fund: feederAsk(x), rel: 55, since: G.year }); news(`${x.name} become a feeder club: ${money(feederAsk(x))} a year.`, true); }
function dropFeeder(id) { net().feeders = net().feeders.filter(f => f.id !== id); news(`${CL(id).name} are no longer a feeder club.`); }
const feederFunding = () => sum(net().feeders, f => f.fund);
/* Funding each summer: the feeder recruits to a higher standard and improves its facilities; the relationship grows. */
function feedersSummer() {
  const c = my();
  for (const f of net().feeders.slice()) {
    const x = CL(f.id); if (!x || x.gone || x.tier <= c.tier) { news(`${x ? x.name : "A feeder"} can no longer be a feeder club.`); dropFeeder(f.id); continue; }
    f.fund = feederAsk(x); const ref = feederRef(x), k = clamp(f.fund / ref, 0, 3);
    x.lvl += k * 1.5; if (R() < k * .3) x.train = Math.min(10, x.train + 1); if (R() < k * .25) x.acadLvl = Math.min(10, x.acadLvl + 1);
    f.rel = clamp(f.rel + (k - .5) * 10, 0, 100);
    // First refusal on their best youngster.
    const y = x.squad.map(P).filter(p => p.age <= 21 && !p.loan).sort((a, b) => b.pot - a.pot)[0];
    if (y && y.pot >= TIER_LVL[c.tier] - 2) { const fee = Math.round(valueOf(y) * (1 - f.rel / 250) / 1000) * 1000;
      addChoice("fFirst", `First refusal: ${y.name} from ${x.name}`, `${POS_NAME[y.pos]}, ${y.age}, rated ${r20(y.ovr)}, potential ${est20(potEstimate(y))}. Yours for ${money(fee)}, below his value, before anyone else hears about him.`, ["Sign him", "Pass"], { pid: y.id, fee, from: x.id }, 1); }
  }
}
DECIDE.fFirst = (m, i) => { const p = G.players[m.data.pid]; if (i !== 0 || !p || p.club !== m.data.from) return; signPlayer(p, m.data.fee, Math.max(p.wage, demandWage(p, my())), false, "first refusal"); };
// What's spent on feeders each week.
function feedersWeek() { if (net().feeders.length) spend("feeders", feederFunding() / 52); partnersWeek(); }

/* ---------- your loan list ----------
   Make a player available for loan and clubs at his level come in during a window: a club where he'd play (its
   standard close to his), English or abroad, offering to pay a share of his wages (more for a better player, more from
   a richer club). Offers wait in your inbox; one at a time for each player. */
function loanListToggle(p) { p.loanList = !p.loanList; news(p.loanList ? `${p.name} is available for loan. Clubs will make offers ${my().tier >= 5 ? "(non-league loans run all season)" : "while a window is open"}.` : `${p.name} is no longer available for loan.`); }
function loanOffersWeek(c) {
  for (const p of c.squad.map(P)) {
    if (!p.loanList || p.loan || p.acad || G.inbox.some(m => m.key === "loanOffer" && !m.done && m.data.pid === p.id)) continue;
    if (R() > .45) continue;
    // A player below every club's standard still finds a taker among the weakest clubs, as a squad player.
    const floor = Math.min(...G.clubs.filter(x => !x.gone && !isMine(x)).map(x => x.lvl)), hi = Math.max(p.ovr + 6, floor + 3);
    const want = G.clubs.filter(x => (!x.gone || x.abroad) && !isMine(x) && x.lvl >= p.ovr - 8 && x.lvl <= hi && (x.abroad ? p.age <= 25 || R() < .3 : true));
    if (!want.length) continue;
    const x = pick(want), share = clamp(Math.round((.4 + (p.ovr - x.lvl + 4) * .05 + (x.abroad || x.tier <= 2 ? .2 : 0) + rf(-.1, .15)) * 10) / 10, .2, 1);
    addChoice("loanOffer", `${clubLabel(x)} want ${p.name} on loan`, `${x.abroad ? "A club abroad" : LEAGUES[x.lg].name}, standard about ${r20(x.lvl)}: he'd be playing at his level (rated ${r20(p.ovr)}). They'd take him to the end of the season and pay ${Math.round(share * 100)}% of his ${pw(p.wage)} wage; you'd pay ${pw(p.wage * (1 - share))}.`, ["Loan him", "No thanks"], { pid: p.id, club: x.id, share }, 1);
  }
}
DECIDE.loanOffer = (m, i) => { const p = G.players[m.data.pid], x = CL(m.data.club); if (i !== 0 || !p || p.club !== G.club || p.loan || !x) return; loanOut(p, x, m.data.share); };

/* Recalling a player you've lent out: he comes straight back. The borrowing club is owed a month of his wages for the
   trouble (and a feeder or partner minds a little). If your 25-man list is full he can't play until you register him. */
const recallFee = p => Math.round(p.wage * 4 / 52 / 100) * 100;
function recallLoan(p) {
  const c = my(), at = CL(p.club); if (!p.loan || p.loan.from !== c.id) return;
  const fee = recallFee(p); if (fee) spend("wages", fee);
  logMove("loanback", p, { club: at ? at.name : "", by: "you" });
  if (at) at.squad = at.squad.filter(id => id !== p.id);
  c.squad.push(p.id); p.club = c.id; p.loan = null; G.loanList = (G.loanList || []).filter(id => id !== p.id);
  const f = net().feeders.find(f => at && f.id === at.id); if (f) f.rel = Math.max(0, f.rel - 3);
  registerNew(p, c);
  news(`You recall ${p.name} from his loan at ${at ? at.name : "his loan club"}${fee ? ` (${money(fee)} to them for the trouble)` : ""}.`, true);
}
