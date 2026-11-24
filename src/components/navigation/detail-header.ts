/**
 * Cabeçalho nativo das telas de detalhe (empilhadas sobre as abas).
 *
 * Opaco de propósito: com o cabeçalho translúcido, o conteúdo começava atrás dele e
 * o botão de voltar cobria o título da tela. Opaco, o conteúdo começa abaixo da barra.
 * O título fica vazio porque cada tela mostra o seu (componente `Screen`).
 */
export function detailHeaderOptions(colors: { background: string; text: string }) {
  return {
    headerShown: true,
    title: '',
    headerTransparent: false,
    headerBackTitle: 'Voltar',
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerStyle: { backgroundColor: colors.background },
  } as const;
}
