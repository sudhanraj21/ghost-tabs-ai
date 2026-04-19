import type { GhostTab, GhostSettings, IntentOverride, DailySummary, LearnedAICategory } from './types';
import { DEFAULT_SETTINGS } from './types';

const STORAGE_KEYS = {
  GHOST_TABS: 'ghostTabs',
  SETTINGS: 'settings',
  ACTIVITY_LOG: 'activityLog',
  INTENT_OVERRIDES: 'intentOverrides',
  DAILY_SUMMARIES: 'dailySummaries',
  TAB_ACTIVITIES: 'tabActivities',
  USER_INTEL: 'userIntelligence',
  LEARNED_AI_CATEGORIES: 'learnedAICategories',
} as const;

export interface UserIntelligence {
  restoredUrls: Record<string, { count: number; lastRestored: number }>;
  timePatterns: Record<string, number>;
  weekdayPatterns: Record<number, number>;
}

export async function getUserIntelligence(): Promise<UserIntelligence> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER_INTEL);
  return (result[STORAGE_KEYS.USER_INTEL] as UserIntelligence) || {
    restoredUrls: {},
    timePatterns: {},
    weekdayPatterns: {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}
  };
}

export async function recordTabRestore(url: string): Promise<void> {
  const intel = await getUserIntelligence();
  const normalized = normalizeUrl(url);
  
  if (intel.restoredUrls[normalized]) {
    intel.restoredUrls[normalized].count++;
    intel.restoredUrls[normalized].lastRestored = Date.now();
  } else {
    intel.restoredUrls[normalized] = { count: 1, lastRestored: Date.now() };
  }
  
  const hour = new Date().getHours();
  intel.timePatterns[hour] = (intel.timePatterns[hour] || 0) + 1;
  
  const day = new Date().getDay();
  intel.weekdayPatterns[day] = (intel.weekdayPatterns[day] || 0) + 1;
  
  await chrome.storage.local.set({ [STORAGE_KEYS.USER_INTEL]: intel });
}

export async function getMostRestoredUrls(limit: number = 5): Promise<string[]> {
  const intel = await getUserIntelligence();
  return Object.entries(intel.restoredUrls)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([url]) => url);
}

export async function suggestBasedOnTime(): Promise<string[]> {
  const intel = await getUserIntelligence();
  const hour = new Date().getHours();
  const day = new Date().getDay();
  
  const suggestions: string[] = [];
  
  if (intel.weekdayPatterns[day] > 10) {
    const topTimeHours = Object.entries(intel.timePatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => parseInt(h));
    
    if (topTimeHours.includes(hour)) {
      const topUrls = await getMostRestoredUrls(3);
      suggestions.push(...topUrls);
    }
  }
  
  return suggestions;
}

export async function getLearnedAICategories(): Promise<Record<string, LearnedAICategory>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LEARNED_AI_CATEGORIES);
  return (result[STORAGE_KEYS.LEARNED_AI_CATEGORIES] as Record<string, LearnedAICategory>) || {};
}

export async function saveLearnedAICategories(categories: Record<string, LearnedAICategory>): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.LEARNED_AI_CATEGORIES]: categories,
  });
}

export async function addLearnedAICategory(
  categoryId: string,
  label: string,
  domain: string,
  title: string,
  url: string
): Promise<LearnedAICategory> {
  const categories = await getLearnedAICategories();
  
  let category = categories[categoryId];
  const now = Date.now();
  
  if (category) {
    category.label = label;
    category.updatedAt = now;
    category.usageCount++;
    if (!category.exampleDomains.includes(domain)) {
      category.exampleDomains.push(domain);
    }
    if (!category.examples.some(e => e.url === url)) {
      category.examples.push({ title, url });
      if (category.examples.length > 10) {
        category.examples = category.examples.slice(-10);
      }
    }
  } else {
    category = {
      id: categoryId,
      label,
      createdAt: now,
      updatedAt: now,
      source: 'ai',
      exampleDomains: [domain],
      keywordHints: [],
      examples: [{ title, url }],
      usageCount: 1,
    };
    categories[categoryId] = category;
  }
  
  await saveLearnedAICategories(categories);
  return category;
}

export async function findMatchingLearnedCategory(domain: string, title: string): Promise<LearnedAICategory | null> {
  const categories = await getLearnedAICategories();
  const titleLower = title.toLowerCase();
  
  for (const cat of Object.values(categories)) {
    if (cat.exampleDomains.includes(domain)) {
      return cat;
    }
    for (const hint of cat.keywordHints) {
      if (titleLower.includes(hint.toLowerCase())) {
        return cat;
      }
    }
  }
  
  return null;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.replace(/\/+$/, '');
  } catch {
    return url;
  }
}

export async function getDuplicateUrls(): Promise<Record<string, string[]>> {
  const tabs = await getGhostTabs();
  const urlMap: Record<string, string[]> = {};
  
  for (const tab of tabs) {
    const normalized = normalizeUrl(tab.url);
    if (!urlMap[normalized]) {
      urlMap[normalized] = [];
    }
    urlMap[normalized].push(tab.id);
  }
  
  const duplicates: Record<string, string[]> = {};
  for (const [url, ids] of Object.entries(urlMap)) {
    if (ids.length > 1) {
      duplicates[url] = ids;
    }
  }
  
  return duplicates;
}

export async function mergeDuplicateTabs(): Promise<number> {
  const duplicates = await getDuplicateUrls();
  let merged = 0;
  
  const tabs = await getGhostTabs();
  const toRemove: string[] = [];
  
  for (const [, ids] of Object.entries(duplicates)) {
    if (ids.length > 1) {
      toRemove.push(...ids.slice(1));
      merged += ids.length - 1;
    }
  }
  
  if (toRemove.length > 0) {
    const updatedTabs = tabs.filter(t => !toRemove.includes(t.id));
    await saveGhostTabs(updatedTabs);
  }
  
  return merged;
}

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
