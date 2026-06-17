import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexa.messenger',
  appName: 'Nexa Messenger',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  server: {
    androidScheme: 'http',
    cleartext: true, // Facilitate testing with local HTTP backend servers (e.g., http://192.168.x.x:3000)
    allowNavigation: ['*']
  }
};

export default config;
