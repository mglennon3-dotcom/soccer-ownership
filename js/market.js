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
function askingFee(p) {
  if (p.club === -1) return 0;
  let f = valueOf(p) * 1.15;
  if (p.club >= 0) { const c = CL(p.club); if (pickXI(c).some(o => o.p === p)) f *= 1.3; if (p.list) f *= .8; }
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
  // Clear out the surplus: too many seniors means the least useful go.
  const seniors = () => c.squad.map(P).filter(p => !p.acad);
  let guard = 0;
  while (seniors().length > 26 && guard++ < 5) {
    const xi = new Set(pickXI(c).map(o => o.p.id));
    const p = seniors().filter(q => !xi.has(q.id) && !q.keep && !q.loan).sort((a, b) => a.ovr - b.ovr)[0]; if (!p) break;
    sellToAI(p, false);
  }
}
/* Sell a player to the AI club that suits him; if nobody wants him, release him. */
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

/* ---------- bids for your players ---------- */
function bidsWeek(c) {
  for (const p of c.squad.map(P)) {
    if (p.acad || p.age > 31 || p.loan) continue;
    const star = p.ovr >= TIER_LVL[c.tier] + 5 || (p.age <= 21 && p.pot >= TIER_LVL[c.tier] + 10);
    if (!star || R() > .12 || G.inbox.some(m => m.type === "bid" && !m.done && m.pid === p.id)) continue;
    const buyer = G.clubs.filter(x => !x.gone && !isMine(x) && x.tier < c.tier && x.lvl >= p.ovr - 3).sort((a, b) => Math.abs(a.lvl - p.ovr) - Math.abs(b.lvl - p.ovr))[0];
    if (!buyer) continue;
    const amt = Math.round(valueOf(p) * rf(.85, 1.5) * (buyer.own ? 1 + OWNER_STYLES[buyer.own.style].poach * .3 : 1) / 1000) * 1000;
    addMsg({ type: "bid", pid: p.id, club: buyer.id, amt, rec: headAdvice(p, amt), title: `${buyer.name} bid ${money(amt)} for ${p.name}` });
  }
}
function headAdvice(p, amt) {
  const s = staffOf("recruit"), v = valueOf(p), starter = pickXI(my()).some(o => o.p === p);
  if (p.keep) return "reject";
  if (!s) return amt >= v * 1.4 ? "accept" : "reject";
  const r = { value: amt >= v * 1.15, potential: p.age >= 24 ? amt >= v : amt >= v * 1.6, proven: starter ? amt >= v * 1.8 : amt >= v, fit: amt >= v * 1.3 }[s.phil];
  return r ? "accept" : "reject";
}
function answerBid(m, accept, auto) {
  m.done = true; m.answer = accept ? "accepted" : "rejected";
  const p = G.players[m.pid], buyer = CL(m.club);
  if (!p || p.club !== G.club) { m.answer = "lapsed"; return; }
  if (!auto && (accept ? "accept" : "reject") !== m.rec) {
    G.meddle = (G.meddle || 0) + 1;
    trust("recruit", -7, accept ? `unhappy you sold ${p.name} when he advised keeping him.` : `frustrated you turned down ${money(m.amt)} for ${p.name}.`);
  }
  if (accept) {
    const starter = pickXI(my()).some(o => o.p === p);
    if (starter && !auto) trust("manager", -6, `didn't want to lose ${p.name}.`);
    leaveClub(p); moveTo(p, buyer); p.wage = wageFor(p.ovr); earn("sales", m.amt);
    news(`${p.name} joins ${buyer.name} for ${money(m.amt)}${auto ? ` (${staffOf("recruit") ? staffOf("recruit").name : "the club"} accepted)` : ""}.`, true);
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
function ownerSell(p) {
  G.meddle = (G.meddle || 0) + 1;
  const starter = pickXI(my()).some(o => o.p === p);
  const b = sellToAI(p, true);
  if (staffOf("recruit")) trust("recruit", -6, `wasn't consulted about selling ${p.name}.`);
  if (starter) trust("manager", -9, `is angry you sold ${p.name}, one of his first-choice players.`);
  return b;
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
  const last = (G.phase === "summer" && G.week === SUMMER_WEEKS - 1) || (G.phase === "season" && G.week === JAN[JAN.length - 1]);
  if (last) { clearAbroad(); news("The transfer window has closed."); }
}
