/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
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
        // "Field ledger" identity — grounded in NABARD (agriculture + institution)
        canopy: {
          DEFAULT: "#14532D", // primary — buttons, active nav, links, focus ring
          dark: "#0E3D21", // primary hover / active
          tint: "#EAEFE9", // active-nav bg, table row band, subtle fills
        },
        harvest: "#B45309", // single warm accent — secondary CTA, warnings
        ink: "#1A2E1F", // body text (warm near-black)
        paper: "#F6F7F4", // app background
        line: "#E2E5DE", // hairlines, borders, dividers
        danger: {
          DEFAULT: "#B42318", // destructive actions, errors
          tint: "#FEF3F2",
        },
        info: {
          DEFAULT: "#1E5F8C", // informational only, sparingly
          tint: "#EFF6FB",
        },
        success: {
          DEFAULT: "#14532D",
          tint: "#EAEFE9",
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
        card: "0 1px 2px 0 rgb(26 46 31 / 0.04), 0 1px 3px 0 rgb(26 46 31 / 0.06)",
        pop: "0 8px 24px -6px rgb(26 46 31 / 0.16)",
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
      },
    },
  },
  plugins: [],
};
