// Headless check: build a world, hire staff for your club, play many seasons and report on talent and money.
// Usage: node tools/sim.js [seasons=20]
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { console, Math, Date, JSON }; vm.createContext(ctx);
for (const f of ["names", "core", "staff", "club", "weather", "match", "events", "cups", "owners", "board", "partners", "legends", "friendlies", "europe", "sale", "season", "market", "appeal"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", f + ".js"), "utf8"), ctx, { filename: f + ".js" });
const run = s => vm.runInContext(s, ctx);
const seasons = +process.argv[2] || 20, t0 = Date.now();
run(`newWorld({ name: "Test Town", half: "N", wealth: "wealthy" });
  function simOwner() {
    const c = my();
    for (const r of ["manager","youth","recruit"]) { const s0 = staffOf(r); if (s0 && s0.yrs > 0) { s0.trust = 60; continue; }
      const cap = wageFor(TIER_LVL[c.tier] + 8) * (r === "manager" ? 1.5 : .7); const s = candidates(r).filter(s => !wontCome(s) && askingWage(s) <= cap)[0] || candidates(r).filter(s => !wontCome(s)).sort((a, b) => askingWage(a) - askingWage(b))[0]; if (s) hire(s, askingWage(s), 3); }
    c.budget.wages = Math.round(24 * wageFor(TIER_LVL[c.tier] + 3)); c.budget.transfer = Math.round(c.budget.wages * 1.5); c.budget.acad = acadRef(c.fac.acad.lvl); c.budget.scout = scoutRef(c.tier);
    const need = Math.round(STADIUM_T[Math.max(1, c.tier - 1)] * .6);  // build for the crowds a division up
    if (capacity(c) < need * 1.2 && !c.fac.stadium.build) { if (!c.fac.stadium.own) startBuild("stadium", { type: "new", ...newStadiumQuote(BUILD_SIZES.find(x => x >= need * 1.2) || 65000), name: "Sim Park", label: "x" }); else startBuild("stadium", { type: "expand", ...expandQuote(c, Math.round(need * 1.2 - c.fac.stadium.cap)), label: "x" }); }
    if (c.fac.stadium.own && c.fac.stadium.pitch < 50 && !c.fac.stadium.relay) relayPitch("hybrid");
    if (c.cash < 0) c.cash += -c.cash + c.budget.wages;  // the owner tops up
    refreshOffers(c); for (const o of c.offers.slice()) if (!c.deals.find(d => d.slot === o.slot && d.yrs > 0)) acceptOffer(o);
  }
  this.simOwner = simOwner; simOwner();
  startSeason();`);
const pctl = (a, q) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(q * (a.length - 1))]; };
const potLog = [];
for (let y = 0; y < seasons; y++) {
  const before = new Set(run("Object.keys(G.players)").map(Number));
  run(`for (let i = 0; i < 200 && !(G.phase === "summer" && G.week === 0 && i > 5); i++) { advance(); if (G.phase === "summer" && G.week === 1) simOwner(); if (my().cash < 0) my().cash = 0; }`);
  // a facility a year at the bottom, so the academy level moves
  run(`{ const c = my(); if (c.fac.acad.lvl < 10 && !c.fac.acad.build) startBuild("acad", { lvl: c.fac.acad.lvl + 1, cost: 0, weeks: 2, label: "x" }); if (c.fac.train.lvl < 10 && !c.fac.train.build) startBuild("train", { lvl: c.fac.train.lvl + 1, cost: 0, weeks: 2, label: "x" }); }`);
  const intake = run(`Object.values(G.players).filter(p => p.acad && p.hist.length === 1 && p.hist[0][0] === G.year - 1).map(p => p.pot)`);
  potLog.push(intake);
  const h = run("G.history[0]");
  console.log(`${run("G.year") - 1}: ${run("LEAGUES[G.history[0].lg].name")} ${h.pos}/${h.size} pts ${h.pts}${h.up ? " UP" : h.down ? " DOWN" : ""} | crowd ${h.att} fans ${h.fans} | inc ${Math.round(h.inc / 1e3)}k cost ${Math.round(h.cost / 1e3)}k cap ${run("capacity(my())")} XI ${run("Math.round(avg(pickXI(my()).map(o=>o.p.ovr)))")} | intake ${intake.length} youths, pot>=85: ${intake.filter(x => x >= 85).length}, >=90: ${intake.filter(x => x >= 90).length}, >=95: ${intake.filter(x => x >= 95).length}, 100: ${intake.filter(x => x >= 100).length}`);
}
const all = potLog.flat();
console.log(`\nIntakes over ${seasons} seasons: ${all.length} youths. Potential median ${pctl(all, .5)}, 90th pct ${pctl(all, .9)}, 99th ${pctl(all, .99)}; 85+: ${all.filter(x => x >= 85).length}, 90+: ${all.filter(x => x >= 90).length}, 95+: ${all.filter(x => x >= 95).length}, 100: ${all.filter(x => x >= 100).length}`);
for (let t = 1; t <= 7; t++) {
  const xi = run(`G.clubs.filter(c => !c.gone && c.tier === ${t}).flatMap(c => pickXI(c).map(o => o.p.ovr))`);
  console.log(`Tier ${t} starters: median ${pctl(xi, .5)}  10th ${pctl(xi, .1)}  90th ${pctl(xi, .9)}  best ${Math.max(...xi)}`);
}
const top = run(`Object.values(G.players).sort((a, b) => b.ovr - a.ovr).slice(0, 8).map(p => p.name + " " + p.ovr + "/" + p.pot + " age " + p.age + " " + (p.club >= 0 ? CL(p.club).short : "FA"))`);
console.log("Best players:", top.join(", "));
console.log("Players in save:", run("Object.keys(G.players).length"), " save size", Math.round(run("JSON.stringify(G).length") / 1024), "KB  time", (Date.now() - t0) / 1000, "s");
