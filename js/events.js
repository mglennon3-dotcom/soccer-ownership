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
const teamAvg20 = c => r20(avg(pickXI(c).map(o => o.p.ovr)));
function pickQuestion(c) {
  const f = form5(), pts = sum(f, r => r.res === "W" ? 3 : r.res === "D" ? 1 : 0), m = staffOf("manager"), qs = [];
  if (f.length === 5 && pts <= 4 && m) qs.push({ key: "pressSack", q: `Is ${m.name}'s job safe?`, body: `${pts} points from the last five games.`, opts: ["Full backing", "Results must improve", "No comment"] });
  if (f.length === 5 && pts >= 12) qs.push({ key: "pressUp", q: c.tier === 1 ? "Is this a title-winning side?" : "Can you go up this season?", body: `${pts} points from the last five.`, opts: ["Yes, that's the aim", "One game at a time"] });
  if (c.prices.ticket > REF_TICKET[c.tier] * 1.2) qs.push({ key: "pressPrice", q: "Supporters say tickets are too expensive", opts: ["Cut prices to the going rate", "Prices reflect our ambition", "No comment"] });
  const star = c.squad.map(P).find(p => G.inbox.some(x => x.type === "bid" && x.pid === p.id && x.age < 6));
  if (star) qs.push({ key: "pressStar", q: `Will ${star.name} be sold?`, opts: ["He's not for sale", "Everyone has a price"], data: { pid: star.id } });
  if (!c.fac.stadium.own || c.fac.stadium.cap < STADIUM_T[c.tier] * .5) qs.push({ key: "pressGround", q: "What are your plans for the ground?", opts: ["Big plans: watch this space", "Not a priority"] });
  if (c.media > 25 && !G.docu) qs.push({ key: "pressDocu", q: "A streaming service wants to film a documentary", body: "Cameras everywhere for a season. Great for the club's profile; managers tend to hate it.", opts: ["Let them film", "Decline"] });
  // Ambition: asked once a season early on, worded for where the club is.
  if (G.week < 6) qs.push(c.tier === 1 ? { key: "pressAmb", q: "Where will the club be in five years?", opts: ["Champions, and a force in Europe", "Established among the top clubs", "No comment"] }
    : { key: "pressAmb", q: "Where will the club be in five years?", opts: [c.tier === 2 ? "In the Premier Division, and staying there" : "In the Premier Division", c.tier <= 4 ? `Pushing for the ${TIER_NAME[c.tier - 1]}` : "Climbing, one step at a time", "No comment"] });
  const pos = G.leagues[c.lg].tab ? table(c.lg).findIndex(r => r.id === c.id) + 1 : 0, n = G.leagues[c.lg].clubs.length;
  if (G.phase === "season" && G.week >= 15 && pos && pos > n - 3) qs.push({ key: "pressDrop", q: "Can you stay up?", body: `${ord(pos)} of ${n} with ${SEASON_WEEKS - G.week} weeks to go.`, opts: ["We'll survive, no question", "Whatever happens, we stay together", "No comment"] });
  if (G.phase === "season" && G.week >= 15 && pos && pos <= 2 && c.tier === 1) qs.push({ key: "pressTitle", q: "Are you title favourites now?", body: `${ord(pos)} in the Premier Division.`, opts: ["We expect to win it", "Plenty of football left"] });
  if (inEurope(c) && G.week >= 4 && G.week <= 30) qs.push({ key: "pressEurope", q: "How far can you go in Europe?", opts: ["All the way", "We'll enjoy every game"] });
  if ((JAN.includes(G.week) || G.week < 2)) qs.push({ key: "pressSign", q: "Will you strengthen the squad this window?", opts: ["Yes: the money is there", "We're happy with what we have", "No comment"] });
  const kid = c.squad.map(P).filter(p => p.age <= 20 && !p.acad && (p.s.app || 0) >= 5).sort((a, b) => b.pot - a.pot)[0];
  if (kid) qs.push({ key: "pressKid", q: `Everyone's talking about ${kid.name}. Is he the real deal?`, body: `${kid.age}, ${kid.s.app} games this season.`, opts: ["He'll be a star", "Let's not put pressure on him"], data: { pid: kid.id } });
  if (G.myRes && G.myRes.length >= 3 && G.myRes.slice(-3).every(r => r.res === "L") && !(f.length === 5 && pts <= 4)) qs.push({ key: "pressSlump", q: "Three defeats in a row: what's going wrong?", opts: ["It's a blip; we'll bounce back", "Changes are coming", "No comment"] });
  if (G.owner && G.owner.wealth > 50e6) qs.push({ key: "pressMoney", q: "Will you put more of your own money in?", opts: ["Whatever it takes", "The club has to pay its way"] });
  const rival = G.clubs.find(x => !x.gone && !isMine(x) && x.own && x.lg === c.lg && OWNER_STYLES[x.own.style].media >= 3);
  if (rival) qs.push({ key: "pressRival", q: `${rival.own.name} of ${rival.name} calls your club "a vanity project"`, opts: ["Fire back", "Rise above it"], data: { club: rival.id } });
  if (G.sTrust && G.sTrust.rel < 35) qs.push({ key: "pressTrust", q: "The supporters' trust says you don't listen", opts: ["Promise to meet them", "Ignore it"] });
  // The questions owners get at real press conferences.
  const nf = typeof nextFixture === "function" ? nextFixture() : null, opp = nf ? CL(nf.h === c.id ? nf.a : nf.h) : null;
  if (opp && nf.w === G.week && isDerby(c, opp)) qs.push({ key: "pressDerby", q: `It's ${opp.name} this weekend. What's your message to the fans?`, opts: ["We owe them a win", "It's three points like any other"], data: { opp: opp.id } });
  const target = Object.values(G.players).find(p => p.club >= 0 && p.club !== c.id && !CL(p.club).gone && r20(p.ovr) >= teamAvg20(c) + 2 && p.age <= 27 && willJoin(p, c) && R() < .002);
  if (target && (windowOpen() || G.week >= JAN[0] - 3)) qs.push({ key: "pressLink", q: `Reports link you with ${target.name} of ${CL(target.club).name}. Any truth in it?`, opts: ["We admire him, and we're ambitious", "I don't talk about other clubs' players"], data: { pid: target.id } });
  const want = c.squad.map(P).find(p => p.req || p.unsettled >= 3);
  if (want) qs.push({ key: "pressWant", q: `${want.name} wants to leave. Will you let him go?`, opts: ["Nobody leaves on the cheap", "If the right offer comes, yes"], data: { pid: want.id } });
  const inj = c.squad.map(P).filter(p => p.inj && !p.acad).length;
  if (inj >= 5) qs.push({ key: "pressInj", q: `You've got ${inj} players injured. Is the squad deep enough?`, opts: ["We'll add cover", "We have the players to cope"] });
  const last = (G.myRes || []).slice(-1)[0];
  if (last && last.w >= G.week - 1 && last.res === "L" && last.ga - last.gf <= 1) qs.push({ key: "pressRef", q: "Your manager was furious with the referee. Do you back him?", opts: ["The decisions cost us the game", "We move on: no excuses"] });
  if (c.mood < 30) qs.push({ key: "pressProtest", q: "Supporters protested outside the ground. What's your response?", opts: ["I hear them, and I'll put it right", "The plan won't change"] });
  const expiring = c.squad.map(P).filter(p => !p.acad && p.yrs <= 1 && !p.loan).sort((a, b) => b.ovr - a.ovr)[0];
  if (expiring && r20(expiring.ovr) >= teamAvg20(c)) qs.push({ key: "pressContract", q: `${expiring.name} is into the last year of his contract. Will he sign a new one?`, opts: ["Talks are going well", "No player is bigger than the club"], data: { pid: expiring.id } });
  if ((G.loans || []).length || c.cash < 0) qs.push({ key: "pressDebt", q: "The club's debts are rising. Should supporters be worried?", opts: ["The finances are under control", "We're investing for the future"] });
  if (G.inbox.some(m => m.key === "poach" && !m.done)) qs.push({ key: "pressPoach", q: "Another club wants to talk to one of your staff. Will you stand in the way?", opts: ["They're going nowhere", "We won't stand in anyone's way"] });
  const cupRun = Object.values(G.cups || {}).some(K => K.win == null && (K.alive || []).includes(c.id) && K.round >= 3);
  if (cupRun) qs.push({ key: "pressCup", q: "Is the cup run a distraction from the league?", opts: ["We want to win it", "The league comes first"] });
  if (R() < .3) qs.push({ key: "pressSell", q: "There are rumours you're looking to sell the club. True?", opts: ["The club is not for sale", "I'd always listen to the right offer"] });
  if (c.fac.acad.lvl >= 4) qs.push({ key: "pressAcad", q: "What's the long-term plan for the academy?", opts: ["Our own players are the future", "The first team comes first"] });
  // Vary them: nothing asked again within about twenty weeks (the five-year question once a season).
  const seen = G.pressSeen ||= {}, now = G.year * 100 + G.week, fresh = qs.filter(q => !seen[q.key] || now - seen[q.key] >= (q.key === "pressAmb" ? 100 : 20));
  const q = fresh.length ? pick(fresh) : null; if (q) seen[q.key] = now; return q;
}
DECIDE.pressSack = (m, i) => { if (i === 0) { trust("manager", 8, "appreciates your public backing.", "Your public backing"); moodHit(my(), -1); } if (i === 1) { trust("manager", -7, "didn't like being put under pressure in public.", "Being put under pressure in public"); moodHit(my(), 2); } if (i === 2) bumpMedia(-1); };
DECIDE.pressUp = (m, i) => { if (i === 0) { moodHit(my(), 4); G.hype = (G.hype || 0) + 1; bumpMedia(2); } };
DECIDE.pressPrice = (m, i) => { const c = my(); if (i === 0) { c.prices.ticket = REF_TICKET[c.tier]; moodHit(c, 5); } if (i === 1) { moodHit(c, -3); investorMood("pe", 3); } };
DECIDE.pressStar = (m, i) => { const p = G.players[m.data.pid]; if (!p) return; if (i === 0) { p.keep = true; moodHit(my(), 2); meddled("recruit", -2, null, "Taking a star off the market"); } else moodHit(my(), -3); };
DECIDE.pressGround = (m, i) => { if (i === 0) { moodHit(my(), 2); bumpMedia(2); G.promise = { kind: "ground", y: G.year }; } else moodHit(my(), -1); };
DECIDE.pressDocu = (m, i) => { if (i === 0) { G.docu = G.year; bumpMedia(18); trust("manager", -4, "isn't keen on the cameras.", "The documentary cameras"); news("A documentary crew will follow the club all season.", true); } };
DECIDE.pressAmb = (m, i) => { if (i === 0) { bumpMedia(5); moodHit(my(), 3); investorMood(null, 2); G.hype = (G.hype || 0) + 1; } };
// Your head of recruitment asked about a suggested player while the window was shut.
DECIDE.recAsk = (m, i) => { const p = G.players[m.data.pid], s = staffOf("recruit"); const x = sugg().find(y => y.id === m.data.pid); if (!p || !s) return;
  if (i === 0) { if (p.club >= 0 && p.club !== G.club && !p.toMe) { agreeIncoming(p, m.data.fee, m.data.wage, s); G.sugg = sugg().filter(y => y.id !== p.id); trust("recruit", 2, null, "Your tips"); } }
  else if (i === 1) { if (m.data.pre && preContractOK(p)) { const a = playerAppeal(p, m.data.preW); if (a.score >= a.pr.thr) { agreePre(p, m.data.preW, s); G.sugg = sugg().filter(y => y.id !== p.id); news(`${s.name} gets the pre-contract done: ${p.name} joins on a free in the summer.`, true); } else { if (x) x.wait = true; news(`${p.name} won't sign a pre-contract with you. ${s.name} will try again when the window opens.`); } }
    else if (x) { x.wait = true; news(`${s.name} will go after ${p.name} when the window opens.`); } }
  else G.sugg = sugg().filter(y => y.id !== p.id); };
DECIDE.pressDrop = (m, i) => { if (i === 0) { moodHit(my(), 2); G.hype = (G.hype || 0) + 1; } if (i === 1) { moodHit(my(), 1); trust("manager", 2, null, "Your public backing"); } };
DECIDE.pressTitle = (m, i) => { if (i === 0) { bumpMedia(4); moodHit(my(), 3); G.hype = (G.hype || 0) + 1; } };
DECIDE.pressEurope = (m, i) => { if (i === 0) { bumpMedia(3); moodHit(my(), 2); } else moodHit(my(), 1); };
DECIDE.pressSign = (m, i) => { if (i === 0) { moodHit(my(), 3); G.hype = (G.hype || 0) + 1; } if (i === 1) moodHit(my(), -2); };
DECIDE.pressKid = (m, i) => { const p = G.players[m.data.pid]; if (!p) return; if (i === 0) { bumpMedia(2); moodHit(my(), 2); p.unsettled = Math.max(p.unsettled || 0, R() < .25 ? 4 : 0); } else trust("youth", 2, null, "Protecting a youngster in public"); };
DECIDE.pressSlump = (m, i) => { if (i === 0) { moodHit(my(), 1); trust("manager", 3, null, "Your public backing"); } if (i === 1) { moodHit(my(), 2); trust("manager", -5, "didn't like hearing that changes are coming.", "Being put under pressure in public"); } };
DECIDE.pressMoney = (m, i) => { if (i === 0) { moodHit(my(), 4); G.hype = (G.hype || 0) + 1; } else moodHit(my(), -2); };
DECIDE.pressDerby = (m, i) => { if (i === 0) { moodHit(my(), 2); G.hype = (G.hype || 0) + 1; } };
DECIDE.pressLink = (m, i) => { if (i === 0) { bumpMedia(3); moodHit(my(), 2); const p = G.players[m.data.pid]; if (p && p.club >= 0) { const x = CL(p.club); if (x && !isMine(x) && R() < .3) p.unsettled = Math.max(p.unsettled || 0, 3); } } };
DECIDE.pressWant = (m, i) => { const p = G.players[m.data.pid]; if (!p) return; if (i === 0) { p.unsettled = (p.unsettled || 0) + 1; moodHit(my(), 1); } else { p.list = true; p.unsettled = Math.max(0, (p.unsettled || 0) - 2); news(`${p.name} is transfer-listed after your comments.`); } };
DECIDE.pressInj = (m, i) => { if (i === 0) moodHit(my(), 1); else trust("manager", 1, null, "Your public backing"); };
DECIDE.pressRef = (m, i) => { if (i === 0) { moodHit(my(), 2); trust("manager", 3, null, "Your public backing"); if (R() < .3) { bumpMedia(3); investorMood(null, -1); news("The FA warns the club about your comments on the referee."); } } };
DECIDE.pressProtest = (m, i) => { if (i === 0) { moodHit(my(), 5); trustRel(4); G.promise = { kind: "fans", y: G.year }; } else { moodHit(my(), -3); trustRel(-4); } };
DECIDE.pressContract = (m, i) => { const p = G.players[m.data.pid]; if (!p) return; if (i === 0) moodHit(my(), 1); else if (R() < .4) p.unsettled = Math.max(p.unsettled || 0, 2); };
DECIDE.pressDebt = (m, i) => { if (i === 0) investorMood(null, 1); else { moodHit(my(), 1); investorMood(null, -1); } };
DECIDE.pressPoach = (m, i) => { if (i === 0) moodHit(my(), 1); };
DECIDE.pressCup = (m, i) => { if (i === 0) { moodHit(my(), 2); G.hype = (G.hype || 0) + 1; } };
DECIDE.pressSell = (m, i) => { if (i === 0) { moodHit(my(), 2); trustRel(2); } else { moodHit(my(), -3); investorMood(null, 2); } };
DECIDE.pressAcad = (m, i) => { if (i === 0) { moodHit(my(), 1); trust("youth", 3, null, "Backing the academy in public"); } else trust("youth", -2, null, "Putting the first team ahead of the academy in public"); };
// Firing back starts a feud: the next game against them is a grudge match (and three feuds make a lasting rivalry).
// It plays well with the supporters and the press, less so with investors. Rising above it is the reverse.
DECIDE.pressRival = (m, i) => { const f = ((my().feud ||= {})[m.data.club] ||= { n: 0 });
  if (i === 0) { bumpMedia(4); moodHit(my(), 2); investorMood(null, -1); f.n++; f.g = true; news(`Your next game against ${CL(m.data.club).name} is a grudge match.${f.n === 3 ? " It's a full-blown rivalry now: every meeting will be." : ""}`); }
  else { investorMood(null, 1); moodHit(my(), -1); } };
// After a grudge match, the press want your reaction.
DECIDE.pressGrudge = (m, i) => { const f = (my().feud || {})[m.data.club]; const won = m.data.res === "W";
  if (won && i === 1) { moodHit(my(), 3); bumpMedia(3); investorMood(null, -1); if (f) { f.n++; if (f.n === 3) news(`That's it: ${CL(m.data.club).name} are now your club's bitter rivals.`, true); } }
  else if (won) { moodHit(my(), 1); investorMood(null, 1); }
  else if (i === 1) { moodHit(my(), 1); bumpMedia(2); if (f) f.n++; }
  else { investorMood(null, 1); bumpMedia(1); } };
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
