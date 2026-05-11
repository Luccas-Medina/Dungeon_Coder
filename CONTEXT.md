# Contexto do Projeto - Block Engine MVP

## Data da Sessão
10/05/2026 (continuação)

## Visão Geral
MVP de um ambiente de programação visual (estilo Blockly simplificado) com mecânicas de jogo e gamificação. O jogador programa ações usando blocos de comandos para guiar um personagem através de fases/labirintos.

## Estado Atual do Projeto

### Funcionalidades Implementadas
- ✅ Sistema de Drag & Drop nativo (HTML5) entre Paleta e Workspace
- ✅ Interpretador (Parser) que converte blocos DOM em comandos lógicos
- ✅ Executor assíncrono (Runner) com async/await e delays
- ✅ Grid 10x10 com renderização de elementos (paredes, buracos, moedas, chaves, inimigos, boss)
- ✅ Geração procedural de 50 fases com dificuldade progressiva (levelGenerator.js)
- ✅ Coleta de itens (moedas e chaves)
- ✅ Sistema de portas que requerem chaves para destrancar
- ✅ Efeitos sonoros (Web Audio API)
- ✅ Persistência no localStorage (progresso, workspace, ranking, estrelas)
- ✅ Blocos aninhados (repeat com children, estilo Scratch)
- ✅ Sistema de Kill Switch (emergency stop no Runner)
- ✅ Menu principal com continuação de jogo
- ✅ Sistema de 3 Estrelas por fase (completa, 0 mortes, ≤20 movimentos)
- ✅ Tooltip de estrelas com feedback visual no header
- ✅ Badge "Novo Recorde!" ao bater recorde pessoal
- ✅ Rankings por fase (Score/Blocos/Movements) com seletor de nível
- ✅ Ranking global agregado (soma de todos os níveis por jogador)
- ✅ Mock data sempre visível (Kenji níveis 1-5, Mori níveis 1-3)
- ✅ Comparação percentual com Kenji (benchmark BFS)
- ✅ Campo para nome do jogador
- ✅ Bug da porta corrigido (doorUnlocked definido corretamente)
- ✅ Ranking salvo automaticamente a cada fase completada
- ✅ Contador de movimentos (apenas blocos de movimento, ignorando attack/repeat)
- ✅ Sistema de baús com 3 itens aleatórios (espada, escudo, poção)
- ✅ Atributos de RPG (HP, Ataque, Escudo, poções) com persistência entre fases
- ✅ Dashboard/HUD com barra de HP colorida (verde/amarelo/vermelho), ATK, escudo, botão de poção
- ✅ Sistema de modais assíncronos com Promise (pausa execução até fechar)
- ✅ Feedback visual: damage flash no HUD, heal glow no ator, animação pulsante no baú
- ✅ Tooltip explicativo de baú exibido uma única vez
- ✅ Blocos condicionais: Se, Enquanto, Então (else)
- ✅ Sistema de Expressões: E, OU, NEGAR, &lt;, &gt;
- ✅ Sensores: Sendo Atacado, Tem Escudo, Tem Poção, Espinhos em Pé, Inimigo, Vida Cheia, Vida Herói
- ✅ Validação de sintaxe com tooltip e mensagens de erro detalhadas
- ✅ Bloco Defender com consumo de escudo sob ataque
- ✅ Escudo inicial = 1 (sem defesa passiva)
- ✅ NEGAR aceita E, OU, &lt;, &gt; dentro dele
- ✅ &lt;/&gt; rejeita E, OU, NEGAR no slot esquerdo
- ✅ Limite de 4 níveis de aninhamento para expressões
- ✅ Placeholder visual (`?`) em expr-slots vazios
- ✅ Detecção do slot mais interno no Drag & Drop (bounding rect por área)
- ✅ Proteção contra sobrescrita de condição já preenchida
- ✅ Sistema de playerId (identificador único por jogador, independente do nome)
- ✅ Estrelas por jogador (cada jogador vê apenas suas próprias estrelas)
- ✅ Stats por nível no ranking (delta em vez de cumulativo)
- ✅ Backup criptografado com fallback para todas as 6 chaves do localStorage
- ✅ Anti-tampering com mirror em memória e verificação periódica (1.5s)
- ✅ Codificação base64 UTF-8 segura (TextEncoder/TextDecoder) em vez de btoa/atob
- ✅ Regra Piso de Gelo (cada movimento desliza 2 casas)
- ✅ Bug da Ganância do Rei: coleta de moedas pós-chave destranca porta
- ✅ Bug do Vidro de Dragão: HP restaurado ao valor pré-fase ao sair

### Blocos Disponíveis
| Tipo | Label | Ícone | Categoria |
|------|-------|-------|-----------|
| moveUp | Mover Para Cima | ⬆️ | Ação (Azul) |
| moveDown | Mover Para Baixo | ⬇️ | Ação (Azul) |
| moveLeft | Mover Para Esquerda | ⬅️ | Ação (Azul) |
| moveRight | Mover Para Direita | ➡️ | Ação (Azul) |
| attack | Atacar | ⚔️ | Ação (Azul) |
| usar_pocao | Usar Poção | 🧪 | Ação (Azul) |
| defender | Defender | 🛡️ | Ação (Azul) |
| repetir | Repetir | 🔁 | Controle (Laranja) |
| enquanto | Enquanto | 🔄 | Controle (Laranja) |
| se | Se | ❓ | Controle (Laranja) |
| entao | Então | ↩️ | Controle (Laranja) |
| AND | E | — | Expressão (Roxo) |
| OR | OU | — | Expressão (Roxo) |
| NOT | NEGAR | — | Expressão (Roxo) |
| lt | &lt; | — | Expressão (Roxo) |
| gt | &gt; | — | Expressão (Roxo) |
| sensor | (vários) | — | Sensor (Verde) |

## Estrutura de Arquivos

```
block-engine-mvp/
├── index.html              # Estrutura principal com Paleta, Workspace e Stage
├── server.js               # Servidor HTTP simples para testes (Node.js)
├── CONTEXT.md              # Este arquivo
├── styles/
│   ├── design-system.css   # Variáveis CSS (cores gamificadas, tipografia)
│   ├── blocks.css          # Estilos de blocos, workspace, ranking, estrelas, tooltip
│   ├── ui.css              # Menu, modal, botões
│   ├── stage.css           # Grid de execução e ator
│   └── animations.css      # Animações CSS
└── js/
    ├── app.js              # Inicialização e orquestração dos módulos
    ├── actors/
    │   └── player.js       # Atributos de RPG (HP, ATK, DEF, poções)
    ├── ui/
    │   ├── modals.js        # Gerenciador de modais assíncronos
    │   └── dashboard.js     # HUD com barra de HP e status
    ├── engine/
    │   ├── parser.js       # Converte DOM em array de comandos (recursivo)
    │   ├── runner.js       # Executor assíncrono de comandos (async/await)
    │   ├── storage.js      # localStorage (progresso, workspace, ranking, estrelas, atributos)
    │   └── levelGenerator.js # Geração procedural de fases (50 níveis)
    └── components/
        ├── dragDrop.js     # Lógica de Drag & Drop (paleta, workspace, repeat)
        ├── workspace.js    # Gerencia pilha de blocos (com aninhamento)
        ├── Stage.js        # Grid, ator, colisões, baús e mecânicas de jogo
        └── palette.js      # Paleta de blocos
```

## Decisões Arquiteturais

### Core Engine vs UI
- **Separação clara**: Lógica de jogo no `Stage.js`, interface no `workspace.js` e `dragDrop.js`
- **Zero frameworks**: Apenas Vanilla JS (ES6+)
- **Event Delegation**: Usado para gerenciar múltiplos blocos

### Sistema de Fases
- Geração procedural: 50 fases via `levelGenerator.js` com seed por sessão
- Dificuldade: `Math.min((level - 1) / 30, 1.5)` escala continuamente
- Boss a cada 5 fases (2×3 células, HP progressivo)
- Conectividade garantida via BFS (player → key → door)

### Rankings
- **3 tipos**: Pontuação (maior), Mortes (menor), Movimentos (menor)
- **Dois modos**: Global (agregado por jogador) e Por Fase (seletor « ‹ N › »)
- **Comparação %**: Benchmark calculado via BFS (caminho ótimo) para cada fase
- **Mock Data**: Kenji (níveis 1-5, perfeito) e Mori (níveis 1-3) sempre visíveis
- **Salvamento**: Automático ao completar qualquer fase
- **Exibição**: Tela dedicada acessada pelo botão "RANKINGS" no menu principal

### Sistema de Estrelas
- 3 estrelas por fase: completar (+1), 0 mortes (+1), ≤20 movimentos (+1)
- Exibidas no header da view do jogo
- Tooltip com condições ao passar o mouse
- Badge "Novo Recorde!" quando supera melhor resultado anterior

## Problemas Resolvidos Nesta Sessão (10/05/2026 — continuação)

### 1. Greed door bug (chave antes das moedas)
- **Arquivo**: `js/components/Stage.js`
- **Problema**: Regra "Ganância do Rei": porta só destranca se TODAS as moedas forem coletadas. Se o jogador pegava a chave primeiro (moedas insuficientes), a chave era consumida (`map = 'path'`) e não havia como destrancar a porta depois, mesmo coletando o resto.
- **Solução**: Adicionada flag `_keyCollected`. Ao coletar moedas com regra `greed`, se `_keyCollected` e `coinsCollected >= _totalCoins`, `unlockDoor()` é chamado.

### 2. Vidro de Dragão — HP não restaurado ao sair da fase
- **Arquivo**: `js/app.js`
- **Problema**: `saveProgress()` e `loadLevel()` usavam `Math.min(hp, _gcBaseMaxHp)` ao restaurar HP, o que mantinha HP = 1 (capado pela GC) em vez de restaurar o HP original (`_gcBaseHp`).
- **Solução**: 
  - `handleVictory()`: restaura `playerStats.hp = _gcBaseHp` antes de `saveProgress()`
  - `loadLevel()`: usa `this.playerStats.hp = this._gcBaseHp` em vez de `Math.min(hp, _gcBaseMaxHp)`
  - `saveProgress()` mantido original para persistir corretamente durante a fase GC

### 3. Nova Regra: Piso de Gelo
- **Arquivo**: `js/engine/rules.js`, `js/engine/runner.js`
- **Regra**: Cada comando Mover desliza o herói 2 células. Se bater numa parede/borda, para na célula anterior.
- **Implementação**: Em `runner.js`, após o primeiro `movePlayer()`, se `currentRule === 'ice_floor'` e `!didReachDoor()`, chama `movePlayer()` novamente no mesmo sentido.

### 4. Verificação de flechas de esqueleto pós-morte
- **Arquivo**: `js/components/Stage.js`
- **Análise**: `updateSkeletons()` já verifica `!skelly.alive` (linha 771) antes de criar novos projéteis. Esqueletos mortos não disparam. Flechas em voo persistem (comportamento esperado). Nenhuma correção necessária.

### 5. Rejeição de AND/OR/NOT em `<`/`>`
- **Arquivo**: `js/components/dragDrop.js`
- **Problema**: Blocos `E`, `OU` e `NEGAR` podiam ser arrastados para o slot esquerdo de `<`/`>`, mas a comparação numérica não aceita operadores lógicos.
- **Solução**: Adicionado `'AND', 'OR'` à lista de rejeição no `lt`/`gt` handler (linha 146). Também adicionada validação de sintaxe correspondente em `workspace.js`.

### 6. Condição não sobrescreve mais ao dropar sobre bloco existente
- **Arquivo**: `js/components/dragDrop.js`
- **Problema**: Arrastar um sensor (ex: `tem_escudo`) sobre um `NEGAR` dentro do slot de condição substituía o `NEGAR` pelo sensor, porque o drop caía no `condition-slot` (que faz `innerHTML = ''`).
- **Solução**: Adicionado `hasChild` guard no condition-slot handler — se já houver um bloco, o drop é rejeitado.

### 7. Drop no slot mais interno
- **Arquivo**: `js/components/dragDrop.js`
- **Problema**: `e.target.closest('.expr-slot')` encontrava o slot *mais externo* (ex: slot direito do `E`) em vez do slot *mais interno* (ex: slot do `NEGAR`), pois o `NEGAR` está dentro do `E`.
- **Solução**: 
  - Se `closest()` achar um slot não-vazio, ignora e usa fallback por bounding rect.
  - O fallback agora seleciona o slot de **menor área** (o mais profundamente aninhado), tanto no `drop` quanto no `dragover`.

### 8. Placeholder visual em expr-slots vazios
- **Arquivo**: `styles/blocks.css`
- **Problema**: Expr-slots vazios não tinham indicação visual de onde soltar blocos.
- **Solução**: Adicionado `.expr-slot:empty::after` com `content: '?'` translúcido.

### 9. Validação de sintaxe para AND/OR/NOT em `<`/`>`
- **Arquivo**: `js/components/workspace.js`
- **Implementação**: Adicionado check para `['AND', 'OR', 'NOT']` dentro do slot de `<`/`>` no `validateSyntax()`, com mensagem: `'Comparação (< >) não aceita E/OU/NEGAR'`.

### 10. Limite de aninhamento de expressões (4 níveis)
- **Arquivo**: `js/components/workspace.js`
- **Implementação**: Adicionado método `checkDepth(block, depth)` que percorre recursivamente blocos de expressão (AND/OR/NOT/lt/gt). Se `depth > 4`, retorna erro. Integrado em `validateSyntax()` para verificar o condition-slot de todo `Se`/`Enquanto`.

### 11. Light mode syntax-error CSS
- **Arquivo**: `styles/design-system.css`
- **Problema**: Em light mode, `.workspace.syntax-error` era sobrescrito por `html.light .workspace` (maior especificidade).
- **Solução**: Adicionado `html.light .workspace.syntax-error` com borda/bg vermelhos.

### 12. Help modal atualizado
- **Arquivo**: `index.html`
- **Alteração**: Seção de Expressões documenta que `<`/`>` não aceitam E/OU/NEGAR e o limite de 4 níveis. Seção de Erros adiciona as duas novas mensagens.

### Sessão 09/05/2026

#### 1. Persistência automática e auto-restore
- **Arquivo**: `js/app.js`
- **`autoRestoreIfNeeded()`**: Nova chamada no `init()`. Ao carregar a página, se existir progresso salvo no localStorage, navega automaticamente para a tela de jogo, restaura a fase correta, o workspace, música e UI. Não exibe o menu se o jogador já tinha uma sessão ativa.
- **`beforeunload`**: Novo handler que salva `saveProgress()` + `workspaceManager.saveToStorage()` ao fechar/atualizar a página, garantindo que nenhum dado seja perdido.

#### 2. Validação completa do sistema de estrelas (`agentica_stars`)
- **Arquivo**: `js/engine/storage.js`
- **`validateStarEntry()`**: Novo helper que valida `earned` (1-3), `deaths` (0-9999) e `movements` (0-9999) antes de usar. Retorna `null` se a estrutura for inválida.
- **`loadStars()` reescrito**: Agora valida cada entrada individualmente por nível, descarta níveis fora de 1-50, rejeita arrays e objetos malformados. Envolvido em try/catch.
- **`saveStars()` reescrito**: Valida entrada completa antes de salvar. `isRecord` só é `true` se `earned > prev.earned`. Try/catch geral com fallback seguro.
- **`getLevelStars()`**: Usa `validateStarEntry()` — retorna `null` sempre que o dado estiver ausente ou corrompido, sem quebrar a UI.

#### 3. Nova tabela de ranking de estrelas por usuário (`agentica_star_ranking`)
- **Arquivo**: `js/engine/storage.js` e `js/app.js`
- **Estrutura**: `{ "playerId": { name, levels: { "1": { earned, deaths, movements, score }, ... } } }`
- **`playerId`**: Identificador único gerado por `Date.now().toString(36) + '_' + random` no momento do Play. Persistido em `saveProgress()`, `saveContinueState()`, entradas de ranking e registros de estrelas.
- **`savePlayerStarRecord(playerId, playerName, level, data)`**: Só persiste se `earned > recorde anterior` do mesmo jogador na mesma fase. Valida playerId (fallback gera novo ID), nome (fallback `'Jogador Anônimo'`), nível (1-50), estrelas (1-3).
- **`loadPlayerStarRecord(playerId, level)`**: Consulta segura com validação de cada campo.
- **`loadStarRankingTable()`**: Recupera e valida a tabela completa. Ignora jogadores ou níveis com estrutura inválida.
- **`_migrateStarTable(data)`**: Migração automática do formato antigo (chaveado por nome) para o novo formato (chaveado por playerId). Gera IDs sintéticos `legacy_*` para dados antigos.
- **`getStarRankingForLevel(level)`**: Retorna todos os jogadores ordenados por estrelas (desc) e movimentos (asc).
- **Integração**: `handleVictory()` em `app.js` chama `Storage.savePlayerStarRecord(this.playerId, playerName, ...)` após o `saveStars` existente.

#### 4. Nome padrão 'Jogador Anônimo'
- **Arquivo**: `js/app.js`
- `loadProgress()` agora faz fallback para `'Jogador Anônimo'` se o nome salvo estiver vazio ou for `null`. O menu pré-preenche com esse nome automaticamente.

#### 5. Anti-tampering do localStorage
- **Arquivo**: `js/engine/storage.js`
- **`_saveMirror`**: Espelho em memória (`Map`) do último blob válido salvo para cada chave `agentica_*`.
- **`secureSave()`**: Agora armazena o blob tanto no localStorage quanto no mirror.
- **`secureLoad()` reescrita**: Em cada leitura:
  - Se a chave foi deletada → restaura do mirror + `console.error`
  - Se o blob está corrompido (assinatura inválida, JSON inválido, versão errada) → restaura do mirror + `console.error`
  - Se o dado é válido → atualiza o mirror com o blob lido
- **`startIntegrityCheck()`**: `setInterval` a cada 1.5s que varre todas as chaves do mirror e compara com o localStorage. Qualquer diferença (edição manual ou exclusão) é revertida automaticamente.
- **`clearContinueState()` e `clearAll()`**: Agora também limpam o mirror, evitando que dados intencionalmente removidos sejam "restaurados".
- **Mensagem no console**: `[Block Engine] ⛔ Modificação manual detectada no localStorage! A chave "X" foi alterada indevidamente...`

#### 6. Try/catch em toda E/S do localStorage
- **`secureSave()`**: Envolvida em try/catch silencioso.
- **`clearContinueState()` / `clearAll()`**: try/catch no `removeItem`.
- Todas as falhas de `JSON.stringify`, `btoa`, `localStorage.setItem`, `localStorage.removeItem` são silenciosamente engolidas sem travar a aplicação.

### Sessão 10/05/2026

#### 1. Sistema de playerId (identificador único por jogador)
- **Arquivo**: `js/app.js`, `js/engine/storage.js`
- **`playerId`**: Gerado em `app.js` via `Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)` ao clicar em Play.
- **Propósito**: Referencia usuários de forma única, independente do nome (que pode mudar). Evita conflitos entre jogadores com mesmo nome.
- **Persistência**: Salvo em `saveProgress()` e `saveContinueState()`, restaurado em `loadProgress()` e `resumeFromContinue()`.
- **Uso em rankings**: Cada entrada de ranking (`agentica_ranking`) inclui `playerId`.
- **Uso em estrelas**: `savePlayerStarRecord()` e `loadPlayerStarRecord()` usam `playerId` como chave na tabela `agentica_star_ranking`.
- **Migração**: `_migrateStarTable()` converte automaticamente o formato antigo (chaveado por nome) para o novo (chaveado por playerId), gerando IDs `legacy_*` para dados pré-existentes.

#### 2. Estrelas por jogador (per-player star display)
- **Arquivo**: `js/app.js`
- **`updateStarsUI()`**: Agora usa `Storage.loadPlayerStarRecord(this.playerId, level)` em vez de `Storage.getLevelStars()` (global). Cada jogador vê apenas SUAS estrelas.
- **`updateStarTooltip()`**: Mesma mudança — tooltip de estrelas por jogador.
- **`autoRestoreIfNeeded()`**: Popula `#playerName.value` com o nome salvo para carregar estrelas corretamente no auto-restore.
- **`resumeFromContinue()`**: Lê nome do input do menu e define `#playerName.value` corretamente.

#### 3. Stats por nível no ranking (per-level ranking stats)
- **Arquivo**: `js/app.js`
- **`_levelStartStats`**: Novo campo no constructor que captura snapshot dos stats cumulativos (`score`, `deaths`, `movements`) no início de cada fase via `loadLevel()`.
- **`handleVictory()`**: Ranking entries agora usam delta por nível (`this.stats - _levelStartStats`) em vez de stats cumulativos. Permite que `validateRankingEntry()` aceite entradas de todas as fases.
- **Estrelas**: Cálculo de estrelas (`levelDeaths`, `levelMovements`) também usa stats por nível, não cumulativos.

#### 4. Backup criptografado para todas as chaves do localStorage
- **Arquivo**: `js/engine/storage.js`
- **`b64Encode()` / `b64Decode()`**: Novas funções que usam `TextEncoder`/`TextDecoder` para codificação base64 segura para UTF-8 (substitui `btoa`/`atob` que falham em caracteres não-Latin1 como acentos portugueses).
- **`secureSave()` e `secureLoad()`**: Agora usam `b64Encode`/`b64Decode` — aceitam qualquer caractere Unicode sem lançar erro.
- **`restoreFromMirror()`**: Também atualizado para usar `b64Decode`.
- **`backupSave(key, data)`**: Usa `secureSave(key + '_backup', data)` — backup é blob assinado/criptografado, não JSON puro.
- **`backupLoad(key)`**: Lê o dado bruto ANTES de chamar `secureLoad`, porque `secureLoad` → `restoreFromMirror` pode deletar a chave via `localStorage.removeItem()` se o mirror não a tiver e o dado for inválido. Inclui compatibilidade retroativa: lê JSON puro antigo e re-salva como blob assinado.
- **`backupDelete(key)`**: Também limpa `_saveMirror` da chave de backup.

Todas as 6 chaves `agentica_*` têm backup criptografado com fallback:

| Chave principal | backupSave em | load com fallback |
|---|---|---|
| `agentica_progress` | `saveProgress()` | `loadProgress()` → `backupLoad` |
| `agentica_workspace` | `saveWorkspace()` | `loadWorkspace()` → `backupLoad` |
| `agentica_ranking` | `saveRanking()` + `addRankingEntry()` | `loadRanking()` + `addRankingEntry()` → `backupLoad` |
| `agentica_stars` | `saveStars()` | `loadStars()` → `backupLoad` |
| `agentica_continue` | `saveContinueState()` | `loadContinueState()` → `backupLoad` |
| `agentica_star_ranking` | `savePlayerStarRecord()` | `loadStarRankingTable()` → `backupLoad` |

- **`clearContinueState()`**: Também chama `backupDelete`.
- **`clearAll()`**: Já chamava `backupDelete(k)` para cada chave.

## Sessões Anteriores

### Sessão 09/05/2026
- Sistema de baús com itens aleatórios (espada/armadura/poção)
- Atributos de RPG (PlayerStats: HP, ATK, DEF, poções)
- Mecânica de dano com absorção de armadura
- Dashboard/HUD com barra de HP
- Sistema de modais assíncronos
- Feedback visual (heal glow, damage flash, chest float)
- Categoria "Blocos" no ranking (substitui "Mortes")

### Sessão 08/05/2026
- Ranking refatorado para tela dedicada
- Mock data sempre visível (Kenji/Mori)
- Sistema de 3 Estrelas
- Bug "userEntries is not iterable"
- Ranking global agregado
- Comparação percentual com BFS benchmark
- Tooltip de estrelas

### Sessão 07/05/2026
- Blocos aninhados (repeat com children)
- Drag & Drop para dentro de repeat
- Parser recursivo para comandos aninhados
- Kill Switch (emergency stop)
- Paleta simplificada (repeat em linha única)
- CSS refinado (estrutura C-bracket)

### Sessão 06/05/2026
- Labels traduzidos ("Mover Frente" → "Mover Para Cima")
- Bug da porta corrigido
- Ranking salvo automaticamente
- Campo de nome do jogador
- Contador de movimentos

## Próximos Passos Sugeridos

### Melhorias no Jogo
- [ ] Bloco "Virar Esquerda/Direita" (mudar orientação)
- [ ] Bloco "Esperar" (wait por N ms)
- [ ] Inimigos que andam (patrulha 1 célula por turno)
- [ ] Power-ups (ímã, vida extra, velocidade)
- [ ] Speed slider funcional (já existe no HTML)

### Melhorias de RPG
- [ ] Sistema de níveis/experiência para o personagem (XP por coleta de moedas e vitória em fases)
- [ ] Tipos raros de baú (raro: drop garantido, épico: 2 itens simultâneos)
- [ ] Loja entre fases para gastar moedas em upgrades de atributos
- [ ] Inimigos com atributos variados (HP próprio, dano, defesa)
- [ ] Poções especiais (poção grande cura +3, poção de defesa temporária)
- [ ] Sistema de equipment slots (espada, armadura, acessório)

### Melhorias Técnicas
- [ ] Deploy (Vercel/Netlify/GitHub Pages)
- [ ] Implementar backend real para ranking global (Firebase/JSONBin.io)
- [ ] Adicionar testes automatizados
- [ ] Undo/Redo (Ctrl+Z) no workspace

### Melhorias de UX
- [ ] Tutorial interativo para primeiro uso
- [ ] Atalhos de teclado (Enter = Executar, Del = Remover)
- [ ] Editor de fases customizadas
- [ ] Conquistas/achievements

## Como Retomar Esta Sessão

### Comandos para Nova Sessão
```bash
# Navegar para o projeto
cd C:\Users\quint\Desktop\V5\block-engine-mvp

# Iniciar servidor de teste
node server.js

# Abrir http://localhost:8080
```

### No OpenCode
1. Digite `@CONTEXT.md` para carregar este contexto
2. Digite `@AGENTS.md` para ver diretrizes do projeto
3. Digite `@js/app.js` para ver o arquivo principal

## Equipe
- Augusto Wiliton Toso Zinato
- Gian Luccas Pires Medina
- Leonardo Rodrigues da Silva Santos
- Lucas Quintino Alves Cavalcante

## Observações Técnicas
- **Servidor**: Use `node server.js` para testar (porta 8080)
- **CORS**: Arquivos devem ser servidos via HTTP, não abrir direto no browser
- **localStorage**: Dados persistem no navegador, limpar cache apaga progresso
- **Mock Rankings**: Kenji e Mori sempre aparecem, independente de dados do usuário
- **Benchmark**: Cálculo BFS do caminho ótimo start → key → door para métrica de movimentos
