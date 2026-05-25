// Theme: follow prefers-color-scheme by default; allow manual override that
// persists to localStorage. Applied by toggling a class on <html>.

export type ThemeMode = 'auto' | 'light' | 'dark';

const KEY = 'imxport.theme';

export function readSavedTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'auto';
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'auto';
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  if (mode === 'light') root.classList.add('theme-light');
  else if (mode === 'dark') root.classList.add('theme-dark');
  // 'auto' leaves no class; prefers-color-scheme media queries take over
}

export function saveTheme(mode: ThemeMode): void {
  if (typeof localStorage === 'undefined') return;
  if (mode === 'auto') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, mode);
}

export function nextTheme(mode: ThemeMode): ThemeMode {
  return mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
}
