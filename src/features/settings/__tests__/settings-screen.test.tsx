import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { mockRouter } from '@/test/expoRouterMock';

import { SettingsScreen } from '../settings-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

describe('SettingsScreen', () => {
  it('mostra o usuário, abre os sons e permite sair', async () => {
    const services = await createTestServices();
    await services.authStore.getState().signIn({ email: 'ana@x.com' });

    await renderWithServices(<SettingsScreen />, services);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('ana@x.com')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Sons e alertas' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sounds');

    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(services.authStore.getState().status).toBe('signedOut'));
  });
});

describe('SettingsScreen — backup', () => {
  it('exporta e importa treinos', async () => {
    const shared: string[] = [];
    let nextText: string | null = null;
    const services = await createTestServices({
      backupIO: {
        share: async (_name, content) => {
          shared.push(content);
        },
        pickText: async () => nextText,
      },
    });
    await services.authStore.getState().signIn({ email: 'ana@x.com' });
    await services.workoutsStore.getState().createTabata();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await renderWithServices(<SettingsScreen />, services);
    await fireEvent.press(screen.getByRole('button', { name: 'Exportar treinos' }));
    await waitFor(() => expect(shared).toHaveLength(1));

    nextText = shared[0];
    await fireEvent.press(screen.getByRole('button', { name: 'Importar treinos' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Treinos importados', '1 treino(s) importado(s).'),
    );
    expect(services.workoutsStore.getState().summaries).toHaveLength(2);
    alert.mockRestore();
  });
});
