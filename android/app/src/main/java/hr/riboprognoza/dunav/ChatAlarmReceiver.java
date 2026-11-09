package hr.riboprognoza.dunav;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;
import java.util.concurrent.Executors;

public class ChatAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "ChatAlarmReceiver";
    public static final int ALARM_INTERVAL_MS = 60 * 1000; // Provjera svake 1 minute

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "ChatAlarmReceiver aktivan, provjera novih poruka...");

        Executors.newSingleThreadExecutor().execute(() -> {
            ChatPollHelper.checkAndNotify(context, false);
        });

        try {
            Intent serviceIntent = new Intent(context, ChatBackgroundService.class);
            context.startService(serviceIntent);
        } catch (Exception ignored) {}

        // Zakaži sljedeću provjeru kako bi radilo čak i ako je aplikacija potpuno ugašena
        scheduleNextAlarm(context);
    }

    public static void scheduleNextAlarm(Context context) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent alarmIntent = new Intent(context, ChatAlarmReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 7771, alarmIntent, flags);

            long triggerAtMillis = SystemClock.elapsedRealtime() + ALARM_INTERVAL_MS;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pendingIntent);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                alarmManager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (Exception e) {
            Log.w(TAG, "Nemoguće zakazati alarm za chat: " + e.getMessage());
        }
    }
}
