const DIRS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
];

export class EnemyBase {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.type = config.type;
        this.hp = config.hp ?? 1;
        this.maxHp = config.maxHp ?? 1;
        this.alive = true;
        this.defeated = false;
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) {
            this.alive = false;
            this.defeated = true;
        }
        return this.hp;
    }
}

export class Bat extends EnemyBase {
    constructor(config, level) {
        super({ ...config, type: 'bat', hp: 1, maxHp: 1 });
        const vertical = Math.random() < 0.5;
        this.axis = vertical ? 'vertical' : 'horizontal';
        this.dir = vertical ? { dx: 0, dy: 1 } : { dx: 1, dy: 0 };
        this.moveRange = 1 + Math.floor((level - 1) / 4);
        this.stepsInDir = 0;
        this.moveTimer = 0;
        this.moveInterval = 1500;
    }

    reverseDir() {
        this.dir = { dx: -this.dir.dx, dy: -this.dir.dy };
        this.stepsInDir = 0;
    }

    tryMove(map, gridSize, enemies) {
        const nx = this.x + this.dir.dx;
        const ny = this.y + this.dir.dy;
        if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) { this.reverseDir(); return null; }
        const cell = map[ny][nx];
        if (cell === 'wall') { this.reverseDir(); return null; }
        for (const e of enemies) {
            if (e !== this && e.alive && e.x === nx && e.y === ny) { this.reverseDir(); return null; }
        }
        this.x = nx;
        this.y = ny;
        this.stepsInDir++;
        if (this.stepsInDir >= this.moveRange) this.reverseDir();
        return { x: nx, y: ny };
    }
}

export class Skeleton extends EnemyBase {
    constructor(config, level) {
        const hp = Math.min(6, 1 + Math.floor((level - 2) / 3));
        super({ ...config, type: 'skeleton', hp, maxHp: hp });
        this.shootDir = DIRS[Math.floor(Math.random() * 4)];
        this.shootTimer = 0;
        this.shootInterval = 5000;
    }
}

export class StoneTroll extends EnemyBase {
    constructor(config, level) {
        super({ ...config, type: 'troll', hp: 3, maxHp: 3 });
        this.attackDmg = 1 + Math.floor((level - 1) / 5);
        this.attackTimer = 0;
        this.attackInterval = 5000;
        this.warningCell = null;
        this.warningTimer = 0;
        this.warningDuration = 1000;
    }

    pickTargetCell(gridSize, map) {
        const candidates = [];
        for (const d of DIRS) {
            const nx = this.x + d.dx;
            const ny = this.y + d.dy;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && map[ny][nx] !== 'wall') {
                candidates.push({ x: nx, y: ny });
            }
        }
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
}

export class Projectile {
    constructor(x, y, dir, type = 'arrow') {
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.type = type;
        this.active = true;
    }

    move(map, gridSize) {
        if (!this.active) return null;
        const nx = this.x + this.dir.dx;
        const ny = this.y + this.dir.dy;
        if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) { this.active = false; return null; }
        if (map[ny][nx] === 'wall') { this.active = false; return null; }
        this.x = nx;
        this.y = ny;
        return { x: nx, y: ny };
    }
}

export class BossEnemy {
    constructor(config, level) {
        this.x = config.x;
        this.y = config.y;
        this.type = config.type || config.bossType || 'octopus';
        this.hp = config.hp ?? (2 + Math.floor((level - 1) / 5));
        this.maxHp = this.hp;
        this.alive = true;
        this.defeated = false;
        this.size = 2;
        this.attackTimer = 0;
        this.attackInterval = 5000;
        this.warningCell = null;
        this.warningTimer = 0;
        this.warningDuration = 1000;
        this.attackDmg = 1 + Math.floor((level - 1) / 5);
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) {
            this.alive = false;
            this.defeated = true;
        }
        return this.hp;
    }

    pickTargetCell(gridSize, map) {
        const candidates = [];
        for (let dy = 0; dy < this.size; dy++) {
            for (let dx = 0; dx < this.size; dx++) {
                for (const d of DIRS) {
                    const nx = this.x + dx + d.dx;
                    const ny = this.y + dy + d.dy;
                    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && map[ny][nx] !== 'wall') {
                        const inside = nx >= this.x && nx < this.x + this.size && ny >= this.y && ny < this.y + this.size;
                        if (!inside) {
                            candidates.push({ x: nx, y: ny });
                        }
                    }
                }
            }
        }
        if (candidates.length === 0) return null;
        const unique = [];
        const seen = new Set();
        for (const c of candidates) {
            const key = `${c.x},${c.y}`;
            if (!seen.has(key)) { seen.add(key); unique.push(c); }
        }
        return unique[Math.floor(Math.random() * unique.length)];
    }

    fireDirection() {
        return DIRS[Math.floor(Math.random() * 4)];
    }
}
