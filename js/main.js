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
  if (!G.foreign2) { for (const id of G.foreign) CL(id).lvl = Math.max(CL(id).lvl, 72) + 1.5; G.foreign2 = true; }
  // 0.14.2: intakes got bigger, so a career from before runs this year's intake again, once (on top of the boys it has).
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
  if (!G.intake2) { G.intake2 = true; if (G.club != null && my() && my().fac.acad.lvl) { youthIntake(my()); saveGame(); } }
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
    const s = CANDS.list[+el.dataset.i], wage = num($("#cw" + el.dataset.i)), yrs = +$("#cy" + el.dataset.i).value;
    if (!staffDropOK(s)) { toast(`${s.name} says no: ${pr(s, "he")} won't drop to the ${TIER_NAME[my().tier]}, whatever the money.`); return; }
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
  sponsor: el => { const o = my().offers.filter(x => x.slot === el.dataset.k)[+el.dataset.i]; if (o) acceptOffer(o); render(); saveGame(); },
  askoffers: el => { const c = my(), k = el.dataset.k; (c.ask ||= {})[k] = G.week + G.year * 100; refreshOffers(c, k); const n = c.offers.filter(o => o.slot === k).length; toast(n ? `The agency comes back with ${n} offer${n > 1 ? "s" : ""}.` : "No offers came back this time."); render(); saveGame(); },
  host: el => { const i = el.dataset.i === "home" ? "home" : +el.dataset.i; setGround(my(), i); news(i === "home" ? `The club moves back to ${my().fac.stadium.name}.` : `The club moves to ${HOSTS[i].name}.`); render(); saveGame(); },
  buildst: async () => { const d = G.stDraft || standPlan(1500), q = groundQuote(d), name = ($("#st-name").value || my().town + " Park").trim();
    if (!await ask(`Build ${name} (${q.cap.toLocaleString()} capacity) for ${money(q.cost)}?`)) return;
    built(startBuild("stadium", { type: "new", ...q, name, stands: d.stands, family: d.family, corp: d.corp, label: `building ${name}, ${q.cap.toLocaleString()} capacity` })); G.stDraft = null; render(); saveGame(); },
  stplan: el => { const keep = G.stDraft; G.stDraft = standPlan(+el.dataset.n); if (keep) { G.stDraft.family = keep.family; for (const k in SIDES) { G.stDraft.stands[k].type = keep.stands[k].type; G.stDraft.stands[k].roof = keep.stands[k].roof; } } render(); },
  sdnofam: () => { G.stDraft.family = ""; render(); },
  extend: async el => { const k = el.dataset.k, n = Math.round(num($("#ext-" + k)) / 50) * 50; if (n < 50) return toast("Add at least 50 places.");
    const q = standQuote(my(), k, n); if (!await ask(`Extend the ${SIDES[k]} by ${n.toLocaleString()} for ${money(q.cost)} (about ${q.weeks} weeks)?`)) return;
    built(startBuild("stadium", { type: "expand", ...q, label: `extending the ${SIDES[k]} (+${n.toLocaleString()})` })); render(); saveGame(); },
  roof: async el => { const k = el.dataset.k, q = roofQuote(my(), k); if (!await ask(`Put a roof on the ${SIDES[k]} for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "roof", ...q, label: `a roof for the ${SIDES[k]}` })); render(); saveGame(); },
  convert: async el => { const k = el.dataset.k, q = convertQuote(my(), k); if (!await ask(`Make the ${SIDES[k]} ${q.to === "seat" ? "all-seated" : "a terrace"} for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "convert", ...q, label: `${q.to === "seat" ? "seating" : "terracing"} the ${SIDES[k]}` })); render(); saveGame(); },
  family: async el => { const k = el.dataset.k, x = standsOf(my().fac.stadium)[k]; if (!x.family && !await ask(`Make the ${SIDES[k]} the family stand for ${money(familyCost(my(), k))}?`)) return; setFamily(my(), k); render(); saveGame(); },
  corp: async () => { const c = my(), n = Math.min(Math.round(num($("#corp-n"))), corpMax(c) - corpSeats(c)); if (n < 1) return; const q = corpQuote(c, n); if (!await ask(`Fit ${n} corporate seats in the Main stand for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "corp", ...q, label: `${n} corporate seats` })); render(); saveGame(); },
  expand: async el => { const q = expandQuote(my(), +el.dataset.n); if (!await ask(`Build a ${q.add.toLocaleString()}-seat stand for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "expand", ...q, label: `a new ${q.add.toLocaleString()}-capacity stand` })); render(); saveGame(); },
  amen: () => { const q = amenQuote(my()); built(startBuild("stadium", { type: "amen", ...q, label: `stadium facilities to level ${q.lvl}` })); render(); saveGame(); },
  suites: () => { const q = suiteQuote(my()); built(startBuild("stadium", { type: "suites", ...q, label: `${q.add} executive suites` })); render(); saveGame(); },
  relay: async el => { const k = el.dataset.k; if (!await ask(`Re-lay the pitch with ${PITCH[k].l.toLowerCase()} for ${money(PITCH[k].cost(my()))}?`)) return; relayPitch(k); render(); saveGame(); },
  vent: async el => { const k = el.dataset.k; if (!await ask(`Build the ${VENTURES[k].l.toLowerCase()} for ${money(VENTURES[k].cost(my()))}?`)) return; buildVenture(k); render(); saveGame(); },
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
  sd: el => { const d = (G.stDraft ||= standPlan(1500)), k = el.dataset.k;
    if (k === "family") d.family = el.value; else if (k === "corp") d.corp = Math.max(0, Math.min(Math.round(num(el)), Math.floor((d.stands.W.cap || 0) * .15)));
    else { const [s, f] = k.split("."); d.stands[s][f] = f === "cap" ? Math.max(0, Math.round(num(el) / 50) * 50) : f === "roof" ? el.checked : el.value; }
    render(); },
  stname: el => { G.stName = el.value.trim(); },
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
