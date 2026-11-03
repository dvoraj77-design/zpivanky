# Průzkum konkurence

Shrnutí, co umí aplikace na učení zpěvu, co si z nich Zpívánky berou a čeho se naopak vyvarují.
Zdroj: popisy v obchodech s aplikacemi, recenze uživatelů, dokumentace a dodané screenshoty (Riyaz, Simply Sing / Yousician).

## Přehled aplikací

| Aplikace | Silné stránky | Na co si uživatelé stěžují |
|---|---|---|
| **Riyaz** | Strukturované kurzy (Western Vocal 101: lekce → cvičení), měření hlasu (rozsah, mluvená výška, dech), automatická „pracovní tónina“ (Bb · Men), skóre po frázích i notách, graf „Flat / Sharp“ po notách, živá křivka nad pruhy not se solmizačními slabikami. | Velká část obsahu za předplatným, hodnocení někdy nespravedlivé při hluku, pocit opakovanosti. |
| **Simply Sing** | Populární písně, noty jako pruhy s textem pod nimi, „Too high / Too low“, volba rozsahu (Soprán…Bas), karaoke řádky s barevně zvýrazněnou slabikou. | Agresivní předplatné, málo vysvětlování techniky, hodnocení u některých hlasů (hluboké mužské) nepřesné, nelze zpomalit. |
| **Yousician (Singing)** | Herní forma, denní výzvy, série dní, krokové lekce s hvězdičkami. | Detekce „neslyší“ správný tón, zpoždění u Bluetooth sluchátek, předplatné. |
| **Vanido** | Krátký denní trénink (rozezpívka) na míru, jednoduché ovládání, osobní cvičební plán. | Málo obsahu, cvičení se opakují, chybí písně. |
| **Singing Carrots** | Výborný test rozsahu, „pitch training“ s kontinuální zpětnou vazbou, srovnání rozsahu se slavnými zpěváky, cvičení na sluch. | Zastaralé rozhraní, malé ovládací prvky na mobilu. |
| **Erol Singer's Studio** | Velká knihovna rozezpívek s posunem po půltónech v rozsahu uživatele, živý graf výšky, nahrávání. | Složité menu, málo vysvětlení, starý vzhled. |
| **Smule** | Karaoke s komunitou, efekty hlasu, nahrávky. | Nic neučí, latence se sluchátky, zaměření na sdílení a předplatné. |
| **Vocal Pitch Monitor** | Velmi rychlá a přesná živá křivka hlasu, rolování historie, nastavitelná stupnice, bourdon. | Jen nástroj – bez kurzu a hodnocení, chybí motivace. |
| **SingTrue** | Sluchový trénink (slyš → zazpívej), krátké hry na trefení tónu, postupná obtížnost. | Málo písní, pouze iOS. |

## Co Zpívánky převzaly a proč

1. **Profil hlasu + pracovní tónina (Riyaz).** Cvičení i písně se automaticky posunou do tvého pohodlného rozsahu. Bez toho začátečník buď tlačí, nebo „bručí“. Typ hlasu určujeme jen z měření, nikdy z pohlaví.
2. **Noty jako pruhy na mřížce výšek se slabikou pod nimi + živá křivka hlasu (Riyaz, Simply Sing).** Okamžitě vidíš, kam tón míří. Křivka je obarvená podle přesnosti a navíc má tvar/symbol (▲ příliš vysoko, ▼ příliš nízko, ● přesně), aby to nezáviselo jen na barvě.
3. **Skóre po frázích a graf odchylek po notách (Riyaz „Know exactly what to fix“).** Plus jedna konkrétní rada, na co se zaměřit – ne deset najednou.
4. **Rozezpívka posouvaná po půltónech (Erol Singer's Studio, Vanido).** Klasický postup učitelů zpěvu; nikdy však nad tvůj změřený rozsah.
5. **Krátký denní trénink na jedno ťuknutí (Vanido, Yousician).** 5 / 10 / 20 minut: rozezpívka → aktuální lekce → píseň, s ohledem na tvé slabé noty a intervaly.
6. **Kurz po kapitolách s hvězdičkami a odemykáním (Yousician, Riyaz).** Lze ale přeskočit – nikdo tě nezdržuje.
7. **Sluchový trénink „slyš → zazpívej“ a poznávání intervalů (SingTrue, Singing Carrots).** Čistý zpěv začíná u ucha.
8. **Rychlá ladička s historií křivky a bourdonem (Vocal Pitch Monitor).** Ladička je hned po spuštění připravená.
9. **„Too high / Too low“ značky a karaoke řádek se zvýrazněnou slabikou (Simply Sing).**
10. **Změna tempa, smyčka fráze, „čekej na mě“ (Yousician, Simply Sing).** Učení po kouscích.

## Čeho se vyvarujeme (časté stížnosti)

- **Předplatné, reklamy, účty** → nic z toho; vše běží v telefonu, data nikam neodcházejí.
- **Nepřesná detekce hlubokých hlasů** → detektor testovaný od C2 (65 Hz) do C6 se syntetickými hlasy s alikvotami; oktávové chyby potlačené sledováním (trackerem).
- **Zpoždění s Bluetooth sluchátky** → kalibrace zpoždění pro každá sluchátka zvlášť a doporučení „poslech přes sluchátka, mikrofon telefonu“, aby Android nepřepnul sluchátka do hovorového režimu (horší kvalita).
- **Nespravedlivé hodnocení** → nastavitelná přísnost (±50 / ±25 / ±10 centů), zpěv o oktávu níž/výš se počítá jako správně, ignorujeme nádechy a souhlásky na začátku tónu.
- **Málo vysvětlení techniky** → každá lekce má 2–4 věty srozumitelného vysvětlení a ukázku.
- **Opakovanost** → generovaná cvičení v různých tóninách, 50 lekcí, 24 písní ve 4 úrovních, vlastní písně.
- **Malé ovládací prvky** → velké cíle pro palec (min. 48 px), důležité tlačítko vždy dole.

## Čím jsou Zpívánky jiné

- Česky, s českým značením not (H, B = B♭) a solmizací jako volbou.
- Plně offline a soukromé, záloha jedním souborem.
- Diagnostika pro ladění (surový signál, frekvence, zpoždění) – když něco nefunguje, je vidět proč.
- Bezpečnost hlasu: připomínky pití a pauz, varování při chraptění, žádné cvičení nad změřený rozsah.
