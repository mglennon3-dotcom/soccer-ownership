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
const NAT_NAME = { ENG: "England", ESP: "Spain", GER: "Germany", ITA: "Italy", POR: "Portugal", FRA: "France", NED: "Netherlands", BEL: "Belgium", BRA: "Brazil", ARG: "Argentina", WAF: "Ghana", SCA: "Norway", COL: "Colombia", URU: "Uruguay", NGA: "Nigeria", SEN: "Senegal", CIV: "Ivory Coast", DEN: "Denmark", CRO: "Croatia", SRB: "Serbia", USA: "United States", JPN: "Japan", KOR: "South Korea" };
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
};
const ALL_NATS = Object.keys(NAMES);
// A foreign player's nationality: the eight league countries count fully, the rest of the world by ABROAD's weights,
// so fifteen new countries don't crowd out Spain or Germany.
const NAT_W = Object.fromEntries(ALL_NATS.map(n => [n, (ABROAD.find(a => a[0] === n) || [0, 0, 0, 0, 1])[4]]));
function pickNat(not) { const ns = ALL_NATS.filter(n => n !== not), t = ns.reduce((s, n) => s + NAT_W[n], 0); let r = R() * t; for (const n of ns) { r -= NAT_W[n]; if (r <= 0) return n; } return ns[ns.length - 1]; }
const CLUB_COLORS = ["#1f4fc4","#b42323","#0d7268","#6d3fd0","#0a6aa0","#3b4a5e","#c2410c","#2f7d32","#9a6408","#b3195c","#1f2937","#7c2d12","#0e7490","#4d7c0f","#a21caf","#be123c","#1e3a8a","#065f46","#854d0e","#5b21b6","#0f766e","#9f1239"];
