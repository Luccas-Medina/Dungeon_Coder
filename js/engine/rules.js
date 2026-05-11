export const RULE_DEFS = {
    economic: {
        id: 'economic',
        name: 'Programação Econômica',
        icon: '📋',
        hover: 'Limite de blocos: máximo 10 blocos no workspace.',
        description: 'O jogador tem um limite estrito de blocos (máximo 10 blocos no workspace). Se ultrapassar, o "Run" é bloqueado. Força o uso de repetir e enquanto em vez de sequências longas de movimentos.',
        maxBlocks: 10
    },
    mirror: {
        id: 'mirror',
        name: 'Mundo Invertido',
        icon: '🔄',
        hover: 'Movimentos invertidos e condições trocadas.',
        description: 'Movimento: Cima vira Baixo, Esquerda vira Direita. Condições: SE (Inimigo) detecta quando não há inimigo, forçando a usar o bloco NEGAR. O grid tem um filtro visual invertido.',
    },
    glass_cannon: {
        id: 'glass_cannon',
        name: 'Vidro de Dragão',
        icon: '🐉',
        hover: 'Ataque dobrado, mas HP máximo é 1.',
        description: 'Ataque dobrado, mas o HP é fixado em 1. O bloco Defender e os sensores de detecção de inimigos tornam-se obrigatórios para não morrer no primeiro hit.',
    },
    vampire: {
        id: 'vampire',
        name: 'Maldição do Vampiro',
        icon: '🧛',
        hover: 'Perde 1 HP a cada 8 movimentos.',
        description: 'O jogador perde 1 HP a cada 8 movimentos. A única forma de recuperar é derrotando inimigos (recupera todo HP) ou coletando poções. Transforma o jogo em um puzzle de otimização de caminho.',
    },
    greed: {
        id: 'greed',
        name: 'Ganância do Rei',
        icon: '👑',
        hover: 'Porta só destranca se TODAS as moedas forem coletadas.',
        description: 'A porta só destranca se TODAS as moedas da fase forem coletadas. Nenhuma moeda pode ficar para trás.',
    },
    ice_floor: {
        id: 'ice_floor',
        name: 'Piso de Gelo',
        icon: '🧊',
        hover: 'Cada comando de Mover desliza o herói 2 casas. Para ao bater numa parede.',
        description: 'Cada comando de Mover (Cima/Baixo/Esquerda/Direita) faz o herói deslizar 2 células em vez de 1. Se bater numa parede ou borda, para imediatamente na célula anterior.',
    },
    pacifist: {
        id: 'pacifist',
        name: 'Pacifista de Ferro',
        icon: '🕊️',
        hover: 'Não pode usar Atacar. Inimigos não podem morrer.',
        description: 'A fase falha se usar o bloco Atacar ou se qualquer inimigo morrer. Use Defender para passar pelos inimigos sem revidar.',
    }
};

const RULE_IDS = Object.keys(RULE_DEFS);

export function pickRuleForLevel(levelIndex, sessionSeed) {
    if (levelIndex < 2) return null;
    const hash = levelIndex * 1337 + sessionSeed;
    const rng = ((hash * 1664525 + 1013904223) | 0) >>> 0;
    const chance = (rng % 100) / 100;
    if (chance < 0.5) return null;
    const ruleIndex = rng % RULE_IDS.length;
    return RULE_IDS[ruleIndex];
}

export function getRuleDef(ruleId) {
    return RULE_DEFS[ruleId] || null;
}
