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
