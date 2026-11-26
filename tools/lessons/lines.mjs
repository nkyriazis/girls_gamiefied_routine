// What the owl says in a lesson (shared/lessons.ts spokenLines), as JSON, for voice.py.
//   node tools/lessons/lines.mjs <package dir>
import fs from 'node:fs';
import path from 'node:path';
import { spokenLines } from '../../shared/lessons.ts';

const lesson = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'lesson.json'), 'utf8'));
process.stdout.write(JSON.stringify(spokenLines(lesson), null, 1));
