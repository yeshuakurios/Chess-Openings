# What a ~1000 opponent plays against our lines

Source: Maia-1100 (a network trained to predict human moves at that rating), queried for every opponent move in every line with `scripts/maia/` (setup in `scripts/maia/README.md`). Numbers are the chance the move is played in that position, rounded. Maia 1100 is the closest net to a 1000 player; treat the numbers as a guide, not exact. Lichess game statistics for the same rating were not reachable from the sandbox (host blocked), so this is a model, not a count.

## Main finding
At this level opponents leave our scripted lines almost at once, and the **entry points** of our Black repertoires are rarer than the lines themselves. The scripted lines are mostly fine as models of play, but we do not yet cover the replies a 1000 player is most likely to choose.

## Bird's Opening (we play White)
After 1.f4 Black plays: d5 31%, e6 12%, Nf6 8%, Nc6 7%, c5 7%, e5 7%, f5 6%, d6 5%, g6 5%.
Our seven lines answer d5, e6, Nf6, c5, e5 and g6, about 70% of games. **Not covered:** Nc6 7%, f5 6%, d6 5%.
After 1...d5 2.Nf3 Black plays Nc6 25% (**the most common reply, not covered**), Nf6 13% (our main line), e6 12%, c5 8%.
After 1...d5 2.Nf3 Nf6 3.e3: Nc6 24%, Bg4 16%, e6 13%, c5 9%, g6 5%. Replies scatter, so expect the unexpected from move 3.

## Budapest Gambit (we play Black)
It only arises if White plays 2.c4 after 1.d4 Nf6 (22%; Nf3 13%, Nc3 12%, Bf4 12% are the alternatives), and after 2...e5 White accepts with 3.dxe5 only 28% of the time: e3 19%, Nc3 15%, d5 13%. **We have no lines against 3.e3, 3.Nc3 or 3.d5.**
After 3.dxe5 Ng4: 4.Nf3 26% (our Adler line), 4.f4 15% (**not covered**), 4.Bf4 10% (our Rubinstein line), 4.h3 9% (**not covered**).
After 4.Bf4 Nc6 5.Nf3 Bb4+: 6.Nc3 51% (**not covered**), 6.Nbd2 29% (our line).

## Portuguese Gambit / Scandinavian (we play Black)
1.e4 d5: 2.exd5 only 33%; 2.e5 18%, 2.Nc3 11%, 2.d3 7% (**none covered**).
After 2.exd5 Nf6: **3.Nc3 43%, 3.c4 18%, 3.Bc4 9%, 3.d4 only 5%.** The gambit lines we teach start with 3.d4, so they will rarely appear. This is the biggest gap in the app.
After 3.d4 Bg4: 4.f3 42%, 4.Be2 22%, 4.Nf3 17% (all three covered).

## Coverage after the first round of new lines (added in the same session)
- Bird after 1.f4: now answers d5, e6, Nf6, c5, e5, g6, f5 and d6, about 81% of replies (still missing Nc6 7%). After 1...d5 2.Nf3 it now answers Nf6 13% and Nc6 25% (38% of that node; e6 12% and c5 8% remain).
- Budapest after 2...e5: answers 3.dxe5 28%, 3.e3 19%, 3.Nc3 15% and 3.d5 13%, about 75%. Still missing 4.f4 15% and 4.h3 9% after 3.dxe5 Ng4, and 6.Nc3 51% after 4.Bf4 Nc6 5.Nf3 Bb4+.
- Scandinavian after 2.exd5 Nf6: answers 3.Nc3 43%, 3.c4 18% and 3.d4 5%, about 66%. Still missing 3.Bc4 9%, and the 2.e5 18% and 2.Nc3 11% branches.

## Still to build, ranked
1. Scandinavian: 2.e5 and 2.Nc3, then 3.Bc4. (Black)
2. Budapest: 4.f4, 4.h3, and 6.Nc3 in the Rubinstein line. (Black)
3. Bird: 1...Nc6, and more answers once Black deviates at move 3. (White)
4. Re-run `scripts/maia/` after adding lines to see the new coverage.
