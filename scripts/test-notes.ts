import assert from 'node:assert/strict';
import { mergeNotes, parseNotes, unsynced } from '../src/notes.ts';
const raw = `ignore me\nEXPLANATION bird/main-d5#4\nLine one.\nLine two.\n\nEXPLANATION bird/main-d5#6   \nSecond.\nEXPLANATION bad id here\nnope\nEXPLANATION bird/x#1\n   \nEXPLANATION bird/main-d5#4\nReplaced.`;
assert.deepEqual(parseNotes(raw), [{ k: 'bird/main-d5#4', text: 'Replaced.' }, { k: 'bird/main-d5#6', text: 'Second.' }]); // bad header and empty body dropped, repeat keeps the last
assert.equal(parseNotes('EXPLANATION a/b#1\n' + 'z'.repeat(5000))[0].text.length, 1000);
assert.deepEqual(parseNotes('no headers at all'), []);
const a = { 'a/b#1': { text: 'old', t: 1 }, 'a/b#2': { text: 'only a', t: 5 } }, b = { 'a/b#1': { text: 'new', t: 2 }, 'a/b#3': { text: 'only b', t: 1 } };
assert.deepEqual(Object.fromEntries(Object.entries(mergeNotes(a, b)).map(([k, n]) => [k, n.text])), { 'a/b#1': 'new', 'a/b#2': 'only a', 'a/b#3': 'only b' });
assert.deepEqual(unsynced(a, 1).map(x => x.k), ['a/b#2']); // only what changed after the last push
console.log('✓ notes ok');
