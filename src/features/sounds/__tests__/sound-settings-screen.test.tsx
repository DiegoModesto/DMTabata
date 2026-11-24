import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { createSilentAlertPlayer } from '@/services/audio/alertPlayer';
import { GLOBAL_SOUND_CONFIG_ID } from '@/services/db/seed';
import { createFakeSoundImporter } from '@/test/fakeSoundImporter';
import { recorderControl, resetRecorderControl } from '@/test/fakeSoundRecorder';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { SoundSettingsScreen } from '../sound-settings-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));
jest.mock('../use-sound-recorder', () => require('@/test/fakeSoundRecorder'));

beforeEach(() => resetRecorderControl());

async function setup() {
  const alertPlayer = createSilentAlertPlayer();
  const fake = createFakeSoundImporter();
  const services = await createTestServices({ alertPlayer, soundImporter: fake.importer });
  return { services, alertPlayer, fake };
}

describe('SoundSettingsScreen — sons globais', () => {
  it('mostra o som padrão de cada momento', async () => {
    const { services } = await setup();
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    expect(
      await screen.findByRole('button', { name: 'Início do trabalho: Largada (padrão)' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Início do descanso: Acorde suave (padrão)' }),
    ).toBeTruthy();
  });

  it('trocar o som do início do trabalho salva na configuração global', async () => {
    const { services } = await setup();
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Início do trabalho: Largada (padrão)' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Apito' }));

    expect(screen.getByRole('button', { name: 'Início do trabalho: Apito' })).toBeTruthy();
    await waitFor(async () =>
      expect((await services.soundConfigs.getById(GLOBAL_SOUND_CONFIG_ID))?.sounds.workStart).toBe(
        'whistle',
      ),
    );
  });

  it('escolher "Silencioso" desliga o som do descanso', async () => {
    const { services } = await setup();
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Início do descanso: Acorde suave (padrão)' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Silencioso' }));
    await waitFor(async () =>
      expect(
        (await services.soundService.settingsForWorkout(planExampleWorkout())).sounds.restStart,
      ).toBeNull(),
    );
  });

  it('pré-escuta toca o som no player', async () => {
    const { services, alertPlayer } = await setup();
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Ouvir Início do trabalho' }));
    expect(alertPlayer.previewed).toEqual(['go']);
  });

  it('ajusta volume e liga a narração', async () => {
    const { services } = await setup();
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Diminuir Volume dos alertas' }),
    );
    expect(screen.getByLabelText('Volume dos alertas: 90%')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Narração por voz'), 'valueChange', true);
    await waitFor(async () => {
      const cfg = await services.soundConfigs.getById(GLOBAL_SOUND_CONFIG_ID);
      expect(cfg).toMatchObject({ volume: 0.9, voiceEnabled: true });
    });
  });

  it('importa um som e ele aparece em "Meus sons" e no seletor', async () => {
    const { services, fake } = await setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    fake.state.nextPick = { fileName: 'grito.mp3', sizeBytes: 1000, handle: null };
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Importar som' }));
    expect(await screen.findByRole('button', { name: 'Ouvir grito' })).toBeTruthy();
    expect(alert).toHaveBeenCalledWith('Som importado', expect.any(String));

    await fireEvent.press(screen.getByRole('button', { name: /Início do trabalho:/ }));
    expect(screen.getByRole('radio', { name: 'grito' })).toBeTruthy();
    alert.mockRestore();
  });

  it('avisa quando o arquivo é rejeitado', async () => {
    const { services, fake } = await setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    fake.state.nextPick = { fileName: 'video.mov', sizeBytes: 1000, handle: null };
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Importar som' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Não foi possível importar',
        expect.stringContaining('Formato'),
      ),
    );
    alert.mockRestore();
  });

  it('remover um som importado pede confirmação', async () => {
    const { services } = await setup();
    await services.sounds.addUserSound({ name: 'Meu', uri: 'file:///m.mp3' });
    const alert = jest.spyOn(Alert, 'alert');
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Remover Meu' }));
    await act(async () => {
      await alert.mock.calls[0][2]!.find((o) => o.text === 'Remover')!.onPress!();
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remover Meu' })).toBeNull());
    alert.mockRestore();
  });
});

describe('SoundSettingsScreen — sons do treino', () => {
  async function setupWorkout() {
    const ctx = await setup();
    const workout = planExampleWorkout();
    await ctx.services.workouts.save(workout, null);
    await renderWithServices(
      <SoundSettingsScreen scope={{ type: 'workout', workoutId: workout.id }} />,
      ctx.services,
    );
    return { ...ctx, workout };
  }

  it('por padrão usa os sons globais', async () => {
    await setupWorkout();
    expect(await screen.findByText(/Usando os sons globais/)).toBeTruthy();
    expect(screen.getByLabelText('Personalizar sons deste treino').props.value).toBe(false);
  });

  it('personalizar e trocar o som vale só para este treino', async () => {
    const { services, workout } = await setupWorkout();
    await fireEvent(
      await screen.findByLabelText('Personalizar sons deste treino'),
      'valueChange',
      true,
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Início do trabalho: Largada (padrão)' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Buzina' }));

    await waitFor(async () => {
      const saved = (await services.workouts.getById(workout.id))!;
      expect((await services.soundService.settingsForWorkout(saved)).sounds.workStart).toBe('horn');
    });
    const other = planExampleWorkout();
    expect((await services.soundService.settingsForWorkout(other)).sounds.workStart).toBe('go');
  });
});

describe('SoundSettingsScreen — som da preparação', () => {
  it('preparação começa sem som e aceita um som importado do usuário', async () => {
    const { services } = await setup();
    const mine = await services.sounds.addUserSound({
      name: 'Meu aquecimento',
      uri: 'file:///v.mp3',
    });
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Início da preparação: Silencioso (padrão)' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Meu aquecimento' }));
    expect(
      screen.getByRole('button', { name: 'Início da preparação: Meu aquecimento' }),
    ).toBeTruthy();
    await waitFor(async () =>
      expect(
        (await services.soundService.settingsForWorkout(planExampleWorkout())).sounds.prepareStart,
      ).toBe(mine.id),
    );
  });
});

describe('SoundSettingsScreen — sons surpresa', () => {
  it('adiciona e remove sons do sorteio e ajusta a chance', async () => {
    const { services } = await setup();
    await services.sounds.addUserSound({ name: 'Meu chicote', uri: 'file:///c.mp3' });
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    expect(await screen.findByText('Nenhum som surpresa escolhido.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar som surpresa' }));
    expect(screen.queryByRole('radio', { name: 'Silencioso' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Meu chicote' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar som surpresa' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Gongo' }));
    expect(screen.getByRole('button', { name: 'Ouvir surpresa Meu chicote' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ouvir surpresa Gongo' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Tirar Gongo das surpresas' }));
    expect(screen.queryByRole('button', { name: 'Ouvir surpresa Gongo' })).toBeNull();

    await waitFor(async () => {
      const s = await services.soundService.settingsForWorkout(planExampleWorkout());
      expect(s.surpriseSounds).toHaveLength(1);
      expect(s.surpriseChance).toBe(0.3);
    });
  });

  it('treino não personalizado mostra a lista global sem permitir editar', async () => {
    const { services } = await setup();
    const global = await services.soundService.globalConfig();
    await services.soundService.saveConfig({ ...global, surpriseSounds: ['gong'] });
    const workout = planExampleWorkout();
    await services.workouts.save(workout, null);
    await renderWithServices(
      <SoundSettingsScreen scope={{ type: 'workout', workoutId: workout.id }} />,
      services,
    );
    expect(await screen.findByRole('button', { name: 'Ouvir surpresa Gongo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Adicionar som surpresa' })).toBeNull();
  });
});

describe('SoundSettingsScreen — pré-escuta com play/pause', () => {
  async function setupMine() {
    const ctx = await setup();
    await ctx.services.sounds.addUserSound({ name: 'Minha corneta', uri: 'file:///c.mp3' });
    await ctx.services.sounds.addUserSound({ name: 'Meu chicote', uri: 'file:///x.mp3' });
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, ctx.services);
    await screen.findByRole('button', { name: 'Ouvir Minha corneta' });
    return ctx;
  }

  it('tocar vira "pausar"; tocar de novo para o áudio e volta a "ouvir"', async () => {
    const { alertPlayer } = await setupMine();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir Minha corneta' }));
    expect(alertPlayer.previewed).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Parar Minha corneta' }));
    expect(alertPlayer.previewStops).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Ouvir Minha corneta' })).toBeTruthy();
  });

  it('quando o áudio termina sozinho, o botão volta a "ouvir"', async () => {
    const { alertPlayer } = await setupMine();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir Minha corneta' }));
    expect(screen.getByRole('button', { name: 'Parar Minha corneta' })).toBeTruthy();
    await act(async () => alertPlayer.finishPreview?.());
    expect(screen.getByRole('button', { name: 'Ouvir Minha corneta' })).toBeTruthy();
  });

  it('ouvir outro som troca a pausa para ele (só um toca por vez)', async () => {
    await setupMine();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir Minha corneta' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir Meu chicote' }));
    expect(screen.getByRole('button', { name: 'Parar Meu chicote' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ouvir Minha corneta' })).toBeTruthy();
  });

  it('o mesmo som em outro lugar da tela não mostra pausa junto', async () => {
    const { services } = await setupMine();
    const corneta = (await services.soundService.library()).find(
      (s) => s.name === 'Minha corneta',
    )!;
    await fireEvent.press(
      screen.getByRole('button', { name: 'Início do trabalho: Largada (padrão)' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Minha corneta' }));
    expect(corneta).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir Início do trabalho' }));
    expect(screen.getByRole('button', { name: 'Parar Início do trabalho' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ouvir Minha corneta' })).toBeTruthy();
  });

  it('no seletor também alterna, e fechar para o áudio', async () => {
    const { alertPlayer } = await setupMine();
    await fireEvent.press(screen.getByRole('button', { name: /Início do descanso:/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir Sino de ringue' }));
    expect(screen.getByRole('button', { name: 'Parar Sino de ringue' })).toBeTruthy();
    const stops = alertPlayer.previewStops;
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(alertPlayer.previewStops).toBeGreaterThan(stops);
  });
});

describe('SoundSettingsScreen — música de fundo', () => {
  it('escolhe a música, ouve e ajusta o volume', async () => {
    const { services, alertPlayer } = await setup();
    const vibes = await services.sounds.addUserSound({ name: 'Vibes', uri: 'file:///v.mp3' });
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Música: Nenhuma (padrão)' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Vibes' }));
    expect(screen.getByRole('button', { name: 'Música: Vibes' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir Música' }));
    expect(alertPlayer.previewed).toContain(vibes.id);
    expect(screen.getByRole('button', { name: 'Parar Música' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Diminuir Volume da música' }));
    await waitFor(async () =>
      expect(await services.soundService.settingsForWorkout(planExampleWorkout())).toMatchObject({
        backgroundMusicId: vibes.id,
        musicVolume: 0.95,
      }),
    );
  });
});

describe('SoundSettingsScreen — pacote pessoal', () => {
  it('"Usar pacote pessoal" aplica preparação, trabalho, descanso, fim, surpresas e música', async () => {
    const { services } = await setup();
    const alert = jest.spyOn(Alert, 'alert');
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Usar pacote pessoal' }));
    await act(async () => {
      await alert.mock.calls[0][2]!.find((o) => o.text === 'Aplicar')!.onPress!();
    });
    expect(screen.getByRole('button', { name: 'Início da preparação: Vamo acordar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Início do trabalho: Corneta' })).toBeTruthy();
    await waitFor(async () =>
      expect(await services.soundService.settingsForWorkout(planExampleWorkout())).toMatchObject({
        sounds: expect.objectContaining({
          restStart: 'pack-campainha-boxe',
          workoutEnd: 'pack-cabou',
        }),
        backgroundMusicId: 'pack-background-vibes',
        surpriseSounds: expect.arrayContaining(['pack-chicote', 'pack-vine-boom']),
      }),
    );
    alert.mockRestore();
  });

  it('o pacote aparece como categoria no seletor', async () => {
    const { services } = await setup();
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(await screen.findByRole('button', { name: /Início do trabalho:/ }));
    expect(screen.getByRole('header', { name: 'PACOTE PESSOAL' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Pegasus Fantasy' })).toBeTruthy();
  });

  it('nos sons de um treino o botão não aparece', async () => {
    const { services } = await setup();
    const workout = planExampleWorkout();
    await services.workouts.save(workout, null);
    await renderWithServices(
      <SoundSettingsScreen scope={{ type: 'workout', workoutId: workout.id }} />,
      services,
    );
    await screen.findByText(/Usando os sons globais/);
    expect(screen.queryByRole('button', { name: 'Usar pacote pessoal' })).toBeNull();
  });
});

describe('SoundSettingsScreen — seletor por categoria', () => {
  it('mostra os sons agrupados (ringue, alertas) e permite escolher o sino de ringue', async () => {
    const { services } = await setup();
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Início do trabalho: Largada (padrão)' }),
    );
    expect(screen.getByRole('header', { name: 'SINAIS DE TREINO' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'RINGUE E LUTA' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'ALERTAS SONOROS' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'MEUS SONS' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir Sino de ringue' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Sino de ringue' }));
    expect(screen.getByRole('button', { name: 'Início do trabalho: Sino de ringue' })).toBeTruthy();
    await waitFor(async () =>
      expect((await services.soundConfigs.getById(GLOBAL_SOUND_CONFIG_ID))?.sounds.workStart).toBe(
        'ring-bell',
      ),
    );
  });

  it('o "Silencioso" aparece uma única vez', async () => {
    const { services } = await setup();
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, services);
    await fireEvent.press(await screen.findByRole('button', { name: /Fim do treino:/ }));
    expect(screen.getAllByRole('radio', { name: 'Silencioso' })).toHaveLength(1);
  });
});

describe('SoundSettingsScreen — gravar som (até 3 s)', () => {
  async function openRecorder() {
    const ctx = await setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, ctx.services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Gravar som' }));
    expect(screen.getByRole('header', { name: 'Gravar som' })).toBeTruthy();
    return { ...ctx, alert };
  }

  afterEach(() => jest.restoreAllMocks());

  it('grava, ouve, dá nome e salva: o som entra em "Meus sons" e no seletor', async () => {
    const { services, fake, alert } = await openRecorder();
    await fireEvent.press(screen.getByRole('button', { name: 'Gravar' }));
    expect(screen.getByText(/Gravando/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
    expect(screen.getByText('2,1 s / 3,0 s')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir' }));
    expect(recorderControl.played).toBe(1);
    // Ouvir vira Pausar enquanto toca
    await fireEvent.press(screen.getByRole('button', { name: 'Pausar' }));
    expect(screen.getByRole('button', { name: 'Ouvir' })).toBeTruthy();
    expect(screen.queryByText(/[●■▶]/u)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Nome do som'), 'Grito de guerra');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar som' }));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Som gravado', expect.stringContaining('Grito de guerra')),
    );
    expect(await screen.findByRole('button', { name: 'Ouvir Grito de guerra' })).toBeTruthy();
    expect(fake.state.removed).toContain('file:///cache/rec.m4a');
    const mine = (await services.soundService.library()).filter((s) => s.source === 'user');
    expect(mine).toHaveLength(1);
    expect(mine[0].uri).toMatch(/^file:\/\/\/sounds\/.+\.m4a$/);

    await fireEvent.press(screen.getByRole('button', { name: /Início do trabalho:/ }));
    expect(screen.getByRole('header', { name: 'MEUS SONS' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Grito de guerra' })).toBeTruthy();
  });

  it('sem nome digitado, salva com o nome sugerido', async () => {
    const { services } = await openRecorder();
    await fireEvent.press(screen.getByRole('button', { name: 'Gravar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
    expect(screen.getByLabelText('Nome do som').props.placeholder).toBe('Gravação 1');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar som' }));
    expect(await screen.findByRole('button', { name: 'Ouvir Gravação 1' })).toBeTruthy();
    expect((await services.soundService.library()).at(-1)?.name).toBe('Gravação 1');
  });

  it('sugere o próximo nome livre a partir da biblioteca', async () => {
    const ctx = await setup();
    await ctx.services.sounds.addUserSound({ name: 'Gravação 1', uri: 'file:///g1.m4a' });
    await renderWithServices(<SoundSettingsScreen scope={{ type: 'global' }} />, ctx.services);
    await screen.findByRole('button', { name: 'Ouvir Gravação 1' });
    await fireEvent.press(screen.getByRole('button', { name: 'Gravar som' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Gravar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
    expect(screen.getByLabelText('Nome do som').props.placeholder).toBe('Gravação 2');
  });

  it('gravação curta demais é recusada e nada é salvo', async () => {
    const { services, alert } = await openRecorder();
    recorderControl.next = { uri: 'file:///cache/curta.m4a', durationMs: 100, sizeBytes: 500 };
    await fireEvent.press(screen.getByRole('button', { name: 'Gravar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar som' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Não foi possível salvar',
        expect.stringContaining('curta'),
      ),
    );
    expect((await services.soundService.library()).some((s) => s.source === 'user')).toBe(false);
    expect(screen.getByRole('button', { name: 'Gravar' })).toBeTruthy();
  });

  it('regravar descarta a gravação anterior', async () => {
    const { fake } = await openRecorder();
    await fireEvent.press(screen.getByRole('button', { name: 'Gravar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Regravar' }));
    expect(fake.state.removed).toContain('file:///cache/rec.m4a');
    expect(recorderControl.started).toBe(2);
    expect(screen.getByRole('button', { name: 'Parar' })).toBeTruthy();
  });

  it('cancelar depois de gravar descarta o arquivo e não salva', async () => {
    const { services, fake } = await openRecorder();
    await fireEvent.press(screen.getByRole('button', { name: 'Gravar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(fake.state.removed).toContain('file:///cache/rec.m4a');
    expect((await services.soundService.library()).some((s) => s.source === 'user')).toBe(false);
  });

  it('sem permissão de microfone, explica e oferece abrir os ajustes', async () => {
    await openRecorder();
    recorderControl.permission = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Gravar' }));
    expect(screen.getByText(/Sem acesso ao microfone/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir ajustes' })).toBeTruthy();
  });
});
