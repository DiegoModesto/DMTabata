import type { SoundId } from '@/domain/alerts';

import { MUSIC_DUCK_LEVEL } from '../musicDucking';
import {
  createWebAlertPlayer,
  type AudioContextLike,
  type GainNodeLike,
  type SourceNodeLike,
} from '../webAlertPlayer';

type FakeSource = SourceNodeLike & {
  started: boolean;
  stopped: boolean;
  offset: number;
  gain: GainNodeLike;
  finish(): void;
};

function fakeContext() {
  const sources: FakeSource[] = [];
  const context: AudioContextLike & { sources: FakeSource[]; resumes: number } = {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    resumes: 0,
    sources,
    async resume() {
      context.resumes++;
      context.state = 'running';
    },
    createGain() {
      return { gain: { value: 1 }, connect() {}, disconnect() {} };
    },
    createBufferSource() {
      let gain: GainNodeLike = null as unknown as GainNodeLike;
      const source: FakeSource = {
        buffer: null,
        loop: false,
        onended: null,
        started: false,
        stopped: false,
        offset: 0,
        get gain() {
          return gain;
        },
        connect(node) {
          gain = node as GainNodeLike;
        },
        start(_when, offset = 0) {
          source.started = true;
          source.offset = offset;
        },
        stop() {
          source.stopped = true;
          source.onended?.();
        },
        disconnect() {},
        finish() {
          source.onended?.();
        },
      };
      sources.push(source);
      return source;
    },
    async decodeAudioData() {
      return { duration: 2 };
    },
  };
  return context;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const context = fakeContext();
  const spoken: { text: string; done: () => void }[] = [];
  const vibrations: (number | number[])[] = [];
  const fetched: string[] = [];
  const player = createWebAlertPlayer({
    createContext: () => context,
    sourceUri: (id: SoundId, user) => (id.startsWith('user-') ? (user[id] ?? null) : `/${id}.mp3`),
    fetchBytes: async (uri) => {
      fetched.push(uri);
      return new ArrayBuffer(8);
    },
    speak: (text, _lang, done) => spoken.push({ text, done }),
    stopSpeech: () => {},
    vibrate: (p) => vibrations.push(p),
  });
  const byUri = (index: number) => context.sources[index];
  return { context, player, spoken, vibrations, fetched, byUri };
}

describe('webAlertPlayer (Web Audio)', () => {
  it('prepare libera o áudio e pré-carrega cada som uma vez só', async () => {
    const { player, context, fetched } = setup();
    await player.prepare(['gong', 'beep', 'gong']);
    expect(context.state).toBe('running');
    expect(fetched).toEqual(['/gong.mp3', '/beep.mp3']);
  });

  it('toca o alerta com o volume pedido', async () => {
    const { player, context } = setup();
    player.execute([{ type: 'sound', soundId: 'gong', volume: 0.6, slot: 'workStart' }]);
    await flush();
    expect(context.sources[0].started).toBe(true);
    expect(context.sources[0].gain.gain.value).toBe(0.6);
  });

  it('música em loop abaixa enquanto um alerta toca e volta ao terminar', async () => {
    const { player, context } = setup();
    player.execute([{ type: 'music', action: 'start', soundId: 'song', volume: 1 }]);
    await flush();
    const music = context.sources[0];
    expect(music.loop).toBe(true);
    expect(music.gain.gain.value).toBe(1);

    player.execute([{ type: 'sound', soundId: 'gong', volume: 1, slot: 'workStart' }]);
    await flush();
    expect(music.gain.gain.value).toBe(MUSIC_DUCK_LEVEL);
    context.sources[1].finish();
    expect(music.gain.gain.value).toBe(1);
  });

  it('segundos finais: "duck" segura a música baixa até "unduck"', async () => {
    const { player, context } = setup();
    player.execute([{ type: 'music', action: 'start', soundId: 'song', volume: 0.8 }]);
    await flush();
    player.execute([{ type: 'music', action: 'duck' }]);
    expect(context.sources[0].gain.gain.value).toBeCloseTo(0.8 * MUSIC_DUCK_LEVEL);
    player.execute([{ type: 'music', action: 'unduck' }]);
    expect(context.sources[0].gain.gain.value).toBeCloseTo(0.8);
  });

  it('pausar e retomar a música continua de onde parou', async () => {
    const { player, context } = setup();
    player.execute([{ type: 'music', action: 'start', soundId: 'song', volume: 1 }]);
    await flush();
    context.currentTime = 5;
    player.execute([{ type: 'music', action: 'pause' }]);
    expect(context.sources[0].stopped).toBe(true);
    context.currentTime = 20;
    player.execute([{ type: 'music', action: 'resume' }]);
    await flush();
    expect(context.sources[1].offset).toBe(5);
    expect(context.sources[1].loop).toBe(true);
  });

  it('um som surpresa novo interrompe o anterior, e a música não fica presa baixa', async () => {
    const { player, context } = setup();
    player.execute([{ type: 'music', action: 'start', soundId: 'song', volume: 1 }]);
    const surprise = (soundId: string) =>
      player.execute([
        { type: 'sound', soundId, volume: 1, slot: 'surprise', channel: 'surprise' },
      ]);
    surprise('laugh');
    await flush();
    surprise('whip');
    await flush();
    expect(context.sources[1].stopped).toBe(true);
    expect(context.sources[2].started).toBe(true);
    player.execute([{ type: 'stopChannel', channel: 'surprise' }]);
    expect(context.sources[2].stopped).toBe(true);
    expect(context.sources[0].gain.gain.value).toBe(1);
  });

  it('parar antes de carregar não toca o som', async () => {
    const { player, context } = setup();
    player.execute([
      { type: 'sound', soundId: 'laugh', volume: 1, slot: 'surprise', channel: 'surprise' },
      { type: 'stopChannel', channel: 'surprise' },
    ]);
    await flush();
    expect(context.sources[0].started).toBe(false);
  });

  it('voz abaixa a música até terminar de falar', async () => {
    const { player, context, spoken } = setup();
    player.execute([{ type: 'music', action: 'start', soundId: 'song', volume: 1 }]);
    await flush();
    player.execute([{ type: 'speak', text: 'Descanso', lang: 'pt-BR' }]);
    expect(context.sources[0].gain.gain.value).toBe(MUSIC_DUCK_LEVEL);
    spoken[0].done();
    expect(context.sources[0].gain.gain.value).toBe(1);
  });

  it('vibração usa o padrão do estilo', () => {
    const { player, vibrations } = setup();
    player.execute([{ type: 'haptic', style: 'success' }]);
    expect(vibrations).toEqual([[20, 60, 20]]);
  });

  it('pré-escuta: avisa o fim natural, mas não quando é parada', async () => {
    const { player, context } = setup();
    const ended = jest.fn();
    player.preview('gong', 1, ended);
    await flush();
    context.sources[0].finish();
    expect(ended).toHaveBeenCalledTimes(1);

    player.preview('beep', 1, ended);
    await flush();
    player.stopPreview();
    expect(context.sources[1].stopped).toBe(true);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('sons do usuário usam a url registrada; som sem arquivo encerra a pré-escuta', async () => {
    const { player, fetched } = setup();
    player.registerSources({ 'user-1': 'blob:abc' });
    await player.prepare(['user-1']);
    expect(fetched).toEqual(['blob:abc']);
    const ended = jest.fn();
    player.preview('user-404', 1, ended);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('release para tudo', async () => {
    const { player, context } = setup();
    player.execute([{ type: 'music', action: 'start', soundId: 'song', volume: 1 }]);
    await flush();
    player.release();
    expect(context.sources[0].stopped).toBe(true);
  });
});
