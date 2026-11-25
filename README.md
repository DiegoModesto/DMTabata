# DMTabata

Aplicativo mobile de treinos intervalados — Tabata, HIIT, EMOM, AMRAP e circuitos — com ciclos configuráveis, temporizador preciso, sons para cada momento do treino (incluindo sons surpresa e música de fundo) e estatísticas por treino.

- **Plano técnico**: [`Plans/plano-tecnico-dmtabata.md`](Plans/plano-tecnico-dmtabata.md)
- **Stack**: React Native 0.88 · Expo SDK 58 · TypeScript (strict) · Expo Router · SQLite (expo-sqlite) · Zustand
- **Plataforma alvo**: iOS (testado em iPhone físico e simulador iOS 26); Android suportado pela base Expo

---

## Funcionalidades

### Treinos
- **Login** simulado (v1): qualquer valor entra.
- **Ciclos e exercícios**: cada ciclo tem trabalho/descanso padrão, repetições e "pular descanso do último exercício"; cada exercício pode ter tempo próprio (ex.: 5 × 30s/10s com o 3º em 60s).
- **Preparação mínima de 16 s** em todos os treinos (editor, validação, backup e migração).
- **Modelos**: Tabata, HIIT, EMOM, AMRAP (com contador de rounds), Circuito e Personalizado.
- **Editor**: ajuste de valores de **1 em 1**, com botões grandes; **segurar** repete e acelera.
- **Pré-treino**: tempo total, tempo de cada ciclo e linha do tempo colorida.

### Temporizador (player)
- Baseado em relógio (sem deriva): pausar, pular, voltar, parar.
- Controles com ícones nativos (SF Symbols / Material Symbols), bloqueio de toques e tela sempre ligada.
- Ao terminar: avaliação do treino (ou **Pular**, no topo da tela).

### Sons
| Recurso | Como funciona |
|---|---|
| **Sons por momento** | Início da preparação, início do trabalho, início do descanso, contagem regressiva, fim de ciclo, fim do treino e metade do trabalho. |
| **Camadas** | Padrão do app → sons globais → sons do treino → som do exercício. Vazio herda; "Silencioso" desliga. |
| **Catálogo embutido** | 37 sons em categorias: *Sinais de treino*, *Ringue e luta* (sino de ringue, fim de round, batida de aviso), *Alertas sonoros* e *Pacote pessoal*. |
| **Meus sons** | Importar áudio (mp3, wav, m4a, aac, caf — até 1 MB) ou **gravar até 3 s** pelo microfone. |
| **Som por exercício** | No editor, o botão de som (alto-falante) em cada exercício escolhe o som do início dele — da lista, **importando um arquivo** ou **gravando um clipe** ali mesmo. O som aparece com ♪ na lista e no detalhe do treino. Em *Editar exercício* também dá para trocar o som do descanso. |
| **Sons surpresa** | Durante o trabalho, em momentos sorteados (20–60% da fase), toca um som aleatório da lista; chance por exercício configurável. Um novo interrompe o anterior. |
| **Música de fundo** | Toca em loop no volume máximo e **abaixa enquanto qualquer outro áudio toca** (alertas, surpresas, voz). Pausa, retoma e para junto com o treino. |
| **Segundos finais** | Bipes da contagem sempre no volume máximo, com a música abaixada até a fase seguinte. |
| **Pré-escuta** | ▶ vira ⏸ enquanto toca; tocar de novo para o áudio. |
| **Narração** | Voz opcional anunciando fases e próximo exercício. |
| **Segundo plano** | Com o app fechado/bloqueado, as trocas de fase viram notificações locais (som `.wav` embutido ou o padrão do sistema). |

### Pacote pessoal de sons
O app traz embutidos **18 áudios** curtos (corneta, campainha de boxe, trilhas e memes) em `assets/sounds/pack/`, baixados do [MyInstants](https://www.myinstants.com). **Os direitos pertencem aos respectivos autores** — veja [`assets/sounds/pack/CREDITOS.md`](assets/sounds/pack/CREDITOS.md).

Em **Configurações → Sons e alertas → Usar pacote pessoal**, um toque aplica:

| Momento | Som |
|---|---|
| Preparação | Vamo acordar |
| Trabalho | Corneta |
| Descanso | Campainha de boxe |
| Fim do treino | Cabou |
| Sons surpresa (12) | Chicote, Risada maligna, Pica-Pau, Sukuna, Meu Deus como sou lindo, Saint Seiya, Pegasus Fantasy, Lula (2), Zé Gotinha, Fahhh, Vine boom |
| Música de fundo | Background vibes |

O "Pára pára pára, aeee" também faz parte do pacote e pode ser escolhido como fim de um treino específico.

> O iOS não toca mp3 em notificações: com o app em segundo plano, esses sons usam o som padrão do sistema.

### Compartilhar, modelos e treinos embutidos
- **Compartilhar**: no treino, *Compartilhar* gera `nome-do-treino.dmtabata` e abre o menu do iOS (WhatsApp, AirDrop, *Salvar em Arquivos*). O arquivo leva a estrutura do treino e os sons que existem em qualquer instalação (embutidos e pacote pessoal); sons importados/gravados ficam de fora (o app avisa).
- **Receber**: tocar no arquivo `.dmtabata` abre o DMTabata com o treino para *Adicionar aos meus treinos*. Também dá para usar *Novo treino → Importar treino de arquivo*.
- **Salvar como modelo**: guarda uma cópia em *Novo treino → Meus modelos*; cada uso cria um treino novo, sem mexer no modelo.
- **Treinos embutidos**: arquivos em [`assets/workouts/`](assets/workouts) aparecem em *Modelos do DMTabata* e são adicionados **uma única vez** à lista em instalações novas (se apagados, não voltam). Hoje: **Boxe Sequenciado** (4 ciclos, 17 exercícios).
- **Embutir um treino novo**: compartilhe-o pelo app, salve o arquivo como `assets/workouts/<id>.json` e registre em [`src/services/library/bundledWorkouts.ts`](src/services/library/bundledWorkouts.ts).

### Estatísticas e dados
- Tempo realizado por fase, pausas, fases puladas e rounds (AMRAP).
- Feedback pós-treino: nota, esforço, dificuldade, humor e observações.
- Gráficos, sequência de dias, exercícios mais pulados e histórico por treino.
- **Backup**: exportar/importar treinos em JSON.

---

## Instalar no iPhone (sem App Store)

Com o iPhone conectado ao Mac por cabo e uma conta Apple gratuita (Personal Team) no Xcode:

```bash
npx expo prebuild --platform ios --clean
cd ios && pod install
xcodebuild -workspace DMTabata.xcworkspace -scheme DMTabata -configuration Release \
  -destination "id=<UDID do iPhone>" DEVELOPMENT_TEAM=<TEAM_ID> \
  CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates build
xcrun devicectl device install app --device <UDID> <caminho>/Release-iphoneos/DMTabata.app
```

- O build **Release** embute o código: o app funciona sem o Mac e sem internet.
- Na primeira vez: **Ajustes → Geral → VPN e Gerenciamento de Dispositivos → Confiar** no desenvolvedor (e ative o *Modo de Desenvolvedor*, se pedido).
- Com conta gratuita, a instalação **vale 7 dias**; reinstalar com o mesmo comando mantém treinos, sons e histórico.
- O plugin [`plugins/with-local-notifications-only.js`](plugins/with-local-notifications-only.js) remove a permissão de push remoto (o app só usa notificações locais), o que permite assinar com conta gratuita.
- UDID do iPhone: `xcrun devicectl list devices`. Team ID: `security find-identity -v -p codesigning` (campo `OU` do certificado).

Para distribuir via TestFlight/Play: conta de desenvolvedor paga, `npx eas-cli@latest build --profile production` e `npx eas-cli@latest submit`.

---

## Desenvolvimento

```bash
npm install
npm run check          # typecheck + lint + testes (o mesmo que o CI roda)
npm test               # Jest + Testing Library
npm run test:coverage
npm run e2e            # Maestro no simulador (ver abaixo)
node scripts/generate-sounds.mjs   # regenera os .wav embutidos (síntese determinística)
```

O app usa módulos nativos (SQLite, áudio, gravação, notificações, ícones), então roda em um **development build** — não no Expo Go:

```bash
npx expo run:ios                 # build + simulador
npx expo start                   # só o Metro, para um build já instalado
npx eas-cli@latest build --profile development --platform ios   # na nuvem
```

### Estrutura

```
src/
  app/          rotas (Expo Router) — arquivos finos que só importam telas
  features/     telas por funcionalidade (workouts, player, sounds, sessions, stats, settings, auth)
  domain/       regras de negócio puras (treino, timeline, alertas, sons, surpresas, estatísticas)
  engine/       motor do temporizador + controlador (eventos → comandos de áudio)
  services/     SQLite (migrações v1–v6), áudio, música de fundo, notificações, sons, sessões, backup, biblioteca de treinos
  stores/       estado (Zustand)
  components/   UI reutilizável (Button, Stepper, Icon, Screen, TextField…)
  test/         utilitários de teste (SQLite em memória, fakes, fábricas)
assets/sounds/  .wav embutidos (gerados) e pack/ (pacote pessoal em mp3)
assets/workouts/ treinos embutidos (formato .dmtabata em JSON)
plugins/        config plugins do Expo
.maestro/       fluxos E2E
Plans/          plano técnico
```

### Banco de dados (migrações)

| Versão | Conteúdo |
|---|---|
| v1 | Esquema inicial (usuários, treinos, ciclos, exercícios, sons, configurações, sessões) |
| v2 | Sons por exercício e som de metade do trabalho |
| v3 | Rounds do AMRAP na sessão |
| v4 | Som da preparação; treinos com preparação < 16 s sobem para 16 s |
| v5 | Sons surpresa (lista + chance) |
| v6 | Música de fundo (som + volume) |

Sons importados guardam o caminho do arquivo, que é **reancorado na pasta atual do app** ao abrir — o iOS pode mudar esse caminho entre instalações.

### Testes

- **Unitários e de regra de negócio** (438, Jest): domínio e motor (funções puras, incluindo propriedade da timeline e precisão do relógio), repositórios contra SQLite real em memória (`better-sqlite3`) com as mesmas migrações do app, serviços com fakes de áudio/arquivos/notificações e telas com Testing Library sobre o banco de teste e relógio simulado.
- **E2E** (4 fluxos, Maestro): login, criar treino (cenário do plano), treinar/avaliar/estatísticas e sons — no app real num simulador.

#### Rodando os testes E2E

Requer [Maestro](https://maestro.dev), um development build instalado no simulador e o Metro rodando (`npx expo start`).

```bash
npm run e2e                                 # usa o simulador ativo
maestro --device <UDID> test .maestro/...   # escolhe o simulador
```

> O primeiro fluxo começa com `clearState` (apaga os dados do app). Use um simulador só para testes se você também testa manualmente.

### Fluxo de trabalho

Cada fase ou melhoria é feita em uma branch própria, com testes unitários e de regra de negócio, e entra na `main` via Pull Request com CI (typecheck, lint e testes) verde.

---

## Histórico

| PR | Entrega |
|---|---|
| #1 | Fase 0 — Fundação: Expo, SQLite, login mock e CI |
| #2 | Fase 1 — Treinos com ciclos, editor, detalhe e temporizador com sons |
| #3 | Fase 2 — Sons configuráveis (global, treino e exercício), importação e voz |
| #4 | Fase 3 — Estatísticas por treino, feedback pós-treino e histórico |
| #5 | Fase 4 — Alertas em segundo plano, modelos de treino, backup e polimento |
| #6 | Sons de ringue, alertas sonoros e gravação de até 3 s |
| #7 | Som da preparação e preparação mínima de 16 s |
| #8 | Sons surpresa sorteados durante o treino |
| #9 | Botão de voltar não cobre mais o título |
| #10 | Stepper 1 em 1 com segurar acelerado, controles sem emoji e pré-escuta play/pause |
| #11 | Música de fundo em loop e "Pular" visível na avaliação |
| #12 | Ícones nativos na tela de gravação |
| #13 | iOS: remove permissão de push remoto (só notificações locais) |
| #14 | Sons importados sobrevivem à troca de caminho da pasta do app |
| #15 | Testes E2E (Maestro) no simulador |
| #16 | Música no volume máximo, abaixando só quando outro áudio toca |
| #17 | Texto do player não corta mais no topo |
| #18 | Pacote pessoal de sons embutido no app |
| #19 | README atualizado com o estado do projeto |
| #20 | Compartilhar treinos, salvar como modelo e treinos embutidos (Boxe Sequenciado) |

## Licença

Código sob a licença MIT ([`LICENSE`](LICENSE)). Os áudios de `assets/sounds/pack/` não são cobertos por ela — pertencem aos respectivos autores (ver créditos).
