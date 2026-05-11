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
    ├── actors/
    │   └── player.js       # RPG attributes (HP, ATK, DEF, potions)
    ├── ui/
    │   ├── modals.js        # Promise-based async modal manager
    │   └── dashboard.js     # HUD with HP bar, stats, potion button
    ├── engine/
    │   ├── parser.js       # Converts DOM tree → command array
    │   ├── runner.js       # Async command executor (async/await)
    │   ├── storage.js      # localStorage wrapper (progress, workspace, rankings, stars, attributes)
    │   └── levelGenerator.js # Procedural level generation (50 levels)
    └── components/
        ├── dragDrop.js     # HTML5 Drag & Drop manager
        ├── workspace.js    # Workspace block stack manager
        ├── Stage.js        # Grid, actor, collisions, chests, game mechanics
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
- `addRankingEntry()` / `getRankingsByScore/Blocks/Movements()` - rankings (Deaths replaced by Blocks)
- `getRankingsByScoreForLevel(level)` / `getRankingsByBlocksForLevel(level)` - per-level ranking filtering
- `getAggregatedRankingsByScore/Blocks/Movements()` - global aggregated rankings (summed per player)
- `saveStars(level, data)` / `loadStars()` / `getLevelStars(level)` - star progression
- `calculateLevelBenchmark(levelData)` - BFS-based optimal moves and max score for comparison
- `playerStats` in `saveProgress()`/`loadProgress()` - RPG attributes persistence
- `agentica_chest_tip_shown` - flag for one-time chest tooltip
- `validateStarEntry(value)` - validates star data structure (earned 1-3, deaths 0-9999, movements 0-9999)
- `savePlayerStarRecord(name, level, data)` - per-user star ranking (only if earned > previous record)
- `loadPlayerStarRecord(name, level)` - per-user star record lookup
- `loadStarRankingTable()` - full star ranking table with validation
- `getStarRankingForLevel(level)` - all players sorted by stars for a level
- `secureSave()` / `secureLoad()` - signed blobs with in-memory mirror anti-tampering
- `startIntegrityCheck()` - periodic 1.5s interval verifying localStorage integrity vs mirror

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
| wait | Esperar | control | orange |

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
- `chest` - Random loot (sword/armor/potion)

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

### Features Implemented (Session 09/05/2026)

#### 1. RPG Stats System
- **File**: `js/actors/player.js`
- `PlayerStats` class: `hp`, `maxHp`, `attack`, `defense`, `potions` properties
- `takeDamage(amount)`: Defense absorbs first, excess reduces HP
- `usePotion()`: Consumes 1 potion, heals 1 HP (capped at maxHp)
- `reset()`: Restores default values (HP=5, ATK=1, DEF=1, potions=0)
- Serialized via `toJSON()`, persisted in localStorage

#### 2. Chest System
- **Files**: `js/components/Stage.js`, `styles/stage.css`
- Chest spawns every 3 levels (excluding boss levels), placed on random `path` cell
- 3 items with 33% chance each: sword (+1 ATK), armor (+1 DEF), potion (+1 inventory)
- Collection triggers modal via Promise that pauses runner execution
- Visual: gold pulsating icon (`inventory_2` Material Symbol) with `chestFloat` animation

#### 3. Damage Mechanics
- Enemy collision: 1 raw damage → defense absorbs, excess to HP
- Boss collision: 3 raw damage → defense absorbs, excess to HP
- Hole: Instant death (unchanged)
- HP persists between levels, all stats reset on death/new game

#### 4. UI Components
- **Dashboard** (`js/ui/dashboard.js`): HUD with color-coded HP bar, ATK/DEF display, potion button, `damageFlash()` animation
- **ModalManager** (`js/ui/modals.js`): Promise-based modal system that pauses/resumes runner via `await`
- Potion button disabled while runner is executing

#### 5. Visual Feedback
- `healGlow` animation on actor when potion is used
- `damageFlash` red flash on HUD when damaged
- `chestFloat` pulsating animation on chest cells
- One-time chest tooltip toast (`agentica_chest_tip_shown` flag)
- Stage legend updated with 🧰 Chest icon

#### 6. Blocks Ranking Category (replaces Deaths)
- **Files**: `js/app.js`, `js/engine/storage.js`, `index.html`
- Deaths tab removed from rankings UI; replaced by "Blocos" (block count in workspace at victory)
- Lower block count = better rank, incentivizing efficient block-based solutions
- `getRankingsByBlocks()` — global sort ascending by `blocks`
- `getRankingsByBlocksForLevel(level)` — per-level filter + sort
- `getAggregatedRankingsByBlocks()` — grouped by player, summed blocks
- Block count captured via `workspaceManager.getBlockCount()` at top of `handleVictory()` (before `workspaceManager.clear()`)
- Mock data updated: Kenji 3-6 blocks, Mori 6-10 blocks
- Backward compatibility: `?? 999` fallback for old entries without blocks field
#### 1. Persistência automática e auto-restore
- **`autoRestoreIfNeeded()`** (`app.js`): Chamada no `init()`. Ao carregar a página, se existir progresso salvo no localStorage, navega automaticamente para a tela de jogo, restaura a fase correta, o workspace, música e UI. Não exibe o menu se o jogador já tinha uma sessão ativa.
- **`beforeunload`** (`app.js`): Novo handler que salva `saveProgress()` + `workspaceManager.saveToStorage()` ao fechar/atualizar a página, garantindo que nenhum dado seja perdido.

#### 2. Validação completa do sistema de estrelas (`agentica_stars`)
- **`validateStarEntry()`** (`storage.js`): Helper que valida `earned` (1-3), `deaths` (0-9999) e `movements` (0-9999). Retorna `null` se inválido.
- **`loadStars()` reescrito**: Valida cada entrada individualmente por nível, descarta níveis fora de 1-50, rejeita arrays e objetos malformados. Envolvido em try/catch.
- **`saveStars()` reescrito**: Valida entrada completa antes de salvar. `isRecord` só é `true` se `earned > prev.earned`. Try/catch geral com fallback seguro.
- **`getLevelStars()`**: Usa `validateStarEntry()` — retorna `null` sempre que o dado estiver ausente ou corrompido, sem quebrar a UI.

#### 3. Nova tabela de ranking de estrelas por usuário (`agentica_star_ranking`)
- **Estrutura**: `{ "PlayerName": { "1": { earned, deaths, movements, score }, ... } }` em `storage.js`
- **`savePlayerStarRecord(name, level, data)`**: Só persiste se `earned > recorde anterior` do mesmo jogador na mesma fase. Valida nome (fallback `'Jogador Anônimo'`), nível (1-50), estrelas (1-3).
- **`loadPlayerStarRecord(name, level)`**: Consulta segura com validação de cada campo.
- **`loadStarRankingTable()`**: Recupera e valida a tabela completa. Ignora jogadores ou níveis com estrutura inválida.
- **`getStarRankingForLevel(level)`**: Retorna todos os jogadores ordenados por estrelas (desc) e movimentos (asc).
- **Integração**: `handleVictory()` em `app.js` chama `Storage.savePlayerStarRecord()` após o `saveStars` existente.

#### 4. Nome padrão 'Jogador Anônimo'
- **`app.js loadProgress()`**: Fallback para `'Jogador Anônimo'` se o nome salvo estiver vazio ou for `null`. O menu pré-preenche com esse nome automaticamente.

#### 5. Anti-tampering do localStorage
- **`_saveMirror`** (`storage.js`): Espelho em memória (`Map`) do último blob válido salvo para cada chave `agentica_*`.
- **`secureSave()`**: Armazena o blob no localStorage e no mirror.
- **`secureLoad()` reescrita**: Em cada leitura verifica integridade — se a chave foi deletada ou corrompida (assinatura inválida, JSON inválido, versão errada), restaura do mirror e loga `console.error`.
- **`startIntegrityCheck()`**: `setInterval` a cada 1.5s varre todas as chaves do mirror e compara com o localStorage. Qualquer diferença é revertida automaticamente.
- **`clearContinueState()` e `clearAll()`**: Sincronizados com o mirror — limpam o espelho ao remover chaves intencionalmente.
- **Mensagem no console**: `[Block Engine] ⛔ Modificação manual detectada no localStorage! A chave "X" foi alterada indevidamente...`

#### 6. Try/catch em toda E/S do localStorage
- `secureSave()`, `clearContinueState()`, `clearAll()` — todas as operações de `setItem`, `removeItem`, `JSON.stringify`, `btoa` são protegidas com try/catch silencioso, sem travar a aplicação.

### Features Implemented (Session 10/05/2026)

#### 1. Estrelas por jogador (per-player star display)
- **`updateStarsUI()`** (`app.js`): Agora usa `Storage.loadPlayerStarRecord(this.playerName, level)` em vez de `Storage.getLevelStars()` (global). Cada jogador vê apenas SUAS estrelas.
- **`updateStarTooltip()`** (`app.js`): Mesma mudança — tooltip de estrelas por jogador.
- **`autoRestoreIfNeeded()`** (`app.js`): Popula `#playerName.value` com o nome salvo para que as estrelas carreguem corretamente no auto-restore.
- **`resumeFromContinue()`** (`app.js`): Lê nome do input do menu (`#menuPlayerName`) e define `#playerName.value` corretamente.

#### 2. Stats por nível no ranking (per-level ranking stats)
- **`_levelStartStats`** (`app.js`): Novo campo no constructor que captura um snapshot dos stats cumulativos (`score`, `deaths`, `movements`) no início de cada fase via `loadLevel()`.
- **`handleVictory()`** (`app.js`): Ranking entries agora usam delta por nível (`this.stats - _levelStartStats`) em vez de stats cumulativos. Isso permite que `validateRankingEntry()` aceite entradas de todas as fases (antes rejeitava após a fase 1 por comparar score cumulativo contra benchmark de fase única).
- **Estrelas**: Cálculo de estrelas (`levelDeaths`, `levelMovements`) também usa stats por nível, não cumulativos.

#### 3. Backup criptografado para todas as chaves do localStorage
- **`b64Encode()` / `b64Decode()`** (`storage.js`): Usam `TextEncoder`/`TextDecoder` para codificação base64 segura para UTF-8 (substitui `btoa`/`atob` que falham em caracteres não-Latin1).
- **`backupSave(key, data)`** (`storage.js`): Salva blob assinado em `key + '_backup'` via `secureSave` — **nunca** JSON puro.
- **`backupLoad(key)`** (`storage.js`): Parseia manualmente o blob assinado (`b64Decode` → `JSON.parse` → extrai `inner.d`), **sem** usar `secureLoad`, evitando verificações de versão/assinatura que poderiam rejeitar backups válidos. Inclui fallback para JSON puro legado (`_backup_plain`).
- **`backupDelete(key)`** (`storage.js`): Remove `_backup` e `_backup_plain` (legado) do localStorage e mirror.

Todas as 6 chaves `agentica_*` têm backup criptografado:

| Chave principal | backupSave em | load* com fallback backupLoad |
|---|---|---|
| `agentica_progress` | `saveProgress()` | `loadProgress()` |
| `agentica_workspace` | `saveWorkspace()` | `loadWorkspace()` |
| `agentica_ranking` | `saveRanking()` / `addRankingEntry()` | `loadRanking()` / `addRankingEntry()` |
| `agentica_stars` | `saveStars()` | `loadStars()` |
| `agentica_continue` | `saveContinueState()` | `loadContinueState()` |
| `agentica_star_ranking` | `savePlayerStarRecord()` | `loadStarRankingTable()` |

- **`clearContinueState()`** e **`clearAll()`**: Chamam `backupDelete()` para cada chave.

## Storage Security Architecture

### Blob Format (signed + encoded)
Every `agentica_*` key stores data in a structured blob:

```
base64({ s: "<signature>", p: "<payload>" })
```

Where:
- `payload` = `JSON.stringify({ v: <version>, d: <data> })`
- `signature` = `hash(salt + payload)` — simple hash-based integrity check (not cryptographic)
- `version` = schema version for forward compatibility (currently 1)
- `data` = the actual application data

### Functions

#### Secure Layer (`secureSave` / `secureLoad` / `saveEncrypted` / `loadEncrypted`)
- `secureSave(key, data)`: Encodes → signs → base64 → writes to `localStorage` + in-memory `_saveMirror`
- `secureLoad(key)`: Reads blob → decodes → verifies signature → checks version → returns `data`
  - If signature/version mismatch AND mirror exists → restores from mirror, logs tamper warning
  - If signature/version mismatch AND no mirror → returns `null` (does NOT delete data)
  - Mirror is empty after page refresh (in-memory only)
- `Storage.saveEncrypted(key, data)`: Public wrapper for `secureSave` — use from `app.js` for any key that is NOT one of the 6 managed keys (e.g. `agentica_theme`, `agentica_chest_tip_shown`)
- `Storage.loadEncrypted(key)`: Public wrapper for `secureLoad`

#### Backup Layer (`backupSave` / `backupLoad`)
- `backupSave(key, data)`: Calls `secureSave(key + '_backup', data)` — identical signed blob format
- `backupLoad(key)`: Manual parsing bypassing `secureLoad` entirely:
  1. Tries `key + '_backup'` (signed blob) — decodes `b64Decode` → `JSON.parse` → extracts `inner.d`
  2. Falls back to `key + '_backup_plain'` (legacy plain JSON, deprecated — only exists from earlier versions) — removes the plain key after migration
  3. On success, calls `secureSave(key, restoredData)` + `secureSave(key + '_backup', restoredData)` to restore both main and backup keys
- `backupDelete(key)`: Removes `key + '_backup'` and `key + '_backup_plain'` from localStorage + mirror

#### Integrity Monitor (`startIntegrityCheck`)
- Periodic check (every 1.5s) comparing `_saveMirror` vs `localStorage`
- **Currently disabled** (returns immediately) — was causing false positives when backup restoration modified keys between ticks

#### One-Time Migration (`migrateLegacyPlainBackups`)
- Runs at module load (`storage.js` line 206-224)
- Scans `localStorage` for any keys ending with `_backup_plain`
- Re-saves each as a signed blob via `secureSave(baseKey + '_backup', parsed)`, then removes the plain key
- Ensures no legacy unencrypted data survives page refresh

### Recovery Flow
When any `load*` function is called (e.g., `loadProgress`, `loadStars`, `loadWorkspace`):

```
loadX() → secureLoad(key) → null (no data or mirror after refresh)
       → backupLoad(key)
         → 1. Try signed blob (key + '_backup')  ← manual parse, no version/sig check
         → 2. Fallback: plain JSON (key + '_backup_plain')  ← legacy
       → If success: secureSave restores main key + backup key
       → Return data
```

This ensures data survives manual deletion of main keys in DevTools.

### Key Characteristics
- **No plain JSON is written** — `backupSave` only creates signed blobs
- **Plain JSON on page load is migrated** — `migrateLegacyPlainBackups()` re-saves any leftover `_backup_plain` keys as signed blobs, then deletes them
- **Plain JSON reading kept for backward compat** — old `_backup_plain` keys found mid-session are recovered and re-saved as signed blobs
- **No false tamper warnings** — `secureLoad` returns `null` (instead of calling `restoreFromMirror`) when mirror is empty after refresh
- **All E/S wrapped in try/catch** — no operation throws, even if localStorage is full, corrupted, or unavailable
- **Backup keys are NOT in-memory mirrored** — only restored when a `load*` function is called

## Known Limitations

### RPG System
- PlayerStats only encodes base attributes (no equipment slots yet)
- Chest items are purely additive (no diminishing returns on attack/defense)
- No visual indicator on the grid of which item was inside a chest (only modal text)
- Attack attribute is cosmetic for now (not used in damage calculation — enemy collision always deals 1 damage)
- Potion count is capped only by inventory (no maximum carry limit enforced besides what's collected)

## Anti-Cheat Architecture

### Module-Level Closures (Primary Defense)
Sensitive session state is stored in **module-level variables** defined *outside* the `App` class (`app.js` lines 119-125):
```javascript
let _victoryToken = null;
let _commandHash = null;
let _statsSnapshot = null;
```
Since these are in **module scope** (not `this.*` properties), they are **inaccessible from the browser console** — `app._victoryToken` returns `undefined`.

### Three-Layer Verification (handleVictory)

| Layer | What it blocks | Mechanism |
|-------|---------------|-----------|
| **Victory Token** | `app.handleVictory()` called from console | Random token set in `runCode()`, checked and consumed in `handleVictory()`. Token includes `level` to prevent cross-level exploits |
| **Command Hash** | Modifying workspace blocks during execution | `_simpleHash(JSON.stringify(commands))` captured at parse time in `runCode()`, re-computed and compared in `handleVictory()`. Any DOM block change causes mismatch |
| **Stats Snapshot** | Inflating score/deaths before/during run | Stats `{score, deaths, movements}` copied at `runCode()` start. `handleVictory()` verifies deltas: deaths/movements can't decrease, score can't exceed level's theoretical max (coins×100 + keys×200 + boss×1000 + completion×500 + enemies×150 + 200 buffer) |

### Single-Use Token
- After `handleVictory()` passes all checks, all three variables are set to `null`
- Calling `handleVictory()` twice → token missing → blocked
- Token cleared in: `handleDefeat()`, `handleLevelFailed()`, `loadLevel()`, `btnClear`, and at the start of every `runCode()` call

### Attempted Console Exploits — Blocked

| Console command | Why it fails |
|----------------|-------------|
| `app.handleVictory()` | `_victoryToken` is `null` → `_rejectCheat()` → 🚫 |
| `app.stats.score = 999999` then play | `_statsSnapshot` at `runCode()` captures inflated value → `handleVictory()` computes `earnedDuringRun.score` > `maxLegitScore` → 🚫 |
| `app.playerStats.hp = 999` then play | Not directly checked by victory (HP is not part of ranking/stars), but `handleDefeat()` resets all stats anyway |
| `Storage.saveStars(...)` | Uses `secureSave` with SHA-256 signature. Stars are cosmetic only |
| `Storage.addRankingEntry(...)` | Uses `validateRankingEntry()` which rejects entries exceeding BFS benchmark `maxScore + 200` |
| Clear workspace, call `handleVictory()` | `_commandHash` mismatch (no blocks found) vs stored hash → 🚫 |
| Inject block DOM from console | DOM injection triggers `dragDrop.js` events, doesn't change `_commandHash` set by `runCode()` |

### Secondary Defenses (localStorage)
- `secureSave` signs every blob with SHA-256 signature — manual DevTools edits are detected and data is treated as missing (not loaded)
- `validateRankingEntry` checks per-level score against BFS benchmark (`maxScore + 200` buffer) — even with correct token, an impossible score entry is rejected
- All `Storage.*` reads use `try/catch` — no missing/corrupted key crashes the game

## Command Reference
When working with this project:
- Use `@js/app.js` to see main orchestrator
- Use `@js/components/Stage.js` for game mechanics
- Use `@CONTEXT.md` for session history
- Use `/share` to save conversation to opencode.ai
