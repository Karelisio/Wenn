package io.karelisio.wenn;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Enregistre la dernière fermeture brutale de l'app pour pouvoir l'afficher
 * dans Réglages au redémarrage.
 *
 * Une exception Java non rattrapée (plugin natif, widget...) tue le processus
 * sans rien laisser de visible : l'app "se ferme toute seule" et, sans accès
 * au logcat de l'appareil, il n'y a aucun moyen de savoir pourquoi. On la
 * capture donc ici avant qu'Android ne termine le processus, exactement comme
 * l'ErrorBoundary le fait côté React pour les erreurs de rendu.
 */
@CapacitorPlugin(name = "CrashLog")
public class CrashLogPlugin extends Plugin {

    private static final String PREFS = "WennCrashLog";
    private static final String KEY_TRACE = "last_trace";
    private static final String KEY_WHEN = "last_when";

    /** À appeler au tout début de MainActivity.onCreate(). */
    static void install(final Context context) {
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread thread, Throwable error) {
                try {
                    StringWriter out = new StringWriter();
                    error.printStackTrace(new PrintWriter(out));
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit()
                        .putString(KEY_TRACE, "[" + thread.getName() + "] " + out)
                        .putString(KEY_WHEN, new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.FRENCH).format(new Date()))
                        .commit(); // commit() et non apply() : le processus meurt juste après.
                } catch (Throwable ignored) {
                    // on ne peut rien faire de plus, laisser Android terminer
                }
                if (previous != null) previous.uncaughtException(thread, error);
            }
        });
    }

    @PluginMethod
    public void get(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("trace", prefs.getString(KEY_TRACE, null));
        result.put("when", prefs.getString(KEY_WHEN, null));
        call.resolve(result);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        call.resolve();
    }
}
