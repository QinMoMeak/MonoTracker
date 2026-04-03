package com.Tracker.app;

import android.content.res.Configuration;
import android.content.res.Resources;
import android.graphics.Color;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DynamicThemePlugin")
public class DynamicThemePlugin extends Plugin {
    private String toHex(int color) {
        return String.format("#%06X", (0xFFFFFF & color));
    }

    private boolean isDarkMode() {
        int nightModeFlags = getContext().getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
    }

    private int getSystemColor(Resources resources, String name, int fallbackColor) {
        int resourceId = resources.getIdentifier(name, "color", "android");
        if (resourceId == 0) {
            return fallbackColor;
        }
        return resources.getColor(resourceId, getContext().getTheme());
    }

    private JSObject buildTokens(boolean isDark) {
        Resources resources = getContext().getResources();
        JSObject tokens = new JSObject();

        String primary = toHex(getSystemColor(resources, isDark ? "system_accent1_800" : "system_accent1_400", Color.parseColor("#7051C8")));
        String onPrimary = toHex(getSystemColor(resources, isDark ? "system_accent1_200" : "system_accent1_1000", Color.parseColor("#FFFFFF")));
        String primaryContainer = toHex(getSystemColor(resources, isDark ? "system_accent1_300" : "system_accent1_900", Color.parseColor("#EADCFF")));
        String onPrimaryContainer = toHex(getSystemColor(resources, isDark ? "system_accent1_900" : "system_accent1_100", Color.parseColor("#25005A")));
        String secondary = toHex(getSystemColor(resources, isDark ? "system_accent2_800" : "system_accent2_400", Color.parseColor("#625B71")));
        String onSecondary = toHex(getSystemColor(resources, isDark ? "system_accent2_200" : "system_accent2_1000", Color.parseColor("#FFFFFF")));
        String secondaryContainer = toHex(getSystemColor(resources, isDark ? "system_accent2_300" : "system_accent2_900", Color.parseColor("#E8DEF8")));
        String onSecondaryContainer = toHex(getSystemColor(resources, isDark ? "system_accent2_900" : "system_accent2_100", Color.parseColor("#1E192B")));
        String surface = toHex(getSystemColor(resources, isDark ? "system_neutral1_100" : "system_neutral1_1000", Color.parseColor(isDark ? "#141218" : "#FCF8FF")));
        String onSurface = toHex(getSystemColor(resources, isDark ? "system_neutral1_900" : "system_neutral1_100", Color.parseColor(isDark ? "#E6E0E8" : "#1D1B20")));
        String surfaceVariant = toHex(getSystemColor(resources, isDark ? "system_neutral2_300" : "system_neutral2_900", Color.parseColor(isDark ? "#49454F" : "#E6E0EB")));
        String onSurfaceVariant = toHex(getSystemColor(resources, isDark ? "system_neutral2_800" : "system_neutral2_300", Color.parseColor(isDark ? "#CAC4CF" : "#49454F")));
        String outline = toHex(getSystemColor(resources, isDark ? "system_neutral2_600" : "system_neutral2_500", Color.parseColor(isDark ? "#948F99" : "#7A757F")));

        tokens.put("primary", primary);
        tokens.put("onPrimary", onPrimary);
        tokens.put("primaryContainer", primaryContainer);
        tokens.put("onPrimaryContainer", onPrimaryContainer);
        tokens.put("secondary", secondary);
        tokens.put("onSecondary", onSecondary);
        tokens.put("secondaryContainer", secondaryContainer);
        tokens.put("onSecondaryContainer", onSecondaryContainer);
        tokens.put("surface", surface);
        tokens.put("onSurface", onSurface);
        tokens.put("surfaceVariant", surfaceVariant);
        tokens.put("onSurfaceVariant", onSurfaceVariant);
        tokens.put("outline", outline);
        tokens.put("error", isDark ? "#FFB4AB" : "#BA1A1A");
        return tokens;
    }

    @PluginMethod
    public void getMaterialTheme(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            JSObject result = new JSObject();
            result.put("supported", false);
            result.put("isDynamic", false);
            call.resolve(result);
            return;
        }

        boolean isDark = call.getBoolean("isDark", isDarkMode());
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("isDynamic", true);
        result.put("tokens", buildTokens(isDark));
        call.resolve(result);
    }
}
