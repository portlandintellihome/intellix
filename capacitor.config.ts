import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.intellihome.intellix',
  appName: 'Intellix',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  // Per-plugin configuration is added in Phase 1B (native plugin integration).
  plugins: {},
};

export default config;
