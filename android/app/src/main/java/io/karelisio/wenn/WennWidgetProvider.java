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

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Widget d'écran d'accueil affichant le nombre de jours avant les prochaines
 * règles. Les données sont écrites par WidgetDataPlugin (depuis le JS, à
 * chaque changement de prédiction) dans des SharedPreferences ; ce provider
 * les relit et recalcule l'affichage à partir de la date du jour.
 */
public class WennWidgetProvider extends AppWidgetProvider {

    static final String PREFS_NAME = "WennWidgetPrefs";
    static final String KEY_HAS_DATA = "has_data";
    static final String KEY_DAYS_REMAINING = "days_remaining";
    static final String KEY_CYCLE_PROGRESS = "cycle_progress";
    static final String KEY_NEXT_PERIOD_START = "next_period_start";
    static final String KEY_LAST_PERIOD_START = "last_period_start";
    static final String KEY_AVERAGE_CYCLE_LENGTH = "average_cycle_length";

    /** Ce qu'affichent les deux widgets : jours restants et avancée dans le cycle (0-1). */
    static final class CycleState {
        boolean hasData;
        int daysRemaining;
        float progress;
    }

    /**
     * Recalcule à chaque rendu les jours restants et l'avancée dans le cycle à
     * partir des dates poussées par WidgetSync.tsx et de la date locale du jour,
     * avec exactement les mêmes calculs que côté JS (y compris le retard : jours
     * restants ≤ 0 = règles attendues). Sans ça, le widget restait figé sur la
     * valeur calculée à la dernière ouverture de l'app. Dates absentes (données
     * écrites par une version précédente de l'app) : repli sur ces valeurs figées.
     */
    static CycleState readState(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        CycleState state = new CycleState();
        state.hasData = prefs.getBoolean(KEY_HAS_DATA, false);
        state.daysRemaining = prefs.getInt(KEY_DAYS_REMAINING, -1);
        state.progress = prefs.getFloat(KEY_CYCLE_PROGRESS, 0f);

        LocalDate today = LocalDate.now();
        LocalDate nextPeriodStart = parseDate(prefs.getString(KEY_NEXT_PERIOD_START, null));
        if (nextPeriodStart != null) {
            // JS : differenceInCalendarDays(nextPeriodStart, aujourd'hui)
            state.hasData = true;
            state.daysRemaining = (int) ChronoUnit.DAYS.between(today, nextPeriodStart);
        }

        LocalDate lastPeriodStart = parseDate(prefs.getString(KEY_LAST_PERIOD_START, null));
        int averageCycleLength = prefs.getInt(KEY_AVERAGE_CYCLE_LENGTH, 0);
        if (lastPeriodStart != null && averageCycleLength > 0) {
            // JS : currentCycleDay = differenceInCalendarDays(aujourd'hui, lastPeriodStart) + 1,
            // puis ((currentCycleDay - 1) % durée moyenne) / durée moyenne
            long currentCycleDay = ChronoUnit.DAYS.between(lastPeriodStart, today) + 1;
            state.progress = ((currentCycleDay - 1) % averageCycleLength) / (float) averageCycleLength;
        }
        return state;
    }

    /** Date "aaaa-mm-jj", ou null si absente ou illisible. */
    private static LocalDate parseDate(String value) {
        if (value == null || value.isEmpty()) return null;
        try {
            return LocalDate.parse(value);
        } catch (RuntimeException e) {
            return null;
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            // onUpdate tourne dans le processus de l'app : une erreur de rendu
            // non rattrapée la fermerait entièrement.
            try {
                updateWidget(context, appWidgetManager, appWidgetId);
            } catch (Throwable ignored) {
            }
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        try {
            updateWidget(context, appWidgetManager, appWidgetId);
        } catch (Throwable ignored) {
        }
    }

    static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        CycleState state = readState(context);
        boolean hasData = state.hasData;
        int daysRemaining = state.daysRemaining;

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
            try {
                updateWidget(context, manager, id);
            } catch (Throwable ignored) {
            }
        }
    }
}
