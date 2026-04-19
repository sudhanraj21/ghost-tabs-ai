import { useEffect, useState, useCallback } from 'react';
import type { GhostTab, Intent, GhostSettings } from '../lib/types';
import { INTENT_LABELS } from '../lib/types';
import type { Translations } from '../lib/i18n';
import GhostCard from './components/GhostCard';
import SearchBar from './components/SearchBar';
import FilterChips from './components/FilterChips';
import EmptyState from './components/EmptyState';

interface CleanerReport {
  duplicateGroups: { canonicalId: string; duplicateIds: string[] }[];
  totalCandidates: number;
  generatedAt: number;
}

type FilterType = 'all' | Intent;
type ViewTab = 'shelved' | 'history';

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'watch_later', label: 'Watch' },
  { id: 'learn_later', label: 'Learn' },
  { id: 'read_later', label: 'Read' },
  { id: 'buy_later', label: 'Buy' },
  { id: 'compare_later', label: 'Compare' },
  { id: 'work', label: 'Work' },
];

export default function App() {
  const [ghostTabs, setGhostTabs] = useState<GhostTab[]>([]);
  const [filteredTabs, setFilteredTabs] = useState<GhostTab[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewTab>('shelved');
  const [translations, setTranslations] = useState<Translations | null>(null);
  const [settings, setSettings] = useState<GhostSettings | null>(null);
  const [cleanerReport, setCleanerReport] = useState<CleanerReport | null>(null);
  const [cleanerLoading, setCleanerLoading] = useState(false);
  const [aiCategorizing, setAiCategorizing] = useState(false);

  const loadTranslations = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TRANSLATIONS' });
      if (response.success && response.data) {
        setTranslations(response.data);
      }
    } catch (error) {
      console.error('Error loading translations:', error);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success && response.data) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  const scanCleaner = useCallback(async () => {
    setCleanerLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_DEAD_TAB_CLEANER_REPORT' });
      if (response.success && response.data) {
        setCleanerReport(response.data);
      }
    } catch (error) {
      console.error('Error scanning cleaner:', error);
    } finally {
      setCleanerLoading(false);
    }
  }, []);

  const runCleaner = useCallback(async () => {
    setCleanerLoading(true);
    try {
      await chrome.runtime.sendMessage({ type: 'RUN_DEAD_TAB_CLEANUP' });
      await loadGhostTabs();
      setCleanerReport(null);
    } catch (error) {
      console.error('Error running cleaner:', error);
    } finally {
      setCleanerLoading(false);
    }
  }, []);

  const runAiCategorization = useCallback(async () => {
    if (!settings?.aiEnabled || !settings.aiApiKey) return;
    setAiCategorizing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'RUN_AI_CATEGORIZATION_ALL' });
      await loadGhostTabs();
    } catch (error) {
      console.error('Error running AI categorization:', error);
    } finally {
      setAiCategorizing(false);
    }
  }, [settings]);

  const loadGhostTabs = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_GHOST_TABS' });
      if (response.success && response.data) {
        setGhostTabs(response.data);
      }
    } catch (error) {
      console.error('Error loading ghost tabs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGhostTabs();
    loadTranslations();
    loadSettings();
    scanCleaner();
    
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'GHOST_TABS_UPDATED') {
        loadGhostTabs();
      }
    });
    
    const interval = setInterval(() => {
      loadGhostTabs();
      loadTranslations();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadGhostTabs, loadTranslations, loadSettings, scanCleaner]);

  useEffect(() => {
    let result = ghostTabs.filter(t => t.status === 'ghosted');
    
    if (activeFilter !== 'all') {
      result = result.filter(tab => tab.intent === activeFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        tab =>
          tab.title.toLowerCase().includes(query) ||
          tab.url.toLowerCase().includes(query) ||
          tab.domain.toLowerCase().includes(query)
      );
    }
    
    setFilteredTabs(result);
  }, [ghostTabs, activeFilter, searchQuery]);

  const recentHistory = [...ghostTabs]
    .sort((a, b) => (b.lastActiveAt || b.parkedAt || 0) - (a.lastActiveAt || a.parkedAt || 0))
    .slice(0, 20);

  const handleRestore = async (tab: GhostTab) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'RESTORE_TAB',
        payload: { id: tab.id },
      });
      await loadGhostTabs();
    } catch (error) {
      console.error('Error restoring tab:', error);
    }
  };

  const handleDelete = async (tab: GhostTab) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_TAB',
        payload: { id: tab.id },
      });
      await loadGhostTabs();
    } catch (error) {
      console.error('Error deleting tab:', error);
    }
  };

  const handleArchive = async (tab: GhostTab) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'ARCHIVE_TAB',
        payload: { id: tab.id },
      });
      await loadGhostTabs();
    } catch (error) {
      console.error('Error archiving tab:', error);
    }
  };

  const groupedTabs = filteredTabs.reduce((acc, tab) => {
    const intent = tab.intent;
    if (!acc[intent]) acc[intent] = [];
    acc[intent].push(tab);
    return acc;
  }, {} as Record<Intent, GhostTab[]>);

  const totalGhost = ghostTabs.filter(t => t.status === 'ghosted').length;

  const intentCounts = ghostTabs.reduce((acc, tab) => {
    if (tab.status === 'ghosted') {
      acc[tab.intent] = (acc[tab.intent] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3C7.58 3 4 6.58 4 11c0 2.86 1.56 5.38 3.94 7.01.16.11.27.27.31.45.04.19.01.39-.09.56-.1.17-.25.3-.44.36-.18.06-.38.04-.55-.06-.26-.16-.52-.31-.78-.47C5.2 17.43 4 14.83 4 11c0-4.42 3.58-8 8-8s8 3.58 8 8c0 3.83-1.2 6.43-2.18 7.85-.27.16-.52.31-.78.47-.17.1-.37.12-.55.06-.19-.06-.34-.19-.44-.36-.1-.17-.13-.37-.09-.56.04-.18.15-.34.31-.45C18.44 16.38 20 13.86 20 11c0-4.42-3.58-8-8-8z" fill="#7c5cff"/>
              <circle cx="8.5" cy="9.5" r="1.5" fill="#7c5cff"/>
              <circle cx="15.5" cy="9.5" r="1.5" fill="#7c5cff"/>
              <path d="M8 15c.5.5 1.5 1 4 1s3.5-.5 4-1" stroke="#7c5cff" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>
          </div>
          <div>
            <div className="header-title">GhostTabs</div>
            <div className="header-subtitle">Your parked tabs</div>
          </div>
        </div>
        <div className="header-right">
          {totalGhost > 0 && (
            <span className="ghost-count">{totalGhost}</span>
          )}
          <button
            className="icon-btn"
            onClick={() => chrome.runtime.openOptionsPage()}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <div className="summary-bar">
        <div className="summary-item">
          <span>Ghost tabs:</span>
          <span className="summary-value">{totalGhost}</span>
        </div>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${activeView === 'shelved' ? 'active' : ''}`}
            onClick={() => setActiveView('shelved')}
          >
            {translations?.shelvedLabel || 'Shelved'} ({totalGhost})
          </button>
          <button
            className={`toggle-btn ${activeView === 'history' ? 'active' : ''}`}
            onClick={() => setActiveView('history')}
          >
            {translations?.historyLabel || 'History'} ({recentHistory.length})
          </button>
        </div>
      </div>

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <FilterChips
        filters={FILTERS}
        activeFilter={activeFilter}
        onFilterChange={(filter) => setActiveFilter(filter as FilterType)}
        counts={intentCounts}
      />

      {cleanerReport && (
        <div className="cleaner-card">
          <div className="cleaner-header">
            <span className="cleaner-title">Dead Tab Cleaner</span>
            <span className="cleaner-count">{cleanerReport.totalCandidates} duplicates</span>
          </div>
          <div className="cleaner-actions">
            <button className="cleaner-btn primary" onClick={runCleaner} disabled={cleanerLoading || cleanerReport.totalCandidates === 0}>
              {cleanerLoading ? 'Cleaning...' : `Clean ${cleanerReport.totalCandidates} duplicates`}
            </button>
            <button className="cleaner-btn secondary" onClick={() => setCleanerReport(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {settings?.aiEnabled && settings?.aiApiKey && (
        <div className="ai-card">
          <div className="ai-header">
            <span className="ai-title">AI Auto-Categorization</span>
          </div>
          <div className="ai-actions">
            <button className="ai-btn" onClick={runAiCategorization} disabled={aiCategorizing}>
              {aiCategorizing ? 'Categorizing...' : 'Run AI Categorization'}
            </button>
          </div>
        </div>
      )}

      <div className="content">
        {loading ? (
          <div className="empty-state">
            <p>Loading...</p>
          </div>
        ) : activeView === 'history' ? (
          <div className="history-section">
            <div className="section-header">
              <span className="section-title">{translations?.historyLabel || 'Recent History'}</span>
              <span className="section-count">{recentHistory.length}</span>
            </div>
            {recentHistory.length === 0 ? (
              <div className="empty-state">
                <p>{translations?.noHistory || 'No activity yet. Your recent tabs will appear here.'}</p>
              </div>
            ) : (
              <div className="ghost-list">
                {recentHistory.map(tab => (
                  <GhostCard
                    key={tab.id}
                    tab={tab}
                    onRestore={handleRestore}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            )}
          </div>
        ) : filteredTabs.length === 0 ? (
          <EmptyState ghostCount={totalGhost} />
        ) : (
          Object.entries(groupedTabs).map(([intent, tabs]) => (
            <section key={intent} className="section">
              <div className="section-header">
                <span className="section-title">{INTENT_LABELS[intent as Intent]}</span>
                <span className="section-count">{tabs.length}</span>
              </div>
              <div className="ghost-list">
                {tabs.map(tab => (
                  <GhostCard
                    key={tab.id}
                    tab={tab}
                    onRestore={handleRestore}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <footer className="footer">
        <span>Local storage only · Privacy first</span>
        <a href="#" onClick={() => chrome.runtime.openOptionsPage()}>
          Settings
        </a>
      </footer>
    </div>
  );
}
