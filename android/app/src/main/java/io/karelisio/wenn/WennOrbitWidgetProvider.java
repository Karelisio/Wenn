package io.karelisio.wenn;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Bundle;
import android.util.TypedValue;
import android.widget.RemoteViews;

/**
 * Widget "Orbite" : reprend le motif de l'icône de l'app (anneau + point) pour
 * situer visuellement où on en est dans le cycle, avec le nombre de jours
 * restants au centre. Un widget d'écran d'accueil ne peut pas jouer d'animation
 * continue (il vit dans le processus du launcher, pas celui de l'app) : le
 * point avance donc d'un cran à chaque rafraîchissement des données, comme une
 * aiguille d'horloge lente calée sur la longueur moyenne du cycle plutôt que
 * de tourner en direct.
 */
public class WennOrbitWidgetProvider extends AppWidgetProvider {

    private static final int BITMAP_SIZE = 240;
    private static final float RING_RADIUS_RATIO = 0.34f;
    private static final float RING_STROKE_RATIO = 0.045f;
    private static final float DOT_RADIUS_RATIO = 0.075f;

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
        SharedPreferences prefs = context.getSharedPreferences(WennWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        boolean hasData = prefs.getBoolean(WennWidgetProvider.KEY_HAS_DATA, false);
        int daysRemaining = prefs.getInt(WennWidgetProvider.KEY_DAYS_REMAINING, -1);
        float progress = prefs.getFloat(WennWidgetProvider.KEY_CYCLE_PROGRESS, 0f);
        boolean periodDay = hasData && daysRemaining <= 0;

        // En dessous d'~70dp de côté, l'anneau devient trop fin pour rester lisible :
        // on réduit alors le chiffre plutôt que de laisser le rendu se chevaucher.
        Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
        int minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        boolean compact = (minWidthDp > 0 && minWidthDp < 70) || (minHeightDp > 0 && minHeightDp < 70);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_orbit);
        views.setImageViewBitmap(R.id.widget_orbit_ring, drawOrbit(progress, periodDay, hasData));

        if (!hasData) {
            views.setTextViewText(R.id.widget_orbit_number, "🌸");
            views.setTextViewTextSize(R.id.widget_orbit_number, TypedValue.COMPLEX_UNIT_SP, compact ? 16 : 22);
        } else if (periodDay) {
            views.setTextViewText(R.id.widget_orbit_number, "🩸");
            views.setTextViewTextSize(R.id.widget_orbit_number, TypedValue.COMPLEX_UNIT_SP, compact ? 16 : 22);
        } else {
            views.setTextViewText(R.id.widget_orbit_number, String.valueOf(daysRemaining));
            views.setTextViewTextSize(R.id.widget_orbit_number, TypedValue.COMPLEX_UNIT_SP, compact ? 18 : 26);
        }

        views.setOnClickPendingIntent(R.id.widget_orbit_root, WennWidgetProvider.openAppIntent(context, appWidgetId));

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap drawOrbit(float progress, boolean periodDay, boolean hasData) {
        Bitmap bitmap = Bitmap.createBitmap(BITMAP_SIZE, BITMAP_SIZE, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        float cx = BITMAP_SIZE / 2f;
        float cy = BITMAP_SIZE / 2f;
        float ringRadius = BITMAP_SIZE * RING_RADIUS_RATIO;

        Paint ringPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        ringPaint.setStyle(Paint.Style.STROKE);
        ringPaint.setStrokeWidth(BITMAP_SIZE * RING_STROKE_RATIO);
        ringPaint.setColor(Color.parseColor("#E0577E"));
        ringPaint.setAlpha(hasData ? 255 : 130);
        canvas.drawCircle(cx, cy, ringRadius, ringPaint);

        // Le point part du haut (12h) et avance dans le sens horaire avec le cycle.
        double angle = Math.toRadians(-90 + 360 * progress);
        float dotX = (float) (cx + ringRadius * Math.cos(angle));
        float dotY = (float) (cy + ringRadius * Math.sin(angle));

        Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dotPaint.setStyle(Paint.Style.FILL);
        dotPaint.setColor(Color.parseColor(periodDay ? "#E0577E" : "#A13A5C"));
        canvas.drawCircle(dotX, dotY, BITMAP_SIZE * DOT_RADIUS_RATIO, dotPaint);

        return bitmap;
    }

    /** Appelé par WidgetDataPlugin après chaque mise à jour des données, pour un rafraîchissement immédiat. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, WennOrbitWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }
}
