// npm test (frontend): node's own runner, on the TypeScript as written (Node strips the types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alarmSoundKey, startAlarmSound } from './alarmSound.ts';
import type { AlarmSounds } from './alarmSound.ts';

// Sounds that only write down what they were asked; fail() is the uploaded file failing to play
function fakeSounds() {
  const heard: string[] = [];
  let onFail: (() => void) | undefined;
  const sounds: AlarmSounds = {
    playWakeUpLoop: () => { heard.push('melody'); },
    stopWakeUpLoop: () => { heard.push('melody off'); },
    playCustomSound: (file: string, _loop: boolean, fail?: () => void) => { heard.push(`upload ${file}`); onFail = fail; },
    stopCustomSound: () => { heard.push('upload off'); },
  };
  return { sounds, heard, fail: () => onFail?.() };
}

test('an alarm with no upload plays the melody until it goes', () => {
  const { sounds, heard } = fakeSounds();
  const stop = startAlarmSound(alarmSoundKey({}), sounds);
  stop();
  assert.deepEqual(heard, ['melody', 'melody off']);
});

test('an uploaded sound that plays is the only sound', () => {
  const { sounds, heard } = fakeSounds();
  const stop = startAlarmSound(alarmSoundKey({ sound: { type: 'upload', value: 'rooster.mp3' } }), sounds);
  stop();
  assert.ok(heard.includes('upload rooster.mp3'));
  assert.ok(!heard.includes('melody'));
});

test('an uploaded sound that fails rings the melody instead, and both stop with the alarm', () => {
  const { sounds, heard, fail } = fakeSounds();
  const stop = startAlarmSound('upload:missing.mp3', sounds);
  fail();
  assert.ok(heard.includes('melody'), `heard: ${heard.join(', ')}`);
  stop();
  assert.ok(heard.includes('melody off') && heard.includes('upload off'), `heard: ${heard.join(', ')}`);
  assert.ok(heard.lastIndexOf('melody off') > heard.indexOf('melody'));
});

test('a failure that comes after the alarm went starts nothing', () => {
  const { sounds, heard, fail } = fakeSounds();
  const stop = startAlarmSound('upload:slow-404.mp3', sounds);
  stop();
  const after = heard.length;
  fail();
  assert.deepEqual(heard.slice(after), []);
  assert.ok(!heard.includes('melody'));
});
