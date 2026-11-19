/* Boot, saves (IndexedDB, one record per career) and the button router. */
"use strict";

const DB = { name: "touchline-owner", store: "saves" };  // the database keeps its first name so existing careers still load
function idb() { return new Promise((ok, no) => { const r = indexedDB.open(DB.name, 1); r.onupgradeneeded = () => r.result.createObjectStore(DB.store); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); }
async function dbDo(mode, fn) { const db = await idb(); return new Promise((ok, no) => { const t = db.transaction(DB.store, mode), st = t.objectStore(DB.store), r = fn(st); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); }
async function saveGame() {
  if (!G) return;
  G.saveId = G.saveId || "c" + Date.now();
  const c = my(), info = c ? `${seasonLabel(G.year)} · ${LEAGUES[c.lg].name} · ${money(G.owner.wealth)}` : `${seasonLabel(G.year)} · between clubs · ${money(G.owner.wealth)}`;
  try { await dbDo("readwrite", st => st.put({ id: G.saveId, name: c ? c.name : "Between clubs", info, at: Date.now(), g: JSON.stringify(G) }, G.saveId)); }
  catch (e) { toast("Couldn't save: " + e.message); }
}
async function listSaves() { try { const all = await dbDo("readonly", st => st.getAll()); return (all || []).sort((a, b) => b.at - a.at); } catch { return []; } }
function upgradeSave() {
  G.board ||= { own: 100, inv: [], dir: {}, offers: [] }; G.sTrust ||= { rel: 50, members: 0, seat: false }; G.net ||= { partner: null, feeders: [] }; G.loans ||= [];
  for (const c of G.clubs) if (!c.gone && !isMine(c) && !c.own) c.own = newOwner(c);
  if (!G.cups) startCups();
  if (!G.foreign) { makeForeign(); G.cont = {}; }
  // 0.38.0: foreign clubs spread down through the levels (each country's smaller clubs well below its best); existing
  // worlds drift there over a few seasons as standards and squads move.
  if (!G.foreign3) { G.foreign3 = true; const by = {}; for (const id of G.foreign || []) { const c = CL(id); (by[c.country] ||= []).push(c); }
    for (const [k, l] of Object.entries(by)) { const top = (FOREIGN[k] || [0, 85])[1]; l.sort((a, b) => b.lvl - a.lvl).forEach((c, i) => c.base = top - i * 2.2); } }
  if (!G.foreign2) { for (const id of G.foreign) CL(id).lvl = Math.max(CL(id).lvl, 72) + 1.5; G.foreign2 = true; }
  // 0.14.2: intakes got bigger, so a career from before runs this year's intake again, once (on top of the players it has).
  // 0.14.12: loans agreed before wage shares were negotiable get one chance to be renegotiated.
  for (const id of G.loanList || []) { const p = G.players[id]; if (p && p.loan && p.loan.to === G.club && !p.loan.neg) { p.loan.neg = true; p.loan.redo = true; if (p.lt) p.lt = null; } }
  // 0.17.1: the free-agent pool had drained of younger players; top it up once.
  if (!G.fa2) { G.fa2 = true; if (G.club != null) freshFreeAgents(); }
  // 0.31.2: staff wages were halved for new contracts; your current staff's pay follows suit, once (a rebalance, not a cut
  // they hold against you), and the managers in work at other clubs are re-quoted.
  if (!G.pay2) { G.pay2 = true; if (G.club != null) { for (const st of Object.values(my().staff).filter(Boolean)) { st.wage = Math.round(st.wage / 2 / 1000) * 1000; st.demand = Math.round(staffWage(st.role, st.rep) * rf(.85, 1.2) / 1000) * 1000; }
    for (const U of Object.values(G.pools || {})) U.empT = 0; } }
  // 0.31.3: staff pay re-based on players' pay (the 0.31.2 halving overshot): current staff move onto the new scale.
  if (!G.pay3) { G.pay3 = true; if (G.club != null) { for (const st of Object.values(my().staff).filter(Boolean)) { st.demand = Math.round(staffWage(st.role, st.rep) * rf(.85, 1.2) / 1000) * 1000; st.wage = Math.max(st.wage, Math.round(staffWage(st.role, st.rep) / 1000) * 1000); }
    for (const U of Object.values(G.pools || {})) U.empT = 0; } }
  // 0.31.5: non-league staff are part-time: your staff's pay drops to the new scale if it's lower.
  if (!G.pay6) { G.pay6 = true; G.pay5 = false; }  // 0.31.6: part-time pay cut further; re-run the part-time step
  if (!G.pay5) { G.pay5 = true; if (G.club != null) for (const st of Object.values(my().staff).filter(Boolean)) { const w = Math.round(staffWage(st.role, st.rep) / 1000) * 1000; st.demand = Math.round(staffWage(st.role, st.rep) * rf(.85, 1.2) / 1000) * 1000; if (partTime(st.rep) && w < st.wage) { news(`${st.name} goes part-time as ${ROLES_STAFF[st.role].l.toLowerCase()}: ${money(w)} a year (was ${money(st.wage)}).`); st.wage = w; } }
    for (const U of Object.values(G.pools || {})) { U.empT = 0; for (const x of U.list || []) x.demand = Math.round(staffWage(x.role, x.rep) * rf(.85, 1.2) / 1000) * 1000; } }
  if (!G.pay4) { G.pay4 = true; if (G.club != null) for (const st of Object.values(my().staff).filter(Boolean)) st.demand = Math.round(staffWage(st.role, st.rep) * rf(.85, 1.2) / 1000) * 1000; for (const U of Object.values(G.pools || {})) { U.empT = 0; for (const x of U.list || []) x.demand = Math.round(staffWage(x.role, x.rep) * rf(.85, 1.2) / 1000) * 1000; } }
  // 0.33.0: non-league players are part-time: every contract below the National Division moves onto the part-time scale,
  // and your wage budget shrinks in step with your wage bill.
  if (!G.pay7) { G.pay7 = true; const before = G.club != null ? wageBill(my()) : 0;
    for (const p of Object.values(G.players)) if (p.wage > 1000) p.wage = Math.max(1000, Math.round(p.wage * partTimeF(p.ovr) / 100) * 100);
    if (G.club != null && before > 0) my().budget.wages = Math.round(my().budget.wages * wageBill(my()) / before / 1000) * 1000; }
  // 0.35.0: outliers: a few clubs have far bigger or smaller followings than their division suggests.
  if (!G.fans2) { G.fans2 = true; for (const c of G.clubs) { if (c.gone || isMine(c)) continue; const d = drawOf(c); if (d > 1.5 || d < .7) c.fans = Math.round(c.fans * d); if (d > 1.5) c.cap = Math.min(80000, Math.max(c.cap, Math.round(c.cap * Math.min(d, 2) / 100) * 100)); } }
  // 0.38.2: staff pay is set by the job (0.35.2): your current staff move onto it if they're paid more than it.
  // 0.46.1: every existing ground gets a freshly drawn site: some hemmed in, some with room, a few spacious. Never smaller
  // than what's on it now (stands and extras), and work in progress is grandfathered.
  // 0.46.6: no planning stage: work already under way drops any planning weeks it had left.
  if (G.club != null) { const b = my().fac.stadium.build; if (b && b.plan) { const done = b.total - b.left; b.left = Math.max(1, b.left - Math.max(0, b.plan - done)); b.total -= b.plan; b.plan = 0; } }
  // 0.47.3: your academy players' potential is re-drawn once under the new intake rules (academy level, division, gems).
  if (!G.reroll1) { G.reroll1 = true; if (G.club != null) { const c = my(), ps = c.squad.map(P).filter(p => p && p.acad);
    if (ps.length) { const lvl = Math.max(1, c.fac.acad.lvl), y = staffOf("youth"), mean = youthBase(c, lvl) + (y ? (y.at.reach - 50) * .05 + (y.at.judge - 50) * .03 : -3);
      for (const p of ps) { p.pot = Math.max(p.ovr, Math.round(oldToNew(drawPotential(mean, 1 + lvl * .1, gemMult(c))))); p.yAcad = c.id; }
      const best = ps.slice().sort((a, b) => potEstimate(b)[1] - potEstimate(a)[1])[0];
      news(`The youth coaches have re-assessed all ${ps.length} academy players. ${best.name} (${best.pos}, ${best.age}) now looks the pick of them, potential ${est20(potEstimate(best))}.`, true); } } }
  // 0.47.6: feeders ask a set amount; your current feeders move onto what they ask.
  if (G.club != null && G.net) for (const f of G.net.feeders || []) { const x = CL(f.id); if (x) f.fund = feederAsk(x); }
  // 0.48.0: top-flight pay re-scaled (a Messi-level player €500k a week, the Premier's best €250-300k): contracts above
  // First Division level move onto the new scale, and your wage budget moves with your wage bill.
  if (!G.pay9) { G.pay9 = true; const before = G.club != null ? wageBill(my()) : 0, oldBase = o => 3000 * Math.pow(1.12, o - 30) * Math.pow(1.12, Math.max(0, o - 72));
    for (const p of Object.values(G.players)) if (p.ovr > 72 && p.wage > 0) p.wage = Math.max(1000, Math.round(p.wage * valueBase(p.ovr) / oldBase(p.ovr) / 100) * 100);
    G.tierW = null; if (G.club != null && before > 0) { const now = wageBill(my()); if (now < before) my().budget.wages = Math.round(my().budget.wages * now / before / 1000) * 1000; } }
  // 0.48.1: First Division pay rises (its average starter €50-100k a week; the Premier above it): contracts from just
  // above Second Division level move onto the new scale, and your wage budget rises with your wage bill.
  if (!G.pay10) { G.pay10 = true; const before = G.club != null ? wageBill(my()) : 0;
    for (const p of Object.values(G.players)) if (p.ovr > 68 && p.wage > 0) p.wage = Math.max(1000, Math.round(p.wage * wageBase(p.ovr) / valueBase(p.ovr) / 100) * 100);
    G.tierW = null; if (G.club != null && before > 0) { const now = wageBill(my()); if (now > before) my().budget.wages = Math.round(my().budget.wages * now / before / 1000) * 1000; } }
  // 0.49.0: the lower leagues sit lower on the rating scale (200-scale average starters: Regional 60, North/South 80,
  // National 100). Every player below 60 (120 on the 200 scale) moves down: his attributes shift together, so he keeps
  // his shape; potential, peak and career history follow. Pay and values are unchanged (they use the old-scale equivalent).
  if (!G.low1) { G.low1 = true;
    for (const p of Object.values(G.players)) {
      const d = Math.round(oldToNew(p.ovr) - p.ovr); if (d) { for (const k in p.at) p.at[k] = clamp(p.at[k] + d, 1, 100); const pk = p.peak; setOvr(p); p.peak = Math.round(oldToNew(pk || p.ovr)); }
      p.pot = Math.max(p.ovr, Math.round(oldToNew(p.pot))); if (p.prog) for (const r of p.prog) { r[2] = Math.round(oldToNew(r[2])); if (r[7] != null) r[7] = Math.round(oldToNew(r[7])); } }
    for (const c of G.clubs) if (c.lvl != null && !isMine(c)) c.lvl = oldToNew(c.lvl);
    G.tierW = null; }
  // 0.49.1: pay climbs evenly from 50 to 100 on the 200 scale: contracts there move onto the new scale (by the same
  // ratio as the going rate), and your wage budget moves with your bill.
  if (!G.pay11) { G.pay11 = true; const before = G.club != null ? wageBill(my()) : 0;
    for (const p of Object.values(G.players)) if (p.wage > 1000) { const r = wageFor(p.ovr) / Math.max(1, wageForV1(p.ovr)); if (Math.abs(r - 1) > .01) p.wage = Math.max(1000, Math.round(p.wage * r / 100) * 100); }
    G.tierW = null; if (G.club != null && before > 0) my().budget.wages = Math.round(my().budget.wages * wageBill(my()) / before / 1000) * 1000; }
  // 0.50.0: First Division average starter about €40k a week, Premier about €75k: contracts move by the ratio of the
  // new going rate to the old, and your wage budget moves with your bill.
  if (!G.pay12) { G.pay12 = true; const before = G.club != null ? wageBill(my()) : 0;
    for (const p of Object.values(G.players)) if (p.wage > 1000) { const r = wageFor(p.ovr) / Math.max(1, payOn(PAY200_V2, p.ovr)); if (Math.abs(r - 1) > .01) p.wage = Math.max(1000, Math.round(p.wage * r / 100) * 100); }
    G.tierW = null; if (G.club != null && before > 0) my().budget.wages = Math.round(my().budget.wages * wageBill(my()) / before / 1000) * 1000; }
  // 0.50.1: staff pay re-based on the corrected player pay: the candidate pools' market rates are redrawn, and your
  // staff move onto the new rate if they're paid more than it (nobody gets a pay rise).
  if (!G.spay2) { G.spay2 = true;
    for (const U of Object.values(G.pools || {})) { U.empT = 0; for (const x of U.list || []) x.demand = Math.round(staffWage(x.role, x.rep) * rf(.85, 1.2) / 1000) * 1000; }
    if (G.club != null) for (const st of Object.values(my().staff).filter(Boolean)) { st.demand = Math.round(staffWage(st.role, st.rep) * rf(.85, 1.2) / 1000) * 1000; const w = Math.ceil(effDemand(st) / 1000) * 1000; if (st.wage > w) st.wage = w; } }
  // 0.50.2: staff pay follows skill as well as reputation: market rates redrawn; your staff move down if paid above it.
  if (!G.spay3) { G.spay3 = true;
    for (const U of Object.values(G.pools || {})) { U.empT = 0; for (const x of U.list || []) x.demand = Math.round(staffMarket(x) * rf(.85, 1.2) / 1000) * 1000; }
    if (G.club != null) for (const st of Object.values(my().staff).filter(Boolean)) { st.demand = Math.round(staffMarket(st) * rf(.85, 1.2) / 1000) * 1000; const w = Math.ceil(effDemand(st) / 1000) * 1000; if (st.wage > w) st.wage = w; } }
  // 0.50.3: AI managers' and youth scouting ratings now follow their club's level: existing ones are re-rated.
  if (!G.aistaff2) { G.aistaff2 = true; for (const c of G.clubs) { if (c.gone && !c.abroad) continue; if (c.coach && !isMine(c)) { c.coach.dev = clamp(Math.round(aiStaffLvl(c.rep) + normal() * 9), 5, 97); c.coach.tac = clamp(Math.round((c.coach.tac + aiStaffLvl(c.rep) + normal() * 9) / 2), 5, 97); } delete c.yscout; } }
  // 0.50.4: emergency signings were paid by their own going rate (a former star keeper could cost millions at a small
  // club); any still at your club on such a contract moves onto the emergency cap.
  if (!G.list2) { G.list2 = true; if (G.club != null) aiListings(); }  // clubs abroad now transfer-list players too
  if (!G.pay13) { G.pay13 = true; for (const c of G.clubs) if (!isMine(c) && c.pay > 1.45) c.pay = 1.45; }  // AI pay levels now top out at 1.45
  if (G.club != null && !G.emerg1) { G.emerg1 = true; const c = my(), ids = new Set((G.tlog || []).filter(m => m.by === "emergency").map(m => m.id));
    for (const p of c.squad.map(P)) if (p && ids.has(p.id)) { const w = emergencyWage(p, c, .6); if (p.wage > w) { news(`${p.name}'s emergency contract is corrected to ${pw(w)}.`); p.wage = w; } } }
  if (!G.site2) { G.site2 = true;
    for (const c of G.clubs) { if (c.gone || c.abroad) continue;
      if (isMine(c)) { const S = c.fac.stadium; if (S.own) S.site = Math.max(newSite(S.cap), S.cap + usedSpace(S), buildNeeds(S)); }
      else c.site = Math.max(c.cap || 0, newSite(c.cap || 1000)); } }
  if (G.club != null && my().fac.stadium.own && my().fac.stadium.opened == null) my().fac.stadium.opened = Math.max(my().founded, G.year - 1);  // 0.44.0: ground ages
  if (G.club != null) my().budget.comm ??= 0;  // 0.40.0: community foundation budget
  // 0.40.2: this season's share of the new costs (match-day operations, travel, utilities, insurance, medical bills for
  // current long injuries, grading works if you came up this summer), less anything already booked under them.
  // 0.40.2: smaller clubs abroad could end up with a negative ground and fanbase (0.38.0); repair them.
  for (const id of G.foreign || []) { const c = CL(id); if (!c) continue; if (!(c.cap > 0)) c.cap = foreignCap(c.base ?? c.lvl); if (!(c.fans > 0)) c.fans = foreignFans(c.base ?? c.lvl); }
  if (!G.retro40) { G.retro40 = true; if (G.club != null) retroCosts(my()); }
  if (!G.pay8) { G.pay8 = true; if (G.club != null) for (const st of Object.values(my().staff).filter(Boolean)) { const w = Math.ceil(effDemand(st) / 1000) * 1000; if (st.wage > w) st.wage = w; } }
  if (!G.intake2) { G.intake2 = true; if (G.club != null && my() && my().fac.acad.lvl) { youthIntake(my()); saveGame(); } }
}
function retroCosts(c) {
  const f = c.fin, res = (G.myRes || []).filter(r => !r.neutral || r.comp), wk = G.phase === "summer" ? G.week : G.phase === "season" ? SUMMER_WEEKS + G.week : SUMMER_WEEKS + SEASON_WEEKS + G.week;
  const due = { mdops: 0, travel: 0, util: utilities(c) / 52 * wk, insure: wageBill(c) * INSURE / 52 * wk, medical: 0, grading: 0 };
  for (const r of res) { const opp = CL(r.opp); if (!opp) continue; if (r.home && r.crowd) due.mdops += opsCost(c, r.crowd); else if (!r.home) due.travel += TRAVEL[c.tier] * tripF(c, opp); }
  for (const id of c.squad) { const p = P(id); if (p && p.inj >= 5 && p.injT == null) { due.medical += medBill(c, p.inj); p.injT = p.inj; } }
  const h = G.history[0]; if (h && h.up && h.y === G.year - 1 && !f.grading) due.grading = gradingCost(c, c.tier);
  let tot = 0; const parts = [];
  const NAME = { mdops: "match-day operations", travel: "team travel", util: "utilities", insure: "insurance", medical: "medical treatment", grading: "ground grading" };
  for (const [k, v] of Object.entries(due)) { const add = Math.round(Math.max(0, v - (f[k] || 0))); if (add >= 1) { spend(k, add); tot += add; parts.push(`${NAME[k]} ${money(add)}`); } }
  if (tot) news(`New running costs have been applied to this season so far: ${money(tot)} (${parts.join(", ")}).`, true);
  return { tot, parts };
}
async function loadSave(id) { const s = await dbDo("readonly", st => st.get(id)); if (!s) return; G = JSON.parse(s.g); upgradeSave(); PAGE = "home"; closeModal(); render(); }
async function start() { G = null; renderStart(await listSaves()); }

let busy = false;
async function advanceN(n, until) {
  if (busy) return; busy = true; $("#busy").hidden = false;
  await new Promise(r => setTimeout(r, 20));
  try {
    for (let i = 0; i < n; i++) {
      const before = G.phase; advance();
      if (until && until(before)) break;
      if ((openDecisions().length || G.inbox.some(m => m.type === "choice" && !m.done && m.age === 1 && G.set?.stop !== false)) && i > 0) break;  // stop for something that needs your answer
      if (G.ended) break;
      if (i % 4 === 3) await new Promise(r => setTimeout(r, 0));
    }
  } catch (e) { console.error(e); toast("Error: " + e.message); }
  busy = false; $("#busy").hidden = true; closeModal(); render(); saveGame();
}

/* Confirmations happen on the page: browsers' own confirm() dialogs are blocked when the game runs inside claude.ai. */
let ASKING = null;
function ask(msg, yes = "Confirm") {
  return new Promise(res => { ASKING = res; modal(`<div class="modal-h"><h2>Are you sure?</h2></div><div class="modal-b"><p class="lead">${esc(msg)}</p><div class="row"><button class="btn primary" data-act="askyes">${esc(yes)}</button><button class="btn" data-act="askno">Cancel</button></div></div>`); });
}
const built = r => { if (typeof r === "string") toast(r); };
const ACT = {
  askyes: () => { const r = ASKING; ASKING = null; closeModal(); if (r) r(true); },
  askno: () => { const r = ASKING; ASKING = null; closeModal(); if (r) r(false); },
  vpri: el => { const start = !!el.closest("#f-vision"), v = start ? START_V : vision(), k = el.dataset.k, d = +el.dataset.d;
    if (d > 0 && sum(Object.values(v.pri)) >= VISION_POINTS) return; v.pri[k] = clamp((v.pri[k] || 0) + d, 0, 4);
    if (start) $("#f-vision").outerHTML = visionCard(START_V, true); else render(); },
  hrole: el => { HIRE_F.role = el.dataset.k; HIRE_F.phil = HIRE_F.focus = HIRE_F.form = ""; render(); },
  hf: el => { if (el.dataset.v != null) { HIRE_F[el.dataset.k] = el.dataset.v; render(); } },
  cand: el => candModal(el.dataset.r, +el.dataset.n),
  friendly: el => { const err = askFriendly(CL(+el.dataset.id), el.dataset.h === "1", SUB.fw); if (err) toast(err); render(); saveGame(); },
  putsale: () => { G.saleOffers = saleOffers(); render(); },
  acceptsale: async el => { const o = G.saleOffers[+el.dataset.i]; if (await ask(`Sell your ${ownPct()}% of ${my().name} to ${o.name} for ${money(o.amt)}? You'll then choose a new club.`)) { sellMyClub(o); render(); saveGame(); } },
  buyclub: async el => { const c = CL(+el.dataset.id); if (await ask(`Buy ${c.name} for ${money(askPrice(c))}?`)) { buyClub(c); PAGE = "home"; render(); saveGame(); } },
  mcty: el => { const k = el.dataset.k, off = new Set(MARKET_F.off || []); off.has(k) ? off.delete(k) : off.add(k); MARKET_F.off = [...off]; render(); },
  mctyall: el => { MARKET_F.off = el.dataset.v === "1" ? [] : MKT_COUNTRIES.slice(); render(); },
  nudge: el => { const a = el.dataset.a, k = el.dataset.k, inp = document.querySelector(`input[data-act="${a}"][data-k="${k}"]`); if (!inp) return;
    const v = el.dataset.set != null ? +el.dataset.set : Math.max(0, Math.round((num(inp) + +el.dataset.d) * 100) / 100); inp.value = String(v); CHANGE[a](inp); },
  mfind: el => { Object.assign(MARKET_F, { tab: "all", pos: el.dataset.k, arch: "", int: "sign" }); PAGE = "market"; render(); scrollTo(0, 0); },
  mtab: el => { MARKET_F.tab = el.dataset.k; render(); },
  loanredo: el => { const p = P(+el.dataset.id), r = redoLoan(p, +$("#rshare").value / 100); LOAN_SAY = r.ok ? null : { id: p.id, t: r.t }; toast(r.t); playerModal(p.id); render(); saveGame(); },
  loanask: el => { const p = P(+el.dataset.id), share = +($("#lshare") ? $("#lshare").value : 50) / 100, r = askLoan(p, share);
    LOAN_SAY = r.ok ? null : { id: p.id, t: r.t };
    if (r.ok) { toast(r.t); closeModal(); } else playerModal(p.id);
    render(); saveGame(); },
  sort: el => { const [id, k] = el.dataset.v.split("|"), cur = SORTS[id]; SORTS[id] = { k, d: cur && cur.k === k ? -cur.d : SORT_UP.includes(k) ? 1 : -1 }; render(); },
  choose: el => { const m = G.inbox.find(x => x.id === +el.dataset.id); if (m) answerChoice(m, +el.dataset.i); render(); saveGame(); },
  seekinv: () => { G.board.offers = investmentOffers(); if (!G.board.offers.length) toast("You can't sell any more without losing control."); render(); },
  sellstake: async el => { const o = G.board.offers[+el.dataset.i]; if (o && await ask(`Sell ${o.pct}% of the club to ${o.name} for ${money(o.amt)}?`)) { sellStake(o); render(); saveGame(); } },
  buyback: async el => { const i = G.board.inv[+el.dataset.i]; if (await ask(`Buy back ${i.name}'s ${i.pct}% for ${money(buyBackPrice(i))} of your own money?`)) { buyBack(+el.dataset.i); render(); saveGame(); } },
  dircands: el => dirModal(el.dataset.k),
  hiredir: el => { const d = DIRC[+el.dataset.i]; G.board.dir[d.role] = d; news(`${d.name} is appointed ${DIRECTORS[d.role].l.toLowerCase()}.`); closeModal(); render(); saveGame(); },
  firedir: async el => { const k = el.dataset.k, d = G.board.dir[k]; if (await ask(`Dismiss ${d.name}? Half a year's pay.`)) { spend("directors", d.wage / 2); G.board.dir[k] = null; render(); } },
  meettrust: () => { meetTrust(); render(); },
  trustseat: async () => { if (await ask("Give the supporters' trust a seat on the board?")) { G.sTrust.seat = true; trustRel(12, "A supporters' trust director joins the board."); moodHit(my(), 3); render(); } },
  setobj: () => { const o = {}; for (const k of Object.keys(OBJ)) o[k] = $("#obj-" + k).value; setObjectives(o); render(); saveGame(); },
  objreset: () => { G.obj = null; render(); },
  approach: el => { approachPartner(CL(+el.dataset.id)); render(); saveGame(); },
  endpartner: async el => { const id = +el.dataset.id; if (await ask(`End the partnership with ${CL(id).name}?`)) { endPartner(id); render(); saveGame(); } },
  addfeeder: el => { addFeeder(CL(+el.dataset.id)); render(); saveGame(); },
  dropfeeder: async el => { if (await ask("End this feeder arrangement?")) { dropFeeder(+el.dataset.id); render(); } },
  repayloan: el => { repayLoan(+el.dataset.id); render(); saveGame(); },
  loanq: async () => { const amt = num($("#ln-amt")), yrs = +$("#ln-yrs").value, t = loanTerms(amt, yrs);
    if (amt <= 0) return; if (amt > t.max) return toast(`The bank will lend at most ${money(t.max)}.`);
    const block = boardBlocks(amt); if (block) return toast(block);
    if (await ask(`Borrow ${money(amt)} over ${yrs} years at ${(t.rate * 100).toFixed(1)}%: ${money(t.weekly)} a week, ${money(t.weekly * yrs * 52)} in all?`)) { takeLoan(amt, yrs); render(); saveGame(); } },
  olend: () => { ownerLend(num($("#ol-amt"))); render(); }, orecall: () => { ownerRecall(num($("#ol-amt"))); render(); },
  heat: async () => { const q = heatQuote(my()); if (await ask(`Install undersoil heating for ${money(q.cost)}?`)) { built(startBuild("stadium", { type: "heat", ...q, label: "undersoil heating" })); render(); saveGame(); } },
  page: el => { PAGE = el.dataset.p; MAST_COMPACT = false; closeModal(); render(); scrollTo(0, 0); lastY = 0; },
  sub: el => { SUB[el.dataset.k] = el.dataset.v; render(); },
  adv: el => advanceN(+el.dataset.n || 1),
  advmenu: () => modal(`<div class="modal-h"><h2>Continue</h2><button class="btn modal-x" data-act="close">✕</button></div><div class="modal-b"><div class="stack">
    <button class="btn" data-act="adv" data-n="1">One week</button><button class="btn" data-act="adv" data-n="4">Four weeks</button>
    <button class="btn" data-act="advto" data-k="phase">${G.phase === "summer" ? "To the start of the season" : "To the end of the season"}</button>
    <p class="small muted">Stops early when something needs your answer.</p></div></div>`),
  advto: () => { const ph = G.phase, y = G.year; advanceN(80, () => (G.phase !== ph && !(ph === "season" && G.phase === "playoffs" && !myPlayoff())) || G.year !== y); },
  close: () => { if (ASKING) return ACT.askno(); closeModal(); }, closebg: (el, e) => { if (e.target === el) ACT.close(); },
  club: el => clubModal(+el.dataset.id), player: el => playerModal(+el.dataset.id),
  bidctr: el => { const m = G.inbox.find(x => x.id === +el.dataset.id); if (!m) return; const t = counterBid(m, num($("#ctr" + m.id))); BID_SAY = t ? { id: m.id, t } : null; if (t) toast(t); render(); saveGame(); },
  war: el => { const w = G.inbox.find(x => x.id === +el.dataset.id); if (!w || w.done) return; const v = el.dataset.v; if (v === "sell") warSell(w, false); else if (v === "keep") warKeep(w); else { const T = warRaise(w); toast(`Best offer now: ${CL(T.id).name}, ${money(T.amt)}.`); } render(); saveGame(); },
  bid: el => { const m = G.inbox.find(x => x.id === +el.dataset.id); if (m) answerBid(m, el.dataset.v === "2" ? 2 : el.dataset.v === "1", false); render(); saveGame(); },
  suggest: el => { const p = P(+el.dataset.id); suggest(p, !!el.dataset.loan); if (document.querySelector(".modal")) playerModal(p.id); render(); saveGame(); },
  nfs: el => { const p = P(+el.dataset.id); setNotForSale(p, !p.nfs); toast(p.nfs ? `${p.name} is not for sale: no club will bid for him.` : `${p.name} is available again.`); playerModal(p.id); render(); saveGame(); },
  loanlist: el => { const p = P(+el.dataset.id); loanListToggle(p); playerModal(p.id); render(); saveGame(); },
  aselall: () => { const ids = my().squad.filter(id => P(id).acad); if (ASEL.size === ids.length) ASEL.clear(); else ids.forEach(id => ASEL.add(id)); render(); },
  abulk: async el => {
    const c = my(), v = el.dataset.v, ps = [...ASEL].map(P).filter(p => p && p.acad && p.club === c.id); if (!ps.length) return;
    const y = staffOf("youth"), over = y && ["release", "promote", "keep"].includes(v) ? youthOverrides(v, ps) : [];
    const warn = over.length ? ` ${y.name} ${v === "release" ? `rates ${over.length === ps.length && over.length > 1 ? "all of them" : over.map(p => p.name).join(", ")} and won't like it` : v === "promote" ? `doesn't think ${over.map(p => p.name).join(", ")} ${over.length > 1 ? "are" : "is"} ready` : `would let ${over.map(p => p.name).join(", ")} go`}.` : "";
    if (v === "release" && !await ask(`Release ${ps.length} academy player${ps.length > 1 ? "s" : ""}? ${ps.map(p => p.name).join(", ")}.${warn}`)) return;
    if (v === "promote" && !await ask(`Offer professional contracts to ${ps.length} academy player${ps.length > 1 ? "s" : ""}? They join the first-team squad.${warn}`)) return;
    if (["release", "promote", "keep"].includes(v)) overruleYouth(v, ps);
    for (const p of ps) {
      if (v === "keep") p.keep = true; else if (v === "unkeep") p.keep = false;
      else if (v === "promote") { p.acad = false; p.yrs = 2; p.wage = Math.max(p.wage, Math.round(demandWage(p, c) / 100) * 100); }
      else if (v === "release") { leaveClub(p); toFreeAgent(p); }
    }
    const names = ps.map(p => p.name).join(", ");
    news(v === "keep" ? `Kept on (they'll be given contracts when they come of age): ${names}.` : v === "unkeep" ? `No longer marked to keep: ${names}.` : v === "promote" ? `Promoted to the first-team squad on professional contracts: ${names}.` : `Released from the academy: ${names}.`, v !== "keep" && v !== "unkeep");
    toast(`${ps.length} player${ps.length > 1 ? "s" : ""} ${v === "keep" ? "kept" : v === "unkeep" ? "unmarked" : v === "promote" ? "promoted" : "released"}.`);
    ASEL.clear(); render(); saveGame();
  },
  force: el => { const p = P(+el.dataset.id); if (!p.force && my().squad.filter(id => P(id).force).length >= MAX_FORCED) return toast(`You can insist on at most ${MAX_FORCED} players.`); p.force = !p.force; p.forceNoted = false; toast(p.force ? `${p.name} will start: the manager has been told.` : `The manager picks ${p.name} on merit again.`); playerModal(p.id); render(); saveGame(); },
  recall: async el => { const p = P(+el.dataset.id); if (!p || !p.loan) return; if (!await ask(`Recall ${p.name} from ${CL(p.club).name}?${recallFee(p) ? ` They're owed ${money(recallFee(p))} for the trouble.` : ""}`)) return; recallLoan(p); closeModal(); render(); saveGame(); },
  keep: el => { const p = P(+el.dataset.id); p.keep = !p.keep; if (p.keep && p.acad) overruleYouth("keep", [p]); toast(p.keep ? `${p.name} is protected: not for sale, and he'll be offered a new contract.` : `${p.name} is no longer protected.`); playerModal(p.id); render(); },
  promote: el => { const p = P(+el.dataset.id), c = my(); overruleYouth("promote", [p]); p.acad = false; p.yrs = 2; p.wage = Math.max(p.wage, Math.round(demandWage(p, c) / 100) * 100); news(`${p.name} is promoted from the academy on a professional contract.`, true); closeModal(); render(); },
  list: el => { const p = P(+el.dataset.id); ownerList(p); playerModal(p.id); render(); saveGame(); },
  release: async el => { const p = P(+el.dataset.id); if (!await ask(`Release ${p.name}?${p.acad ? "" : ` It costs ${money(releaseCost(p))}.`}`)) return; if (p.acad) { overruleYouth("release", [p]); leaveClub(p); toFreeAgent(p); news(`${p.name} is released from the academy.`); } else ownerRelease(p); closeModal(); render(); saveGame(); },
  buy: el => buyModal(+el.dataset.id),
  buygo: el => {
    const p = P(+el.dataset.id), fee = num($("#b-fee")), wage = num($("#b-wage")) * 52, ask = askingFee(p);
    if (fee < ask * .95) return toast(`${p.club >= 0 ? CL(p.club).name : "His club"} turn the offer down. They want about ${money(ask)}.`);
    const a = playerAppeal(p, wage);
    if (a.score < a.pr.thr) return toast(`${p.name} turns you down. ${refusalReason(a, P_FACTORS)}`);
    ownerBuy(p, fee, wage); closeModal(); render(); saveGame();
  },
  cands: el => { HIRE_F.role = el.dataset.r; HIRE_F.phil = HIRE_F.focus = HIRE_F.form = ""; PAGE = "hire"; closeModal(); render(); scrollTo(0, 0); },
  hire: el => {
    const s = CANDS.list[+el.dataset.i], wage = num($("#cw" + el.dataset.i)) * 52, yrs = +$("#cy" + el.dataset.i).value;
    if (!staffDropOK(s)) { toast(empDrop(s) >= 4 ? `${s.name} says no: ${pr(s, "he")} won't leave ${CL(s.emp).name} for a club ${empDrop(s)} divisions lower.` : `${s.name} says no: ${pr(s, "he")} won't drop to the ${TIER_NAME[my().tier]}, whatever the money.`); return; }
    const a = staffAppeal(s, wage);
    if (a.score < a.pr.thr) { toast(`${s.name} says no. ${refusalReason(a, S_FACTORS, s)}`); return; }
    if (s.emp != null) {  // poaching: their club must accept your compensation
      const comp = Math.round(num($("#cc" + el.dataset.i))); s.compTries = (s.compTries || 0) + 1;
      if (comp < poachMin(s)) { const walked = s.compTries >= 3; toast(walked ? `${CL(s.emp).name} end the talks: ${s.name} stays put.` : `${CL(s.emp).name} turn down ${money(comp)}: they want more for ${s.name}.`); if (walked) { s.compBlocked = G.year; closeModal(); render(); } return; }
      s.compOffer = comp;
    }
    hire(s, wage, yrs); closeModal(); if (PAGE === "hire") { PAGE = "staff"; scrollTo(0, 0); } render(); saveGame();
  },
  dismiss: async el => { const s = staffOf(el.dataset.r); if (await ask(`Dismiss ${s.name}? It costs ${money(payoff(s))}.`)) { dismiss(el.dataset.r); G.meddle = (G.meddle || 0) + .5; render(); saveGame(); } },
  renewstaff: el => { const s = staffOf(el.dataset.r), w = staffAsk(s); if (w == null) { toast(`${s.name} won't sign a new contract: ${refusalReason(staffAppeal(s, s.wage * 1.5), S_FACTORS, s)}`); return; } s.wage = Math.max(w, s.wage); s.yrs = 3; s.expiring = false; news(`${s.name} signs a new three-year contract (${money(s.wage)} a year).`); render(); saveGame(); },
  invest: el => { invest(+el.dataset.v); render(); }, investx: () => { invest(num($("#inv-amt"))); render(); }, withdraw: () => { withdraw(num($("#inv-amt"))); render(); },
  sponsor: el => { if (!commOpen()) return toast("Deals can only be signed in pre-season."); const o = my().offers.filter(x => x.slot === el.dataset.k)[+el.dataset.i]; if (o) acceptOffer(o); render(); saveGame(); },
  askoffers: el => { if (!commOpen()) return toast("The agency only negotiates in pre-season."); const c = my(), k = el.dataset.k; (c.ask ||= {})[k] = G.week + G.year * 100; refreshOffers(c, k); const n = c.offers.filter(o => o.slot === k).length; toast(n ? `The agency comes back with ${n} offer${n > 1 ? "s" : ""}.` : "No offers came back this time."); render(); saveGame(); },
  host: el => { const i = el.dataset.i === "home" ? "home" : +el.dataset.i; setGround(my(), i); news(i === "home" ? `The club moves back to ${my().fac.stadium.name}.` : `The club moves to ${HOSTS[i].name}.`); render(); saveGame(); },
  buildst: async () => { const d = G.stDraft || standPlan(1500), q = groundQuote(d), name = ($("#st-name").value || my().town + " Park").trim();
    if (q.cap > SITE_MAX) return toast(`No site takes more than ${SITE_MAX.toLocaleString()}.`);
    if (!await ask(`Build ${name} (${q.cap.toLocaleString()} capacity) for ${money(q.cost)}?`)) return;
    built(startBuild("stadium", { type: "new", ...q, vent: d.vent || [], name, stands: d.stands, family: d.family, corp: d.corp, label: `building ${name}, ${q.cap.toLocaleString()} capacity` })); G.stDraft = null; render(); saveGame(); },
  stplan: el => { if (my().fac.stadium.own) G.rgOpen = true; const keep = G.stDraft; G.stDraft = standPlan(+el.dataset.n); if (keep) { G.stDraft.family = keep.family; G.stDraft.vent = keep.vent || []; for (const k in SIDES) { G.stDraft.stands[k].type = keep.stands[k].type; G.stDraft.stands[k].roof = keep.stands[k].roof; } } render(); },
  sdnofam: () => { G.stDraft.family = ""; render(); },
  extend: async el => { const k = el.dataset.k, n = Math.round(num($("#ext-" + k)) / 50) * 50; if (n < 50) return toast("Add at least 50 places.");
    if (n > siteRoom(my().fac.stadium)) return toast(`Only room for ${siteRoom(my().fac.stadium).toLocaleString()} more places on this site.`);
    const q = standQuote(my(), k, n); if (!await ask(`Extend the ${SIDES[k]} by ${n.toLocaleString()} for ${money(q.cost)} (about ${q.weeks} weeks)? The stand's ${standsOf(my().fac.stadium)[k].cap.toLocaleString()} places close until it's done.`)) return;
    built(startBuild("stadium", { type: "expand", ...q, label: `extending the ${SIDES[k]} (+${n.toLocaleString()})` })); render(); saveGame(); },
  rebuild: async el => { const k = el.dataset.k, c = my(), r = (G.rb || {})[k] || standsOf(c.fac.stadium)[k], q = rebuildQuote(c, k, r.cap, r.type, r.roof), S0 = c.fac.stadium;
    if (S0.cap - standsOf(S0)[k].cap + r.cap > siteCap(S0)) return toast("Too big for the site.");
    if (!await ask(`Demolish the ${SIDES[k]} and build ${r.cap.toLocaleString()} ${r.type === "terrace" ? "terrace places" : "seats"} for ${money(q.cost)}? It's closed for about ${q.weeks} weeks.`)) return;
    built(startBuild("stadium", { type: "rebuild", ...q, label: `rebuilding the ${SIDES[k]} (${r.cap.toLocaleString()})` })); G.rb = {}; G.rbOpen = null; render(); saveGame(); },
  mvsite: el => { G.moveK = el.dataset.k; G.plotN = null; G.mvOpen = true; render(); },
  mvstay: el => { G.mvStay = el.dataset.v; G.mvOpen = true; render(); },
  mvplot: el => { G.plotN = +el.dataset.n; G.mvOpen = true; render(); },
  mvplan: el => { G.mvOpen = true; const keep = G.mvDraft; G.mvDraft = standPlan(+el.dataset.n); if (keep) { G.mvDraft.family = keep.family; G.mvDraft.vent = keep.vent || []; for (const k in SIDES) { G.mvDraft.stands[k].type = keep.stands[k].type; G.mvDraft.stands[k].roof = keep.stands[k].roof; } } render(); },
  movebuild: async () => { const c = my(), sites = newSites(c), site = sites.find(x => x.k === G.moveK) || sites[1], plots = plotSizes(c, site), plot = plots.includes(G.plotN) ? G.plotN : plots[Math.min(1, plots.length - 1)], d = G.mvDraft, q = moveQuote(c, d, site, plot), name = ($("#mv-name").value || c.town + " Stadium").trim();
    if (q.space > plot) return toast(`The stands and extras need room for ${q.space.toLocaleString()}; this plot takes ${plot.toLocaleString()}.`);
    const rent = G.mvStay === "rent", S = c.fac.stadium, h = tempHost(c);
    if (!await ask(`Buy a plot ${site.km} km away (room for ${plot.toLocaleString()}) and build ${name} (${q.cap.toLocaleString()}) for ${money(q.cost)}? About ${q.weeks} weeks. ${rent ? `${S.name} is sold now for about ${money(q.sell)} and home games move to ${HOSTS[h].name} until the new ground opens.` : `You keep playing at ${S.name} and sell it on moving day.`}${site.km > 9 ? " Supporters won't like it." : ""}`)) return;
    const res = startBuild("stadium", { type: "move", ...q, vent: d.vent || [], sold: rent, name, stands: d.stands, family: d.family, corp: d.corp, label: `building ${name} (${q.cap.toLocaleString()}), ${site.km} km away` });
    if (S.build && S.build.type === "move") { if (rent) { earn("oldground", q.sell); S.soldOld = true; S.rebuilding = true; S.away = h; c.cap = capacity(c); news(`${S.name} is sold for ${money(q.sell)}. Home games move to ${HOSTS[h].name} until ${name} opens.`, true); } moveAnnounced(c, site.km); }
    built(res); G.mvDraft = null; G.mvOpen = false; G.sites = null; render(); saveGame(); },
  reground: async () => { const c = my(), S = c.fac.stadium, d = G.stDraft || standPlan(S.cap), q = regroundQuote(c, d), h = tempHost(c);
    if (q.space > siteCap(S)) return toast(`The stands and extras need room for ${q.space.toLocaleString()}; the site takes ${siteCap(S).toLocaleString()}.`);
    if (!await ask(`Demolish ${S.name} and build a new ${q.cap.toLocaleString()}-capacity ground for ${money(q.cost)}? About ${q.weeks} weeks, playing at ${HOSTS[h].name} meanwhile.`)) return;
    const res = startBuild("stadium", { type: "reground", ...q, vent: d.vent || [], name: S.name, stands: d.stands, family: d.family, corp: d.corp, label: `rebuilding ${S.name}, ${q.cap.toLocaleString()} capacity` });
    if (S.build && S.build.type === "reground") { S.build.host = h; S.rebuilding = true; S.away = h; c.cap = capacity(c); news(`${S.name} closes for rebuilding. Home games move to ${HOSTS[h].name}.`, true); }
    built(res); G.stDraft = null; G.rgOpen = false; render(); saveGame(); },
  roof: async el => { const k = el.dataset.k, q = roofQuote(my(), k); if (!await ask(`Put a roof on the ${SIDES[k]} for ${money(q.cost)}? It closes for about ${q.weeks} weeks.`)) return; built(startBuild("stadium", { type: "roof", ...q, label: `a roof for the ${SIDES[k]}` })); render(); saveGame(); },
  convert: async el => { const k = el.dataset.k, q = convertQuote(my(), k); if (!await ask(`Make the ${SIDES[k]} ${q.to === "seat" ? "all-seated" : "a terrace"} for ${money(q.cost)}? It closes for about ${q.weeks} weeks.`)) return; built(startBuild("stadium", { type: "convert", ...q, label: `${q.to === "seat" ? "seating" : "terracing"} the ${SIDES[k]}` })); render(); saveGame(); },
  family: async el => { const k = el.dataset.k, x = standsOf(my().fac.stadium)[k]; if (!x.family && !await ask(`Make the ${SIDES[k]} the family stand for ${money(familyCost(my(), k))}?`)) return; setFamily(my(), k); render(); saveGame(); },
  corp: async () => { const c = my(), n = Math.min(Math.round(num($("#corp-n"))), corpMax(c) - corpSeats(c)); if (n < 1) return; const q = corpQuote(c, n); if (!await ask(`Fit ${n} corporate seats in the Main stand for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "corp", ...q, label: `${n} corporate seats` })); render(); saveGame(); },
  expand: async el => { if (+el.dataset.n > siteRoom(my().fac.stadium)) return toast("No room on the site."); const q = expandQuote(my(), +el.dataset.n); if (!await ask(`Build a ${q.add.toLocaleString()}-seat stand for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "expand", ...q, label: `a new ${q.add.toLocaleString()}-capacity stand` })); render(); saveGame(); },
  amen: () => { const q = amenQuote(my()); built(startBuild("stadium", { type: "amen", ...q, label: `stadium facilities to level ${q.lvl}` })); render(); saveGame(); },
  suites: () => { const q = suiteQuote(my()); built(startBuild("stadium", { type: "suites", ...q, label: `${q.add} executive suites` })); render(); saveGame(); },
  relay: async el => { const k = el.dataset.k; if (!await ask(`Re-lay the pitch with ${PITCH[k].l.toLowerCase()} for ${money(PITCH[k].cost(my()))}?`)) return; relayPitch(k); render(); saveGame(); },
  vent: async el => { const k = el.dataset.k; if (!await ask(`Build the ${VENTURES[k].l.toLowerCase()} for ${money(VENTURES[k].cost(my()))}?`)) return; buildVenture(k); render(); saveGame(); },
  popupoff: async () => { if (await ask("End the pop-up fan zone? Supporters will be disappointed.")) { my().fac.stadium.popup = false; moodHit(my(), -2); trustRel(-3); news("The pop-up fan zone is wound up."); render(); } },
  unvent: async el => { if (await ask(`Close the ${VENTURES[el.dataset.k].l.toLowerCase()}?`)) { closeVenture(el.dataset.k); render(); } },
  upfac: el => { const k = el.dataset.k, lvl = my().fac[k].lvl + 1; built(startBuild(k, { lvl, cost: facCost(k, lvl), weeks: facWeeks(lvl), label: `${FAC_NAME[k].toLowerCase()} to level ${lvl}` })); render(); saveGame(); },
  export: async () => {
    const data = JSON.stringify(G), filename = `${(my() ? my().short : "owner").toLowerCase()}-${G.year}.json`;
    try { const dl = window.claude && await window.claude.use("downloads"); if (dl) { await dl.save({ filename, data: new Blob([data], { type: "application/json" }) }); return toast("Save file exported."); } } catch (e) { if (e && e.code === "declined") return; }
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = filename; a.click(); } catch (e) { toast("Couldn't export the save here."); }
  },
  quit: async () => { await saveGame(); start(); },
  load: el => loadSave(el.dataset.id),
  delsave: async el => { if (!await ask("Delete this career?")) return; await dbDo("readwrite", st => st.delete(el.dataset.id)); start(); },
  found: async () => {
    const name = $("#f-name").value.trim(); if (!name) return toast("Give your club a name.");
    const sel = id => ($(`#${id} [aria-pressed="true"]`) || {}).dataset?.v;
    $("#busy").hidden = false; await new Promise(r => setTimeout(r, 30));
    newWorld({ name, town: $("#f-town").value.trim() || name.split(" ")[0], short: ($("#f-short").value.trim() || name).toUpperCase(), owner: $("#f-owner").value.trim(), vision: JSON.parse(JSON.stringify(START_V)), half: sel("f-half") || "N", color: sel("f-color"), wealth: sel("f-wealth") || "wealthy" });
    startSeason(); refreshOffers(my());
    $("#busy").hidden = true; PAGE = "home"; render(); saveGame();
  },
};
const CHANGE = {
  starhunt: el => { G.starHunt = el.checked; toast(el.checked ? "Your head of recruitment may now chase stars on huge wages." : "Your head of recruitment will leave the stars alone."); render(); },
  price: el => { const c = my(), k = el.dataset.k, v = num(el);
    if (k === "ticket" && G.sTrust && G.sTrust.freeze === G.year && v > c.prices.ticket) { toast("You promised the supporters' trust a price freeze this season."); render(); return; }
    c.prices[k] = v; render(); },
  ffund: el => { const f = net().feeders.find(x => x.id === +el.dataset.id); if (f) f.fund = Math.round(num(el)); render(); },
  loanout: async el => { if (!el.value) return; const p = P(+el.dataset.id), x = CL(+el.value); if (await ask(`Loan ${p.name} to ${x.name} until the end of the season?`)) { loanOut(p, x); closeModal(); render(); saveGame(); } },
  budget: el => { const c = my(), k = el.dataset.k, v = Math.round(num(el)), old = c.budget[k]; c.budget[k] = v;
    // Staff notice their budgets being cut hard.
    const role = { wages: "manager", transfer: "recruit", scout: "recruit", acad: "youth" }[k]; if (v < old * .7 && staffOf(role)) meddled(role, -4, `isn't happy about the ${k === "acad" ? "academy" : k} budget being cut.`);
    render(); },
  fweek: el => { SUB.fw = +el.value; },
  oname: el => { const v = el.value.trim(); if (v) { G.owner.name = v; saveGame(); render(); } },
  concerts: el => { my().fac.stadium.concerts = +el.value; render(); },
  vset: el => { if (el.closest("#f-vision")) { START_V[el.dataset.k] = el.value; return; } vision()[el.dataset.k] = el.value; render(); },
  buyf: el => { BUYF[el.dataset.k] = el.type === "checkbox" ? el.checked : +el.value; render(); },
  lgsel: el => { SUB.league = el.value; render(); },
  sd: el => { const d = (G.stDraft ||= standPlan(my().fac.stadium.own ? my().fac.stadium.cap : 1500)), k = el.dataset.k; if (my().fac.stadium.own) G.rgOpen = true;
    if (k === "family") d.family = el.value; else if (k === "corp") d.corp = Math.max(0, Math.min(Math.round(num(el)), Math.floor((d.stands.W.cap || 0) * .15)));
    else if (k.startsWith("vent.")) { const v = k.slice(5); d.vent = (d.vent || []).filter(x => x !== v); if (el.checked) d.vent.push(v); if (!el.checked && v === "shop") d.vent = d.vent.filter(x => x !== "mega"); }
    else { const [s, f] = k.split("."); d.stands[s][f] = f === "cap" ? Math.max(0, Math.round(num(el) / 50) * 50) : f === "roof" ? el.checked : el.value; }
    render(); },
  stname: el => { G.stName = el.value.trim(); },
  extn: el => { (G.extN ||= {})[el.dataset.k] = Math.max(50, Math.round(num(el) / 50) * 50); render(); },
  stfin: el => { (G.stFin ||= { share: 0, years: 25 })[el.dataset.k] = +el.value; render(); },
  mvname: el => { G.mvName = el.value.trim(); },
  mvsd: el => { const d = G.mvDraft, k = el.dataset.k; G.mvOpen = true; if (!d) return;
    if (k === "family") d.family = el.value; else if (k === "corp") d.corp = Math.max(0, Math.min(Math.round(num(el)), Math.floor((d.stands.W.cap || 0) * .15)));
    else if (k.startsWith("vent.")) { const v = k.slice(5); d.vent = (d.vent || []).filter(x => x !== v); if (el.checked) d.vent.push(v); if (!el.checked && v === "shop") d.vent = d.vent.filter(x => x !== "mega"); }
    else { const [s, f] = k.split("."); d.stands[s][f] = f === "cap" ? Math.max(0, Math.round(num(el) / 50) * 50) : f === "roof" ? el.checked : el.value; }
    render(); },
  rb: el => { const [s, f] = el.dataset.k.split("."), x = standsOf(my().fac.stadium)[s], r = ((G.rb ||= {})[s] ||= { cap: x.cap, type: x.type, roof: x.roof });
    r[f] = f === "cap" ? Math.max(0, Math.round(num(el) / 50) * 50) : f === "roof" ? el.checked : el.value; G.rbOpen = s; render(); },
  msel: el => { SUB.my = el.value === "all" ? "all" : +el.value; render(); },
  reg: el => { const p = P(+el.dataset.id), e = toggleReg(p); if (e) toast(e); render(); saveGame(); },
  asel: el => { const id = +el.dataset.id; if (el.checked) ASEL.add(id); else ASEL.delete(id); render(); },
  pcty: el => { SUB.pcty = el.value; SUB.plg = ""; render(); },
  plg: el => { SUB.plg = el.value; render(); },
  hf: el => { const k = el.dataset.k; HIRE_F[k] = ["phil", "focus", "form", "vis", "st"].includes(k) ? el.value : +el.value || 0; render(); },
  mf: el => { const k = el.dataset.k; MARKET_F[k] = ["pos", "arch", "int", "lg"].includes(k) ? el.value : +el.value || 0;
    if (k === "pos" && MARKET_F.arch && !(ARCHETYPES[el.value] || []).some(a => a[0] === MARKET_F.arch)) MARKET_F.arch = "";
    if (k === "arch" && el.value && MARKET_F.pos && !(ARCHETYPES[MARKET_F.pos] || []).some(a => a[0] === el.value)) MARKET_F.pos = "";
    render(); },
};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.tagName === "SELECT" || el.tagName === "INPUT") return;
  // pickers on the start screen
  const grp = el.closest("#f-half, #f-color, #f-wealth"); if (grp) { grp.querySelectorAll("[aria-pressed]").forEach(b => b.setAttribute("aria-pressed", b === el)); return; }
  const f = ACT[el.dataset.act]; if (f) f(el, e);
});
document.addEventListener("click", e => { const b = e.target.closest("#f-half button, #f-color button, #f-wealth button"); if (b) b.parentNode.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); });
document.addEventListener("change", e => {
  const el = e.target;
  if (el.id === "imp" && el.files[0]) { el.files[0].text().then(t => { try { G = JSON.parse(t); upgradeSave(); G.saveId = "c" + Date.now(); PAGE = "home"; render(); saveGame(); toast("Save imported."); } catch { toast("That isn't a save file."); } }); return; }
  const f = CHANGE[el.dataset.act]; if (f) f(el);
});
// Boxes that don't redraw the page (offers, loans, amounts) tidy their figure when you leave them.
document.addEventListener("focusout", e => { const el = e.target; if (el.classList && el.classList.contains("num-in") && el.value.trim()) el.value = fmtNum(num(el)); });
document.addEventListener("keydown", e => { if (e.key === "Escape") ACT.close(); });
try { if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && window.top === window) { navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => r.update()).catch(() => { });
  // When a new version takes over, reload once so you are never left looking at the old one.
  let reloaded = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloaded || busy) return; reloaded = true; location.reload(); }); } } catch (e) { }
window.claude?.hot?.snapshot?.(() => ({ G, PAGE }));
start();

/* On a phone the masthead is a third of the screen. Scrolling down shrinks it to the club
   name and the Continue button; scrolling up (or reaching the top) brings back the numbers and the section tabs. */
const phoneWidth = () => matchMedia("(max-width:760px)").matches;
let lastY = 0, upRun = 0, downRun = 0;
function setCompact(on) {
  const m = document.querySelector(".mast"); MAST_COMPACT = on; if (!m) return;
  const before = m.getBoundingClientRect().height;
  m.classList.toggle("compact", on);
  if (!on) { const nav = m.querySelector("nav.tabs"); if (nav) nav.scrollLeft = NAV_X; }
  // The masthead is sticky and takes up room in the page: scroll by the change so what you were reading stays put.
  const d = before - m.getBoundingClientRect().height; if (d) window.scrollBy(0, -d);
  lastY = scrollY; upRun = downRun = 0;
}
window.addEventListener("scroll", () => {
  const y = scrollY, dy = y - lastY; lastY = y;
  if (!phoneWidth() || !document.querySelector(".mast")) return;
  if (dy > 0) { downRun += dy; upRun = 0; } else { upRun -= dy; downRun = 0; }
  if (!MAST_COMPACT && y > 140 && downRun > 40) setCompact(true);
  else if (MAST_COMPACT && (y < 30 || upRun > 70)) setCompact(false);
}, { passive: true });
window.addEventListener("resize", () => { if (!phoneWidth() && MAST_COMPACT) setCompact(false); });
// iPhones close web apps in the background without warning: save whenever the game is put away.
document.addEventListener("visibilitychange", () => { if (document.hidden && G && G.club != null) saveGame(); });
window.addEventListener("pagehide", () => { if (G && G.club != null) saveGame(); });
