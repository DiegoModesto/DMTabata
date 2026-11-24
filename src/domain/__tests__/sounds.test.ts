import { SILENT_SOUND_ID } from '../alerts';
import { BUILTIN_SOUNDS, checkImport, IMPORT_LIMITS, soundName, type SoundEntry } from '../sounds';

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
    expect(checkImport({ fileName: 'a.wav', sizeBytes: IMPORT_LIMITS.maxBytes + 1 })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('1 MB'),
    });
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
