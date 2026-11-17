/* Transfers. Your head of recruitment signs and sells players inside the budgets you set, following his own
   philosophy. You can overrule him (buy someone yourself, sell or release a player, answer a bid against his
   advice), but he and the manager notice. */
"use strict";

/* What a player wants to join you: his rating's going rate, more to drop down divisions. */
function demandWage(p, c) {
  const from = p.club >= 0 ? CL(p.club).tier : p.club === -2 ? Math.max(1, Math.min(7, Math.round((90 - p.ovr) / 6))) : 7;
  // Dropping divisions is weighed as prestige in appeal.js; this is just his going rate.
  return Math.round(wageFor(p.ovr) * (p.club === -2 ? 1.15 : 1) / 100) * 100;
}
// Will he come at all? Players rarely drop more than two divisions.
const willJoin = (p, c) => p.club < 0 && p.club !== -2 ? true : c.tier - (p.club >= 0 ? CL(p.club).tier : 1) <= 3 || p.age >= 32;
// xi: optional cache (club id -> Set of first-choice player ids) for pricing many players at once.
function askingFee(p, xi) {
  if (p.club === -1) return 0;
  let f = valueOf(p) * 1.15;
  if (p.club >= 0) {
    const c = CL(p.club), starters = xi ? (xi[c.id] ||= new Set(pickXI(c).map(o => o.p.id))) : null;
    if (starters ? starters.has(p.id) : pickXI(c).some(o => o.p === p)) f *= 1.3;
    if (p.list) f *= .8;
  }
  return Math.round(f / 1000) * 1000;
}
const negotiated = fee => Math.round(fee * (1.08 - staffAttr("recruit", "neg", 30) / 300) / 1000) * 1000;

/* ---------- what the squad needs (judged on the manager's formation) ---------- */
function squadNeeds(c) {
  const slots = FORMS[mgr().form || "4-4-2"], xi = pickXI(c), out = [];
  const senior = c.squad.map(P).filter(p => !p.acad || p.age >= 18);
  for (const pos of POS) {
    const n = slots.filter(s => s === pos).length; if (!n && pos !== "GK") continue;
    const depth = senior.filter(p => p.pos === pos).length, want = pos === "GK" ? 2 : Math.max(2, n * 2);
    const starters = xi.filter(o => o.slot === pos).map(o => roleRating(o.p, pos)), weakest = starters.length ? Math.min(...starters) : 0;
    if (depth < want) out.push({ pos, kind: "depth", weakest, short: want - depth });
    else if (weakest < TIER_LVL[c.tier] + 2) out.push({ pos, kind: "upgrade", weakest });
  }
  return out.sort((a, b) => (a.kind === "depth" ? 0 : 1) - (b.kind === "depth" ? 0 : 1) || a.weakest - b.weakest);
}

/* ---------- the pool he searches ----------
   English clubs and free agents; with a European or worldwide brief, players abroad too (made on demand: they
   live outside the simulated leagues and are cleared when the window shuts). */
function abroadPool(level) {
  const s = staffOf("recruit"); if (!s || s.focus === "domestic") return [];
  G.abroad = (G.abroad || []).filter(id => G.players[id]);
  const want = s.focus === "world" ? 40 : 22;
  while (G.abroad.length < want) {
    const age = ri(18, 31), ovr = clamp(Math.round(level + normal() * 7), 25, 90);
    const p = makePlayer({ pos: pick(POS), ovr, age, nat: s.focus === "world" ? pickNat("ENG") : pick(["ESP", "GER", "ITA", "FRA", "POR", "NED", "BEL", "DEN", "CRO"]), pot: seniorPot(ovr, age) });
    p.club = -2; p.abroad = s.focus; G.abroad.push(p.id);
  }
  return G.abroad.map(P);
}
function clearAbroad() { for (const id of G.abroad || []) { const p = G.players[id]; if (p && p.club === -2) delete G.players[id]; } G.abroad = []; }
const fromName = p => p.club >= 0 ? CL(p.club).name : p.club === -2 ? `a club in ${NAT_NAME[p.nat] || "Europe"}` : "Free agent";

/* How the head of recruitment rates a target, on what he thinks the player is (his estimates, not the truth). */
function scoutScore(p, need, c, phil) {
  const [o1, o2] = ovrEstimate(p), [p1, p2] = potEstimate(p), eo = (o1 + o2) / 2, ep = (p1 + p2) / 2;
  const fee = negotiated(askingFee(p)), wage = p._ask || demandWage(p, c), gain = eo - need.weakest;
  if (need.kind === "upgrade" && gain < 2) return -1;
  if (need.kind === "depth" && eo < TIER_LVL[c.tier] - 9) return -1;
  switch (phil) {
    case "potential": return p.age <= 23 ? ep * 1.2 + eo * .4 - p.age : eo * .3;
    case "proven": return eo * 1.5 + (p.age >= 25 && p.age <= 31 ? 4 : -4);
    case "value": return (Math.max(1, gain + 6)) * 1e5 / (fee + wage * 2 + 20000);
    case "fit": { const k = STYLES[mgr().phil].keys; return eo + (p.pos === "GK" ? 0 : (avg(k.map(x => p.at[x])) - avg(OUT_KEYS.map(x => p.at[x]))) * .8); }
  }
  return eo;
}
function shortlist(c, need, max = 6) {
  const s = staffOf("recruit"), left = c.budget.transfer - c.spentT, wageRoom = c.budget.wages - wageBill(c);
  const reach = s ? s.at.net : 0, phil = s ? s.phil : "proven";
  // Contacts and scouting budget decide how much of the market he actually sees.
  const seeTier = c.tier - 1 - Math.floor((reach + scoutBoost() * 3) / 35);
  const pool = [];
  for (const q of Object.values(G.players)) {
    if (q.pos !== need.pos || q.club === c.id || q.acad || q.club === -2 || q.loan) continue;
    if (q.club >= 0 && (CL(q.club).tier < seeTier)) continue;
    pool.push(q);
  }
  for (const q of abroadPool(TIER_LVL[c.tier])) if (q.pos === need.pos) pool.push(q);
  const ok = pool.filter(q => { if (!willJoin(q, c) || q.age > 34 || negotiated(askingFee(q)) > left || demandWage(q, c) * .85 > wageRoom) return false; q._ask = playerAsk(q, c); return q._ask != null && q._ask <= wageRoom; });
  return ok.map(q => ({ p: q, sc: scoutScore(q, need, c, phil) })).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, max);
}

/* ---------- signing ---------- */
function signPlayer(p, fee, wage, byOwner) {
  const c = my(), seller = p.club >= 0 ? CL(p.club) : null;
  if (p.club === -2) G.abroad = G.abroad.filter(id => id !== p.id);
  p.abroad = undefined;
  moveTo(p, c); p.wage = wage; p.yrs = p.age >= 31 ? ri(1, 2) : ri(2, 4);
  signingBoost(p, c);
  spend("buys", fee); if (!byOwner) c.spentT += fee;
  if (seller && !seller.gone) aiSquadCheck(seller, true);
  news(`${byOwner ? "You sign" : `${staffOf("recruit") ? staffOf("recruit").name + " signs" : "The club signs"}`} ${p.name} (${p.pos}, ${p.age}, rated ${r20(p.ovr)}) from ${seller ? seller.name : p.nat !== "ENG" ? "abroad" : "free agency"}${fee ? " for " + money(fee) : " on a free"}, on ${money(wage)} a year.`, true);
}
function headWeek(c) {
  const s = staffOf("recruit");
  if (!s) return;
  let signed = 0;
  for (const need of squadNeeds(c)) {
    if (signed >= (G.phase === "summer" ? (c.squad.filter(id => !P(id).acad).length < 18 ? 4 : 2) : 1)) break;
    const best = shortlist(c, need, 1)[0]; if (!best) continue;
    signPlayer(best.p, negotiated(askingFee(best.p)), best.p._ask, false); signed++;
  }
  // Too many seniors: he transfer-lists the least useful and waits for offers. Only a squad far too big at the end of
  // the window gets players released.
  const seniors = () => c.squad.map(P).filter(p => !p.acad && !p.loan);
  const xi = new Set(pickXI(c).map(o => o.p.id)), spare = seniors().filter(q => !xi.has(q.id) && !q.keep && canSell(q)).sort((a, b) => a.ovr - b.ovr);
  for (const p of spare.slice(0, Math.max(0, seniors().length - 26))) if (!p.list) { p.list = true; news(`${s.name} transfer-lists ${p.name}.`); }
  if (lastWindowWeek()) for (const p of spare.filter(q => q.club === c.id).slice(0, Math.max(0, seniors().length - 28))) release(p, false);
}
const lastWindowWeek = () => (G.phase === "summer" && G.week === SUMMER_WEEKS - 1) || (G.phase === "season" && G.week === JAN[JAN.length - 1]);
/* A forced sale (administration): the administrators take what a club at his level will pay. */
function sellToAI(p, byOwner, fee) {
  const c = my(), buyer = G.clubs.filter(x => !x.gone && !isMine(x) && Math.abs(x.lvl - p.ovr) < 6).sort(() => R() - .5)[0];
  if (!buyer) return release(p, byOwner);
  fee = fee ?? Math.round(valueOf(p) * rf(.75, 1.05) / 1000) * 1000;
  moveTo(p, buyer); p.wage = wageFor(p.ovr); earn("sales", fee);
  news(`${p.name} is sold to ${buyer.name} for ${money(fee)}${byOwner ? " (your decision)" : ""}.`, true);
  return buyer;
}
const releaseCost = p => Math.round(p.wage * Math.max(1, p.yrs) * .5);
function release(p, byOwner) {
  spend("wages", releaseCost(p)); leaveClub(p); toFreeAgent(p);
  news(`${p.name} is released${releaseCost(p) ? `, with ${money(releaseCost(p))} paid up` : ""}${byOwner ? " (your decision)" : ""}.`);
}

/* Clubs that can bid: every English club still going and every foreign club. */
const bidders = () => G.clubs.filter(x => (!x.gone || x.abroad) && !isMine(x));
// Foreign clubs like bringing their own countrymen home.
const bidWeight = (x, p, c) => (1 + Math.max(0, c.tier - x.tier) * 1.5) * (x.abroad ? (x.country === p.nat ? .9 : .2) : 1);  // abroad: a minority of bids, more for their own countrymen
const clubLabel = x => x.abroad ? `${x.name} (${COUNTRY[x.country].name})` : x.name;
/* ---------- offers for your players ----------
   Real offers only, and only in a window. Clubs bid for players you've transfer-listed (usually below their value:
   everyone knows you want to sell), and the bigger clubs come in for your stars whether they're listed or not. */
function bidsWeek(c) {
  for (const p of c.squad.map(P)) {
    if (p.acad || p.loan || !canSell(p) || G.inbox.some(m => m.type === "bid" && !m.done && m.pid === p.id)) continue;
    let buyer = null, amt = 0;
    if (p.list) {
      if (R() > .35) continue;
      const want = bidders().filter(x => x.lvl >= p.ovr - 4 && x.lvl <= p.ovr + 9 && p.age <= 33);
      if (!want.length) continue;
      buyer = wpick(want, x => bidWeight(x, p, c)); amt = Math.round(valueOf(p) * rf(.5, 1.0) / 1000) * 1000;
    } else {
      // Unlisted players draw bids too: anyone who'd be a regular somewhere, more often the better he is for your
      // level, and at or above his value, since the club has to tempt you.
      if (p.age > 33) continue;
      const star = p.ovr >= TIER_LVL[c.tier] + 5 || (p.age <= 21 && p.pot >= TIER_LVL[c.tier] + 10);
      // A standout season puts him in the shop window: more bids, bigger ones, from bigger clubs.
      const form = Math.max(0, seasonForm(p));
      const chance = .025 + (star ? .1 : 0) + Math.max(0, p.ovr - TIER_LVL[c.tier]) * .006 + form * .07;
      if (R() > chance) continue;
      const h = hostileOf(c), want = bidders().filter(x => x.lvl >= p.ovr - 3 && x.lvl <= p.ovr + 7 + form * 4 && x.tier <= c.tier + 1);
      buyer = h && star && R() < .4 ? h : want.length ? wpick(want, x => bidWeight(x, p, c)) : null;
      if (!buyer) continue;
      amt = Math.round(valueOf(p) * rf(.9, 1.45) * (1 + form * .2) * (buyer.own ? 1 + OWNER_STYLES[buyer.own.style].poach * .3 : 1) / 1000) * 1000;
    }
    if (amt < 1000) amt = 1000;
    const fw = formWord(seasonForm(p)), keen = buyer.tier < c.tier || buyer.rep > c.rep + 8 || (p.list && R() < .7);
    addMsg({ type: "bid", keen, pid: p.id, club: buyer.id, amt, rec: headAdvice(p, amt), title: `${clubLabel(buyer)} bid ${money(amt)} for ${p.name}${p.list ? " (listed)" : fw ? ` after ${fw}` : ""}` });
  }
}
function headAdvice(p, amt) {
  const s = staffOf("recruit"), v = valueOf(p), starter = pickXI(my()).some(o => o.p === p);
  if (p.keep) return "reject";
  if (my().squad.filter(id => !P(id).acad).length <= 16) return "reject";  // the squad is too thin to sell
  if (p.list) return amt >= v * (s && s.phil === "value" ? .75 : .6) ? "accept" : "reject";  // he wants him gone, at a fair price
  if (!s) return amt >= v * 1.4 ? "accept" : "reject";
  const r = { value: amt >= v * 1.15, potential: p.age >= 24 ? amt >= v : amt >= v * 1.6, proven: starter ? amt >= v * 1.8 : amt >= v, fit: amt >= v * 1.3 }[s.phil];
  return r ? "accept" : "reject";
}
/* The improved contract that keeps a wanted player happy: about 30% more, for three or four years. */
const newDealWage = p => Math.round(Math.max(p.wage * 1.3, demandWage(p, my()) * 1.15) / 100) * 100;
function newDeal(p) {
  const w = newDealWage(p); p.wage = w; p.yrs = ri(3, 4); p.unsettled = 0; p.blocked = 0; p.dealY = G.year;
  news(`${p.name} signs an improved ${p.yrs}-year contract: ${money(w)} a year. He's happy to stay.`, true);
}
/* choice: true/1 accept, false/0 reject, 2 reject and offer him a new deal. */
function answerBid(m, accept, auto) {
  const deal = accept === 2; accept = accept === true || accept === 1;
  m.done = true; m.answer = accept ? "accepted" : deal ? "rejected, with a new contract" : "rejected";
  const p = G.players[m.pid], buyer = CL(m.club);
  if (!p || p.club !== G.club) { m.answer = "lapsed"; return; }
  if (!accept && m.keen && p.dealY !== G.year) {
    if (deal) newDeal(p);
    else { p.blocked = (p.blocked || 0) + 1; p.unsettled = 8 + p.blocked * 4; news(`${p.name} wanted the move to ${buyer.name} and is unsettled${p.blocked >= 2 ? ". He's been blocked before and it shows" : ""}.`, p.blocked >= 2); }
  }
  if (!auto && !deal && (accept ? "accept" : "reject") !== m.rec) {
    G.meddle = (G.meddle || 0) + 1;
    trust("recruit", -7, accept ? `unhappy you sold ${p.name} when he advised keeping him.` : `frustrated you turned down ${money(m.amt)} for ${p.name}.`);
  }
  if (accept) {
    const starter = pickXI(my()).some(o => o.p === p);
    if (starter && !auto) trust("manager", -6, `didn't want to lose ${p.name}.`);
    leaveClub(p); moveTo(p, buyer); p.wage = wageFor(p.ovr); earn("sales", m.amt);
    news(`${p.name} joins ${clubLabel(buyer)} for ${money(m.amt)}${auto ? ` (${staffOf("recruit") ? staffOf("recruit").name : "the club"} accepted)` : ""}.`, true);
  } else if (auto) news(`A ${money(m.amt)} bid from ${buyer.name} for ${p.name} is turned down.`);
}

/* ---------- you, overruling your staff ---------- */
function ownerBuy(p, fee, wage) {
  G.meddle = (G.meddle || 0) + 1;
  const c = my(), onList = shortlist(c, { pos: p.pos, kind: "depth", weakest: 0 }, 8).some(x => x.p === p);
  signPlayer(p, fee, wage, true);
  if (staffOf("recruit")) trust("recruit", onList ? -3 : -10, onList ? "would rather have done the deal himself." : `wasn't consulted about ${p.name} and isn't happy.`);
  const xi = pickXI(c); if (xi.some(o => o.p === p)) trust("manager", 3, null); else trust("manager", -3, null);
}
/* You put a player on the transfer list (or take him off). Offers then come in through the inbox. */
function ownerList(p) {
  p.list = !p.list;
  if (!p.list) return news(`${p.name} is taken off the transfer list.`);
  G.meddle = (G.meddle || 0) + .5;
  const starter = pickXI(my()).some(o => o.p === p);
  if (staffOf("recruit")) trust("recruit", -3, null);
  if (starter) trust("manager", -6, `is unhappy you've transfer-listed ${p.name}, one of his first-choice players.`);
  news(`You put ${p.name} on the transfer list. Offers will come in while the window is open.`);
}
function ownerRelease(p) {
  G.meddle = (G.meddle || 0) + .5;
  const starter = pickXI(my()).some(o => o.p === p);
  release(p, true);
  if (starter) trust("manager", -8, `is angry you released ${p.name}.`);
}

/* ---------- each week of a window ---------- */
function marketWeek() {
  const c = my();
  headWeek(c); bidsWeek(c);
  for (const x of G.clubs) if (!x.gone && !isMine(x) && R() < .25) aiSquadCheck(x, true);
  foreignJanuary();  // foreign clubs look at the free agents every week of a window, as English clubs do
  const last = (G.phase === "summer" && G.week === SUMMER_WEEKS - 1) || (G.phase === "season" && G.week === JAN[JAN.length - 1]);
  if (last) { clearAbroad(); news("The transfer window has closed."); }
}
