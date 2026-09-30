package io.karelisio.wenn;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pont JS -> widget d'écran d'accueil : reçoit le nombre de jours restants
 * avant les prochaines règles (recalculé côté app à chaque changement de
 * données) et les dates dont il découle, et les stocke pour que
 * WennWidgetProvider puisse l'afficher et le tenir à jour chaque jour.
 */
@CapacitorPlugin(name = "WidgetData")
public class WidgetDataPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(WennWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        Integer daysRemaining = call.getInt("daysRemaining");
        Double cycleProgress = call.getDouble("cycleProgress");
        if (daysRemaining != null) {
            editor.putBoolean(WennWidgetProvider.KEY_HAS_DATA, true);
            editor.putInt(WennWidgetProvider.KEY_DAYS_REMAINING, daysRemaining);
        } else {
            editor.putBoolean(WennWidgetProvider.KEY_HAS_DATA, false);
        }
        if (cycleProgress != null) {
            editor.putFloat(WennWidgetProvider.KEY_CYCLE_PROGRESS, cycleProgress.floatValue());
        }

        // Dates dont découlent les deux valeurs ci-dessus : les widgets s'en servent
        // pour se recalculer eux-mêmes chaque jour, même app fermée (voir
        // WennWidgetProvider.readState). Pas encore de prédiction : on les efface.
        putStringOrRemove(editor, WennWidgetProvider.KEY_NEXT_PERIOD_START, call.getString("nextPeriodStart"));
        putStringOrRemove(editor, WennWidgetProvider.KEY_LAST_PERIOD_START, call.getString("lastPeriodStart"));
        Integer averageCycleLength = call.getInt("averageCycleLength");
        if (averageCycleLength != null) {
            editor.putInt(WennWidgetProvider.KEY_AVERAGE_CYCLE_LENGTH, averageCycleLength);
        } else {
            editor.remove(WennWidgetProvider.KEY_AVERAGE_CYCLE_LENGTH);
        }
        editor.apply();

        // Le rendu d'un widget tourne dans le processus de l'app : une erreur ici
        // (RemoteViews, mémoire...) fermerait l'app entière. Les données sont déjà
        // enregistrées, un widget non rafraîchi se rattrapera à sa prochaine mise à jour.
        try {
            WennWidgetProvider.refreshAll(context);
        } catch (Throwable ignored) {
        }
        try {
            WennOrbitWidgetProvider.refreshAll(context);
        } catch (Throwable ignored) {
        }
        call.resolve();
    }

    private static void putStringOrRemove(SharedPreferences.Editor editor, String key, String value) {
        if (value != null && !value.isEmpty()) {
            editor.putString(key, value);
        } else {
            editor.remove(key);
        }
    }
}
