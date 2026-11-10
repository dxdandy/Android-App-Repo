package hr.riboprognoza.dunav;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Pomoćna klasa za prikaz obavijesti s ikonicom udice i zvukom
 * Usklađena 100% sa sistemskim postavkama glasnoće obavijesti uređaja (STREAM_NOTIFICATION / IMPORTANCE_DEFAULT).
 */
public class ChatNotificationHelper {
    public static final String CHANNEL_ID = "ribo_chat_system_default_v6";
    private static final String TAG = "ChatNotificationHelper";

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = context.getSystemService(NotificationManager.class);
                if (manager != null) {
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "LiveChat Poruke (Sistemska glasnoća)",
                        NotificationManager.IMPORTANCE_DEFAULT
                    );
                    channel.setDescription("Obavijesti o novim porukama usklađene s vašim sistemskim postavkama glasnoće obavijesti");
                    channel.enableLights(true);
                    channel.setLightColor(Color.parseColor("#0891b2"));
                    channel.enableVibration(true);
                    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    channel.setShowBadge(true);

                    // Isključivo standardni STREAM_NOTIFICATION kako bi glasnoća bila identična ostalim aplikacijama
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setLegacyStreamType(AudioManager.STREAM_NOTIFICATION)
                        .build();
                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    channel.setSound(soundUri, audioAttributes);

                    manager.createNotificationChannel(channel);
                }
            } catch (Exception e) {
                Log.w(TAG, "Greška pri kreiranju notification kanala: " + e.getMessage());
            }
        }
    }

    /**
     * Uklanja sve aktivne obavijesti i resetira badge/brojač ikone aplikacije
     */
    public static void clearAllNotifications(Context context) {
        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.cancelAll();
            Log.i(TAG, "Uspješno poništene sve chat obavijesti i resetiran sistemski bedž.");
        } catch (Exception e) {
            Log.w(TAG, "Greška pri resetiranju obavijesti: " + e.getMessage());
        }
    }

    public static void showNotification(Context context, String senderName, String messageText, String messageId) {
        try {
            createNotificationChannel(context);

            Intent intent = new Intent(context, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
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
                .setSmallIcon(R.drawable.ic_stat_hook)
                .setColor(Color.parseColor("#0891b2"))
                .setContentTitle("🎣 LiveChat: " + displayName)
                .setContentText(displayBody)
                .setTicker("🎣 " + displayName + ": " + displayBody)
                .setStyle(new NotificationCompat.BigTextStyle()
                    .setBigContentTitle("🎣 LiveChat: " + displayName)
                    .bigText(displayBody))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSound(defaultSound, AudioManager.STREAM_NOTIFICATION)
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
            Log.i(TAG, "Uspješno poslana sistemska obavijest s ikonom udice od: " + displayName);
        } catch (Exception e) {
            Log.e(TAG, "Greška pri prikazu obavijesti: " + e.getMessage());
        }
    }
}
