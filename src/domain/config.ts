/**
 * GERA System Configuration
 */

export const CONFIG = {
  /** Dev helpers (test panel, admin/facilitator switcher). Never on in production builds. */
  DEMO_MODE: Boolean(import.meta.env?.DEV) || import.meta.env?.VITE_ENABLE_DEV_TOOLS === 'true',
  MAX_NOTE_LENGTH: 160,
  DUPLICATE_CHECK_WINDOW_MS: 60 * 1000, // 60 seconds
  CATALOG_VERSION: 1,
  DEFAULT_NETWORK_LATENCY_MS: 0,
  SESSION_DURATION_MS: 12 * 60 * 60 * 1000, // 12 hours
  MAX_LOGIN_FAILURES_PER_MINUTE: 5,
};

/**
 * Opposing behavior pairs config (P-code with W-code)
 * P02–W01, P04–W07, P06–W03, P07–W02, P08–W03, P09–W04, P10–W05, P11–W06, P12–W08, P13–W10, P14–W01
 */
export const OPPOSING_PAIRS: [string, string][] = [
  ['P02', 'W01'],
  ['P04', 'W07'],
  ['P06', 'W03'],
  ['P07', 'W02'],
  ['P08', 'W03'],
  ['P09', 'W04'],
  ['P10', 'W05'],
  ['P11', 'W06'],
  ['P12', 'W08'],
  ['P13', 'W10'],
  ['P14', 'W01'],
];

/**
 * Returns any opposing pairs present within the given array of behavior codes.
 */
export function detectOpposingPairs(behaviorCodes: string[]): [string, string][] {
  const codeSet = new Set(behaviorCodes);
  const detected: [string, string][] = [];

  for (const [pos, warn] of OPPOSING_PAIRS) {
    if (codeSet.has(pos) && codeSet.has(warn)) {
      detected.push([pos, warn]);
    }
  }

  return detected;
}
