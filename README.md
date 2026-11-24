# DMTabata

Aplicativo mobile de treinos intervalados (Tabata, HIIT, EMOM, AMRAP, circuitos) com ciclos configuráveis, temporizador preciso, sons personalizáveis e estatísticas por treino.

- Plano técnico: [`Plans/plano-tecnico-dmtabata.md`](Plans/plano-tecnico-dmtabata.md)
- Stack: React Native 0.88 + Expo SDK 58 + TypeScript + SQLite

## Funcionalidades

- **Login** (simulado na v1 — qualquer valor entra).
- **Treinos** com ciclos; cada ciclo tem tempo padrão de trabalho/descanso e cada exercício pode ter tempo próprio (ex.: 5 × 30s/10s com o 3º em 60s).
- **Modelos**: Tabata, HIIT, EMOM, AMRAP (com contador de rounds), Circuito e Personalizado.
- **Pré-treino**: tempo total, tempo de cada ciclo e linha do tempo colorida.
- **Temporizador**: baseado em relógio (sem deriva), pausar/pular/voltar/parar, bloqueio de toques, tela sempre ligada.
- **Sons**: um som por momento (início do trabalho, início do descanso, contagem, fim de ciclo, fim, metade), configuráveis globalmente, por treino e por exercício; importação de sons próprios; narração por voz; abaixa a música de outros apps.
- **Segundo plano**: ao sair do app, as trocas de fase viram notificações locais com o som configurado.
- **Estatísticas**: tempo realizado por fase, pausas, fases puladas, feedback pós-treino (nota, esforço, dificuldade, humor, observações), gráficos, sequência de dias e histórico.
- **Backup**: exportar/importar treinos em JSON.

### Pacote pessoal de sons

O app traz embutido um **pacote pessoal** com 18 áudios curtos (corneta, campainha de boxe, trilhas e memes) em `assets/sounds/pack/`, baixados do [MyInstants](https://www.myinstants.com). Os direitos pertencem aos respectivos autores — veja `assets/sounds/pack/CREDITOS.md`. Em **Configurações → Sons e alertas → Usar pacote pessoal**, um toque aplica a configuração completa (preparação, trabalho, descanso, fim, sons surpresa e música de fundo).

## Desenvolvimento

```bash
npm install
npm run check          # typecheck + lint + testes
npm test               # testes (Jest + Testing Library)
npm run test:coverage
node scripts/generate-sounds.mjs   # regenera os sons embutidos
```

O app usa módulos nativos (SQLite, áudio, notificações), então roda em um **development build** — não no Expo Go:

```bash
npx expo run:ios       # ou: npx expo run:android
# ou na nuvem, sem Xcode/Android Studio:
npx eas-cli@latest build --profile development --platform ios
```

Para distribuir um beta (TestFlight / Play Internal Testing): ajuste `ios.bundleIdentifier` e `android.package` em `app.json`, depois `npx eas-cli@latest build --profile production` e `npx eas-cli@latest submit`.

### Estrutura

```
src/
  app/          rotas (Expo Router) — arquivos finos que só importam telas
  features/     telas por funcionalidade
  domain/       regras de negócio puras (sem React/Expo)
  engine/       motor do temporizador (máquina de estados pura)
  services/     banco (SQLite), áudio, notificações, sons, sessões, backup
  stores/       estado (Zustand)
  components/   componentes de UI reutilizáveis
  test/         utilitários de teste (SQLite em memória, fakes, fábricas)
```

### Testes

- **Domínio e motor**: funções puras, incluindo teste de propriedade da timeline e precisão do relógio.
- **Repositórios**: rodam contra SQLite real em memória (`better-sqlite3`) com as mesmas migrações do app.
- **Serviços**: regras de negócio com fakes para áudio, arquivos e notificações.
- **Telas**: Testing Library com serviços reais sobre o banco de teste e relógio simulado.

### Fluxo de trabalho

Cada fase do plano é desenvolvida em uma branch `fase-N/...`, com testes, e entra na `main` via Pull Request com CI (typecheck, lint e testes).
- **E2E (Maestro)**: fluxos em `.maestro/` que rodam no app real num simulador — login, criar treino (cenário do plano), treinar/avaliar e sons.

#### Rodando os testes E2E

Requer [Maestro](https://maestro.dev), um development build instalado no simulador e o Metro rodando (`npx expo start`).

```bash
npm run e2e                               # usa o simulador ativo
maestro --device <UDID> test .maestro/... # escolhe o simulador
```

> O primeiro fluxo começa com `clearState` (apaga os dados do app). Use um simulador só para testes se você também testa manualmente.
