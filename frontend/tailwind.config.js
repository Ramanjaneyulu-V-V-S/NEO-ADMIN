/** @type {import('tailwindcss').Config} */

// Every colour token resolves through a CSS custom property (space-separated RGB
// triplet, defined in src/index.css) so the palette flips between light and dark
// without touching markup. `<alpha-value>` keeps `bg-ink/40`, `ring-canopy/20` etc. working.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Dark theme is stamped as `data-theme="dark"` on <html> (see hooks/useTheme.js);
  // the OS preference is honoured via `prefers-color-scheme` in index.css when unstamped.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        // Body / UI — technical, institutional, Devanagari-capable
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Devanagari"', "system-ui", "sans-serif"],
        // Display — warm organic serif, used only for mastheads / login / empty states
        display: ['"Fraunces"', "Georgia", "serif"],
        // Data — identifiers, codes, counts, DQL (tabular figures)
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // "Field ledger" identity — grounded in NABARD (agriculture + institution).
        // Light values (the canonical ones) are listed in the comments; dark values live in index.css.
        canopy: {
          DEFAULT: v("canopy"), // #14532D primary — buttons, active nav, links, focus ring
          dark: v("canopy-dark"), // #0E3D21 primary hover / active
          tint: v("canopy-tint"), // #EAEFE9 active-nav bg, table row band, subtle fills
        },
        harvest: v("harvest"), // #B45309 single warm accent — secondary CTA, warnings
        // Categorical/nominal accents — status-domain badges with 3+ values
        // that would otherwise collapse onto the same 1-2 semantic tones.
        // Not a substitute for `canopy` primary actions. See index.css.
        plum: v("plum"), // dusk sky purple
        tide: v("tide"), // lake teal/navy
        coral: v("coral"), // dusk coral glow
        clay: v("clay"), // daytime terracotta
        moss: v("moss"), // daytime olive/mustard
        // Theme-invariant — always the deep NABARD green / white, in every theme.
        // Only for the login hero panel + logo lockup; everywhere else use `canopy`.
        brand: {
          DEFAULT: v("brand"),
          foreground: v("on-brand"),
        },
        ink: v("ink"), // #1A2E1F body text (warm near-black)
        paper: v("paper"), // #F6F7F4 app background
        surface: v("surface"), // #FFFFFF raised surfaces — cards, inputs, modals, table bodies
        line: v("line"), // #E2E5DE hairlines, borders, dividers
        danger: {
          DEFAULT: v("danger"), // #B42318 destructive actions, errors
          tint: v("danger-tint"), // #FEF3F2
        },
        info: {
          DEFAULT: v("info"), // #1E5F8C informational only, sparingly
          tint: v("info-tint"), // #EFF6FB
        },
        success: {
          DEFAULT: v("canopy"),
          tint: v("canopy-tint"),
        },
        // `white` is reserved for text / decor ON accent fills (canopy, harvest, danger
        // buttons, the login brand panel). In dark mode those fills brighten, so the
        // "white" on top of them becomes near-black ink for contrast. Never use
        // `bg-white` for a surface — use `bg-surface`.
        white: v("on-accent"),
        // The neutral grey scale is theme-aware too: light = Tailwind slate, dark = an
        // inverted, green-biased ramp so `text-slate-500` stays mid-grey on both grounds
        // and `bg-slate-50` / `border-slate-200` become raised dark surfaces / hairlines.
        slate: {
          50: v("slate-50"),
          100: v("slate-100"),
          200: v("slate-200"),
          300: v("slate-300"),
          400: v("slate-400"),
          500: v("slate-500"),
          600: v("slate-600"),
          700: v("slate-700"),
          800: v("slate-800"),
          900: v("slate-900"),
        },
      },
      fontSize: {
        // fixed type scale
        "display-lg": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.01em" }],
        display: ["1.5rem", { lineHeight: "1.9rem", letterSpacing: "-0.005em" }],
        title: ["1.125rem", { lineHeight: "1.6rem" }],
        body: ["0.875rem", { lineHeight: "1.35rem" }],
        caption: ["0.75rem", { lineHeight: "1.1rem" }],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(var(--c-shadow) / 0.04), 0 1px 3px 0 rgb(var(--c-shadow) / 0.06)",
        pop: "0 8px 24px -6px rgb(var(--c-shadow) / 0.16)",
      },
      screens: {
        xs: "480px",
      },
      keyframes: {
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "spine-grow": {
          "0%": { transform: "scaleY(0)" },
          "100%": { transform: "scaleY(1)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Dropdown / popover panels — small fade + rise, plus a matching exit
        "panel-in": {
          "0%": { opacity: "0", transform: "translateY(-4px) scale(0.98)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "panel-out": {
          "0%": { opacity: "1", transform: "none" },
          "100%": { opacity: "0", transform: "translateY(-4px) scale(0.98)" },
        },
        // Indeterminate progress bar — a query's duration isn't known up front.
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
      },
      transitionTimingFunction: {
        // One calm ease-out shared by every transition / animation in the app
        DEFAULT: "cubic-bezier(0.32, 0.72, 0, 1)",
        smooth: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      transitionDuration: {
        // Slightly longer than Tailwind's 150ms default — calmer hover / colour fades
        DEFAULT: "200ms",
      },
      animation: {
        "sheet-up": "sheet-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        "pop-in": "pop-in 0.2s cubic-bezier(0.32, 0.72, 0, 1)",
        "spine-grow": "spine-grow 0.14s cubic-bezier(0.32, 0.72, 0, 1)",
        "toast-in": "toast-in 0.18s cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-rise": "fade-rise 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        "panel-in": "panel-in 0.15s cubic-bezier(0.32, 0.72, 0, 1)",
        "panel-out": "panel-out 0.12s cubic-bezier(0.32, 0.72, 0, 1)",
        "progress-indeterminate": "progress-indeterminate 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
