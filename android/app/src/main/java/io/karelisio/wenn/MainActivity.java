package io.karelisio.wenn;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Avant tout le reste : une exception non rattrapée pendant le
        // démarrage doit être enregistrée, pas juste fermer l'app en silence.
        CrashLogPlugin.install(getApplicationContext());
        registerPlugin(CrashLogPlugin.class);
        registerPlugin(WallpaperColorPlugin.class);
        registerPlugin(ApkInstallerPlugin.class);
        registerPlugin(WidgetDataPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
