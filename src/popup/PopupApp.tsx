import { useEffect, useState, useCallback } from 'react';
import type { GhostTab } from '../lib/types';

export default function PopupApp() {
  const [ghostTabs, setGhostTabs] = useState<GhostTab[]>([]);
  const [parking, setParking] = useState(false);

  const loadGhostTabs = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_GHOST_TABS' });
      if (response.success && response.data) {
        setGhostTabs(response.data);
      }
    } catch (error) {
      console.error('Error loading ghost tabs:', error);
    }
  }, []);

  useEffect(() => {
    loadGhostTabs();
  }, [loadGhostTabs]);

  const handleParkCurrentTab = async () => {
    setParking(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.runtime.sendMessage({ type: 'PARK_TAB', payload: tab.id });
        await loadGhostTabs();
        await chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
      }
    } catch (error) {
      console.error('Error parking tab:', error);
    } finally {
      setParking(false);
    }
  };

  const handleParkAll = async () => {
    setParking(true);
    try {
      await chrome.runtime.sendMessage({ type: 'PARK_ALL_INACTIVE' });
      await loadGhostTabs();
      await chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
    } catch (error) {
      console.error('Error parking tabs:', error);
    } finally {
      setParking(false);
    }
  };

  const handleOpenShelf = () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  };

  const handleSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const activeTabs = ghostTabs.filter(t => t.status === 'ghosted');

  return (
    <div className="popup">
      <div className="popup-header">
        <div className="header-left">
          <span className="app-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3C7.58 3 4 6.58 4 11c0 2.86 1.56 5.38 3.94 7.01.16.11.27.27.31.45.04.19.01.39-.09.56-.1.17-.25.3-.44.36-.18.06-.38.04-.55-.06-.26-.16-.52-.31-.78-.47C5.2 17.43 4 14.83 4 11c0-4.42 3.58-8 8-8s8 3.58 8 8c0 3.83-1.2 6.43-2.18 7.85-.27.16-.52.31-.78.47-.17.1-.37.12-.55.06-.19-.06-.34-.19-.44-.36-.1-.17-.13-.37-.09-.56.04-.18.15-.34.31-.45C18.44 16.38 20 13.86 20 11c0-4.42-3.58-8-8-8z" fill="#7c5cff"/>
              <circle cx="8.5" cy="9.5" r="1.5" fill="#7c5cff"/>
              <circle cx="15.5" cy="9.5" r="1.5" fill="#7c5cff"/>
              <path d="M8 15c.5.5 1.5 1 4 1s3.5-.5 4-1" stroke="#7c5cff" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>
          </span>
          <span className="app-name">GhostTabs</span>
          {activeTabs.length > 0 && (
            <span className="count-badge">{activeTabs.length}</span>
          )}
        </div>
        <button className="icon-btn settings-btn" onClick={handleSettings} title="Settings">
          ⚙
        </button>
      </div>

      <div className="action-row">
        <button
          className="action-btn"
          onClick={handleParkCurrentTab}
          disabled={parking}
          title="Park current tab"
        >
          <span className="action-icon">◻</span>
          <span className="action-label">Park</span>
        </button>
        <button className="action-btn" onClick={handleParkAll} disabled={parking} title="Park inactive">
          <span className="action-icon">▣</span>
          <span className="action-label">Park All</span>
        </button>
        <button className="action-btn primary-action" onClick={handleOpenShelf} title="Open Ghost Shelf">
          <span className="action-icon">☰</span>
          <span className="action-label">Shelf</span>
        </button>
      </div>
    </div>
  );
}
