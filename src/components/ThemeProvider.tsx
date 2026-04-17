import { useEffect } from 'react';
import { useThemeStore } from '@/store/useThemeStore';
import { applyTheme } from '@/lib/theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore(s => s.mode);
  const palette = useThemeStore(s => s.palette);

  useEffect(() => {
    applyTheme(mode, palette);
  }, [mode, palette]);

  return <>{children}</>;
}
