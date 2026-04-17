import type { TabActivity } from './types';
import { saveTabActivities, loadTabActivities } from './storage';

const activityMap = new Map<number, TabActivity>();

const TRACK_INTERVAL_MS = 60000;

let trackInterval: ReturnType<typeof setInterval> | null = null;

export async function initTabActivities(): Promise<void> {
  const saved = await loadTabActivities();
  if (saved) {
    for (const [tabId, data] of Object.entries(saved)) {
      activityMap.set(parseInt(tabId), {
        tabId: parseInt(tabId),
        url: data.url,
        title: data.title,
        lastActiveAt: data.lastActiveAt,
        totalActiveTimeMs: data.totalActiveTimeMs,
        isPinned: data.isPinned,
        isAudible: data.isAudible,
        groupId: data.groupId,
      });
    }
  }
}

async function persistActivities(): Promise<void> {
  const obj: Record<number, { lastActiveAt: number; totalActiveTimeMs: number; url: string; title: string; isPinned: boolean; isAudible: boolean; groupId?: number }> = {};
  for (const [tabId, activity] of activityMap) {
    obj[tabId] = {
      lastActiveAt: activity.lastActiveAt,
      totalActiveTimeMs: activity.totalActiveTimeMs,
      url: activity.url,
      title: activity.title,
      isPinned: activity.isPinned,
      isAudible: activity.isAudible,
      groupId: activity.groupId,
    };
  }
  await saveTabActivities(obj);
}

export function getTabActivity(tabId: number): TabActivity | undefined {
  return activityMap.get(tabId);
}

export function getAllTabActivities(): TabActivity[] {
  return Array.from(activityMap.values());
}

export function updateTabActivity(tabId: number, data: Partial<TabActivity> & { isActivated?: boolean }): void {
  const existing = activityMap.get(tabId);
  const now = Date.now();
  
  if (existing) {
    const updates: Partial<TabActivity> = {};
    
    if (data.url !== undefined) updates.url = data.url;
    if (data.title !== undefined) updates.title = data.title;
    if (data.isPinned !== undefined) updates.isPinned = data.isPinned;
    if (data.isAudible !== undefined) updates.isAudible = data.isAudible;
    if (data.groupId !== undefined) updates.groupId = data.groupId;
    
    if (data.isActivated) {
      const elapsed = now - existing.lastActiveAt;
      updates.lastActiveAt = now;
      if (elapsed < TRACK_INTERVAL_MS * 2) {
        updates.totalActiveTimeMs = existing.totalActiveTimeMs + elapsed;
      }
    }
    
    activityMap.set(tabId, { ...existing, ...updates });
  } else {
    activityMap.set(tabId, {
      tabId,
      url: data.url || '',
      title: data.title || '',
      lastActiveAt: data.isActivated ? now : now,
      totalActiveTimeMs: 0,
      isPinned: data.isPinned || false,
      isAudible: data.isAudible || false,
      groupId: data.groupId,
    });
  }
}

export async function trackCurrentTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    
    const existing = activityMap.get(tab.id);
    const now = Date.now();
    
    if (existing) {
      activityMap.set(tab.id, {
        ...existing,
        url: tab.url || '',
        title: tab.title || '',
        lastActiveAt: now,
        isPinned: tab.pinned || false,
        isAudible: tab.audible || false,
        groupId: tab.groupId,
      });
    } else {
      activityMap.set(tab.id, {
        tabId: tab.id,
        url: tab.url || '',
        title: tab.title || '',
        lastActiveAt: now,
        totalActiveTimeMs: 0,
        isPinned: tab.pinned || false,
        isAudible: tab.audible || false,
        groupId: tab.groupId,
      });
    }
  }
  
  await persistActivities();
}

export function removeTabActivity(tabId: number): void {
  activityMap.delete(tabId);
}

export function getInactiveTabs(thresholdMinutes: number, ignorePinned: boolean, ignoreAudible: boolean): TabActivity[] {
  const threshold = thresholdMinutes * 60 * 1000;
  const now = Date.now();
  
  return getAllTabActivities().filter(activity => {
    if (!activity.url) return false;
    if (activity.url.startsWith('chrome://') || activity.url.startsWith('chrome-extension://')) {
      return false;
    }
    
    if (ignorePinned && activity.isPinned) {
      return false;
    }
    
    if (ignoreAudible && activity.isAudible) {
      return false;
    }
    
    const inactiveTime = now - activity.lastActiveAt;
    return inactiveTime >= threshold;
  });
}

export function startTracking(): void {
  if (trackInterval) return;
  
  trackCurrentTabs();
  
  trackInterval = setInterval(() => {
    trackCurrentTabs();
  }, TRACK_INTERVAL_MS);
}

export function stopTracking(): void {
  if (trackInterval) {
    clearInterval(trackInterval);
    trackInterval = null;
  }
}

export function isTabRecentlyActive(tabId: number, thresholdMinutes: number = 5): boolean {
  const activity = activityMap.get(tabId);
  if (!activity) return false;
  
  const threshold = thresholdMinutes * 60 * 1000;
  return (Date.now() - activity.lastActiveAt) < threshold;
}
