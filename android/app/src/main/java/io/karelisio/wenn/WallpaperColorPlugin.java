package io.karelisio.wenn;

import android.app.WallpaperColors;
import android.app.WallpaperManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Expose les couleurs du fond d'écran système (WallpaperManager#getWallpaperColors,
 * l'API utilisée par Android lui-même pour Material You) à la webview, sans avoir
 * besoin de lire l'image en elle-même ni de permission particulière.
 */
@CapacitorPlugin(name = "WallpaperColor")
public class WallpaperColorPlugin extends Plugin {

    @PluginMethod
    public void getColors(PluginCall call) {
        JSObject result = new JSObject();

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) {
            result.put("available", false);
            call.resolve(result);
            return;
        }

        WallpaperManager manager = WallpaperManager.getInstance(getContext());
        WallpaperColors colors = manager.getWallpaperColors(WallpaperManager.FLAG_SYSTEM);

        if (colors == null) {
            result.put("available", false);
            call.resolve(result);
            return;
        }

        result.put("available", true);
        result.put("primary", toHex(colors.getPrimaryColor().toArgb()));
        if (colors.getSecondaryColor() != null) {
            result.put("secondary", toHex(colors.getSecondaryColor().toArgb()));
        }
        if (colors.getTertiaryColor() != null) {
            result.put("tertiary", toHex(colors.getTertiaryColor().toArgb()));
        }
        call.resolve(result);
    }

    private String toHex(int argb) {
        return String.format("#%06X", 0xFFFFFF & argb);
    }
}
