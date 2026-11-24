import type { Phase } from '../timeline';
import { alertsForEvents, DEFAULT_ALERT_SETTINGS, type AlertSettings } from '../alerts';

const phase = (kind: Phase['kind']): Phase => ({
  index: 0,
  kind,
  durationMs: 10_000,
  startOffsetMs: 0,
  label: 'X',
  cycleIndex: 0,
  totalCycles: 1,
  cycleName: 'C',
  itemIndex: 0,
  totalItems: 1,
  repeat: 1,
  totalRepeats: 1,
  nextWorkLabel: null,
  soundOverride: null,
});

const sounds = (settings: AlertSettings, events: Parameters<typeof alertsForEvents>[0]) =>
  alertsForEvents(events, settings)
    .filter((c) => c.type === 'sound')
    .map((c) => (c.type === 'sound' ? `${c.slot}:${c.soundId}` : ''));

describe('alertsForEvents — som no início do treino e do descanso', () => {
  it('trabalho toca o som de início de trabalho; descanso toca o de descanso', () => {
    expect(
      sounds(DEFAULT_ALERT_SETTINGS, [
        { type: 'phaseStarted', phase: phase('work') },
        { type: 'phaseStarted', phase: phase('rest') },
      ]),
    ).toEqual(['workStart:go', 'restStart:rest']);
  });

  it('preparação não toca som; contagem e fim tocam', () => {
    expect(
      sounds(DEFAULT_ALERT_SETTINGS, [
        { type: 'phaseStarted', phase: phase('prepare') },
        { type: 'countdown', secondsLeft: 3, phase: phase('prepare') },
        { type: 'finished', stoppedEarly: false },
      ]),
    ).toEqual(['countdown:beep', 'workoutEnd:finish']);
  });

  it('parar antes do fim não toca a fanfarra', () => {
    expect(sounds(DEFAULT_ALERT_SETTINGS, [{ type: 'finished', stoppedEarly: true }])).toEqual([]);
  });

  it('fim de ciclo sem som próprio usa o som de descanso', () => {
    const settings = {
      ...DEFAULT_ALERT_SETTINGS,
      sounds: { ...DEFAULT_ALERT_SETTINGS.sounds, cycleEnd: null },
    };
    expect(sounds(settings, [{ type: 'phaseStarted', phase: phase('cycleRest') }])).toEqual([
      'cycleEnd:rest',
    ]);
  });

  it('som null = silencioso; volume 0 desliga sons', () => {
    const silentWork = {
      ...DEFAULT_ALERT_SETTINGS,
      sounds: { ...DEFAULT_ALERT_SETTINGS.sounds, workStart: null },
    };
    expect(sounds(silentWork, [{ type: 'phaseStarted', phase: phase('work') }])).toEqual([]);
    expect(
      sounds({ ...DEFAULT_ALERT_SETTINGS, volume: 0 }, [
        { type: 'phaseStarted', phase: phase('work') },
      ]),
    ).toEqual([]);
  });

  it('vibra conforme o evento quando habilitado', () => {
    const commands = alertsForEvents(
      [{ type: 'phaseStarted', phase: phase('work') }],
      DEFAULT_ALERT_SETTINGS,
    );
    expect(commands).toContainEqual({ type: 'haptic', style: 'heavy' });
    const noHaptics = alertsForEvents([{ type: 'phaseStarted', phase: phase('work') }], {
      ...DEFAULT_ALERT_SETTINGS,
      hapticsEnabled: false,
    });
    expect(noHaptics.some((c) => c.type === 'haptic')).toBe(false);
  });

  it('repassa o volume configurado', () => {
    const [cmd] = alertsForEvents([{ type: 'phaseStarted', phase: phase('work') }], {
      ...DEFAULT_ALERT_SETTINGS,
      volume: 0.4,
    });
    expect(cmd).toMatchObject({ type: 'sound', volume: 0.4 });
  });
});

describe('sons por exercício (sobrescrita na fase)', () => {
  it('som do exercício substitui o do evento', () => {
    const work = { ...phase('work'), soundOverride: 'horn' };
    expect(sounds(DEFAULT_ALERT_SETTINGS, [{ type: 'phaseStarted', phase: work }])).toEqual([
      'workStart:horn',
    ]);
  });

  it('exercício "silencioso" não toca som, mas ainda vibra', () => {
    const work = { ...phase('work'), soundOverride: 'silent' };
    const commands = alertsForEvents([{ type: 'phaseStarted', phase: work }], DEFAULT_ALERT_SETTINGS);
    expect(commands.some((c) => c.type === 'sound')).toBe(false);
    expect(commands.some((c) => c.type === 'haptic')).toBe(true);
  });

  it('a sobrescrita não afeta contagem regressiva', () => {
    const work = { ...phase('work'), soundOverride: 'horn' };
    expect(
      sounds(DEFAULT_ALERT_SETTINGS, [{ type: 'countdown', secondsLeft: 2, phase: work }]),
    ).toEqual(['countdown:beep']);
  });
});

describe('narração por voz', () => {
  const voice = { ...DEFAULT_ALERT_SETTINGS, voiceEnabled: true };
  const speech = (settings: AlertSettings, events: Parameters<typeof alertsForEvents>[0]) =>
    alertsForEvents(events, settings)
      .filter((c) => c.type === 'speak')
      .map((c) => (c.type === 'speak' ? c.text : ''));

  it('desligada por padrão', () => {
    expect(speech(DEFAULT_ALERT_SETTINGS, [{ type: 'phaseStarted', phase: phase('work') }])).toEqual(
      [],
    );
  });

  it('anuncia exercício, descanso com próximo e fim', () => {
    const work = { ...phase('work'), label: 'Burpee' };
    const rest = { ...phase('rest'), nextWorkLabel: 'Agachamento' };
    expect(
      speech(voice, [
        { type: 'phaseStarted', phase: work },
        { type: 'phaseStarted', phase: rest },
        { type: 'halfway', phase: work },
        { type: 'finished', stoppedEarly: false },
      ]),
    ).toEqual(['Vai! Burpee.', 'Descanso. Próximo: Agachamento.', 'Metade.', 'Treino concluído!']);
  });

  it('sem "anunciar próximo" omite o próximo exercício', () => {
    const rest = { ...phase('rest'), nextWorkLabel: 'Agachamento' };
    expect(speech({ ...voice, announceNext: false }, [{ type: 'phaseStarted', phase: rest }])).toEqual(
      ['Descanso.'],
    );
  });

  it('usa o idioma configurado e não fala a contagem', () => {
    const commands = alertsForEvents(
      [
        { type: 'phaseStarted', phase: phase('cooldown') },
        { type: 'countdown', secondsLeft: 3, phase: phase('work') },
      ],
      { ...voice, voiceLang: 'en-US' },
    );
    expect(commands.filter((c) => c.type === 'speak')).toEqual([
      { type: 'speak', text: 'Desaquecimento.', lang: 'en-US' },
    ]);
  });
});
