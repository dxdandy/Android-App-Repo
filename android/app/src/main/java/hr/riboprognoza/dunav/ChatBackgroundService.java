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
                    ChatPollHelper.checkAndNotify(getApplicationContext());
                    Thread.sleep(3500);
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    Log.w(TAG, "Greška u pozadinskom osluškivanju: " + e.getMessage());
                    try {
                        Thread.sleep(5000);
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
        ChatAlarmReceiver.scheduleNextAlarm(getApplicationContext());
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

        // Zakaži buđenje putem AlarmManagera kako bi obavijesti radile i dok je aplikacija ugašena
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
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + 2500,
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
