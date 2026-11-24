import { BUILTIN_SOUNDS } from '@/domain/sounds';
import { emptySoundConfig } from '@/domain/soundConfig';
import { planExampleWorkout } from '@/test/factories';
import { createMigratedTestDatabase } from '@/test/sqliteTestDatabase';

import { createSoundConfigRepository } from '../repositories/soundConfigRepository';
import { createSoundRepository } from '../repositories/soundRepository';
import { createWorkoutRepository } from '../repositories/workoutRepository';
import { GLOBAL_SOUND_CONFIG_ID, seed } from '../seed';

async function setup() {
  const db = await createMigratedTestDatabase();
  await seed(db);
  let clock = 100;
  return {
    db,
    sounds: createSoundRepository(db, () => ++clock),
    configs: createSoundConfigRepository(db),
    workouts: createWorkoutRepository(db),
  };
}

describe('soundRepository', () => {
  it('lista embutidos (sem o "silencioso") e depois os do usuário', async () => {
    const { sounds } = await setup();
    await sounds.addUserSound({ name: 'Meu apito', uri: 'file:///a.mp3' });
    const list = await sounds.list();
    const n = BUILTIN_SOUNDS.length;
    expect(list).toHaveLength(n + 1);
    expect(list.slice(0, n).every((s) => s.source === 'builtin')).toBe(true);
    expect(list[0].id).toBe('go');
    expect(list[n]).toMatchObject({ name: 'Meu apito', source: 'user', uri: 'file:///a.mp3' });
  });

  it('renomeia só sons do usuário', async () => {
    const { sounds } = await setup();
    const mine = await sounds.addUserSound({ name: 'A', uri: 'file:///a.mp3' });
    await sounds.rename(mine.id, 'B');
    await sounds.rename('go', 'Hackeado');
    expect((await sounds.getById(mine.id))?.name).toBe('B');
    expect((await sounds.getById('go'))?.name).toBe('Largada');
  });

  it('não remove sons embutidos', async () => {
    const { sounds } = await setup();
    expect(await sounds.removeUserSound('go')).toBeNull();
    expect(await sounds.getById('go')).not.toBeNull();
  });

  it('remover som do usuário faz configurações e exercícios voltarem a herdar', async () => {
    const { sounds, configs, workouts } = await setup();
    const mine = await sounds.addUserSound({ name: 'A', uri: 'file:///a.mp3' });
    const config = emptySoundConfig('cfg', 'X');
    config.sounds.workStart = mine.id;
    await configs.save(config);
    const workout = planExampleWorkout();
    workout.cycles[0].items[0] = { ...workout.cycles[0].items[0], workSoundId: mine.id };
    await workouts.save(workout, null);

    await sounds.removeUserSound(mine.id);

    expect((await configs.getById('cfg'))?.sounds.workStart).toBeNull();
    expect((await workouts.getById(workout.id))?.cycles[0].items[0].workSoundId).toBeNull();
  });
});

describe('soundConfigRepository', () => {
  it('a configuração global semeada herda tudo', async () => {
    const { configs } = await setup();
    expect(await configs.getById(GLOBAL_SOUND_CONFIG_ID)).toEqual(
      emptySoundConfig(GLOBAL_SOUND_CONFIG_ID, 'Sons globais'),
    );
  });

  it('salva e recarrega todos os campos (inclusive booleanos e nulos)', async () => {
    const { configs } = await setup();
    const config = {
      ...emptySoundConfig('c1', 'Treino'),
      sounds: {
        prepareStart: 'ring-bell',
        workStart: 'whistle',
        restStart: 'silent',
        countdown: null,
        cycleEnd: 'gong',
        workoutEnd: 'finish',
        halfway: 'double-beep',
      },
      countdownFrom: 5,
      volume: 0.7,
      hapticsEnabled: false,
      halfwayAlert: true,
      voiceEnabled: true,
      voiceLang: 'en-US',
      announceNext: false,
      duckMusic: null,
      surpriseSounds: ['chicote', 'risada'],
      surpriseChance: 0.4,
      backgroundMusicId: 'vibes',
      musicVolume: 0.35,
    };
    await configs.save(config);
    expect(await configs.getById('c1')).toEqual(config);

    await configs.save({ ...config, volume: null, hapticsEnabled: null });
    expect(await configs.getById('c1')).toMatchObject({ volume: null, hapticsEnabled: null });

    await configs.save({ ...config, surpriseSounds: [], surpriseChance: null });
    expect(await configs.getById('c1')).toMatchObject({ surpriseSounds: [], surpriseChance: null });
    await configs.save({ ...config, surpriseSounds: null });
    expect((await configs.getById('c1'))?.surpriseSounds).toBeNull();
  });

  it('rejeita som inexistente (integridade referencial)', async () => {
    const { configs } = await setup();
    const config = emptySoundConfig('c2', 'X');
    config.sounds.workStart = 'nao-existe';
    await expect(configs.save(config)).rejects.toThrow();
  });
});

describe('workoutRepository + sons', () => {
  it('persiste os sons de cada exercício', async () => {
    const { workouts } = await setup();
    const workout = planExampleWorkout();
    workout.cycles[0].items[2] = {
      ...workout.cycles[0].items[2],
      workSoundId: 'horn',
      restSoundId: 'silent',
    };
    await workouts.save(workout, null);
    const item = (await workouts.getById(workout.id))!.cycles[0].items[2];
    expect(item).toMatchObject({ workSoundId: 'horn', restSoundId: 'silent' });
  });

  it('excluir o treino exclui sua configuração de sons, mas nunca a global', async () => {
    const { workouts, configs } = await setup();
    await configs.save(emptySoundConfig('own', 'Própria'));
    const a = { ...planExampleWorkout(), soundConfigId: 'own' };
    const b = { ...planExampleWorkout(), soundConfigId: GLOBAL_SOUND_CONFIG_ID };
    await workouts.save(a, null);
    await workouts.save(b, null);
    await workouts.remove(a.id);
    await workouts.remove(b.id);
    expect(await configs.getById('own')).toBeNull();
    expect(await configs.getById(GLOBAL_SOUND_CONFIG_ID)).not.toBeNull();
  });
});
