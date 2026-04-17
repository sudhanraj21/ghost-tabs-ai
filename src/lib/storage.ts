import type { GhostTab, GhostSettings, IntentOverride, DailySummary } from './types';
import { DEFAULT_SETTINGS } from './types';

const STORAGE_KEYS = {
  GHOST_TABS: 'ghostTabs',
  SETTINGS: 'settings',
  ACTIVITY_LOG: 'activityLog',
  INTENT_OVERRIDES: 'intentOverrides',
  DAILY_SUMMARIES: 'dailySummaries',
  TAB_ACTIVITIES: 'tabActivities',
} as const;

export async function getGhostTabs(): Promise<GhostTab[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.GHOST_TABS);
  return (result[STORAGE_KEYS.GHOST_TABS] as GhostTab[]) || [];
}

export async function saveGhostTabs(tabs: GhostTab[]): Promise<void> {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const cleanedTabs = tabs.filter(t => {
    if (t.status === 'restored' || t.status === 'archived') {
      return t.parkedAt > thirtyDaysAgo;
    }
    return true;
  });
  await chrome.storage.local.set({ [STORAGE_KEYS.GHOST_TABS]: cleanedTabs });
}

export async function addGhostTab(tab: GhostTab): Promise<void> {
  const tabs = await getGhostTabs();
  tabs.unshift(tab);
  await saveGhostTabs(tabs);
  await updateBadgeCount();
}

export async function removeGhostTab(id: string): Promise<void> {
  const tabs = await getGhostTabs();
  const filtered = tabs.filter(t => t.id !== id);
  await saveGhostTabs(filtered);
  await updateBadgeCount();
}

export async function removeGhostTabByUrl(url: string): Promise<void> {
  const tabs = await getGhostTabs();
  const normalizedUrl = normalizeUrlForMatch(url);
  const filtered = tabs.filter(t => normalizeUrlForMatch(t.url) !== normalizedUrl);
  await saveGhostTabs(filtered);
  await updateBadgeCount();
}

function normalizeUrlForMatch(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.replace(/\/+$/, '').replace(/\?.*$/, '');
  } catch {
    return url;
  }
}

export async function updateGhostTab(id: string, updates: Partial<GhostTab>): Promise<void> {
  const tabs = await getGhostTabs();
  const index = tabs.findIndex(t => t.id === id);
  if (index !== -1) {
    tabs[index] = { ...tabs[index], ...updates };
    await saveGhostTabs(tabs);
  }
}

export async function getGhostTabById(id: string): Promise<GhostTab | undefined> {
  const tabs = await getGhostTabs();
  return tabs.find(t => t.id === id);
}

export async function getGhostTabByUrl(url: string): Promise<GhostTab | undefined> {
  const tabs = await getGhostTabs();
  return tabs.find(t => t.url === url);
}

export async function getGhostTabsByIntent(intent: string): Promise<GhostTab[]> {
  const tabs = await getGhostTabs();
  return tabs.filter(t => t.intent === intent && t.status === 'ghosted');
}

export async function getActiveGhostTabs(): Promise<GhostTab[]> {
  const tabs = await getGhostTabs();
  return tabs.filter(t => t.status === 'ghosted');
}

export async function archiveGhostTab(id: string): Promise<void> {
  await updateGhostTab(id, { status: 'archived' });
}

export async function restoreGhostTab(id: string): Promise<void> {
  await updateGhostTab(id, {
    status: 'restored',
    restoreCount: (await getGhostTabById(id))!.restoreCount + 1,
  });
}

export async function getSettings(): Promise<GhostSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] as Partial<GhostSettings>) };
}

export async function saveSettings(settings: Partial<GhostSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
  });
}

export async function saveTabActivities(activities: Record<number, { lastActiveAt: number; totalActiveTimeMs: number; url: string; title: string; isPinned: boolean; isAudible: boolean; groupId?: number }>): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.TAB_ACTIVITIES]: activities,
  });
}

export async function loadTabActivities(): Promise<Record<number, { lastActiveAt: number; totalActiveTimeMs: number; url: string; title: string; isPinned: boolean; isAudible: boolean; groupId?: number }> | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_ACTIVITIES);
  return result[STORAGE_KEYS.TAB_ACTIVITIES] || null;
}

export async function getIntentOverrides(): Promise<IntentOverride[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.INTENT_OVERRIDES);
  return (result[STORAGE_KEYS.INTENT_OVERRIDES] as IntentOverride[]) || [];
}

export async function addIntentOverride(url: string, intent: string): Promise<void> {
  const overrides = await getIntentOverrides();
  const existing = overrides.findIndex(o => o.url === url);
  if (existing !== -1) {
    overrides[existing] = { url, intent: intent as IntentOverride['intent'], timestamp: Date.now() };
  } else {
    overrides.push({ url, intent: intent as IntentOverride['intent'], timestamp: Date.now() });
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.INTENT_OVERRIDES]: overrides });
}

export async function getDailySummaries(): Promise<DailySummary[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_SUMMARIES);
  return (result[STORAGE_KEYS.DAILY_SUMMARIES] as DailySummary[]) || [];
}

export async function addDailySummary(summary: DailySummary): Promise<void> {
  const summaries = await getDailySummaries();
  const today = new Date().toISOString().split('T')[0];
  const existingIndex = summaries.findIndex(s => s.date === today);
  if (existingIndex !== -1) {
    summaries[existingIndex] = summary;
  } else {
    summaries.unshift(summary);
    if (summaries.length > 30) summaries.pop();
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_SUMMARIES]: summaries });
}

let lastBadgeCount: number | null = null;
let badgeInitialized = false;

const BADGE_COUNT_KEY = 'ghostTabs_lastBadgeCount';

export async function initBadgeCount(): Promise<void> {
  if (badgeInitialized) return;
  
  const stored = (await chrome.storage.local.get(BADGE_COUNT_KEY))[BADGE_COUNT_KEY];
  lastBadgeCount = typeof stored === 'number' ? stored : null;
  badgeInitialized = true;
  console.log('[Badge] Initialized with stored count:', lastBadgeCount);
}

export async function updateBadgeCount(): Promise<void> {
  const settings = await getSettings();
  if (!settings.showBadgeCount) {
    if (lastBadgeCount !== null) {
      await chrome.action.setBadgeText({ text: '' });
      lastBadgeCount = null;
      await chrome.storage.local.set({ [BADGE_COUNT_KEY]: null });
    }
    return;
  }
  
  const tabs = await getActiveGhostTabs();
  const count = tabs.length;
  
  if (count === lastBadgeCount) {
    return;
  }
  
  console.log('[Badge] Updating from', lastBadgeCount, 'to', count);
  lastBadgeCount = count;
  await chrome.storage.local.set({ [BADGE_COUNT_KEY]: count });
  
  if (count > 0) {
    await chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: '#607D8B' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
