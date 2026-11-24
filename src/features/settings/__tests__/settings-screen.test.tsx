import { fireEvent, screen, waitFor } from '@testing-library/react-native';

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
