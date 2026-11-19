/* Transfers. Your head of recruitment signs and sells players inside the budgets you set, following his own
   philosophy. You can overrule him (buy someone yourself, sell or release a player, answer a bid against his
   advice), but he and the manager notice. */
"use strict";

/* What a player wants to join you: his rating's going rate, more to drop down divisions. */
function demandWage(p, c) {
  const from = p.club >= 0 ? CL(p.club).tier : p.club === -2 ? Math.max(1, Math.min(7, Math.round((90 - p.ovr) / 6))) : 7;
  // Dropping divisions is weighed as prestige in appeal.js; this is just his going rate.
  return Math.round((c ? wageAt(p.ovr, c.tier) : wageFor(p.ovr)) * (p.club === -2 ? 1.15 : 1) * (c ? wageMult(p, c) : 1) / 100) * 100;  // his values: greed, home
}
// Will he come at all? Players rarely drop more than two divisions.
/* Would he even consider a club in this division? Every player has a natural level: the division whose typical starter
   is nearest his rating. He'll drop one division below it (two once he's 31 and winding down), but no further,
   whatever the money. Free agents included. */
const naturalTier = p => { let best = 7; for (let t = 1; t <= 7; t++) if (Math.abs(TIER_LVL[t] - p.ovr) < Math.abs(TIER_LVL[best] - p.ovr)) best = t; return best; };
/* How far down he'll go: one division (two once he's 31), less the further he stands above his own division's average
   starter. A 15 or better won't leave the Premier until he's 31, and a 16 or better won't drop at all. */
const joinRoom = p => { const t = naturalTier(p), over = Math.max(0, p.ovr - TIER_XI[t]); return Math.max(0, (p.age >= 31 ? 2 : 1) - Math.floor(over / 3)); };
const willJoin = (p, c) => c.abroad || c.tier - naturalTier(p) <= joinRoom(p);
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
    const depth = senior.filter(p => p.pos === pos && !(p.inj > 4) && !p.list).length, want = pos === "GK" ? 2 : Math.max(2, n * 2);
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
    const age = ri(18, 31), ovr = clamp(Math.round(level + normal() * 7), 8, 90);
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
  const full = regList(c).length >= REG_MAX;  // a full 25-man list: only under-21s could play
  const ok = pool.filter(q => { if ((full && !regExempt(q)) || !willJoin(q, c) || q.age > 34 || negotiated(askingFee(q)) > left || demandWage(q, c) * .85 > wageRoom) return false; q._ask = playerAsk(q, c); return q._ask != null && q._ask <= wageRoom; });
  return ok.map(q => ({ p: q, sc: scoutScore(q, need, c, phil) })).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, max);
}

/* ---------- signing ---------- */
/* ---------- your club's transfer activity ----------
   Every move in and out of your club, kept for the Activity page: who, when, from or to whom, the fee, the wage, and
   who did the deal. */
function logMove(kind, p, o = {}) {
  (G.tlog ||= []).unshift({ y: G.year, ph: G.phase, w: G.week, kind, id: p.id, name: p.name, pos: p.pos, age: p.age, r: r20(p.ovr), ...o });
  if (G.tlog.length > 800) G.tlog.length = 800;
}
function signPlayer(p, fee, wage, byOwner, how) {
  const c = my(), seller = p.club >= 0 ? CL(p.club) : null;
  logMove("in", p, { club: fromName(p), fee, wage, by: byOwner ? "you" : how || "recruit" });
  if (p.club === -2) G.abroad = G.abroad.filter(id => id !== p.id);
  p.abroad = undefined;
  moveTo(p, c); p.wage = wage; p.yrs = p.age >= 31 ? ri(1, 2) : ri(2, 4); registerNew(p, c);
  signingBoost(p, c);
  spend("buys", fee); if (!byOwner) c.spentT += fee;
  if (seller && !seller.gone) aiSquadCheck(seller, true);
  news(`${byOwner ? "You sign" : `${staffOf("recruit") ? staffOf("recruit").name + " signs" : "The club signs"}`} ${p.name} (${p.pos}, ${p.age}, rated ${r20(p.ovr)}) from ${seller ? seller.name : p.nat !== "ENG" ? "abroad" : "free agency"}${fee ? " for " + money(fee) : " on a free"}, on ${pw(wage)}.`, true);
}
/* Position cover: two keepers, and for every outfield position in the manager's formation one more than it has places.
   Your staff never list, sell or release a player if that would leave his position short (long injuries don't count
   as cover). */
function coverNeed(c, pos) { const n = FORMS[mgr().form || "4-4-2"].filter(s => s === pos).length; return pos === "GK" ? 2 : n ? n + 1 : 0; }
function coverOK(c, p) {
  const left = c.squad.map(P).filter(q => q !== p && q.pos === p.pos && !q.acad && !q.list && !(q.inj > 4) && !(q.loan && q.loan.from === c.id)).length;
  return left >= coverNeed(c, p.pos);
}
function headWeek(c) {
  const s = staffOf("recruit");
  if (!s) return;
  let signed = 0;
  const lim = G.phase === "summer" ? (c.squad.filter(id => !P(id).acad).length < 18 ? 4 : 2) : 1;
  // Your suggestions come first, and don't count against his own list (he'll still only take ones he agrees with).
  for (const x of sugg().slice()) {
    const p = G.players[x.id];
    if (!p || p.club === c.id) { G.sugg = sugg().filter(y => y !== x); continue; }
    const v = suggView(p, c, x.loan); if (!v.ok) continue;
    if (x.loan) loanIn(p, CL(p.club), v.share, "suggestion");
    else { const fromClub = fromName(p); signPlayer(p, v.fee, v.ask, false, "suggestion"); news(`${s.name} negotiated the deal for ${p.name}: ${v.N.ask ? (v.fee < v.N.ask ? `${fromClub} asked ${money(v.N.ask)}, ${pr(s, "he")} paid ${money(v.fee)}` : `${fromClub} wouldn't move from ${money(v.N.ask)}`) : "a free transfer"}; the agent wanted ${pw(v.N.agent)}, ${pr(s, "he")} agreed ${pw(v.ask)}.`); }
    G.sugg = sugg().filter(y => y !== x);
    news(`${p.name} was your suggestion: ${s.name} thanks you for the tip.`); trust("recruit", 2, null);
  }
  for (const need of squadNeeds(c)) {
    if (signed >= lim) break;
    const best = shortlist(c, need, 1)[0]; if (!best) continue;
    signPlayer(best.p, negotiated(askingFee(best.p)), best.p._ask, false); signed++;
  }
  // Too many seniors: he transfer-lists the least useful and waits for offers. Only a squad far too big at the end of
  // the window gets players released.
  const seniors = () => c.squad.map(P).filter(p => !p.acad && !p.loan);
  const xi = new Set(pickXI(c).map(o => o.p.id)), spare = seniors().filter(q => !xi.has(q.id) && !q.keep && canSell(q)).sort((a, b) => a.ovr - b.ovr);
  for (const p of spare.slice(0, Math.max(0, seniors().length - 26))) if (!p.list && coverOK(c, p)) { p.list = true; news(`${s.name} transfer-lists ${p.name}.`); }

}
const lastWindowWeek = () => (G.phase === "summer" && G.week === SUMMER_WEEKS - 1) || (G.phase === "season" && G.week === JAN[JAN.length - 1]);
/* A forced sale (administration): the administrators take what a club at his level will pay. */
function sellToAI(p, byOwner, fee) {
  const c = my(), buyer = G.clubs.filter(x => !x.gone && !isMine(x) && Math.abs(x.lvl - p.ovr) < 6).sort(() => R() - .5)[0];
  if (!buyer) return release(p, byOwner);
  fee = fee ?? Math.round(valueOf(p) * rf(.75, 1.05) / 1000) * 1000;
  logMove("out", p, { club: buyer.name, fee, wage: p.wage, by: byOwner ? "you" : "administrators" });
  moveTo(p, buyer); p.wage = aiWage(p, buyer); earn("sales", fee);
  news(`${p.name} is sold to ${buyer.name} for ${money(fee)}${byOwner ? " (your decision)" : ""}.`, true);
  return buyer;
}
const releaseCost = p => Math.round(p.wage * Math.max(1, p.yrs) * .5);
function release(p, byOwner) {
  if (p.club === G.club) logMove("release", p, { fee: releaseCost(p), wage: p.wage, by: byOwner ? "you" : "recruit" });
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
    if (p.nfs) {
      // Not for sale: only a star for your division or a player coming off a big season draws bids, and they have to
      // blow you away: two to five times his value (more after a huge season).
      if (p.age > 33) continue;
      const star = starAtLevel(p, c), form = Math.max(0, seasonForm(p));
      if (!star && form < .5) continue;
      if (R() > (star ? .03 : 0) + form * .05) continue;
      const want = bidders().filter(x => x.lvl >= p.ovr - 4 && (x.tier < c.tier || x.abroad || (x.tier === c.tier && x.rep > c.rep + 5)));
      if (!want.length) continue;
      buyer = wpick(want, x => bidWeight(x, p, c)); amt = feeRound(valueOf(p) * rf(2, 5) * (1 + form * .1));
      addMsg({ type: "bid", keen: buyer.tier < c.tier || buyer.rep > c.rep + 8 || buyer.abroad, nfs: true, pid: p.id, club: buyer.id, amt, rec: headAdvice(p, amt), title: `${clubLabel(buyer)} bid ${money(amt)} for ${p.name}, though he's not for sale` });
      continue;
    }
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
  if (p.keep || p.nfs) return "reject";  // your call: he isn't for sale (you can still accept it yourself)
  if (my().squad.filter(id => !P(id).acad).length <= 16) return "reject";  // the squad is too thin to sell
  if (!coverOK(my(), p)) return "reject";  // it would leave his position short
  if (p.list) return amt >= v * (s && s.phil === "value" ? .75 : .6) ? "accept" : "reject";  // he wants him gone, at a fair price
  if (!s) return amt >= v * 1.4 ? "accept" : "reject";
  const r = { value: amt >= v * 1.15, potential: p.age >= 24 ? amt >= v : amt >= v * 1.6, proven: starter ? amt >= v * 1.8 : amt >= v, fit: amt >= v * 1.3 }[s.phil];
  return r ? "accept" : "reject";
}
/* The improved contract that keeps a wanted player happy: about 30% more, for three or four years. */
const newDealWage = p => Math.round(Math.max(p.wage * 1.3, demandWage(p, my()) * 1.15) / 100) * 100;
function newDeal(p) {
  const w = newDealWage(p); p.wage = w; p.yrs = ri(3, 4); p.unsettled = 0; p.blocked = 0; p.payGrudge = 0; p.dealY = G.year;
  news(`${p.name} signs an improved ${p.yrs}-year contract: ${pw(w)}. He's happy to stay.`, true);
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
    // Answering a bid is your call: he only minds much when it's a big one (selling a first-choice player he wanted to
    // keep, or turning down well over the odds). Small disagreements barely register.
    const big = accept ? pickXI(my()).some(o => o.p === p) : m.amt >= valueOf(p) * 1.5;
    G.meddle = (G.meddle || 0) + (big ? .3 : .1);
    meddled("recruit", big ? -3 : -1, big ? (accept ? `would rather have kept ${p.name}.` : `thinks ${money(m.amt)} for ${p.name} was worth taking.`) : null);
  }
  if (accept) {
    if (!auto && maybeWar(m, p, buyer)) return;  // word gets out and other clubs come in
    completeSale(p, buyer, m.amt, auto);
  } else if (auto) news(`A ${money(m.amt)} bid from ${buyer.name} for ${p.name} is turned down.`);
}
function completeSale(p, buyer, amt, auto) {
  if (!auto && pickXI(my()).some(o => o.p === p)) meddled("manager", -6, `didn't want to lose ${p.name}.`);
  logMove("out", p, { club: clubLabel(buyer), fee: amt, wage: p.wage, by: auto ? "recruit" : "you" });
  leaveClub(p); moveTo(p, buyer); p.wage = aiWage(p, buyer); earn("sales", amt);
  news(`${p.name} joins ${clubLabel(buyer)} for ${money(amt)}${auto ? ` (${staffOf("recruit") ? staffOf("recruit").name : "the club"} accepted)` : ""}.`, true);
}

/* ---------- negotiating a bid ----------
   Each bidder has a most it will pay (hidden): well above its opening bid for a player it really wants, not much above
   it for a listed one. Counter at or under that and they agree. A little over it and they come back with an improved
   offer; too far over, or a third time, and they may walk away. */
// Rounding a fee to a sensible step for its size, so small fees still have room to negotiate.
const feeRound = v => { const st = v < 10e3 ? 100 : v < 100e3 ? 500 : v < 1e6 ? 5000 : 50000; return Math.round(v / st) * st; };
function bidMax(m) {
  const p = G.players[m.pid];
  return m.max ??= Math.max(m.amt, feeRound(m.amt * (p && p.list ? rf(1.04, 1.25) : rf(1.1, 1.5)) * (1 + Math.max(0, seasonForm(p || {})) * .1)));
}
function counterBid(m, ask) {
  const p = G.players[m.pid], buyer = CL(m.club), max = bidMax(m);
  if (!p || p.club !== G.club || m.done) return "That bid has lapsed.";
  if (ask <= m.amt) { answerBid(m, true, false); return null; }
  m.tries = (m.tries || 0) + 1; m.age = 0;
  if (ask <= max) { m.amt = ask; m.title = `${clubLabel(buyer)} agree ${money(ask)} for ${p.name}`; answerBid(m, true, false); return `${buyer.name} agree to ${money(ask)}.`; }
  if (m.tries >= 3 || ask > max * 1.35 || (ask > max * 1.15 && R() < .4)) {
    m.done = true; m.answer = `you asked ${money(ask)}; they walked away`;
    news(`${buyer.name} walk away from talks for ${p.name}: ${money(ask)} was too much.`);
    return `${buyer.name} walk away: ${money(ask)} was too much.`;
  }
  let up = Math.min(max, feeRound((m.amt + max) / 2)); if (up <= m.amt) up = max;
  m.amt = up; m.final = up >= max; m.title = `${clubLabel(buyer)} improve their bid to ${money(up)} for ${p.name}${m.final ? " (final offer)" : ""}`;
  return `${buyer.name} won't pay ${money(ask)}, but they've improved their offer to ${money(up)}${m.final ? ". They say it's their final offer" : ""}.`;
}

/* ---------- bidding wars ----------
   Accept a bid and word gets out: for a player in demand (a star, one coming off a fine season, one you're selling
   below his value) other clubs may come in before the deal is done. You can take the best offer, ask everyone for
   their best and final bids once, or call it off and keep him. Left alone, he goes to the highest bidder. */
function maybeWar(m, p, buyer) {
  const c = my(), star = p.ovr >= TIER_LVL[c.tier] + 5 || (p.age <= 21 && p.pot >= TIER_LVL[c.tier] + 10), form = Math.max(0, seasonForm(p));
  const chance = clamp(.12 + (star ? .25 : 0) + form * .15 + (valueOf(p) > m.amt ? .1 : 0), 0, .6);
  if (R() > chance) return false;
  const rivals = shuffle(bidders().filter(x => x.id !== buyer.id && x.lvl >= p.ovr - 4 && x.lvl <= p.ovr + 8)).slice(0, R() < .4 ? 2 : 1);
  if (!rivals.length) return false;
  const bids = [{ id: buyer.id, amt: m.amt, max: bidMax(m) }, ...rivals.map(x => { const amt = feeRound(m.amt * rf(1.04, 1.2)); return { id: x.id, amt, max: feeRound(amt * rf(1.03, 1.35)) }; })];
  m.answer = "accepted: then other clubs came in";
  addMsg({ type: "war", pid: p.id, bids, keen: m.keen, rec: m.rec, title: `Bidding war for ${p.name}!` });
  news(`Word gets out that you've accepted ${money(m.amt)} for ${p.name}: ${rivals.map(x => clubLabel(x)).join(" and ")} come in with higher offers.`, true);
  return true;
}
const warTop = w => w.bids.filter(b => !b.out).sort((a, b) => b.amt - a.amt)[0];
function warRaise(w) {
  const top = warTop(w).amt;
  for (const b of w.bids) if (!b.out) { if (b.amt >= top && b === warTop(w)) continue; if (b.max > top) b.amt = Math.min(b.max, Math.max(top + 100, feeRound(top * rf(1.03, 1.12)))); else b.out = true; }
  // The leader may stretch once more if someone has passed him.
  const t = warTop(w); for (const b of w.bids) if (!b.out && b !== t && b.max > t.amt && R() < .5) b.amt = Math.min(b.max, Math.max(t.amt + 100, feeRound(t.amt * rf(1.02, 1.08))));
  w.final = true; w.age = 0;
  const p = G.players[w.pid], T = warTop(w);
  news(`Best and final offers for ${p.name}: ${w.bids.map(b => `${CL(b.id).name} ${b.out ? "drop out" : money(b.amt)}`).join(", ")}.`);
  return T;
}
function warSell(w, auto) {
  const p = G.players[w.pid], T = warTop(w); w.done = true;
  if (!p || p.club !== G.club) { w.answer = "lapsed"; return; }
  w.answer = `sold to ${CL(T.id).name} for ${money(T.amt)}`;
  completeSale(p, CL(T.id), T.amt, auto);
}
function warKeep(w) {
  const p = G.players[w.pid]; w.done = true; w.answer = "you kept him";
  if (!p || p.club !== G.club) return;
  if (w.keen && p.dealY !== G.year) { p.blocked = (p.blocked || 0) + 1; p.unsettled = 8 + p.blocked * 4; news(`${p.name} had clubs fighting over him and you kept him: he's unsettled.`, true); }
  else news(`You call off the sale: ${p.name} stays.`);
  G.meddle = (G.meddle || 0) + .5;
}

/* ---------- your suggestions ----------
   Point your head of recruitment at a player. He sizes him up the way he does his own targets and tells you what he
   thinks; while a window is open he goes after the ones he agrees with before his own list. Asking isn't overruling:
   he doesn't mind being asked, and he's pleased when a tip comes off. */
const sugg = () => (G.sugg ||= []);
const suggested = (p, loan) => sugg().find(x => x.id === p.id && (loan == null || !!x.loan === !!loan));
function suggView(p, c = my(), loan = false) {
  const s = staffOf("recruit");
  if (!s) return { ok: false, w: "There's no head of recruitment to ask." };
  if (p.club === c.id) return { ok: false, w: "He's ours." };
  if (loan) {
    if (!loanable(p)) return { ok: false, w: "Not a loan: clubs only lend players 23 or under." };
    if (!lendsTo(p, c)) return { ok: false, w: `${CL(p.club).name} won't lend him this far down: he's a ${TIER_NAME[naturalTier(p)]} player and they want him playing at that level.` };
    if (inTheirXI(p)) return { ok: false, w: "He's in their first team: they won't lend him." };
    if (windowOpen() && playerLoanTerms(p).no) return { ok: false, w: `${CL(p.club).name} won't lend him this window.` };
  } else {
    if (p.age > 34) return { ok: false, w: "Too old to sign: he'd be gone within a season." };
    if (!willJoin(p, c)) return { ok: false, w: "He wouldn't come here: he's too good for our level." };
  }
  const [o1, o2] = ovrEstimate(p), eo = (o1 + o2) / 2, [p1, p2] = potEstimate(p), ep = (p1 + p2) / 2, T = TIER_LVL[c.tier];
  const st = pickXI(c).filter(o => o.slot === p.pos).map(o => roleRating(o.p, p.pos)), weakest = st.length ? Math.min(...st) : 0;
  const depth = c.squad.map(P).filter(q => q.pos === p.pos && !q.acad && !q.list && !(q.inj > 4)).length;
  const starter = eo >= weakest + (s.phil === "proven" ? 1 : 0) && eo >= T - 10;
  const cover = depth <= coverNeed(c, p.pos) && eo >= T - 8;
  const prospect = p.age <= 21 && ep >= T + (s.phil === "potential" ? 3 : 7);
  if (!starter && !cover && !prospect) return { ok: false, w: st.length ? `He wouldn't improve us: I have him at about ${r20(eo)}, and our weakest starter there is ${r20(weakest)}.` : `He isn't good enough for this level.` };
  if (!regExempt(p) && regList(c).length >= REG_MAX) return { ok: false, w: "I'd take him, but the 25-man list is full: he couldn't play. Unregister someone in a window first." };
  const what = starter ? "He'd go straight into the side" : prospect ? "A real prospect" : "Good cover";
  if (loan) {
    // He pays what the lending club has in mind, less a little if he's a good negotiator; outside a window he can only guess.
    const room = c.budget.wages - wageBill(c);
    if (!windowOpen()) return p.wage * .5 > room ? { ok: false, money: true, w: `A loan would cost about ${pw(p.wage * .5)} and the wage budget only has ${pw(Math.max(0, room))} to spare.` } : { ok: false, wait: true, w: `${what} on loan. I'll ask about him when the window opens.` };
    const T = playerLoanTerms(p), share = Math.max(0, Math.round((T.min - (s.at.neg >= 65 ? .1 : 0)) * 10) / 10);
    if (p.wage * share > room) return { ok: false, money: true, w: `They want us to pay ${Math.round(T.min * 100)}% of his wages (${pw(p.wage * T.min)}), and the wage budget only has ${pw(Math.max(0, room))} to spare.` };
    return { ok: true, loan: true, share, w: `${what} on loan. ${share < T.min ? `They want us to pay ${Math.round(T.min * 100)}% of his wages; I can talk them down to ${Math.round(share * 100)}%` : `They want us to pay ${Math.round(share * 100)}% of his wages`} (${pw(p.wage * share)}). I'll borrow him this week.` };
  }
  const N = negotiate(p, c);
  if (!N) return { ok: false, w: "He isn't interested in joining us." };
  const fee = N.fee, ask = N.wage, left = c.budget.transfer - c.spentT, room = c.budget.wages - wageBill(c);
  const deal = `${N.ask ? (fee < N.ask ? `They want ${money(N.ask)}; I can get him for about ${money(fee)}` : `They want ${money(N.ask)} and I don't think they'll take less`) : "He's a free agent"}, on ${pw(ask)} (his agent's asking ${pw(N.agent)})`;
  if (fee > left) return { ok: false, money: true, w: `I'd take him, but even talked down to about ${money(fee)} his fee is more than the ${money(Math.max(0, left))} left in the transfer budget.` };
  if (ask > room) return { ok: false, money: true, w: `I'd take him, but even talked down to ${pw(ask)} his wages are more than the ${pw(Math.max(0, room))} the wage budget has to spare.` };
  return { ok: true, fee, ask, N, w: `${what}. ${deal}. ${windowOpen() ? "I'll go after him this week." : "I'll go after him when the window opens."}` };
}
/* His negotiation on a deal you suggested. The fee: he talks the asking price down, more the better a negotiator he is
   and the weaker the seller's hand (a listed player, one with a year or less left, one who's asked to leave); a little
   luck either way. The wage: the agent opens a quarter above the least the player would take, and he talks it down
   toward that floor. Settled once per window, so the figures don't jump about each time you look. */
function negotiate(p, c = my()) {
  const s = staffOf("recruit"), neg = s ? s.at.neg : 30, min = playerAsk(p, c); if (min == null) return null;
  const w = windowId(); if (!p.ng || p.ng.w !== w) p.ng = { w, n: normal(), m: normal() };
  const lever = (neg - 50) / 250 + (p.list ? .08 : 0) + (p.club >= 0 && p.yrs <= 1 ? .1 : 0) + (p.req ? .08 : 0);
  const ask = askingFee(p), fee = Math.round(ask * clamp(1 - lever + p.ng.n * .03, .55, 1) / 1000) * 1000;
  const agent = Math.round(min * 1.25 / 100) * 100, wage = Math.round((min + (agent - min) * clamp(1 - neg / 100 + p.ng.m * .1, 0, 1)) / 100) * 100;
  return { ask, fee, agent, wage };
}
function suggest(p, loan) {
  const s = staffOf("recruit"); if (!s) return;
  if (suggested(p, loan)) { G.sugg = sugg().filter(x => x.id !== p.id); return news(`You withdraw your suggestion of ${p.name}.`); }
  G.sugg = sugg().filter(x => x.id !== p.id);  // a player is suggested as a signing or a loan, not both
  sugg().push({ id: p.id, y: G.year, w: G.week, loan: !!loan });
  news(`You suggest ${loan ? "borrowing" : "signing"} ${p.name} to ${s.name}: "${suggView(p, my(), loan).w}"`);
}

/* ---------- you, overruling your staff ---------- */
function ownerBuy(p, fee, wage) {
  G.meddle = (G.meddle || 0) + 1;
  const c = my(), onList = shortlist(c, { pos: p.pos, kind: "depth", weakest: 0 }, 8).some(x => x.p === p);
  signPlayer(p, fee, wage, true); G.sugg = sugg().filter(x => x.id !== p.id);
  if (staffOf("recruit")) meddled("recruit", onList ? -3 : -10, onList ? `would rather have done the deal ${pr(staffOf("recruit"), "himself")}.` : `wasn't consulted about ${p.name} and isn't happy.`);
  const xi = pickXI(c); if (xi.some(o => o.p === p)) trust("manager", 3, null); else meddled("manager", -3, null);
}
/* You put a player on the transfer list (or take him off). Offers then come in through the inbox. */
/* A star for the division: rating at the top of the division's range (shown about: Regional League and National
   North/South 4+, National Division 5+, Third 7+, Second 8+, First 11+, Premier 16+), or a teenager with that kind of potential. */
// (Held as underlying ratings so a change to the shown 1-20 scale doesn't move them.)
const STAR_RAW = [0, 86.9, 74, 67.8, 65.6, 57.1, 44.6, 44.6], STAR_POT = [0, 101, 80.6, 74, 72, 67.8, 62.1, 62.1];
const starAtLevel = (p, c = my()) => p.ovr >= STAR_RAW[c.tier] || (p.age <= 21 && p.pot >= STAR_POT[c.tier]);
// Would being kept off the market rankle? He's well above the division, or paid well below his worth.
const nfsGrudge = (p, c) => p.age <= 31 && (p.ovr - TIER_LVL[c.tier] >= 6 || p.wage < wageAt(p.ovr, c.tier) * .8);
/* Not for sale: you tell the world he isn't available. Nobody bids for him, open bids are turned down, and your staff
   never list him. A player who wanted the move he's now been denied may be unsettled. */
function setNotForSale(p, on) {
  p.nfs = on; if (!on) return news(`${p.name} is available again: clubs can bid for him.`);
  p.list = false;
  for (const m of G.inbox.filter(m => m.type === "bid" && !m.done && m.pid === p.id)) { m.done = true; m.answer = "rejected: not for sale"; }
  news(`You declare ${p.name} not for sale. Clubs are told only a huge offer will do.`);
  // A player who has outgrown the club, or is paid well under his worth, doesn't like being told he can't leave.
  if (nfsGrudge(p, my())) { p.unsettled = Math.max(p.unsettled || 0, 4); news(`${p.name} isn't happy about being made not for sale: he thinks he deserves ${p.wage < wageAt(p.ovr, my().tier) * .8 ? "more money" : "a bigger club"}.`, true); }
}
function ownerList(p) {
  p.list = !p.list; if (p.list) p.nfs = false;
  if (!p.list) return news(`${p.name} is taken off the transfer list.`);
  G.meddle = (G.meddle || 0) + .5;
  const starter = pickXI(my()).some(o => o.p === p);
  if (staffOf("recruit")) meddled("recruit", -3, null);
  if (starter) meddled("manager", -6, `is unhappy you've transfer-listed ${p.name}, one of ${pr(staffOf("manager"), "his")} first-choice players.`);
  news(`You put ${p.name} on the transfer list. Offers will come in while the window is open.`);
}
function ownerRelease(p) {
  G.meddle = (G.meddle || 0) + .5;
  const starter = pickXI(my()).some(o => o.p === p);
  release(p, true);
  if (starter) meddled("manager", -8, `is angry you released ${p.name}.`);
}

/* ---------- each week of a window ---------- */
function marketWeek() {
  const c = my();
  headWeek(c); bidsWeek(c); loanOffersWeek(c);
  for (const x of G.clubs) if (!x.gone && !isMine(x) && R() < .25) aiSquadCheck(x, true);
  foreignJanuary();  // foreign clubs look at the free agents every week of a window, as English clubs do
  const last = (G.phase === "summer" && G.week === SUMMER_WEEKS - 1) || (G.phase === "season" && G.week === JAN[JAN.length - 1]);
  if (last) { clearAbroad(); autoRegister(c); news("The transfer window has closed."); }
}
