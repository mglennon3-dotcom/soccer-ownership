/* World data and helpers: names, nationalities, towns, regions, colours. */
const R = Math.random;
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const rf = (a, b) => a + R() * (b - a);
const pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += R(); return (u - 3) * 1.41; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sum = (a, f = x => x) => a.reduce((s, x) => s + f(x), 0);
function wpick(arr, w) { let t = 0; const ws = arr.map(x => { const v = Math.max(0, w(x)); t += v; return v; }); if (!t) return arr[0]; let r = R() * t; for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function money(v) {
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a < 10000) return s + "€" + Math.round(a).toLocaleString("en-GB");  // small sums in full: at the bottom of the pyramid every euro shows
  if (a >= 1e9) return s + "€" + (a / 1e9).toFixed(2) + "bn";
  if (a >= 1e7) return s + "€" + (a / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1e6) return s + "€" + (a / 1e6).toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "M";
  return s + "€" + Math.round(a / 1000) + "k";
}
// Weekly wages to the nearest hundred below €10k (money() rounds to whole thousands, so €1,250 and
// €1,700 a week both read "€1k"), and to the nearest ten below €1k.
const perWeek = annual => { const w = annual / 52; return (w >= 1e4 ? money(w) : w >= 1000 ? "€" + (w / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "€" + Math.round(w / 10) * 10) + "/wk"; };
const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
const pct = x => Math.round(x * 100) + "%";
function km(a, b) {
  const toR = x => x * Math.PI / 180, dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const stripAcc = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const COUNTRIES = [
  { code: "ENG", name: "England", adj: "English",
    regions: [["London",51.51,-0.13,"S"],["South East",51.25,0.55,"S"],["South West",50.95,-3.2,"S"],["East Anglia",52.4,1.0,"S"],["West Midlands",52.48,-1.9,"N"],["East Midlands",52.95,-1.15,"N"],["North West",53.6,-2.55,"N"],["Yorkshire",53.8,-1.45,"N"],["North East",54.9,-1.6,"N"]],
    pre: ["Ash","Brack","Cal","Thorn","Wick","Hal","Mar","Stan","Red","Brom","Kes","Lan","Pen","Har","Wes","Nor","Sal","Ever","Hol","Til","Elm","Fen","Gran","Kirk","Mill","Oak","Rush","Shel","Ald","Bex","Cor","Dun","Lyd","Mor","Sand","Hart","Wil","Brad","Chip","Fal","Gil","Haw","Ilk","Ket","Lox","Nant","Ross","Stoke","That","Wal"],
    suf: ["ford","ton","bury","ley","ham","wick","field","mouth","stead","by","gate","worth","borough","bridge","mere","dale","well","combe","hurst","stow","hampton","minster","chester","port","wood","thorpe"],
    fmt: ["{t} Town","{t} United","{t} City","{t} Athletic","{t} Rovers","{t} Albion","{t} Wanderers","{t} FC","AFC {t}","{t} Borough","{t} County"] },
  { code: "ESP", name: "Spain", adj: "Spanish",
    regions: [["Madrid",40.42,-3.7],["Catalonia",41.6,1.9],["Andalusia",37.4,-5.0],["Valencia",39.45,-0.5],["Basque Country",43.1,-2.6],["Galicia",42.8,-8.0],["Castile",41.6,-4.7],["Aragon",41.65,-0.9]],
    pre: ["Val","Mon","Sant","Alca","Villa","Torre","Cas","Pal","Ber","Mar","Lor","Gua","Sal","Ron","Tar","Bena","Cam","Fuen","Hor","Lin","Olm","Peñ","Riba","Seg","Tre","Zar","Ali","Mer","Cor"],
    suf: ["ares","eda","illa","ena","ejo","ona","ante","oz","ero","ida","ales","uela","ar","era","obre","al","iza","ón","ada"],
    fmt: ["Real {t}","{t} CF","Atlético {t}","CD {t}","UD {t}","Deportivo {t}","Racing {t}","SD {t}","CF {t}"] },
  { code: "GER", name: "Germany", adj: "German",
    regions: [["Bavaria",48.6,11.6],["Berlin",52.52,13.4],["Rhineland",50.6,7.0],["Ruhr",51.45,7.2],["Saxony",51.1,13.2],["North",53.5,9.9],["Baden",48.6,8.5],["Hesse",50.3,8.7]],
    pre: ["Alt","Bad","Berg","Eich","Fal","Gro","Hei","Kirch","Lin","Mar","Neu","Ober","Ros","Schön","Stein","Wal","Hoch","Lich","Mühl","Sond","Tann","Unter","Brem","Lau","Rhein","Sieg","Würz","Elm","Dor"],
    suf: ["dorf","hausen","heim","feld","stadt","bach","berg","au","ingen","hagen","rode","stein","furt","tal","brück","wald","see","burg"],
    fmt: ["FC {t}","SV {t}","VfB {t}","TSV {t}","Eintracht {t}","SC {t}","Borussia {t}","1. FC {t}","SpVgg {t}"] },
  { code: "ITA", name: "Italy", adj: "Italian",
    regions: [["Lombardy",45.5,9.4],["Piedmont",45.0,7.7],["Lazio",41.9,12.6],["Campania",40.9,14.4],["Tuscany",43.5,11.2],["Veneto",45.5,12.0],["Emilia",44.6,11.0],["Sicily",37.6,14.0]],
    pre: ["Ca","Mon","San","Vil","Pie","Fi","Lu","Ter","Bel","Cor","Fon","Mar","Ponte","Val","Ac","Bor","Cas","Gal","Lo","Or","Pe","Sas","Ve","Ri","Aqui","Sor","Tre"],
    suf: ["ella","ano","ena","ola","ate","ara","eto","ignano","iglia","ezzo","one","asco","ello","orto","iana","era"],
    fmt: ["{t} Calcio","AC {t}","US {t}","{t} FC","Atletico {t}","SS {t}","AS {t}","Sporting {t}","Virtus {t}"] },
  { code: "FRA", name: "France", adj: "French",
    regions: [["Île-de-France",48.85,2.35],["Brittany",48.1,-2.8],["Normandy",49.2,0.3],["Provence",43.6,5.5],["Rhône",45.75,4.85],["Nord",50.5,3.0],["Aquitaine",44.8,-0.6],["Lorraine",48.7,6.2]],
    pre: ["Beau","Mont","Val","Chât","Ro","Bel","Ver","Gran","Lan","Mar","Sa","Bour","Cler","Font","Mor","Pont","Cha","Vau","Lou","Ger"],
    suf: ["ville","mont","court","gny","lieu","nac","sac","bourg","fort","mas","lac","ières","oux","eau","ay","eux"],
    fmt: ["{t} FC","AS {t}","Olympique {t}","Stade {t}","SC {t}","RC {t}","US {t}","FC {t}","AJ {t}"] },
  { code: "POR", name: "Portugal", adj: "Portuguese",
    regions: [["Lisbon",38.72,-9.14],["Porto",41.15,-8.6],["Minho",41.6,-8.4],["Algarve",37.1,-8.2],["Coimbra",40.2,-8.4],["Alentejo",38.5,-7.9],["Madeira",32.65,-16.9],["Azores",37.75,-25.67]],
    pre: ["Vila","Ar","Bra","Cas","Fa","Gui","Lou","Mon","Pe","Sa","Tor","Val","Es","Al","Ma","Ri","Cova","Fer"],
    suf: ["inho","ela","ães","ar","eira","ão","ense","osa","al","edo","elo","oa","anda"],
    fmt: ["{t} FC","SC {t}","CD {t}","GD {t}","Sporting {t}","Académico {t}","União {t}","FC {t}"] },
  { code: "NED", name: "Netherlands", adj: "Dutch",
    regions: [["Holland",52.37,4.9],["Utrecht",52.09,5.12],["Brabant",51.6,5.1],["Gelderland",52.0,5.9],["Limburg",51.0,5.8],["Friesland",53.1,5.8],["Groningen",53.2,6.6],["Overijssel",52.4,6.4]],
    pre: ["Ams","Rot","Hel","Zwol","Gro","Bre","Ein","Til","Del","Har","Dor","Venl","Ap","Al","Bos","Leeu","Wa","Oos","Zee","Hoog","Mid"],
    suf: ["dam","drecht","burg","hoven","wijk","veld","huizen","horst","land","sum","lo","werd","haven","rode","kerk"],
    fmt: ["{t} FC","SC {t}","VV {t}","FC {t}","Sparta {t}","RKC {t}","Fortuna {t}","SBV {t}"] },
  { code: "BEL", name: "Belgium", adj: "Belgian",
    regions: [["Brussels",50.85,4.35],["Flanders",51.05,3.7],["Antwerp",51.22,4.4],["Liège",50.63,5.57],["Hainaut",50.45,4.0],["Limburg (BE)",50.93,5.34],["Namur",50.47,4.87],["Ardennes",49.9,5.5]],
    pre: ["Ber","Mol","Wa","Ou","Lok","Tur","Has","Gen","Roe","Lie","Char","Aal","Ze","Kor","Ost","Ve","Tie","Her"],
    suf: ["eren","hout","ege","ingen","elle","gem","beke","dam","rode","stal","ken","aart","laar"],
    fmt: ["KV {t}","RSC {t}","Royal {t}","KRC {t}","Standard {t}","Sporting {t}","{t} FC","Racing {t}"] },
  // 0.72: the rest of the continent's leagues, smaller (the clubs that matter in Europe), by the continental ranking.
  { code: "TUR", name: "Turkey", adj: "Turkish",
    regions: [["Istanbul",41.01,28.98],["Ankara",39.93,32.86],["Izmir",38.42,27.14],["Black Sea",41.0,39.7],["Anatolia",37.9,32.5],["Antalya",36.9,30.7]],
    pre: ["Kara","Ak","Bay","Gül","Yeni","Kır","Sarı","Bur","Esk","Kay","Mer","Dem","Ord","Tok","Sam","Ala","Kon","Bol"],
    suf: ["köy","şehir","pınar","dere","tepe","kale","ova","yurt","han","lar","sun","ören","dağ"],
    fmt: ["{t}spor","{t} SK","{t} Belediyespor","{t} FK","{t} Gençlik","{t} İdmanyurdu"] },
  { code: "GRE", name: "Greece", adj: "Greek",
    regions: [["Athens",37.98,23.73],["Thessaloniki",40.64,22.94],["Crete",35.3,25.1],["Peloponnese",37.5,22.4],["Thessaly",39.6,22.4],["Epirus",39.7,20.8]],
    pre: ["Ana","Kal","Ped","Agi","Ner","Kor","Lar","Mes","Pal","Xan","Ser","Tri","Vol","Kar","Ali","Ele"],
    suf: ["polis","ada","ia","ini","itsa","ona","aki","os","eri","ou","ina","ani"],
    fmt: ["{t} FC","AE {t}","Panathlitikos {t}","Asteras {t}","Atromitos {t}","PAS {t}","Iraklis {t}"] },
  { code: "CZE", name: "Czechia", adj: "Czech",
    regions: [["Prague",50.08,14.44],["Moravia",49.2,16.6],["Bohemia",49.7,13.4],["Silesia",49.8,18.2],["Liberec",50.77,15.06]],
    pre: ["Hra","Bře","Lit","Kol","Pís","Tře","Jab","Mla","Pře","Chr","Kro","Vys","Bud","Ost"],
    suf: ["ov","ice","any","ín","ec","ava","nov","sko","ky","ová","ník"],
    fmt: ["FK {t}","SK {t}","Slovan {t}","Baník {t}","Dukla {t}","FC {t}","Viktoria {t}"] },
  { code: "POL", name: "Poland", adj: "Polish",
    regions: [["Warsaw",52.23,21.01],["Silesia",50.3,19.0],["Greater Poland",52.4,16.9],["Pomerania",54.35,18.65],["Lesser Poland",50.06,19.94],["Lower Silesia",51.1,17.03]],
    pre: ["Bia","Gór","Prz","Wło","Kos","Szcz","Rad","Ols","Lub","Tar","Zab","Kiel","Opo","Chr","Grud"],
    suf: ["ów","owice","sk","ice","no","ka","aw","yn","ec","ice","nik","owo"],
    fmt: ["{t} KS","Polonia {t}","Lech {t}","Górnik {t}","Zagłębie {t}","Wisła {t}","Piast {t}","Stal {t}"] },
  { code: "SCA", name: "Norway", adj: "Norwegian",
    regions: [["Oslo",59.91,10.75],["Bergen",60.39,5.32],["Trondheim",63.43,10.4],["Stavanger",58.97,5.73],["Nordland",67.3,14.4]],
    pre: ["Mol","Lill","Sand","Fred","Bod","Hau","Kris","Sog","Stab","Strøm","Ålen","Lev","Rauf","Ham","Vål"],
    suf: ["de","ø","heim","vik","sund","fjord","dal","berg","nes","stad","ås","eng"],
    fmt: ["{t} FK","{t} IL","{t} BK","IK {t}","{t} Fotball","SK {t}"] },
  { code: "DEN", name: "Denmark", adj: "Danish",
    regions: [["Copenhagen",55.68,12.57],["Jutland",56.2,9.5],["Funen",55.4,10.4],["Aarhus",56.16,10.2],["Aalborg",57.05,9.92]],
    pre: ["Hel","Vej","Sil","Her","Rand","Ros","Køg","Hor","Lyng","Næst","Skive","Thi","Fred","Ny"],
    suf: ["borg","le","keborg","ning","ers","kilde","e","sens","by","sted","rup","bæk"],
    fmt: ["{t} BK","{t} IF","FC {t}","{t} FF","AGF {t}","B.93 {t}"] },
  { code: "CYP", name: "Cyprus", adj: "Cypriot",
    regions: [["Nicosia",35.17,33.36],["Limassol",34.68,33.04],["Larnaca",34.92,33.63],["Paphos",34.77,32.42]],
    pre: ["Ana","Kor","Pol","Lef","Ayi","Der","Dal","Ere","Kat","Par","Ach"],
    suf: ["ia","ini","onas","ou","os","eri","ali","itis","ada"],
    fmt: ["{t} FC","APOEL {t}","Omonia {t}","Anorthosis {t}","Apollon {t}","Ethnikos {t}"] },
  { code: "SUI", name: "Switzerland", adj: "Swiss",
    regions: [["Zürich",47.37,8.54],["Bern",46.95,7.45],["Basel",47.56,7.59],["Geneva",46.2,6.14],["Lucerne",47.05,8.31],["Ticino",46.2,8.95]],
    pre: ["Wint","Thun","Aar","Sitt","Grench","Schaff","Laus","Neuch","Bell","Wil","Frau","Kriens","Yver"],
    suf: ["erthur","au","en","ingen","hausen","dorf","on","wil","ach","berg","ier"],
    fmt: ["FC {t}","{t} FC","Servette {t}","Young Boys {t}","Grasshopper {t}","Lugano {t}"] },
  { code: "AUT", name: "Austria", adj: "Austrian",
    regions: [["Vienna",48.21,16.37],["Salzburg",47.8,13.04],["Styria",47.07,15.44],["Tyrol",47.26,11.39],["Upper Austria",48.3,14.29],["Carinthia",46.62,14.31]],
    pre: ["Alt","Hart","Wolfs","Ried","Linz","Pasch","Kapf","Leob","Ams","Kuf","Bruck","Leon"],
    suf: ["berg","dorf","bach","feld","ing","stein","au","kirchen","hofen","stadt"],
    fmt: ["SK {t}","SV {t}","FC {t}","Austria {t}","Rapid {t}","Admira {t}","WSG {t}"] },
  { code: "HUN", name: "Hungary", adj: "Hungarian",
    regions: [["Budapest",47.5,19.04],["Debrecen",47.53,21.63],["Győr",47.69,17.63],["Pécs",46.07,18.23],["Szeged",46.25,20.15]],
    pre: ["Kis","Nagy","Fehér","Szom","Kecs","Nyír","Zala","Eger","Tata","Mező","Paks","Sop"],
    suf: ["vár","egyháza","hely","falva","szeg","telek","háza","ron","kő","bánya"],
    fmt: ["{t} FC","{t} ETO","{t} TE","Vasas {t}","Honvéd {t}","Haladás {t}","{t} VSC"] },
  { code: "CRO", name: "Croatia", adj: "Croatian",
    regions: [["Zagreb",45.81,15.98],["Split",43.51,16.44],["Rijeka",45.33,14.44],["Osijek",45.55,18.69],["Istria",45.2,13.9]],
    pre: ["Var","Šib","Zad","Kar","Vin","Slav","Pož","Vuk","Kop","Gor","Dub"],
    suf: ["aždin","enik","ar","lovac","kovci","onski","ega","ovar","rivnica","ica"],
    fmt: ["NK {t}","HNK {t}","GNK {t}","{t} Rudeš","Lokomotiva {t}","Slaven {t}"] },
  { code: "SWE", name: "Sweden", adj: "Swedish",
    regions: [["Stockholm",59.33,18.07],["Gothenburg",57.71,11.97],["Malmö",55.6,13.0],["Norrland",63.8,17.5],["Småland",56.9,14.8]],
    pre: ["Häck","Elfs","Hamm","Kalm","Norr","Väst","Hels","Öre","Sunds","Jönk","Trel","Värn"],
    suf: ["en","borg","by","köping","ås","vall","sund","holm","ström","berg","ö"],
    fmt: ["{t} IF","{t} FF","IFK {t}","{t} BK","AIK {t}","{t} IS"] },
  { code: "SCO", name: "Scotland", adj: "Scottish",
    regions: [["Glasgow",55.86,-4.25],["Edinburgh",55.95,-3.19],["Aberdeen",57.15,-2.09],["Dundee",56.46,-2.97],["Highlands",57.48,-4.22],["Ayrshire",55.46,-4.63]],
    pre: ["Kil","Dun","Inver","Craig","Strath","Ach","Bal","Kin","Auch","Glen","Mon","Tor","Lin","Pit","Muir"],
    suf: ["mark","ross","ellan","burn","haven","lochy","more","dee","garry","toun","whin","nock"],
    fmt: ["{t} FC","{t} Thistle","{t} Athletic","{t} Rovers","{t} Rangers","{t} Celtic","{t} Academicals","{t} Hearts"] },
  { code: "ROU", name: "Romania", adj: "Romanian",
    regions: [["Bucharest",44.43,26.1],["Cluj",46.77,23.6],["Banat",45.75,21.23],["Moldavia",47.16,27.59],["Oltenia",44.32,23.8]],
    pre: ["Cra","Sib","Vas","Ploi","Bot","Ara","Med","Buz","Tur","Fal","Hun"],
    suf: ["iova","iu","lui","ești","oșani","ad","iaș","ău","eni","ceni"],
    fmt: ["FC {t}","CS {t}","Universitatea {t}","Rapid {t}","Petrolul {t}","Dinamo {t}","Farul {t}"] },
  { code: "UKR", name: "Ukraine", adj: "Ukrainian",
    regions: [["Kyiv",50.45,30.52],["Kharkiv",49.99,36.23],["Lviv",49.84,24.03],["Odesa",46.48,30.73],["Dnipro",48.46,35.05]],
    pre: ["Zor","Kryv","Polt","Ver","Myk","Cher","Ivan","Zhyt","Ternop","Lut","Sum","Uzh"],
    suf: ["ya","yi","ava","es","olaiv","kasy","ivka","omyr","il","sk","orod"],
    fmt: ["FC {t}","Metalist {t}","Shakhtar {t}","Vorskla {t}","Karpaty {t}","Dnipro {t}","Kolos {t}"] },
];
const COUNTRY = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));
const TOWN_BLOCK = new Set(["Torino","Valencia","Hamburg","Wolfsburg","Marino","Salerno","Lucca","Sevilla","Marburg","Rotdam","Amsdam","Brugge","Genk",
  // Real English clubs the generator can spell out of its own parts (one was "Everton FC" in a test save).
  "Ashford","Brackley","Margate","Bromley","Weston","Salford","Everton","Tilbury","Kirkby","Corby","Hartley","Bradford","Ashton","Thornbury","Redbridge","Walton"]);
// Youth prospects also come from outside the eight leagues.
/* Rest of the world (5.78): youth prospects and players from fifteen countries outside the eight leagues. It was four
   regions (Brazil, Argentina, West Africa, Scandinavia); Ghana and Norway keep the codes WAF and SCA they had then, so
   older saves' players read correctly. [code, label, lat, lon, weight among foreign players] */
const ABROAD = [["BRA","Brazil",-15.8,-47.9,1],["ARG","Argentina",-34.6,-58.4,1],["COL","Colombia",4.7,-74.1,.6],["URU","Uruguay",-34.9,-56.2,.6],
  ["WAF","Ghana",5.6,-.2,.6],["NGA","Nigeria",6.5,3.4,.6],["SEN","Senegal",14.7,-17.4,.5],["CIV","Ivory Coast",5.3,-4,.5],
  ["SCA","Norway",59.9,10.8,.6],["DEN","Denmark",55.7,12.6,.6],["CRO","Croatia",45.8,16,.6],["SRB","Serbia",44.8,20.5,.5],
  ["USA","United States",40.7,-74,.4],["JPN","Japan",35.7,139.7,.4],["KOR","South Korea",37.6,127,.4]];
const NAT_NAME = { ENG: "England", ESP: "Spain", GER: "Germany", ITA: "Italy", POR: "Portugal", FRA: "France", NED: "Netherlands", BEL: "Belgium", BRA: "Brazil", ARG: "Argentina", WAF: "Ghana", SCA: "Norway", COL: "Colombia", URU: "Uruguay", NGA: "Nigeria", SEN: "Senegal", CIV: "Ivory Coast", DEN: "Denmark", CRO: "Croatia", SRB: "Serbia", USA: "United States", JPN: "Japan", KOR: "South Korea", TUR: "Turkey", GRE: "Greece", CZE: "Czechia", POL: "Poland", CYP: "Cyprus", SUI: "Switzerland", AUT: "Austria", HUN: "Hungary", SWE: "Sweden", SCO: "Scotland", ROU: "Romania", UKR: "Ukraine" };
const NAMES = {
  ENG: [["Jack","Oliver","Harry","George","Callum","Kieran","Lewis","Jamie","Ryan","Connor","Ben","Josh","Liam","Tom","Dan","Alfie","Charlie","Reece","Owen","Mason","Ethan","Archie","Toby","Jordan","Nathan","Sam","Max","Joe","Kyle","Luke","Adam","Elliot","Finley","Rhys","Theo","Aaron","Bradley","Caleb","Declan","Freddie","Harvey","Isaac","Jake","Leo","Louis","Marcus","Noah","Oscar","Rory","Sonny","Tyler","Will","Zach","Ellis","Jacob"],
        ["Ashworth","Barlow","Carver","Dawson","Ellison","Fletcher","Garside","Hargreaves","Ingram","Jenner","Kitson","Lomax","Marsh","Norris","Oakley","Pickering","Quayle","Rowntree","Shaw","Tindall","Upton","Varley","Whitfield","Yates","Brook","Cartwright","Denton","Holloway","Pryce","Sheard","Bancroft","Cooke","Dyson","Fairclough","Gosling","Hesketh","Kendrick","Lindley","Moss","Ogden","Pell","Rigby","Stott","Thwaite","Walsh","Whittaker","Atherton","Bellamy","Birtles","Bramwell","Calloway","Catterall","Dunmore","Eastwood","Fenwick","Greenhalgh","Haworth","Hollins","Kershaw","Lambton","Lister","Mayall","Nuttall","Openshaw","Platt","Ramsden","Royle","Scholfield","Settle","Speight","Starkey","Sutcliffe","Tattersall","Thorley","Trickett","Wadsworth","Walmsley","Warburton","Weatherall","Wilde","Woodhead","Worsley","Brierley","Crossley","Duckworth","Entwistle","Hulme","Mottram","Pilling","Ratcliffe","Abbott","Adams","Allen","Armstrong","Atkinson","Bailey","Baker","Ball","Barker","Barnes","Barrett","Bates","Baxter","Bell","Bennett","Berry","Bird","Bishop","Blake","Booth","Bradley","Brennan","Briggs","Brooks","Burgess","Burton","Butler","Chambers","Chapman","Clarke","Coleman","Collins","Cooper","Cox","Crawford","Cross","Curtis","Davies","Day","Dixon","Doyle","Duncan","Edwards","Elliott","Ellis","Evans","Farrell","Field","Finch","Fisher","Foster","Fowler","Fox","Francis","Fraser","Freeman","Fuller","Gardner","Gibbs","Gibson","Gilbert","Goodwin","Gordon","Graham","Grant","Gray","Green","Griffiths","Hall","Hamilton","Hancock","Harding","Harper","Harris","Hart","Harvey","Hawkins","Hayes","Henderson","Hill","Hodgson","Holland","Holmes","Hopkins","Howard","Hudson","Hughes","Hunt","Hunter","Jackson","James","Jarvis","Jennings","Johnson","Jones","Kay","Kelly","Kemp","Kennedy","King","Knight","Lane","Lawrence","Lawson","Lee","Lewis","Lloyd","Lowe","Lucas","Lynch","Mann","Marshall","Mason","Matthews","May","McCarthy","McDonald","Mills","Mitchell","Moore","Morgan","Morris","Murphy","Murray","Nash","Newman","Nicholls","Nolan","Owen","Page","Palmer","Parker","Parsons","Payne","Pearce","Pearson","Perry","Phillips","Porter","Powell","Price","Quinn","Reed","Reid","Reynolds","Rhodes","Richards","Richardson","Riley","Roberts","Robinson","Rogers","Rose","Ross","Russell","Ryan","Sanders","Saunders","Scott","Sharp","Simpson","Slater","Spencer","Stevens","Stewart","Stone","Sullivan","Sutton","Taylor","Thomas","Thompson","Thornton","Todd","Tucker","Turner","Walker","Wallace","Ward","Warren","Watson","Watts","Webb","Wells","West","Wheeler","White","Wilkinson","Williams","Willis","Wood","Woods","Wright","Young","Bassett","Blackwood","Bowden","Brannigan","Carlisle","Chadwick","Coates","Corbett","Cutler","Dempsey","Doherty","Draper","Eccles","Farnworth","Gallagher","Garnett","Hadley","Halliwell","Hammond","Haynes","Hendry","Horrocks","Jowett","Keane","Kirkby","Lacey","Maguire","Marlow","Mellor","Molyneux","Nicholson","Pemberton","Penrose","Prescott","Rafferty","Redfern","Rooke","Shepherd","Snell","Stanway","Tolley","Trelawny","Underwood","Vaughan","Wainwright","Whelan","Winstanley","Yardley","Adeyemi","Mensah","Okafor","Boateng","Campbell","Asante","Okoro","Adebayo","Nwosu","Osei","Owusu","Danso","Amankwah","Ogunleye","Bakare","Afolabi","Achebe","Opoku","Daley","McKenzie","Forbes","Lindo","Beckford","Samuels","Khan","Patel","Hussain","Ali","Ahmed","Rahman","Choudhury","Malik","Iqbal","Shah","Begum","Mistry","Sandhu","Gill","Dhillon","Bains"]],
  ESP: [["Álvaro","Iker","Pablo","Sergio","Javier","Adrián","Mario","Hugo","Diego","Rubén","Marcos","Óscar","Raúl","Unai","Aitor","Carlos","Dani","Jorge","Nacho","Gonzalo","Íñigo","Pau","Asier","Rodrigo","Borja","Fran","Iván","Jon","Mikel","Víctor","Samu","Héctor","Álex","Ander"],
        ["Arrieta","Bermejo","Cabrera","Delgado","Echeverría","Fuentes","Galindo","Herrero","Ibarra","Jiménez","Lozano","Méndez","Navas","Olmedo","Pizarro","Quesada","Robles","Saavedra","Tejada","Urrutia","Vidal","Zamora","Montero","Carrasco","Salcedo","Aranda","Beltrán","Castaño","Domingo","Espinosa","Ferrer","Gallego","Hurtado","Iglesias","Lorente","Marín","Nieto","Ortega","Prieto","Rivas","Soler"]],
  GER: [["Lukas","Jonas","Leon","Finn","Felix","Niklas","Tim","Jannik","Moritz","Maximilian","Paul","Julian","Tobias","Florian","Kevin","Marco","Lennart","Philipp","Sebastian","Dominik","Kai","Benedikt","Malte","Elias","Noah","Luis","Jan","Fabian","Marvin","Robin","Till","Henrik","Nils"],
        ["Achterberg","Brenner","Dietrich","Eckert","Fiedler","Görtz","Hartmann","Jäger","Kessler","Lindner","Möller","Neuhaus","Oswald","Pfeiffer","Reinhold","Seidel","Thalberg","Urban","Vogt","Wendt","Zimmer","Krause","Brandt","Kühne","Albrecht","Baumann","Engel","Frank","Graf","Haas","Kraus","Lorenz","Martens","Nowak","Otto","Probst","Roth","Schulte","Thiele","Winkler"]],
  ITA: [["Lorenzo","Matteo","Alessandro","Davide","Federico","Riccardo","Simone","Andrea","Gabriele","Tommaso","Nicolò","Francesco","Luca","Stefano","Giacomo","Pietro","Daniele","Emanuele","Filippo","Marco","Edoardo","Mattia","Leonardo","Samuele","Alberto","Christian","Michele","Antonio","Giorgio","Salvatore"],
        ["Bellucci","Caruso","De Santis","Esposito","Ferrara","Galli","Lombardi","Mancuso","Negri","Orlando","Pellegrini","Rinaldi","Sartori","Testa","Valente","Zanella","Marchetti","Colombo","Fontana","Moretti","Barbieri","Greco","Leone","Serra","Amato","Benedetti","Conti","D'Angelo","Farina","Gentile","Longo","Mariani","Palumbo","Ricci","Rossetti","Sala","Silvestri","Vitale","Ferri","Bruno"]],
  POR: [["João","Rúben","Tiago","Diogo","Gonçalo","Rafael","André","Nuno","Vitor","Rui","Pedro","Henrique","Miguel","Bernardo","Francisco","Hugo","Luís","Martim","Sérgio","Fábio","Bruno","Ricardo","Daniel"],["Almeida","Batista","Cardoso","Duarte","Fonseca","Gomes","Lopes","Macedo","Neves","Pinto","Quintela","Ramos","Simões","Teixeira","Correia","Antunes","Barros","Coelho","Esteves","Faria","Godinho","Leal","Marques","Nogueira","Pacheco","Rocha","Sequeira","Tavares","Vieira"]],
  FRA: [["Théo","Lucas","Hugo","Maxime","Antoine","Mathis","Enzo","Yanis","Clément","Bastien","Romain","Nolan","Rayan","Moussa","Adrien","Baptiste","Florian","Jules","Kylian","Louis","Matteo","Nathan","Quentin","Thomas","Valentin"],["Aubert","Benoît","Chevalier","Delorme","Fabre","Garnier","Lacroix","Marchand","Perrin","Roussel","Tessier","Vasseur","Fournier","Diallo","Camara","Bertin","Blanchard","Collin","Dumas","Fleury","Gauthier","Leroy","Masson","Morel","Navarro","Picard","Renaud","Robin","Schmitt","Vidal","Lemoine"]],
  NED: [["Daan","Sem","Thijs","Lars","Jesse","Bram","Ruben","Stijn","Joris","Niels","Wout","Tijn","Milan","Jens","Luuk","Thomas","Bas","Koen","Rick","Mats","Jasper","Teun","Sven","Gijs"],["Bakker","Visser","Smit","Mulder","de Graaf","van Dam","Kuipers","Veenstra","Hoekstra","Brouwer","Dekker","van Rijn","Jansen","Kok","Boer","de Jong","Hendriks","Koster","Maas","Peters","Postma","Schouten","van Leeuwen","Verhoeven","Vos","de Wit","Bosman","Meijer"]],
  BEL: [["Arne","Wout","Jelle","Simon","Thibault","Maxime","Lander","Senne","Cédric","Robin","Dries","Brecht","Jonas","Kobe","Matthias","Ruben","Thomas","Victor","Bart","Joren","Lucas","Seppe"],["Peeters","Janssens","Maes","Claes","Wouters","Goossens","Dubois","Lambert","Mertens","Willems","Leclercq","Vermeulen","De Smet","Aerts","Bogaerts","Coppens","Desmet","Hermans","Jacobs","Michiels","Pauwels","Smets","Van Damme","Verstraeten","Wuyts"]],
  BRA: [["Gabriel","Lucas","Mateus","Rafael","Thiago","Felipe","Bruno","Caio","Igor","Renan","Wesley","Danilo","Éverton","Rodrigo","Luan","Vinícius","Arthur","Guilherme","Leandro","Marcelo","Paulo","Samuel","Vitor"],["Silva","Souza","Oliveira","Pereira","Costa","Ribeiro","Martins","Carvalho","Araújo","Barbosa","Moraes","Nascimento","Moreira","Cardoso","Almeida","Batista","Campos","Dias","Fernandes","Lima","Monteiro","Rocha","Teixeira","Vieira"]],
  ARG: [["Santiago","Matías","Nicolás","Facundo","Joaquín","Tomás","Agustín","Franco","Gonzalo","Emiliano","Leandro","Ezequiel","Valentín","Lautaro","Bautista","Ignacio","Julián","Lucas","Mauro","Rodrigo","Thiago"],["Acosta","Benítez","Coronel","Domínguez","Escobar","Ferreyra","Godoy","Herrera","Ledesma","Medina","Ojeda","Paredes","Quiroga","Sosa","Vera","Aguirre","Bustos","Cabral","Funes","Giménez","Luna","Molina","Navarro","Peralta","Rojas"]],
  WAF: [["Kwame","Kofi","Yaw","Emmanuel","Ibrahim","Samuel","Abdul","Moses","Daniel","Joseph","Isaac","Osman","Chidi","Tunde","Sékou"],["Mensah","Asante","Boateng","Owusu","Adebayo","Okafor","Eze","Nwosu","Traoré","Koné","Diarra","Bamba","Sarpong","Appiah","Ogunleye"]],
  SCA: [["Erik","Magnus","Oscar","Emil","Sander","Mathias","Viktor","Henrik","Anders","Jonas","Sindre","Elias","Rasmus"],["Andersen","Berg","Dahl","Ekström","Haugen","Lund","Nyberg","Sørensen","Strand","Vik","Holm","Lindgren","Aas","Bakke"]],
  COL: [["Juan","Andrés","Camilo","Sebastián","Felipe","Jhon","Diego","Yerson","Cristian","Daniel","Mateo","Santiago","Kevin","Brayan","Óscar","Jefferson","Luis","Wilmar","Esteban","Sergio"],["Rentería","Mosquera","Valencia","Mena","Arboleda","Murillo","Palacios","Quintero","Cardona","Zapata","Restrepo","Ortega","Borja","Castaño","Ríos","Lozano","Hurtado","Salazar","Giraldo","Montoya"]],
  URU: [["Federico","Facundo","Rodrigo","Nicolás","Maximiliano","Gastón","Agustín","Mathías","Diego","Martín","Bruno","Gonzalo","Sebastián","Ignacio","Jonathan","Matías","Santiago","Joaquín"],["Pereyra","Olivera","Ferreiro","Viera","Laborde","Rodríguez","Machado","Sosa","Techera","Cabrera","Acuña","Bentos","Silvera","Píriz","Correa","Lemos","Núñez","Varela"]],
  NGA: [["Chukwuemeka","Oluwaseun","Emeka","Victor","Samuel","Ademola","Kelechi","Chidera","Tobi","Ifeanyi","Babatunde","Uche","Femi","Wilfred","Calvin","Ebuka","Taiwo","Kenneth"],["Okonkwo","Adeyemi","Nwankwo","Olaniyan","Eze","Onwuachi","Balogun","Ogbonna","Afolabi","Okoye","Ihejirika","Akinwale","Oduya","Chukwu","Nwachukwu","Obi","Adekunle","Uzor"]],
  SEN: [["Moussa","Cheikh","Ibou","Pape","Mamadou","Ibrahima","Abdou","Saliou","Babacar","Lamine","Ousmane","Idrissa","Khadim","Habib","Bamba","Alioune","Modou","Assane"],["Ndiaye","Diop","Sarr","Fall","Gueye","Seck","Faye","Mbaye","Ciss","Diatta","Niang","Sow","Kouyaté","Thiam","Camara","Dieng","Badji","Mendy"]],
  CIV: [["Yao","Serge","Wilfried","Franck","Aristide","Christian","Simon","Désiré","Ghislain","Hamed","Jérémie","Karim","Arsène","Willy","Evann","Oumar","Lassina","Sébastien"],["Kouassi","Koffi","Yapi","Konan","Guié","Aké","Kouamé","Bléhi","Zoro","Brou","Doumbia","Tia","Kipré","Gnahoré","Ouattara","Coulibaly","Goré","Bakayoko"]],
  DEN: [["Mikkel","Rasmus","Kasper","Frederik","Mads","Jesper","Christian","Jonas","Andreas","Victor","Oliver","Mathias","Jakob","Simon","Nikolaj","Tobias","Gustav","Emil"],["Nielsen","Jørgensen","Kristensen","Poulsen","Rasmussen","Pedersen","Christensen","Madsen","Thomsen","Dalsgaard","Høeg","Skov","Lauridsen","Kjeldsen","Bech","Vestergaard","Mortensen","Dahl"]],
  CRO: [["Luka","Ivan","Marko","Josip","Mateo","Ante","Dario","Nikola","Domagoj","Mario","Borna","Lovro","Duje","Martin","Petar","Filip","Toni","Šime"],["Horvat","Kovač","Babić","Marić","Jurić","Novak","Knežević","Vuković","Petković","Pavlović","Perić","Bošnjak","Šarić","Grgić","Matić","Sušić","Ercegović","Barišić"]],
  SRB: [["Nemanja","Aleksandar","Dušan","Stefan","Miloš","Sergej","Filip","Lazar","Uroš","Strahinja","Vanja","Dejan","Nikola","Andrija","Veljko","Đorđe","Saša","Luka"],["Jovanović","Petrović","Nikolić","Marković","Đorđević","Stojanović","Ilić","Stanković","Pavlović","Milošević","Lukić","Živković","Glišić","Radić","Babić","Milić","Todorović","Vasić"]],
  USA: [["Tyler","Brandon","Cody","Chase","Logan","Zach","Garrett","Austin","Cole","Jalen","Hunter","Dylan","Brody","Caleb","Marcus","Trent","Weston","Drew"],["Miller","Johnson","Carter","Reynolds","Brooks","Sullivan","Hayes","Walker","Bennett","Coleman","Parker","Murphy","Hughes","Russell","Foster","Griffin","Morales","Tillman"]],
  JPN: [["Haruto","Takumi","Daichi","Kaito","Ritsu","Shota","Yuto","Sota","Kenta","Hiroki","Ren","Riku","Takeru","Kazuki","Junya","Ao","Daisuke","Kou"],["Tanaka","Suzuki","Takahashi","Watanabe","Nakamura","Kobayashi","Yamamoto","Inoue","Kimura","Hayashi","Shimizu","Endo","Morita","Ishikawa","Matsuda","Ueno","Hattori","Sano"]],
  KOR: [["Min-jun","Hyun-jun","Jae-hyun","Seung-woo","Ji-ho","Jae-won","Seo-jun","Jun-ho","Hyun-woo","Ji-sung","Tae-hwan","Dong-gyeong","Tae-yang","Sung-min","Joon-young","Jin-su","Sang-ho","Do-hyun"],["Kim","Lee","Park","Jeong","Choi","Cho","Kang","Yoon","Jang","Lim","Han","Oh","Seo","Shin","Kwon","Hwang","Ahn","Song"]],
  TUR: [["Emre","Burak","Mert","Kerem","Arda","Cenk","Hakan","Oğuz","Ozan","Yusuf","Berkay","Enes","Furkan","Kaan","Selçuk","Umut","Barış","Okay"],["Yılmaz","Kaya","Demir","Şahin","Çelik","Aydın","Öztürk","Arslan","Doğan","Kılıç","Aslan","Kurt","Özdemir","Erdem","Koç","Polat","Tekin","Güler"]],
  GRE: [["Giorgos","Dimitris","Kostas","Nikos","Giannis","Vasilis","Christos","Panagiotis","Thanasis","Stelios","Lazaros","Manolis","Petros","Sotiris","Tasos","Fotis"],["Papadopoulos","Georgiou","Nikolaidis","Karagounis","Vlachos","Christodoulou","Pappas","Galanis","Mavropanos","Tzavellas","Bakasetas","Fortounis","Siopis","Kourbelis","Samaris","Douvikas"]],
  CYP: [["Andreas","Konstantinos","Marios","Charalambos","Michalis","Loizos","Pieros","Nestoras","Kyriakos","Fotis","Ioannis","Demetris"],["Charalambous","Christofi","Panayiotou","Loizou","Kyriakou","Ioannou","Sotiriou","Efrem","Kastanos","Antoniou","Pittas","Neophytou"]],
  CZE: [["Tomáš","Jakub","Ondřej","Lukáš","Petr","Jan","Matěj","Adam","Václav","Vojtěch","Pavel","Martin","Filip","David","Jiří","Michal"],["Novák","Svoboda","Dvořák","Černý","Procházka","Kučera","Veselý","Horák","Němec","Pokorný","Marek","Pospíšil","Hájek","Král","Jelínek","Růžička"]],
  POL: [["Jakub","Kacper","Mateusz","Bartosz","Michał","Krzysztof","Piotr","Kamil","Łukasz","Szymon","Dawid","Przemysław","Tomasz","Wojciech","Patryk","Damian"],["Nowak","Kowalski","Wiśniewski","Wójcik","Kowalczyk","Kamiński","Lewandowski","Zieliński","Szymański","Woźniak","Dąbrowski","Kozłowski","Jankowski","Mazur","Krawczyk","Piątek"]],
  SUI: [["Luca","Nico","Fabian","Silvan","Yannick","Remo","Cédric","Gian","Dario","Noah","Joël","Kevin","Loris","Ricardo","Michel","Ruben"],["Müller","Meier","Schmid","Keller","Weber","Huber","Gerber","Frei","Steiner","Brunner","Baumgartner","Zbinden","Rochat","Favre","Bühler","Moser"]],
  AUT: [["Florian","Stefan","Christoph","Lukas","Matthias","Marcel","Philipp","Konrad","Andreas","Patrick","Valentin","Raphael","Dominik","Sascha","Thomas","Maximilian"],["Gruber","Huber","Bauer","Wagner","Pichler","Steiner","Moser","Mayer","Hofer","Leitner","Berger","Fuchs","Eder","Fischer","Schwarz","Winkler"]],
  HUN: [["Dániel","Bence","Ádám","Máté","Balázs","Dominik","Gergő","Zsolt","Roland","Attila","Péter","Krisztián","Levente","Barnabás","Milos","Tamás"],["Nagy","Kovács","Tóth","Szabó","Horváth","Varga","Kiss","Molnár","Németh","Farkas","Balogh","Papp","Takács","Juhász","Lakatos","Szalai"]],
  SWE: [["Oscar","William","Hugo","Lucas","Alexander","Isak","Viktor","Filip","Gustav","Albin","Linus","Anton","Ludvig","Simon","Jesper","Hampus"],["Johansson","Andersson","Karlsson","Nilsson","Eriksson","Larsson","Olsson","Persson","Svensson","Gustafsson","Lindqvist","Bergström","Lundgren","Sjöberg","Forsberg","Ekdal"]],
  SCO: [["Callum","Ross","Kyle","Scott","Lewis","Craig","Ryan","Fraser","Euan","Calum","Andrew","Kenny","Stuart","Gregor","Lyndon","Ewan","Murray","Kieran"],["MacDonald","Campbell","Stewart","Robertson","Thomson","Anderson","Murray","Fraser","McLean","Ferguson","McKenna","Kerr","Gilmour","McTominay","Hendry","Ralston","Paterson","Shankland"]],
  ROU: [["Andrei","Alexandru","Ionuț","Florin","Răzvan","Bogdan","Cristian","Mihai","Vlad","Denis","Darius","Nicolae","Valentin","Ianis","Adrian","Ștefan"],["Popescu","Ionescu","Stan","Dumitru","Stoica","Gheorghe","Rusu","Munteanu","Matei","Constantin","Marin","Radu","Mihăilă","Drăguș","Coman","Hagi"]],
  UKR: [["Oleksandr","Andriy","Mykola","Serhiy","Yevhen","Taras","Viktor","Artem","Bohdan","Danylo","Ruslan","Vitaliy","Illia","Maksym","Roman","Yaroslav"],["Shevchenko","Kovalenko","Bondarenko","Tkachenko","Kravchenko","Melnyk","Boyko","Moroz","Lysenko","Marchenko","Rudenko","Savchenko","Petrenko","Zinchenko","Mudryk","Tsyhankov"]],
};
const ALL_NATS = Object.keys(NAMES);
// A foreign player's nationality: the eight league countries count fully, the rest of the world by ABROAD's weights,
// so fifteen new countries don't crowd out Spain or Germany.
const NAT_W_EXTRA = { TUR: .5, GRE: .3, CYP: .1, CZE: .3, POL: .4, SUI: .3, AUT: .3, HUN: .2, SWE: .4, SCO: .5, ROU: .3, UKR: .3 };  // the smaller leagues' countries, by the same weights
const NAT_W = Object.fromEntries(ALL_NATS.map(n => [n, NAT_W_EXTRA[n] ?? (ABROAD.find(a => a[0] === n) || [0, 0, 0, 0, 1])[4]]));
function pickNat(not) { const ns = ALL_NATS.filter(n => n !== not), t = ns.reduce((s, n) => s + NAT_W[n], 0); let r = R() * t; for (const n of ns) { r -= NAT_W[n]; if (r <= 0) return n; } return ns[ns.length - 1]; }
const CLUB_COLORS = ["#1f4fc4","#b42323","#0d7268","#6d3fd0","#0a6aa0","#3b4a5e","#c2410c","#2f7d32","#9a6408","#b3195c","#1f2937","#7c2d12","#0e7490","#4d7c0f","#a21caf","#be123c","#1e3a8a","#065f46","#854d0e","#5b21b6","#0f766e","#9f1239"];
