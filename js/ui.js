/* The owner's office: every page and dialog. Actions are buttons with data-act; main.js routes them. */
"use strict";

const $ = s => document.querySelector(s);
let PAGE = "home", SUB = {}, MARKET_F = { pos: "", age: 40, fee: "", min: 0 };
const eur = v => (v < 0 ? "−" : "") + "€" + (Math.abs(v) < 100 ? Math.abs(v).toFixed(2).replace(/\.00$/, "") : Math.round(Math.abs(v)).toLocaleString());
const big = v => Math.abs(v) < 1000 ? eur(v) : money(v);
const crest = (c, s = 22) => `<svg class="crest" width="${s}" height="${Math.round(s * 1.15)}" viewBox="0 0 20 23" aria-hidden="true"><path d="M1 1h18v9c0 6-4 10-9 12C5 20 1 16 1 10z" fill="${c.color}" stroke="var(--crest-edge)"/><text x="10" y="13" text-anchor="middle" font-size="6" font-weight="700" fill="#fff" font-family="sans-serif">${esc(c.short)}</text></svg>`;
const clubLink = c => `<button class="lnk" data-act="club" data-id="${c.id}">${esc(c.name)}</button>`;
const bar = (v, max = 100) => `<span class="bar"><i style="width:${clamp(v / max * 100, 0, 100)}%"></i></span>`;
const rcls = v => v >= 80 ? "r-elite" : v >= 70 ? "r-high" : v >= 55 ? "r-mid" : v >= 40 ? "r-low" : "r-bad";
// Everything is shown out of 20 (see r20 in core.js).
const rating = v => `<span class="ovr ${rcls(v)}">${r20(v)}</span>`;
const range = ([a, b]) => r20(a) === r20(b) ? rating(a) : `<span class="ovr ${rcls((a + b) / 2)}">${r20(a)}–${r20(b)}</span>`;
const attr20 = v => `${bar(v)}<b class="num">${r20(v)}</b>`;
const word = ([w, cls]) => `<span class="${cls}">${w}</span>`;
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600); }

/* ---------- start screen ---------- */
function renderStart(saves) {
  $("#app").innerHTML = `<div class="wrap gut"><div class="hero"><p class="eyebrow">Touchline · Owner</p><h1>Build a club <span>from nothing</span></h1>
    <p>You own a brand-new football club at the bottom of the pyramid. Hire the people who run it, set the prices and budgets, find sponsors,
    build a ground, and grow it — season by season — toward the Premier Division. You don't pick the team. You pick who picks the team.</p></div>
    ${saves.length ? `<section class="card" style="margin-bottom:16px"><div class="card-h"><h2>Continue</h2></div><div class="stack">${saves.map(s => `<div class="row between"><div><b>${esc(s.name)}</b> <span class="muted small">${esc(s.info)}</span></div><div class="row"><button class="btn primary" data-act="load" data-id="${s.id}">Continue</button><button class="btn sm danger" data-act="delsave" data-id="${s.id}">Delete</button></div></div>`).join("")}</div></section>` : ""}
    <section class="card"><div class="card-h"><h2>Found a new club</h2></div>
    <div class="form-grid">
      <label>Club name<input id="f-name" maxlength="32" placeholder="e.g. Harwick Athletic"></label>
      <label>Town<input id="f-town" maxlength="20" placeholder="e.g. Harwick"></label>
      <label>Short name (3 letters)<input id="f-short" maxlength="3" placeholder="HAR"></label>
      <label>Your name<input id="f-owner" maxlength="30" placeholder="Chair"></label>
    </div>
    <h3 style="margin:16px 0 8px">Region</h3>
    <div class="seg" id="f-half"><button data-v="N" aria-pressed="true">North — Regional League North</button><button data-v="S" aria-pressed="false">South — Regional League South</button></div>
    <h3 style="margin:16px 0 8px">Colours</h3>
    <div class="swatches" id="f-color">${CLUB_COLORS.map((c, i) => `<button style="background:${c}" data-v="${c}" aria-pressed="${i === 1}" aria-label="Colour ${i + 1}"></button>`).join("")}</div>
    <h3 style="margin:16px 0 8px">Your fortune</h3>
    <div class="pick-cards" id="f-wealth">${Object.entries(WEALTH).map(([k, w], i) => `<button class="pick-card" data-v="${k}" aria-pressed="${i === 1}"><b>${w.l}</b><span class="num">${money(w.amt)}</span><small>${w.d}</small></button>`).join("")}</div>
    <div class="row" style="margin-top:18px"><button class="btn primary" data-act="found">Found the club</button><span class="muted small">Building the leagues takes a few seconds.</span></div>
    </section><p class="muted small" style="margin:18px 0">Version ${VERSION}. All clubs, players and staff are fictional.</p></div>`;
}

/* ---------- masthead ---------- */
const PAGES = [["home", "Office"], ["squad", "Squad"], ["staff", "Staff"], ["fin", "Finances"], ["comm", "Commercial"], ["fac", "Facilities"], ["board", "Board"], ["net", "Network"], ["league", "Competitions"], ["market", "Market"], ["rivals", "Rivals"], ["hist", "History"]];
function phaseText() {
  if (G.phase === "summer") return `${seasonLabel(G.year)} pre-season · week ${G.week + 1} of ${SUMMER_WEEKS} · transfer window open`;
  if (G.phase === "playoffs") return `${seasonLabel(G.year)} · play-offs`;
  return `${seasonLabel(G.year)} · week ${G.week + 1} of ${SEASON_WEEKS}${windowOpen() ? " · January window open" : ""}`;
}
function mast() {
  const c = my(), pos = G.phase === "summer" ? null : posOf(c.lg, c.id), dec = openDecisions().length;
  return `<header class="mast" style="--club:${c.color}"><div class="wrap gut"><div class="mast-in">
    <div class="ident row">${crest(c, 30)}<div><p class="eyebrow" style="color:var(--board-muted)">${phaseText()}</p><h1 style="font-size:24px">${esc(c.name)}</h1></div></div>
    <div class="mast-r"><dl class="kpis">
      <div><dt>Club cash</dt><dd class="${c.cash < 0 ? "bad" : ""}">${money(c.cash)}</dd></div>
      <div><dt>Your fortune</dt><dd>${money(G.owner.wealth)}</dd></div>
      <div><dt>${LEAGUES[c.lg].name}</dt><dd>${pos ? ord(pos) : "—"}</dd></div>
      <div><dt>Fans</dt><dd>${c.fans.toLocaleString()}</dd></div></dl>
      <div class="playbtn"><button data-act="adv" data-n="1">Continue</button><button data-act="advmenu" aria-label="More">▾</button></div></div></div>
    <nav class="tabs">${PAGES.map(([k, l]) => `<button data-act="page" data-p="${k}" ${PAGE === k ? 'aria-current="page"' : ""}>${l}${k === "home" && dec ? `<span class="dot">${dec}</span>` : ""}</button>`).join("")}</nav></div></header>`;
}
function render() {
  if (!G) return;
  if (G.club == null) { $("#app").innerHTML = buyScreen(); return; }
  const body = { home: pgHome, squad: pgSquad, staff: pgStaff, fin: pgFin, comm: pgComm, fac: pgFac, league: pgComps, market: pgMarket, hist: pgHist, board: pgBoard, net: pgNet, rivals: pgRivals }[PAGE]();
  if (G.ended) { $("#app").innerHTML = endScreen(); return; }
  const y = scrollY;
  $("#app").innerHTML = mast() + `<main class="wrap gut page">${body}</main>`;
  scrollTo(0, y);
}

/* ---------- Office (home) ---------- */
function checklist() {
  const c = my(), out = [];
  if (!staffOf("manager")) out.push(["Hire a manager. Until you do, the club captain picks the team.", "staff"]);
  if (!staffOf("recruit")) out.push(["Hire a head of recruitment. Nobody is signing players for you.", "staff"]);
  if (c.fac.acad.lvl && !staffOf("youth")) out.push(["Hire a youth manager to run the academy.", "staff"]);
  if (!c.fac.acad.lvl && !c.fac.acad.build) out.push(["There's no academy: no youth players will come through.", "fac"]);
  if (c.offers.length) out.push([`${new Set(c.offers.map(o => o.slot)).size} sponsorship slot${new Set(c.offers.map(o => o.slot)).size > 1 ? "s have" : " has"} offers waiting.`, "comm"]);
  for (const s of Object.values(c.staff).filter(s => s && s.expiring)) out.push([`${s.name}'s contract has run out: renew or replace.`, "staff"]);
  if (wageBill(c) > c.budget.wages) out.push([`The wage bill (${money(wageBill(c))}) is over the wage budget (${money(c.budget.wages)}).`, "fin"]);
  const up = ABOVE[c.lg]; if (up && capacity(c) < GROUND_REQ[LEAGUES[up].tier]) out.push([`Your ground holds ${capacity(c).toLocaleString()}; promotion needs ${GROUND_REQ[LEAGUES[up].tier].toLocaleString()}.`, "fac"]);
  if (c.fac.stadium.own && c.fac.stadium.pitch < 50 && !c.fac.stadium.relay) out.push(["The pitch is in poor condition.", "fac"]);
  if (c.cash < 0) out.push([`The club is overdrawn (${money(c.cash)}).`, "fin"]);
  return out;
}
function pgHome() {
  const c = my(), nf = nextFixture(), last = (G.myRes || []).slice(-6).reverse(), todo = checklist();
  const fx = nf ? `<p class="lead">${nf.h === c.id ? "Home" : "Away"} to ${clubLink(CL(nf.h === c.id ? nf.a : nf.h))} <span class="muted">· week ${nf.w + 1}</span></p>` : G.phase === "summer" ? `<p class="lead">Pre-season. The first league game is in ${SUMMER_WEEKS - G.week} week${SUMMER_WEEKS - G.week > 1 ? "s" : ""}.</p>` : `<p class="lead">No more league games this season.</p>`;
  const xi = pickXI(c), fit = styleFit(xi, mgr().phil);
  return `<div class="grid2"><div class="stack">
    <section class="card"><div class="card-h"><h2>Next up</h2><span class="muted small">${esc(mgr().name)} · ${STYLES[mgr().phil].l} · ${mgr().form}</span></div>${fx}
      ${myCupTie().map(({ k, K, t }) => `<p>${CUP_DEF[k].name} ${K.name.toLowerCase()}: ${t.h === G.club ? "home to" : "away to"} ${clubLink(CL(t.h === G.club ? t.a : t.h))} <span class="muted small">· week ${CUP_DEF[k].weeks[K.round] + 1}</span></p>`).join("")}
      ${weatherLine()}
      <p class="small muted" style="margin-top:6px">Squad suits the manager's style: ${fitText(fit)} · Team rating ${r20(avg(xi.map(o => roleRating(o.p, o.slot))))} (division typical ${r20(TIER_LVL[c.tier])}) · Morale ${Math.round(c.morale)}</p></section>
    ${todo.length ? `<section class="card"><div class="card-h"><h2>Needs your attention</h2></div><ul class="todo">${todo.map(([t, p]) => `<li><button class="lnk" data-act="page" data-p="${p}">${esc(t)}</button></li>`).join("")}</ul></section>` : ""}
    ${inboxCard()}
    ${G.phase === "summer" && !(G.obj && G.obj.y === G.year) ? objectivesCard() : ""}
    <section class="card"><div class="card-h"><h2>Results</h2><button class="lnk small" data-act="page" data-p="league">All results</button></div>${last.length ? resultsList(last) : `<p class="muted">No games yet.</p>`}</section>
    <section class="card"><div class="card-h"><h2>News</h2></div><ul class="news">${G.news.slice(0, 25).map(n => `<li class="${n.hi ? "hi" : ""}">${esc(n.t)}<small>${n.y} · ${n.w}</small></li>`).join("")}</ul></section>
  </div><div class="stack">
    ${G.phase !== "summer" ? `<section class="card"><div class="card-h"><h3>${LEAGUES[c.lg].name}</h3></div>${miniTable(c.lg)}</section>` : `<section class="card"><div class="card-h"><h3>This season</h3></div><p>${LEAGUES[c.lg].name}. ${LEAGUES[c.lg].auto} promoted automatically${LEAGUES[c.lg].po ? `, ${ord(LEAGUES[c.lg].po[0])}–${ord(LEAGUES[c.lg].po[1])} to the play-offs` : ""}.</p></section>`}
    <section class="card"><div class="card-h"><h3>The club</h3></div><dl class="ledger">
      <dt>Supporters</dt><dd>${c.fans.toLocaleString()} · ${word(moodWord(c.mood))}</dd>
      <dt>Ground</dt><dd>${capacity(c).toLocaleString()}${c.fac.stadium.own ? "" : " (rented)"}</dd>
      <dt>Training ground</dt><dd>Level ${c.fac.train.lvl}</dd><dt>Academy</dt><dd>Level ${c.fac.acad.lvl}</dd>
      <dt>Wage bill</dt><dd>${money(wageBill(c))} / ${money(c.budget.wages)}</dd>
      <dt>Season so far</dt><dd class="${ledgerIncome(c.fin) - ledgerCosts(c.fin) < 0 ? "bad" : "good"}">${money(ledgerIncome(c.fin) - ledgerCosts(c.fin))}</dd></dl></section>
    ${G.obj && G.obj.y === G.year ? `<section class="card"><div class="card-h"><h3>Targets</h3><button class="lnk small" data-act="page" data-p="board">Board</button></div>${Object.entries(OBJ).filter(([k]) => G.obj[k] !== "none").map(([k, D]) => `<p class="small">${D.l}: ${D.opts[G.obj[k]]}</p>`).join("") || "<p class='small muted'>None set.</p>"}</section>` : ""}
    <section class="card"><div class="card-h"><h3>Your staff</h3><button class="lnk small" data-act="page" data-p="staff">Staff</button></div>${["manager", "recruit", "youth"].map(r => { const s = staffOf(r); return `<div class="row between small" style="padding:4px 0"><span>${ROLES_STAFF[r].l}</span><span>${s ? `${esc(s.name)} · ${word(trustWord(s.trust))}` : `<span class="warn">Vacant</span>`}</span></div>`; }).join("")}</section>
  </div></div>`;
}
const fitText = f => f >= .35 ? `<span class="good">great</span>` : f >= .1 ? `<span class="good">good</span>` : f > -.1 ? "average" : f > -.35 ? `<span class="warn">poor</span>` : `<span class="bad">very poor</span>`;
function inboxCard() {
  const m = G.inbox.filter(x => !x.done && (x.type === "bid" || x.type === "choice" || x.age < 4)).slice(0, 8);
  if (!m.length) return "";
  return `<section class="card summary"><div class="card-h"><h2>Inbox</h2></div><div class="stack">${m.map(x => {
    if (x.type === "choice") return choiceHTML(x);
    if (x.type === "bid") { const p = G.players[x.pid]; if (!p) return ""; const s = staffOf("recruit");
      return `<div class="decision"><b>${esc(x.title)}</b><p class="small">${esc(p.name)}: ${p.pos}, ${p.age}, rated ${r20(p.ovr)}. Valued at about ${money(valueOf(p))}. ${s ? esc(s.name) : "Your staff"} advise${s ? "s" : ""} you to <b>${x.rec}</b>. If you don't answer this week, ${s ? "he" : "they"} will.</p>
        <div class="row" style="margin-top:6px"><button class="btn sm" data-act="bid" data-id="${x.id}" data-v="1">Accept</button><button class="btn sm" data-act="bid" data-id="${x.id}" data-v="0">Reject</button><button class="btn sm" data-act="player" data-id="${p.id}">View player</button></div></div>`; }
    return `<div class="decision"><b>${esc(x.title)}</b><p class="small">${esc(x.body || "")}</p>${x.pid && G.players[x.pid] ? `<button class="btn sm" data-act="player" data-id="${x.pid}" style="margin-top:6px">View</button>` : ""}</div>`;
  }).join("")}</div></section>`;
}
function resultsList(rs) {
  return `<ul class="results">${rs.map(r => { const o = CL(r.opp), mine = r.ev.filter(e => (e.side === 0) === (r.home || (r.comp === "PO" && !r.home && false)));
    const sc = r.ev.filter(e => r.home ? e.side === 0 : e.side === 1).map(e => esc(e.g.split(" ").slice(1).join(" ") || e.g) + " " + e.m + "'").join(", ");
    return `<li><span class="res ${r.res}">${r.res}</span> <b class="num">${r.gf}–${r.ga}</b>${r.pens ? " (pens)" : ""} ${r.home ? "v" : "at"} ${clubLink(o)} <span class="muted small">${r.comp === "PO" ? "Play-off" : "Wk " + (r.w + 1)}${r.crowd ? " · crowd " + r.crowd.toLocaleString() : ""}${sc ? " · " + sc : ""}</span></li>`; }).join("")}</ul>`;
}
function miniTable(k) {
  const t = table(k), i = t.findIndex(r => r.id === G.club), from = clamp(i - 3, 0, Math.max(0, t.length - 8));
  return tableHTML(k, t.slice(from, from + 8), from, true);
}
function tableHTML(k, rows, off = 0, compact) {
  const L = LEAGUES[k], n = G.leagues[k].clubs.length;
  const zone = i => i < L.auto ? "z-up" : L.po && i + 1 >= L.po[0] && i + 1 <= L.po[1] ? "z-po" : i >= n - L.down ? "z-down" : "";
  return `<div class="tbl-wrap"><table class="lg"><thead><tr><th>#</th><th style="text-align:left">Club</th><th>P</th>${compact ? "" : "<th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th>"}<th>GD</th><th>Pts</th>${compact ? "" : "<th>Form</th>"}</tr></thead><tbody>
    ${rows.map((r, j) => { const i = j + off, c = CL(r.id); return `<tr class="${zone(i)} ${r.id === G.club ? "me" : ""}"><td class="num">${i + 1}</td><td style="text-align:left">${crest(c, 14)} ${clubLink(c)}</td><td class="num">${r.p}</td>${compact ? "" : `<td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${r.gf}</td><td class="num">${r.ga}</td>`}<td class="num">${r.gf - r.ga}</td><td class="num"><b>${r.pts}</b></td>${compact ? "" : `<td>${r.form.map(f => `<span class="res ${f}">${f}</span>`).join("")}</td>`}</tr>`; }).join("")}</tbody></table></div>`;
}

/* ---------- Squad ---------- */
function pgSquad() {
  const c = my(), tab = SUB.squad || "first", xi = new Set(pickXI(c).map(o => o.p.id));
  const ps = c.squad.map(P).filter(p => tab === "acad" ? p.acad : !p.acad).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ovr - a.ovr);
  const potJudge = tab === "acad" ? (staffOf("youth") ? `${staffOf("youth").name}'s estimates` : "rough guesses: no youth manager") : (staffOf("manager") ? `${staffOf("manager").name}'s estimates` : "rough guesses: no manager");
  return `<section class="card"><div class="card-h"><h2>Squad</h2><div class="seg"><button data-act="sub" data-k="squad" data-v="first" aria-pressed="${tab === "first"}">First team (${c.squad.filter(id => !P(id).acad).length})</button><button data-act="sub" data-k="squad" data-v="acad" aria-pressed="${tab === "acad"}">Academy (${c.squad.filter(id => P(id).acad).length})</button></div></div>
    <p class="small muted" style="margin-bottom:10px">The manager picks the side; players marked XI are his current first choices. Ratings are out of 20: about ${r20(TIER_LVL[c.tier])} is a typical starter in your division, 16 a Premier Division regular, 18–19 world class, and 20 a once-in-a-generation player. Potential shows ${potJudge}. Tap a player to sell, release or protect him.</p>
    ${ps.length ? `<div class="tbl-wrap"><table class="sq"><thead><tr><th>Pos</th><th style="text-align:left">Name</th><th>Age</th><th>Rating</th><th>Potential</th><th>Apps</th><th>Gls</th><th>Wage</th><th>Contract</th><th>Value</th></tr></thead><tbody>
    ${ps.map(p => `<tr data-act="player" data-id="${p.id}" class="click"><td><span class="pos">${p.pos}</span></td><td style="text-align:left">${esc(p.name)} ${xi.has(p.id) ? '<span class="chip xi">XI</span>' : ""}${p.inj ? `<span class="chip inj">${p.inj}w</span>` : ""}${p.keep ? '<span class="chip list">KEEP</span>' : ""}${p.loan ? '<span class="chip hg">LOAN</span>' : ""}${p.nat !== "ENG" ? ` <span class="muted small">${esc(NAT_NAME[p.nat] || p.nat)}</span>` : ""}</td>
      <td class="num">${p.age}</td><td>${rating(p.ovr)}</td><td>${range(potEstimate(p))}</td><td class="num">${p.s.app}</td><td class="num">${p.s.g}</td><td class="num">${money(p.wage)}</td><td class="num">${p.acad ? "Youth" : p.yrs + "y"}</td><td class="num">${money(valueOf(p))}</td></tr>`).join("")}</tbody></table></div>
    ${tab === "first" && (G.loanList || []).some(id => G.players[id] && G.players[id].loan && G.players[id].loan.from === c.id) ? `<h3 style="margin:14px 0 6px">Out on loan</h3>${(G.loanList || []).map(id => G.players[id]).filter(p => p && p.loan && p.loan.from === c.id).map(p => `<p class="small"><button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button> (${p.pos}, ${r20(p.ovr)}) at ${esc(CL(p.club).name)}: ${p.s.app} games</p>`).join("")}` : ""}`
    : `<p class="muted">${tab === "acad" ? (c.fac.acad.lvl ? "The academy's first intake arrives in the summer." : "No academy yet. Build one on the Facilities page.") : "No players."}</p>`}</section>`;
}
function playerModal(id) {
  const p = G.players[id]; if (!p) return;
  const mine = p.club === G.club, c = p.club >= 0 ? CL(p.club) : null, est = ovrEstimate(p);
  const keys = keysOf(p.pos).slice().sort((a, b) => (POS_W[p.pos][b] || 0) - (POS_W[p.pos][a] || 0));
  const exact = mine || (c && c.lg === my().lg);
  const attrs = keys.map(k => `<div class="attr-r"><span>${ATTR[k]}${POS_W[p.pos][k] ? " ★" : ""}</span>${exact ? attr20(p.at[k]) : `<span class="muted small">not scouted</span>`}</div>`).join("");
  let acts = "";
  if (mine) {
    const sellQ = Math.round(valueOf(p) * .9 / 1000) * 1000;
    acts = `<div class="row"><button class="btn" data-act="keep" data-id="${p.id}">${p.keep ? "Remove protection" : "Protect (keep and renew)"}</button>
      ${p.acad ? `<button class="btn" data-act="promote" data-id="${p.id}">Offer a professional contract</button><button class="btn danger" data-act="release" data-id="${p.id}">Release from academy</button>` :
      `${net().feeders.length && !p.loan ? `<select data-act="loanout" data-id="${p.id}"><option value="">Loan to a feeder…</option>${net().feeders.map(f => `<option value="${f.id}">${esc(CL(f.id).name)}</option>`).join("")}</select>` : ""}${p.loan ? `<span class="small muted">On loan from ${esc(CL(p.loan.from).name)}</span>` : `<button class="btn" data-act="sell" data-id="${p.id}">Sell (about ${money(sellQ)})</button><button class="btn danger" data-act="release" data-id="${p.id}">Release (${money(releaseCost(p))})</button>`}`}</div>
      <p class="small muted">Selling or releasing a player is your call, but your head of recruitment won't like being bypassed, and the manager won't like losing a first-choice player. Protected players are never sold by your staff and are offered new contracts.</p>`;
  } else {
    const fee = askingFee(p), wage = playerAsk(p), ok = willJoin(p, my()) && wage != null;
    acts = `<div class="row"><button class="btn primary" data-act="buy" data-id="${p.id}" ${ok ? "" : "disabled"}>Make an offer</button><span class="small muted">${ok ? `Asking fee about ${fee ? money(fee) : "nothing (free agent)"}; he'd want about ${money(wage)} a year.` : "He isn't interested in joining, whatever the money."}</span></div>
      <details><summary class="small">What he's weighing up</summary>${factorBars(playerAppeal(p, wage || demandWage(p, my())), P_FACTORS)}</details>`;
  }
  modal(`<div class="modal-h" style="--mc:${c ? c.color : "var(--muted)"}"><div><p class="eyebrow">${POS_NAME[p.pos]} · ${p.age} · ${esc(NAT_NAME[p.nat] || p.nat)}</p><h2>${esc(p.name)}</h2><p class="small muted">${c ? esc(c.name) : p.club === -2 ? "Plays abroad" : "Free agent"}${p.acad ? " · academy" : ""}</p></div><button class="btn modal-x" data-act="close">✕</button></div>
    <div class="modal-b"><dl class="facts"><div><dt>Rating</dt><dd>${range(est)}</dd></div><div><dt>Potential (est.)</dt><dd>${range(potEstimate(p))}</dd></div><div><dt>Value</dt><dd>${money(valueOf(p))}</dd></div><div><dt>Wage</dt><dd>${money(p.wage)}/yr</dd></div><div><dt>Contract</dt><dd>${p.acad ? "Youth terms" : p.yrs ? p.yrs + " yr" : "—"}</dd></div><div><dt>Season</dt><dd>${p.s.app} apps, ${p.s.g} goals, ${p.s.a} assists</dd></div><div><dt>Career</dt><dd>${p.tot[0] + p.s.app} apps, ${p.tot[1] + p.s.g} goals</dd></div>${p.inj ? `<div><dt>Injured</dt><dd class="bad">${p.inj} weeks</dd></div>` : ""}</dl>
    <div class="attr-grid">${attrs}</div>${acts}
    ${p.hist.length ? `<p class="small muted">Clubs: ${p.hist.map(h => `${h[0]} ${esc(h[1])}`).join(" · ")}</p>` : ""}</div>`);
}

/* ---------- Staff ---------- */
function staffCard(role) {
  const s = staffOf(role), R0 = ROLES_STAFF[role];
  if (!s) return `<section class="card"><div class="card-h"><h2>${R0.l}</h2><span class="warn">Vacant</span></div><p class="muted" style="margin-bottom:10px">${role === "manager" ? "Picks the team, sets the tactics, develops the players. Without one, the club captain does it badly." : role === "recruit" ? "Signs and sells players within your budgets, renews contracts, and advises you on bids." : "Runs the academy: the size and quality of each year's intake, and how the youngsters develop."}</p><button class="btn primary" data-act="cands" data-r="${role}">Find candidates</button></section>`;
  const ph = R0.phil[s.phil];
  return `<section class="card"><div class="card-h"><h2>${R0.l}</h2><span>${word(trustWord(s.trust))} <span class="muted small">trust ${Math.round(s.trust)}</span></span></div>
    <p class="lead"><b>${esc(s.name)}</b>, ${s.age}</p>
    <p style="margin:6px 0"><span class="chip list">${esc(ph.l)}</span> ${esc(ph.d)}</p><p class="small"><b>Focus:</b> ${esc(R0.focus[s.focus])}${s.form ? ` · <b>Formation:</b> ${s.form}` : ""}</p>
    <div class="attr-grid" style="margin:10px 0">${Object.entries(R0.attrs).map(([k, l]) => { const d = s.prev ? r20(s.at[k]) - r20(s.prev[k]) : 0; return `<div class="attr-r"><span>${l}${d ? ` <span class="${d > 0 ? "good" : "bad"} small">${d > 0 ? "▲" : "▼"}${Math.abs(d)}</span>` : ""}</span>${attr20(s.at[k])}</div>`; }).join("")}</div>
    ${role === "manager" ? `<p class="small">His style with this squad: ${fitText(styleFit(pickXI(my()), s.phil))}.</p>` : ""}
    <p class="small muted">${money(s.wage)} a year · ${s.expiring ? `<span class="warn">contract expired</span>` : `${s.yrs} year${s.yrs > 1 ? "s" : ""} left`} · releasing him costs ${money(payoff(s))}</p>
    <div class="row" style="margin-top:10px">${s.expiring ? `<button class="btn primary" data-act="renewstaff" data-r="${role}">Renew 3 years${staffAsk(s) != null ? ` (${money(Math.max(s.wage, staffAsk(s)))}/yr)` : ""}</button>` : ""}<button class="btn" data-act="cands" data-r="${role}">Look for a replacement</button><button class="btn danger" data-act="dismiss" data-r="${role}">Dismiss</button></div></section>`;
}
function pgStaff() {
  return `<p class="small muted" style="margin-bottom:12px">The job attracts staff of about reputation ${Math.round(attraction())} (division, facilities, and your fortune). Better people will come for more money; the very best won't drop this far at all. Trust falls when you overrule them or a season goes badly; below 20 they resign.</p>
    <div class="grid3">${staffCard("manager")}${staffCard("recruit")}${staffCard("youth")}</div>`;
}
/* What a player or coach is weighing up: each factor's weight to him (his top two starred) and how you score on it. */
function factorBars(a, factors) {
  return `<div class="factors">${factors.map(([k, l]) => { const v = a.f[k], top = a.pr.top.includes(k);
    return `<div class="factor ${top ? "top" : ""}" title="${esc(FACTOR_HELP[k] || "")}"><span>${top ? "★ " : ""}${l}</span><span class="fbar"><i style="width:${Math.round(v * 100)}%;background:${v >= .6 ? "var(--win)" : v >= .4 ? "var(--accent)" : "var(--loss)"}"></i></span><span class="muted small num">${Math.round(a.pr.pri[k] * 100)}%</span></div>`; }).join("")}</div>
    <p class="small muted">★ what he cares about most. The bar is how well your club does on it; the figure is how much it weighs with him.</p>`;
}
let CANDS = null;
function candModal(role) {
  CANDS = { role, list: candidates(role).sort((a, b) => (staffAsk(a) == null) - (staffAsk(b) == null) || staffAvg(b) - staffAvg(a)) };
  const R0 = ROLES_STAFF[role];
  modal(`<div class="modal-h"><div><p class="eyebrow">Candidates</p><h2>${R0.l}</h2></div><button class="btn modal-x" data-act="close">✕</button></div>
    <div class="modal-b"><p class="small muted">Like players, coaches weigh up the whole job: the money, your club's standing, facilities, budgets, the squad, your ambition, and whether you let staff do their jobs. Each cares about some things more than others. The wage shown is the least that would get him to say yes; offer less and he'll probably refuse.</p>
    ${CANDS.list.map((s, i) => { const ph = R0.phil[s.phil], ask = staffAsk(s), no = ask == null; return `<div class="cand ${no ? "dim" : ""}"><div class="row between"><div><b>${esc(s.name)}</b>, ${s.age} <span class="muted small">reputation ${s.rep}</span></div><div class="num">${no ? `<span class="muted">Not interested at any price</span>` : "wants about " + money(ask) + "/yr"}</div></div>
      <p class="small"><span class="chip list">${esc(ph.l)}</span> ${esc(R0.focus[s.focus])}${s.form ? ` · ${s.form}` : ""}</p>
      <div class="attr-grid">${Object.entries(R0.attrs).map(([k, l]) => `<div class="attr-r"><span>${l}</span>${attr20(s.at[k])}</div>`).join("")}</div>
      ${role === "manager" ? `<p class="small muted">His style with your current squad: ${fitText(styleFit(pickXI(my()), s.phil))}</p>` : ""}
      <details><summary class="small">What he's weighing up</summary>${factorBars(staffAppeal(s, ask || s.demand), S_FACTORS)}</details>
      ${no ? "" : `<div class="row" style="margin-top:6px"><label class="small">Offer €/yr <input type="number" class="num-in" id="cw${i}" value="${ask}" step="1000"></label><label class="small">Years <select id="cy${i}">${[1, 2, 3, 4].map(y => `<option ${y === 3 ? "selected" : ""}>${y}</option>`).join("")}</select></label><button class="btn primary sm" data-act="hire" data-i="${i}">Offer the job</button></div>`}</div>`; }).join("")}</div>`);
}

/* ---------- Finances ---------- */
function pgFin() {
  const c = my(), f = matchdayForecast(c), T = c.tier, L = c.finLast;
  const row = (k, l) => `<tr><td style="text-align:left">${l}</td><td class="num">${money(c.fin[k] || 0)}</td><td class="num muted">${L ? money(L[k] || 0) : "—"}</td></tr>`;
  const priceIn = (k, l, ref, step, note) => `<div class="price"><label>${l}<span class="row"><span>€</span><input type="number" class="num-in" data-act="price" data-k="${k}" value="${c.prices[k]}" step="${step}" min="0"></span></label><p class="small muted">Typical in your division: ${eur(ref)}. ${note}</p></div>`;
  const budgetIn = (k, l, note) => `<div class="price"><label>${l}<span class="row"><span>€</span><input type="number" class="num-in" data-act="budget" data-k="${k}" value="${c.budget[k]}" step="1000" min="0"></span></label><p class="small muted">${note}</p></div>`;
  return `<div class="grid2"><div class="stack">
    <section class="card"><div class="card-h"><h2>Prices</h2></div><div class="price-grid">
      ${priceIn("ticket", "Match ticket", REF_TICKET[T], 1, `Forecast crowd ${f.crowd.toLocaleString()} of ${capacity(c).toLocaleString()}: ${money(f.gate)} a game.`)}
      ${priceIn("conc", "Food & drink (average item)", REF_CONC[T], .5, `About ${money(f.conc)} profit a game${c.fac.stadium.own ? "" : " after your landlord's half"}.`)}
      ${priceIn("shirt", "Replica shirt", REF_SHIRT[T], 1, `About ${money(merchFor(c) * 52)} profit a year.`)}
      ${c.fac.stadium.own && c.fac.stadium.suites ? priceIn("suite", "Executive suite (per season)", REF_SUITE[T], 500, `${suitesLet(c)} of ${c.fac.stadium.suites} suites let: ${money(suitesLet(c) * c.prices.suite)} a season.`) : ""}
    </div><p class="small muted" style="margin-top:8px">Supporters notice prices well above the going rate and their mood suffers; cheap tickets win a little goodwill.</p></section>
    <section class="card"><div class="card-h"><h2>Budgets</h2></div><div class="price-grid">
      ${budgetIn("wages", "Player wage budget (per year)", `Current wage bill ${money(wageBill(c))}. Your head of recruitment won't sign players or renew contracts beyond it.`)}
      ${budgetIn("transfer", "Transfer budget (per season)", `Spent this season: ${money(c.spentT)}. Fees for players he signs come out of this.`)}
      ${budgetIn("acad", "Academy running budget (per year)", c.fac.acad.lvl ? `A solid budget for a level-${c.fac.acad.lvl} academy is about ${money(acadRef(c.fac.acad.lvl))}. More means bigger, better intakes.` : "No academy yet.")}
      ${budgetIn("scout", "Scouting budget (per year)", `About ${money(scoutRef(T))} is normal at this level. More lets your recruitment team see further and judge players better.`)}
    </div></section>
    <section class="card"><div class="card-h"><h2>Accounts</h2><span class="muted small">this season · last season</span></div><div class="tbl-wrap"><table class="proj"><tbody>
      <tr class="sec"><td colspan="3">Income</td></tr>${row("gate", "Gate receipts")}${row("conc", "Food & drink")}${row("suites", "Executive suites")}${row("events", "Stadium ventures & events")}${row("merch", "Merchandise")}${row("spons", "Sponsorship")}${row("tv", "Central (TV) money")}${row("prize", "Prize money")}${row("sales", "Player sales")}
      <tr class="tot"><td style="text-align:left">Total income</td><td class="num">${money(ledgerIncome(c.fin))}</td><td class="num muted">${L ? money(ledgerIncome(L)) : "—"}</td></tr>
      <tr class="sec"><td colspan="3">Costs</td></tr>${row("wages", "Player wages")}${row("staff", "Staff wages")}${row("buys", "Transfer fees")}${row("rent", "Ground rent")}${row("fac", "Facility upkeep")}${row("build", "Construction")}${row("acad", "Academy")}${row("scout", "Scouting")}${row("interest", "Interest")}${row("directors", "Directors")}${row("feeders", "Feeder funding")}${row("dividend", "Dividends")}
      <tr class="tot"><td style="text-align:left">Total costs</td><td class="num">${money(ledgerCosts(c.fin))}</td><td class="num muted">${L ? money(ledgerCosts(L)) : "—"}</td></tr>
      <tr class="sec"><td colspan="3">Not counted above</td></tr>${row("equity", "Shares sold")}${row("borrow", "Borrowed")}${row("repay", "Loan repayments")}${row("invest", "Your investment")}
      <tr class="tot"><td style="text-align:left">Result</td><td class="num ${ledgerIncome(c.fin) - ledgerCosts(c.fin) < 0 ? "bad" : "good"}">${money(ledgerIncome(c.fin) - ledgerCosts(c.fin))}</td><td class="num muted">${L ? money(ledgerIncome(L) - ledgerCosts(L)) : "—"}</td></tr>
    </tbody></table></div></section>
  </div><div class="stack">${loansCard()}
    <section class="card"><div class="card-h"><h2>Your money</h2></div><dl class="ledger"><dt>Club cash</dt><dd class="${c.cash < 0 ? "bad" : ""}">${money(c.cash)}</dd><dt>Your fortune</dt><dd>${money(G.owner.wealth)}</dd><dt>Put in so far</dt><dd>${money(G.owner.invested)}</dd></dl>
      <p class="small muted" style="margin:10px 0">An overdrawn club pays 10% a year interest.</p>
      <div class="row">${[1e5, 1e6, 1e7].map(v => `<button class="btn sm" data-act="invest" data-v="${v}" ${G.owner.wealth < v ? "disabled" : ""}>Put in ${money(v)}</button>`).join("")}</div>
      <div class="row" style="margin-top:8px"><input type="number" class="num-in" id="inv-amt" placeholder="Amount" step="10000"><button class="btn sm" data-act="investx">Put in</button><button class="btn sm" data-act="withdraw">Take out</button></div></section>
    <section class="card"><div class="card-h"><h3>A year at a glance</h3></div><dl class="ledger">
      <dt>Player wages</dt><dd>${money(wageBill(c))}</dd><dt>Staff wages</dt><dd>${money(staffBill(c))}</dd><dt>Upkeep</dt><dd>${money(upkeep(c))}</dd><dt>Academy + scouting</dt><dd>${money(c.budget.acad + c.budget.scout)}</dd>
      <dt>Sponsors</dt><dd>${money(sponsorTotal(c))}</dd><dt>Central money</dt><dd>${money(TV[T])}</dd><dt>Matchday (est.)</dt><dd>${money((f.gate + f.conc - f.rent) * G.leagues[c.lg].clubs.length - 1)}</dd></dl></section>
  </div></div>`;
}

/* ---------- Commercial ---------- */
function pgComm() {
  const c = my();
  return `<p class="small muted" style="margin-bottom:12px">Brands pay according to your division, your standing and the size and mood of your support. Offers last a few weeks. Longer deals pay a little less a year but lock it in, which is good while you're small and bad once you've grown. Each deal pays a bonus if you're promoted.</p>
  <div class="grid2 needs">${Object.entries(SLOTS).map(([k, S]) => {
    const avail = !S.need || S.need(c), d = c.deals.find(x => x.slot === k), offers = c.offers.filter(o => o.slot === k);
    return `<section class="card"><div class="card-h"><h3>${S.l}</h3>${d ? `<span class="good small">${d.yrs} yr left</span>` : ""}</div>
      ${!avail ? `<p class="muted small">${k === "stadium" ? "You need a stadium of your own." : "You need a training ground of level 2 or better."}</p>` :
      `${d ? `<p><b>${esc(d.brand)}</b> · ${money(d.amt)}/yr · promotion bonus ${money(d.bonus)}</p>` : `<p class="muted">No sponsor.</p>`}
      ${offers.length ? `<div class="stack" style="margin-top:10px;gap:8px">${offers.map((o, i) => `<div class="row between offer"><span><b>${esc(o.brand)}</b><br><span class="small muted">${o.yrs} yr · bonus ${money(o.bonus)} · expires in ${o.exp} wk</span></span><span class="row"><b class="num">${money(o.amt)}/yr</b><button class="btn sm primary" data-act="sponsor" data-k="${k}" data-i="${i}">Sign</button></span></div>`).join("")}</div>` : ""}
      ${!d || d.yrs <= 1 ? `<button class="btn sm" style="margin-top:10px" data-act="askoffers" data-k="${k}" ${(c.ask || {})[k] > G.week + G.year * 100 - 4 && (c.ask || {})[k] ? "disabled" : ""}>Ask the agency for new offers</button>` : ""}`}
    </section>`; }).join("")}</div>`;
}

/* ---------- Facilities ---------- */
function progress(b) { return `<p class="small">Under construction: ${b.total - b.left} of ${b.total} weeks ${bar(b.total - b.left, b.total)}</p>`; }
function pgFac() {
  const c = my(), S = c.fac.stadium, up = ABOVE[c.lg], need = up ? GROUND_REQ[LEAGUES[up].tier] : 0;
  let st = `<section class="card"><div class="card-h"><h2>Stadium</h2><span class="small muted">${S.own ? esc(S.name) : "Rented"}</span></div>
    <dl class="ledger"><dt>Capacity</dt><dd>${capacity(c).toLocaleString()}</dd><dt>Needed for promotion</dt><dd class="${capacity(c) < need ? "bad" : "good"}">${need ? need.toLocaleString() : "—"}</dd>
    <dt>Facilities</dt><dd>Level ${ground(c).amen} of 5</dd>${S.own ? `<dt>Executive suites</dt><dd>${S.suites || 0} (room for ${suiteMax(c)})</dd><dt>Pitch</dt><dd>${word(pitchWord(S.pitch))} ${Math.round(S.pitch)}/100 · ${PITCH[S.ptype || "grass"].l}</dd><dt>Upkeep</dt><dd>${money(stadiumUpkeep(c))}/yr</dd>` : `<dt>Rent</dt><dd>${money(ground(c).rent)} a home game</dd>`}</dl>`;
  if (S.build) st += `<p style="margin-top:10px"><b>${esc(S.build.label)}</b></p>` + progress(S.build);
  if (!S.own) {
    st += `<h3 style="margin:14px 0 6px">Where you play</h3>${HOSTS.map((h, i) => `<div class="row between offer"><span>${esc(h.name[0].toUpperCase() + h.name.slice(1))}<br><span class="small muted">${h.cap.toLocaleString()} capacity · ${money(h.rent)} a game · facilities ${h.amen}</span></span>${S.host === i ? `<span class="good small">Current</span>` : `<button class="btn sm" data-act="host" data-i="${i}">Move here</button>`}</div>`).join("")}`;
    if (!S.build) st += `<h3 style="margin:14px 0 6px">Build your own ground</h3><p class="small muted">Your own ground keeps all the bar takings, unlocks executive suites and naming rights, and has no rent; it has upkeep instead. You'll keep renting while it's built.</p>
      <label class="small">Name <input id="st-name" value="${esc(c.town)} Park" maxlength="30"></label>
      ${BUILD_SIZES.map(n => { const q = newStadiumQuote(n); return `<div class="row between offer"><span><b>${n.toLocaleString()}</b> capacity<br><span class="small muted">${money(q.cost)} · about ${q.weeks} weeks</span></span><button class="btn sm" data-act="buildst" data-n="${n}">Build</button></div>`; }).join("")}`;
  } else if (!S.build) {
    st += `<h3 style="margin:14px 0 6px">Expand</h3>${[1000, 3000, 8000, 15000].map(a => { const q = expandQuote(c, a); return `<div class="row between offer"><span>New stand: <b>+${a.toLocaleString()}</b><br><span class="small muted">${money(q.cost)} · about ${q.weeks} weeks</span></span><button class="btn sm" data-act="expand" data-n="${a}">Build</button></div>`; }).join("")}`;
    const aq = amenQuote(c); if (aq) st += `<div class="row between offer"><span>Upgrade facilities to level ${aq.lvl}<br><span class="small muted">Concourses, bars, toilets: more spent per fan. ${money(aq.cost)} · ${aq.weeks} weeks</span></span><button class="btn sm" data-act="amen">Upgrade</button></div>`;
    if (!S.heat) { const hq = heatQuote(c); st += `<div class="row between offer"><span>Undersoil heating<br><span class="small muted">Frost and snow won't postpone your home games. ${money(hq.cost)} · ${hq.weeks} weeks · upkeep ${money(hq.upkeep)}/yr</span></span><button class="btn sm" data-act="heat">Install</button></div>`; }
    const sq = suiteQuote(c); if (sq) st += `<div class="row between offer"><span>Add ${sq.add} executive suites<br><span class="small muted">Let to businesses by the season (demand about ${Math.round(suiteDemand(c))} at the going rate). ${money(sq.cost)} · ${sq.weeks} weeks</span></span><button class="btn sm" data-act="suites">Build</button></div>`;
  }
  if (S.own) st += S.relay ? `<p class="small" style="margin-top:10px">The pitch is being re-laid (${S.relay.left} week${S.relay.left > 1 ? "s" : ""} left).</p>` :
    `<h3 style="margin:14px 0 6px">Pitch</h3><p class="small muted">Wears with every home game. A worn pitch blunts passing football at home, causes more injuries and annoys supporters. It recovers over the summer.</p>${Object.entries(PITCH).map(([k, t]) => `<div class="row between offer"><span>Re-lay with ${t.l.toLowerCase()}<br><span class="small muted">${money(t.cost(c))}${k === "hybrid" ? " · wears about half as fast" : ""}</span></span><button class="btn sm" data-act="relay" data-k="${k}">Re-lay</button></div>`).join("")}`;
  st += `</section>`;
  if (S.own) {
    st += `<section class="card"><div class="card-h"><h2>Beyond match days</h2></div><p class="small muted" style="margin-bottom:8px">Other ways to make the ground pay. This season so far: ${money(c.fin.events || 0)}.</p>
      ${Object.entries(VENTURES).map(([k, V]) => { const on = has(c, k), ok = ventureOK(c, k);
        return `<div class="row between offer"><span><b>${V.l}</b>${on ? ' <span class="good small">open</span>' : ""}<br><span class="small muted">${V.d} ${on ? "" : `Costs ${money(V.cost(c))}`}${V.upkeep ? ` · upkeep ${money(V.upkeep)}/yr` : ""}${V.week && ok ? ` · earns about ${money(V.week(c) * 52)}/yr` : ""}</span></span>${on ? `<button class="btn sm" data-act="unvent" data-k="${k}">Close</button>` : ok ? `<button class="btn sm" data-act="vent" data-k="${k}">Build</button>` : `<span class="small muted">Not yet</span>`}</div>`; }).join("")}
      <div class="row between offer"><span><b>Summer concerts</b><br><span class="small muted">${S.cap >= CONCERT_MIN ? `About ${money(concertFee(c))} each, held in pre-season. Each one costs the pitch about 8 points.` : `Needs a ground of ${CONCERT_MIN.toLocaleString()}.`}</span></span>${S.cap >= CONCERT_MIN ? `<select data-act="concerts">${[0, 1, 2, 3, 4].map(n => `<option ${n === (S.concerts || 0) ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}</div></section>`;
  }
  const fac = k => { const F = c.fac[k], D = k === "train" ? TRAIN_DESC : ACAD_DESC, nx = F.lvl + 1;
    return `<section class="card"><div class="card-h"><h2>${FAC_NAME[k]}</h2><span class="num">Level ${F.lvl}/10</span></div><p class="lead">${D[F.lvl]}.</p>
      <p class="small muted" style="margin:6px 0">${k === "train" ? "Better training speeds up development, cuts injuries, and helps attract staff." : "No academy means no youth intake. Each level brings bigger, better intakes and faster development for academy players, and slightly better odds of an exceptional talent."} Upkeep ${money(facUpkeep(k, F.lvl))}/yr.</p>
      ${F.build ? progress(F.build) : nx <= 10 ? `<div class="row between offer"><span>Upgrade to level ${nx}: ${D[nx].toLowerCase()}<br><span class="small muted">${money(facCost(k, nx))} · ${facWeeks(nx)} weeks · upkeep then ${money(facUpkeep(k, nx))}/yr</span></span><button class="btn sm" data-act="upfac" data-k="${k}">Build</button></div>` : ""}</section>`; };
  return `<div class="grid2"><div class="stack">${st}</div><div class="stack">${fac("train")}${fac("acad")}</div></div>`;
}

/* ---------- League ---------- */
function pgLeagueInner() {
  const k = SUB.league || my().lg;
  const opts = LG_KEYS.map(x => `<option value="${x}" ${x === k ? "selected" : ""}>${LEAGUES[x].name}</option>`).join("");
  const scorers = Object.values(G.players).filter(p => p.club >= 0 && CL(p.club).lg === k && p.s.g > 0).sort((a, b) => b.s.g - a.s.g).slice(0, 8);
  const po = G.po && G.po[k];
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>${LEAGUES[k].name}</h2><select data-act="lgsel">${opts}</select></div>
    ${tableHTML(k, table(k))}<p class="small muted" style="margin-top:8px">${LEAGUES[k].auto ? `Top ${LEAGUES[k].auto} promoted` : "Champions"}${LEAGUES[k].po ? `, ${ord(LEAGUES[k].po[0])}–${ord(LEAGUES[k].po[1])} play-offs` : ""}, bottom ${LEAGUES[k].down} ${LEAGUES[k].tier === 7 ? "drop out of the pyramid" : "relegated"}. Promotion needs a ground of ${ABOVE[k] ? GROUND_REQ[LEAGUES[ABOVE[k]].tier].toLocaleString() : "—"}.</p></section>
    ${po ? `<section class="card"><div class="card-h"><h3>Play-offs</h3></div>${po.res.map(r => `<p>${esc(CL(r.h).name)} ${r.hg}–${r.ag} ${esc(CL(r.a).name)}${r.pens ? " (pens)" : ""}</p>`).join("") || "<p class='muted'>To come.</p>"}</section>` : ""}
    ${k === my().lg ? `<section class="card"><div class="card-h"><h3>Your results</h3></div>${(G.myRes || []).length ? resultsList((G.myRes || []).slice().reverse()) : "<p class='muted'>None yet.</p>"}</section>` : ""}</div>
    <div class="stack"><section class="card"><div class="card-h"><h3>Top scorers</h3></div>${scorers.length ? scorers.map(p => `<div class="row between small"><button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button><span class="muted">${esc(CL(p.club).short)}</span><b class="num">${p.s.g}</b></div>`).join("") : "<p class='muted'>None yet.</p>"}</section></div></div>`;
}
function clubModal(id) {
  const c = CL(id), ps = c.squad.map(P).filter(p => !p.acad).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ovr - a.ovr);
  modal(`<div class="modal-h" style="--mc:${c.color}">${crest(c, 36)}<div><p class="eyebrow">${LEAGUES[c.lg].name} · founded ${c.founded}</p><h2>${esc(c.name)}</h2></div><button class="btn modal-x" data-act="close">✕</button></div>
    <div class="modal-b">${isMine(c) ? "" : `<dl class="facts"><div><dt>Manager</dt><dd>${esc(c.coach.name)}</dd></div><div><dt>Style</dt><dd>${STYLES[c.coach.style].l}, ${c.coach.form}</dd></div><div><dt>Ground</dt><dd>${c.cap.toLocaleString()}</dd></div><div><dt>Owner</dt><dd>${esc(c.own.name)}<br><span class="small muted">${OWNER_STYLES[c.own.style].l}</span></dd></div><div><dt>Honours</dt><dd>${c.trophies.length ? c.trophies.map(t => t[0] + " " + t[1]).join(", ") : "—"}</dd></div></dl>`}
    <div class="tbl-wrap"><table><tbody>${ps.map(p => `<tr class="click" data-act="player" data-id="${p.id}"><td><span class="pos">${p.pos}</span></td><td style="text-align:left">${esc(p.name)}</td><td class="num">${p.age}</td><td>${range(ovrEstimate(p))}</td></tr>`).join("")}</tbody></table></div></div>`);
}

/* ---------- Market ---------- */
function pgMarket() {
  const c = my(), F = MARKET_F, s = staffOf("recruit"), needs = squadNeeds(c);
  const pool = Object.values(G.players).filter(p => p.club !== c.id && !p.acad && (!F.pos || p.pos === F.pos) && p.age <= F.age && (p.club < 0 || CL(p.club).tier >= c.tier - 2))
    .map(p => ({ p, e: ovrEstimate(p), fee: askingFee(p) })).filter(x => r20((x.e[0] + x.e[1]) / 2) >= F.min && (!F.fee || x.fee <= F.fee)).sort((a, b) => b.e[1] - a.e[1]).slice(0, 60);
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>Transfer market</h2><span class="small ${windowOpen() ? "good" : "muted"}">${windowOpen() ? "Window open" : "Window closed: free agents only"}</span></div>
    <p class="small muted" style="margin-bottom:10px">Buying a player yourself goes over your head of recruitment's head. Players at clubs more than two divisions above won't come. Ratings are ${s ? `${esc(s.name)}'s estimates` : "guesses: you have no recruitment staff"}.</p>
    <div class="row filters"><select data-act="mf" data-k="pos"><option value="">All positions</option>${POS.map(x => `<option ${F.pos === x ? "selected" : ""}>${x}</option>`).join("")}</select>
      <label class="small">Max age <input type="number" class="num-in sm" data-act="mf" data-k="age" value="${F.age}"></label><label class="small">Min rating <input type="number" class="num-in sm" data-act="mf" data-k="min" value="${F.min}"></label><label class="small">Max fee <input type="number" class="num-in" data-act="mf" data-k="fee" value="${F.fee}" step="10000" placeholder="any"></label></div>
    <div class="tbl-wrap"><table class="sq"><thead><tr><th>Pos</th><th style="text-align:left">Name</th><th>Age</th><th style="text-align:left">Club</th><th>Rating</th><th>Potential</th><th>Fee</th></tr></thead><tbody>
    ${pool.map(({ p, e, fee }) => `<tr class="click" data-act="player" data-id="${p.id}"><td><span class="pos">${p.pos}</span></td><td style="text-align:left">${esc(p.name)}</td><td class="num">${p.age}</td><td style="text-align:left" class="small">${esc(fromName(p))}</td><td>${range(e)}</td><td>${range(potEstimate(p))}</td><td class="num">${fee ? money(fee) : "Free"}</td></tr>`).join("")}</tbody></table></div></section></div>
    <div class="stack"><section class="card"><div class="card-h"><h3>Recruitment priorities</h3></div>${s ? `<p class="small muted" style="margin-bottom:8px">${esc(s.name)} · ${ROLES_STAFF.recruit.phil[s.phil].l} · ${ROLES_STAFF.recruit.focus[s.focus]}</p>` : `<p class="warn small">No head of recruitment: nobody is signing players.</p>`}
      ${needs.length ? needs.map(n => `<div class="row between small"><span><span class="pos">${n.pos}</span> ${n.kind === "depth" ? `needs ${n.short} more` : "needs an upgrade"}</span><span class="muted">best now ${n.weakest ? r20(n.weakest) : "—"}</span></div>`).join("") : "<p class='small'>The squad is covered.</p>"}
      <p class="small muted" style="margin-top:8px">Budget left: ${money(c.budget.transfer - c.spentT)} in fees, ${money(Math.max(0, c.budget.wages - wageBill(c)))} a year in wages.</p></section></div></div>`;
}
function buyModal(id) {
  const p = G.players[id], fee = askingFee(p), wage = playerAsk(p) || demandWage(p, my()), s = staffOf("recruit");
  modal(`<div class="modal-h"><div><p class="eyebrow">Your offer</p><h2>${esc(p.name)}</h2><p class="small muted">${esc(fromName(p))}</p></div><button class="btn modal-x" data-act="close">✕</button></div>
    <div class="modal-b"><p>The selling club wants about <b>${fee ? money(fee) : "nothing"}</b>. He wants about <b>${money(wage)}</b> a year.</p>
    <div class="row"><label class="small">Fee € <input type="number" class="num-in" id="b-fee" value="${fee}" step="1000"></label><label class="small">Wage €/yr <input type="number" class="num-in" id="b-wage" value="${wage}" step="1000"></label></div>
    ${factorBars(playerAppeal(p, wage), P_FACTORS)}
    <p class="small muted">Paid from club cash (${money(my().cash)}), outside the budgets you've set. ${s ? `${esc(s.name)} won't like being bypassed.` : ""}</p>
    <div class="row"><button class="btn primary" data-act="buygo" data-id="${p.id}">Make the offer</button></div></div>`);
}

/* ---------- History ---------- */
function pgHist() {
  const c = my();
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>Seasons</h2></div>${G.history.length ? `<div class="tbl-wrap"><table><thead><tr><th>Season</th><th style="text-align:left">Division</th><th>Pos</th><th>Pts</th><th>Crowd</th><th>Income</th><th>Costs</th><th style="text-align:left">Manager</th><th style="text-align:left">Cups · targets</th></tr></thead><tbody>
    ${G.history.map(h => `<tr><td>${seasonLabel(h.y)}</td><td style="text-align:left">${G.career && G.career.length ? `<b>${esc(h.club || "")}</b> · ` : ""}${LEAGUES[h.lg].name}</td><td class="num">${ord(h.pos)}${h.up ? ' <span class="good">▲</span>' : h.down ? ' <span class="bad">▼</span>' : ""}</td><td class="num">${h.pts}</td><td class="num">${h.att.toLocaleString()}</td><td class="num">${money(h.inc)}</td><td class="num">${money(h.cost)}</td><td style="text-align:left" class="small">${esc(h.mgr)}</td><td style="text-align:left" class="small">${[...(h.cups || []), ...(h.obj || [])].map(esc).join("<br>")}</td></tr>`).join("")}</tbody></table></div>` : "<p class='muted'>Your first season is under way.</p>"}</section>
    <section class="card"><div class="card-h"><h3>Honours</h3></div>${c.trophies.length ? c.trophies.map(t => `<p>🏆 ${t[0]} ${esc(t[1])}</p>`).join("") : "<p class='muted'>None yet.</p>"}</section></div>
    <div class="stack"><section class="card"><div class="card-h"><h3>Hall of fame</h3></div>${G.hof.length ? G.hof.slice(-15).reverse().map(h => `<p class="small">${esc(h.name)} (${h.pos}) · peak ${h.peak} · ${h.apps} apps, ${h.goals} goals · retired ${h.y}</p>`).join("") : "<p class='muted small'>Great players who retire are remembered here.</p>"}</section>
    <section class="card"><div class="card-h"><h3>Save</h3></div><div class="row"><button class="btn sm" data-act="export">Export save file</button><label class="btn sm">Import<input type="file" id="imp" accept=".json" hidden></label><button class="btn sm" data-act="quit">Back to start</button></div></section></div></div>`;
}

/* ---------- modal ---------- */
function modal(html) { const m = $("#modal"); m.innerHTML = `<div class="scrim" data-act="closebg"><div class="modal" role="dialog">${html}</div></div>`; }
function closeModal() { $("#modal").innerHTML = ""; }
