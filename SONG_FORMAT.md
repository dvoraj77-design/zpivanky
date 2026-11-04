# Formát písně Zpívánek (`zpivanky-song`, verze 1)

Jedna píseň = jeden JSON objekt. Stejný formát používají vestavěné písně (kompilují se z kompaktního zápisu v `docs/js/data/songs.js`), vlastní písně z editoru i budoucí importované písně (fáze 2: Spotify / soubor → oddělení vokálu → přepis melodie).

Čas je v **dobách** (beat) od začátku písně (doba = jednotka taktu, ve 4/4 čtvrťová nota). Převod na sekundy dává `tempo` (BPM) nebo – u importovaných nahrávek – `timing.beats` (mapa dob na sekundy). Výšky jsou MIDI čísla (60 = C4, 69 = A4 = 440 Hz).

```json
{
  "format": "zpivanky-song",
  "version": 1,
  "id": "tri-tony",
  "title": "Tři tóny",
  "subtitle": "",
  "source": "builtin",
  "level": 1,
  "chapter": 3,
  "practices": ["trefení tónu"],
  "description": "Jen do, re, mi – ideální první píseň.",
  "credits": { "melody": "Zpívánky (původní)", "lyrics": "Zpívánky (původní)" },
  "tempo": 72,
  "meter": [4, 4],
  "key": { "tonic": "C", "mode": "major" },
  "sections": [
    { "type": "intro", "name": "Předehra", "start": 0, "end": 8 },
    { "type": "verse", "name": "Sloka", "start": 8, "end": 40 },
    { "type": "outro", "name": "Dohra", "start": 40, "end": 48 }
  ],
  "notes": [
    { "t": 8, "d": 1, "p": 60, "syl": "Zpí-", "phrase": 0 },
    { "t": 9, "d": 1, "p": 62, "syl": "vám", "phrase": 0 }
  ],
  "chords": [ { "t": 0, "d": 4, "sym": "C" }, { "t": 4, "d": 4, "sym": "G" } ],
  "lyrics": [ { "text": "Zpívám rád, zpívám teď,", "start": 8, "end": 16, "line": 0 } ],
  "phrases": [ { "start": 8, "end": 16, "index": 0, "section": 1 } ],
  "length": 48,
  "timing": null,
  "audio": null
}
```

## Pole

| Pole | Typ | Popis |
|---|---|---|
| `format`, `version` | text, číslo | Vždy `zpivanky-song`, `1`. |
| `id` | text | Jedinečný identifikátor (vlastní písně `custom-…`, importované `import-…`). |
| `title`, `subtitle`, `description` | text | Název, podtitul, krátký popis. |
| `source` | `builtin` \| `custom` \| `import` \| `midi` | Původ písně. |
| `category` | `cvicne` \| `detske` \| `lidove` \| `koledy` \| `svet` | Kategorie vestavěné knihovny (vlastní písně jsou „Moje“). |
| `style` | `pop` \| `rock` \| `lidove` \| … | Styl vlastní písně (třídění v Moje). |
| `bars` | [doby] | Začátky taktů (předtakty) – nácvik frází po celých taktech. |
| `level` | 0–4 | Obtížnost (0 = nehodnocená vlastní píseň). |
| `chapter` | číslo \| null | Kapitola kurzu, ke které píseň patří. |
| `practices` | text[] | Co píseň procvičuje. |
| `credits` | `{melody, lyrics, arrangement?, recording?}` | Autoři / licence. |
| `tempo` | BPM | Tempo v dobách za minutu (u importu výchozí, přesný čas je v `timing`). |
| `meter` | `[doby, jednotka]` | Takt, např. `[3, 4]`. |
| `key` | `{tonic, mode}` | Tónika (`C`, `Eb`, `F#`…) a `major`/`minor`. |
| `sections[]` | `{type, name, start, end}` | Stavba: `intro`, `verse`, `chorus`, `bridge`, `outro`. |
| `notes[]` | `{t, d, p, syl, phrase, melisma?}` | Melodie: začátek, délka (doby), MIDI výška, slabika, index fráze; `melisma: true` = pokračování slabiky na dalším tónu. |
| `chords[]` | `{t, d, sym}` | Akordy (mezinárodní značky: `C`, `Am`, `G7`, `F#m`, `Bb`, `D/F#`, `sus4`, `maj7`…). |
| `lyrics[]` | `{text, start, end, line}` | Řádky textu s časováním (doby). Pro karaoke. |
| `phrases[]` | `{start, end, index, section}` | Fráze (hodnocení po frázích, smyčka, „poslechni → zazpívej“). |
| `length` | doby | Celková délka. |
| `timing` | null \| objekt | **Fáze 2** – viz níže. |
| `audio` | null \| objekt | **Fáze 2** – odkazy na zvukové stopy. |

## Rozšíření pro importované písně (fáze 2)

```json
"timing": {
  "type": "beatmap",
  "beats": [ { "beat": 0, "time": 0.42 }, { "beat": 1, "time": 0.91 } ],
  "tempoChanges": true
},
"audio": {
  "stems": {
    "mix": "stems/song-123/mix.opus",
    "vocals": "stems/song-123/vocals.opus",
    "instrumental": "stems/song-123/instrumental.opus"
  },
  "offset": 0.0,
  "sampleRate": 48000,
  "durationSec": 201.4,
  "loudnessLufs": -14.2
},
"analysis": {
  "melodyConfidence": [ { "t": 8, "c": 0.93 } ],
  "pitchTrack": "stems/song-123/vocals.f0.json",
  "keyConfidence": 0.81,
  "lyricsSource": "lrc"
}
```

- `timing.beats` mapuje doby na sekundy nahrávky (lineární interpolace mezi body). Když chybí, platí `time = beat × 60 / tempo`.
- `audio.stems` jsou relativní cesty (nebo URL serveru ve fázi 2); přehrávač místo syntetického doprovodu přehraje `instrumental` a volitelně `vocals` jako vodicí hlas („Singer ON/OFF“). Transpozice a tempo u nahrávek vyžadují time-stretch/pitch-shift na serveru nebo v AudioWorkletu.
- `analysis` je nepovinné a slouží k ladění (jistota přepisu, surová křivka vokálu).
- Všechna ostatní pole zůstávají stejná, takže hodnocení, smyčky, karaoke i doporučení tóniny fungují beze změny.

## Píseň z MIDI (`source: "midi"`)

```json
"backing": {
  "tracks": [ { "id": "2:1", "name": "Bass", "gm": "Basa", "inst": "bass", "role": "bass" } ],
  "events": [ { "t": 4, "d": 1.9, "midi": 36, "vel": 0.57, "tr": "2:1" } ]
}
```

- `backing` je původní aranžmá z MIDI: ostatní stopy převedené na nástroje aplikace (`piano`, `guitar`, `nylon`, `bass`, `violin`, `cello`, `flute`, `clarinet`, `sax`, `organ`, `drum`, `off`). Doby jsou ve stejné ose jako noty (doba 0 = začátek písně), při transpozici se posouvá vše kromě bicích.
- Role (`chords` / `bass` / `drums`) určuje sběrnici mixu (hlasitost akordů, basy a bicích zvlášť).
- Text z karaoke souborů: `/` nový řádek, `\` nový odstavec, mezera = nové slovo; MIDI bez mezer (LilyPond) = každá slabika samostatně.

## Kompaktní zápis vestavěných písní

V `docs/js/data/songs.js` se píše po frázích `[melodie, text, akordy]`:

- melodie: `C4/1 D E/2 | E/1 D C/2` – nota + oktáva + `/doby`; oktáva i délka se pamatují; `r` = pauza; `|` = takt (kontroluje se délka taktu)
- text: slabiky dělí mezery a pomlčky (`zpí-vám`), `_` = melisma, `~` spojí slova do jedné slabiky (`k~nám`)
- akordy: po taktech `C | Am F | G:3 C:1` (rovnoměrně, nebo `:doby`)

Kompilátor `compileSong()` (`docs/js/core/song.js`) hlídá počty slabik, délky taktů a testy (`tests/unit/songs.test.mjs`) kontrolují rozsah dle úrovně, akordy na těžkých dobách, konec na tónice a doprovod.
