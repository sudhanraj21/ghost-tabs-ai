import type { GhostSettings, GhostTab } from '../lib/types';
import { updateBadgeCount, getSettings, getActiveGhostTabs, getGhostTabs, initBadgeCount, recordTabRestore, getGhostTabById } from '../lib/storage';
import { trackCurrentTabs, startTracking, updateTabActivity, removeTabActivity, initTabActivities } from '../lib/tab-tracker';
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

async function injectContentScriptsIntoOpenTabs() {
  const restrictedUrls = ['chrome://', 'edge://', 'about:', 'chrome-extension://', 'devtools://'];
  
  const tabs = await chrome.tabs.query({});
  
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    
    const isRestricted = restrictedUrls.some(url => tab.url!.startsWith(url));
    if (isRestricted) continue;
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content-script.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/styles.css']
      });
    } catch (e) {
      // Ignore tabs where injection fails
    }
  }
}

async function refreshSettings() {
  await broadcastGhostTabsUpdate();
  await trackCurrentTabs();
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('GhostTabs AI installed');
  
  await initBadgeCount();
  await initTabActivities();
  await updateBadgeCount();
  await injectContentScriptsIntoOpenTabs();
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
      await updateBadgeCount();
      await broadcastGhostTabsUpdate();
    }
  }
  
  if (info.menuItemId === 'park-all-inactive') {
    const count = await parkAllInactiveTabs();
    if (count > 0) {
      await updateBadgeCount();
      await broadcastGhostTabsUpdate();
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'GhostTabs AI',
        message: `Parked ${count} inactive tab${count > 1 ? 's' : ''} to ghost shelf`,
      });
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('GhostTabs AI starting up');
  await initBadgeCount();
  await initTabActivities();
  await updateBadgeCount();
  await injectContentScriptsIntoOpenTabs();
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
      const parked = await autoParkInactiveTabs();
      if (parked > 0) {
        await updateBadgeCount();
        await broadcastGhostTabsUpdate();
      }
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
      if (result) {
        await updateBadgeCount();
        await broadcastGhostTabsUpdate();
      }
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
      const ghostTab = await getGhostTabById(id);
      if (ghostTab) {
        await recordTabRestore(ghostTab.url);
      }
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
    
    case 'MERGE_DUPLICATES': {
      const { mergeDuplicateTabs, getDuplicateUrls } = await import('../lib/storage');
      const duplicates = await getDuplicateUrls();
      const duplicateCount = Object.keys(duplicates).length;
      const merged = await mergeDuplicateTabs();
      if (merged > 0) {
        await updateBadgeCount();
        broadcastGhostTabsUpdate();
      }
      return { success: true, data: { merged, duplicateCount } };
    }
    
    case 'GET_SMART_SUGGESTIONS': {
      const { suggestBasedOnTime, getMostRestoredUrls } = await import('../lib/storage');
      const suggestions = await suggestBasedOnTime();
      const topUrls = await getMostRestoredUrls(5);
      return { success: true, data: { suggestions, topUrls } };
    }
    
    case 'GET_SETTINGS': {
      const settings = await getSettings();
      return { success: true, data: settings };
    }
    
    case 'UPDATE_SETTINGS': {
      const settings = message.payload as Partial<GhostSettings>;
      const { saveSettings: doSaveSettings } = await import('../lib/storage');
      await doSaveSettings(settings);
      await refreshSettings();
      return { success: true };
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
    
    case 'GET_DEAD_TAB_CLEANER_REPORT': {
      const { scanForDuplicates } = await import('../lib/dead-tab-cleaner');
      const report = await scanForDuplicates();
      return { success: true, data: report };
    }
    
    case 'RUN_DEAD_TAB_CLEANUP': {
      const { runDeadTabCleanup } = await import('../lib/dead-tab-cleaner');
      const result = await runDeadTabCleanup();
      await broadcastGhostTabsUpdate();
      return { success: true, data: result };
    }
    
    case 'RUN_AI_CATEGORIZATION_ALL': {
      const { getGhostTabs, saveGhostTabs } = await import('../lib/storage');
      const { getSettings } = await import('../lib/storage');
      const settings = await getSettings();
      
      if (!settings.aiApiKey || !settings.aiEnabled) {
        return { success: false, error: 'AI not enabled' };
      }
      
      const tabs = await getGhostTabs();
      const ghostTabs = tabs.filter(t => t.status === 'ghosted');
      
      let updated = 0;
      for (const tab of ghostTabs) {
        try {
          const aiResult = await enrichTabWithAI(tab.url, tab.title, settings.aiApiKey);
          if (aiResult) {
            const updatedTabs = tabs.map(t => {
              if (t.id === tab.id) {
                return { ...t, ...aiResult };
              }
              return t;
            });
            await saveGhostTabs(updatedTabs);
            updated++;
          }
        } catch {}
      }
      
      await broadcastGhostTabsUpdate();
      return { success: true, data: { updated } };
    }
    
    case 'GET_LEARNED_AI_CATEGORIES': {
      const { getLearnedAICategories } = await import('../lib/storage');
      const categories = await getLearnedAICategories();
      return { success: true, data: categories };
    }
    
    default:
      return { success: false, error: 'Unknown message type' };
  }
}

async function enrichTabWithAI(url: string, title: string, apiKey: string): Promise<Partial<GhostTab> | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You categorize web pages. Return JSON: { "category": "string", "label": "string", "summary": "string", "cluster": "string", "confidence": number }',
          },
          {
            role: 'user',
            content: `URL: ${url}\nTitle: ${title}`,
          },
        ],
        temperature: 0.3,
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return null;
    
    const parsed = JSON.parse(content);
    
    return {
      aiCategory: parsed.category?.toLowerCase().replace(/\s+/g, '-'),
      aiCategoryLabel: parsed.label,
      aiSummary: parsed.summary,
      aiLabel: parsed.label,
      aiCluster: parsed.cluster,
      aiConfidence: parsed.confidence,
    };
  } catch {
    return null;
  }
}
