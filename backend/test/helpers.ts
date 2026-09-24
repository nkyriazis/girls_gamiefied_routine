import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { after } from 'node:test';

/** A fresh temp directory, removed when the test file finishes. */
export function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'routine-test-'));
  after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
