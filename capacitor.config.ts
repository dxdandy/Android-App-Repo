import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'hr.riboprognoza.dunav',
  appName: 'RiboPrognoza',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'ais-pre-w265pmwlescn6ezxznnwhn-294488753863.europe-west2.run.app',
      'ais-dev-w265pmwlescn6ezxznnwhn-294488753863.europe-west2.run.app',
      '*.run.app'
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: false
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_fish',
      iconColor: '#0891b2',
      sound: 'beep.wav'
    }
  }
};

export default config;
