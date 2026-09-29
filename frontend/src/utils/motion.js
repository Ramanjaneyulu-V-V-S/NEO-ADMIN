// Shared Framer Motion easing for the app's "house" transition feel.
// Matches the CSS `animate-*` keyframe tokens in tailwind.config.js, which
// all use this same cubic-bezier — keep any new Framer usage on this curve
// rather than inventing another one.
export const EASE_SMOOTH = [0.32, 0.72, 0, 1];
