package io.karelisio.wenn;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Widget d'écran d'accueil affichant le nombre de jours avant les prochaines
 * règles. Les données sont écrites par WidgetDataPlugin (depuis le JS, à
 * chaque changement de prédiction) dans des SharedPreferences ; ce provider
 * ne fait que les relire et rafraîchir l'affichage.
 */
public class WennWidgetProvider extends AppWidgetProvider {

    static final String PREFS_NAME = "WennWidgetPrefs";
    static final String KEY_HAS_DATA = "has_data";
    static final String KEY_DAYS_REMAINING = "days_remaining";
    static final String KEY_CYCLE_PROGRESS = "cycle_progress";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        updateWidget(context, appWidgetManager, appWidgetId);
    }

    static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean hasData = prefs.getBoolean(KEY_HAS_DATA, false);
        int daysRemaining = prefs.getInt(KEY_DAYS_REMAINING, -1);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_days_remaining);

        // Le widget doit rester lisible même réduit à sa hauteur minimale : sous ~55dp
        // on masque le libellé et on rétrécit le chiffre plutôt que de le laisser déborder.
        Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
        int minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        boolean compact = minHeightDp > 0 && minHeightDp < 55;
        views.setViewVisibility(R.id.widget_days_label, compact ? View.GONE : View.VISIBLE);
        views.setTextViewTextSize(R.id.widget_days_number, TypedValue.COMPLEX_UNIT_SP, compact ? 20 : 28);

        if (!hasData) {
            views.setTextViewText(R.id.widget_days_number, "🌸");
            views.setTextViewText(R.id.widget_days_label, "Ouvre Wenn");
        } else if (daysRemaining <= 0) {
            views.setTextViewText(R.id.widget_days_number, "🩸");
            views.setTextViewText(R.id.widget_days_label, "Règles attendues");
        } else if (daysRemaining == 1) {
            views.setTextViewText(R.id.widget_days_number, "1");
            views.setTextViewText(R.id.widget_days_label, "jour avant les règles");
        } else {
            views.setTextViewText(R.id.widget_days_number, String.valueOf(daysRemaining));
            views.setTextViewText(R.id.widget_days_label, "jours avant les règles");
        }

        views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, appWidgetId));

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    static PendingIntent openAppIntent(Context context, int appWidgetId) {
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context,
            appWidgetId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    /** Appelé par WidgetDataPlugin après chaque mise à jour des données, pour un rafraîchissement immédiat. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, WennWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }
}
