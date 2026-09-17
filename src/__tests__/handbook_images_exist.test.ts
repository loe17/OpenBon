import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Handbook Images Integrity', () => {
  it('should guarantee that every single image referenced in handbook-data.ts exists on disk', () => {
    const handbookPath = path.join(process.cwd(), 'src', 'app', 'docs', 'handbook-data.ts');
    expect(fs.existsSync(handbookPath)).toBe(true);
    const content = fs.readFileSync(handbookPath, 'utf-8');

    const lines = content.split('\n');
    const missing: string[] = [];
    const found: string[] = [];

    lines.forEach((line) => {
      const match = line.match(/src:\s*['"]([^'"]+)['"]/);
      if (match) {
        const relativeSrc = match[1];
        const absolutePath = path.join(process.cwd(), 'public', relativeSrc);
        if (!fs.existsSync(absolutePath)) {
          missing.push(relativeSrc);
        } else {
          found.push(relativeSrc);
        }
      }
    });

    expect(found.length).toBeGreaterThanOrEqual(35);
    expect(missing).toEqual([]);
  });
});
