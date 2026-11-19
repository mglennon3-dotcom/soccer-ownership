/* Decisions in your inbox, and the media.
   A decision has options; if you don't answer within two weeks the default (shown) is taken for you.
   Handlers live in DECIDE by key so saved games can resume them. */
"use strict";

const DECIDE = {};
function addChoice(key, title, body, opts, data, dflt = 0) { return addMsg({ type: "choice", key, title, body, opts, data, dflt }); }
function answerChoice(m, i) { if (m.done) return; m.done = true; m.answer = m.opts[i]; const f = DECIDE[m.key]; if (f) f(m, i); }

/* ---------- media ----------
   Your media profile (0-100) grows with your division, cup runs and how you handle the press, and raises what
   sponsors will pay. Every few weeks reporters want an answer; what you say moves the fans, your staff, your
   investors and the expectations you'll be judged on. */
function bumpMedia(d) { const c = my(); c.media = clamp((c.media ?? 10) + d, 0, 100); }
const mediaMult = c => .85 + (c.media ?? 10) / 330;
function mediaWeek() {
  const c = my(); c.media = c.media ?? 10;
  c.media += ((8 - c.tier) * 6 - c.media) * .01;  // drifts toward what your division warrants
  if (G.phase !== "season" || R() > .22 || G.inbox.some(m => m.key && m.key.startsWith("press") && !m.done)) return;
  const q = pickQuestion(c); if (q) addChoice(q.key, `Press: ${q.q}`, q.body || "", q.opts, q.data || {}, q.dflt ?? q.opts.length - 1);
}
function form5() { return (G.myRes || []).filter(r => r.comp === my().lg).slice(-5); }
function pickQuestion(c) {
  const f = form5(), pts = sum(f, r => r.res === "W" ? 3 : r.res === "D" ? 1 : 0), m = staffOf("manager"), qs = [];
  if (f.length === 5 && pts <= 4 && m) qs.push({ key: "pressSack", q: `Is ${m.name}'s job safe?`, body: `${pts} points from the last five games.`, opts: ["Full backing", "Results must improve", "No comment"] });
  if (f.length === 5 && pts >= 12) qs.push({ key: "pressUp", q: "Can you go up this season?", body: `${pts} points from the last five.`, opts: ["Yes, that's the aim", "One game at a time"] });
  if (c.prices.ticket > REF_TICKET[c.tier] * 1.2) qs.push({ key: "pressPrice", q: "Supporters say tickets are too expensive", opts: ["Cut prices to the going rate", "Prices reflect our ambition", "No comment"] });
  const star = c.squad.map(P).find(p => G.inbox.some(x => x.type === "bid" && x.pid === p.id && x.age < 6));
  if (star) qs.push({ key: "pressStar", q: `Will ${star.name} be sold?`, opts: ["He's not for sale", "Everyone has a price"], data: { pid: star.id } });
  if (!c.fac.stadium.own || c.fac.stadium.cap < STADIUM_T[c.tier] * .5) qs.push({ key: "pressGround", q: "What are your plans for the ground?", opts: ["Big plans: watch this space", "Not a priority"] });
  if (c.media > 25 && !G.docu) qs.push({ key: "pressDocu", q: "A streaming service wants to film a documentary", body: "Cameras everywhere for a season. Great for the club's profile; managers tend to hate it.", opts: ["Let them film", "Decline"] });
  if (G.week < 6) qs.push({ key: "pressAmb", q: "Where will the club be in five years?", opts: ["The Premier Division", "Steady growth", "No comment"] });
  const rival = G.clubs.find(x => !x.gone && !isMine(x) && x.own && x.lg === c.lg && OWNER_STYLES[x.own.style].media >= 3);
  if (rival) qs.push({ key: "pressRival", q: `${rival.own.name} of ${rival.name} calls your club "a vanity project"`, opts: ["Fire back", "Rise above it"], data: { club: rival.id } });
  if (G.sTrust && G.sTrust.rel < 35) qs.push({ key: "pressTrust", q: "The supporters' trust says you don't listen", opts: ["Promise to meet them", "Ignore it"] });
  return qs.length ? pick(qs) : null;
}
DECIDE.pressSack = (m, i) => { if (i === 0) { trust("manager", 8, "appreciates your public backing."); moodHit(my(), -1); } if (i === 1) { trust("manager", -7, "didn't like being put under pressure in public."); moodHit(my(), 2); } if (i === 2) bumpMedia(-1); };
DECIDE.pressUp = (m, i) => { if (i === 0) { moodHit(my(), 4); G.hype = (G.hype || 0) + 1; bumpMedia(2); } };
DECIDE.pressPrice = (m, i) => { const c = my(); if (i === 0) { c.prices.ticket = REF_TICKET[c.tier]; moodHit(c, 5); } if (i === 1) { moodHit(c, -3); investorMood("pe", 3); } };
DECIDE.pressStar = (m, i) => { const p = G.players[m.data.pid]; if (!p) return; if (i === 0) { p.keep = true; moodHit(my(), 2); meddled("recruit", -2, null); } else moodHit(my(), -3); };
DECIDE.pressGround = (m, i) => { if (i === 0) { moodHit(my(), 2); bumpMedia(2); G.promise = { kind: "ground", y: G.year }; } else moodHit(my(), -1); };
DECIDE.pressDocu = (m, i) => { if (i === 0) { G.docu = G.year; bumpMedia(18); trust("manager", -4, "isn't keen on the cameras."); news("A documentary crew will follow the club all season.", true); } };
DECIDE.pressAmb = (m, i) => { if (i === 0) { bumpMedia(5); moodHit(my(), 3); investorMood(null, 2); G.hype = (G.hype || 0) + 1; } };
DECIDE.pressRival = (m, i) => { if (i === 0) { bumpMedia(4); moodHit(my(), 2); (my().rivals ||= {})[m.data.club] = ((my().rivals || {})[m.data.club] || 0) + 1; } };
DECIDE.pressTrust = (m, i) => { if (i === 0) trustRel(8, "You promise the trust a meeting."); else { trustRel(-6); moodHit(my(), -2); } };

// An academy player who's stopped improving wants to leave: let him go, or the youth manager tries to talk him round.
DECIDE.acadLeave = (m, i) => { const p = G.players[m.data.pid], c = my(); if (!p || p.club !== c.id || !p.acad) return;
  if (i === 0) { acadLeave(p, c); return; }
  const y = staffOf("youth"), ok = R() < (y ? .35 + staffAvg(y) / 200 : .25);
  if (ok) { p.stayY = G.year; news(`${y ? y.name : "The coaches"} talk${y ? "s" : ""} ${p.name} round: he'll give it another year.`); }
  else { news(`${p.name} can't be persuaded.`); acadLeave(p, c); } };
// A foreign player wants to go home: sell him to the club in his country, or try to keep him (he may sulk).
DECIDE.homeGo = (m, i) => { const p = G.players[m.data.pid], to = CL(m.data.to), c = my(); if (!p || p.club !== c.id) return;
  if (i === 0 && to) { const fee = Math.round(valueOf(p) * .8 / 1000) * 1000; logMove("out", p, { club: to.name, fee, wage: p.wage, by: "you" }); moveTo(p, to); p.wage = aiWage(p, to); earn("sales", fee); news(`${p.name} goes home to ${to.name} for ${money(fee)}.`, true); return; }
  if (R() < .5) news(`${p.name} agrees to stay for now.`); else { p.unsettled = Math.max(p.unsettled || 0, 10); news(`${p.name} is unhappy at being kept from going home.`, true); } };
// Away days (see club.js): helping supporters travel, and refunds after a heavy away defeat.
DECIDE.awayHelp = (m, i) => { const c = my(), k = fanCare(c);
  if (i === 0) { spend("travel", m.data.cost); moodHit(c, 2.5 * k); trustRel(6); news("The club pays for supporters' coaches to the away game. The trust is delighted."); }
  else if (i === 1) { spend("travel", Math.round(m.data.cost / 2)); moodHit(c, 1.2 * k); trustRel(3); }
  else { moodHit(c, -1.2 * k); trustRel(-4); } };
DECIDE.awayRefund = (m, i) => { const c = my(), k = fanCare(c);
  if (i === 0) { spend("refunds", m.data.cost); moodHit(c, 3 * k); trustRel(8); bumpMedia(2); news("The club refunds the travelling supporters after the heavy defeat. It goes down well."); }
  else moodHit(c, -1 * k); };

DECIDE.relayAsk = (m, i) => { const S = my().fac.stadium; if (i === 0 && S.own && !S.relay) relayPitch(m.data.type || S.ptype || "grass"); };
