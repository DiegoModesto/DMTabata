import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { StartupErrorScreen } from '@/features/startup/startup-error-screen';
import { createTestDatabase } from '@/test/sqliteTestDatabase';

import { ServicesProvider, useServices } from '../services-provider';

function Ready() {
  useServices();
  return <Text>App pronto</Text>;
}

describe('ServicesProvider — falha ao abrir o banco', () => {
  it('mostra o motivo e "Tentar de novo" abre o banco outra vez', async () => {
    const openDatabase = jest
      .fn()
      .mockRejectedValueOnce(
        new Error("Failed to execute 'createSyncAccessHandle': Access Handles cannot be created"),
      )
      .mockImplementation(async () => createTestDatabase());
    const onError = jest.fn();

    await render(
      <ServicesProvider
        openDatabase={openDatabase}
        createOverrides={() => ({ bundledWorkouts: [] })}
        onError={onError}
        errorFallback={(error, retry) => <StartupErrorScreen error={error} onRetry={retry} />}>
        <Ready />
      </ServicesProvider>,
    );

    expect(await screen.findByRole('header', { name: 'O DMTabata já está aberto' })).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('App pronto')).toBeTruthy();
    expect(openDatabase).toHaveBeenCalledTimes(2);
  });

  it('navegador sem suporte não oferece nova tentativa', async () => {
    await render(
      <ServicesProvider
        openDatabase={() => Promise.reject(new ReferenceError('SharedArrayBuffer is not defined'))}
        errorFallback={(error, retry) => <StartupErrorScreen error={error} onRetry={retry} />}>
        <Ready />
      </ServicesProvider>,
    );
    expect(await screen.findByRole('header', { name: 'Navegador sem suporte' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });
});
