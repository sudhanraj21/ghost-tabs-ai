import type { GhostTab } from './types';
import { addGhostTab, getGhostTabByUrl, getSettings, updateBadgeCount, getGhostTabs, saveGhostTabs, removeGhostTabByUrl, getUserIntelligence, mergeDuplicateTabs } from './storage';
import { getIntentForUrl } from './intent-engine';
import { getTabActivity, removeTabActivity, getInactiveTabs } from './tab-tracker';
import { generateId } from './storage';

function normalizeUrlForIntel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.replace(/\/+$/, '');
  } catch {
    return url;
  }
}

export async function parkTab(tabId: number): Promise<GhostTab | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return null;
    }
    
    const appSettings = await getSettings();
    if (appSettings.excludedDomains.length > 0) {
      const domain = new URL(tab.url).hostname.toLowerCase().replace(/^www\./, '');
      const excludedDomains = appSettings.excludedDomains.map(d => d.toLowerCase());
      if (excludedDomains.some(d => domain.includes(d))) {
        return null;
      }
    }
    
    const existing = await getGhostTabByUrl(tab.url);
    if (existing && existing.status === 'ghosted') {
      return { ...existing, skipped: true } as GhostTab;
    }
    
    await removeGhostTabByUrl(tab.url);
    
    const activity = getTabActivity(tabId);
    const { intent, confidence } = await getIntentForUrl(tab.url, tab.title || '');
    
    let domain = '';
    try {
      domain = new URL(tab.url).hostname.replace(/^www\./, '');
    } catch {}
    
    const ghostTab: GhostTab = {
      id: generateId(),
      originalTabId: tabId,
      url: tab.url,
      title: tab.title || 'Untitled',
      faviconUrl: tab.favIconUrl,
      domain,
      intent,
      confidence,
      createdAt: Date.now(),
      parkedAt: Date.now(),
      lastActiveAt: activity?.lastActiveAt || Date.now(),
      totalActiveTimeMs: activity?.totalActiveTimeMs || 0,
      restoreCount: 0,
      status: 'ghosted',
    };
    
    await addGhostTab(ghostTab);
    
    const settings = await getSettings();
    if (settings.closeTabsOnPark) {
      await chrome.tabs.remove(tabId);
    }
    
    removeTabActivity(tabId);
    
    return ghostTab;
  } catch (error) {
    console.error('Error parking tab:', error);
    return null;
  }
}

export async function parkTabs(tabIds: number[]): Promise<GhostTab[]> {
  const results: GhostTab[] = [];
  for (const tabId of tabIds) {
    const ghostTab = await parkTab(tabId);
    if (ghostTab) {
      results.push(ghostTab);
    }
  }
  return results;
}

export async function restoreTab(ghostTabId: string): Promise<number | null> {
  try {
    const tabs = await getGhostTabs();
    const target = tabs.find(t => t.id === ghostTabId);
    
    if (!target) return null;
    
    const newTab = await chrome.tabs.create({
      url: target.url,
      active: true,
    });
    
    const updatedTabs = tabs.map(t => {
      if (t.id === ghostTabId) {
        return {
          ...t,
          status: 'restored' as const,
          lastActiveAt: Date.now(),
          restoreCount: (t.restoreCount || 0) + 1,
        };
      }
      return t;
    });
    
    await saveGhostTabs(updatedTabs);
    await updateBadgeCount();
    
    return newTab.id || null;
  } catch (error) {
    console.error('Error restoring tab:', error);
    return null;
  }
}

export async function archiveTab(ghostTabId: string): Promise<void> {
  try {
    const tabs = await getGhostTabs();
    const updatedTabs = tabs.map(t => {
      if (t.id === ghostTabId) {
        return { ...t, status: 'archived' as const };
      }
      return t;
    });
    await saveGhostTabs(updatedTabs);
  } catch (error) {
    console.error('Error archiving tab:', error);
  }
}

export async function deleteTab(ghostTabId: string): Promise<void> {
  try {
    const tabs = await getGhostTabs();
    const updatedTabs = tabs.filter(t => t.id !== ghostTabId);
    await saveGhostTabs(updatedTabs);
    await updateBadgeCount();
  } catch (error) {
    console.error('Error deleting tab:', error);
  }
}

export async function autoParkInactiveTabs(): Promise<number> {
  const settings = await getSettings();
  
  if (!settings.autoParkEnabled) return 0;
  
  const excludedDomains = settings.excludedDomains.map(d => d.toLowerCase());
  const meetingDomains = settings.meetingDomains.map(d => d.toLowerCase());
  
  const inactiveTabs = getInactiveTabs(
    settings.autoParkThresholdMinutes,
    settings.ignorePinnedTabs,
    settings.ignoreAudibleTabs
  );
  
  if (inactiveTabs.length === 0) return 0;
  
  const activeTabsResult = await chrome.tabs.query({ active: true });
  const activeTabIds = new Set(activeTabsResult.map(t => t.id).filter((id): id is number => id !== undefined));
  
  const validInactiveTabs = inactiveTabs.filter(t => !activeTabIds.has(t.tabId));
  
  if (validInactiveTabs.length === 0) return 0;
  
  const intel = await getUserIntelligence();
  const frequentlyRestoredUrls = Object.entries(intel.restoredUrls)
    .filter(([_, data]) => data.count >= 3)
    .map(([url]) => url);
  
  const validTabIds = validInactiveTabs
    .filter(t => {
      if (!t.url) return false;
      if (t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) return false;
      
      const normalized = normalizeUrlForIntel(t.url);
      if (frequentlyRestoredUrls.some(url => normalized.includes(url) || url.includes(normalized))) {
        return false;
      }
      
      try {
        const domain = new URL(t.url).hostname.toLowerCase();
        if (excludedDomains.some(d => domain.includes(d))) return false;
        if (settings.ignoreMeetingTabs && meetingDomains.some(d => domain.includes(d))) return false;
      } catch {}
      
      return true;
    })
    .map(t => t.tabId);
  
  if (validTabIds.length === 0) return 0;
  
  const parked = await parkTabs(validTabIds);
  await mergeDuplicateTabs();
  return parked.length;
}

export async function parkAllInactiveTabs(): Promise<number> {
  const settings = await getSettings();
  
  const excludedDomains = settings.excludedDomains.map(d => d.toLowerCase());
  const meetingDomains = settings.meetingDomains.map(d => d.toLowerCase());
  
  const inactiveTabs = getInactiveTabs(
    settings.autoParkThresholdMinutes,
    settings.ignorePinnedTabs,
    settings.ignoreAudibleTabs
  );
  
  const activeTabsResult = await chrome.tabs.query({ active: true });
  const activeTabIds = new Set(activeTabsResult.map(t => t.id).filter((id): id is number => id !== undefined));
  
  const validInactiveTabs = inactiveTabs.filter(t => !activeTabIds.has(t.tabId));
  
  const validTabIds = validInactiveTabs
    .filter(t => {
      if (!t.url) return false;
      if (t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) return false;
      
      try {
        const domain = new URL(t.url).hostname.toLowerCase();
        if (excludedDomains.some(d => domain.includes(d))) return false;
        if (settings.ignoreMeetingTabs && meetingDomains.some(d => domain.includes(d))) return false;
      } catch {}
      
      return true;
    })
    .map(t => t.tabId);
  
  const parked = await parkTabs(validTabIds);
  return parked.length;
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
