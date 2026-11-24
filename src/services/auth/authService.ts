import type { User } from '@/domain/user';

export type SignInInput = {
  email?: string;
  password?: string;
};

/**
 * Contrato de autenticação. A v1 usa `MockAuthService`; trocar por um provedor
 * real (Supabase, Firebase, Apple/Google) é só uma nova implementação.
 */
export interface AuthService {
  signIn(input: SignInInput): Promise<User>;
  signOut(): Promise<void>;
  currentUser(): Promise<User | null>;
}
