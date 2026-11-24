import { fireEvent, screen } from '@testing-library/react-native';

import { mockRouter, resetRouterMock } from '@/test/expoRouterMock';
import { renderWithServices } from '@/test/renderWithServices';

import { TemplatePickerScreen } from '../template-picker-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

describe('TemplatePickerScreen', () => {
  beforeEach(resetRouterMock);

  it('lista os modelos com duração e abre o editor com o escolhido', async () => {
    await renderWithServices(<TemplatePickerScreen />);
    expect(screen.getByRole('button', { name: 'Modelo Tabata' })).toBeTruthy();
    expect(screen.getByText('4min06s')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Modelo Personalizado' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Modelo Circuito' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/workout/new?template=circuit');
  });
});
