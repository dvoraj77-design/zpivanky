# Plán aplikace Zpívánky

Osobní PWA na učení čistého zpěvu. Běží celá v telefonu (Chrome na Androidu), po prvním načtení offline.
Hostování: GitHub Pages z větve `main`, složka `/docs` → https://dvoraj77-design.github.io/zpivanky/

## Architektura

- **Bez sestavovacího kroku**: čisté ES moduly v `docs/js`, UI přes Preact + htm (přibaleno v `docs/vendor`).
- **`docs/js/core/`** – čistá logika bez prohlížeče (testovatelná v Node): hudební teorie a značení not, detektor výšky (YIN přes FFT), tracker (vyhlazení, potlačení oktávových skoků, detekce hlasu/šumu/nástupů), hodnocení, profil hlasu, doporučení tóniny, formát písní a jejich kontrola, generátor doprovodu, generátor cvičení, kurz, pokrok, denní plán, záloha, převod zpěvu na noty, harmonizace.
- **`docs/js/audio/`** – Web Audio: AudioWorklet s detektorem (běží mimo hlavní vlákno), vzorkovač nástrojů (klavír, kytara, basa – přibalené vzorky Opus), syntéza vodicího hlasu, bourdonu a metronomu, plánovač (transport) s tempem a transpozicí, nahrávání, export WAV.
- **`docs/js/screens/`** – obrazovky; **`docs/js/ui/`** – sdílené komponenty (válec not s křivkou, ručička ladičky, kruh skóre, graf odchylek…).
- **Data**: IndexedDB (profil, pokrok, pokusy, vlastní písně, nahrávky) + localStorage pro nastavení. Service worker přednačte všechny soubory; data se při aktualizaci nemažou.

## Navigace

Spodní lišta (palec): **Dnes · Kurz · Písně · Ladička · Já**. Hash routování (`#/…`), systémové „zpět“ funguje.

```
Dnes ─┬─ Dnešní trénink (5/10/20 min) → sled cvičení → souhrn
      ├─ Pokračovat v kurzu → lekce
      ├─ Rychlé nástroje (metronom, bourdon, klavír, stupnice, sluch)
      └─ Připomínka pití/pauzy, série dní, denní cíl
Kurz ── Kapitoly (10) → lekce (50) → úvod (text + ukázka) → cvičení → výsledek
Písně ─ Knihovna (úrovně 1–4, filtr) → detail písně (tónina, režim) → přehrávač → výsledek
      └─ Vlastní píseň: editor (noty/akordy/text) | nazpívat → převod na noty
Ladička ─ nota, oktáva, centy, ručička, křivka 10 s, bourdon, klepnutí = poslech noty
Já ─┬─ Můj hlas (profil, typ hlasu, pracovní tónina, historie rozsahu, test hlasu, ruční úprava)
    ├─ Pokrok (minuty, série, přesnost v čase, nejslabší noty a intervaly, odznaky)
    ├─ Nahrávky (archiv, přehrání, porovnání, uložení WAV)
    ├─ Zvuk a sluchátka (mikrofon, výstup, sluchátkové profily, kalibrace zpoždění, kontrola úrovně)
    ├─ Nástroje (metronom, referenční tón, bourdon, klavír, stupnice, sluchový trénink)
    ├─ Nastavení (značení not, přísnost, vodicí nástroj, styl doprovodu, denní cíl, připomínky)
    ├─ Záloha a obnova (jeden soubor)
    └─ Diagnostika (zařízení, vzorkovací frekvence, zpoždění, surový signál a frekvence)
```

## Cesta nového uživatele

1. **Vítej** – co aplikace umí (3 body), vše zůstává v telefonu.
2. **Sluchátka** – proč headset (mikrofon u pusy = čistší signál, doprovod se nedostane do mikrofonu). Doporučení drátových; u Bluetooth upozornění na zpoždění a na to, že Android při použití BT mikrofonu přepne sluchátka do hovorového režimu → doporučení „poslouchat přes BT, zpívat do mikrofonu telefonu“.
3. **Mikrofon** – povolení, výběr mikrofonu, kontrola úrovně (tichý / přebuzený / hlučno).
4. **Kalibrace zpoždění** (lze přeskočit) – 8 cvaknutí, zpíváš „pa“ do rytmu.
5. **Test hlasu** (~3 min) – mluvená výška, nejnižší tón, nejvyšší hrudní tón, nejvyšší falzet, výdrž „sss“, řízený výdech.
6. **Výsledek** – rozsah, typ hlasu s vysvětlením, pracovní tónina → Dnes.

Každý krok jde přeskočit; do testu se lze kdykoli vrátit. Do změření se používá výchozí profil (hluboký mužský hlas G2–E4 dle zadání).

## Kurz (10 kapitol, 50 lekcí)

| # | Kapitola | Lekce (typ cvičení) |
|---|---|---|
| 1 | Poznej svůj hlas | Co je tón (volný držený tón) · Ladička (trefení tónice) · Bručení „mmm“ (držení) · Test hlasu (průvodce) · Do–Mi–Sol (trefení) |
| 2 | Dech a postoj | Postoj a „sss“ (výdrž 8 s) · Bráničné dýchání (výdrž 12 s) · Řízený výdech (stálý „fff“) · Opora na tónu (držení + stálá síla) · Fráze na jeden dech (stupnice) |
| 3 | Trefit tón | Slyš a zazpívej (trefení) · Tóny nahoru · Tóny dolů · Náhodné tóny · Naslepo (bez křivky) |
| 4 | Držet tón | 3 sekundy · 6 sekund · Bez kolísání · Samohlásky na jednom tónu · Držení v různých výškách |
| 5 | Kroky a stupnice | 1-2-1 · 1-2-3-2-1 · 1-2-3-4-3-2-1 · 1-2-3-4-5-4-3-2-1 · Celá stupnice |
| 6 | Skoky a intervaly | Tercie · Kvinta · Arpeggio 1-3-5-3-1 · Kvarta · Oktáva a velké arpeggio |
| 7 | Rytmus | Nástupy na metronom · Půlové a čtvrťové · Osminy · Tečkovaný rytmus · Melodie v rytmu |
| 8 | Rozšiřování rozsahu | Siréna nahoru · Siréna dolů · Siréna přes oktávu · Do lehkého hlasu (falzet) · Rty „brrr“ na arpeggiu |
| 9 | Dynamika a výraz | Crescendo · Decrescendo · Messa di voce · Legato · Staccato |
| 10 | Sluch | Sekunda nebo tercie? · Kvarta, kvinta, oktáva · Krátká melodie (zavolání → odpověď) · Delší melodie · Dur nebo moll? |

Každá lekce: vysvětlení (2–4 věty), ukázka, cvičení v pracovní tónině s posunem po půltónech v pohodlném rozsahu, hodnocení s konkrétní zpětnou vazbou a 1–3 hvězdičky. Další lekce se odemkne po splnění (≥ 1 hvězdička), lze ji přeskočit.

## Knihovna písní (24 písní, 4 úrovně)

Vlastní melodie s českým textem + lidové / volné melodie (autorsky volné). Každá píseň: název, text, melodie, akordy, tempo, takt, stavba (předehra, sloka, refrén, dohra), obtížnost, co procvičuje, vazba na kapitolu.

- **Úroveň 1** (rozsah 3–5 tónů, krokově, pomalu, 4–8 taktů): 6 písní
- **Úroveň 2** (do sexty, jednoduché skoky): 6 písní
- **Úroveň 3** (oktáva, intervaly, tečkovaný rytmus): 6 písní
- **Úroveň 4** (přes oktávu, synkopy, sloka + refrén): 6 písní

## Funkce: musí být

- Ladička (nota, oktáva, centy, ručička + barva + symbol, křivka 10 s, klidné zobrazení, < 100 ms)
- Detektor výšky ±5 centů, C2–C6, potlačení oktávových chyb, ignorování šumu
- Sluchátka: navedení, výběr mikrofonu, kalibrace zpoždění pro profil sluchátek, kontrola úrovně, upozornění při reproduktoru + režim „poslechni → zazpívej“
- Test hlasu a profil (rozsah, pohodlný rozsah, tessitura, typ, pracovní tónina, dech, historie, ruční úprava)
- Kurz 10 kapitol / 50 lekcí, 11 typů cvičení, posun po půltónech, výsledky (skóre, fráze, odchylky po notách, rada, přehrání)
- Dnešní trénink 5/10/20 min s ohledem na slabá místa
- 24 písní, doprovod (klavír, rozložené akordy, kytara, basa, rytmus), odpočet, předehra, závěr na tónice
- Přehrávač: válec not + křivka, karaoke, doporučení tóniny, transpozice ±12, tempo 50–120 %, smyčka, mix, režimy (poslech / s vodicí melodií / sám / vystoupení / čekej na mě / po frázích), hodnocení, historie, nahrávka WAV
- Vlastní píseň (editor + nazpívání)
- Pokrok, archiv nahrávek, nástroje, sluchový trénink, diagnostika
- Bezpečnost hlasu, wake lock, offline PWA, záloha/obnova, česká chybová hlášení

## Bonusy (po povinných, co nejvíc)

- Odznaky a denní cíl s oslavou
- Porovnání dvou nahrávek (křivky přes sebe)
- „Naslepo“ režim (bez živé křivky)
- Sdílení nahrávky přes systémové sdílení
- Klavír s držením tónu a zobrazením intervalu
- Světlý pastelový vzhled (změna na přání), přesnost značená barvou i tvarem

## Testování

- `npm test` – jednotkové testy logiky (Node `node:test`), přesnost detektoru na syntetických signálech, kontrola všech písní.
- `npm run e2e` – Playwright (Chromium): simulovaný zpěvák jako mikrofon, prohlídka všech obrazovek v 390×844 se screenshoty, offline test, kontrola manifestu.
