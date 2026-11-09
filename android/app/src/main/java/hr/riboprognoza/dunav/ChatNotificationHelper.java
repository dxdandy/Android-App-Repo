package hr.riboprognoza.dunav;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class ChatNotificationHelper {
    public static final String CHANNEL_ID = "ribo_chat_channel";
    private static final String TAG = "ChatNotificationHelper";

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = context.getSystemService(NotificationManager.class);
                if (manager != null) {
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "RiboPrognoza LiveChat Poruke",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Zvučne i znakovne obavijesti s ikonom udice za nove poruke u chatu");
                    channel.enableLights(true);
                    channel.setLightColor(Color.parseColor("#0891b2"));
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{0, 300, 150, 300});
                    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    channel.setShowBadge(true);

                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                        .build();
                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    channel.setSound(soundUri, audioAttributes);

                    manager.createNotificationChannel(channel);
                    Log.i(TAG, "Notification channel 'ribo_chat_channel' uspješno konfiguriran.");
                }
            } catch (Exception e) {
                Log.w(TAG, "Greška pri kreiranju notification kanala: " + e.getMessage());
            }
        }
    }

    public static void showNotification(Context context, String senderName, String messageText, String messageId) {
        try {
            createNotificationChannel(context);

            Intent intent = new Intent(context, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra("openChat", true);
            intent.putExtra("messageId", messageId);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            int notifId = (int) (System.currentTimeMillis() % 100000);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, notifId, intent, flags);

            Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            String displayName = (senderName != null && !senderName.trim().isEmpty()) ? senderName.trim() : "Ribič";
            String displayBody = (messageText != null && !messageText.trim().isEmpty()) ? messageText.trim() : "Nova poruka u LiveChatu";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_fish)
                .setColor(Color.parseColor("#0891b2"))
                .setContentTitle("🎣 LiveChat: " + displayName)
                .setContentText(displayBody)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(displayBody))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSound(defaultSound)
                .setVibrate(new long[]{0, 300, 150, 300})
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "Nema POST_NOTIFICATIONS dozvole za slanje obavijesti.");
                    return;
                }
            }

            notificationManager.notify(notifId, builder.build());
            Log.i(TAG, "Uspješno poslana nativna obavijest za poruku: " + displayName + ": " + displayBody);
        } catch (Exception e) {
            Log.e(TAG, "Greška pri prikazu obavijesti: " + e.getMessage());
        }
    }
}
