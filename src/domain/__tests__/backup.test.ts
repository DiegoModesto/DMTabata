import { planExampleWorkout } from '@/test/factories';

import { buildBackup, parseBackup, serializeBackup } from '../backup';
import { workoutTotals } from '../workout';

const known = new Set(['go', 'gong', 'silent']);

describe('backup — exportar e importar treinos', () => {
  it('ida e volta preserva a estrutura e os tempos, com ids novos', () => {
    const source = planExampleWorkout();
    source.cycles[0].items[2] = { ...source.cycles[0].items[2], workSoundId: 'gong' };
    const text = serializeBackup(buildBackup([source], 123));
    const parsed = parseBackup(text, { knownSoundIds: known, now: 999 });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [imported] = parsed.workouts;
    expect(imported.id).not.toBe(source.id);
    expect(imported.cycles[0].items[0].id).not.toBe(source.cycles[0].items[0].id);
    expect(imported.name).toBe('Treino de perna');
    expect(imported.cycles[0].items[2]).toMatchObject({ label: 'Prancha', workSec: 60, workSoundId: 'gong' });
    expect(workoutTotals(imported).totalSec).toBe(workoutTotals(source).totalSec);
    expect(imported.createdAt).toBe(999);
  });

  it('descarta sons que não existem neste aparelho e a configuração própria', () => {
    const source = { ...planExampleWorkout(), soundConfigId: 'cfg-de-outro-aparelho' };
    source.cycles[0].items[0] = { ...source.cycles[0].items[0], workSoundId: 'som-importado-la' };
    const parsed = parseBackup(serializeBackup(buildBackup([source])), { knownSoundIds: known });
    if (!parsed.ok) throw new Error();
    expect(parsed.workouts[0].soundConfigId).toBeNull();
    expect(parsed.workouts[0].cycles[0].items[0].workSoundId).toBeNull();
  });

  it('ignora treinos inválidos e informa quantos', () => {
    const valid = planExampleWorkout();
    const invalid = { ...planExampleWorkout(), name: '' };
    const text = JSON.stringify({ ...buildBackup([valid, invalid]), workouts: [valid, invalid, 'lixo'] });
    const parsed = parseBackup(text, { knownSoundIds: known });
    expect(parsed).toMatchObject({ ok: true, skipped: 2 });
    if (parsed.ok) expect(parsed.workouts).toHaveLength(1);
  });

  it('rejeita arquivos que não são backup', () => {
    expect(parseBackup('{oops', { knownSoundIds: known })).toEqual({
      ok: false,
      reason: 'Arquivo não é um JSON válido.',
    });
    expect(parseBackup('{"workouts": []}', { knownSoundIds: known })).toMatchObject({ ok: false });
    expect(
      parseBackup(JSON.stringify({ app: 'dmtabata', version: 99, workouts: [] }), { knownSoundIds: known }),
    ).toMatchObject({ ok: false, reason: expect.stringContaining('mais nova') });
  });

  it('campos ausentes recebem valores padrão seguros', () => {
    const text = JSON.stringify({
      app: 'dmtabata',
      version: 1,
      workouts: [{ name: 'Mínimo', cycles: [{ items: [{ label: 'A' }] }] }],
    });
    const parsed = parseBackup(text, { knownSoundIds: known });
    if (!parsed.ok) throw new Error();
    expect(parsed.workouts[0]).toMatchObject({ type: 'custom', prepareSec: 10, favorite: false });
    expect(parsed.workouts[0].cycles[0]).toMatchObject({ defaultWorkSec: 30, defaultRestSec: 10, repeatCount: 1 });
  });
});
