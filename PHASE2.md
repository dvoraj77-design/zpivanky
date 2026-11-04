# Fáze 2 – import vlastních písní (podrobný návrh)

> **Stav (listopad 2026): import je hotový a nasazený.** Písně → ＋ Přidat → Z nahrávky. Co je jinak než v návrhu níže:
> - Oddělení zpěvu „Přesně“ používá model **MDX-Net Kim_Vocal_2** (33 MB, váhy float16) místo HTDemucs – je menší a na zpěv přesnější; běží v telefonu přes ONNX Runtime Web (grafický čip WebGPU, jinak procesor WASM ve více vláknech). Stahuje se jen jednou na vyžádání (~56 MB i s runtime) do zvláštní cache, ne při instalaci aplikace.
> - „Rychle“ = maska středu/stran ve spektru; melodie se z ní čte **harmonickou saliencí** (odolná vůči basě a doprovodu uprostřed), z čistého zpěvu modelu přesným detektorem výšky.
> - Stopy se ukládají do IndexedDB jako 16bit PCM (doprovod stereo 44,1 kHz, zpěv mono 22 kHz; ~11 MB na minutu), ne Opus – kódování přes WebCodecs by potřebovalo kontejner a nepřineslo by nic podstatného pro pár písní. Originál jde u písně smazat a uvolnit místo; do zálohy se nedává.
> - Kontrola po importu: shrnutí (noty, akordy, tempo, takt, text), úprava názvu, interpreta a **textu** (znovu se rozloží na noty), opětovné dohledání textu, smazání originálu. Noty se opravují zatím jen celé o oktávu (✏️ → Melodie o oktávu); ruční editor jednotlivých not je další krok.
> - Originální doprovod se zarovná na stálé tempo podle nalezených dob (WSOLA s proměnným krokem) a přehrává se sample-přesně s transportem (smyčky frází, čekání na tón, pauza); tónina se mění posunem ±6 půltónů (zbytek je oktáva), tempo 50–120 % beze změny výšky.
> - Ověření přesnosti: na syntetických směsích (známé noty, akordy, tempo) tempo ±3 %, doby ≥ 85 % do ±70 ms, kořeny akordů ≥ 70 %, melodie z rychlého oddělení 26–35 ze 35–42 not; na skutečné studiové písni (ukázka Spleeteru, jen lokálně) rychlý režim trefí 78 % znělých snímků přesně (84 % po oktávách) proti zpěvu odděleném modelem. Model zpěv z amatérské nahrávky z telefonu a syntetického zpěváka částečně potlačuje – na skutečných nahrávkách zpěváků funguje (odhad zpěvu −7 dB, projekce do směsi 1,06).
> - Měřená rychlost: rychlý import 30 s písně ≈ 5 s; přesný ≈ 10× délka úseku na procesoru (3 vlákna) – proto lze vybrat jen úsek (třeba refrén) a aplikace ukazuje odhad zbývajícího času; s grafickým čipem bývá výrazně rychlejší.


Cíl: vzít píseň, kterou chceš zpívat, a udělat z ní ve Zpívánkách stejnou „učebnicovou“ píseň jako vestavěné – noty melodie, akordy, tempo, takt, text s časováním a doprovod – aby šla zpívat ve tvé tónině, pomaleji, po frázích a s hodnocením. Pokud možno **zdarma** a **bez účtů**.

## 1. Odkud vzít zvuk (a co nejde)

| Zdroj | Jde? | Poznámka |
|---|---|---|
| **Spotify – zvuk** | ❌ | Zvuk je chráněný DRM, podmínky Spotify stahování/nahrávání zakazují a webová API zvuk nedává. Od 27. 11. 2024 nové aplikace nedostanou ani „audio features/analysis“ (tempo, tónina). |
| **Spotify – metadata** | ✅ (volitelně) | Název, interpret, délka, obal – jen pro vyhledání a pojmenování. Vyžaduje registraci vlastní (bezplatné) Spotify aplikace a přihlášení – přínos je malý, doporučuji vynechat. |
| **Vlastní soubor v telefonu** (MP3, M4A, WAV, OGG, FLAC) | ✅ | Hlavní cesta. Koupené/stažené písně, vlastní nahrávky, karaoke verze. |
| **Nahrát přes mikrofon** (píseň hraje z jiného zařízení) | ✅ | Funguje vždy, ale horší kvalita (ozvěna, šum). Vhodné pro jednoduché písně. |
| **YouTube / streamovací služby** | ❌ | Stahování porušuje podmínky služeb. |
| **Noty / akordy z internetu** | ✅ ručně | Editor vlastní písně už teď umí zadat noty, akordy a text. |

## 2. Co se z písně musí zjistit

1. **Oddělení zpěvu od hudby** (vokál × doprovod) – nutné pro přesný přepis melodie i pro „karaoke“ podklad.
2. **Melodie zpěvu** → noty (výška, začátek, délka).
3. **Tempo a doby** (beat tracking) → převod sekund na doby, takt.
4. **Tónina** a **akordy** (z doprovodu).
5. **Text** se slabikami a časováním (řádky = fráze).
6. **Stavba** (sloka / refrén) – volitelně z opakování akordů a textu.

## 3. Kde to spočítat – tři varianty

### A) Všechno v telefonu (doporučeno: zdarma, soukromé, bez serveru)
- **Oddělení zpěvu:** model **HTDemucs** v prohlížeči (ONNX Runtime Web, licence MIT). Model ~180 MB se stáhne jednou při prvním importu a uloží se pro offline použití. Výpočet 3minutové písně: s WebGPU řádově 1–3 minuty, bez něj (WASM) 5–15 minut – telefon u toho musí zůstat zapnutý.
  - Rychlá náhradní metoda (okamžitá, horší): **odečtení středového kanálu** (L − R) – u mnoha studiových nahrávek potlačí zpěv; vhodné jako „karaoke podklad“, ne pro přepis.
- **Melodie:** na odděleném zpěvu stávající detektor (MPM, přesnost ověřená testy) + převod na noty, nebo **Basic Pitch** od Spotify (TensorFlow.js, Apache 2.0, ~2 MB) jako druhý názor.
- **Tempo, doby, takt:** vlastní beat tracker (nástupy energie → autokorelace tempa → dynamické programování dob), rozhodnutí 3/4 × 4/4 podle síly dob.
- **Akordy a tónina:** chroma (12 tónů) z doprovodné stopy po dobách → šablony dur/moll/septakordy → vyhlazení (Viterbi) → tónina Krumhansl–Schmuckler (už v aplikaci).
- **Výhody:** zdarma, nic neodchází z telefonu, funguje i offline (po stažení modelu). **Nevýhody:** velký jednorázový download, delší výpočet, slabší telefony to zvládnou pomalu.

### B) Bezplatný cloud (Hugging Face Space)
- Na Hugging Face (zdarma) poběží malá služba s Demucs + Basic Pitch + beat trackerem. Aplikace jí pošle soubor a dostane zpět JSON + stopy.
- **Výhody:** telefon nepočítá, rychlejší na slabých telefonech. **Nevýhody:** zvuk odchází na cizí server, free CPU je pomalé (minuty) a služba „usíná“, potřeba účet Hugging Face, údržba.

### C) Domácí počítač
- Skript (Python + Demucs) na PC ve stejné Wi-Fi; aplikace pošle soubor do PC a dostane výsledek. Nejrychlejší a nejkvalitnější, ale potřeba PC zapnuté a jednorázová instalace.

**Doporučení:** začít variantou **A** (v telefonu), s rychlým režimem bez oddělení (středový kanál) a přesným režimem s HTDemucs. B/C lze doplnit později jako „turbo“.

## 4. Jak bude znít doprovod importované písně

1. **Syntetický doprovod z akordů** (jako vestavěné písně) – plně funguje posun tóniny, tempo 50–120 %, styly (klavír, kytara…), vodicí melodie, smyčky. Zní „učebnicově“.
2. **Originální podklad** (doprovodná stopa bez zpěvu) – zní jako originál. Posun tóniny a tempa vyžaduje časové natažení a posun výšky (algoritmus WSOLA / „SoundTouch“ v AudioWorkletu); ±3 půltóny a 70–100 % zní dobře, větší posuny už slyšitelně hůř.
3. **Obojí** – přepínač „Originál / Klavír“.

## 5. Text a časování

- **Automaticky:** vyhledání synchronizovaného textu (LRC) na **lrclib.net** (zdarma, bez klíče) podle názvu, interpreta a délky. Odešle se jen název písně.
- **Ručně:** vložit text; aplikace rozdělí slabiky a přiřadí je k notám podle pořadí; řádky = fráze. Možnost „ťukání“: přehraje píseň a ťukáš na začátek každého řádku.
- Slabiky se automaticky dělí podle češtiny (samohlásky, slabičné r/l), ruční oprava v editoru.

## 6. Postup importu (obrazovky)

1. **Písně → ＋ → Importovat píseň** → vybrat soubor (nebo nahrát mikrofonem).
2. Název a interpret (předvyplní se z názvu souboru / štítků ID3).
3. Volba režimu: **Rychlý** (bez oddělení, sekundy) / **Přesný** (oddělení zpěvu, minuty; při prvním použití stáhne model).
4. Průběh: dekódování → oddělení zpěvu → melodie → tempo a doby → akordy → text (s ukazatelem a možností nechat běžet na pozadí, obrazovka nezhasne).
5. **Kontrola a oprava** (editor): válec not s křivkou z originálu, poslech originálu × přepisu, oprava not (přetažení výš/níž, délka), akordů, taktu, textu; zkrácení na sloku + refrén.
6. Uložit → píseň je v knihovně (štítek „Importovaná“) a funguje jako ostatní: doporučená tónina, Zpívat / Nacvičit frázi / Poslech, hodnocení, nahrávky.

## 7. Datový formát a úložiště

- Formát písně už je připravený (`SONG_FORMAT.md`): `timing.beats` (mapa dob na sekundy originálu), `audio.stems` (cesty ke stopám), `analysis` (jistota přepisu).
- Stopy se uloží do IndexedDB jako Opus (WebCodecs) – 3 min ≈ 2–3 MB na stopu. Originál se volitelně neukládá (jen podklad).
- Záloha: volitelně „včetně importovaných stop“ (větší soubor).

## 8. Přesnost a testování

- Testovací sada: vlastní syntetické „písně“ (melodie + doprovod + bicí smíchané) se známými notami, tempem a akordy → měření: přesnost not (± čtvrt doby, ± půltón), tempo (±2 %), akordy (% shody po dobách).
- Reálné testy: tvoje nahrávky a pár volně licencovaných písní (Creative Commons).
- Cíl: u čistě nazpívaných popových písní 80–90 % not správně bez oprav; zbytek doladí editor.

## 9. Právní stránka

- Import slouží jen pro osobní cvičení s nahrávkami, které vlastníš; nic se nesdílí ani nezveřejňuje. Importované písně a stopy zůstávají jen v telefonu.

## 10. Plán prací (odhad)

1. Import souboru, dekódování, náhled, rychlé oddělení (středový kanál), beat tracker, akordy, přepis melodie z odděleného/rychlého signálu → editor kontroly → uložení. (MVP)
2. HTDemucs v telefonu (stažení modelu na vyžádání, WebGPU/WASM, průběh, pokračování po přerušení).
3. Text z lrclib.net + ruční „ťukání“ řádků + české dělení slabik.
4. Originální podklad s posunem tóniny a tempa (WSOLA v AudioWorkletu).
5. Testovací sada přesnosti + ladění.
6. (Volitelně) Varianta B/C „turbo“ přes cloud nebo PC.
