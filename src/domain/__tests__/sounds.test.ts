import { SILENT_SOUND_ID } from '../alerts';
import fs from 'node:fs';
import path from 'node:path';

import { notificationSound } from '../notificationPlan';

import {
  BUILTIN_SOUNDS,
  checkImport,
  checkRecording,
  groupSounds,
  IMPORT_LIMITS,
  isPackSoundId,
  PERSONAL_PACK_PRESET,
  nextRecordingName,
  RECORDING_LIMITS,
  recordingExtension,
  rebaseDocumentUri,
  recordingName,
  SOUND_CATEGORY_ORDER,
  soundCategory,
  soundName,
  type SoundEntry,
} from '../sounds';

describe('checkImport — regras para importar sons', () => {
  it('aceita formatos de áudio comuns e gera nome legível', () => {
    expect(checkImport({ fileName: 'meu_apito-forte.MP3', sizeBytes: 20_000 })).toEqual({
      ok: true,
      name: 'meu apito forte',
      extension: 'mp3',
    });
    for (const ext of IMPORT_LIMITS.extensions) {
      expect(checkImport({ fileName: `a.${ext}`, sizeBytes: 10 }).ok).toBe(true);
    }
  });

  it('rejeita formatos não suportados', () => {
    const result = checkImport({ fileName: 'video.mp4', sizeBytes: 10 });
    expect(result).toMatchObject({ ok: false });
    expect(checkImport({ fileName: 'semextensao', sizeBytes: 10 }).ok).toBe(false);
  });

  it('rejeita arquivos acima de 1 MB e vazios', () => {
    expect(checkImport({ fileName: 'a.wav', sizeBytes: IMPORT_LIMITS.maxBytes + 1 })).toMatchObject(
      {
        ok: false,
        reason: expect.stringContaining('1 MB'),
      },
    );
    expect(checkImport({ fileName: 'a.wav', sizeBytes: 0 }).ok).toBe(false);
    expect(checkImport({ fileName: 'a.wav', sizeBytes: IMPORT_LIMITS.maxBytes }).ok).toBe(true);
  });

  it('tamanho desconhecido é aceito; nome vazio vira "Meu som"; nome longo é cortado', () => {
    expect(checkImport({ fileName: '.wav', sizeBytes: null })).toMatchObject({
      ok: true,
      name: 'Meu som',
    });
    const long = checkImport({ fileName: `${'x'.repeat(80)}.wav`, sizeBytes: 1 });
    expect(long.ok && long.name.length).toBe(IMPORT_LIMITS.maxNameLength);
  });
});

describe('soundName', () => {
  const library: SoundEntry[] = BUILTIN_SOUNDS.map((s) => ({
    ...s,
    source: 'builtin',
    uri: `builtin:${s.id}`,
    createdAt: 0,
  }));

  it('resolve nomes, silencioso e sons removidos', () => {
    expect(soundName('whistle', library)).toBe('Apito');
    expect(soundName(SILENT_SOUND_ID, library)).toBe('Silencioso');
    expect(soundName(null, library)).toBe('Silencioso');
    expect(soundName('apagado', library)).toBe('Som removido');
  });
});

describe('catálogo de sons embutidos', () => {
  it('ids são únicos e todos têm categoria e nome', () => {
    const ids = BUILTIN_SOUNDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of BUILTIN_SOUNDS) {
      expect(s.name.trim()).not.toBe('');
      expect(SOUND_CATEGORY_ORDER).toContain(s.category);
      expect(s.category).not.toBe('user');
    }
  });

  it('tem sinais de ringue de boxe e alertas sonoros', () => {
    const fight = BUILTIN_SOUNDS.filter((s) => s.category === 'fight').map((s) => s.id);
    expect(fight).toEqual(expect.arrayContaining(['ring-bell', 'ring-bell-3', 'clapper']));
    const alerts = BUILTIN_SOUNDS.filter((s) => s.category === 'alerts').map((s) => s.id);
    expect(alerts).toEqual(expect.arrayContaining(['alarm', 'siren', 'chime', 'beep']));
  });

  it('todo som embutido tem arquivo em assets e está registrado para notificações', () => {
    const root = path.join(__dirname, '..', '..', '..');
    const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    const plugin = appJson.expo.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === 'expo-notifications',
    );
    const registered: string[] = plugin[1].sounds;
    for (const s of BUILTIN_SOUNDS) {
      if (isPackSoundId(s.id)) {
        // mp3 do pacote: arquivo existe; notificações usam o som padrão (iOS não aceita mp3)
        const file = `./assets/sounds/pack/${s.id.replace(/^pack-/, '')}.mp3`;
        expect(fs.existsSync(path.join(root, file))).toBe(true);
        continue;
      }
      const file = `./assets/sounds/${s.id}.wav`;
      expect(registered).toContain(file);
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    }
  });
});

describe('agrupamento por categoria', () => {
  const entry = (id: string, source: 'builtin' | 'user', name = id): SoundEntry => ({
    id,
    name,
    source,
    uri: source === 'builtin' ? `builtin:${id}` : `file:///${id}.m4a`,
    createdAt: 0,
  });

  it('classifica embutidos pelo catálogo e os do usuário como "Meus sons"', () => {
    expect(soundCategory(entry('ring-bell', 'builtin'))).toBe('fight');
    expect(soundCategory(entry('go', 'builtin'))).toBe('training');
    expect(soundCategory(entry('alarm', 'builtin'))).toBe('alerts');
    expect(soundCategory(entry('abc', 'user'))).toBe('user');
    // id embutido desconhecido (ex.: de versão futura) cai em alertas
    expect(soundCategory(entry('misterio', 'builtin'))).toBe('alerts');
  });

  it('agrupa na ordem de exibição e omite grupos vazios', () => {
    const groups = groupSounds([
      entry('alarm', 'builtin'),
      entry('rec', 'user', 'Gravação 1'),
      entry('ring-bell', 'builtin'),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Ringue e luta', 'Alertas sonoros', 'Meus sons']);
    expect(groups[2].sounds.map((s) => s.name)).toEqual(['Gravação 1']);
  });
});

describe('checkRecording — regras da gravação pelo microfone', () => {
  it('aceita gravações entre o mínimo e 3 segundos', () => {
    expect(checkRecording({ durationMs: 1500, sizeBytes: 20_000 })).toEqual({ ok: true });
    expect(checkRecording({ durationMs: RECORDING_LIMITS.minMs, sizeBytes: null }).ok).toBe(true);
    expect(checkRecording({ durationMs: RECORDING_LIMITS.maxMs, sizeBytes: 1 }).ok).toBe(true);
  });

  it('tolera o pequeno atraso do gravador ao parar no limite', () => {
    expect(checkRecording({ durationMs: 3200, sizeBytes: 1 }).ok).toBe(true);
    expect(checkRecording({ durationMs: 3600, sizeBytes: 1 })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('3 segundos'),
    });
  });

  it('rejeita toque acidental, duração inválida, arquivo vazio ou grande demais', () => {
    expect(checkRecording({ durationMs: 120, sizeBytes: 100 }).ok).toBe(false);
    expect(checkRecording({ durationMs: Number.NaN, sizeBytes: 100 }).ok).toBe(false);
    expect(checkRecording({ durationMs: 1000, sizeBytes: 0 }).ok).toBe(false);
    expect(checkRecording({ durationMs: 1000, sizeBytes: RECORDING_LIMITS.maxBytes + 1 }).ok).toBe(
      false,
    );
  });
});

describe('nomes e extensão das gravações', () => {
  it('sugere o próximo "Gravação N" livre (sem diferenciar maiúsculas)', () => {
    expect(nextRecordingName([])).toBe('Gravação 1');
    expect(nextRecordingName([{ name: 'Gravação 1' }, { name: 'gravação 2 ' }])).toBe('Gravação 3');
    expect(nextRecordingName([{ name: 'Gravação 2' }])).toBe('Gravação 1');
  });

  it('usa o nome digitado limpo, ou o sugerido se vazio, com limite de tamanho', () => {
    expect(recordingName('  Grito   de  guerra ', 'Gravação 1')).toBe('Grito de guerra');
    expect(recordingName('   ', 'Gravação 4')).toBe('Gravação 4');
    expect(recordingName('x'.repeat(90), 'G')).toHaveLength(IMPORT_LIMITS.maxNameLength);
  });

  it('extrai a extensão da uri e cai em m4a quando desconhecida', () => {
    expect(recordingExtension('file:///tmp/rec-1.M4A')).toBe('m4a');
    expect(recordingExtension('file:///tmp/rec.wav?x=1')).toBe('wav');
    expect(recordingExtension('file:///tmp/rec.3gp')).toBe('m4a');
    expect(recordingExtension('file:///tmp/semextensao')).toBe('m4a');
  });
});

describe('rebaseDocumentUri — pasta do app mudou de caminho', () => {
  const now = 'file:///var/mobile/Containers/Data/Application/NOVO/Documents/';

  it('reancora sons salvos com o caminho antigo na pasta atual', () => {
    expect(
      rebaseDocumentUri(
        'file:///var/mobile/Containers/Data/Application/VELHO/Documents/sounds/a.mp3',
        now,
      ),
    ).toBe(`${now}sounds/a.mp3`);
  });

  it('aceita a pasta atual com ou sem barra final', () => {
    expect(rebaseDocumentUri('file:///x/Documents/sounds/b.m4a', now.slice(0, -1))).toBe(
      `${now}sounds/b.m4a`,
    );
  });

  it('não mexe em sons embutidos nem em arquivos fora de Documents', () => {
    expect(rebaseDocumentUri('builtin:gong', now)).toBe('builtin:gong');
    expect(rebaseDocumentUri('file:///tmp/rec.m4a', now)).toBe('file:///tmp/rec.m4a');
  });
});

describe('pacote pessoal', () => {
  const ids = new Set(BUILTIN_SOUNDS.map((s) => s.id as string));

  it('18 sons em "Pacote pessoal", com crédito registrado', () => {
    const pack = BUILTIN_SOUNDS.filter((s) => s.category === 'pack');
    expect(pack).toHaveLength(18);
    expect(pack.every((s) => isPackSoundId(s.id))).toBe(true);
    const root = path.join(__dirname, '..', '..', '..');
    const credits = fs.readFileSync(path.join(root, 'assets/sounds/pack/CREDITOS.md'), 'utf8');
    expect(credits).toContain('MyInstants');
    for (const s of pack) expect(credits).toContain(s.name);
  });

  it('a configuração do pacote só usa sons que existem no catálogo', () => {
    for (const id of Object.values(PERSONAL_PACK_PRESET.sounds)) expect(ids.has(id)).toBe(true);
    for (const id of PERSONAL_PACK_PRESET.surpriseSounds) expect(ids.has(id)).toBe(true);
    expect(ids.has(PERSONAL_PACK_PRESET.backgroundMusicId)).toBe(true);
    expect(PERSONAL_PACK_PRESET.surpriseSounds).toHaveLength(12);
  });

  it('sons do pacote viram "default" nas notificações; .wav embutidos continuam', () => {
    expect(notificationSound('pack-corneta')).toBe('default');
    expect(notificationSound('ring-bell')).toBe('ring-bell.wav');
  });
});
