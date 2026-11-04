# Zpívánky 🎤

Osobní aplikace na učení čistého zpěvu: živá ladička, test hlasu, kurz pro začátečníky (10 kapitol, 50 lekcí), 24 písní s doprovodem v tvé tónině, nástroje a sluchový trénink. Běží celá v telefonu, bez účtu, bez reklam a po prvním načtení i bez internetu.

## Adresa

**https://dvoraj77-design.github.io/zpivanky/**

### Jednorázové zapnutí (jen poprvé, 1 minuta)

1. Otevři https://github.com/dvoraj77-design/zpivanky/settings/pages
2. **Build and deployment → Source: Deploy from a branch**
3. **Branch: `main`**, složka **`/docs`** → **Save**
4. Za 1–2 minuty je aplikace na adrese výše (stav uvidíš v záložce *Actions* jako „pages build and deployment“).

Repo už je veřejné, takže GitHub Pages fungují zdarma.

## Instalace na plochu (Android, Chrome)

1. Otevři adresu výše v **Chromu**.
2. Menu ⋮ → **Přidat na plochu** / **Instalovat aplikaci** → **Instalovat**.
3. Na ploše a v seznamu aplikací se objeví ikona **Zpívánky**. Aplikace běží přes celou obrazovku jako běžná aplikace (Chrome z ní vytvoří WebAPK).
4. Jednou ji otevři s internetem – stáhne si vše potřebné (asi 2 MB) a dál funguje offline.

## Povolení mikrofonu

- Při prvním spuštění aplikace požádá o mikrofon → **Povolit**.
- Když jsi omylem zakázal: v Chromu klepni na ikonu vlevo od adresy → **Oprávnění → Mikrofon → Povolit**. U nainstalované aplikace: **Nastavení Androidu → Aplikace → Zpívánky (nebo Chrome) → Oprávnění → Mikrofon → Povolit**.
- Zvuk se zpracovává jen v telefonu, nic se nikam neposílá.

## Dva lidé (nebo víc)

Každý telefon má svá data jen u sebe – profil hlasu, pokrok i nahrávky. Když chcete zpívat oba, nainstalujte si aplikaci každý na svůj telefon ze stejné adresy. Je to zdarma a data se nemíchají. Přenos na nový telefon: **Já → Záloha a obnova**.

## Pro úplné začátečníky

Režim pro začátečníky je zapnutý: na obrazovkách jsou vysvětlivky (jde je skrýt křížkem nebo vypnout v Nastavení). **Kurz → Zpěv** začíná kapitolou **0. Ovládni svůj hlas** a **Kurz → Hudební nauka** vysvětluje tón, noty, stupnice, rytmus, takt a akordy. Vše je shrnuté v **Já → Jak to funguje**.

## Sluchátka

- Nejlepší je **drátový headset** (jack / USB-C): nejmenší zpoždění, mikrofon u pusy.
- **Bluetooth (např. Nothing Ear (a))**: poslouchej přes sluchátka, ale v *Já → Zvuk a sluchátka* nech mikrofon **telefonu** (jinak Android přepne sluchátka do hovorového režimu a zvuk zhorší). V aplikaci Nothing X zapni **Low Lag Mode** a pak udělej **Kalibraci zpoždění** (10 s).
- Bez sluchátek funguje ladička i cvičení; u písní se použije režim „poslechni → zazpívej“.

## Aktualizace

Aplikace se aktualizuje sama: každý push do `main` GitHub Pages za 1–2 minuty nasadí, a když pak aplikaci otevřeš s internetem, nahoře se objeví **„Je k dispozici nová verze – Aktualizovat“**. Když měníš soubory v `docs/` sám, spusť před commitem `npm run build` – jinak telefon změnu nepozná a dál použije verzi uloženou pro offline režim. Profil, pokrok, vlastní písně i nahrávky zůstávají (jsou v úložišti telefonu, ne v aplikaci). Pro jistotu si občas udělej **Já → Záloha a obnova → Vytvořit zálohu**.

## Vlastní písně z MIDI a karaoke

**Písně → ＋ Přidat → Z MIDI nebo karaoke.** MIDI (.mid) a karaoke (.kar) soubory obsahují přesné noty i text. Vyber jeden soubor (zvolíš stopu s melodií – každou si můžeš poslechnout –, nástroje doprovodu, tempo a styl), nebo **víc souborů najednou** – aplikace je naimportuje sama a roztřídí podle stylu do **Moje**. Písně hrají s **původním aranžmá** na nástrojích v telefonu (nebo s doprovodem z akordů) a zůstávají jen v telefonu. Ze Spotify ani YouTube zvuk stáhnout nejde; MIDI/karaoke verze písní najdeš na internetu („název písně midi“ nebo „kar“).

**Experimentální: z nahrávky MP3** (＋ Přidat → Experimentální) – umělá inteligence v telefonu odhadne melodii ze zvuku; výsledky zatím bývají nepřesné. Model (~56 MB) se stáhne jen při prvním použití.

## Co kde najdeš

- **Dnes** – denní trénink na 5 / 10 / 20 minut, pokračování v kurzu, rychlé nástroje.
- **Kurz** – Zpěv (11 kapitol od úplné nuly po rytmus, rozsah, dynamiku a sluch; hvězdičky, odemykání, lze přeskočit) a Hudební nauka (10 kapitol pro laiky).
- **Písně** – knihovna (cvičné, dětské, lidové, koledy, ze světa) s hledáním, vlastní písně z MIDI/karaoke, doporučená tónina pro tvůj hlas, tempo 50–120 %, režimy Zpívat (vodicí melodie ON/OFF), Nacvičit frázi a Poslech, smyčka fráze, karaoke, mixážní pult, vlastní písně (editor i nazpívání).
- **Ladička** – nota, oktáva, centy, křivka posledních 10 s, bourdon, klepnutím uslyšíš notu.
- **Já** – hlasový profil a test hlasu, pokrok a odznaky, archiv nahrávek (porovnání, uložení WAV), zvuk a sluchátka, nástroje, nastavení, záloha, diagnostika.

## Pro vývoj

Bez sestavovacího kroku (čisté ES moduly + Preact/htm, vše přibalené v `docs/`).

```bash
npm run serve
```

```bash
npm test
```

```bash
npm run e2e
```

```bash
npm run build
```

`npm test` obsahuje i realistického syntetického zpěváka (vibrato, nasazení zespodu, souhlásky, ozvěna, šum, 16kHz Bluetooth, průsak doprovodu); `npm run e2e` pouští simulované zpěváky do aplikace v Chromiu, i na 4× zpomaleném procesoru. `npm run build` přegeneruje seznam souborů pro offline režim (`docs/precache.js`) a verzi – spusť ho po každé změně v `docs/`. Dokumenty: [PLAN.md](PLAN.md), [COMPETITION.md](COMPETITION.md), [DECISIONS.md](DECISIONS.md), [SONG_FORMAT.md](SONG_FORMAT.md), [TESTING.md](TESTING.md), [PROGRESS.md](PROGRESS.md).

## Licence zvuků a písma

Import: ONNX Runtime Web 1.20.1 (Microsoft, MIT), model MDX-Net Kim_Vocal_2 (KimberleyJensen, šířený s Ultimate Vocal Remover; viz `docs/models/README.txt`). Klavír: Salamander Grand Piano V3 (Alexander Holm, CC-BY 3.0). Kytary, basa, housle, violoncello, flétna, klarinet, saxofon, varhany: tonejs-instruments (Nicholaus Brosowsky, CC-BY 3.0). Notové zápisy českých lidových písní a koled: mojzis/noticky (CC0). Písmo Nunito (SIL OFL 1.1). Preact + htm (MIT). Melodie „Óda na radost“ (Beethoven) a „Ah! vous dirai-je, maman“ jsou volné dílo; ostatní melodie a všechny texty jsou původní.
