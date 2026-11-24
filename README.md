# DMTabata

Aplicativo mobile de treinos intervalados (Tabata, HIIT, circuitos) com ciclos configuráveis, temporizador preciso, sons personalizáveis e estatísticas por treino.

- Plano técnico: [`Plans/plano-tecnico-dmtabata.md`](Plans/plano-tecnico-dmtabata.md)
- Stack: React Native + Expo + TypeScript

## Desenvolvimento

```bash
npm install
npm start           # servidor Expo (requer development build para módulos nativos)
npm run check       # typecheck + lint + testes
npm test            # testes (Jest + Testing Library)
npm run test:coverage
```

### Estrutura

```
src/
  app/          rotas (Expo Router) — arquivos finos que só importam telas
  features/     telas por funcionalidade
  domain/       regras de negócio puras (sem React/Expo)
  services/     banco (SQLite), autenticação, áudio...
  stores/       estado (Zustand)
  components/   componentes de UI reutilizáveis
  test/         utilitários de teste (SQLite em memória, render com serviços)
```

### Testes

- **Domínio**: funções puras, testadas isoladamente.
- **Repositórios**: rodam contra SQLite real em memória (`better-sqlite3`) com as mesmas migrações do app.
- **Telas**: Testing Library com serviços reais sobre o banco de teste.

### Fluxo de trabalho

Cada fase do plano é desenvolvida em uma branch `fase-N/...`, com testes, e entra na `main` via Pull Request.
