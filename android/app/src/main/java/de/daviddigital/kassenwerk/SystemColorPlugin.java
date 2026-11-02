package de.daviddigital.kassenwerk;

import android.content.res.Configuration;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Färbt die Flächen hinter Status- und Navigationsleiste passend zum App-Design
 * (Hell/Dunkel) und setzt helle bzw. dunkle Symbole.
 */
@CapacitorPlugin(name = "SystemColor")
public class SystemColorPlugin extends Plugin {
    private Integer color = null;
    private boolean dark = false;

    @PluginMethod
    public void set(PluginCall call) {
        try {
            color = Color.parseColor(call.getString("color", "#ffffff"));
        } catch (IllegalArgumentException e) {
            call.reject("Ungültige Farbe");
            return;
        }
        dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        getActivity().runOnUiThread(() -> {
            apply();
            call.resolve();
        });
    }

    private void apply() {
        if (color == null) return;
        Window w = getActivity().getWindow();
        View decor = w.getDecorView();
        decor.setBackgroundColor(color);
        WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(w, decor);
        ic.setAppearanceLightStatusBars(!dark);
        ic.setAppearanceLightNavigationBars(!dark);
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // Capacitor setzt bei Konfigurationswechseln die Hintergrundfarbe zurück – danach erneut anwenden
        getActivity().getWindow().getDecorView().postDelayed(this::apply, 50);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        getActivity().getWindow().getDecorView().post(this::apply);
    }
}
