/* The owner's office: every page and dialog. Actions are buttons with data-act; main.js routes them. */
"use strict";

const $ = s => document.querySelector(s);
let NAV_X = 0, MAST_COMPACT = false, PAGE = "home", SUB = {}, MARKET_F = { tab: "all", pos: "", arch: "", age: 40, fee: 0, wage: 0, min: 0, pmin: 0, lshare: 0, int: "", lg: "", off: [] };
const eur = v => (v < 0 ? "−" : "") + "€" + (Math.abs(v) < 100 ? Math.abs(v).toFixed(2).replace(/\.00$/, "") : Math.round(Math.abs(v)).toLocaleString("en-GB"));
// Figures in boxes read with thousands commas ("300,000"); num() reads them back however they were typed.
const fmtNum = v => v === "" || v == null ? "" : Number(v).toLocaleString("en-GB", { maximumFractionDigits: 2 });
const num = el => Math.max(0, +String(el && el.value || "").replace(/[^0-9.]/g, "") || 0);
// A sensible step for a budget of this size: about a tenth of it, rounded.
const stepFor = v => { const t = Math.max(1000, v / 10), m = Math.pow(10, Math.floor(Math.log10(t))); return Math.round(t / m) * m; };
const big = v => Math.abs(v) < 1000 ? eur(v) : money(v);
const crest = (c, s = 22) => `<svg class="crest" width="${s}" height="${Math.round(s * 1.15)}" viewBox="0 0 20 23" aria-hidden="true"><path d="M1 1h18v9c0 6-4 10-9 12C5 20 1 16 1 10z" fill="${c.color}" stroke="var(--crest-edge)"/><text x="10" y="13" text-anchor="middle" font-size="6" font-weight="700" fill="#fff" font-family="sans-serif">${esc(c.short)}</text></svg>`;
const clubLink = c => `<button class="lnk" data-act="club" data-id="${c.id}">${esc(c.name)}</button>`;
const bar = (v, max = 100) => `<span class="bar"><i style="width:${clamp(v / max * 100, 0, 100)}%"></i></span>`;
const rcls = v => v >= 80 ? "r-elite" : v >= 70 ? "r-high" : v >= 55 ? "r-mid" : v >= 40 ? "r-low" : "r-bad";
// Everything is shown out of 20 (see r20 in core.js).
const rating = v => `<span class="ovr ${rcls(v)}">${r20(v)}</span>`;
// A wonderkid is obvious to everyone: tagged wherever he appears.
const wkChip = p => isWonderkid(p) ? ' <span class="chip" style="background:var(--win, #2f9e5b);color:#fff" title="A wonderkid: a very high ceiling, already close to it, and growing fast">WONDERKID</span>' : "";
// Movement since the end of last season: an arrow beside the rating.
const ratingMove = p => { if (p.r0 == null) return ""; const d = r20(p.ovr) - p.r0; return d ? ` <span class="${d > 0 ? "good" : "bad"}" style="font-size:.8em" title="${d > 0 ? "Up" : "Down"} ${Math.abs(d)} since the end of last season (was ${p.r0})">${d > 0 ? "▲" : "▼"}</span>` : ""; };
const range = ([a, b]) => r20(a) === r20(b) ? rating(a) : `<span class="ovr ${rcls((a + b) / 2)}">${r20(a)}–${r20(b)}</span>`;
const favChip = (p, cid, short) => ({ 2: `<span class="chip rival r3" title="Club legend">${short ? "LEG" : "LEGEND"}</span>`, 1: `<span class="chip acad" title="Fan favourite">${short ? "FAV" : "FAN FAVOURITE"}</span>` })[favLevel(p, cid)] || "";
const exLine = s => s.ex ? `<p class="small">${isLegendOf(s, G.club) ? '<span class="chip rival r3">YOUR CLUB LEGEND</span> ' : s.ex.favOf.includes(G.club) ? '<span class="chip acad">YOUR FORMER FAVOURITE</span> ' : ""}Former ${POS_NAME[s.ex.pos].toLowerCase()}: best rating ${r20(s.ex.peak)}, ${s.ex.apps} games, ${s.ex.goals} goals (${s.ex.clubs.map(esc).join(", ")})</p>` : "";
/* Sortable tables, as in Touchline Manager: tap a column heading to sort by it, tap again to reverse. Text columns start
   A-Z, numbers start highest first. cols: { k, l, v: row => sort value, f: row => cell html, r: right-aligned, left }. */
let SORTS = {};
function sortTable(id, cols, rows, opt = {}) {
  const st = SORTS[id] || opt.sort || null;
  if (st) { const col = cols.find(c => c.k === st.k); if (col && col.v) rows = rows.map(r => [col.v(r), r]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0) * st.d).map(x => x[1]); }
  const total = rows.length; if (opt.limit) rows = rows.slice(0, opt.limit);
  return `<div class="tbl-wrap"><table class="sq"><thead><tr>${cols.map(c => `<th${c.left ? ' style="text-align:left"' : ""} ${st && st.k === c.k ? `aria-sort="${st.d > 0 ? "ascending" : "descending"}"` : ""}>${c.v ? `<button data-act="sort" data-v="${id}|${c.k}">${c.l}${st && st.k === c.k ? (st.d > 0 ? " ▲" : " ▼") : ""}</button>` : c.l}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(r => `<tr${opt.row ? " " + opt.row(r) : ""}>${cols.map(c => `<td class="${c.r ? "num" : ""}"${c.left ? ' style="text-align:left"' : ""}>${c.f(r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="muted">${opt.empty || "Nothing to show."}</td></tr>`}</tbody></table></div>${opt.limit && total > opt.limit && !opt.quiet ? `<p class="small muted" style="margin-top:6px">Showing ${opt.limit} of ${total.toLocaleString("en-GB")}. Narrow the filters or sort to see others.</p>` : ""}`;
}
const SORT_UP = ["name", "pos", "club", "nat", "ask"];  // columns that start A-Z (or by position)
const archChip = p => { const a = archetypeOf(p); return a ? `<span class="chip hg" title="${esc(a[0] + ": " + a[2])}">${a[3]}</span>` : ""; };
const staff20 = v => `${bar(v)}<b class="num">${s20(v)}</b>`;  // directors and preferences: straight 1-20
const staffR20 = v => `${bar(staffEq(v))}<b class="num">${sr20(v)}</b>`;  // staff abilities: on the players' scale
const attr20 = v => `${bar(v)}<b class="num">${r20(v)}</b>`;
const word = ([w, cls]) => `<span class="${cls}">${w}</span>`;
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600); }

/* ---------- start screen ---------- */
function renderStart(saves) {
  $("#app").innerHTML = `<div class="wrap gut"><div class="hero"><p class="eyebrow">The Owner's Box <span style="opacity:.7">· version ${VERSION}</span></p><h1>Build a club <span>from nothing</span></h1>
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
    <label>Where the club is<select id="f-region">${COUNTRY.ENG.regions.map(r => `<option value="${esc(r[0])}" ${r[0] === "London" ? "selected" : ""}>${esc(r[0])} (Regional League ${r[3] === "N" ? "North" : "South"})</option>`).join("")}</select></label>
    <p class="small muted" style="margin-top:4px">Sets your local derbies, away-trip distances, and which players count as local lads.</p>
    <h3 style="margin:16px 0 8px">Colours</h3>
    <div class="swatches" id="f-color">${CLUB_COLORS.map((c, i) => `<button style="background:${c}" data-v="${c}" aria-pressed="${i === 1}" aria-label="Colour ${i + 1}"></button>`).join("")}</div>
    <h3 style="margin:16px 0 8px">Your fortune</h3>
    <div class="pick-cards" id="f-wealth">${Object.entries(WEALTH).map(([k, w], i) => `<button class="pick-card" data-v="${k}" aria-pressed="${i === 1}"><b>${w.l}</b><span class="num">${money(w.amt)}</span><small>${w.d}</small></button>`).join("")}</div>
    ${visionCard(START_V, true)}
    <div class="row" style="margin-top:18px"><button class="btn primary" data-act="found">Found the club</button><span class="muted small">Building the leagues takes a few seconds.</span></div>
    </section><p class="muted small" style="margin:18px 0">All clubs, players and staff are fictional.</p></div>`;
}

/* ---------- masthead ---------- */
const PAGES = [["home", "Office"], ["owner", "Owner"], ["squad", "Squad"], ["tactics", "Tactics"], ["staff", "Staff"], ["fin", "Finances"], ["comm", "Commercial"], ["fac", "Facilities"], ["board", "Board"], ["net", "Network"], ["league", "Competitions"], ["market", "Market"], ["moves", "Activity"], ["rivals", "Rivals"], ["hist", "History"]];
function phaseText() {
  if (G.phase === "summer") return `${seasonLabel(G.year)} pre-season · week ${G.week + 1} of ${SUMMER_WEEKS} · transfer window open`;
  if (G.phase === "playoffs") return `${seasonLabel(G.year)} · play-offs`;
  return `${seasonLabel(G.year)} · week ${G.week + 1} of ${SEASON_WEEKS}${windowOpen() ? " · January window open" : ""}`;
}
function mast() {
  const c = my(), pos = G.phase === "summer" ? null : posOf(c.lg, c.id), dec = openDecisions().length;
  return `<header class="mast${MAST_COMPACT ? " compact" : ""}" style="--club:${c.color}"><div class="wrap gut"><div class="mast-in">
    <div class="ident row">${crest(c, 30)}<div><p class="eyebrow" style="color:var(--board-muted)">${phaseText()}</p><h1 style="font-size:24px">${esc(c.name)}</h1></div></div>
    <div class="mast-r"><dl class="kpis">
      <div><dt>Club cash</dt><dd class="${c.cash < 0 ? "bad" : ""}">${money(c.cash)}</dd></div>
      <div><dt>Your fortune</dt><dd>${money(G.owner.wealth)}</dd></div>
      <div><dt>${LEAGUES[c.lg].name}</dt><dd>${pos ? ord(pos) : "—"}</dd></div>
      <div><dt>Fans</dt><dd>${c.fans.toLocaleString("en-GB")}</dd></div></dl>
      <div class="playbtn"><button data-act="adv" data-n="1">Continue</button><button data-act="advmenu" aria-label="More">▾</button></div></div></div>
    <nav class="tabs">${PAGES.map(([k, l]) => `<button data-act="page" data-p="${k}" ${PAGE === k || (PAGE === "hire" && k === "staff") ? 'aria-current="page"' : ""}>${l}${k === "home" && dec ? `<span class="dot">${dec}</span>` : ""}</button>`).join("")}</nav></div></header>`;
}
function render() {
  if (!G) return;
  if (G.club == null) { $("#app").innerHTML = buyScreen(); return; }
  const body = { home: pgHome, squad: pgSquad, staff: pgStaff, fin: pgFin, comm: pgComm, fac: pgFac, league: pgComps, market: pgMarket, hist: pgHist, board: pgBoard, net: pgNet, rivals: pgRivals, tactics: pgTactics, owner: pgOwner, hire: pgHire, moves: pgMoves }[PAGE]();
  if (G.ended) { $("#app").innerHTML = endScreen(); return; }
  // The section tabs keep their sideways scroll across redraws, so tapping a tab doesn't snap the bar back to the start.
  // (Only a visible bar records it: iOS reports 0 while the compact masthead hides it.)
  const y = scrollY, nav = document.querySelector("nav.tabs"); if (nav && nav.offsetParent) NAV_X = nav.scrollLeft;
  $("#app").innerHTML = mast() + `<main class="wrap gut page">${body}</main>`;
  const nav2 = document.querySelector("nav.tabs"); if (nav2) nav2.scrollLeft = NAV_X;
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
  // A small ground is a financial handicap: when it keeps selling out, fans (and their money) are being turned away.
  const recent = (c.att || []).slice(-5), full = recent.filter(a => a >= capacity(c)).length;
  if (recent.length >= 3 && full >= 3) out.push([`${full} of your last ${recent.length} home games sold out. A bigger ground would earn more at the gate and the bar.`, "fac"]);
  if (c.fac.stadium.own && c.fac.stadium.pitch < 50 && !c.fac.stadium.relay) out.push(["The pitch is in poor condition.", "fac"]);
  if (c.cash < 0) out.push([`The club is overdrawn (${money(c.cash)}).`, "fin"]);
  // Pre-season: weeks still without a friendly (fewer than two in all and the side starts the season rusty).
  if (G.phase === "summer") { const free = freeWeeks().length, have = (G.friendlies || []).length;
    if (free) out.push([`${free} pre-season week${free > 1 ? "s have" : " has"} no friendly yet${have < 2 ? `: with fewer than two, the side starts the season rusty` : ""}. Arrange them on Competitions → Pre-season.`, "league"]); }
  return out;
}
function pgHome() {
  const c = my(), nf = nextFixture(), last = (G.myRes || []).slice(-6).reverse(), todo = checklist();
  const fx = nf ? `<p class="lead">${nf.h === c.id ? "Home" : "Away"} to ${clubLink(CL(nf.h === c.id ? nf.a : nf.h))} <span class="muted">· week ${nf.w + 1}</span></p>` : G.phase === "summer" ? `<p class="lead">Pre-season. The first league game is in ${SUMMER_WEEKS - G.week} week${SUMMER_WEEKS - G.week > 1 ? "s" : ""}.</p>` : G.phase === "playoffs" ? (() => { const m = myPlayoff(); if (!m) return `<p class="lead">The regular season is over: the play-offs are being played.</p>`;
      const opp = id => clubLink(CL(id === G.club ? (m.h === G.club ? m.a : m.h) : id));
      return m.stage === "semi" ? `<p class="lead">${LEAGUES[m.k].name} play-off semi-final: ${m.h === G.club ? "home to" : "away to"} ${opp(G.club)}</p><p class="small muted">One game; extra time and penalties if level. The winners go to the final at a neutral ground.</p>`
        : m.stage === "final" ? `<p class="lead">${LEAGUES[m.k].name} play-off final v ${opp(G.club)}</p><p class="small muted">At a neutral ground. The winners are promoted.</p>`
        : `<p class="lead">Out of the play-offs: beaten in the semi-final by ${clubLink(CL(m.opp))}.</p>`; })() : `<p class="lead">No more league games this season.</p>`;
  const xi = pickXI(c), fit = styleFit(xi, mgr().phil);
  // Anything waiting on your decision (a bid, a choice) puts the inbox first; otherwise it sits further down.
  const act = G.inbox.some(x => !x.done && (x.type === "bid" || x.type === "war" || x.type === "choice") && (x.type === "choice" || G.players[x.pid]));
  // Tabs keep the page short: today (what's next, the table, what needs you), the team, the club, and the news.
  // Anything waiting on your decision sits above the tabs whichever is open.
  const tab = SUB.office || "today", TABS = [["today", "Today"], ["team", "Team"], ["club", "Club"], ["news", "News"]];
  const tabs = `<div class="chips" style="margin-bottom:14px">${TABS.map(([k, l]) => `<button data-act="sub" data-k="office" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>`;
  const panes = {
    today: () => `<div class="grid2"><div class="stack">
    <section class="card"><div class="card-h"><h2>Next up</h2><span class="muted small">${esc(mgr().name)} · ${STYLES[mgr().phil].l} · ${mgr().form}</span></div>${fx}
      ${myCupTie().map(({ k, K, t }) => `<p>${CUP_DEF[k].name} ${K.name.toLowerCase()}: ${t.h === G.club ? "home to" : "away to"} ${clubLink(CL(t.h === G.club ? t.a : t.h))} <span class="muted small">· week ${CUP_DEF[k].weeks[K.round] + 1}</span></p>`).join("")}
      ${Object.values(G.cont || {}).filter(K => K.teams.includes(G.club) && K.win == null).map(K => { const D = CONT[K.key], md = CONT_GROUP_WEEKS.findIndex(w => w >= G.week);
        if (K.md < 6 && md >= 0) { const g = K.groups.findIndex(x => x.includes(G.club)), pair = GROUP_MD[md].map(([i, j]) => [K.groups[g][i], K.groups[g][j]]).find(p => p.includes(G.club)); return `<p>${D.name}, Group ${"ABCDEFGH"[g]}: ${pair[0] === G.club ? "home to" : "away to"} ${clubLink(CL(pair[0] === G.club ? pair[1] : pair[0]))} <span class="muted small">· week ${CONT_GROUP_WEEKS[md] + 1}</span></p>`; }
        const R = K.ko[K.round], t = R && R.ties.find(t => (t.h === G.club || t.a === G.club) && t.w == null); return t ? `<p>${D.name} ${R.n.toLowerCase()}: v ${clubLink(CL(t.h === G.club ? t.a : t.h))} <span class="muted small">· week${R.n === "Final" ? "" : "s"} ${CONT_KO[K.round].w.map(w => w + 1).join(" & ")}</span></p>` : ""; }).join("")}
      ${weatherLine()}
      <p class="small muted" style="margin-top:6px">Squad suits the manager's style: ${fitText(fit)} · Team rating ${r20(avg(xi.map(o => roleRating(o.p, o.slot))))} (division typical ${r20(TIER_LVL[c.tier])}) · Morale ${Math.round(c.morale)}</p></section>
    ${positionCard(c)}
  </div><div class="stack">
    ${todo.length ? `<section class="card"><div class="card-h"><h2>Needs your attention</h2></div><ul class="todo">${todo.map(([t, p]) => `<li><button class="lnk" data-act="page" data-p="${p}">${esc(t)}</button></li>`).join("")}</ul></section>` : ""}
    ${act ? "" : inboxCard()}
    ${G.phase === "summer" && !(G.obj && G.obj.y === G.year) ? objectivesCard() : ""}
  </div></div>`,
    team: () => `<div class="grid2"><div class="stack">
    ${performersCard(c)}
    <section class="card"><div class="card-h"><h2>Results</h2><button class="lnk small" data-act="page" data-p="league">All results</button></div>${last.length ? resultsList(last) : `<p class="muted">No games yet.</p>`}</section>
  </div><div class="stack">
    ${needsCard(c)}
  </div></div>`,
    club: () => `<div class="grid2"><div class="stack">
    <section class="card"><div class="card-h"><h3>The club</h3></div><dl class="ledger">
      <dt>Supporters</dt><dd>${c.fans.toLocaleString("en-GB")} · ${word(moodWord(c.mood))}</dd>
      <dt>Ground</dt><dd>${capacity(c).toLocaleString("en-GB")}${atHome(c) ? "" : " (rented)"}</dd>
      <dt>Season tickets</dt><dd>${stHolders(c) ? `${stHolders(c).toLocaleString("en-GB")} sold` : G.phase === "summer" ? `on sale (~${stDemand(c).toLocaleString("en-GB")})` : "none"}</dd>
      <dt>Training ground</dt><dd>Level ${c.fac.train.lvl}</dd><dt>Academy</dt><dd>Level ${c.fac.acad.lvl}</dd>
      <dt>Wage bill</dt><dd>${money(wageBill(c))} / ${money(c.budget.wages)}</dd>
      <dt>Season so far</dt><dd class="${ledgerIncome(c.fin) - ledgerCosts(c.fin) < 0 ? "bad" : "good"}">${money(ledgerIncome(c.fin) - ledgerCosts(c.fin))}</dd>
      ${c.tier <= 4 ? (() => { const f = c.fin, inc = ledgerIncome(f), r = spendRolling(c, inc - (ledgerCosts(f) - f.build - f.acad), inc); return `<dt>Spending rule</dt><dd class="${r.ratio > SPEND_LIMIT ? "bad" : r.ratio > SPEND_LIMIT - .1 ? "warn" : "good"}" title="Losses over three seasons may not pass 35% of income. Stadium, training ground and academy spending don't count.">${Math.round(r.ratio * 100)}% of income lost so far (limit 35%)</dd>`; })() : ""}</dl></section>
    ${supportersCard(c)}
    ${G.obj && G.obj.y === G.year ? `<section class="card"><div class="card-h"><h3>Targets</h3><button class="lnk small" data-act="page" data-p="board">Board</button></div>${Object.keys(OBJ).filter(k => G.obj[k] && G.obj[k] !== "none").map(k => `<p class="small">${objLabel(k)}: ${objText(k, G.obj[k])}</p>`).join("") || "<p class='small muted'>None set.</p>"}</section>` : ""}
    <section class="card"><div class="card-h"><h3>Your staff</h3><button class="lnk small" data-act="page" data-p="staff">Staff</button></div>${["manager", "recruit", "youth"].map(r => { const s = staffOf(r); return `<div class="row between small" style="padding:4px 0"><span>${ROLES_STAFF[r].l}</span><span>${s ? `${esc(s.name)} · ${word(trustWord(s.trust))}` : `<span class="warn">Vacant</span>`}</span></div>`; }).join("")}</section>
  </div></div>`,
    news: () => `<div class="stack">
    <section class="card"><div class="card-h"><h2>News</h2></div><ul class="news">${G.news.slice(0, 25).map(n => `<li class="${n.hi ? "hi" : ""}">${esc(n.t)}<small>${n.y} · ${n.w}</small></li>`).join("")}</ul></section>
  </div>`,
  };
  return `${newSignCard()}${act ? `<div style="margin-bottom:14px">${inboxCard(true)}</div>` : ""}${tabs}${(panes[tab] || panes.today)()}`;
}
/* New signings made for you, at the top of the Office page until you've seen them: the deal and the player. */
function newSignCard() {
  const L = (G.newSign || []).filter(x => G.players[x.pid]); if (!L.length) return "";
  const c = my(), xi = new Set(pickXI(c).map(o => o.p.id)), BY = { recruit: "your head of recruitment", suggestion: "your head of recruitment, on your suggestion", "first refusal": "first refusal from a feeder", partner: "a partner club deal", emergency: "an emergency signing" };
  return `<section class="card" style="margin-bottom:14px;border-left:4px solid var(--accent)"><div class="card-h"><h2>New signing${L.length > 1 ? "s" : ""}</h2><button class="btn sm" data-act="signseen">Got it</button></div><div class="stack">${L.map(x => { const p = G.players[x.pid], est = ovrEstimate(p), arch = archetypeOf(p), starts = xi.has(p.id), pos = c.squad.map(P).filter(q => q.pos === p.pos && !q.acad && q.id !== p.id).sort((a, b) => b.ovr - a.ovr)[0];
    return `<div class="offer" style="display:block"><div class="row between"><span><span class="pos">${p.pos}</span> <button class="lnk" data-act="player" data-id="${p.id}"><b>${esc(p.name)}</b></button>${wkChip(p)}</span><span class="small muted">${esc(x.w)}</span></div>
      <p class="small" style="margin-top:4px">${POS_NAME[p.pos]}${arch ? ` · ${esc(arch[0])}` : ""} · ${p.age} · ${esc(NAT_NAME[p.nat] || p.nat)}</p>
      <dl class="ledger" style="margin-top:6px">
        <dt>Rating</dt><dd>${range(est)}</dd><dt>Potential</dt><dd>${range(potEstimate(p))}</dd>
        <dt>From</dt><dd class="t">${esc(x.from)}${x.fromId != null && CL(x.fromId) ? ` <span class="muted">(${esc(CL(x.fromId).abroad ? COUNTRY[CL(x.fromId).country].name : LEAGUES[CL(x.fromId).lg].name)})</span>` : ""}</dd>
        <dt>Fee</dt><dd>${x.fee ? money(x.fee) : "Free transfer"}</dd><dt>Wage</dt><dd>${pw(x.wage)}</dd><dt>Contract</dt><dd>${p.yrs} year${p.yrs === 1 ? "" : "s"}</dd>
        <dt>Value</dt><dd>${money(valueOf(p))}</dd>
        <dt>${x.statL || "Last season"}</dt><dd class="t">${x.lastApp} games, ${x.lastG} goal${x.lastG === 1 ? "" : "s"}, ${x.lastA} assist${x.lastA === 1 ? "" : "s"}</dd>
        <dt>Signed by</dt><dd class="t">${esc(x.rec && (x.by === "recruit" || x.by === "suggestion") ? `${x.rec} (${BY[x.by] || x.by})` : BY[x.by] || x.by)}</dd>
        <dt>In the side?</dt><dd class="t">${starts ? `<span class="good">Straight into the first team</span>` : pos ? `Behind ${esc(pos.name)} (${r20(pos.ovr)}) for now` : "Squad player"}</dd></dl></div>`; }).join("")}</div></section>`;
}
const fitText = f => f >= .35 ? `<span class="good">great</span>` : f >= .1 ? `<span class="good">good</span>` : f > -.1 ? "average" : f > -.35 ? `<span class="warn">poor</span>` : `<span class="bad">very poor</span>`;
function inboxCard(urgent) {
  // Decisions first, then recent news items.
  const m = G.inbox.filter(x => !x.done && (x.type === "bid" || x.type === "war" || x.type === "choice" || x.age < 4)).sort((a, b) => (b.type === "war" ? 2 : b.type === "bid" || b.type === "choice" ? 1 : 0) - (a.type === "war" ? 2 : a.type === "bid" || a.type === "choice" ? 1 : 0)).slice(0, 8);
  if (!m.length) return "";
  const n = m.filter(x => x.type === "bid" || x.type === "war" || x.type === "choice").length;
  return `<section class="card summary"><div class="card-h"><h2>Inbox</h2>${urgent ? `<span class="chip req">${n} to decide</span>` : ""}</div><div class="stack">${m.map(x => {
    if (x.type === "choice") return choiceHTML(x);
    if (x.type === "bid") { const p = G.players[x.pid]; if (!p) return ""; const s = staffOf("recruit");
      return `<div class="decision"><b>${esc(x.title)}</b>${myPlayerLine(p)}${x.pre ? `<p class="small warn">The window is shut: accept and he stays with you until it opens, then joins them.</p>` : ""}<p class="small">${POS_NAME[p.pos]}, ${p.age}. Valued at about ${money(valueOf(p))}. ${s ? esc(s.name) : "Your staff"} advise${s ? "s" : ""} you to <b>${x.rec}</b>. If you don't answer this week, ${s ? pr(s, "he") : "they"} will.${x.keen ? ` <b>${esc(p.name.split(" ")[0])} wants the move:</b> turn it down without a better contract and he'll be unsettled for a while.` : ""}</p>
        <div class="row" style="margin-top:6px;flex-wrap:nowrap"><span class="money-in"><span>€</span><input type="text" inputmode="decimal" class="num-in" id="ctr${x.id}" value="${fmtNum(Math.round(Math.max(x.amt * 1.25, valueOf(p)) / 1000) * 1000)}" aria-label="Counter-offer"></span><button class="btn sm" data-act="bidctr" data-id="${x.id}" ${x.final ? "disabled" : ""}>Counter</button></div>
        ${BID_SAY && BID_SAY.id === x.id ? `<p class="small warn" style="margin-top:4px">${esc(BID_SAY.t)}</p>` : x.final ? `<p class="small muted" style="margin-top:4px">They say this is their final offer.</p>` : ""}
        <div class="row" style="margin-top:6px"><button class="btn sm" data-act="bid" data-id="${x.id}" data-v="1">Accept</button><button class="btn sm" data-act="bid" data-id="${x.id}" data-v="0">Reject</button>${x.keen && p.dealY !== G.year ? `<button class="btn sm" data-act="bid" data-id="${x.id}" data-v="2">Reject and offer a new deal (${pw(newDealWage(p))})</button>` : ""}<button class="btn sm" data-act="player" data-id="${p.id}">View player</button></div></div>`; }
    if (x.type === "war") { const p = G.players[x.pid]; if (!p) return ""; const T = warTop(x);
      return `<div class="decision"><b>${esc(x.title)}</b>${myPlayerLine(p)}<p class="small">${POS_NAME[p.pos]}, ${p.age}, valued at about ${money(valueOf(p))}. You accepted an offer, and now others want him too. If you don't decide within two weeks he goes to the highest bidder.</p>
        ${x.bids.map(b => `<div class="row between small" style="padding:2px 0"><span>${esc(clubLabel(CL(b.id)))}</span><b class="num ${b === T ? "good" : ""}">${b.out ? '<span class="muted">dropped out</span>' : money(b.amt)}</b></div>`).join("")}
        <div class="row" style="margin-top:6px"><button class="btn sm primary" data-act="war" data-id="${x.id}" data-v="sell">Sell to ${esc(CL(T.id).name)} for ${money(T.amt)}</button>${x.final ? "" : `<button class="btn sm" data-act="war" data-id="${x.id}" data-v="raise">Ask for best and final offers</button>`}<button class="btn sm" data-act="war" data-id="${x.id}" data-v="keep">Keep him</button></div></div>`; }
    if (x.type === "objectives" && !x.rows) oldObjRows(x);  // a report written before reports were laid out
    return `<div class="decision"><b>${esc(x.title)}</b>${x.rows ? msgRows(x) : `<p class="small">${esc(x.body || "")}</p>`}${x.go ? `<button class="btn sm" data-act="page" data-p="${x.go}" style="margin-top:6px">${esc(x.goL || "Go")}</button>` : ""}${x.pid && G.players[x.pid] ? `<button class="btn sm" data-act="player" data-id="${x.pid}" style="margin-top:6px">View</button>` : ""}</div>`;
  }).join("")}</div></section>`;
}
function resultsList(rs) {
  return `<ul class="results">${rs.map(r => { const o = CL(r.opp), mine = r.ev.filter(e => (e.side === 0) === (r.home || (r.comp === "PO" && !r.home && false)));
    const sc = r.ev.filter(e => r.home ? e.side === 0 : e.side === 1).map(e => esc(e.g.split(" ").slice(1).join(" ") || e.g) + " " + e.m + "'").join(", ");
    return `<li><span class="res ${r.res}">${r.res}</span> <b class="num">${r.gf}–${r.ga}</b>${r.pens ? " (pens)" : ""} ${r.home ? "v" : "at"} ${clubLink(o)} <span class="muted small">${r.label ? esc(r.label) : r.comp === "F" ? "Friendly" : r.comp === "PO" ? "Play-off" : "Wk " + (r.w + 1)}${r.crowd ? " · crowd " + r.crowd.toLocaleString("en-GB") : ""}${sc ? " · " + sc : ""}</span></li>`; }).join("")}</ul>`;
}
function miniTable(k) {
  const t = table(k), i = t.findIndex(r => r.id === G.club), from = clamp(i - 3, 0, Math.max(0, t.length - 8));
  return tableHTML(k, t.slice(from, from + 8), from, true);
}
function tableHTML(k, rows, off = 0, compact) {
  const L = LEAGUES[k], n = G.leagues[k].clubs.length;
  const zone = i => i < L.auto ? "z-up" : L.po && i + 1 >= L.po[0] && i + 1 <= L.po[1] ? "z-po" : i >= n - L.down ? "z-down" : "";
  return `<div class="tbl-wrap"><table class="lg"><thead><tr><th>#</th><th style="text-align:left">Club</th><th>P</th>${compact ? "" : "<th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th>"}<th>GD</th><th>Pts</th>${compact ? "" : "<th>Form</th>"}</tr></thead><tbody>
    ${rows.map((r, j) => { const i = j + off, c = CL(r.id); return `<tr class="${zone(i)} ${r.id === G.club ? "me" : ""}"><td class="num">${i + 1}</td><td style="text-align:left">${crest(c, 14)} ${clubLink(c)}</td><td class="num">${r.p}</td>${compact ? "" : `<td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${r.gf}</td><td class="num">${r.ga}</td>`}<td class="num">${r.gf - r.ga}</td><td class="num"><b>${r.pts}</b>${c.ded && G.phase === "season" ? `<span class="bad" title="Points deducted" style="font-size:.75em"> −${c.ded}</span>` : ""}</td>${compact ? "" : `<td>${r.form.map(f => `<span class="res ${f}">${f}</span>`).join("")}</td>`}</tr>`; }).join("")}</tbody></table></div>`;
}

/* ---------- Squad ---------- */
function pgSquad() {
  const c = my(), tab = SUB.squad || "first", xi = new Set(pickXI(c).map(o => o.p.id));
  // Tabs: the first team, the academy, and three lists: protected (kept or not for sale), transfer-listed, loan-listed.
  const SQT = { first: ["First team", p => !p.acad], acad: ["Academy", p => p.acad], prot: ["Protected", p => p.keep || p.nfs], tl: ["Transfer listed", p => p.list], ll: ["Loan listed", p => p.loanList], exp: ["Final year", p => !p.acad && !(p.loan && p.loan.to === c.id) && p.yrs <= 1] };
  // Players you've lent out live at their loan clubs: listed separately.
  const outList = (G.loanList || []).map(id => G.players[id]).filter(p => p && p.loan && p.loan.from === c.id);
  SQT.out = ["Loaned out", () => false];
  SQT.stats = ["Stats", p => !p.acad || (p.s.app || 0) > 0];
  const LS = loanSuggestions(c); SQT.sugloan = ["Suggested loans", p => LS.has(p.id)];
  const all = c.squad.map(P), ps = (tab === "out" ? outList : all.filter((SQT[tab] || SQT.first)[1])).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ovr - a.ovr);
  const potJudge = tab === "acad" ? (staffOf("youth") ? `${staffOf("youth").name}'s estimates` : "rough guesses: no youth manager") : (staffOf("manager") ? `${staffOf("manager").name}'s estimates` : "rough guesses: no manager");
  return `<section class="card"><div class="card-h"><h2>Squad</h2></div>
    <div class="chips" style="margin-bottom:12px">${Object.entries(SQT).map(([k, [l, f]]) => `<button data-act="sub" data-k="squad" data-v="${k}" aria-pressed="${tab === k}">${l} (${k === "out" ? outList.length : all.filter(f).length})</button>`).join("")}</div>
    <p class="small muted" style="margin-bottom:10px">The manager picks the side; players marked XI are his current first choices. Ratings are out of 20: about ${r20(TIER_LVL[c.tier])} is a typical starter in your division. The Regional League and National North/South are mostly 1–5, the National Division 3–7, the Third Division 5–9, the Second 6–10, the First 9–13 and the Premier Division 12–20; 18–19 is world class and 20 a once-in-a-generation player. Potential shows ${potJudge}. Tap a player to sell, release or protect him.</p>
    ${tab === "exp" ? `<p class="small" style="margin-bottom:10px">Their contracts end this summer. Your head of recruitment renews the ones he wants (the best 18 seniors, if the wage budget allows) and lets the rest go. <b>Tick Renew</b> to keep a player and make sure he's offered a new deal (it also protects him, KP); he can still turn it down if he's unhappy.</p>` : ""}
    ${tab === "first" ? (() => { const n = regList(c).length, out = ps.filter(p => !isReg(p, c)).length; return `<p class="small" style="margin-bottom:10px"><b>Registered: ${n} of ${REG_MAX}</b>${out ? ` · <span class="bad">${out} not registered (can't play)</span>` : ""} · under-21s don't need registering. ${windowOpen() ? "Tick or untick in the Reg. column while the window is open." : "The list can change in the next transfer window."}</p>
      <label class="small" style="display:block;margin:-4px 0 10px"><input type="checkbox" data-act="autoreg" ${autoRegOn() ? "checked" : ""}> Automatically register the best 25 (by rating) while a window is open</label>`; })() : ""}
    ${tab === "acad" && ps.length ? (() => { for (const id of [...ASEL]) if (!ps.some(p => p.id === id)) ASEL.delete(id); const n = ASEL.size;
      return `<div class="bulk"><button class="btn sm" data-act="aselall">${n === ps.length ? "Clear all" : "Select all"}</button><span class="small muted">${n ? `${n} selected` : "Tick players to act on several at once."}</span>
        ${n ? `<span class="row" style="flex-wrap:wrap;gap:6px"><button class="btn sm" data-act="abulk" data-v="keep">Keep</button><button class="btn sm" data-act="abulk" data-v="unkeep">Don't keep</button><button class="btn sm" data-act="abulk" data-v="promote">Pro contract</button><button class="btn sm danger" data-act="abulk" data-v="release">Release</button></span>` : ""}</div>`; })() : ""}
    ${ps.length && tab === "sugloan" ? loanSuggestTable(c, ps, LS) : tab === "sugloan" ? `<p class="muted">No young player with that kind of potential is short of games right now.</p>` : ps.length && tab === "stats" ? squadStats(c, ps, xi) : ps.length ? `${sortTable("squad-" + tab, [
      // Final year: tick to keep him and offer a new deal when his contract ends.
      ...(tab === "exp" ? [{ k: "renew", l: "Renew", v: p => p.keep ? 1 : 0, f: p => `<input type="checkbox" data-act="renewtick" data-id="${p.id}" ${p.keep ? "checked" : ""} aria-label="Keep and renew ${esc(p.name)}">` }] : []),
      ...(tab === "acad" ? [{ k: "sel", l: "✓", f: p => `<input type="checkbox" data-act="asel" data-id="${p.id}" ${ASEL.has(p.id) ? "checked" : ""} aria-label="Select ${esc(p.name)}">` }] : []),
      { k: "name", l: "Player", left: true, v: p => p.name, f: p => `<button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button>${wkChip(p)} ${xi.has(p.id) ? '<span class="chip xi" title="First-choice XI">XI</span>' : ""}${p.inj ? `<span class="chip inj">${p.inj}w</span>` : ""}${p.unsettled > 0 ? '<span class="chip sus" title="Unsettled">UNS</span>' : ""}${p.req ? '<span class="chip req" title="Has asked to leave">OUT</span>' : ""}${p.agreed && CL(p.agreed.club) ? `<span class="chip req" title="Sold: joins ${esc(CL(p.agreed.club).name)} when the window opens">SOLD</span>` : ""}${!p.acad && !isReg(p, c) && !(p.loan && p.loan.from === c.id) ? '<span class="chip inj" title="Not registered: cannot play">NR</span>' : ""}${p.force ? '<span class="chip sus" title="Your pick: the manager must start him">OP</span>' : ""}${p.keep ? '<span class="chip list" title="Protected: kept and renewed">KP</span>' : ""}${p.nfs ? '<span class="chip xi" title="Not for sale">NFS</span>' : ""}${p.list ? '<span class="chip req" title="Transfer-listed">TL</span>' : ""}${p.loanList ? '<span class="chip hg" title="Available for loan">LL</span>' : ""}${favChip(p, c.id, true)}${p.loan ? '<span class="chip hg" title="On loan here">LN</span>' : ""}${p.nat !== "ENG" ? ` <span class="muted small">${esc(NAT_NAME[p.nat] || p.nat)}</span>` : ""}<br><span class="small muted">${esc((archetypeOf(p) || [""])[0])}</span>` },
      { k: "pos", l: "Pos", v: p => POS.indexOf(p.pos) * 1000 - p.ovr, f: p => `<span class="pos">${p.pos}</span>` },
      { k: "age", l: "Age", r: true, v: p => p.age, f: p => p.age },
      { k: "ovr", l: "Rating", v: p => p.ovr, f: p => rating(p.ovr) + ratingMove(p) },
      ...(tab === "out" ? [{ k: "at", l: "On loan at", left: true, v: p => CL(p.club).name, f: p => `<span class="small">${esc(CL(p.club).name)}</span><br><span class="small muted">you pay ${Math.round((1 - p.loan.share) * 100)}%</span>` },
        { k: "recall", l: "", f: p => `<button class="btn sm" data-act="recall" data-id="${p.id}">Recall</button>` }] : []),
      ...(tab !== "acad" && tab !== "out" ? [{ k: "reg", l: "Reg.", v: p => regExempt(p) ? 1 : isReg(p, c) ? 2 : 0, f: p => regExempt(p) ? `<span class="small muted">U21</span>` : `<input type="checkbox" data-act="reg" data-id="${p.id}" ${isReg(p, c) ? "checked" : ""} ${windowOpen() ? "" : "disabled"} aria-label="Registered">` }] : []),
      { k: "pot", l: "Potential", v: p => potEstimate(p)[1], f: p => range(potEstimate(p)) },
      { k: "app", l: "Apps", r: true, v: p => p.s.app, f: p => p.s.sub ? `${p.s.app - p.s.sub}<span class="small muted"> (${p.s.sub})</span>` : p.s.app },
      { k: "fit", l: "Fit", r: true, v: p => p.fit ?? 100, f: p => { const f = Math.round(p.fit ?? 100); return `<span class="small ${f < 70 ? "bad" : f < 85 ? "warn" : ""}">${f}%</span>`; } },
      { k: "g", l: "Gls", r: true, v: p => p.s.g, f: p => p.s.g },
      // A loanee: what you pay (your share), with his full wage and the share underneath.
      { k: "wage", l: "Wage", r: true, v: p => myWage(p), f: p => p.loan && p.loan.to === c.id ? `${pw(myWage(p))}<br><span class="small muted">${Math.round(p.loan.share * 100)}% of ${pw(p.wage)}</span>` : pw(p.wage) },
      { k: "yrs", l: "Contract", r: true, v: p => p.acad ? 99 : p.yrs, f: p => p.acad ? "Youth" : p.yrs + "y" },
      { k: "val", l: "Value", r: true, v: p => valueOf(p), f: p => money(valueOf(p)) },
    ], ps, { sort: { k: "pos", d: 1 } })}
    ${tab !== "acad" ? `<p class="small muted" style="margin-top:8px">XI first choice · OP your pick (he must start) · apps (sub apps) · Fit: sharpness, below about 85% the manager rests him · KP protected · NFS not for sale · TL transfer-listed · LL available for loan · LN on loan here · OUT wants to leave · UNS unsettled · NR not registered · FAV fan favourite · LEG legend · 3w injured for 3 weeks</p>` : ""}
    ${tab === "first" && (G.loanList || []).some(id => G.players[id] && G.players[id].loan && G.players[id].loan.from === c.id) ? `<h3 style="margin:14px 0 6px">Out on loan</h3>${(G.loanList || []).map(id => G.players[id]).filter(p => p && p.loan && p.loan.from === c.id).map(p => `<p class="small"><button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button> (${p.pos}, ${r20(p.ovr)}) at ${esc(CL(p.club).name)}: ${p.s.app} games · you still pay ${pw(p.wage * (1 - p.loan.share))}${p.loan.share >= 1 ? "" : ` (${Math.round((1 - p.loan.share) * 100)}%)`}</p>`).join("")}` : ""}`
    : `<p class="muted">${tab === "acad" ? (c.fac.acad.lvl ? "The academy's first intake arrives in the summer." : "No academy yet. Build one on the Facilities page.") : tab === "prot" ? "Nobody is protected or marked not for sale. Do it from a player's card." : tab === "tl" ? "Nobody is on the transfer list." : tab === "ll" ? "Nobody is available for loan. Make a player available from his card." : tab === "exp" ? "Nobody is in the last year of his contract." : tab === "out" ? "Nobody is out on loan." : "No players."}</p>`}</section>`;
}
/* Progression on a player's card: a row a season (newest first, this season so far on top) and a small line of his
   rating. Potential is shown only for your own players, as your staff estimate it now. */
/* Career by club: games, goals and assists for each club he's played for since records began (earlier career, before
   this was kept, shows as one line), career totals, and his best season from the progression rows. */
function careerHTML(p) {
  const cs = p.cs || {}, ids = Object.keys(cs).map(Number).sort((a, b) => cs[b][0] - cs[a][0]);
  const tracked = ids.reduce((t, id) => [t[0] + cs[id][0], t[1] + cs[id][1], t[2] + cs[id][2]], [0, 0, 0]);
  const totApps = p.tot[0] + p.s.app, totG = p.tot[1] + p.s.g, early = [Math.max(0, totApps - tracked[0]), Math.max(0, totG - tracked[1])];
  if (!ids.length && !totApps) return "";
  const best = [...(p.prog || []), [G.year, p.age, p.ovr, "", p.s.app, p.s.g, p.s.a]].filter(r => r[4] >= 5).sort((a, b) => (b[5] + b[6] * .5) - (a[5] + a[6] * .5) || b[4] - a[4])[0];
  const nm = id => { const x = CL(id); return x ? `${esc(x.name)}${x.abroad ? ` <span class="muted">(${esc(COUNTRY[x.country].name)})</span>` : ""}` : "A former club"; };
  return `<details class="prog" open><summary class="small"><b>Career</b></summary>
    <div class="tbl-wrap"><table class="sq"><thead><tr><th style="text-align:left">Club</th><th>Apps</th><th>Gls</th><th>Ast</th></tr></thead><tbody>
    ${ids.map(id => `<tr><td style="text-align:left" class="small">${nm(id)}${id === p.club ? ' <span class="muted">· now</span>' : ""}</td><td>${cs[id][0]}</td><td>${cs[id][1]}</td><td>${cs[id][2]}</td></tr>`).join("")}
    ${early[0] ? `<tr><td style="text-align:left" class="small muted">Earlier career${p.hist && p.hist.length ? ` (${[...new Set(p.hist.map(h => h[1]))].slice(0, 4).map(esc).join(", ")})` : ""}</td><td>${early[0]}</td><td>${early[1]}</td><td>—</td></tr>` : ""}
    <tr class="tot"><td style="text-align:left"><b>Career</b></td><td><b>${totApps}</b></td><td><b>${totG}</b></td><td><b>${tracked[2]}</b></td></tr>
    </tbody></table></div>
    ${best ? `<p class="small" style="margin-top:4px"><b>Best season:</b> ${best[0] === G.year && best[4] === p.s.app ? "this season" : seasonLabel(best[0])}, ${best[5]} goal${best[5] === 1 ? "" : "s"} and ${best[6]} assist${best[6] === 1 ? "" : "s"} in ${best[4]} games${best[3] ? ` for ${esc(best[3])}` : ""}.</p>` : ""}</details>`;
}
/* Transfer history: each move since 0.74 with its fee (earlier moves are listed from his clubs, fees not kept). */
function transfersHTML(p) {
  const T = (p.tx || []).slice().reverse(), nm = id => id === -1 ? "Free agency" : id === -2 ? "Abroad" : CL(id) ? `${esc(CL(id).name)}${CL(id).abroad ? ` <span class="muted">(${esc(COUNTRY[CL(id).country].name)})</span>` : ""}` : "A former club";
  const earlier = (p.hist || []).filter(h => !T.some(t => t[0] === h[0])).map(h => `${h[0]} ${esc(h[1])}`);
  if (!T.length && (p.hist || []).length < 2) return "";
  return `<details class="prog" open><summary class="small"><b>Transfer history</b></summary>
    ${T.length ? `<div class="tbl-wrap"><table class="sq"><thead><tr><th style="text-align:left">When</th><th style="text-align:left">From</th><th style="text-align:left">To</th><th>Fee</th></tr></thead><tbody>
    ${T.map(t => `<tr><td style="text-align:left" class="small">${seasonLabel(t[0])}<br><span class="muted">${t[1] ? "season" : "summer"}</span></td><td style="text-align:left" class="small">${nm(t[2])}</td><td style="text-align:left" class="small">${nm(t[3])}</td><td class="small">${t[4] ? money(t[4]) : "Free"}</td></tr>`).join("")}
    </tbody></table></div>` : ""}${earlier.length > (T.length ? 0 : 1) ? `<p class="small muted" style="margin-top:4px">Earlier clubs (fees not recorded): ${earlier.join(" · ")}</p>` : ""}</details>`;
}
// A season before wages were kept: at your club, read it from his pay history (the last change up to that season).
const pastPay = (p, r) => { const L = p.payLog || []; if (!L.length || r[3] !== my().short) return 0; const e = L.find(x => x.y <= r[0]); return e ? e.to : L[L.length - 1].from || 0; };
function progressionHTML(p, mine, exact) {
  const now = [G.year, p.age, p.ovr, p.club >= 0 ? CL(p.club).short : p.club === -2 ? "ABR" : "FA", p.s.app, p.s.g, p.s.a, p.pot, true, p.club === -1 ? 0 : p.wage];
  const rows = [now, ...(p.prog || []).slice().reverse()];
  if (rows.length < 2 && !p.s.app) return "";
  const pts = rows.slice().reverse().map(r => to20(r[2])), w = 220, h = 46, lo = Math.max(1, Math.floor(Math.min(...pts)) - 1), hi = Math.min(20, Math.ceil(Math.max(...pts)) + 1);
  const xy = pts.map((v, i) => [pts.length === 1 ? w / 2 : 6 + i * (w - 12) / (pts.length - 1), h - 6 - (v - lo) / Math.max(1, hi - lo) * (h - 12)]);
  const spark = exact && pts.length > 1 ? `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Rating by season"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${xy.map(q => q.map(n => n.toFixed(1)).join(",")).join(" ")}"/>${xy.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="var(--accent)"/>`).join("")}<text x="2" y="10" font-size="9" fill="var(--muted)">${hi}</text><text x="2" y="${h - 2}" font-size="9" fill="var(--muted)">${lo}</text></svg>` : "";
  return `<details class="prog" ${mine ? "open" : ""}><summary class="small"><b>Progression</b></summary>${spark}
    <div class="tbl-wrap"><table class="sq"><thead><tr><th style="text-align:left">Season</th><th>Age</th><th style="text-align:left">Club</th>${exact ? "<th>Rating</th>" : ""}<th>Apps</th><th>Gls</th><th>Ast</th><th>Wage</th></tr></thead><tbody>
    ${rows.map((r, i) => { const prev = rows[i + 1], d = prev ? r20(r[2]) - r20(prev[2]) : 0;
      return `<tr><td style="text-align:left" class="small">${r[8] ? "Now" : seasonLabel(r[0])}</td><td>${r[1]}</td><td style="text-align:left" class="small">${esc(r[3])}</td>${exact ? `<td>${r20(r[2])}${d ? ` <span class="small ${d > 0 ? "good" : "bad"}">${d > 0 ? "▲" : "▼"}${Math.abs(d)}</span>` : ""}</td>` : ""}<td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td class="small" style="white-space:nowrap">${r[9] ? pw(r[9]) : pastPay(p, r) ? pw(pastPay(p, r)) : "—"}</td></tr>`; }).join("")}
    </tbody></table></div>${exact ? "" : `<p class="small muted">Ratings aren't known for players outside your league.</p>`}</details>`;
}
function playerModal(id) {
  const p = G.players[id]; if (!p) return;
  const mine = p.club === G.club, lentOut = !!(p.loan && p.loan.from === G.club), c = p.club >= 0 ? CL(p.club) : null, est = lentOut ? [p.ovr, p.ovr] : ovrEstimate(p);
  const keys = keysOf(p.pos).slice().sort((a, b) => (POS_W[p.pos][b] || 0) - (POS_W[p.pos][a] || 0));
  const exact = mine || lentOut || (c && c.lg === my().lg);
  const attrs = keys.map(k => `<div class="attr-r"><span>${ATTR[k]}${POS_W[p.pos][k] ? " ★" : ""}</span>${exact ? attr20(p.at[k]) : `<span class="muted small">not scouted</span>`}</div>`).join("");
  let acts = "";
  if (lentOut) acts = `<div class="sugg"><b class="small">On loan at ${esc(c.name)} until the end of the season</b><p class="small muted">${p.s.app} games there this season. You pay ${Math.round((1 - p.loan.share) * 100)}% of his wages (${pw(p.wage * (1 - p.loan.share))}).</p><div class="row" style="margin-top:6px"><button class="btn sm" data-act="recall" data-id="${p.id}">Recall him${recallFee(p) ? ` (${money(recallFee(p))})` : ""}</button></div></div>`;
  else if (mine) {
    acts = `${!p.acad && !(p.loan && p.loan.from === G.club) ? `<div class="row" style="margin-bottom:6px"><button class="btn" data-act="force" data-id="${p.id}">${p.force ? "Let the manager decide" : "Insist he starts"}</button><span class="small muted">${p.force ? "Your pick: he starts whenever he's fit and registered." : staffOf("manager") ? `${esc(staffOf("manager").name)} and a hands-on owner: ${word(tolWord(staffOf("manager")))}.` : ""}</span></div>` : ""}<div class="row"><button class="btn" data-act="keep" data-id="${p.id}">${p.keep ? "Remove protection" : "Protect (keep and renew)"}</button>${p.acad || p.loan ? "" : `<button class="btn" data-act="nfs" data-id="${p.id}">${p.nfs ? "Make available" : "Not for sale"}</button>`}
      ${p.acad && staffOf("youth") ? `<p class="small" style="flex-basis:100%"><b>${esc(staffOf("youth").name)}:</b> ${youthRates(p) ? (youthReady(p) ? '<span class="good">rates him and thinks he\'s ready for a pro contract</span>' : '<span class="good">rates him: keep him, but he isn\'t ready yet</span>') : '<span class="muted">would let him go when he comes of age</span>'}.</p>` : ""}
      ${p.acad ? `<button class="btn" data-act="promote" data-id="${p.id}">Offer a professional contract</button><button class="btn danger" data-act="release" data-id="${p.id}">Release from academy</button>` :
      `${net().feeders.length && !p.loan ? `<select data-act="loanout" data-id="${p.id}"><option value="">Loan to a feeder (he's rated ${r20(p.ovr)})…</option>${net().feeders.map(f => `<option value="${f.id}">${esc(CL(f.id).name)} · team average ${teamAvg(CL(f.id))} (division ${divAvg(CL(f.id))})${p.age <= 27 && p.pot > p.ovr ? (challengeF(p, CL(f.id)) < 1 ? ` · too easy: grows ${Math.round((1 - challengeF(p, CL(f.id))) * 100)}% slower` : " · a good test") : ""}</option>`).join("")}</select>` : ""}${p.loan ? `<span class="small muted">On loan from ${esc(CL(p.loan.from).name)}</span>` : `<button class="btn" data-act="loanlist" data-id="${p.id}">${p.loanList ? "Take off the loan list" : "Make available for loan"}</button>${canSell(p) ? `<button class="btn" data-act="list" data-id="${p.id}">${p.list ? "Take off the transfer list" : "Put on the transfer list"}</button>` : `<span class="small muted">Signed in this window: he can't be sold until it closes.</span>`}<button class="btn danger" data-act="release" data-id="${p.id}">Release (${money(releaseCost(p))})</button>`}`}</div>
      ${p.loan && p.loan.to === G.club && p.loan.redo && playerLoanTerms(p, CL(p.loan.from)).min >= p.loan.share ? `<div class="sugg"><b class="small">His loan terms</b><p class="small good">${esc(CL(p.loan.from).name)} would want at least ${Math.round(playerLoanTerms(p, CL(p.loan.from)).min * 100)}% of his wages for a new loan: your ${Math.round(p.loan.share * 100)}% is already a better deal, so there's nothing to renegotiate.</p></div>` : ""}
      ${p.loan && p.loan.to === G.club && p.loan.redo && playerLoanTerms(p, CL(p.loan.from)).min < p.loan.share ? `<div class="sugg"><b class="small">Renegotiate his loan</b><p class="small muted">This loan was agreed before wage shares could be negotiated: you pay ${Math.round(p.loan.share * 100)}% of his wages. You have one chance to ask ${esc(CL(p.loan.from).name)} for a better split.</p>
        <div class="row" style="margin-top:6px"><label class="small">You pay <select id="rshare">${[0, 10, 20, 30, 40].filter(v => v < p.loan.share * 100).map(v => `<option value="${v}" ${v === (p.lt && p.lt.tries ? Math.round(p.lt.min * 100) : 30) ? "selected" : ""}>${v}% · ${pw(p.wage * v / 100)}</option>`).join("")}</select></label><button class="btn sm" data-act="loanredo" data-id="${p.id}">Ask</button></div>
        ${LOAN_SAY && LOAN_SAY.id === p.id ? `<p class="small warn">${esc(LOAN_SAY.t)}</p>` : ""}</div>` : ""}
      <p class="small muted">Players are only sold when a club makes an offer. Transfer-listed players attract offers while a window is open, usually below their value; they arrive in your inbox with your head of recruitment's advice. Listing a player yourself goes over his head, and the manager won't like losing a first-choice player. Protected players are never sold by your staff and are offered new contracts. Players on the loan list draw loan offers from clubs at their level while a window is open. Players marked not for sale only draw huge bids (two to five times their value), and one who's outgrown the club or is underpaid may resent it.</p>`;
  } else {
    const fee = askingFee(p), wage = playerAsk(p), ok = willJoin(p, my()) && wage != null;
    const lendable = loanable(p) && lendsTo(p) && loansOpen() && !inTheirXI(p), T = lendable ? playerLoanTerms(p) : null;
    const said = LOAN_SAY && LOAN_SAY.id === p.id ? LOAN_SAY.t : "", pick0 = T ? Math.round(T.min * 10) * 10 : 50;
    acts = p.toMe ? `<div class="sugg"><b class="small good">Agreed: he joins you when the window opens</b><p class="small muted">${p.toMe.fee ? `${money(p.toMe.fee)} to ${esc(fromName(p))}, paid then` : "On a free"}; he'll earn ${pw(p.toMe.wage)}.</p><div class="row" style="margin-top:6px"><button class="btn sm danger" data-act="unagree" data-id="${p.id}">Pull out of the deal</button></div></div>` : `${p.club !== G.club ? weakestStarterLine(p.id) : ""}${p.club >= 0 && p.yrs <= 1 && !CL(p.club).gone || (p.club >= 0 && CL(p.club).abroad && p.yrs <= 1) ? `<p class="small ${renewsAI(p) ? "muted" : "good"}" style="margin-bottom:6px">Last year of his contract: ${renewsAI(p) ? "he's expected to sign a new one there." : `<b>he isn't expected to re-sign</b>, so ${esc(CL(p.club).name)} would rather take a lower fee now than lose him for nothing.`}</p>` : ""}<div class="row"><button class="btn primary" data-act="buy" data-id="${p.id}" ${ok ? "" : "disabled"}>Make an offer</button><span class="small muted">${ok ? `Asking fee about ${fee ? money(fee) : "nothing (free agent)"}; he'd want about ${pw(wage)}.${keenToJoin(p) && wage < demandWage(p, my()) * .95 ? ` <span class="good">He really wants to come: he'd take less than his going rate (${pw(demandWage(p, my()))}).</span>` : keenToJoin(p) ? ` <span class="muted">He's keen, but won't take much less than he earns now.</span>` : ""}` : "He isn't interested in joining, whatever the money."}</span></div>
      ${!lendable && loanable(p) && lendsTo(p) && !loansOpen() && !inTheirXI(p) ? `<p class="small muted">${esc(CL(p.club).name)} would lend him, but loans can only be agreed while a transfer window is open.</p>` : ""}
      ${lendable ? `<div class="sugg"><b class="small">Borrow him to the end of the season</b>${T && T.no ? `<p class="small muted">${esc(said || `${CL(p.club).name} won't lend him to you this window.`)}</p>` : `
        <div class="row" style="margin-top:6px"><label class="small">You pay <select id="lshare">${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => `<option value="${v}" ${v === pick0 ? "selected" : ""}>${v}% · ${pw(p.wage * v / 100)}</option>`).join("")}</select></label><button class="btn sm" data-act="loanask" data-id="${p.id}">Ask</button></div>
        <p class="small ${said ? "warn" : "muted"}">${esc(said || `${CL(p.club).name} want you to pay ${pw(loanPay(p) ?? 0)}.`)}</p>`}</div>` : ""}
      ${(() => { const s = staffOf("recruit"); if (!s) return `<p class="small muted">Hire a head of recruitment and you can suggest players to them.</p>`; const on = suggested(p), canLoan = loanable(p), v = suggView(p, my(), false), vl = canLoan ? suggView(p, my(), true) : null;
        const cls = x => x.ok ? "good" : x.money ? "warn" : x.wait ? "" : "muted";
        return `<div class="sugg"><b class="small">${on ? `You've suggested ${on.loan ? "borrowing" : "signing"} him` : "Suggest him to your head of recruitment"}</b>
          <div class="row" style="margin-top:6px"><button class="btn sm" data-act="suggest" data-id="${p.id}">${on && !on.loan ? "Withdraw" : "Suggest signing"}</button>${canLoan ? `<button class="btn sm" data-act="suggest" data-id="${p.id}" data-loan="1">${on && on.loan ? "Withdraw" : "Suggest a loan"}</button>` : ""}</div>
          <p class="small ${cls(v)}"><b>${esc(s.name)}${canLoan ? " on signing" : ""}:</b> ${esc(v.w)}</p>${vl ? `<p class="small ${cls(vl)}"><b>On a loan:</b> ${esc(vl.w)}</p>` : ""}</div>`; })()}
      <details><summary class="small">What he's weighing up</summary>${factorBars(playerAppeal(p, wage || demandWage(p, my())), P_FACTORS)}</details>`;
  }
  modal(`<div class="modal-h" style="--mc:${c ? c.color : "var(--muted)"}"><div><p class="eyebrow">${POS_NAME[p.pos]} · ${p.age} · ${esc(NAT_NAME[p.nat] || p.nat)}</p><h2>${esc(p.name)}${wkChip(p)}${mine ? "" : ` <button class="fav-btn ${isFav(p.id) ? "on" : ""}" data-act="fav" data-id="${p.id}" aria-pressed="${isFav(p.id)}" title="${isFav(p.id) ? "Remove from favourites" : "Add to favourites"}">${isFav(p.id) ? "★" : "☆"}</button>`}</h2><p class="small muted">${archetypeOf(p) ? `<b class="arch">${esc(archetypeOf(p)[0])}</b> · ` : ""}${c ? esc(c.name) : p.club === -2 ? "Plays abroad" : "Free agent"}${p.acad ? " · academy" : ""}</p></div><button class="btn modal-x" data-act="close">✕</button></div>
    <div class="modal-b"><dl class="facts"><div><dt>Rating</dt><dd>${range(est)}</dd></div><div><dt>Potential (est.)</dt><dd>${range(potEstimate(p))}</dd></div><div><dt>Value</dt><dd>${money(valueOf(p))}</dd></div><div><dt>Wage</dt><dd>${pw(p.wage)}${p.loan && p.loan.to === G.club ? `<br><span class="small">you pay ${pw(myWage(p))} (${Math.round(p.loan.share * 100)}%)</span>` : p.loan && p.loan.from === G.club ? `<br><span class="small">you pay ${pw(p.wage * (1 - p.loan.share))} (${Math.round((1 - p.loan.share) * 100)}%)</span>` : ""}</dd></div><div><dt>Contract</dt><dd>${p.acad ? "Youth terms" : p.yrs ? p.yrs + " yr" : "—"}${mine && !p.acad && !(p.loan && p.loan.to === G.club) ? `<br><span class="small">+25% if promoted, −25% if relegated</span>` : ""}</dd></div><div><dt>Season</dt><dd>${p.s.app} apps, ${p.s.g} goals, ${p.s.a} assists</dd></div><div><dt>Career</dt><dd>${p.tot[0] + p.s.app} apps, ${p.tot[1] + p.s.g} goals</dd></div>${p.inj ? `<div><dt>Injured</dt><dd class="bad">${p.inj} weeks</dd></div>` : ""}</dl>
    <div class="attr-grid">${attrs}</div>${careerHTML(p)}${transfersHTML(p)}${progressionHTML(p, mine, mine || (c && c.lg === my().lg))}${acts}
    ${archetypeOf(p) ? `<p><b>${esc(archetypeOf(p)[0])}.</b> <span class="muted">${esc(archetypeOf(p)[2])}</span></p>` : ""}
    ${(() => { const pr = prefsOf(p, P_FACTORS), wm = wageMult(p, my()), h = homeOf(p), fit = systemFit(p);
      return `<p class="small"><b>What drives him:</b> ${personaOf(p).map(esc).join(" · ")}${h ? ` · from ${esc(h)}${h === my().region ? ' <span class="good">(your area)</span>' : ""}` : ""}.
        ${wm > 1.05 ? ` <span class="warn">He wants about ${Math.round((wm - 1) * 100)}% over the going rate${mine && (pr.top.includes("money") || wm > 1.1) ? ", and won't take a relegation pay cut quietly" : ""}.</span>` : wm < .95 ? ` <span class="good">He'd take about ${Math.round((1 - wm) * 100)}% less to play near home.</span>` : ""}
        ${mine && !p.acad ? (fit.slots === 0 ? ` <span class="bad">The manager's ${esc(mgr().form || "")} has no place for a ${POS_NAME[p.pos].toLowerCase()}.</span>` : fit.style < -.4 ? ` <span class="warn">The ${esc(STYLES[mgr().phil].l.toLowerCase())} style doesn't suit his game.</span>` : fit.style > .4 ? ` <span class="good">The ${esc(STYLES[mgr().phil].l.toLowerCase())} style suits him.</span>` : "") : ""}</p>`; })()}
    ${p.club >= 0 && p.age <= 27 && p.pot > p.ovr && challengeF(p) < 1 ? `<p class="small warn">Playing below his level (${CL(p.club).abroad ? `${esc(COUNTRY[CL(p.club).country].name)}'s league` : `the ${esc(LEAGUES[CL(p.club).lg].name)}`}, where the average starter is about ${Math.round(divLevel20(CL(p.club)))}): he's growing about ${Math.round((1 - challengeF(p)) * 100)}% slower than he would somewhere that tests him.</p>` : ""}
    ${formWord(seasonForm(p)) ? `<p class="small good">Coming off ${formWord(seasonForm(p))}: clubs are taking notice.</p>` : ""}
    ${(() => { const L = Object.entries(p.love || {}).filter(([, l]) => l >= FAV).map(([cid, l]) => `${l >= LEGEND ? "a legend" : "a fan favourite"} at ${esc(G.clubs[+cid] ? G.clubs[+cid].name : "a former club")}`); return L.length ? `<p class="small"><b>Supporters' view:</b> ${L.join("; ")}.</p>` : ""; })()}
    ${p.hist.length ? `<p class="small muted">Clubs: ${p.hist.map(h => `${h[0]} ${esc(h[1])}`).join(" · ")}</p>` : ""}</div>`);
}

/* ---------- Staff ---------- */
// A staff member's rating (his average, 1-20) beside his name, with his potential when he still has room to grow.
const staffBadge = s => { const a = sr20(staffAvg(s)), hi = sr20(staffPotRange(s)[1]), pt = staffPot20(s); return `<span class="srate" title="Rating ${a}${hi > a ? `, potential ${pt}` : ""}">${a}${hi > a ? `<small> → ${pt}</small>` : ""}</span>`; };
/* How a member of staff feels and why: the causes behind the trust figure, this season and last, and ways to put it
   right when the mood has soured. */
function staffMoodHTML(role, s) {
  const L = (s.tlog || []).filter(x => Math.abs(x.d) >= .05), M = s.mend || {}, low = s.trust < 55, B = s.tbase;
  const num = v => `<b class="num ${v < 0 ? "bad" : v > 0 ? "good" : "muted"}">${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}</b>`;
  const ys = [...new Set(L.map(x => x.y))].sort((a, b) => b - a);
  // From where he started to where he is now: the starting point, then every cause season by season (newest first).
  const season = y => { const R = L.filter(x => x.y === y).sort((a, b) => a.d - b.d), tot = sum(R, x => x.d);
    return `<div style="margin-top:6px"><div class="row between small"><span class="muted">${seasonLabel(y)}</span>${num(tot)}</div>${R.map(x => `<div class="row between small" style="padding:1px 0 1px 10px"><span>${esc(x.k)}${x.n > 1 ? ` <span class="muted">×${x.n}</span>` : ""}</span>${num(x.d)}</div>`).join("")}</div>`; };
  const btn = (how, l) => M[how] === G.year ? `<span class="small muted">${l}: done this season</span>` : `<button class="btn sm" data-act="mend" data-r="${role}" data-k="${how}">${l}</button>`;
  const forced = role === "manager" && (my().squad.some(id => P(id).force) || (G.depth && Object.keys(G.depth).length));
  const fix = `<div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap">${btn("talk", "Clear the air")}${s.expiring ? "" : btn("pay", `Pay rise (to ${pw(Math.round(s.wage * 1.1 / 100) * 100)})`)}${btn("promise", "Promise not to interfere this season")}${forced ? btn("hands", "Leave team selection to " + pr(s, "him")) : ""}</div>
    <p class="small muted" style="margin-top:4px">A talk helps most once the cause has stopped. Break a promise and it costs twice as much. Grudges also fade on their own: trust drifts back up toward 60 week by week.</p>`;
  if (!B && !L.length) return "";
  return `<details ${low ? "open" : ""} style="margin-top:8px"><summary class="small"><b>How ${pr(s, "he")} got to ${Math.round(s.trust)}</b>${low ? ` <span class="${s.trust < 40 ? "bad" : "warn"}">· ${s.trust < 40 ? "at risk of resigning below 20" : "uneasy"}</span>` : ""}</summary>
    ${B ? `<div class="row between small" style="margin-top:6px"><span>${esc(B.k)}</span><b class="num">${Math.round(B.t)}</b></div>` : ""}
    ${ys.map(season).join("")}
    <div class="row between small" style="margin-top:6px;border-top:1px solid var(--line);padding-top:4px"><b>Now</b><b class="num">${Math.round(s.trust)}</b></div>
    ${low ? fix : `<p class="small muted" style="margin-top:6px">${pr(s, "He")}'s settled: nothing needs putting right.</p>`}</details>`;
}
function staffCard(role) {
  const s = staffOf(role), R0 = ROLES_STAFF[role];
  if (!s) return `<section class="card"><div class="card-h"><h2>${R0.l}</h2><span class="warn">Vacant</span></div><p class="muted" style="margin-bottom:10px">${role === "manager" ? "Picks the team, sets the tactics, develops the players. Without one, the club captain does it badly." : role === "recruit" ? "Signs and sells players within your budgets, renews contracts, and advises you on bids." : "Runs the academy: the size and quality of each year's intake, and how the youngsters develop."}</p><button class="btn primary" data-act="cands" data-r="${role}">Find candidates</button></section>`;
  const ph = R0.phil[s.phil];
  return `<section class="card"><div class="card-h"><h2>${R0.l}</h2><span>${word(trustWord(s.trust))} <span class="muted small">trust ${Math.round(s.trust)}</span></span></div>
    <p class="lead"><b>${esc(s.name)}</b> ${staffBadge(s)}<span class="muted">, ${s.age}${partTime(s.rep) ? " · part-time" : ""}</span></p>
    <p style="margin:6px 0"><span class="chip list">${esc(ph.l)}</span> ${esc(ph.d)}</p><p class="small">${word(matchWord(visionMatch(s)))}</p>${exLine(s)}<p class="small"><b>Focus:</b> ${esc(R0.focus[s.focus])}${s.form ? ` · <b>Formation:</b> ${s.form}` : ""}${role === "manager" ? ` · <b>Rotation:</b> ${rotWord(s)} (${s20(rotOf(s))}/20)` : ""}</p>
    <div class="attr-grid" style="margin:10px 0">${Object.entries(R0.attrs).map(([k, l]) => { const d = s.prev ? sr20(s.at[k]) - sr20(s.prev[k]) : 0; return `<div class="attr-r"><span>${l}${d ? ` <span class="${d > 0 ? "good" : "bad"} small">${d > 0 ? "▲" : "▼"}${Math.abs(d)}</span>` : ""}</span>${staffR20(s.at[k])}</div>`; }).join("")}<div class="attr-r"><span>Hands-on owner – <span class="small ${tolWord(s)[1]}">${tolWord(s)[0]}</span></span>${staff20(tolOf(s))}</div>${s.role === "manager" ? `<div class="attr-r"><span>Rotation – <span class="small">${rotWord(s)}</span></span>${staff20(rotOf(s))}</div>` : ""}<div class="attr-r"><span>Potential <span class="small muted">(average ${pr(s, "he")} could reach, est.)</span></span>${bar(staffEq(staffPotRange(s)[1]))}<b class="num">${staffPot20(s)}</b></div></div>
    ${role === "manager" ? `<p class="small">${pr(s, "His")} style with this squad: ${fitText(styleFit(pickXI(my()), s.phil))}.</p>` : ""}
    <p class="small muted">${pw(s.wage)} · ${s.expiring ? `<span class="warn">contract expired</span>` : `${s.yrs} year${s.yrs > 1 ? "s" : ""} left`} · releasing ${pr(s, "him")} costs ${money(payoff(s))}</p>
    ${staffMoodHTML(role, s)}
    <div class="row" style="margin-top:10px">${s.expiring ? `<button class="btn primary" data-act="renewstaff" data-r="${role}">Renew 3 years${staffAsk(s) != null ? ` (${pw(Math.max(s.wage, staffAsk(s)))})` : ""}</button>` : ""}<button class="btn" data-act="cands" data-r="${role}">Look for a replacement</button><button class="btn danger" data-act="dismiss" data-r="${role}">Dismiss</button></div></section>`;
}
function pgStaff() {
  // Tabs: everyone at a glance, then one per member of staff with his card and his targets for the season.
  const tab = SUB.staff || "all", TABS = [["all", "Overview"], ...["manager", "recruit", "youth"].map(r => [r, ROLES_STAFF[r].l])];
  const tabs = `<div class="chips" style="margin-bottom:14px">${TABS.map(([k, l]) => `<button data-act="sub" data-k="staff" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>`;
  if (tab !== "all") return `${tabs}<div class="grid2"><div class="stack">${staffCard(tab)}</div><div class="stack">${staffTargetsCard(tab)}</div></div>`;
  return `${tabs}<p class="small muted" style="margin-bottom:12px">The job attracts staff of about reputation ${Math.round(attraction())} (division, facilities, and your fortune). Better people will come for more money; the very best won't drop this far at all. Trust falls when you overrule them or a season goes badly; below 20 they resign.</p>
    <div class="grid3">${staffCard("manager")}${staffCard("recruit")}${staffCard("youth")}</div>`;
}
/* What a player or coach is weighing up: each factor's weight to him (his top two starred) and how you score on it. */
function factorBars(a, factors, who) {
  return `<div class="factors">${factors.filter(([k]) => a.pr.pri[k] != null).map(([k, l]) => { const v = a.f[k], top = a.pr.top.includes(k);
    return `<div class="factor ${top ? "top" : ""}" title="${esc(FACTOR_HELP[k] || "")}"><span>${top ? "★ " : ""}${l}</span><span class="fbar"><i style="width:${Math.round(v * 100)}%;background:${v >= .6 ? "var(--win)" : v >= .4 ? "var(--accent)" : "var(--loss)"}"></i></span><span class="muted small num">${Math.round(a.pr.pri[k] * 100)}%</span></div>`; }).join("")}</div>
    <p class="small muted">★ what ${who ? pr(who, "he") : "he"} cares about most. The bar is how well your club does on it; the figure is how much it weighs with ${who ? pr(who, "him") : "him"}.</p>`;
}
let CANDS = null, LOAN_SAY = null, BID_SAY = null;
const ASEL = new Set();  // academy players ticked for a bulk keep / contract / release
/* ---------- the staff search: a page like the transfer market ---------- */
const HIRE_F = { role: "manager", who: "yes", phil: "", focus: "", form: "", min: 0, wage: 0, age: 99, vis: "", st: "" };
/* Typical staff at each level: a sample of the kind of people working in each division (their reputation in that
   division's range), their average rating and the best of them, with the going rate for the job. Worked out once. */
let STAFF_LV = null;
function staffLevels() {
  if (STAFF_LV) return STAFF_LV;
  STAFF_LV = [];
  for (let t = 1; t <= 7; t++) {
    const lo = TIER_REP[t] - 4, hi = t > 1 ? TIER_REP[t - 1] - 4 : 99, row = { t };
    for (const r of Object.keys(ROLES_STAFF)) { const l = Array.from({ length: 400 }, () => staffAvg(genStaff(r, rf(lo, hi)))).sort((a, b) => a - b); row[r] = [sr20(avg(l)), sr20(l[Math.floor(l.length * .9)])]; }
    STAFF_LV.push(row);
  }
  return STAFF_LV;
}
function staffLevelsCard(role) {
  const t = my().tier, rows = staffLevels(), roles = Object.keys(ROLES_STAFF);
  return `<details style="margin-bottom:10px"><summary class="small">Typical staff ratings by division</summary>
    <div class="tbl-wrap" style="margin-top:6px"><table class="sq"><thead><tr><th style="text-align:left">Division</th>${roles.map(r => `<th>${ROLES_STAFF[r].l}</th>`).join("")}<th>Going rate (${ROLES_STAFF[role].l.toLowerCase()})</th></tr></thead><tbody>
    ${rows.map(x => `<tr${x.t === t ? ' style="font-weight:700"' : ""}><td style="text-align:left">${TIER_NAME[x.t]}${x.t === t ? " (you)" : ""}</td>${roles.map(r => `<td class="num">${x[r][0]} <span class="muted small">best ${x[r][1]}</span></td>`).join("")}<td class="num">${pw(staffWage(role, TIER_REP[x.t]))}</td></tr>`).join("")}</tbody></table></div>
    <p class="small muted" style="margin-top:4px">Average rating of staff working at each level, and roughly the best one in ten. Going rate: what a typical club in that division pays for the job.</p></details>`;
}
function pgHire() {
  const F = HIRE_F, role = F.role, R0 = ROLES_STAFF[role], all = candidates(role), cur = staffOf(role);
  const rows = all.map(s => ({ s, ask: staffAsk(s), vm: visionMatch(s), avg: staffAvg(s) }));
  const yes = rows.filter(x => x.ask != null).length;
  let pool = F.who === "yes" ? rows.filter(x => x.ask != null) : rows;
  pool = pool.filter(x => (!F.phil || x.s.phil === F.phil) && (!F.focus || x.s.focus === F.focus) && (!F.form || x.s.form === F.form) && sr20(x.avg) >= F.min && x.s.age <= F.age
    && (!F.wage || (x.ask != null && x.ask <= F.wage)) && (!F.vis || (F.vis === "full" ? x.vm >= .75 : x.vm >= .5))
    && (!F.st || (F.st === "free" ? x.s.emp == null : x.s.emp != null)));
  const sel = (k, opts) => `<select data-act="hf" data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(F[k]) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const WAGES = [0, 5e3, 10e3, 15e3, 25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2.5e6, 5e6];
  const attrCols = Object.entries(R0.attrs).map(([k, l]) => ({ k: "a_" + k, l: { tac: "Tactics", mot: "Motiv.", dev: "Develop", judge: "Judge", reach: "Scouting", neg: "Negot.", net: "Contacts" }[k] || l, r: true, v: x => x.s.at[k], f: x => `<b class="num">${sr20(x.s.at[k])}</b>` }));
  return `<div class="stack"><section class="card"><div class="card-h"><h2>Find staff</h2><button class="lnk small" data-act="page" data-p="staff">← Staff</button></div>
    <div class="chips" style="margin-bottom:12px">${Object.entries(ROLES_STAFF).map(([k, r]) => `<button data-act="hrole" data-k="${k}" aria-pressed="${role === k}">${r.l}</button>`).join("")}</div>
    <p class="small muted" style="margin:-4px 0 10px">Going rate for a ${R0.l.toLowerCase()} at your club: <b>${pw(jobRate(role))}</b>. Better candidates ask up to about 2.5× that; anyone working at a higher-division club wants at least what they earn now.</p>
    <p class="small" style="margin-bottom:10px">${cur ? `Now: <b>${esc(cur.name)}</b>, ${esc(R0.phil[cur.phil].l)} · average ${sr20(staffAvg(cur))} · ${pw(cur.wage)}` : `<span class="warn">Vacant</span>`}</p>
    ${staffLevelsCard(role)}
    <div class="chips" style="margin-bottom:12px">${[["yes", `Would come (${yes})`], ["all", `Everyone (${all.length})`]].map(([k, l]) => `<button data-act="hf" data-k="who" data-v="${k}" aria-pressed="${F.who === k}">${l}</button>`).join("")}</div>
    <div class="filters">
      <label class="f">${role === "manager" ? "Style" : "Approach"}${sel("phil", [["", "Any"], ...Object.entries(R0.phil).map(([k, v]) => [k, v.l])])}</label>
      <label class="f">Focus${sel("focus", [["", "Any"], ...Object.entries(R0.focus).map(([k, v]) => [k, v.split(":")[0]])])}</label>
      ${role === "manager" ? `<label class="f">Formation${sel("form", [["", "Any"], ...FORM_KEYS.map(k => [k, k])])}</label>` : ""}
      <label class="f">Min average${sel("min", [[0, "Any"], [5, "5+"], [8, "8+"], [10, "10+"], [12, "12+"], [14, "14+"], [16, "16+"]])}</label>
      <label class="f">Max wage${sel("wage", WAGES.map(v => [v, v ? pw(v) : "Any"]))}</label>
      <label class="f">Max age${sel("age", [[99, "Any"], [60, 60], [50, 50], [45, 45], [40, 40]])}</label>
      <label class="f">Vision${sel("vis", [["", "Any"], ["part", "At least partly shares it"], ["full", "Shares your vision"]])}</label>
      <label class="f">Status${sel("st", [["", "Anyone"], ["free", "Out of work"], ["emp", "At another club (poach)"]])}</label></div>
    <p class="small muted" style="margin-bottom:8px">${pool.length} match${pool.length === 1 ? "es" : ""}. Tap a column to sort; tap a name to see the card and offer the job. "Wants" is the least they'd accept.</p>
    ${sortTable("hire-" + role, [
      { k: "name", l: "Name", left: true, v: x => x.s.name, f: x => `<button class="lnk" data-act="cand" data-r="${role}" data-n="${all.indexOf(x.s)}">${esc(x.s.name)}</button>${x.s.ex ? ' <span class="chip acad">EX-PRO</span>' : ""}<br><span class="small muted">${esc(R0.phil[x.s.phil].l)}${x.s.form ? " · " + x.s.form : ""}</span>` },
      { k: "age", l: "Age", r: true, v: x => x.s.age, f: x => x.s.age },
      { k: "rep", l: "Rep", r: true, v: x => x.s.rep, f: x => x.s.rep },
      { k: "avg", l: "Avg", r: true, v: x => x.avg, f: x => `<b class="num">${sr20(x.avg)}</b>` },
      { k: "pot", l: "Pot.", r: true, v: x => { const [a, b] = staffPotRange(x.s); return a + b; }, f: x => `<b class="num">${staffPot20(x.s)}</b>` },
      ...attrCols,
      { k: "tol", l: "Hands-on", r: true, v: x => tolOf(x.s), f: x => `<span class="num ${tolWord(x.s)[1]}">${s20(tolOf(x.s))}</span>` },
      ...(role === "manager" ? [{ k: "rot", l: "Rotation", r: true, v: x => rotOf(x.s), f: x => `<span class="num" title="${rotWord(x.s)}">${s20(rotOf(x.s))}</span>` },
        { k: "foc", l: "Picks", left: true, v: x => x.s.focus, f: x => `<span class="small">${{ youth: "Youth", results: "Strongest side", balanced: "Balanced" }[x.s.focus] || ""}</span>` }] : []),
      { k: "vis", l: "Vision", v: x => x.vm, f: x => `<span class="small ${matchWord(x.vm)[1]}">${x.vm >= .75 ? "Shares" : x.vm >= .5 ? "Partly" : "Differs"}</span>` },
      { k: "ask", l: "Wants", r: true, v: x => x.ask ?? 1e12, f: x => x.ask != null ? pw(x.ask) : `<span class="small muted">${staffDropOK(x.s) ? "No" : "Won't drop"}</span>` },
      { k: "club", l: "Now at", left: true, v: x => x.s.emp != null ? CL(x.s.emp).name : "", f: x => x.s.emp != null ? `<span class="small">${esc(CL(x.s.emp).name)}<br><span class="muted">comp. ${money(poachFee(x.s))}</span></span>` : `<span class="small muted">Out of work</span>` },
    ], pool, { sort: { k: "avg", d: -1 }, limit: 200, quiet: true, empty: "Nobody matches these filters." })}
    <p class="small muted" style="margin-top:10px">Like players, coaches weigh up the whole job: the money, your club's standing, facilities, budgets, the squad, your ambition, and whether you let staff do their jobs. They won't drop more than two divisions below their standing.</p></section></div>`;
}
/* One candidate's card, with the job offer. */
function candModal(role, n) {
  const s = candidates(role)[n]; if (!s) return;
  const R0 = ROLES_STAFF[role], ph = R0.phil[s.phil], ask = staffAsk(s), no = ask == null;
  CANDS = { role, list: [s] };
  modal(`<div class="modal-h"><div><p class="eyebrow">${R0.l} · ${s.age} · reputation ${s.rep}${partTime(s.rep) ? " · part-time" : ""}</p><h2>${esc(s.name)} ${staffBadge(s)}</h2><p class="small">${no ? `<span class="muted">${staffDropOK(s) ? "Not interested at any price" : `Won't drop to the ${TIER_NAME[my().tier]}`}</span>` : "Wants about " + pw(ask)}</p></div><button class="btn modal-x" data-act="close">✕</button></div>
    <div class="modal-b"><p class="small"><span class="chip list">${esc(ph.l)}</span> ${esc(R0.focus[s.focus])}${s.form ? ` · ${s.form}` : ""} · ${word(matchWord(visionMatch(s)))}</p>
      <p class="small muted">${esc(ph.d || "")}</p>
      ${exLine(s)}
      ${s.emp != null && !no ? `<p class="small warn" style="margin-top:6px">${s.coachOf != null ? "Manager" : "Working"} at ${esc(clubLabel(CL(s.emp)))}. They ask ${money(poachFee(s))} in compensation to let ${pr(s, "him")} go: offer what you like below, but too little and they'll say no (three goes, then they stop talking). ${pr(s, "He")} also wants a little more to leave a job${empDrop(s) >= 2 ? `, and ${empDrop(s)} divisions down from where ${pr(s, "he")} works now, a lot more (×${dropPremium(s).toFixed(1)})` : ""}.</p>` : ""}
      <div class="attr-grid">${Object.entries(R0.attrs).map(([k, l]) => `<div class="attr-r"><span>${l}</span>${staffR20(s.at[k])}</div>`).join("")}<div class="attr-r"><span>Hands-on owner – <span class="small ${tolWord(s)[1]}">${tolWord(s)[0]}</span></span>${staff20(tolOf(s))}</div>${s.role === "manager" ? `<div class="attr-r"><span>Rotation – <span class="small">${rotWord(s)}</span></span>${staff20(rotOf(s))}</div>` : ""}<div class="attr-r"><span>Potential <span class="small muted">(average ${pr(s, "he")} could reach, est.)</span></span>${bar(staffEq(staffPotRange(s)[1]))}<b class="num">${staffPot20(s)}</b></div></div>
      ${role === "manager" ? `<p class="small muted">${pr(s, "His")} style with your current squad: ${fitText(styleFit(pickXI(my()), s.phil))}</p>` : ""}
      <details><summary class="small">What ${pr(s, "he")}'s weighing up</summary>${factorBars(staffAppeal(s, ask || effDemand(s)), S_FACTORS, s)}</details>
      ${s.compBlocked === G.year ? `<p class="small bad" style="margin-top:8px">${esc(CL(s.emp).name)} won't talk to you about ${pr(s, "him")} again this season.</p>` : no ? "" : `<div class="row" style="margin-top:10px"><label class="small">Offer €/wk <input type="text" inputmode="decimal" class="num-in" id="cw0" value="${fmtNum(Math.ceil(ask / 52 / 10) * 10)}"></label>${s.emp != null ? `<label class="small">Compensation € <input type="text" inputmode="decimal" class="num-in" id="cc0" value="${fmtNum(poachFee(s))}"></label>` : ""}<label class="small">Years <select id="cy0">${[1, 2, 3, 4].map(y => `<option ${y === 3 ? "selected" : ""}>${y}</option>`).join("")}</select></label><button class="btn primary sm" data-act="hire" data-i="0">${s.emp != null ? `Poach him (${money(poachFee(s))})` : "Offer the job"}</button></div>`}</div>`);
}

/* Loan wages: who you've borrowed and lent, and the share of each wage you actually pay. */
function loanWagesCard(c) {
  const L = (G.loanList || []).map(id => G.players[id]).filter(p => p && p.loan && (p.loan.to === c.id || p.loan.from === c.id));
  if (!L.length) return "";
  const inn = L.filter(p => p.loan.to === c.id), out = L.filter(p => p.loan.from === c.id);
  const row = (p, pay, pct, where) => `<div class="row between small" style="padding:4px 0;gap:10px;flex-wrap:nowrap"><span><button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button><br><span class="muted">${esc(where)} · ${pct}% of ${pw(p.wage)}</span></span><b class="num">${pw(pay)}</b></div>`;
  const tIn = sum(inn, p => p.wage * p.loan.share), tOut = sum(out, p => p.wage * (1 - p.loan.share));
  return `<section class="card"><div class="card-h"><h3>Loan wages</h3><span class="small muted">what you pay</span></div>
    ${inn.length ? `<p class="small muted" style="margin-bottom:2px">Borrowed</p>${inn.map(p => row(p, p.wage * p.loan.share, Math.round(p.loan.share * 100), `from ${CL(p.loan.from).name}`)).join("")}` : ""}
    ${out.length ? `<p class="small muted" style="margin:8px 0 2px">Lent out (you still pay the rest)</p>${out.map(p => row(p, p.wage * (1 - p.loan.share), Math.round((1 - p.loan.share) * 100), `at ${CL(p.club).name}`)).join("")}` : ""}
    <dl class="ledger" style="margin-top:8px"><dt class="tot">Loan wages a year</dt><dd class="tot">${money(tIn + tOut)}</dd></dl>
    <p class="small muted" style="margin-top:6px">Already counted in player wages: you pay only your share of a borrowed player's wage.${inn.some(p => p.loan.redo && playerLoanTerms(p, CL(p.loan.from)).min < p.loan.share) ? ' <b class="warn">A loan can be renegotiated: open the player\'s card.</b>' : ""}</p></section>`;
}

/* ---------- Finances ---------- */
function pgFin() {
  const c = my(); c.prices.st ??= stRef(c); const f = matchdayForecast(c), T = c.tier, L = c.finLast;
  const row = (k, l) => `<tr><td style="text-align:left">${l}</td><td class="num">${money(c.fin[k] || 0)}</td><td class="num muted">${L ? money(L[k] || 0) : "—"}</td></tr>`;
  /* A setting: name and key figure on top, a compact € box with − / + steps, an optional bar, a line of help. */
  const setting = ({ act, k, l, val, step, fig, bar, help, ref }) => `<div class="setting"><div class="setting-h"><b>${l}</b>${fig ? `<span class="small">${fig}</span>` : ""}</div>
    <div class="setting-c"><button class="btn sm" data-act="nudge" data-a="${act}" data-k="${k}" data-d="${-step}" aria-label="Less">−</button><span class="money-in"><span>€</span><input type="text" inputmode="decimal" class="num-in" data-act="${act}" data-k="${k}" value="${fmtNum(val)}" aria-label="${esc(l)}"></span><button class="btn sm" data-act="nudge" data-a="${act}" data-k="${k}" data-d="${step}" aria-label="More">+</button>${ref != null && Math.abs(val - ref) > step / 2 ? `<button class="lnk small" data-act="nudge" data-a="${act}" data-k="${k}" data-set="${ref}">Set to ${eur(ref)}</button>` : ""}</div>
    ${bar != null ? `<div class="use"><i style="width:${clamp(bar * 100, 0, 100)}%;background:${bar > 1 ? "var(--loss)" : bar > .9 ? "var(--accent)" : "var(--win)"}"></i></div>` : ""}
    <p class="small muted">${help}</p></div>`;
  const priceIn = (k, l, ref, step, note) => setting({ act: "price", k, l, val: c.prices[k], step, ref, fig: `typical ${eur(ref)}`, help: note });
  const budgetIn = (k, l, note, o = {}) => setting({ act: "budget", k, l, val: c.budget[k], step: o.step || stepFor(c.budget[k]), ref: o.ref, fig: o.fig, bar: o.bar, help: note });
  const tab = SUB.fin || "over", TABS = [["over", "Overview"], ["game", "Per game"], ["prices", "Prices"], ["budgets", "Budgets"], ["accounts", "Accounts"], ["loans", "Borrowing"]];
  const tabs = `<div class="chips" style="margin-bottom:14px">${TABS.map(([k, l]) => `<button data-act="sub" data-k="fin" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>`;
  const body = {
    over: () => `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>Your money</h2></div><dl class="ledger"><dt>Club cash</dt><dd class="${c.cash < 0 ? "bad" : ""}">${money(c.cash)}</dd><dt>Your fortune</dt><dd>${money(G.owner.wealth)}</dd><dt>Put in so far</dt><dd>${money(G.owner.invested)}</dd></dl>
      <p class="small muted" style="margin:10px 0">An overdrawn club pays 10% a year interest.</p>
      <div class="row">${[1e5, 1e6, 1e7].map(v => `<button class="btn sm" data-act="invest" data-v="${v}" ${G.owner.wealth < v ? "disabled" : ""}>Put in ${money(v)}</button>`).join("")}</div>
      <div class="row" style="margin-top:8px"><input type="text" inputmode="decimal" class="num-in" id="inv-amt" placeholder="Amount"><button class="btn sm" data-act="investx">Put in</button><button class="btn sm" data-act="withdraw">Take out</button></div></section></div><div class="stack"><section class="card"><div class="card-h"><h3>A year at a glance</h3></div><dl class="ledger">
      <dt>Player wages</dt><dd>${money(wageBill(c))}</dd><dt>Staff wages</dt><dd>${money(staffBill(c))}</dd><dt>Upkeep</dt><dd>${money(upkeep(c))}</dd><dt>Academy + scouting</dt><dd>${money(c.budget.acad + c.budget.scout)}</dd>
      <dt>Sponsors</dt><dd>${money(sponsorTotal(c))}</dd><dt>Central money</dt><dd>${money(TV[T])}</dd><dt>Matchday (est.)</dt><dd>${money((f.gate + f.conc - f.rent - f.ops) * G.leagues[c.lg].clubs.length - 1)}</dd></dl></section>${loanWagesCard(c)}</div></div>`,
    game: () => perGameHTML(c),
    prices: () => `<section class="card"><div class="card-h"><h2>Prices</h2></div><div class="settings">
      ${priceIn("ticket", "Match ticket", REF_TICKET[T], 1, `Forecast crowd ${f.crowd.toLocaleString("en-GB")} of ${capacity(c).toLocaleString("en-GB")}${f.hold ? `, ${f.hold.toLocaleString("en-GB")} of them season-ticket holders` : ""}: ${money(f.gate)} a game on the day.`)}
      ${priceIn("st", `Season ticket (${homeGames(c)} league home games)`, stRef(c), 5, G.phase === "summer"
        ? `On sale until the season starts. Forecast: ${stDemand(c).toLocaleString("en-GB")} sold (${Math.round(stDemand(c) / capacity(c) * 100)}% of the ground), ${money(stDemand(c) * c.prices.st)} up front. Holders don't pay on the day.`
        : `${stHolders(c) ? `${stHolders(c).toLocaleString("en-GB")} sold this season at ${money(c.st.price)}: ${money(c.st.n * c.st.price)}.` : "None sold this season."} A new price applies from next pre-season (forecast ${stDemand(c).toLocaleString("en-GB")}).`)}
      ${priceIn("conc", "Food & drink (average item)", REF_CONC[T], .5, `About ${money(f.conc)} profit a game${atHome(c) ? "" : " after your landlord's half"}.`)}
      ${priceIn("shirt", "Replica shirt", REF_SHIRT[T], 1, `About ${money(merchFor(c) * 52)} profit a year.`)}
      ${c.fac.stadium.own && c.fac.stadium.suites ? priceIn("suite", "Executive suite (per season)", REF_SUITE[T], 500, `${suitesLet(c)} of ${c.fac.stadium.suites} suites let: ${money(suitesLet(c) * c.prices.suite)} a season.`) : ""}
    </div><p class="small muted" style="margin-top:8px">Supporters notice prices well above the going rate and their mood suffers; cheap tickets win a little goodwill.</p></section>`,
    budgets: () => `${forecastCard(c)}<section class="card"><div class="card-h"><h2>Budgets</h2></div><div class="settings">
      ${budgetIn("wages", "Player wages (per year)", "Your head of recruitment won't sign players or renew contracts beyond it.", { fig: `${money(c.budget.wages)} a year = ${pw(c.budget.wages)} · ${money(wageBill(c))} used (${pw(wageBill(c))}) · <b>${money(Math.max(0, c.budget.wages - wageBill(c)))} left = ${pw(Math.max(0, c.budget.wages - wageBill(c)))} you can offer</b>`, bar: c.budget.wages ? wageBill(c) / c.budget.wages : 1 })}
      ${budgetIn("transfer", "Transfer fees (this season)", "Fees for the players your head of recruitment signs come out of this.", { fig: `${money(c.spentT)} spent · ${money(Math.max(0, c.budget.transfer - c.spentT))} left`, bar: c.budget.transfer ? c.spentT / c.budget.transfer : (c.spentT ? 1.01 : 0) })}
      ${c.fac.acad.lvl ? budgetIn("acad", "Academy (per year)", "More means bigger, better intakes; less, smaller and weaker ones.", { ref: Math.round(acadRef(c.fac.acad.lvl)), fig: `normal ${money(acadRef(c.fac.acad.lvl))}` }) : `<div class="setting"><div class="setting-h"><b>Academy</b></div><p class="small muted">No academy yet. Build one on the Facilities page.</p></div>`}
      ${budgetIn("scout", "Scouting (per year)", "More lets your recruitment team see further and judge players better.", { ref: scoutRef(T), fig: `normal ${money(scoutRef(T))}` })}
      ${budgetIn("comm", "Community foundation (per year)", "School visits, coaching and charity work. It grows your support (more families), lifts supporters' mood and makes the club more attractive to sponsors. Nothing happens without it.", { ref: COMM_REF[T], fig: `usual ${money(COMM_REF[T])}` })}
    </div></section>`,
    accounts: () => `<section class="card"><div class="card-h"><h2>Accounts</h2><span class="muted small">this season · last season</span></div><div class="tbl-wrap"><table class="proj"><tbody>
      <tr class="sec"><td colspan="3">Income</td></tr>${row("gate", "Gate receipts")}${row("stix", "Season tickets")}${row("conc", "Food & drink")}${row("suites", "Executive suites")}${row("events", "Stadium ventures & events")}${row("merch", "Merchandise")}${row("insclaim", "Insurance claims")}${row("oldground", "Sale of the old ground")}${row("spons", "Sponsorship")}${row("network", "Partner club fees")}${row("tv", "Central (TV) money")}${c.fin.para || (c.finLast || {}).para ? row("para", "Parachute payments") : ""}${row("prize", "Prize money")}${row("sales", "Player sales")}
      <tr class="tot"><td style="text-align:left">Total income</td><td class="num">${money(ledgerIncome(c.fin))}</td><td class="num muted">${L ? money(ledgerIncome(L)) : "—"}</td></tr>
      <tr class="sec"><td colspan="3">Costs</td></tr>${row("wages", "Player wages")}${row("staff", "Staff wages")}${row("buys", "Transfer fees")}${row("rent", "Ground rent")}${row("mdops", "Match-day operations")}${row("travel", "Team and supporter travel")}${row("refunds", "Refunds to supporters")}${row("medical", "Medical treatment")}${row("insure", "Insurance premiums")}${row("util", "Utilities")}${row("grading", "Ground-grading works")}${row("comm", "Community foundation")}${row("tax", "Corporation tax")}${row("fac", "Facility upkeep")}${row("build", "Construction")}${row("acad", "Academy")}${row("scout", "Scouting")}${row("interest", "Interest")}${c.fin.directors || (c.finLast || {}).directors ? row("directors", "Directors") : ""}${row("feeders", "Feeder funding")}${row("breaks", "Breaking sponsor deals")}${row("dividend", "Dividends")}
      <tr class="tot"><td style="text-align:left">Total costs</td><td class="num">${money(ledgerCosts(c.fin))}</td><td class="num muted">${L ? money(ledgerCosts(L)) : "—"}</td></tr>
      <tr class="sec"><td colspan="3">Not counted above</td></tr>${row("equity", "Shares sold")}${row("borrow", "Borrowed")}${row("repay", "Loan repayments")}${row("invest", "Your investment")}
      <tr class="tot"><td style="text-align:left">Result</td><td class="num ${ledgerIncome(c.fin) - ledgerCosts(c.fin) < 0 ? "bad" : "good"}">${money(ledgerIncome(c.fin) - ledgerCosts(c.fin))}</td><td class="num muted">${L ? money(ledgerIncome(L) - ledgerCosts(L)) : "—"}</td></tr>
    </tbody></table></div></section>`,
    loans: () => loansCard(),
  }[tab]();
  return tabs + body;
}

/* ---------- Commercial ---------- */
function pgComm() {
  const c = my();
  return `${commOpen() ? `<p class="small good" style="margin-bottom:8px"><b>The commercial window is open</b> (pre-season): ask for offers, sign deals or replace a sponsor now.</p>` : `<p class="small warn" style="margin-bottom:8px"><b>The commercial window is closed</b> until pre-season. Deals can't be asked for, signed or replaced during the season; your current sponsors keep paying.</p>`}<p class="small muted" style="margin-bottom:12px">Brands pay according to your division, your standing and the size and mood of your support. Offers last a few weeks. Longer deals pay a little less a year but lock it in, which is good while you're small and bad once you've grown. Each deal pays a bonus if you're promoted. Deals get better as the club grows (promotion, a bigger and happier support, a higher standing, a good league position, full crowds): once you've outgrown a deal by a quarter you can ask for new terms, and brands come to you when you've outgrown it by half.</p>
  ${brandGood() >= .05 && brandWary() < .05 ? `<p class="small good" style="margin-bottom:8px"><b>Brands think well of you:</b> you honour your deals, so offers are about ${Math.round((brandMult() - 1) * 100)}% higher${brandGood() >= .25 ? ", a fourth brand joins in" : ""}, and more brands come to you unprompted.</p>` : ""}
  ${brandWary() >= .05 ? `<p class="small warn" style="margin-bottom:8px"><b>Brands are wary of you</b> after ${(G.broken || []).length === 1 ? "a broken deal" : "broken deals"} (${(G.broken || []).slice(0, 3).map(b => `${esc(b.brand)}, ${b.y}`).join("; ")}): ${Math.max(1, 3 - Math.round(brandWary() * 3))} offer${Math.max(1, 3 - Math.round(brandWary() * 3)) > 1 ? "s" : ""} per deal instead of three, about ${Math.round(brandWary() * 35)}% lower, and few come to you unprompted. It fades each summer.</p>` : ""}
  <div class="grid2 needs">${Object.entries(SLOTS).map(([k, S]) => {
    const avail = !S.need || S.need(c), d = c.deals.find(x => x.slot === k), offers = c.offers.filter(o => o.slot === k);
    return `<section class="card"><div class="card-h"><h3>${S.l}</h3>${d ? `<span class="good small">${d.yrs} yr left</span>` : ""}</div>
      ${!avail ? `<p class="muted small">${k === "stadium" ? "You need a stadium of your own." : "You need a training ground of level 2 or better."}</p>` :
      `${d ? `<p><b>${esc(d.brand)}</b> · ${money(d.amt)}/yr · promotion bonus ${money(d.bonus)}</p>` : `<p class="muted">No sponsor.</p>`}
      ${offers.length && commOpen() ? `<div class="stack" style="margin-top:10px;gap:8px">${offers.map((o, i) => `<div class="row between offer"><span><b>${esc(o.brand)}</b>${o.renew ? ' <span class="chip acad">renewal</span>' : ""}<br><span class="small muted">${o.yrs} yr · bonus ${money(o.bonus)} · expires in ${o.exp} wk</span></span><span class="row"><b class="num">${money(o.amt)}/yr</b><button class="btn sm primary" data-act="sponsor" data-k="${k}" data-i="${i}">Sign</button></span></div>`).join("")}</div>
        ${d && breakFee(d) ? `<p class="small warn" style="margin-top:6px">Signing one breaks ${esc(d.brand)}'s deal: ${money(breakFee(d))} compensation (half of what it still had to pay), and other brands will be warier of you for a few seasons.</p>` : ""}` : ""}
      ${d && d.yrs > 0 && dealGrowth(c, d) >= 1.1 ? `<p class="small good">The club has grown: this slot would fetch about ${money(commercialValue(c) * S.share)} a year now (${Math.round((dealGrowth(c, d) - 1) * 100)}% more)${commOpen() ? "" : "; you can renegotiate next pre-season"}.</p>` : ""}
      ${commOpen() && (!d || d.yrs <= 1 || dealGrowth(c, d) >= 1.25) ? `<button class="btn sm" style="margin-top:10px" data-act="askoffers" data-k="${k}" ${(c.ask || {})[k] > G.week + G.year * 100 - 4 && (c.ask || {})[k] ? "disabled" : ""}>Ask the agency for new offers</button>` : ""}`}
    </section>`; }).join("")}</div>`;
}

/* ---------- Facilities ---------- */
/* The stand-by-stand designer for a new ground: capacity, seats or terrace, roof, for each stand; a family stand;
   corporate seats. Each change re-quotes. */
function standDesigner(d, c) {
  const tot = sum(Object.values(d.stands), x => x.cap || 0);
  const extras = `<h3 style="margin:12px 0 6px">Extras built with the ground</h3><p class="small muted">Built at the same time for 15% less, and ready on opening day. Each takes room on the plot.</p>
    ${Object.entries(VENTURES).map(([k, V]) => { const on = (d.vent || []).includes(k), ok = designVentOK(d, tot, k);
      return `<label class="row between offer" style="gap:8px"><span><b>${V.l}</b><br><span class="small muted">${ok ? `${money(VENTURES[k].cost(designShell(d, tot)) * .85)} · room for ${ventSpace(k, tot).toLocaleString("en-GB")} places` : "Needs a bigger ground (or the club shop first)"}</span></span><input type="checkbox" data-act="sd" data-k="vent.${k}" ${on ? "checked" : ""} ${ok || on ? "" : "disabled"}></label>`; }).join("")}`;
  return `<div class="tbl-wrap"><table class="sq designer"><thead><tr><th style="text-align:left">Stand</th><th>Places</th><th>Type</th><th>Roof</th></tr></thead><tbody>
    ${Object.entries(SIDES).map(([k, l]) => { const x = d.stands[k]; return `<tr><td style="text-align:left">${l}</td>
      <td><input type="text" inputmode="numeric" class="num-in" style="width:4.6em" data-act="sd" data-k="${k}.cap" value="${fmtNum(x.cap)}" aria-label="${l} places"></td>
      <td><select data-act="sd" data-k="${k}.type"><option value="seat" ${x.type === "seat" ? "selected" : ""}>Seats</option><option value="terrace" ${x.type === "terrace" ? "selected" : ""}>Terrace</option></select></td>
      <td><input type="checkbox" data-act="sd" data-k="${k}.roof" ${x.roof ? "checked" : ""} aria-label="Roof"></td></tr>`; }).join("")}
    </tbody></table></div>
    <div class="filters" style="margin-top:8px"><label class="f">Family stand<select data-act="sd" data-k="family"><option value="">None</option>${Object.entries(SIDES).map(([k, l]) => `<option value="${k}" ${d.family === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f">Corporate seats (Main stand)<input type="text" inputmode="numeric" class="num-in" data-act="sd" data-k="corp" value="${d.corp || 0}"></label></div>${extras}
    <p class="small muted" style="margin-top:6px">Terraces cost about half as much a place, are louder (a bigger home advantage, happier supporters) and sell a fifth cheaper; the Premier and First Divisions are all-seater. A roof keeps the crowd coming in bad weather (+20% to build). A family stand grows the support faster and sells more shirts. Corporate seats (up to 15% of the Main stand) are sold to businesses by the season.</p>`;
}
const closedNote = (d, c) => { const t = sum(Object.values(d.stands), x => x.type === "terrace" ? x.cap || 0 : 0); return t ? ` <span class="small muted">(${t.toLocaleString("en-GB")} on terraces${c.tier <= ALL_SEATER ? ": closed in this division" : ""})</span>` : ""; };
function progress(b) { const done = b.total - b.left, plan = b.plan || 0;
  return done < plan ? `<p class="small">Planning and approvals: ${done} of ${plan} weeks ${bar(done, plan)}<br><span class="muted">Then about ${b.total - plan} weeks of construction.</span></p>` : `<p class="small">Under construction: ${done - plan} of ${b.total - plan} weeks ${bar(done - plan, b.total - plan)}</p>`; }
// Ground ages and history: your grounds (opened, closed, capacity) and each stand's build year.
const ageWord = a => a >= 80 ? ["historic, badly dated", "bad"] : a >= 60 ? ["old and dated", "warn"] : a >= 30 ? ["mature", ""] : a >= 10 ? ["modern", "good"] : ["brand new", "good"];
// Your academy's name: earned by graduates who become first-team regulars.
function pedigreeCard(c) {
  const v = youthPedigree(c), w = pedigreeWord(c), top = G.clubs.filter(x => !x.gone && !x.abroad && !isMine(x) && youthPedigree(x) >= 4).sort((a, b) => youthPedigree(b) - youthPedigree(a)).slice(0, 5);
  return `<section class="card"><div class="card-h"><h2>Academy reputation</h2><span class="small ${w ? w[1] : "muted"}">${w ? w[0] : "No reputation yet"}</span></div>
    <p class="small muted">Young players choose academies with a name for bringing players through. Yours grows each season your own graduates are first-team regulars (20+ games), and fades slowly without them. A better reputation lifts every intake and finds more gems.${v ? ` Right now it adds about ${v > 0 ? "+" : ""}${v.toFixed(1)} to each player's potential.` : ""}</p>
    ${top.length ? `<p class="small" style="margin-top:8px">Clubs renowned for youth: ${top.map(x => `<button class="lnk" data-act="club" data-id="${x.id}">${esc(x.name)}</button> <span class="muted">(${TIER_NAME[x.tier]})</span>`).join(", ")}.</p>` : ""}</section>`;
}
function groundHistory(c) {
  const S = c.fac.stadium, h = S.hist || [];
  if (!S.own && !h.length) return `<section class="card"><div class="card-h"><h2>Ground history</h2></div><p class="small muted">No ground of your own yet: the club rents ${esc(ground(c).name)}.</p></section>`;
  const a = groundAge(c), w = ageWord(a);
  return `<section class="card"><div class="card-h"><h2>Ground history</h2></div>
    ${S.own ? `<p><b>${esc(S.name)}</b>, opened ${S.opened} (${a ? `${a} year${a > 1 ? "s" : ""} old` : "this year"}) · <span class="small ${w[1]}">${w[0]}</span></p>
    <p class="small ${standUpkeepF(S) > 1.25 ? "warn" : "muted"}">Stadium upkeep ${money(stadiumUpkeep(c))}/yr${standUpkeepF(S) > 1.005 ? ` (${Math.round((standUpkeepF(S) - 1) * 100)}% more because of its age; rebuilding the oldest stands brings it down)` : ""}.</p>
    <dl class="ledger" style="margin-top:6px">${Object.entries(SIDES).map(([k, l]) => { const x = standsOf(S)[k]; const f = ageUpF(G.year - standYr(S, k)); return `<dt>${l}</dt><dd class="small">built ${standYr(S, k)}${x.ext ? `, extended ${x.ext}` : ""}${f > 1.005 ? ` · <span class="${f > 1.5 ? "bad" : "warn"}">upkeep +${Math.round((f - 1) * 100)}%</span>` : ""}</dd>`; }).join("")}</dl>` : ""}
    ${h.length ? `<h3 style="margin:12px 0 6px">Former grounds</h3>${h.slice().reverse().map(g => `<div class="row between offer"><span>${esc(g.name)}<br><span class="small muted">${g.from}–${g.to} · ${g.cap.toLocaleString("en-GB")} capacity</span></span></div>`).join("")}` : ""}</section>`;
}
function pgFac() {
  const c = my(), S = c.fac.stadium;
  let st = `<section class="card"><div class="card-h"><h2>Stadium</h2><span class="small muted">${S.own ? esc(S.name) : "Rented"}</span></div>
    <dl class="ledger"><dt>Capacity</dt><dd>${capacity(c).toLocaleString("en-GB")}</dd><dt>Season tickets</dt><dd>${stHolders(c) ? `${stHolders(c).toLocaleString("en-GB")} (${Math.round(stHolders(c) / capacity(c) * 100)}%)` : G.phase === "summer" ? `on sale: about ${stDemand(c).toLocaleString("en-GB")}` : "none this season"}</dd>
    <dt>Facilities</dt><dd>Level ${ground(c).amen} of 5</dd>${S.own ? `<dt>Executive suites</dt><dd>${S.suites || 0} (room for ${suiteMax(c)})</dd><dt>Pitch</dt><dd>${word(pitchWord(S.pitch))} ${Math.round(S.pitch)}/100 · ${PITCH[S.ptype || "grass"].l}</dd><dt>Upkeep</dt><dd>${money(stadiumUpkeep(c))}/yr</dd>` : `<dt>Rent</dt><dd>${money(ground(c).rent)} a home game</dd>`}</dl>`;
  if (S.build) st += `<p style="margin-top:10px"><b>${esc(S.build.label)}</b></p>` + progress(S.build) + (closedSide(S) ? `<p class="small warn">The ${SIDES[closedSide(S)]} (${standsOf(S)[closedSide(S)].cap.toLocaleString("en-GB")} places) is closed until the work is finished.</p>` : S.rebuilding ? `<p class="small warn">${S.soldOld ? `Your old ground has been sold: home games are at ${esc(HOSTS[S.away ?? 0].name)} until the new one opens.` : `The ground is a building site: home games are at ${esc(HOSTS[S.away ?? 0].name)} until it reopens.`}</p>` : "");
  const here = i => S.own ? S.away === i : S.host === i;
  st += `<h3 style="margin:14px 0 6px">Where you play</h3>
    <p class="small muted">A bigger ground means bigger crowds when demand is there. Renting costs a fee every home game and the landlord keeps half the bar takings.</p>
    ${S.own ? `<div class="row between offer"><span><b>${esc(S.name)}</b> (your own ground)<br><span class="small muted">${S.cap.toLocaleString("en-GB")} capacity · no rent · all the bar takings</span></span>${atHome(c) ? `<span class="good small">Current</span>` : S.rebuilding ? `<span class="warn small">${S.soldOld ? "Sold" : "Being rebuilt"}</span>` : `<button class="btn sm" data-act="host" data-i="home">Move back home</button>`}</div>` : ""}
    ${HOSTS.map((h, i) => `<div class="row between offer"><span>${esc(h.name[0].toUpperCase() + h.name.slice(1))}<br><span class="small muted">${h.cap.toLocaleString("en-GB")} capacity · ${money(h.rent)} a game · facilities ${h.amen}</span></span>${here(i) ? `<span class="good small">Current</span>` : `<button class="btn sm" data-act="host" data-i="${i}">Move here</button>`}</div>`).join("")}`;
  st += `</section>`;
  let bd = `<section class="card"><div class="card-h"><h2>Building work</h2></div>${S.build ? `<p><b>${esc(S.build.label)}</b></p>` + progress(S.build) : ""}
    ${S.build ? "" : (() => { const f = G.stFin || {}, ex = 5e6, amt = ex * (f.share || .5), rt = stadiumRate(ex, amt), n = (f.years || 25) * 52, wk = amt * (rt / 52) / (1 - Math.pow(1 + rt / 52, -n)), t = { rate: rt + .005 }; return `<div class="row between offer"><span><b>Paying for stadium work</b><br><span class="small muted">${f.share ? `${Math.round(f.share * 100)}% of each project over €100k financed by a stadium loan over ${f.years || 25} years (about ${(Math.max(.02, t.rate - .005) * 100).toFixed(1)}% now). Example: a ${money(ex)} project means ${money(ex * f.share)} of debt and about ${money(wk)} a week in repayments. Debt lowers the club's value and makes borrowing dearer; heavy debt worries investors. The lender will go up to about ${money(stadiumFinMax(ex))} on a project that size.` : "Paid in full from the club's cash. You can finance big projects with a stadium loan instead."}</span></span>
      <span class="row" style="flex-wrap:nowrap"><select data-act="stfin" data-k="share">${[[0, "Cash"], [.5, "Finance 50%"], [.8, "Finance 80%"]].map(([v, l]) => `<option value="${v}" ${(f.share || 0) === v ? "selected" : ""}>${l}</option>`).join("")}</select>${f.share ? `<select data-act="stfin" data-k="years">${[15, 25].map(y => `<option value="${y}" ${(f.years || 25) === y ? "selected" : ""}>${y} yrs</option>`).join("")}</select>` : ""}</span></div>`; })()}`;
  if (!S.own) {
    if (!S.build) { const d = (G.stDraft ||= standPlan(1500)), q = groundQuote(d);
      bd += `<h3 style="margin:14px 0 6px">Build your own ground</h3><p class="small muted">Your own ground keeps all the bar takings, unlocks executive suites and naming rights, and has no rent; it has upkeep instead. You'll keep renting while it's built. Design it stand by stand, or start from a size.</p>
      <label class="small">Name <input id="st-name" value="${esc(G.stName || c.town + " Park")}" maxlength="30" data-act="stname"></label>
      <div class="chips" style="margin:8px 0">${BUILD_SIZES.map(n => `<button data-act="stplan" data-n="${n}">${n.toLocaleString("en-GB")}</button>`).join("")}</div>
      ${standDesigner(d, c)}
      <div class="row between offer" style="margin-top:8px"><span><b>${q.cap.toLocaleString("en-GB")}</b> capacity${closedNote(d, c)}<br><span class="small muted">${money(q.cost)} · about ${q.weeks} weeks</span></span><button class="btn sm primary" data-act="buildst" ${q.cap < 500 || q.cap > SITE_MAX ? "disabled" : ""}>Build</button></div>${q.cap > SITE_MAX ? `<p class="small warn">No site in the country takes more than ${SITE_MAX.toLocaleString("en-GB")}.</p>` : `<p class="small muted">The site you buy will have room to grow beyond what you build (how much varies), up to ${SITE_MAX.toLocaleString("en-GB")}.</p>`}`; }
  } else if (!S.build) {
    bd += `<h3 style="margin:14px 0 6px">The stands</h3><p class="small muted">Extend a stand by any number of places, put a roof on it, switch between seats and terracing, or make it the family stand. One job at a time.</p>
      <p class="small ${siteRoom(S) ? "" : "warn"}" style="margin:4px 0 8px">The site takes a ground of up to <b>${siteCap(S).toLocaleString("en-GB")}</b>${usedSpace(S) ? ` (extras like the car park take up room for ${usedSpace(S).toLocaleString("en-GB")})` : ""}${siteRoom(S) ? `: room for ${siteRoom(S).toLocaleString("en-GB")} more places` : ": it's full, so a stand can only be rebuilt within the same total"}.</p>
      ${Object.entries(SIDES).map(([k, l]) => { const x = standsOf(S)[k], conv = convertQuote(c, k);
        return `<div class="offer stand"><div class="row between"><b>${l}</b><span class="small">${x.cap.toLocaleString("en-GB")} · ${x.type === "terrace" ? "terrace" : "seated"} · ${x.roof ? "covered" : "open"}${x.family ? ' · <span class="good">family stand</span>' : ""}${k === "W" && x.corp ? ` · ${x.corp} corporate` : ""}</span></div>
          ${x.type === "terrace" && c.tier <= ALL_SEATER ? `<p class="small bad">Closed: this division is all-seater.</p>` : ""}
          ${(() => { const n = (G.extN || {})[k] || 1000, q = standQuote(c, k, n); return n > siteRoom(S) ? `<p class="small warn" style="margin-top:6px">Only room for ${siteRoom(S).toLocaleString("en-GB")} more places on this site.</p>` : `<p class="small muted" style="margin-top:6px">Add ${n.toLocaleString("en-GB")} places: <b>${money(q.cost)}</b> · about ${q.weeks} weeks · the stand closes while it's built</p>`; })()}
          <div class="row" style="margin-top:6px;flex-wrap:wrap"><span class="money-in"><input type="text" inputmode="numeric" class="num-in" id="ext-${k}" data-act="extn" data-k="${k}" value="${fmtNum((G.extN || {})[k] || 1000)}" aria-label="Places to add"></span><button class="btn sm" data-act="extend" data-k="${k}">Extend</button>
            ${x.roof ? "" : `<button class="btn sm" data-act="roof" data-k="${k}">Roof (${money(roofQuote(c, k).cost)})</button>`}
            <button class="btn sm" data-act="convert" data-k="${k}">${conv.to === "seat" ? "Seat it" : "Terrace it"} (${money(conv.cost)})</button>
            <button class="btn sm" data-act="family" data-k="${k}">${x.family ? "End family stand" : `Family stand (${money(familyCost(c, k))})`}</button></div>
          ${(() => { const r = ((G.rb ||= {})[k] ||= { cap: x.cap, type: x.type, roof: x.roof }), q = rebuildQuote(c, k, r.cap, r.type, r.roof);
            return `<details style="margin-top:6px" ${G.rbOpen === k ? "open" : ""}><summary class="small">Demolish and rebuild</summary><div class="row" style="margin-top:6px;flex-wrap:wrap;gap:8px">
              <label class="small">Places <input type="text" inputmode="numeric" class="num-in" style="width:5em" data-act="rb" data-k="${k}.cap" value="${fmtNum(r.cap)}"></label>
              <label class="small"><select data-act="rb" data-k="${k}.type"><option value="seat" ${r.type === "seat" ? "selected" : ""}>Seats</option><option value="terrace" ${r.type === "terrace" ? "selected" : ""}>Terrace</option></select></label>
              <label class="small"><input type="checkbox" data-act="rb" data-k="${k}.roof" ${r.roof ? "checked" : ""}> Roof</label></div>
              <p class="small muted" style="margin-top:6px">Knock down the ${l} (${x.cap.toLocaleString("en-GB")} places) and build ${r.cap.toLocaleString("en-GB")} ${r.type === "terrace" ? "on a terrace" : "seats"}${r.roof ? ", covered" : ", open"}: <b>${money(q.cost)}</b> (${money(q.demo)} of it demolition) · about ${q.weeks} weeks with the stand closed.</p>
              ${S.cap - x.cap + r.cap > siteCap(S) ? `<p class="small warn">Too big for the site: at most ${(siteCap(S) - S.cap + x.cap).toLocaleString("en-GB")} places here.</p>` : ""}
              <button class="btn sm" data-act="rebuild" data-k="${k}" ${r.cap < 50 || S.cap - x.cap + r.cap > siteCap(S) ? "disabled" : ""}>Demolish and rebuild</button></details>`; })()}</div>`; }).join("")}
      <div class="row between offer"><span>Corporate seats in the Main stand<br><span class="small muted">${corpSeats(c)} of up to ${corpMax(c)} · ${corpLet(c)} sold at about ${money(REF_CORP[c.tier])} a season each · ${money(corpQuote(c, 1).cost)} a seat to fit</span></span>${corpSeats(c) < corpMax(c) ? `<span class="row" style="flex-wrap:nowrap"><input type="text" inputmode="numeric" class="num-in" id="corp-n" value="${Math.min(20, corpMax(c) - corpSeats(c))}" style="width:5em" aria-label="Corporate seats to add"><button class="btn sm" data-act="corp">Add</button></span>` : ""}</div>`;
    { const d = (G.stDraft ||= Object.assign(standPlan(S.cap), { vent: Object.keys(S.vent || {}) })), q = regroundQuote(c, d), h = HOSTS[tempHost(c)];
      bd += `<details style="margin-top:12px" ${G.rgOpen ? "open" : ""}><summary><b>Demolish and rebuild the whole ground</b></summary><p class="small muted" style="margin:6px 0">Start again on the same site, stand by stand. Home games move to ${esc(h.name)} (${h.cap.toLocaleString("en-GB")}, ${money(h.rent)} a game) until it reopens; you can pick another rented ground meanwhile.</p>
        <div class="chips" style="margin:8px 0">${BUILD_SIZES.map(n => `<button data-act="stplan" data-n="${n}">${n.toLocaleString("en-GB")}</button>`).join("")}</div>
        ${standDesigner(d, c)}
        ${q.space > siteCap(S) ? `<p class="small warn" style="margin-top:6px">Too big: the stands and extras need room for ${q.space.toLocaleString("en-GB")}; the site takes ${siteCap(S).toLocaleString("en-GB")}.</p>` : ""}
        <div class="row between offer" style="margin-top:8px"><span><b>${q.cap.toLocaleString("en-GB")}</b> capacity${closedNote(d, c)}<br><span class="small muted">${money(q.cost)} (${money(q.demo)} of it demolition) · about ${q.weeks} weeks</span></span><button class="btn sm primary" data-act="reground" ${q.cap < 500 || q.space > siteCap(S) ? "disabled" : ""}>Rebuild</button></div></details>`; }
    { const sites = newSites(c), pick = sites.find(x => x.k === G.moveK) || sites[1], plots = plotSizes(c, pick), plot = plots.includes(G.plotN) ? G.plotN : plots[Math.min(1, plots.length - 1)],
        d = (G.mvDraft ||= Object.assign(standPlan(Math.min(plot, Math.round(S.cap * 1.8 / 500) * 500)), { vent: Object.keys(S.vent || {}) })), q = moveQuote(c, d, pick, plot);
      bd += `<details style="margin-top:12px" ${G.mvOpen ? "open" : ""}><summary><b>Build a new ground elsewhere</b></summary><p class="small muted" style="margin:6px 0">Buy land and build a new home. While it's built you can stay here and sell this ground on moving day, or sell it now (about ${money(oldGroundValue(c))}) and play at a rented ground meanwhile. The further you go, the more supporters object.</p>
        ${sites.map(x => `<div class="row between offer"><span><b>${x.l}</b> · ${x.km} km away<br><span class="small muted">Plots for a ground of up to ${x.site.toLocaleString("en-GB")} · land from ${money(landCost(c, x, plotSizes(c, x)[0]))} · supporters: <span class="${x.km <= 3 ? "good" : x.km <= 9 ? "warn" : "bad"}">${x.km <= 3 ? "excited" : x.km <= 9 ? "uneasy about it" : x.km > 20 ? "angry; many will stop coming" : "unhappy; some will stop coming"}</span></span></span>${x.k === pick.k ? `<span class="good small">Chosen</span>` : `<button class="btn sm" data-act="mvsite" data-k="${x.k}">Choose</button>`}</div>`).join("")}
        <p class="small" style="margin:10px 0 4px"><b>Plot size</b> <span class="muted">(the biggest ground it will ever take)</span></p>
        <div class="chips" style="margin-bottom:8px">${plots.map(n => `<button data-act="mvplot" data-n="${n}" aria-pressed="${n === plot}">${n.toLocaleString("en-GB")} · ${money(landCost(c, pick, n))}</button>`).join("")}</div>
        ${(() => { const h = HOSTS[tempHost(c)], stay = (G.mvStay || "stay") === "stay"; return `<p class="small" style="margin:10px 0 4px"><b>While it's built</b></p>
        <div class="chips" style="margin-bottom:6px"><button data-act="mvstay" data-v="stay" aria-pressed="${stay}">Stay here</button><button data-act="mvstay" data-v="rent" aria-pressed="${!stay}">Sell now and rent</button></div>
        <p class="small muted" style="margin-bottom:8px">${stay ? `Keep playing at ${esc(S.name)} until the new ground opens; it's sold on moving day for about ${money(oldGroundValue(c))}. No money up front.` : `Sell ${esc(S.name)} now for about ${money(oldGroundValue(c))} and play at ${esc(h.name)} (${h.cap.toLocaleString("en-GB")}, ${money(h.rent)} a game) until the new ground opens. No upkeep or extras income from the old ground meanwhile.`}</p>`; })()}
        <label class="small">Name <input id="mv-name" value="${esc(G.mvName || c.town + " Stadium")}" maxlength="30" data-act="mvname"></label>
        <div class="chips" style="margin:8px 0">${BUILD_SIZES.filter(n => n <= plot).map(n => `<button data-act="mvplan" data-n="${n}">${n.toLocaleString("en-GB")}</button>`).join("")}</div>
        ${standDesigner(d, c).replace(/data-act="sd"/g, 'data-act="mvsd"')}
        ${q.space > plot ? `<p class="small warn" style="margin-top:6px">Too big for this plot: the stands and extras need room for ${q.space.toLocaleString("en-GB")}; it takes ${plot.toLocaleString("en-GB")}.</p>` : ""}
        <div class="row between offer" style="margin-top:8px"><span><b>${q.cap.toLocaleString("en-GB")}</b> capacity${closedNote(d, c)}<br><span class="small muted">${money(q.cost)} (land ${money(q.land)}) · about ${q.weeks} weeks · ${(G.mvStay || "stay") === "stay" ? `this ground sells on moving day for about ${money(q.sell)}` : `this ground sells now for about ${money(q.sell)}`}</span></span><button class="btn sm primary" data-act="movebuild" ${q.cap < 500 || q.space > plot ? "disabled" : ""}>Build</button></div></details>`; }
    const aq = amenQuote(c); if (aq) bd += `<div class="row between offer"><span>Upgrade facilities to level ${aq.lvl}<br><span class="small muted">Concourses, bars, toilets: more spent per fan. ${money(aq.cost)} · ${aq.weeks} weeks</span></span><button class="btn sm" data-act="amen">Upgrade</button></div>`;
    if (!S.heat) { const hq = heatQuote(c); bd += `<div class="row between offer"><span>Undersoil heating<br><span class="small muted">Frost and snow won't postpone your home games. ${money(hq.cost)} · ${hq.weeks} weeks · upkeep ${money(hq.upkeep)}/yr</span></span><button class="btn sm" data-act="heat">Install</button></div>`; }
    const sq = suiteQuote(c); if (sq) bd += `<div class="row between offer"><span>Add ${sq.add} executive suites<br><span class="small muted">Let to businesses by the season (demand about ${Math.round(suiteDemand(c))} at the going rate). ${money(sq.cost)} · ${sq.weeks} weeks</span></span><button class="btn sm" data-act="suites">Build</button></div>`;
  }
  bd += `</section>`;
  if (S.own) st += `<section class="card">` + (S.relay ? `<p class="small" style="margin-top:10px">The pitch is being re-laid (${S.relay.left} week${S.relay.left > 1 ? "s" : ""} left).</p>` :
    `<h3 style="margin:14px 0 6px">Pitch</h3><p class="small muted">Wears with every home game. A worn pitch blunts passing football at home, causes more injuries and annoys supporters. It recovers over the summer.</p>${Object.entries(PITCH).map(([k, t]) => `<div class="row between offer"><span>Re-lay with ${t.l.toLowerCase()}<br><span class="small muted">${money(t.cost(c))}${k === "hybrid" ? " · wears about half as fast" : ""}</span></span><button class="btn sm" data-act="relay" data-k="${k}">Re-lay</button></div>`).join("")}`);
  if (S.own) st += `</section>`;
  let vt = "";
  if (!S.own && S.popup) vt += `<section class="card"><div class="card-h"><h2>Pop-up fan zone</h2><span class="good small">running</span></div><p class="small muted">Hired for every home game while you rent your ground: half the effect of a permanent fan zone (atmosphere, turnout, mood), and about ${money(Math.abs(fzGame(c, matchdayForecast(c).crowd, .5)))} a game ${fzGame(c, matchdayForecast(c).crowd, .5) < 0 ? "net cost" : "net profit"} at a typical crowd. Build a permanent one once you have your own ground.</p><div class="row" style="margin-top:8px"><button class="btn sm" data-act="popupoff">End the pop-up</button></div></section>`;
  if (S.own) {
    vt += `<section class="card"><div class="card-h"><h2>Beyond match days</h2></div><p class="small muted" style="margin-bottom:8px">Other ways to make the ground pay. This season so far: ${money(c.fin.events || 0)}.</p>
      ${Object.entries(VENTURES).map(([k, V]) => { const on = has(c, k), ok = ventureOK(c, k), bld = (S.ventB || {})[k];
        if (bld) return `<div class="row between offer"><span><b>${V.l}</b> <span class="warn small">being built</span><br><span class="small muted">${V.d} Opens in about ${bld.left} week${bld.left > 1 ? "s" : ""}; no income or upkeep until then.</span></span><span class="small muted">${bld.left} wk${bld.left > 1 ? "s" : ""}</span></div>`;
        const sp = ventSpace(k, S.cap), roomless = !on && sp > siteRoom(S);
        return `<div class="row between offer"><span><b>${V.l}</b>${on ? ' <span class="good small">open</span>' : ""}<br><span class="small muted">${V.d} ${on ? "" : `Costs ${money(V.cost(c))}`}${sp && !on ? ` · needs room for ${sp.toLocaleString("en-GB")} places${roomless ? ` <span class="warn">(only ${siteRoom(S).toLocaleString("en-GB")} free on the site)</span>` : ""}` : ""}${ventUp(c, k) ? ` · upkeep ${money(ventUp(c, k))}/yr` : ""}${V.week && ok ? ` · earns about ${money(V.week(c) * 52)}/yr` : ""}${on ? "" : ` · takes about ${VENT_WEEKS[k] || 8} week${(VENT_WEEKS[k] || 8) > 1 ? "s" : ""} to build`}</span></span>${on ? `<button class="btn sm" data-act="unvent" data-k="${k}">Close</button>` : ok ? `<button class="btn sm" data-act="vent" data-k="${k}">Build</button>` : `<span class="small muted">Not yet</span>`}</div>`; }).join("")}
      <div class="row between offer"><span><b>Summer concerts</b><br><span class="small muted">${S.cap >= CONCERT_MIN ? `About ${money(concertFee(c))} each, held in pre-season. Each one costs the pitch about 8 points.` : `Needs a ground of ${CONCERT_MIN.toLocaleString("en-GB")}.`}</span></span>${S.cap >= CONCERT_MIN ? `<select data-act="concerts">${[0, 1, 2, 3, 4].map(n => `<option ${n === (S.concerts || 0) ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}</div></section>`;
  }
  const fac = k => { const F = c.fac[k], D = k === "train" ? TRAIN_DESC : ACAD_DESC, nx = F.lvl + 1;
    return `<section class="card"><div class="card-h"><h2>${FAC_NAME[k]}</h2><span class="num">Level ${F.lvl}/10</span></div><p class="lead">${D[F.lvl]}.</p>
      <p class="small muted" style="margin:6px 0">${k === "train" ? "Better training speeds up development, cuts injuries, and helps attract staff." : "No academy means no youth intake. Each level brings bigger, better intakes and faster development for academy players, and slightly better odds of an exceptional talent."} Upkeep ${money(facUpkeep(k, F.lvl))}/yr.</p>
      ${F.build ? progress(F.build) : nx <= 10 ? `<div class="row between offer"><span>Upgrade to level ${nx}: ${D[nx].toLowerCase()}<br><span class="small muted">${money(facCost(k, nx))} · ${facWeeks(nx)} weeks · upkeep then ${money(facUpkeep(k, nx))}/yr</span></span><button class="btn sm" data-act="upfac" data-k="${k}">Build</button></div>` : ""}</section>`; };
  st += groundHistory(c);
  const tab = SUB.fac || "ground", TABS = [["ground", "Ground"], ["build", "Building"], ["vent", "Ventures"], ["train", "Training"], ["acad", "Academy"]];
  const tabs = `<div class="chips" style="margin-bottom:14px">${TABS.map(([k, l]) => `<button data-act="sub" data-k="fac" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>`;
  const pane = { ground: st, build: bd, vent: vt || `<section class="card"><p class="muted">Stadium ventures need a ground of your own.</p></section>`, train: fac("train"), acad: fac("acad") + pedigreeCard(c) }[tab];
  return `${tabs}<div class="stack">${pane}</div>`;
}

/* ---------- League ---------- */
/* The play-offs: each tie as a fixture until it's played, then the score. */
function poHTML(po, last) {
  if (!po) return "";
  const nm = id => id === G.club ? `<b>${esc(CL(id).name)}</b>` : esc(CL(id).name);
  const tie = (h, a, label) => { const r = po.res.find(x => x.h === h && x.a === a);
    return `<div class="row between small" style="padding:4px 0;gap:8px"><span class="muted" style="min-width:5.5em">${label}</span><span style="flex:1">${nm(h)} ${r ? `<b class="num">${r.hg}–${r.ag}</b>${r.pens ? " (pens)" : ""}` : "v"} ${nm(a)}</span>${r ? `<span class="small">${r.w === G.club ? '<span class="good">Won</span>' : [h, a].includes(G.club) ? '<span class="bad">Lost</span>' : ""}</span>` : `<span class="small muted">to play</span>`}</div>`; };
  return `<section class="card"><div class="card-h"><h3>${last ? "Last season's play-offs" : "Play-offs"}</h3>${po.win != null ? `<span class="small">Winners: ${nm(po.win)}</span>` : ""}</div>
    ${po.semis.map(([h, a], i) => tie(h, a, `Semi-final ${i + 1}`)).join("")}
    ${po.final ? tie(po.final[0], po.final[1], "Final") : `<div class="row small muted" style="padding:4px 0">Final: winners of the semi-finals, at a neutral ground</div>`}</section>`;
}
function pgLeagueInner() {
  const k = SUB.league || my().lg;
  const opts = LG_KEYS.map(x => `<option value="${x}" ${x === k ? "selected" : ""}>${LEAGUES[x].name}</option>`).join("");
  const scorers = Object.values(G.players).filter(p => p.club >= 0 && CL(p.club).lg === k && p.s.g > 0).sort((a, b) => b.s.g - a.s.g).slice(0, 8);
  const po = (G.po && G.po[k]) || (G.phase === "summer" && G.poLast && G.poLast[k]) || null;
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>${LEAGUES[k].name}</h2><select data-act="lgsel">${opts}</select></div>
    ${tableHTML(k, table(k))}<p class="small muted" style="margin-top:8px">${LEAGUES[k].auto ? `Top ${LEAGUES[k].auto} promoted` : "Champions"}${LEAGUES[k].po ? `, ${ord(LEAGUES[k].po[0])}–${ord(LEAGUES[k].po[1])} play-offs` : ""}, bottom ${LEAGUES[k].down} ${LEAGUES[k].tier === 7 ? "drop out of the pyramid" : "relegated"}.</p></section>
    ${poHTML(po, !G.po && G.poLast && G.poLast[k] === po)}
    ${k === my().lg ? `<section class="card"><div class="card-h"><h3>Your results</h3></div>${(G.myRes || []).length ? resultsList((G.myRes || []).slice().reverse()) : "<p class='muted'>None yet.</p>"}</section>` : ""}</div>
    <div class="stack"><section class="card"><div class="card-h"><h3>Top scorers</h3></div>${scorers.length ? scorers.map(p => `<div class="row between small"><button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button><span class="muted">${esc(CL(p.club).short)}</span><b class="num">${p.s.g}</b></div>`).join("") : "<p class='muted'>None yet.</p>"}</section></div></div>`;
}
const FAN_COL = { hard: "var(--loss)", loyal: "var(--win)", fair: "var(--accent)", comm: "#5b8def" };
const fanBar = c => { const m = fanMix(c); return `<div class="fanbar">${Object.keys(FAN_KINDS).map(k => `<i style="width:${m[k]}%;background:${FAN_COL[k]}" title="${FAN_KINDS[k][0]} ${m[k]}%"></i>`).join("")}</div>`; };
const fanSummary = c => { const m = fanMix(c); return Object.keys(m).sort((a, b) => m[b] - m[a]).slice(0, 2).map(k => `${FAN_KINDS[k][0]} ${m[k]}%`).join(", "); };
function clubModal(id) {
  const c = CL(id), ps = c.squad.map(P).filter(p => !p.acad).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ovr - a.ovr);
  modal(`<div class="modal-h" style="--mc:${c.color}">${crest(c, 36)}<div><p class="eyebrow">${divisionOf(c)} · founded ${c.founded}</p><h2>${esc(c.name)}</h2></div><button class="btn modal-x" data-act="close">✕</button></div>
    <div class="modal-b">${isMine(c) ? "" : `<dl class="facts"><div><dt>Manager</dt><dd>${esc(c.coach.name)}</dd></div><div><dt>Style</dt><dd>${STYLES[c.coach.style].l}, ${c.coach.form}</dd></div><div><dt>Ground</dt><dd>${c.cap.toLocaleString("en-GB")}<br><span class="small ${ageWord(groundAge(c))[1]}">opened ${aiOpened(c)} · ${ageWord(groundAge(c))[0]}</span>${c.build ? `<br><span class="small warn">building a new ${c.build.cap.toLocaleString("en-GB")} ground, ${c.build.left != null ? `${c.build.left} weeks to go` : `opens ${c.build.open}`}${squeeze(c) < 1 ? ` (spending ${Math.round((1 - squeeze(c)) * 100)}% less meanwhile)` : ""}</span>` : ""}${c.moved ? `<br><span class="small muted">new ground ${c.moved.y}${c.moved.km > 3 ? `, ${c.moved.km} km from the old one` : ""}</span>` : ""}</dd></div><div><dt>Owner</dt><dd>${esc(c.own.name)}<br><span class="small muted">${OWNER_STYLES[c.own.style].l}</span></dd></div><div><dt>Owner's money</dt><dd>${lossWord(c)}${c.push && lossTol(c) > 0 ? " (more chasing promotion)" : ""}${c.aiFin ? `<br><span class="small ${c.aiFin.net < 0 ? "bad" : "good"}">${c.aiFin.net < 0 ? "Lost" : "Made"} ${money(Math.abs(c.aiFin.net))} last season</span>` : ""}${c.cut ? `<br><span class="small warn">Cutting costs</span>` : ""}${c.debt ? `<br><span class="small ${c.debt > c.aiFin?.inc * 1.5 ? "bad" : "muted"}">Debt ${money(c.debt)}</span>` : ""}</dd></div><div><dt>Wage budget</dt><dd>${money(aiBudget(c))}/yr</dd></div><div><dt>Academy</dt><dd class="small">Level ${c.acadLvl || 0}/10 · youth scouting ${sr20(aiYouthScout(c))}${pedigreeWord(c) ? `<br><span class="${pedigreeWord(c)[1]}">${pedigreeWord(c)[0]}</span>` : ""}</dd></div><div><dt>Supporters</dt><dd>${c.fans.toLocaleString("en-GB")}${drawWord(c) ? ` <span class="small ${drawWord(c)[1]}">· ${drawWord(c)[0]}</span>` : ""}<br><span class="small muted">${fanSummary(c)}</span>${fanBar(c)}</dd></div><div><dt>Honours</dt><dd>${c.trophies.length ? c.trophies.map(t => t[0] + " " + t[1]).join(", ") : "—"}</dd></div></dl>`}
    <div class="tbl-wrap"><table><tbody>${ps.map(p => `<tr class="click" data-act="player" data-id="${p.id}"><td><span class="pos">${p.pos}</span></td><td style="text-align:left">${esc(p.name)}</td><td class="num">${p.age}</td><td>${range(ovrEstimate(p))}</td></tr>`).join("")}</tbody></table></div></div>`);
}

/* ---------- Market ---------- */
/* How open a player is to joining you, from the same factors he weighs when you make an offer (appeal.js). */
function interestOf(p) {
  const ask = playerAsk(p); if (ask == null || !willJoin(p, my())) return { w: "Not interested", k: "no", cls: "bad", ask: null };
  const sc = playerAppeal(p, demandWage(p, my())), m = sc.score - sc.pr.thr, down = my().tier > naturalTier(p);  // stepping down: never "keen"
  if (hugeAsk(p)) { const a = affinity(p, my()); return { w: `Only for a huge wage (${a ? "he " + a : "money talks"})`, k: "sign", cls: "warn", ask }; }
  return m >= .08 && !down ? { w: "Keen", k: "keen", cls: "good", ask } : m >= 0 ? { w: "Open", k: "open", cls: "", ask } : { w: "For more money", k: "sign", cls: "warn", ask };
}
// Where a player plays (or, for a free agent, where he's from): the country chips on the market filter.
const MKT_COUNTRIES = ["ENG", "ITA", "ESP", "GER", "FRA", "POR", "BEL", "NED", "EUR", "ROW"];  // EUR: the smaller European leagues
const playerCountry = p => { const k = p.club >= 0 ? (CL(p.club).abroad ? CL(p.club).country : "ENG") : p.nat; return MKT_COUNTRIES.includes(k) ? k : COUNTRY[k] ? "EUR" : "ROW"; };
// Favourites: players you're keeping an eye on (the market's Favourites tab). Players who've left the game drop off.
const isFav = id => (G.favs || []).includes(id);
// Players you've suggested to your head of recruitment, and those agreed to join (the market's Suggested tab).
const suggPlayers = () => { const ids = new Set([...sugg().map(x => x.id), ...incoming().map(p => p.id)]); return [...ids].map(id => G.players[id]).filter(p => p && p.club !== G.club); };
const favPlayers = () => (G.favs || []).map(id => G.players[id]).filter(p => p && p.club !== G.club);
function pgMarket() {
  const c = my(), F = MARKET_F, s = staffOf("recruit"), needs = squadNeeds(c), xiCache = {}, off = new Set(F.off || []);
  const TABS = [["all", "All players"], ["fa", "Free agents"], ["listed", "Transfer listed"], ["loans", "Loan targets"], ["favs", `Favourites${favPlayers().length ? ` (${favPlayers().length})` : ""}`], ["sugg", `Suggested${suggPlayers().length ? ` (${suggPlayers().length})` : ""}`]];
  let base = F.tab === "sugg" ? suggPlayers() : F.tab === "favs" ? favPlayers() : F.tab === "fa" ? G.fa.map(P).filter(Boolean) : Object.values(G.players).filter(p => p.club >= 0 && p.club !== c.id && !p.acad && !p.loan && (!CL(p.club).gone || CL(p.club).abroad));
  if (F.tab === "listed") base = base.filter(p => p.list || p.req);
  if (F.tab === "loans") base = base.filter(p => loanable(p) && lendsTo(p) && !(xiCache[p.club] ||= new Set(pickXI(CL(p.club)).map(o => o.p.id))).has(p.id));
  if (off.size) base = base.filter(p => !off.has(playerCountry(p)));
  if (F.lg) base = base.filter(p => p.club >= 0 && (F.lg === "ABROAD" ? CL(p.club).abroad : CL(p.club).lg === F.lg));
  // Cheap filters first; then each club's first team is worked out once for the asking prices.
  // "Fits my budget": what's left of the transfer budget, and the spare room in the wage budget (a week).
  const feeLeft = Math.max(0, c.budget.transfer - c.spentT), wageLeft = Math.max(0, c.budget.wages - wageBill(c)) / 52;
  const feeCap = F.fee === -1 ? feeLeft : F.fee, wageCap = F.wage === -1 ? wageLeft : F.wage;
  let pool = base.filter(p => (!F.pos || p.pos === F.pos) && p.age <= F.age && (!F.arch || (archetypeOf(p) || [])[0] === F.arch))
    .map(p => ({ p, e: ovrEstimate(p) })).filter(x => r20((x.e[0] + x.e[1]) / 2) >= F.min)
    .map(x => ({ ...x, pe: potEstimate(x.p) })).filter(x => !F.pmin || r20((x.pe[0] + x.pe[1]) / 2) >= F.pmin)  // potential as your staff estimate it
    .map(x => ({ ...x, fee: askingFee(x.p, xiCache) })).filter(x => F.tab === "loans" || !F.fee || x.fee <= feeCap);
  for (const x of pool) x.i = interestOf(x.p);
  // Max wage (a week): what he'd want to join you, or for a loan the half of his wages you'd pay.
  if (F.wage) pool = pool.filter(x => (F.tab === "loans" ? x.p.wage / 2 : x.i.ask ?? Infinity) / 52 <= wageCap);
  // Cheap loans: his club wants you to pay no more than this share of his wages this window.
  if (F.tab === "loans" && F.lshare) pool = pool.filter(x => { const T = playerLoanTerms(x.p); return !T.no && T.min * 100 <= F.lshare + 1e-9; });
  if (F.int) pool = pool.filter(x => F.int === "sign" ? x.i.k !== "no" : F.int === "open" ? x.i.k === "open" || x.i.k === "keen" : x.i.k === F.int);
  const archOpts = (F.pos ? [F.pos] : POS).map(r => `<optgroup label="${POS_NAME[r]}">${ARCHETYPES[r].map(a => `<option value="${esc(a[0])}" ${F.arch === a[0] ? "selected" : ""}>${a[0]}</option>`).join("")}</optgroup>`).join("");
  const sel = (k, opts) => `<select data-act="mf" data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(F[k]) === String(v) ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  const FEES = [0, 5e3, 10e3, 25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2.5e6, 5e6, 10e6, 25e6, 50e6, 100e6];
  const wageUse = c.budget.wages ? Math.round(wageBill(c) / c.budget.wages * 100) : 0;
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>Search the market</h2></div>
    <p style="margin-bottom:12px">${windowOpen() ? `<b class="good">Window open</b>` : `<b class="muted">Window closed</b>: free agents sign now; anyone else can agree to join when it opens${incoming().length ? ` (${incoming().length} agreed)` : ""}`} · Transfer budget left <b class="num ${c.budget.transfer - c.spentT <= 0 ? "bad" : ""}">${money(Math.max(0, c.budget.transfer - c.spentT))}</b> of ${money(c.budget.transfer)} · Wages left <b class="num">${pw(Math.max(0, c.budget.wages - wageBill(c)))}</b> (${wageUse}% used) · Cash <b class="num">${money(c.cash)}</b></p>
    <div class="chips" style="margin-bottom:12px">${TABS.map(([k, l]) => `<button data-act="mtab" data-k="${k}" aria-pressed="${F.tab === k}">${l}</button>`).join("")}</div>
    <div class="filters">
      <label class="f">Position${sel("pos", [["", "Any"], ...POS.map(r => [r, POS_NAME[r]])])}</label>
      <label class="f">Type<select data-act="mf" data-k="arch"><option value="">Any</option>${archOpts}</select></label>
      <label class="f">Max age${sel("age", [[40, "Any"], [30, 30], [27, 27], [24, 24], [21, 21]])}</label>
      <label class="f">Min rating${sel("min", [[0, "Any"], [2, "2+"], [4, "4+"], [6, "6+"], [8, "8+"], [10, "10+"], [12, "12+"], [14, "14+"], [16, "16+"]])}</label>
      <label class="f">Min potential${sel("pmin", [[0, "Any"], [6, "6+"], [8, "8+"], [10, "10+"], [12, "12+"], [14, "14+"], [16, "16+"], [18, "18+"]])}</label>
      <label class="f">Interest${sel("int", [["", "Any"], ["keen", "Keen"], ["open", "Open or keen"], ["sign", "Would sign (not Not interested)"], ["no", "Not interested"]])}</label>
      <label class="f">Max wage${sel("wage", [[0, "Any"], [-1, `Fits my budget (${pw(wageLeft * 52)})`], ...[50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 250000].map(v => [v, "€" + v.toLocaleString("en-GB") + "/wk"])])}</label>
      ${F.tab === "loans" ? `<label class="f">Wage share you pay${sel("lshare", [[0, "Any"], [20, "Cheap: 20% or less"], [10, "10% or less"], [0.001, "Free (they pay it all)"]])}</label>` : ""}
      ${F.tab === "loans" ? "" : `<label class="f">Max fee${sel("fee", [[0, "Any"], [-1, `Fits my budget (${money(feeLeft)})`], ...FEES.slice(1).map(v => [v, money(v)])])}</label>`}
      <label class="f">League${sel("lg", [["", "All leagues"], ...LG_KEYS.map(k => [k, LEAGUES[k].name]), ["ABROAD", "Clubs abroad"]])}</label></div>
    <label class="small" style="display:block;margin:0 0 10px"><input type="checkbox" data-act="starhunt" ${G.starHunt ? "checked" : ""}> Let ${staffOf("recruit") ? esc(staffOf("recruit").name) : "your head of recruitment"} chase stars who'd only drop down for a huge wage</label>
    ${F.tab === "loans" && partners().length ? `<div class="offer" style="display:block;margin-bottom:12px"><b>From your partner clubs</b>${partners().map(pt => { const x = CL(pt.id); if (!x) return ""; const av = partnerLendable(x, c).filter(q => !F.lshare || playerLoanTerms(q, x).min * 100 <= F.lshare + 1e-9);
      return `<div style="margin-top:8px"><span class="small">${crest(x, 14)} <b>${esc(x.name)}</b> <span class="muted">${esc(clubWhere(x))} · ${av.length} player${av.length === 1 ? "" : "s"}</span></span>${av.length ? partnerLoanRows(x, av, 6) : `<p class="small muted">No young players at your level yet.</p>`}</div>`; }).join("")}
      <p class="small muted" style="margin-top:6px">Partner clubs always lend to you and usually cover most of the wages. Tap a player to ask.</p></div>` : ""}
    <div class="cty-tog" role="group" aria-label="Countries to search"><span class="small muted">Countries</span>${MKT_COUNTRIES.map(k => { const on = !off.has(k); return `<button class="cty ${on ? "on" : ""}" data-act="mcty" data-k="${k}" aria-pressed="${on}">${k === "ROW" ? "Rest of world" : k === "EUR" ? "Rest of Europe" : esc(COUNTRY[k].name)}</button>`; }).join("")}
      <span class="cty-all small"><button class="lnk" data-act="mctyall" data-v="1" ${off.size ? "" : "disabled"}>Select all</button> · <button class="lnk" data-act="mctyall" data-v="0" ${off.size === MKT_COUNTRIES.length ? "disabled" : ""}>Unselect all</button></span></div>
    <p class="small muted" style="margin-bottom:8px">${pool.length.toLocaleString("en-GB")} player${pool.length === 1 ? "" : "s"} match${pool.length === 1 ? "es" : ""}${pool.length > 200 ? ": showing the first 200 in the order you sort by" : ""}.${F.tab === "loans" ? " Young players out of their club's first team: ask to borrow one from his card, and you pay half his wages to the end of the season." : ""}</p>
    ${sortTable("market-" + F.tab, [
      { k: "name", l: "Player", left: true, v: x => x.p.name, f: x => `<button class="fav-btn sm ${isFav(x.p.id) ? "on" : ""}" data-act="fav" data-id="${x.p.id}" aria-pressed="${isFav(x.p.id)}" title="${isFav(x.p.id) ? "Remove from favourites" : "Add to favourites"}">${isFav(x.p.id) ? "★" : "☆"}</button><button class="lnk" data-act="player" data-id="${x.p.id}">${esc(x.p.name)}</button>${wkChip(x.p)}${x.p.list ? ' <span class="chip req">LISTED</span>' : ""}${x.p.toMe ? ' <span class="chip xi">AGREED</span>' : sugg().some(y => y.id === x.p.id) ? ` <span class="chip list">SUGGESTED${sugg().find(y => y.id === x.p.id).loan ? " LOAN" : ""}</span>` : ""}<br><span class="small muted">${esc((archetypeOf(x.p) || [""])[0])}</span>` },
      { k: "pos", l: "Pos", v: x => POS.indexOf(x.p.pos), f: x => `<span class="pos">${x.p.pos}</span>` },
      { k: "age", l: "Age", r: true, v: x => x.p.age, f: x => x.p.age },
      { k: "ovr", l: "Rating", v: x => x.e[0] + x.e[1], f: x => range(x.e) },
      { k: "pot", l: "Potential", v: x => x.pe[0] + x.pe[1], f: x => range(x.pe) },
      { k: "int", l: "Interest", v: x => ({ keen: 3, open: 2, sign: 1, no: 0 })[x.i.k], f: x => `<span class="small ${x.i.cls}">${x.i.w}</span>` },
      { k: "club", l: "Club", left: true, v: x => fromName(x.p), f: x => `<span class="small">${esc(fromName(x.p))}</span>` },
      { k: "fee", l: F.tab === "loans" ? "Value" : "Fee", r: true, v: x => x.fee, f: x => F.tab === "loans" ? money(valueOf(x.p)) : x.fee ? money(x.fee) : "Free" },
      ...(F.tab === "loans" ? [] : [{ k: "wage", l: "Wage", r: true, v: x => x.p.wage, f: x => pw(x.p.wage) }]),
      // On loan: the wage his club wants you to pay this window (or that he isn't available to you).
      F.tab === "loans" ? { k: "ask", l: "You'd pay", r: true, v: x => loanPay(x.p) ?? 1e12, f: x => loanPay(x.p) != null ? pw(loanPay(x.p)) : `<span class="small muted">Not available</span>` }
        : { k: "ask", l: "Wants", r: true, v: x => x.i.ask ?? 1e12, f: x => x.i.ask != null ? pw(x.i.ask) : "—" },
    ], pool, { sort: { k: "ovr", d: -1 }, limit: 200, quiet: true, empty: F.tab === "sugg" ? (suggPlayers().length ? "None of your suggestions match these filters." : "No suggestions yet: open a player's card and tap Suggest signing or Suggest a loan.") : F.tab === "favs" ? (favPlayers().length ? "None of your favourites match these filters." : "No favourites yet: tap the ☆ next to a player, here or on his card, to keep an eye on him.") : "Nobody matches these filters." })}</section></div>
    <div class="stack"><section class="card"><div class="card-h"><h3>Recruitment priorities</h3></div>${s ? `<p class="small muted" style="margin-bottom:8px">${esc(s.name)} · ${ROLES_STAFF.recruit.phil[s.phil].l} · ${ROLES_STAFF.recruit.focus[s.focus]}</p>` : `<p class="warn small">No head of recruitment: nobody is signing players.</p>`}
      ${needs.length ? needs.map(n => `<div class="row between small"><span><span class="pos">${n.pos}</span> ${n.kind === "depth" ? `needs ${n.short} more` : "needs an upgrade"}</span><span class="muted">best now ${n.weakest ? r20(n.weakest) : "—"}</span></div>`).join("") : "<p class='small'>The squad is covered.</p>"}
      <p class="small muted" style="margin-top:8px">Budget left: ${money(c.budget.transfer - c.spentT)} in fees, ${money(Math.max(0, c.budget.wages - wageBill(c)))} a year in wages.</p></section>
    ${s ? `<section class="card"><div class="card-h"><h3>Your suggestions</h3><span class="small muted">${sugg().length}</span></div>
      ${sugg().length ? sugg().filter(x => G.players[x.id]).map(x => { const p = G.players[x.id], v = suggView(p, my(), x.loan); return `<div class="sugg-row"><div class="row between"><span><span class="pos">${p.pos}</span> <button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button>${x.loan ? ' <span class="chip acad">LOAN</span>' : ""} <span class="small muted">${p.age} · ${esc(fromName(p))}</span></span><button class="lnk small" data-act="suggest" data-id="${p.id}"${x.loan ? ' data-loan="1"' : ""}>Withdraw</button></div><p class="small ${v.ok ? "good" : v.money ? "warn" : v.wait ? "" : "muted"}">${esc(v.w)}</p></div>`; }).join("")
        : `<p class="small muted">Open a player's card and tap <b>Suggest signing</b> or <b>Suggest a loan</b> to point ${esc(s.name)} at him. ${pr(s, "He")} goes after the ones ${pr(s, "he")} agrees with while a window is open, before ${pr(s, "his")} own targets, and tells you why if ${pr(s, "he")} won't.</p>`}</section>` : ""}</div></div>`;
}
function buyModal(id) {
  const p = G.players[id], fee = askingFee(p), wage = playerAsk(p) || demandWage(p, my()), s = staffOf("recruit");
  modal(`<div class="modal-h"><div><p class="eyebrow">Your offer</p><h2>${esc(p.name)}</h2><p class="small muted">${esc(fromName(p))}</p></div><button class="btn modal-x" data-act="close">✕</button></div>
    <div class="modal-b">${theirPlayerLine(p)}${weakestStarterLine(p.id)}${p.club >= 0 && isDerby(my(), CL(p.club)) ? `<p class="small warn">${esc(CL(p.club).name)} are your rivals: they don't like selling to you, and the price reflects it (about 40% more).</p>` : ""}<p>The selling club wants about <b>${fee ? money(fee) : "nothing"}</b>. He wants about <b>${pw(wage)}</b>.</p>
    <div class="row"><label class="small">Fee € <input type="text" inputmode="decimal" class="num-in" id="b-fee" value="${fmtNum(fee)}"></label><label class="small">Wage €/week <input type="text" inputmode="decimal" class="num-in" id="b-wage" value="${fmtNum(Math.round(wage / 52))}"></label></div>
    ${factorBars(playerAppeal(p, wage), P_FACTORS)}
    <p class="small muted">Paid from club cash (${money(my().cash)}), outside the budgets you've set. ${s ? `${esc(s.name)} won't like being bypassed.` : ""}</p>
    ${!windowOpen() && p.club >= 0 ? `<p class="small">The window is closed: if they accept, the deal is agreed now and he joins when it next opens (the fee is paid then).</p>` : ""}
    <div class="row"><button class="btn primary" data-act="buygo" data-id="${p.id}">${!windowOpen() && p.club >= 0 ? "Agree the deal" : "Make the offer"}</button></div></div>`);
}

/* ---------- History ---------- */
function pgHist() {
  const c = my();
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>Seasons</h2></div>${G.history.length ? `<div class="tbl-wrap"><table><thead><tr><th>Season</th><th style="text-align:left">Division</th><th>Pos</th><th>Pts</th><th>Crowd</th><th>Season tickets</th><th>Income</th><th>Costs</th><th style="text-align:left">Manager</th><th style="text-align:left">Cups · targets</th></tr></thead><tbody>
    ${G.history.map(h => `<tr><td>${seasonLabel(h.y)}</td><td style="text-align:left">${G.career && G.career.length ? `<b>${esc(h.club || "")}</b> · ` : ""}${LEAGUES[h.lg].name}</td><td class="num">${ord(h.pos)}${h.up ? ' <span class="good">▲</span>' : h.down ? ' <span class="bad">▼</span>' : ""}</td><td class="num">${h.pts}</td><td class="num">${h.att.toLocaleString("en-GB")}</td><td class="num">${h.st != null ? `${h.st.toLocaleString("en-GB")}${h.stp ? `<br><span class="small muted">at ${money(h.stp)}</span>` : ""}` : "—"}</td><td class="num">${money(h.inc)}</td><td class="num">${money(h.cost)}</td><td style="text-align:left" class="small">${esc(h.mgr)}</td><td style="text-align:left" class="small">${[...(h.cups || []), ...(h.obj || [])].map(esc).join("<br>")}</td></tr>`).join("")}</tbody></table></div>` : "<p class='muted'>Your first season is under way.</p>"}</section>
    <section class="card"><div class="card-h"><h3>Honours</h3></div>${c.trophies.length ? c.trophies.map(t => `<p>🏆 ${t[0]} ${esc(t[1])}</p>`).join("") : "<p class='muted'>None yet.</p>"}</section></div>
    <div class="stack"><section class="card"><div class="card-h"><h3>Club legends</h3></div>${(() => { const now = c.squad.map(P).filter(p => favLevel(p, c.id) === 2), past = c.legends || [];
      return now.length || past.length ? now.map(p => `<p class="small"><b>${esc(p.name)}</b> (${p.pos}) · still playing · ${Math.round(loveOf(p, c.id))} affection</p>`).join("") + past.slice().reverse().map(l => `<p class="small"><b>${esc(l.name)}</b> (${l.pos}) · ${l.from}–${l.to} · ${l.apps} games, ${l.goals} goals</p>`).join("")
        : "<p class='small muted'>Players become fan favourites, then legends, through games, goals and loyalty. Legends who retire are remembered here.</p>"; })()}</section>
    <section class="card"><div class="card-h"><h3>Hall of fame</h3></div>${G.hof.length ? G.hof.slice(-15).reverse().map(h => `<p class="small">${esc(h.name)} (${h.pos}) · peak ${h.peak} · ${h.apps} apps, ${h.goals} goals · retired ${h.y}</p>`).join("") : "<p class='muted small'>Great players who retire are remembered here.</p>"}</section>
    <section class="card"><div class="card-h"><h3>Save</h3></div><div class="row"><button class="btn sm" data-act="export">Export save file</button><label class="btn sm">Import<input type="file" id="imp" accept=".json" hidden></label><button class="btn sm" data-act="quit">Back to start</button></div></section></div></div>`;
}

/* ---------- modal ---------- */
function modal(html) { const m = $("#modal"); m.innerHTML = `<div class="scrim" data-act="closebg"><div class="modal" role="dialog">${html}</div></div>`; }
function closeModal() { $("#modal").innerHTML = ""; }

/* Per game: what a home game brings in and costs, what runs every week whatever happens, and the net of a home week
   and an away week. Forecast for a typical home game at today's prices, and this season's actual averages. */
function perGameHTML(c) {
  const f = matchdayForecast(c), vg = ventureGame(c, f.crowd) + (fzK(c) === .5 ? fzGame(c, f.crowd, .5) : 0), H = c.hgs || { n: 0 }, n = H.n, inSeason = G.phase !== "summer";
  const ventWeek = atHome(c) ? sum(Object.keys(c.fac.stadium.vent || {}), k => VENTURES[k].week ? VENTURES[k].week(c) : 0) : 0;
  const weekIn = [["Sponsors", sponsorTotal(c) / 52], ["Merchandise", merchFor(c)], ["Central (TV) money", TV[c.tier] / 46], ["Executive suites", suitesLet(c) * c.prices.suite / 46], ["Stadium ventures", ventWeek]].filter(x => x[1] > 0);
  const weekOut = [["Player wages", wageBill(c) / 52], ["Staff wages", staffBill(c) / 52], ["Facility upkeep", upkeep(c) / 52],
    ["Academy", c.budget.acad / 52], ["Scouting", c.budget.scout / 52], ["Utilities", utilities(c) / 52], ["Insurance", wageBill(c) * INSURE / 52], ["Community foundation", (c.budget.comm || 0) / 52], ["Feeder funding", feederFunding() / 52], ["Loan repayments", sum(G.loans || [], l => l.weekly)], ["Overdraft interest", c.cash < 0 ? -c.cash * .1 / 52 : 0]].filter(x => x[1] > 0);
  const stPer = f.hold ? (stHolders(c) || stDemand(c)) * stPrice(c) / homeGames(c) : 0;
  const tin = sum(weekIn, x => x[1]), tout = sum(weekOut, x => x[1]), match = f.gate + stPer + f.conc + vg - f.rent - f.ops, eur0 = v => money(v).replace(/^€0$/, "—");
  const rows = (list, sign) => list.map(([l, v]) => `<tr><td style="text-align:left">${l}</td><td class="num">${sign}${money(v)}</td></tr>`).join("");
  const per = k => n ? (H[k] || 0) / n : 0;
  return `<div class="grid2"><div class="stack">
    <section class="card"><div class="card-h"><h2>A home game</h2><span class="small muted">forecast at today's prices</span></div><div class="tbl-wrap"><table class="proj"><tbody>
      <tr class="sec"><td colspan="2">Crowd ${f.crowd.toLocaleString("en-GB")} of ${capacity(c).toLocaleString("en-GB")}</td></tr>
      ${f.hold ? `<tr><td style="text-align:left">Season-ticket holders: ${f.hold.toLocaleString("en-GB")}<br><span class="small muted">expected at the game, of ${stHolders(c) ? `${stHolders(c).toLocaleString("en-GB")} sold at ${money(c.st.price)}` : `about ${stDemand(c).toLocaleString("en-GB")} forecast to sell at ${money(stPrice(c))}`}; paid up front, about ${money((stHolders(c) || stDemand(c)) * stPrice(c) / homeGames(c))} a league game</span></td><td class="num">+${money((stHolders(c) || stDemand(c)) * stPrice(c) / homeGames(c))}</td></tr>` : ""}
      <tr><td style="text-align:left">Tickets on the day${f.hold ? ` (${Math.max(0, f.crowd - f.hold).toLocaleString("en-GB")} paying)` : ""}</td><td class="num">+${money(f.gate)}</td></tr>
      <tr><td style="text-align:left">Food & drink${atHome(c) ? "" : " (after the landlord's half)"}</td><td class="num">+${money(f.conc)}</td></tr>
      ${vg ? `<tr><td style="text-align:left">Fan zone, car park and match-day ventures</td><td class="num">${vg < 0 ? "−" : "+"}${money(Math.abs(vg))}</td></tr>` : ""}
      ${f.rent ? `<tr><td style="text-align:left">Ground rent</td><td class="num">−${money(f.rent)}</td></tr>` : ""}
      <tr><td style="text-align:left">Stewards, policing and ground staff</td><td class="num">−${money(f.ops)}</td></tr>
      <tr class="tot"><td style="text-align:left">Match-day result</td><td class="num ${match < 0 ? "bad" : "good"}">${money(match)}</td></tr></tbody></table></div>
      <p class="small muted" style="margin-top:6px">A typical opponent in your division. Big clubs, local derbies and good weather bring more; cup ties away pay a share of the gate.</p></section>
    <section class="card"><div class="card-h"><h3>This season so far, per home game</h3><span class="small muted">${n} home game${n === 1 ? "" : "s"}</span></div>${n ? `<dl class="ledger">
      <dt>Average crowd</dt><dd>${Math.round(per("crowd")).toLocaleString("en-GB")}</dd>${per("hold") ? `<dt>Season-ticket holders</dt><dd>${Math.round(per("hold")).toLocaleString("en-GB")} a game</dd><dt>Season tickets (share)</dt><dd>+${money(per("stg"))}</dd>` : ""}<dt>Tickets on the day</dt><dd>+${money(per("gate"))}</dd><dt>Food & drink</dt><dd>+${money(per("conc"))}</dd>${per("vent") ? `<dt>Match-day ventures</dt><dd>+${money(per("vent"))}</dd>` : ""}<dt>Ground rent</dt><dd>−${money(per("rent"))}</dd>
      <dt><b>Match-day result</b></dt><dd class="${per("gate") + per("stg") + per("conc") + per("vent") - per("rent") - per("ops") < 0 ? "bad" : "good"}"><b>${money(per("gate") + per("stg") + per("conc") + per("vent") - per("rent") - per("ops"))}</b></dd></dl>
      <p class="small muted" style="margin-top:6px">League and cup games at home. European nights, friendlies and away cup shares aren't included.</p>` : `<p class="small muted">No home games played yet${inSeason ? "" : " this season"}.</p>`}</section>
  </div><div class="stack">
    <section class="card"><div class="card-h"><h2>Every week</h2><span class="small muted">home or away</span></div><div class="tbl-wrap"><table class="proj"><tbody>
      <tr class="sec"><td colspan="2">Coming in</td></tr>${rows(weekIn, "+")}
      <tr class="sec"><td colspan="2">Going out</td></tr>${rows(weekOut, "−")}
      <tr class="tot"><td style="text-align:left">Every week</td><td class="num ${tin - tout < 0 ? "bad" : "good"}">${money(tin - tout)}</td></tr></tbody></table></div>
      ${!inSeason ? `<p class="small muted" style="margin-top:6px">TV money and executive suites are paid during the season.</p>` : ""}</section>
    <section class="card summary"><div class="card-h"><h3>Net, week by week</h3></div><dl class="ledger">
      <dt>A home-game week</dt><dd class="${match + tin - tout < 0 ? "bad" : "good"}">${money(match + tin - tout)}</dd>
      <dt>An away-game week</dt><dd class="${tin - tout < 0 ? "bad" : "good"}">${money(tin - tout)}</dd>
      <dt>Over a season (about ${Math.round(homeGames0(c))} home games, ${SEASON_WEEKS} weeks)</dt><dd class="${match * homeGames0(c) + (tin - tout) * SEASON_WEEKS < 0 ? "bad" : "good"}">${money(match * homeGames0(c) + (tin - tout) * SEASON_WEEKS)}</dd></dl>
      <p class="small muted" style="margin-top:6px">Before transfer fees, building work, prize money and player sales.</p></section>
  </div></div>`;
}
const avg0 = a => a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const homeGames0 = c => (G.leagues[c.lg].clubs.length - 1);

/* The season forecast on the Budgets tab. Change a budget and it updates; the change shown is against where the forecast
   stood when you first looked this week. */
let FC_BASE = null;
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
function forecastCard(c) {
  const F = seasonForecast(c), key = `${G.year}.${G.phase}.${G.week}`;
  if (!FC_BASE || FC_BASE.key !== key) FC_BASE = { key, net: F.net };
  const d = F.net - FC_BASE.net, sign = v => (v < 0 ? "−" : "+") + money(Math.abs(v));
  const rows = (o, s) => Object.entries(o).filter(([, v]) => Math.round(v)).map(([l, v]) => `<tr><td style="text-align:left">${l}</td><td class="num">${s}${money(v)}</td></tr>`).join("");
  return `<section class="card"><div class="card-h"><h2>Season forecast</h2><span class="small muted">${F.W} week${F.W === 1 ? "" : "s"} to go · ${F.home} home game${F.home === 1 ? "" : "s"} left</span></div>
    <dl class="ledger"><dt><b>Projected result for the season</b></dt><dd class="${F.net < 0 ? "bad" : "good"}"><b>${sign(F.net)}</b></dd>
      ${Math.abs(d) >= 1000 ? `<dt>Change from your earlier budgets</dt><dd class="${d < 0 ? "bad" : "good"}">${sign(d)}</dd>` : ""}
      ${c.tier <= 4 ? `<dt>Spending rule (three seasons)</dt><dd class="${F.ratio > SPEND_LIMIT ? "bad" : F.ratio > SPEND_LIMIT - .1 ? "warn" : "good"}">${Math.round(F.ratio * 100)}% of income lost (limit 35%)${F.ratio > SPEND_LIMIT ? ": points deduction" : ""}</dd>` : ""}</dl>
    <details style="margin-top:8px"><summary class="small">How it adds up</summary><div class="tbl-wrap"><table class="proj"><tbody>
      <tr class="sec"><td colspan="2">So far this season</td></tr>
      ${c.fin.sales ? `<tr><td style="text-align:left">Player sales</td><td class="num">+${money(c.fin.sales)}</td></tr>` : ""}
      ${c.fin.buys ? `<tr><td style="text-align:left">Transfer fees paid</td><td class="num">−${money(c.fin.buys)}</td></tr>` : ""}
      <tr><td style="text-align:left">${c.fin.sales || c.fin.buys ? "Everything else" : "Result so far"}</td><td class="num">${sign(F.sofar - (c.fin.sales || 0) + (c.fin.buys || 0))}</td></tr>
      <tr class="sec"><td colspan="2">Still to come in</td></tr>${rows(F.rest, "+")}
      <tr class="sec"><td colspan="2">Still to go out</td></tr>${rows(F.out, "−")}
      <tr class="tot"><td style="text-align:left">Projected result</td><td class="num ${F.net < 0 ? "bad" : "good"}">${sign(F.net)}</td></tr></tbody></table></div></details>
    ${(() => { const nx = incoming().filter(p => toMeWhen(p) === "summer"), jr = incoming().filter(p => toMeWhen(p) === "jan" && p.toMe.rec);
      return (jr.length ? `<p class="small" style="margin-top:6px">January deals agreed by your head of recruitment (${jr.map(p => esc(p.name)).join(", ")}) are inside the transfer and wage budgets above.</p>` : "") + (nx.length ? `<p class="small" style="margin-top:6px">Agreed for the summer, so in <b>next</b> season's accounts: ${nx.map(p => `${esc(p.name)} (${p.toMe.fee ? money(p.toMe.fee) : "free"}, ${pw(p.toMe.wage)})`).join(", ")}.</p>` : ""); })()}
    <p class="small muted" style="margin-top:6px">This season's books so far plus the rest at today's rates. ${F.windowAhead ? "Assumes your head of recruitment uses the wage and transfer budgets in the coming window. " : ""}League merit money for ${ordinal(F.pos)} place. Player sales count as they happen; future sales, cup runs, Europe, building work and one-off bills aren't forecast.</p></section>`;
}

/* The Stats tab: this season's numbers for everyone who's played (or could), with totals for the club and his career.
   Minutes are counted as 90 for a start and about 25 off the bench. */
function squadStats(c, ps, xi) {
  const st = p => (p.s.app || 0) - (p.s.sub || 0), mn = p => st(p) * 90 + (p.s.sub || 0) * 25, ga = p => (p.s.g || 0) + (p.s.a || 0);
  const per90 = p => mn(p) >= 270 ? ga(p) / mn(p) * 90 : null, atClub = p => (p.cs || {})[c.id] || [0, 0, 0];
  const top = k => Math.max(0, ...ps.map(p => p.s[k] || 0));
  const tg = top("g"), ta = top("a"), tot = { app: sum(ps, p => p.s.app || 0), g: sum(ps, p => p.s.g || 0), a: sum(ps, p => p.s.a || 0) };
  return `<p class="small" style="margin-bottom:8px">This season: <b>${tot.g}</b> goals and <b>${tot.a}</b> assists from the squad${tg ? ` · top scorer ${esc(ps.find(p => p.s.g === tg).name)} (${tg})` : ""}${ta ? ` · most assists ${esc(ps.find(p => p.s.a === ta).name)} (${ta})` : ""}.</p>
  ${sortTable("squad-stats", [
    { k: "name", l: "Player", left: true, v: p => p.name, f: p => `<button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button>${wkChip(p)} ${xi.has(p.id) ? '<span class="chip xi" title="First-choice XI">XI</span>' : ""}${p.acad ? '<span class="chip acad">ACAD</span>' : ""}` },
    { k: "pos", l: "Pos", v: p => POS.indexOf(p.pos) * 1000 - p.ovr, f: p => `<span class="pos">${p.pos}</span>` },
    { k: "age", l: "Age", r: true, v: p => p.age, f: p => p.age },
    { k: "st", l: "Starts", r: true, v: st, f: st },
    { k: "sub", l: "Sub", r: true, v: p => p.s.sub || 0, f: p => p.s.sub || 0 },
    { k: "min", l: "Mins", r: true, v: mn, f: p => mn(p).toLocaleString("en-GB") },
    { k: "g", l: "Gls", r: true, v: p => p.s.g || 0, f: p => p.s.g ? `<b>${p.s.g}</b>` : 0 },
    { k: "a", l: "Ast", r: true, v: p => p.s.a || 0, f: p => p.s.a || 0 },
    { k: "ga", l: "G+A", r: true, v: ga, f: ga },
    { k: "p90", l: "G+A /90", r: true, v: p => per90(p) ?? -1, f: p => per90(p) == null ? `<span class="muted">—</span>` : per90(p).toFixed(2) },
    { k: "form", l: "Form", left: true, v: p => p.s.app >= 10 ? seasonForm(p) : -9, f: p => { if ((p.s.app || 0) < 10) return `<span class="small muted">too few games</span>`; const f = seasonForm(p), w = f >= 1.2 ? "exceptional" : f >= .5 ? "very good" : f >= .15 ? "good" : f <= -.5 ? "poor" : f <= -.15 ? "below par" : "steady"; return `<span class="small ${f >= .15 ? "good" : f <= -.15 ? "bad" : "muted"}">${w}</span>`; } },
    { k: "club", l: "For us", r: true, v: p => atClub(p)[0], f: p => `<span class="small">${atClub(p)[0]} · ${atClub(p)[1]}g · ${atClub(p)[2]}a</span>` },
    { k: "car", l: "Career", r: true, v: p => (p.tot || [0])[0] + (p.s.app || 0), f: p => `<span class="small">${(p.tot || [0, 0])[0] + (p.s.app || 0)} · ${(p.tot || [0, 0])[1] + (p.s.g || 0)}g</span>` },  // past seasons plus this one
  ], ps, { sort: { k: "min", d: -1 } })}
  <p class="small muted" style="margin-top:8px">All competitions this season. Minutes: 90 a start, about 25 off the bench. G+A /90 needs three games' worth of minutes; form needs ten games (judged on goal threat for his position, and on playing every week for keepers and centre-backs). "For us": games, goals and assists for the club in all seasons; "Career": games and goals everywhere.</p>`;
}

// A report laid out as a table (targets): each row [what, level, result, met?], then a summary line.
function msgRows(x) {
  // Stacked, one block a target: readable on a phone. Status on the first line, level and result underneath.
  return `<div class="stack" style="gap:6px;margin-top:6px">${x.rows.map(([what, lvl, res, ok, eff]) => `<div style="border-top:1px solid var(--line, rgba(127,127,127,.25));padding-top:6px">
    <div class="row between" style="gap:8px;align-items:flex-start;flex-wrap:nowrap"><span class="small" style="font-weight:600;flex:1;min-width:0">${esc(what)}</span><span class="small ${ok === "ok" ? "muted" : ok ? "good" : "bad"}" style="white-space:nowrap">${ok === "ok" ? "≈ fine" : ok ? "✓ met" : "✗ missed"}</span></div>
    <div class="small muted">${esc(lvl || "")}${res ? `${lvl ? " · " : ""}result: <b style="color:var(--ink, inherit)">${esc(res)}</b>` : ""}</div>${eff ? `<div class="small ${/^[−]|: −/.test(eff) || /^−/.test(eff) ? "bad" : /^\+/.test(eff) ? "good" : "muted"}">Effect: ${esc(eff)}</div>` : ""}</div>`).join("")}</div>${x.foot ? [].concat(x.foot).map(f => `<p class="small" style="margin-top:8px">${esc(f)}</p>`).join("") : ""}`;
}

/* Target reports saved before the new layout were plain sentences: split them back into rows. Staff lines read
   "Role: target value (level): result, met|missed[, beating the X level]"; club lines "target (level): met|missed[, reaching
   the X level]". Anything that doesn't match stays as text. */
function oldObjRows(x) {
  const parts = String(x.body || "").split(/\.\s+(?=[A-Z0-9€])/).map(t => t.replace(/\.$/, "").trim()).filter(Boolean), rows = [], rest = [];
  const cap = w => w ? w[0].toUpperCase() + w.slice(1) : "";
  for (const t of parts) {
    let m = t.match(/^(.*) \((modest|fair|ambitious|hardest)\): (.*?), (met|missed)(?:, (?:beating|reaching) the (\w+) level)?$/i);
    if (m) { rows.push([m[1], cap(m[2]) + (m[5] ? ` · reached ${m[5]}` : ""), m[3], m[4].toLowerCase() === "met"]); continue; }
    m = t.match(/^(.*) \((modest|fair|ambitious|hardest)\): (met|missed)(?:, (?:beating|reaching) the (\w+) level)?$/i);
    if (m) { rows.push([m[1], cap(m[2]) + (m[4] ? ` · reached ${m[4]}` : ""), "", m[3].toLowerCase() === "met"]); continue; }
    rest.push(t);
  }
  if (rows.length) { x.rows = rows; if (rest.length) x.foot = rest.join(". ") + "."; }
}

/* Suggested loans: players 23 or under with potential at least a typical starter's in your division (your manager's
   estimate) who neither start nor are first backup in their position. Games elsewhere will do them more good. */
function loanSuggestions(c) {
  const out = new Map(), form = FORMS[mgr().form || "4-4-2"] || [], xi = pickXI(c), inXI = new Set(xi.map(o => o.p.id));
  const bar = TIER_XI[c.tier] + ((G.lvlAdj || [])[c.tier] || 0) - 2;  // about a typical starter here
  for (const pos of POS) {
    const slots = form.filter(x => x === pos).length;
    const depth = c.squad.map(P).filter(p => p && p.pos === pos && !p.acad && !(p.loan && p.loan.to === c.id)).sort((a, b) => b.ovr - a.ovr);
    const bench = depth.filter(p => !inXI.has(p.id));  // the first of these is first backup (if the formation uses the position)
    bench.forEach((p, i) => {
      if (p.age > 23 || p.loan || p.agreed || (slots && i === 0)) return;
      const [lo, hi] = potEstimate(p); if ((lo + hi) / 2 < bar) return;
      out.set(p.id, { order: slots ? i + slots + 1 : null, why: slots ? `${ORD(i + slots + 1)} choice ${POS_NAME[pos].toLowerCase()}` : `your ${mgr().form || "4-4-2"} has no ${POS_NAME[pos].toLowerCase()}` });
    });
  }
  return out;
}
function loanSuggestTable(c, ps, LS) {
  return `<p class="small" style="margin-bottom:8px">Young players with the potential to start at this level who aren't starting or first backup: a season of games on loan will do them more good. Put them on the loan list and clubs at their level will make offers${c.tier >= 5 ? " (non-league loans run all season)" : " while a window is open"}.</p>
  ${sortTable("squad-sugloan", [
    { k: "name", l: "Player", left: true, v: p => p.name, f: p => `<button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button>${wkChip(p)}${p.loanList ? ' <span class="chip acad">LOAN LIST</span>' : ""}` },
    { k: "pos", l: "Pos", v: p => POS.indexOf(p.pos), f: p => `<span class="pos">${p.pos}</span>` },
    { k: "age", l: "Age", r: true, v: p => p.age, f: p => p.age },
    { k: "ovr", l: "Rating", v: p => p.ovr, f: p => rating(p.ovr) },
    { k: "pot", l: "Potential", v: p => potEstimate(p)[1], f: p => range(potEstimate(p)) },
    { k: "depth", l: "Place in the side", left: true, v: p => LS.get(p.id).order ?? 99, f: p => `<span class="small">${esc(LS.get(p.id).why)}</span>` },
    { k: "app", l: "Apps", r: true, v: p => p.s.app || 0, f: p => p.s.app || 0 },
    { k: "act", l: "", f: p => `<button class="btn sm ${p.loanList ? "" : "primary"}" data-act="sugloan" data-id="${p.id}">${p.loanList ? "Take off loan list" : "Put on loan list"}</button>` },
  ], ps, { sort: { k: "pot", d: -1 } })}`;
}
