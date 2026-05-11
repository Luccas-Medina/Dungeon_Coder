const STORAGE_PREFIX = 'agentica_';
const STORAGE_SALT = 'DungeonCoder2026!@#Sec';
const STORAGE_VERSION = 1;

function generateId() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function computeSignature(str) {
    let hash = 0;
    const data = STORAGE_SALT + str;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash) + data.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function b64Encode(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function b64Decode(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

function secureSave(key, data) {
    try {
        const payload = JSON.stringify({ v: STORAGE_VERSION, d: data });
        const sig = computeSignature(payload);
        const blob = b64Encode(JSON.stringify({ s: sig, p: payload }));
        localStorage.setItem(key, blob);
    } catch {}
}

function secureLoad(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        let decoded;
        try {
            decoded = JSON.parse(b64Decode(raw));
        } catch {
            return null;
        }

        if (!decoded || !decoded.s || !decoded.p) return null;

        if (decoded.s !== computeSignature(decoded.p)) return null;

        const parsed = JSON.parse(decoded.p);
        if (parsed.v !== STORAGE_VERSION) return null;

        return parsed.d;
    } catch {
        return null;
    }
}

function validateInt(value, min, max, def) {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return def;
    return Math.max(min, Math.min(max, Math.floor(Math.abs(value))));
}

function validateString(value, maxLen, def) {
    if (typeof value !== 'string') return def;
    return value.trim().slice(0, maxLen);
}

const MOCK_RANKINGS = [
    { id: 'mock_k1', playerId: 'mock_kenji', name: 'Kenji', level: 1, deaths: 0, movements: 8,  score: 1200,  blocks: 4,  date: 'Mock', perfect: true },
    { id: 'mock_k2', playerId: 'mock_kenji', name: 'Kenji', level: 2, deaths: 0, movements: 10, score: 2600,  blocks: 5,  date: 'Mock', perfect: true },
    { id: 'mock_k3', playerId: 'mock_kenji', name: 'Kenji', level: 3, deaths: 0, movements: 12, score: 4100,  blocks: 6,  date: 'Mock', perfect: true },
    { id: 'mock_k4', playerId: 'mock_kenji', name: 'Kenji', level: 4, deaths: 0, movements: 14, score: 5700,  blocks: 7,  date: 'Mock', perfect: true },
    { id: 'mock_k5', playerId: 'mock_kenji', name: 'Kenji', level: 5, deaths: 0, movements: 18, score: 10000, blocks: 8,  date: 'Mock', perfect: true },
    { id: 'mock_m1', playerId: 'mock_mori', name: 'Mori',  level: 1, deaths: 2, movements: 15, score: 800,   blocks: 8,  date: 'Mock' },
    { id: 'mock_m2', playerId: 'mock_mori', name: 'Mori',  level: 2, deaths: 3, movements: 22, score: 1800,  blocks: 12, date: 'Mock' },
    { id: 'mock_m3', playerId: 'mock_mori', name: 'Mori',  level: 3, deaths: 5, movements: 30, score: 3000,  blocks: 15, date: 'Mock' }
];

function bfsOptimalMoves(map, startX, startY, targetX, targetY) {
    const SIZE = 10;
    const dist = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
    const q = [{ x: startX, y: startY }];
    dist[startY][startX] = 0;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (q.length > 0) {
        const { x, y } = q.shift();
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && dist[ny][nx] === -1) {
                const cell = map[ny][nx];
                if (cell !== 'wall' && cell !== 'hole' && cell !== 'boss') {
                    dist[ny][nx] = dist[y][x] + 1;
                    q.push({ x: nx, y: ny });
                }
            }
        }
    }
    return dist[targetY][targetX];
}

(function migrateOldKeys() {
    try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
            if (!k.startsWith(STORAGE_PREFIX)) continue;

            // Remove all backup keys (signed blobs and legacy plain)
            if (k.endsWith('_backup') || k.endsWith('_backup_plain')) {
                localStorage.removeItem(k);
                continue;
            }

            // Remove star_ranking (redundant with agentica_stars)
            if (k === `${STORAGE_PREFIX}star_ranking`) {
                localStorage.removeItem(k);
                continue;
            }

            // Remove continue state (redundant with agentica_progress)
            if (k === `${STORAGE_PREFIX}continue`) {
                localStorage.removeItem(k);
                continue;
            }
        }
    } catch {}
})();

export const Storage = {
    saveEncrypted(key, data) {
        secureSave(key, data);
    },
    loadEncrypted(key) {
        return secureLoad(key);
    },

    saveProgress(data) {
        const payload = {
            level: validateInt(data.level, 0, 49, 0),
            coins: validateInt(data.coins, 0, 100, 0),
            keys: validateInt(data.keys, 0, 10, 0),
            deaths: validateInt(data.deaths, 0, 9999, 0),
            score: validateInt(data.score, 0, 999999, 0),
            movements: validateInt(data.movements, 0, 9999, 0),
            playerId: data.playerId || '',
            playerName: validateString(data.playerName, 20, ''),
            playerStats: data.playerStats ?? { hp: 5, maxHp: 5, attack: 1, inventory: { potions: 0 }, shield: 0 },
            lastSaved: Date.now()
        };
        secureSave(`${STORAGE_PREFIX}progress`, payload);
    },

    loadProgress() {
        const data = secureLoad(`${STORAGE_PREFIX}progress`);
        if (!data) return null;
        return {
            level: validateInt(data.level, 0, 49, 0),
            coins: validateInt(data.coins, 0, 100, 0),
            keys: validateInt(data.keys, 0, 10, 0),
            deaths: validateInt(data.deaths, 0, 9999, 0),
            score: validateInt(data.score, 0, 999999, 0),
            movements: validateInt(data.movements, 0, 9999, 0),
            playerId: data.playerId || '',
            playerName: validateString(data.playerName, 20, ''),
            playerStats: data.playerStats ?? null
        };
    },

    clearProgress() {
        try {
            localStorage.removeItem(`${STORAGE_PREFIX}progress`);
        } catch {}
    },

    saveWorkspace(blocks) {
        if (!Array.isArray(blocks)) return;
        secureSave(`${STORAGE_PREFIX}workspace`, blocks);
    },

    loadWorkspace() {
        const data = secureLoad(`${STORAGE_PREFIX}workspace`);
        if (!Array.isArray(data)) return null;
        return data;
    },

    saveRanking(ranking) {
        if (!Array.isArray(ranking)) return;
        const userEntries = ranking.filter(e => e.date !== 'Mock');
        secureSave(`${STORAGE_PREFIX}ranking`, userEntries);
    },

    loadRanking() {
        const raw = secureLoad(`${STORAGE_PREFIX}ranking`);
        const userEntries = Array.isArray(raw) ? raw : [];
        return [...MOCK_RANKINGS, ...userEntries];
    },

    addRankingEntry(entry) {
        if (!entry || typeof entry !== 'object') return;
        const raw = secureLoad(`${STORAGE_PREFIX}ranking`);
        const userEntries = Array.isArray(raw) ? raw : [];

        userEntries.push({
            id: generateId(),
            playerId: entry.playerId || '',
            name: validateString(entry.name, 20, 'Anônimo'),
            level: validateInt(entry.level, 1, 50, 1),
            deaths: validateInt(entry.deaths, 0, 9999, 0),
            movements: validateInt(entry.movements, 0, 9999, 0),
            score: validateInt(entry.score, 0, 999999, 0),
            blocks: validateInt(entry.blocks, 0, 9999, 999),
            date: new Date().toLocaleDateString('pt-BR')
        });
        secureSave(`${STORAGE_PREFIX}ranking`, userEntries);
    },

    getRankingsByScore() {
        const ranking = this.loadRanking();
        return [...ranking].sort((a, b) => b.score - a.score).slice(0, 10);
    },

    getRankingsByScoreForLevel(level) {
        const ranking = this.loadRanking();
        return [...ranking]
            .filter(e => e.level === level)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    },

    getRankingsByDeaths() {
        const ranking = this.loadRanking();
        return [...ranking].sort((a, b) => a.deaths - b.deaths || b.level - a.level).slice(0, 10);
    },

    getRankingsByDeathsForLevel(level) {
        const ranking = this.loadRanking();
        return [...ranking]
            .filter(e => e.level === level)
            .sort((a, b) => a.deaths - b.deaths || b.level - a.level)
            .slice(0, 10);
    },

    getRankingsByMovements() {
        const ranking = this.loadRanking();
        return [...ranking].sort((a, b) => a.movements - b.movements || b.level - a.level).slice(0, 10);
    },

    getRankingsByMovementsForLevel(level) {
        const ranking = this.loadRanking();
        return [...ranking]
            .filter(e => e.level === level)
            .sort((a, b) => a.movements - b.movements || b.level - a.level)
            .slice(0, 10);
    },

    getRankingsByBlocks() {
        const ranking = this.loadRanking();
        return [...ranking]
            .sort((a, b) => (a.blocks ?? 999) - (b.blocks ?? 999) || b.level - a.level)
            .slice(0, 10);
    },

    getRankingsByBlocksForLevel(level) {
        const ranking = this.loadRanking();
        return [...ranking]
            .filter(e => e.level === level)
            .sort((a, b) => (a.blocks ?? 999) - (b.blocks ?? 999) || b.level - a.level)
            .slice(0, 10);
    },

    // Aggregated rankings (sum of all levels per player)
    getAggregatedRankingsByScore() {
        const ranking = this.loadRanking();
        const grouped = {};
        for (const entry of ranking) {
            if (!grouped[entry.name]) {
                grouped[entry.name] = { name: entry.name, score: 0, deaths: 0, movements: 0, levels: 0, perfect: true };
            }
            grouped[entry.name].score += entry.score || 0;
            grouped[entry.name].deaths += entry.deaths || 0;
            grouped[entry.name].movements += entry.movements || 0;
            grouped[entry.name].levels++;
            if (!entry.perfect) grouped[entry.name].perfect = false;
        }
        return Object.values(grouped).sort((a, b) => b.score - a.score).slice(0, 10);
    },

    getAggregatedRankingsByDeaths() {
        const ranking = this.loadRanking();
        const grouped = {};
        for (const entry of ranking) {
            if (!grouped[entry.name]) {
                grouped[entry.name] = { name: entry.name, score: 0, deaths: 0, movements: 0, levels: 0, perfect: true };
            }
            grouped[entry.name].score += entry.score || 0;
            grouped[entry.name].deaths += entry.deaths || 0;
            grouped[entry.name].movements += entry.movements || 0;
            grouped[entry.name].levels++;
            if (!entry.perfect) grouped[entry.name].perfect = false;
        }
        return Object.values(grouped).sort((a, b) => a.deaths - b.deaths || b.score - a.score).slice(0, 10);
    },

    getAggregatedRankingsByMovements() {
        const ranking = this.loadRanking();
        const grouped = {};
        for (const entry of ranking) {
            if (!grouped[entry.name]) {
                grouped[entry.name] = { name: entry.name, score: 0, deaths: 0, movements: 0, levels: 0, perfect: true };
            }
            grouped[entry.name].score += entry.score || 0;
            grouped[entry.name].deaths += entry.deaths || 0;
            grouped[entry.name].movements += entry.movements || 0;
            grouped[entry.name].levels++;
            if (!entry.perfect) grouped[entry.name].perfect = false;
        }
        return Object.values(grouped).sort((a, b) => a.movements - b.movements || b.score - a.score).slice(0, 10);
    },

    getAggregatedRankingsByBlocks() {
        const ranking = this.loadRanking();
        const grouped = {};
        for (const entry of ranking) {
            if (!grouped[entry.name]) {
                grouped[entry.name] = { name: entry.name, score: 0, blocks: 0, movements: 0, levels: 0, perfect: true };
            }
            grouped[entry.name].score += entry.score || 0;
            grouped[entry.name].blocks += entry.blocks || 0;
            grouped[entry.name].movements += entry.movements || 0;
            grouped[entry.name].levels++;
            if (!entry.perfect) grouped[entry.name].perfect = false;
        }
        return Object.values(grouped).sort((a, b) => (a.blocks ?? 999) - (b.blocks ?? 999) || b.score - a.score).slice(0, 10);
    },

    // Stars system
    validateStarEntry(value) {
        if (!value || typeof value !== 'object') return null;
        return {
            earned: validateInt(value.earned, 1, 3, 1),
            deaths: validateInt(value.deaths, 0, 9999, 0),
            movements: validateInt(value.movements, 0, 9999, 0)
        };
    },

    saveStars(playerId, level, data) {
        try {
            const pid = typeof playerId === 'string' && playerId ? playerId : 'default';
            const lv = validateInt(level, 1, 50, 1);
            const entry = this.validateStarEntry(data);
            if (!entry) return { earned: 1, deaths: 0, movements: 0, isRecord: false };

            const all = this.loadStars();
            const playerStars = all[pid] || {};
            const prev = playerStars[lv];

            let isRecord = false;
            if (!prev || entry.earned > prev.earned) {
                isRecord = true;
            }

            playerStars[lv] = { ...entry, isRecord };
            all[pid] = playerStars;
            secureSave(`${STORAGE_PREFIX}stars`, all);
            return playerStars[lv];
        } catch {
            return { earned: 1, deaths: 0, movements: 0, isRecord: false };
        }
    },

    loadStars() {
        try {
            const data = secureLoad(`${STORAGE_PREFIX}stars`);
            if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
            return data;
        } catch {
            return {};
        }
    },

    getLevelStars(playerId, level) {
        try {
            const pid = typeof playerId === 'string' && playerId ? playerId : 'default';
            const all = this.loadStars();
            const playerStars = all[pid];
            if (!playerStars) return null;
            const lv = validateInt(level, 1, 50, 1);
            return this.validateStarEntry(playerStars[lv]);
        } catch {
            return null;
        }
    },

    calculateLevelBenchmark(levelData) {
        if (!levelData || !levelData.map || !levelData.player) {
            return { maxScore: 0, optimalMoves: 20 };
        }
        const map = levelData.map;
        const player = levelData.player;
        const boss = levelData.boss;

        let maxScore = 0;
        let coinCount = 0;
        let keyPos = null;
        let doorPos = null;

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const cell = map[y][x];
                if (cell === 'coin') coinCount++;
                if (cell === 'key') keyPos = { x, y };
                if (cell === 'door') doorPos = { x, y };
            }
        }

        maxScore += coinCount * 100;
        maxScore += keyPos ? 200 : 0;
        maxScore += 500;
        if (boss) maxScore += 1000;

        let optimalMoves = 0;
        if (keyPos && doorPos) {
            const toKey = bfsOptimalMoves(map, player.x, player.y, keyPos.x, keyPos.y);
            if (toKey > 0) {
                const toDoor = bfsOptimalMoves(map, keyPos.x, keyPos.y, doorPos.x, doorPos.y);
                if (toDoor > 0) {
                    optimalMoves = toKey + toDoor;
                }
            }
        }

        if (boss) {
            const toBoss = bfsOptimalMoves(map, player.x, player.y, boss.x, boss.y);
            if (toBoss > 0) optimalMoves = Math.max(optimalMoves, toBoss);
        }

        return { maxScore, optimalMoves: optimalMoves > 0 ? optimalMoves : 20 };
    },

    validateRankingEntry(entry, levelData) {
        if (!entry || typeof entry !== 'object') return false;
        const benchmark = this.calculateLevelBenchmark(levelData);

        const moves = validateInt(entry.movements, 0, 9999, 0);
        const score = validateInt(entry.score, 0, 999999, 0);
        const deaths = validateInt(entry.deaths, 0, 9999, 0);

        if (moves <= 0 && benchmark.optimalMoves > 0) return false;

        const minPossibleMoves = Math.max(1, Math.floor(benchmark.optimalMoves * 0.5));
        if (moves < minPossibleMoves) return false;

        const maxPossibleWithDeaths = benchmark.maxScore + 100;
        if (score > maxPossibleWithDeaths + 100) return false;

        if (deaths === 0 && moves < benchmark.optimalMoves && benchmark.optimalMoves > 0) return false;

        if (moves > 999 || deaths > 100 || score > 100000) return false;

        return true;
    },

    // Player registry — every "Jogar" creates a permanent record
    savePlayerRecord(playerId, playerName) {
        try {
            if (!playerId) return;
            const records = this.loadPlayerRecords();
            const name = validateString(playerName, 20, 'Anônimo');
            const existing = records[playerId];
            records[playerId] = {
                playerId,
                playerName: name,
                firstPlayed: existing?.firstPlayed || Date.now(),
                lastPlayed: Date.now(),
                isNew: !existing
            };
            secureSave(`${STORAGE_PREFIX}players`, records);
        } catch {}
    },

    loadPlayerRecords() {
        try {
            const data = secureLoad(`${STORAGE_PREFIX}players`);
            if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
            return data;
        } catch {
            return {};
        }
    },

    getAllPlayerEntries() {
        const records = this.loadPlayerRecords();
        return Object.values(records)
            .map(r => ({
                playerId: r.playerId || '',
                playerName: validateString(r.playerName, 20, 'Anônimo'),
                firstPlayed: r.firstPlayed || 0,
                lastPlayed: r.lastPlayed || 0
            }))
            .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    },

    clearAll() {
        try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
            keys.forEach(k => localStorage.removeItem(k));
        } catch {}
    }
};
