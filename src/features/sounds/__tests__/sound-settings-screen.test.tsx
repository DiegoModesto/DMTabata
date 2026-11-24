import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { createSilentAlertPlayer } from '@/services/audio/alertPlayer';
import { GLOBAL_SOUND_CONFIG_ID } from '@/services/db/seed';
import { createFakeSoundImporter } from '@/test/fakeSoundImporter';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { SoundSettingsScreen } from '../sound-settings-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

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
    await fireEvent.press(await screen.findByRole('button', { name: 'Diminuir Volume dos alertas' }));
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
      expect(alert).toHaveBeenCalledWith('Não foi possível importar', expect.stringContaining('Formato')),
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
