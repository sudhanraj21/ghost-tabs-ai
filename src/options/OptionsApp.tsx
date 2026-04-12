import { useEffect, useState, useCallback } from 'react';
import type { GhostSettings } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';
import type { AISettings } from '../lib/ai-types';
import { DEFAULT_AI_SETTINGS } from '../lib/ai-types';
import { getLastAIError } from '../lib/ai-error-handler';
import { SUPPORTED_LOCALES, getTranslations, type Locale, getSystemLocale } from '../lib/i18n';

export default function OptionsApp() {
  const [settings, setSettings] = useState<GhostSettings>(DEFAULT_SETTINGS);
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  
  const t = getTranslations(settings.language || getSystemLocale());

  const loadSettings = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success && response.data) {
        const loadedSettings = response.data;
        if (!loadedSettings.language) {
          loadedSettings.language = getSystemLocale();
        }
        setSettings(loadedSettings);
      }
      
      const { getAISettings } = await import('../lib/ai-storage');
      const ai = await getAISettings();
      setAiSettings(ai);
      
      const error = await getLastAIError();
      setAiError(error?.message || null);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { saveSettings } = await import('../lib/storage');
      await saveSettings(settings);
      
      const { setAISettings } = await import('../lib/ai-storage');
      await setAISettings(aiSettings);
      
      await chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = (locale: Locale) => {
    setSettings(prev => ({ ...prev, language: locale }));
  };

  const handleToggle = (key: keyof GhostSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAiToggle = (key: keyof AISettings) => {
    if (key === 'aiEnabled' || key === 'aiAutoEnrichOnPark' || key === 'aiDuplicateDetection' || key === 'aiAutoLabeling' || key === 'aiSmartPrediction') {
      setAiSettings(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handleAiApiKeyChange = (value: string) => {
    setAiSettings(prev => ({ ...prev, aiApiKey: value }));
    setAiError(null);
  };

  const handleClearAiError = async () => {
    const { clearAIError: clearError } = await import('../lib/ai-error-handler');
    await clearError();
    setAiError(null);
  };

  const handleNumberChange = (key: keyof GhostSettings, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setSettings(prev => ({ ...prev, [key]: num }));
    }
  };

  const handleSelectChange = (key: keyof GhostSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addExcludedDomain = () => {
    if (!newDomain.trim()) return;
    
    let domain = newDomain.trim();
    if (domain.includes('://')) {
      try {
        domain = new URL(domain.startsWith('http') ? domain : 'https://' + domain).hostname;
      } catch {
        domain = domain.replace(/^https?:\/\//, '').split('/')[0];
      }
    }
    domain = domain.replace(/^www\./, '').toLowerCase();
    
    if (domain && !settings.excludedDomains.includes(domain)) {
      setSettings(prev => ({
        ...prev,
        excludedDomains: [...prev.excludedDomains, domain],
      }));
      setNewDomain('');
    }
  };

  const removeExcludedDomain = (domain: string) => {
    setSettings(prev => ({
      ...prev,
      excludedDomains: prev.excludedDomains.filter(d => d !== domain),
    }));
  };

  if (loading) {
    return (
      <div className="options">
        <p>{t.settings}</p>
      </div>
    );
  }

  return (
    <div className="options">
      <header className="header">
        <div className="header-left">
          <div className="header-icon">👻</div>
          <div className="header-content">
            <h1>{t.appName}</h1>
            <p>{t.settings}</p>
          </div>
        </div>
        <div className="header-right">
          <select
            className="language-select"
            value={settings.language || 'en'}
            onChange={(e) => handleLanguageChange(e.target.value as Locale)}
          >
            {SUPPORTED_LOCALES.map(locale => (
              <option key={locale.code} value={locale.code}>
                {locale.nativeName}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="section">
        <h2 className="section-title">{t.autoPark}</h2>
        <div className="setting-group">
          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.enableAutoPark}</h4>
              <p>Automatically move tabs to Ghost Shelf after they become inactive</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoParkEnabled}
                onChange={() => handleToggle('autoParkEnabled')}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.inactivityThreshold}</h4>
              <p>Minutes of no activity before a tab is considered inactive</p>
            </div>
            <div className="input-field">
              <input
                type="number"
                min="1"
                max="1440"
                value={settings.autoParkThresholdMinutes}
                onChange={(e) => handleNumberChange('autoParkThresholdMinutes', e.target.value)}
              />
              <span>{t.minutes}</span>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.maxTabsSuggestion}</h4>
              <p>Suggest parking when tab count exceeds this</p>
            </div>
            <div className="input-field">
              <input
                type="number"
                min="1"
                max="100"
                value={settings.maxActiveTabsBeforeSuggestion}
                onChange={(e) => handleNumberChange('maxActiveTabsBeforeSuggestion', e.target.value)}
              />
              <span>{t.tabs}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t.tabProtection}</h2>
        <div className="setting-group">
          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.ignorePinnedTabs}</h4>
              <p>Never auto-park pinned tabs</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.ignorePinnedTabs}
                onChange={() => handleToggle('ignorePinnedTabs')}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.ignoreMediaTabs}</h4>
              <p>Never auto-park tabs that are playing audio or video</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.ignoreAudibleTabs}
                onChange={() => handleToggle('ignoreAudibleTabs')}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.ignoreMeetingTabs}</h4>
              <p>Never auto-park video meeting tabs (Zoom, Teams, Meet, etc.)</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.ignoreMeetingTabs}
                onChange={() => handleToggle('ignoreMeetingTabs')}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.closeTabsOnPark}</h4>
              <p>Close original tab when parking (recommended)</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.closeTabsOnPark}
                onChange={() => handleToggle('closeTabsOnPark')}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t.excludedDomains}</h2>
        <div className="setting-group">
          <div className="domain-section">
            <p>{t.domainsNote}</p>
            
            {settings.excludedDomains.length > 0 && (
              <div className="domain-list">
                {settings.excludedDomains.map(domain => (
                  <span key={domain} className="domain-tag">
                    {domain}
                    <button onClick={() => removeExcludedDomain(domain)}>×</button>
                  </span>
                ))}
              </div>
            )}
            
            <div className="add-domain">
              <input
                type="text"
                placeholder="e.g., github.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExcludedDomain()}
              />
              <button onClick={addExcludedDomain}>{t.addDomain}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t.notifications}</h2>
        <div className="setting-group">
          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.enableReminders}</h4>
              <p>Show notifications about pending ghost tabs</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.reminderEnabled}
                onChange={() => handleToggle('reminderEnabled')}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.reminderFrequency}</h4>
              <p>How often to remind about ghost tabs</p>
            </div>
            <select
              className="select-field"
              value={settings.reminderFrequency}
              onChange={(e) => handleSelectChange('reminderFrequency', e.target.value)}
            >
              <option value="daily">{t.daily}</option>
              <option value="weekly">{t.weekly}</option>
              <option value="never">{t.never}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t.display}</h2>
        <div className="setting-group">
          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.showBadgeCount}</h4>
              <p>Display ghost tab count on extension icon</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showBadgeCount}
                onChange={() => handleToggle('showBadgeCount')}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.showGhostShelfOverlay}</h4>
              <p>Show dock on web pages to access ghost tabs</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showGhostShelfOverlay}
                onChange={() => handleToggle('showGhostShelfOverlay')}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.dockPosition}</h4>
              <p>Position of the ghost dock on pages</p>
            </div>
            <select
              className="select-field"
              value={settings.ghostShelfPosition}
              onChange={(e) => handleSelectChange('ghostShelfPosition', e.target.value)}
            >
              <option value="bottom-right">{t.bottomRight}</option>
              <option value="bottom-left">{t.bottomLeft}</option>
              <option value="top-right">{t.topRight}</option>
              <option value="top-left">{t.topLeft}</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.startCollapsed}</h4>
              <p>Dock starts in collapsed state</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.ghostShelfStartCollapsed}
                onChange={() => handleToggle('ghostShelfStartCollapsed')}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t.aiIntelligence}</h2>
        <div className="setting-group">
          <div className="setting-row">
            <div className="setting-info">
              <h4>{t.enableAiFeatures}</h4>
              <p>Enable smart tab analysis and predictions</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={aiSettings.aiEnabled}
                onChange={() => handleAiToggle('aiEnabled')}
              />
              <span className="slider"></span>
            </label>
          </div>

          {aiSettings.aiEnabled && (
            <>
              <div className="setting-row">
                <div className="setting-info">
                  <h4>{t.apiKey}</h4>
                  <p>Anthropic API key for AI features</p>
                </div>
                <div className="input-field">
                  <input
                    type="password"
                    placeholder="sk-ant-..."
                    value={aiSettings.aiApiKey || ''}
                    onChange={(e) => handleAiApiKeyChange(e.target.value)}
                  />
                </div>
              </div>

              {aiError && (
                <div className="ai-error-banner">
                  <span className="error-icon">⚠️</span>
                  <span className="error-message">{aiError}</span>
                  <button className="error-dismiss" onClick={handleClearAiError}>×</button>
                </div>
              )}

              <div className="setting-row">
                <div className="setting-info">
                  <h4>{t.autoEnrichOnPark}</h4>
                  <p>Analyze tabs automatically when parked</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={aiSettings.aiAutoEnrichOnPark}
                    onChange={() => handleAiToggle('aiAutoEnrichOnPark')}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <h4>{t.duplicateDetection}</h4>
                  <p>AI finds similar tabs to avoid duplicates</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={aiSettings.aiDuplicateDetection}
                    onChange={() => handleAiToggle('aiDuplicateDetection')}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <h4>{t.autoLabeling}</h4>
                  <p>AI generates custom labels for tabs</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={aiSettings.aiAutoLabeling}
                    onChange={() => handleAiToggle('aiAutoLabeling')}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <h4>{t.smartPredictions}</h4>
                  <p>AI predicts which tab you'll resume next</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={aiSettings.aiSmartPrediction}
                    onChange={() => handleAiToggle('aiSmartPrediction')}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="save-section">
        <button
          className="btn-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t.saving : t.saveSettings}
        </button>
        {saved && (
          <span className="save-status">{t.saved}</span>
        )}
      </div>

      <div className="privacy-note">
        <h4>{t.privacyNote}</h4>
        <p>All data is stored locally in your browser. GhostTabs AI does not send any tab data to external servers.</p>
      </div>

      <footer className="footer">
        <p>GhostTabs AI v1.1.0</p>
        <p className="version">{t.footerNote || 'Built with care for tab lovers'}</p>
      </footer>
    </div>
  );
}
