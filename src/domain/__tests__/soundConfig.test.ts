import { DEFAULT_ALERT_SETTINGS, SILENT_SOUND_ID } from '../alerts';
import {
  applySoundConfig,
  emptySoundConfig,
  hasOverrides,
  resolveAlertSettings,
  soundsInUse,
} from '../soundConfig';

const layer = (changes: Partial<ReturnType<typeof emptySoundConfig>> = {}) => ({
  ...emptySoundConfig('x', 'X'),
  ...changes,
});

describe('resolveAlertSettings — camadas padrão → global → treino', () => {
  it('sem camadas = padrão do app', () => {
    expect(resolveAlertSettings()).toEqual(DEFAULT_ALERT_SETTINGS);
    expect(resolveAlertSettings(null, undefined)).toEqual(DEFAULT_ALERT_SETTINGS);
  });

  it('camada vazia herda tudo', () => {
    expect(resolveAlertSettings(layer())).toEqual(DEFAULT_ALERT_SETTINGS);
  });

  it('a última camada vence; campos nulos herdam da anterior', () => {
    const global = layer({
      sounds: { ...layer().sounds, workStart: 'whistle', restStart: 'bell' },
      volume: 0.5,
    });
    const workout = layer({ sounds: { ...layer().sounds, workStart: 'horn' } });
    const settings = resolveAlertSettings(global, workout);
    expect(settings.sounds.workStart).toBe('horn');
    expect(settings.sounds.restStart).toBe('bell');
    expect(settings.sounds.countdown).toBe(DEFAULT_ALERT_SETTINGS.sounds.countdown);
    expect(settings.volume).toBe(0.5);
  });

  it('"silencioso" desliga o som (diferente de herdar)', () => {
    const settings = resolveAlertSettings(
      layer({ sounds: { ...layer().sounds, countdown: SILENT_SOUND_ID } }),
    );
    expect(settings.sounds.countdown).toBeNull();
  });

  it('treino pode religar o que o global desligou', () => {
    const global = layer({ hapticsEnabled: false, voiceEnabled: false });
    const workout = layer({ voiceEnabled: true });
    const settings = resolveAlertSettings(global, workout);
    expect(settings).toMatchObject({ hapticsEnabled: false, voiceEnabled: true });
  });

  it('limita volume (0..1) e contagem (0..10)', () => {
    expect(resolveAlertSettings(layer({ volume: 3, countdownFrom: 50 }))).toMatchObject({
      volume: 1,
      countdownFrom: 10,
    });
    expect(resolveAlertSettings(layer({ volume: -1, countdownFrom: -2 }))).toMatchObject({
      volume: 0,
      countdownFrom: 0,
    });
  });

  it('applySoundConfig aplica sobre uma base qualquer', () => {
    const base = { ...DEFAULT_ALERT_SETTINGS, volume: 0.3 };
    expect(applySoundConfig(base, null)).toBe(base);
    expect(applySoundConfig(base, layer()).volume).toBe(0.3);
  });
});

describe('soundsInUse', () => {
  it('lista sons únicos, sem silencioso/nulos, incluindo os dos exercícios', () => {
    const settings = resolveAlertSettings(
      layer({ sounds: { ...layer().sounds, halfway: SILENT_SOUND_ID } }),
    );
    expect(soundsInUse(settings, ['horn', null, 'go', SILENT_SOUND_ID]).sort()).toEqual(
      ['bell', 'beep', 'finish', 'go', 'horn', 'rest'].sort(),
    );
  });
});

describe('hasOverrides', () => {
  it('detecta qualquer campo preenchido', () => {
    expect(hasOverrides(layer())).toBe(false);
    expect(hasOverrides(layer({ volume: 0.2 }))).toBe(true);
    expect(hasOverrides(layer({ sounds: { ...layer().sounds, cycleEnd: 'gong' } }))).toBe(true);
  });
});

describe('sons surpresa nas camadas de configuração', () => {
  it('padrão: lista vazia e chance de 30%', () => {
    const s = resolveAlertSettings();
    expect(s.surpriseSounds).toEqual([]);
    expect(s.surpriseChance).toBe(0.3);
  });

  it('treino herda a lista global (null) ou a substitui; [] desliga só no treino', () => {
    const global = {
      ...emptySoundConfig('g', 'G'),
      surpriseSounds: ['a', 'b'],
      surpriseChance: 0.5,
    };
    const inherits = emptySoundConfig('w', 'W');
    const replaces = { ...emptySoundConfig('w', 'W'), surpriseSounds: ['c'] };
    const off = { ...emptySoundConfig('w', 'W'), surpriseSounds: [] };
    expect(resolveAlertSettings(global, inherits)).toMatchObject({
      surpriseSounds: ['a', 'b'],
      surpriseChance: 0.5,
    });
    expect(resolveAlertSettings(global, replaces).surpriseSounds).toEqual(['c']);
    expect(resolveAlertSettings(global, off).surpriseSounds).toEqual([]);
  });

  it('chance fica entre 0 e 1 e a lista é limpa', () => {
    const layer = {
      ...emptySoundConfig('g', 'G'),
      surpriseSounds: ['a', 'a', 'silent'],
      surpriseChance: 3,
    };
    expect(resolveAlertSettings(layer)).toMatchObject({ surpriseSounds: ['a'], surpriseChance: 1 });
  });

  it('sons surpresa entram no pré-carregamento', () => {
    const s = resolveAlertSettings({ ...emptySoundConfig('g', 'G'), surpriseSounds: ['x'] });
    expect(soundsInUse(s)).toContain('x');
  });
});

describe('música de fundo nas camadas', () => {
  it('padrão: sem música, volume 35% (abaixo dos alertas)', () => {
    expect(resolveAlertSettings()).toMatchObject({ backgroundMusicId: null, musicVolume: 0.35 });
  });

  it('treino herda a música global, troca por outra ou desliga com "silencioso"', () => {
    const global = { ...emptySoundConfig('g', 'G'), backgroundMusicId: 'vibes', musicVolume: 0.5 };
    expect(resolveAlertSettings(global, emptySoundConfig('w', 'W'))).toMatchObject({
      backgroundMusicId: 'vibes',
      musicVolume: 0.5,
    });
    expect(
      resolveAlertSettings(global, { ...emptySoundConfig('w', 'W'), backgroundMusicId: 'outra' })
        .backgroundMusicId,
    ).toBe('outra');
    expect(
      resolveAlertSettings(global, {
        ...emptySoundConfig('w', 'W'),
        backgroundMusicId: SILENT_SOUND_ID,
      }).backgroundMusicId,
    ).toBeNull();
  });

  it('música entra no pré-carregamento e o volume fica entre 0 e 1', () => {
    const s = resolveAlertSettings({
      ...emptySoundConfig('g', 'G'),
      backgroundMusicId: 'vibes',
      musicVolume: 7,
    });
    expect(soundsInUse(s)).toContain('vibes');
    expect(s.musicVolume).toBe(1);
  });
});
