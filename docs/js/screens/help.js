// Nápověda „Jak to funguje“ – vysvětlení celé aplikace pro úplné začátečníky.
import { html, useState, useEffect, TopBar, useAppState, Toggle } from '../ui/common.js';
import { saveSettings } from '../state.js';

export const HELP = [
  { id: 'start', icon: '🚀', title: 'Jak začít', body: [
    'Nikdy jsi nezpíval? Nevadí. Začni v **Kurzu** kapitolou **„Ovládni svůj hlas“** – naučíš se poznat vyšší a nižší tón, posunout hlas nahoru a dolů, zpívat potichu a nahlas.',
    'Souběžně si projdi **Kurz → Hudební nauka**: co je tón, nota, stupnice a rytmus. Každá lekce trvá pár minut.',
    'Pak si udělej **test hlasu** (Já → Můj hlas). Aplikace zjistí tvůj rozsah a všechna cvičení i písně posune tak, aby se ti zpívaly pohodlně.',
    'Každý den stačí 5–10 minut: na obrazovce **Dnes** klepni na „5 min“ a aplikace tě provede.',
  ] },
  { id: 'voice', icon: '🎙️', title: 'Jak ovládat hlas', body: [
    '**Výš a níž:** výšku neděláš silou ani tlakem v krku. Představ si tón předem a „pošli“ hlas za ním – jako když se divíš („Ó?!“) hlas vyjede nahoru, když vzdycháš („óóó…“) jde dolů. Pomůže sledovat žlutou čáru a posouvat hlas plynule, ne skokem.',
    '**Potichu a nahlas:** sílu dělá **dech**, ne krk. Víc vzduchu = silnější tón. Krk a ramena nech volné. Potichu zpívej jako ukolébavku, nahlas jako když voláš přes dvůr – ale nikdy nekřič.',
    '**Barva:** tón zní tmavě (ú, ó) nebo světle (í, é) podle tvaru úst a jazyka. Pro začátek zpívej na „á“ nebo „ó“ s pootevřenými ústy a uvolněnou čelistí.',
    '**Dech:** nadechni se klidně do břicha a boků (ramena se nezvedají). Při zpěvu vydechuj pomalu a rovnoměrně, jako bys foukal na svíčku a nechtěl ji sfouknout.',
    '**Nevychází to?** Zabruč tón se zavřenými ústy („mmm“) – je to nejsnazší. Teprve pak otevři na „á“.',
  ] },
  { id: 'roll', icon: '🎼', title: 'Jak číst válec not', body: [
    'Každý tón je **pruh**. Čím výš pruh je, tím vyšší tón. Čím je delší, tím déle ho drž. Pod pruhem je slabika, kterou zpíváš.',
    'Svislá šedá čára je **teď** – pruhy k ní připlouvají zprava. Když pruh dorazí k čáře, zpívej.',
    'Tvůj hlas je **tečka a čára**: zelená **●** = přesně, oranžová = trochu vedle, červená = hodně vedle. **▲** znamená moc vysoko (jdi níž), **▼** moc nízko (jdi výš).',
    '**Čárkovaný pruh** jen poslouchej – zazní tón a teprve pak ho zazpíváš (plný pruh).',
    'Vlevo jsou jména tónů, žlutě zvýrazněný je základní tón („do“) tóniny.',
  ] },
  { id: 'modes', icon: '🎚️', title: 'Režimy písní', body: [
    '**🎤 Zpívat** – doprovod hraje celou píseň a nezastavuje se. Tlačítkem **Vodicí melodie** zapneš nebo vypneš hlas, který zpívá melodii s tebou (pro začátek nech zapnuté). Na konci dostaneš hodnocení.',
    '**🔁 Nacvičit frázi** – jedna fráze (řádek textu) hraje dokola v rytmu, po celých taktech; před ní je vždy jeden volný takt, kdy hraje jen doprovod a ty se nadechneš. Šipkami ◀ ▶ přejdeš na předchozí nebo další. Hodí se na těžká místa. Volitelně „čekat, až tón trefím“.',
    '**👂 Poslech** – jen poslouchej, jak píseň zní. Nic se nehodnotí.',
    '**Tempo** (posuvník) zpomalí nebo zrychlí píseň, výška se nezmění. Začni na 70 %.',
    '**Tónina** – aplikace sama doporučí výšku podle tvého hlasu (★). Tlačítky − a ＋ ji můžeš posunout o půltón.',
    '**🎚️ Mixážní pult** – hlasitost doprovodu, melodie a metronomu. **🎤/🎼** přepne válec not a karaoke (jen text).',
  ] },
  { id: 'tuner', icon: '🎯', title: 'Ladička', body: [
    'Zazpívej libovolný tón a ladička ukáže, který to je (např. **A3**), a o kolik **centů** jsi vedle. 100 centů = půltón. Ručička uprostřed a zelená barva = přesně.',
    'Dole je křivka tvého hlasu za posledních 10 sekund. Klepnutím na notu nebo mřížku ji uslyšíš.',
    '**Bourdon** je držený tón jako opora – zapni ho a zkus zpívat stejný tón.',
  ] },
  { id: 'score', icon: '⭐', title: 'Hodnocení', body: [
    '**Skóre 0–100** říká, jak přesně jsi zasáhl tóny (výšku i nástupy). 85+ = 3 hvězdičky, 70+ = 2, 50+ = 1.',
    '**Kde se zaměřit** – skóre každé fráze, tlačítkem ▶ si ji přehraješ.',
    '**Přesnost po notách** – každý tón posunutý doleva (níž) nebo doprava (výš). Zelený pás uprostřed je „přesně“.',
    '**Přísnost** (Nastavení): začátečník ±50 centů, pokročilý ±25, profi ±10. Začni jako začátečník.',
    'Zpěv o oktávu níž nebo výš než melodie se počítá jako správně (např. muž zpívá ženskou melodii).',
  ] },
  { id: 'notes', icon: '🔤', title: 'Noty a značení', body: [
    'Tóny se jmenují **C D E F G A H**. Česky je **B** tón mezi A a H (anglicky B♭). Černé klávesy: **Cis, Dis, Fis, Gis** (zvýšené) nebo **Des, Es, Ges, As, B** (snížené).',
    'Číslo za jménem je **oktáva**: C4 je prostřední C na klavíru, C3 o oktávu níž. Hluboký mužský hlas zpívá zhruba G2–E4.',
    '**Solmizace** (do re mi fa sol la ti) pojmenovává tóny podle místa ve stupnici – „do“ je vždy základní tón písně. V Nastavení si můžeš vybrat značení.',
  ] },
  { id: 'key', icon: '🗝️', title: 'Tónina a posun', body: [
    '**Tónina** říká, od jakého tónu je píseň postavená (např. C dur). Stejnou píseň jde zazpívat výš i níž – aplikace ji posune do tvého rozsahu.',
    '**Pracovní tónina** (Já → Můj hlas) je výška, od které začínají cvičení. Určí ji test hlasu.',
    'Cvičení se opakují a posouvají o **půltón** nahoru (a pak dolů) – jako klasická rozezpívka. Nikdy nejdou nad tvůj změřený rozsah.',
  ] },
  { id: 'headphones', icon: '🎧', title: 'Sluchátka a zpoždění', body: [
    'Zpívej se **sluchátky**: doprovod pak neslyší mikrofon a hodnocení je přesné. Nejlepší jsou drátová.',
    'U **Bluetooth** sluchátek zpívej do mikrofonu **telefonu** (Já → Zvuk a sluchátka) a udělej **kalibraci zpoždění** – aplikace pak správně hodnotí nástupy.',
    'Z reproduktoru to jde taky, ale mikrofon slyší i doprovod a hodnocení bude méně přesné.',
  ] },
  { id: 'people', icon: '👥', title: 'Více lidí a telefonů', body: [
    'Každý telefon má **svá vlastní data** – profil hlasu, pokrok i nahrávky zůstávají jen v něm. Když chcete zpívat dva, nainstalujte si aplikaci každý na svůj telefon ze stejné adresy. Je to zdarma a nic se nemíchá.',
    'Přenos dat na nový telefon: **Já → Záloha a obnova** → vytvoř zálohu, pošli si soubor a na novém telefonu ho obnov.',
  ] },
  { id: 'safety', icon: '🩺', title: 'Bezpečnost hlasu', body: [
    'Zpívej **uvolněně**, nikdy přes bolest. Pij vodu a dělej pauzy (aplikace připomene každých 15 minut).',
    'Když tě **bolí v krku nebo chraptíš**, přestaň a dej hlasu den dva odpočinout. Potíže delší než dva týdny ukaž lékaři (foniatrovi).',
    'Výšky nevynucuj. Rozsah roste tréninkem sám – test hlasu zopakuj za pár týdnů.',
  ] },
  { id: 'offline', icon: '📶', title: 'Offline a aktualizace', body: [
    'Po prvním načtení funguje aplikace **bez internetu**. Nic se nikam neposílá.',
    'Když vyjde nová verze, nahoře se objeví **„Aktualizovat“**. Tvoje data zůstanou.',
  ] },
];

function Para({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return html`<p>${parts.map((p) => (p.startsWith('**') ? html`<b>${p.slice(2, -2)}</b>` : p))}</p>`;
}

export function HelpScreen({ query }) {
  const st = useAppState();
  const want = query?.get('s');
  const [open, setOpen] = useState(want || 'start');
  useEffect(() => { if (want) { setOpen(want); setTimeout(() => document.getElementById('help-' + want)?.scrollIntoView({ block: 'start' }), 50); } }, [want]);
  return html`<div class="screen">
    <${TopBar} title="Jak to funguje" sub="Nápověda a vysvětlení od úplného začátku" backTo="/me" />
    <div class="card"><${Toggle} label="Režim pro začátečníky" sub="Vysvětlivky a tipy na obrazovkách" on=${st.settings.beginner !== false} onChange=${(v) => saveSettings({ beginner: v })} />
      ${(st.settings.hiddenHints || []).length ? html`<button class="btn sm block" onClick=${() => saveSettings({ hiddenHints: [] })}>Znovu ukázat skryté tipy (${st.settings.hiddenHints.length})</button>` : null}</div>
    <div class="list mt16">${HELP.map((h) => html`<div id=${'help-' + h.id} class="card" style="padding:0;overflow:hidden">
      <button class="item" style="box-shadow:none;border-radius:0" aria-expanded=${open === h.id} onClick=${() => setOpen(open === h.id ? null : h.id)}>
        <div class="ic">${h.icon}</div><div class="grow t">${h.title}</div><div class="chev">${open === h.id ? '▾' : '›'}</div></button>
      ${open === h.id ? html`<div style="padding:0 16px 8px">${h.body.map((t) => html`<${Para} text=${t} />`)}</div>` : null}
    </div>`)}</div>
  </div>`;
}
