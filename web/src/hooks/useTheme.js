import { useEffect, useState } from 'react';

const STORAGE_KEY = 'campusos-theme';

/** Dark is the default theme; the choice is remembered in the browser. */
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent('college-theme', {detail:theme}));
  }, [theme]);

  useEffect(() => { const sync=(e)=>setTheme(e.detail); window.addEventListener('college-theme',sync); return ()=>window.removeEventListener('college-theme',sync); }, []);

  return {
    theme,
    toggle: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  };
}
