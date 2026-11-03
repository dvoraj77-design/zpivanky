# Postup práce

Podle tohoto souboru se dá kdykoli navázat. Pořadí: celek → obsah → testy → ladění.

## Hotovo
- Otázky zodpovězeny (hosting: veřejné repo, Pages z `main` /docs; název Zpívánky; hluboký mužský hlas; Nothing Ear (a) BT).
- Vzorky nástrojů, písmo Nunito, Preact/htm přibaleny (`scripts/prepare-samples.sh`).
- `COMPETITION.md`, `PLAN.md`, `DECISIONS.md`.
- Jádro (`docs/js/core`): teorie a značení, detektor MPM (±0,3 c), tracker, hodnocení, profil hlasu, formát písní, doprovod, cvičení, pokrok, záloha, převod zpěvu na noty.
- Obsah: 24 písní (`docs/js/data/songs.js`), kurz 10 kapitol / 50 lekcí (`docs/js/data/course.js`).
- Audio: worklet → worker (detekce), vzorkovač, vodicí hlas, bourdon, metronom, transport, nahrávání, WAV export.
- Všechny obrazovky propojené (28 tras), service worker, manifest, ikony.
- Jednotkové testy: `npm test` (50 testů).

## Rozpracované
- E2E testy se simulovaným zpěvákem (Playwright), screenshoty, offline test.

## Další kroky
1. E2E: ladička (fake mic WAV), cvičení a píseň (testovací vstup), offline, manifest.
2. Projít screenshoty všech obrazovek, opravit překryvy.
3. README, TESTING, SONG_FORMAT; nasazení na `main`.
4. Bonusy a ladění.
