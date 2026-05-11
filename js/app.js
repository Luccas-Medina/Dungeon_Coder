import { Storage } from './engine/storage.js';
import { Parser } from './engine/parser.js';
import { Runner } from './engine/runner.js';
import { DragDropManager } from './components/dragDrop.js';
import { WorkspaceManager } from './components/workspace.js';
import { PaletteManager } from './components/palette.js';
import { Stage } from './components/Stage.js';
import { generateLevel } from './engine/levelGenerator.js';

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
    }
};

class App {
    constructor() {
        this.currentLevel = 0;
        this.stats = { coins: 0, keys: 0, deaths: 0, score: 0, movements: 0 };
        this.playerName = '';
        this.bgMuted = false;
        this.rankMode = 'level';
        this.rankLevel = 1;
        this.init();
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
        this.setupMenuListeners();
        this.setupRankingsViewListeners();
        this.setupStarTooltip();

        // Pre-fill menu name if saved
        if (this.playerName) {
            document.getElementById('menuPlayerName').value = this.playerName;
            document.getElementById('menuPlayBtn').disabled = false;
        }
    }

    setupStageCallbacks() {
        this.stage.setCallbacks({
            onCoinCollect: (count) => {
                this.stats.coins = count;
                this.stats.score += 100;
                SoundManager.playCollect();
                this.updateUI();
            },
            onKeyCollect: () => {
                this.stats.keys++;
                this.stats.score += 200;
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
            onEnemyCollision: () => {
                this.handleDefeat('Você foi pego por um inimigo!');
            },
            onAttack: () => {
                SoundManager.playAttack();
            },
            onBossDefeat: () => {
                this.stats.score += 1000;
                SoundManager.playVictory();
                this.updateUI();
            },
            onLevelComplete: () => {
                this.handleVictory();
            }
        });
    }

    setupRunnerCallbacks() {
        this.runner.setCallbacks({
            onComplete: () => {
                this.setButtonsEnabled(false);
            },
            onError: (error) => {
                this.setButtonsEnabled(false);
            },
            onBlockExecute: (index) => {
                this.highlightBlock(index);
            }
        });
    }

    setupEventListeners() {
        // Mobile and desktop play buttons
        document.getElementById('btnPlay').addEventListener('click', () => this.runCode());
        document.getElementById('btnPlayMobile').addEventListener('click', () => this.runCode());
        document.getElementById('btnRunDesktop').addEventListener('click', () => this.runCode());
        
        // Pause buttons
        document.getElementById('btnPause').addEventListener('click', () => this.togglePause());
        document.getElementById('btnPauseDesktop').addEventListener('click', () => this.togglePause());
        
        // Clear buttons
        document.getElementById('btnClear').addEventListener('click', () => this.workspaceManager.clear());
        
        // Reset buttons
        document.getElementById('btnResetLevel').addEventListener('click', () => this.loadLevel(this.currentLevel));
        document.getElementById('btnResetDesktop').addEventListener('click', () => this.loadLevel(this.currentLevel));
        
        // Level navigation
        document.getElementById('btnPrevLevel').addEventListener('click', () => {
            if (this.currentLevel > 0) {
                this.loadLevel(this.currentLevel - 1);
            }
        });
        document.getElementById('btnNextLevel').addEventListener('click', () => {
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
            Storage.saveContinueState({
                level: this.currentLevel,
                stats: { ...this.stats },
                stage: this.stage.getState()
            });
            this.showView('menu');
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
            this.playerName = name;
            document.getElementById('playerName').value = name;
            this.stats = { coins: 0, keys: 0, deaths: 0, score: 0, movements: 0 };
            this.currentLevel = 0;
            Storage.clearContinueState();
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
        const continueState = Storage.loadContinueState();
        const btn = document.getElementById('menuContinueBtn');
        btn.style.display = continueState ? '' : 'none';
    }

    resumeFromContinue() {
        const continueState = Storage.loadContinueState();
        if (!continueState) return;

        this.currentLevel = continueState.level;
        this.playerName = document.getElementById('playerName').value || this.playerName;

        this.showView('game');

        if (continueState.stage) {
            this.stats = { ...continueState.stats };
            this.stage.restoreState(continueState.stage);
            this.workspaceManager.restoreFromStorage();
        } else {
            this.loadLevel(this.currentLevel);
        }

        this.playBgMusic();

        this.updateUI();
        this.displayRankings();
        this.saveProgress();
    }

    setupBgMusic() {
        this.bgTrackIndex = -1;
        this.bgMusic = new Audio();
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.4;

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

    pickRandomBg() {
        const file = IMAGE_FILES[Math.floor(Math.random() * IMAGE_FILES.length)];
        document.querySelector('.stage').style.setProperty('--stage-bg', `url('/Dungeon_Coder/images/${file}')`);
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
            this.currentLevel = saved.level ?? 0;
            this.stats.coins = saved.coins ?? 0;
            this.stats.keys = saved.keys ?? 0;
            this.stats.deaths = saved.deaths ?? 0;
            this.stats.score = saved.score ?? 0;
            this.stats.movements = saved.movements ?? 0;
            this.playerName = saved.playerName ?? '';
            document.getElementById('playerName').value = this.playerName;
        }
    }

    saveProgress() {
        this.playerName = document.getElementById('playerName').value.trim();
        Storage.saveProgress({
            level: this.currentLevel,
            coins: this.stats.coins,
            keys: this.stats.keys,
            deaths: this.stats.deaths,
            score: this.stats.score,
            movements: this.stats.movements,
            playerName: this.playerName
        });
    }

    loadLevel(index) {
        if (index < 0 || index >= MAX_LEVELS) return;
        this.currentLevel = index;
        this.stats.coins = 0;
        this.stats.keys = 0;

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

        this.stage.loadLevel(levelCopy);
        this.updateUI();
        this.updateStarsUI();
        this.saveProgress();
    }

    countMovements(commands) {
        let count = 0;
        for (const cmd of commands) {
            if (['moveUp', 'moveDown', 'moveLeft', 'moveRight'].includes(cmd.type)) {
                count++;
            } else if (cmd.type === 'repeat' && cmd.children.length > 0) {
                count += (cmd.params.times ?? 2) * this.countMovements(cmd.children);
            }
        }
        return count;
    }

    async runCode() {
        if (this.runner.isRunning) return;

        // Reset runner state before new run
        this.runner.stop();
        
        SoundManager.init();

        const commands = this.parser.parse(document.getElementById('workspace'));
        this.currentRunMovements = this.countMovements(commands);

        if (commands.length === 0) {
            this.showMessage('Nenhum bloco!', 'Adicione blocos ao workspace antes de executar.');
            this._modalAction = () => this.hideModal();
            this._modalSecondaryAction = null;
            return;
        }

        this.setButtonsEnabled(true);
        document.getElementById('btnPause').disabled = false;

        await this.runner.run(commands);
    }

    togglePause() {
        if (!this.runner.isRunning) return;

        if (this.runner.isPaused) {
            this.runner.resume();
            document.getElementById('btnPause').textContent = '⏸ Pausar';
        } else {
            this.runner.pause();
            document.getElementById('btnPause').textContent = '▶ Retomar';
        }
    }

    highlightBlock(index) {
        const blocks = this.workspaceManager.getBlocks();
        blocks.forEach(b => b.classList.remove('executing'));
        if (blocks[index]) {
            blocks[index].classList.add('executing');
        }
    }

    handleVictory() {
        this.runner.stop();
        this.workspaceManager.clear();
        SoundManager.playVictory();
        this.stats.score += 500;
        this.stats.movements += this.currentRunMovements || 0;
        this.setButtonsEnabled(false);
        this.changeBgMusic();
        this.pickRandomBg();

        const playerName = document.getElementById('playerName').value.trim() || 'Anônimo';

        Storage.addRankingEntry({
            name: playerName,
            score: this.stats.score,
            level: this.currentLevel + 1,
            deaths: this.stats.deaths,
            movements: this.stats.movements
        });

        // Calculate stars
        const earnedStars = 1 + (this.stats.deaths === 0 ? 1 : 0) + (this.currentRunMovements <= 20 ? 1 : 0);
        const starResult = Storage.saveStars(this.currentLevel + 1, {
            earned: earnedStars,
            deaths: this.stats.deaths,
            movements: this.stats.movements
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

        // Animate stars in modal and show record badge
        document.getElementById('modalStars').classList.remove('hidden');
        setTimeout(() => this.animateModalStars(earnedStars, starResult?.isRecord), 300);

        this.saveProgress();
        this.displayRankings();
        this.updateStarsUI();
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

    handleDefeat(message) {
        // Kill switch - stop all execution immediately
        this.runner.kill();
        Storage.clearContinueState();
        
        SoundManager.playError();
        this.stats.deaths++;
        this.stats.score = Math.max(0, this.stats.score - 50);
        this.setButtonsEnabled(false);

        this.showMessage(
            '💀 Derrota!',
            `${message} Tentativas falhas: ${this.stats.deaths}`,
            'Tentar Novamente'
        );

        this._modalAction = () => {
            this.hideModal();
            this.pauseBgMusic();
            this.showView('menu');
        };

        this._modalSecondaryAction = null;

        this.saveProgress();
        this.displayRankings();
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
        document.getElementById('btnPause').disabled = !enabled;
        document.getElementById('btnPauseDesktop').disabled = !enabled;
    }

    updateUI() {
        const levelNum = this.currentLevel + 1;
        document.getElementById('levelBadge').textContent = `Fase ${levelNum}`;
        document.getElementById('stageLevelTitle').textContent = `Level ${levelNum}: ${getLevel(this.currentLevel).name}`;
        
        // Update objective info
        const levelData = getLevel(this.currentLevel);
        const coinCount = levelData.map.flat().filter(c => c === 'coin').length;
        const keyCount = levelData.map.flat().filter(c => c === 'key').length;
        document.getElementById('objectiveCoins').textContent = `${this.stats.coins}/${coinCount}`;
        document.getElementById('objectiveKeys').textContent = `${this.stats.keys}/${keyCount}`;

        this.updateStarsUI();
    }

    updateStarsUI() {
        const stars = Storage.getLevelStars(this.currentLevel + 1);
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
        const stars = Storage.getLevelStars(this.currentLevel + 1);
        if (!tooltip) return;
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

    displayRankings(mode, level) {
        if (mode !== undefined) this.rankMode = mode;
        if (level !== undefined) this.rankLevel = level;

        if (this.rankMode === 'global') {
            this.renderRankingList('viewRankingScoreList', Storage.getAggregatedRankingsByScore(), 'score', true);
            this.renderRankingList('viewRankingDeathsList', Storage.getAggregatedRankingsByDeaths(), 'deaths', false);
            this.renderRankingList('viewRankingMovementsList', Storage.getAggregatedRankingsByMovements(), 'movements', false);
        } else {
            this.renderRankingList('viewRankingScoreList', Storage.getRankingsByScoreForLevel(this.rankLevel), 'score', true, this.rankLevel);
            this.renderRankingList('viewRankingDeathsList', Storage.getRankingsByDeathsForLevel(this.rankLevel), 'deaths', false, this.rankLevel);
            this.renderRankingList('viewRankingMovementsList', Storage.getRankingsByMovementsForLevel(this.rankLevel), 'movements', false, this.rankLevel);
        }
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
            const isCurrentPlayer = entry.name === this.playerName && this.playerName;
            if (isCurrentPlayer) item.classList.add('current-player');

            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;

            let valueText = '';
            if (isScore) {
                valueText = `${entry.score} pts`;
            } else if (metric === 'deaths') {
                valueText = `${entry.deaths} mortes`;
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
                } else if (metric === 'deaths') {
                    comparisonHtml = `<div class="ranking-comparison">${entry.deaths === 0 ? '✅ Perfeito, sem mortes!' : `💀 ${entry.deaths} mortes`}</div>`;
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
