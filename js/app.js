import { Storage } from './engine/storage.js';
import { Parser } from './engine/parser.js';
import { Runner } from './engine/runner.js';
import { DragDropManager } from './components/dragDrop.js';
import { WorkspaceManager } from './components/workspace.js';
import { PaletteManager } from './components/palette.js';
import { Stage } from './components/Stage.js';
import { generateLevel } from './engine/levelGenerator.js';
import { PlayerStats } from './actors/player.js';
import { ModalManager } from './ui/modals.js';
import { Dashboard } from './ui/dashboard.js';
import { pickRuleForLevel, getRuleDef, RULE_DEFS } from './engine/rules.js';

const MAX_LEVELS = 50;
const BG_TRACKS = [
    'sounds/beat.mp3',
    'sounds/percussão.mp3',
    'sounds/som_aventura.mp3',
    'sounds/som_perigo.mp3',
    'sounds/water_adbenture.mp3'
];

const IMAGE_FILES = [
    'arvore.png',
    'background.jpg',
    'cachoeira.jpg',
    'floresta.jpg',
    'mercadinho.png'
];
const levelCache = new Map();
let sessionSeed = Date.now();

function getLevel(index) {
    if (index < 0 || index >= MAX_LEVELS) return null;
    if (!levelCache.has(index)) {
        levelCache.set(index, generateLevel(index + 1, sessionSeed));
    }
    return levelCache.get(index);
}

function clearLevelCache() {
    levelCache.clear();
    sessionSeed = Date.now();
}

// ─── Anti-cheat: module-level closures (inaccessible from console) ───
let _victoryToken = null;
let _commandHash = null;
let _statsSnapshot = null;

function _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

const SoundManager = {
    context: null,

    init() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
    },

    playTone(frequency, duration, type = 'square', volume = 0.1) {
        if (!this.context) this.init();
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.context.destination);
        osc.start();
        osc.stop(this.context.currentTime + duration);
    },

    playSnap() {
        this.playTone(800, 0.1, 'square', 0.08);
    },

    playMove() {
        this.playTone(400, 0.15, 'sine', 0.06);
    },

    playCollect() {
        this.playTone(600, 0.1, 'square', 0.08);
        setTimeout(() => this.playTone(900, 0.15, 'square', 0.08), 100);
    },

    playError() {
        this.playTone(200, 0.3, 'sawtooth', 0.1);
    },

    playVictory() {
        [523, 659, 784, 1047].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.2, 'square', 0.08), i * 150);
        });
    },

    playDelete() {
        this.playTone(300, 0.15, 'triangle', 0.06);
    },

    playAttack() {
        this.playTone(150, 0.2, 'sawtooth', 0.1);
        setTimeout(() => this.playTone(100, 0.15, 'sawtooth', 0.08), 100);
    },

    playPunch() {
        this.playTone(70, 0.2, 'sawtooth', 0.15);
        setTimeout(() => this.playTone(50, 0.15, 'sawtooth', 0.12), 60);
    }
};

class App {
    constructor() {
        this.currentLevel = 0;
        this.stats = { coins: 0, keys: 0, deaths: 0, score: 0, movements: 0 };
        this._levelStartStats = null;
        this.playerId = '';
        this.playerName = '';
        this.bgMuted = false;
        this.rankMode = 'level';
        this.rankLevel = 1;
        this.playerStats = new PlayerStats();
        this.modalManager = new ModalManager(this);
        this.dashboard = new Dashboard();
        this.currentRule = null;
        this._gcBaseHp = null;
        this._gcBaseMaxHp = null;
        this._pacifistViolation = false;
        this.init();
    }

    validateStat(value, min, max, def = 0) {
        if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return def;
        return Math.max(min, Math.min(max, Math.floor(Math.abs(value))));
    }

    init() {
        SoundManager.init();

        this.workspaceManager = new WorkspaceManager(
            document.getElementById('workspace'),
            document.getElementById('workspaceInfo')
        );

        this.paletteManager = new PaletteManager(
            document.getElementById('palette')
        );

        this.stage = new Stage(
            document.getElementById('grid'),
            document.getElementById('actor')
        );

        this.parser = new Parser();
        this.runner = new Runner(this.stage, SoundManager);

        this.dragDropManager = new DragDropManager({
            palette: document.getElementById('palette'),
            workspace: document.getElementById('workspace'),
            trashZone: document.getElementById('trashZone'),
            workspaceManager: this.workspaceManager,
            soundManager: SoundManager
        });

        this.setupStageCallbacks();
        this.setupRunnerCallbacks();
        this.setupEventListeners();
        this.setupBgMusic();
        this.loadProgress();
        this.runner.playerStats = this.playerStats;
        this.dashboard.update(this.playerStats);
        this.setupMenuListeners();
        this.setupRankingsViewListeners();
        this.setupStarTooltip();
        this.setupThemeToggle();
        this.setupHelpAccordion();

        // Pre-fill menu name if saved
        if (this.playerName) {
            document.getElementById('menuPlayerName').value = this.playerName;
            document.getElementById('menuPlayBtn').disabled = false;
        }

        // Auto-restore game if there's saved progress
        this.autoRestoreIfNeeded();
    }

    setupStageCallbacks() {
        this.stage.setCallbacks({
            onCoinCollect: (count) => {
                this.stats.coins = this.validateStat(count, 0, 100);
                this.stats.score = Math.min(999999, this.stats.score + 100);
                SoundManager.playCollect();
                this.updateUI();
            },
            onKeyCollect: () => {
                this.stats.keys = Math.min(10, this.stats.keys + 1);
                this.stats.score = Math.min(999999, this.stats.score + 200);
                SoundManager.playCollect();
                this.updateUI();
            },
            onDoorUnlock: () => {
                SoundManager.playTone(523, 0.2, 'square', 0.1);
                setTimeout(() => SoundManager.playTone(659, 0.3, 'square', 0.1), 200);
            },
            onHoleFall: () => {
                this.handleDefeat('Você caiu em um buraco!');
            },
            onEnemyCollision: async () => {
                await this.handleEnemyDamage(1, 'enemy');
            },
            onBossCollision: async (damage) => {
                await this.handleEnemyDamage(damage || 3, 'boss');
            },
            onChestCollect: async (item) => {
                SoundManager.playCollect();
                const msg = item === 'sword'
                    ? ['⚔️ Espada encontrada!', 'Ataque +1']
                    : item === 'shield'
                        ? ['🛡️ Escudo encontrado!', 'Carga de escudo +1']
                        : ['🧪 Poção encontrada!', 'Adicionada ao inventário'];
                if (item === 'sword') this.playerStats.attack++;
                if (item === 'shield') this.playerStats.shield++;
                if (item === 'potion') this.playerStats.inventory.potions++;
                this.dashboard.update(this.playerStats);
                this.saveProgress();
                await this.modalManager.show(msg[0], msg[1]);
            },
            onAttack: () => {
                SoundManager.playAttack();
            },
            onBossDefeat: () => {
                this.stats.score = Math.min(999999, this.stats.score + 1000);
                SoundManager.playVictory();
                this.updateUI();
            },
            onPlayerTakeDamage: async (amount, source) => {
                if (source === 'troll' || source === 'boss') {
                    SoundManager.playPunch();
                } else if (source === 'spike') {
                    SoundManager.playError();
                }
                await this.handleEnemyDamage(amount, source);
            },
            onEnemyDefeated: (type) => {
                if (this.currentRule === 'pacifist') {
                    this._pacifistViolation = true;
                    this.handleDefeat('Você violou o Pacifista de Ferro! Um inimigo foi derrotado.');
                    return;
                }
                if (this.currentRule === 'vampire') {
                    this.playerStats.hp = this.playerStats.maxHp;
                    this.dashboard.update(this.playerStats);
                }
                const points = { bat: 50, skeleton: 100, troll: 150 };
                this.stats.score += points[type] || 50;
                this.updateUI();
            },
            onGetPlayerAttack: () => {
                let atk = this.playerStats.attack || 1;
                if (this.currentRule === 'glass_cannon') atk *= 2;
                return atk;
            }
        });
    }

    setupRunnerCallbacks() {
        this.runner.setCallbacks({
            onComplete: () => {
                this.setButtonsEnabled(false);
                if (this._pacifistViolation) {
                    return;
                }
                if (this.stage.didReachDoor && this.stage.didReachDoor()) {
                    const extraBlocks = Math.max(0, (this._currentCommandCount || 0) - ((this.runner.doorReachedIndex || 0) + 1));
                    this.stats.score = Math.max(0, this.stats.score - extraBlocks * 10);
                    this.handleVictory();
                } else {
                    this.handleLevelFailed();
                }
            },
            onError: (error) => {
                this.setButtonsEnabled(false);
            },
            onBlockExecute: (index) => {
                this.highlightBlock(index);
            }
        });
        this.runner.onUsePotion = () => {
            if (!this.playerStats.usePotion()) return;
            this.stage.healGlow();
            this.dashboard.update(this.playerStats);
            this.saveProgress();
        };
        this.runner.onUseShield = () => {
            if (this.playerStats.shield > 0 && this.stage.isPlayerUnderAttack()) {
                this.playerStats.shield--;
                this.stage.shieldBlockNextHit = true;
                this.dashboard.update(this.playerStats);
                this.saveProgress();
            }
        };
        this.runner.onVampireTick = () => {
            this.playerStats.takeDamage(1);
            this.dashboard.update(this.playerStats);
            this.dashboard.damageFlash();
            this.saveProgress();
            if (this.playerStats.hp <= 0) {
                this.handleDefeat('Você sucumbiu à Maldição do Vampiro!');
            }
        };
        this.runner.onPacifistAttack = () => {
            this._pacifistViolation = true;
            this.handleDefeat('Você violou o Pacifista de Ferro! O bloco Atacar não pode ser usado.');
        };
    }

    setupEventListeners() {
        // Mobile and desktop play buttons
        document.getElementById('btnPlay').addEventListener('click', () => this.runCode());
        document.getElementById('btnPlayMobile').addEventListener('click', () => this.runCode());
        document.getElementById('btnRunDesktop').addEventListener('click', () => this.runCode());
        
        // Clear button
        document.getElementById('btnClear').addEventListener('click', () => {
            if (this.runner.isRunning) {
                const btn = document.getElementById('btnClear');
                btn.classList.add('shake');
                setTimeout(() => btn.classList.remove('shake'), 500);
                return;
            }
            _victoryToken = null;
            _commandHash = null;
            _statsSnapshot = null;
            this.runner.stop();
            this.stage.stopAI();
            this.workspaceManager.clear();
            this.setButtonsEnabled(false);
        });
        
        // Reset buttons
        document.getElementById('btnResetLevel').addEventListener('click', () => this.loadLevel(this.currentLevel));
        document.getElementById('btnResetDesktop').addEventListener('click', () => this.loadLevel(this.currentLevel));
        
        // Level navigation
        document.getElementById('btnPrevLevel').addEventListener('click', () => {
            if (this.runner.isRunning) return;
            if (this.currentLevel > 0) {
                this.loadLevel(this.currentLevel - 1);
            }
        });
        document.getElementById('btnNextLevel').addEventListener('click', () => {
            if (this.runner.isRunning) return;
            if (this.currentLevel < MAX_LEVELS - 1) {
                this.loadLevel(this.currentLevel + 1);
            }
        });

        document.getElementById('modalBtnPrimary').addEventListener('click', () => this.handleModalPrimary());
        document.getElementById('modalBtnSecondary').addEventListener('click', () => this.handleModalSecondary());

        document.getElementById('btnBackToMenu').addEventListener('click', () => {
            if (this.runner.isRunning) return;
            this.pauseBgMusic();
            this.workspaceManager.saveToStorage();
            this.saveProgress();
            this.showView('menu');
        });

        // Pause/resume on tab visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stage.stopAI();
                this.pauseBgMusic();
                if (SoundManager.context) SoundManager.context.suspend();
            } else {
                if (SoundManager.context && SoundManager.context.state === 'suspended') {
                    SoundManager.context.resume();
                }
            }
        });

        // Save state on page close/refresh
        window.addEventListener('beforeunload', () => {
            this.saveProgress();
            this.workspaceManager.saveToStorage();
        });
    }

    showView(viewName) {
        const views = {
            menu: 'viewMenu',
            game: 'viewGame',
            rankings: 'viewRankings'
        };
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(views[viewName]);
        if (target) target.classList.add('active');
        if (viewName === 'menu') this.refreshMenu();
    }

    setupMenuListeners() {
        const nameInput = document.getElementById('menuPlayerName');
        const playBtn = document.getElementById('menuPlayBtn');
        const errorEl = document.getElementById('menuNameError');

        nameInput.addEventListener('input', () => {
            const hasName = nameInput.value.trim().length > 0;
            playBtn.disabled = !hasName;
            errorEl.classList.remove('show');
        });

        playBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (!name) {
                errorEl.classList.add('show');
                return;
            }
            this.playerName = (typeof name === 'string') ? name.trim().slice(0, 20) : '';
            this.playerId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
            Storage.savePlayerRecord(this.playerId, this.playerName);
            document.getElementById('playerName').value = this.playerName;
            this.stats = { coins: 0, keys: 0, deaths: 0, score: 0, movements: 0 };
            this.playerStats.reset();
            this.dashboard.update(this.playerStats);
            this.currentLevel = 0;
            clearLevelCache();
            this.bgMuted = false;
            document.getElementById('soundIcon').textContent = 'volume_up';
            this.workspaceManager.clear();
            this.showView('game');
            this.loadLevel(this.currentLevel);
            this.pickRandomTrack();
            this.pickRandomBg();
            this.playBgMusic();
            this.updateUI();
            this.displayRankings();
            this.saveProgress();
        });

        document.getElementById('menuRankingsBtn').addEventListener('click', () => {
            this.rankMode = 'level';
            this.rankLevel = 1;
            document.getElementById('rankGlobalBtn').classList.remove('active');
            document.getElementById('viewLevelSelector').classList.remove('disabled');
            document.getElementById('viewRankLevelDisplay').textContent = 'Fase 1';
            this.displayRankings('level', 1);
            this.showView('rankings');
        });

        document.getElementById('menuContinueBtn').addEventListener('click', () => {
            this.resumeFromContinue();
        });
    }

    setupRankingsViewListeners() {
        const container = document.querySelector('.rankings-view-card');
        const tabs = container.querySelectorAll('.ranking-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const panels = container.querySelectorAll('.ranking-panel');
                panels.forEach(p => p.classList.remove('active'));
                const panelId = 'viewRanking' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
                const panel = document.getElementById(panelId);
                if (panel) panel.classList.add('active');
            });
        });

        // Global button toggle
        document.getElementById('rankGlobalBtn').addEventListener('click', () => {
            if (this.rankMode === 'global') {
                this.rankMode = 'level';
                this.rankLevel = 1;
                document.getElementById('rankGlobalBtn').classList.remove('active');
                document.getElementById('viewLevelSelector').classList.remove('disabled');
                document.getElementById('viewRankLevelDisplay').textContent = 'Fase 1';
                this.displayRankings('level', 1);
            } else {
                this.rankMode = 'global';
                document.getElementById('rankGlobalBtn').classList.add('active');
                document.getElementById('viewLevelSelector').classList.add('disabled');
                this.displayRankings('global');
            }
        });

        // Level navigation
        document.getElementById('viewRankFirstBtn').addEventListener('click', () => this.changeRankViewLevel(-999));
        document.getElementById('viewRankPrevBtn').addEventListener('click', () => this.changeRankViewLevel(-1));
        document.getElementById('viewRankNextBtn').addEventListener('click', () => this.changeRankViewLevel(1));
        document.getElementById('viewRankLastBtn').addEventListener('click', () => this.changeRankViewLevel(999));

        document.getElementById('rankingsBackBtn').addEventListener('click', () => {
            this.showView('menu');
        });
    }

    changeRankViewLevel(delta) {
        let newLevel = this.rankLevel;
        if (delta === -999) newLevel = 1;
        else if (delta === 999) newLevel = MAX_LEVELS;
        else newLevel = Math.max(1, Math.min(MAX_LEVELS, this.rankLevel + delta));
        this.rankLevel = newLevel;
        document.getElementById('viewRankLevelDisplay').textContent = `Fase ${newLevel}`;
        this.displayRankings('level', newLevel);
    }

    refreshMenu() {
        const saved = Storage.loadProgress();
        const btn = document.getElementById('menuContinueBtn');
        btn.style.display = (saved && saved.playerName && saved.level !== undefined) ? '' : 'none';
    }

    resumeFromContinue() {
        const saved = Storage.loadProgress();
        if (!saved) return;

        const menuName = document.getElementById('menuPlayerName')?.value?.trim();
        this.playerName = menuName || saved.playerName || 'Jogador Anônimo';
        this.playerId = saved.playerId || '';
        document.getElementById('playerName').value = this.playerName;

        this.currentLevel = this.validateStat(saved.level, 0, 49);
        this.stats = {
            coins: this.validateStat(saved.coins, 0, 100),
            keys: this.validateStat(saved.keys, 0, 10),
            deaths: this.validateStat(saved.deaths, 0, 9999),
            score: this.validateStat(saved.score, 0, 999999),
            movements: this.validateStat(saved.movements, 0, 9999)
        };

        if (saved.playerStats) {
            this.playerStats = new PlayerStats(saved.playerStats);
            this.runner.playerStats = this.playerStats;
        }
        this.dashboard.update(this.playerStats);

        this.showView('game');
        this.loadLevel(this.currentLevel);
        this.workspaceManager.restoreFromStorage();
        this.playBgMusic();
        this.updateUI();
        this.displayRankings();
    }

    setupBgMusic() {
        this.bgTrackIndex = -1;
        this.bgMusic = new Audio();
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.4;
        this.bgMusic.onerror = () => {
            console.warn('[Block Engine] Audio falhou, pulando para próxima track');
            this.nextBgTrack();
        };

        document.getElementById('soundToggle').addEventListener('click', () => {
            this.toggleBgMusic();
        });
    }

    pickRandomTrack() {
        let idx;
        do {
            idx = Math.floor(Math.random() * BG_TRACKS.length);
        } while (idx === this.bgTrackIndex && BG_TRACKS.length > 1);
        this.bgTrackIndex = idx;
        this.bgMusic.src = BG_TRACKS[idx];
    }

    changeBgMusic() {
        const wasPlaying = !this.bgMusic.paused;
        this.pickRandomTrack();
        if (wasPlaying && !this.bgMuted) {
            this.bgMusic.play().catch(() => {});
        }
    }

    nextBgTrack() {
        this.bgMusic.onerror = null;
        this.pickRandomTrack();
        if (!this.bgMuted) {
            this.bgMusic.play().catch(() => { this.bgMusic.onerror = () => this.nextBgTrack(); });
        }
        this.bgMusic.onerror = () => this.nextBgTrack();
    }

    pickRandomBg() {
        const file = IMAGE_FILES[Math.floor(Math.random() * IMAGE_FILES.length)];
        document.querySelector('.stage').style.setProperty('--stage-bg', `url('/teste-block-engine-mvp/images/${file}')`);
    }

    playBgMusic() {
        if (this.bgMusic.src === '') {
            this.pickRandomTrack();
        }
        if (!this.bgMuted && this.bgMusic.paused) {
            this.bgMusic.play().catch(() => {});
        }
    }

    pauseBgMusic() {
        if (!this.bgMusic.paused) {
            this.bgMusic.pause();
        }
    }

    toggleBgMusic() {
        this.bgMuted = !this.bgMuted;
        const icon = document.getElementById('soundIcon');
        if (this.bgMuted) {
            this.bgMusic.pause();
            icon.textContent = 'volume_off';
        } else {
            if (this.bgMusic.src === '') this.pickRandomTrack();
            this.bgMusic.play().catch(() => {});
            icon.textContent = 'volume_up';
        }
    }

    loadProgress() {
        const saved = Storage.loadProgress();
        if (saved) {
            this.currentLevel = this.validateStat(saved.level, 0, 49);
            this.stats.coins = this.validateStat(saved.coins, 0, 100);
            this.stats.keys = this.validateStat(saved.keys, 0, 10);
            this.stats.deaths = this.validateStat(saved.deaths, 0, 9999);
            this.stats.score = this.validateStat(saved.score, 0, 999999);
            this.stats.movements = this.validateStat(saved.movements, 0, 9999);
            this.playerId = (typeof saved.playerId === 'string') ? saved.playerId : '';
            this.playerName = (typeof saved.playerName === 'string') ? saved.playerName.trim().slice(0, 20) || 'Jogador Anônimo' : 'Jogador Anônimo';
            this.playerStats = new PlayerStats(saved.playerStats);
            document.getElementById('playerName').value = this.playerName;
        }
    }

    saveProgress() {
        this.playerName = (typeof this.playerName === 'string') ? this.playerName.trim().slice(0, 20) : '';
        let stats = this.playerStats.toJSON();
        if (this.currentRule === 'glass_cannon' && this._gcBaseMaxHp !== null) {
            stats.maxHp = this._gcBaseMaxHp;
            stats.hp = Math.min(stats.hp, this._gcBaseMaxHp);
        }
        Storage.saveProgress({
            level: this.validateStat(this.currentLevel, 0, 49),
            coins: this.validateStat(this.stats.coins, 0, 100),
            keys: this.validateStat(this.stats.keys, 0, 10),
            deaths: this.validateStat(this.stats.deaths, 0, 9999),
            score: this.validateStat(this.stats.score, 0, 999999),
            movements: this.validateStat(this.stats.movements, 0, 9999),
            playerId: this.playerId,
            playerName: this.playerName,
            playerStats: stats
        });
    }

    loadLevel(index) {
        if (index < 0 || index >= MAX_LEVELS) return;
        _victoryToken = null;
        _commandHash = null;
        _statsSnapshot = null;
        this.runner.stop();
        this.stage.stopAI();
        this.currentLevel = this.validateStat(index, 0, 49);
        this.stats.coins = 0;
        this.stats.keys = 0;

        this._levelStartStats = {
            score: this.stats.score,
            deaths: this.stats.deaths,
            movements: this.stats.movements
        };

        this._pacifistViolation = false;

        if (this.currentRule === 'glass_cannon' && this._gcBaseMaxHp !== null) {
            this.playerStats.maxHp = this._gcBaseMaxHp;
            this.playerStats.hp = this._gcBaseHp;
        }
        this._gcBaseHp = null;
        this._gcBaseMaxHp = null;
        this.currentRule = null;

        const levelData = getLevel(index);
        const levelCopy = {
            name: levelData.name,
            map: levelData.map.map(row => [...row]),
            player: { ...levelData.player }
        };

        if (levelData.enemies) {
            levelCopy.enemies = levelData.enemies.map(e => ({ ...e }));
        }

        if (levelData.boss) {
            levelCopy.boss = { ...levelData.boss };
        }

        if (levelData.spikes) {
            levelCopy.spikes = levelData.spikes.map(s => ({ ...s }));
        }

        this.stage.shieldBlockNextHit = false;

        this.applyLevelRule(index);
        this.stage.currentRule = this.currentRule;
        this.runner.currentRule = this.currentRule;

        this.stage.loadLevel(levelCopy, this.currentLevel);
        this.stage.startAI();
        this.updateUI();
        this.updateStarsUI();
        this.dashboard.update(this.playerStats);
        this.showChestTip();
        this.saveProgress();
    }

    applyLevelRule(index) {
        this.currentRule = pickRuleForLevel(index, sessionSeed);

        const gridEl = document.getElementById('grid');
        if (this.currentRule === 'mirror') {
            gridEl.style.filter = 'invert(1) hue-rotate(180deg)';
        } else {
            gridEl.style.filter = '';
        }

        this.runner.currentRule = this.currentRule;

        if (this.currentRule === 'glass_cannon') {
            this._gcBaseMaxHp = this.playerStats.maxHp;
            this._gcBaseHp = this.playerStats.hp;
            this.playerStats.maxHp = 1;
            this.playerStats.hp = Math.min(this.playerStats.hp, 1);
        }
    }

    countMovements(commands) {
        let count = 0;
        for (const cmd of commands) {
            if (['moveUp', 'moveDown', 'moveLeft', 'moveRight'].includes(cmd.type)) {
                count++;
            } else if (cmd.type === 'repetir' && cmd.children?.length > 0) {
                count += (cmd.params.times ?? 2) * this.countMovements(cmd.children);
            } else if (cmd.type === 'se') {
                if (cmd.children?.length > 0) count += this.countMovements(cmd.children);
                if (cmd.elseChildren?.length > 0) count += this.countMovements(cmd.elseChildren);
            } else if (cmd.type === 'enquanto' && cmd.children?.length > 0) {
                count += this.countMovements(cmd.children);
            }
        }
        return count;
    }

    async runCode() {
        if (this.runner.isRunning) return;

        // Clear any stale anti-cheat tokens
        _victoryToken = null;
        _commandHash = null;
        _statsSnapshot = null;

        this.runner.stop();
        this.stage.startAI();
        this.stage.shieldBlockNextHit = false;

        SoundManager.init();

        if (this.currentRule === 'economic') {
            const blockCount = this.workspaceManager.getBlockCount();
            const maxBlocks = getRuleDef('economic').maxBlocks;
            if (blockCount > maxBlocks) {
                this.showMessage('Limite de blocos!', `Regra "Programação Econômica": máximo ${maxBlocks} blocos permitidos. Use ${maxBlocks} ou menos.`);
                this._modalAction = () => this.hideModal();
                this._modalSecondaryAction = null;
                return;
            }
        }

        if (!this.workspaceManager.validateSyntax()) {
            this.showMessage('Erro de sintaxe!', 'Corrija os blocos antes de executar: "Então" deve estar dentro de um bloco "Se".');
            this._modalAction = () => this.hideModal();
            this._modalSecondaryAction = null;
            return;
        }

        const commands = this.parser.parse(document.getElementById('workspace'));
        this._currentCommandCount = commands.length;
        this.currentRunMovements = this.countMovements(commands);

        if (commands.length === 0) {
            this.showMessage('Nenhum bloco!', 'Adicione blocos ao workspace antes de executar.');
            this._modalAction = () => this.hideModal();
            this._modalSecondaryAction = null;
            return;
        }

        // ─── Anti-cheat: seal the session ───
        _victoryToken = {
            level: this.currentLevel,
            cmdCount: commands.length,
            id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
        };
        _commandHash = _simpleHash(JSON.stringify(commands));
        _statsSnapshot = {
            score: this.stats.score,
            deaths: this.stats.deaths,
            movements: this.stats.movements,
            coins: this.stats.coins,
            keys: this.stats.keys
        };
        // ──────────────────────────────────────

        this.runner.currentRule = this.currentRule;
        this.setButtonsEnabled(true);
        await this.runner.run(commands);
    }

    highlightBlock(index) {
        const blocks = this.workspaceManager.getBlocks();
        blocks.forEach(b => b.classList.remove('executing'));
        if (blocks[index]) {
            blocks[index].classList.add('executing');
        }
    }

    _rejectCheat(msg) {
        _victoryToken = null;
        _commandHash = null;
        _statsSnapshot = null;
        this.runner.kill();
        this.stage.stopAI();
        this.setButtonsEnabled(false);
        SoundManager.playError();
        this.showMessage('🚫 Invasão Detectada!', `${msg} Todas as ações foram bloqueadas.`, 'OK');
        this._modalAction = () => this.hideModal();
        this._modalSecondaryAction = null;
    }

    handleVictory() {
        // ─── Anti-cheat: verify session integrity ───
        if (!_victoryToken || !_commandHash) {
            this._rejectCheat('Sessão inválida. Use o botão "Jogar" para executar os blocos.');
            return;
        }

        if (_victoryToken.level !== this.currentLevel) {
            this._rejectCheat('Nível incorreto detectado.');
            return;
        }

        try {
            const currentHash = _simpleHash(JSON.stringify(this.parser.parse(document.getElementById('workspace'))));
            if (currentHash !== _commandHash) {
                this._rejectCheat('Os blocos foram modificados durante a execução.');
                return;
            }
        } catch {
            this._rejectCheat('Erro ao verificar a integridade dos blocos.');
            return;
        }

        if (_statsSnapshot) {
            const earnedDuringRun = {
                score: this.stats.score - _statsSnapshot.score,
                deaths: this.stats.deaths - _statsSnapshot.deaths,
                movements: this.stats.movements - _statsSnapshot.movements,
            };
            if (earnedDuringRun.deaths < 0 || earnedDuringRun.movements < 0) {
                this._rejectCheat('Estatísticas inválidas detectadas (valores negativos).');
                return;
            }
            const levelData = getLevel(this.currentLevel);
            if (levelData) {
                const coinCount = levelData.map.flat().filter(c => c === 'coin').length;
                const keyCount = levelData.map.flat().filter(c => c === 'key').length;
                const enemyCount = levelData.enemies?.length || 0;
                const hasBoss = !!levelData.boss;
                const maxLegitScore = coinCount * 100 + keyCount * 200 + 500 +
                    (hasBoss ? 1000 : 0) + enemyCount * 150 + 200;
                if (earnedDuringRun.score > maxLegitScore) {
                    this._rejectCheat('Pontuação inválida detectada. O score excede o máximo possível para esta fase.');
                    return;
                }
            }
        }

        // Single-use token invalidation
        _victoryToken = null;
        _commandHash = null;
        _statsSnapshot = null;
        // ─────────────────────────────────────────────

        const blockCount = this.workspaceManager.getBlockCount();
        this.stage.stopAI();
        this.runner.stop();
        this.workspaceManager.clear();
        SoundManager.playVictory();
        this.stats.score = Math.min(999999, this.stats.score + 500);
        this.stats.movements = Math.min(9999, this.stats.movements + (this.validateStat(this.currentRunMovements, 0, 9999) || 0));
        this.setButtonsEnabled(false);
        this.changeBgMusic();
        this.pickRandomBg();

        const playerName = (typeof document.getElementById('playerName').value === 'string')
            ? document.getElementById('playerName').value.trim().slice(0, 20) || 'Anônimo'
            : 'Anônimo';

        const start = this._levelStartStats || { score: 0, deaths: 0, movements: 0 };
        const entry = {
            playerId: this.playerId,
            name: playerName,
            score: this.validateStat(this.stats.score - start.score, 0, 999999),
            level: this.validateStat(this.currentLevel + 1, 1, 50),
            deaths: this.validateStat(this.stats.deaths - start.deaths, 0, 9999),
            movements: this.validateStat(this.stats.movements - start.movements, 0, 9999),
            blocks: blockCount
        };

        const levelData = getLevel(this.currentLevel);
        if (Storage.validateRankingEntry(entry, levelData)) {
            Storage.addRankingEntry(entry);
        }

        // Calculate stars (per-level stats only)
        const levelDeaths = this.stats.deaths - (start.deaths || 0);
        const levelMovements = this.stats.movements - (start.movements || 0);
        const earnedStars = 1 + (levelDeaths === 0 ? 1 : 0) + (this.currentRunMovements <= 20 ? 1 : 0);
        const starResult = Storage.saveStars(this.playerId, this.currentLevel + 1, {
            earned: earnedStars,
            deaths: levelDeaths,
            movements: levelMovements
        });

        if (this.currentLevel < MAX_LEVELS - 1) {
            this.showMessage(
                '🎉 Fase Completa!',
                `Você completou "${getLevel(this.currentLevel).name}"! Pontuação: ${this.stats.score}`,
                'Próxima Fase'
            );
            this._modalAction = () => {
                this.hideModal();
                this.loadLevel(this.currentLevel + 1);
            };
            this._modalSecondaryAction = null;
        } else {
            this.showMessage(
                '🏆 Parabéns!',
                `Você completou todas as fases! Pontuação Final: ${this.stats.score}`,
                'Ver Ranking'
            );
            this._modalAction = () => {
                this.hideModal();
                this.displayRankings();
            };
            this._modalSecondaryAction = null;
        }

        // Restore original stats if leaving Glass Cannon
        if (this.currentRule === 'glass_cannon' && this._gcBaseMaxHp !== null) {
            this.playerStats.maxHp = this._gcBaseMaxHp;
            this.playerStats.hp = this._gcBaseHp;
            this.dashboard.update(this.playerStats);
        }

        // Animate stars in modal and show record badge
        document.getElementById('modalStars').classList.remove('hidden');
        setTimeout(() => this.animateModalStars(earnedStars, starResult?.isRecord), 300);

        this.saveProgress();
        this.displayRankings();
        this.updateStarsUI();
    }

    handleLevelFailed() {
        _victoryToken = null;
        _commandHash = null;
        _statsSnapshot = null;
        this.stage.stopAI();
        this.stage.resetDoorFlag();
        this.playerStats.takeDamage(1);
        this.dashboard.update(this.playerStats);
        this.dashboard.damageFlash();
        this.setButtonsEnabled(false);
        this.saveProgress();

        if (this.playerStats.hp <= 0) {
            this.handleDefeat('Você não conseguiu concluir a fase a tempo!');
            return;
        }

        this.showMessage(
            '❌ Fase não concluída!',
            'Você não chegou à porta. Reorganize seus blocos e tente novamente!',
            'OK'
        );
        this._modalAction = () => {
            this.hideModal();
            this.loadLevel(this.currentLevel);
        };
        this._modalSecondaryAction = null;
    }

    animateModalStars(earnedStars, isRecord) {
        for (let i = 0; i < 3; i++) {
            const starEl = document.getElementById(`modalStar${i + 1}`);
            if (starEl) {
                setTimeout(() => {
                    if (i < earnedStars) {
                        starEl.textContent = '★';
                        starEl.classList.add('star-earned', 'star-earn-anim');
                        SoundManager.playTone(800 + i * 200, 0.15, 'sine', 0.08);
                    } else {
                        starEl.textContent = '☆';
                        starEl.classList.remove('star-earned');
                    }
                }, i * 400);
            }
        }
        if (isRecord) {
            setTimeout(() => {
                const badge = document.getElementById('recordBadge');
                if (badge) {
                    badge.classList.remove('hidden');
                    setTimeout(() => badge.classList.add('hidden'), 4000);
                }
            }, 1200);
        }
    }

    async handleEnemyDamage(amount, source) {
        if (this._damageLock) return;
        this._damageLock = true;
        try {
            if (source !== 'spike' && this.stage.shieldBlockNextHit) {
                this.stage.shieldBlockNextHit = false;
                return;
            }

            const hpBefore = this.playerStats.hp;
            this.playerStats.takeDamage(amount);
            this.dashboard.update(this.playerStats);
            this.dashboard.damageFlash();
            this.saveProgress();
            if (this.playerStats.hp <= 0) {
                const msg = source === 'bat' ? 'Você foi derrotado por um Morcego!'
                    : source === 'skeleton' ? 'Você foi atingido por uma flecha!'
                    : source === 'troll' ? 'Você foi esmagado por uma pedra!'
                    : source === 'boss' ? 'Você foi derrotado pelo Boss!'
                    : source === 'spike' ? 'Você foi empalado por espinhos!'
                    : 'Você foi derrotado!';
                this.handleDefeat(msg);
            } else if (this.runner.isRunning) {
                const hpLoss = hpBefore - this.playerStats.hp;
                const sourceNames = {
                    bat: '🦇 Morcego!',
                    skeleton: '💀 Esqueleto!',
                    troll: '🗿 Troll de Pedra!',
                    boss: '👹 Boss!',
                    enemy: '👾 Inimigo!',
                    spike: '🔺 Espinhos!'
                };
                await this.modalManager.show(sourceNames[source] || '💥 Ataque!',
                    `Sofreu ${hpLoss} de dano! HP: ${this.playerStats.hp}/${this.playerStats.maxHp}`);
            }
        } finally {
            this._damageLock = false;
        }
    }

    handleDefeat(message) {
        _victoryToken = null;
        _commandHash = null;
        _statsSnapshot = null;
        this.stage.stopAI();
        this.runner.kill();
        this.workspaceManager.clear();

        SoundManager.playError();
        this.stats.deaths = Math.min(9999, this.stats.deaths + 1);
        this.stats.score = Math.max(0, Math.min(999999, this.stats.score - 50));
        this.playerStats.reset();
        this.dashboard.update(this.playerStats);
        this.setButtonsEnabled(false);

        this.showMessage(
            '💀 Derrota!',
            `${message} Todo o progresso foi perdido. Inicie um novo jogo.`,
            'Menu Principal'
        );

        this._modalAction = () => {
            this.hideModal();
            this.pauseBgMusic();
            Storage.clearProgress();
            this.currentLevel = 0;
            this.playerName = '';
            this.playerId = '';
            this.stats = { coins: 0, keys: 0, deaths: 0, score: 0, movements: 0 };
            this.showView('menu');
        };

        this._modalSecondaryAction = null;
    }

    handleModalPrimary() {
        if (this._modalAction) this._modalAction();
    }

    handleModalSecondary() {
        if (this._modalSecondaryAction) this._modalSecondaryAction();
    }

    showMessage(title, message, primaryBtn = 'OK', secondaryBtn = null) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;
        document.getElementById('modalBtnPrimary').textContent = primaryBtn;

        // Hide stars & record badge by default (only shown in victory)
        document.getElementById('modalStars').classList.add('hidden');
        document.getElementById('recordBadge').classList.add('hidden');

        const secondaryBtnEl = document.getElementById('modalBtnSecondary');
        if (secondaryBtn) {
            secondaryBtnEl.textContent = secondaryBtn;
            secondaryBtnEl.style.display = '';
        } else {
            secondaryBtnEl.style.display = 'none';
        }

        document.getElementById('modalOverlay').hidden = false;
    }

    hideModal() {
        document.getElementById('modalOverlay').hidden = true;
    }

    setButtonsEnabled(enabled) {
        document.getElementById('btnPlay').disabled = enabled;
        document.getElementById('btnPlayMobile').disabled = enabled;
        document.getElementById('btnRunDesktop').disabled = enabled;
    }

    updateUI() {
        const levelNum = this.currentLevel + 1;
        document.getElementById('levelBadge').textContent = `Fase ${levelNum}`;
        const ruleDef = getRuleDef(this.currentRule);
        const ruleDisplay = ruleDef ? `${ruleDef.icon} ${ruleDef.name}` : 'Fase sem regras especiais';
        const ruleTitle = ruleDef ? ruleDef.hover : '';
        const titleEl = document.getElementById('stageLevelTitle');
        titleEl.textContent = `Fase ${levelNum}: ${ruleDisplay}`;
        titleEl.title = ruleTitle;
        
        // Update objective info
        const levelData = getLevel(this.currentLevel);
        const coinCount = levelData.map.flat().filter(c => c === 'coin').length;
        const keyCount = levelData.map.flat().filter(c => c === 'key').length;
        document.getElementById('objectiveCoins').textContent = `${this.stats.coins}/${coinCount}`;
        document.getElementById('objectiveKeys').textContent = `${this.stats.keys}/${keyCount}`;

        this.updateStarsUI();
    }

    updateStarsUI() {
        const stars = Storage.getLevelStars(this.playerId, this.currentLevel + 1);
        for (let i = 0; i < 3; i++) {
            const starEl = document.getElementById(`headerStar${i + 1}`);
            if (starEl) {
                if (stars && i < stars.earned) {
                    starEl.textContent = '★';
                    starEl.classList.add('star-earned');
                } else {
                    starEl.textContent = '☆';
                    starEl.classList.remove('star-earned');
                }
            }
        }
    }

    setupStarTooltip() {
        const display = document.getElementById('starDisplay');
        const tooltip = document.getElementById('starTooltip');
        if (!display || !tooltip) return;
        display.addEventListener('mouseenter', () => this.updateStarTooltip());
        display.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
    }

    updateStarTooltip() {
        const tooltip = document.getElementById('starTooltip');
        if (!tooltip) return;
        const stars = Storage.getLevelStars(this.playerId, this.currentLevel + 1);
        for (let i = 0; i < 3; i++) {
            const icon = document.getElementById(`tipStar${i + 1}`);
            if (!icon) continue;
            const item = icon.closest('.star-tooltip-item');
            if (stars && i < stars.earned) {
                icon.textContent = '★';
                icon.classList.add('earned');
                if (item) item.classList.add('achieved');
            } else {
                icon.textContent = '☆';
                icon.classList.remove('earned');
                if (item) item.classList.remove('achieved');
            }
        }
        tooltip.classList.add('show');
    }

    showChestTip() {
        if (Storage.loadEncrypted('agentica_chest_tip_shown')) return;
        const levelNum = this.currentLevel + 1;
        if (levelNum % 3 !== 1) return;
        if (getLevel(this.currentLevel)?.boss) return;
        Storage.saveEncrypted('agentica_chest_tip_shown', '1');
        const toast = document.createElement('div');
        toast.className = 'chest-tip';
        toast.textContent = '🧰 Baú! Aproxime-se para abrir e ganhar itens!';
        document.getElementById('gameWrapper').appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    setupThemeToggle() {
        const html = document.documentElement;
        const homeBtn = document.getElementById('themeToggleHome');
        const gameBtn = document.getElementById('themeToggleGame');

        const saved = Storage.loadEncrypted('agentica_theme');
        if (saved === 'light') {
            html.classList.add('light');
            this.updateThemeIcons(true);
        }

        const toggle = (isLight) => {
            html.classList.toggle('light', isLight);
            Storage.saveEncrypted('agentica_theme', isLight ? 'light' : 'dark');
            this.updateThemeIcons(isLight);
        };

        homeBtn?.addEventListener('click', () => toggle(!html.classList.contains('light')));
        gameBtn?.addEventListener('click', () => toggle(!html.classList.contains('light')));
    }

    updateThemeIcons(isLight) {
        const icon = isLight ? 'dark_mode' : 'light_mode';
        document.querySelectorAll('.btn-theme .material-symbols-outlined').forEach(el => {
            el.textContent = icon;
        });
    }

    setupHelpAccordion() {
        const overlay = document.getElementById('helpOverlay');
        const modal = document.getElementById('helpModal');
        const closeBtn = document.getElementById('helpCloseBtn');
        const gotItBtn = document.getElementById('helpGotItBtn');

        // Accordion toggle
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.dataset.target;
                const body = document.getElementById(targetId);
                if (!body) return;

                const isOpen = body.classList.contains('open');
                body.classList.toggle('open');
                header.classList.toggle('open');

                // Close others
                document.querySelectorAll('.accordion-body.open').forEach(other => {
                    if (other.id !== targetId) {
                        other.classList.remove('open');
                        other.previousElementSibling?.classList.remove('open');
                    }
                });
            });
        });

        // Open help from menu
        document.querySelectorAll('#menuHelpBtn, #btnHelp').forEach(btn => {
            btn?.addEventListener('click', () => {
                overlay.hidden = false;
            });
        });

        // Close handlers
        const close = () => {
            overlay.hidden = true;
            document.querySelectorAll('.accordion-body.open, .accordion-header.open').forEach(el => {
                el.classList.remove('open');
            });
        };

        closeBtn?.addEventListener('click', close);
        gotItBtn?.addEventListener('click', close);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }

    autoRestoreIfNeeded() {
        const saved = Storage.loadProgress();
        if (!saved) return;

        document.getElementById('playerName').value = this.playerName;
        this.showView('game');
        this.loadLevel(this.currentLevel);
        this.pickRandomTrack();
        this.pickRandomBg();
        this.playBgMusic();
        this.updateUI();
        this.displayRankings();
    }

    displayRankings(mode, level) {
        if (mode !== undefined) this.rankMode = mode;
        if (level !== undefined) this.rankLevel = level;

        if (this.rankMode === 'global') {
            this.renderRankingList('viewRankingScoreList', Storage.getAggregatedRankingsByScore(), 'score', true);
            this.renderRankingList('viewRankingBlocksList', Storage.getAggregatedRankingsByBlocks(), 'blocks', false);
            this.renderRankingList('viewRankingMovementsList', Storage.getAggregatedRankingsByMovements(), 'movements', false);
        } else {
            this.renderRankingList('viewRankingScoreList', Storage.getRankingsByScoreForLevel(this.rankLevel), 'score', true, this.rankLevel);
            this.renderRankingList('viewRankingBlocksList', Storage.getRankingsByBlocksForLevel(this.rankLevel), 'blocks', false, this.rankLevel);
            this.renderRankingList('viewRankingMovementsList', Storage.getRankingsByMovementsForLevel(this.rankLevel), 'movements', false, this.rankLevel);
        }
        this.renderPlayerList();
    }

    renderPlayerList() {
        const container = document.getElementById('viewRankingPlayersList');
        if (!container) return;
        container.innerHTML = '';

        const players = Storage.getAllPlayerEntries();
        if (players.length === 0) {
            container.innerHTML = '<div class="ranking-empty">Nenhum jogador registrado ainda</div>';
            return;
        }

        players.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';

            const isCurrentPlayer = player.playerId === this.playerId && this.playerId;
            if (isCurrentPlayer) item.classList.add('current-player');

            const firstDate = new Date(player.firstPlayed).toLocaleDateString('pt-BR');
            const lastDate = new Date(player.lastPlayed).toLocaleDateString('pt-BR');

            item.innerHTML = `
                <span class="ranking-position">${index + 1}º</span>
                <span class="ranking-name">${player.playerName}</span>
                <span class="ranking-value">🎮</span>
                <span class="ranking-level">Primeiro: ${firstDate}</span>
            `;

            container.appendChild(item);
        });
    }

    renderRankingList(containerId, rankings, metric, isScore, level) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (rankings.length === 0) {
            container.innerHTML = '<div class="ranking-empty">Nenhum registro ainda</div>';
            return;
        }

        // Calculate benchmark for per-level rankings
        let benchmark = null;
        if (level) {
            const levelData = getLevel(level - 1);
            if (levelData) {
                benchmark = Storage.calculateLevelBenchmark(levelData);
            }
        }

        rankings.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';

            if (entry.perfect) item.classList.add('perfect');
            const isCurrentPlayer = entry.playerId === this.playerId && this.playerId;
            if (isCurrentPlayer) item.classList.add('current-player');

            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;

            let valueText = '';
            if (isScore) {
                valueText = `${entry.score} pts`;
            } else if (metric === 'blocks') {
                valueText = `${entry.blocks ?? 0} blocos`;
            } else {
                valueText = `${entry.movements} movimentos`;
            }

            // Build comparison HTML
            let comparisonHtml = '';
            if (isCurrentPlayer && benchmark && level) {
                if (isScore && benchmark.maxScore > 0) {
                    const pct = Math.round((entry.score / benchmark.maxScore) * 100);
                    comparisonHtml = `<div class="ranking-comparison">🎯 ${Math.min(pct, 100)}% do recorde (Kenji: ${benchmark.maxScore} pts)</div>`;
                } else if (metric === 'movements' && benchmark.optimalMoves > 0) {
                    const pct = Math.round((benchmark.optimalMoves / Math.max(entry.movements, 1)) * 100);
                    comparisonHtml = `<div class="ranking-comparison">🎯 ${Math.min(pct, 100)}% de eficiência (Ótimo: ${benchmark.optimalMoves} mov.)</div>`;
                } else if (metric === 'blocks') {
                    comparisonHtml = `<div class="ranking-comparison">🏗️ ${entry.blocks ?? 0} blocos (menor é melhor)</div>`;
                }
            }

            const levelText = entry.levels ? `${entry.levels} níveis` : `Fase ${entry.level}`;
            item.innerHTML = `
                <span class="ranking-position">${medal}</span>
                <span class="ranking-name">${entry.name}</span>
                <span class="ranking-value">${valueText}</span>
                <span class="ranking-level">${levelText}</span>
                ${comparisonHtml}
            `;

            container.appendChild(item);
        });
    }

}

const app = new App();
