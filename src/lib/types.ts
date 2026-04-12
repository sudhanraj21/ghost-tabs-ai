import type { Locale } from './i18n';

export type Intent =
  | 'watch_later'
  | 'learn_later'
  | 'read_later'
  | 'buy_later'
  | 'compare_later'
  | 'work'
  | 'temporary'
  | 'unknown';

export type GhostStatus = 'ghosted' | 'restored' | 'archived';

export interface GhostTab {
  id: string;
  originalTabId?: number;
  url: string;
  title: string;
  faviconUrl?: string;
  domain: string;
  intent: Intent;
  confidence: number;
  createdAt: number;
  parkedAt: number;
  lastActiveAt: number;
  totalActiveTimeMs: number;
  restoreCount: number;
  groupId?: string;
  pinned?: boolean;
  tags?: string[];
  notes?: string;
  status: GhostStatus;
  skipped?: boolean;
}

export type GhostShelfPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface GhostSettings {
  autoParkEnabled: boolean;
  autoParkThresholdMinutes: number;
  ignorePinnedTabs: boolean;
  ignoreAudibleTabs: boolean;
  ignoreMeetingTabs: boolean;
  meetingDomains: string[];
  maxActiveTabsBeforeSuggestion: number;
  excludedDomains: string[];
  reminderEnabled: boolean;
  reminderFrequency: 'daily' | 'weekly' | 'never';
  showBadgeCount: boolean;
  closeTabsOnPark: boolean;
  showGhostShelfOverlay: boolean;
  ghostShelfPosition: GhostShelfPosition;
  ghostShelfStartCollapsed: boolean;
  language: Locale;
}

export interface TabActivity {
  tabId: number;
  url: string;
  title: string;
  lastActiveAt: number;
  totalActiveTimeMs: number;
  isPinned: boolean;
  isAudible: boolean;
  groupId?: number;
}

export interface IntentRule {
  id: string;
  pattern: string;
  patternType: 'domain' | 'url' | 'title';
  intent: Intent;
  confidence: number;
  enabled: boolean;
}

export interface IntentOverride {
  url: string;
  intent: Intent;
  timestamp: number;
}

export interface DailySummary {
  date: string;
  tabsParked: number;
  tabsRestored: number;
  topIntents: { intent: Intent; count: number }[];
}

export const DEFAULT_SETTINGS: GhostSettings = {
  autoParkEnabled: true,
  autoParkThresholdMinutes: 30,
  ignorePinnedTabs: true,
  ignoreAudibleTabs: true,
  ignoreMeetingTabs: true,
  meetingDomains: ['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'webex.com', 'Whereby', 'jitsi.org', 'chime.aws'],
  maxActiveTabsBeforeSuggestion: 8,
  excludedDomains: [],
  reminderEnabled: true,
  reminderFrequency: 'weekly',
  showBadgeCount: true,
  closeTabsOnPark: true,
  showGhostShelfOverlay: true,
  ghostShelfPosition: 'bottom-right',
  ghostShelfStartCollapsed: true,
  language: 'en',
};

export const INTENT_LABELS: Record<Intent, string> = {
  watch_later: 'Watch Later',
  learn_later: 'Learn Later',
  read_later: 'Read Later',
  buy_later: 'Buy Later',
  compare_later: 'Compare Later',
  work: 'Work',
  temporary: 'Temporary',
  unknown: 'Unknown',
};

export const INTENT_ICONS: Record<Intent, string> = {
  watch_later: '▶',
  learn_later: '📚',
  read_later: '📖',
  buy_later: '🛒',
  compare_later: '⚖',
  work: '💼',
  temporary: '⏱',
  unknown: '📄',
};

export const INTENT_COLORS: Record<Intent, string> = {
  watch_later: '#E91E63',
  learn_later: '#9C27B0',
  read_later: '#2196F3',
  buy_later: '#4CAF50',
  compare_later: '#FF9800',
  work: '#607D8B',
  temporary: '#9E9E9E',
  unknown: '#795548',
};
