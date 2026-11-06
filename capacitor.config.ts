import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'hr.riboprognoza.dunav',
  appName: 'RiboPrognoza',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: false
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_fish',
      iconColor: '#22c55e',
      sound: 'beep.wav'
    }
  }
};

export default config;
