kim-vocal-2.onnx – model MDX-Net „Kim_Vocal_2“ pro oddělení zpěvu od doprovodu.
Autorka modelu: KimberleyJensen; model se volně šíří jako součást projektu Ultimate Vocal Remover
(https://github.com/Anjok07/ultimatevocalremovergui, software pod licencí MIT; modely z UVR model_repo).
Úprava pro Zpívánky: váhy uložené jako float16 (výpočet zůstává ve float32), velikost 33 MB místo 67 MB;
rozdíl výstupu proti originálu −68 dB (neslyšitelný). Vstup/výstup [1, 4, 3072, 256] (L/P reálná/imaginární
složka STFT, n_fft 7680, hop 1024, 44,1 kHz). Samostatnou licenci modelu autorka neuvádí – Zpívánky ho
používají jen pro osobní nekomerční cvičení, model se stahuje do telefonu až na vyžádání (Import → Přesně).
