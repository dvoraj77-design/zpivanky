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

## Nápady pro fázi 2
- Server: import písní (Spotify / soubor), oddělení vokálu, přepis melodie, akordy a časování textu → formát v `SONG_FORMAT.md` (`timing`, `audio.stems`, `analysis`).
- Time-stretch/pitch-shift nahrávek, přehrávání stop místo syntetického doprovodu.
