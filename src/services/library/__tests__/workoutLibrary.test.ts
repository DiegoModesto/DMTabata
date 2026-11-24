import boxe from '@/assets/workouts/boxe-sequenciado.json';
import { emptySoundConfig } from '@/domain/soundConfig';
import { buildWorkoutFile, serializeWorkoutFile } from '@/domain/workoutFile';
import { createFakeBackupIO } from '@/test/fakeBackupIO';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices } from '@/test/renderWithServices';

import { SEEDED_BUNDLED_KEY, WORKOUT_MIME, WORKOUT_UTI } from '../workoutLibrary';

async function setup(bundled = [{ id: 'boxe-sequenciado', file: boxe as unknown }]) {
  const fake = createFakeBackupIO();
  const services = await createTestServices({ backupIO: fake.io, bundledWorkouts: bundled });
  await services.authStore.getState().signIn({ email: 'ana@x.com' });
  return { ...services, fake };
}

async function saveWithSounds(services: Awaited<ReturnType<typeof setup>>) {
  const workout = await services.workouts.save(planExampleWorkout({ name: 'Perna' }), null);
  const config = {
    ...emptySoundConfig('cfg-perna', 'Sons do treino'),
    sounds: { ...emptySoundConfig('x', 'x').sounds, workStart: 'pack-corneta' },
    backgroundMusicId: 'pack-background-vibes',
  };
  await services.soundConfigs.save(config);
  await services.workouts.setSoundConfig(workout.id, config.id);
  return workout;
}

describe('workoutLibrary — compartilhar', () => {
  it('gera "perna.dmtabata" com o treino e os sons, pelo menu do sistema', async () => {
    const s = await setup([]);
    const workout = await saveWithSounds(s);
    expect(await s.library.shareWorkout(workout.id)).toEqual({ droppedSounds: 0 });
    const [shared] = s.fake.state.shared;
    expect(shared.fileName).toBe('perna.dmtabata');
    expect(shared.options).toMatchObject({ mimeType: WORKOUT_MIME, uti: WORKOUT_UTI });
    const content = JSON.parse(shared.content);
    expect(content).toMatchObject({ app: 'dmtabata', kind: 'workout' });
    expect(content.workout.name).toBe('Perna');
    expect(content.sounds).toMatchObject({
      sounds: { workStart: 'pack-corneta' },
      backgroundMusicId: 'pack-background-vibes',
    });
  });

  it('avisa quantos sons importados ficaram de fora', async () => {
    const s = await setup([]);
    const mine = await s.sounds.addUserSound({ name: 'Grito', uri: 'file:///g.m4a' });
    const w = planExampleWorkout();
    w.cycles[0].items[0].workSoundId = mine.id;
    const saved = await s.workouts.save(w, null);
    expect(await s.library.shareWorkout(saved.id)).toEqual({ droppedSounds: 1 });
  });
});

describe('workoutLibrary — importar', () => {
  it('importa um treino recebido com os sons dele, como treino novo', async () => {
    const s = await setup([]);
    const source = await saveWithSounds(s);
    await s.library.shareWorkout(source.id);
    const result = await s.library.importText(s.fake.state.shared[0].content);
    if (result.status !== 'imported') throw new Error('esperava importar');
    expect(result.workout.id).not.toBe(source.id);
    expect(result.workout.name).toBe('Perna');
    const settings = await s.soundService.settingsForWorkout(result.workout);
    expect(settings.sounds.workStart).toBe('pack-corneta');
    expect(settings.backgroundMusicId).toBe('pack-background-vibes');
    expect(result.workout.soundConfigId).not.toBe(source.soundConfigId);
  });

  it('arquivo inválido devolve erro; cancelar a escolha não faz nada', async () => {
    const s = await setup([]);
    expect(await s.library.importText('{"app":"outro"}')).toMatchObject({ status: 'error' });
    expect(await s.library.importFromPicker()).toEqual({ status: 'canceled' });
  });

  it('importa pelo seletor de arquivos e por arquivo aberto de outro app', async () => {
    const s = await setup([]);
    const text = serializeWorkoutFile(
      buildWorkoutFile(planExampleWorkout({ name: 'Recebido' }), null, () => true).file,
    );
    s.fake.state.nextPick = text;
    expect(await s.library.importFromPicker()).toMatchObject({
      status: 'imported',
      workout: { name: 'Recebido' },
    });
    s.fake.state.files.set('file:///Inbox/x.dmtabata', text);
    expect(await s.library.readUri('file:///Inbox/x.dmtabata')).toBe(text);
  });
});

describe('workoutLibrary — modelos', () => {
  it('salvar como modelo aparece em "Meus modelos" e cria cópias independentes', async () => {
    const s = await setup([]);
    const source = await saveWithSounds(s);
    const template = await s.library.saveAsTemplate(source.id);
    expect(template).toMatchObject({
      source: 'user',
      name: 'Perna',
      cycleCount: 1,
      exerciseCount: 5,
    });
    expect(await s.library.templates()).toEqual([template]);

    const a = await s.library.createFromTemplate(template.id);
    const b = await s.library.createFromTemplate(template.id);
    expect(a.id).not.toBe(b.id);
    expect(a.soundConfigId).not.toBe(b.soundConfigId);
    expect((await s.soundService.settingsForWorkout(a)).sounds.workStart).toBe('pack-corneta');

    // Editar o treino original não muda o modelo
    await s.workouts.save({ ...source, name: 'Perna v2' }, null);
    expect((await s.library.templates())[0].name).toBe('Perna');
  });

  it('remover modelo não apaga os treinos', async () => {
    const s = await setup([]);
    const source = await saveWithSounds(s);
    const template = await s.library.saveAsTemplate(source.id);
    await s.library.removeTemplate(template.id);
    expect(await s.library.templates()).toEqual([]);
    expect(await s.workouts.getById(source.id)).not.toBeNull();
  });

  it('modelos do DMTabata (embutidos) vêm antes dos meus', async () => {
    const s = await setup();
    const source = await saveWithSounds(s);
    await s.library.saveAsTemplate(source.id);
    const list = await s.library.templates();
    expect(list.map((t) => [t.source, t.name])).toEqual([
      ['bundled', 'Boxe Sequenciado'],
      ['user', 'Perna'],
    ]);
  });
});

describe('workoutLibrary — treinos embutidos na lista', () => {
  const names = async (s: Awaited<ReturnType<typeof setup>>) =>
    (await s.workouts.listSummaries(s.authStore.getState().user!.id)).map((w) => w.name);

  it('adiciona o Boxe Sequenciado uma única vez, com os sons dele', async () => {
    const s = await setup();
    await s.workoutsStore.getState().load();
    await s.workoutsStore.getState().load();
    expect(await names(s)).toEqual(['Boxe Sequenciado']);
    const [summary] = s.workoutsStore.getState().summaries;
    const workout = (await s.workouts.getById(summary.id))!;
    expect((await s.soundService.settingsForWorkout(workout)).sounds.prepareStart).toBe(
      'pack-vamo-acordar',
    );
  });

  it('se o usuário apagar, ele não volta', async () => {
    const s = await setup();
    await s.workoutsStore.getState().load();
    const [summary] = s.workoutsStore.getState().summaries;
    await s.workoutsStore.getState().remove(summary.id);
    await s.workoutsStore.getState().load();
    expect(await names(s)).toEqual([]);
    expect(await s.settings.get(SEEDED_BUNDLED_KEY)).toEqual(['boxe-sequenciado']);
  });

  it('chamadas simultâneas não duplicam', async () => {
    const s = await setup();
    await Promise.all([
      s.library.ensureBundledWorkouts(),
      s.library.ensureBundledWorkouts(),
      s.workoutsStore.getState().load(),
    ]);
    expect(await names(s)).toEqual(['Boxe Sequenciado']);
  });

  it('sem usuário logado não adiciona nada', async () => {
    const fake = createFakeBackupIO();
    const s = await createTestServices({
      backupIO: fake.io,
      bundledWorkouts: [{ id: 'boxe-sequenciado', file: boxe }],
    });
    await s.library.ensureBundledWorkouts();
    expect(await s.settings.get(SEEDED_BUNDLED_KEY)).toBeNull();
  });
});
