'use strict';
// Item passives (round 5): rolled on unique / heroic items, hand-picked on legendaries.
// Every passive is implemented in turn-based combat (server/battle.js) and described on the item card.
// v ranges: [unique, heroic]; legendary items carry fixed values.
const PX = {
  ls: { n: 'Wampiryzm', d: '{v}% zadanych obrażeń przywraca życie', u: [3, 5], h: [6, 9], cap: 30 },
  stun: { n: 'Ogłuszenie', d: '{v}% szans na ogłuszenie celu przy trafieniu', u: [4, 6], h: [7, 10], cap: 30 },
  thorns: { n: 'Ciernie', d: '{v}% otrzymanych obrażeń wraca do atakującego', u: [8, 12], h: [14, 20], cap: 60 },
  xturn: { n: 'Pośpiech', d: '{v}% szans na dodatkowy atak w turze', u: [4, 6], h: [7, 10], cap: 30 },
  critd: { n: 'Okrucieństwo', d: '+{v}% obrażeń krytycznych', u: [15, 25], h: [30, 45], cap: 150 },
  regen: { n: 'Źródło', d: '+{v} many / energii co turę', u: [3, 5], h: [6, 9], cap: 30 },
  boss: { n: 'Pogromca', d: '+{v}% obrażeń przeciw bossom i elitom', u: [8, 12], h: [14, 20], cap: 60 },
  poison: { n: 'Trucizna', d: '{v}% szans na zatrucie celu (3 tury, 15% ataku na turę)', u: [10, 15], h: [18, 25], cap: 60 },
  shield: { n: 'Bariera', d: 'na start walki tarcza pochłaniająca {v} obrażeń', u: [2, 3], h: [4, 5], lvl: true, cap: 9999 },
  hregen: { n: 'Odnowa', d: '+{v}% maks. życia co turę', u: [1, 2], h: [2, 3], cap: 8 },
  exec: { n: 'Egzekucja', d: '+{v}% obrażeń przeciw wrogom poniżej 30% życia', u: [15, 25], h: [30, 40], cap: 120 },
  block: { n: 'Blok', d: '{v}% szans na zablokowanie połowy obrażeń', u: [6, 9], h: [10, 14], cap: 40 },
  first: { n: 'Inicjatywa', d: '+{v}% obrażeń w pierwszej rundzie walki', u: [30, 50], h: [60, 90], cap: 200 },
  // legendary-only
  phoenix: { n: 'Feniks', d: 'raz na walkę powstajesz z {v}% życia po śmierci', leg: 1, cap: 60 },
  chain: { n: 'Łańcuch', d: '{v}% szans, że atak trafi także drugiego wroga (60%)', leg: 1, cap: 80 },
  echo: { n: 'Echo mocy', d: '{v}% szans, że umiejętność nie zużyje many / energii', leg: 1, cap: 60 },
  frost: { n: 'Lodowy dotyk', d: '{v}% szans na zamrożenie celu (nie działa na bossy)', leg: 1, cap: 40 },
  soul: { n: 'Żniwiarz dusz', d: 'zabicie wroga przywraca {v}% życia', leg: 1, cap: 60 },
  berserk: { n: 'Szał', d: '+1% obrażeń za każde 2% brakującego życia (maks. +{v}%)', leg: 1, cap: 80 },
  mirror: { n: 'Lustro', d: '{v}% szans na odbicie całego ciosu w atakującego', leg: 1, cap: 25 },
};
const ROLL = Object.keys(PX).filter((k) => !PX[k].leg);
// hand-designed legendaries: base (stat profile + icon from items.js BASES), level, passives, lore
const LEG = [
  { id: 'grzmot', n: 'Grzmot Przodków', b: 'hammer', l: 12, px: [['stun', 15], ['xturn', 8]], lore: 'Młot pierwszego wodza Osady. Ziemia drży, gdy uderza.' },
  { id: 'krwiop', n: 'Krwiopijca', b: 'axe', l: 22, px: [['ls', 12], ['berserk', 50]], lore: 'Im bliżej śmierci jego właściciel, tym bardziej topór łaknie krwi.' },
  { id: 'switu', n: 'Ostrze Świtu', b: 'sword', l: 40, px: [['critd', 60], ['chain', 35]], lore: 'Wykute w Cytadeli z pierwszego promienia słońca.' },
  { id: 'gniewig', n: 'Gniew Ignara', b: 'hammer', l: 48, px: [['boss', 30], ['stun', 12], ['first', 80]], lore: 'Płonie od środka. Nigdy nie stygnie.' },
  { id: 'egida', n: 'Egida Wieczności', b: 'shield', l: 30, px: [['block', 20], ['shield', 6], ['thorns', 25]], lore: 'Tarcza, o którą rozbiło się sto armii.' },
  { id: 'feniksz', n: 'Zbroja Feniksa', b: 'plate', l: 45, px: [['phoenix', 30], ['hregen', 3]], lore: 'Popiół w jej szwach wciąż się żarzy.' },
  { id: 'tytan', n: 'Korona Tytana', b: 'greathelm', l: 55, px: [['mirror', 8], ['hregen', 3], ['thorns', 20]], lore: 'Należała do strażnika, który nie upadł nigdy.' },
  { id: 'kastety', n: 'Kastety Burzy', b: 'gaunt', l: 35, px: [['xturn', 12], ['critd', 40]], lore: 'Każdy cios brzmi jak grom.' },
  { id: 'szept', n: 'Szept Wiatru', b: 'bow', l: 14, px: [['xturn', 10], ['first', 60]], lore: 'Strzała pada, zanim usłyszysz cięciwę.' },
  { id: 'zadlo', n: 'Żądło Królowej', b: 'xbow', l: 26, px: [['poison', 30], ['exec', 35]], lore: 'Bełty maczane w jadzie skorpiona-matki.' },
  { id: 'lewiat', n: 'Łuk Lewiatana', b: 'lbow', l: 36, px: [['chain', 40], ['critd', 50]], lore: 'Cięciwa z wąsa morskiego potwora.' },
  { id: 'gwiazda', n: 'Gwiazda Zaranna', b: 'rbow', l: 52, px: [['exec', 50], ['echo', 30]], lore: 'Świeci jaśniej z każdym upadłym wrogiem.' },
  { id: 'cien', n: 'Płaszcz Cienia', b: 'cloak', l: 30, px: [['mirror', 10], ['xturn', 6]], lore: 'Tkany z mroku Otchłani.' },
  { id: 'nieskon', n: 'Kołczan Nieskończoności', b: 'quiver', l: 42, px: [['echo', 35], ['regen', 8]], lore: 'Nikt nie widział jego dna.' },
  { id: 'lowca', n: 'Maska Łowcy', b: 'mask', l: 20, px: [['critd', 45], ['boss', 25]], lore: 'Widzi słabe miejsce każdej bestii.' },
  { id: 'wiatr', n: 'Buty Wiatru', b: 'sboot', l: 47, px: [['xturn', 12], ['block', 10]], lore: 'Stąpają szybciej niż myśl.' },
  { id: 'mgiel', n: 'Kostur Mgieł', b: 'staff', l: 12, px: [['frost', 12], ['regen', 6]], lore: 'Zrodzony z mgły, która zeszła z gór.' },
  { id: 'ksiega', n: 'Księga Sethara', b: 'tome', l: 26, px: [['soul', 15], ['echo', 30]], lore: 'Strony szepczą imiona umarłych.' },
  { id: 'berlo', n: 'Berło Otchłani', b: 'scepter', l: 56, px: [['chain', 45], ['ls', 10], ['critd', 40]], lore: 'Morgath trzymał je przez tysiąc lat.' },
  { id: 'rozdzf', n: 'Różdżka Feniksa', b: 'wand', l: 38, px: [['phoenix', 30], ['first', 80]], lore: 'Pióro feniksa zamknięte w krysztale.' },
  { id: 'arcym', n: 'Szata Arcymaga', b: 'robe', l: 44, px: [['shield', 7], ['regen', 10]], lore: 'Haftowana runami ochrony.' },
  { id: 'diadem', n: 'Diadem Gwiazd', b: 'circlet', l: 34, px: [['echo', 25], ['frost', 10]], lore: 'Gwiazdy krążą wokół czoła noszącego.' },
  { id: 'kulaw', n: 'Kula Wieczności', b: 'orb', l: 50, px: [['soul', 20], ['boss', 30]], lore: 'W jej wnętrzu wiruje cała historia Ardanu.' },
  { id: 'mitenki', n: 'Mitenki Zaklinacza', b: 'mitt', l: 22, px: [['critd', 40], ['regen', 5]], lore: 'Palce same układają się w znaki mocy.' },
  { id: 'wampir', n: 'Pierścień Wampira', b: 'ring', l: 18, px: [['ls', 10], ['soul', 10]], lore: 'Zimny w dotyku, ciepły od cudzej krwi.' },
  { id: 'sygnet', n: 'Sygnet Króla Cieni', b: 'signet', l: 28, px: [['berserk', 50], ['boss', 20]], lore: 'Pieczęć Sethara. Wciąż pamięta swojego pana.' },
  { id: 'okolew', n: 'Oko Lewiatana', b: 'amulet', l: 36, px: [['mirror', 8], ['block', 12]], lore: 'Mruga, gdy nadchodzi cios.' },
  { id: 'serceo', n: 'Serce Otchłani', b: 'medal', l: 58, px: [['phoenix', 40], ['hregen', 3], ['xturn', 8]], lore: 'Bije w rytmie, którego nie zna żaden człowiek.' },
  { id: 'midas', n: 'Obrączka Midasa', b: 'band', l: 42, px: [['stun', 12], ['thorns', 30]], lore: 'Złoto, które odpłaca ciosem za cios.' },
  { id: 'talizm', n: 'Talizman Szczęścia', b: 'talisman', l: 10, px: [['critd', 35], ['first', 50]], lore: 'Czterolistna koniczyna zatopiona w bursztynie.' },
];
const pxText = (k, v) => { const P = PX[k]; if (!P) return ''; return P.n + ': ' + P.d.replace('{v}', String(v)); };
module.exports = { PX, ROLL, LEG, pxText };
