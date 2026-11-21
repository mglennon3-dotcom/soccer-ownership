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
    ${offers.length ? `<div class="stack" style="margin-top:10px;gap:8px">${offers.map((o, i) => `<div class="row between offer"><span><b>${esc(o.name)}</b> · ${INVESTOR[o.type].l}<br><span class="small muted">${INVESTOR[o.type].d}</span></span><span class="row"><b class="num">${money(o.amt)} for ${o.pct}%</b><button class="btn sm primary" data-act="sellstake" data-i="${i}">Accept</button></span></div>${(() => { const imp = o.amt / (o.pct / 100), d = imp / v - 1;
      return `<p class="small" style="margin:-2px 0 4px 2px">Values the club at <b>${money(imp)}</b> <span class="${d >= .02 ? "good" : d <= -.02 ? "bad" : "muted"}">(${Math.abs(d) < .02 ? "about our own valuation" : `${Math.round(Math.abs(d) * 100)}% ${d > 0 ? "above" : "below"} our ${money(v)}`})</span>. You'd keep ${B.own - o.pct}%, worth about ${money(imp * (B.own - o.pct) / 100)} at that price.</p>`; })()}`).join("")}</div>` : ""}</section>`;
  const trustC = `<section class="card"><div class="card-h"><h2>Supporters' trust</h2><span>${moodBar(T.rel)} <span class="small muted">relations ${Math.round(T.rel)}</span></span></div>
    <dl class="ledger"><dt>Members</dt><dd>${T.members.toLocaleString("en-GB")}</dd><dt>Seat on the board</dt><dd>${T.seat ? "Yes" : "No"}</dd>${T.freeze ? `<dt>Ticket price freeze</dt><dd>${seasonLabel(T.freeze)}</dd>` : ""}${T.u18 ? `<dt>Under-18 tickets</dt><dd>Half price</dd>` : ""}</dl>
    <p class="small muted" style="margin:10px 0">The organised fans. They make demands through the season. When supporters are angry and relations are poor, they protest at home games: smaller crowds and bad headlines.</p>
    <div class="row"><button class="btn sm" data-act="meettrust" ${T.met === G.year ? "disabled" : ""}>Meet the trust${T.met === G.year ? " (done this year)" : ""}</button>${!T.seat ? `<button class="btn sm" data-act="trustseat">Offer them a board seat</button>` : ""}</div></section>`;
  const so = G.saleOffers || [];
  const sale = `<section class="card"><div class="card-h"><h2>Sell the club</h2></div><p class="small muted" style="margin-bottom:8px">Sell your ${B.own}% and buy another club with the money. The investors, loans and debts stay with this club.</p>
    ${so.length ? `<div class="stack" style="gap:8px">${so.map((o, i) => `<div class="row between offer"><span><b>${esc(o.name)}</b><br><span class="small muted">${OWNER_STYLES[o.style].l}: ${OWNER_STYLES[o.style].d}</span></span><span class="row"><b class="num">${money(o.amt)}</b><button class="btn sm danger" data-act="acceptsale" data-i="${i}">Sell</button></span></div>`).join("")}</div>` : `<button class="btn" data-act="putsale">Put the club up for sale</button>`}
    ${(G.career || []).length ? `<h3 style="margin:12px 0 6px">Clubs you've owned</h3>${G.career.map(x => `<p class="small">${esc(x.club)}, ${x.from}–${x.to}: sold to ${esc(x.by)} for ${money(x.sold)}</p>`).join("")}` : ""}</section>`;
  return `<div class="grid2"><div class="stack">${visionCard()}${objectivesCard()}<p class="small muted" style="margin:-4px 0 4px">Staff targets are set on the <button class="lnk small" data-act="page" data-p="staff">Staff</button> page, one tab for each member of staff.</p>${own}</div><div class="stack">${trustC}${sale}</div></div>`;
}
function objectivesCard() {
  const o = G.obj && G.obj.y === G.year ? G.obj : null, canSet = G.phase === "summer";
  if (!canSet || o) {
    const c = my();
    return `<section class="card"><div class="card-h"><h2>This season's targets</h2>${o && G.phase === "summer" ? `<button class="btn sm" data-act="objreset">Change</button>` : ""}</div>
      ${o ? `<dl class="ledger">${Object.keys(OBJ).filter(k => o[k] && o[k] !== "none").map(k => `<dt>${objLabel(k)}</dt><dd>${objText(k, o[k])}${typeof o[k] === "number" ? ` <span class="small muted">· ${LVL_NAME[o[k]].toLowerCase()}</span>` : ""}</dd>`).join("")}<dt>Squad suggests</dt><dd>${ord(o.exp)} place</dd>${G.phase === "season" ? `<dt>Now</dt><dd>${ord(posOf(c.lg, c.id))}</dd>` : ""}</dl>` : `<p class="muted">No targets were set this season. Set them in pre-season.</p>`}</section>`;
  }
  const L = clubTargetLevels();
  return `<section class="card summary"><div class="card-h"><h2>Set this season's targets</h2></div>
    <p class="small muted" style="margin-bottom:10px">They're announced to the fans. Pick a level for each, or no target. The squad currently looks like a ${ord(expectedPos())}-place side; the manager will say if he thinks a league target is unrealistic.</p>
    <div class="price-grid">${Object.entries(L).map(([k, v]) => `<label class="small"><b>${objLabel(k)}</b><select id="obj-${k}">${LVL_NAME.map((n, i) => `<option value="${i}">${i ? `${n}: ${OBJ[k].txt(v[i - 1])}` : n}</option>`).join("")}</select></label>`).join("")}</div>
    <p class="small muted" style="margin-top:8px">Meeting a harder target raises the club's standing and wins more new supporters, the hardest most of all; falling short costs more the further short you finish. Finishing where the squad suggested (or better) is never a failure in the league, and beating it counts in your favour.</p>
    <div class="row" style="margin-top:10px"><button class="btn primary" data-act="setobj">Announce targets</button></div></section>`;
}


/* ---------- Network ---------- */
// A club's team average: its manager's first-choice eleven, on the 1-20 scale.
const teamAvg = x => { const xi = pickXI(x); return xi.length ? r20(avg(xi.map(o => roleRating(o.p, o.slot)))) : "—"; };
// The average of the team averages in a club's division (abroad: its country's league), worked out once a week.
let DIVAVG = { k: null, m: {} };
const divAvg = x => { const key = `${G.year}.${G.phase}.${G.week}`; if (DIVAVG.k !== key) DIVAVG = { k: key, m: {} };
  const g = x.abroad ? "c:" + x.country : "l:" + x.lg, ids = x.abroad ? G.foreign.filter(id => CL(id).country === x.country) : G.leagues[x.lg].clubs;
  return DIVAVG.m[g] ??= r20(avg(ids.map(CL).map(c => { const xi = pickXI(c); return xi.length ? avg(xi.map(o => roleRating(o.p, o.slot))) : 0; }).filter(Boolean))); };
const avgPair = x => `team average <b>${teamAvg(x)}</b> <span class="muted">(${x.abroad ? "league" : "division"} ${divAvg(x)})</span>`;
// The young players a partner club would lend you (outside its first team, at your level), best prospects first.
// A club's youth set-up at a glance: academy level, its youth manager's scouting (staff 1-20 scale) and reputation.
// A feeder's academy: its record with youth decides how good the youngsters it offers you on first refusal tend to be
// (it doesn't change how your players develop on loan there: that's its coaching and training ground).
const FEEDER_YOUTH = { good: "the youngsters it offers you on first refusal tend to be better", poor: "the youngsters it offers you on first refusal tend to be a little weaker" };
const youthLine = x => { const w = pedigreeWord(x); return `Academy level <b>${x.acadLvl || 0}</b>/10 · youth scouting <b>${sr20(aiYouthScout(x))}</b>${w ? ` · <span class="${w[1]}">${w[0].toLowerCase()}</span> <span class="small muted">(${w[1] === "good" ? FEEDER_YOUTH.good : FEEDER_YOUTH.poor})</span>` : ""}`; };
function partnerLendable(x, c = my()) { const xi = new Set(pickXI(x).map(o => o.p.id)); return x.squad.map(P).filter(q => !q.acad && !q.loan && q.age <= 23 && !xi.has(q.id) && lendsTo(q, c)).sort((a, b) => potEstimate(b)[1] - potEstimate(a)[1]); }
// A parent club's young players you could borrow: name and position on one line with what he'd cost you, his age,
// rating and potential (plain, so nothing wraps awkwardly on a phone) underneath.
function partnerLoanRows(x, avail, max) {
  const cost = (q, t) => !loansOpen() ? `<span class="muted">${pw(q.wage)}</span>` : t.no ? `<span class="muted">not this window</span>` : t.min <= 0 ? `<b class="good">Free</b>` : `<b>${Math.round(t.min * 100)}%</b> <span class="muted">· ${pw(q.wage * t.min)}</span>`;
  return `<div class="loanlist">${avail.slice(0, max).map(q => { const t = playerLoanTerms(q, x);
    return `<div class="loanrow"><div class="row between" style="gap:8px;flex-wrap:nowrap"><span style="min-width:0"><span class="pos">${q.pos}</span> <button class="lnk" data-act="player" data-id="${q.id}">${esc(q.name)}</button></span><span class="small" style="white-space:nowrap">${cost(q, t)}</span></div>
      <div class="small muted">${q.age} · rated <b>${est20(ovrEstimate(q))}</b> · potential <b>${est20(potEstimate(q))}</b> · wage ${pw(q.wage)}</div></div>`; }).join("")}${avail.length > max ? `<p class="small muted">…and ${avail.length - max} more.</p>` : ""}</div>`;
}
// Sorting the clubs you could take on as feeders.
/* Youth recruitment: who they bring in (academy level, youth scouting, their record with youngsters). Youth development:
   how fast young players grow there (training ground and the coach's skill at developing players, as growth reads them). */
const youthRecScore = x => (x.acadLvl || 0) * 6 + aiYouthScout(x) * .4 + youthPedigree(x) * 3;
const youthDevF = x => { const e = envOf(x); return .62 + e.train * .045 + e.dev * .004; };
const youthDev20 = x => clamp(Math.round((youthDevF(x) - .7) / .65 * 19 + 1), 1, 20);
const FEED_SORT = { div: (a, b) => a.tier - b.tier || b.rep - a.rep, cheap: (a, b) => feederAsk(a) - feederAsk(b), dear: (a, b) => feederAsk(b) - feederAsk(a), rec: (a, b) => youthRecScore(b) - youthRecScore(a), dev: (a, b) => youthDevF(b) - youthDevF(a), team: (a, b) => teamAvgN(b) - teamAvgN(a) };
const teamAvgN = x => avg(pickXI(x).map(o => o.p.ovr));
// Your prospects (23 or under, still growing, not in your first team) for whom a club's division is a real test: good
// enough to get games (no more than a point below its average starter), not so easy that growth slows.
function rightLevel(x) { const c = my(), xi = new Set(pickXI(c).map(o => o.p.id)), L = divLevel20(x);
  return c.squad.map(P).filter(q => q && q.age <= 23 && q.pot > q.ovr && !xi.has(q.id) && !q.loan && (!q.acad || q.age >= 16) && to20(q.ovr) >= L - 1 && challengeF(q, x) >= 1).sort((a, b) => b.pot - a.pot); }
function pgNet() {
  const c = my(), N = net(), PT = partners();
  const fsrt = FEED_SORT[SUB.fsort] ? SUB.fsort : "div", fees = sum(PT, p => CL(p.id) ? affilFee(CL(p.id)) : 0), cost = feederFunding();
  const money3 = `<p class="small" style="margin-bottom:10px">Partners pay you <b class="good">${money(fees)}</b> a year · feeders cost you <b class="bad">${money(cost)}</b> a year · net <b class="${fees - cost >= 0 ? "good" : "bad"}">${fees - cost >= 0 ? "+" : "−"}${money(Math.abs(fees - cost))}</b></p>`;
  // Finding a partner: filter by country, and for England by division.
  const cty = SUB.pcty || "", lg = SUB.plg || "", all = partnerCands();
  const srt = SUB.psort || "rep", list = all.filter(x => (!cty || (cty === "ENG" ? !x.abroad : x.country === cty)) && (!lg || x.lg === lg) && (!SUB.pcover || partnerCover(x) * 100 >= SUB.pcover - 1e-9))
    .sort(srt === "fee" ? (a, b) => affilFee(b) - affilFee(a) || b.rep - a.rep : srt === "yes" ? (a, b) => partnerChance(b) - partnerChance(a) || affilFee(b) - affilFee(a) : srt === "cover" ? (a, b) => partnerCover(b) - partnerCover(a) || affilFee(b) - affilFee(a) : (a, b) => b.rep - a.rep);
  const ctys = [...new Set(all.filter(x => x.abroad).map(x => x.country))];
  const lgs = [...new Set(all.filter(x => !x.abroad).map(x => x.lg))];
  const partner = `<section class="card"><div class="card-h"><h2>Partner clubs</h2><span class="small muted">${PT.length} of ${MAX_PARTNERS}</span></div>${money3}
    <p class="small muted" style="margin-bottom:10px">Bigger clubs you're a feeder to: any English club in a division above you, or a club abroad. Each pays you a yearly affiliation fee (more from a club abroad or in the Premier Division), and each window offers young players on loan, usually covering a set share of their wages (shown for each club; not guaranteed for every player). In return they can approach your best academy prospects (16–18) with a professional contract: you're warned in your inbox and can offer him a better deal, pay him to stay, or let him go for compensation.</p>
    ${PT.length ? `<div class="filters" style="margin-bottom:8px"><label class="f">Players on loan at<select data-act="plshare">${[[0, "Any wage share"], [20, "20% or less"], [10, "10% or less"], [0.001, "Free (they pay it all)"]].map(([v, l]) => `<option value="${v}" ${String(SUB.plshare || 0) === String(v) ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>` : ""}
    ${PT.map(p => { const x = CL(p.id), xi = new Set(pickXI(x).map(o => o.p.id)), avail = x.squad.map(P).filter(q => !q.acad && !q.loan && q.age <= 23 && !xi.has(q.id) && lendsTo(q, c) && (!SUB.plshare || playerLoanTerms(q, x).min * 100 <= SUB.plshare + 1e-9)).sort((a, b) => potEstimate(b)[1] - potEstimate(a)[1]), n = avail.length;
      // The young players they'd lend you: outside their first team and at your level. Tap one to ask for him.
      const list = n ? `<details style="margin-top:6px"><summary class="small">Players they'd lend you (${n})</summary>${partnerLoanRows(x, avail, 8)}<p class="small muted" style="margin-top:4px">Tap a player to ask to borrow him${loansOpen() ? "" : " when the window opens"}. They also offer one or two each window.</p></details>` : "";
      return `<div class="offer"><div class="row between"><span>${crest(x, 22)} ${clubLink(x)}<br><span class="small muted">${esc(clubWhere(x))} · ${avgPair(x)} · since ${p.since} · pays you ${money(affilFee(x))} a year · usually covers ${Math.round(partnerCover(x) * 100)}% of loan wages${n ? "" : SUB.plshare ? " · none on loan at that wage share" : " · no young players at your level yet"}</span></span><span class="row">${moodBar(p.rel)}<button class="btn sm danger" data-act="endpartner" data-id="${x.id}">End</button></span></div>${list}</div>`; }).join("")}
    ${PT.length >= MAX_PARTNERS ? "" : !all.length ? `<p class="muted">There's no club above you to partner with.</p>` : `<h3 style="margin:12px 0 6px">Find a partner</h3>
      <div class="filters"><label class="f">Country<select data-act="pcty"><option value="">Anywhere</option><option value="ENG" ${cty === "ENG" ? "selected" : ""}>England</option>${ctys.map(k => `<option value="${k}" ${cty === k ? "selected" : ""}>${esc(COUNTRY[k].name)}</option>`).join("")}</select></label>
        <label class="f">Loan wages they usually cover<select data-act="pcover">${[[0, "Any"], [80, "80% or more"], [100, "All of it"]].map(([v, l]) => `<option value="${v}" ${(SUB.pcover || 0) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="f">Sort by<select data-act="psort">${[["rep", "Best known"], ["fee", "Most money for you"], ["cover", "Covers most loan wages"], ["yes", "Likeliest to say yes"]].map(([k, l]) => `<option value="${k}" ${srt === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        ${cty === "ENG" ? `<label class="f">Division<select data-act="plg"><option value="">Any</option>${lgs.sort().map(k => `<option value="${k}" ${lg === k ? "selected" : ""}>${esc(LEAGUES[k].name)}</option>`).join("")}</select></label>` : ""}</div>
      <p class="small muted" style="margin:6px 0">${list.length} club${list.length === 1 ? "" : "s"}${list.length > 12 ? `: showing the top 12 (${{ rep: "best known", fee: "most money", cover: "covers most loan wages", yes: "likeliest to say yes" }[srt]})` : ""}. You can approach each club once a year.</p>
      <div class="stack" style="gap:6px">${list.slice(0, 12).map(x => `<div class="row between offer" style="gap:8px"><span>${crest(x, 18)} ${clubLink(x)} <span class="small muted">${esc(clubWhere(x))} · ${avgPair(x)}${x.own ? " · " + OWNER_STYLES[x.own.style].l.toLowerCase() : ""} · ${money(affilFee(x))}/yr · usually covers ${Math.round(partnerCover(x) * 100)}% of loan wages</span></span><span class="row" style="flex-wrap:nowrap"><span class="small muted">${pctTxt(partnerChance(x) * 100)}</span>${askedPartner(x) ? `<span class="small muted">asked</span>` : `<button class="btn sm" data-act="approach" data-id="${x.id}">Approach</button>`}</span></div>`).join("") || `<p class="muted small">No clubs match.</p>`}</div>`}</section>`;
  const feeders = `<section class="card"><div class="card-h"><h2>Feeder clubs</h2><span class="small muted">${N.feeders.length} of ${MAX_FEEDERS}</span></div>${money3}
    <p class="small muted" style="margin-bottom:10px">Clubs in lower divisions that you fund: each asks a set amount a year. The money raises their standard and facilities each summer. They take your young players on loan first (they pay half the wages), and they give you first refusal on their best youngsters at a discount that grows with the relationship.</p>
    ${N.feeders.map(f => { const x = CL(f.id), out = (G.loanList || []).map(id => G.players[id]).filter(p => p && p.loan && p.loan.to === x.id && p.loan.from === c.id);
      return `<div class="offer"><div class="row between"><span>${crest(x, 18)} ${clubLink(x)} <span class="small muted">${LEAGUES[x.lg].name} · ${avgPair(x)} (yours ${teamAvg(c)})<br>${youthLine(x)}</span></span><span class="row">${moodBar(f.rel)}<button class="btn sm danger" data-act="dropfeeder" data-id="${x.id}">End</button></span></div>
        <div class="row small" style="margin-top:6px"><span>Funding <b>${money(feederAsk(x))}</b>/yr <span class="muted">(what they ask)</span></span><span class="muted">${out.length ? "On loan there: " + out.map(p => esc(p.name)).join(", ") : "None of your players there."}</span></div></div>`; }).join("")}
    ${N.feeders.length < MAX_FEEDERS ? (feederCands().length ? `<h3 style="margin:12px 0 6px">Add a feeder</h3>
      <div class="filters"><label class="f">Sort by<select data-act="fsort">${[["div", "Highest division"], ["cheap", "Cheapest for you"], ["dear", "Most expensive"], ["rec", "Best youth recruitment"], ["dev", "Best youth development"], ["team", "Strongest team"]].map(([k, l]) => `<option value="${k}" ${fsrt === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <div class="stack" style="gap:6px">${feederCands().sort(FEED_SORT[fsrt]).slice(0, 8).map(x => `<div class="row between offer"><span>${crest(x, 18)} ${clubLink(x)} <span class="small muted">${LEAGUES[x.lg].name} · ${avgPair(x)}<br>${youthLine(x)} · youth development <b>${youthDev20(x)}</b>/20 · asks <b>${money(feederAsk(x))}</b>/yr${(() => { const f = rightLevel(x); return f.length ? `<br><span class="good">The right level for ${f.slice(0, 3).map(q => esc(q.name)).join(", ")}${f.length > 3 ? ` and ${f.length - 3} more` : ""}</span>` : ""; })()}</span></span><button class="btn sm" data-act="addfeeder" data-id="${x.id}">Make a feeder</button></div>`).join("")}</div>` : `<p class="muted">No division below you to recruit feeders from yet.</p>`) : ""}
    <p class="small muted" style="margin-top:8px">Loan a player out from his page in the Squad tab.</p></section>`;
  return `<div class="grid2"><div class="stack">${feeders}</div><div class="stack">${partner}</div></div>`;
}

/* ---------- Competitions: league and cups ---------- */
function pgComps() {
  const tab = SUB.comp || (G.phase === "summer" ? "pre" : "league"), mineCups = Object.keys(CUP_DEF).filter(k => CUP_DEF[k].tiers.includes(my().tier));
  const tabs = `<div class="seg" style="margin-bottom:12px">${G.phase === "summer" ? `<button data-act="sub" data-k="comp" data-v="pre" aria-pressed="${tab === "pre"}">Pre-season</button>` : ""}<button data-act="sub" data-k="comp" data-v="league" aria-pressed="${tab === "league"}">League</button>${Object.keys(CUP_DEF).map(k => `<button data-act="sub" data-k="comp" data-v="${k}" aria-pressed="${tab === k}">${CUP_DEF[k].name}${mineCups.includes(k) ? "" : " ·"}</button>`).join("")}${Object.keys(CONT).map(k => `<button data-act="sub" data-k="comp" data-v="${k}" aria-pressed="${tab === k}">${CONT[k].name}</button>`).join("")}</div>`;
  if (tab === "league") return tabs + pgLeagueInner();
  if (tab === "pre") return tabs + preseasonHTML();
  if (CONT[tab]) return tabs + contHTML(tab);
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
/* ---------- you against your division ----------
   Your own figures are your books; other clubs' are estimates from their division, standing, support, ground and
   owner (how they price tickets, how hard they push the brand). */
function clubNumbers(x) {
  if (isMine(x)) { const att = (x.att || []).length ? Math.round(avg(x.att)) : matchdayForecast(x).crowd;
    return { rep: x.rep, budget: x.budget.wages, tbud: Math.max(0, (x.budget.transfer || 0) - (x.spentT || 0)), wages: wageBill(x), ticket: x.prices.ticket, att, staff: staffBill(x), comm: commercialValue(x), merch: Math.max(0, merchFor(x)) * 52, cap: capacity(x), fans: x.fans }; }
  const { ticket, att, staff, comm, merch } = aiEstimate(x);
  return { rep: x.rep, budget: x.abroad ? 0 : aiBudget(x), tbud: x.abroad ? 0 : Math.max(0, tbOf(x)), wages: sum(x.squad, id => G.players[id] ? G.players[id].wage : 0), ticket, att, staff, comm, merch, cap: x.cap || 0, fans: x.fans };
}
function compareCard(c) {
  const clubs = G.leagues[c.lg].clubs.map(CL), rows = clubs.map(x => ({ x, ...clubNumbers(x) })), others = rows.filter(r => !isMine(r.x));
  const av = k => avg(others.map(r => r[k])), me = rows.find(r => isMine(r.x));
  const rank = k => rows.filter(r => r[k] > me[k]).length + 1;
  const vs = (k, f, lowGood) => { const a = av(k), d = a ? (me[k] - a) / a : 0; return `<tr><td style="text-align:left">${f[0]}</td><td class="num">${f[1](me[k])}</td><td class="num muted">${f[1](a)}</td><td class="num small ${Math.abs(d) < .05 || lowGood === null ? "muted" : (d > 0) !== !!lowGood ? "good" : "warn"}">${d > 0 ? "+" : ""}${Math.round(d * 100)}%</td><td class="num small">${ord(rank(k))}</td></tr>`; };
  const F = { rep: ["Prestige", v => Math.round(v)], budget: ["Wage budget (a year)", v => money(v)], tbud: ["Transfer budget left", v => money(v)], wages: ["Player wages", v => pw(v)], ticket: ["Match ticket", v => money(v)], att: ["Average crowd", v => Math.round(v).toLocaleString("en-GB")],
    staff: ["Staff wages (a year)", v => money(v)], comm: ["Commercial value (a year)", v => money(v)], merch: ["Merchandise (a year)", v => money(v)], cap: ["Stadium", v => Math.round(v).toLocaleString("en-GB")], fans: ["Supporters", v => Math.round(v).toLocaleString("en-GB")] };
  return `<section class="card"><div class="card-h"><h2>You against your division</h2><span class="small muted">${esc(LEAGUES[c.lg].name)}</span></div>
    <div class="tbl-wrap"><table class="sq"><thead><tr><th style="text-align:left"></th><th>You</th><th>Division avg</th><th>Diff</th><th>Rank</th></tr></thead><tbody>
    ${["rep", "budget", "tbud", "wages", "ticket", "att", "staff", "comm", "merch", "cap", "fans"].map(k => vs(k, F[k], k === "ticket" ? null : k === "wages" || k === "staff" || k === "budget" || k === "tbud" ? null : false)).join("")}</tbody></table></div>
    <h3 style="margin:14px 0 6px">Club by club</h3>
    ${sortTable("cmp-div", [
      { k: "name", l: "Club", left: true, v: r => r.x.name, f: r => `${crest(r.x, 14)} <button class="lnk" data-act="club" data-id="${r.x.id}">${isMine(r.x) ? `<b>${esc(r.x.name)}</b>` : esc(r.x.name)}</button>` },
      { k: "rep", l: "Prestige", r: true, v: r => r.rep, f: r => Math.round(r.rep) },
      { k: "budget", l: "Wage budget", r: true, v: r => r.budget, f: r => money(r.budget) },
      { k: "tbud", l: "To spend", r: true, v: r => r.tbud, f: r => money(r.tbud) },
      { k: "wages", l: "Wages", r: true, v: r => r.wages, f: r => pw(r.wages) },
      { k: "ticket", l: "Ticket", r: true, v: r => r.ticket, f: r => money(r.ticket) },
      { k: "att", l: "Crowd", r: true, v: r => r.att, f: r => r.att.toLocaleString("en-GB") },
      { k: "staff", l: "Staff", r: true, v: r => r.staff, f: r => money(r.staff) },
      { k: "comm", l: "Commercial", r: true, v: r => r.comm, f: r => money(r.comm) },
      { k: "merch", l: "Merch", r: true, v: r => r.merch, f: r => money(r.merch) },
      { k: "cap", l: "Stadium", r: true, v: r => r.cap, f: r => r.cap.toLocaleString("en-GB") },
      { k: "fan", l: "Support", left: true, v: r => topFan(r.x), f: r => `<span class="small" style="white-space:nowrap"><span class="dot" style="background:${FAN_COL[topFan(r.x)]}"></span> ${FAN_KINDS[topFan(r.x)][0]} ${fanMix(r.x)[topFan(r.x)]}%</span>` },
    ], rows, { sort: { k: "rep", d: -1 }, quiet: true })}
    <p class="small muted" style="margin-top:6px">Your figures are your own books (crowd: this season's average, or the forecast before your first home game). Other clubs' are estimates from their division, standing, support, ground and owner. Wages are a week; staff and commercial are a year.</p></section>`;
}
/* Your derbies: on the Office's Club tab (compact) and the Rivals page (full). */
function derbiesCard(full) {
  const L = myDerbies(), rec = r => r[0] + r[1] + r[2] ? `${r[0]}W ${r[1]}D ${r[2]}L` : "—";
  const chip = d => `<span class="chip rival${d.lvl === 2 ? " r3" : ""}">${d.lvl === 2 ? "FIERCE" : "LOCAL"}</span>`;
  const body = !L.length ? `<p class="muted small">No derbies yet. Neighbours, years of title fights or a grudge make one.</p>` : full
    ? `<div class="tbl-wrap"><table class="sq"><thead><tr><th style="text-align:left">Club</th><th style="text-align:left">Derby</th><th style="text-align:left">Why</th><th>Distance</th><th>Division</th><th>Record</th></tr></thead><tbody>${L.map(d => `<tr class="click" data-act="club" data-id="${d.x.id}"><td style="text-align:left">${crest(d.x, 14)} ${esc(d.x.name)}</td><td style="text-align:left">${chip(d)}</td><td style="text-align:left" class="small">${d.why}</td><td class="num">${d.km != null ? d.km + " km" : "—"}</td><td class="small">${esc(LEAGUES[d.x.lg].name)}</td><td class="num">${rec(d.rec)}</td></tr>`).join("")}</tbody></table></div>
      <p class="small muted" style="margin-top:8px">Derbies are for good, whichever divisions the clubs end up in. They bring bigger crowds and bigger swings in supporter mood, and rival clubs charge more to sell to each other. Records count competitive games since record-keeping began.</p>`
    : L.map(d => `<div class="row between small" style="padding:4px 0"><span>${crest(d.x, 14)} ${clubLink(d.x)} ${chip(d)}</span><span class="muted">${d.why}${d.km != null ? " · " + d.km + " km" : ""} · ${d.rec[0] + d.rec[1] + d.rec[2] ? rec(d.rec) : "no games yet"}</span></div>`).join("");
  return `<section class="card"><div class="card-h"><${full ? "h2" : "h3"}>Derbies</${full ? "h2" : "h3"}>${full ? "" : `<button class="lnk small" data-act="sub" data-k="riv" data-v="derby" data-p="rivals">Rivals</button>`}</div>${body}</section>`;
}
function pgRivals() {
  const c = my(), mine = G.leagues[c.lg].clubs.map(CL).filter(x => !isMine(x));
  const rich = G.clubs.filter(x => !x.gone && x.own && !isMine(x)).sort((a, b) => b.own.wealth - a.own.wealth).slice(0, 10);
  const row = x => `<tr class="click" data-act="club" data-id="${x.id}"><td style="text-align:left">${crest(x, 14)} ${esc(x.name)}${isDerby(c, x) ? ' <span class="chip rival">' + (derbyLevel(c, x) === 2 ? 'FIERCE DERBY' : 'DERBY') + '</span>' : ""}${x.own.target === c.id ? ' <span class="chip rival r3">HOSTILE</span>' : ""}</td><td style="text-align:left" class="small">${esc(x.own.name)}</td><td style="text-align:left"><span class="chip list">${OWNER_STYLES[x.own.style].l}</span></td><td class="num">${x.own.wealth ? money(x.own.wealth) : "—"}</td><td class="num">${x.own.since}</td><td class="small">${LEAGUES[x.lg].name}</td><td class="num">${Math.round(x.rep)} <span class="small muted">${esc(prestigeWord(x.rep))}</span></td><td class="num">${s20(handsOn(x.own))}</td></tr>`;
  const head = `<thead><tr><th style="text-align:left">Club</th><th style="text-align:left">Owner</th><th style="text-align:left">Style</th><th>Fortune</th><th>Since</th><th>Division</th><th>Prestige</th><th>Hands-on</th></tr></thead>`;
  const h = hostileOf(c), tab = SUB.riv || "cmp";
  const TABS = [["cmp", "Compare"], ["derby", "Derbies"], ["div", "Division"], ["rich", "Richest"], ["styles", "Owner styles"]];
  const banner = h ? `<section class="card summary" style="margin-bottom:16px"><div class="card-h"><h2>Hostile neighbour: ${esc(h.name)}</h2></div><p>${esc(h.own.name)} bought ${esc(h.name)} in ${h.own.since} to beat you. Expect approaches for your staff and bids for your players, fewer local sponsors and a fight for supporters.</p></section>` : "";
  const body = {
    cmp: () => compareCard(c),
    derby: () => derbiesCard(true),
    div: () => `<section class="card"><div class="card-h"><h2>Your division's owners</h2><span class="small muted">${esc(LEAGUES[c.lg].name)}</span></div><div class="tbl-wrap"><table class="sq">${head}<tbody>${mine.slice().sort((a, b) => b.rep - a.rep).map(row).join("")}</tbody></table></div></section>`,
    rich: () => `<section class="card"><div class="card-h"><h2>The richest owners</h2></div><div class="tbl-wrap"><table class="sq">${head}<tbody>${rich.map(row).join("")}</tbody></table></div></section>`,
    styles: () => `<section class="card"><div class="card-h"><h2>Owner styles</h2></div>${Object.values(OWNER_STYLES).map(s => `<p class="small" style="margin-bottom:6px"><b>${s.l}.</b> ${s.d}</p>`).join("")}
      <p class="small muted">Owners with deep pockets and big profiles near you take local sponsorship from you. Ambitious owners above you come for your staff and pay over the odds for your players. Clubs change hands in takeovers every summer.</p></section>`,
  }[tab] || (() => compareCard(c));
  return `${banner}<div class="chips" style="margin-bottom:14px">${TABS.map(([k, l]) => `<button data-act="sub" data-k="riv" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>${body()}`;
}

/* ---------- pieces for other pages ---------- */
function weatherLine() {
  const c = my(), now = G.wx && WX[G.wx[c.half]], nx = G.wxNext && WX[G.wxNext[c.half]];
  return `<p class="small muted">${now ? `Weather: ${now.ico} ${now.l}` : ""}${nx ? ` · next week ${nx.ico} ${nx.l.toLowerCase()}${nx.off && !hasHeating(c) ? ' <span class="warn">(home games at risk)</span>' : ""}` : ""}</p>`;
}
// The last time a player of yours had his pay raised (or, failing that, when and on what he joined).
function payHistoryLine(p) {
  const L = p.payLog || [], rise = L.find(x => x.why !== "signed" && x.to > x.from), signed = L.find(x => x.why === "signed");
  const join = signed || (G.tlog || []).find(m => m.kind === "in" && m.id === p.id), ago = y => G.year - y === 0 ? "this season" : G.year - y === 1 ? "last season" : `${G.year - y} seasons ago`;
  if (rise) return `<p class="small">Last pay rise: <b>${ago(rise.y)}</b> (${seasonLabel(rise.y)}, ${rise.why}), from ${pw(rise.from)} to ${pw(rise.to)}.</p>`;
  if (join) { const w0 = join.to || join.wage; return `<p class="small">No pay rise on record since he joined ${ago(join.y)} (${seasonLabel(join.y)})${w0 ? ` on ${pw(w0)}${w0 < p.wage ? `; he's on ${pw(p.wage)} now, so he has had rises since, from before records were kept` : ""}` : ""}.</p>`; }
  if (p.yAcad === G.club) return `<p class="small">No pay rise on record since he came through the academy.</p>`;
  return `<p class="small muted">No pay rise on record.</p>`;
}
// For one of your players someone wants: his rating, potential, and whether he's in your starting side.
function myPlayerLine(p) {
  const o = pickXI(my()).find(o => o.p === p), [a, b] = potEstimate(p).map(r20), pot = a === b ? `${a}` : `${a}–${b}`;
  const role = o ? (o.slot === p.pos ? `<span class="good">a starter</span> (${POS_NAME[o.slot].toLowerCase()})` : `<span class="good">a starter</span>, playing out of position at ${POS_NAME[o.slot].toLowerCase()}`)
    : p.acad ? "in the academy" : p.inj ? `not starting (injured, ${p.inj} wk${p.inj > 1 ? "s" : ""})` : `<span class="muted">not in the starting side</span>`;
  const agreed = p.agreed && CL(p.agreed.club) ? ` · <span class="warn">agreed to join ${esc(CL(p.agreed.club).name)} when the window opens</span>` : "";
  return `<p class="small"><button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button>: rated <b>${r20(p.ovr)}</b>, potential <b>${pot}</b> · ${role}${agreed} · ${p.s.app || 0} game${(p.s.app || 0) === 1 ? "" : "s"} this season</p>`;
}
// For another club's player you're looking at: your scouts' view of his rating and potential, and his place at his club.
function theirPlayerLine(p) {
  const e = v => { const [a, b] = v.map(r20); return a === b ? `${a}` : `${a}–${b}`; }, x = p.club >= 0 ? CL(p.club) : null;
  const role = !x ? (p.club === -1 ? "a free agent" : "abroad") : x.squad && pickXI(x).some(o => o.p === p) ? `<span class="good">a starter</span> at ${esc(x.name)}` : `<span class="muted">not starting</span> at ${esc(x.name)}`;
  return `<p class="small"><b>${esc(p.name)}</b>, ${POS_NAME[p.pos].toLowerCase()}, ${p.age}: rated <b>${e(ovrEstimate(p))}</b>, potential <b>${e(potEstimate(p))}</b> · ${role} · ${p.s.app || 0} game${(p.s.app || 0) === 1 ? "" : "s"} this season</p>`;
}
// For a player offered to you: your weakest current starter in his position, to compare against.
function weakestStarterLine(pid) {
  const p = G.players[pid]; if (!p) return "";
  const form = mgr().form || "4-4-2", n = (FORMS[form] || []).filter(x => x === p.pos).length, pos = POS_NAME[p.pos].toLowerCase();
  // Does the manager's formation use this player's position at all?
  const uses = n ? `Your ${form} uses ${n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : n} ${pos}${n > 1 ? "s" : ""}.` : `<span class="warn">Your ${form} doesn't use a ${pos}</span>: he'd have to play out of position or sit out.`;
  if (!n) return `<p class="small">${uses}</p>`;
  const at = o => o.p.pos === o.slot ? o.p.ovr : Math.min(o.p.ovr, roleRating(o.p, o.slot));  // his rating, or less out of position
  const xi = pickXI(my()).filter(o => o.slot === p.pos), w = xi.sort((a, b) => at(a) - at(b))[0];
  if (!w) return `<p class="small">${uses} Nobody starts there at the moment.</p>`;
  const mid = p.club === G.club ? p.ovr : avg(ovrEstimate(p)), there = r20(at(w)), d = r20(mid) - there, out = w.p.pos !== w.slot ? ` (a ${POS_NAME[w.p.pos].toLowerCase()} playing out of position)` : "";
  const [a, b] = potEstimate(w.p).map(r20), pot = a === b ? `${a}` : `${a}–${b}`;
  return `<p class="small">${uses}</p><p class="small ${d > 0 ? "good" : d < 0 ? "muted" : ""}">Your weakest starter there: <button class="lnk" data-act="player" data-id="${w.p.id}">${esc(w.p.name)}</button>${out}, ${w.p.age}, rated ${there} there, potential ${pot}${d > 0 ? ` (this player is ${d} better now)` : d < 0 ? ` (${-d} better than this player now)` : " (the same as this player now)"}.</p>`;
}
// A parent club's approach: you set the wage of your professional contract and see the chance he stays at it.
function apChanceText(x, weekly) { const p = G.players[x.data.pid]; if (!p) return ""; const c = Math.round(poachChance(p, weekly * 52, x.data.theirs) * 100); return `<b class="${c >= 75 ? "good" : c >= 50 ? "" : "warn"}">${c}% chance he stays</b> at ${pw(weekly * 52)} (their offer: ${pw(x.data.theirs)})`; }
function apOfferHTML(x) {
  const p = G.players[x.data.pid]; if (!p || x.done) return "";
  const w0 = Math.round(x.data.ours / 52 / 50) * 50, steps = [1, 1.25, 1.5, 2].map(f => Math.round(x.data.theirs * f / 52 / 50) * 50);
  return `<div class="sugg" style="margin-top:6px"><b class="small">Offer him a professional contract (3 years)</b>
    <div class="row" style="margin-top:6px;gap:8px"><label class="small">Wage €/week <input type="text" inputmode="decimal" class="num-in" id="ap-w-${x.id}" data-act="apw" data-id="${x.id}" value="${fmtNum(w0)}"></label><button class="btn sm" data-act="apoffer" data-id="${x.id}">Offer it</button></div>
    <p class="small" id="ap-p-${x.id}" style="margin-top:4px">${apChanceText(x, w0)}</p>
    <p class="small muted">${steps.map((w, i) => `${["Matching", "25% more", "50% more", "Double"][i]} (${pw(w * 52)}): ${Math.round(poachChance(p, w * 52, x.data.theirs) * 100)}%`).join(" · ")}</p></div>`;
}
function choiceHTML(x) {
  return `<div class="decision"><b>${esc(x.title)}</b>${x.body ? `<p class="small">${esc(x.body)}</p>` : ""}${x.key === "raise" && x.data && G.players[x.data.pid] ? (q => `<p class="small">Contract: <b>${q.yrs} year${q.yrs === 1 ? "" : "s"} left</b> on ${pw(q.wage)}. ${x.done ? "" : "A rise in full gives him a new deal to 4 years (3 if you meet him halfway)."}</p>`)(G.players[x.data.pid]) + payHistoryLine(G.players[x.data.pid]) : ""}${x.data && x.data.pid != null && G.players[x.data.pid] ? (G.players[x.data.pid].club === G.club ? myPlayerLine(G.players[x.data.pid]) : x.key !== "ySign" ? weakestStarterLine(x.data.pid) : "") : ""}${x.key === "acadPoach" ? apOfferHTML(x) : ""}<div class="row" style="margin-top:6px">${x.opts.map((o, i) => x.key === "acadPoach" && i === 0 && !x.done ? "" : `<button class="btn sm ${i === x.dflt ? "" : ""}" data-act="choose" data-id="${x.id}" data-i="${i}">${esc(o)}</button>`).join("")}<span class="small muted">If you don't answer: “${esc(x.opts[x.dflt])}”</span></div></div>`;
}
function loansCard() {
  const c = my(), t = loanTerms(100000, 5);
  return `<section class="card"><div class="card-h"><h2>Borrowing</h2><span class="small muted">Debt ${money(debtOf())}</span></div>
    ${(G.loans || []).length ? `<div class="stack" style="gap:6px">${G.loans.map(l => `<div class="row between offer"><span><b>${esc(l.lender)}</b>: ${money(l.amt)} at ${(l.rate * 100).toFixed(1)}% from ${l.y}<br><span class="small muted">${money(l.left)} left · ${money(l.weekly)} a week</span></span><button class="btn sm" data-act="repayloan" data-id="${l.id}">Pay off (${money(l.left * 1.02)})</button></div>`).join("")}</div>` : `<p class="muted small">No bank loans.</p>`}
    <p class="small muted" style="margin:10px 0">The bank will lend up to ${money(t.max)} more, against what the club is worth${c.fac.stadium.own ? " (more with your own ground)" : ""}. Rates rise with your debt. An overdraft beyond the bank's limit for eight weeks means administration: ten points docked and your best players sold.</p>
    <div class="row"><label class="small">Borrow € <input type="text" inputmode="decimal" class="num-in" id="ln-amt" value="${fmtNum(Math.min(t.max, 100000))}"></label><label class="small">over <select id="ln-yrs">${[3, 5, 10, 20].map(y => `<option ${y === 5 ? "selected" : ""}>${y}</option>`).join("")}</select> years</label><button class="btn sm" data-act="loanq">See terms</button></div>
    <h3 style="margin:14px 0 6px">Your own loans to the club</h3><p class="small">Lent so far: ${money(G.owner.lent || 0)} (interest-free; take it back when the club can afford it).</p>
    <div class="row" style="margin-top:6px"><input type="text" inputmode="decimal" class="num-in" id="ol-amt" placeholder="Amount"><button class="btn sm" data-act="olend">Lend</button><button class="btn sm" data-act="orecall">Take back</button></div></section>`;
}
function endScreen() {
  const e = G.ended, c = my();
  return `<div class="wrap gut"><div class="hero"><p class="eyebrow">${seasonLabel(e.y)}</p><h1>You sold <span>${esc(c.name)}</span></h1>
    <p>For ${money(e.amt)} to a ${OWNER_STYLES[e.style].l.toLowerCase()}. You founded the club in ${c.founded} with nothing; you leave it in the ${LEAGUES[c.lg].name}, with ${c.fans.toLocaleString("en-GB")} supporters and ${c.trophies.length} trophies. You put in ${money(G.owner.invested)}; your fortune is now ${money(G.owner.wealth)}.</p></div>
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
    ${list.map(({ c, p }) => `<tr><td style="text-align:left">${crest(c, 14)} <button class="lnk" data-act="club" data-id="${c.id}">${esc(c.name)}</button></td><td style="text-align:left" class="small">${LEAGUES[c.lg].name}</td><td class="num">${c.cap.toLocaleString("en-GB")}</td><td class="num">${c.fans.toLocaleString("en-GB")}</td><td>${rating(avg(pickXI(c).map(o => o.p.ovr)))}</td><td style="text-align:left" class="small">${OWNER_STYLES[c.own.style].l}</td><td class="num">${money(p)}</td><td><button class="btn sm primary" data-act="buyclub" data-id="${c.id}" ${p > w ? "disabled" : ""}>Buy</button></td></tr>`).join("") || `<tr><td colspan="8" class="muted">No clubs for sale at this price.</td></tr>`}</tbody></table></div></section></div>`;
}

/* ---------- your vision ---------- */
/* The vision controls: on the Board page for your club, and on the start screen before the club is founded
   (start = true: they edit START_V and redraw only themselves, so the rest of the form keeps what you typed). */
let START_V = { style: "any", recruit: "any", pri: { results: 2, youth: 2, finance: 2, fans: 2, commercial: 1, facilities: 1 } };
function visionCard(v = vision(), start = false) {
  const used = sum(Object.values(v.pri)), left = VISION_POINTS - used;
  const head = `<div class="card-h"><${start ? "h3" : "h2"}>Your vision</${start ? "h3" : "h2"}><span class="small ${left ? "warn" : "muted"}">${left} of ${VISION_POINTS} points left</span></div>`;
  const body = `<p class="small muted" style="margin-bottom:10px">What matters to you as owner. Staff who share your ideas are keener to join and grow happier working for you; staff who don't slowly sour. Each priority point also brings a small benefit in that area.${start ? " You can change all of this later on the Board page." : ""}</p>
    <div class="price-grid" style="margin-bottom:12px">
      <label class="small"><b>How the team should play</b><select data-act="vset" data-k="style"><option value="any">Whatever wins</option>${Object.entries(STYLES).map(([k, s]) => `<option value="${k}" ${v.style === k ? "selected" : ""}>${s.l}</option>`).join("")}</select></label>
      <label class="small"><b>How to recruit</b><select data-act="vset" data-k="recruit"><option value="any">Leave it to the experts</option>${Object.entries(ROLES_STAFF.recruit.phil).map(([k, s]) => `<option value="${k}" ${v.recruit === k ? "selected" : ""}>${s.l}</option>`).join("")}</select></label></div>
    <div class="stack" style="gap:8px">${Object.entries(PRIORITIES).map(([k, P]) => `<div class="row between offer"><span><b>${P.l}</b><br><span class="small muted">${P.d}</span></span>
      <span class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="vpri" data-k="${k}" data-d="-1" ${v.pri[k] ? "" : "disabled"} aria-label="Less">−</button><b class="num" style="min-width:3ch;text-align:center">${"●".repeat(v.pri[k])}${"○".repeat(4 - v.pri[k])}</b><button class="btn sm" data-act="vpri" data-k="${k}" data-d="1" ${left && v.pri[k] < 4 ? "" : "disabled"} aria-label="More">+</button></span></div>`).join("")}</div>`;
  return start ? `<div id="f-vision" style="margin-top:16px">${head}${body}</div>` : `<section class="card">${head}${body}</section>`;
}

/* ---------- pre-season friendlies ---------- */
function preseasonHTML() {
  if (G.phase !== "summer") return `<p class="muted">Friendlies are arranged in pre-season.</p>`;
  const c = my(), F = G.friendlies || [], asked = new Set(G.fAsked || []), free = freeWeeks(), full = !free.length;
  if (!free.includes(SUB.fw)) SUB.fw = free[0];
  // Sorted by the most you'd make from each club (the better of home and away), or by keenness or division.
  const best = x => Math.max(awayFee(x), homeFriendly(x).gate - homeFriendly(x).fee), fs = SUB.fsort || "money";
  const opp = friendlyOptions().slice().sort(fs === "keen" ? (a, b) => friendlyInterest(b) - friendlyInterest(a) : fs === "div" ? (a, b) => (a.abroad ? 0 : a.tier) - (b.abroad ? 0 : b.tier) || b.rep - a.rep : (a, b) => best(b) - best(a)), like = i => i >= .8 ? ["Keen", "good"] : i >= .5 ? ["Might say yes", ""] : ["Unlikely", "warn"];
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>Arrange friendlies</h2><span class="small muted">${F.length} of ${MAX_FRIENDLIES} weeks</span></div>
    <p class="small muted" style="margin-bottom:10px">Away, the host pays you: bigger clubs pay more, and every club pays more the keener it is to face a side of your ability. Home, you keep a reduced gate; a bigger visitor draws a bigger crowd but takes a third as an appearance fee. You can play one in every pre-season week. Fewer than two and the team starts the season rusty; three or more sharpens it.</p>
    ${full ? `<p class="small">Every pre-season week has a friendly.</p>` : `<label class="small" style="display:block;margin-bottom:10px"><b>For week</b> <select data-act="fweek">${free.map(w => `<option value="${w}" ${SUB.fw === w ? "selected" : ""}>Pre-season week ${w + 1}${w === G.week ? " (this week)" : ""}</option>`).join("")}</select></label>`}
    <div class="chips" style="margin-bottom:8px">${[["money", "Most money"], ["keen", "Keenest"], ["div", "Division"]].map(([k, l]) => `<button data-act="sub" data-k="fsort" data-v="${k}" aria-pressed="${fs === k}">${l}</button>`).join("")}</div>
    <div class="stack" style="gap:6px">${opp.map(x => { const i = friendlyInterest(x), h = homeFriendly(x), done = asked.has(x.id);
      return `<div class="offer"><div class="row between"><span>${crest(x, 16)} ${clubLink(x)} <span class="small muted">${esc(clubWhere(x))}${x.abroad ? " · tour" : x.region === c.region ? " · local" : ""}</span></span>${word(like(i))}</div>
        <div class="row small" style="margin-top:4px"><span class="muted">${awayFee(x) >= h.gate - h.fee ? `<b>Away fee ${money(awayFee(x))}</b>` : `Away fee ${money(awayFee(x))}`} · at home about ${h.crowd.toLocaleString("en-GB")} fans, ${h.gate - h.fee > awayFee(x) ? `<b>${money(h.gate - h.fee)} to you</b>` : `${money(h.gate - h.fee)} to you`}</span>
        ${done ? `<span class="muted">Asked</span>` : `<button class="btn sm" data-act="friendly" data-id="${x.id}" data-h="0" ${full ? "disabled" : ""}>Away</button><button class="btn sm" data-act="friendly" data-id="${x.id}" data-h="1" ${full ? "disabled" : ""}>Home</button>`}</div></div>`; }).join("")}</div></section></div>
    <div class="stack"><section class="card"><div class="card-h"><h3>Your pre-season</h3></div>${F.length ? F.slice().sort((a, b) => a.w - b.w).map(f => { const x = CL(f.opp), r = (G.myRes || []).find(r => r.comp === "F" && r.opp === f.opp && r.w === f.w);
      return `<p class="small">Week ${f.w + 1}: ${f.home ? "v" : "at"} ${esc(x.name)}${r ? ` · <b>${r.gf}–${r.ga}</b>` : f.home ? "" : ` · fee ${money(f.fee)}`}</p>`; }).join("") : "<p class='small muted'>None arranged yet.</p>"}</section></div></div>`;
}

/* ---------- continental competitions ---------- */
function contHTML(k) {
  const K = (G.cont || {})[k], D = CONT[k], c = my(), q = G.qual && G.qual.y === G.year + 1 ? G.qual[k] : null;
  const teamCell = id => { const x = CL(id); return `${crest(x, 14)} <button class="lnk" data-act="club" data-id="${id}">${esc(x.name)}</button> <span class="muted small">${x.abroad ? COUNTRY[x.country].name : "Eng"}</span>`; };
  const info = `<section class="card"><div class="card-h"><h3>${D.name}</h3></div><p class="small">${k === "CC" ? "The top four in the Premier Division and 28 clubs from Spain, Germany, Italy, France, Portugal, the Netherlands and Belgium." : "5th and 6th in the Premier Division, the National Cup winners whatever their division, and 29 clubs from abroad."} Eight groups of four, home and away; the top two go through to two-legged knockout rounds and a final at a neutral ground.</p>
    <dl class="ledger" style="margin-top:8px"><dt>Taking part</dt><dd>${money(D.join)}</dd><dt>Group win / draw</dt><dd>${money(D.win)} / ${money(D.draw)}</dd>${CONT_KO.map((r, i) => `<dt>Reaching the ${r.n.toLowerCase()}</dt><dd>${money(D.rounds[i])}</dd>`).join("")}<dt>Winners</dt><dd>${money(D.champ)}</dd></dl>
    ${q ? `<p class="small" style="margin-top:8px"><b>Qualified for next season:</b> ${q.map(id => esc(CL(id).name)).join(", ")}</p>` : ""}
    ${G.contLast && G.contLast[k] && G.contLast[k].win != null ? `<p class="small muted" style="margin-top:6px">Last season's winners: ${esc(CL(G.contLast[k].win).name)}</p>` : ""}</section>`;
  if (!K) return `<div class="grid2"><div class="stack"><section class="card"><p class="muted">The continental competitions start next season.</p></section></div><div class="stack">${info}</div></div>`;
  const tie = (t, final) => `<div class="row between small ${t.h === G.club || t.a === G.club ? "me-row" : ""}" style="padding:3px 0"><span>${teamCell(t.h)}</span><b class="num">${t.g1 ? final ? `${t.g1[0]}–${t.g1[1]}${t.pens ? " p" : ""}` : `${t.g1[0]}–${t.g1[1]}${t.g2 ? ` · ${t.g2[0]}–${t.g2[1]}` : ""}${t.pens ? " p" : ""}` : "v"}</b><span style="text-align:right">${teamCell(t.a)}</span></div>`;
  const ko = K.ko.slice().reverse().map((R, i) => `<section class="card"><div class="card-h"><h3>${R.n}</h3><span class="small muted">week${R.n === "Final" ? "" : "s"} ${CONT_KO.find(x => x.n === R.n).w.map(w => w + 1).join(" & ")}</span></div>${R.ties.map(t => tie(t, R.n === "Final")).join("")}</section>`).join("");
  const groups = K.groups.map((g, gi) => { const t = groupTable(K, gi), mine = g.includes(G.club);
    return `<section class="card"${mine ? ' style="border-color:var(--accent)"' : ""}><div class="card-h"><h3>Group ${"ABCDEFGH"[gi]}</h3></div><div class="tbl-wrap"><table class="lg"><thead><tr><th style="text-align:left">Club</th><th>P</th><th>GD</th><th>Pts</th></tr></thead><tbody>${t.map((r, i) => `<tr class="${i < 2 && K.md === 6 ? "z-up" : ""} ${r.id === G.club ? "me" : ""}"><td style="text-align:left">${teamCell(r.id)}</td><td class="num">${r.p}</td><td class="num">${r.gf - r.ga}</td><td class="num"><b>${r.pts}</b></td></tr>`).join("")}</tbody></table></div></section>`; });
  const myGroup = K.groups.findIndex(g => g.includes(G.club));
  return `<div class="grid2"><div class="stack">${K.win != null ? `<section class="card summary"><h2>🏆 ${esc(CL(K.win).name)}</h2></section>` : ""}${ko}
    <p class="small muted">Group games in weeks ${CONT_GROUP_WEEKS.map(w => w + 1).join(", ")}.</p>${myGroup >= 0 ? groups[myGroup] : ""}${groups.filter((_, i) => i !== myGroup).join("")}</div><div class="stack">${info}</div></div>`;
}

/* ---------- Tactics: how your manager sets the team up (you watch; he decides) ---------- */
// Where each slot sits on the pitch, per formation: [x 0-100 left to right, y 0-100 attacking end to own goal].
const FORM_XY = {"4-4-2": [[50, 88], [13, 68], [37, 73], [63, 73], [87, 68], [13, 45], [37, 50], [63, 50], [87, 45], [37, 19], [63, 19]], "4-3-3": [[50, 88], [13, 68], [37, 73], [63, 73], [87, 68], [50, 59], [29, 44], [71, 44], [15, 22], [50, 15], [85, 22]], "4-2-3-1": [[50, 88], [13, 68], [37, 73], [63, 73], [87, 68], [35, 58], [65, 58], [15, 34], [50, 36], [85, 34], [50, 14]], "4-1-2-1-2": [[50, 88], [13, 68], [37, 73], [63, 73], [87, 68], [50, 60], [29, 47], [71, 47], [50, 34], [37, 17], [63, 17]], "3-5-2": [[50, 88], [27, 73], [50, 75], [73, 73], [9, 50], [50, 59], [31, 43], [69, 43], [91, 50], [37, 18], [63, 18]], "3-4-3": [[50, 88], [27, 73], [50, 75], [73, 73], [9, 48], [36, 52], [64, 52], [91, 48], [15, 21], [50, 15], [85, 21]], "5-3-2": [[50, 88], [8, 62], [29, 73], [50, 75], [71, 73], [92, 62], [27, 47], [50, 55], [73, 47], [37, 20], [63, 20]]};
const PITCH_LINES = `<svg class="lines" viewBox="0 0 68 96" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="var(--chalk)" stroke-width=".4"><rect x="2" y="2" width="64" height="92"/><line x1="2" y1="48" x2="66" y2="48"/><circle cx="34" cy="48" r="7"/><rect x="16" y="2" width="36" height="14"/><rect x="26" y="2" width="16" height="5"/><rect x="16" y="80" width="36" height="14"/><rect x="26" y="89" width="16" height="5"/></svg>`;
// Attack, midfield and defence of a side as the match engine weighs them (before morale and tactics).
function lineStrength(xi) {
  let a = 0, m = 0, d = 0, wa = 0, wm = 0, wd = 0;
  for (const { p, slot } of xi) { const r = roleRating(p, slot), w = SLOT_W[slot]; a += r * w[0]; m += r * w[1]; d += r * w[2]; wa += w[0]; wm += w[1]; wd += w[2]; }
  return { a: a / (wa || 1), m: m / (wm || 1), d: d / (wd || 1) };
}
// Fitness (sharpness): a small bar on the pitch and a percentage elsewhere; amber below 85%, red below 70%.
const fitCol = f => f < 70 ? "var(--loss)" : f < 85 ? "var(--accent)" : "var(--win)";
const fitBar = p => { const f = Math.round(p.fit ?? 100); return `<span class="fitbar" title="Fitness ${f}%"><i style="width:${f}%;background:${fitCol(f)}"></i></span><span class="fitpc">${f}%</span>`; };
const fitTxt = p => { const f = Math.round(p.fit ?? 100); return `<span class="small ${f < 70 ? "bad" : f < 85 ? "warn" : "muted"}">${f}%</span>`; };
function pgTactics() {
  const tab = SUB.tactics || "shape";
  const tabs = `<div class="chips" style="margin-bottom:14px">${[["shape", "Team"], ["depth", "Depth chart"], ["retrain", "Retrains"]].map(([k, l]) => `<button data-act="sub" data-k="tactics" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>`;
  return tabs + (tab === "depth" ? depthChart() : tab === "retrain" ? retrainList() : tacticsShape());
}
/* Suggested retrains: every move the manager rates a good one, best first; then neutral moves that would give a
   player a place in the formation (his position isn't used, the new one is). Same estimates as on the player card. */
function retrainList() {
  const c = my(), m = mgr(), used = new Set(FORMS[m.form || "4-4-2"] || FORMS["4-4-2"]);
  const rows = c.squad.map(P).filter(p => p && retrainOK(p) && !p.acad).flatMap(p => RETRAIN[p.pos].map(to => {
    const V = retrainView(p, to), gain = (V.ovr[0] + V.ovr[1]) / 2 - to20(p.ovr) + ((V.pot[0] + V.pot[1]) / 2 - (to20(potEstimate(p)[0]) + to20(potEstimate(p)[1])) / 2) * (p.age <= 25 ? .7 : .2);
    return { p, to, V, gain, fits: !used.has(p.pos) && used.has(to) };
  })).filter(r => r.V.verdict === "good" || (r.V.verdict === "neutral" && r.fits)).sort((a, b) => (b.V.verdict === "good") - (a.V.verdict === "good") || b.gain - a.gain);
  const rng = ([a, b]) => a === b ? `${a}` : `${a}–${b}`;
  const row = r => `<div class="row between" style="gap:8px;padding:8px 0;border-bottom:1px solid var(--line)"><span class="small"><span class="pos">${r.p.pos}</span> <button class="lnk" data-act="player" data-id="${r.p.id}">${esc(r.p.name)}</button>, ${r.p.age} · rated ${r20(r.p.ovr)} → <b>${esc(POS_NAME[r.to])}</b> · <span class="${r.V.verdict === "good" ? "good" : ""}">${r.V.verdict === "good" ? "Good move" : "Neutral"}</span><br><span class="muted">About ${rng(r.V.ovr)} there, potential ${rng(r.V.pot)}${r.fits ? ` · ${/^[AEIOU]/.test(POS_NAME[r.p.pos]) ? "an" : "a"} ${esc(POS_NAME[r.p.pos].toLowerCase())} has no place in the ${esc(m.form || "4-4-2")}` : ""}</span></span><button class="btn sm" data-act="retrain" data-id="${r.p.id}" data-to="${r.to}">Retrain</button></div>`;
  return `<section class="card"><div class="card-h"><h2>Suggested retrains</h2><span class="small muted">${esc(m.name || "The manager")} · player development ${s20(m.at.dev)}</span></div>
    <p class="small muted" style="margin-bottom:8px">Moves the manager thinks would make a player better, best first, and neutral ones that would give a player a place in the formation. Each player can retrain once; how well he takes to it can surprise anyone.</p>
    ${rows.length ? rows.map(row).join("") : `<p class="muted">No retrains the manager would recommend right now.</p>`}</section>`;
}
/* The depth chart: each position the formation uses, with the whole squad ranked by how good they are there (the same
   position ratings the manager picks on). Starters first; then who would come in, injured or unregistered players
   marked, and players who'd be playing out of position flagged. */
const DEPTH_VIEW = {};
function depthChart() {
  const c = my(), form = mgr().form || "4-4-2", slots = FORMS[form] || FORMS["4-4-2"], xi = pickXI(c), startsAt = new Map(xi.map(o => [o.p.id, o.slot]));
  const roles = [...new Set(slots)], ps = c.squad.map(P).filter(p => p && (!p.acad || p.age >= 16) && !(p.loan && p.loan.from === c.id));
  const SHOW = 6;
  const cards = roles.map(role => {
    const n = slots.filter(s => s === role).length;
    const all = ps.filter(p => (role === "GK") === (p.pos === "GK")).map(p => ({ p, r: roleRating(p, role) })).sort((a, b) => b.r - a.r);
    // Your order if you've set one (everyone eligible, as you ranked them); otherwise the manager's: starters here, then
    // the best of everyone not starting anywhere (players starting in other positions aren't cover).
    const mineL = depthSync(c, role), byId = new Map(all.map(x => [x.p.id, x]));
    const ranked = mineL ? mineL.map(id => byId.get(id)).filter(Boolean).filter((x, i) => i < Math.max(SHOW, n + 3) || startsAt.get(x.p.id) === role)
      : [...all.filter(x => startsAt.get(x.p.id) === role), ...all.filter(x => !startsAt.has(x.p.id)).slice(0, Math.max(3, SHOW - n))];
    DEPTH_VIEW[role] = mineL ? mineL.slice() : [...ranked.map(x => x.p.id), ...all.filter(x => !ranked.includes(x)).map(x => x.p.id)];
    const coverR = (ranked.find(x => !startsAt.has(x.p.id) && !x.p.inj) || { r: 0 }).r;
    const alsoHere = all.filter(x => startsAt.has(x.p.id) && startsAt.get(x.p.id) !== role && x.r > coverR).slice(0, 3);
    let backup = 0;
    const rows = ranked.map(({ p, r }) => {
      const here = startsAt.get(p.id) === role, elsewhere = startsAt.has(p.id) && !here, oop = p.pos !== role;
      const tag = here ? `<span class="chip xi">STARTS</span>` : p.inj ? `<span class="small bad">injured ${p.inj}w</span>` : !isReg(p, c) ? `<span class="small warn">not registered</span>`
        : elsewhere ? `<span class="small muted">starts at ${startsAt.get(p.id)}</span>` : `<span class="small muted">${["1st", "2nd", "3rd", "4th", "5th"][backup++] || ""} choice cover</span>`;
      const k = DEPTH_VIEW[role].indexOf(p.id), mv = `<span class="depth-mv"><button class="btn sm" data-act="depth" data-role="${role}" data-id="${p.id}" data-d="-1" ${k <= 0 ? "disabled" : ""} aria-label="Move ${esc(p.name)} up">▲</button><button class="btn sm" data-act="depth" data-role="${role}" data-id="${p.id}" data-d="1" ${k >= DEPTH_VIEW[role].length - 1 ? "disabled" : ""} aria-label="Move ${esc(p.name)} down">▼</button></span>`;
      return `<tr class="${p.inj || elsewhere ? "muted" : ""}"><td class="num">${mv}${rating(r)}</td><td style="text-align:left"><button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button>${oop ? ` <span class="pos" title="Normally ${esc(POS_NAME[p.pos].toLowerCase())}">${p.pos}</span>` : ""}${p.loan && p.loan.to === c.id ? ` <span class="chip list" title="On loan from ${esc(CL(p.loan.from).name)}">LOAN</span>` : ""}<br><span class="small muted">${p.age} · potential ${est20(potEstimate(p))}${p.loan && p.loan.to === c.id ? ` · on loan from ${esc(CL(p.loan.from).name)}` : ""}</span></td><td style="text-align:right">${tag}</td></tr>`;
    }).join("");
    const cover = ranked.filter(x => startsAt.get(x.p.id) !== role && !startsAt.has(x.p.id) && !x.p.inj && isReg(x.p, c));
    const thin = !cover.length ? `<p class="small bad">No cover: an injury here means someone plays out of position.</p>` : !cover.some(x => x.p.pos === role) ? `<p class="small warn">No natural ${esc(POS_NAME[role].toLowerCase())} as cover.</p>` : "";
    const lentOut = (G.loanList || []).map(id => G.players[id]).filter(q => q && q.loan && q.loan.from === c.id && q.pos === role);
    const away = lentOut.length ? `<p class="small muted">Out on loan: ${lentOut.map(q => `<button class="lnk" data-act="player" data-id="${q.id}">${esc(q.name)}</button> (${r20(q.ovr)}, at ${esc(CL(q.club).name)})`).join(", ")}.</p>` : "";
    const also = alsoHere.length ? `<p class="small muted">Better here than the cover, but starting elsewhere: ${alsoHere.map(x => `${esc(x.p.name)} (${r20(x.r)}, starts at ${startsAt.get(x.p.id)})`).join(", ")}.</p>` : "";
    return `<section class="card"><div class="card-h"><h3>${esc(POS_NAME[role])}</h3><span class="small muted">${n} in the ${form}${mineL ? ` · <b>your order</b> · <button class="lnk" data-act="depthreset" data-role="${role}">let the manager pick</button>` : ""}</span></div><table class="tbl depth"><tbody>${rows}</tbody></table>${thin}${also}${away}</section>`;
  }).join("");
  return `<p class="small muted" style="margin-bottom:10px">Every position in the ${form}, with your squad ranked by their rating there (out of 20, as the manager picks). A position badge means he'd be playing out of position. Injured players are greyed. Use ▲ ▼ to set your own order: the top players start there (when fit and registered), the next come in first. \"Insist he starts\" on a player's card still comes first.</p><div class="grid2 depth-grid">${cards}</div>`;
}
function tacticsShape() {
  const c = my(), M = mgr(), hired = !!staffOf("manager"), form = M.form || "4-4-2", xi = pickXI(c), st = STYLES[M.phil], fit = styleFit(xi, M.phil);
  const pos = FORM_XY[form] || FORM_XY["4-4-2"];
  const slots = xi.map(({ p, slot, i }) => { const [x, y] = pos[i], r = r20(roleRating(p, slot)), oop = p.pos !== slot;
    return `<button class="slot${oop ? " oop" : ""}" style="left:${x}%;top:${y}%" data-act="player" data-id="${p.id}" title="${esc(p.name)}: ${POS_NAME[slot]}${oop ? ` (normally ${POS_NAME[p.pos].toLowerCase()})` : ""}"><span class="disc">${r}</span><span class="nm">${esc(p.name.split(" ").slice(1).join(" ") || p.name)}</span><span class="rl">${slot} · <span style="color:${fitCol(Math.round(p.fit ?? 100))}">${Math.round(p.fit ?? 100)}%</span></span></button>`; }).join("");
  const missing = 11 - xi.length;
  // The style's four attributes across the outfield XI, against their own average.
  const outf = xi.filter(o => o.p.pos !== "GK").map(o => o.p), allAvg = avg(outf.map(p => avg(OUT_KEYS.map(k => p.at[k]))));
  const keyRows = st.keys.map(k => { const v = avg(outf.map(p => p.at[k])), d = v - allAvg; return `<div><div class="attr-r"><span>${ATTR[k]}</span>${attr20(v)}</div><p class="small ${d > 1.5 ? "good" : d < -1.5 ? "bad" : "muted"}">${d > 1.5 ? "A strength of this side" : d < -1.5 ? "A weakness of this side" : "About average for this side"}</p></div>`; }).join("");
  const styles = Object.entries(STYLES).map(([k, S]) => [k, S, styleFit(xi, k)]).sort((a, b) => b[2] - a[2]);
  // Against the rest of the division
  const L = lineStrength(xi), div = G.leagues[c.lg].clubs.filter(id => id !== c.id).map(id => lineStrength(pickXI(CL(id))));
  const dv = k => avg(div.map(x => x[k])), line = (l, k) => { const me = L[k], them = dv(k), diff = r20(me) - r20(them);
    return `<div class="row between" style="padding:3px 0"><span>${l}</span><span>${rating(me)} <span class="small ${diff > 0 ? "good" : diff < 0 ? "bad" : "muted"}">${diff > 0 ? "+" + diff : diff < 0 ? diff : "level"} on the division average (${r20(them)})</span></span></div>`; };
  const inXI = new Set(xi.map(o => o.p.id)), avail = c.squad.map(P).filter(p => !inXI.has(p.id) && !p.inj && (!p.acad || p.age >= 17));
  const bench = avail.sort((a, b) => b.ovr - a.ovr).slice(0, 7), out2 = c.squad.map(P).filter(p => p.inj || p.unsettled > 0);
  const nf = nextFixture(), opp = nf ? CL(nf.h === c.id ? nf.a : nf.h) : null, oxi = opp ? pickXI(opp) : null;
  const focusTxt = { youth: "Gives young players a chance: he picks promising youngsters over slightly better senior players.", results: "Picks the strongest side every week.", balanced: "Balances results and bringing players through." }[M.focus];
  return `<div class="grid2"><div class="stack">
    <section class="card"><div class="card-h"><h2>${form}</h2><span class="small muted">${hired ? esc(M.name) + "'s side" : "Picked by the club captain: there's no manager"}</span></div>
      <div class="pitch" style="--club:${c.color};max-width:420px;margin:0 auto">${PITCH_LINES}${slots}</div>
      ${missing > 0 ? `<p class="small bad" style="margin-top:8px">${missing} place${missing > 1 ? "s" : ""} empty: not enough fit players.</p>` : ""}
      <p class="small muted" style="margin-top:8px">The number is each player's rating in that position (out of 20). A dashed ring means he's playing out of position. Tap a player for his card.</p></section>
    <section class="card"><div class="card-h"><h3>Substitutes</h3></div>${bench.length ? bench.map(p => `<div class="row between small" style="padding:2px 0"><span><span class="pos">${p.pos}</span> <button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button></span><span>${fitTxt(p)} ${rating(p.ovr)}</span></div>`).join("") : "<p class='small muted'>Nobody else is fit.</p>"}
      ${out2.length ? `<h3 style="margin:12px 0 6px">Unavailable or unsettled</h3>${out2.map(p => `<p class="small">${esc(p.name)} (${p.pos}): ${p.inj ? `injured, ${p.inj} week${p.inj > 1 ? "s" : ""}` : "unsettled, playing below his best"}</p>`).join("")}` : ""}</section>
  </div><div class="stack">
    <section class="card"><div class="card-h"><h2>How we play</h2></div>
      <p class="lead"><b>${st.l}.</b> ${esc(st.d)}</p>
      <p class="small" style="margin:6px 0">${esc(focusTxt || "")}</p>
      <dl class="ledger"><dt>Formation</dt><dd>${form}</dd><dt>Squad suits the style</dt><dd>${fitText(fit)}</dd>${hired ? `<dt>Tactics</dt><dd>${sr20(M.at.tac)}/20</dd><dt>Motivation</dt><dd>${sr20(M.at.mot)}/20</dd>` : ""}<dt>Team morale</dt><dd>${Math.round(c.morale)}</dd></dl>
      <h3 style="margin:14px 0 6px">What the style needs</h3><div class="stack" style="gap:6px">${keyRows}</div></section>
    <section class="card"><div class="card-h"><h3>Strength against the division</h3></div>${line("Attack", "a")}${line("Midfield", "m")}${line("Defence", "d")}
      <p class="small muted" style="margin-top:6px">This eleven's ratings in their positions, as the match engine weighs them, against the average side in the ${LEAGUES[c.lg].name}. Morale, the manager's tactics and how well the squad suits his style come on top.</p></section>
    <section class="card"><div class="card-h"><h3>Styles this squad would suit</h3></div>${styles.map(([k, S, f]) => `<div class="row between small" style="padding:3px 0"><span>${S.l}${k === M.phil ? ' <span class="chip xi">CURRENT</span>' : ""}</span><span>${fitText(f)}</span></div>`).join("")}
      <p class="small muted" style="margin-top:6px">Worth knowing when you choose a manager: his style works best with a squad built for it.</p></section>
    ${opp ? `<section class="card"><div class="card-h"><h3>Next opponent</h3></div><p>${clubLink(opp)} <span class="muted small">${nf.h === c.id ? "home" : "away"} · week ${nf.w + 1}</span></p>
      <dl class="ledger" style="margin-top:6px"><dt>They play</dt><dd>${STYLES[opp.coach.style].l}, ${opp.coach.form}</dd><dt>Their side</dt><dd>${rating(avg(oxi.map(o => roleRating(o.p, o.slot))))}</dd><dt>Ours</dt><dd>${rating(avg(xi.map(o => roleRating(o.p, o.slot))))}</dd></dl></section>` : ""}
  </div></div>`;
}

/* ---------- Office: league position, top performers, areas of need ---------- */
/* Office: each domestic cup you're still in: the next tie (or a bye), and your run so far. Winners get a trophy card. */
function cupsOfficeCard() {
  const cell = id => { const x = CL(id); return `${crest(x, 14)} <button class="lnk" data-act="club" data-id="${id}">${esc(x.name)}</button> <span class="muted small">${esc(TIER_NAME[x.tier] || "")}</span>`; };
  return Object.entries(G.cups || {}).filter(([, K]) => K.win === G.club || (K.alive || []).includes(G.club)).map(([k, K]) => {
    const D = CUP_DEF[k], link = `<button class="lnk small" data-act="sub" data-k="comp" data-v="${k}" data-p="league">Full draw</button>`;
    const run = (G.myRes || []).filter(r => r.comp === k).map(r => `<div class="row between small" style="padding:2px 0"><span class="muted">${esc(r.label || "")}</span><span>${r.neutral ? "" : r.home ? "home to " : "away to "}${esc(CL(r.opp).name)}</span><b class="${r.res === "W" ? "good" : "bad"}">${r.gf}–${r.ga}${r.pens ? " p" : ""}</b></div>`).join("");
    if (K.win === G.club) return `<section class="card summary"><h3>🏆 ${esc(D.name)} winners</h3>${run}</section>`;
    const t = (K.ties || []).find(t => t.h === G.club || t.a === G.club), wk = D.weeks[K.round];
    const next = t ? `<p style="margin:2px 0">${K.name === "Final" ? "v" : t.h === G.club ? "Home to" : "Away to"} ${cell(t.h === G.club ? t.a : t.h)}</p><p class="small muted">${K.name === "Final" ? "At a neutral ground · " : ""}Week ${wk + 1}</p>`
      : `<p class="small">A bye in the ${esc((K.name || "").toLowerCase())}: you're through to the next round.</p>`;
    return `<section class="card"><div class="card-h"><h3>${esc(D.name)} · ${esc(K.name || "")}</h3>${link}</div>${next}${run ? `<div style="margin-top:6px;border-top:1px solid var(--line);padding-top:6px">${run}</div>` : ""}</section>`;
  }).join("");
}
/* Office: your European group while you're in it (or your knockout tie while you're still alive). */
function euroOfficeCard() {
  return Object.values(G.cont || {}).filter(K => K.teams && K.teams.includes(G.club)).map(K => {
    const D = CONT[K.key], gi = K.groups.findIndex(g => g.includes(G.club)), link = `<button class="lnk small" data-act="sub" data-k="comp" data-v="${K.key}" data-p="league">All groups</button>`;
    const cell = id => { const x = CL(id); return `${crest(x, 14)} <button class="lnk" data-act="club" data-id="${id}">${esc(x.name)}</button>${x.abroad ? ` <span class="muted small">${esc(COUNTRY[x.country].name)}</span>` : ""}`; };
    if (K.md < 6) {
      const t = groupTable(K, gi), nx = CONT_GROUP_WEEKS[K.md];
      return `<section class="card"><div class="card-h"><h3>${esc(D.name)} · Group ${"ABCDEFGH"[gi]}</h3>${link}</div><div class="tbl-wrap"><table class="lg"><thead><tr><th style="text-align:left">Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>
        ${t.map((r, i) => `<tr class="${i < 2 ? "z-up" : ""} ${r.id === G.club ? "me" : ""}"><td style="text-align:left">${cell(r.id)}</td><td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${r.gf - r.ga}</td><td class="num"><b>${r.pts}</b></td></tr>`).join("")}</tbody></table></div>
        <p class="small muted" style="margin-top:6px">Matchday ${K.md + 1} of 6${nx != null ? ` in week ${nx + 1}` : ""}. The top two go through to the round of 16.</p></section>`;
    }
    // Knockouts: your tie in the current round, if you're still in it (or the trophy, if you've won it).
    if (K.win === G.club) return `<section class="card summary"><h3>🏆 ${esc(D.name)} winners</h3></section>`;
    const R = K.ko[K.ko.length - 1], t = R && R.ties.find(t => t.h === G.club || t.a === G.club);
    if (!t || t.w != null) return "";
    const score = t.g1 ? `${t.g1[0]}–${t.g1[1]}${t.g2 ? `, ${t.g2[0]}–${t.g2[1]}` : ""}` : "v";
    return `<section class="card"><div class="card-h"><h3>${esc(D.name)} · ${R.n}</h3>${link}</div><div class="row between small" style="padding:3px 0"><span>${cell(t.h)}</span><b class="num">${score}</b><span style="text-align:right">${cell(t.a)}</span></div>
      <p class="small muted" style="margin-top:6px">Week${R.n === "Final" ? "" : "s"} ${CONT_KO.find(x => x.n === R.n).w.map(w => w + 1).join(" & ")}.</p></section>`;
  }).join("");
}
function positionCard(c) {
  const L = LEAGUES[c.lg], t = table(c.lg), i = t.findIndex(r => r.id === c.id), me = t[i], n = t.length;
  if (G.phase === "summer" || !me || !me.p) return `<section class="card"><div class="card-h"><h2>${L.name}</h2></div><p>${L.auto} promoted automatically${L.po ? `, ${ord(L.po[0])}–${ord(L.po[1])} to the play-offs` : ""}, bottom ${L.down} ${L.tier === 7 ? "drop out of the pyramid" : "relegated"}.</p>${G.phase === "summer" ? "" : miniTable(c.lg)}</section>`;
  const gap = pos => { const r = t[pos - 1]; return r ? r.pts - me.pts : 0; };
  const lines = [];
  if (L.auto && i + 1 > L.auto) lines.push(`${gap(L.auto)} point${gap(L.auto) === 1 ? "" : "s"} off automatic promotion`);
  else if (L.auto) lines.push(`In an automatic promotion place${i + 1 < n ? `, ${me.pts - t[L.auto].pts} clear` : ""}`);
  if (L.po && i + 1 > L.po[1]) lines.push(`${gap(L.po[1])} off the play-offs`);
  else if (L.po && i + 1 >= L.po[0]) lines.push("In the play-off places");
  if (L.down) { const safe = n - L.down; if (i + 1 > safe) lines.push(`<span class="bad">${gap(safe)} point${gap(safe) === 1 ? "" : "s"} from safety</span>`); else lines.push(`${me.pts - t[safe].pts} clear of the drop`); }
  return `<section class="card"><div class="card-h"><h2>${ord(i + 1)} <span class="muted" style="font-size:.6em">of ${n}</span></h2><span class="small muted">${me.pts} pts · ${me.w}W ${me.d}D ${me.l}L · GD ${me.gf - me.ga >= 0 ? "+" : ""}${me.gf - me.ga}</span></div>
    <p class="small" style="margin-bottom:8px">${lines.join(" · ")}</p>${miniTable(c.lg)}
    <div class="row" style="margin-top:6px"><button class="lnk small" data-act="page" data-p="league">Full table</button></div></section>`;
}
/* The Office's Team tab: a card for each competition you're in this season (friendlies left out). The league: the
   full table. Europe: your group table, then every result by stage, two-legged ties with the aggregate. Each cup: your
   results round by round, and whether you're still in, out, or the winners. Each card carries your record in it. */
const recOf = rs => { const o = { p: rs.length, w: 0, d: 0, l: 0, f: 0, a: 0 }; for (const r of rs) { o.f += r.gf; o.a += r.ga; r.gf > r.ga ? o.w++ : r.gf < r.ga ? o.l++ : o.d++; } return o; };
const recLine = o => o.p ? `P${o.p} · ${o.w}W ${o.d}D ${o.l}L · ${o.f}–${o.a}` : "No games yet";
const resRow = r => `<div class="row between small" style="padding:3px 0;gap:8px"><span class="muted" style="flex:0 0 auto">${esc(r.label || "")}</span><span style="text-align:right;flex:1">${r.neutral ? "v" : r.home ? "home to" : "away to"} ${clubLink(CL(r.opp))}</span><b class="num ${r.gf > r.ga ? "good" : r.gf < r.ga ? "bad" : ""}" style="flex:0 0 auto">${r.gf}–${r.ga}${r.pens ? " p" : ""}</b></div>`;
function compCards(c, today) {  // today: every cup and European competition this season, without the league card (Today has the table)
  const R = (G.myRes || []).filter(r => r.comp && r.comp !== "F"), out = [];
  // The league (and the play-offs, if you're in them)
  const L = LEAGUES[c.lg], lr = R.filter(r => r.comp === c.lg), po = R.filter(r => r.comp === "PO");
  if (!today) out.push(`<section class="card"><div class="card-h"><h2>${esc(L.name)}</h2><span class="small muted">${recLine(recOf(lr))}</span></div>${G.phase === "summer" ? `<p class="small muted">The season starts soon.</p>` : tableHTML(c.lg, table(c.lg), 0, true)}
    ${po.length ? `<div style="margin-top:8px;border-top:1px solid var(--line);padding-top:6px"><b class="small">Play-offs</b>${po.map(resRow).join("")}</div>` : ""}</section>`);
  // Europe
  for (const K of Object.values(G.cont || {}).filter(K => K.teams && K.teams.includes(c.id))) {
    const D = CONT[K.key], gi = K.groups.findIndex(g => g.includes(c.id)), rs = R.filter(r => r.comp === K.key), t = groupTable(K, gi);
    const grp = `<div class="tbl-wrap"><table class="lg"><thead><tr><th style="text-align:left">Group ${"ABCDEFGH"[gi]}</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>${t.map((r, i) => `<tr class="${i < 2 && K.md === 6 ? "z-up" : ""} ${r.id === c.id ? "me" : ""}"><td style="text-align:left">${crest(CL(r.id), 14)} ${clubLink(CL(r.id))}</td><td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${r.gf - r.ga}</td><td class="num"><b>${r.pts}</b></td></tr>`).join("")}</tbody></table></div>`;
    const ko = K.ko.map(RD => { const tie = RD.ties.find(t => t.h === c.id || t.a === c.id); if (!tie) return ""; const lbl = r => (r.label || "").toLowerCase(), games = rs.filter(r => RD.n === "Final" ? / final$/.test(lbl(r)) : lbl(r).includes(RD.n.toLowerCase() + ","));
      const agg = tie.g1 ? (() => { const me = tie.h === c.id; const f = (me ? tie.g1[0] : tie.g1[1]) + (tie.g2 ? (me ? tie.g2[0] : tie.g2[1]) : 0), a = (me ? tie.g1[1] : tie.g1[0]) + (tie.g2 ? (me ? tie.g2[1] : tie.g2[0]) : 0); /* g2 is kept from the first leg's home side's view */ return `${f}–${a}`; })() : "";
      const wks = CONT_KO.find(x => x.n === RD.n).w, me1 = tie.h === c.id;
      const st = tie.w == null ? (RD.n === "Final" ? `<span class="muted">week ${wks[0] + 1}</span>` : !tie.g1 ? `<span class="muted">first leg in week ${wks[0] + 1} (${me1 ? "home" : "away"}), second leg in week ${wks[1] + 1}</span>` : `<span class="muted">first leg ${me1 ? tie.g1[0] : tie.g1[1]}–${me1 ? tie.g1[1] : tie.g1[0]} · second leg in week ${wks[1] + 1} (${me1 ? "away" : "home"})</span>`) : tie.w === c.id ? `<span class="good">through${RD.n === "Final" ? ": winners" : ""}</span>` : `<span class="bad">out</span>`;
      const opp = CL(tie.h === c.id ? tie.a : tie.h), vs = `<div class="small" style="padding:2px 0">v ${crest(opp, 14)} ${clubLink(opp)}${opp.abroad ? ` <span class="muted">${esc(COUNTRY[opp.country].name)}</span>` : ""}${opp.lvl ? ` <span class="muted">· team rated about ${Math.round(to20(opp.lvl))}</span>` : ""}</div>`;
      return `<div style="margin-top:6px"><div class="row between small"><b>${RD.n}</b><span>${agg && RD.n !== "Final" && tie.w != null ? `${agg} on aggregate · ` : ""}${st}</span></div>${tie.w == null ? vs : ""}${games.map(resRow).join("")}</div>`; }).join("");
    const lastKO = K.ko.map(RD => [RD, RD.ties.find(t => t.h === c.id || t.a === c.id)]).filter(x => x[1]).pop();
    const status = K.win === c.id ? `🏆 Winners` : K.md < 6 ? `Group stage · matchday ${K.md + 1} of 6` : t.findIndex(r => r.id === c.id) >= 2 ? `<span class="bad">Out in the group stage</span>`
      : !lastKO ? `<span class="good">Through to the knockouts</span>` : lastKO[1].w == null ? `In the ${lastKO[0].n.toLowerCase()}` : lastKO[1].w === c.id ? `<span class="good">Through to the next round</span>` : `<span class="bad">Out in the ${lastKO[0].n.toLowerCase()}</span>`;
    out.push(`<section class="card"><div class="card-h"><h2>${esc(D.name)}</h2><span class="small muted">${recLine(recOf(rs))}</span></div>${status ? `<p class="small" style="margin-bottom:6px">${status}</p>` : ""}${grp}
      <div style="margin-top:8px">${rs.filter(r => /group/i.test(r.label || "") || !K.ko.length).map(resRow).join("") || ""}</div>${ko}</section>`);
  }
  // Domestic cups you've entered this season
  for (const [k, K] of Object.entries(G.cups || {})) {
    const D = CUP_DEF[k], rs = R.filter(r => r.comp === k), alive = (K.alive || []).includes(c.id) && K.win == null; if (!rs.length && !alive && K.win !== c.id) continue;
    const t = (K.ties || []).find(t => t.h === c.id || t.a === c.id), last = rs[rs.length - 1];
    const status = K.win === c.id ? `🏆 Winners` : alive ? (t ? `Still in · ${esc(K.name || "")}: ${t.h === c.id ? "home to" : "away to"} ${clubLink(CL(t.h === c.id ? t.a : t.h))}, week ${D.weeks[K.round] + 1}` : `Still in · a bye in the ${esc((K.name || "").toLowerCase())}`) : last ? `<span class="bad">Out in the ${esc((last.label || "").toLowerCase())}</span> to ${clubLink(CL(last.opp))}` : "";
    out.push(`<section class="card"><div class="card-h"><h2>${esc(D.name)}</h2><span class="small muted">${recLine(recOf(rs))}</span></div><p class="small" style="margin-bottom:6px">${status}</p>${rs.map(resRow).join("")}</section>`);
  }
  return out.join("");
}
function performersCard(c) {
  const ps = c.squad.map(P).filter(p => !p.acad || myS(p).app), any = ps.some(p => myS(p).app);  // for your club only
  const top = (f, k, unit) => { const l = ps.filter(p => f(p) > 0).sort((a, b) => f(b) - f(a) || b.ovr - a.ovr).slice(0, 3);
    return l.length ? l.map(p => `<div class="row between small" style="padding:2px 0"><span><span class="pos">${p.pos}</span> <button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button></span><b class="num">${f(p)}${unit ? " " + unit : ""}</b></div>`).join("") : `<p class="small muted">None yet.</p>`; };
  const best = ps.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  return `<section class="card"><div class="card-h"><h2>Top performers</h2><span class="small muted">this season</span></div>
    <div class="perf">
      <div><h3>Goals</h3>${any ? top(p => myS(p).g, "g") : `<p class="small muted">No games yet.</p>`}</div>
      <div><h3>Assists</h3>${any ? top(p => myS(p).a, "a") : `<p class="small muted">No games yet.</p>`}</div>
      <div><h3>Best players</h3>${best.map(p => `<div class="row between small" style="padding:2px 0"><span><span class="pos">${p.pos}</span> <button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button></span>${rating(p.ovr)}</div>`).join("")}</div>
    </div></section>`;
}
function needsCard(c) {
  const needs = squadNeeds(c), xi = pickXI(c), L = lineStrength(xi), div = G.leagues[c.lg].clubs.filter(id => id !== c.id).map(id => lineStrength(pickXI(CL(id))));
  const lines = [["Attack", "a"], ["Midfield", "m"], ["Defence", "d"]].map(([l, k]) => [l, r20(L[k]) - r20(avg(div.map(x => x[k])))]).sort((a, b) => a[1] - b[1]);
  const weak = lines[0], s = staffOf("recruit");
  return `<section class="card"><div class="card-h"><h2>Areas of need</h2><button class="lnk small" data-act="page" data-p="tactics">Tactics</button></div>
    ${needs.length ? needs.slice(0, 5).map(n => `<div class="row between" style="padding:4px 0;border-top:1px solid var(--line)"><span><span class="pos">${n.pos}</span> ${n.kind === "depth" ? `<b>${n.short} more needed</b>` : `<b>needs an upgrade</b>`} <span class="small muted">best now ${n.weakest ? r20(n.weakest) : "—"}, typical ${r20(TIER_LVL[c.tier])}</span></span><button class="btn sm" data-act="mfind" data-k="${n.pos}">Find</button></div>`).join("")
      : `<p class="small">Every position is covered at your division's standard.</p>`}
    <p class="small" style="margin-top:8px">Weakest area: <b>${weak[0].toLowerCase()}</b> ${weak[1] < 0 ? `<span class="bad">${weak[1]} on the division average</span>` : weak[1] > 0 ? `<span class="good">still +${weak[1]} on the division average</span>` : "level with the division average"}.</p>
    <p class="small muted" style="margin-top:4px">${s ? `${esc(s.name)} is working through these in the transfer windows.` : "You have no head of recruitment to fill them."}</p></section>`;
}

/* ---------- the owner's profile ---------- */
function ownerRecord() {
  const H = G.history.slice().reverse(), c = my(), clubs = [...(G.career || []).map(x => x.club), c.name];
  const trophies = [...c.trophies.filter(t => t[0] >= (c.ownedFrom ?? c.founded)).map(t => [t[0], t[1], c.name])];
  for (const h of H) for (const cup of h.cups || []) if (/winners/.test(cup) && !trophies.some(t => t[0] === h.y && cup.startsWith(t[1]))) trophies.push([h.y, cup.replace(": winners", ""), h.club || c.name]);
  for (const h of H) if (h.pos === 1 && !trophies.some(t => t[0] === h.y && t[1] === LEAGUES[h.lg].name)) trophies.push([h.y, LEAGUES[h.lg].name, h.club || c.name]);
  // Milestones: the first time each thing happened.
  const ms = [], first = (test, text) => { const h = H.find(test); if (h) ms.push([h.y, text(h)]); };
  ms.push([c.ownedFrom ?? c.founded, (c.ownedFrom != null ? "Bought " : "Founded ") + (G.career && G.career.length ? (G.career[0].club) : c.name)]);
  first(h => h.up, h => `First promotion, into the ${LEAGUES[ABOVE[h.lg] || h.lg].name}`);
  first(h => h.pos === 1, h => `First title: the ${LEAGUES[h.lg].name}`);
  first(h => (h.cups || []).some(x => /winners/.test(x)), h => `First cup: ${(h.cups.find(x => /winners/.test(x)) || "").replace(": winners", "")}`);
  first(h => (h.cups || []).some(x => /Champions Cup|Continental Shield/.test(x)), h => "First season in Europe");
  for (const t of [5, 3, 1]) first(h => h.tier <= t, h => t === 1 ? "Reached the Premier Division" : `Reached the ${TIER_NAME[t]}`);
  const legends = (c.legends || []).slice().sort((a, b) => a.to - b.to); if (legends[0]) ms.push([legends[0].to, `First club legend retired: ${legends[0].name}`]);
  for (const x of G.career || []) ms.push([x.to, `Sold ${x.club} for ${money(x.sold)}`]);
  ms.sort((a, b) => a[0] - b[0]);
  return { H, clubs, trophies: trophies.sort((a, b) => a[0] - b[0]), ms,
    ups: H.filter(h => h.up).length, downs: H.filter(h => h.down).length, best: H.length ? H.slice().sort((a, b) => a.tier - b.tier || a.pos - b.pos)[0] : null };
}
function pgOwner() {
  const c = my(), O = G.owner, R = ownerRecord(), v = valuation(c), stake = Math.round(v * ownPct() / 100), lent = O.lent || 0, worth = O.wealth + stake + lent;
  const since = (G.career && G.career[0] ? G.career[0].from : c.ownedFrom ?? c.founded), years = G.year - since + (G.phase === "summer" ? 0 : 1);
  const staffT = Object.values(c.staff).filter(Boolean).map(s => s.trust), med = G.meddle || 0;
  const style = med >= 3 ? ["Very hands-on: you overrule your staff a lot", "bad"] : med >= 1 ? ["Hands-on: you step in now and then", "warn"] : ["Hands-off: you let your staff work", "good"];
  const inv = (G.board || {}).inv || [], invMood = inv.length ? avg(inv.map(i => i.mood)) : null;
  const V = vision(), topPri = Object.entries(V.pri).sort((a, b) => b[1] - a[1]).filter(x => x[1] > 0).slice(0, 3).map(([k, n]) => `${PRIORITIES[k].l} ${"●".repeat(n)}`).join(" · ");
  return `<div class="grid2"><div class="stack">
    <section class="card summary"><div class="card-h"><h2>${esc(O.name)}</h2><span class="small muted">${WEALTH[O.kind] ? WEALTH[O.kind].l : "Owner"} · ${ord(years)} season as an owner</span></div>
      <label class="small">Your name <input type="text" data-act="oname" value="${esc(O.name)}" maxlength="30"></label>
      <dl class="ledger" style="margin-top:12px"><dt>Your fortune</dt><dd>${money(O.wealth)}</dd><dt>Your ${ownPct()}% of ${esc(c.name)}</dt><dd>${money(stake)}</dd>${lent ? `<dt>Lent to the club</dt><dd>${money(lent)}</dd>` : ""}
        <dt class="tot">Net worth</dt><dd class="tot">${money(worth)}</dd><dt>Put in so far</dt><dd>${money(O.invested)}</dd>
        <dt>Started with</dt><dd>${WEALTH[O.kind] ? money(WEALTH[O.kind].amt) : "—"}</dd></dl></section>
    <section class="card"><div class="card-h"><h3>How you're seen</h3></div><dl class="ledger">
      <dt>Supporters</dt><dd>${word(moodWord(c.mood))}</dd>
      <dt>Supporters' trust</dt><dd>${G.sTrust ? `${Math.round(G.sTrust.rel)}/100` : "—"}</dd>
      <dt>Your staff</dt><dd>${staffT.length ? word(trustWord(avg(staffT))) : "No staff yet"}</dd>
      ${invMood != null ? `<dt>Investors</dt><dd>${invMood >= 60 ? '<span class="good">Happy</span>' : invMood >= 35 ? "Watchful" : '<span class="bad">Unhappy</span>'}</dd>` : ""}
      <dt>Media profile</dt><dd>${Math.round(c.media || 10)}/100</dd>
      <dt>How hands-on you are</dt><dd>${s20(myHandsOn())}/20</dd></dl>
      <p class="small ${style[1]}" style="margin-top:8px">${style[0]}.</p></section>
    <section class="card"><div class="card-h"><h3>Your vision</h3><button class="lnk small" data-act="page" data-p="board">Change</button></div>
      <p class="small"><b>Football:</b> ${V.style === "any" ? "whatever wins" : STYLES[V.style].l} · <b>Recruitment:</b> ${V.recruit === "any" ? "left to the experts" : ROLES_STAFF.recruit.phil[V.recruit].l}</p>
      <p class="small" style="margin-top:4px"><b>Priorities:</b> ${topPri || "none set"}</p></section>
  </div><div class="stack">
    ${prestigeCard()}
    <section class="card"><div class="card-h"><h2>Record</h2></div><dl class="ledger">
      <dt>Seasons</dt><dd>${R.H.length}</dd><dt>Promotions</dt><dd>${R.ups}</dd><dt>Relegations</dt><dd>${R.downs}</dd><dt>Trophies</dt><dd>${R.trophies.length}</dd>
      <dt>Best finish</dt><dd style="font-family:inherit">${R.best ? `${ord(R.best.pos)}, ${LEAGUES[R.best.lg].name} (${seasonLabel(R.best.y)})` : "—"}</dd>
      <dt>Clubs owned</dt><dd style="font-family:inherit">${R.clubs.map(esc).join(", ")}</dd></dl>
      ${R.trophies.length ? `<h3 style="margin:12px 0 6px">Honours</h3>${R.trophies.map(t => `<p class="small">🏆 ${seasonLabel(t[0])} · ${esc(t[1])}${R.clubs.length > 1 ? ` <span class="muted">(${esc(t[2])})</span>` : ""}</p>`).join("")}` : ""}</section>
    <section class="card"><div class="card-h"><h3>Milestones</h3></div>${R.ms.map(([y, t]) => `<div class="row small" style="padding:3px 0;gap:10px"><span class="num muted" style="min-width:4ch">${y}</span><span>${esc(t)}</span></div>`).join("")}
      ${R.H.length < 2 ? `<p class="small muted" style="margin-top:6px">Promotions, titles, cups, European football and club legends will appear here as they happen.</p>` : ""}</section>
  </div></div>`;
}

/* ---------- transfer activity: your club's moves ---------- */
const MOVE_KIND = { in: ["Signed", "good"], out: ["Sold", "warn"], release: ["Released", "bad"], expired: ["Contract ended", "muted"], loanin: ["Loan in", "good"], loanout: ["Loan out", "warn"], loanback: ["Back from loan", "muted"], loanend: ["Loan ended", "muted"], youth: ["Academy signing", "good"] };
const MOVE_BY = { you: "You", recruit: "Head of recruitment", suggestion: "Your suggestion", "first refusal": "First refusal (feeder)", partner: "Partner club offer", emergency: "Emergency signing", administrators: "Administrators" };
const moveWhen = m => m.ph === "summer" ? `Pre-season wk ${m.w + 1}` : m.ph === "playoffs" ? "End of season" : `${JAN.includes(m.w) ? "January" : "Week"} ${JAN.includes(m.w) ? "" : m.w + 1}`.trim();
function pgMoves() {
  const L = G.tlog || [], ys = [...new Set(L.map(m => m.y))].sort((a, b) => b - a), y = SUB.my ?? (ys[0] ?? G.year), t = SUB.mt || "all";
  const inY = L.filter(m => y === "all" || m.y === +y);
  const groups = { all: () => true, in: m => m.kind === "in" || m.kind === "youth", out: m => m.kind === "out", loans: m => m.kind.startsWith("loan"), left: m => m.kind === "release" || m.kind === "expired" };
  const rows = inY.filter(groups[t]);
  const spent = sum(inY.filter(m => m.kind === "in" || m.kind === "youth"), m => m.fee || 0), got = sum(inY.filter(m => m.kind === "out"), m => m.fee || 0), payoffs = sum(inY.filter(m => m.kind === "release"), m => m.fee || 0);
  const nIn = inY.filter(m => m.kind === "in" || m.kind === "youth" || m.kind === "loanin").length, nOut = inY.filter(m => ["out", "release", "expired", "loanout"].includes(m.kind)).length;
  const ag = incoming();
  const agreed = ag.length ? `<section class="card"><div class="card-h"><h2>Agreed: joining when the window opens</h2><span class="small muted">${ag.length}</span></div>
    ${sortTable("agreed", [
      { k: "name", l: "Player", left: true, v: p => p.name, f: p => `<button class="lnk" data-act="player" data-id="${p.id}">${esc(p.name)}</button><br><span class="small muted">${p.pos} · ${p.age} · rated ${r20(p.ovr)}</span>` },
      { k: "club", l: "From", left: true, v: p => fromName(p), f: p => `<span class="small">${esc(fromName(p))}</span>` },
      { k: "when", l: "Joins", left: true, v: p => toMeWhen(p) === "jan" ? 0 : 1, f: p => `<span class="small">${toMeWhen(p) === "jan" ? "January window<br><span class='muted'>this season's accounts</span>" : "Summer window<br><span class='muted'>next season's accounts</span>"}</span>` },
      { k: "fee", l: "Fee", r: true, v: p => p.toMe.fee, f: p => p.toMe.fee ? money(p.toMe.fee) : "Free" },
      { k: "wage", l: "Wage", r: true, v: p => p.toMe.wage, f: p => pw(p.toMe.wage) },
      { k: "by", l: "Deal by", left: true, v: p => p.toMe.rec ? 1 : 0, f: p => `<span class="small muted">${p.toMe.rec ? "Head of recruitment (your suggestion)" : "You (club cash, outside the budgets)"}</span>` },
    ], ag, { sort: { k: "when", d: 1 }, quiet: true })}
    <p class="small muted" style="margin-top:6px">Nothing is paid until he joins: the fee comes out then and his wages start. Deals your head of recruitment agrees for January are held back from this season's transfer budget; summer ones come out of next season's.</p></section>` : "";
  return `<div class="stack">${agreed}<section class="card"><div class="card-h"><h2>Transfer activity</h2>
      <select data-act="msel">${["all", ...ys].map(v => `<option value="${v}" ${String(v) === String(y) ? "selected" : ""}>${v === "all" ? "All seasons" : seasonLabel(+v)}</option>`).join("")}</select></div>
    <dl class="ledger"><dt>In / out</dt><dd>${nIn} / ${nOut}</dd><dt>Spent on fees</dt><dd>${money(spent)}</dd><dt>Received</dt><dd>${money(got)}</dd>${payoffs ? `<dt>Paid to release players</dt><dd>${money(payoffs)}</dd>` : ""}
      <dt class="tot">Net</dt><dd class="tot ${got - spent - payoffs < 0 ? "bad" : "good"}">${money(got - spent - payoffs)}</dd></dl>
    <div class="chips" style="margin:12px 0">${[["all", "All"], ["in", "Signings"], ["out", "Sales"], ["loans", "Loans"], ["left", "Released & expired"]].map(([k, l]) => `<button data-act="sub" data-k="mt" data-v="${k}" aria-pressed="${t === k}">${l}</button>`).join("")}</div>
    ${rows.length ? sortTable("moves", [
      { k: "when", l: "When", left: true, v: m => m.y * 1000 + (m.ph === "summer" ? 0 : m.ph === "playoffs" ? 900 : 100 + m.w), f: m => `<span class="small">${y === "all" ? seasonLabel(m.y) + "<br>" : ""}${moveWhen(m)}</span>` },
      { k: "name", l: "Player", left: true, v: m => m.name, f: m => `${G.players[m.id] ? `<button class="lnk" data-act="player" data-id="${m.id}">${esc(m.name)}</button>` : esc(m.name)}<br><span class="small muted">${m.pos} · ${m.age} · rated ${m.r}</span>` },
      { k: "kind", l: "Move", left: true, v: m => MOVE_KIND[m.kind][0], f: m => `<span class="small ${MOVE_KIND[m.kind][1]}">${MOVE_KIND[m.kind][0]}</span>${m.share != null ? `<br><span class="small muted">you pay ${Math.round((m.kind === "loanout" ? 1 - m.share : m.share) * 100)}% of his wages</span>` : ""}` },
      { k: "club", l: "From / to", left: true, v: m => m.club || "", f: m => `<span class="small">${esc(m.club || "—")}</span>` },
      { k: "fee", l: "Fee", r: true, v: m => m.fee || 0, f: m => m.fee ? `<span class="${m.kind === "out" ? "good" : ""}">${m.kind === "release" ? "−" : ""}${money(m.fee)}</span>` : m.kind === "in" ? "Free" : "—" },
      { k: "wage", l: "Wage", r: true, v: m => m.wage || 0, f: m => m.wage ? pw(m.wage) : "—" },
      { k: "by", l: "Deal by", left: true, v: m => m.by || "", f: m => `<span class="small muted">${esc(MOVE_BY[m.by] || "")}</span>` },
    ], rows, { sort: { k: "when", d: -1 }, quiet: true }) : `<p class="muted">${L.length ? "No moves of this kind." : "Your club's signings, sales, loans and releases will be listed here from now on."}</p>`}</section></div>`;
}

/* ---------- club prestige ----------
   Prestige is the club's reputation (0-100): it decides who will join you (players and staff), what sponsors pay, how
   fast the support grows and how many come through the gate. It moves at the end of each season, 30% of the way to
   your division's standing plus or minus your finish (about four points either way), with a bump for European nights. */
const PRESTIGE_WORDS = [[88, "Elite"], [75, "A big club"], [60, "Established"], [45, "Respected"], [30, "Regional name"], [15, "Local club"], [0, "Unknown"]];
const prestigeWord = r => PRESTIGE_WORDS.find(([t]) => r >= t)[1];
function prestigeProjection(c) {
  const L = G.leagues[c.lg], n = L.clubs.length, pos = G.phase === "season" || G.phase === "playoffs" ? table2(c.lg, c.id, n) : 0;
  return { pos, target: TIER_REP[c.tier] + pos, next: clamp(Math.round(c.rep + (TIER_REP[c.tier] + pos - c.rep) * .3), 1, 99) };
}
function prestigeCard() {
  const c = my(), pr = prestigeProjection(c), eng = G.clubs.filter(x => !x.gone && !x.abroad), rankE = eng.filter(x => x.rep > c.rep).length + 1;
  const div = G.leagues[c.lg].clubs.map(CL), rankD = div.filter(x => x.rep > c.rep).length + 1;
  const log = [...(G.repLog || []).filter(r => r[0] < G.year), [G.year, c.rep]], pts = [...log.map(r => r[1]), pr.next];
  const w = 240, h = 60, lo = Math.max(0, Math.min(...pts) - 5), hi = Math.min(100, Math.max(...pts) + 5), X = i => 8 + i * (w - 16) / Math.max(1, pts.length - 1), Y = v => h - 8 - (v - lo) / Math.max(1, hi - lo) * (h - 16);
  const line = pts.length > 1 ? `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Prestige by season"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.slice(0, -1).map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/><line x1="${X(pts.length - 2).toFixed(1)}" y1="${Y(pts[pts.length - 2]).toFixed(1)}" x2="${X(pts.length - 1).toFixed(1)}" y2="${Y(pr.next).toFixed(1)}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4 3"/>${pts.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === pts.length - 1 ? 3 : 2.5}" fill="${i === pts.length - 1 ? "none" : "var(--accent)"}" stroke="var(--accent)"/>`).join("")}</svg>` : "";
  const d = pr.next - c.rep, nextTier = PRESTIGE_WORDS.slice().reverse().find(([t]) => t > c.rep);
  return `<section class="card"><div class="card-h"><h3>Club prestige</h3><span class="small muted">${esc(prestigeWord(c.rep))}</span></div>
    <div class="row between"><b style="font-size:28px" class="num">${Math.round(c.rep)}</b><span class="small ${d > 0 ? "good" : d < 0 ? "bad" : "muted"}">${G.phase === "summer" ? "Moves at the end of the season" : `End of season, if the table stays as it is: <b>${pr.next}</b> (${d > 0 ? "+" : ""}${d})`}</span></div>
    ${line}
    <dl class="ledger" style="margin-top:6px"><dt>In your division</dt><dd>${ord(rankD)} of ${div.length}</dd><dt>In England</dt><dd>${ord(rankE)} of ${eng.length}</dd>
      <dt>Your division's standing</dt><dd>${TIER_REP[c.tier]}</dd>${G.phase !== "summer" ? `<dt>Your league position is worth</dt><dd class="${pr.pos > 0 ? "good" : pr.pos < 0 ? "bad" : ""}">${pr.pos > 0 ? "+" : ""}${pr.pos}</dd>` : ""}
      ${nextTier ? `<dt>Next: ${esc(nextTier[1])}</dt><dd>${nextTier[0]}</dd>` : ""}</dl>
    <details style="margin-top:6px"><summary class="small">What moves it</summary><p class="small muted" style="margin-top:4px">Prestige drifts each summer toward your division's standing, plus up to four for finishing near the top (or minus for near the bottom). Promotion lifts the standing it drifts toward; European football adds a point, a European trophy four. It decides who'll join you, what sponsors pay, how fast your support grows and how many come through the gate.</p></details></section>`;
}

/* Your supporters: the mix of kinds, what each does, and what shifts it. */
function supportersCard(c) {
  const m = fanMix(c), top = Object.keys(m).sort((a, b) => m[b] - m[a])[0], col = FAN_COL;
  return `<section class="card"><div class="card-h"><h3>Your supporters</h3><span class="small muted">${c.fans.toLocaleString("en-GB")} · ${word(moodWord(c.mood))}</span></div>
    <div class="fanbar">${Object.keys(FAN_KINDS).map(k => `<i style="width:${m[k]}%;background:${col[k]}" title="${FAN_KINDS[k][0]} ${m[k]}%"></i>`).join("")}</div>
    ${Object.entries(FAN_KINDS).map(([k, [l, d]]) => `<div class="row between small" style="padding:3px 0;gap:8px;flex-wrap:nowrap"><span><span class="dot" style="background:${col[k]}"></span> <b>${l}</b> <span class="muted">${d}</span></span><b class="num">${m[k]}%</b></div>`).join("")}
    <details style="margin-top:6px"><summary class="small">Mostly ${FAN_KINDS[top][0].toLowerCase()}. What shifts it</summary><p class="small muted" style="margin-top:4px">The mix shifts each summer: promotions bring fair-weather fans (relegation sends them away and leaves the loyal), steady seasons and a happy crowd build loyalty, terraces build a hardcore, and cheap tickets and a family stand bring in the community.</p></details></section>`;
}

/* One member of staff's targets on his Staff tab: chosen in week 1 of pre-season, then progress through the season. */
function staffTargetsCard(role) {
  const c = my(), S = G.sobj && G.sobj.y === G.year ? G.sobj : null, open = staffTargetsOpen(), mine = S && S[role] && Object.values(S[role]).some(t => t && t.lv);
  const edit = open && (!mine || STO_EDIT === role), who = staffOf(role);
  if (!who) return `<section class="card"><div class="card-h"><h2>Targets</h2></div><p class="muted small">Appoint a ${ROLES_STAFF[role].l.toLowerCase()} to set targets.</p></section>`;
  if (!edit) {
    const list = staffTargets(c).filter(t => t.role === role);
    return `<section class="card"><div class="card-h"><h2>Targets this season</h2>${mine && open ? `<button class="btn sm" data-act="sobjedit" data-role="${role}">Change</button>` : ""}</div>
      ${list.length ? `<div class="tbl-wrap"><table class="proj"><tbody>${list.map(t => `<tr><td style="text-align:left"><span class="small muted">${LVL_NAME[t.lv].toLowerCase()}</span><br>${t.label} ${fmtT(t.k, t.v[t.lv - 1])}</td><td class="num ${t.met ? "good" : ""}">${fmtT(t.k, t.now)}${t.met ? " ✓" : ""}${t.got ? `<br><span class="small muted">${LVL_NAME[t.got].toLowerCase()} level reached</span>` : ""}</td></tr>`).join("")}</tbody></table></div>
      <p class="small muted" style="margin-top:6px">Where each stands now. At the end of the season a met target is rewarded by its level (the hardest most); a missed one costs more the further short it falls. ${esc(who.name)}'s ratings, potential and trust move with it.</p>`
      : `<p class="muted small">${open ? "No targets set yet." : "No targets this season. They're set in week 1 of pre-season."}</p>${open ? `<button class="btn sm" data-act="sobjedit" data-role="${role}">Set targets</button>` : ""}`}</section>`;
  }
  const L = staffTargetLevels(c)[role], cur = k => S && S[role] && S[role][k] ? S[role][k].lv : 0;
  const sel = k => { const [l, v] = L[k]; return `<label class="small"><b>${l}</b><select id="so-${role}-${k}">${LVL_NAME.map((n, i) => `<option value="${i}" ${cur(k) === i ? "selected" : ""}>${i ? `${n}: ${fmtT(k, v[i - 1])}` : n}</option>`).join("")}</select></label>`; };
  return `<section class="card"><div class="card-h"><h2>Set targets for ${esc(who.name)}</h2><span class="small muted">${G.week === 0 ? "week 1 of pre-season" : "this summer only: any week"}</span></div>
    <p class="small muted" style="margin-bottom:10px">Pick a level for each, or no target. Meeting a harder target is rewarded more, the hardest most of all; falling short costs more the further short you finish. Ratings and potential are shown ratings out of 20, scaled to your division; growth is rating points gained this season.</p>
    <div class="price-grid">${role === "recruit" ? `<label class="small"><b>Position</b><select id="so-recruit-posK">${POS.map(p => `<option value="${p}" ${S && S.recruit && S.recruit.posK === p ? "selected" : ""}>${POS_NAME[p]}</option>`).join("")}</select></label>` : ""}${Object.keys(L).map(sel).join("")}</div>
    <div class="row" style="margin-top:10px"><button class="btn primary" data-act="setsobj" data-role="${role}">Set targets</button></div></section>`;
}
let STO_EDIT = null;  // the role whose targets are being changed
