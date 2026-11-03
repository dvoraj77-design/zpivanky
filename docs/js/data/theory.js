// Hudební nauka pro úplné laiky: krátké stránky s ukázkami k poslechu, klaviaturou, rytmem a kvízem.
// Bloky: p (odstavec, **tučně**), tip, play (noty [midi, začátek, délka] v dobách), rhythm (vzor [začátek, délka] v dobách),
// keys (klaviatura od–do se zvýrazněním), roll (ukázka válce not), quiz (otázka, možnosti, správná odpověď, volitelně play).

const C4 = 60;
const scale = (root, steps = [0, 2, 4, 5, 7, 9, 11, 12]) => steps.map((s, i) => [root + s, i, 0.9]);

export const THEORY = [
  {
    id: 't1', n: 1, title: 'Zvuk a tón', icon: '🔔', intro: 'Co je tón a jaké má vlastnosti.',
    lessons: [
      { id: 't1l1', title: 'Co je tón', blocks: [
        { t: 'p', text: 'Každý zvuk vzniká **chvěním** – chvěje se struna, blána bubnu nebo tvoje **hlasivky** v krku. Chvění rozkmitá vzduch a ten dorazí do ucha.' },
        { t: 'p', text: 'Když je chvění **pravidelné**, slyšíme **tón** (klavír, zpěv, píšťalka). Když je nepravidelné, slyšíme **šum** (vítr, „sss“, šustění papíru).' },
        { t: 'play', label: 'Tón (klavír)', notes: [[C4, 0, 2]], inst: 'piano' },
        { t: 'play', label: 'Tón (hlas „ú“)', notes: [[C4, 0, 2]], inst: 'guide' },
        { t: 'tip', text: 'Zpěv je tón, který vyrábíš sám: vzduch z plic rozkmitá hlasivky a ústa tón „vytvarují“.' },
        { t: 'quiz', q: 'Co slyšíme, když se něco chvěje pravidelně?', options: ['Šum', 'Tón', 'Ticho'], answer: 1 },
      ] },
      { id: 't1l2', title: 'Čtyři vlastnosti tónu', blocks: [
        { t: 'p', text: 'Každý tón má čtyři vlastnosti: **výšku** (vysoko × nízko), **sílu** (potichu × nahlas), **délku** (krátce × dlouho) a **barvu** (čím zní – klavír, hlas, flétna).' },
        { t: 'play', label: 'Výška: nízký → vysoký', notes: [[48, 0, 1.2], [72, 1.5, 1.2]], inst: 'piano' },
        { t: 'play', label: 'Síla: potichu → nahlas', notes: [[C4, 0, 1.2, 0.25], [C4, 1.5, 1.2, 1]], inst: 'piano' },
        { t: 'play', label: 'Délka: krátce → dlouho', notes: [[C4, 0, 0.3], [C4, 1, 2.5]], inst: 'guide' },
        { t: 'play', label: 'Barva: klavír → hlas', notes: [[C4, 0, 1.4]], inst: 'piano', then: { notes: [[C4, 1.8, 1.6]], inst: 'guide' } },
        { t: 'tip', text: 'Při zpěvu ovládáš všechny čtyři: výšku hlasivkami, sílu dechem, délku dechem a barvu tvarem úst.' },
        { t: 'quiz', q: 'Která vlastnost říká, jestli tón zní „nahoře“, nebo „dole“?', options: ['Síla', 'Barva', 'Výška', 'Délka'], answer: 2 },
        { t: 'quiz', q: 'Poslechni si dva tóny. Čím se liší?', play: { notes: [[64, 0, 1.2, 0.3], [64, 1.5, 1.2, 1]], inst: 'piano' }, options: ['Výškou', 'Silou', 'Barvou'], answer: 1 },
      ] },
    ],
  },
  {
    id: 't2', n: 2, title: 'Výška tónu', icon: '📏', intro: 'Vysoko, nízko, oktáva a rozsah hlasu.',
    lessons: [
      { id: 't2l1', title: 'Vysoko a nízko', blocks: [
        { t: 'p', text: 'Čím **rychleji** se něco chvěje, tím je tón **vyšší**. Rychlost se měří v **hertzech (Hz)** – kolikrát za sekundu se chvěje. Tón A, podle kterého se ladí, má 440 Hz.' },
        { t: 'p', text: 'Mužský hlas mluví zhruba kolem 100–130 Hz, ženský kolem 180–250 Hz. Proto ženy a děti zní „výš“.' },
        { t: 'play', label: 'Postupně výš a výš', notes: [[48, 0, 0.8], [55, 1, 0.8], [60, 2, 0.8], [67, 3, 0.8], [72, 4, 1.2]], inst: 'piano' },
        { t: 'quiz', q: 'Který tón je vyšší – první, nebo druhý?', play: { notes: [[62, 0, 1], [57, 1.3, 1]], inst: 'piano' }, options: ['První', 'Druhý'], answer: 0 },
        { t: 'quiz', q: 'A teď?', play: { notes: [[55, 0, 1], [59, 1.3, 1]], inst: 'guide' }, options: ['První', 'Druhý'], answer: 1 },
      ] },
      { id: 't2l2', title: 'Oktáva a rozsah hlasu', blocks: [
        { t: 'p', text: '**Oktáva** je tón se stejným jménem, ale dvakrát rychlejším chvěním. Zní „stejně, jen výš“ – proto mohou muži a ženy zpívat stejnou píseň o oktávu od sebe.' },
        { t: 'play', label: 'C a o oktávu vyšší C', notes: [[48, 0, 1.2], [60, 1.5, 1.2], [48, 3, 1.5], [60, 3, 1.5]], inst: 'piano' },
        { t: 'p', text: '**Rozsah hlasu** je od nejnižšího po nejvyšší tón, který zazpíváš. Začátečník mívá rozsah asi 1–1,5 oktávy, trénovaný zpěvák 2 a víc. Aplikace tvůj rozsah změří v testu hlasu a písně do něj sama posune.' },
        { t: 'tip', text: 'Když zazpíváš melodii o oktávu níž nebo výš, aplikace to počítá jako správně.' },
        { t: 'quiz', q: 'Co je oktáva?', options: ['Dva různé tóny vedle sebe', 'Stejný tón výš nebo níž (dvojnásobné chvění)', 'Osm písní'], answer: 1 },
      ] },
    ],
  },
  {
    id: 't3', n: 3, title: 'Jména tónů a klaviatura', icon: '🎹', intro: 'C D E F G A H, černé klávesy, půltón.',
    lessons: [
      { id: 't3l1', title: 'Sedm jmen', blocks: [
        { t: 'p', text: 'Tóny mají jména podle písmen: **C D E F G A H**. Pak se jména opakují o oktávu výš: C D E… Na klavíru jsou to **bílé klávesy**.' },
        { t: 'keys', from: 60, to: 72, highlight: [60, 62, 64, 65, 67, 69, 71, 72], labels: true },
        { t: 'play', label: 'C D E F G A H C', notes: scale(60), inst: 'piano' },
        { t: 'p', text: 'Aby se oktávy rozlišily, píše se za jméno číslo: **C4** je „prostřední C“ na klavíru, **C3** o oktávu níž. Hluboký mužský hlas zpívá zhruba G2 až E4.' },
        { t: 'tip', text: 'V Česku se tón mezi A a H jmenuje **B** (v angličtině B♭). Anglické „B“ je u nás **H**. Aplikace používá české značení, v Nastavení jde přepnout.' },
        { t: 'quiz', q: 'Jak se jmenuje tón hned po G?', options: ['H', 'A', 'B'], answer: 1 },
      ] },
      { id: 't3l2', title: 'Půltón, celý tón a černé klávesy', blocks: [
        { t: 'p', text: '**Půltón** je nejmenší krok mezi dvěma klávesami vedle sebe (i černou). **Celý tón** jsou dva půltóny. Mezi E–F a H–C černá klávesa není, je tam jen půltón.' },
        { t: 'keys', from: 60, to: 72, highlight: [61, 63, 66, 68, 70], labels: true },
        { t: 'p', text: 'Černé klávesy mají jména od sousedních: zvýšené tóny dostanou **-is** (C → **Cis**, F → **Fis**), snížené **-es** (E → **Es**, A → **As**). Jedna klávesa tak může mít dvě jména (Cis = Des).' },
        { t: 'play', label: 'Půltón (C → Cis)', notes: [[60, 0, 1], [61, 1.2, 1.2]], inst: 'piano' },
        { t: 'play', label: 'Celý tón (C → D)', notes: [[60, 0, 1], [62, 1.2, 1.2]], inst: 'piano' },
        { t: 'tip', text: 'Ladička ukazuje odchylku v **centech**: 100 centů = 1 půltón. Odchylka do ±25 centů je pro začátečníka výborná.' },
        { t: 'quiz', q: 'Kolik půltónů má celý tón?', options: ['Jeden', 'Dva', 'Čtyři'], answer: 1 },
        { t: 'quiz', q: 'Jak se jmenuje zvýšené F?', options: ['Fes', 'Fis', 'Fa'], answer: 1 },
      ] },
    ],
  },
  {
    id: 't4', n: 4, title: 'Stupnice', icon: '🪜', intro: 'Durová a mollová stupnice, do re mi.',
    lessons: [
      { id: 't4l1', title: 'Durová stupnice a do re mi', blocks: [
        { t: 'p', text: '**Stupnice** je osm tónů jako schody, od jednoho tónu k jeho oktávě. Nejznámější je **durová** – zní vesele a jasně. Kroky jsou: celý, celý, **půl**, celý, celý, celý, **půl**.' },
        { t: 'play', label: 'Durová stupnice', notes: scale(60), inst: 'piano' },
        { t: 'p', text: 'Zpěváci tóny stupnice pojmenovávají slabikami **do re mi fa sol la ti do** (solmizace). „Do“ je vždy první tón – ať je píseň v jakékoli výšce. Tak se melodie dá zazpívat bez znalosti not.' },
        { t: 'play', label: 'do – mi – sol – do', notes: [[60, 0, 0.9], [64, 1, 0.9], [67, 2, 0.9], [72, 3, 1.5]], inst: 'guide' },
        { t: 'tip', text: 'Pracovní tónina v aplikaci určuje, kde je tvoje „do“. Cvičení se pak posouvají po půltónech nahoru a dolů.' },
        { t: 'quiz', q: 'Kolikátý tón stupnice je „sol“?', options: ['Třetí', 'Pátý', 'Osmý'], answer: 1 },
      ] },
      { id: 't4l2', title: 'Dur a moll', blocks: [
        { t: 'p', text: '**Mollová** stupnice má jiné kroky – třetí tón je o půltón níž. Zní tmavěji, smutněji, tajemněji. Píseň „Rybář“ je v moll.' },
        { t: 'play', label: 'Durová (veselá)', notes: scale(60), inst: 'piano' },
        { t: 'play', label: 'Mollová (smutnější)', notes: scale(57, [0, 2, 3, 5, 7, 8, 10, 12]), inst: 'piano' },
        { t: 'quiz', q: 'Poslechni si stupnici. Je durová, nebo mollová?', play: { notes: scale(57, [0, 2, 3, 5, 7, 8, 10, 12]), inst: 'piano' }, options: ['Durová', 'Mollová'], answer: 1 },
        { t: 'quiz', q: 'A tahle?', play: { notes: scale(62), inst: 'piano' }, options: ['Durová', 'Mollová'], answer: 0 },
      ] },
    ],
  },
  {
    id: 't5', n: 5, title: 'Intervaly', icon: '🦘', intro: 'Vzdálenost dvou tónů a jak ji slyšet.',
    lessons: [
      { id: 't5l1', title: 'Kroky a skoky', blocks: [
        { t: 'p', text: '**Interval** je vzdálenost mezi dvěma tóny. Malé vzdálenosti jsou **kroky** (sekunda), větší jsou **skoky** (tercie, kvarta, kvinta, sexta, oktáva).' },
        { t: 'play', label: 'Sekunda (krok: do–re)', notes: [[60, 0, 0.9], [62, 1, 1.2]], inst: 'piano' },
        { t: 'play', label: 'Tercie (do–mi)', notes: [[60, 0, 0.9], [64, 1, 1.2]], inst: 'piano' },
        { t: 'play', label: 'Kvinta (do–sol)', notes: [[60, 0, 0.9], [67, 1, 1.2]], inst: 'piano' },
        { t: 'play', label: 'Oktáva (do–do)', notes: [[60, 0, 0.9], [72, 1, 1.2]], inst: 'piano' },
        { t: 'tip', text: 'Interval si nejlépe zapamatuješ podle začátku známé písně: kvinta je začátek „Hvězdičko, ty maličká“, malá tercie je kukačka „ku-kuk“.' },
        { t: 'quiz', q: 'Je to krok, nebo skok?', play: { notes: [[60, 0, 0.9], [67, 1, 1.2]], inst: 'piano' }, options: ['Krok', 'Skok'], answer: 1 },
        { t: 'quiz', q: 'A tohle?', play: { notes: [[64, 0, 0.9], [62, 1, 1.2]], inst: 'piano' }, options: ['Krok', 'Skok'], answer: 0 },
      ] },
    ],
  },
  {
    id: 't6', n: 6, title: 'Rytmus a tempo', icon: '🥁', intro: 'Doba, puls, tempo a metronom.',
    lessons: [
      { id: 't6l1', title: 'Doba a puls', blocks: [
        { t: 'p', text: 'Hudba má pravidelný **puls** jako tep srdce nebo kroky při chůzi. Jeden úder pulsu je **doba**. Když posloucháš píseň a podupáváš nohou, dupeš na doby.' },
        { t: 'rhythm', label: 'Puls – 8 dob', pattern: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]], bpm: 80 },
        { t: 'p', text: '**Tempo** říká, jak rychle doby jdou, v úderech za minutu (**BPM**). 60 BPM = jedna doba za sekundu, 120 BPM = dvě. **Metronom** doby kliká, aby se dalo držet tempo.' },
        { t: 'rhythm', label: 'Pomalu (60 BPM)', pattern: [[0, 1], [1, 1], [2, 1], [3, 1]], bpm: 60 },
        { t: 'rhythm', label: 'Rychle (120 BPM)', pattern: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]], bpm: 120 },
        { t: 'tip', text: 'Když je pro tebe píseň rychlá, zpomal tempo posuvníkem – výška se nezmění.' },
        { t: 'quiz', q: 'Co znamená 60 BPM?', options: ['60 tónů v písni', 'Jedna doba za sekundu', '60 sekund ticha'], answer: 1 },
      ] },
    ],
  },
  {
    id: 't7', n: 7, title: 'Délky not a pomlky', icon: '⏱️', intro: 'Celá, půlová, čtvrťová, osminová, tečka.',
    lessons: [
      { id: 't7l1', title: 'Jak dlouho tón trvá', blocks: [
        { t: 'p', text: 'Délku tónu měříme v dobách. **Čtvrťová** nota trvá 1 dobu, **půlová** 2 doby, **celá** 4 doby a **osminová** půl doby (dvě se vejdou do jedné doby).' },
        { t: 'rhythm', label: 'Čtvrťové (1 doba)', pattern: [[0, 1], [1, 1], [2, 1], [3, 1]], bpm: 80, voice: true },
        { t: 'rhythm', label: 'Půlové (2 doby)', pattern: [[0, 2], [2, 2]], bpm: 80, voice: true },
        { t: 'rhythm', label: 'Osminové (půl doby)', pattern: [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]], bpm: 80, voice: true },
        { t: 'p', text: '**Pomlka** je ticho na určitou dobu – i ticho patří do rytmu. **Tečka** za notou ji prodlouží o polovinu: tečkovaná čtvrťová trvá 1½ doby („dlouhá – krátká“).' },
        { t: 'rhythm', label: 'Tečkovaný rytmus', pattern: [[0, 1.5], [1.5, 0.5], [2, 1.5], [3.5, 0.5]], bpm: 80, voice: true },
        { t: 'tip', text: 'Na válci not v aplikaci je délka tónu vidět jako **délka pruhu**. Delší pruh = déle drž.' },
        { t: 'quiz', q: 'Kolik dob trvá půlová nota?', options: ['Půl doby', '1 dobu', '2 doby', '4 doby'], answer: 2 },
        { t: 'quiz', q: 'Poslechni si rytmus. Jsou to čtvrťové, nebo osminové noty?', play: { rhythm: [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]], bpm: 80 }, options: ['Čtvrťové', 'Osminové'], answer: 1 },
      ] },
    ],
  },
  {
    id: 't8', n: 8, title: 'Takt', icon: '🎼', intro: '2/4, 3/4, 4/4 a těžká doba.',
    lessons: [
      { id: 't8l1', title: 'Počítání do tří a do čtyř', blocks: [
        { t: 'p', text: 'Doby se seskupují do **taktů**. První doba taktu je **těžká** – zní důrazněji. Takt **4/4** se počítá „**raz** dva tři čtyři“, **3/4** „**raz** dva tři“ (valčík), **2/4** „**raz** dva“ (pochod, polka).' },
        { t: 'rhythm', label: '4/4: RAZ dva tři čtyři', pattern: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]], bpm: 90, meter: 4 },
        { t: 'rhythm', label: '3/4: RAZ dva tři (valčík)', pattern: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]], bpm: 100, meter: 3 },
        { t: 'p', text: 'Na těžké době se obvykle mění akord a melodie tam stojí na „pevném“ tónu. Když se ztratíš, počkej na další „raz“ a nastup znovu.' },
        { t: 'tip', text: 'Odpočet před písní (3 – 2 – 1) trvá přesně jeden takt. Na „raz“ po něm začneš zpívat (nebo začne předehra).' },
        { t: 'quiz', q: 'Poslechni si kliky. Je to takt na tři, nebo na čtyři?', play: { rhythm: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]], bpm: 100, meter: 3 }, options: ['Na tři (3/4)', 'Na čtyři (4/4)'], answer: 0 },
        { t: 'quiz', q: 'Která doba v taktu je těžká?', options: ['První', 'Poslední', 'Žádná'], answer: 0 },
      ] },
    ],
  },
  {
    id: 't9', n: 9, title: 'Akordy a doprovod', icon: '🎸', intro: 'Více tónů najednou, dur a moll, domov.',
    lessons: [
      { id: 't9l1', title: 'Co je akord', blocks: [
        { t: 'p', text: '**Akord** jsou tři (nebo více) tóny zahrané **najednou**. Nejčastější je trojzvuk: do – mi – sol. Doprovod písně jsou vlastně akordy, které se střídají pod melodií.' },
        { t: 'play', label: 'Tóny po sobě, pak najednou', notes: [[60, 0, 0.8], [64, 1, 0.8], [67, 2, 0.8], [60, 3, 2], [64, 3, 2], [67, 3, 2]], inst: 'piano' },
        { t: 'p', text: '**Durový** akord zní vesele, **mollový** smutněji (liší se prostředním tónem). V zápisu písní je dur jen písmeno (C, G), moll má malé „m“ (Am, Dm).' },
        { t: 'play', label: 'C dur → A moll', notes: [[60, 0, 1.6], [64, 0, 1.6], [67, 0, 1.6], [57, 2, 1.8], [60, 2, 1.8], [64, 2, 1.8]], inst: 'piano' },
        { t: 'p', text: 'Akord na první tón stupnice (**tónika**) zní jako „domov“ – píseň na něm končí. Akord na pátý tón (**dominanta**) zní jako „otázka“, která chce zpátky domů.' },
        { t: 'play', label: 'Domov – otázka – domov (C – G – C)', notes: [[60, 0, 1.4], [64, 0, 1.4], [67, 0, 1.4], [59, 1.6, 1.4], [62, 1.6, 1.4], [67, 1.6, 1.4], [60, 3.2, 2], [64, 3.2, 2], [67, 3.2, 2]], inst: 'piano' },
        { t: 'tip', text: 'Předehra písně ti „nastaví“ tóninu – poslouchej ji a první tón melodie pak najdeš snáz.' },
        { t: 'quiz', q: 'Zní tento akord vesele (dur), nebo smutně (moll)?', play: { notes: [[57, 0, 2], [60, 0, 2], [64, 0, 2]], inst: 'piano' }, options: ['Dur', 'Moll'], answer: 1 },
      ] },
    ],
  },
  {
    id: 't10', n: 10, title: 'Jak číst zpěv v aplikaci', icon: '👀', intro: 'Válec not, křivka hlasu, barvy a symboly.',
    lessons: [
      { id: 't10l1', title: 'Válec not', blocks: [
        { t: 'p', text: 'Místo klasických not ukazuje aplikace **válec not**: každý tón je **pruh**. Čím výš pruh je, tím vyšší tón. Čím je pruh delší, tím déle tón trvá. Pod pruhem je slabika textu.' },
        { t: 'roll', items: [[60, 0, 1, 'Zpí-'], [62, 1, 1, 'vám'], [64, 2, 2, 'rád'], [64, 4, 1, 'zpí-'], [62, 5, 1, 'vám'], [60, 6, 2, 'teď']] },
        { t: 'p', text: 'Svislá čára je **teď** – noty k ní připlouvají zprava. Tvůj hlas je **tečka a čára**: zelená ● = přesně, oranžová = trochu vedle, červená = hodně vedle. Šipka **▲** znamená, že jsi moc vysoko (jdi níž), **▼** moc nízko (jdi výš).' },
        { t: 'p', text: 'Čárkovaný pruh je jen na poslech – zazní tón a ty jen posloucháš. Pak přijde plný pruh – ten zazpíváš.' },
        { t: 'tip', text: 'Netrhej hlasem za čárou – posouvej ho plynule a klidně. Pomalejší tempo (posuvník) dá více času.' },
        { t: 'quiz', q: 'Ukazuje šipka ▼. Co máš udělat?', options: ['Zpívat výš', 'Zpívat níž', 'Zpívat hlasitěji'], answer: 0 },
        { t: 'quiz', q: 'Co znamená delší pruh?', options: ['Vyšší tón', 'Tón trvá déle', 'Hlasitější tón'], answer: 1 },
      ] },
    ],
  },
];

export const ALL_THEORY = THEORY.flatMap((c) => c.lessons.map((l, i) => ({ ...l, chapter: c.id, chapterN: c.n, index: i })));
export const theoryById = (id) => ALL_THEORY.find((l) => l.id === id);
export const theoryChapter = (id) => THEORY.find((c) => c.id === id);
