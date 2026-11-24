import boxe from '@/assets/workouts/boxe-sequenciado.json';
import { planExampleWorkout } from '@/test/factories';

import { emptySoundConfig } from '../soundConfig';
import { isBuiltinSoundId } from '../sounds';
import {
  buildWorkoutFile,
  importRouteForPath,
  parseWorkoutFile,
  serializeWorkoutFile,
  workoutFileName,
} from '../workoutFile';
import { workoutTotals } from '../workout';

const known = new Set(['go', 'whistle', 'pack-corneta', 'pack-cabou', 'pack-chicote']);

describe('arquivo de treino (.dmtabata) — ida e volta', () => {
  it('preserva a estrutura e os tempos, com ids novos', () => {
    const source = planExampleWorkout({ name: 'Perna' });
    const { file } = buildWorkoutFile(source, null, isBuiltinSoundId, 1);
    const parsed = parseWorkoutFile(serializeWorkoutFile(file), { knownSoundIds: known, now: 2 });
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.workout.name).toBe('Perna');
    expect(workoutTotals(parsed.workout).totalSec).toBe(workoutTotals(source).totalSec);
    expect(parsed.workout.id).not.toBe(source.id);
    expect(parsed.workout.cycles[0].items.map((i) => i.label)).toEqual(
      source.cycles[0].items.map((i) => i.label),
    );
    expect(parsed.sounds).toBeNull();
  });

  it('leva os sons do treino que existem em qualquer instalação', () => {
    const config = {
      ...emptySoundConfig('c', 'Sons'),
      sounds: {
        ...emptySoundConfig('c', 'S').sounds,
        workStart: 'pack-corneta',
        workoutEnd: 'silent',
      },
      surpriseSounds: ['pack-chicote'],
      backgroundMusicId: null,
      musicVolume: 0.8,
    };
    const { file, droppedSounds } = buildWorkoutFile(
      planExampleWorkout(),
      config,
      isBuiltinSoundId,
    );
    expect(droppedSounds).toBe(0);
    const parsed = parseWorkoutFile(file, { knownSoundIds: known });
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.sounds).toMatchObject({
      sounds: expect.objectContaining({ workStart: 'pack-corneta', workoutEnd: 'silent' }),
      surpriseSounds: ['pack-chicote'],
      musicVolume: 0.8,
      surpriseChance: null,
    });
  });

  it('sons importados pelo usuário não vão no arquivo e são contados', () => {
    const w = planExampleWorkout();
    w.cycles[0].items[0].workSoundId = 'meu-som-uuid';
    const config = {
      ...emptySoundConfig('c', 'Sons'),
      sounds: { ...emptySoundConfig('c', 'S').sounds, restStart: 'outro-uuid' },
      backgroundMusicId: 'musica-uuid',
    };
    const { file, droppedSounds } = buildWorkoutFile(w, config, isBuiltinSoundId);
    expect(droppedSounds).toBe(3);
    expect(file.workout.cycles[0].items[0].workSoundId).toBeNull();
    expect(file.sounds).toEqual({ sounds: {} });
  });

  it('som que não existe no aparelho de quem recebe vira padrão e é contado', () => {
    const { file } = buildWorkoutFile(
      planExampleWorkout(),
      {
        ...emptySoundConfig('c', 'S'),
        sounds: { ...emptySoundConfig('c', 'S').sounds, workStart: 'pack-novo-futuro' },
      },
      () => true,
    );
    const parsed = parseWorkoutFile(file, { knownSoundIds: known });
    expect(parsed).toMatchObject({ ok: true, missingSounds: 1 });
    if (parsed.ok) expect(parsed.sounds?.sounds.workStart).toBeNull();
  });

  it('recusa arquivos que não são treino, de versão futura ou inválidos', () => {
    expect(parseWorkoutFile('não é json', { knownSoundIds: known }).ok).toBe(false);
    expect(parseWorkoutFile({ app: 'dmtabata', workouts: [] }, { knownSoundIds: known }).ok).toBe(
      false,
    );
    expect(
      parseWorkoutFile(
        { app: 'dmtabata', kind: 'workout', version: 99, workout: {} },
        { knownSoundIds: known },
      ),
    ).toMatchObject({ ok: false, reason: expect.stringContaining('mais nova') });
    expect(
      parseWorkoutFile(
        { app: 'dmtabata', kind: 'workout', version: 1, workout: { name: '', cycles: [] } },
        { knownSoundIds: known },
      ).ok,
    ).toBe(false);
  });

  it('preparação abaixo do mínimo sobe para 16 s ao importar', () => {
    const { file } = buildWorkoutFile(planExampleWorkout(), null, isBuiltinSoundId);
    file.workout.prepareSec = 5;
    const parsed = parseWorkoutFile(file, { knownSoundIds: known });
    expect(parsed.ok && parsed.workout.prepareSec).toBe(16);
  });
});

describe('nome do arquivo e abertura por outros apps', () => {
  it('gera nome sem acentos nem espaços', () => {
    expect(workoutFileName('Boxe Sequenciado')).toBe('boxe-sequenciado.dmtabata');
    expect(workoutFileName('Pêndulo & Esquiva!')).toBe('pendulo-esquiva.dmtabata');
    expect(workoutFileName('   ')).toBe('treino.dmtabata');
  });

  it('arquivo .dmtabata aberto vai para a tela de importar; outros caminhos não', () => {
    const uri = 'file:///private/var/mobile/Inbox/boxe sequenciado.dmtabata';
    expect(importRouteForPath(uri)).toBe(`/import?uri=${encodeURIComponent(uri)}`);
    expect(importRouteForPath('/var/x/TREINO.DMTABATA')).toContain('/import?uri=');
    expect(importRouteForPath('dmtabata://workout/123')).toBeNull();
    expect(importRouteForPath('file:///x/foto.jpg')).toBeNull();
  });
});

describe('treino embutido: Boxe Sequenciado', () => {
  it('é um arquivo válido com 4 ciclos, 17 exercícios e os sons do pacote', () => {
    const parsed = parseWorkoutFile(boxe, {
      knownSoundIds: new Set(['pack-vamo-acordar', 'pack-para-para']),
    });
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.workout.name).toBe('Boxe Sequenciado');
    expect(parsed.workout.cycles.map((c) => c.name)).toEqual([
      'Aquecimento',
      'Cruzados',
      'Ganchos',
      'Esquivas',
    ]);
    expect(parsed.workout.cycles.reduce((n, c) => n + c.items.length, 0)).toBe(17);
    expect(parsed.sounds?.sounds.prepareStart).toBe('pack-vamo-acordar');
    expect(parsed.missingSounds).toBe(0);
  });
});
