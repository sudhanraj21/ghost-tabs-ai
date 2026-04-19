import type { GhostTab, DuplicateGroup } from './types';
import { getGhostTabs, saveGhostTabs, updateBadgeCount } from './storage';

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.replace(/\/+$/, '').replace(/\?.*$/, '');
  } catch {
    return url;
  }
}

export interface CleanerReport {
  duplicateGroups: DuplicateGroup[];
  totalCandidates: number;
  generatedAt: number;
}

export async function scanForDuplicates(): Promise<CleanerReport> {
  const tabs = await getGhostTabs();
  const ghostTabs = tabs.filter(t => t.status === 'ghosted');
  
  const urlGroups = new Map<string, GhostTab[]>();
  
  for (const tab of ghostTabs) {
    const normalized = normalizeUrl(tab.url);
    const existing = urlGroups.get(normalized) || [];
    existing.push(tab);
    urlGroups.set(normalized, existing);
  }
  
  const duplicateGroups: DuplicateGroup[] = [];
  let totalCandidates = 0;
  
  for (const [, groupTabs] of urlGroups) {
    if (groupTabs.length > 1) {
      const sorted = [...groupTabs].sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);
      
      duplicateGroups.push({
        canonicalId: canonical.id,
        duplicateIds: duplicates.map(d => d.id),
        urls: groupTabs.map(t => t.url),
      });
      totalCandidates += duplicates.length;
    }
  }
  
  return {
    duplicateGroups,
    totalCandidates,
    generatedAt: Date.now(),
  };
}

export async function runDeadTabCleanup(): Promise<{ archived: number }> {
  const report = await scanForDuplicates();
  
  if (report.duplicateGroups.length === 0) {
    return { archived: 0 };
  }
  
  const tabs = await getGhostTabs();
  const idsToArchive = new Set<string>();
  
  for (const group of report.duplicateGroups) {
    for (const dupId of group.duplicateIds) {
      idsToArchive.add(dupId);
    }
  }
  
  const updatedTabs = tabs.map(tab => {
    if (idsToArchive.has(tab.id)) {
      return {
        ...tab,
        status: 'archived' as const,
        cleanedAt: Date.now(),
        cleanupFlags: [...(tab.cleanupFlags || []), 'duplicate'],
        duplicateOf: report.duplicateGroups.find(g => g.duplicateIds.includes(tab.id))?.canonicalId || null,
      };
    }
    return tab;
  });
  
  await saveGhostTabs(updatedTabs);
  await updateBadgeCount();
  
  return { archived: idsToArchive.size };
}