# Touchline Owner

A football club ownership game in the browser, built on Touchline Manager's world. You found a brand-new club at the
bottom of a seven-tier English pyramid and try to take it to the Premier Division. You don't pick the team or sign
players: you hire the people who do, give them budgets, and run the business. All clubs, players and staff are fictional.

## Play it

Any static server works: `python3 -m http.server 8000` in this folder, then open <http://localhost:8000>.
Careers are saved in the browser (IndexedDB). Export a save file from the History page to back one up.

## What you do

- **Hire staff.** A manager (tactics, motivation, player development; a style of play, a formation, and a view on
  youth), a head of recruitment (judging ability, negotiation, contacts; a recruitment philosophy and a search area),
  and a youth manager (development, judging potential, youth scouting; a type of player, local or wide search).
  Their philosophies decide how the team plays and who gets signed. Pick people whose ideas match yours.
- **Set prices:** tickets, food and drink, replica shirts, executive suites. Prices above what supporters expect earn
  more per head but cost crowds and goodwill.
- **Set budgets:** player wages, transfers, academy running costs, scouting. Your staff work within them and notice
  when they're cut.
- **Find sponsors:** shirt, kit, sleeve, stadium naming and training-ground naming. Offers expire; longer deals pay a
  little less a year; each pays a promotion bonus.
- **Build the club.** You start renting a recreation ground. Build your own stadium (1,500 to 65,000), add stands,
  upgrade the facilities, add executive suites, look after the pitch (it wears with every home game; re-lay it with
  grass or a hybrid surface). Build a training ground and an academy, levels 1 to 10.
- **Make the stadium pay beyond match days:** club shop and megastore, car park, conference and events centre, tours
  and museum, a stadium hotel, summer concerts (they damage the pitch), a tenant team.
- **Overrule your staff when you must.** Buy a player yourself, sell or release one, or answer a bid against your head
  of recruitment's advice. They notice, and so does every coach you try to hire afterwards.
- **Fund it.** You choose your fortune at the start (local businessperson, wealthy investor, billionaire consortium)
  and move money in and out of the club. An overdrawn club pays 10% interest.

## The world

| Tier | Division | Clubs | Up | Play-offs | Down |
|---|---|---|---|---|---|
| 1 | Premier Division | 20 | — | — | 3 |
| 2 | First Division | 24 | 2 | 3rd–6th | 3 |
| 3 | Second Division | 24 | 2 | 3rd–6th | 4 |
| 4 | Third Division | 24 | 3 | 4th–7th | 2 |
| 5 | National Division | 24 | 1 | 2nd–5th | 4 |
| 6 | National Division North / South | 24 each | 1 | 2nd–5th | 3 |
| 7 | Regional League North / South | 20 each | 2 | 3rd–6th | 3 (fold) |

Play-offs are one-off semi-finals at the higher seed and a final at a neutral ground. **Ground grading:** a club whose
ground is too small for the division above can't be promoted (2,000 for tier 6 up to 20,000 for the top flight); the
next club in the table goes up instead.

## Players: ratings out of 100

Every player has twelve attributes out of 100 (keepers five), and each position's rating is a weighted mix of them.
A typical starter is about 44 in the regional leagues, 60 in the Third Division and 80 in the Premier Division; 90+
is world class.

**Potential is rare at the top.** Touchline Manager handed out too many youngsters with very high potential. Here,
every youth intake draws potential from a bell curve whose centre an academy can move (from about 38 at a club with
no facilities to about 57 at the best academy in the game), capped at 94. Separately, about one youngster in 2,000 is
an exceptional talent (90–100), heavily skewed toward 90. Measured over 20 seasons and about 15,000 youth players
across the whole world: 13 had potential of 90 or more, one 95 or more, and none reached 100. A potential of 100 is a
once-in-a-generation player, and even he needs regular football, good coaching and facilities to get there. Potential is
never shown exactly: your staff estimate it as a range, narrower the better they judge.

## Why people join

Like Touchline Manager's youth prospects, every player and every coach has their own priorities. Each weighs seven
factors, two of them most heavily. Players weigh wages, playing time, formation fit, club prestige, training
facilities, closeness to home and the project. Coaches weigh salary, prestige, facilities, budgets, the squad, your
ambition and freedom to work. Money is only one factor. Some people won't come at any price, and the hiring and
transfer dialogs show what each one is weighing up.

## Code

`js/names.js` (names, towns and helpers from Touchline Manager), `core.js` (pyramid, players, talent, development),
`staff.js`, `club.js` (prices, attendance, sponsors, facilities, suites, pitch, ventures), `match.js`, `season.js`
(calendar, play-offs, promotion, the summer), `market.js` (transfers and your recruitment head), `appeal.js` (why
people join), `ui.js`, `main.js`.

`node tools/sim.js 20` plays 20 seasons headless and reports talent, ratings by tier and the test club's progress.
