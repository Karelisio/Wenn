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
 * données) et le stocke pour que WennWidgetProvider puisse l'afficher.
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
        editor.apply();

        WennWidgetProvider.refreshAll(context);
        WennOrbitWidgetProvider.refreshAll(context);
        call.resolve();
    }
}
