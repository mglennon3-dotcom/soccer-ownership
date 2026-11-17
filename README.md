# Touchline Owner

A football club ownership game in the browser, built on Touchline Manager's world. You found a brand-new club at the
bottom of a seven-tier English pyramid and try to take it to the Premier Division. You don't pick the team or sign
players: you hire the people who do, give them budgets, and run the business. All clubs, players and staff are fictional.

## Play it

- **Online:** open the GitHub Pages address for this repository. The game is served straight from the `main` branch
  (Settings → Pages → Deploy from a branch → `main`, `/ (root)`; `.nojekyll` makes GitHub serve the files as they are).
- **Offline:** open it once while online, then use your browser's *Install app* or *Add to Home Screen*. The game's
  files are cached by a service worker, so it opens with no connection after that. Google Fonts are cached the first
  time they load; until then the game uses system fonts.
- **On claude.ai:** `artifact.html` is the same game laid out for a claude.ai page.
- **Careers** are saved in the browser (IndexedDB) on that device, as many as you like. Export a save file from the
  History page to back one up or move a career to another device, and import it there.

Running locally: any static server works, for example `python3 -m http.server 8000` in this folder, then open
<http://localhost:8000>.

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

## Ratings: shown out of 20, held at 200-step precision

Every player has twelve attributes (keepers five); each position's rating is a weighted mix of them. Attributes,
ratings and potential are held in half-points on a 100 scale, which is 200 steps. Everything is shown out of 20, and
that's also all anyone in the game sees: your manager picks his side, your scouts judge targets and AI clubs recruit on
the 20-point figures. Only matches and development use the exact values underneath. Staff and director attributes work
the same way. A typical starter is about 9 in the regional leagues, 12 in the Third Division and 16 in the Premier
Division; 18–19 is world class, and 20 a once-in-a-generation player.

**Potential is rare at the top.** Each youth intake draws potential from a bell curve whose centre an academy can move
(about 38 of 100 with no facilities, about 57 at the best academy in the game), capped at 94. Separately, about one
youngster in 2,000 is an exceptional talent (90–100), heavily skewed toward 90. Over 20 simulated seasons and about
15,000 youth players across the whole world, 13 had potential of 90+ (18 out of 20), one had 95+, and none reached 100.
Even a generational talent needs football, coaching and facilities to get there. Potential is only ever an estimate.

## Why people join

Like Touchline Manager's youth prospects, every player and every coach has their own priorities. Each weighs seven
factors, two of them most heavily. Players weigh wages, playing time, formation fit, club prestige, training
facilities, closeness to home and the project. Coaches weigh salary, prestige, facilities, budgets, the squad, your
ambition and freedom to work. Money is only one factor. Some people won't come at any price, and the hiring and
transfer dialogs show what each one is weighing up.

## Competitions

The league, plus three cups with one-off ties and penalties: the **National Cup** (every club; the big clubs get byes),
the **League Cup** (tiers 1–4) and the **National Trophy** (tiers 5–7). Prize money for every round won; beating a club
from a higher division delights the supporters.

## The boardroom

- **Objectives.** Set league, cup, finance and youth targets each pre-season. They're announced: ambitious targets lift
  the fans now and hurt more if missed. The manager tells you if he thinks one is unrealistic.
- **Investors.** Sell up to 49% of the club: silent partners, local consortiums, private equity (premium price, 4%
  dividend, wants profits), celebrity investors (media profile). They judge you every summer; unhappy investors holding
  a quarter of the club can block big projects and loans, and ones who want out sell to a rival owner unless you buy them out.
- **Directors.** Finance (cheaper loans and upkeep), commercial (better sponsors) and operations (cheaper building, better pitch).
- **Supporters' trust.** Members, relations, demands (price freezes, cheaper youth tickets, fan zones, open accounts, a
  board seat, a 5% stake), and protests at home games when fans are angry and relations poor.
- **Loans.** Bank loans against the club's value; rates rise with debt. Lend the club your own money interest-free.
  Eight weeks over the overdraft limit means administration: ten points docked and the best players sold.

## The network

A **partner club** two or more divisions above offers young players on loan each window. Up to three **feeder clubs**
below you take your funding (raising their standard and facilities), take your players on loan first, and give you first
refusal on their best youngsters at a discount.

## Media, weather and staff

- **Media.** Your profile raises sponsorship. Every few weeks the press wants an answer (the manager's future, promotion
  talk, ticket prices, a star's future, a documentary crew, a rival owner's jibes), and the answer moves fans, staff and investors.
- **Weather.** Rain and snow cut crowds and chew up the pitch; frost and snow postpone games at grounds without undersoil heating.
- **Staff careers.** Staff improve while young, level off, then decline; they retire from 60. Clubs that poach your staff
  pay compensation: at least the rest of their contract, plus a premium.

## Rival owners

Every club has an owner with a style that drives it: lifelong fan, billionaire benefactor, asset stripper, data-driven
investor, property developer, celebrity, multi-club group, absent owner, reckless gambler, supporter-owned, meddler,
youth evangelist, old-money dynasty (until the heir takes over), hostile neighbour (bought nearby to beat you), crypto or betting money (can vanish overnight), former player (fans adore him; he hires his mates as managers). Styles decide spending, building, how long managers last, administrations, poaching of your staff and
players, and competition for local sponsors. Clubs change hands in takeovers.

## Selling up and starting again

Put the club up for sale from the Board page (or accept an unsolicited bid that sometimes comes in the summer). You're
paid for your stake, plus anything you lent the club; investors and loans stay with it, and it carries on as an AI club
under its new owner. Then buy any club whose owner will sell (not supporter-owned clubs or hostile neighbours), and take
it on as it stands: squad, manager, ground, facilities and sponsors. The History page keeps every club you've owned.

## Code

`js/names.js` (names, towns and helpers from Touchline Manager), `core.js` (pyramid, players, talent, development),
`staff.js`, `club.js` (prices, attendance, sponsors, facilities, suites, pitch, ventures), `weather.js`, `match.js`,
`events.js` (decisions and media), `cups.js`, `owners.js` (rival owners), `board.js` (valuation, investors, directors,
supporters' trust, loans, objectives), `partners.js`, `sale.js`, `season.js`, `market.js`, `appeal.js`, `ui.js`, `ui2.js`, `main.js`.

`node tools/sim.js 20` plays 20 seasons headless and reports talent, ratings by tier and the test club's progress.
