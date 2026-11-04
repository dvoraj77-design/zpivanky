# Postup práce

Podle tohoto souboru se dá kdykoli navázat. Pořadí: celek → obsah → testy → ladění.

## Hotovo
- Otázky zodpovězeny (hosting: veřejné repo, Pages z `main` /docs; název Zpívánky; hluboký mužský hlas; Nothing Ear (a) BT).
- Průzkum a plán: `COMPETITION.md`, `PLAN.md`, `DECISIONS.md`, `SONG_FORMAT.md`.
- Jádro (`docs/js/core`): teorie a české značení, detektor MPM (chyba ≤ 0,3 c), tracker, hodnocení, profil a typ hlasu, doporučení tóniny, formát písní, doprovod, generátor cvičení, pokrok/odznaky/denní plán, záloha, převod zpěvu na noty + harmonizace.
- Obsah: 24 písní ve 4 úrovních, kurz 10 kapitol / 50 lekcí, 11 typů cvičení.
- Audio: worklet → worker (detekce mimo zvukové vlákno), vzorkovač (klavír/kytara/basa), vodicí hlas, bourdon, metronom, bicí, transport (tempo, smyčka, pauza, čekej na mě), nahrávání, WAV export.
- Všechny obrazovky (30+ tras), PWA: service worker, manifest, ikony; nasazeno na `main`.
- Redesign na světlý pastelový vzhled (na přání uživatele).
- Testy: `npm test` (50 jednotkových), `npm run e2e` (simulovaný zpěvák, všechny typy cvičení, test hlasu, kalibrace, režimy písní, editor, archiv, záloha, obrazovky 390×844 a 412×915, offline, instalovatelnost).
- `README.md`, `TESTING.md`.

- Finální běh: 50 jednotkových + 14 e2e testů zelených po redesignu; nasazeno do `main` (commit f98821a a novější).

## Čeká na uživatele
- Jednorázově zapnout GitHub Pages: Settings → Pages → Deploy from a branch → `main` → `/docs` → Save (viz README).
- Projít `TESTING.md` na telefonu se sluchátky.

## Fáze 2 – import písní (hotovo)
- Jádro: FFT libovolné délky, STFT/ISTFT jako torch, MDX-Net (ONNX), rychlá maska středu, tempo a doby (spektrální tok + DP), takt, akordy (harmonická chroma + Viterbi), přepis melodie (detektor / harmonická salience), oprava oktáv, české slabiky, LRC, sestavení písně, WSOLA (tempo, zarovnání na stálé tempo, posun výšky).
- Aplikace: obrazovka Import (soubor / mikrofon, název z ID3 nebo jména souboru, úsek, Rychle / Přesně s odhadem času, text Dohledat / Vložit / Bez textu), průběh se zrušením, stažení modelu do telefonu, shrnutí po importu, úprava textu a názvu, smazání originálu, originální doprovod v přehrávači (tempo, tónina, smyčky, poslech s původním zpěvem).
- Service worker: hlavičky izolace (vícevláknové WASM), model v cache na vyžádání.
- Testy: `tests/unit/import.test.mjs`, `tests/unit/import2.test.mjs`, `tests/e2e/import.test.mjs` (rychlý import se zarovnaným textem z podvrženého lrclib, přehrání originálu v 70 % a +3 půltónech, úprava textu, přesný import s modelem ve WASM, nahrání mikrofonem).

## Kolo 3 – MIDI, knihovna, nástroje, hlasitosti (hotovo)
- Import MIDI / karaoke (.mid, .kar): výběr stopy melodie s poslechem, nástroje pro každou stopu doprovodu, text z MIDI (i cp1250), tempo, styl; hromadný import mnoha souborů; přehrávání původního aranžmá.
- Knihovna: kategorie, hledání (bez diakritiky), filtr obtížnosti a stylu; +24 skutečných písní (lidové, koledy, dětské, ze světa).
- 7 nových vzorkovaných nástrojů, 4 nové styly doprovodu (klasická kytara, smyčce, varhany, kapela), volba nástroje melodie, mixér hlasitostí po skupinách, ukázka zvuku na detailu písně.
- Nácvik fráze po celých taktech s přípravným taktem.
- MP3 import přesunut mezi experimentální, stažení modelu pokračuje po výpadku sítě.

## Další nápady
- Ruční editor jednotlivých not importované písně (táhnout výš/níž, délka).
- Původní zpěv jako vodicí hlas (místo syntetického) v režimu Zpívat.
