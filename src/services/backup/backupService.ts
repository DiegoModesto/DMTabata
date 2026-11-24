import { buildBackup, parseBackup, serializeBackup } from '@/domain/backup';
import type { SoundRepository } from '@/services/db/repositories/soundRepository';
import type { WorkoutRepository } from '@/services/db/repositories/workoutRepository';

import type { BackupIO } from './backupIO';

export type ImportOutcome =
  | { status: 'imported'; imported: number; skipped: number }
  | { status: 'error'; reason: string }
  | { status: 'canceled' };

export function createBackupService(deps: {
  workouts: WorkoutRepository;
  sounds: SoundRepository;
  io: BackupIO;
  getUserId: () => string | null;
  now?: () => number;
}) {
  const { workouts, sounds, io, getUserId, now = Date.now } = deps;

  return {
    /** Exporta todos os treinos do usuário. Retorna quantos foram exportados. */
    async exportAll(): Promise<number> {
      const list = await workouts.listFull(getUserId());
      const date = new Date(now()).toISOString().slice(0, 10);
      await io.share(`dmtabata-treinos-${date}.json`, serializeBackup(buildBackup(list, now())));
      return list.length;
    },

    async importFromFile(): Promise<ImportOutcome> {
      const text = await io.pickText();
      if (text === null) return { status: 'canceled' };
      const knownSoundIds = new Set((await sounds.list()).map((s) => s.id).concat('silent'));
      const parsed = parseBackup(text, { knownSoundIds, now: now() });
      if (!parsed.ok) return { status: 'error', reason: parsed.reason };
      for (const workout of parsed.workouts) await workouts.save(workout, getUserId());
      return { status: 'imported', imported: parsed.workouts.length, skipped: parsed.skipped };
    },
  };
}

export type BackupService = ReturnType<typeof createBackupService>;
