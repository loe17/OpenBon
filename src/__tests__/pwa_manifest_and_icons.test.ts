import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Manifest & Icon Validation for Chrome / Android App Installation', () => {
  const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
  const swPath = path.join(process.cwd(), 'public', 'sw.js');
  const icon192Path = path.join(process.cwd(), 'public', 'icon-192.png');
  const icon512Path = path.join(process.cwd(), 'public', 'icon-512.png');

  it('validates manifest.json exists and fulfills all PWA installability requirements', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(['fullscreen', 'standalone']).toContain(manifest.display);

    const sizes = manifest.icons.map((i: any) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    const icon192 = manifest.icons.find((i: any) => i.sizes === '192x192');
    expect(icon192).toBeDefined();
    expect(icon192.type).toBe('image/png');
    expect(icon192.purpose).toContain('maskable');

    const icon512 = manifest.icons.find((i: any) => i.sizes === '512x512');
    expect(icon512).toBeDefined();
    expect(icon512.type).toBe('image/png');
    expect(icon512.purpose).toContain('maskable');
  });

  it('validates icon-192.png has exact 192x192 PNG dimensions', () => {
    expect(fs.existsSync(icon192Path)).toBe(true);
    const buf = fs.readFileSync(icon192Path);
    expect(buf.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // PNG signature
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(192);
    expect(height).toBe(192);
  });

  it('validates icon-512.png has exact 512x512 PNG dimensions', () => {
    expect(fs.existsSync(icon512Path)).toBe(true);
    const buf = fs.readFileSync(icon512Path);
    expect(buf.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // PNG signature
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(512);
    expect(height).toBe(512);
  });

  it('validates sw.js precaches the updated icons', () => {
    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain('/icon-192.png');
    expect(swContent).toContain('/icon-512.png');
  });

  it('validates fullscreen-button.tsx implements auto-restore on pointerdown', () => {
    const fsBtnPath = path.join(process.cwd(), 'src', 'components', 'ui', 'fullscreen-button.tsx');
    const content = fs.readFileSync(fsBtnPath, 'utf8');
    expect(content).toContain('openbon_fullscreen_preferred');
    expect(content).toContain('pointerdown');
    expect(content).toContain('data-fullscreen-button');
  });
});
