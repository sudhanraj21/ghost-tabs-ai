import type { GhostTab } from '../../lib/types';
import { INTENT_LABELS } from '../../lib/types';

interface GhostCardProps {
  tab: GhostTab;
  onRestore: (tab: GhostTab) => void;
  onDelete: (tab: GhostTab) => void;
  onArchive: (tab: GhostTab) => void;
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default function GhostCard({ tab, onRestore, onDelete, onArchive }: GhostCardProps) {
  const isRestored = tab.status === 'restored';
  const isArchived = tab.status === 'archived';
  const showStatus = isRestored || isArchived;
  const hasAiMetadata = !!(tab.aiCategory || tab.aiLabel || tab.aiSummary);
  
  return (
    <div className="ghost-card" onClick={() => !showStatus && onRestore(tab)}>
      <div className="favicon">
        {tab.faviconUrl ? (
          <img src={tab.faviconUrl} alt="" />
        ) : (
          <span className="favicon-placeholder">📄</span>
        )}
      </div>
      <div className="content">
        <div className="title" title={tab.title}>{tab.title}</div>
        {tab.aiSummary && (
          <div className="ai-summary" title={tab.aiSummary}>{tab.aiSummary}</div>
        )}
        <div className="meta">
          <span className="domain">{tab.domain}</span>
          <span className="time">{formatTime(tab.parkedAt)}</span>
          {showStatus && (
            <span className={`status-badge ${tab.status}`}>
              {isRestored ? 'Restored' : 'Archived'}
            </span>
          )}
          {!showStatus && (
            <span className={`intent-badge ${tab.intent}`}>
              {INTENT_LABELS[tab.intent]}
            </span>
          )}
          {hasAiMetadata && (
            <span className="ai-badge">
              {tab.aiCategoryLabel || tab.aiCategory}
            </span>
          )}
        </div>
      </div>
      <div className="card-actions">
        {!showStatus && (
          <button
            className="action-btn"
            onClick={(e) => { e.stopPropagation(); onRestore(tab); }}
            title="Restore"
          >
            ↗
          </button>
        )}
        {!showStatus && (
          <button
            className="action-btn"
            onClick={(e) => { e.stopPropagation(); onArchive(tab); }}
            title="Archive"
          >
            📁
          </button>
        )}
        <button
          className="action-btn danger"
          onClick={(e) => { e.stopPropagation(); onDelete(tab); }}
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
}
