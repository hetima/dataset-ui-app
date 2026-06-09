export const THEME_OPTIONS = ["light", "dark", "system"] as const;
export type AppTheme = (typeof THEME_OPTIONS)[number];

export function isAppTheme(value: string): value is AppTheme {
  return (THEME_OPTIONS as readonly string[]).includes(value);
}
