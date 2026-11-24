import { DEFAULT_DISPLAY_NAME, displayNameFromEmail, normalizeEmail } from '../user';

describe('displayNameFromEmail', () => {
  it('gera nome legível a partir da parte local do e-mail', () => {
    expect(displayNameFromEmail('joao.silva@exemplo.com')).toBe('Joao Silva');
    expect(displayNameFromEmail('MARIA_souza+treino@x.com')).toBe('Maria Souza Treino');
  });

  it('usa o nome padrão quando não há e-mail', () => {
    expect(displayNameFromEmail(null)).toBe(DEFAULT_DISPLAY_NAME);
    expect(displayNameFromEmail('')).toBe(DEFAULT_DISPLAY_NAME);
    expect(displayNameFromEmail('   ')).toBe(DEFAULT_DISPLAY_NAME);
    expect(displayNameFromEmail('@dominio.com')).toBe(DEFAULT_DISPLAY_NAME);
  });
});

describe('normalizeEmail', () => {
  it('remove espaços e converte para minúsculas', () => {
    expect(normalizeEmail('  Diego@Exemplo.COM ')).toBe('diego@exemplo.com');
  });

  it('retorna null para valores vazios', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});
