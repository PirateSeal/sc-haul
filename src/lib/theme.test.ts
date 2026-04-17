import { describe, it, expect, beforeEach } from 'vitest';
import { PALETTES, applyTheme } from '@/lib/theme';

describe('PALETTES', () => {
  it('has 7 entries', () => {
    expect(PALETTES).toHaveLength(7);
  });

  it('has unique ids', () => {
    const ids = PALETTES.map(p => p.id);
    expect(new Set(ids).size).toBe(7);
  });

  it('each palette has required fields', () => {
    for (const p of PALETTES) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.swatch).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.dark.primary).toBeTruthy();
      expect(p.dark.primaryFg).toBeTruthy();
      expect(p.dark.ring).toBeTruthy();
      expect(p.light.primary).toBeTruthy();
      expect(p.light.primaryFg).toBeTruthy();
      expect(p.light.ring).toBeTruthy();
    }
  });

  it('includes expected palette ids', () => {
    const ids = PALETTES.map(p => p.id);
    expect(ids).toContain('cyan');
    expect(ids).toContain('violet');
    expect(ids).toContain('emerald');
    expect(ids).toContain('amber');
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.cssText = '';
  });

  it('adds dark class in dark mode', () => {
    applyTheme('dark', 'cyan');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class in light mode', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light', 'cyan');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets CSS custom properties', () => {
    applyTheme('dark', 'cyan');
    expect(document.documentElement.style.getPropertyValue('--primary')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--primary-foreground')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--ring')).not.toBe('');
  });

  it('applies correct dark values for cyan', () => {
    const cyan = PALETTES.find(p => p.id === 'cyan')!;
    applyTheme('dark', 'cyan');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(cyan.dark.primary);
  });

  it('applies correct light values for cyan', () => {
    const cyan = PALETTES.find(p => p.id === 'cyan')!;
    applyTheme('light', 'cyan');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(cyan.light.primary);
  });

  it('falls back to first palette for unknown id', () => {
    applyTheme('dark', 'does-not-exist');
    // Should use cyan (first palette) without throwing
    const cyan = PALETTES.find(p => p.id === 'cyan')!;
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(cyan.dark.primary);
  });

  it('applies different primary values for different palettes', () => {
    applyTheme('dark', 'cyan');
    const cyanPrimary = document.documentElement.style.getPropertyValue('--primary');

    applyTheme('dark', 'violet');
    const violetPrimary = document.documentElement.style.getPropertyValue('--primary');

    expect(cyanPrimary).not.toBe(violetPrimary);
  });
});
