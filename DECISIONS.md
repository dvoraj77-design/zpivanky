# Rozhodnutí

Každé rozhodnutí, které zadání neřešilo, jednou větou.

1. **Hostování**: GitHub Pages z větve `main`, složka `/docs` (dle odpovědi); vývoj probíhá ve větvi `claude/tender-ramanujan-mxr346` a do `main` se slučuje.
2. **Bez sestavovacího kroku**: aplikace je v čistých ES modulech + Preact/htm (13 kB, přibaleno), aby se dala snadno opravovat a nic se nenačítalo z cizích serverů.
3. **Detektor výšky**: YIN (kumulativní normovaný rozdíl) počítaný přes FFT v AudioWorkletu, okno ~43 ms, krok ~10 ms; tracker s mediánem, hysterezí hlasu a potlačením oktávových skoků.
4. **Zvuky nástrojů**: přibalené vzorky Salamander Grand Piano (CC-BY 3.0) a tonejs-instruments kytara/basa, převedené do mono Ogg Opus (celkem ~1 MB); vodicí hlas, bourdon a metronom se syntetizují.
5. **Tempo beze změny výšky**: doprovod se generuje z not, takže změna tempa výšku nikdy nemění.
6. **Bluetooth sluchátka (Nothing Ear (a))**: když web použije Bluetooth mikrofon, Android přepne sluchátka do hovorového profilu (SCO: mono, nízká kvalita) – proto doporučujeme poslouchat přes sluchátka a zpívat do mikrofonu telefonu; zapni v aplikaci Nothing X „Low Lag Mode“ (výrobce uvádí < 120 ms) a proveď kalibraci zpoždění.
7. **Výběr výstupu**: Chrome na Androidu neumí z webu přepnout zvukový výstup, proto aplikace výstup jen zobrazuje (podle zařízení a profilu sluchátek) a výběr dělá Android.
8. **Profily sluchátek**: web nezjistí, která Bluetooth sluchátka jsou připojená, proto si profil (název + zpoždění) vybíráš ručně; návrh názvu se bere z popisku mikrofonu.
9. **Výchozí profil hlasu před testem**: hluboký mužský hlas G2–E4 (dle odpovědi), aplikace jej po testu přepíše změřenými hodnotami.
10. **Typ hlasu**: určen jen z měřeného rozsahu, tessitury a mluvené výšky; názvy (bas, baryton, tenor, alt, mezzosoprán, soprán) jsou popisy rozsahu, ne pohlaví.
11. **Pracovní tónina**: tónika („do“) je nejnižší pohodlný tón + 2 půltóny, aby se do pohodlného rozsahu vešla stupnice do–sol a arpeggio; zobrazení např. „B · baryton“.
12. **Značení not**: výchozí české (C D E F G A H, B = B♭, Cis, Es…), oktávy vědecky (A4 = 440 Hz); solmizace je pohyblivé „do“ v tónině cvičení/písně, v ladičce je „do“ = C.
13. **Hodnocení**: tón je „přesně“, když medián odchylky leží v toleranci přísnosti; skóre noty kombinuje podíl času v toleranci (60 %), průměrnou odchylku (25 %) a včasnost nástupu (15 %); první 120 ms tónu se do přesnosti nepočítá (nasazení).
14. **Oktáva**: při hodnocení výšky se odchylka počítá modulo oktáva, ale do statistik se ukládá skutečně zpívaná výška.
15. **Hvězdičky**: 1★ ≥ 50 bodů, 2★ ≥ 70, 3★ ≥ 85; lekce se odemyká od 1★, ale lze ji přeskočit.
16. **Úložiště**: IndexedDB pro data a nahrávky (mono 16 bit 24 kHz), localStorage pro nastavení; po prvním spuštění se žádá o trvalé úložiště (`navigator.storage.persist`).
17. **Nahrávky**: ukládá se posledních 60 pokusů s nahrávkou (starší bez označení ★ se mažou), export do WAV (mono 32 kHz, hlas + doprovod).
18. **Lidové písně**: použity jen melodie, které jsou bezpečně autorsky volné; texty jsou vlastní nebo lidové; všechny ostatní melodie jsou původní.
19. **APK**: Chrome při „Přidat na plochu“ sám vytvoří a nainstaluje WebAPK (ikona v seznamu aplikací, celá obrazovka), proto samostatné APK není nutné.
20. **Testování mikrofonu**: kromě falešného zařízení Chromia (`--use-file-for-fake-audio-capture`) má aplikace testovací vstup, který přehraje vygenerovanou nahrávku synchronně se začátkem cvičení – jen tak jde přesně ověřit pozdní nástup.
21. **Vzhled**: na přání uživatele během vývoje změněn z tmavě fialového na světlý pastelový (teplé světlé pozadí, bílé karty s jemným stínem, mátová / nebesky modrá / broskvová / levandulová / máslová); přesnost se dál značí barvou i tvarem (● ▲ ▼ ✕). Paleta je na jednom místě (`docs/js/ui/theme.js` + `:root` v `css/app.css`).
22. **Automatická tónina písní** hledá posun v rozsahu ±24 půltónů (vestavěné písně jsou zapsané v libovolné výšce), ruční doladění je ±12 půltónů od doporučené.
23. **Nástup u opakovaného stejného tónu** se nehodnotí (nejde spolehlivě odlišit od pokračování předchozího tónu); hodnotí se jen výška.
24. **Bez sluchátek** se písně automaticky přehrávají v režimu „poslechni → zazpívej“ a cvičení mají napřed ukázku; aplikace pozná reproduktor podle zvoleného profilu, testem „Slyší mikrofon doprovod?“ a nabídne přepnutí.
25. **Detekce běží ve Web Workeru**, ne přímo ve zvukovém vlákně, aby výpočet nikdy nezpůsobil praskání doprovodu na pomalejším telefonu.
26. **Šumové pozadí** se odhaduje jen z neperiodických snímků (šum, nádech, souhlásky), aby se při dlouhém souvislém zpěvu nezvedalo k hlasitosti hlasu; prah periodicity snížen na 0,7 a hlasitost nad šumem na 8 dB (ověřeno realistickým zpěvákem s ozvěnou, šumem ventilátoru a 16kHz Bluetooth mikrofonem).
27. **Průsak doprovodu do mikrofonu** do −28 dB hodnocení nevadí; silnější (reproduktor) ano – proto režim „poslechni → zazpívej“ a test „Slyší mikrofon doprovod?“.
28. **Režimy písní zjednodušeny na 3** (na přání): Zpívat (doprovod nonstop, vodicí melodie velkým tlačítkem ON/OFF, výchozí ON), Nacvičit frázi (smyčka jedné fráze, šipky na další, volitelně „čekat na tón“), Poslech. Režimy „poslechni → zazpívej“ a „čekej na mě“ jako samostatné odstraněny; bez sluchátek aplikace jen upozorní, nic nepřepíná.
29. **Průběžné skóre fráze** se ukáže hned po jejím dozpívání (bublina + barva proužku).
30. **Export z archivu**: jen hlas, hlas s doprovodem, nebo balíček pro ladění (hlas + křivka + cíle + nastavení) – pro vzdálené ladění hodnocení.
31. **Import písní (fáze 2) běží celý v telefonu**: nic se neodesílá na server; jediný síťový požadavek je volitelné dohledání textu na lrclib.net (název, interpret, délka písně) a jednorázové stažení modelu z vlastní adresy aplikace.
32. **Spotify / YouTube**: zvuk je chráněný (DRM), webová aplikace ho nemůže stáhnout ani nahrát z telefonu – proto import ze souboru a nahrání mikrofonem z jiného zařízení.
33. **Model pro „Přesně“**: MDX-Net Kim_Vocal_2 (UVR) místo HTDemucs – menší (33 MB po uložení vah ve float16, rozdíl výstupu −68 dB), na zpěv přesnější; ONNX Runtime Web 1.20.1 (MIT) s WebGPU a WASM (SIMD, vlákna). Softwarová náhrada grafického čipu se nepoužije (byla by pomalejší než procesor); když grafický čip vrátí nesmysl, přepne se na procesor.
34. **Vícevláknový výpočet na GitHub Pages**: Pages neposílá hlavičky COOP/COEP, proto je přidává service worker ke všem odpovědím (aplikace nepoužívá cizí zdroje, takže izolace nic nerozbije; text z lrclib jde přes CORS).
35. **Model a runtime se nestahují při instalaci** (nejsou v seznamu pro offline režim), ale až při prvním „Přesně“ do cache `zp-models-v1`; aktualizace aplikace je nesmaže.
36. **Melodie z rychlého oddělení**: rychlá maska nechává ve „zpěvu“ basu a bicí uprostřed, detektor výšky pak sledoval basu (9/38 not) → harmonická salience s potlačením basového pásma a Viterbiho výběrem (26/38, 35/35, 38/42 not na testovacích směsích). Na čistém zpěvu z modelu zůstává přesný detektor (salience by u hlubokého mužského hlasu dělala oktávové chyby – ověřeno na skutečné nahrávce).
37. **Oktávové chyby přepisu**: osamocený tón víc než 9 půltónů od obou sousedů se posune o oktávu k nim (skutečný oktávový skok melodie zůstane).
38. **Text s časováním** (LRC z lrclib) se rozloží do oken řádků; když do nich padne méně než 60 % not (jiná verze nahrávky, posun), použije se rozdělení podle pauz. České dělení slabik je automatické; text jde kdykoli upravit.
39. **Originální doprovod a tónina**: posouvá se o nejbližší ekvivalent ±6 půltónů (oktáva se nemění – zní přirozeněji); aplikace nabízí i „🎧 originál“ (původní tónina nebo o oktávu), kde se doprovod vůbec nepřevádí.
40. **Ukládání stop**: 16bit PCM v IndexedDB (doprovod stereo 44,1 kHz, původní zpěv mono 22 kHz); originální soubor se neukládá. Do zálohy se stopy nedávají (velikost); po obnovení hraje syntetický doprovod.
41. **Délka importu**: nejvýš 8 minut, lze vybrat úsek; přesný režim ukazuje odhad času podle první části a obrazovka během výpočtu nezhasne.
42. **Import z MP3 je experimentální** (na přání uživatele zachován, ale schovaný v „＋ Přidat → Experimentální“): odhad melodie zpěvu ze zvuku u skutečných nahrávek nebyl použitelný. Hlavní cestou importu je **MIDI / karaoke (.mid, .kar)** – obsahují přesné noty i text.
43. **Komerční písně se do aplikace nepřibalují**: repozitář i web jsou veřejné, šlo by o veřejné šíření chráněných textů a aranží. Uživatel si je naimportuje sám (i hromadně) – zůstanou jen v jeho telefonu.
44. **Výběr melodie z MIDI**: skóre stopy = shoda nástupů s textem (váha 6), jednohlasost, název stopy (melody/vocal/zpěv…), poloha 55–80 MIDI, nástroj (flétna, klarinet, sax… plus, basa a plochy minus). Ze stopy s akordy se bere nejvyšší hlas; místa bez textu (předehra, sóla) se nezpívají.
45. **Akordy z MIDI**: chroma z not doprovodu po dobách + basa → stejné rozpoznávání (šablony + Viterbi) jako u nahrávek; MIDI jen s melodií → harmonizace melodie.
46. **Knihovna**: vestavěné písně v kategoriích Cvičné / Dětské / Lidové / Koledy / Ze světa; jen volná díla. České písně a koledy přepsané z notových zápisů repozitáře mojzis/noticky (CC0), ostatní obecně známé lidové nápěvy. Obtížnost se u skutečných písní určuje z rozsahu melodie; přísná pravidla úrovní (počet tónů, synkopy…) platí jen pro cvičné písně.
47. **Nové nástroje** (tonejs-instruments, CC-BY 3.0): housle, violoncello, flétna, klarinet, saxofon, varhany, klasická kytara – mono Opus 48 kb/s, max. 4 s, držené tóny se smyčkují v ustálené části (celý počet period, průchod nulou). Načítají se až když je píseň použije (paměť telefonu).
48. **Hlasitosti**: zvláštní sběrnice pro melodii, akordy, basu, bicí a metronom (0–160 %); výchozí melodie 110 %, akordy 60 % (melodie v doprovodu zanikala). Volba nástroje vodicí melodie na detailu písně i v přehrávači.
49. **Nácvik fráze po celých taktech**: smyčka od taktové čáry před frází do taktové čáry po ní + jeden volný přípravný takt (hraje doprovod, tiché kliky), plynule dokola v rytmu; vodicí melodie jen pro nacvičovanou frázi.
50. **Hry** (nová záložka místo Ladičky; ladička zůstává na obrazovce Dnes a v Já → Nástroje): 18 her ve skupinách Nauka / Poslech / Zpěv, každá s 5 úrovněmi (Začátečník → Mistr), odemykání od ⭐. Postup podle RESEARCH.md: zvuk před značkou, intervaly po skupinách s opěrnými písněmi z knihovny, solmizace od sol–mi, Leitnerovy krabičky (chyby se vrací častěji), prokládání typů otázek.
51. **Zpívací hry** používají stejný engine jako cvičení (detekce, hodnocení, válec) a přidávají vlastní metriky: rytmus = průměrná odchylka (napřed/pozdě) + pravidelnost (směrodatná odchylka), „Drž tempo“ = metronom po 2 taktech zmlkne a změří se zrychlení/zpomalení, „Rychlá trefa“ = čas do tří snímků v toleranci, „Dlouhý tón“ = kolísání výšky v centech.
52. **Sluchový trénink** z menu Já přesunut do Her (Poslech); menu Já rozděleno do skupin Můj zpěv / Nástroje / Nastavení / Pomoc.
53. **Notová osnova** se kreslí jako SVG (houslový klíč ručně kreslenou křivkou, basový klíč, pomocné linky, posuvky, předznamenání), protože notové znaky Unicode nemusí telefon umět zobrazit.
