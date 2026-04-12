# GhostTabs AI

A Chrome extension that turns inactive tabs into lightweight "ghost tabs" shown in a visible side shelf. Save memory while keeping visibility. Resume when ready.

## Features

- **Ghost Tab Parking**: Convert inactive tabs to ghost tabs with one click or automatically
- **Side Panel Shelf**: View all ghost tabs in a persistent side panel
- **Smart Intent Detection**: Automatic classification (Watch Later, Learn Later, Read Later, etc.)
- **Quick Restore**: Click any ghost tab to restore it instantly
- **Auto-Park**: Configure automatic parking after inactivity threshold
- **Tab Protection**: Never auto-park pinned or media-playing tabs
- **Privacy First**: All data stored locally in your browser

## Architecture

```
src/
├── lib/
│   ├── types.ts           # TypeScript types and constants
│   ├── storage.ts         # Chrome storage helpers
│   ├── intent-engine.ts    # Rule-based intent classification
│   ├── tab-tracker.ts     # Tab activity tracking
│   └── park-manager.ts    # Tab parking/restoring logic
├── background/
│   └── service-worker.ts   # Background service worker
├── sidepanel/             # Side panel UI (main interface)
│   ├── main.tsx
│   ├── App.tsx
│   └── components/
├── popup/                 # Popup UI (quick actions)
│   ├── main.tsx
│   └── PopupApp.tsx
└── options/               # Settings page
    ├── main.tsx
    └── OptionsApp.tsx
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

### Loading in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from this project

### Development

```bash
# Run dev server with hot reload
npm run dev

# Type check
npm run typecheck
```

## Intent Classification

The extension uses rule-based classification for tab intent:

| Intent | Examples |
|--------|----------|
| Watch Later | YouTube, Netflix, Vimeo, Twitch |
| Learn Later | Coursera, Udemy, MDN, tutorials |
| Read Later | Medium, Dev.to, news sites, blogs |
| Buy Later | Amazon, eBay, product pages |
| Compare Later | G2, Capterra, product comparisons |
| Work | GitHub, Jira, Notion, Figma, Slack |

## Data Model

```typescript
interface GhostTab {
  id: string;
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
  status: 'ghosted' | 'restored' | 'archived';
}
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-park enabled | true | Automatically park inactive tabs |
| Inactivity threshold | 30 min | Minutes before auto-parking |
| Ignore pinned tabs | true | Never auto-park pinned tabs |
| Ignore media tabs | true | Never auto-park audible tabs |
| Close tabs on park | true | Close original tab when parking |
| Excluded domains | [] | Domains never auto-parked |
| Reminder frequency | weekly | How often to remind about ghost tabs |

## Known Limitations

- Chrome URLs (`chrome://`) cannot be parked
- Extension URLs cannot be parked
- Incognito mode requires additional permissions
- Exact scroll/form state cannot be restored (only URL)
- Side Panel API requires Chrome 114+

## Privacy

GhostTabs AI is **local-first**:
- All data stored in `chrome.storage.local`
- No external servers or APIs required
- No analytics or tracking
- Your tabs never leave your browser

## Future Enhancements

- [ ] Cloud sync (premium)
- [ ] AI-powered page summarization (premium)
- [ ] Cross-device support
- [ ] Firefox/Edge extensions
- [ ] Keyboard shortcuts
- [ ] Bulk operations
- [ ] Export/import data

## License

MIT
