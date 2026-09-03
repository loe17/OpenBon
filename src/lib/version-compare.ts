/** Semver-Vergleich (major.minor.patch). Wird von Update-Check und Tests genutzt. */
export function compareSemver(vA: string, vB: string): number {
  const cleanA = vA.replace(/^v/i, '').split('.').map((p) => parseInt(p, 10) || 0);
  const cleanB = vB.replace(/^v/i, '').split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const a = cleanA[i] || 0;
    const b = cleanB[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}
