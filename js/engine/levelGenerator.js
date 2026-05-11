const SIZE = 10;
const MAX_ATTEMPTS = 100;

export function generateLevel(levelNumber, sessionSeed = 42) {
    const seed = levelNumber * 1337 + sessionSeed;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const result = tryGenerate(levelNumber, seed + attempt);
        if (result) return result;
    }
    return generateFallback(levelNumber);
}

function rng(seed) {
    let s = seed | 0;
    return function () {
        s = (s * 1664525 + 1013904223) | 0;
        return (s >>> 0) / 4294967296;
    };
}

function randInt(rngFn, min, max) {
    return min + Math.floor(rngFn() * (max - min + 1));
}

function pick(rngFn, arr) {
    return arr[Math.floor(rngFn() * arr.length)];
}

const DIRECTIONS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
];

function tryGenerate(levelNumber, seed) {
    const r = rng(seed);
    const difficulty = Math.min((levelNumber - 1) / 30, 1.5);
    const isBossLevel = levelNumber % 5 === 0;

    const map = Array.from({ length: SIZE }, () => Array(SIZE).fill('path'));

    for (let i = 0; i < SIZE; i++) {
        map[0][i] = 'wall';
        map[SIZE - 1][i] = 'wall';
        map[i][0] = 'wall';
        map[i][SIZE - 1] = 'wall';
    }

    const wallClusters = 2 + Math.floor(difficulty * 8);
    for (let i = 0; i < wallClusters; i++) {
        const cx = randInt(r, 2, SIZE - 3);
        const cy = randInt(r, 2, SIZE - 3);
        const clusterSize = randInt(r, 1, 3);
        for (let j = 0; j < clusterSize; j++) {
            const wx = Math.min(Math.max(cx + randInt(r, -1, 1), 1), SIZE - 2);
            const wy = Math.min(Math.max(cy + randInt(r, -1, 1), 1), SIZE - 2);
            if (map[wy][wx] === 'path' && !(wx === 1 && wy === 1)) {
                map[wy][wx] = 'wall';
            }
        }
    }

    const player = { x: 1, y: 1 };

    const holeCount = Math.floor(1 + difficulty * 4);
    let placedHoles = 0;
    for (let i = 0; i < holeCount * 10 && placedHoles < holeCount; i++) {
        const hx = randInt(r, 2, SIZE - 3);
        const hy = randInt(r, 2, SIZE - 3);
        if (map[hy][hx] === 'path' && !(hx === 1 && hy === 1)) {
            map[hy][hx] = 'hole';
            placedHoles++;
        }
    }

    map[player.y][player.x] = 'start';

    const walkable = (x, y) => {
        if (y < 0 || y >= SIZE || x < 0 || x >= SIZE) return false;
        const t = map[y][x];
        return t !== 'wall' && t !== 'hole';
    };

    const distances = bfsDistances(map, player.x, player.y, walkable);
    let farthest = null;
    let maxDist = 0;
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (map[y][x] === 'path' && distances[y][x] > maxDist) {
                maxDist = distances[y][x];
                farthest = { x, y };
            }
        }
    }
    if (!farthest || maxDist < 5) return null;
    map[farthest.y][farthest.x] = 'door';

    const keyDist = Math.floor(maxDist * (0.3 + r() * 0.25));
    const keyCandidates = [];
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (map[y][x] === 'path' && distances[y][x] >= keyDist - 1 && distances[y][x] <= keyDist + 1) {
                keyCandidates.push({ x, y });
            }
        }
    }
    if (keyCandidates.length === 0) return null;
    const keyPos = keyCandidates[Math.floor(r() * keyCandidates.length)];
    map[keyPos.y][keyPos.x] = 'key';

    const coinCount = 2 + Math.floor(r() * 3) + Math.floor(difficulty * 4);
    let placedCoins = 0;
    for (let i = 0; i < coinCount * 20 && placedCoins < coinCount; i++) {
        const cx = randInt(r, 2, SIZE - 3);
        const cy = randInt(r, 2, SIZE - 3);
        if (map[cy][cx] === 'path' && distances[cy][cx] > 0) {
            map[cy][cx] = 'coin';
            placedCoins++;
        }
    }

    const enemies = [];
    if (!isBossLevel && levelNumber >= 2) {
        const enemyCount = Math.min(5, 1 + Math.floor(levelNumber / 4));

        const availableCells = [];
        for (let y = 2; y < SIZE - 2; y++) {
            for (let x = 2; x < SIZE - 2; x++) {
                if (map[y][x] === 'path' && distances[y][x] > 2 && !(x === keyPos.x && y === keyPos.y)) {
                    availableCells.push({ x, y });
                }
            }
        }

        const trollMinDist = 3;
        const trollCells = availableCells.filter(c => {
            const d = Math.abs(c.x - keyPos.x) + Math.abs(c.y - keyPos.y);
            return d <= trollMinDist && d > 0;
        });
        const batCells = availableCells.filter(c => {
            const d = Math.abs(c.x - keyPos.x) + Math.abs(c.y - keyPos.y);
            return d > 1;
        });
        const skellyCells = availableCells.filter(c => {
            const d = Math.abs(c.x - keyPos.x) + Math.abs(c.y - keyPos.y);
            return d > 2;
        });

        const shuffledBats = [...batCells].sort(() => r() - 0.5);
        const shuffledSkellies = [...skellyCells].sort(() => r() - 0.5);
        const shuffledTrolls = [...trollCells].sort(() => r() - 0.5);

        const minBats = 1;
        const minSkellies = (levelNumber >= 3) ? 1 : 0;
        const minTrolls = (levelNumber >= 4 && trollCells.length > 0) ? 1 : 0;

        let targetBats = Math.max(minBats, Math.floor(enemyCount * 0.5));
        let targetSkellies = levelNumber >= 3 ? Math.max(minSkellies, Math.floor(enemyCount * 0.3)) : 0;
        let targetTrolls = (levelNumber >= 4 && trollCells.length > 0) ? Math.max(minTrolls, Math.floor(enemyCount * 0.2)) : 0;

        const totalTarget = targetBats + targetSkellies + targetTrolls;
        if (totalTarget > enemyCount) {
            let excess = totalTarget - enemyCount;
            while (excess > 0 && targetTrolls > minTrolls) { targetTrolls--; excess--; }
            while (excess > 0 && targetSkellies > minSkellies) { targetSkellies--; excess--; }
            while (excess > 0 && targetBats > minBats) { targetBats--; excess--; }
        }

        targetBats = Math.min(targetBats, enemyCount);
        targetSkellies = Math.min(targetSkellies, Math.max(0, enemyCount - targetBats));
        targetTrolls = Math.min(targetTrolls, Math.max(0, enemyCount - targetBats - targetSkellies));

        let batsPlaced = 0, skelliesPlaced = 0, trollsPlaced = 0;

        for (let i = 0; i < shuffledBats.length && batsPlaced < targetBats; i++) {
            const c = shuffledBats[i];
            enemies.push({ x: c.x, y: c.y, type: 'bat' });
            batsPlaced++;
        }

        for (let i = 0; i < shuffledSkellies.length && skelliesPlaced < targetSkellies; i++) {
            const c = shuffledSkellies[i];
            enemies.push({ x: c.x, y: c.y, type: 'skeleton' });
            skelliesPlaced++;
        }

        for (let i = 0; i < shuffledTrolls.length && trollsPlaced < targetTrolls; i++) {
            const c = shuffledTrolls[i];
            enemies.push({ x: c.x, y: c.y, type: 'troll' });
            trollsPlaced++;
        }
    }

    let boss = null;
    if (isBossLevel) {
        const bossHp = 2 + Math.floor((levelNumber - 1) / 5);
        const areas = [];
        for (let y = 2; y < SIZE - 3; y++) {
            for (let x = 2; x < SIZE - 3; x++) {
                let ok = true;
                for (let dy = 0; dy < 2 && ok; dy++) {
                    for (let dx = 0; dx < 2 && ok; dx++) {
                        if (map[y + dy][x + dx] !== 'path') ok = false;
                    }
                }
                if (ok) areas.push({ x, y });
            }
        }
        if (areas.length === 0) return null;
        const area = pick(r, areas);
        for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
                map[area.y + dy][area.x + dx] = 'boss';
            }
        }
        const bossType = r() < 0.5 ? 'octopus' : 'devil';
        boss = { x: area.x, y: area.y, bossType, type: bossType, hp: bossHp, maxHp: bossHp };
    }

    const spikes = [];
    if (levelNumber >= 3) {
        const spikeCount = Math.min(8, 1 + Math.floor(levelNumber / 5));
        const spikeCandidates = [];
        for (let y = 1; y < SIZE - 1; y++) {
            for (let x = 1; x < SIZE - 1; x++) {
                if (map[y][x] !== 'path' || distances[y][x] <= 1) continue;
                let occupied = enemies.some(e => e.x === x && e.y === y);
                if (boss) {
                    for (let dy = 0; dy < 2 && !occupied; dy++) {
                        for (let dx = 0; dx < 2 && !occupied; dx++) {
                            if (boss.x + dx === x && boss.y + dy === y) occupied = true;
                        }
                    }
                }
                if (!occupied) spikeCandidates.push({ x, y });
            }
        }
        for (let i = 0; i < spikeCount && spikeCandidates.length > 0; i++) {
            const idx = Math.floor(r() * spikeCandidates.length);
            const cell = spikeCandidates.splice(idx, 1)[0];
            map[cell.y][cell.x] = 'spike';
            spikes.push({ x: cell.x, y: cell.y });
        }
    }

    if (!checkConnectivity(map, player.x, player.y, keyPos.x, keyPos.y, farthest.x, farthest.y, boss, enemies)) {
        return null;
    }

    return {
        name: `Fase ${levelNumber}`,
        map,
        player,
        enemies,
        boss,
        spikes
    };
}

function bfsDistances(map, startX, startY, walkableFn) {
    const dist = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
    const q = [{ x: startX, y: startY }];
    dist[startY][startX] = 0;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (q.length > 0) {
        const { x, y } = q.shift();
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && dist[ny][nx] === -1 && walkableFn(nx, ny)) {
                dist[ny][nx] = dist[y][x] + 1;
                q.push({ x: nx, y: ny });
            }
        }
    }
    return dist;
}

function bfsReachable(map, startX, startY, walkableFn) {
    const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const q = [{ x: startX, y: startY }];
    visited[startY][startX] = true;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (q.length > 0) {
        const { x, y } = q.shift();
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && !visited[ny][nx] && walkableFn(nx, ny)) {
                visited[ny][nx] = true;
                q.push({ x: nx, y: ny });
            }
        }
    }
    return visited;
}

function checkConnectivity(map, px, py, kx, ky, dx, dy, boss, enemies) {
    const safeWalkable = (x, y) => {
        if (y < 0 || y >= SIZE || x < 0 || x >= SIZE) return false;
        const t = map[y][x];
        return t !== 'wall' && t !== 'hole';
    };

    const fromPlayer = bfsReachable(map, px, py, safeWalkable);
    if (!fromPlayer[ky][kx]) return false;

    const fromKey = bfsReachable(map, kx, ky, safeWalkable);
    if (!fromKey[dy][dx]) return false;

    if (boss) {
        if (!fromPlayer[boss.y][boss.x]) return false;
        if (!fromPlayer[boss.y][boss.x + 1]) return false;
    }

    if (enemies) {
        for (const e of enemies) {
            if (!fromPlayer[e.y][e.x]) return false;
        }
    }

    return true;
}

function generateFallback(levelNumber) {
    const map = Array.from({ length: SIZE }, () => Array(SIZE).fill('path'));
    for (let i = 0; i < SIZE; i++) {
        map[0][i] = 'wall';
        map[SIZE - 1][i] = 'wall';
        map[i][0] = 'wall';
        map[i][SIZE - 1] = 'wall';
    }
    map[1][1] = 'start';
    map[1][2] = 'coin';
    map[1][3] = 'coin';
    map[1][4] = 'key';
    map[1][7] = 'door';

    const enemies = [];
    if (levelNumber >= 2) {
        enemies.push({ x: 3, y: 3, type: 'bat' });
        if (levelNumber >= 3) enemies.push({ x: 5, y: 5, type: 'skeleton' });
        if (levelNumber >= 4) enemies.push({ x: 2, y: 5, type: 'troll' });
    }

    const spikes = [];
    if (levelNumber >= 3) {
        const spikePositions = [{x:4,y:3}, {x:6,y:5}];
        for (const sp of spikePositions) {
            if (map[sp.y] && map[sp.y][sp.x] === 'path') {
                map[sp.y][sp.x] = 'spike';
                spikes.push({ x: sp.x, y: sp.y });
            }
        }
    }

    return {
        name: `Fase ${levelNumber}`,
        map,
        player: { x: 1, y: 1 },
        enemies,
        boss: null,
        spikes
    };
}
