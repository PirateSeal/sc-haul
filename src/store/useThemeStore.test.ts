import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/store/useThemeStore';

beforeEach(() => {
  useThemeStore.setState({ mode: 'dark', palette: 'cyan' });
  localStorage.clear();
});

describe('initial state', () => {
  it('defaults to dark mode', () => {
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('defaults to cyan palette', () => {
    expect(useThemeStore.getState().palette).toBe('cyan');
  });
});

describe('setMode', () => {
  it('switches to light mode', () => {
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('switches back to dark mode', () => {
    useThemeStore.getState().setMode('light');
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });
});

describe('setPalette', () => {
  it('changes the active palette', () => {
    useThemeStore.getState().setPalette('violet');
    expect(useThemeStore.getState().palette).toBe('violet');
  });

  it('overwrites the previous palette', () => {
    useThemeStore.getState().setPalette('violet');
    useThemeStore.getState().setPalette('emerald');
    expect(useThemeStore.getState().palette).toBe('emerald');
  });

  it('accepts any string (validation is UI concern)', () => {
    useThemeStore.getState().setPalette('any-value');
    expect(useThemeStore.getState().palette).toBe('any-value');
  });
});
