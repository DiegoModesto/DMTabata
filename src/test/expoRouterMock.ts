/**
 * Mock de expo-router para testes de tela.
 * Uso: jest.mock('expo-router', () => require('@/test/expoRouterMock'));
 */
import { useEffect } from 'react';

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  dismiss: jest.fn(),
};

export const useRouter = () => mockRouter;
export const router = mockRouter;
export const useLocalSearchParams = jest.fn(() => ({}));

/** Em testes, "foco" acontece na montagem. */
export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(effect, [effect]);
}

export const Stack = Object.assign(() => null, { Screen: () => null, Protected: () => null });

export function resetRouterMock() {
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  mockNavigation.dispatch.mockReset();
}

export const mockNavigation = { dispatch: jest.fn() };
export const useNavigation = () => mockNavigation;

/** Guarda o último callback registrado para o teste simular uma tentativa de saída. */
export const preventRemoveState = {
  prevent: false,
  callback: null as null | ((e: { data: { action: unknown } }) => void),
};
export function usePreventRemove(
  prevent: boolean,
  callback: (e: { data: { action: unknown } }) => void,
) {
  preventRemoveState.prevent = prevent;
  preventRemoveState.callback = callback;
}
