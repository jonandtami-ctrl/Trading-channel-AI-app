import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { ScanDataProvider } from '../hooks/ScanDataProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ScanDataProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text },
            contentStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="symbol/[symbol]" options={{ title: '' }} />
          <Stack.Screen name="category/[category]" options={{ title: '' }} />
          <Stack.Screen name="signal/[type]" options={{ title: '' }} />
        </Stack>
      </ScanDataProvider>
    </SafeAreaProvider>
  );
}
