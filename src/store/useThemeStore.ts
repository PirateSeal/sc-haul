import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  mode: 'dark' | 'light';
  palette: string;
  setMode: (mode: 'dark' | 'light') => void;
  setPalette: (palette: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      palette: 'cyan',
      setMode: (mode) => set({ mode }),
      setPalette: (palette) => set({ palette }),
    }),
    { name: 'theme-storage' }
  )
);
