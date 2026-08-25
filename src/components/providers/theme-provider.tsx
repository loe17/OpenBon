'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'contrast' | 'modern' | 'minimal' | 'plain';

export interface ThemeOption {
  id: Theme;
  label: string;
  description: string;
  icon: string;
}

export const AVAILABLE_THEMES: ThemeOption[] = [
  { id: 'dark', label: 'Dunkel', description: 'Deep Slate / Nachtmodus (Standard)', icon: '🌙' },
  { id: 'light', label: 'Hell', description: 'Klares Tageslicht & extrem sonnenlichttauglich', icon: '☀️' },
  { id: 'contrast', label: 'Kontrastreich', description: 'Extremer OLED-Kontrast (Schwarz/Gold)', icon: '⚡' },
  { id: 'modern', label: 'Modern', description: 'Neon Violet & Cyber Glow', icon: '💎' },
  { id: 'plain', label: 'Biergarten', description: 'Traditionell Tannengrün & Festzeltholz', icon: '🍺' },
  { id: 'minimal', label: 'Minimalistisch', description: 'Monochromes reines Zink-Design', icon: '◽' },
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
    const saved = localStorage.getItem('openbon_theme') as Theme | null;
    const validThemes: Theme[] = ['dark', 'light', 'contrast', 'modern', 'minimal', 'plain'];
    const initialTheme = saved && validThemes.includes(saved) ? saved : 'dark';
    
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.classList.remove('dark', 'light', 'contrast', 'modern', 'minimal', 'plain');
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
