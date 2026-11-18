# The Owner's Box

A football club ownership game in the browser. You found a brand-new club at the
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

- **Set your vision** (Board page): how you want the team to play, how you want it to recruit, and ten points across
  six priorities (winning now, youth, sound finances, the supporters, commercial growth, facilities). Staff who share
  your vision are keener to join and grow happier; staff who don't slowly sour. Each point brings a small benefit too.
- **Your owner profile** (Owner page): your name, fortune, the value of your stake, net worth and what you've put in;
  how supporters, the trust, your staff, investors and the media see you, and whether you're hands-off or a meddler;
  your vision at a glance; and your record (seasons, promotions, relegations, honours, best finish, clubs owned) with
  milestones such as your first promotion, first title, first cup and first season in Europe.
- **Watch your team.** The Tactics page shows the manager's formation on a pitch with his first-choice eleven (each
  player's rating in his position, out-of-position players marked), the bench and who's unavailable, his style and how
  well the squad suits it, attack, midfield and defence against the division, which styles the squad would suit best
  (worth knowing when you hire a manager), and the next opponent.
- **Poach staff.** About a third of the staff universe, and every other club's manager, is in work. Approach them from
  Find staff (Status: At another club): their club gets compensation (a year or two of wages, more for a manager and
  for a club abroad) and they want a little more to leave. Your own new appointments can't be approached in their first
  year, and other clubs rarely come for your staff.
- **A staff universe.** Over a hundred people for each role, from part-timers to the best in the game, kept from week to
  week: they age, some take jobs elsewhere or retire, and new names come in. Filter to the ones who would come (always at
  least ten) or see everyone. The Find staff page works like the transfer market: a tab for each role, filters (style
  or approach, focus, formation, minimum average, maximum wage, age, vision) and a table you sort by any column (age,
  reputation, each attribute, average, vision, wage). Tap a name for his card and to offer the job.
  Like players, coaches won't drop more than two divisions below where their reputation belongs (three once they're
  58 and winding down), whatever you offer, unless they're a former player coming home.
- **Hire staff.** A manager (tactics, motivation, player development; a style of play, a formation, and a view on
  youth), a head of recruitment (judging ability, negotiation, contacts; a recruitment philosophy and a search area),
  and a youth manager (development, judging potential, youth scouting; a type of player, local or wide search).
  Their philosophies decide how the team plays and who gets signed. Pick people whose ideas match yours.
- **Finances in tabs:** Overview, Per game (what a home game brings in and costs, what runs every week, and the net of a
  home week and an away week, forecast and this season's actual averages), Prices, Budgets, Accounts and Borrowing.
  Sums under €10,000 are shown in full.
- **Set prices:** tickets, food and drink, replica shirts, executive suites. Prices above what supporters expect earn
  more per head but cost crowds and goodwill.
- **Season tickets.** Set the price on the Finances page (the going rate is about a quarter off buying every league home
  game). They sell when the season starts, paid up front: how many depends on the price, the supporters' mood and the
  size of your support, up to 70% of the ground. Holders don't pay on the day for league games. The number sold shows on
  the Office, the Stadium and Finances.
- **Set budgets:** player wages, transfers, academy running costs, scouting. Your staff work within them and notice
  when they're cut.
- **Find sponsors:** shirt, kit, sleeve, stadium naming and training-ground naming. Offers expire; longer deals pay a
  little less a year; each pays a promotion bonus.
  Deals get better as the club grows: promotion, standing, a bigger and happier support, league position and crowds
  all count. Outgrow a deal by a quarter and you can ask for new terms; outgrow it by half and brands approach you. Breaking a deal
  early costs half of what it still had to pay.
- **Design your ground stand by stand.** A ground of your own is four stands (Main, East, North, South). Design a new
  one stand by stand (or start from a size): places, seats or terrace, roof or open, a family stand and corporate seats.
  Later, extend any stand by any number of places, roof it, switch between seats and terracing, move the family stand or
  add corporate seats. Terraces are about half the cost a place, louder (a bigger home advantage, happier supporters)
  and sell a fifth cheaper, but the Premier and First Divisions are all-seater, so terraces close there until seated. A
  roof keeps the crowd coming in bad weather. A family stand grows the support faster and sells more shirts. Corporate
  seats (up to 15% of the Main stand) sell to businesses by the season. Older grounds are split into four seated,
  covered stands.
- **Build the club.** You start renting a recreation ground. Build your own stadium (1,500 to 65,000), add stands,
  upgrade the facilities, add executive suites, look after the pitch (it wears with every home game; re-lay it with
  grass or a hybrid surface). Build a training ground and an academy, levels 1 to 10.
- **Make the stadium pay beyond match days:** club shop and megastore, car park, conference and events centre, tours
  and museum, a stadium hotel, summer concerts (they damage the pitch), a tenant team.
- **Suggest signings.** Tap *Suggest* on any player's card and your head of recruitment tells you what he thinks: he'd
  start, he's a prospect, he's good cover, or why not (not good enough, won't come, too dear for the budget). While a
  window is open he goes after the ones he agrees with before his own targets. Asking isn't overruling, and he's pleased
  when a tip comes off. He negotiates the deal: he talks the asking fee down (more the better a negotiator he is, and
  more if the player is listed, has a year or less left or has asked to leave) and the agent's wage demand down toward
  the least the player will take, and tells you the figures before and after. You can suggest a loan instead for players 23 or under: he borrows him during the window, paying
  what the lending club wants (a good negotiator knocks 10% off). Your suggestions are listed on the Transfers page.
- **Youth recruitment all year.** As well as the summer intake (at least three boys), your youth manager's scouts bring
  boys in three more times a year: late summer, January and a spring trial day. How many and how good depends on his
  scouting reach and eye for potential, the academy budget and level, and whether he looks locally or wider. Trialists join
  straight away; a boy from another academy or abroad costs compensation, so your youth manager asks you first (sign
  him or pass; unanswered after three weeks, the chance goes). A full academy takes no more.
- **Negotiate loans.** On a loan target's card, choose what share of his wages you'll pay (0% to 100%) and ask. Each
  club has a figure in mind for the window: lower for your partner clubs and for youngsters who need games, higher for
  clubs abroad. Offer less and they tell you what they want; after three tries they stop listening, and about one club
  in five won't lend at all. The Finances overview lists every loan's wage share and what you pay; the wage bill everywhere (budgets,
  your head of recruitment's limits) counts only your share. Lending is about ability, not club size: any club, even a Premier Division one, will lend a player to a club in
  the division that suits his rating or one below it, but not further down.
- **Rotation and substitutes.** Players tire with every game (less with good stamina, a keeper hardly at all) and
  recover each week (faster with better training). Below about 88% sharpness the manager starts resting a player for a
  fresh deputy. Every match has up to three substitutes (five in a friendly): the most tired starters come off for a
  bench player in the same part of the pitch, the manager spreading the minutes among those who've played least. The
  Squad page shows appearances with sub appearances in brackets, and each player's fitness.
- **Squad registration.** Hold as many players as you like, but only 25 registered seniors can play; under-21s and
  academy players don't need registering. Tick or untick players in the Squad page's Reg. column while a transfer
  window is open. New signings are registered if there's room, and your manager fills any empty places when a window
  closes. With the list full, your head of recruitment only goes for under-21s.
- **Loan list.** Make a player available for loan from his card. While a window is open, clubs at his level (English
  or abroad) send offers to your inbox with the share of his wages they'd pay; accept and he goes out to the end of the
  season, and he plays every week there.
- **Transfer activity.** The Activity page lists every move in and out of your club: signings, sales, loans in and
  out, academy signings, releases and contracts that ran out, with the fee, the wage, the other club and who did the
  deal (you, your head of recruitment, your suggestion, a partner club). Filter by season and type; totals for fees
  spent and received.
- **Negotiate bids.** Counter any offer for one of your players. Each bidder has a most it will pay: counter at or
  under it and they agree; a little over and they come back with an improved (sometimes final) offer; too far over, or
  a third time, and they may walk away.
- **Bidding wars.** Accept a bid and word gets out: for a player in demand (a star, one coming off a fine season, one
  sold below his value) other clubs may come in. Take the best offer, ask everyone once for best and final bids, or
  keep him. Left alone for two weeks, he goes to the highest bidder.
- **Not for sale.** Mark a player not for sale from his card: open bids are turned down, he can't be transfer-listed,
  and bids only come for a star for your division (at the top of its rating range: Regional League 5+, National
  Division 7+, Third 9+, Second 10+, First 13+, Premier 18+) or a player coming off a big season, at two to five times
  his value (a little more after a huge season) (your head of recruitment advises
  rejecting; it's still your call). A player who has outgrown the club or is paid well under his worth resents it: he's
  unsettled for a while and more likely to hand in a transfer request, and turning down a big club he wants to join
  unsettles him further.
- **Pre-season tours.** Clubs abroad host English sides for a tour fee set by your division (about ten times what an
  English club would pay a side at your level), and they're keener to play you than English clubs far above you.
- **Overrule your staff when you must.** Buy a player yourself, transfer-list or release one, or answer a bid against
  your head of recruitment's advice. They notice, and so does every coach you try to hire afterwards.
- **Selling only happens through real offers.** Clubs bid during a window for players on the transfer list (usually
  below their value) and for players they rate, listed or not; a standout season brings more and bigger bids from
  bigger clubs. Offers come to your inbox with your head of recruitment's advice: accept, reject, or reject and offer the player an improved contract. A player who wants the move and is turned down without a better deal is unsettled for a while and plays below his best. A player signed in a window can't be
  sold until it closes.
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

Play-offs are one-off semi-finals at the higher seed and a final at a neutral ground. Promotion doesn't depend on your ground: a bigger one just means bigger crowds and more income.

## The transfer market and player types

Every player has an archetype for his position, read from which of his attributes stand out (a stopper or a
ball-playing defender, a poacher or a target man, and so on); it shows on the Squad page, the market and player cards.
The market has four tabs (all players, free agents, transfer listed, loan targets) and filters for position, type,
age, rating, interest, fee, league and country, laid out as in Touchline Manager. Interest is how open a player is to joining you, from the same factors he weighs when
you bid. Nobody drops more than one division below his natural level (the division whose typical
starter is nearest his rating), or two once he's 31, whatever the money. Tables show his current wage and what he'd want from you, and sort by any column. Ask to borrow a loan target
from his card during a window: you pay half his wages until the end of the season. AI clubs transfer-list players they
can do without each summer and January.

## Ratings: shown out of 20, held at 200-step precision

Every player has twelve attributes (keepers five); each position's rating is a weighted mix of them. Attributes,
ratings and potential are held in half-points on a 100 scale, which is 200 steps. Everything is shown out of 20, and
that's also all anyone in the game sees: your manager picks his side, your scouts judge targets and AI clubs recruit on
the 20-point figures. Only matches and development use the exact values underneath. The shown scale, by division:
Regional League and National North/South mostly 1-5, National Division 3-7, Third Division 5-9, Second 6-10, First
9-13, Premier Division 12-20; 18-19 is world class and 20 a once-in-a-generation player. Foreign clubs are their
countries' top flights and read like the Premier Division. Staff and directors use a straight 1-20 scale on which about 10 is average. Player wages are shown by the week.

**Potential is rare at the top.** Each youth intake draws potential from a bell curve whose centre an academy can move
(about 38 of 100 with no facilities, about 57 at the best academy in the game), capped at 94. Separately, about one
youngster in 2,000 is an exceptional talent (90–100), heavily skewed toward 90. Over 20 simulated seasons and about
15,000 youth players across the whole world, 13 had potential of 90+ (18 out of 20), one had 95+, and none reached 100.
Even a generational talent needs football, coaching and facilities to get there. Potential is only ever an estimate.

## Why people join

Every player and every coach has their own priorities. Each weighs seven
factors, two of them most heavily. Players weigh wages, playing time, formation fit, club prestige, training
facilities, closeness to home and the project. Coaches weigh salary, prestige, facilities, budgets, the squad, your
ambition and freedom to work. Money is only one factor. Some people won't come at any price, and the hiring and
transfer dialogs show what each one is weighing up.

## Competitions

The league, plus three cups with one-off ties and penalties: the **National Cup** (every club; the big clubs get byes),
the **League Cup** (tiers 1–4) and the **National Trophy** (tiers 5–7). Prize money for every round won; beating a club
from a higher division delights the supporters.

## Continental football

71 clubs from Spain, Germany, Italy, France, Portugal, the Netherlands and Belgium play in two competitions of 32 (they
don't play domestic leagues; their strength drifts each summer):
- **Champions Cup:** the top four in the Premier Division and 28 foreign clubs.
- **Continental Shield:** 5th and 6th in the Premier Division, the National Cup winners whatever their division (so a
  cup run can take a small club into Europe), and 29 foreign clubs.

Eight groups of four, home and away (weeks 5-25), then two-legged knockout rounds and a final at a neutral ground.
Prize money for taking part, every group win and draw, and each round reached; home European nights draw bigger
crowds at higher prices. Players at foreign clubs can be signed too, and foreign clubs bid for yours (about a quarter of the offers a top-flight or second-tier club gets, more for players from their own country). They sign free agents too, every week of a window, preferring their own countrymen; new players are only made up when no free agent fits. Each window foreign clubs may offer you young players on loan (you pay half his wages) or ask to borrow your fringe youngsters, from clubs where they'd go straight into the side (they pay all his wages). Foreign clubs play their own league seasons in the background, so players there get games and develop.

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

You can be a feeder to up to three **partner clubs**: English clubs in any division above you, or clubs abroad (filter
by country and division to find them). Each partner pays you a yearly affiliation fee set by your division (more from a club abroad or
in the Premier Division), and each window offers young players at your level on loan, at a wage share it's happy with; the bigger the partner, the higher you need to climb before its youngsters suit you. Up to three **feeder clubs**
below you take your funding (raising their standard and facilities), take your players on loan first, and give you first
refusal on their best youngsters at a discount.

## Pre-season friendlies and unhappy players

Arrange a friendly in any or all of the eight pre-season weeks (Competitions → Pre-season). Away, the host pays you a fee
that grows with the size of their club and how keen they are to face a side of your ability; neighbours are keener,
much stronger clubs barely interested. Home, you keep a reduced gate, and bigger visitors draw bigger crowds but take a
third as an appearance fee. Friendlies don't count in players' records; fewer than two leaves the team rusty for the
first league games, three or more gives a small edge.

Players get unhappy: benched when good enough to start, far too good for your division, underpaid, or kept from a move.
An unhappy player may hand in a transfer request: accept it (he's listed), offer a new deal (settles money and blocked
moves, sometimes the rest), or refuse (he's unsettled and plays below his best).

## Fan favourites and legends

Players build affection with each club they play for: games, goals, assists, loyalty, and more for academy graduates.
About two good seasons make a fan favourite, six or more a club legend. Favourites sell shirts; selling or releasing one
upsets the supporters. Legends who retire get a testimonial and a place on the club's legends list. Signing a big name
for your division, or bringing a favourite home, gets the supporters buzzing (mood, new fans, shirt sales). Some retiring
players go into coaching and appear among your staff candidates, your own favourites and legends always; appointing a
legend lifts the fans, the supporters' trust and the dressing room, and legends are keener to come home.

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

`js/names.js` (names, towns, regions and helpers), `core.js` (pyramid, players, talent, development),
`staff.js`, `club.js` (prices, attendance, sponsors, facilities, suites, pitch, ventures), `weather.js`, `match.js`,
`events.js` (decisions and media), `cups.js`, `owners.js` (rival owners), `board.js` (valuation, investors, directors,
supporters' trust, loans, objectives), `partners.js`, `legends.js`, `friendlies.js` (friendlies and transfer requests), `europe.js` (foreign clubs and the continental cups), `sale.js`, `season.js`, `market.js`, `appeal.js`, `ui.js`, `ui2.js`, `main.js`.

`node tools/sim.js 20` plays 20 seasons headless and reports talent, ratings by tier and the test club's progress.
