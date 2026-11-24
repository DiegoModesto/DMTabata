import { createMusicDucking, MUSIC_DUCK_LEVEL } from '../musicDucking';

function setup() {
  const applied: number[] = [];
  const ducking = createMusicDucking((f) => applied.push(f));
  return { ducking, applied };
}

describe('musicDucking — música abaixa só quando outro áudio toca', () => {
  it('começa no volume cheio e abaixa enquanto um alerta toca', () => {
    const { ducking, applied } = setup();
    expect(ducking.factor()).toBe(1);
    ducking.started('corneta');
    expect(ducking.factor()).toBe(MUSIC_DUCK_LEVEL);
    ducking.ended('corneta');
    expect(ducking.factor()).toBe(1);
    expect(applied).toEqual([MUSIC_DUCK_LEVEL, 1]);
  });

  it('com vários áudios ao mesmo tempo, só volta quando o último termina', () => {
    const { ducking } = setup();
    ducking.started('campainha');
    ducking.started('surpresa');
    ducking.ended('campainha');
    expect(ducking.factor()).toBe(MUSIC_DUCK_LEVEL);
    ducking.ended('surpresa');
    expect(ducking.factor()).toBe(1);
  });

  it('retenção dos segundos finais mantém abaixada entre os bipes', () => {
    const { ducking } = setup();
    ducking.hold();
    ducking.started('bipe');
    ducking.ended('bipe'); // intervalo entre bipes
    expect(ducking.factor()).toBe(MUSIC_DUCK_LEVEL);
    ducking.release();
    expect(ducking.factor()).toBe(1);
  });

  it('liberar a retenção com o som da nova fase tocando continua abaixada até ele acabar', () => {
    const { ducking } = setup();
    ducking.hold();
    ducking.started('corneta');
    ducking.release();
    expect(ducking.factor()).toBe(MUSIC_DUCK_LEVEL);
    ducking.ended('corneta');
    expect(ducking.factor()).toBe(1);
  });

  it('não reaplica o mesmo volume; prune e reset limpam estados presos', () => {
    const { ducking, applied } = setup();
    ducking.started('a');
    ducking.started('b');
    expect(applied).toEqual([MUSIC_DUCK_LEVEL]);
    ducking.prune((k) => k === 'b');
    expect(ducking.factor()).toBe(MUSIC_DUCK_LEVEL);
    ducking.prune(() => false);
    expect(ducking.factor()).toBe(1);
    ducking.hold();
    ducking.reset();
    expect(ducking.factor()).toBe(1);
  });
});
