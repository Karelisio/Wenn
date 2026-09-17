package io.karelisio.wenn;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
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

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean hasData = prefs.getBoolean(KEY_HAS_DATA, false);
        int daysRemaining = prefs.getInt(KEY_DAYS_REMAINING, -1);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_days_remaining);

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

        appWidgetManager.updateAppWidget(appWidgetId, views);
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
