import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/services-provider';

/**
 * Login simulado: os campos são apenas visuais. "Entrar" sempre autentica e a
 * navegação para as abas acontece pelo guard de rotas no layout raiz.
 */
export function LoginScreen() {
  const signIn = useAuth((s) => s.signIn);
  const error = useAuth((s) => s.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn({ email, password });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hero}>
          <ThemedText type="title" accessibilityRole="header">
            DMTabata
          </ThemedText>
          <ThemedText themeColor="textSecondary">Treinos intervalados do seu jeito.</ThemedText>
        </View>

        <View style={styles.form}>
          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <TextField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            textContentType="password"
          />
          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}
          <Button title="Entrar" onPress={handleSignIn} loading={loading} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Login de demonstração — qualquer valor funciona.
          </ThemedText>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center', gap: Spacing.five },
  hero: { alignItems: 'center', gap: Spacing.two },
  form: { gap: Spacing.three },
  hint: { textAlign: 'center' },
});
