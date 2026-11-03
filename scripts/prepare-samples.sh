#!/usr/bin/env bash
# Připraví zvukové vzorky nástrojů z npm balíčků do docs/samples (mono Ogg Opus, ořezané ticho na začátku).
# Zdroje: @audio-samples/piano-mp3-velocity8 (Salamander Grand Piano V3, Alexander Holm, CC-BY 3.0),
#         tonejs-instrument-guitar-acoustic-mp3, tonejs-instrument-bass-electric-mp3 (tonejs-instruments, nbrosowsky, CC-BY 3.0 / MIT).
set -euo pipefail
SRC="${1:?cesta ke složce s rozbalenými balíčky}"
OUT="$(dirname "$0")/../docs/samples"
enc() { # in out seconds
  ffmpeg -loglevel error -y -i "$1" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0,atrim=0:$3,afade=t=out:st=$(echo "$3-0.6" | bc):d=0.6,pan=mono|c0=0.5*c0+0.5*c1" -ar 48000 -c:a libopus -b:a 48k "$2"
}
P="$SRC/x_audio-samples-piano-mp3-velocity8-1.0.5/package/audio"
for n in A1 C2 D#2 F#2 A2 C3 D#3 F#3 A3 C4 D#4 F#4 A4 C5 D#5 F#5 A5 C6 D#6 F#6 A6 C7; do
  o="${n/\#/s}"; enc "$P/${n}v8.mp3" "$OUT/piano/$o.ogg" 4.5; done
G="$SRC/x_tonejs-instrument-guitar-acoustic-mp3-1.1.2/package"
for n in E2 G2 As2 Cs3 E3 G3 As3 Cs4 E4 G4; do enc "$G/$n.mp3" "$OUT/guitar/$n.ogg" 3.0; done
B="$SRC/x_tonejs-instrument-bass-electric-mp3-1.1.2/package"
for n in E1 G1 As1 Cs2 E2 G2 As2 Cs3 E3 G3 As3; do enc "$B/$n.mp3" "$OUT/bass/$n.ogg" 2.5; done
