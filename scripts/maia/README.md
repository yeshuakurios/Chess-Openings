# Human-like opponent replies (Maia)

Not part of the app, CI or `npm test`. A dev tool that asks [Maia](https://github.com/CSSLab/maia-chess), a network trained to predict what humans of a given rating play, how likely each reply is in every opponent position of our lines. Result summary: `docs/opponent-replies-1100.md`.

## Setup (about 10 minutes, CPU only)
1. Build lc0 with the OpenBLAS backend: `git clone --recurse-submodules https://github.com/LeelaChessZero/lc0.git`, `pip install meson`, `apt-get install libopenblas-dev`, then
   `meson setup build/release --buildtype release -Dblas=true -Dopenblas=true -Dgtest=false -Dcudnn=false -Dplain_cuda=false -Dopencl=false -Dispc=false -Dnative_cuda=false -Dopenblas_include=/usr/include/x86_64-linux-gnu/openblas-pthread -Dopenblas_libdirs=/usr/lib/x86_64-linux-gnu/openblas-pthread` and `ninja -C build/release lc0`.
2. Download a net from the maia-chess releases page (`maia-1100.pb.gz`; nets exist for 1100 to 1900).
3. Put the `lc0` binary and the net in one folder and set `MAIA_DIR` to it.

## Use
`MAIA_DIR=... node scripts/maia/analyse.mjs replies.json` writes, for every opponent move in every line, Maia's probability of the scripted move and the top alternatives (one network evaluation per position, under a second in total).
`node scripts/maia/steps.mjs replies.json` prints it move by move.

Limits: Maia 1100 is the closest net to a 1000 player but not the same; it was trained on 2019 online games and predicts a single move about half the time, so read the numbers as a rough guide.
