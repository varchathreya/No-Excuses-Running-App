/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#F4F1EA',
    tint: '#FF604A',

    // Core surfaces
    background: '#111315',
    foreground: '#F4F1EA',

    // Cards / elevated surfaces
    card: '#1B1F20',
    cardForeground: '#F4F1EA',

    // Primary action color (buttons, links, active states)
    primary: '#FF604A',
    primaryForeground: '#111315',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#273032',
    secondaryForeground: '#F4F1EA',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#222829',
    mutedForeground: '#A8B0AE',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#B8D77A',
    accentForeground: '#111315',

    // Destructive actions (delete, error states)
    destructive: '#FF604A',
    destructiveForeground: '#111315',

    // Borders and input outlines
    border: '#303738',
    input: '#303738',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
