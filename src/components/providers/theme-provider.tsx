'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'contrast' | 'modern' | 'minimal' | 'plain' | 'klassisch';

export interface ThemeOption {
  id: Theme;
  label: string;
  description: string;
}

export const AVAILABLE_THEMES: ThemeOption[] = [
  { id: 'dark', label: 'Dunkel', description: 'Deep Slate / Nachtmodus (Standard)' },
  { id: 'light', label: 'Hell', description: 'Klares Tageslicht & sonnenlichttauglich' },
  { id: 'contrast', label: 'Kontrastreich', description: 'OLED-Kontrast (Schwarz/Gold)' },
  { id: 'modern', label: 'Modern', description: 'Neon Violet & Cyber Glow' },
  { id: 'plain', label: 'Biergarten', description: 'Traditionell Tannengrün & Festzeltholz' },
  { id: 'minimal', label: 'Minimalistisch', description: 'Monochromes reines Zink-Design' },
  { id: 'klassisch', label: 'Klassisch', description: 'Weisser Grund, blauer Akzent, flache Pastellflaechen' },
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
    const validThemes: Theme[] = ['dark', 'light', 'contrast', 'modern', 'minimal', 'plain', 'klassisch'];
    const saved = localStorage.getItem('openbon_theme') as Theme | null;
    
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
    document.documentElement.classList.remove('dark', 'light', 'contrast', 'modern', 'minimal', 'plain', 'klassisch');
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
