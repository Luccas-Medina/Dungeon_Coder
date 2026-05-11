# Contexto do Projeto - Block Engine MVP

## Data da Sessão
08/05/2026

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
- ✅ Rankings por fase (Score/Deaths/Movements) com seletor de nível
- ✅ Ranking global agregado (soma de todos os níveis por jogador)
- ✅ Mock data sempre visível (Kenji níveis 1-5, Mori níveis 1-3)
- ✅ Comparação percentual com Kenji (benchmark BFS)
- ✅ Campo para nome do jogador
- ✅ Bug da porta corrigido (doorUnlocked definido corretamente)
- ✅ Ranking salvo automaticamente a cada fase completada
- ✅ Contador de movimentos (apenas blocos de movimento, ignorando attack/repeat)

### Blocos Disponíveis
| Tipo | Label | Ícone | Categoria |
|------|-------|-------|-----------|
| moveUp | Mover Para Cima | ⬆️ | Ação (Azul) |
| moveDown | Mover Para Baixo | ⬇️ | Ação (Azul) |
| moveLeft | Mover Para Esquerda | ⬅️ | Ação (Azul) |
| moveRight | Mover Para Direita | ➡️ | Ação (Azul) |
| attack | Atacar | ⚔️ | Ação (Azul) |
| repeat | Repetir | 🔁 | Controle (Laranja) |

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
    ├── engine/
    │   ├── parser.js       # Converte DOM em array de comandos (recursivo)
    │   ├── runner.js       # Executor assíncrono de comandos (async/await)
    │   ├── storage.js      # localStorage (progresso, workspace, ranking, estrelas)
    │   └── levelGenerator.js # Geração procedural de fases (50 níveis)
    └── components/
        ├── dragDrop.js     # Lógica de Drag & Drop (paleta, workspace, repeat)
        ├── workspace.js    # Gerencia pilha de blocos (com aninhamento)
        ├── Stage.js        # Grid, ator, colisões e mecânicas de jogo
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

## Problemas Resolvidos Nesta Sessão (08/05/2026)

### 1. Ranking refatorado para tela dedicada
- **Arquivos**: `index.html`, `js/app.js`, `js/engine/storage.js`
- **Alteração**: Ranking removido da view do jogo; movido para tela dedicada com seletor de nível e modo Global

### 2. Mock data sempre visível
- **Arquivo**: `js/engine/storage.js`
- **Causa**: Mock só aparecia se ranking estivesse vazio, e entradas filtradas por nível escondiam Kenji/Mori
- **Solução**: `loadRanking()` sempre mescla `[...MOCK_RANKINGS, ...userEntries]`; `saveRanking()` filtra mock antes de persistir

### 3. Sistema de 3 Estrelas implementado
- **Arquivos**: `js/app.js` (handleVictory), `js/engine/storage.js` (saveStars/loadStars)
- **Implementação**: Estrelas calculadas na vitória, salvas no localStorage, exibidas no header com tooltip

### 4. Bug "userEntries is not iterable"
- **Arquivo**: `js/engine/storage.js`
- **Causa**: `JSON.parse()` retornava objeto não-array se localStorage tivesse dado corrompido
- **Solução**: Adicionado `Array.isArray(parsed)` check em `loadRanking()` e `addRankingEntry()`

### 5. Ranking global agregado
- **Arquivo**: `js/engine/storage.js`
- **Implementação**: `getAggregatedRankingsByScore/Deaths/Movements()` agrupam por nome, somam métricas

### 6. Comparação percentual com recorde
- **Arquivo**: `js/engine/storage.js` (calculateLevelBenchmark), `js/app.js` (renderRankingList)
- **Implementação**: BFS calcula caminho ótimo e score máximo teórico por fase

### 7. Estrelas com tooltip explicativo
- **Arquivo**: `index.html`, `js/app.js`, `styles/blocks.css`
- **Implementação**: Tooltip aparece no hover com condições de cada estrela e status (★ conquistado / ☆ pendente)

## Sessões Anteriores

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
- [ ] Adicionar blocos condicionais (Se/Se não)
- [ ] Bloco "Virar Esquerda/Direita" (mudar orientação)
- [ ] Bloco "Esperar" (wait por N ms)
- [ ] Inimigos que andam (patrulha 1 célula por turno)
- [ ] Power-ups (ímã, vida extra, velocidade)
- [ ] Speed slider funcional (já existe no HTML)

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
cd C:\Users\quint\Desktop\V3\block-engine-mvp

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
