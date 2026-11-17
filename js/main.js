/* Boot, saves (IndexedDB, one record per career) and the button router. */
"use strict";

const DB = { name: "touchline-owner", store: "saves" };
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

const built = r => { if (typeof r === "string") toast(r); };
const ACT = {
  putsale: () => { G.saleOffers = saleOffers(); render(); },
  acceptsale: el => { const o = G.saleOffers[+el.dataset.i]; if (confirm(`Sell your ${ownPct()}% of ${my().name} to ${o.name} for ${money(o.amt)}? You'll then choose a new club.`)) { sellMyClub(o); render(); saveGame(); } },
  buyclub: el => { const c = CL(+el.dataset.id); if (confirm(`Buy ${c.name} for ${money(askPrice(c))}?`)) { buyClub(c); PAGE = "home"; render(); saveGame(); } },
  choose: el => { const m = G.inbox.find(x => x.id === +el.dataset.id); if (m) answerChoice(m, +el.dataset.i); render(); saveGame(); },
  seekinv: () => { G.board.offers = investmentOffers(); if (!G.board.offers.length) toast("You can't sell any more without losing control."); render(); },
  sellstake: el => { const o = G.board.offers[+el.dataset.i]; if (o && confirm(`Sell ${o.pct}% of the club to ${o.name} for ${money(o.amt)}?`)) { sellStake(o); render(); saveGame(); } },
  buyback: el => { const i = G.board.inv[+el.dataset.i]; if (confirm(`Buy back ${i.name}'s ${i.pct}% for ${money(buyBackPrice(i))} of your own money?`)) { buyBack(+el.dataset.i); render(); saveGame(); } },
  dircands: el => dirModal(el.dataset.k),
  hiredir: el => { const d = DIRC[+el.dataset.i]; G.board.dir[d.role] = d; news(`${d.name} is appointed ${DIRECTORS[d.role].l.toLowerCase()}.`); closeModal(); render(); saveGame(); },
  firedir: el => { const k = el.dataset.k, d = G.board.dir[k]; if (confirm(`Dismiss ${d.name}? Half a year's pay.`)) { spend("directors", d.wage / 2); G.board.dir[k] = null; render(); } },
  meettrust: () => { meetTrust(); render(); },
  trustseat: () => { if (confirm("Give the supporters' trust a seat on the board?")) { G.sTrust.seat = true; trustRel(12, "A supporters' trust director joins the board."); moodHit(my(), 3); render(); } },
  setobj: () => { const o = {}; for (const k of Object.keys(OBJ)) o[k] = $("#obj-" + k).value; setObjectives(o); render(); saveGame(); },
  objreset: () => { G.obj = null; render(); },
  approach: el => { approachPartner(CL(+el.dataset.id)); render(); saveGame(); },
  endpartner: () => { if (confirm("End the partnership?")) { news(`The partnership with ${CL(net().partner.id).name} ends.`); net().partner = null; render(); } },
  addfeeder: el => { addFeeder(CL(+el.dataset.id)); render(); saveGame(); },
  dropfeeder: el => { if (confirm("End this feeder arrangement?")) { dropFeeder(+el.dataset.id); render(); } },
  repayloan: el => { repayLoan(+el.dataset.id); render(); saveGame(); },
  loanq: () => { const amt = +$("#ln-amt").value || 0, yrs = +$("#ln-yrs").value, t = loanTerms(amt, yrs);
    if (amt <= 0) return; if (amt > t.max) return toast(`The bank will lend at most ${money(t.max)}.`);
    const block = boardBlocks(amt); if (block) return toast(block);
    if (confirm(`Borrow ${money(amt)} over ${yrs} years at ${(t.rate * 100).toFixed(1)}%: ${money(t.weekly)} a week, ${money(t.weekly * yrs * 52)} in all?`)) { takeLoan(amt, yrs); render(); saveGame(); } },
  olend: () => { ownerLend(+$("#ol-amt").value || 0); render(); }, orecall: () => { ownerRecall(+$("#ol-amt").value || 0); render(); },
  heat: () => { const q = heatQuote(my()); if (confirm(`Install undersoil heating for ${money(q.cost)}?`)) { built(startBuild("stadium", { type: "heat", ...q, label: "undersoil heating" })); render(); saveGame(); } },
  page: el => { PAGE = el.dataset.p; closeModal(); scrollTo(0, 0); render(); },
  sub: el => { SUB[el.dataset.k] = el.dataset.v; render(); },
  adv: el => advanceN(+el.dataset.n || 1),
  advmenu: () => modal(`<div class="modal-h"><h2>Continue</h2><button class="btn modal-x" data-act="close">✕</button></div><div class="modal-b"><div class="stack">
    <button class="btn" data-act="adv" data-n="1">One week</button><button class="btn" data-act="adv" data-n="4">Four weeks</button>
    <button class="btn" data-act="advto" data-k="phase">${G.phase === "summer" ? "To the start of the season" : "To the end of the season"}</button>
    <p class="small muted">Stops early when something needs your answer.</p></div></div>`),
  advto: () => { const ph = G.phase, y = G.year; advanceN(80, () => G.phase !== ph && !(ph === "season" && G.phase === "playoffs") || G.year !== y); },
  close: () => closeModal(), closebg: (el, e) => { if (e.target === el) closeModal(); },
  club: el => clubModal(+el.dataset.id), player: el => playerModal(+el.dataset.id),
  bid: el => { const m = G.inbox.find(x => x.id === +el.dataset.id); if (m) answerBid(m, el.dataset.v === "1", false); render(); saveGame(); },
  keep: el => { const p = P(+el.dataset.id); p.keep = !p.keep; toast(p.keep ? `${p.name} is protected: not for sale, and he'll be offered a new contract.` : `${p.name} is no longer protected.`); playerModal(p.id); render(); },
  promote: el => { const p = P(+el.dataset.id), c = my(); p.acad = false; p.yrs = 2; p.wage = Math.max(p.wage, Math.round(demandWage(p, c) * .6 / 100) * 100); news(`${p.name} is promoted from the academy on a professional contract.`, true); closeModal(); render(); },
  sell: el => { const p = P(+el.dataset.id); if (!confirm(`Sell ${p.name}? Your staff weren't consulted.`)) return; const b = ownerSell(p); closeModal(); render(); saveGame(); toast(b ? `${p.name} sold to ${b.name}.` : `Nobody wanted ${p.name}; he was released.`); },
  release: el => { const p = P(+el.dataset.id); if (!confirm(`Release ${p.name}?${p.acad ? "" : ` It costs ${money(releaseCost(p))}.`}`)) return; if (p.acad) { leaveClub(p); toFreeAgent(p); news(`${p.name} is released from the academy.`); } else ownerRelease(p); closeModal(); render(); saveGame(); },
  buy: el => buyModal(+el.dataset.id),
  buygo: el => {
    const p = P(+el.dataset.id), fee = +$("#b-fee").value || 0, wage = +$("#b-wage").value || 0, ask = askingFee(p);
    if (fee < ask * .95) return toast(`${p.club >= 0 ? CL(p.club).name : "His club"} turn the offer down. They want about ${money(ask)}.`);
    const a = playerAppeal(p, wage);
    if (a.score < a.pr.thr) return toast(`${p.name} turns you down. ${refusalReason(a, P_FACTORS)}`);
    ownerBuy(p, fee, wage); closeModal(); render(); saveGame();
  },
  cands: el => candModal(el.dataset.r),
  hire: el => {
    const s = CANDS.list[+el.dataset.i], wage = +$("#cw" + el.dataset.i).value || 0, yrs = +$("#cy" + el.dataset.i).value;
    const a = staffAppeal(s, wage);
    if (a.score < a.pr.thr) { toast(`${s.name} says no. ${refusalReason(a, S_FACTORS)}`); return; }
    hire(s, wage, yrs); closeModal(); render(); saveGame();
  },
  dismiss: el => { const s = staffOf(el.dataset.r); if (confirm(`Dismiss ${s.name}? It costs ${money(payoff(s))}.`)) { dismiss(el.dataset.r); G.meddle = (G.meddle || 0) + .5; render(); saveGame(); } },
  renewstaff: el => { const s = staffOf(el.dataset.r), w = staffAsk(s); if (w == null) { toast(`${s.name} won't sign a new contract: ${refusalReason(staffAppeal(s, s.wage * 1.5), S_FACTORS)}`); return; } s.wage = Math.max(w, s.wage); s.yrs = 3; s.expiring = false; news(`${s.name} signs a new three-year contract (${money(s.wage)} a year).`); render(); saveGame(); },
  invest: el => { invest(+el.dataset.v); render(); }, investx: () => { invest(+$("#inv-amt").value || 0); render(); }, withdraw: () => { withdraw(+$("#inv-amt").value || 0); render(); },
  sponsor: el => { const o = my().offers.filter(x => x.slot === el.dataset.k)[+el.dataset.i]; if (o) acceptOffer(o); render(); saveGame(); },
  askoffers: el => { const c = my(); (c.ask ||= {})[el.dataset.k] = G.week + G.year * 100; refreshOffers(c, el.dataset.k); render(); },
  host: el => { setGround(my(), +el.dataset.i); news(`The club moves to ${HOSTS[+el.dataset.i].name}.`); render(); },
  buildst: el => { const n = +el.dataset.n, q = newStadiumQuote(n), name = ($("#st-name").value || my().town + " Park").trim(); if (!confirm(`Build ${name} (${n.toLocaleString()}) for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "new", ...q, name, label: `building ${name}, ${n.toLocaleString()} capacity` })); render(); saveGame(); },
  expand: el => { const q = expandQuote(my(), +el.dataset.n); if (!confirm(`Build a ${q.add.toLocaleString()}-seat stand for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "expand", ...q, label: `a new ${q.add.toLocaleString()}-capacity stand` })); render(); saveGame(); },
  amen: () => { const q = amenQuote(my()); built(startBuild("stadium", { type: "amen", ...q, label: `stadium facilities to level ${q.lvl}` })); render(); saveGame(); },
  suites: () => { const q = suiteQuote(my()); built(startBuild("stadium", { type: "suites", ...q, label: `${q.add} executive suites` })); render(); saveGame(); },
  relay: el => { const k = el.dataset.k; if (!confirm(`Re-lay the pitch with ${PITCH[k].l.toLowerCase()} for ${money(PITCH[k].cost(my()))}?`)) return; relayPitch(k); render(); saveGame(); },
  vent: el => { const k = el.dataset.k; if (!confirm(`Build the ${VENTURES[k].l.toLowerCase()} for ${money(VENTURES[k].cost(my()))}?`)) return; buildVenture(k); render(); saveGame(); },
  unvent: el => { if (confirm(`Close the ${VENTURES[el.dataset.k].l.toLowerCase()}?`)) { closeVenture(el.dataset.k); render(); } },
  upfac: el => { const k = el.dataset.k, lvl = my().fac[k].lvl + 1; built(startBuild(k, { lvl, cost: facCost(k, lvl), weeks: facWeeks(lvl), label: `${FAC_NAME[k].toLowerCase()} to level ${lvl}` })); render(); saveGame(); },
  export: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(G)], { type: "application/json" })); a.download = `${my().short}-${G.year}.json`; a.click(); },
  quit: async () => { await saveGame(); start(); },
  load: el => loadSave(el.dataset.id),
  delsave: async el => { if (!confirm("Delete this career?")) return; await dbDo("readwrite", st => st.delete(el.dataset.id)); start(); },
  found: async () => {
    const name = $("#f-name").value.trim(); if (!name) return toast("Give your club a name.");
    const sel = id => ($(`#${id} [aria-pressed="true"]`) || {}).dataset?.v;
    $("#busy").hidden = false; await new Promise(r => setTimeout(r, 30));
    newWorld({ name, town: $("#f-town").value.trim() || name.split(" ")[0], short: ($("#f-short").value.trim() || name).toUpperCase(), owner: $("#f-owner").value.trim(), half: sel("f-half") || "N", color: sel("f-color"), wealth: sel("f-wealth") || "wealthy" });
    startSeason(); refreshOffers(my());
    $("#busy").hidden = true; PAGE = "home"; render(); saveGame();
  },
};
const CHANGE = {
  price: el => { const c = my(), k = el.dataset.k, v = Math.max(0, +el.value || 0);
    if (k === "ticket" && G.sTrust && G.sTrust.freeze === G.year && v > c.prices.ticket) { toast("You promised the supporters' trust a price freeze this season."); render(); return; }
    c.prices[k] = v; render(); },
  ffund: el => { const f = net().feeders.find(x => x.id === +el.dataset.id); if (f) f.fund = Math.max(0, Math.round(+el.value || 0)); render(); },
  loanout: el => { if (!el.value) return; const p = P(+el.dataset.id), x = CL(+el.value); if (confirm(`Loan ${p.name} to ${x.name} until the end of the season?`)) { loanOut(p, x); closeModal(); render(); saveGame(); } },
  budget: el => { const c = my(), k = el.dataset.k, v = Math.max(0, Math.round(+el.value || 0)), old = c.budget[k]; c.budget[k] = v;
    // Staff notice their budgets being cut hard.
    const role = { wages: "manager", transfer: "recruit", scout: "recruit", acad: "youth" }[k]; if (v < old * .7 && staffOf(role)) trust(role, -4, `isn't happy about the ${k === "acad" ? "academy" : k} budget being cut.`);
    render(); },
  concerts: el => { my().fac.stadium.concerts = +el.value; render(); },
  buyf: el => { BUYF[el.dataset.k] = el.type === "checkbox" ? el.checked : +el.value; render(); },
  lgsel: el => { SUB.league = el.value; render(); },
  mf: el => { MARKET_F[el.dataset.k] = el.dataset.k === "pos" ? el.value : (+el.value || 0); if (el.dataset.k === "age" && !MARKET_F.age) MARKET_F.age = 40; render(); },
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
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
start();
