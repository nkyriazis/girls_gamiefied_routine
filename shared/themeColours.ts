// The theme's colours (#104): every --color-* token frontend/src/styles/variables.css defines, by the name
// after «--color-». data.json names a kid's or a routine's colour as one of them, var(--color-accent), so a
// theme change carries the kids along. The parents' colour picker offers some of them
// (settings/model.ts THEME_COLORS) and the backend's config checks accept any of them
// (backend/src/configChecks.ts): «var(--color-secondry)» is a typo, not a colour. The frontend's
// themeColours.test.ts checks this list against variables.css both ways, so the two can't drift.
export const THEME_COLOR_TOKENS = [
  'bg-start', 'bg-mid', 'bg-end',
  'primary', 'secondary', 'accent',
  'text-main', 'text-muted',
  'success', 'warning', 'danger',
] as const;

export type ThemeColorToken = typeof THEME_COLOR_TOKENS[number];

/** A token as data.json saves it: var(--color-<token>). */
export const themeColor = (token: ThemeColorToken) => `var(--color-${token})`;
