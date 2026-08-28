import fs from 'fs';

export interface DiskSpaceInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercentage: number;
  formattedTotal: string;
  formattedFree: string;
  formattedUsed: string;
  isSufficient: boolean;
  minRequiredMb: number;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function getDiskSpace(targetPath = process.cwd()): DiskSpaceInfo {
  const minRequiredMb = 350; // Mindestens 350 MB freier Speicher für Next.js Build
  const minRequiredBytes = minRequiredMb * 1024 * 1024;

  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(targetPath);
      const bsize = Number(stats.bsize || 4096);
      const total = Number(stats.blocks) * bsize;
      const free = Number(stats.bavail !== undefined ? stats.bavail : stats.bfree) * bsize;
      const used = Math.max(0, total - free);
      const usedPercentage = total > 0 ? Math.min(100, Math.max(0, Math.round((used / total) * 100))) : 0;

      return {
        totalBytes: total,
        freeBytes: free,
        usedBytes: used,
        usedPercentage,
        formattedTotal: formatBytes(total),
        formattedFree: formatBytes(free),
        formattedUsed: formatBytes(used),
        isSufficient: free >= minRequiredBytes,
        minRequiredMb,
      };
    }
  } catch (err) {
    console.warn('[DISK-SPACE] statfsSync nicht verfügbar:', err);
  }

  // Fallback
  return {
    totalBytes: 0,
    freeBytes: 1024 * 1024 * 1024,
    usedBytes: 0,
    usedPercentage: 0,
    formattedTotal: 'Unbekannt',
    formattedFree: 'Verfügbar',
    formattedUsed: '0 B',
    isSufficient: true,
    minRequiredMb,
  };
}
