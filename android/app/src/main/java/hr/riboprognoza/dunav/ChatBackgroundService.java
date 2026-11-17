package hr.riboprognoza.dunav;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

/**
 * Pozadinski servis je stavljen u stanje mirovanja (0% potrošnje baterije u pozadini)
 * kako Android operativni sustav nikada ne bi prijavio povećanu potrošnju baterije.
 */
public class ChatBackgroundService extends Service {
    @Override
    public void onCreate() {
        super.onCreate();
        ChatAlarmReceiver.cancelAlarm(getApplicationContext());
        stopSelf();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ChatAlarmReceiver.cancelAlarm(getApplicationContext());
        stopSelf();
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

