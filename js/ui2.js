/* Pages for the boardroom, the network, cups and rival owners, and the pieces they add to other pages. */
"use strict";

const pctTxt = v => `${Math.round(v)}%`;
const moodBar = v => `<span class="fbar" style="display:inline-block;width:80px;vertical-align:middle"><i style="width:${v}%;background:${v >= 60 ? "var(--win)" : v >= 35 ? "var(--accent)" : "var(--loss)"}"></i></span>`;

/* ---------- Board ---------- */
function pgBoard() {
  const c = my(), B = G.board, T = G.sTrust, v = valuation(c);
  const offers = B.offers || [];
  const own = `<section class="card"><div class="card-h"><h2>Ownership</h2><span class="num">Club valued at ${money(v)}</span></div>
    <dl class="ledger"><dt>${esc(G.owner.name)} (you)</dt><dd>${B.own}%</dd>${B.inv.map(i => `<dt>${esc(i.name)} <span class="small">· ${INVESTOR[i.type].l}${i.rival ? ` (${OWNER_STYLES[i.rival].l.toLowerCase()})` : ""}</span></dt><dd>${i.pct}%</dd>`).join("")}</dl>
    <p class="small muted" style="margin:10px 0">You keep control while you hold more than half. Investors judge you every summer. If unhappy investors hold a quarter of the club between them, they can block big building projects and loans.</p>
    ${B.inv.length ? `<div class="stack" style="gap:8px">${B.inv.map((i, idx) => `<div class="row between offer"><span><b>${esc(i.name)}</b> · ${i.pct}% · paid ${money(i.amt)}<br><span class="small muted">${INVESTOR[i.type].d}</span></span><span class="row">${moodBar(i.mood)}<button class="btn sm" data-act="buyback" data-i="${idx}" ${G.owner.wealth < buyBackPrice(i) ? "disabled" : ""}>Buy back (${money(buyBackPrice(i))})</button></span></div>`).join("")}</div>` : ""}
    <div class="row" style="margin-top:10px"><button class="btn" data-act="seekinv" ${B.own <= 56 ? "disabled" : ""}>Look for investors</button></div>
    ${offers.length ? `<div class="stack" style="margin-top:10px;gap:8px">${offers.map((o, i) => `<div class="row between offer"><span><b>${esc(o.name)}</b> · ${INVESTOR[o.type].l}<br><span class="small muted">${INVESTOR[o.type].d}</span></span><span class="row"><b class="num">${money(o.amt)} for ${o.pct}%</b><button class="btn sm primary" data-act="sellstake" data-i="${i}">Accept</button></span></div>`).join("")}</div>` : ""}</section>`;
  const dirs = `<section class="card"><div class="card-h"><h2>Directors</h2></div><p class="small muted" style="margin-bottom:8px">Business-side staff. Their skill is out of 20.</p>
    ${Object.entries(DIRECTORS).map(([k, D]) => { const d = B.dir[k]; return `<div class="row between offer"><span><b>${D.l}</b><br><span class="small muted">${D.d}</span></span>${d ? `<span class="row"><span>${esc(d.name)} · ${attr20(d.skill)} · ${money(d.wage)}/yr</span><button class="btn sm danger" data-act="firedir" data-k="${k}">Dismiss</button></span>` : `<button class="btn sm" data-act="dircands" data-k="${k}">Find one</button>`}</div>`; }).join("")}</section>`;
  const trustC = `<section class="card"><div class="card-h"><h2>Supporters' trust</h2><span>${moodBar(T.rel)} <span class="small muted">relations ${Math.round(T.rel)}</span></span></div>
    <dl class="ledger"><dt>Members</dt><dd>${T.members.toLocaleString()}</dd><dt>Seat on the board</dt><dd>${T.seat ? "Yes" : "No"}</dd>${T.freeze ? `<dt>Ticket price freeze</dt><dd>${seasonLabel(T.freeze)}</dd>` : ""}${T.u18 ? `<dt>Under-18 tickets</dt><dd>Half price</dd>` : ""}</dl>
    <p class="small muted" style="margin:10px 0">The organised fans. They make demands through the season. When supporters are angry and relations are poor, they protest at home games: smaller crowds and bad headlines.</p>
    <div class="row"><button class="btn sm" data-act="meettrust" ${T.met === G.year ? "disabled" : ""}>Meet the trust${T.met === G.year ? " (done this year)" : ""}</button>${!T.seat ? `<button class="btn sm" data-act="trustseat">Offer them a board seat</button>` : ""}</div></section>`;
  const so = G.saleOffers || [];
  const sale = `<section class="card"><div class="card-h"><h2>Sell the club</h2></div><p class="small muted" style="margin-bottom:8px">Sell your ${B.own}% and buy another club with the money. The investors, loans and debts stay with this club.</p>
    ${so.length ? `<div class="stack" style="gap:8px">${so.map((o, i) => `<div class="row between offer"><span><b>${esc(o.name)}</b><br><span class="small muted">${OWNER_STYLES[o.style].l}: ${OWNER_STYLES[o.style].d}</span></span><span class="row"><b class="num">${money(o.amt)}</b><button class="btn sm danger" data-act="acceptsale" data-i="${i}">Sell</button></span></div>`).join("")}</div>` : `<button class="btn" data-act="putsale">Put the club up for sale</button>`}
    ${(G.career || []).length ? `<h3 style="margin:12px 0 6px">Clubs you've owned</h3>${G.career.map(x => `<p class="small">${esc(x.club)}, ${x.from}–${x.to}: sold to ${esc(x.by)} for ${money(x.sold)}</p>`).join("")}` : ""}</section>`;
  return `<div class="grid2"><div class="stack">${visionCard()}${objectivesCard()}${own}</div><div class="stack">${trustC}${dirs}${sale}</div></div>`;
}
function objectivesCard() {
  const o = G.obj && G.obj.y === G.year ? G.obj : null, canSet = G.phase === "summer";
  if (!canSet || o) {
    const c = my();
    return `<section class="card"><div class="card-h"><h2>This season's targets</h2>${o && G.phase === "summer" ? `<button class="btn sm" data-act="objreset">Change</button>` : ""}</div>
      ${o ? `<dl class="ledger">${Object.entries(OBJ).map(([k, D]) => `<dt>${D.l}</dt><dd>${D.opts[o[k]]}</dd>`).join("")}<dt>Squad suggests</dt><dd>${ord(o.exp)} place</dd>${G.phase === "season" ? `<dt>Now</dt><dd>${ord(posOf(c.lg, c.id))}</dd>` : ""}</dl>` : `<p class="muted">No targets were set this season. Set them in pre-season.</p>`}</section>`;
  }
  return `<section class="card summary"><div class="card-h"><h2>Set this season's targets</h2></div>
    <p class="small muted" style="margin-bottom:10px">They're announced to the fans. Ambitious targets lift spirits now and hurt more if missed. The squad currently looks like a ${ord(expectedPos())}-place side. The manager will say if he thinks a target is unrealistic.</p>
    <div class="price-grid">${Object.entries(OBJ).map(([k, D]) => `<label class="small"><b>${D.l}</b><select id="obj-${k}">${Object.entries(D.opts).map(([v, l]) => `<option value="${v}" ${v === "none" ? "selected" : ""}>${l}${k === "lg" && v !== "none" ? ` (${ord(lgTarget(v, my().lg))} or better)` : ""}</option>`).join("")}</select></label>`).join("")}</div>
    <div class="row" style="margin-top:10px"><button class="btn primary" data-act="setobj">Announce targets</button></div></section>`;
}
function dirModal(k) {
  const list = directorCands(k); DIRC = list;
  modal(`<div class="modal-h"><div><p class="eyebrow">Candidates</p><h2>${DIRECTORS[k].l}</h2></div><button class="btn modal-x" data-act="close">✕</button></div>
    <div class="modal-b">${list.map((d, i) => `<div class="row between offer"><span><b>${esc(d.name)}</b><br>${attr20(d.skill)}</span><span class="row"><span class="num">${money(d.wage)}/yr</span><button class="btn sm primary" data-act="hiredir" data-i="${i}">Appoint</button></span></div>`).join("")}</div>`);
}
let DIRC = [];

/* ---------- Network ---------- */
function pgNet() {
  const c = my(), N = net(), pt = N.partner && CL(N.partner.id);
  const partner = `<section class="card"><div class="card-h"><h2>Partner club</h2></div>
    <p class="small muted" style="margin-bottom:10px">A club at least two divisions above you. Each window they offer young players on loan (you pay half the wages). In return they get a first look at your best youngsters.</p>
    ${pt ? `<div class="row between"><span>${crest(pt, 22)} ${clubLink(pt)} · ${LEAGUES[pt.lg].name}<br><span class="small muted">since ${N.partner.since}</span></span><span class="row">${moodBar(N.partner.rel)}<button class="btn sm danger" data-act="endpartner">End</button></span></div>` :
      c.tier <= 2 ? `<p class="muted">There's no division two above you.</p>` : N.asked === G.year ? `<p class="muted">You've approached a club this year already.</p>` :
      `<div class="stack" style="gap:6px">${partnerCands().slice(0, 8).map(x => `<div class="row between offer"><span>${crest(x, 18)} ${clubLink(x)} <span class="small muted">${LEAGUES[x.lg].name}${x.own ? " · " + OWNER_STYLES[x.own.style].l.toLowerCase() : ""}</span></span><span class="row"><span class="small muted">${pctTxt(partnerChance(x) * 100)} chance</span><button class="btn sm" data-act="approach" data-id="${x.id}">Approach</button></span></div>`).join("")}</div><p class="small muted">One approach a year.</p>`}</section>`;
  const feeders = `<section class="card"><div class="card-h"><h2>Feeder clubs</h2><span class="small muted">${N.feeders.length} of ${MAX_FEEDERS}</span></div>
    <p class="small muted" style="margin-bottom:10px">Clubs in lower divisions that you fund. The money raises their standard and facilities each summer. They take your young players on loan first (they pay half the wages), and they give you first refusal on their best youngsters at a discount that grows with the relationship.</p>
    ${N.feeders.map(f => { const x = CL(f.id), out = (G.loanList || []).map(id => G.players[id]).filter(p => p && p.loan && p.loan.to === x.id && p.loan.from === c.id);
      return `<div class="offer"><div class="row between"><span>${crest(x, 18)} ${clubLink(x)} <span class="small muted">${LEAGUES[x.lg].name} · standard ${r20(x.lvl)}</span></span><span class="row">${moodBar(f.rel)}<button class="btn sm danger" data-act="dropfeeder" data-id="${x.id}">End</button></span></div>
        <div class="row small" style="margin-top:6px"><label>Funding €/yr <input type="number" inputmode="decimal" class="num-in" data-act="ffund" data-id="${x.id}" value="${f.fund}" step="5000"></label><span class="muted">${out.length ? "On loan there: " + out.map(p => esc(p.name)).join(", ") : "None of your players there."}</span></div></div>`; }).join("")}
    ${N.feeders.length < MAX_FEEDERS ? (feederCands().length ? `<h3 style="margin:12px 0 6px">Add a feeder</h3><div class="stack" style="gap:6px">${feederCands().slice(0, 8).map(x => `<div class="row between offer"><span>${crest(x, 18)} ${clubLink(x)} <span class="small muted">${LEAGUES[x.lg].name}</span></span><button class="btn sm" data-act="addfeeder" data-id="${x.id}">Make a feeder</button></div>`).join("")}</div>` : `<p class="muted">No division below you to recruit feeders from yet.</p>`) : ""}
    <p class="small muted" style="margin-top:8px">Loan a player out from his page in the Squad tab.</p></section>`;
  return `<div class="grid2"><div class="stack">${feeders}</div><div class="stack">${partner}</div></div>`;
}

/* ---------- Competitions: league and cups ---------- */
function pgComps() {
  const tab = SUB.comp || "league", mineCups = Object.keys(CUP_DEF).filter(k => CUP_DEF[k].tiers.includes(my().tier));
  const tabs = `<div class="seg" style="margin-bottom:12px"><button data-act="sub" data-k="comp" data-v="league" aria-pressed="${tab === "league"}">League</button>${Object.keys(CUP_DEF).map(k => `<button data-act="sub" data-k="comp" data-v="${k}" aria-pressed="${tab === k}">${CUP_DEF[k].name}${mineCups.includes(k) ? "" : " ·"}</button>`).join("")}</div>`;
  if (tab === "league") return tabs + pgLeagueInner();
  const K = (G.cups || {})[tab], D = CUP_DEF[tab]; if (!K) return tabs + `<p class="muted">Not started.</p>`;
  const rounds = [...new Set(K.log.map(x => x.r))];
  const tieRow = (t, done) => { const mine = t.h === G.club || t.a === G.club; return `<div class="row between small ${mine ? "me-row" : ""}"><span>${esc(CL(t.h).name)} <span class="muted">(${CL(t.h).tier})</span></span><b class="num">${done ? `${t.hg}–${t.ag}${t.pens ? " p" : ""}` : "v"}</b><span style="text-align:right">${esc(CL(t.a).name)} <span class="muted">(${CL(t.a).tier})</span></span></div>`; };
  return tabs + `<div class="grid2"><div class="stack">
    ${K.ties && K.win == null ? `<section class="card"><div class="card-h"><h2>${K.name}</h2><span class="small muted">week ${D.weeks[K.round] + 1}</span></div>${K.ties.filter(t => t.h === G.club || t.a === G.club).map(t => tieRow(t)).join("")}<details><summary class="small">All ${K.ties.length} ties</summary>${K.ties.map(t => tieRow(t)).join("")}</details></section>` : ""}
    ${K.win != null ? `<section class="card summary"><h2>🏆 ${esc(CL(K.win).name)}</h2></section>` : ""}
    ${rounds.reverse().map(r => { const ts = K.log.filter(x => x.r === r), mine = ts.filter(t => t.h === G.club || t.a === G.club); return `<section class="card"><div class="card-h"><h3>${r}</h3></div>${mine.map(t => tieRow(t, true)).join("")}${ts.length > 4 ? `<details><summary class="small">All results</summary>${ts.map(t => tieRow(t, true)).join("")}</details>` : ts.filter(t => !mine.includes(t)).map(t => tieRow(t, true)).join("")}</section>`; }).join("")}
  </div><div class="stack"><section class="card"><div class="card-h"><h3>${D.name}</h3></div><p class="small">${D.tiers.length === 7 ? "Every club in the pyramid" : "Tiers " + D.tiers[0] + "–" + D.tiers[D.tiers.length - 1]}. One-off ties, penalties if level.</p>
    <dl class="ledger" style="margin-top:8px">${D.prize.map((p, i) => `<dt>Win in round ${i + 1}</dt><dd>${money(p)}</dd>`).join("")}<dt>Winners</dt><dd>${money(D.win)}</dd></dl>
    ${G.cupsLast && G.cupsLast[tab] && G.cupsLast[tab].win != null ? `<p class="small muted" style="margin-top:8px">Last season: ${esc(CL(G.cupsLast[tab].win).name)}</p>` : ""}</section></div></div>`;
}

/* ---------- Rival owners ---------- */
function pgRivals() {
  const c = my(), mine = G.leagues[c.lg].clubs.map(CL).filter(x => !isMine(x));
  const rich = G.clubs.filter(x => !x.gone && x.own && !isMine(x)).sort((a, b) => b.own.wealth - a.own.wealth).slice(0, 10);
  const row = x => `<tr class="click" data-act="club" data-id="${x.id}"><td style="text-align:left">${crest(x, 14)} ${esc(x.name)}${isDerby(c, x) ? ' <span class="chip rival">DERBY</span>' : ""}${x.own.target === c.id ? ' <span class="chip rival r3">HOSTILE</span>' : ""}</td><td style="text-align:left" class="small">${esc(x.own.name)}</td><td style="text-align:left"><span class="chip list">${OWNER_STYLES[x.own.style].l}</span></td><td class="num">${x.own.wealth ? money(x.own.wealth) : "—"}</td><td class="num">${x.own.since}</td><td class="small">${LEAGUES[x.lg].name}</td></tr>`;
  const head = `<thead><tr><th style="text-align:left">Club</th><th style="text-align:left">Owner</th><th style="text-align:left">Style</th><th>Fortune</th><th>Since</th><th>Division</th></tr></thead>`;
  const h = hostileOf(c);
  return `${h ? `<section class="card summary" style="margin-bottom:16px"><div class="card-h"><h2>Hostile neighbour: ${esc(h.name)}</h2></div><p>${esc(h.own.name)} bought ${esc(h.name)} in ${h.own.since} to beat you. Expect approaches for your staff and bids for your players, fewer local sponsors and a fight for supporters.</p></section>` : ""}<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>Your division's owners</h2></div><div class="tbl-wrap"><table class="sq">${head}<tbody>${mine.map(row).join("")}</tbody></table></div></section>
    <section class="card"><div class="card-h"><h2>The richest owners</h2></div><div class="tbl-wrap"><table class="sq">${head}<tbody>${rich.map(row).join("")}</tbody></table></div></section></div>
    <div class="stack"><section class="card"><div class="card-h"><h3>Owner styles</h3></div>${Object.values(OWNER_STYLES).map(s => `<p class="small" style="margin-bottom:6px"><b>${s.l}.</b> ${s.d}</p>`).join("")}
    <p class="small muted">Owners with deep pockets and big profiles near you take local sponsorship from you. Ambitious owners above you come for your staff and pay over the odds for your players. Clubs change hands in takeovers every summer.</p></section></div></div>`;
}

/* ---------- pieces for other pages ---------- */
function weatherLine() {
  const c = my(), now = G.wx && WX[G.wx[c.half]], nx = G.wxNext && WX[G.wxNext[c.half]];
  return `<p class="small muted">${now ? `Weather: ${now.ico} ${now.l}` : ""}${nx ? ` · next week ${nx.ico} ${nx.l.toLowerCase()}${nx.off && !hasHeating(c) ? ' <span class="warn">(home games at risk)</span>' : ""}` : ""}</p>`;
}
function choiceHTML(x) {
  return `<div class="decision"><b>${esc(x.title)}</b>${x.body ? `<p class="small">${esc(x.body)}</p>` : ""}<div class="row" style="margin-top:6px">${x.opts.map((o, i) => `<button class="btn sm ${i === x.dflt ? "" : ""}" data-act="choose" data-id="${x.id}" data-i="${i}">${esc(o)}</button>`).join("")}<span class="small muted">If you don't answer: “${esc(x.opts[x.dflt])}”</span></div></div>`;
}
function loansCard() {
  const c = my(), t = loanTerms(100000, 5);
  return `<section class="card"><div class="card-h"><h2>Borrowing</h2><span class="small muted">Debt ${money(debtOf())}</span></div>
    ${(G.loans || []).length ? `<div class="stack" style="gap:6px">${G.loans.map(l => `<div class="row between offer"><span><b>${esc(l.lender)}</b>: ${money(l.amt)} at ${(l.rate * 100).toFixed(1)}% from ${l.y}<br><span class="small muted">${money(l.left)} left · ${money(l.weekly)} a week</span></span><button class="btn sm" data-act="repayloan" data-id="${l.id}">Pay off (${money(l.left * 1.02)})</button></div>`).join("")}</div>` : `<p class="muted small">No bank loans.</p>`}
    <p class="small muted" style="margin:10px 0">The bank will lend up to ${money(t.max)} more, against what the club is worth${c.fac.stadium.own ? " (more with your own ground)" : ""}. Rates rise with your debt, and a finance director brings them down. An overdraft beyond the bank's limit for eight weeks means administration: ten points docked and your best players sold.</p>
    <div class="row"><label class="small">Borrow € <input type="number" inputmode="decimal" class="num-in" id="ln-amt" value="${Math.min(t.max, 100000)}" step="10000"></label><label class="small">over <select id="ln-yrs">${[3, 5, 10, 20].map(y => `<option ${y === 5 ? "selected" : ""}>${y}</option>`).join("")}</select> years</label><button class="btn sm" data-act="loanq">See terms</button></div>
    <h3 style="margin:14px 0 6px">Your own loans to the club</h3><p class="small">Lent so far: ${money(G.owner.lent || 0)} (interest-free; take it back when the club can afford it).</p>
    <div class="row" style="margin-top:6px"><input type="number" inputmode="decimal" class="num-in" id="ol-amt" placeholder="Amount" step="10000"><button class="btn sm" data-act="olend">Lend</button><button class="btn sm" data-act="orecall">Take back</button></div></section>`;
}
function endScreen() {
  const e = G.ended, c = my();
  return `<div class="wrap gut"><div class="hero"><p class="eyebrow">${seasonLabel(e.y)}</p><h1>You sold <span>${esc(c.name)}</span></h1>
    <p>For ${money(e.amt)} to a ${OWNER_STYLES[e.style].l.toLowerCase()}. You founded the club in ${c.founded} with nothing; you leave it in the ${LEAGUES[c.lg].name}, with ${c.fans.toLocaleString()} supporters and ${c.trophies.length} trophies. You put in ${money(G.owner.invested)}; your fortune is now ${money(G.owner.wealth)}.</p></div>
    <div class="row"><button class="btn primary" data-act="quit">Back to the start</button></div></div>`;
}

/* ---------- between clubs: buy one ---------- */
let BUYF = { tier: 0, afford: true };
function buyScreen() {
  const w = G.owner.wealth, list = G.clubs.filter(c => !c.gone && c.own && (!BUYF.tier || c.tier === BUYF.tier)).map(c => ({ c, p: askPrice(c) })).filter(x => x.p && (!BUYF.afford || x.p <= w)).sort((a, b) => a.c.tier - b.c.tier || b.p - a.p).slice(0, 80);
  const last = (G.career || []).slice(-1)[0];
  return `<div class="wrap gut page"><div class="hero"><p class="eyebrow">${seasonLabel(G.year)} · between clubs</p><h1>Buy <span>a club</span></h1>
    <p>${last ? `You sold ${esc(last.club)} for ${money(last.sold)}. ` : ""}Your fortune: <b>${money(w)}</b>. You get the club as it stands: squad, manager, ground, facilities and sponsors. Supporter-owned clubs and hostile owners won't sell.</p></div>
    <section class="card"><div class="row filters" style="margin-bottom:10px"><select data-act="buyf" data-k="tier"><option value="0">All divisions</option>${[1, 2, 3, 4, 5, 6, 7].map(t => `<option value="${t}" ${BUYF.tier === t ? "selected" : ""}>${TIER_NAME[t]}</option>`).join("")}</select>
      <label class="small"><input type="checkbox" data-act="buyf" data-k="afford" ${BUYF.afford ? "checked" : ""}> Only clubs I can afford</label></div>
    <div class="tbl-wrap"><table class="sq"><thead><tr><th style="text-align:left">Club</th><th style="text-align:left">Division</th><th>Ground</th><th>Fans</th><th>Team</th><th style="text-align:left">Owner</th><th>Price</th><th></th></tr></thead><tbody>
    ${list.map(({ c, p }) => `<tr><td style="text-align:left">${crest(c, 14)} <button class="lnk" data-act="club" data-id="${c.id}">${esc(c.name)}</button></td><td style="text-align:left" class="small">${LEAGUES[c.lg].name}</td><td class="num">${c.cap.toLocaleString()}</td><td class="num">${c.fans.toLocaleString()}</td><td>${rating(avg(pickXI(c).map(o => o.p.ovr)))}</td><td style="text-align:left" class="small">${OWNER_STYLES[c.own.style].l}</td><td class="num">${money(p)}</td><td><button class="btn sm primary" data-act="buyclub" data-id="${c.id}" ${p > w ? "disabled" : ""}>Buy</button></td></tr>`).join("") || `<tr><td colspan="8" class="muted">No clubs for sale at this price.</td></tr>`}</tbody></table></div></section></div>`;
}

/* ---------- your vision ---------- */
function visionCard() {
  const v = vision(), used = sum(Object.values(v.pri)), left = VISION_POINTS - used;
  return `<section class="card"><div class="card-h"><h2>Your vision</h2><span class="small ${left ? "warn" : "muted"}">${left} of ${VISION_POINTS} points left</span></div>
    <p class="small muted" style="margin-bottom:10px">What matters to you as owner. Staff who share your ideas are keener to join and grow happier working for you; staff who don't slowly sour. Each priority point also brings a small benefit in that area.</p>
    <div class="price-grid" style="margin-bottom:12px">
      <label class="small"><b>How the team should play</b><select data-act="vset" data-k="style"><option value="any">Whatever wins</option>${Object.entries(STYLES).map(([k, s]) => `<option value="${k}" ${v.style === k ? "selected" : ""}>${s.l}</option>`).join("")}</select></label>
      <label class="small"><b>How to recruit</b><select data-act="vset" data-k="recruit"><option value="any">Leave it to the experts</option>${Object.entries(ROLES_STAFF.recruit.phil).map(([k, s]) => `<option value="${k}" ${v.recruit === k ? "selected" : ""}>${s.l}</option>`).join("")}</select></label></div>
    <div class="stack" style="gap:8px">${Object.entries(PRIORITIES).map(([k, P]) => `<div class="row between offer"><span><b>${P.l}</b><br><span class="small muted">${P.d}</span></span>
      <span class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="vpri" data-k="${k}" data-d="-1" ${v.pri[k] ? "" : "disabled"} aria-label="Less">−</button><b class="num" style="min-width:3ch;text-align:center">${"●".repeat(v.pri[k])}${"○".repeat(4 - v.pri[k])}</b><button class="btn sm" data-act="vpri" data-k="${k}" data-d="1" ${left && v.pri[k] < 4 ? "" : "disabled"} aria-label="More">+</button></span></div>`).join("")}</div></section>`;
}
