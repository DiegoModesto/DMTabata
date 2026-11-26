import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import { DialogHost, presentDialog, resetDialogs, showAlert } from '../app-dialog';

describe('app-dialog — alertas que funcionam também na web', () => {
  afterEach(async () => {
    await act(async () => resetDialogs());
    jest.restoreAllMocks();
  });

  it('no app nativo usa o alerta do sistema', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    showAlert('Parar treino?', 'Seu progresso será encerrado.');
    expect(alert).toHaveBeenCalledWith('Parar treino?', 'Seu progresso será encerrado.');
  });

  it('na web mostra o diálogo próprio em vez do Alert (que lá não faz nada)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      await render(<DialogHost />);
      const stop = jest.fn();
      await act(async () =>
        showAlert('Parar treino?', 'O progresso será encerrado.', [
          { text: 'Continuar treinando', style: 'cancel' },
          { text: 'Parar', style: 'destructive', onPress: stop },
        ]),
      );
      expect(alert).not.toHaveBeenCalled();
      expect(screen.getByText('Parar treino?')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
      expect(stop).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Parar treino?')).toBeNull();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });

  it('sem botões mostra só "OK"; cancelar fecha sem executar a ação', async () => {
    await render(<DialogHost />);
    await act(async () => presentDialog('Modelo salvo', 'Está em Meus modelos.'));
    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Modelo salvo')).toBeNull();

    const remove = jest.fn();
    await act(async () =>
      presentDialog('Excluir treino?', undefined, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: remove },
      ]),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByText('Excluir treino?')).toBeNull();
  });

  it('um botão pode abrir outro diálogo (menu → confirmar exclusão)', async () => {
    await render(<DialogHost />);
    const remove = jest.fn();
    await act(async () =>
      presentDialog('Boxe', undefined, [
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () =>
            presentDialog('Excluir treino?', '"Boxe" será removido.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Excluir', style: 'destructive', onPress: remove },
            ]),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
    expect(screen.getByText('Excluir treino?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
