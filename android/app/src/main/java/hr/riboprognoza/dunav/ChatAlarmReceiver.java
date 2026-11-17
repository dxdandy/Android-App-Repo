package hr.riboprognoza.dunav;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Prijamnik alarma prilagođen za nultu potrošnju baterije u pozadini.
 */
public class ChatAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        cancelAlarm(context);
    }

    public static void scheduleNextAlarm(Context context) {
        cancelAlarm(context);
    }

    public static void cancelAlarm(Context context) {
        if (context == null) return;
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent alarmIntent = new Intent(context, ChatAlarmReceiver.class);
            int flags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 7771, alarmIntent, flags);
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
            }
        } catch (Exception ignored) {}
    }
}

