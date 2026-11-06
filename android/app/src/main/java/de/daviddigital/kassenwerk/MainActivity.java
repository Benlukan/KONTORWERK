package de.daviddigital.kassenwerk;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
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
        }
    }
}
