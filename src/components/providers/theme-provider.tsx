'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'speed' | 'speed-light';

export interface ThemeOption {
  id: Theme;
  label: string;
  description: string;
}

export const AVAILABLE_THEMES: ThemeOption[] = [
  { id: 'dark', label: 'Dunkel', description: 'Eleganter Mitternachtsmodus mit tiefen Kontrasten und subtilem Glow' },
  { id: 'light', label: 'Hell', description: 'Schneeweißer Grund mit sonnenlichttauglichen Kontrasten' },
  { id: 'speed', label: 'Kompakt Dunkel', description: 'Maximale Kacheldichte und extra große Ziffern im Dunkelmodus' },
  { id: 'speed-light', label: 'Kompakt Hell', description: 'Maximale Kacheldichte und extra große Ziffern im hellen Modus' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const validThemes: Theme[] = ['dark', 'light', 'speed', 'speed-light'];
    const saved = localStorage.getItem('openbon_theme') as any;
    
    if (saved && validThemes.includes(saved)) {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      // Fallback vom Server laden
      fetch('/api/config/public')
        .then((res) => res.json())
        .then((data) => {
          if (data?.activeTheme && validThemes.includes(data.activeTheme)) {
            setThemeState(data.activeTheme);
            applyTheme(data.activeTheme);
          } else {
            setThemeState('dark');
            applyTheme('dark');
          }
        })
        .catch(() => {
          setThemeState('dark');
          applyTheme('dark');
        });
    }
  }, []);

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.classList.remove('dark', 'light', 'contrast', 'tradition', 'speed', 'speed-light', 'modern', 'minimal', 'plain', 'klassisch');
    document.documentElement.classList.add(t);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('openbon_theme', newTheme);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
