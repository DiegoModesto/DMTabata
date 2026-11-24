# DMTabata — Plano Técnico

> Versão 0.2 · 24/11/2026 — adicionados fluxo de telas, login mock, ciclos com tempos por exercício, sons por fase e estatísticas por treino
> Status: rascunho para validação

---

## 1. Visão geral

Aplicativo mobile de treinos intervalados (Tabata, HIIT, EMOM, AMRAP e personalizados) onde o usuário:

- entra no app por uma **tela de login** (mock na v1);
- cadastra **treinos** compostos por **ciclos**, e cada ciclo por **exercícios** com tempo de trabalho e de descanso próprios;
- vê o **tempo total** e o **tempo de cada ciclo** antes de começar;
- executa o treino com um **temporizador preciso**, com **sons configuráveis** no início do trabalho e do descanso;
- acompanha **estatísticas por treino** (tempo feito, conclusão, feedback).

### Objetivos
| # | Objetivo | Critério de sucesso |
|---|----------|---------------------|
| 1 | Temporizador confiável | Desvio < 100 ms ao fim de um treino de 30 min, mesmo com tela bloqueada |
| 2 | Criação rápida de treinos | Criar um Tabata clássico em < 15 s (via template) |
| 3 | Alertas que funcionam com música tocando | Áudio do app "abaixa" (ducking) a música e não a interrompe |
| 4 | Funciona offline | 100% das funções principais sem internet |

### Fora do escopo (v1)
- Autenticação real / sincronização na nuvem (o login é apenas visual — ver seção 7.2)
- Social, ranking, compartilhamento público
- Integração com wearables (fica para v2)

---

## 2. Stack recomendada

| Camada | Escolha | Motivo |
|--------|---------|--------|
| Framework | **React Native + Expo (SDK atual, managed + dev client)** | Um código para iOS e Android; ecossistema maduro de áudio, notificações e haptics |
| Linguagem | **TypeScript (strict)** | Segurança no modelo de dados e no motor do timer |
| Navegação | **Expo Router** | Rotas baseadas em arquivos, deep links prontos |
| Estado | **Zustand** (UI/sessão) + **máquina de estados pura em TS** (motor do timer) | Timer é naturalmente uma máquina de estados; implementada como reducer puro, sem dependência, 100% testável |
| Persistência | **expo-sqlite + SQL puro com migrações versionadas** (`PRAGMA user_version`) | Dados relacionais; repositórios testados contra SQLite real (better-sqlite3) sem ORM. *Decisão da Fase 0: Drizzle descartado para reduzir dependências.* |
| Áudio | **expo-audio** | Bipes curtos, controle de audio session (ducking/mix) |
| Voz | **expo-speech** (TTS) | Anúncios "Descanso", "Próximo: Burpee", "3, 2, 1" |
| Vibração | **expo-haptics** | Feedback tátil nas transições |
| Notificações | **expo-notifications** | Alertas agendados quando o app está em background |
| Tela ligada | **expo-keep-awake** | Evita a tela apagar durante o treino |
| Formulários | Estado local + validação de domínio pura (`domain/validation.ts`) | Regras de validação testáveis sem UI |
| Testes | **Jest + React Native Testing Library + Maestro (E2E)** | |
| CI/CD | **EAS Build + EAS Submit + GitHub Actions** | |

> **Alternativa:** se o alvo for só iOS e houver interesse em Apple Watch/Live Activities desde o início, Swift + SwiftUI é a melhor escolha. Recomendo começar com Expo e adicionar módulos nativos depois, se necessário.

---

## 3. Arquitetura

```
┌───────────────────────────────────────────────────────────┐
│                         UI (Expo Router)                  │
│  Treinos · Editor · Player · Histórico · Configurações    │
└──────────────┬───────────────────────────────┬────────────┘
               │                               │
       ┌───────▼────────┐              ┌───────▼────────┐
       │  Stores        │              │  Timer Engine  │  ← XState (puro, testável)
       │  (Zustand)     │              │  + Scheduler   │
       └───────┬────────┘              └───────┬────────┘
               │                               │ eventos de fase
       ┌───────▼────────┐              ┌───────▼────────┐
       │  Repositórios  │              │  Alert Service │  → áudio / voz / haptics / notificação
       │  (Drizzle)     │              └────────────────┘
       └───────┬────────┘
       ┌───────▼────────┐
       │  SQLite local  │
       └────────────────┘
```

### Estrutura de pastas
```
src/
  app/                  # rotas (Expo Router)
    (auth)/login.tsx    # login mock
    (tabs)/workouts/    # lista de treinos
    (tabs)/stats/       # estatísticas gerais
    (tabs)/settings/
    workout/new.tsx
    workout/[id]/index.tsx   # detalhe / pré-treino
    workout/[id]/edit.tsx
    workout/[id]/sounds.tsx
    workout/[id]/stats.tsx
    player/[id].tsx
    session/[id]/feedback.tsx
  domain/               # tipos e regras puras (sem React)
    models.ts
    timeline.ts         # "compila" um treino em uma lista linear de fases
    validation.ts
  engine/               # motor do timer
    timerMachine.ts
    clock.ts
  services/
    alerts/             # audio, speech, haptics, notifications
    db/                 # schema, migrations, repositórios
  stores/
  components/
  assets/sounds/
```

**Regra principal:** `domain/` e `engine/` não importam nada de React nem de Expo. Isso garante testes unitários rápidos e determinísticos.

---

## 4. Modelo de dados

### 4.1 Conceitos

- **Treino** — o que o usuário salva e executa. Contém um ou mais **ciclos**.
- **Ciclo** — sequência de exercícios. Tem **tempo padrão de trabalho** e **tempo padrão de descanso**, número de **repetições** do ciclo (padrão 1) e descanso entre ciclos.
- **Item do ciclo (exercício)** — cada posição do ciclo. Herda os tempos padrão do ciclo, mas **pode sobrescrever** o tempo de trabalho e/ou de descanso individualmente.
- **Som** — arquivo de áudio (embutido no app ou importado pelo usuário) usado nos alertas.
- **Sessão** — uma execução de um treino, com o log de cada fase e o feedback do usuário (base das estatísticas).
- **Tipo de treino (template)** — preset que gera ciclos prontos: Tabata, HIIT, EMOM, AMRAP, Circuito, Personalizado.

**Exemplo do requisito:** ciclo de 5 exercícios, padrão 30s trabalho / 10s descanso, com o 3º exercício sobrescrito para 60s:

| # | Exercício | Trabalho | Descanso | Origem |
|---|-----------|----------|----------|--------|
| 1 | Polichinelo | 30s | 10s | padrão do ciclo |
| 2 | Agachamento | 30s | 10s | padrão do ciclo |
| 3 | Prancha | **60s** | 10s | **sobrescrito** |
| 4 | Burpee | 30s | 10s | padrão do ciclo |
| 5 | Abdominal | 30s | — | último item: descanso substituído pelo descanso entre ciclos |

Tempo do ciclo = (30+30+60+30+30) + (4 × 10) = **220s (3min40s)**.

Regras:
- Se o usuário alterar o padrão do ciclo, os itens **não sobrescritos** acompanham; os sobrescritos mantêm o valor (com ícone indicando e opção "voltar ao padrão").
- O descanso do último item do ciclo pode ser configurado como "pular" (padrão) ou "manter".

### 4.2 Schema (SQLite)

```ts
// users  (mock na v1 — um único registro local)
id TEXT PK, display_name TEXT, email TEXT NULL, created_at INTEGER

// exercises  (catálogo reutilizável; também dá para digitar nome livre no ciclo)
id TEXT PK, name TEXT, description TEXT, color TEXT, icon TEXT, created_at INTEGER

// workouts
id TEXT PK, user_id TEXT FK, name TEXT,
type TEXT,                                   -- 'tabata' | 'hiit' | 'emom' | 'amrap' | 'circuit' | 'custom'
prepare_sec INTEGER DEFAULT 10,
cooldown_sec INTEGER DEFAULT 0,
rest_between_cycles_sec INTEGER DEFAULT 60,
sound_config_id TEXT FK NULL,                -- NULL = usa os sons globais
color TEXT, favorite INTEGER, created_at INTEGER, updated_at INTEGER

// cycles
id TEXT PK, workout_id TEXT FK, position INTEGER,
name TEXT,                                   -- "Ciclo 1", "Aquecimento"...
repeat_count INTEGER DEFAULT 1,              -- quantas vezes o ciclo se repete
default_work_sec INTEGER,                    -- ex.: 30
default_rest_sec INTEGER,                    -- ex.: 10
skip_last_rest INTEGER DEFAULT 1

// cycle_items  (cada exercício do ciclo)
id TEXT PK, cycle_id TEXT FK, position INTEGER,
exercise_id TEXT FK NULL, label TEXT NULL,   -- nome livre se não usar catálogo
work_sec INTEGER NULL,                       -- NULL = herda default_work_sec
rest_sec INTEGER NULL,                       -- NULL = herda default_rest_sec
sound_config_id TEXT FK NULL                 -- sobrescreve sons só neste exercício (opcional)

// sounds  (biblioteca)
id TEXT PK, name TEXT,
source TEXT,                                 -- 'builtin' | 'user'
uri TEXT,                                    -- asset embutido ou arquivo copiado para o diretório do app
duration_ms INTEGER, created_at INTEGER

// sound_configs  (qual som toca em cada evento)
id TEXT PK, name TEXT,
work_start_sound_id TEXT FK,                 -- começou o trabalho
rest_start_sound_id TEXT FK,                 -- começou o descanso
countdown_sound_id TEXT FK NULL,             -- bipes dos últimos N segundos
cycle_end_sound_id TEXT FK NULL,
workout_end_sound_id TEXT FK NULL,
countdown_from INTEGER DEFAULT 3,
volume REAL,                                 -- 0..1
voice_enabled INTEGER, voice_lang TEXT, announce_next INTEGER,
haptics_enabled INTEGER,
halfway_alert INTEGER,
duck_music INTEGER DEFAULT 1

// sessions  (uma execução)
id TEXT PK, workout_id TEXT FK NULL, workout_snapshot TEXT (JSON),
started_at INTEGER, ended_at INTEGER,
status TEXT,                                 -- 'completed' | 'abandoned'
planned_total_sec INTEGER,
actual_work_sec INTEGER, actual_rest_sec INTEGER, paused_sec INTEGER,
phases_completed INTEGER, phases_skipped INTEGER, phases_total INTEGER

// session_phases  (log detalhado de cada fase executada)
id TEXT PK, session_id TEXT FK, phase_index INTEGER,
kind TEXT, cycle_position INTEGER, item_position INTEGER, exercise_label TEXT,
planned_ms INTEGER, actual_ms INTEGER, skipped INTEGER

// session_feedback
session_id TEXT PK FK,
rating INTEGER,                              -- 1..5 estrelas
rpe INTEGER,                                 -- esforço percebido 1..10
mood TEXT NULL,                              -- 'cansado' | 'normal' | 'ótimo'
difficulty TEXT NULL,                        -- 'fácil' | 'ideal' | 'difícil'
notes TEXT NULL
```

> `workout_snapshot` guarda o treino como estava no momento da execução, para as estatísticas não mudarem se o treino for editado depois.
>
> Tempo efetivo de um item: `item.work_sec ?? cycle.default_work_sec` e `item.rest_sec ?? cycle.default_rest_sec` — resolvido em `domain/timeline.ts`.

### 4.3 Templates de tipos de treino

| Tipo | Parâmetros do usuário | Estrutura gerada |
|------|----------------------|------------------|
| **Tabata** | exercícios (1–8), sets | 8 × (20s trabalho / 10s descanso) por set |
| **HIIT** | trabalho, descanso, rounds | N × (T trabalho / D descanso) |
| **EMOM** | minutos, exercício(s) | N × 60s, sinal a cada minuto (descanso = sobra do minuto) |
| **AMRAP** | duração total | 1 intervalo longo + contador manual de rounds |
| **Circuito** | lista de exercícios, tempo por exercício, descanso, voltas | voltas × (ex₁, desc, ex₂, desc, …) |
| **Personalizado** | livre | editor de blocos completo |

Os templates são só **geradores** — depois de criado, todo treino é editável como "Personalizado".

---

## 5. Motor do temporizador (parte mais crítica)

### 5.1 Compilação em timeline
Antes de iniciar, o treino é "compilado" em uma lista linear de fases:

```ts
type Phase = {
  index: number;
  kind: 'prepare' | 'work' | 'rest' | 'cycleRest' | 'cooldown';
  durationMs: number;      // já resolvido: item.work_sec ?? cycle.default_work_sec
  startOffsetMs: number;   // início relativo ao começo do treino
  exerciseName?: string;
  cycleIndex: number; totalCycles: number;
  itemIndex: number; totalItems: number;
  repeat: number; totalRepeats: number;
  sounds: ResolvedSounds;  // sons já resolvidos pela herança global → treino → exercício
  next?: { kind: Phase['kind']; exerciseName?: string };
};
```

A timeline também fornece `cycleDurations[]` e `totalDuration`, usados na tela de detalhe e no editor.

Vantagens: duração total conhecida, barra de progresso trivial, pular/voltar fase é só mudar o índice, e dá para agendar todas as notificações de uma vez.

### 5.2 Relógio baseado em timestamp (não em contagem)
**Nunca** decrementar um contador a cada `setInterval(1000)` — isso acumula atraso e para quando o app vai para background.

```ts
// tempo decorrido = agora - início - tempo total pausado
elapsed = monotonicNow() - startedAt - pausedAccumulated;
phase   = findPhase(timeline, elapsed);       // busca binária por startOffsetMs
remain  = phase.startOffsetMs + phase.durationMs - elapsed;
```

- Usar relógio monotônico (`performance.now()` / `global.nativePerformanceNow`) para evitar saltos de ajuste de horário.
- O "tick" da UI (`requestAnimationFrame` ou 100–250 ms) **só renderiza**; não é fonte da verdade.
- Ao voltar do background, o estado é recalculado a partir do timestamp — o tempo nunca "perde" segundos.

### 5.3 Máquina de estados (XState)

```
idle ──START──► running ──PAUSE──► paused ──RESUME──► running
                  │  ▲                │
          SKIP/BACK  │                └──STOP──► finished
                  ▼  │
             (phase change)  ──(última fase acabou)──► finished
```

Eventos emitidos para o Alert Service: `PHASE_STARTED`, `COUNTDOWN_TICK(n)`, `HALFWAY`, `WORKOUT_FINISHED`.

### 5.4 Background e tela bloqueada
Este é o ponto de maior risco técnico, principalmente no iOS.

**Implementado (Fase 4):**

| Cenário | Estratégia |
|---------|-----------|
| App em primeiro plano | Áudio/voz/haptics em tempo real pelo motor; `keep-awake` ativo |
| App vai para segundo plano / tela bloqueada | Agenda **notificações locais** (expo-notifications) para cada troca de fase restante + fim, com o som configurado (sons embutidos empacotados no app). Até 60 por vez (limite do iOS: 64), sempre reservando o aviso de fim. Pausado não agenda nada. |
| Durante o segundo plano | O player **não** toca alertas (evita som duplicado com a notificação). |
| Volta ao app | Cancela as notificações; o motor recalcula o estado pelo relógio — nenhum segundo é perdido. |

Sons importados pelo usuário usam o som padrão do sistema na notificação (o iOS só toca sons empacotados).

**Futuro (v1.1+):** Live Activity (iOS) e foreground service com cronômetro na notificação (Android); avaliar áudio contínuo em background (`UIBackgroundModes: audio`) se as notificações não forem precisas o bastante em testes de campo.

---

## 6. Alertas

### 6.1 Tipos de alerta
| Gatilho | Som | Voz (TTS) | Vibração |
|---------|-----|-----------|----------|
| Contagem regressiva (últimos N s) | bipe curto | "3, 2, 1" (opcional) | leve |
| Início do trabalho | bipe longo / apito | "Vai! Burpee" | forte |
| Início do descanso | sino | "Descanso. Próximo: Agachamento" | média |
| Metade do intervalo | bipe duplo | "Metade" | leve |
| Fim de round / bloco | — | "Round 3 de 8" | — |
| Fim do treino | fanfarra | "Treino concluído" | padrão sucesso |

### 6.2 Configuração em camadas
`Padrão do app` → `Sons globais do usuário` → `Sons do treino` → `Sons do exercício` (cada nível sobrescreve o anterior; o campo vazio herda).

### 6.2.1 Troca de sons
- Para cada evento (**início do trabalho**, **início do descanso**, contagem regressiva, fim do ciclo, fim do treino) o usuário escolhe um som da biblioteca.
- **Biblioteca embutida** (v1): bipe, bipe duplo, apito, sino, gongo, buzina, palmas, "silencioso".
- **Sons do usuário**: importar arquivo (`File.pickFileAsync` do `expo-file-system`, sem dependência extra), copiado para o diretório do app, limite de 1 MB, formatos mp3/wav/m4a/aac/caf. Excluir faz quem usava o som voltar ao padrão.
- **"Silencioso" × "herdar"**: `null` herda da camada anterior; o id `silent` desliga o som explicitamente.
- Botão ▶︎ de **pré-escuta** ao lado de cada opção.
- Observação: notificações em background no iOS só tocam sons empacotados no app (≤ 30 s). Sons importados pelo usuário tocam normalmente com o app ativo ou em modo áudio-em-background; no fallback por notificação, usa-se o som embutido mais próximo.

### 6.3 Áudio
- Sessão de áudio em modo **mix com ducking**: a música do Spotify/Apple Music abaixa no bipe e volta.
- Sons pré-carregados na memória ao abrir o Player (latência < 50 ms).
- Respeitar modo silencioso? → configurável (`tocar mesmo no silencioso`, padrão: sim, pois é um app de treino).
- Pacotes de som em `assets/sounds/` (formato `.caf` no iOS para notificações, `.wav/.mp3` no app).

---

## 7. Sequência de telas

### 7.1 Fluxo de navegação

```
┌──────────┐  Entrar   ┌──────────────────┐  "+"   ┌──────────────┐  Salvar  ┌──────────────┐
│  Login   ├──────────►│ Lista de treinos ├───────►│ Novo treino  ├─────────►│  Detalhe do  │
│  (mock)  │           │     (home)       │        │  (editor)    │          │    treino    │
└──────────┘           └────────┬─────────┘        └──────▲───────┘          └──┬───┬───┬───┘
                                │ toca no treino          │ Editar             │   │   │
                                └──────────────────────────┼────────────────────►  │   │
                                                           └───────────────────────┘   │
                         ┌──────────────┐   Sons   ┌──────────────────┐                │
                         │  Sons do     │◄─────────┤  Detalhe (cont.) │                │ Começar
                         │  treino      │          │  Estatísticas ─────► Estatísticas │
                         └──────────────┘          └──────────────────┘   do treino    │
                                                                                       ▼
              ┌──────────────────┐  Salvar  ┌──────────────────┐  fim/parar  ┌──────────────┐
              │ Estatísticas do  │◄─────────┤ Feedback / resumo│◄────────────┤ Temporizador │
              │ treino           │          │  pós-treino      │             │  (player)    │
              └──────────────────┘          └──────────────────┘             └──────────────┘

Abas inferiores (após login):  [ Treinos ]  [ Estatísticas ]  [ Configurações ]
```

### 7.2 Tela 1 — Login (mock)
- Logo, campos **e-mail** e **senha** (visuais, sem validação obrigatória) e botão **Entrar**.
- Ao tocar em **Entrar**: cria/reutiliza o usuário local, grava `isLoggedIn = true` (AsyncStorage/SecureStore) e navega para **Lista de treinos** (`router.replace`, sem voltar para o login).
- Na próxima abertura, se já "logado", pula direto para a home. **Sair** fica em Configurações.
- Implementação isolada atrás de uma interface `AuthService { signIn(); signOut(); currentUser() }` com `MockAuthService`. Trocar por auth real (ex.: Supabase, Firebase, Apple/Google Sign-In) depois é só outra implementação, sem mexer nas telas.

### 7.3 Tela 2 — Lista de treinos (home)
- Cartões com: nome, nº de ciclos, nº de exercícios, **tempo total**, data do último treino e ícone de favorito.
- Busca por nome, filtro "favoritos", ordenação (recentes / nome / duração).
- Ações no cartão: deslizar para **duplicar** ou **excluir** (com confirmação).
- Botão **"+" Novo treino** (abre editor vazio ou escolha de template).
- Estado vazio: ilustração + "Crie seu primeiro treino" + atalho "Usar Tabata clássico".

### 7.4 Tela 3 — Novo treino / Editar treino
```
┌───────────────────────────────────────────┐
│ ← Novo treino                     Salvar  │
│ Nome: [ Treino de perna         ]         │
│ Preparação: [10s]   Descanso entre        │
│                     ciclos: [60s]         │
│───────────────────────────────────────────│
│ ▼ Ciclo 1                Repetir: [1x]    │
│   Padrão: Trabalho [30s]  Descanso [10s]  │
│   ≡ 1 Polichinelo        30s / 10s        │
│   ≡ 2 Agachamento        30s / 10s        │
│   ≡ 3 Prancha       ✎   60s / 10s        │ ← sobrescrito
│   ≡ 4 Burpee             30s / 10s        │
│   ≡ 5 Abdominal          30s / —          │
│   [+ Exercício]                           │
│   Tempo do ciclo: 3min40s                 │
│ ▶ Ciclo 2 ...                             │
│ [+ Ciclo]                                 │
│───────────────────────────────────────────│
│ Tempo total: 12min20s                     │
└───────────────────────────────────────────┘
```
- **Ciclos:** adicionar, renomear, duplicar, remover, reordenar (botões ↑/↓ — mais acessível que drag & drop; implementado na Fase 1), definir repetições.
- **Tempo padrão do ciclo:** trabalho e descanso aplicados a todos os exercícios do ciclo.
- **Atalho "criar N exercícios"**: stepper "Exercícios" no ciclo — com os tempos padrão, "5 exercícios de 30s com 10s de descanso" sai em 3 toques.
- **Exercício individual:** tocar abre um bottom sheet com nome (do catálogo ou texto livre), **tempo de trabalho** e **tempo de descanso** próprios, e (opcional) sons específicos. Itens com tempo sobrescrito exibem ✎ e o botão "voltar ao padrão".
- Seletor de tempo: botões −5s / +5s e entrada mm:ss.
- **Recalcula em tempo real** o tempo de cada ciclo e o total.
- Validação (zod): nome obrigatório, ≥ 1 ciclo, ≥ 1 exercício por ciclo, trabalho ≥ 1s.
- Sair com alterações não salvas → confirmação.

### 7.5 Tela 4 — Detalhe do treino (pré-treino)
Ao selecionar um treino na lista:
- **Tempo total** em destaque (ex.: `12:20`) e totais de trabalho vs. descanso.
- **Lista de ciclos** com o tempo de cada um, expansível para ver cada exercício com seus tempos.
- Mini-timeline colorida (verde = trabalho, azul = descanso) mostrando a proporção das fases.
- Resumo das últimas sessões (última vez feito, nº de vezes, nota média) com link para **Estatísticas do treino**.
- Botões: **Editar**, **Sons**, **Estatísticas** e o principal **▶ Começar**.

### 7.6 Tela 5 — Temporizador (player)
- Contagem de **preparação** (ex.: 10s) antes do primeiro exercício.
- **Tempo restante** grande, **cor de fundo por fase** (verde = trabalho, azul = descanso, amarelo = preparação) e rótulo textual ("TRABALHO" / "DESCANSO").
- Exercício atual, **próximo exercício**, posição: "Ciclo 1/3 · Exercício 3/5 · Repetição 1/1".
- Anel de progresso da fase + barra de progresso do treino + tempo total restante.
- **Sons**: toca o som configurado ao **começar um trabalho** e ao **começar um descanso**, bipes nos últimos N segundos, som de fim de ciclo e de fim de treino (+ vibração e voz, se ativados).
- Controles: **pausar/continuar**, **pular fase**, **voltar fase**, **parar** (confirmação) e **bloquear toques**.
- Tela sempre ligada; continua funcionando com tela bloqueada (seção 5.4).
- Ao terminar ou parar → **Feedback / resumo**.

### 7.7 Tela 6 — Sons do treino
- Lista de eventos (Início do trabalho, Início do descanso, Contagem regressiva, Fim do ciclo, Fim do treino), cada um com o som selecionado e ▶︎ pré-escuta.
- Toggle "Usar sons globais" (herança) vs. personalizar para este treino.
- Volume, contagem a partir de N segundos, voz, vibração.
- **Importar som** do dispositivo (ver 6.2.1).

### 7.8 Tela 7 — Feedback / resumo pós-treino
- Tempo planejado vs. **tempo realizado**, tempo em pausa, fases concluídas / puladas, status (concluído / interrompido em X%).
- **Feedback:** nota (1–5 ★), esforço percebido (RPE 1–10), dificuldade (fácil / ideal / difícil), humor, observações livres.
- **Salvar** → grava `sessions`, `session_phases` e `session_feedback` → abre Estatísticas do treino. **Descartar** também disponível.

### 7.9 Tela 8 — Estatísticas do treino
Ver seção 7A.

### 7.10 Tela 9 — Estatísticas gerais (aba)
- Totais da semana/mês: nº de treinos, tempo total treinado, sequência de dias (streak), calendário com dias treinados.
- Ranking dos treinos mais feitos e lista de sessões recentes.

### 7.11 Tela 10 — Configurações
- Sons globais (mesma UI da tela de sons), biblioteca de sons, voz/idioma, vibração, tema claro/escuro, export/import de backup (JSON), **Sair** (volta ao login).

Acessibilidade: fontes dinâmicas, alto contraste no player, VoiceOver/TalkBack nos controles, cores de fase sempre acompanhadas de texto.

---

## 7A. Estatísticas por treino

### O que é coletado (automático, a cada sessão)
| Dado | Origem |
|------|--------|
| Início, fim, duração real | timestamps da sessão |
| Tempo de trabalho e de descanso realizados | soma de `session_phases.actual_ms` por tipo |
| Tempo em pausa | motor do timer |
| Fases concluídas / puladas / total | log de fases |
| % de conclusão | `phases_completed / phases_total` |
| Exercícios pulados | `session_phases.skipped` |

### O que é coletado (feedback do usuário)
Nota 1–5, RPE 1–10, dificuldade, humor e observações.

### O que a tela mostra
- **Cartões-resumo:** vezes realizado, tempo total acumulado, taxa média de conclusão, nota média, RPE médio, última execução.
- **Gráficos:** duração realizada ao longo do tempo; RPE e nota por sessão (tendência); frequência por semana.
- **Exercícios mais pulados** (ajuda a ajustar o treino).
- **Histórico de sessões** do treino; tocar em uma abre o detalhe (fases, tempos, feedback).
- Filtro de período: 7 dias / 30 dias / 90 dias / tudo.

### Implementação
- Agregações em funções puras (`domain/stats.ts`) sobre as sessões carregadas do SQLite — volume local pequeno e 100% testável. *(Fase 3)*
- Tempo realizado medido pelo tempo decorrido do motor e distribuído exatamente entre as fases (`domain/sessionRecorder.ts`), sem erro de tick; pausa medida à parte.
- Gráficos de barras próprios com Views (`components/bar-chart.tsx`) — sem dependência nativa; cada barra é acessível.
- Sessões sem tempo de trabalho (parou no preparo) são descartadas. Excluir um treino mantém o histórico (nome vem da cópia salva).
- O log de fases é gravado em memória durante o treino e persistido em uma transação ao salvar; se o app fechar no meio, a sessão em andamento é salva como `abandoned` (checkpoint a cada troca de fase).

---

## 8. Qualidade e testes

| Nível | O quê | Ferramenta |
|-------|-------|-----------|
| Unitário | `timeline.ts` (compilação de cada template), `timerMachine` com relógio falso, validações | Jest + fake timers |
| Propriedade | soma das fases = duração total; nunca há fase de duração ≤ 0 | fast-check |
| Integração | repositórios com SQLite em memória; migrações | Jest |
| Componente | Editor e Player | RNTL |
| E2E | criar Tabata → iniciar → pausar → concluir → ver no histórico | Maestro |
| Manual (dispositivo real) | tela bloqueada, música tocando, modo silencioso, chamada recebida no meio do treino | checklist por release |

**Teste de precisão:** rodar um treino de 30 min em aparelho físico (iOS e Android), metade com tela bloqueada, e medir desvio dos alertas.

---

## 9. Roadmap

### Fase 0 — Fundação (1 semana) ✅ PR #1
- Projeto Expo + TS strict, lint/format, Expo Router, CI rodando testes
- Schema SQLite + migrações + seeds (sons embutidos, templates)
- **Tela de login mock** + `MockAuthService` + navegação para as abas

### Fase 1 — Treinos e núcleo do timer (2 semanas) ✅ PR #2
- **Lista de treinos** e **Novo/Editar treino** com ciclos, tempos padrão e sobrescrita por exercício
- `timeline.ts` (resolução de tempos herdados/sobrescritos) + `timerMachine` com testes completos
- **Detalhe do treino** com tempo total e tempo por ciclo
- **Player** em primeiro plano com sons de início de trabalho/descanso e haptics

### Fase 2 — Sons (1–2 semanas) ✅ PR #3
- Biblioteca de sons embutidos, **tela de sons do treino**, sons globais, pré-escuta
- Importação de sons do usuário, sobrescrita por exercício
- Voz (TTS) e ducking

### Fase 3 — Estatísticas (2 semanas) ✅ PR #4
- Log de fases durante o treino, checkpoint e sessões abandonadas
- **Feedback pós-treino**, **Estatísticas do treino** e **Estatísticas gerais** com gráficos

### Fase 4 — Background e polimento (2 semanas) ✅ PR #5
- Notificações agendadas + áudio em background (iOS) + foreground service (Android)
- Teste de precisão em dispositivo real *(pendente — requer aparelho físico)*
- Templates (Tabata, HIIT, EMOM, AMRAP com contador de rounds, Circuito), export/import JSON, bloqueio de toques, confirmação ao sair do editor com alterações
- `eas.json` pronto; beta via TestFlight / Play Internal Testing *(pendente — requer contas Apple/Google)*

### v2 (futuro)
- Live Activities / widget, Apple Watch / Wear OS
- Apple Health / Google Health Connect
- Autenticação real (substituindo o `MockAuthService`) e sincronização na nuvem (ex.: Supabase)
- Treinos compartilháveis via link

---

## 10. Riscos e mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| iOS suspender o app em background e alertas atrasarem | Alto | Background audio mode + notificações agendadas como fallback; testar cedo (antecipar spike na Fase 1) |
| Rejeição na App Store pelo uso de background audio | Médio | App guia o treino por áudio (uso legítimo); deixar isso explícito na descrição da revisão |
| Bipes cortando/pausando a música do usuário | Médio | Sessão de áudio em `mixWithOthers` + `duckOthers`; testar com Spotify e Apple Music |
| Limite de 64 notificações no iOS | Baixo | Agendamento em janelas deslizantes |
| Otimização de bateria agressiva no Android (Xiaomi, Samsung) | Médio | Foreground service + orientar o usuário a desativar otimização para o app |
| Editor de treino complexo demais | Médio | Templates como porta de entrada; editor avançado só em "Personalizado" |

---

## 11. Decisões em aberto

1. **Plataformas:** iOS + Android desde o início, ou só iOS?
2. **Idiomas:** só pt-BR na v1, ou pt-BR + en (impacta TTS e i18n desde o começo)?
3. **Monetização:** gratuito, pago, ou freemium (ex.: templates/sons premium)?
4. **Background audio no iOS:** adotar desde a v1 (recomendado) ou começar só com notificações?
5. **Apple Watch / Live Activity:** entra na v1.1 ou fica para v2?
6. **Login real:** qual provedor no futuro (e-mail/senha, Apple, Google)? Define a implementação do `AuthService`.
7. **Sons importados:** permitir na v1 ou só a biblioteca embutida?
8. **Feedback pós-treino:** obrigatório ou opcional (pular direto para as estatísticas)?
