import { HeaderShownContext } from 'expo-router/react-navigation';
import { useContext, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Props = {
  title?: string;
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  headerRight?: ReactNode;
};

/** Container padrão das telas: área segura, largura máxima e título opcional. */
export function Screen({
  title,
  children,
  scroll = false,
  edges,
  contentStyle,
  headerRight,
}: Props) {
  // Com cabeçalho nativo visível, ele já ocupa a área do topo: não reservar de novo.
  const headerShown = useContext(HeaderShownContext);
  const safeEdges: Edge[] = edges ?? (headerShown ? ['left', 'right'] : ['top', 'left', 'right']);
  const body = (
    <View style={[styles.content, contentStyle]}>
      {title ? (
        <View style={styles.header}>
          <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          {headerRight}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.root} edges={safeEdges}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  title: { flexShrink: 1 },
});
