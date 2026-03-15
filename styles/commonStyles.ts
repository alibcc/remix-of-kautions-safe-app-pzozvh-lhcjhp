import { StyleSheet } from 'react-native';

// ─────────────────────────────────────────────
// FLATKAUTION Design System v1
// Brand: Riso Print — Yellow / Ink / Orange / Paper
// Border rule: 1.5px ink on hero elements only
// ─────────────────────────────────────────────

export const colors = {
  // ── Core brand ──────────────────────────────
  primary: '#F2C12E',        // Riso Yellow — main brand, CTAs, highlights
  ink: '#1A1A1A',            // Ink Black — borders, headers, dark cards
  accent: '#E85D26',         // Riso Orange — issue tags, active states, tile 1
  paper: '#F7F2E8',          // Paper — app background
  teal: '#5BAD8A',           // Riso Teal — success / OK status

  // ── Backgrounds ─────────────────────────────
  background: '#F7F2E8',     // Paper — replaces #F8F9FA
  card: '#FFFFFF',           // White cards float on paper bg
  cardDark: '#1A1A1A',       // Ink cards (active protocol, PDF card)

  // ── Text ────────────────────────────────────
  text: '#1A1A1A',           // Primary text
  textSecondary: '#6B7280',  // Muted labels
  textMuted: 'rgba(26,26,26,0.4)', // Captions, German subtitles
  textOnYellow: '#1A1A1A',   // Text on yellow backgrounds
  textOnInk: '#F2C12E',      // Yellow text on ink/black backgrounds
  textOnOrange: '#F7F2E8',   // Paper text on orange backgrounds

  // ── Status ──────────────────────────────────
  success: '#5BAD8A',        // OK / no issues
  successBg: '#EAF3DE',      // Success tint background
  successText: '#1a3a22',    // Text on success bg
  warning: '#F2C12E',        // Needs attention — reuses primary yellow
  warningText: '#6a5010',    // Text on yellow warning
  error: '#E85D26',          // Damage / issues found — reuses accent orange
  errorBg: '#FFE0D6',        // Error tint background
  errorText: '#993c1d',      // Text on error bg

  // ── Borders ─────────────────────────────────
  // BORDER RULE: 1.5px ink on hero cards + app icon only
  // White content cards: NO border (float on paper)
  // Dashed empty states: 1px dashed rgba(26,26,26,0.2)
  border: 'rgba(26,26,26,0.12)',       // Hairline — dividers only
  borderHero: '#1A1A1A',               // 1.5px — hero cards, icon, primary CTA
  borderDashed: 'rgba(26,26,26,0.2)',  // Dashed — empty states

  // ── Legacy aliases (keeps existing code working) ──
  secondary: '#5BAD8A',      // Was green success — now maps to teal
  highlight: '#E85D26',      // Was red error — now maps to orange accent
  dotMatrix: 'rgba(242,193,46,0.05)', // Subtle yellow tint
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Cards ──────────────────────────────────
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,          // Rounded — replaces sharp 0
    padding: 16,
    marginBottom: 6,
    // NO border — white cards float on paper background
  },
  cardHero: {
    backgroundColor: colors.cardDark,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    // Hero cards get the ink border
    borderWidth: 1.5,
    borderColor: colors.borderHero,
  },
  cardYellow: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: colors.borderHero,
  },

  // ── Typography ─────────────────────────────
  title: {
    fontSize: 22,
    fontWeight: '500',         // Was 700 — lighter, more refined
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text,
    lineHeight: 22,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },

  // ── Buttons ────────────────────────────────
  button: {
    backgroundColor: colors.primary,
    borderRadius: 100,         // Full pill — replaces sharp 0
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderHero,
  },
  buttonText: {
    color: colors.textOnYellow,
    fontSize: 13,
    fontWeight: '500',         // Was 600
  },
  buttonDark: {
    backgroundColor: colors.ink,
    borderRadius: 100,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDarkText: {
    color: colors.textOnInk,
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Inputs ─────────────────────────────────
  input: {
    backgroundColor: colors.card,
    borderWidth: 0,            // No border — floats on paper
    borderRadius: 10,          // Rounded — replaces sharp 0
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.text,
    marginBottom: 6,
  },

  // ── Tags / badges ──────────────────────────
  tagSuccess: {
    backgroundColor: colors.success,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  tagSuccessText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#ffffff',
  },
  tagWarning: {
    backgroundColor: colors.warning,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  tagWarningText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.warningText,
  },
  tagError: {
    backgroundColor: colors.error,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  tagErrorText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textOnOrange,
  },

  // ── Screen padding ─────────────────────────
  screenPadding: {
    paddingHorizontal: 16,
  },
});
