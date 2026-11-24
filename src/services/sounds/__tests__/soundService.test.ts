import { createSilentAlertPlayer } from '@/services/audio/alertPlayer';
import { GLOBAL_SOUND_CONFIG_ID } from '@/services/db/seed';
import { createFakeSoundImporter } from '@/test/fakeSoundImporter';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices } from '@/test/renderWithServices';

async function setup() {
  const alertPlayer = createSilentAlertPlayer();
  const fake = createFakeSoundImporter();
  const services = await createTestServices({ alertPlayer, soundImporter: fake.importer });
  const workout = planExampleWorkout();
  await services.workouts.save(workout, null);
  return { ...services, fake, workout, alertPlayer };
}

describe('soundService — importação', () => {
  it('cancelar a seleção não faz nada', async () => {
    const { soundService } = await setup();
    expect(await soundService.importSound()).toEqual({ status: 'canceled' });
  });

  it('rejeita formato inválido sem copiar o arquivo', async () => {
    const { soundService, fake } = await setup();
    fake.state.nextPick = { fileName: 'filme.mp4', sizeBytes: 10, handle: null };
    expect(await soundService.importSound()).toMatchObject({ status: 'rejected' });
    expect(fake.state.stored.size).toBe(0);
  });

  it('importa, salva na biblioteca e registra no player', async () => {
    const { soundService, fake, alertPlayer } = await setup();
    fake.state.nextPick = { fileName: 'grito_de_guerra.m4a', sizeBytes: 30_000, handle: null };
    const result = await soundService.importSound();
    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.sound).toMatchObject({ name: 'grito de guerra', source: 'user' });
    expect(result.sound.uri).toBe(`file:///sounds/${result.sound.id}.m4a`);
    expect(alertPlayer.sources[result.sound.id]).toBe(result.sound.uri);
    expect((await soundService.library()).some((s) => s.id === result.sound.id)).toBe(true);
  });

  it('remover apaga o arquivo; sons embutidos não podem ser removidos', async () => {
    const { soundService, fake } = await setup();
    fake.state.nextPick = { fileName: 'a.wav', sizeBytes: 10, handle: null };
    const result = await soundService.importSound();
    if (result.status !== 'imported') throw new Error('esperava importar');
    expect(await soundService.removeSound(result.sound.id)).toBe(true);
    expect(fake.state.removed).toEqual([result.sound.uri]);
    expect(await soundService.removeSound('go')).toBe(false);
  });

  it('registerUserSources disponibiliza sons já importados ao abrir o app', async () => {
    const { soundService, sounds, alertPlayer } = await setup();
    const mine = await sounds.addUserSound({ name: 'X', uri: 'file:///x.mp3' });
    await soundService.registerUserSources();
    expect(alertPlayer.sources).toEqual({ [mine.id]: 'file:///x.mp3' });
  });
});

describe('soundService — configurações em camadas', () => {
  it('treino novo usa os sons globais', async () => {
    const { soundService, workout } = await setup();
    expect(await soundService.workoutConfig(workout.id)).toBeNull();
    const global = await soundService.globalConfig();
    await soundService.saveConfig({ ...global, sounds: { ...global.sounds, workStart: 'whistle' } });
    const settings = await soundService.settingsForWorkout(workout);
    expect(settings.sounds.workStart).toBe('whistle');
  });

  it('personalizar cria configuração própria que sobrescreve a global', async () => {
    const { soundService, workouts, workout } = await setup();
    const global = await soundService.globalConfig();
    await soundService.saveConfig({ ...global, sounds: { ...global.sounds, workStart: 'whistle' }, volume: 0.5 });

    const own = await soundService.personalizeWorkout(workout.id);
    expect(await soundService.personalizeWorkout(workout.id)).toEqual(own); // idempotente
    await soundService.saveConfig({ ...own, sounds: { ...own.sounds, workStart: 'horn' } });

    const reloaded = (await workouts.getById(workout.id))!;
    expect(reloaded.soundConfigId).toBe(own.id);
    const settings = await soundService.settingsForWorkout(reloaded);
    expect(settings.sounds.workStart).toBe('horn');
    expect(settings.volume).toBe(0.5); // herdado do global
  });

  it('voltar ao global descarta a configuração do treino', async () => {
    const { soundService, soundConfigs, workouts, workout } = await setup();
    const own = await soundService.personalizeWorkout(workout.id);
    await soundService.useGlobalForWorkout(workout.id);
    expect((await workouts.getById(workout.id))!.soundConfigId).toBeNull();
    expect(await soundConfigs.getById(own.id)).toBeNull();
    expect(await soundConfigs.getById(GLOBAL_SOUND_CONFIG_ID)).not.toBeNull();
  });
});
