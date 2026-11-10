package hr.riboprognoza.dunav;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Pozadinski servis koji osluškuje Firestore svakih 3.5 sekundi,
 * te se automatski ponovno pokreće čak i ako korisnik potpuno ugasi aplikaciju (onTaskRemoved).
 */
public class ChatBackgroundService extends Service {
    private static final String TAG = "ChatBackgroundService";
    private ExecutorService executor;
    private volatile boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        executor = Executors.newSingleThreadExecutor();
        isRunning = true;
        startPollingLoop();
        ChatAlarmReceiver.scheduleNextAlarm(getApplicationContext());
        Log.i(TAG, "ChatBackgroundService pokrenut.");
    }

    private void startPollingLoop() {
        if (executor == null || executor.isShutdown()) {
            executor = Executors.newSingleThreadExecutor();
        }
        executor.execute(() -> {
            while (isRunning) {
                try {
                    Context appCtx = getApplicationContext();
                    ChatPollHelper.checkAndNotify(appCtx);
                    // Pametna prilagodba: 15s dok je zaslon uključen, 45s dok je zaslon ugašen (bez buđenja procesora)
                    boolean screenOn = true;
                    try {
                        android.os.PowerManager pm = (android.os.PowerManager) appCtx.getSystemService(Context.POWER_SERVICE);
                        if (pm != null) {
                            screenOn = pm.isInteractive();
                        }
                    } catch (Exception ignored) {}
                    Thread.sleep(screenOn ? 15000 : 45000);
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    Log.w(TAG, "Greška u pozadinskom osluškivanju: " + e.getMessage());
                    try {
                        Thread.sleep(15000);
                    } catch (InterruptedException ignored) {}
                }
            }
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isRunning) {
            isRunning = true;
            startPollingLoop();
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Korisnik je potpuno ugasio aplikaciju (swipe iz nedavnih aplikacija)
        try {
            getApplicationContext()
                .getSharedPreferences(ChatPollHelper.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(ChatPollHelper.KEY_IN_CHAT, false)
                .apply();
        } catch (Exception ignored) {}

        // Zakaži pričuvni alarm bez prisilnog buđenja
        ChatAlarmReceiver.scheduleNextAlarm(getApplicationContext());

        try {
            Intent restartServiceIntent = new Intent(getApplicationContext(), ChatBackgroundService.class);
            restartServiceIntent.setPackage(getPackageName());
            int flags = PendingIntent.FLAG_ONE_SHOT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent restartPendingIntent = PendingIntent.getService(
                getApplicationContext(), 7772, restartServiceIntent, flags
            );
            AlarmManager alarmService = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmService != null) {
                alarmService.set(
                    AlarmManager.ELAPSED_REALTIME,
                    SystemClock.elapsedRealtime() + 5000,
                    restartPendingIntent
                );
            }
        } catch (Exception ignored) {}

        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (executor != null) {
            executor.shutdownNow();
        }
        ChatAlarmReceiver.scheduleNextAlarm(getApplicationContext());
        super.onDestroy();
        Log.i(TAG, "ChatBackgroundService zaustavljen, alarm ostaje aktivan.");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
