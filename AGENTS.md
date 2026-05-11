# AGENTS.md - Block Engine MVP

## Project Overview
A visual programming environment (Blockly-inspired) MVP where players use drag-and-drop code blocks to control a character through maze-like levels. Built with vanilla JavaScript (ES6+), no frameworks.

## Architecture

### Core Principle
Strict separation between **Engine** (game logic) and **UI** (DOM manipulation). Never mix DOM operations with game rules.

### Directory Structure
```
block-engine-mvp/
├── index.html              # Main HTML with Palette, Workspace, Stage sections
├── server.js               # Simple HTTP server for testing (Node.js)
├── CONTEXT.md              # Session context and history
├── AGENTS.md               # This file
├── styles/
│   ├── design-system.css   # CSS variables (colors, typography, spacing)
│   ├── blocks.css          # Block styles, workspace, ranking styles, stars, tooltips
│   ├── stage.css           # Grid and actor styles
│   ├── ui.css              # Menu, modal, button styles
│   └── animations.css      # CSS animations
└── js/
    ├── app.js              # Main orchestrator, initializes all modules
    ├── engine/
    │   ├── parser.js       # Converts DOM tree → command array
    │   ├── runner.js       # Async command executor (async/await)
    │   ├── storage.js      # localStorage wrapper (progress, workspace, rankings, stars)
    │   └── levelGenerator.js # Procedural level generation (50 levels)
    └── components/
        ├── dragDrop.js     # HTML5 Drag & Drop manager
        ├── workspace.js    # Workspace block stack manager
        ├── Stage.js        # Grid, actor, collisions, game mechanics
        └── palette.js      # Block palette manager
```

## Key Patterns

### Module Pattern
All components use ES6 classes with explicit exports:
```javascript
export class Parser { ... }
export class Runner { ... }
```

### Event Delegation
Use event delegation for dynamic elements. Example from `dragDrop.js`:
```javascript
this.workspace.addEventListener('dragstart', (e) => {
    const block = e.target.closest('.block');
    // ...
});
```

### Async Execution
Runner uses async/await with delays for animation sequencing:
```javascript
async executeCommand(command) {
    await this.stage.movePlayer('up');
    await this.sleep(400); // animation delay
}
```

### localStorage Persistence
All persistence goes through `Storage` module in `js/engine/storage.js`:
- `saveProgress()` / `loadProgress()` - level, stats, player name
- `saveWorkspace()` / `loadWorkspace()` - block stack
- `addRankingEntry()` / `getRankingsByScore/Deaths/Movements()` - rankings
- `getRankingsByScoreForLevel(level)` - per-level ranking filtering
- `getAggregatedRankingsByScore/Deaths/Movements()` - global aggregated rankings (summed per player)
- `saveStars(level, data)` / `loadStars()` / `getLevelStars(level)` - star progression
- `calculateLevelBenchmark(levelData)` - BFS-based optimal moves and max score for comparison

## Coding Standards

### Naming Conventions
- **Classes**: PascalCase (`Stage`, `DragDropManager`)
- **Methods**: camelCase (`movePlayer`, `unlockDoor`)
- **CSS Variables**: kebab-case (`--color-action`, `--spacing-md`)
- **Data Attributes**: kebab-case (`data-type`, `data-param`)

### CSS Architecture
- Design tokens in `design-system.css` using CSS custom properties
- Block types use categories: `block-action` (blue), `block-control` (orange)
- Grid cells: `wall`, `path`, `hole`, `coin`, `key`, `door`, `enemy`, `boss`

### Block Types
| Type | Label | Category | Color |
|------|-------|----------|-------|
| moveUp | Mover Para Cima | action | blue |
| moveDown | Mover Para Baixo | action | blue |
| moveLeft | Mover Para Esquerda | action | blue |
| moveRight | Mover Para Direita | action | blue |
| attack | Atacar | action | blue |
| repeat | Repetir | control | orange |

## Game Mechanics

### Level Structure
Levels defined in `app.js` as array of objects:
```javascript
{
    name: 'Level Name',
    map: [['wall', 'path', ...], ...], // 10x10 grid
    player: { x: 1, y: 1 },
    enemies: [{ x: 5, y: 5, defeated: false }], // optional
    boss: { x: 7, y: 8, hp: 3, maxHp: 3 } // optional
}
```

### Grid Cell Types
- `wall` - Solid, blocks movement
- `path` - Walkable
- `start` - Player starting position (marker only, walkable)
- `hole` - Instant death
- `coin` - Collectible (+100 points)
- `key` - Unlocks door, auto-collects
- `door` - Level exit (requires key)
- `enemy` - Defeatable with attack block
- `boss` - Multi-cell, requires multiple hits

### Scoring System
- Coin: +100 points
- Key: +200 points
- Level complete: +500 points
- Boss defeat: +1000 points
- Death: -50 points

## Common Tasks

### Adding a New Block Type
1. Add HTML in `index.html` palette section
2. Add entry in `workspace.js` `getCategoryForType()` and `getLabelForType()`
3. Add command handling in `parser.js` and `runner.js`
4. Add CSS class in `blocks.css` if new category

### Adding a New Level
1. Add level object to `levels` array in `app.js`
2. Design 10x10 grid map
3. Place player start position
4. Optionally add enemies/boss

### Modifying Rankings
- Rankings stored in localStorage under `agentica_ranking`
- **Mock data always visible**: `loadRanking()` returns `[...MOCK_RANKINGS, ...userEntries]`
  - Kenji: levels 1-5, perfect runs (0 deaths, 8-18 movements)
  - Mori: levels 1-3, struggling (2-5 deaths, 15-30 movements)
- Three ranking types: by score (desc), deaths (asc), movements (asc)
- **Two ranking modes** in the rankings view:
  - **Global**: aggregated by player name, sums all levels (`getAggregatedRankingsByScore/Deaths/Movements()`)
  - **Per-level**: filters entries by specific level (`getRankingsByScoreForLevel(level)`)
- **% comparison**: for per-level mode, compares player's score/movements against benchmark (BFS optimal)
- Player name from menu input, saved in progress

### Stars System
- Each level has 3 stars to earn:
  | Condition | Stars |
  |-----------|-------|
  | Complete the level | ⭐ +1 (always) |
  | Complete with 0 deaths | ⭐ +1 |
  | Complete with ≤ 20 movements | ⭐ +1 |
- Stars displayed in header, updated on level load and victory
- Tooltip on hover shows conditions and current status (★ earned, ☆ pending)
- **Record badge** ("🏆 Novo Recorde!") shown in modal when beating personal best in a level
- Stars persisted in localStorage under `agentica_stars`

## Important Notes

### CORS Issue
Always serve files via HTTP server, never open `index.html` directly:
```bash
cd C:\block-engine-mvp
node server.js
# Open http://localhost:8080
```

### Bug Fixes Applied (Session 06/05/2026)
1. **Door bug**: `unlockDoor()` now sets `this.doorUnlocked = true`
2. **Ranking save**: Now saves automatically on every level completion
3. **Move count**: Only counts movement blocks (not attack/repeat)

### Features Implemented (Session 07/05/2026)

#### 1. Block Nesting System - Repeat Blocks
- **Repeat blocks** now support nesting of child blocks (similar to Scratch)
- Created a three-part structure for repeat blocks in workspace:
  - `.repeat-head`: Header with icon, label, and input for iteration count
  - `.repeat-body`: Container for vertical bar and children slot
  - `.block-children`: Slot where child blocks are dropped
- **Visual C-bracket design**: Clean "C" shape that embraces child blocks
  - Left vertical bar connects from head down to bottom
  - Bottom left corner rounded bar completes the frame
  - Removed middle pin/connector for cleaner look

#### 2. Drag & Drop Enhancements
- **Drop into repeat**: Drag blocks from palette directly into repeat block's `.block-children` container
- **Drag from workspace**: Move existing blocks into repeat blocks
- **Drag-over feedback**: Visual highlight when dragging over repeat children area
- **Remove from parent**: Drag blocks out of repeat blocks back to workspace
- **Delete nested blocks**: Drag nested blocks to trash zone to delete

#### 3. Parser Updates
- Recursive parsing of nested blocks using `parseBlocks(container)`
- Each repeat block now contains a `children` array with nested commands
- Support for multiple children inside repeat (not just one)

#### 4. Workspace Improvements
- **Left alignment**: Workspace blocks now align to the left (`align-items: flex-start`)
- **Block counting**: Both top-level and nested blocks count toward total
- **Storage**: Hierarchical block data saved/loaded with nested children

#### 5. Palette Simplification
- Repeat block in palette is now a single line (icon + label)
- No input field in palette version - input only appears when placed in workspace

#### 6. Kill Switch System (Emergency Stop)
- **Runner state**: Added `dead` property to immediately halt execution
- **kill() method**: New method that:
  - Sets `dead = true` to stop all commands
  - Aborts any running async operations via AbortController
  - Calls `stage.freezePlayer()` to stop animations
- **handleDefeat**: Now calls `runner.kill()` on death (hole fall or enemy collision)
- **Player freezing**: Stage has `freezePlayer()` that:
  - Removes all transitions/animations
  - Adds `.frozen` CSS class (grayscale + reduced opacity)
  - Disables pointer events
- **resetPlayer**: Now calls `unfreezePlayer()` before repositioning

#### 7. CSS Refinements
- `.block-repeat`: Flex column layout, transparent background
- `.repeat-head`: Orange background, border, rounded top corners
- `.repeat-body::before`: Vertical left bar (4px width, orange)
- `.repeat-body::after`: Bottom left corner bar (rounded)
- `.block-children`: Container with left padding for children indentation
- `.block-children:empty`: Shows "solte blocos aqui" placeholder
- `.actor.frozen`: Grayscale + reduced opacity for dead player
- Media query overrides for mobile to maintain repeat block structure

### Level Generation (levelGenerator.js)
Levels are procedurally generated with **per-session seeded RNG** (seed = levelNumber × 1337 + random sessionSeed):
- Each click of **Play** generates a new `sessionSeed` and clears the level cache — every new game has unique maps
- Within a session, levels are deterministic (re-entering a level gives the same map)
- **Difficulty**: `Math.min((levelNumber - 1) / 30, 1.5)` — scales continuously through all 50 levels
- **Walls**: `2 + floor(difficulty × 8)` clusters, each 1-3 cells (range: 2-14 clusters)
- **Holes**: `floor(1 + difficulty × 4)` cells (range: 1-7)
- **Coins**: `2 + random(0-2) + floor(difficulty × 4)` cells (range: 2-10)
- **Enemies** (non-boss levels): `min(5, floor(difficulty × 5))` — placed 3+ cells from player
- **Boss** (every 5th level): 2×3 multi-cell, HP = `2 + floor((levelNumber-1)/5)`, no regular enemies
- **Connectivity**: BFS verifies player→key→door always reachable (holes excluded)
- **Fallback**: Simple corridor-level if 100 generation attempts fail

### Features Implemented (Session 08/05/2026)

#### 1. Ranking System Overhaul
- **Ranking removed from game view**: Dedicated ranking page accessible via "RANKINGS" button in main menu
- **Per-level ranking**: Level selector (`« ‹ Fase N › »`) filters rankings by specific level
- **Global aggregated ranking**: Toggle button `[🌍 Global]` shows summed scores/deaths/movements per player across all levels
- **Mock data expanded**: Kenji now has entries for levels 1-5, Mori for levels 1-3
- **Always visible mock**: `loadRanking()` always merges `[...MOCK_RANKINGS, ...userEntries]`; save filters out mock entries
- **% comparison**: Per-level ranking shows player's percentage against Kenji benchmark (score: "85% do recorde", movements: "92% de eficiência")
- **Bug fix**: Added `Array.isArray()` validation in `loadRanking()` and `addRankingEntry()` to prevent "userEntries is not iterable" error when localStorage has corrupt/invalid data

#### 2. 3-Star System
- **Stars per level**: 1 for completion, 1 for 0 deaths, 1 for ≤20 movements
- **Header display**: Stars shown as ★ (earned, golden glow) / ☆ (pending) next to level badge
- **Hover tooltip**: Shows each star condition with visual feedback of earned status
- **Victory animation**: Stars animate sequentially in modal with sound effects
- **Record badge**: "🏆 Novo Recorde!" appears when beating personal best star score

#### 3. UI Refinements
- Removed duplicate star icon from header stats (redundant with new star display)
- Star tooltip with fadeIn animation, arrow indicator, and conditional styling
- `.ranking-mode-selector`, `.rank-mode-btn` with `.active` state for Global toggle
- `.level-selector.disabled` state when Global mode is active
- `.ranking-comparison` text for per-level benchmark display

## Known Limitations

## Command Reference
When working with this project:
- Use `@js/app.js` to see main orchestrator
- Use `@js/components/Stage.js` for game mechanics
- Use `@CONTEXT.md` for session history
- Use `/share` to save conversation to opencode.ai
