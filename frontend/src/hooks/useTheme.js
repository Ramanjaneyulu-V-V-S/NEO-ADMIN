import { useCallback, useEffect, useState } from 'react';

/**
 * Theme preference — `light` | `dark` | `system`.
 *
 * The palette itself lives in index.css as CSS custom properties; this hook
 * only stamps `data-theme` on <html> (nothing for `system`, so the
 * `prefers-color-scheme` media query decides) and remembers the choice in
 * localStorage. index.html has a tiny inline script that applies the stored
 * value before first paint so a dark reload never flashes light.
 */
export const THEMES = ['light', 'dark', 'system'];
export const THEME_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const THEME_COLOR = { light: '#14532D', dark: '#111814' };

// Must match the `.theme-switching` transition duration in index.css, plus a
// little slack so the class never comes off mid-fade.
const THEME_SWITCH_MS = 400;
let switchTimer = null;

/**
 * Crossfade the palette for one switch: stamp `.theme-switching` on <html>
 * (index.css turns colour transitions on under it) and take it off again once
 * the fade has run. Skipped entirely for reduced-motion users.
 */
function startThemeTransition() {
    if (typeof window === 'undefined' || window.matchMedia(MOTION_QUERY).matches) return;
    const root = document.documentElement;
    root.classList.add('theme-switching');
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => root.classList.remove('theme-switching'), THEME_SWITCH_MS);
}

function readStored() {
    try {
        const v = localStorage.getItem(THEME_KEY);
        return THEMES.includes(v) ? v : 'system';
    } catch {
        return 'system';
    }
}

function systemPrefersDark() {
    return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

/** Resolve a preference to the theme actually on screen. */
export function resolveTheme(pref, systemDark = systemPrefersDark()) {
    if (pref === 'light' || pref === 'dark') return pref;
    return systemDark ? 'dark' : 'light';
}

/** Stamp <html data-theme> and the browser-chrome colour for a preference. */
export function applyTheme(pref) {
    const root = document.documentElement;
    if (pref === 'light' || pref === 'dark') root.dataset.theme = pref;
    else delete root.dataset.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[resolveTheme(pref)]);
}

export default function useTheme() {
    const [theme, setThemeState] = useState(readStored);
    const [systemDark, setSystemDark] = useState(systemPrefersDark);
    const resolved = resolveTheme(theme, systemDark);

    // Apply + persist whenever the preference (or the OS, while in `system`) changes.
    useEffect(() => {
        applyTheme(theme);
        try {
            if (theme === 'system') localStorage.removeItem(THEME_KEY);
            else localStorage.setItem(THEME_KEY, theme);
        } catch {
            /* ignore — private mode / disabled storage */
        }
    }, [theme, systemDark]);

    // Track the OS preference; keep two tabs in agreement.
    useEffect(() => {
        const mql = window.matchMedia(DARK_QUERY);
        const onMedia = () => {
            startThemeTransition();
            setSystemDark(mql.matches);
        };
        const onStorage = (e) => {
            if (e.key !== THEME_KEY && e.key !== null) return;
            startThemeTransition();
            setThemeState(readStored());
        };
        mql.addEventListener('change', onMedia);
        window.addEventListener('storage', onStorage);
        return () => {
            mql.removeEventListener('change', onMedia);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    const setTheme = useCallback((next) => {
        startThemeTransition();
        setThemeState(THEMES.includes(next) ? next : 'system');
    }, []);

    return { theme, setTheme, resolved };
}
