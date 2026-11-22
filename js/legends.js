/* Fan favourites, club legends, popular signings, and players who go into coaching.
   - Every player builds affection (p.love[clubId]) with each club he plays for, every season: appearances, goals,
     assists, loyalty, and more if he came through its academy. 70+ makes him a fan favourite there (about two good seasons), 200+ a legend (six or more).
   - Selling or releasing a favourite upsets your supporters; keeping favourites sells shirts.
   - Legends who retire are remembered on the club's legends list, with a testimonial match that pays the club.
   - Signing a big name for your division (or bringing a favourite home) brings a wave of excitement.
   - Some retiring players move into coaching and turn up among the candidates for your staff; your own legends are
     always offered. Appointing a legend lifts the fans, the supporters' trust and the dressing room. */
"use strict";

const FAV = 70, LEGEND = 200;  // about two good seasons for a favourite, six or more for a legend
const loveOf = (p, cid) => (p.love || {})[cid] || 0;
const favLevel = (p, cid) => { const l = loveOf(p, cid); return l >= LEGEND ? 2 : l >= FAV ? 1 : 0; };
const isLegendOf = (s, cid) => !!(s.ex && s.ex.legendOf.includes(cid));
const favCount = c => c.squad.filter(id => favLevel(P(id), c.id) >= 1).length;

/* Each summer, before the season's numbers are cleared. */
function loveSeason() {
  /* Each club he played for this season gets the credit for his games there. (Loans have already ended by now, so
     "where he is" would credit a loanee's parent club with his season elsewhere; his per-club split doesn't.) A loan
     club, or one he left mid-season, gets a little less. */
  const byShort = new Map(G.clubs.map(x => [x.short, x]));
  for (const p of Object.values(G.players)) {
    if (!p.s.app) continue;
    const loanAt = p.loanedAt && p.loanedAt.y === G.year ? byShort.get(p.loanedAt.short) : null;
    const parts = p.sc && p.sc.y === G.year && Object.keys(p.sc.by).length ? Object.entries(p.sc.by).map(([cid, v]) => [CL(+cid), v])
      : [[loanAt || (p.club >= 0 ? CL(p.club) : null), [p.s.app, p.s.g, p.s.a]]];
    for (const [c, v] of parts) {
      if (!c || !v[0]) continue;
      const home = p.hist.length && p.hist[0][1] === c.short && p.hist[0][0] <= G.year - 1, away = c.id !== p.club || c === loanAt;
      const add = v[0] * .6 + v[1] * 1.5 + v[2] * .7 + 3 + (home ? 3 : 0) + (away ? -3 : 0);
      const before = favLevel(p, c.id);
      (p.love ||= {})[c.id] = Math.round((loveOf(p, c.id) + Math.max(0, add)) * 10) / 10;
      const after = favLevel(p, c.id);
      if (isMine(c) && after > before) news(after === 2 ? `${p.name} is now a club legend in the eyes of the supporters.` : `${p.name} has become a fan favourite.`, after === 2);
    }
  }
}
/* A favourite leaving (sold, released, contract not renewed) hurts. */
function favLeaves(p) {
  if (G.club == null || p.club !== G.club || p._retiring) return;
  const lv = favLevel(p, G.club); if (!lv) return;
  moodHit(my(), lv === 2 ? -10 : -4);
  news(lv === 2 ? `Supporters are furious that club legend ${p.name} is leaving.` : `Supporters are sorry to see fan favourite ${p.name} go.`, lv === 2);
  recordLegend(p, my());
}
function recordLegend(p, c) {
  if (favLevel(p, c.id) < 2) return;
  const L = (c.legends ||= []);
  const here = (p.cs || {})[c.id];  // his games for this club (the season in progress included when it's yours)
  if (!L.some(x => x.name === p.name)) L.push({ name: p.name, pos: p.pos, nat: p.nat, peak: p.peak, apps: p.tot[0] + p.s.app, goals: p.tot[1] + p.s.g,
    here: here ? [here[0] + (p.club === c.id ? p.s.app : 0), here[1] + (p.club === c.id ? p.s.g : 0), (here[2] || 0) + (p.club === c.id ? p.s.a : 0)] : null,
    from: (p.hist.find(h => h[1] === c.short) || [G.year])[0], to: G.year, how: p._retiring ? "retired" : "left" });
}
/* Retirement: legends are honoured, and some players stay in football as staff. */
function onRetire(p) {
  for (const [cid, l] of Object.entries(p.love || {})) {
    const c = G.clubs[+cid]; if (!c || c.gone || l < LEGEND) continue;
    recordLegend(p, c);
    if (isMine(c)) { const gate = Math.round(c.fans * 1.4 * REF_TICKET[c.tier] / 1000) * 1000; earn("gate", gate); moodHit(c, 3); news(`Club legend ${p.name} retires. His testimonial match raises ${money(gate)} for the club.`, true); }
  }
  becomeStaff(p);
}
function becomeStaff(p) {
  const legendOf = Object.entries(p.love || {}).filter(([, l]) => l >= LEGEND).map(([c]) => +c), favOf = Object.entries(p.love || {}).filter(([, l]) => l >= FAV).map(([c]) => +c);
  const mine = G.club != null && (legendOf.includes(G.club) || favOf.includes(G.club));
  if (!mine && R() > .14 + (legendOf.length ? .3 : 0) + (p.peak >= 80 ? .15 : 0)) return;
  const a = p.at, brain = p.pos === "GK" ? (a.dis + a.cmp) / 2 : (a.vis + a.cmp + a.pas) / 3;
  const role = brain > p.peak + 4 || ["CM", "DM", "CB"].includes(p.pos) && R() < .5 ? "manager" : R() < .5 ? "youth" : "recruit";
  const rep = clamp(Math.round(p.peak * .7 - 22 + legendOf.length * 4), 3, 90);
  const s = genStaff(role, rep);
  s.name = p.name; s.age = clamp(p.age + ri(0, 2), 32, 45);
  const base = k => clamp(rh(s.at[k] * .6 + (brain - 20) * .4 + normal() * 4), 5, 95);
  for (const k of Object.keys(s.at)) s.at[k] = base(k);
  if (role === "manager") s.at.mot = clamp(rh(s.at.mot + legendOf.length * 6), 5, 95);
  if (role === "recruit") s.at.net = clamp(rh(s.at.net + new Set(p.hist.map(h => h[1])).size * 3), 5, 95);
  s.ex = { peak: p.peak, pos: p.pos, apps: p.tot[0], goals: p.tot[1], clubs: [...new Set(p.hist.map(h => h[1]))].slice(-5), legendOf, favOf };
  (G.exPros ||= []).push({ y: G.year, s });
  G.exPros = G.exPros.filter(x => G.year - x.y <= 10).slice(-150);
  if (mine) news(`${p.name} wants to stay in football: he's now among the candidates for ${ROLES_STAFF[role].l.toLowerCase()}.`, legendOf.includes(G.club));
}
// Former players who could join you: your own favourites and legends always, plus a few others at your level.
function exProCands(role) {
  const a = attraction(), own = [], others = [];
  for (const x of G.exPros || []) { if (x.s.role !== role) continue; (x.s.ex.favOf.includes(G.club) ? own : others).push(x.s); }
  return [...own, ...others.filter(s => Math.abs(s.rep - a) < 25).sort(() => R() - .5).slice(0, 3)];
}
function hiredExPro(s) {
  G.exPros = (G.exPros || []).filter(x => x.s !== s);
  if (!s.ex) return;
  const c = my();
  if (isLegendOf(s, c.id)) { moodHit(c, 10); trustRel(10); c.morale = clamp(c.morale + 8, 20, 95); { const t0 = s.trust; s.trust = Math.max(s.trust, 75); if (s.tbase) s.tbase.t = s.trust; if (s.trust > t0 && s.tbase) s.tbase.k += "; a club legend coming home, so more"; } news(`A club legend comes home: ${s.name} takes charge as ${ROLES_STAFF[s.role].l.toLowerCase()}. The supporters are delighted.`, true); bumpMedia(4); }
  else if (s.ex.favOf.includes(c.id)) { moodHit(c, 4); trustRel(4); news(`Former fan favourite ${s.name} returns to the club.`); }
}

/* Popular signings: how much a new arrival excites the supporters (0-30). */
function signingBuzz(p, c) {
  let b = Math.max(0, (p.ovr - TIER_LVL[c.tier] - 6) * 1.3) + Math.max(0, (p.peak - TIER_LVL[c.tier] - 10) * .4);
  if (favLevel(p, c.id) === 2) b += 15; else if (favLevel(p, c.id) === 1) b += 7;
  if (Object.values(p.love || {}).some(l => l >= LEGEND)) b += 4;
  return clamp(Math.round(b), 0, 30);
}
function signingBoost(p, c) {
  const b = signingBuzz(p, c); if (b < 4) return;
  moodHit(c, b * .4); c.fans = Math.round(c.fans * (1 + b * .004)); c.buzz = { w: 8, k: 1 + b / 40 }; bumpMedia(b / 4); addHoney(c, "star", clamp(b / 25, .2, .6));
  news(favLevel(p, c.id) ? `${p.name} is back! Supporters queue for shirts with his name on.` : `The signing of ${p.name} has the supporters buzzing: season ticket enquiries and shirt sales are up.`, b >= 10);
}
// Shirts: favourites in the squad, and a recent big signing, both sell more.
const shirtBoost = c => (1 + Math.min(.25, favCount(c) * .03)) * (c.buzz && c.buzz.w > 0 ? c.buzz.k : 1);
function buzzWeek(c) { if (c.buzz && c.buzz.w > 0) c.buzz.w--; }

/* A standout season: goals and assists per game against what's normal for the position (keepers and centre-backs are
   judged more on simply playing every week). -1 poor, 0 ordinary, 1 very good, 2 exceptional. Uses this season once he
   has ten games, otherwise last season. */
const POS_RETURN = { ST: .42, W: .3, AM: .3, CM: .15, DM: .08, FB: .08, CB: .05, GK: 0 };
function seasonForm(p) {
  const s = p.s.app >= 10 ? p.s : p.last && p.last.app >= 10 ? p.last : null; if (!s) return 0;
  // Ever-presents get noticed: this season against the league games his club has played so far, last season against 30.
  if (p.pos === "GK" || p.pos === "CB") { const x = p.club >= 0 ? CL(p.club) : null, row = x && !x.abroad && G.leagues[x.lg] ? G.leagues[x.lg].tab[x.id] : null;
    if (s === p.s && row && row.p) return clamp((s.app / row.p - .7) / .25, -1, .8);  // "very good", short of a star season until it is complete
    return clamp((s.app - 30) / 12, -1, 1); }
  const exp = POS_RETURN[p.pos], cpg = (s.g + s.a * .6) / s.app;
  return clamp((cpg / exp - 1) * Math.min(1, s.app / 25), -1, 2);
}
const formWord = f => f >= 1.2 ? "an exceptional season" : f >= .5 ? "a very good season" : null;
