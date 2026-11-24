import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { SettingsScreen } from '../settings-screen';

describe('SettingsScreen', () => {
  it('mostra o usuário logado e permite sair', async () => {
    const services = await createTestServices();
    await services.authStore.getState().signIn({ email: 'ana@x.com' });

    await renderWithServices(<SettingsScreen />, services);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('ana@x.com')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(services.authStore.getState().status).toBe('signedOut'));
  });
});
