// Authoring data for `Variation.plan` (3 steps, each with its drawing). Re-running replaces every plan; edit the PLANS table and run `npx tsx scripts/add-plans.ts`.
// Plain-language text only (no squares, no move notation); the drawings carry the squares. Colours: g green = your plan, b blue = pressure, r red = target/danger, y yellow = key square.
import { writeFileSync } from 'node:fs';
import { listContentFiles, loadOpening, type Shape } from './shared.ts';

const C = { g: 'green', b: 'blue', r: 'red', y: 'yellow' } as const;
/** 'f3e5g' = arrow f3→e5 in green; 'e5y' = ring on e5 in yellow. */
const sh = (s: string): Shape => (s.length === 5 ? { from: s.slice(0, 2), to: s.slice(2, 4), color: C[s[4] as 'g'] } : { from: s.slice(0, 2), color: C[s[2] as 'g'] });
type Step = [string, string]; // [text, 'shape shape ...']
const PLANS: Record<string, Step[]> = {
  // ---------- Bird ----------
  'bird/main-d5': [
    ['Aim the knight and the long-diagonal bishop at the key central square, then jump the knight there.', 'f3e5g b2e5b e5y'],
    ['Play the d-pawn up one step and bring the last knight out behind it.', 'd2d3g b1d2b'],
    ['Swing the queen toward the king side and keep the pawns in front of your king solid.', 'd1e1g g8r'],
  ],
  'bird/froms-gambit': [
    ['Finish development first: knight out and the king-side bishop to its long diagonal.', 'b1c3g f1g2g'],
    ['Trade off the bishop that eyes your king-side pawns.', 'c1f4r d6r'],
    ['Keep the king in the middle until the attack is blunted. The extra pawn decides later.', 'e1y g4r'],
  ],
  'bird/vs-nf6': [
    ['Use the pawn wedge for space: bring the knight out, then push the e-pawn.', 'b1c3g e3e4g'],
    ['Develop the dark-squared bishop on a useful diagonal to support the center.', 'c1d2b'],
    ['Swing the queen toward the king side and lift a rook once the center is set.', 'd1e1g g8r'],
  ],
  'bird/main-d5-c5': [
    ['Aim the knight and the long-diagonal bishop at the key central square, then jump the knight there.', 'f3e5g b2e5b e5y'],
    ['If Black pushes the center pawn to cramp you, answer with a side-pawn lever.', 'c2c4g d4r'],
    ['Trade off the king-side defenders, then bring the queen over to attack.', 'd1e1g f6r e7r'],
  ],
  'bird/vs-c5': [
    ['Aim the knight and the long-diagonal bishop at the key central square, then jump the knight there.', 'f3e5g b2e5b e5y'],
    ['If Black pushes the center pawn to cramp you, answer with a side-pawn lever.', 'c2c4g d4r'],
    ['Trade off the king-side defenders, then bring the queen over to attack.', 'd1e1g f6r e7r'],
  ],
  'bird/vs-g6': [
    ['Decide the center: support the pawn that was just hit, or trade it and open lines.', 'c2c3g d4y'],
    ['Bring the other knight out and control the key central square with pawns and pieces.', 'b1c3g'],
    ['Once the center is settled, start play on the king side with the queen.', 'd1e1g g7r'],
  ],
  'bird/vs-e6': [
    ['Plant a knight on the key central square, backed by the long-diagonal bishop.', 'f3e5g b2e5b e5y'],
    ['Aim the bishop at the king side and bring the queen over for an attack.', 'd3h7y d1e1g'],
    ['Watch for Black’s central pawn break and answer it with the other knight.', 'b1c3g c5r'],
  ],
  'bird/main-d5-nc6': [
    ['Count the attackers and defenders on the f-pawn and keep it defended.', 'd6f4r e3f4b f4y'],
    ['If Black trades the bishop for your knight, you get the bishop pair. Open the position later.', 'g4f3r'],
    ['Develop the long-diagonal bishop and take control of the key central square.', 'c1b2g f3e5g'],
  ],
  'bird/vs-f5': [
    ['Expand in the center with a pawn before Black does.', 'c2c4g'],
    ['Bring the other knight out to the third rank.', 'b1c3g'],
    ['Swing the queen to the king side, but do not weaken your queen side.', 'd1e1g b2y'],
  ],
  'bird/vs-d6': [
    ['Decide the center: support the pawn that was just hit, or trade it and open lines.', 'c2c3g d4y'],
    ['Bring the other knight out and control the key central square with pawns and pieces.', 'b1c3g'],
    ['Once the center is settled, start play on the king side with the queen.', 'd1e1g g7r'],
  ],
  'bird/vs-nc6': [
    ['Challenge Black’s central pawn with a side-pawn lever.', 'c2c4g d5r'],
    ['Keep the long-diagonal bishop on the center and jump the knight to the key square.', 'f3e5g b2e5b'],
    ['Swing the queen to the king side and trade rather than let Black’s pawn break cramp you.', 'd1e1g'],
  ],
  'bird/d5-bf5': [
    ['Aim a knight at Black’s outside bishop to challenge it or force it away.', 'f3h4g f5r'],
    ['Take the long diagonal with your bishop and control the key central square.', 'c1b2g e5y'],
    ['Push a pawn to gain space once the bishop has been dealt with.', 'c2c4g'],
  ],
  'bird/d5-e6': [
    ['Plant a knight on the key central square, backed by the long-diagonal bishop.', 'f3e5g b2e5b e5y'],
    ['Aim the bishop at the king side and swing the queen over to attack.', 'd3h7y d1e1g'],
    ['Do not rush the center pawn forward where Black can hit it. Break only when your pieces are ready.', 'd4r'],
  ],
  // ---------- Budapest Gambit ----------
  'budapest-gambit/bf4-rubinstein': [
    ['Keep the pin on the knight so White cannot finish developing comfortably.', 'b4d2r d2r'],
    ['Castle and bring a rook to the center.', 'e8g8g'],
    ['Keep both knights in the center. Trade the bishop for the pinned knight only if it costs White something.', 'e5y c6y'],
  ],
  'budapest-gambit/nf3-adler': [
    ['Develop the bishop and castle so the king is safe.', 'f8e7g e8g8g'],
    ['Undermine White’s big center with the d-pawn and the knight’s pressure.', 'd7d6g e5c4y'],
    ['If White kicks the knight with a pawn, retreat it to a good square.', 'e5g6b'],
  ],
  'budapest-gambit/a3-trap': [
    ['The queen pins White’s e-pawn against the king. It cannot capture.', 'e7e1r'],
    ['The knight jumps next to the king with check. White’s own pieces block every escape.', 'd3r e1r'],
    ['If White never falls for it, the normal plan applies: castle and keep the knights active.', 'e8g8g c6y'],
  ],
  'budapest-gambit/e3-declined': [
    ['Trade pieces. Fewer pieces means fewer attacking chances for White.', 'd5c3y'],
    ['Keep a knight directly in front of White’s isolated pawn as a blockade.', 'd5y'],
    ['Attack the isolated pawn with your other pieces and head for a better endgame.', 'e7f6g d4r'],
  ],
  'budapest-gambit/nc3-declined': [
    ['Pressure White’s center pawn along the open file with the rook.', 'e8e3r'],
    ['Keep the bishop pinning the knight so White cannot develop in peace.', 'b4c3r'],
    ['Prepare a central pawn break while White’s king is still in the middle.', 'd7d5g e1y'],
  ],
  'budapest-gambit/d5-declined': [
    ['Put a knight on the outpost.', 'd7c5g'],
    ['Challenge White’s space with a side-pawn push.', 'c7c6g'],
    ['Prepare the king-side pawn break to gain room and hit the center.', 'f7f5g e4r'],
  ],
  'budapest-gambit/bf4-declined': [
    ['Offer a bishop trade. White’s recapture opens a file and pulls a pawn off the center.', 'd6f4r f4y'],
    ['Castle, then keep pressure on the center with a pawn and a knight.', 'e8g8g c5d4b'],
    ['Open the center with a pawn break once the pieces are developed.', 'e6e5g d8b6g'],
  ],
  'budapest-gambit/nf3-declined': [
    ['Decide about the queens: keep them on, or trade them for an open file.', 'b6b3r'],
    ['Develop the rest of the pieces calmly.', 'e7e6g f8e7g'],
    ['Watch White’s central pawn break and use your extra queen-side space.', 'e4r b7b5g'],
  ],
  // ---------- Modern Defence ----------
  'modern-defence/e4-classical': [
    ['Prepare the break: bring the knight and bishop to useful squares.', 'b8d7g c8e6g'],
    ['Strike at White’s center with a pawn break. Pick the one that fits where White’s pieces stand.', 'e7e5g d6d5g'],
    ['Let the long-diagonal bishop come alive once the pawns are traded.', 'g7d4b d4r'],
  ],
  'modern-defence/e4-austrian': [
    ['Castle quickly. White’s king is not safe yet, but yours must be.', 'e8g8g'],
    ['Develop the queen-side knight and aim at White’s e-pawn.', 'b8c6g f6e4b'],
    ['White wants to push the e-pawn to kick your knight. Use the loosened king side as a target.', 'e4e5r c5f2r e1r'],
  ],
  'modern-defence/e4-c4': [
    ['Break with the e-pawn when your pieces are ready.', 'e7e5g'],
    ['Keep the knight pressing White’s d-pawn. The long-diagonal bishop joins in later.', 'c6d4b d4y'],
    ['If White castles on the queen side, storm it with pawns. Keep your long-diagonal bishop.', 'a7a5g g7y'],
  ],
  'modern-defence/e4-bc4': [
    ['Push the d-pawn to challenge the bishop and the e-pawn.', 'd6d5g'],
    ['Develop the last pieces and keep the position flexible.', 'b8d7g c8e6g'],
    ['Watch White’s bishop on the king-side diagonal. It has little to hit once you have castled.', 'c4f7r'],
  ],
  'modern-defence/e4-nc3': [
    ['Your long-diagonal bishop already hits the queen-side. Keep it open.', 'g7b2b'],
    ['Break in the center with the e-pawn when you are ready.', 'e7e5g'],
    ['Finish development: knight out and the other bishop active.', 'b8d7g c8f5g e4r'],
  ],
  'modern-defence/d4-c4': [
    ['Decide whether to trade pawns in the center or keep it closed.', 'e5d4b d4y'],
    ['If the center locks, attack White’s king with the f-pawn push.', 'f7f5g'],
    ['Use the knights on outposts and keep the long-diagonal bishop flexible.', 'b8c6g f6d7g'],
  ],
  'modern-defence/d4-london': [
    ['Challenge White’s bishop and center with the e-pawn push.', 'e7e5g f4y'],
    ['Or hit the center with the c-pawn push.', 'c7c5g'],
    ['If the bishop retreats, take the extra space and keep the pieces coordinated.', 'g7d4b'],
  ],
  'modern-defence/nf3-g3': [
    ['Support the center pawns with the knights and the c-pawn.', 'b8c6g c7c6g'],
    ['Expand with the f-pawn push.', 'f7f5g'],
    ['White’s long-diagonal bishop eyes your queen side. Keep your pieces coordinated there.', 'g2b7y'],
  ],
  'modern-defence/c4-nc3': [
    ['Develop the last knight and castle.', 'g8e7g e8g8g'],
    ['Prepare the d-pawn push to claim space in the center.', 'd7d5g'],
    ['Keep the long-diagonal bishop open. It is your best piece.', 'g7c3b'],
  ],
  // ---------- Portuguese Gambit ----------
  'portuguese-gambit/f3-bf5': [
    ['Attack White’s center pawn with the knight.', 'c6d4y d4y'],
    ['Open the e-file by pushing the e-pawn.', 'e7e5g'],
    ['White’s king is still in the middle. Strike before White consolidates.', 'e1r f5c2r'],
  ],
  'portuguese-gambit/nf3-nxd5': [
    ['Trade the light-squared bishop for a knight if it helps.', 'g4f3r'],
    ['Castle, then pressure the center pawn.', 'e8g8g'],
    ['Challenge the center with a knight and a side pawn.', 'b8c6g c7c5g'],
  ],
  'portuguese-gambit/be2-bxe2': [
    ['The kings are on opposite sides. Push the king-side pawns toward White’s king.', 'g7g5g h7h5g'],
    ['Pressure the central pawn with the knight and the rook.', 'c6d4y d8d4b'],
    ['Keep the queen safe from tempo-gaining attacks.', 'd5y'],
  ],
  'portuguese-gambit/nf3-bxf3': [
    ['Aim the knights at the weak squares in front of White’s doubled pawns.', 'f6d5g f3y'],
    ['Welcome trades, including queens. The doubled pawns matter more in an endgame.', 'a5c3r'],
    ['White has the bishop pair, so close the position when you can.', 'c7c5g'],
  ],
  'portuguese-gambit/nc3-nxd5': [
    ['Trade a pair of knights to ease White’s space advantage.', 'd5c3r'],
    ['Castle and keep your pieces compact.', 'e8g8g g4f3r'],
    ['Pressure White’s central pawn with a knight and a side pawn.', 'c6d4b c7c5g'],
  ],
  'portuguese-gambit/c4-c6': [
    ['Develop the bishop with tempo on White’s pawn.', 'c8e6g c4r'],
    ['Castle and bring the rest of the pieces out.', 'f8e7g e8g8g'],
    ['You are a piece up for a pawn. Trade pieces to convert.', 'd4y e4y'],
  ],
  'portuguese-gambit/nxd5-qxd5': [
    ['Castle and build behind the queen.', 'e8g8g'],
    ['Challenge the center with a pawn break and the knights.', 'e6e5g c6b4g'],
    ['White’s c-pawn push can gain time on the queen. Know where it retreats.', 'c4r d5y'],
  ],
  'portuguese-gambit/e5-bf5': [
    ['Hit the base of White’s pawn chain with the side pawn and the knights.', 'c5d4g c6d4b'],
    ['Then challenge the head of the chain with the f-pawn break.', 'f7f6g e5r'],
    ['Keep the light-squared bishop outside the chain, where it is active.', 'f5y'],
  ],
  'portuguese-gambit/nc3-d4': [
    ['Keep the center locked so White’s pieces have less room.', 'd4y e5y'],
    ['Bring the knights to good squares.', 'b8d7g'],
    ['Pick a break: the f-pawn or a side pawn push. Keep the f-pawn defended against the bishop.', 'f7f5g c7c5g f7r'],
  ],
};

let n = 0;
for (const file of listContentFiles()) {
  const o = loadOpening(file);
  for (const v of o.variations) {
    const steps = PLANS[`${o.id}/${v.id}`];
    if (!steps) { console.error(`no plan for ${o.id}/${v.id}`); process.exitCode = 1; continue; }
    v.plan = { steps: steps.map(([text, shapes]) => ({ text, shapes: shapes.split(' ').map(sh) })) };
    n++;
  }
  writeFileSync(file, JSON.stringify(o, null, 2) + '\n');
}
console.log(`wrote ${n} plans`);
