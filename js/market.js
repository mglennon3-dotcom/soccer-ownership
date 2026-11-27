/* Transfers. Your head of recruitment signs and sells players inside the budgets you set, following his own
   philosophy. You can overrule him (buy someone yourself, sell or release a player, answer a bid against his
   advice), but he and the manager notice. */
"use strict";

/* What a player wants to join you: his rating's going rate, more to drop down divisions. */
/* Still without a club once the season has started: he lowers his sights. About 30% less than his going rate from the
   opening week, 40% less from January (a player released during the season gets there after a month on the market). */
function faDiscount(p) {
  if (p.club !== -1 || (G.phase !== "season" && G.phase !== "playoffs")) return 1;
  const start = G.year * 100 + SUMMER_WEEKS, since = p.faAt == null || p.faAt < start ? 0 : absWeek() - p.faAt;
  if (p.faAt != null && p.faAt >= start && since < 4) return 1;
  return G.phase === "playoffs" || G.week >= JAN[0] ? .6 : .7;
}
function demandWage(p, c) {
  const from = p.club >= 0 ? CL(p.club).tier : p.club === -2 ? Math.max(1, Math.min(7, Math.round((90 - p.ovr) / 6))) : 7;
  // Dropping divisions is weighed as prestige in appeal.js; this is just his going rate.
  return Math.round((c ? wageAt(p.ovr, c.tier) : wageFor(p.ovr)) * (p.club === -2 ? 1.15 : 1) * (c ? wageMult(p, c) : 1) * faDiscount(p) / 100) * 100;  // his values: greed, home; a free agent still unsigned takes less
}
// Will he come at all? Players rarely drop more than two divisions.
/* Would he even consider a club in this division? Every player has a natural level: the division whose typical starter
   is nearest his rating. He'll drop one division below it (two once he's 31 and winding down), but no further,
   whatever the money. Free agents included. */
const naturalTier = p => { let best = 7; for (let t = 1; t <= 7; t++) if (Math.abs(TIER_LVL[t] - p.ovr) < Math.abs(TIER_LVL[best] - p.ovr)) best = t; return best; };
/* How far down he'll go. In his prime (under 31) a player good enough to start for an average side in his division won't
   drop out of it at all; a weaker one will go one division lower. From 31 he'll go two lower, less the further he stands
   above his division's average starter: a 15 one division, a 16 or better not at all. */
const joinRoom = p => { const t = naturalTier(p), over = p.ovr - TIER_XI[t];
  return p.age < 31 ? (over >= -1 ? 0 : 1) : Math.max(0, 2 - Math.floor(Math.max(0, over) / 3)); };
/* Past his room, only two kinds of player can be tempted, and only by a huge wage: a money-motivated one, or one with an
   affinity for the club (he grew up supporting it, came through its academy, or was a favourite there). Never more than
   two divisions past his room, and never the very best players in the game (a shown 16.5 or better). */
const STAR_NEVER = 90;
function boyhoodOf(p) {
  if (p.boy !== undefined) return p.boy;
  const reg = homeOf(p), cs = reg ? G.clubs.filter(x => !x.gone && !x.abroad && x.region === reg) : [];
  return (p.boy = cs.length && R() < .6 ? pick(cs).id : null);
}
const affinity = (p, c) => boyhoodOf(p) === c.id ? "grew up supporting the club" : p.yAcad === c.id ? "came through the club's academy" : favLevel(p, c.id) ? "was a favourite here" : null;
const greedy = p => prefsOf(p, P_FACTORS).top.includes("money");
const tempted = (p, c) => p.ovr < STAR_NEVER && (greedy(p) || !!affinity(p, c));
const hugeAsk = (p, c = my()) => c.tier - naturalTier(p) > joinRoom(p);
const willJoin = (p, c) => { if (c.abroad) return true; const d = c.tier - naturalTier(p), r = joinRoom(p); return d <= r || (d <= r + 2 && tempted(p, c)); };
// What it takes: his own level's rate, 15% more per division dropped and, past his room, at least double again.
function hugeWage(p, c) { const nt = naturalTier(p), drop = Math.max(0, c.tier - nt), beyond = drop - joinRoom(p), over = Math.max(0, p.ovr - TIER_XI[nt]);
  return wageAt(p.ovr, nt) * wageMult(p, c) * faDiscount(p) * (1 + .15 * drop) * (beyond > 0 ? 2 + (beyond - 1) * .5 + over * .1 : 1); }
/* What a club asks for a player: the same rule whoever is buying, you or an AI club.
   - His value (valueOf: rating, age, potential, years left), plus 15%.
   - A club lower down the pyramid can't hold out for quite as much: full price in the top two divisions, 90% in the
     Second, 80% in the Third. Non-league moves are basically free: a token 2% in the National Division, 0.5% in
     National North/South, nothing in the Regional League. (Your own players are priced in full.)
   - 30% more for a first-choice player, and 20% more again for the club's best player.
   - 10% more with four or more years left on his deal.
   - 20% less once he's on the transfer list.
   - Selling to a rival only at a premium: 25%, or 50% for a fierce one.
   A player in his last year who won't re-sign is already cheaper through his value, and his club gives up the premiums.
   xi: optional cache (club id -> Set of first-choice player ids) for pricing many players at once. buyer: who's buying
   (you unless said otherwise; null for no one in particular). */
const SELL_DIV = [0, 1, 1, .9, .8, .02, .005, 0];
const XI_SET = new Map();
function xiSet(c, xi) {
  if (xi) return xi[c.id] ||= new Set(pickXI(c).map(o => o.p.id));
  if (isMine(c)) return new Set(pickXI(c).map(o => o.p.id));
  const k = `${G.year}:${G.phase}:${G.week}`; let e = XI_SET.get(c.id);
  if (!e || e.k !== k) { e = { k, s: new Set(pickXI(c).map(o => o.p.id)) }; XI_SET.set(c.id, e); if (XI_SET.size > 400) XI_SET.clear(); }
  return e.s;
}
const bestOf = c => { let b = null; for (const id of c.squad) { const q = P(id); if (q && !q.acad && !q.loan && (!b || q.ovr > b.ovr)) b = q; } return b; };
const partTimeClub = c => !!c && !c.abroad && c.tier >= 6;
// A professional club signing a part-timer can do it at any time, not only in a window.
const proSigning = (p, buyer = my()) => p.club >= 0 && partTimeClub(CL(p.club)) && !partTimeClub(buyer);
function askingFee(p, xi, buyer = my()) {
  if (p.club === -1) return 0;
  let f = valueOf(p) * 1.15;
  if (p.club >= 0) {
    const c = CL(p.club), mine = isMine(c);
    const leaving = !mine && p.yrs <= 1 && !renewsAI(p);  // he won't re-sign: better a fee now than nothing in the summer
    if (!c.abroad && !mine) f *= SELL_DIV[c.tier] ?? 1;
    if (c.abroad) f *= fStr(c);  // a league abroad prices players at its own level
    if (!leaving && xiSet(c, xi).has(p.id)) { f *= 1.3; if (bestOf(c) === p) f *= 1.2; }
    if (!leaving && p.yrs >= 4) f *= 1.1;
    if (p.list) f *= .8;
    f *= [1, 1.25, 1.5][derbyLevel(buyer, c)];  // selling to a rival: only at a premium (more for a fierce one)
    // Part-time football (National North/South and the Regional League): a player under contract at a part-time club
    // costs another part-time club a fee (about half a year's wage: €1k to €10k); a club offering him a professional
    // contract (the National Division and up) can take him at any time, paying his club compensation (a year's wage: €2k to €50k).
    if (!c.abroad && partTimeClub(c) && buyer && !buyer.abroad) f = Math.max(f, partTimeClub(buyer) ? clamp(p.wage * .5, 1000, 10000) : clamp(p.wage, 2000, 50000));
    // A release clause: a bigger club (standing well above his club's) can take him for the set fee.
    if (p.clause && !mine && buyer && (buyer.rep || 0) >= p.clause.rep) f = Math.min(f, p.clause.fee);
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
const EURO_FOCUS = new Set(["ESP", "GER", "ITA", "FRA", "POR", "NED", "BEL", "DEN", "CRO", "AUT", "SUI", "SWE", "NOR"]);
function abroadPool(level) {
  // Real players at the clubs abroad, around the level asked for (a European brief: the leagues nearer home).
  const s = staffOf("recruit"); if (!s || s.focus === "domestic") return [];
  const key = windowId() + ":" + s.focus + ":" + Math.round(level / 3);
  if (!G.abroadK || G.abroadK !== key) { G.abroadK = key;
    const ps = []; for (const id of G.foreign || []) { const c = CL(id); if (!c || (s.focus !== "world" && !EURO_FOCUS.has(c.country))) continue;
      for (const pid of c.squad) { const p = P(pid); if (p && !p.acad && !p.loan && Math.abs(p.ovr - level) <= 9) ps.push(p.id); } }
    G.abroadReal = shuffle(ps).slice(0, s.focus === "world" ? 40 : 22); }
  return (G.abroadReal || []).map(id => G.players[id]).filter(p => p && p.club >= 0 && CL(p.club).abroad);
}
function clearAbroad() { for (const id of G.abroad || []) { const p = G.players[id]; if (p && p.club === -2) delete G.players[id]; } G.abroad = []; }
const fromName = p => p.club >= 0 ? CL(p.club).name : p.club === -2 ? `a club in ${NAT_NAME[p.nat] || "Europe"}` : "Free agent";

/* How the head of recruitment rates a target, on what he thinks the player is (his estimates, not the truth). */
function scoutScore(p, need, c, phil) {
  const [o1, o2] = ovrEstimate(p), [p1, p2] = potEstimate(p), eo = (o1 + o2) / 2, ep = (p1 + p2) / 2;
  const fee = negotiated(askingFee(p)), wage = p._ask || demandWage(p, c), gain = eo - need.weakest, tf = typeFit(c, p, mgr().phil);
  if (need.kind === "upgrade" && gain < 2) return -1;
  if (need.kind === "depth" && eo < TIER_LVL[c.tier] - 9) return -1;
  switch (phil) {
    case "potential": return p.age <= 23 ? ep * 1.2 + eo * .4 - p.age + tf : eo * .3;
    case "proven": return eo * 1.5 + (p.age >= 25 && p.age <= 31 ? 4 : -4) + tf * 1.5;
    case "value": return (Math.max(1, gain + 6)) * 1e5 / (fee + wage * 2 + 20000);
    case "fit": { const k = STYLES[mgr().phil].keys; return eo + (p.pos === "GK" ? 0 : (avg(k.map(x => p.at[x])) - avg(OUT_KEYS.map(x => p.at[x]))) * .8) + tf * 3; }
  }
  return eo + tf;
}
// A player who left your club (sold, released or let go) this season or last: your head of recruitment won't bring
// him back on her own. (You can still suggest him or buy him yourself.)
const leftUs = p => (G.tlog || []).some(m => m.id === p.id && ["out", "release", "expired"].includes(m.kind) && m.y >= G.year - 1);
function shortlist(c, need, max = 6) {
  const H = isMine(c) ? suggHold() : { t: 0, w: 0 }, s = staffOf("recruit"), left = c.budget.transfer - c.spentT - pendFees() - H.t, wageRoom = c.budget.wages - wageBill(c) - pendWages() - H.w;
  const reach = s ? s.at.net : 0, phil = s ? s.phil : "proven";
  // Contacts and scouting budget decide how much of the market he actually sees.
  const seeTier = c.tier - 1 - Math.floor((reach + scoutBoost() * 3) / 35);
  const pool = [];
  for (const q of Object.values(G.players)) {
    if (q.pos !== need.pos || q.club === c.id || q.acad || q.club === -2 || q.loan || leftUs(q)) continue;
    if (q.club >= 0 && (CL(q.club).tier < seeTier)) continue;
    pool.push(q);
  }
  for (const q of abroadPool(TIER_LVL[c.tier])) if (q.pos === need.pos) pool.push(q);
  const full = regList(c).length >= REG_MAX;  // a full 25-man list: only under-21s could play
  // Stars dropping down for a huge wage are only chased if you've told him to (Market page).
  // A youth-and-potential recruiter only buys young players (23 or under): he'd rather leave a place unfilled.
  const emb = embargoed(c);  // under an embargo: free agents only
  const ok = pool.filter(q => { if ((emb && q.club !== -1) || (phil === "potential" && q.age > 23) || (full && !regExempt(q)) || !willJoin(q, c) || (!G.starHunt && hugeAsk(q, c)) || q.age > 34 || (!emb && negotiated(askingFee(q)) > left) || demandWage(q, c) * .85 > wageRoom) return false; q._ask = playerAsk(q, c); return q._ask != null && q._ask <= wageRoom; });
  return ok.map(q => ({ p: q, sc: scoutScore(q, need, c, phil) })).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, max);
}

/* ---------- signing ---------- */
/* ---------- your club's transfer activity ----------
   Every move in and out of your club, kept for the Activity page: who, when, from or to whom, the fee, the wage, and
   who did the deal. */
function logMove(kind, p, o = {}) {
  (G.tlog ||= []).unshift({ t: (G.tseq = (G.tseq || 0) + 1), y: G.year, ph: G.phase, w: G.week, kind, id: p.id, name: p.name, pos: p.pos, age: p.age, r: r20(p.ovr), ...o });
  if (G.tlog.length > 800) G.tlog.length = 800;
}
// How long a new signing's contract runs: as for renewals (autoYears), by his age and whether he walks into the best
// 18 of the squad, up to what a player of his age will sign for.
function signYears(p, c) {
  const sen = c.squad.map(P).filter(q => q && !q.acad && q.id !== p.id).map(q => q.ovr).sort((a, b) => b - a);
  return autoYears(p, { maxY: p.age >= 32 ? 2 : p.age >= 30 ? 3 : 5 }, p.ovr >= (sen[17] ?? 0));
}
function signPlayer(p, fee, wage, byOwner, how) {
  if (fee > (G.recFee || 0) && fee > 50e6) { G.recFee = fee; story(`A record fee: you pay ${money(fee)} for ${p.name}.`, "record", 3); }
  if (embargoed(my()) && fee > 0) { news(`The deal for ${p.name} is blocked: the club is under a transfer embargo.`, true); return false; }
  const c = my(), seller = p.club >= 0 ? CL(p.club) : null, keen = tookLess(p, c, wage);
  if (keen) p.keen = keen; else delete p.keen;
  p.joinR = { y: G.year, from: fromName(p), fee, wage, by: byOwner ? "you" : how || "recruit" };
  // Signings made for you (your head of recruitment, your suggestions, first refusal...) go to the top of the Office page.
  if (!byOwner) (G.newSign ||= []).unshift({ pid: p.id, by: how || "recruit", fee, wage, keen, from: fromName(p), fromId: seller ? seller.id : null, ...(() => { const lr = (p.prog || []).slice(-1)[0], pre = G.phase === "summer" && lr; return { lastApp: pre ? lr[4] : (p.s || {}).app || 0, lastG: pre ? lr[5] : (p.s || {}).g || 0, lastA: pre ? lr[6] : (p.s || {}).a || 0, statL: pre ? "Last season" : "This season" }; })(), y: G.year, w: whenLabel(), rec: staffOf("recruit") ? staffOf("recruit").name : null });
  logMove("in", p, { club: fromName(p), fee, wage, by: byOwner ? "you" : how || "recruit" });
  if (p.club === -2) G.abroad = G.abroad.filter(id => id !== p.id);
  p.abroad = undefined;
  NEXT_FEE = fee; moveTo(p, c); p.wage = wage; p.yrs = signYears(p, c); registerNew(p, c); logPay(p, 0, "signed");
  signingBoost(p, c);
  c.cash -= fee; book("buys", fee); if (fee) p.am = { book: fee, fee, y: G.year }; if (!byOwner) c.spentT += fee;  // cash now; the accounts spread it over his contract
  if (seller && !seller.gone) aiSquadCheck(seller, true);
  news(`${byOwner ? "You sign" : `${staffOf("recruit") ? staffOf("recruit").name + " signs" : "The club signs"}`} ${p.name} (${p.pos}, ${p.age}, rated ${r20(p.ovr)}) from ${seller ? seller.name : p.nat !== "ENG" ? "abroad" : "free agency"}${fee ? " for " + money(fee) : " on a free"}, on ${pw(wage)}.`, true);
  if (keen) news(`${p.name} ${keenLine(keen).replace(/^Took/, "took")}`, true);
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
  let signed = 0, waitFor = null;
  let lim = G.phase === "summer" ? (c.squad.filter(id => !P(id).acad).length < 18 ? 4 : 2) : 1;
  // Your suggestions come first, and don't count against his own list (he'll still only take ones he agrees with).
  for (const x of sugg().slice()) {
    const p = G.players[x.id]; x.wait = false;  // the window's open: no more waiting
    if (!p || p.club === c.id) { G.sugg = sugg().filter(y => y !== x); continue; }
    const v = suggView(p, c, x.loan);
    if (!v.ok) { if (v.money && x.raised && !waitFor) waitFor = { p, v, x }; continue; }
    if (embargoed(c) && (x.loan || v.fee > 0)) continue;  // the embargo: he can't do it (it waits)
    if (x.loan) loanIn(p, CL(p.club), v.share, "suggestion");
    else { const fromClub = fromName(p); signPlayer(p, v.fee, v.ask, false, "suggestion"); news(`${s.name} negotiated the deal for ${p.name}: ${v.N.ask ? (v.fee < v.N.ask ? `${fromClub} asked ${money(v.N.ask)}, ${pr(s, "he")} paid ${money(v.fee)}` : `${fromClub} wouldn't move from ${money(v.N.ask)}`) : "a free transfer"}; the agent wanted ${pw(v.N.agent)}, ${pr(s, "he")} agreed ${pw(v.ask)}.`); }
    G.sugg = sugg().filter(y => y !== x);
    news(`${p.name} was your suggestion: ${s.name} thanks you for the tip.`); trust("recruit", 2, null, "Your tips");
  }
  // You raised a budget for a suggestion and it's still a little short (his read of the price moved): he doesn't spend
  // that money on anyone else. He tells you once a window what it needs, and waits.
  if (waitFor) { const { p, v, x } = waitFor; if (x.toldW !== windowId()) { x.toldW = windowId(); const f = budgetFit(p, x.loan);
      news(`${s.name}: "${p.name} is still just out of reach${f ? `: it needs ${budgetFitText(f)} more` : ""}. I'm holding the budget for him and not signing anyone else meanwhile."`, true); }
    lim = 0; }
  for (const need of squadNeeds(c)) {
    if (signed >= lim) break;
    const best = shortlist(c, need, 1)[0];
    if (!best) { const s = staffOf("recruit"); if (s && s.phil === "potential" && G.phase === "summer" && G.week === SUMMER_WEEKS - 2 && need.kind === "depth" && need.short >= 2) news(`${s.name} can't find a young ${POS_NAME[need.pos].toLowerCase()} the budget stretches to, and won't sign an older one: the squad is ${need.short} short there.`, true); continue; }
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
  payFee(buyer, null, fee); moveTo(p, buyer); p.wage = aiWage(p, buyer); earn("sales", fee);
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
const bidWeight = (x, p, c) => (1 + Math.max(0, c.tier - x.tier) * 1.5) * (x.abroad ? (x.country === p.nat ? .9 : .2) : 1) * [1, .3, .1][derbyLevel(c, x)];  // rivals rarely deal with each other  // abroad: a minority of bids, more for their own countrymen
const clubLabel = x => x.abroad ? `${x.name} (${COUNTRY[x.country].name})` : x.name;
/* ---------- offers for your players ----------
   Real offers only, and only in a window. Clubs bid for players you've transfer-listed (usually below their value:
   everyone knows you want to sell), and the bigger clubs come in for your stars whether they're listed or not. */
const NFS_MIN = 2.5;  // a bid for a not-for-sale player below this multiple of his value is rejected automatically
function bidsWeek(c) {
  for (const p of c.squad.map(P)) {
    if (p.acad || p.loan || p.agreed || !canSell(p) || G.inbox.some(m => m.type === "bid" && !m.done && m.pid === p.id)) continue;
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
      if (!canAfford(buyer, amt)) continue;  // they can't raise it
      const m = addMsg({ type: "bid", keen: buyer.tier < c.tier || buyer.rep > c.rep + 8 || buyer.abroad, nfs: true, pid: p.id, club: buyer.id, amt, rec: headAdvice(p, amt), title: `${clubLabel(buyer)} bid ${money(amt)} for ${p.name}, though he's not for sale` });
      // Not for sale means it (1.2.29): anything under two and a half times his value is turned down at once. Only a bid
      // above that reaches you to decide.
      if (amt < valueOf(p) * NFS_MIN) { answerBid(m, false, true); m.answer = `turned down: he's not for sale (under ${NFS_MIN}x his value)`; }
      continue;
    }
    if (p.list) {
      // Listed means you'll sell, not that he's cheap: what he fetches depends on demand (listDemand). An ordinary player
      // draws bids from a bit over half his value to a little above it; one coming off a big season, good for the level, draws more bids, from
      // bigger clubs, at or above his value, and several clubs may chase him at once.
      const d = listDemand(p, c), form = Math.max(0, seasonForm(p));
      if (R() > .35 + d * .45) continue;
      const want = bidders().filter(x => x.lvl >= p.ovr - 4 && x.lvl <= p.ovr + 9 + form * 4 && p.age <= 33);
      if (!want.length) continue;
      const n = 1 + (d > .35 && R() < d ? 1 : 0) + (d > .65 && R() < d - .3 ? 1 : 0), seen = new Set(), offers = [];
      for (let i = 0; i < n * 2 && offers.length < n; i++) { const b = wpick(want, x => bidWeight(x, p, c)); if (!b || seen.has(b.id)) continue; seen.add(b.id);
        const a = Math.max(1000, feeRound(valueOf(p) * rf(.6 + d * .4, 1.1 + d * .35))); if (canAfford(b, a)) offers.push([b, a]); }
      if (!offers.length) continue;
      if (askMet(p, offers, 0)) continue;  // your asking price: met, and he's sold
      offers.sort((x, y) => y[1] - x[1]); [buyer, amt] = offers[0];  // competition: the best bid is the one you see
      if (offers.length > 1 && p.chaseW !== windowId()) p.chaseW = windowId(), news(`${offers.length} clubs are chasing ${p.name}: ${clubLabel(buyer)} lead the way with ${money(amt)}.`);
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
    if (!canAfford(buyer, amt)) continue;  // they haven't the budget for it
    const fw = formWord(seasonForm(p)), keen = buyer.tier < c.tier || buyer.rep > c.rep + 8 || (p.list && R() < .7);
    addMsg({ type: "bid", keen, pid: p.id, club: buyer.id, amt, rec: headAdvice(p, amt), title: `${clubLabel(buyer)} bid ${money(amt)} for ${p.name}${p.list ? " (listed)" : fw ? ` after ${fw}` : ""}` });
  }
}
/* Your asking price for a listed player (1.2.20). A bidder goes as high as it would in talks (a little above its opening
   bid, more for a player it really wants); if that reaches your asking price, it pays exactly that and the sale goes
   through (in a closed window, it's agreed and he joins when it opens). Bids below it still arrive for you to answer. */
/* How much clubs want a listed player, 0-1: his season (the big one), how good he is for your level, his age and
   potential. His contract is already in his value. */
function listDemand(p, c = my()) {
  const form = Math.max(0, seasonForm(p)), above = p.ovr - TIER_LVL[c.tier];
  let d = form * .55 + clamp(above * .04, -.2, .35) + (starAtLevel(p, c) ? .15 : 0) + (p.age <= 23 && p.pot > p.ovr + 5 ? .1 : 0);
  if (p.age >= 31) d -= (p.age - 30) * .1;
  return clamp(d, 0, 1);
}
// The most a club will go to for him (in talks, or to meet an asking price): more for a player in demand, and more
// from a bigger club.
const bidTop = (p, buyer, amt) => Math.min(tbOf(buyer), amt * rf(1.04 + listDemand(p) * .1, 1.25 + listDemand(p) * .25) * (buyer.tier < my().tier || buyer.abroad ? rf(1, 1.25) : 1) * (1 + Math.max(0, seasonForm(p)) * .1));
function askMet(p, bids, amt, pre) {
  if (!p.askP) return false;
  if (!Array.isArray(bids)) bids = bids ? [[bids, amt]] : [];
  const can = bids.map(([b, a]) => [b, bidTop(p, b, a)]).filter(([b, top]) => top >= p.askP && canAfford(b, p.askP)).sort((x, y) => y[1] - x[1]);
  if (!can.length) return false;
  // Two or more clubs at your price: a bidding war. The keenest pays a little over the next best, up to its own limit.
  const [buyer, top] = can[0], fee = can.length > 1 ? Math.min(top, feeRound(p.askP + (can[1][1] - p.askP) * rf(.2, .4))) : p.askP;
  const m = addMsg({ type: "bid", pre: !!pre, keen: true, pid: p.id, club: buyer.id, amt: fee, rec: "accept", title: fee > p.askP ? `${clubLabel(buyer)} win the race for ${p.name}: ${money(fee)}, above your ${money(p.askP)} asking price` : `${clubLabel(buyer)} meet your ${money(p.askP)} asking price for ${p.name}` });
  if (can.length > 1) news(`${can.length} clubs met your asking price for ${p.name}; ${buyer.name} went highest, ${money(fee)}.`, true);
  answerBid(m, true, "ask"); return true;
}
// A bigger club that wants one of your players with a release clause can simply pay it: the sale goes through.
function clauseWeek(c) {
  for (const p of c.squad.map(P)) { if (!p || !p.clause || p.loan || R() > .08) continue;
    const bs = G.clubs.filter(x => !x.gone && !isMine(x) && (x.rep || 0) >= p.clause.rep && canAfford(x, p.clause.fee) && (x.abroad ? !homeBound(p) : true) && p.ovr >= (x.lvl || 0) - 4 && acceptsMove(p, x));
    if (!bs.length) continue; const b = pick(bs);
    const m = addMsg({ type: "bid", keen: true, pid: p.id, club: b.id, amt: p.clause.fee, rec: "accept", title: `${clubLabel(b)} trigger ${p.name}'s ${money(p.clause.fee)} release clause` });
    news(`${b.name} pay ${p.name}'s ${money(p.clause.fee)} release clause: he's going.`, true); story(`${b.name} trigger ${p.name}'s ${money(p.clause.fee)} release clause: he leaves ${c.name}.`, "clause", 3); answerBid(m, true, true); return; }
}
function headAdvice(p, amt) {
  const s = staffOf("recruit"), v = valueOf(p), starter = pickXI(my()).some(o => o.p === p);
  if (p.keep || p.nfs) return "reject";  // your call: he isn't for sale (you can still accept it yourself)
  if (my().squad.filter(id => !P(id).acad).length <= 16) return "reject";  // the squad is too thin to sell
  if (!coverOK(my(), p)) return "reject";  // it would leave his position short
  if (p.list && p.askP) return amt >= p.askP ? "accept" : "reject";  // your asking price
  if (p.list) return amt >= v * ((s && s.phil === "value" ? .75 : .6) + listDemand(p) * .45) ? "accept" : "reject";  // in demand: he holds out for more  // he wants him gone, at a fair price
  if (!s) return amt >= v * 1.4 ? "accept" : "reject";
  const r = { value: amt >= v * 1.15, potential: p.age >= 24 ? amt >= v : amt >= v * 1.6, proven: starter ? amt >= v * 1.8 : amt >= v, fit: amt >= v * 1.3 }[s.phil];
  return r ? "accept" : "reject";
}
/* The improved contract that keeps a wanted player happy: about 30% more, for three or four years. */
const newDealWage = p => Math.round(Math.max(p.wage * 1.3, demandWage(p, my()) * 1.15) / 100) * 100;
function newDeal(p) {
  const w = newDealWage(p), was = p.wage; p.wage = w; logPay(p, was, "new deal"); p.yrs = ri(3, 4); p.unsettled = 0; p.blocked = 0; p.payGrudge = 0; p.dealY = G.year;
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
    else if (p.goPromise && G.year <= p.goPromise && bigClubFor(buyer)) { delete p.goPromise; p.blocked = (p.blocked || 0) + 2; p.unsettled = 24; p.req = G.year; p.list = true; trust("manager", -3, null, "Players' trust in your word"); news(`You promised ${p.name} he could go if a club like ${buyer.name} came in. You've broken it: he won't forgive you, and he's on the transfer list.`, true); }
    else { p.blocked = (p.blocked || 0) + 1; p.unsettled = 8 + p.blocked * 4; news(`${p.name} wanted the move to ${buyer.name} and is unsettled${p.blocked >= 2 ? ". He's been blocked before and it shows" : ""}.`, p.blocked >= 2); }
  }
  if (!auto && !deal && (accept ? "accept" : "reject") !== m.rec) {
    // Answering a bid is the owner's call: your head of recruitment brings players in, selling isn't her department.
    // Only the manager minds, and only when you sell one of his first-choice players.
    if (accept && pickXI(my()).some(o => o.p === p)) meddled("manager", -3, `would rather have kept ${p.name}.`, "Selling first-choice players");
  }
  if (accept && m.pre) {
    // Agreed out of the window: he joins them when the next one opens.
    p.agreed = { club: buyer.id, amt: m.amt, auto: !!auto }; m.answer = "agreed: he joins when the window opens";
    news(`${p.name} will join ${clubLabel(buyer)} for ${money(m.amt)} when the transfer window opens${auto === "ask" ? " (your asking price)" : auto ? ` (${staffOf("recruit") ? staffOf("recruit").name : "the club"} accepted)` : ""}. Until then he stays and plays for you.`, true);
    return;
  }
  if (accept) {
    if (!auto && maybeWar(m, p, buyer)) return;  // word gets out and other clubs come in
    completeSale(p, buyer, m.amt, auto);
  } else if (auto) news(`A ${money(m.amt)} bid from ${buyer.name} for ${p.name} is turned down${m.nfs && m.amt < valueOf(p) * NFS_MIN ? `: he's not for sale, and it's under ${NFS_MIN} times his value` : ""}.`);
}
function completeSale(p, buyer, amt, auto) {
  if (!auto && pickXI(my()).some(o => o.p === p)) meddled("manager", -6, `didn't want to lose ${p.name}.`, "Selling first-choice players");
  logMove("out", p, { club: clubLabel(buyer), fee: amt, wage: p.wage, by: auto && auto !== "ask" ? "recruit" : "you" });
  leaveClub(p); payFee(buyer, null, amt); moveTo(p, buyer); p.wage = aiWage(p, buyer); earn("sales", amt);
  news(`${p.name} joins ${clubLabel(buyer)} for ${money(amt)}${auto === "ask" ? ", meeting your asking price" : auto ? ` (${staffOf("recruit") ? staffOf("recruit").name : "the club"} accepted)` : ""}.`, true);
}

/* ---------- negotiating a bid ----------
   Each bidder has a most it will pay (hidden): well above its opening bid for a player it really wants, not much above
   it for a listed one. Counter at or under that and they agree. A little over it and they come back with an improved
   offer; too far over, or a third time, and they may walk away. */
// Rounding a fee to a sensible step for its size, so small fees still have room to negotiate.
const feeRound = v => { const st = v < 10e3 ? 100 : v < 100e3 ? 500 : v < 1e6 ? 5000 : 50000; return Math.round(v / st) * st; };
function bidMax(m) {
  const p = G.players[m.pid];
  return m.max ??= Math.max(m.amt, Math.min(tbOf(CL(m.club)), feeRound(m.amt * (p && p.list ? rf(1.04 + listDemand(p) * .1, 1.25 + listDemand(p) * .25) : rf(1.1, 1.5)) * (1 + Math.max(0, seasonForm(p || {})) * .1))));
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
  const rivals = shuffle(bidders().filter(x => x.id !== buyer.id && x.lvl >= p.ovr - 4 && x.lvl <= p.ovr + 8 && canAfford(x, m.amt * 1.2))).slice(0, R() < .4 ? 2 : 1);
  if (!rivals.length) return false;
  const bids = [{ id: buyer.id, amt: m.amt, max: bidMax(m) }, ...rivals.map(x => { const amt = feeRound(m.amt * rf(1.04, 1.2)); return { id: x.id, amt, max: Math.max(amt, Math.min(tbOf(x), feeRound(amt * rf(1.03, 1.35)))) }; })];
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
/* Money held for your suggestions (1.2.23): once your head of recruitment has said he can do a deal you suggested (or you
   raised a budget to make it possible), its fee and wages are set aside, and his own shopping list can't spend them.
   Released when the deal is done or the suggestion is withdrawn. */
const suggHold = (except = -1) => { let t = 0, w = 0; for (const x of sugg()) { const p = G.players[x.id]; if (!x.hold || x.id === except || !p || p.club === G.club) continue; t += x.hold.t || 0; w += x.hold.w || 0; } return { t, w }; };
function setHold(p, loan) { const x = sugg().find(y => y.id === p.id); if (!x) return; const v = suggView(p, my(), loan); x.hold = v.ok ? { t: v.fee || 0, w: v.loan ? p.wage * (v.share || 0) : v.ask || 0 } : x.hold || null; }
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
    const room = c.budget.wages - wageBill(c) - suggHold(p.id).w;
    if (!windowOpen()) return p.wage * .5 > room ? { ok: false, money: true, need: { wages: p.wage * .5 - room }, w: `A loan would cost about ${pw(p.wage * .5)} and the wage budget only has ${pw(Math.max(0, room))} to spare.` } : { ok: false, wait: true, w: `${what} on loan. I'll ask about him when the window opens.` };
    const T = playerLoanTerms(p), share = Math.max(0, Math.round((T.min - (s.at.neg >= 65 ? .1 : 0)) * 10) / 10);
    if (!p.ng || p.ng.w !== windowId()) p.ng = { w: windowId(), n: normal(), m: normal() };
    T.min = clamp(Math.round(negGuess(T.min, p.ng.m, .25) * 10) / 10, 0, 1);  // what he reckons they want (his read)
    if (p.wage * share > room) return { ok: false, money: true, need: { wages: p.wage * share - room }, w: `They want us to pay ${Math.round(T.min * 100)}% of his wages (${pw(p.wage * T.min)}), and the wage budget only has ${pw(Math.max(0, room))} to spare.` };
    return { ok: true, loan: true, share, w: `${what} on loan. ${share < T.min ? `They want us to pay ${Math.round(T.min * 100)}% of his wages; I can talk them down to ${Math.round(share * 100)}%` : `They want us to pay ${Math.round(share * 100)}% of his wages`} (${pw(p.wage * share)}). I'll borrow him this week.` };
  }
  const N = negotiate(p, c);
  if (!N) return { ok: false, w: "He isn't interested in joining us." };
  const H = suggHold(p.id), fee = N.fee, ask = N.wage, left = c.budget.transfer - c.spentT - pendFees() - H.t, room = c.budget.wages - wageBill(c) - pendWages() - H.w;
  const deal = `${N.ask ? (fee < N.ask ? `They want ${money(N.ask)}; I think I can get him for about ${money(N.feeG)}` : `They want ${money(N.ask)} and I don't think they'll take less`) : "He's a free agent"}, on about ${pw(N.wageG)} (his agent's asking ${pw(N.agent)}; ${negWord()})`;
  const need = { transfer: Math.max(0, fee - left), wages: Math.max(0, ask - room) };
  if (fee > left) return { ok: false, money: true, need, w: `I'd take him, but even talked down to about ${money(fee)} his fee is more than the ${money(Math.max(0, left))} left in the transfer budget.` };
  if (ask > room) return { ok: false, money: true, need, w: `I'd take him, but even talked down to ${pw(ask)} his wages are more than the ${pw(Math.max(0, room))} the wage budget has to spare${pendWages() ? ` once the ${incoming().length} player${incoming().length > 1 ? "s" : ""} already agreed to join (${pw(pendWages())}) are counted` : ""}.` };
  return { ok: true, fee, ask, N, w: `${what}. ${deal}. ${windowOpen() || proSigning(p) ? "I'll go after him this week." : p.club >= 0 ? "I'll agree a deal now, and he'll join when the window opens." : "I'll sign him this week."}` };
}
/* His negotiation on a deal you suggested. The fee: he talks the asking price down, more the better a negotiator he is
   and the weaker the seller's hand (a listed player, one with a year or less left, one who's asked to leave); a little
   luck either way. The wage: the agent opens a quarter above the least the player would take, and he talks it down
   toward that floor. Settled once per window, so the figures don't jump about each time you look. */
// How well your head of recruitment reads the other side: a strong negotiator sees close to the truth, a poor one (or
// nobody) is guessing. n is a stable draw for the deal (it doesn't change each time you look); spread the size of the miss.
const negRead = () => { const s = staffOf("recruit"); return s ? clamp(s.at.neg / 100, 0, 1) : .1; };
const negGuess = (v, n, spread) => v * (1 + clamp(n || 0, -2, 2) * spread * (1 - negRead()));
const negWord = () => { const r = negRead(), s = staffOf("recruit"); return !s ? "a guess: you have no head of recruitment" : r >= .75 ? "a sharp read" : r >= .5 ? "a fair read, give or take" : "only a rough guess"; };
function negotiate(p, c = my()) {
  const s = staffOf("recruit"), neg = s ? s.at.neg : 30, min = playerAsk(p, c); if (min == null) return null;
  const w = windowId(); if (!p.ng || p.ng.w !== w) p.ng = { w, n: normal(), m: normal() };
  const lever = (neg - 50) / 250 + (p.list ? .08 : 0) + (p.club >= 0 && p.yrs <= 1 ? .1 : 0) + (p.req ? .08 : 0);
  const ask = askingFee(p), fee = Math.round(ask * clamp(1 - lever + p.ng.n * .03, .55, 1) / 1000) * 1000;
  // His wage: the agent opens a quarter above what he'd really take; your head of recruitment talks him down to that
  // (the same figure you'd get dealing yourself). Negotiating skill shows in the fee.
  const agent = Math.round(min * 1.25 / 100) * 100, wage = Math.round(min / 100) * 100;
  p.ng.m2 ??= normal();
  return { ask, fee, agent, wage, feeG: Math.round(negGuess(fee, p.ng.m, .12) / 1000) * 1000, wageG: Math.round(negGuess(wage, p.ng.m2, .1) / 100) * 100 };
}
function suggest(p, loan) {
  const s = staffOf("recruit"); if (!s) return;
  if (suggested(p, loan)) { G.sugg = sugg().filter(x => x.id !== p.id); return news(`You withdraw your suggestion of ${p.name}.`); }
  G.sugg = sugg().filter(x => x.id !== p.id);  // a player is suggested as a signing or a loan, not both
  sugg().push({ id: p.id, y: G.year, w: G.week, loan: !!loan }); setHold(p, loan);
  news(`You suggest ${loan ? "borrowing" : "signing"} ${p.name} to ${s.name}: "${suggView(p, my(), loan).w}"`);
}

/* What the budgets would need to rise by for your head of recruitment to do a deal he says he can't afford:
   transfer to the next 10,000, wages to the next 1,000 a year. */
function budgetFit(p, loan) {
  const v = suggView(p, my(), loan); if (!v.money || !v.need) return null;
  const t = Math.ceil((v.need.transfer || 0) / 1e4) * 1e4, w = Math.ceil((v.need.wages || 0) / 1e3) * 1e3;
  return t > 0 || w > 0 ? { transfer: t, wages: w } : null;
}
const budgetFitText = f => [f.transfer ? `the transfer budget by ${money(f.transfer)}` : "", f.wages ? `the wage budget by ${money(f.wages)} a year (${pw(f.wages)})` : ""].filter(Boolean).join(" and ");

/* A new contract for one of your players, offered by you at any time from his card. Whether he signs is everything he
   weighs up, not just the money: is he actually playing, does the formation and style suit him, is he near home, is
   the club big enough for him, the facilities, the project, and how loyal he is (a mercenary goes where the money is;
   a loyal player, more so a fan favourite, wants to stay). Grievances other than pay count against you. Each season he
   has a mood you can't see (so the same offer can go either way between seasons). Your head of recruitment reads him:
   the better a negotiator, the closer her advice. Three refusals a season and his agent ends talks until next season.
   He won't take a pay cut mid-contract (in his last year an overpaid player takes up to 10% less); older players want
   shorter deals. */
const loyaltyOf = p => p.loy ??= Math.round(clamp(.5 + normal() * .22 - (prefsOf(p, P_FACTORS).pri.money - .14) * 1.5, 0, 1) * 100) / 100;
const loyalWord = p => { const l = loyaltyOf(p); return l >= .75 ? "Highly loyal" : l >= .6 ? "Loyal" : l <= .25 ? "A mercenary" : l <= .4 ? "Follows the money" : null; };
// Everything but the money, worked out once: s0 is his appeal without wages; the money adds pri.money * moneyF(wage).
function stayScore(p) {
  const c = my(), a = playerAppeal(p, p.wage, c), games = ((G.leagues[c.lg].tab || {})[c.id] || {}).p || 0;
  const real = games >= 5 ? clamp(p.s.app / games / .8, 0, 1) : null;  // is he actually playing?
  const f = { ...a.f, time: real == null ? a.f.time : (a.f.time + real) / 2 };
  const L = loyaltyOf(p), love = Math.min(1, loveOf(p, c.id) / LEGEND), un = unhappiness(p, c), gr = un ? un.why.filter(w => w !== "wages") : [];
  const s0 = sum(Object.entries(a.pr.pri).filter(([k]) => k !== "money"), ([k, w]) => w * f[k]) + (L - .5) * .12 + love * .08 * (.5 + L) - (gr.length ? Math.min(.15, un.s * .03) : 0) + clubSit(c).m * .06;  // how the club is doing
  return { s0, thr: a.pr.thr, f, pr: a.pr, L, love, real, gr, dem: demandWage(p, c) };
}
// The least he'd sign for, given a reading of his mood (m): null if no money would keep him.
function stayMin(S, floor, m) {
  const ok = w => S.s0 + S.pr.pri.money * moneyF(w / S.dem) + m >= S.thr, top = S.dem * 3;
  if (ok(floor)) return floor; if (!ok(top)) return null;
  let lo = floor, hi = top; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return Math.ceil(hi / 100) * 100;
}
function renewTerms(p, cm = 0) {
  const c = my(), k = "R" + G.year; if (!p.rn || p.rn.k !== k || p.rn.m == null) p.rn = { k, tries: 0, n: normal(), m: clamp(normal(), -2, 2) * .03, off: false };
  const s = staffOf("recruit"), maxY = p.age >= 32 ? 2 : p.age >= 30 ? 3 : 5, S0 = stayScore(p), S = cm ? { ...S0, s0: S0.s0 + clauseLift(p, cm) } : S0;
  // No pay cut mid-contract; and a new deal is paid by his loyalty: a mercenary wants up to a quarter over his going
  // rate, an average player about the going rate (95-105%), a loyal one takes as little as 75% (a little less again
  // if the fans love him, but never under 75%).
  const worthF = clamp(1.25 - S.L * .5 - S.love * .05, .75, 1.25);
  const floor = Math.ceil(Math.max(p.yrs <= 1 ? p.wage * .9 : p.wage, S.dem * worthF) / 100) * 100;
  let min = stayMin(S, floor, p.rn.m); const read = s ? clamp(s.at.neg / 100, 0, 1) : 0;
  // Her read of his mood: a good negotiator sees most of it, a poor one guesses.
  const guess = p.rn.m * read + clamp(p.rn.n, -2, 2) * .03 * (1 - read);
  let advice = s ? stayMin(S, floor, guess) : null;
  // He's asked for a rise (it's in your inbox): a new contract has to meet him at least halfway.
  const pend = G.inbox.find(m => m.key === "raise" && !m.done && m.data && m.data.pid === p.id);
  if (pend && min != null) { min = Math.max(min, pend.data.half); if (advice != null) advice = Math.max(advice, pend.data.half); }
  const notes = [], pri = S.pr.pri, top = S.pr.top, cares = k => top.includes(k) || pri[k] >= .2;
  if (S.real != null) notes.push(S.real >= .7 ? ["good", "he's playing every week"] : S.real < .35 ? ["bad", "he isn't playing enough"] : ["", "he's in and out of the side"]);
  { const st = clubSit(c); if (st.fight) notes.push(["bad", "he's worried about the relegation fight"]); else if (st.m >= .4) notes.push(["good", "he likes where the club is going"]); else if (st.m <= -.4) notes.push(["bad", "he isn't sure where the club is going"]); }
  if (S.f.form >= .75) notes.push(["good", "the system suits him"]); else if (S.f.form < .45) notes.push(["bad", "the formation and style don't suit him"]);
  { const sf = systemFit(p); if (sf.mates >= .4) notes.push(["good", "he clicks with the players around him"]); else if (sf.mates <= -.4) notes.push(["bad", "he doesn't click with the players around him"]); }
  if (cares("home")) notes.push(S.f.home >= 1 ? ["good", "he's at home here"] : ["bad", `he'd like to be closer to home${homeOf(p) ? ` (${homeOf(p)})` : ""}`]);
  if (cares("prest") && S.f.prest < .45) notes.push(["bad", "he thinks he's outgrowing the club"]);
  if (cares("money")) notes.push(["", "it's mostly about the money for him"]);
  if (S.love >= FAV / LEGEND) notes.push(["good", `the fans ${S.love >= 1 ? "worship" : "love"} him`]);
  notes.push(S.L >= .75 ? ["good", "he's loyal to the club"] : S.L <= .25 ? ["bad", "he's a mercenary: he'll go wherever pays most"] : S.L <= .4 ? ["", "he isn't the loyal type"] : null);
  for (const g of S.gr) if (!["playing time", "having no place in the manager's system", "a style of play that doesn't suit him", "not clicking with the players around him"].includes(g)) notes.push(["bad", `he's unhappy about ${g}`]);
  return { no: min == null, min, advice, pend, guessNo: s && advice == null, s, maxY, tries: p.rn.tries, off: p.rn.off, notes: notes.filter(Boolean), S };
}
function offerRenewal(p, wage, yrs, cm = 0) {
  const T = renewTerms(p, cm); wage = Math.round(wage / 100) * 100;
  if (T.no) { if (++p.rn.tries >= 3) p.rn.off = true; return { ok: false, t: `${p.name} doesn't want to stay, whatever the money.` }; }
  if (T.off) return { ok: false, t: `${p.name}'s agent has ended talks until next season.` };
  if (clauseInsult(p, cm)) { p.unsettled = Math.max(p.unsettled || 0, 4); if (++p.rn.tries >= 3) { p.rn.off = true; return { ok: false, t: `${p.name} is offended by a ${money(Math.round(fullValue(p) * cm / 1e5) * 1e5)} release clause: his agent ends talks until next season.` }; }
    return { ok: false, t: `${p.name} is offended by a release clause that high and turns the offer down. ${3 - p.rn.tries} more ${3 - p.rn.tries === 1 ? "try" : "tries"} this season.` }; }
  if (wage >= T.min) {
    const was = p.wage; p.wage = wage; p.yrs = clamp(Math.round(yrs), 1, T.maxY); logPay(p, was, "new deal");
    p.dealY = G.year; p.unsettled = 0; p.payGrudge = 0; p.expiring = false; delete p.rn;
    if (cm) giveClause(p, my(), cm); else delete p.clause;  // a release clause, if one was agreed
    if (T.pend) { T.pend.done = true; T.pend.answer = `New contract agreed: ${pw(wage)}`; }
    news(`${p.name} signs a new ${p.yrs}-year contract: ${pw(wage)}${was !== wage ? ` (was ${pw(was)})` : ""}${cm ? `, with a ${money(p.clause.fee)} release clause for bigger clubs` : ""}.`, true);
    return { ok: true, t: `${p.name} signs: ${pw(wage)} for ${p.yrs} year${p.yrs > 1 ? "s" : ""}.` };
  }
  if (++p.rn.tries >= 3) { p.rn.off = true; return { ok: false, t: `${p.name}'s agent turns it down and ends talks until next season.` }; }
  return { ok: false, t: `${p.name}'s agent turns ${pw(wage)} down: he wants more. ${3 - p.rn.tries} more ${3 - p.rn.tries === 1 ? "try" : "tries"} this season.` };
}

/* Retraining: once in his career, one of your outfield players can learn a neighbouring position (AM to CM, CM to
   DM, DM to CB, and so on). His rating there starts from his attributes as they are (a passer may suit DM better than
   AM); he learns the role, closing about half the gap to his rating now; then how well he takes to it, an aptitude
   nobody can see for sure, moves the new position's key attributes up or down. His potential moves with his rating; a young player's aptitude counts again as he grows into
   the role. The manager estimates the outcome, the better his player development the closer. */
const RETRAIN = { CB: ["FB", "DM"], FB: ["CB", "W", "DM"], DM: ["CB", "CM", "FB"], CM: ["DM", "AM"], AM: ["CM", "W", "ST"], W: ["FB", "AM", "ST"], ST: ["W", "AM"], GK: [] };
const retrainOK = p => p.club === G.club && p.pos !== "GK" && !p.retrained && !(p.loan && p.loan.to === G.club);
const aptOf = (p, to) => ((p.apt ||= {})[to] ??= Math.round(clamp(normal(), -2.5, 2.5) * 4 * 10) / 10);
// What retraining would do: his new rating and potential (raw), from his attributes and his aptitude.
function retrainOutcome(p, to, apt = aptOf(p, to)) {
  // He learns the role: about half the gap between his attributes there and his rating now closes, then his aptitude.
  const raw = rawRole({ ...p, pos: to }, to), now = p.ovr + (raw - p.ovr) * .5 + apt, ovr = clamp(Math.round(now), 1, 100), d = ovr - p.ovr;
  const pot = Math.max(ovr, Math.round(p.pot + d + (p.age <= 21 ? apt * .5 : 0)));
  return { ovr, pot };
}
// The manager's estimate: his read of the aptitude is better the better his player development (dev 0-100).
function retrainView(p, to) {
  const m = mgr(), dev = m && m.at ? m.at.dev : 20, acc = clamp(dev / 100, .1, .95);
  const guess = aptOf(p, to) * acc + clamp(((p.rtn ||= {})[to] ??= normal()), -2, 2) * 3 * (1 - acc);
  const E = retrainOutcome(p, to, guess), spread = (1 - acc) * 4;
  const d = to20(E.ovr) - to20(p.ovr), dp = to20(E.pot) - to20(p.pot), score = d + dp * (p.age <= 25 ? .7 : .2);
  const verdict = score >= .6 ? "good" : score <= -.6 ? "bad" : "neutral";
  const r = v => [Math.max(1, Math.round(to20(v - spread))), Math.min(20, Math.round(to20(v + spread)))];
  // Potential is shown as your scouts' range for him, moved by the change he expects.
  const [pa, pb] = potEstimate(p), dP = E.pot - p.pot, pot = [Math.max(1, Math.round(to20(pa + dP - spread))), Math.min(20, Math.round(to20(pb + dP + spread)))];
  return { verdict, ovr: r(E.ovr), pot, sure: acc >= .7 ? "confident" : acc >= .45 ? "fairly sure" : "guessing" };
}
function retrain(p, to) {
  if (!retrainOK(p) || !RETRAIN[p.pos].includes(to)) return;
  const from = p.pos, was = p.ovr, wasPot = p.pot, apt = aptOf(p, to), O = retrainOutcome(p, to, apt);
  p.pos = to; const lift = O.ovr - rawRole(p, to); for (const k of Object.keys(POS_W[to])) p.at[k] = clamp(rh(p.at[k] + lift), 1, 100);  // the new role's skills, learned well or badly
  setOvr(p); p.pot = Math.max(p.ovr, O.pot + (p.ovr - O.ovr)); delete p.dvb; p.retrained = { from, y: G.year };
  // Your depth charts re-slot him by his new ratings (he'd otherwise keep the place he had in his old position).
  for (const role in G.depth || {}) G.depth[role] = G.depth[role].filter(id => id !== p.id);
  news(`${p.name} retrains from ${POS_NAME[from].toLowerCase()} to ${POS_NAME[to].toLowerCase()}: now rated ${r20(p.ovr)} (was ${r20(was)}).`, true);
  return { was, wasPot };
}

/* Your own pre-contracts and loans aren't held to the wage budget, but the screens say whether he fits and offer to
   raise it just enough (to the next 1,000 a year). Room counts deals already agreed. */
const wageRoom = () => my().budget.wages - wageBill(my()) - pendWages();
const wageShort = annual => Math.max(0, Math.ceil((annual - wageRoom()) / 1e3) * 1e3);
function wageFitLine(p, annual, re) { const s = wageShort(annual);
  return s ? `<div style="margin:6px 0"><p class="small warn" style="margin-bottom:4px">At ${pw(annual)} he'd take the wage budget over by ${pw(s)}: raising it by ${money(s)} a year covers him.</p><button class="btn sm" data-act="fitwage" data-id="${p.id}" data-amt="${s}" data-re="${re}">Raise the wage budget to fit him</button></div>`
    : `<p class="small muted" style="margin:4px 0">Fits the wage budget: ${pw(Math.max(0, wageRoom()))} to spare${pendWages() ? " after the deals already agreed" : ""}.</p>`; }
function raiseWages(amt, p) { my().budget.wages += amt; news(`You raise the wage budget by ${money(amt)} a year to make room for ${p.name}.`); }
async function offerWageRaise(p, annual, s = wageShort(annual)) { if (!s) return;
  if (await ask(`${p.name}'s ${pw(annual)} takes the wage budget over by ${pw(s)}. Raise it by ${money(s)} a year to fit him? The deal goes ahead either way.`, "Raise the budget")) raiseWages(s, p); }

/* ---------- you, overruling your staff ---------- */
/* Agreed out of the window: a player at another club can agree to join you; the deal goes through, and the fee is paid,
   when the next window opens. Until then his club won't sell him to anyone else. If he leaves the game (or the club is
   gone) the deal falls through; if his contract runs out in the meantime he comes on a free. */
// Which window an agreed deal completes in: January (this season's books and budget) or the summer (next season's).
const toMeWhen = p => p.toMe.when || (p.toMe.y === G.year && G.phase === "season" && p.toMe.w < JAN[0] ? "jan" : "summer");
/* Pre-contracts: once the January window has closed, a player at another club in the last months of his contract can
   agree to join you on a free in the summer. No fee and no say for his club; he only has to want to come. */
const preContractOK = p => p.club >= 0 && p.club !== G.club && (!CL(p.club).gone || CL(p.club).abroad) && p.yrs <= 1 && !p.acad && !p.loan && !p.toMe && G.phase === "season" && G.week > JAN[JAN.length - 1];
// A player who means to re-sign with his club wants a big offer to change his mind: about 60% more than he'd otherwise ask.
const preAsk = p => { const w = playerAsk(p) || demandWage(p, my()); return Math.round(w * (renewsAI(p) ? 1.6 : 1) / 100) * 100; };
function agreePre(p, wage, rec) { agreeIncoming(p, 0, wage, rec, true); p.toMe.pre = true; p.toMe.when = "summer"; G.news[0].t = `Pre-contract agreed: ${p.name} will join from ${fromName(p)} on a free when his contract ends in the summer, on ${pw(wage)}.`;
  if (rec) agreedMsg(p, rec, true); }
// An inbox notice for deals your head of recruitment agrees: who, what it costs, and when he arrives.
function agreedMsg(p, rec, pre) { const A = p.toMe;
  addMsg({ type: "info", title: `${rec.name} ${pre ? "signs a pre-contract with" : "agrees a deal for"} ${p.name}`,
    body: `${POS_NAME[p.pos]}, ${p.age}, rated ${est20(ovrEstimate(p))}, potential ${est20(potEstimate(p))}, from ${fromName(p)}. Signed this week. ${pre ? "No fee" : A.fee ? `${money(A.fee)}, paid when he arrives` : "No fee"}. ${pw(A.wage)}. ${pre ? "He joins on a free when his contract ends this summer (his wages start then, in next season's accounts)" : `He joins ${A.when === "jan" ? "when the January window opens (this season's accounts)" : "when the summer window opens (next season's accounts)"}`}. You can pull out from his player card.` }); }
function agreeIncoming(p, fee, wage, rec, quiet) { p.toMe = { fee, wage, y: G.year, w: G.week, rec: !!rec, by: rec ? "recruit" : "you", when: G.phase === "season" && G.week < JAN[0] ? "jan" : "summer" }; news(`${rec ? `${rec.name} agrees a deal` : "Agreed"}: ${p.name} will join from ${fromName(p)} when the ${p.toMe.when === "jan" ? "January window opens (this season's accounts)" : "summer window opens (next season's accounts)"}${fee ? `, for ${money(fee)}` : ""}, on ${pw(wage)}.`, true);  if (rec && !quiet) agreedMsg(p, rec, false); }
// What deals agreed by your head of recruitment have already promised from the budgets (all agreed players' wages count).
const pendFees = () => sum(incoming().filter(p => p.toMe.rec && toMeWhen(p) === "jan"), p => p.toMe.fee);  // summer deals come out of next season's budget
const pendWages = () => sum(incoming(), p => p.toMe.wage);
/* Out of the window your head of recruitment only acts on your suggestions: he agrees the deal (a free agent he signs
   straight away) and the player joins when the window opens. His own targets wait for the window. */
function headOffWindow(c) {
  const s = staffOf("recruit"); if (!s || G.club == null) return;
  for (const x of sugg().slice()) { if (x.loan) continue; const p = G.players[x.id];
    if (!p || p.club === c.id) { G.sugg = sugg().filter(y => y !== x); continue; }
    if (p.toMe) continue; const v = suggView(p, c, false); if (!v.ok) continue;
    if (p.club === -1) { signPlayer(p, 0, v.ask, false, "suggestion"); G.sugg = sugg().filter(y => y !== x); news(`${p.name} was your suggestion: ${s.name} thanks you for the tip.`); trust("recruit", 2, null, "Your tips"); continue; }
    // A player at another club: she asks you first. Agree the deal now (he joins when the window opens), or wait.
    if (x.wait || G.inbox.some(m => m.key === "recAsk" && !m.done && m.data.pid === p.id)) continue;
    const pre = preContractOK(p), preW = pre ? preAsk(p) : 0, next = G.week < JAN[0] ? "the January window" : "the summer";
    addChoice("recAsk", `${s.name}: shall I agree a deal for ${p.name}?`,
      `The window is shut, so he can't join until ${next}. I can agree it now: ${v.fee ? `${money(v.fee)} to ${fromName(p)}` : "no fee"}, on ${pw(v.ask)} for ${p.age >= 31 ? "1–2" : "2–4"} years, and he joins then (the fee is paid then). ${pre ? `Or I offer him a pre-contract now instead: no fee, as his contract runs out in the summer, and he'd join then, though he'd want about ${pw(preW)}${renewsAI(p) ? ", as he means to re-sign with them and it'd take a big offer" : ""}.` : `Or we wait and I'll go after him when the window opens; his club and his demands may have changed by then.`}`,
      ["Agree the transfer now", pre ? `Pre-contract instead (free, ~${pw(preW)})` : "Wait for the window", "Forget him"], { pid: p.id, fee: v.fee, wage: v.ask, pre, preW }, 1); }
}
function completeIncoming() {
  for (const p of Object.values(G.players)) { if (!p.toMe) continue; const A = p.toMe; delete p.toMe;
    if (p.club === G.club) continue;
    const seller = p.club >= 0 ? CL(p.club) : null;
    if (seller && seller.gone && !seller.abroad) { news(`${p.name}'s move falls through: ${seller.name} no longer exist.`, true); continue; }
    if (embargoed(my()) && A.fee > 0 && p.club !== -1) { news(`${p.name}'s move falls through: the club is under a transfer embargo.`, true); continue; }
    if (A.rec) { G.sugg = sugg().filter(x => x.id !== p.id); signPlayer(p, p.club === -1 ? 0 : A.fee, A.wage, false, "recruit"); } else ownerBuy(p, p.club === -1 ? 0 : A.fee, A.wage);
    if (A.pre && p.club === G.club) p.yrs = 4; } }  // a pre-contract is a four-year deal
const incoming = () => Object.values(G.players).filter(p => p.toMe);
function ownerBuy(p, fee, wage) {
  G.meddle = (G.meddle || 0) + 1;
  const c = my(), onList = shortlist(c, { pos: p.pos, kind: "depth", weakest: 0 }, 8).some(x => x.p === p);
  signPlayer(p, fee, wage, true); G.sugg = sugg().filter(x => x.id !== p.id);
  if (staffOf("recruit")) meddled("recruit", onList ? -3 : -10, onList ? `would rather have done the deal ${pr(staffOf("recruit"), "himself")}.` : `wasn't consulted about ${p.name} and isn't happy.`, "Signings made without consulting");
  const xi = pickXI(c); if (xi.some(o => o.p === p)) trust("manager", 3, null, "Your signings who make the team"); else meddled("manager", -3, null, "Signings the manager didn't want");
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
  p.list = !p.list; if (p.list) p.nfs = false; else delete p.askP;
  if (!p.list) return news(`${p.name} is taken off the transfer list.`);
  // Deciding who's for sale is the owner's call: your head of recruitment just handles the offers. Only listing one of
  // the manager's first-choice players annoys anyone.
  const starter = pickXI(my()).some(o => o.p === p);
  if (starter) meddled("manager", -6, `is unhappy you've transfer-listed ${p.name}, one of ${pr(staffOf("manager"), "his")} first-choice players.`, "Transfer-listing first-choice players");
  news(`You put ${p.name} on the transfer list. Offers will come in while the window is open.`);
}
function ownerRelease(p) {
  G.meddle = (G.meddle || 0) + .5;
  const starter = pickXI(my()).some(o => o.p === p);
  release(p, true);
  if (starter) meddled("manager", -8, `is angry you released ${p.name}.`, "Releasing first-choice players");
}

/* ---------- each week of a window ---------- */
/* Out of the windows clubs still bid for players you've transfer-listed. A sale agreed then goes through when the next
   window opens; until then the player stays (and plays) for you, and nobody else bids for him. */
function offWindowBids(c = my()) {
  for (const p of c.squad.map(P)) {
    if (!p.list || p.acad || p.loan || p.agreed || !canSell(p) || p.age > 33 || R() > .08 || G.inbox.some(m => m.type === "bid" && !m.done && m.pid === p.id)) continue;
    const want = bidders().filter(x => x.lvl >= p.ovr - 4 && x.lvl <= p.ovr + 9); if (!want.length) continue;
    const d = listDemand(p, c), buyer = wpick(want, x => bidWeight(x, p, c)), amt = Math.max(1000, feeRound(valueOf(p) * rf(.6 + d * .4, 1.1 + d * .35)));
    if (!canAfford(buyer, amt) || askMet(p, buyer, amt, true)) continue;
    addMsg({ type: "bid", pre: true, keen: R() < .7, pid: p.id, club: buyer.id, amt, rec: headAdvice(p, amt), title: `${clubLabel(buyer)} bid ${money(amt)} for ${p.name} (listed): he'd join when the window opens` });
  }
}
// When a window opens, sales agreed while it was shut go through.
function completeAgreed(c = my()) {
  for (const p of c.squad.map(P)) { if (!p || !p.agreed) continue; const A = p.agreed, buyer = CL(A.club); delete p.agreed;
    if (!buyer || (buyer.gone && !buyer.abroad)) { news(`${p.name}'s move to ${buyer ? buyer.name : "his new club"} falls through: the club no longer exists.`, true); continue; }
    completeSale(p, buyer, A.amt, A.auto); }
}
/* Free agents don't hang around at the top of the game: a player good enough for the Football League who nobody here
   signs soon goes abroad or drops into the game below ours. The better he is, the sooner: League One standard and up
   within a few weeks, League Two within a couple of months, the National Division within a season or so; young ones
   faster, veterans (30+) slower, so the good free agents left are mostly older. The pool lower down stays full:
   semi-pros and part-timers wait for a club; the weakest (released kids who never made it) give up within a year. */
/* A player in the last year of his deal who won't sign a new one, and is good enough to fetch a fee (young, or well
   above his club), is sold rather than lost for nothing: at the start of his final year, or in January. */
function aiSellExpiring() {
  for (const c of G.clubs) { if (c.gone || c.abroad || isMine(c)) continue;
    for (const p of c.squad.map(P)) { if (!p) continue; const wc = r20(p.ovr) >= 17; if (p.acad || p.loan || p.yrs > 1 || p.toMe || (p.age > 26 && p.ovr < c.lvl + 3 && !wc) || renewsAI(p) || R() > (wc ? .95 : .6)) continue;
      const b = playerChooses(p, G.clubs.filter(x => !x.gone && !isMine(x) && x !== c && (x.abroad ? !homeBound(p) : x.tier <= c.tier)), .8);
      // Nobody can afford him: a young star usually signs a new deal after all (a big rise, a release clause); only now and then does one run it down.
      if (!b) { if ((p.age <= 24 && p.ovr >= c.lvl && R() < .8) || (wc && R() < .95)) { p.renew = { y: G.year, ok: true }; if (p.age <= 24) giveClause(p, c); p.wage = Math.min(wageCap(c), Math.max(p.wage, Math.round(aiWage(p, c) * 1.3 / 100) * 100)); } continue; }  // (nobody earns more than €500k a week)
      aiTransfer(p, b, Math.round(aiFee(p, b) * .8 / 1e3) * 1e3); p.wage = offerWage(p, b); p.yrs = aiYears(p, b); } }
}
/* Free agents can sign at any time, not only in the windows. Each week a club at (or a little below) a good free agent's
   level may take him on, the better he is the likelier; the longer he's been waiting, the less he asks (down to 70% of
   his going rate once the season starts, 60% from January: faDiscount), so more of them take the deal. */
function faPickup(k) {
  for (const p of G.fa.map(P).filter(p => p && !faFresh(p) && !p.toMe && p.ovr >= 55 && p.age <= 35)) {
    if (R() > clamp(.25 + (p.ovr - 60) * .015, .2, .6) * k * (faDiscount(p) < 1 ? 1.4 : 1)) continue;
    const b = buyerFor(p, 8); if (!b || isMine(b)) continue;
    moveTo(p, b); p.wage = Math.round(aiWage(p, b) * faDiscount(p) / 100) * 100; p.yrs = p.age >= 31 ? 1 : aiYears(p, b); }
}
function faDrain() {
  const now = absWeek();
  for (const p of G.fa.map(P)) { if (!p || p.toMe || faFresh(p)) continue;
    const wk = Math.max(0, now - (p.faAt ?? 0)), t = naturalTier(p);
    let ch = t <= 3 ? (wk > 2 ? .25 : 0) : t === 4 ? (wk > 6 ? .1 : 0) : t === 5 ? (wk > 16 ? .04 : 0) : p.ovr < 30 ? (wk > 26 ? .06 : 0) : (wk > 100 ? .02 : 0);
    // A good young player is snapped up (abroad or below) faster still; a good veteran waits longer for the right offer.
    if (t <= 4) ch *= p.age <= 27 ? 2 : p.age >= 30 ? .35 : 1;
    if (t <= 4 && G.phase === "season" && G.week < 8) ch = 0;  // the first weeks of the season: clubs still pick up who's left
    if (t <= 4 && G.phase === "summer") ch = 0;  // the summer market: out-of-contract players stay available all window
    if (ch && R() < ch) retire(p, true); }
}
function marketWeek() {
  const c = my();
  if ((G.phase === "summer" && G.week === 0) || (G.phase === "season" && G.week === JAN[0])) { completeAgreed(c); completeIncoming(); }
  headWeek(c); bidsWeek(c); clauseWeek(c); loanOffersWeek(c); faDrain();
  if ((G.phase === "summer" && G.week === SUMMER_WEEKS - 2) || (G.phase === "season" && G.week === JAN[JAN.length - 2])) aiLoans();  // late in each window
  if ((G.phase === "summer" && G.week === 2) || (G.phase === "season" && G.week === JAN[0])) aiSellExpiring();
  if (G.phase === "season" && G.week === 1) { for (const x of G.clubs) if (!x.gone && !x.abroad && x.tier === 1) plAgree(x);
    // Who's expected to finish where (by strength), for the season's shocks.
    G.expRank = {}; for (const k of LG_KEYS) G.leagues[k].clubs.map(CL).sort((a, b) => (b.lvl || 0) - (a.lvl || 0)).forEach((c, i) => G.expRank[c.id] = i + 1); }
  if (G.phase === "season" && G.week === JAN[JAN.length - 1] + 6 && scrLive()) plMarch();  // early March
  // Free agents whose three weeks are up: each week of a window a club at their level may take one on (the better he is, the sooner).
  faPickup(1);
  for (const x of G.clubs) if (!x.gone && !isMine(x) && R() < .25) aiSquadCheck(x, true);
  foreignJanuary();  // foreign clubs look at the free agents every week of a window, as English clubs do
  const last = (G.phase === "summer" && G.week === SUMMER_WEEKS - 1) || (G.phase === "season" && G.week === JAN[JAN.length - 1]);
  if (last) { clearAbroad(); autoRegister(c); news("The transfer window has closed.", true);
    addMsg({ type: "info", title: "The transfer window has closed", body: G.phase === "summer" ? "Until the January window, only free agents can join straight away. Players at other clubs can agree to join when it opens." : "Until the summer, only free agents can join straight away. Players at other clubs can agree to join in the summer, and anyone in the last months of his contract can sign a pre-contract with you." }); }
  // Opening, and a week's warning before it shuts.
  if ((G.phase === "summer" && G.week === 0) || (G.phase === "season" && G.week === JAN[0])) addMsg({ type: "info", title: G.phase === "summer" ? "The summer transfer window is open" : "The January transfer window is open", body: `It closes at the end of ${G.phase === "summer" ? `pre-season (${SUMMER_WEEKS} weeks)` : `week ${JAN[JAN.length - 1] + 1} (${JAN.length} weeks)`}. Players at other clubs can join straight away while it's open.` });
  if ((G.phase === "summer" && G.week === SUMMER_WEEKS - 2) || (G.phase === "season" && G.week === JAN[JAN.length - 2])) addMsg({ type: "info", title: "The transfer window closes next week", body: "Anything you want done before it shuts has to be agreed this week or next. After that, players at other clubs can only agree to join when the next window opens." });
}
