# Changelog

All notable changes to GhostTabs AI will be documented in this file.

## [1.1.0] - 2024

### Architecture Improvements

- **Unified restore logic**: Removed duplicated restore functionality. All restore operations now flow through `park-manager.ts` for consistency. Service worker calls the shared function instead of mutating storage directly.

- **Fixed activity tracking semantics**: Refactored `tab-tracker.ts` to separate metadata updates from activity timestamps. `lastActiveAt` is now only updated on true user activation events, not on every metadata refresh. This improves auto-park accuracy.

- **Removed unused settings**: Removed `autoRestoreOnClick` setting that was declared but never implemented. Cleaned up type definitions.

- **Added shared storage functions**: Created `archiveTab()` and `deleteTab()` functions in `park-manager.ts` for consistent state management.

- **Fixed notification icon**: Updated notification to use consistent SVG icon path (`/assets/icon128.svg`).

### UI Redesign

- **Design system**: Created shared CSS design tokens (`tokens.css`) with Mac-inspired color palette, spacing, typography, and shadow values. Reduced visual saturation for a premium feel.

- **Popup redesign**: Transformed from dense dashboard to compact quick-actions surface:
  - Clean header with app icon and ghost count
  - Primary CTA: Park Current Tab
  - Secondary CTA: Open Ghost Shelf
  - Compact recent ghost tabs list with favicons and intent labels
  - Minimal footer with settings link

- **Side panel redesign**: Improved as the main product interface:
  - Sticky header with ghost count badge
  - Summary bar with quick stats and park button
  - Improved search input with better focus states
  - Segmented filter chips with counts
  - Premium ghost tab cards with visible restore actions on hover
  - Better empty states with helpful guidance

- **Options page redesign**: Resembles native preferences panel:
  - Grouped settings in cards with hover states
  - Clean toggle switches
  - Consistent input styling
  - Removed fake documentation links
  - Polished privacy note

### Visual Changes

- Replaced heavy blue palette with neutral dark theme
- Added softer shadows and rounded corners
- Improved typography hierarchy
- Added proper focus states for accessibility
- Better scrollbar styling
- Reduced emoji usage in favor of cleaner icon treatment

## [1.0.0] - Initial Release

- Manual and auto-park inactive tabs
- Side panel ghost shelf UI
- Intent classification (Watch/Learn/Read/Buy/Work Later)
- Restore on click
- Configurable settings
- Context menu integration
- Badge count

---

**Notes for future development:**
- `maxActiveTabsBeforeSuggestion` is reserved for future suggestion banner feature
- Cloud sync and AI features planned for premium tier
