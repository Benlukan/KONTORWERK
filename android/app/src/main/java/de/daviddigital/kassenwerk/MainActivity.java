package de.daviddigital.kassenwerk;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemColorPlugin.class);
        super.onCreate(savedInstanceState);
        // Layout unabhängig von der System-Schriftgröße halten
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
        // Android 10 und älter (z. B. Tablet mit Android 7.1.1): Capacitors eigene Behandlung der Systemleisten
        // schiebt den Inhalt dort nicht zuverlässig unter die Statusleiste – Logo und Name lagen darunter.
        // Deshalb hier das klassische Verhalten: Android legt die App unter die Statusleiste, die Leiste
        // bekommt die App-Farbe (SystemColorPlugin). Ab Android 11 bleibt alles wie bisher.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
            final View decor = getWindow().getDecorView();
            decor.post(() -> {
                ViewCompat.setOnApplyWindowInsetsListener(decor, null);
                decor.setPadding(0, 0, 0, 0);
                ViewCompat.requestApplyInsets(decor);
            });
            // Manche (Custom-)ROMs legen das Fenster trotzdem unter die Statusleiste. Darum nachmessen:
            // Beginnt die WebView oberhalb der Unterkante der Statusleiste, bekommt die Seite genau den
            // fehlenden Abstand als --safe-area-inset-top (die CSS nutzt ihn für Seitenleiste und Kopfzeile).
            final WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                wv.getViewTreeObserver().addOnGlobalLayoutListener(() -> injectTopInset(wv));
                for (int ms : new int[] {400, 1200, 3000, 6000}) wv.postDelayed(() -> injectTopInset(wv), ms);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R && getBridge() != null && getBridge().getWebView() != null) {
            final WebView wv = getBridge().getWebView();
            wv.postDelayed(() -> injectTopInset(wv), 300);
        }
    }

    /** Fehlenden Abstand zur Statusleiste messen und als CSS-Variable an die Seite geben (nur Android 10 und älter). */
    private void injectTopInset(WebView wv) {
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        int bar = id > 0 ? getResources().getDimensionPixelSize(id) : 0;
        boolean fullscreen = (getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_FULLSCREEN) != 0;
        int[] loc = new int[2];
        wv.getLocationOnScreen(loc);
        int px = !fullscreen && loc[1] < bar ? bar - loc[1] : 0;
        float density = getResources().getDisplayMetrics().density;
        long dp = Math.round(px / density);
        wv.evaluateJavascript("document.documentElement.style.setProperty('--safe-area-inset-top','" + dp + "px');window.__kwTopInset=" + dp + ";", null);
    }
}
