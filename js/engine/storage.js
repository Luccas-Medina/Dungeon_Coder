const STORAGE_PREFIX = 'agentica_';

const MOCK_RANKINGS = [
    { name: 'Kenji', level: 1, deaths: 0, movements: 8,  score: 1200,  date: 'Mock', perfect: true },
    { name: 'Kenji', level: 2, deaths: 0, movements: 10, score: 2600,  date: 'Mock', perfect: true },
    { name: 'Kenji', level: 3, deaths: 0, movements: 12, score: 4100,  date: 'Mock', perfect: true },
    { name: 'Kenji', level: 4, deaths: 0, movements: 14, score: 5700,  date: 'Mock', perfect: true },
    { name: 'Kenji', level: 5, deaths: 0, movements: 18, score: 10000, date: 'Mock', perfect: true },
    { name: 'Mori',  level: 1, deaths: 2, movements: 15, score: 800,   date: 'Mock' },
    { name: 'Mori',  level: 2, deaths: 3, movements: 22, score: 1800,  date: 'Mock' },
    { name: 'Mori',  level: 3, deaths: 5, movements: 30, score: 3000,  date: 'Mock' }
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

export const Storage = {
    saveProgress(data) {
        const payload = {
            level: data.level ?? 1,
            coins: data.coins ?? 0,
            keys: data.keys ?? 0,
            deaths: data.deaths ?? 0,
            score: data.score ?? 0,
            movements: data.movements ?? 0,
            playerName: data.playerName ?? '',
            lastSaved: Date.now()
        };
        localStorage.setItem(`${STORAGE_PREFIX}progress`, JSON.stringify(payload));
    },

    loadProgress() {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}progress`);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    saveWorkspace(blocks) {
        localStorage.setItem(`${STORAGE_PREFIX}workspace`, JSON.stringify(blocks));
    },

    loadWorkspace() {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}workspace`);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    saveRanking(ranking) {
        const userEntries = ranking.filter(e => e.date !== 'Mock');
        localStorage.setItem(`${STORAGE_PREFIX}ranking`, JSON.stringify(userEntries));
    },

    loadRanking() {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}ranking`);
        let userEntries = [];
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                userEntries = Array.isArray(parsed) ? parsed : [];
            } catch {
                userEntries = [];
            }
        }
        return [...MOCK_RANKINGS, ...userEntries];
    },

    addRankingEntry(entry) {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}ranking`);
        let userEntries = [];
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                userEntries = Array.isArray(parsed) ? parsed : [];
            } catch {
                userEntries = [];
            }
        }
        userEntries.push({
            ...entry,
            date: new Date().toLocaleDateString('pt-BR')
        });
        localStorage.setItem(`${STORAGE_PREFIX}ranking`, JSON.stringify(userEntries));
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

    // Stars system
    saveStars(level, data) {
        const all = this.loadStars();
        const prev = all[level];
        if (prev && prev.earned >= data.earned) {
            all[level] = { ...data, isRecord: false };
        } else {
            all[level] = { ...data, isRecord: true };
        }
        localStorage.setItem(`${STORAGE_PREFIX}stars`, JSON.stringify(all));
        return all[level];
    },

    loadStars() {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}stars`);
        if (!raw) return {};
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    },

    getLevelStars(level) {
        const all = this.loadStars();
        return all[level] || null;
    },

    // Benchmark (Kenji record calculation)
    calculateLevelBenchmark(levelData) {
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
        maxScore += 500; // level completion
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

    saveContinueState(data) {
        localStorage.setItem(`${STORAGE_PREFIX}continue`, JSON.stringify(data));
    },

    loadContinueState() {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}continue`);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    clearContinueState() {
        localStorage.removeItem(`${STORAGE_PREFIX}continue`);
    },

    clearAll() {
        localStorage.removeItem(`${STORAGE_PREFIX}progress`);
        localStorage.removeItem(`${STORAGE_PREFIX}workspace`);
        localStorage.removeItem(`${STORAGE_PREFIX}continue`);
        localStorage.removeItem(`${STORAGE_PREFIX}ranking`);
        localStorage.removeItem(`${STORAGE_PREFIX}stars`);
    }
};
