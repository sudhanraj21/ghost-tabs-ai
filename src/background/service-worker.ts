import { updateBadgeCount, getSettings, getActiveGhostTabs, getGhostTabs, initBadgeCount } from '../lib/storage';
import { trackCurrentTabs, startTracking, updateTabActivity, removeTabActivity } from '../lib/tab-tracker';
import { parkTab, restoreTab, autoParkInactiveTabs, parkAllInactiveTabs } from '../lib/park-manager';
import { getAllAIMetadata } from '../lib/ai-storage';
import { getTranslations, type Locale } from '../lib/i18n';

const ALARM_NAME = 'ghosttabs-check';
const REFRESH_ALARM_NAME = 'ghosttabs-refresh';
const CHECK_INTERVAL_MINUTES = 5;

async function broadcastGhostTabsUpdate() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'GHOST_TABS_UPDATED' });
      } catch (e) {}
    }
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('GhostTabs AI installed');
  
  await initBadgeCount();
  await updateBadgeCount();
  startTracking();
  
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
  
  chrome.alarms.create(REFRESH_ALARM_NAME, {
    periodInMinutes: 1/12,
  });
  
  chrome.contextMenus.create({
    id: 'park-tab',
    title: 'Park to Ghost Shelf',
    contexts: ['page'],
  });
  
  chrome.contextMenus.create({
    id: 'park-all-inactive',
    title: 'Park All Inactive Tabs',
    contexts: ['page'],
  });
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('GhostTabs AI startup');
  await updateBadgeCount();
  startTracking();
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id !== undefined && tab.url && !tab.url.startsWith('chrome://')) {
    updateTabActivity(tab.id, {
      url: tab.url,
      title: tab.title || '',
      isPinned: tab.pinned || false,
      isAudible: tab.audible || false,
      groupId: tab.groupId,
    });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    const url = tab.url;
    updateTabActivity(tabId, {
      url: url,
      title: tab.title || '',
      isPinned: tab.pinned || false,
      isAudible: tab.audible || false,
    });
    const ghostTabs = await getGhostTabs();
    const matchedTab = ghostTabs.find(t => normalizeUrl(t.url) === normalizeUrl(url));
    if (matchedTab) {
      const { updateGhostTab } = await import('../lib/storage');
      await updateGhostTab(matchedTab.id, { lastActiveAt: Date.now() });
      const allTabs = await chrome.tabs.query({});
      for (const t of allTabs) {
        if (t.id) {
          try {
            await chrome.tabs.sendMessage(t.id, { type: 'GHOST_TABS_UPDATED' });
          } catch (e) {}
        }
      }
    }
  }
});

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.replace(/\/+$/, '').replace(/\?.*$/, '');
  } catch {
    return url;
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (activeInfo.tabId !== undefined) {
    updateTabActivity(activeInfo.tabId, { lastActiveAt: Date.now(), isActivated: true });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTabActivity(tabId);
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'park-tab' && info.pageUrl) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await parkTab(tabs[0].id);
    }
  }
  
  if (info.menuItemId === 'park-all-inactive') {
    const count = await parkAllInactiveTabs();
    if (count > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon128.svg',
        title: 'GhostTabs AI',
        message: `Parked ${count} inactive tab${count > 1 ? 's' : ''} to ghost shelf`,
      });
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('GhostTabs AI starting up');
  await initBadgeCount();
  await updateBadgeCount();
  startTracking();
  
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
  
  chrome.alarms.create(REFRESH_ALARM_NAME, {
    periodInMinutes: 1/12,
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);
  
  if (alarm.name === ALARM_NAME) {
    await trackCurrentTabs();
    
    const settings = await getSettings();
    if (settings.autoParkEnabled) {
      await autoParkInactiveTabs();
    }
  }
  
  if (alarm.name === REFRESH_ALARM_NAME) {
    console.log('Refreshing ghost tabs on all pages');
    await broadcastGhostTabsUpdate();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

async function handleMessage(message: { type: string; payload?: unknown }) {
  switch (message.type) {
    case 'GET_GHOST_TABS': {
      const tabs = await getActiveGhostTabs();
      return { success: true, data: tabs };
    }
    
    case 'GET_ALL_GHOST_TABS': {
      const tabs = await getGhostTabs();
      return { success: true, data: tabs };
    }
    
    case 'GET_AI_METADATA': {
      const metadata = await getAllAIMetadata();
      return { success: true, data: metadata };
    }
    
    case 'PARK_TAB': {
      const tabId = message.payload as number;
      const result = await parkTab(tabId);
      return { success: true, data: result };
    }
    
    case 'PARK_CURRENT_TAB': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        const result = await parkTab(tabs[0].id);
        const allTabs = await chrome.tabs.query({});
        for (const tab of allTabs) {
          if (tab.id) {
            try {
              await chrome.tabs.sendMessage(tab.id, { type: 'GHOST_TABS_UPDATED' });
            } catch (e) {}
          }
        }
        const skipped = result && 'skipped' in result && result.skipped;
        return { success: true, data: result, skipped };
      }
      return { success: false, error: 'No active tab' };
    }
    
    case 'PARK_ALL_INACTIVE': {
      const count = await parkAllInactiveTabs();
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'GHOST_TABS_UPDATED' });
          } catch (e) {}
        }
      }
      return { success: true, data: count };
    }
    
    case 'RESTORE_TAB': {
      const { id } = message.payload as { id: string };
      const tabId = await restoreTab(id);
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'GHOST_TABS_UPDATED' });
          } catch (e) {}
        }
      }
      return { success: true, data: tabId };
    }
    
    case 'DELETE_TAB': {
      const { id } = message.payload as { id: string };
      const { deleteTab } = await import('../lib/park-manager');
      await deleteTab(id);
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'GHOST_TABS_UPDATED' });
          } catch (e) {}
        }
      }
      return { success: true };
    }
    
    case 'ARCHIVE_TAB': {
      const { id } = message.payload as { id: string };
      const { archiveTab } = await import('../lib/park-manager');
      await archiveTab(id);
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'GHOST_TABS_UPDATED' });
          } catch (e) {}
        }
      }
      return { success: true };
    }
    
    case 'GET_SETTINGS': {
      const settings = await getSettings();
      return { success: true, data: settings };
    }
    
    case 'UPDATE_BADGE': {
      await updateBadgeCount();
      return { success: true };
    }
    
    case 'GET_TRANSLATIONS': {
      const settings = await getSettings();
      const locale: Locale = (settings.language as Locale) || 'en';
      const translations = getTranslations(locale);
      return { success: true, data: translations };
    }
    
    default:
      return { success: false, error: 'Unknown message type' };
  }
}
