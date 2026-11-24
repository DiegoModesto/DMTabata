import { Colors } from '@/constants/theme';

import { detailHeaderOptions } from '../detail-header';

describe('detailHeaderOptions — cabeçalho das telas de detalhe', () => {
  it('é opaco, para o botão de voltar não cobrir o título da tela', () => {
    const options = detailHeaderOptions(Colors.light);
    expect(options.headerShown).toBe(true);
    expect(options.headerTransparent).toBe(false);
    expect(options.headerStyle.backgroundColor).toBe(Colors.light.background);
  });

  it('mostra "Voltar" em vez do nome do grupo de rotas e deixa o título para a tela', () => {
    const options = detailHeaderOptions(Colors.dark);
    expect(options.headerBackTitle).toBe('Voltar');
    expect(options.title).toBe('');
    expect(options.headerTintColor).toBe(Colors.dark.text);
  });
});
