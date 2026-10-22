import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'hr.riboprognoza.dunav',
  appName: 'RiboPrognoza',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
