import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithServices } from '@/test/renderWithServices';

import { LoginScreen } from '../login-screen';

describe('LoginScreen (mock)', () => {
  it('mostra os campos e o botão Entrar', async () => {
    await renderWithServices(<LoginScreen />);
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('clicar em Entrar sem preencher nada já autentica', async () => {
    const { services } = await renderWithServices(<LoginScreen />);
    expect(services.authStore.getState().status).toBe('signedOut');

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(services.authStore.getState().status).toBe('signedIn'));
    expect(services.authStore.getState().user?.displayName).toBe('Atleta');
  });

  it('usa o e-mail digitado para identificar o usuário', async () => {
    const { services } = await renderWithServices(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'diego.modesto@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'qualquer');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(services.authStore.getState().user?.email).toBe('diego.modesto@exemplo.com'),
    );
    expect(services.authStore.getState().user?.displayName).toBe('Diego Modesto');
  });
});
