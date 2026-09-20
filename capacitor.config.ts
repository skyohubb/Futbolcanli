import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.skyohubb.futbolcanli',
  appName: 'FutbolCanli',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Canlı API için production URL - değiştirilebilir
    // url: 'https://futbolcanli.skyohubb.workers.dev',
    // cleartext: true
  },
  plugins: {}
};

export default config;
