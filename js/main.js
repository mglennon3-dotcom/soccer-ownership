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
  G.board ||= { own: 100, inv: [], offers: [] }; G.sTrust ||= { rel: 50, members: 0, seat: false };
  if (G.sTrust && G.sTrust.freeze && G.sTrust.freeze >= G.year && G.sTrust.fp == null && G.club != null && my()) G.sTrust.fp = my().prices.ticket; G.net ||= { partner: null, feeders: [] }; G.loans ||= [];
  for (const c of G.clubs) if (!c.gone && !isMine(c) && !c.own) c.own = newOwner(c);
  if (!G.cups) startCups();
  if (!G.foreign) { makeForeign(); G.cont = {}; }
  // 0.73.1: staff hired before their trust was recorded get a starting point: where they stood before the records begin.
  for (const st of Object.values((G.club != null && my().staff) || {}).filter(Boolean)) if (!st.tbase) { const logged = sum(st.tlog || [], x => x.d);
    st.tbase = { t: Math.round((st.trust - logged) * 10) / 10, y: (st.tlog && st.tlog.length ? Math.min(...st.tlog.map(x => x.y)) : G.year), old: true, k: `Where things stood when records began (hired ${st.since || "earlier"}; what happened before that wasn't kept)` }; }
  // 0.73.4: a one-off top-up of the free agents, for careers whose summer passed before the out-of-contract players
  // reached the market (they were all snapped up the moment their deals ended): players under 32 around your level.
  if (!G.fa4 && G.club != null && false) { G.fa4 = true; const t = my().tier, mix = Object.entries(SQUAD_MIX).flatMap(([pos, n]) => Array(n).fill(pos)); let n = 0;
    for (let i = 0; i < 40; i++) { const ovr = clamp(Math.round(TIER_XI[t] - 12 + R() * 15), 20, 92), age = ri(21, 31);
      const p = makePlayer({ pos: pick(mix), ovr, age, nat: R() < .6 ? "ENG" : pickNat("ENG"), pot: seniorPot(ovr, age) }); toFreeAgent(p); p.faAt = absWeek(); n++; }
    news(`${n} more players are out of contract and looking for clubs, around your level and under 32: see Market → Free agents. Other clubs move in after three weeks.`, true); }
  // 0.74.7: partner clubs always lend: clear any refusal already rolled this window for their players.
  if (!G.lt2) { G.lt2 = true; for (const pt of (G.net && G.net.partners) || []) { const x = CL(pt.id); if (x) for (const id of x.squad) { const q = G.players[id]; if (q && q.lt) { q.lt.no = false; q.lt.min = Math.min(q.lt.min, .5); } } } }
  // 0.75.3: a one-off reset you asked for: every feeder arrangement ends, with no fallout. Players you've lent to them
  // stay on loan there until the end of the season.
  if (!G.fdrop1 && G.club != null) { G.fdrop1 = true; const n = (net().feeders || []).length;
    if (n) { const names = net().feeders.map(f => CL(f.id) ? CL(f.id).name : "a feeder").join(", "); net().feeders = []; news(`A fresh start: your feeder arrangements end (${names}), with no hard feelings. Players you've lent them stay on loan until the end of the season.`, true); } }
  if (G.club != null && typeof linkCheck === "function") linkCheck();  // same-division links (from before 0.75.2) end on loading
  // 0.76.1: a one-off: every parent club you've approached this year can be approached again.
  if (!G.ask2 && G.club != null) { G.ask2 = true; const n = Object.values(net().askedIds || {}).filter(y => y === G.year).length; net().askedIds = {}; if (n) news(`You can approach again the ${n} club${n > 1 ? "s" : ""} you asked to be a partner this year.`); }
  if (!G.reg1 && G.club != null) { G.reg1 = true; if (/kensington/i.test(my().name) && my().region !== "London") { my().region = "London"; my().half = "S"; } }  // 0.77.8: South Kensington is in London
  // 0.79.0: a one-off you asked for: the Rosborg FF midfielder your head of recruitment agreed to bring in next summer
  // joins now, for the fee his club was asking (€20.7M) on the wage he asked you for (€62,400 a week).
  if (!G.fix1 && G.club != null) { const p = Object.values(G.players).find(p => p.club >= 0 && p.club !== G.club && CL(p.club) && /Rosborg/i.test(CL(p.club).name) && (p.toMe || sugg().some(x => x.id === p.id)));
    if (p) { G.fix1 = true; delete p.toMe; G.sugg = sugg().filter(x => x.id !== p.id); signPlayer(p, 20.7e6, 62400 * 52, false, "suggestion"); } }
  if (G.club != null && G.phase === "summer" && G.week === 0 && typeof summerRelay === "function") summerRelay();
  if (G.club != null && G.phase === "summer" && G.week === 0 && typeof completeIncoming === "function") completeIncoming();  // 0.80.2: agreed summer deals go through at the start of pre-season  // 0.80.0: start of pre-season: the pitch is re-laid straight away
  if (!G.ilk1 && G.club != null) { G.ilk1 = true; const x = G.clubs.find(o => !o.gone && !o.abroad && /^Ilkby\b/.test(o.name)); if (x && my().region === "London") { x.region = "London"; x.half = "S"; (G.kmFix ||= {})[pairKey(my(), x)] = 3; } }  // 0.80.8: one-off: Ilkby move to London, 2 miles away
  if (!G.lon2 && G.club != null) { G.lon2 = true; if (!G.derby) buildDerbies(); const lon = G.clubs.filter(x => !x.gone && !x.abroad && x.region === "London");  // 0.80.9: one-off: London's local derbies; Ilkby fierce
    for (const a of lon) for (const b of lon) if (a.id < b.id && !G.derby[pairKey(a, b)] && geoDerby(a, b)) G.derby[pairKey(a, b)] = 1;
    const x = G.clubs.find(o => !o.gone && !o.abroad && /^Ilkby\b/.test(o.name)); if (x) G.derby[pairKey(my(), x)] = 2; }
  if (!G.t18a && G.club != null) { G.t18a = true; for (const p of my().squad.map(P)) if (p && p.acad && p.age === 18) (G.turn18 ||= []).push(p.id); }  // 0.96.0: one-off: your academy 18-year-olds get the question too
  if (!G.tk1 && G.club != null) { G.tk1 = true; const c = my();  // 0.93.1: one-off: your match ticket set to your going rate (unless you've promised a freeze)
    if (!(typeof priceFrozen === "function" && priceFrozen())) { const was = c.prices.ticket; c.prices.ticket = ticketRef(c); if (was !== c.prices.ticket) news(`Match tickets set to the going rate: ${eur(c.prices.ticket)} (were ${eur(was)}).`); } }
  if (!G.csfix2 && G.club != null) { G.csfix2 = G.csfix1 = true;  // 0.91.11: one-off: undo 0.91.10's handing you a Shield final you lost on penalties
    for (const K of [...Object.values(G.cont || {}), ...Object.values(G.contLast || {})]) {
      const D = CONT[K.key], RD = (K.ko || []).find(R => R.n === "Final"), t = RD && RD.ties[0]; if (!t || !t.pens || t.w !== G.club) continue;
      const msg = G.news.find(n => n.t.startsWith(`EUROPEAN CHAMPIONS! ${my().name} win the ${D.name} on penalties against `)); if (!msg) continue;  // only the one it handed you
      const them = CL(t.h === G.club ? t.a : t.h), c = my(), y = K === G.cont[K.key] ? G.year : G.year - 1, lbl = seasonLabel(y);
      t.w = them.id; K.win = them.id;
      c.trophies = c.trophies.filter(x => !(x[0] === y && x[1] === D.name)); c.rep = Math.max(1, c.rep - 4); c.cash -= D.champ; c.fin.prize -= D.champ; moodHit(c, -25);
      them.trophies.push([y, D.name]); them.rep = Math.min(99, them.rep + 4);
      for (const p of c.squad.map(P)) if (p && p.acc) p.acc = p.acc.filter(a => !(a[1] === "euro" && a[2] === `${D.name} winner ${lbl}`));
      for (const p of them.squad.map(P)) if (p && !p.acad && seasonAt(p, them.id)[0] >= 5) (p.acc ||= []).push([y, "euro", `${D.name} winner ${lbl}`]);
      const r = (G.myRes || []).find(r => r.comp === K.key && / final$/i.test(r.label || "")); if (r) r.res = "L";
      G.news = G.news.filter(n => n !== msg); news(`${them.name}${them.abroad ? ` (${countryOf(them)})` : ""} win the ${D.name}.`); } }
  if (!G.sc2) { G.sc2 = true;  // 0.91.6: one-off: the season's games from before the split by club began go back in (to his earlier club if he moved, else this one)
    for (const p of Object.values(G.players)) { if (!p.sc || p.sc.y !== G.year || p.club < 0) continue;
      const by = p.sc.by, keys = Object.keys(by), tot = [0, 1, 2].map(i => keys.reduce((s, k) => s + (by[k][i] || 0), 0)), miss = [p.s.app - tot[0], p.s.g - tot[1], p.s.a - tot[2]];
      if (miss.every(v => v <= 0)) continue; const to = keys.length > 1 || (keys.length === 1 && +keys[0] !== p.club) ? keys[0] : String(p.club);
      const b = (by[to] ||= [0, 0, 0]); for (let i = 0; i < 3; i++) b[i] += Math.max(0, miss[i]); } }
  if (!G.sc1) { G.sc1 = true;  // 0.90.5: one-off: players who moved this season get their season split by club (from their career record)
    for (const p of Object.values(G.players)) { if (p.club < 0 || (p.sc && p.sc.y === G.year)) continue;
      const t = (p.tx || []).filter(x => x[0] === G.year && x[3] === p.club).pop(); if (!t || t[2] == null || t[2] < 0) continue;
      const here = ((p.cs || {})[p.club] || [0, 0, 0]).map((v, i) => Math.min(v, [p.s.app, p.s.g, p.s.a][i])), s = [p.s.app, p.s.g, p.s.a];
      p.sc = { y: G.year, by: { [t[2]]: s.map((v, i) => Math.max(0, v - here[i])), [p.club]: here } }; } }
  if (!G.back1 && G.club != null) { G.back1 = true; const c = my();  // 0.89.2: one-off: Adam Brannigan and Zach Palmer come back from the parent clubs on pro deals; compensation repaid
    for (const name of ["Adam Brannigan", "Zach Palmer"]) {
      const p = Object.values(G.players).find(p => p.name === name && p.club >= 0 && p.club !== c.id && partners().some(pt => pt.id === p.club)); if (!p) continue;
      const from = CL(p.club), t = (G.tlog || []).find(m => m.kind === "out" && m.id === p.id && m.y === G.year), comp = t ? t.fee || 0 : 0;
      if (comp) { c.cash -= comp; c.fin.sales -= comp; } G.tlog = (G.tlog || []).filter(m => m !== t);
      leaveClub(p); NEXT_FEE = 0; moveTo(p, c); p.tx = (p.tx || []).filter(x => !(x[0] === G.year && (x[3] === from.id || x[2] === from.id)));
      p.acad = false; p.yrs = 3; p.wage = Math.max(p.wage, Math.round(Math.max(p.wage * 1.15, demandWage(p, c)) / 100) * 100); p.dealY = G.year; p.loy = Math.max(loyaltyOf(p), .6);
      if (typeof registerNew === "function") registerNew(p, c);
      news(`${p.name} is back from ${from.name} on a professional contract: ${pw(p.wage)} for 3 years${comp ? `. The ${money(comp)} compensation goes back to them` : ""}.`, true); } }
  if (!G.acc1) { G.acc1 = true;  // 0.87.0: one-off: past titles, cups and your promotions, for those who played their part (from season records)
    const LN = new Set(Object.values(LEAGUES).map(L => L.name)), byShort = {}; for (const c of G.clubs) if (!c.abroad) (byShort[c.short] ||= []).push(c);
    const rowAt = (p, y, short) => (p.prog || []).find(r => r[0] === y && typeof r[3] === "string" && r[3].split(" ")[0] === short);
    const ps = Object.values(G.players).filter(p => p.prog && p.prog.length);
    for (const c of G.clubs) if (!c.abroad) for (const [y, name] of c.trophies || []) {
      const lg = LN.has(name), min = lg ? 10 : 5;
      for (const p of ps) { const r = rowAt(p, y, c.short); if (r && r[4] >= min) (p.acc ||= []).push([y, lg ? "title" : /Champions Cup|Continental Shield/.test(name) ? "euro" : "cup", lg ? `${name} champions ${seasonLabel(y)}` : `${name} winner ${seasonLabel(y)}`]); } }
    if (G.club != null) for (const h of G.history || []) if (h.up && (!h.club || h.club === my().name)) for (const p of ps) { const r = rowAt(p, h.y, my().short); if (r && r[4] >= 10) (p.acc ||= []).push([h.y, "promo", `Promoted from the ${LEAGUES[h.lg].name} ${seasonLabel(h.y)}`]); }
    for (const p of ps) if (p.acc) p.acc.sort((a, b) => a[0] - b[0]); }
  if (!G.chof1 && G.club != null) { G.chof1 = true; const c = my();  // 0.86.0: one-off: older legends get their games for you, peak and nationality where he's still in the game
    for (const l of c.legends || []) { if (l.here) continue; const p = Object.values(G.players).find(p => p.name === l.name && p.pos === l.pos);
      if (p) { const h = (p.cs || {})[c.id]; if (h) l.here = [h[0], h[1], h[2] || 0]; l.peak = p.peak; l.nat = p.nat; l.how = "left"; }
      else { const H = (G.hof || []).find(h => h.name === l.name); if (H) { l.peak = H.peak; l.nat = H.nat; } l.how = "retired"; } } }
  if (!G.hof4) { G.hof2 = G.hof3 = G.hof4 = true; const legs = new Set(G.club != null ? (my().legends || []).map(l => l.name) : []); G.hof = (G.hof || []).filter(h => hofWorthy(h.peak, h.apps)); for (const h of G.hof) if (legs.has(h.name)) { h.leg = true; h.mine = true; } }  // 0.85.1/0.85.2: one-off: the hall of fame keeps only those who'd get in now
  if (!G.am1 && G.club != null) { G.am1 = true; const c = my(), YT = YEAR_TICKS(), now = yearTick();  // 0.83.0: one-off: fees already paid go on the books at what's left of them
    for (const p of c.squad.map(P).concat((G.loanList || []).map(id => G.players[id]).filter(p => p && p.loan && p.loan.from === c.id))) {
      const t = (p.tx || []).filter(x => x[3] === c.id && x[4] > 0).pop(); if (!t || p.am) continue;
      const done = (G.year - t[0]) * YT + now - (t[1] ? SUMMER_WEEKS + JAN[0] : 0), left = Math.max(0, (p.yrs || 0) * YT - now);
      const bk = Math.round(t[4] * left / Math.max(1, done + left)); if (bk > 0) p.am = { book: bk, fee: t[4], y: t[0] }; } }
  if (!G.rtd1 && G.club != null) { G.rtd1 = true; const ids = new Set(my().squad.filter(id => G.players[id] && G.players[id].retrained)); for (const role in G.depth || {}) G.depth[role] = G.depth[role].filter(id => !ids.has(id)); }  // 0.82.3: one-off: retrained players re-slotted in the depth charts
  if (!G.treq2 && G.club != null) { G.treq2 = true; for (const m of G.inbox) { const p = m.key === "treq" && !m.done && G.players[m.data.pid]; if (p && lastDealY(p) === G.year) { m.done = true; m.drop = true; p.req = 0; } } G.inbox = G.inbox.filter(m => !m.drop); }  // 0.81.3: one-off: drop transfer requests from players who only just signed
  if ((!G.love2 || !G.love3) && G.club != null) {
    /* 0.98.1/0.98.4: one-off: a loan season's fan affection went to the parent club; give it to the club he played for.
       A loan season is a row marked "(loan)" or, where his season was split by club, the row for that same club
       (the marked row is then empty). love2 did the marked rows; love3 the split ones it missed. */
    const do2 = !G.love2, do3 = !G.love3; G.love2 = G.love3 = true;
    const byShort = new Map(G.clubs.map(x => [x.short, x])), fixed = [], LN = / \(loan\)$/;
    for (const p of Object.values(G.players)) { const pr = p.prog || []; if (!pr.some(r => LN.test(r[3]))) continue;
      const split = r => typeof r[3] === "string" && !LN.test(r[3]) && pr.some(q => q !== r && q[0] === r[0] && q[3] === r[3] + " (loan)");
      const loanish = r => LN.test(r[3]) || split(r), lv0 = favLevel(p, G.club);
      pr.forEach((r, i) => { if (!r[4]) return; const marked = LN.test(r[3]); if (marked ? !do2 : !(do3 && split(r))) return;
        const at = byShort.get(r[3].replace(LN, ""));
        // (his permanent moves first: the club he'd last joined by then; failing that, the nearest season he wasn't on loan)
        const hj = [...(p.hist || [])].reverse().find(h => h[0] <= r[0] && byShort.get(h[1])), own = [...pr.slice(0, i).reverse(), ...pr.slice(i + 1)].find(q => !loanish(q) && byShort.get(q[3]));
        const par = hj ? byShort.get(hj[1]) : own && byShort.get(own[3]); if (!par || !at || par === at) return;
        const home = p.hist.length && p.hist[0][1] === par.short && p.hist[0][0] < r[0], base = r[4] * .6 + r[5] * 1.5 + r[6] * .7 + 3;
        p.love ||= {}; p.love[par.id] = Math.max(0, Math.round(((p.love[par.id] || 0) - base - (home ? 3 : 0)) * 10) / 10); if (!p.love[par.id]) delete p.love[par.id];
        p.love[at.id] = Math.round(((p.love[at.id] || 0) + base - 3) * 10) / 10; });
      // the split rows: label the loan club's row as the loan, and the empty one as his own club
      if (do3) for (const r of pr.filter(split)) { const e = pr.find(q => q[0] === r[0] && q[3] === r[3] + " (loan)" && !q[4]); r[3] += " (loan)"; if (e) { const nx = pr.find(q => q[0] > r[0] && !LN.test(q[3])) || {}; e[3] = p.club >= 0 && !(p.loan) ? CL(p.club).short : nx[3] || e[3]; } }
      if (lv0 && favLevel(p, G.club) < lv0) { fixed.push(p.name); if (G.achs && favLevel(p, G.club) < 2) delete G.achs[`legend.${p.id}`]; } }
    if (fixed.length) news(`Records corrected: ${fixed.join(", ")} ${fixed.length > 1 ? "were" : "was"} wrongly counted a fan favourite or legend here for seasons spent on loan elsewhere.`); }
  // A "club legend" card for someone who isn't one (any more): the loan-season repair took it away, so the card goes too.
  // 1.0.21: transfer-listing no longer costs your head of recruitment's trust: give back what it cost this season and
  // last, and take it off the reasons on the Staff page.
  if (G.club != null && !G.tlrec1) { G.tlrec1 = true; const s = staffOf("recruit");
    const SELL = ["Transfer-listing players yourself", "Your calls on offers for players", "Taking a star off the market"];
    if (s && s.tlog) { const back = -s.tlog.filter(x => SELL.includes(x.k) && x.y >= G.year - 1).reduce((t, x) => t + x.d, 0);
      s.tlog = s.tlog.filter(x => !SELL.includes(x.k));
      if (back > 0) { const t0 = s.trust; s.trust = clamp(s.trust + back, 0, 100); news(`${s.name} no longer minds your decisions on selling players (it isn't ${pr(s, "his")} department): ${pr(s, "his")} trust in you is back up from ${Math.round(t0)} to ${Math.round(s.trust)}.`, true); } } }
  /* 1.0.23: undo your head of recruitment buying back a player you'd just sold (before 1.0.22 stopped it): he goes
     back to the club you sold him to, the fee comes back, and the deal is struck from the books. */
  if (G.club != null && !G.unbuy1) { G.unbuy1 = true; const c = my();
    for (const p of c.squad.map(P).filter(Boolean)) {
      const T = (G.tlog || []), inn = T.find(m => m.id === p.id && m.kind === "in"); if (!inn || inn.by !== "recruit" || !inn.fee) continue;
      const out = T.find(m => m.id === p.id && m.kind === "out" && m.t < inn.t && m.club === inn.club && m.y >= inn.y - 1); if (!out) continue;
      const to = G.clubs.find(k => k.name === inn.club && !k.gone); if (!to) continue;
      const fee = inn.fee; delete p.am; c.cash += fee; book("buys", -fee); c.spentT = Math.max(0, (c.spentT || 0) - fee);
      if (!to.abroad) { to.tnet = (to.tnet || 0) - fee; to.tb = tbOf(to) - fee * .5; }
      NEXT_FEE = 0; moveTo(p, to); p.tx.pop(); p.hist.pop(); const tx = p.tx[p.tx.length - 1]; if (tx && tx[3] === c.id && tx[2] === to.id) { p.tx.pop(); p.hist.pop(); }
      p.wage = aiWage(p, to); p.yrs = aiYears(p, to); delete p.joinR; delete p.keen;
      G.tlog = T.filter(m => m !== inn); G.newSign = (G.newSign || []).filter(x => x.pid !== p.id); syncReg(c);
      news(`${p.name}'s return is undone: he stays at ${to.name}, and the ${money(fee)} fee is back in the club's account.`, true);
    } }
  /* 1.0.25, one-off: your European tie that went out on a coin flip (before shootouts were played out) gets a real
     shootout. Win it and you take your opponent's place: if the next round has been played, it's replayed now with you
     in it, and the winner goes on to the final (if that hasn't been played yet). */
  if (G.club != null && !G.pens1) { G.pens1 = true;
    for (const K of Object.values(G.cont || {})) for (let qi = 0; qi < (K.ko || []).length; qi++) {
      const RD = K.ko[qi], t = RD.ties.find(x => (x.h === G.club || x.a === G.club) && x.pens === true && x.w != null && x.w !== G.club); if (!t || RD.n === "Final") continue;
      const D = CONT[K.key], opp = t.w, s = shootout(t.h, t.a); t.pens = s.ps;
      if (s.w !== G.club) { news(`The ${D.name} ${RD.n.toLowerCase()} shootout against ${CL(opp).name}, replayed: you lose it ${penStr(t, G.club)}. ${CL(opp).name} stay through.`, true); continue; }
      t.w = G.club; earn("prize", D.rounds[Math.min(qi + 1, D.rounds.length - 1)]); moodHit(my(), 4);
      news(`The ${D.name} ${RD.n.toLowerCase()} shootout against ${CL(opp).name}, replayed: you win it ${penStr(t, G.club)}! ${my().name} go through in their place.`, true);
      const nx = K.ko[qi + 1]; if (!nx) { K.round = Math.max(K.round, qi); break; }
      const t2 = nx.ties.find(x => x.h === opp || x.a === opp); if (!t2) break;
      if (t2.h === opp) t2.h = G.club; else t2.a = G.club;
      if (nx.n === "Final") { if (t2.w != null) news(`(The final has already been played, so it stands.)`, true); break; }
      if (t2.w == null && !t2.g1) { news(`${CL(t2.h === G.club ? t2.a : t2.h).name} are your ${nx.n.toLowerCase()} opponents.`, true); break; }
      // The next round was already played with them in it: replay it now with you.
      const was = t2.w; delete t2.g1; delete t2.g2; delete t2.pens; delete t2.et; t2.w = null;
      const r1 = contMatch(t2.h, t2.a, false, K.key, `${D.short} ${nx.n.toLowerCase()}, first leg`); t2.g1 = [r1.hg, r1.ag];
      secondLeg(K, D, nx, t2, qi + 1);
      const fin = K.ko[qi + 2]; if (fin && fin.n === "Final" && was != null && t2.w !== was) { const tf = fin.ties[0]; if (tf && tf.w == null) { if (tf.h === was) tf.h = t2.w; else if (tf.a === was) tf.a = t2.w; }
        else if (tf) news(`(The final has already been played, so it stands.)`, true); }
      break;
    } }
  if (!G.sites4) { G.sites4 = true; G.sites3 = true; G.sites = null; }  // 1.0.28/1.0.31: bigger plots on offer
  // 1.0.36: every ground gets a setting (city centre, terraced streets, suburbs, industrial, retail park, market town,
  // village, open country); other clubs' support takes on its colour.
  if (!G.locs1) { G.locs1 = true; for (const c of G.clubs) { if (c.gone) continue; const had = !!c.loc; locOf(c); if (!had && !isMine(c) && c.fanMix) locMix(c); } }
  /* 1.0.38, one-off (asked for): AFC Gilstow is a village club in the South West. Its London derbies go, and it picks
     up its new neighbours' (worked out as for any club, from distance). */
  if (!G.gisSW1 && G.club != null && my().name === "AFC Gilstow") { G.gisSW1 = true; const c = my();
    c.region = "South West"; c.half = "S"; c.loc = "village";
    if (G.derby) { for (const k of Object.keys(G.derby)) if (k.split("-").includes(String(c.id))) delete G.derby[k];
      for (const o of G.clubs.filter(x => !x.gone && !x.abroad && x !== c && (x.region === c.region || roadKm(c, x) <= 40))) { const l = geoDerby(c, o); if (l) G.derby[pairKey(c, o)] = l; } }
    news(`AFC Gilstow is a village club in the South West: ${LOC(c).d} It has ${catchWord(c)}, so the support grows slowly.`, true); }
  if (!G.books1 && G.club != null && G.sTrust) { G.books1 = true; if (G.inbox.some(m => m.key === "trustAsk" && m.done && m.data && m.data.k === "accounts" && m.answer === "Agree")) G.sTrust.books = G.year; }
  // 1.0.56: breakout pay demands already in the inbox follow the new rules: withdrawn from a player who took less to
  // join within the last two seasons; otherwise capped at a quarter over his going rate, defaulting to the middle offer.
  if (!G.brk56 && G.club != null) { G.brk56 = true; const c = my();
    for (const m of G.inbox.filter(m => m.key === "raise" && !m.done && m.data && m.data.threat)) { const p = G.players[m.data.pid]; if (!p || p.club !== c.id) continue;
      if (p.keen && p.keen.club === c.id && G.year - (p.keen.y || 0) < 2) { G.inbox = G.inbox.filter(x => x !== m); news(`${p.name} withdraws his demand for a new deal: he took less to join and he's happy to honour it for now.`, true); continue; }
      const cap = Math.round(Math.max(p.wage * 1.15, demandWage(p, c) * 1.25) / 100) * 100; if (m.data.worth <= cap) { m.dflt = 1; continue; }
      m.data.worth = cap; m.data.half = Math.round((p.wage + cap) / 2 / 100) * 100; m.opts = [`Give him ${pw(cap)}`, `Offer ${pw(m.data.half)}`, "Refuse"]; m.dflt = 1;
      m.body = m.body.replace(/wants €[\d,]+\/wk/, `wants ${pw(cap)}`); } }
  // 1.0.58: transfer requests made before the Premier Division ambition fix lose "ambition" as a reason (a request
  // that had no other reason is withdrawn).
  if (!G.amb58 && G.club != null) { G.amb58 = true; const c = my();
    if (c.tier === 1) for (const m of G.inbox.filter(m => m.key === "treq" && !m.done && /unhappy about .*ambition/.test(m.body || ""))) { const p = G.players[m.data.pid]; if (!p) continue;
      const why = (m.body.match(/unhappy about (.*)\.$/) || [])[1], rest = why ? why.split(" and ").filter(w => w !== "ambition") : [];
      if (!rest.length) { G.inbox = G.inbox.filter(x => x !== m); p.req = 0; news(`${p.name} withdraws his transfer request.`, true); }
      else m.body = m.body.replace(/unhappy about .*\.$/, `unhappy about ${rest.join(" and ")}.`); } }
  // 1.0.59: ...and the reason itself, not just the wording (it decides whether a new deal settles him).
  if (!G.amb59 && G.club != null) { G.amb59 = true; if (my().tier === 1) for (const m of G.inbox.filter(m => m.key === "treq" && !m.done && m.data && Array.isArray(m.data.why))) m.data.why = m.data.why.filter(w => w !== "ambition"); }
  if (!G.treq60) { G.treq60 = true; for (const m of G.inbox) if (m.key === "treq" && !m.done && m.opts && m.opts.length === 3) m.opts.push("Ask what it would take to keep him"); }
  /* 1.0.62, one-off (asked for): Moritz Görtz's transfer request starts again, as a fresh card with today's options
     (any half-answered request or terms card for him is cleared first). */
  if (!G.gortz62 && G.club != null) { G.gortz62 = true; const c = my(), p = c.squad.map(P).find(q => q && q.name === "Moritz Görtz");
    if (p) { G.inbox = G.inbox.filter(m => !(["treq", "keepTerms"].includes(m.key) && m.data && m.data.pid === p.id && !m.done));
      p.req = G.year; delete p.goPromise; delete p.ambPromise; if (p.list) p.list = false;
      addChoice("treq", `${p.name} hands in a transfer request`, `${POS_NAME[p.pos]}, ${p.age}, rated ${r20(p.ovr)}. He's unhappy about a blocked move.`,
        ["Accept: put him on the transfer list", `Offer a new deal (${pw(newDealWage(p))})`, "Refuse", "Ask what it would take to keep him"], { pid: p.id, why: ["a blocked move"] }, 0); } }
  /* 1.0.63, one-off (asked for): a clean slate for your squad: every open transfer request, terms card and pay demand
     from your players is cleared, along with the grievances behind them (requests, unsettled mood, blocked moves, pay
     grudges, promises). */
  if (!G.clean63 && G.club != null) { G.clean63 = true; const c = my(), ids = new Set(c.squad);
    const n = G.inbox.filter(m => !m.done && ["treq", "keepTerms", "raise"].includes(m.key) && m.data && ids.has(m.data.pid)).length;
    G.inbox = G.inbox.filter(m => !(!m.done && ["treq", "keepTerms", "raise"].includes(m.key) && m.data && ids.has(m.data.pid)));
    for (const p of c.squad.map(P)) if (p) { p.req = 0; p.unsettled = 0; p.blocked = 0; p.payGrudge = 0; delete p.goPromise; delete p.ambPromise; }
    news(`A clean slate in the dressing room: ${n ? `${n} open request${n > 1 ? "s" : ""} cleared, and ` : ""}every player's grievances are forgotten.`, true); }
  // 1.0.92, one-off: players abroad were on English-scale contracts from the start (Norway's league was missed out of
  // the strength table entirely): every contract abroad is reset to what his league pays.
  if (!G.fwage92) { G.fwage92 = true; for (const id of G.foreign || []) { const c = CL(id); if (!c) continue; for (const pid of c.squad) { const p = P(pid); if (p && !p.acad && !p.loan) p.wage = aiWage(p, c); } } }
  // 1.2.0, one-off: AI contracts from the start of the game were on a single pay scale whatever the division (a player
  // in League One paid like one anywhere): every AI club's contracts reset to its division's standard.
  if (!G.stdWage121 && G.club != null) { G.stdWage121 = true; standardWages(); }  // (and the leagues abroad)
  // 1.2.11: a save left half-way through the end of a season (some clubs already promoted or relegated, some with no
  // division at all) is put back as the season's tables have it, so the season can end properly.
  if (G.phase !== "summer" && G.leagues && G.clubs.some(c => !c.gone && !c.abroad && (!c.lg || !LEAGUES[c.lg] || !(G.leagues[c.lg].tab || {})[c.id]))) {
    let n = 0; for (const k of LG_KEYS) { const ids = Object.keys(G.leagues[k].tab || {}).map(Number); if (!ids.length) continue;
      for (const id of ids) { const c = G.clubs[id]; if (!c) continue; if (c.lg !== k || c.tier !== LEAGUES[k].tier) { n++; c.lg = k; c.tier = LEAGUES[k].tier; if (LEAGUES[k].half) c.half = LEAGUES[k].half; } if (c.tierSince === G.year + 1) c.tierSince = G.year; }
      G.leagues[k].clubs = ids; }
    for (const c of G.clubs) if (!c.gone && !c.abroad && (!c.lg || !LEAGUES[c.lg])) { c.gone = true; for (const pid of c.squad.slice()) toFreeAgent(P(pid)); c.squad = []; }
    if (n) news(`The season's final table has been restored: ${n} clubs put back where they finished, so the season can end.`); }
  // 1.2.14: clean up after a season's end that crashed and was retried: each retry wrote the season's records again
  // (history, trophies, honours), which made, for example, "50 seasons under your ownership" fire. Keep one of each.
  if (!G.dedup1214 && G.club != null) { G.dedup1214 = true; let fix = 0;
    if (Array.isArray(G.history)) { const seen = new Set(), h = []; for (const x of G.history) { const k = x.y + "|" + x.club; if (x.y != null && seen.has(k)) { fix++; continue; } seen.add(k); h.push(x); } G.history = h; }
    for (const c of G.clubs) if (Array.isArray(c.trophies)) { const seen = new Set(); c.trophies = c.trophies.filter(t => { const k = t[0] + "|" + t[1]; if (seen.has(k)) { fix++; return false; } seen.add(k); return true; }); }
    for (const p of Object.values(G.players)) if (Array.isArray(p.acc)) { const seen = new Set(); p.acc = p.acc.filter(a => { const k = a.join("|"); if (seen.has(k)) return false; seen.add(k); return true; }); }
    const H = (G.history || []).length; for (const n of [10, 25, 50]) if (G.achs && G.achs["yrs" + n] && H < n) { delete G.achs["yrs" + n]; G.inbox = (G.inbox || []).filter(m => !(m.type === "ach" && m.title && m.title.includes(`${n} seasons under your ownership`))); fix++; }
    if (fix) news(`Records tidied: a season's end that had to be retried had been counted more than once (${fix} duplicate records removed).`); }
  /* Supporters (1.2.16): one-off. Your supporter count jumped several-fold in one go (Montclair: about 150 to over 1,100), which sent the
     typical ticket to the top of its range. Put it back to the last level before the jump, using the season history. */
  if (!G.fansFix1216 && G.club != null) {
    G.fansFix1216 = true;
    try {
      const mine = CL(G.club), hist = (G.history || []).filter(h => h.club === mine.name && h.fans > 0);
      const seq = [mine.fans, ...hist.map(h => h.fans)];
      for (let i = 0; i < seq.length - 1; i++) {
        if (seq[i] > 2.5 * seq[i + 1] && seq[i] - seq[i + 1] > 200) {
          const back = seq[i + 1];
          mine.fans = back;
          for (let j = 0; j < i; j++) hist[j].fans = back;
          break;
        }
      }
    } catch (e) { console.warn("fansFix1216", e); }
  }
  /* Supporters (1.2.42): one-off. Under the old rules AI clubs' support crept up season after season; any club now above
     one and a half times its natural size (division, following, catchment, standing) has the excess halved. Fallen
     giants keep a big following. From now on support has to be earned (seasonFans). */
  if (!G.fansFix1242) { G.fansFix1242 = true;
    try { let n = 0; for (const c of G.clubs) { if (c.gone || c.abroad || isMine(c) || !(c.fans > 0)) continue; const cap = natFans(c) * 1.5; if (c.fans > cap) { c.fans = Math.round(cap + (c.fans - cap) * .5); n++; } }
      if (n && G.club != null) news(`Across the game, ${n} clubs' support settles back toward what their size can hold. From now on supporters are won by promotions, titles, cups and star signings, and lost by relegation, bad seasons and selling the fans' favourites.`); } catch (e) { console.warn("fansFix1242", e); } }
  // (1.2.52) A press question about your plans for the ground, asked while a new one was already going up: withdrawn.
  if (G.club != null && my().fac.stadium.build && ["new", "move", "reground"].includes(my().fac.stadium.build.type)) G.inbox = (G.inbox || []).filter(m => !(m.key === "pressGround" && !m.done));
  /* Contract lengths (1.0.17-18): this summer's renewals by your head of recruitment and last season's and this
     summer's signings had a random length; give them what the new rules would have (never shorter than they have). */
  if (G.club != null && !G.yrs3) { G.yrs3 = true; const c = my(), fixed = [];
    const longer = (p, n) => { if (p && p.club === G.club && n > p.yrs) { fixed.push(`${p.name} ${p.yrs}→${n}`); p.yrs = n; p.expiring = false; } };
    const asAge = (p, a, f) => { const keep = p.age; p.age = a; try { return f(); } finally { p.age = keep; } };
    // The renewals: the head of recruitment's summer contracts message (this summer's, or last summer's if the new one hasn't come yet).
    const last = G.phase === "summer" ? G.year - 1 : G.year;
    const msg = G.inbox.find(m => m.type === "contracts" && m.y === last) || G.inbox.find(m => m.type === "contracts" && m.y === last - 1);
    if (msg) { const body = (msg.body || "").split("Leaving:")[0]; for (const [, nm, y] of body.matchAll(/(?:New contracts: |, )([^,(]+?) \((\d) yr,/g)) {
      const p = c.squad.map(P).find(q => q && q.name === nm.trim()); if (!p) continue;
      const core = new Set(c.squad.map(P).filter(q => !q.acad).sort((a, b) => b.ovr - a.ovr).slice(0, 18).map(q => q.id)).has(p.id);
      const used = Math.max(0, G.year - (msg.y + 1)); longer(p, autoYears(p, renewTerms(p), core) - used); } }
    // The signings: last season's and this summer's, counting the year already gone for last season's.
    for (const p of c.squad.map(P)) if (p && !p.acad && p.joinR && p.joinR.y >= G.year - 1 && !(p.loan && p.loan.to === G.club)) {
      const used = G.year - p.joinR.y - (G.phase === "summer" ? 0 : 0); longer(p, asAge(p, p.age - used, () => signYears(p, c)) - used); }
    if (fixed.length) news(`Contract lengths put right: renewals and recent signings now run as long as they should. ${fixed.join(", ")} years.`, true); }
  // Minutes (tracked from 1.0.10): an estimate for the season so far from starts and sub appearances.
  for (const p of Object.values(G.players)) if (p.s && p.s.min == null) p.s.min = Math.max(0, (p.s.app - (p.s.sub || 0)) * 84 + (p.s.sub || 0) * 22);
  // A pay-rise request from a player whose pay was settled this season (e.g. his first professional contract) shouldn't exist: withdraw it.
  if (G.club != null) G.inbox = G.inbox.filter(m => !(m.key === "raise" && !m.done && m.data && G.players[m.data.pid] && lastDealY(G.players[m.data.pid]) >= G.year));
  if (G.club != null) G.inbox = G.inbox.filter(m => !(m.type === "ach" && / is a club legend$/.test(m.title || "") && (() => { const p = m.who && m.who.pid != null ? G.players[m.who.pid] : Object.values(G.players).find(q => (m.title || "").includes(q.name + " is a club legend")); return p && favLevel(p, G.club) < 2; })()));
  if (!G.raise3 && G.club != null) { G.raise3 = true;  // 0.97.0: one-off: a breakout pay demand already in the inbox re-priced off what it'd take to keep him
    for (const m of G.inbox.filter(m => m.key === "raise" && !m.done && m.data && m.data.threat)) { const p = G.players[m.data.pid]; if (!p || p.club !== G.club) continue;
      const keep = renewTerms(p).min, form = Math.max(0, seasonForm(p)), ask = Math.round(Math.max(p.wage * 1.15, (keep || demandWage(p, my()) * 1.2) * (1.1 + form * .1)) / 100) * 100, half = Math.round((p.wage + ask) / 2 / 100) * 100;
      if (ask >= m.data.worth) continue;
      const rep = t => t.split(pw(m.data.worth)).join(pw(ask)).split(pw(m.data.half)).join(pw(half));
      m.body = rep(m.body); m.opts = m.opts.map(rep); m.data.worth = ask; m.data.half = half; } }
  if (!G.raise2 && G.club != null) { G.raise2 = true; G.inbox = G.inbox.filter(m => !(m.key === "raise" && !m.done && !m.data.threat && G.players[m.data.pid] && !settledPay(G.players[m.data.pid]))); }  // 0.81.2: one-off: drop pay-rise asks from players too new to ask
  if (!G.fix2 && G.club != null) { G.fix2 = true; const sd = my().squad.map(P).find(p => p && /Simon Dalsgaard/i.test(p.name)); if (sd) sd.yrs = 4; }  // 0.80.3: one-off: his deal is four years
  if (!G.derby && G.club != null) buildDerbies();  // 0.78.4: derbies are historical, settled once
  if (!G.fd2) { G.fd2 = true; for (const x of G.clubs) delete x.feedAsk; if (G.club != null) for (const f of net().feeders || []) { const x = CL(f.id); if (x) f.fund = feederAsk(x); } }  // 0.75.5: feeder asks re-set at the new, lower rate
  if (!G.foreign4) { G.foreign4 = true; addForeignLeagues(); }  // 0.72: fifteen more leagues abroad
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
  // Ratings as they stand (a save from before the arrows had none): the arrows start from here.
  for (const p of Object.values(G.players)) if (p.r0 == null) p.r0 = r20(p.ovr);
  if (G.board && G.board.dir) delete G.board.dir;  // directors were removed
  // Staff targets: the first summer they exist can be set in any week of it; old-style targets are cleared.
  if (!G.sgrace1) { G.sgrace1 = true; if (G.phase === "summer") G.sgrace = G.year; if (G.sobj && G.sobj.manager && Object.values(G.sobj.manager).some(v => typeof v === "number")) G.sobj = null; }
  // The manager's assists target became one player's assists: a target set the old way is converted.
  { const a = G.sobj && G.sobj.manager && G.sobj.manager.assists; if (a && a.v && a.v[0] > 25) { a.v = [6, 10, 14, 20]; a.label = "Top assister's assists"; } }
  // One-off: Max Cutler's pay rise at South Kensington should have come with a new contract.
  if (!G.cutler4 && G.club != null) { G.cutler4 = true; const c = my(); if (/South Kensington/.test(c.name)) { const p = c.squad.map(id => G.players[id]).find(p => p && p.name === "Max Cutler"); if (p && p.yrs < 4) { p.yrs = 4; p.dealY = G.year; p.expiring = false; } } }
  // Statement signings' wages were uncapped: anyone above €500k a week comes down to it (once).
  if (!G.stunCap) { G.stunCap = true; for (const p of Object.values(G.players)) if (p.stunC != null && p.wage > 500e3 * 52) p.wage = 500e3 * 52; }
  if (G.club != null) syncReg();  // auto-registration: the best 25 while a window is open
  if (!G.brk1) { G.brk1 = true; if (G.club != null) for (const id of my().squad.slice()) { const p = G.players[id]; if (p) breakSlump(p); } }  // one-off: the summer roll this squad missed
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
  const due = { mdops: 0, travel: 0, util: utilities(c) / YEAR_TICKS() * wk, insure: wageBill(c) * INSURE / YEAR_TICKS() * wk, medical: 0, grading: 0 };
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
  depth: el => { const role = el.dataset.role, id = +el.dataset.id, d = +el.dataset.d, L = (DEPTH_VIEW[role] || []).slice(), i = L.indexOf(id), j = i + d; if (el.closest("details")) (G.depthOpen ||= {})[role] = true;  // keep the fold open while you reorder inside it
    if (i < 0 || j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; (G.depth ||= {})[role] = L; render(); saveGame(); },
  depthadd: el => { const role = el.dataset.role, id = +el.dataset.id, X = ((G.depthX ||= {})[role] ||= []); if (!X.includes(id)) X.push(id); render(); saveGame(); },
  depthdrop: el => { const role = el.dataset.role, id = +el.dataset.id; if (G.depthX && G.depthX[role]) G.depthX[role] = G.depthX[role].filter(i => i !== id); if (G.depth && G.depth[role]) G.depth[role] = G.depth[role].filter(i => i !== id); render(); saveGame(); },
  depthresetall: async () => { const n = Object.keys(G.depth || {}).length, f = my().squad.map(P).filter(p => p && p.force).length; if (!n) return;
    if (!await ask(`Put all ${n} position${n > 1 ? "s" : ""} you've ordered back into the manager's order?${f ? ` (${f} "insist he starts" pick${f > 1 ? "s stay" : " stays"}: clear ${f > 1 ? "them" : "it"} on the player's card.)` : ""}`)) return;
    G.depth = {}; toast("Every position is back in the manager's order."); render(); saveGame(); },
  bestxi: async el => { const c = my(), chem = !!el.dataset.chem, xi = chem ? chemXI(c) : bestXI(c); if (!xi.length) return;
    const roles = [...new Set(xi.map(x => x.slot))], now = pickXI(c), sum = x => x.reduce((t, o) => t + roleRating(o.p, o.slot), 0) / 10, fmt = v => (v >= 0 ? "+" : "") + v.toFixed(1);
    const extra = ` Chemistry ${fmt(chemScore(now, c))} now, ${fmt(chemScore(xi, c))} with this side; combined rating ${(sum(xi) - sum(now) >= 0 ? "+" : "") + (sum(xi) - sum(now)).toFixed(1)} on the current XI.`;
    if (!await ask(`Make your ${chem ? "best-chemistry" : "best-fitting"} XI the starters? ${xi.map(x => `${x.p.name.split(" ").slice(-1)[0]} (${x.slot})`).join(", ")}.${extra} Each position's depth chart puts them first; the rest follow as they are.`)) return;
    G.depth ||= {}; for (const role of roles) { const top = xi.filter(x => x.slot === role).sort((a, b) => roleRating(b.p, role) - roleRating(a.p, role)).map(x => x.p.id);
      const rest = depthOrder(c, role).filter(id => !top.includes(id)); G.depth[role] = [...top, ...rest]; (G.depthX ||= {}); for (const id of top) if (!depthLine(P(id), role)) (G.depthX[role] ||= []).includes(id) || G.depthX[role].push(id); }
    toast(`Your ${chem ? "best-chemistry" : "best-fitting"} XI are now the starters.`); render(); saveGame(); },
  depthreset: el => { if (G.depth) delete G.depth[el.dataset.role]; render(); saveGame(); },
  praise: el => { praiseDo(+el.dataset.id, el.dataset.t, el.dataset.how); render(); saveGame(); },
  optprice: el => { const c = my(), ks = el.dataset.k === "all" ? ["ticket", "st", "conc", "shirt", ...(c.fac.stadium.own && c.fac.stadium.suites ? ["suite"] : [])] : [el.dataset.k], done = [];
    for (const k of ks) { if (k === "ticket" && priceFrozen()) { done.push("tickets frozen (your promise to the trust)"); continue; } const p = bestPrice(c, k); if (p != null) { c.prices[k] = p; done.push(`${{ ticket: "ticket", st: "season ticket", conc: "food & drink", shirt: "shirt", suite: "suites" }[k]} ${eur(p)}`); } }
    toast(`Most profitable: ${done.join(", ")}.`); render(); saveGame(); },
  msgseen: el => { for (const m of G.inbox) if (el.dataset.id === "all" ? !["bid", "war", "choice"].includes(m.type) : m.id === +el.dataset.id) m.seen = true; render(); saveGame(); },
  signseen: () => { G.newSign = []; render(); saveGame(); },
  mend: el => { staffMend(el.dataset.r, el.dataset.k); render(); saveGame(); },
  mtab: el => { MARKET_F.tab = el.dataset.k; render(); },
  fav: el => { const id = +el.dataset.id; G.favs ||= []; G.favs = G.favs.includes(id) ? G.favs.filter(x => x !== id) : [...G.favs, id]; if (document.querySelector(".modal") && el.closest(".modal")) playerModal(id); render(); saveGame(); },
  loanredo: el => { const p = P(+el.dataset.id), r = redoLoan(p, +$("#rshare").value / 100); LOAN_SAY = r.ok ? null : { id: p.id, t: r.t }; toast(r.t); playerModal(p.id); render(); saveGame(); },
  loanask: async el => { const p = P(+el.dataset.id), share = +($("#lshare") ? $("#lshare").value : 50) / 100, short = wageShort(p.wage * share), r = askLoan(p, share);
    LOAN_SAY = r.ok ? null : { id: p.id, t: r.t };
    if (r.ok) { closeModal(); await offerWageRaise(p, p.wage * share, short); closeModal(); toast(r.t); } else playerModal(p.id);
    render(); saveGame(); },
  sort: el => { const [id, k] = el.dataset.v.split("|"), cur = SORTS[id]; SORTS[id] = { k, d: cur && cur.k === k ? -cur.d : SORT_UP.includes(k) ? 1 : -1 }; render(); },
  apoffer: el => { const m = G.inbox.find(x => x.id === +el.dataset.id), inp = $("#ap-w-" + el.dataset.id); if (!m || !inp) return; m.data.offer = Math.round(num(inp) * 52); answerChoice(m, 0); render(); saveGame(); },
  choose: el => { const m = G.inbox.find(x => x.id === +el.dataset.id); if (m) answerChoice(m, +el.dataset.i); render(); saveGame(); },
  seekinv: () => { G.board.offers = investmentOffers(); if (!G.board.offers.length) toast("You can't sell any more without losing control."); render(); },
  sellstake: async el => { const o = G.board.offers[+el.dataset.i]; if (o && await ask(`Sell ${o.pct}% of the club to ${o.name} for ${money(o.amt)}?`)) { sellStake(o); render(); saveGame(); } },
  buyback: async el => { const i = G.board.inv[+el.dataset.i]; if (await ask(`Buy back ${i.name}'s ${i.pct}% for ${money(buyBackPrice(i))} of your own money?`)) { buyBack(+el.dataset.i); render(); saveGame(); } },
  meettrust: () => { meetTrust(); render(); },
  trustseat: async () => { if (await ask("Give the supporters' trust a seat on the board?")) { G.sTrust.seat = true; trustRel(12, "A supporters' trust director joins the board."); moodHit(my(), 3); render(); } },
  setobj: () => { const o = {}; for (const k of Object.keys(OBJ)) { const el = $("#obj-" + k); o[k] = el ? +el.value || 0 : 0; } setObjectives(o); render(); saveGame(); },
  objreset: () => { G.obj = null; render(); },
  sobjedit: el => { STO_EDIT = el.dataset.role; render(); },
  setsobj: el => { if (!staffTargetsOpen()) return toast("Staff targets are set in week 1 of pre-season."); const role = el.dataset.role, L = staffTargetLevels()[role], T = {};
    for (const [k, [label, v]] of Object.entries(L)) { const lv = +($(`#so-${role}-${k}`) || {}).value || 0; if (lv) T[k] = { lv, v, label }; }
    if (role === "recruit") T.posK = $("#so-recruit-posK").value; STO_EDIT = null; setStaffObjectives(role, T); render(); saveGame(); },
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
  page: el => { PAGE = el.dataset.p; if (PAGE === "league" && G.phase === "summer") SUB.comp = "pre"; /* pre-season: open on the friendlies */ MAST_COMPACT = false; closeModal(); render(); scrollTo(0, 0); lastY = 0; },
  sub: el => { SUB[el.dataset.k] = el.dataset.v; if (el.dataset.p) { PAGE = el.dataset.p; scrollTo(0, 0); } render(); },
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
  retrain: async el => { const p = P(+el.dataset.id), to = el.dataset.to, V = retrainView(p, to);
    if (!await ask(`Retrain ${p.name} as a ${POS_NAME[to].toLowerCase()}? ${mgr() && mgr().name ? mgr().name : "The manager"} thinks it's ${V.verdict === "neutral" ? "neutral" : `a ${V.verdict} move`}: about ${V.ovr[0]}${V.ovr[1] !== V.ovr[0] ? "–" + V.ovr[1] : ""} now. He can only retrain once.`, "Retrain him")) return playerModal(p.id);
    retrain(p, to); playerModal(p.id); render(); saveGame(); },
  storyy: el => { STORY_Y = +el.value; render(); },
  rnclause: el => { RENEW_CL = { id: +el.dataset.id, m: +el.value }; render(); },
  renewgo: el => { const p = P(+el.dataset.id), r = offerRenewal(p, num($("#rn-wage")) * 52, +$("#rn-yrs").value, +(($("#rn-clause") || {}).value || 0));
    RENEW_SAY = r.ok ? null : { id: p.id, t: r.t }; if (r.ok) toast(r.t); playerModal(p.id); render(); saveGame(); },
  ptab: el => { PCARD = { id: +el.dataset.id, tab: el.dataset.v }; playerModal(+el.dataset.id); },
  hofsort: el => { HOF_SORT = el.dataset.v; render(); },
  fitwage: el => { const p = P(+el.dataset.id), sh = $("#lshare") ? $("#lshare").value : null; raiseWages(+el.dataset.amt, p); el.dataset.re === "pre" ? preModal(p.id) : playerModal(p.id);
    if (sh != null && $("#lshare")) { $("#lshare").value = sh; CHANGE.lshare($("#lshare")); } render(); saveGame(); },
  fitbudget: async el => { const p = P(+el.dataset.id), loan = !!el.dataset.loan, f = budgetFit(p, loan), c = my(), s = staffOf("recruit"); if (!f || !s) return;
    const on = suggested(p), also = !on || !!on.loan !== loan;
    if (!await ask(`Raise ${budgetFitText(f)} so ${s.name} can ${loan ? "borrow" : "sign"} ${p.name}?${also ? ` You'll also suggest ${loan ? "borrowing" : "signing"} him.` : ""}`)) return;
    c.budget.transfer += f.transfer; c.budget.wages += f.wages; news(`You raise ${budgetFitText(f)} to make room for ${p.name}.`);
    if (also) suggest(p, loan); else setHold(p, loan); { const x = sugg().find(y => y.id === p.id); if (x) x.raised = true; } playerModal(p.id); render(); saveGame(); },
  suggest: el => { const p = P(+el.dataset.id); suggest(p, !!el.dataset.loan); if (document.querySelector(".modal")) playerModal(p.id); render(); saveGame(); },
  nfs: el => { const p = P(+el.dataset.id); setNotForSale(p, !p.nfs); toast(p.nfs ? `${p.name} is not for sale: no club will bid for him.` : `${p.name} is available again.`); playerModal(p.id); render(); saveGame(); },
  sugloan: el => { const p = P(+el.dataset.id); loanListToggle(p); render(); saveGame(); },
  loanlist: el => { const p = P(+el.dataset.id); loanListToggle(p); playerModal(p.id); render(); saveGame(); },
  fselall: () => { const c = my(), ids = c.squad.filter(id => { const p = P(id); return !p.acad && !(p.loan && p.loan.to === c.id); }); if (FSEL.size === ids.length) FSEL.clear(); else ids.forEach(id => FSEL.add(id)); render(); },
  fbulk: async el => {
    const c = my(), v = el.dataset.v, ps = [...FSEL].map(P).filter(p => p && !p.acad && p.club === c.id && !(p.loan && p.loan.to === c.id)); if (!ps.length) return;
    if (v === "tl" && !await ask(`Put ${ps.length} player${ps.length > 1 ? "s" : ""} on the transfer list? ${ps.map(p => p.name).join(", ")}.`)) return;
    let n = 0;
    for (const p of ps) {
      if (v === "keep" && !p.keep) { p.keep = true; if (p.list) ownerList(p); n++; }
      else if (v === "unkeep" && p.keep) { p.keep = false; n++; }
      else if (v === "ll" && !p.loanList) { loanListToggle(p); n++; }
      else if (v === "unll" && p.loanList) { loanListToggle(p); n++; }
      else if (v === "tl" && !p.list) { p.keep = false; ownerList(p); n++; }
      else if (v === "untl" && p.list) { ownerList(p); n++; }
      else if (v === "nfs" && !p.nfs) { setNotForSale(p, true); n++; }
      else if (v === "unnfs" && p.nfs) { setNotForSale(p, false); n++; }
    }
    const what = { keep: "protected", unkeep: "no longer protected", ll: "loan-listed", unll: "taken off the loan list", tl: "transfer-listed", untl: "taken off the transfer list", nfs: "made not for sale", unnfs: "made available again" }[v];
    toast(n ? `${n} player${n > 1 ? "s" : ""} ${what}.` : `Nothing to change: ${{ keep: "they were all protected already", unkeep: "none of them was protected", ll: "they were all on the loan list already", unll: "none of them was on the loan list", tl: "they were all on the transfer list already", untl: "none of them was on the transfer list", nfs: "they were all not for sale already", unnfs: "none of them was marked not for sale" }[v]}.`);
    FSEL.clear(); render(); saveGame(); },
  aselall: () => { const ids = my().squad.filter(id => P(id).acad); if (ASEL.size === ids.length) ASEL.clear(); else ids.forEach(id => ASEL.add(id)); render(); },
  // (1.2.56) The youth coach picks who's ready for a professional contract: they're ticked, and he says why.
  ypick: () => { const c = my(), yc = staffOf("youth"); if (!yc) return; const ps = c.squad.map(P).filter(p => p && p.acad && p.age >= 16), picks = ps.filter(p => youthReady(p, c)), T = TIER_LVL[c.tier];
    ASEL.clear(); for (const p of picks) ASEL.add(p.id);
    YPICK_SAY = picks.length ? `<b>${esc(yc.name)}:</b> "${picks.length === 1 ? "He's" : "They're"} ready for a professional contract: ${picks.map(p => `${esc(p.name)} (${p.age}, ${p.ovr >= T - 8 ? `rated ${r20(p.ovr)}, good enough now` : `potential ${est20(potEstimate(p))}`})`).join(", ")}." Tap Pro contract to promote ${picks.length === 1 ? "him" : "them"}, or untick anyone first.`
      : `<b>${esc(yc.name)}:</b> "Nobody's ready yet. I'd give them another season." ${ps.length ? "" : "(No academy players are 16 or over.)"}`;
    render(); },
  abulk: async el => { YPICK_SAY = "";
    const c = my(), v = el.dataset.v, ps = [...ASEL].map(P).filter(p => p && p.acad && p.club === c.id); if (!ps.length) return;
    const y = staffOf("youth"), over = y && ["release", "promote", "keep"].includes(v) ? youthOverrides(v, ps) : [];
    const warn = over.length ? ` ${y.name} ${v === "release" ? `rates ${over.length === ps.length && over.length > 1 ? "all of them" : over.map(p => p.name).join(", ")} and won't like it` : v === "promote" ? `doesn't think ${over.map(p => p.name).join(", ")} ${over.length > 1 ? "are" : "is"} ready` : `would let ${over.map(p => p.name).join(", ")} go`}.` : "";
    if (v === "release" && !await ask(`Release ${ps.length} academy player${ps.length > 1 ? "s" : ""}? ${ps.map(p => p.name).join(", ")}.${warn}`)) return;
    if (v === "promote" && !await ask(`Offer professional contracts to ${ps.length} academy player${ps.length > 1 ? "s" : ""}? They join the first-team squad.${warn}`)) return;
    if (["release", "promote", "keep"].includes(v)) overruleYouth(v, ps);
    for (const p of ps) {
      if (v === "keep") p.keep = true; else if (v === "unkeep") p.keep = false;
      else if (v === "promote") { const was = p.wage; p.acad = false; p.yrs = 2; p.wage = Math.max(p.wage, Math.round(demandWage(p, c) / 100) * 100); logPay(p, was, "first professional contract"); }
      else if (v === "release") { leaveClub(p); toFreeAgent(p); }
    }
    const names = ps.map(p => p.name).join(", ");
    news(v === "keep" ? `Kept on (they'll be given contracts when they come of age): ${names}.` : v === "unkeep" ? `No longer marked to keep: ${names}.` : v === "promote" ? `Promoted to the first-team squad on professional contracts: ${names}.` : `Released from the academy: ${names}.`, v !== "keep" && v !== "unkeep");
    toast(`${ps.length} player${ps.length > 1 ? "s" : ""} ${v === "keep" ? "kept" : v === "unkeep" ? "unmarked" : v === "promote" ? "promoted" : "released"}.`);
    ASEL.clear(); render(); saveGame();
  },
  eurostart: el => { const p = P(+el.dataset.id); p.euroStart = !p.euroStart; toast(p.euroStart ? `${p.name} will start the European games.` : `The manager picks the European side as usual.`); playerModal(p.id); saveGame(); },
  cupstart: el => { const p = P(+el.dataset.id); p.cupStart = !p.cupStart; toast(p.cupStart ? `${p.name} will start the cup games.` : `The manager picks the cup side as usual.`); playerModal(p.id); saveGame(); },
  forcey: el => { const p = P(+el.dataset.id); if (!p.force && my().squad.filter(id => P(id).force).length >= MAX_FORCED) return toast(`You can insist on at most ${MAX_FORCED} players.`); p.force = !p.force; p.forceNoted = false; toast(p.force ? `${p.name} will start: the manager has been told.` : `The manager picks ${p.name} on merit again.`); render(); saveGame(); },
  force: el => { const p = P(+el.dataset.id); if (!p.force && my().squad.filter(id => P(id).force).length >= MAX_FORCED) return toast(`You can insist on at most ${MAX_FORCED} players.`); p.force = !p.force; p.forceNoted = false; toast(p.force ? `${p.name} will start: the manager has been told.` : `The manager picks ${p.name} on merit again.`); playerModal(p.id); render(); saveGame(); },
  sendback: async el => { const p = P(+el.dataset.id); if (!p || !p.loan || p.loan.to !== G.club) return; if (!await ask(`Send ${p.name} back to ${CL(p.loan.from).name}? His loan ends now and the loan place is free.`)) return; returnLoan(p, "you"); closeModal(); render(); saveGame(); },
  recall: async el => { const p = P(+el.dataset.id); if (!p || !p.loan) return; if (!await ask(`Recall ${p.name} from ${CL(p.club).name}?${recallFee(p) ? ` They're owed ${money(recallFee(p))} for the trouble.` : ""}`)) return; recallLoan(p); closeModal(); render(); saveGame(); },
  keep: el => { const p = P(+el.dataset.id); p.keep = !p.keep; if (p.keep && p.acad) overruleYouth("keep", [p]); toast(p.keep ? `${p.name} is protected: not for sale, and he'll be offered a new contract.` : `${p.name} is no longer protected.`); playerModal(p.id); render(); },
  promote: el => { const p = P(+el.dataset.id), c = my(), was = p.wage; overruleYouth("promote", [p]); p.acad = false; p.yrs = 2; p.wage = Math.max(p.wage, Math.round(demandWage(p, c) / 100) * 100); logPay(p, was, "first professional contract"); news(`${p.name} is promoted from the academy on a professional contract.`, true); closeModal(); render(); },
  askp: el => { const p = P(+el.dataset.id), v = el.dataset.clear ? 0 : Math.round(num($("#askp" + p.id))); if (v > 0) p.askP = v; else delete p.askP;
    toast(v > 0 ? `${p.name}: asking ${money(v)}. A club that pays it buys him.` : `${p.name}: no asking price.`); playerModal(p.id); render(); saveGame(); },
  fweek2: el => { SUB.fw = +el.dataset.v; render(); const s = document.querySelector('[data-act="fweek"]'); if (s) s.scrollIntoView({ block: "center" }); },
  list: el => { const p = P(+el.dataset.id); ownerList(p); playerModal(p.id); render(); saveGame(); },
  release: async el => { const p = P(+el.dataset.id); if (!await ask(`Release ${p.name}?${p.acad ? "" : ` It costs ${money(releaseCost(p))}.`}`)) return; if (p.acad) { overruleYouth("release", [p]); leaveClub(p); toFreeAgent(p); news(`${p.name} is released from the academy.`); } else ownerRelease(p); closeModal(); render(); saveGame(); },
  buy: el => buyModal(+el.dataset.id),
  pre: el => preModal(+el.dataset.id),
  prego: async el => { const p = P(+el.dataset.id), wage = num($("#pre-wage")) * 52, a = playerAppeal(p, wage);
    if (!preContractOK(p)) return toast("It's too late for that now.");
    if (renewsAI(p) && wage < preAsk(p) * .97) return toast(`${p.name} says he'll be signing a new deal with ${CL(p.club).name}. It would take about ${pw(preAsk(p))} to tempt him.`);
    if (a.score < a.pr.thr) return toast(`${p.name} turns you down. ${refusalReason(a, P_FACTORS)}`);
    await offerWageRaise(p, wage); agreePre(p, wage); closeModal(); render(); saveGame(); },
  buygo: el => {
    const p = P(+el.dataset.id), fee = num($("#b-fee")), wage = num($("#b-wage")) * 52, ask = askingFee(p);
    if (ssrBound(my()) && fee > plSales(my())) return toast("You're on the league's spending limit (sustainability tests): no transfer fee that your sales this season don't cover.");
    if (my().scrBan === G.year && fee > 0) return toast("You broke the squad cost rule last season: no transfer fees this season. Free agents, loans and pre-contracts only.");
    if (p.loan && p.loan.ai) return toast(`${p.name} is on loan at ${CL(p.club).name} from ${CL(p.loan.from).name} until the end of the season: try again in the summer.`);
    if (embargoed(my()) && p.club !== -1) return toast("You're under a transfer embargo: free agents only (or a pre-contract) until the debts are cleared.");
    if (fee < ask * .95) return toast(`${p.club >= 0 ? CL(p.club).name : "His club"} turn the offer down. They want about ${money(ask)}.`);
    const a = playerAppeal(p, wage);
    if (a.score < a.pr.thr) return toast(`${p.name} turns you down. ${refusalReason(a, P_FACTORS)}`);
    if (!windowOpen() && p.club >= 0 && !proSigning(p)) { agreeIncoming(p, fee, wage); toast(`${p.name} says yes: the deal is agreed and goes through when the window opens.`); } else { ownerBuy(p, fee, wage); toast(`${p.name} says yes: he signs on ${pw(wage)}${fee > 0 ? `, fee ${money(fee)}` : ""}.`); }  /* a professional contract for a part-timer: any time */ closeModal(); render(); saveGame();
  },
  unagree: el => { const p = P(+el.dataset.id); if (p && p.toMe) { delete p.toMe; news(`You pull out of the agreed deal for ${p.name}.`); } closeModal(); render(); saveGame(); },
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
    if (q.over) return toast(`A compact box holds at most ${q.over.toLocaleString()}: make it smaller or choose another shape.`);
    built(startBuild("stadium", { type: "new", ...q, vent: d.vent || [], name, stands: d.stands, family: d.family, corp: d.corp, suites: d.suites || 0, label: `building ${name}, ${q.cap.toLocaleString()} capacity` })); G.stDraft = null; render(); saveGame(); },
  stplan: el => { if (my().fac.stadium.own) G.rgOpen = true; const keep = G.stDraft; G.stDraft = standPlan(+el.dataset.n); if (keep) { G.stDraft.family = keep.family; G.stDraft.vent = keep.vent || []; G.stDraft.corp = keep.corp || 0; G.stDraft.suites = keep.suites || 0; for (const k in SIDES) { G.stDraft.stands[k].type = keep.stands[k].type; G.stDraft.stands[k].roof = keep.stands[k].roof; } } render(); },
  sdnofam: () => { G.stDraft.family = ""; render(); },
  extend: async el => { const k = el.dataset.k, n = Math.round(num($("#ext-" + k)) / 50) * 50; if (n < 50) return toast("Add at least 50 places.");
    const lf = stStyle(standsOf(my().fac.stadium)[k]).land; if (n * lf > siteRoom(my().fac.stadium)) return toast(`Only room for ${Math.floor(siteRoom(my().fac.stadium) / lf).toLocaleString()} more places on this site.`);
    const q = standQuote(my(), k, n); if (!await ask(`Extend the ${SIDES[k]} by ${n.toLocaleString()} for ${money(q.cost)} (about ${q.weeks} weeks)? The stand's ${standsOf(my().fac.stadium)[k].cap.toLocaleString()} places close until it's done.`)) return;
    built(startBuild("stadium", { type: "expand", ...q, label: `extending the ${SIDES[k]} (+${n.toLocaleString()})` })); render(); saveGame(); },
  archfxgo: async () => { const c = my(), S = c.fac.stadium, D = G.archDraft; if (!D || !archFixOK(c)) return;
    const f = archFixCost(c, D);
    if (!await ask(`Set ${S.name}'s design${f > 0 ? ` for ${money(f)}` : f < 0 ? ` (${money(-f)} back)` : ""}? It takes effect at once. This is a one-off and can't be changed afterwards except by rebuilding.`)) return;
    if (f) spend("build", f);
    for (const [k, x] of Object.entries(standsOf(S))) x.style = D.styles[k] || "std"; S.shape = D.shape; S.feat = { ...D.feat }; S.archSet = true; syncCap(S); c.cap = capacity(c); G.archDraft = null;
    news(`${S.name}'s design is set: ${Object.values(standsOf(S)).map(x => stStyle(x).l.toLowerCase()).join(", ")}; ${shapeOf(S).l.toLowerCase()}${Object.keys(S.feat).filter(k => S.feat[k]).length ? `; ${Object.keys(S.feat).filter(k => S.feat[k]).map(k => FEATURES[k].l.toLowerCase()).join(", ")}` : ""}.`, true); render(); saveGame(); },
  feat: async el => { const c = my(), k = el.dataset.k, q = featQuote(c, k); if (c.fac.stadium.build) return toast("Finish the current building work first.");
    if (!await ask(`Add ${FEATURES[k].l.toLowerCase()} to ${c.fac.stadium.name} for ${money(q.cost)}? About ${q.weeks} weeks.`)) return; built(startBuild("stadium", { type: "feat", k, cost: q.cost, weeks: q.weeks, label: `adding ${FEATURES[k].l.toLowerCase()}` })); render(); saveGame(); },
  rebuild: async el => { const k = el.dataset.k, c = my(), r = (G.rb || {})[k] || standsOf(c.fac.stadium)[k], q = rebuildQuote(c, k, r.cap, r.type, r.roof, r.style), S0 = c.fac.stadium;
    if (rebuildFoot(S0, k, r) > siteCap(S0)) return toast("Too big for the site.");
    if (!await ask(`Demolish the ${SIDES[k]} and build ${r.cap.toLocaleString()} ${r.type === "terrace" ? "terrace places" : "seats"} for ${money(q.cost)}? It's closed for about ${q.weeks} weeks.`)) return;
    built(startBuild("stadium", { type: "rebuild", ...q, label: `rebuilding the ${SIDES[k]} (${r.cap.toLocaleString()})` })); G.rb = {}; G.rbOpen = null; render(); saveGame(); },
  mvsite: el => { G.moveK = el.dataset.k; G.plotN = null; G.mvOpen = true; render(); },
  mvstay: el => { G.mvStay = el.dataset.v; G.mvOpen = true; render(); },
  mvplot: el => { G.plotN = +el.dataset.n; G.mvOpen = true; render(); },
  mvplan: el => { G.mvOpen = true; const keep = G.mvDraft; G.mvDraft = standPlan(+el.dataset.n); if (keep) { G.mvDraft.family = keep.family; G.mvDraft.vent = keep.vent || []; G.mvDraft.corp = keep.corp || 0; G.mvDraft.suites = keep.suites || 0; for (const k in SIDES) { G.mvDraft.stands[k].type = keep.stands[k].type; G.mvDraft.stands[k].roof = keep.stands[k].roof; } } render(); },
  buyplot: async () => { const c = my(), { pick, plot } = mvChoice(c); if (ownPlot(c) || c.fac.stadium.build) return;
    if (!await ask(`Buy land ${pick.km} km away (${pick.l.toLowerCase()}) with room for a ground of up to ${plot.toLocaleString()}, for ${money(landCost(c, pick, plot))}? You can build on it whenever you like.`)) return;
    buyPlot(c, pick, plot); G.mvOpen = true; render(); saveGame(); },
  adjbuy: async el => { const c = my(), n = +el.dataset.n; if (!(n >= 500 && n <= adjMax(c))) return;
    if (!await ask(`Buy the land next to ${c.fac.stadium.name}, enough for ${n.toLocaleString()} more places, for ${money(adjCost(c, n))}?${adjAnger(c, n) >= 10 ? " Families will be bought out of their homes: the supporters and the town will be furious." : adjAnger(c, n) ? " Some neighbours will have to move: supporters won't like it." : ""}`)) return;
    buyAdjacent(c, n); render(); saveGame(); },
  vacbuy: async () => { const c = my(), v = vacantNow(c); if (!v) return; if (!await ask(`Buy ${v.l} next to ${c.fac.stadium.name} (room for ${v.size.toLocaleString()} more places) for ${money(vacantCost(c, v))}?`)) return; buyVacant(c); render(); saveGame(); },
  sellplot: async () => { const c = my(), P0 = ownPlot(c); if (!P0) return; if (!await ask(`Sell your land ${P0.km} km away for ${money(Math.round(P0.paid * .85 / 1e4) * 1e4)}?`)) return; sellPlot(c); render(); saveGame(); },
  movebuild: async () => { const c = my(), { pick: site, plots, plot } = mvChoice(c), d = G.mvDraft, q = moveQuote(c, d, site, plot), name = ($("#mv-name").value || c.town + " Stadium").trim();
    if (q.space > plot) return toast(`The stands and extras need room for ${q.space.toLocaleString()}; this plot takes ${plot.toLocaleString()}.`);
    const rent = G.mvStay === "rent", S = c.fac.stadium, h = tempHost(c);
    if (!await ask(`${site.owned ? `Build on your land ${site.km} km away (room for ${plot.toLocaleString()}):` : `Buy a plot ${site.km} km away (room for ${plot.toLocaleString()}) and build`} ${name} (${q.cap.toLocaleString()}) for ${money(q.cost)}? About ${q.weeks} weeks. ${rent ? `${S.name} is sold now for about ${money(q.sell)} and home games move to ${HOSTS[h].name} until the new ground opens.` : `You keep playing at ${S.name} and sell it on moving day.`}${site.km > 9 ? " Supporters won't like it." : ""}`)) return;
    if (q.over) return toast(`A compact box holds at most ${q.over.toLocaleString()}: make it smaller or choose another shape.`);
    const res = startBuild("stadium", { type: "move", ...q, vent: d.vent || [], sold: rent, name, stands: d.stands, family: d.family, corp: d.corp, suites: d.suites || 0, label: `building ${name} (${q.cap.toLocaleString()}), ${site.km} km away` });
    if (S.build && S.build.type === "move" && q.px && !site.owned) { trustRel(-Math.min(10, Math.round(q.px / 4))); news(`The council takes its time over a ${plot.toLocaleString()}-capacity plot for a club that draws about ${supportSize(c).toLocaleString()}: about ${q.px} extra weeks of planning. The supporters' trust asks whether the club can ever fill it.`, true); }
    if (S.build && S.build.type === "move") { if (rent) { earn("oldground", q.sell); S.soldOld = true; S.rebuilding = true; S.away = h; c.cap = capacity(c); news(`${S.name} is sold for ${money(q.sell)}. Home games move to ${HOSTS[h].name} until ${name} opens.`, true); } if (!site.owned) moveAnnounced(c, site.km, { k: site.k, km: site.km, site: plot }); delete S.plot; }
    built(res); G.mvDraft = null; G.mvOpen = false; G.sites = null; render(); saveGame(); },
  reground: async () => { const c = my(), S = c.fac.stadium, d = G.stDraft || standPlan(S.cap), q = regroundQuote(c, d), h = tempHost(c);
    if (q.space > siteCap(S)) return toast(`The stands and extras need room for ${q.space.toLocaleString()}; the site takes ${siteCap(S).toLocaleString()}.`);
    if (!await ask(`Demolish ${S.name} and build a new ${q.cap.toLocaleString()}-capacity ground for ${money(q.cost)}? About ${q.weeks} weeks, playing at ${HOSTS[h].name} meanwhile.`)) return;
    if (q.over) return toast(`A compact box holds at most ${q.over.toLocaleString()}: make it smaller or choose another shape.`);
    const res = startBuild("stadium", { type: "reground", ...q, vent: d.vent || [], name: S.name, stands: d.stands, family: d.family, corp: d.corp, suites: d.suites || 0, label: `rebuilding ${S.name}, ${q.cap.toLocaleString()} capacity` });
    if (S.build && S.build.type === "reground") { S.build.host = h; S.rebuilding = true; S.away = h; c.cap = capacity(c); news(`${S.name} closes for rebuilding. Home games move to ${HOSTS[h].name}.`, true); }
    built(res); G.stDraft = null; G.rgOpen = false; render(); saveGame(); },
  roof: async el => { const k = el.dataset.k, q = roofQuote(my(), k); if (!await ask(`Put a roof on the ${SIDES[k]} for ${money(q.cost)}? It closes for about ${q.weeks} weeks.`)) return; built(startBuild("stadium", { type: "roof", ...q, label: `a roof for the ${SIDES[k]}` })); render(); saveGame(); },
  convert: async el => { const k = el.dataset.k, q = convertQuote(my(), k); if (!await ask(`Make the ${SIDES[k]} ${q.to === "seat" ? "all-seated" : "a terrace"} for ${money(q.cost)}? It closes for about ${q.weeks} weeks.`)) return; built(startBuild("stadium", { type: "convert", ...q, label: `${q.to === "seat" ? "seating" : "terracing"} the ${SIDES[k]}` })); render(); saveGame(); },
  family: async el => { const k = el.dataset.k, x = standsOf(my().fac.stadium)[k]; if (!x.family && !await ask(`Make the ${SIDES[k]} the family stand for ${money(familyCost(my(), k))}?`)) return; setFamily(my(), k); render(); saveGame(); },
  corp: async () => { const c = my(), n = Math.min(Math.round(num($("#corp-n"))), corpMax(c) - corpSeats(c)); if (n < 1) return; const q = corpQuote(c, n); if (!await ask(`Fit ${n} corporate seats in the Main stand for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "corp", ...q, label: `${n} corporate seats` })); render(); saveGame(); },
  expand: async el => { if (+el.dataset.n > siteRoom(my().fac.stadium)) return toast("No room on the site."); const q = expandQuote(my(), +el.dataset.n); if (!await ask(`Build a ${q.add.toLocaleString()}-seat stand for ${money(q.cost)}?`)) return; built(startBuild("stadium", { type: "expand", ...q, label: `a new ${q.add.toLocaleString()}-capacity stand` })); render(); saveGame(); },
  amen: () => { const q = amenQuote(my()); built(startBuild("stadium", { type: "amen", ...q, label: `stadium facilities to level ${q.lvl}` })); render(); saveGame(); },
  suites: () => { const q = suiteQuote(my()); built(startBuild("stadium", { type: "suites", ...q, label: `${q.add} executive suites` })); render(); saveGame(); },
  psize: async el => { const k = el.dataset.k; if (!psizeOK(my(), k) || !await ask(`Mark out a ${PSIZE[k].l.toLowerCase()} pitch (${PSIZE[k].dim}) for ${money(psizeCost(my()))}?`)) return; setPsize(k); render(); saveGame(); },
  relay: async el => { const k = el.dataset.k; if (!await ask(`Re-lay the pitch with ${PITCH[k].l.toLowerCase()} for ${money(PITCH[k].cost(my()))}?`)) return; relayPitch(k); render(); saveGame(); },
  vent: async el => { const k = el.dataset.k; if (!await ask(`Build the ${VENTURES[k].l.toLowerCase()} for ${money(VENTURES[k].cost(my()))}? It takes about ${VENT_WEEKS[k] || 8} weeks to build and earns nothing until it opens.`)) return; buildVenture(k); render(); saveGame(); },
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
  preset: el => { const P = START_PRESETS[el.dataset.k]; if (!P) return;
    for (const [id, v] of Object.entries(P.v)) { const x = $("#" + id); if (x) x.value = v; }
    if (P.wealth) document.querySelectorAll("#f-wealth [aria-pressed]").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === P.wealth));
    el.parentNode.querySelectorAll(".pick-card").forEach(b => b.setAttribute("aria-pressed", b === el)); $("#f-more").open = true; CHANGE.fhint(); toast(`${P.l}: filled in. Change anything you like.`); },
  dcardall: el => { const on = el.dataset.v === "1"; G.depthCards = {}; for (const d of document.querySelectorAll("details[data-dcard]")) G.depthCards[d.dataset.dcard] = on; render(); },
  fmore: () => { SUB.fmore = (SUB.fmore || 40) + 40; render(); },
  found: async () => {
    const name = $("#f-name").value.trim(); if (!name) return toast("Give your club a name.");
    const sel = id => ($(`#${id} [aria-pressed="true"]`) || {}).dataset?.v;
    $("#busy").hidden = false; await new Promise(r => setTimeout(r, 30));
    const v = id => ($("#" + id) || {}).value, more = { tier: +v("f-tier") || 7, founded: +v("f-founded") || null, nick: (v("f-nick") || "").trim(), color2: sel("f-color2"), rep: v("f-rep") || "unknown", fans: v("f-fans") || "normal", mix: v("f-mix") || "bal",
      own: v("f-own") === "own", gname: (v("f-gname") || "").trim(), gcap: num($("#f-gcap") || { value: "" }) || 0, gage: +v("f-gage") || 0, glay: v("f-glay") || "mix", groom: v("f-groom") || "some", psize: v("f-psize") || "std", ptype: v("f-ptype") || "grass", loc: v("f-loc") || "sub",
      ftrain: +v("f-ftrain") || 0, facad: +v("f-facad") || 0, famen: +v("f-famen") || 0, fsuites: num($("#f-fsuites") || { value: "" }) || 0, fheat: !!v("f-fheat"), fvent: [...document.querySelectorAll(".f-fvent:checked")].map(x => x.value) };
    newWorld({ ...more, shortSet: !!$("#f-short").value.trim(), name, town: $("#f-town").value.trim() || name.split(" ")[0], short: ($("#f-short").value.trim() || name).toUpperCase(), owner: $("#f-owner").value.trim(), vision: JSON.parse(JSON.stringify(START_V)), half: (COUNTRY.ENG.regions.find(r => r[0] === $("#f-region").value) || [0, 0, 0, "S"])[3], region: $("#f-region").value, color: sel("f-color"), wealth: sel("f-wealth") || "wealthy" });
    startSeason(); refreshOffers(my());
    $("#busy").hidden = true; PAGE = "home"; render(); saveGame();
  },
};
const CHANGE = {
  fctry: el => { SUB.fctry = el.value; render(); },
  fq: el => { SUB.fq = el.value; SUB.fmore = 40; render(); const x = document.querySelector('[data-act="fq"]'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } },
  fhint: () => { const h = $("#f-hint"); if (h) h.innerHTML = startHint($("#f-region").value, $("#f-loc").value); },
  renewtick: el => { const p = P(+el.dataset.id); p.keep = el.checked; if (p.keep) { p.list = false; } news(p.keep ? `${p.name} will be offered a new contract when his runs out.` : `${p.name} is no longer marked to be kept.`); render(); saveGame(); },

  youthcups: el => { G.youthCups = el.checked; news(el.checked ? "You tell the manager to give your high-potential youngsters the lesser cup games." : "The manager picks his strongest side in the cups again."); render(); saveGame(); },
  autoreg: el => { G.autoReg = el.checked; if (el.checked) { syncReg(); toast(windowOpen() ? "Your best 25 are registered." : "Your best 25 will be registered when the next window opens."); } render(); saveGame(); },
  starhunt: el => { G.starHunt = el.checked; toast(el.checked ? "Your head of recruitment may now chase stars on huge wages." : "Your head of recruitment will leave the stars alone."); render(); },
  price: el => { const c = my(), k = el.dataset.k, v = num(el);
    if (k === "ticket" && priceFrozen()) { c.prices.ticket = G.sTrust.fp ?? c.prices.ticket; toast(`You promised the supporters' trust a price freeze: tickets stay at ${eur(c.prices.ticket)} until the end of ${seasonLabel(G.sTrust.freeze)}.`); render(); return; }
    c.prices[k] = v; render(); },
  ffund: el => { const f = net().feeders.find(x => x.id === +el.dataset.id); if (f) f.fund = Math.round(num(el)); render(); },
  loanout: async el => { if (!el.value) return; const p = P(+el.dataset.id), x = CL(+el.value); if (await ask(`Loan ${p.name} to ${x.name} until the end of the season?`)) { loanOut(p, x); closeModal(); render(); saveGame(); } },
  budget: el => { const c = my(), k = el.dataset.k, v = Math.round(num(el)), old = c.budget[k]; c.budget[k] = v;
    // Staff notice their budgets being cut hard.
    const role = { wages: "manager", transfer: "recruit", scout: "recruit", acad: "youth" }[k]; if (v < old * .7 && staffOf(role)) meddled(role, -4, `isn't happy about the ${k === "acad" ? "academy" : k} budget being cut.`, "Budget cuts");
    render(); },
  lshare: el => { const p = P(+el.dataset.id), box = $("#lfit"); if (p && box) box.innerHTML = wageFitLine(p, p.wage * +el.value / 100, "card"); },
  apw: el => { const m = G.inbox.find(x => x.id === +el.dataset.id), out = $("#ap-p-" + el.dataset.id); if (m && out) out.innerHTML = apChanceText(m, num(el)); },
  sugll: el => { const p = P(+el.dataset.id); if (!!p.loanList !== el.checked) loanListToggle(p); render(); saveGame(); },
  sugfd: async el => { const p = P(+el.dataset.id), x = CL(+el.dataset.to); if (!el.checked) return;
    if (await ask(`Loan ${p.name} to ${x.name} (${TIER_NAME[x.tier]}) until the end of the season?`, "Loan him")) { if (p.loanList) loanListToggle(p); loanOut(p, x); } render(); saveGame(); },
  fweek: el => { SUB.fw = +el.value; },
  oname: el => { const v = el.value.trim(); if (v) { G.owner.name = v; saveGame(); render(); } },
  mintgt: el => { const p = P(+el.dataset.id), n = +el.value; if (n) p.minT = n; else delete p.minT; toast(n ? `${p.name}: the manager will aim to give him ${n.toLocaleString("en-GB")} minutes this season.` : `${p.name}: no minutes target.`); if (el.dataset.stay) render(); else playerModal(p.id); saveGame(); },
  hirev: el => { const S = my().fac.stadium; if (S.concerts && !S.hire) { S.hire = { concert: S.concerts }; delete S.concerts; } (S.hire ||= {})[el.dataset.k] = +el.value; render(); },
  vset: el => { if (el.closest("#f-vision")) { START_V[el.dataset.k] = el.value; return; } vision()[el.dataset.k] = el.value; render(); },
  buyf: el => { BUYF[el.dataset.k] = el.type === "checkbox" ? el.checked : +el.value; render(); },
  lgsel: el => { SUB.league = el.value; render(); },
  archfx: el => { const D = G.archDraft, k = el.dataset.k; if (!D) return; if (k === "shape") D.shape = el.value; else if (k.startsWith("style.")) D.styles[k.slice(6)] = el.value; else if (k.startsWith("feat.")) D.feat[k.slice(5)] = el.checked; render(); },
  sd: el => { const d = (G.stDraft ||= standPlan(my().fac.stadium.own ? my().fac.stadium.cap : 1500)), k = el.dataset.k; if (my().fac.stadium.own) G.rgOpen = true;
    if (k === "family") d.family = el.value; else if (k === "corp") d.corp = Math.max(0, Math.min(Math.round(num(el)), Math.floor((d.stands.W.cap || 0) * .15)));
    else if (k === "suites") d.suites = Math.max(0, Math.min(Math.round(num(el)), Math.floor(sum(Object.values(d.stands), x => x.cap || 0) / 250)));
    else if (k === "amen") d.amen = clamp(+el.value || 2, 1, 5); else if (k === "heat") d.heat = el.checked; else if (k === "shape") d.shape = el.value; else if (k.startsWith("feat.")) (d.feat ||= {})[k.slice(5)] = el.checked;
    else if (k.startsWith("vent.")) { const v = k.slice(5); d.vent = (d.vent || []).filter(x => x !== v); if (el.checked) d.vent.push(v); if (!el.checked && v === "shop") d.vent = d.vent.filter(x => x !== "mega"); }
    else { const [s, f] = k.split("."); d.stands[s][f] = f === "cap" ? Math.max(0, Math.round(num(el) / 50) * 50) : f === "roof" ? el.checked : el.value; }
    render(); },
  stname: el => { G.stName = el.value.trim(); },
  mvplotin: el => { G.plotN = clamp(Math.round(num(el) / 500) * 500, plotMin(my()), SITE_MAX); G.mvOpen = true; render(); },
  adjn: el => { G.adjN = clamp(Math.round(num(el) / 500) * 500, 500, Math.max(500, adjMax(my()))); render(); },
  extn: el => { (G.extN ||= {})[el.dataset.k] = Math.max(50, Math.round(num(el) / 50) * 50); render(); },
  stfin: el => { (G.stFin ||= { share: 0, years: 25 })[el.dataset.k] = +el.value; render(); },
  mvname: el => { G.mvName = el.value.trim(); },
  mvsd: el => { const d = G.mvDraft, k = el.dataset.k; G.mvOpen = true; if (!d) return;
    if (k === "family") d.family = el.value; else if (k === "corp") d.corp = Math.max(0, Math.min(Math.round(num(el)), Math.floor((d.stands.W.cap || 0) * .15)));
    else if (k === "suites") d.suites = Math.max(0, Math.min(Math.round(num(el)), Math.floor(sum(Object.values(d.stands), x => x.cap || 0) / 250)));
    else if (k === "amen") d.amen = clamp(+el.value || 2, 1, 5); else if (k === "heat") d.heat = el.checked; else if (k === "shape") d.shape = el.value; else if (k.startsWith("feat.")) (d.feat ||= {})[k.slice(5)] = el.checked;
    else if (k.startsWith("vent.")) { const v = k.slice(5); d.vent = (d.vent || []).filter(x => x !== v); if (el.checked) d.vent.push(v); if (!el.checked && v === "shop") d.vent = d.vent.filter(x => x !== "mega"); }
    else { const [s, f] = k.split("."); d.stands[s][f] = f === "cap" ? Math.max(0, Math.round(num(el) / 50) * 50) : f === "roof" ? el.checked : el.value; }
    render(); },
  rb: el => { const [s, f] = el.dataset.k.split("."), x = standsOf(my().fac.stadium)[s], r = ((G.rb ||= {})[s] ||= { cap: x.cap, type: x.type, roof: x.roof, style: x.style || "std" });
    r[f] = f === "cap" ? Math.max(0, Math.round(num(el) / 50) * 50) : f === "roof" ? el.checked : el.value; G.rbOpen = s; render(); },
  msel: el => { SUB.my = el.value === "all" ? "all" : +el.value; render(); },
  reg: el => { const p = P(+el.dataset.id), was = autoRegOn() && windowOpen(), e = toggleReg(p); if (e) toast(e); else if (was) { G.autoReg = false; toast("Auto-registration is off: you're choosing the 25 yourself."); } render(); saveGame(); },
  fsel: el => { const id = +el.dataset.id; if (el.checked) FSEL.add(id); else FSEL.delete(id); render(); },
  asel: el => { const id = +el.dataset.id; if (el.checked) ASEL.add(id); else ASEL.delete(id); render(); },
  pcty: el => { SUB.pcty = el.value; SUB.plg = ""; render(); },
  plg: el => { SUB.plg = el.value; render(); },
  psort: el => { SUB.psort = el.value; render(); },
  fsort: el => { SUB.fsort = el.value; render(); },
  pcover: el => { SUB.pcover = +el.value || 0; render(); },
  plshare: el => { SUB.plshare = +el.value || 0; render(); },
  hf: el => { const k = el.dataset.k; HIRE_F[k] = ["phil", "focus", "form", "vis", "st"].includes(k) ? el.value : +el.value || 0; render(); },
  mf: el => { const k = el.dataset.k; MARKET_F[k] = ["pos", "arch", "int", "lg"].includes(k) ? el.value : +el.value || 0;
    if (k === "pos" && MARKET_F.arch && !(ARCHETYPES[el.value] || []).some(a => a[0] === MARKET_F.arch)) MARKET_F.arch = "";
    if (k === "arch" && el.value && MARKET_F.pos && !(ARCHETYPES[MARKET_F.pos] || []).some(a => a[0] === el.value)) MARKET_F.pos = "";
    render(); },
};
// Depth-chart cards remember whether you left them open.
document.addEventListener("toggle", e => { const d = e.target; if (d && d.dataset && d.dataset.dcard) (G.depthCards ||= {})[d.dataset.dcard] = d.open; }, true);
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.tagName === "SELECT" || el.tagName === "INPUT") return;
  // pickers on the start screen
  const grp = el.closest("#f-half, #f-color, #f-color2, #f-wealth"); if (grp) { grp.querySelectorAll("[aria-pressed]").forEach(b => b.setAttribute("aria-pressed", b === el)); return; }
  const f = ACT[el.dataset.act]; if (f) f(el, e);
});
document.addEventListener("click", e => { const b = e.target.closest("#f-half button, #f-color button, #f-color2 button, #f-wealth button"); if (b) b.parentNode.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); });
document.addEventListener("input", e => { const el = e.target; if (el.dataset && el.dataset.act === "apw") CHANGE.apw(el); });  // live: the chance he stays as you type
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

/* The whole masthead (numbers and section tabs) stays pinned at the top as you scroll, on phones too: it no longer
   shrinks to the club name and Continue. (MAST_SHRINK = true brings that back.) */
const MAST_SHRINK = false;
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
  if (!MAST_SHRINK || !phoneWidth() || !document.querySelector(".mast")) return;
  if (dy > 0) { downRun += dy; upRun = 0; } else { upRun -= dy; downRun = 0; }
  if (!MAST_COMPACT && y > 140 && downRun > 40) setCompact(true);
  else if (MAST_COMPACT && (y < 30 || upRun > 70)) setCompact(false);
}, { passive: true });
window.addEventListener("resize", () => { if (!phoneWidth() && MAST_COMPACT) setCompact(false); });
// iPhones close web apps in the background without warning: save whenever the game is put away.
document.addEventListener("visibilitychange", () => { if (document.hidden && G && G.club != null) saveGame(); });
window.addEventListener("pagehide", () => { if (G && G.club != null) saveGame(); });
