export interface Palette {
  id: string;
  name: string;
  /** Hex swatch shown in the color picker */
  swatch: string;
  dark: { primary: string; primaryFg: string; ring: string };
  light: { primary: string; primaryFg: string; ring: string };
}

export const PALETTES: Palette[] = [
  {
    id: 'cyan',
    name: 'Cyan',
    swatch: '#06b6d4',
    dark:  { primary: 'oklch(0.72 0.15 200)', primaryFg: 'oklch(0.12 0.01 240)', ring: 'oklch(0.72 0.15 200 / 60%)' },
    light: { primary: 'oklch(0.52 0.18 200)', primaryFg: 'oklch(0.98 0 0)',      ring: 'oklch(0.52 0.18 200 / 50%)' },
  },
  {
    id: 'violet',
    name: 'Violet',
    swatch: '#8b5cf6',
    dark:  { primary: 'oklch(0.68 0.20 280)', primaryFg: 'oklch(0.12 0.01 240)', ring: 'oklch(0.68 0.20 280 / 60%)' },
    light: { primary: 'oklch(0.52 0.23 280)', primaryFg: 'oklch(0.98 0 0)',      ring: 'oklch(0.52 0.23 280 / 50%)' },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    swatch: '#10b981',
    dark:  { primary: 'oklch(0.73 0.17 152)', primaryFg: 'oklch(0.12 0.01 240)', ring: 'oklch(0.73 0.17 152 / 60%)' },
    light: { primary: 'oklch(0.52 0.19 152)', primaryFg: 'oklch(0.98 0 0)',      ring: 'oklch(0.52 0.19 152 / 50%)' },
  },
  {
    id: 'amber',
    name: 'Amber',
    swatch: '#f59e0b',
    dark:  { primary: 'oklch(0.78 0.17 72)',  primaryFg: 'oklch(0.12 0.01 240)', ring: 'oklch(0.78 0.17 72 / 60%)' },
    light: { primary: 'oklch(0.60 0.18 72)',  primaryFg: 'oklch(0.12 0.01 240)', ring: 'oklch(0.60 0.18 72 / 50%)' },
  },
  {
    id: 'rose',
    name: 'Rose',
    swatch: '#f43f5e',
    dark:  { primary: 'oklch(0.70 0.20 10)',  primaryFg: 'oklch(0.12 0.01 240)', ring: 'oklch(0.70 0.20 10 / 60%)' },
    light: { primary: 'oklch(0.55 0.22 10)',  primaryFg: 'oklch(0.98 0 0)',      ring: 'oklch(0.55 0.22 10 / 50%)' },
  },
  {
    id: 'orange',
    name: 'Orange',
    swatch: '#f97316',
    dark:  { primary: 'oklch(0.75 0.19 41)',  primaryFg: 'oklch(0.12 0.01 240)', ring: 'oklch(0.75 0.19 41 / 60%)' },
    light: { primary: 'oklch(0.60 0.21 41)',  primaryFg: 'oklch(0.12 0.01 240)', ring: 'oklch(0.60 0.21 41 / 50%)' },
  },
  {
    id: 'indigo',
    name: 'Indigo',
    swatch: '#6366f1',
    dark:  { primary: 'oklch(0.65 0.22 265)', primaryFg: 'oklch(0.12 0.01 240)', ring: 'oklch(0.65 0.22 265 / 60%)' },
    light: { primary: 'oklch(0.50 0.24 265)', primaryFg: 'oklch(0.98 0 0)',      ring: 'oklch(0.50 0.24 265 / 50%)' },
  },
];

export function applyTheme(mode: 'dark' | 'light', paletteId: string) {
  const html = document.documentElement;
  html.classList.toggle('dark', mode === 'dark');

  const palette = PALETTES.find(p => p.id === paletteId) ?? PALETTES[0];
  const vars = mode === 'dark' ? palette.dark : palette.light;

  html.style.setProperty('--primary', vars.primary);
  html.style.setProperty('--primary-foreground', vars.primaryFg);
  html.style.setProperty('--ring', vars.ring);
}
