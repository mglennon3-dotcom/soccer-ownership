/* Weather. Each week has weather in the north and the south. Frost and snow postpone games at grounds without
   undersoil heating (played the following week); rain and snow keep crowds down, cut up pitches and make passing
   football harder. */
"use strict";

const WX = {
  clear: { l: "Clear", ico: "☀", crowd: 1, wear: 1, play: 1 },
  cloud: { l: "Overcast", ico: "☁", crowd: 1, wear: 1, play: 1 },
  rain:  { l: "Rain", ico: "🌧", crowd: .92, wear: 1.6, play: .97 },
  storm: { l: "Heavy rain", ico: "⛈", crowd: .82, wear: 2.2, play: .93 },
  frost: { l: "Frost", ico: "❄", crowd: .9, wear: 1.2, play: .97, off: .5 },
  snow:  { l: "Snow", ico: "🌨", crowd: .75, wear: 1.4, play: .92, off: .85 },
  heat:  { l: "Heatwave", ico: "🔥", crowd: .95, wear: 1.1, play: .96 },
};
// Season week 0 is mid-August; month index 0 = January.
const monthOf = w => G.phase === "summer" ? 6 : (7 + Math.floor((w + 2) / 4.4)) % 12;
function rollWeather(half, w) {
  const m = monthOf(w), winter = [11, 0, 1].includes(m), shoulder = [10, 2].includes(m), summer = [5, 6, 7].includes(m);
  const north = half === "N" ? 1.4 : 1, r = R();
  if (winter) { if (r < .07 * north) return "snow"; if (r < .07 * north + .14 * north) return "frost"; }
  if (shoulder && r < .06 * north) return "frost";
  if (summer && r < .1) return "heat";
  const r2 = R();
  return r2 < .1 ? "storm" : r2 < .4 ? "rain" : r2 < .7 ? "cloud" : "clear";
}
// This week's weather is fixed when the week starts; next week's is the forecast.
function weatherWeek() {
  G.wx = G.wxNext || { N: rollWeather("N", G.week), S: rollWeather("S", G.week) };
  G.wxNext = { N: rollWeather("N", G.week + 1), S: rollWeather("S", G.week + 1) };
}
const wxAt = c => WX[(G.wx || {})[c.half] || "clear"];
const hasHeating = c => isMine(c) ? !!c.fac.stadium.heat : c.tier <= 3 || c.cap >= 15000;
/* Is this game off? Frost or snow at a ground without undersoil heating, by chance. */
function postponed(h) { const c = CL(h), w = wxAt(c); return !!w.off && !hasHeating(c) && R() < w.off; }
const heatQuote = c => ({ cost: Math.round((150000 + c.fac.stadium.cap * 18) / 1e4) * 1e4, weeks: 6, upkeep: 20000 + c.fac.stadium.cap * 2 });
