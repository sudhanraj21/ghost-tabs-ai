import type { GhostTab, GhostShelfPosition } from '../lib/types';

type Intent = 'watch_later' | 'learn_later' | 'read_later' | 'buy_later' | 'compare_later' | 'work' | 'temporary' | 'unknown' | 'research' | 'finance' | 'social' | 'news';

const INTENT_COLORS: Record<Intent, string> = {
  watch_later: '#E91E63',
  learn_later: '#9C27B0',
  read_later: '#2196F3',
  buy_later: '#4CAF50',
  compare_later: '#FF9800',
  work: '#607D8B',
  temporary: '#9E9E9E',
  unknown: '#795548',
  research: '#0ea5e9',
  finance: '#22c55e',
  social: '#8b5cf6',
  news: '#f97316',
};

const POSITION_CLASSES: Record<GhostShelfPosition, string> = {
  'bottom-right': 'ghost-dock--bottom-right',
  'bottom-left': 'ghost-dock--bottom-left',
  'top-right': 'ghost-dock--top-right',
  'top-left': 'ghost-dock--top-left',
};

interface GhostSettingsWithShelf {
  showGhostShelfOverlay: boolean;
  ghostShelfPosition: GhostShelfPosition;
  ghostShelfStartCollapsed: boolean;
}

let ghostTabs: GhostTab[] = [];
let settings: GhostSettingsWithShelf | null = null;
let isExpanded = false;
let clickTimer: ReturnType<typeof setTimeout> | null = null;
let t: any = null;

async function loadTranslations() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TRANSLATIONS' });
    if (response.success && response.data) {
      t = response.data;
    }
  } catch {
    t = null;
  }
}

function showToast(message: string, type: 'success' | 'info' | 'warning' = 'info') {
  const existing = document.getElementById('ghost-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'ghost-toast';
  toast.className = `ghost-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => toast.classList.add('show'));
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

async function init() {
  if (document.getElementById('ghost-dock')) return;

  console.log('GhostTabs: Initializing...');
  
  await loadTranslations();
  
  const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  if (!settingsResponse.success) {
    console.error('Failed to get settings');
    return;
  }

  settings = settingsResponse.data as GhostSettingsWithShelf;
  console.log('GhostTabs: Settings loaded', settings);

  if (!settings.showGhostShelfOverlay) {
    console.log('GhostTabs: Overlay disabled in settings');
    return;
  }

  console.log('GhostTabs: Creating dock...');
  isExpanded = !settings.ghostShelfStartCollapsed;

  chrome.runtime.onMessage.addListener((message) => {
    console.log('Content script received message:', message.type);
    if (message.type === 'GHOST_TABS_UPDATED' || message.type === 'REFRESH_GHOST_TABS') {
      console.log('Reloading ghost tabs...');
      loadGhostTabs().then(async () => {
        await loadAIMetadata();
        updateDock();
        console.log('Dock updated with', ghostTabs.length, 'tabs');
      });
    }
  });
  
  await loadGhostTabs();
  await loadAIMetadata();
  createDock();
}

async function loadGhostTabs() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_GHOST_TABS' });
  if (response.success) {
    const newTabs: GhostTab[] = response.data || [];
    ghostTabs = newTabs;
  }
}

interface AIMetadata {
  tabId: string;
  label?: string;
  summary?: string;
  cluster?: string;
  resumeReason?: string;
  priorityScore?: number;
  lastUpdatedAt?: number;
  similarTabs?: string[];
  duplicateOf?: string;
  customLabel?: string;
  predictedResume?: boolean;
  userContext?: string;
  aiIntent?: string;
}

let aiMetadataMap: Record<string, AIMetadata> = {};

async function loadAIMetadata() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_AI_METADATA' });
    if (response.success) {
      aiMetadataMap = response.data || {};
    }
  } catch {
    aiMetadataMap = {};
  }
}

function createDock() {
  const dock = document.createElement('div');
  dock.id = 'ghost-dock';
  dock.className = `ghost-dock ${POSITION_CLASSES[settings!.ghostShelfPosition]}`;

  if (isExpanded) {
    dock.classList.add('ghost-dock--expanded');
  }

  dock.innerHTML = createDockHTML();

  document.body.appendChild(dock);

  setupDockEvents(dock);
}

function createDockHTML(): string {
  const count = ghostTabs.length;
  
  if (ghostTabs.length === 0) {
    return `
      <div class="ghost-dock__dock">
        <div class="ghost-dock__icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="16" rx="2" fill="url(#grad2)" fill-opacity="0.9"/>
            <rect x="5" y="6" width="14" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
            <circle cx="7.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="11.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="15.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
            <path d="M7 15c1 0 3-.5 5-.5s4 .5 5 .5" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="rgba(255,255,255,0.15)" stroke-width="1" fill="none"/>
            <defs>
              <linearGradient id="grad2" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
                <stop stop-color="#0066b2"/>
                <stop offset="1" stop-color="#0078d4"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <div class="ghost-dock__shelf">
        <div class="ghost-dock__empty">No ghost tabs</div>
      </div>
    `;
  }

  const getScore = (tab: GhostTab) => {
    let score = 0;
    if (tab.pinned) score += 30;
    if ((tab.restoreCount || 0) > 0) score += 20;
    score += Math.min((tab.totalActiveTimeMs || 0) / 1000, 20);
    const recency = tab.parkedAt || tab.lastActiveAt || 0;
    if (recency) {
      const hoursSince = (Date.now() - recency) / (1000 * 60 * 60);
      score += Math.max(0, 10 - hoursSince / 24);
    }
    return score;
  };

  const sortedTabs = [...ghostTabs].sort((a, b) => getScore(b) - getScore(a));

  const resumeTabs = sortedTabs.filter(t => getScore(t) >= 15).slice(0, 3);
  const resumeItems = resumeTabs.map(tab => createResumeTabHTML(tab)).join('');
  const tabItems = sortedTabs.map((tab) => createTabItemHTML(tab)).join('');

  return `
    <div class="ghost-dock__dock">
      <div class="ghost-dock__icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="16" rx="2" fill="url(#grad)" fill-opacity="0.9"/>
          <rect x="5" y="6" width="14" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
          <circle cx="7.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
          <circle cx="11.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
          <circle cx="15.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
          <path d="M7 15c1 0 3-.5 5-.5s4 .5 5 .5" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="rgba(255,255,255,0.15)" stroke-width="1" fill="none"/>
          <defs>
            <linearGradient id="grad" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
              <stop stop-color="#0066b2"/>
              <stop offset="1" stop-color="#0078d4"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      ${count > 0 ? `<span class="ghost-dock__badge">${count > 99 ? '99+' : count}</span>` : ''}
    </div>
    <div class="ghost-dock__shelf">
      ${resumeItems ? `
        <div class="ghost-dock__resume-bar">
          <span class="ghost-dock__resume-label">Resume</span>
          <div class="ghost-dock__resume-tabs">${resumeItems}</div>
        </div>
      ` : ''}
      <div class="ghost-dock__tab-rail">${tabItems || '<div class="ghost-dock__empty">No tabs</div>'}</div>
    </div>
  `;
}

function createTabItemHTML(tab: GhostTab): string {
  const getScore = (t: GhostTab) => {
    let score = 0;
    if (t.pinned) score += 30;
    if ((t.restoreCount || 0) > 0) score += 20;
    score += Math.min((t.totalActiveTimeMs || 0) / 1000, 20);
    const recency = t.parkedAt || t.lastActiveAt || 0;
    if (recency) {
      const hoursSince = (Date.now() - recency) / (1000 * 60 * 60);
      score += Math.max(0, 10 - hoursSince / 24);
    }
    return score;
  };
  const isResume = getScore(tab) >= 15;
  const isPriority = getScore(tab) >= 10;
  
  const favicon = tab.faviconUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(tab.domain)}&sz=32`;
  const aiMeta = aiMetadataMap[tab.id];
  const displayIntent = aiMeta?.aiIntent || tab.intent;
  const intentColor = INTENT_COLORS[displayIntent as Intent] || INTENT_COLORS.unknown;
  const timeAgo = getTimeAgo(tab.parkedAt);
  const tooltipText = `Resume this: ${tab.title || tab.domain} (${timeAgo})`;
  
  return `
    <div class="ghost-dock__tab ${isResume ? 'ghost-dock__tab--resume' : ''} ${isPriority && !isResume ? 'ghost-dock__tab--priority' : ''}" data-id="${tab.id}" title="${tooltipText}">
      <img class="ghost-dock__tab-favicon" src="${favicon}" alt="" />
      <span class="ghost-dock__tab-title">${escapeHtml(tab.title || tab.domain)}</span>
      ${isResume ? '<span class="ghost-dock__tab-resume-dot"></span>' : ''}
      <span class="ghost-dock__tab-indicator" style="background-color: ${intentColor}"></span>
    </div>
  `;
}

function createResumeTabHTML(tab: GhostTab): string {
  const favicon = tab.faviconUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(tab.domain)}&sz=32`;
  const timeAgo = getTimeAgo(tab.parkedAt);
  
  return `
    <div class="ghost-dock__resume-tab" data-id="${tab.id}" title="Resume: ${tab.title || tab.domain} (${timeAgo})">
      <img class="ghost-dock__resume-favicon" src="${favicon}" alt="" />
      <span class="ghost-dock__resume-title">${escapeHtml(tab.title || tab.domain)}</span>
    </div>
  `;
}

function getTimeAgo(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setupDockEvents(dock: HTMLElement) {
  const dockClickArea = dock.querySelector('.ghost-dock__dock') as HTMLElement;
  if (!dockClickArea) {
    console.error('GhostTabs: Dock click area not found');
    return;
  }

  dockClickArea.onclick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      handleDoubleClick();
    } else {
      clickTimer = setTimeout(() => {
        clickTimer = null;
        handleSingleClick();
      }, 400);
    }
  };

  dockClickArea.ondblclick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    handleDoubleClick();
  };

  dock.querySelectorAll('.ghost-dock__tab').forEach(tabEl => {
    const el = tabEl as HTMLElement;

    el.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.dataset.id;
      if (id) {
        await restoreTab(id);
      }
    };

    el.oncontextmenu = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.dataset.id;
      if (id) {
        await deleteTab(id);
      }
    };
  });
  
  dock.querySelectorAll('.ghost-dock__resume-tab').forEach(tabEl => {
    const el = tabEl as HTMLElement;

    el.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.dataset.id;
      if (id) {
        await restoreTab(id);
      }
    };

    el.oncontextmenu = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.dataset.id;
      if (id) {
        await deleteTab(id);
      }
    };
  });

  console.log('GhostTabs: Dock events set up');
}

function handleSingleClick() {
  isExpanded = !isExpanded;
  const dock = document.getElementById('ghost-dock');
  if (dock) {
    dock.classList.toggle('ghost-dock--expanded', isExpanded);
  }
}

async function handleDoubleClick() {
  const response = await chrome.runtime.sendMessage({ type: 'PARK_CURRENT_TAB' });
  if (response.success) {
    if (response.data?.skipped) {
      showToast(t?.toastAlreadySaved || 'Already in Ghost Shelf', 'warning');
    } else {
      showToast(t?.toastSaved || 'Saved to GhostTabs', 'success');
    }
    await loadGhostTabs();
    updateDock();
  }
}

async function restoreTab(id: string) {
  const response = await chrome.runtime.sendMessage({
    type: 'RESTORE_TAB',
    payload: { id },
  });

  if (response.success) {
    showToast(t?.toastRestored || 'Restored', 'success');
    await loadGhostTabs();
    updateDock();
  } else {
    showToast(t?.toastFailedRestore || 'Failed to restore', 'warning');
  }
}

async function deleteTab(id: string) {
  const response = await chrome.runtime.sendMessage({
    type: 'DELETE_TAB',
    payload: { id },
  });

  if (response.success) {
    showToast(t?.toastRemoved || 'Removed', 'info');
    await loadGhostTabs();
    updateDock();
  }
}

function updateDock() {
  const dock = document.getElementById('ghost-dock');
  if (dock) {
    const existingDock = dock.querySelector('.ghost-dock__dock');
    const existingBadge = dock.querySelector('.ghost-dock__badge');
    const tabRail = dock.querySelector('.ghost-dock__tab-rail') as HTMLElement | null;
    const prevScrollLeft = tabRail?.scrollLeft ?? 0;
    const prevBadgeText = existingBadge?.textContent ?? '';
    
    const newCount = ghostTabs.length;
    const newBadgeText = newCount > 0 ? (newCount > 99 ? '99+' : String(newCount)) : '';
    
    if (prevBadgeText === newBadgeText && existingDock) {
      const newShelfHTML = createShelfHTML();
      const shelfEl = dock.querySelector('.ghost-dock__shelf');
      if (shelfEl) {
        shelfEl.innerHTML = newShelfHTML;
        setupDockEvents(dock);
        const newTabRail = dock.querySelector('.ghost-dock__tab-rail') as HTMLElement | null;
        if (newTabRail) {
          requestAnimationFrame(() => {
            newTabRail.scrollLeft = prevScrollLeft;
          });
        }
      }
    } else if (existingDock) {
      const newShelfHTML = createShelfHTML();
      const shelfEl = dock.querySelector('.ghost-dock__shelf');
      if (shelfEl) {
        shelfEl.innerHTML = newShelfHTML;
      }
      if (existingBadge) {
        existingBadge.textContent = newBadgeText;
      } else if (newBadgeText) {
        const badge = document.createElement('span');
        badge.className = 'ghost-dock__badge';
        badge.textContent = newBadgeText;
        existingDock.appendChild(badge);
      }
      setupDockEvents(dock);
    } else {
      dock.innerHTML = createDockHTML();
      setupDockEvents(dock);
    }
  }
}

function createShelfHTML(): string {
  const getScore = (tab: GhostTab) => {
    let score = 0;
    if (tab.pinned) score += 30;
    if ((tab.restoreCount || 0) > 0) score += 20;
    score += Math.min((tab.totalActiveTimeMs || 0) / 1000, 20);
    const recency = tab.parkedAt || tab.lastActiveAt || 0;
    if (recency) {
      const hoursSince = (Date.now() - recency) / (1000 * 60 * 60);
      score += Math.max(0, 10 - hoursSince / 24);
    }
    return score;
  };

  const sortedTabs = [...ghostTabs].sort((a, b) => getScore(b) - getScore(a));

  const resumeTabs = sortedTabs.filter(t => getScore(t) >= 15).slice(0, 3);
  const resumeItems = resumeTabs.map(tab => createResumeTabHTML(tab)).join('');
  const tabItems = sortedTabs.map((tab) => createTabItemHTML(tab)).join('');

  return `
    ${resumeItems ? `
      <div class="ghost-dock__resume-bar">
        <span class="ghost-dock__resume-label">Resume</span>
        <div class="ghost-dock__resume-tabs">${resumeItems}</div>
      </div>
    ` : ''}
    <div class="ghost-dock__tab-rail">${tabItems || '<div class="ghost-dock__empty">No tabs</div>'}</div>
  `;
}

init().catch(console.error);