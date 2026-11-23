package com.vespraevent.videobooth;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.webkit.JavascriptInterface;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.text.InputType;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Vespra Vidéobooth — l'écran du vidéobooth en plein écran sur une tablette Android.
 * L'application ne contient aucun écran : elle ouvre le site (toujours à jour) et laisse passer la caméra et le micro.
 */
public class MainActivity extends Activity {
    private static final String ADRESSE = "https://www.vespraevent.fr/videobooth/";
    private static final String HOTE = "vespraevent.fr";
    private static final int CODE_PERMISSIONS = 7;

    /* Code pour quitter le mode tablette dédiée (le même que le menu du vidéobooth) */
    private static final String CODE_SORTIE = "0104";
    private WebView web;
    private boolean admin = false;   /* vrai dans les réglages du vidéobooth : la barre du système reste visible */
    private int touches = 0;
    private long premiereTouche = 0;
    private PermissionRequest enAttente;
    private boolean horsLigne = false;
    private final Handler tempo = new Handler(Looper.getMainLooper());
    private final Runnable reessayer = new Runnable() {
        @Override public void run() { if (horsLigne && web != null) web.loadUrl(ADRESSE); }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        FrameLayout racine = new FrameLayout(this);
        racine.addView(web, new FrameLayout.LayoutParams(-1, -1));
        /* zone cachée en haut à gauche : 5 appuis rapides ouvrent la sortie (réservée au personnel) */
        View coin = new View(this);
        int t = (int) (110 * getResources().getDisplayMetrics().density);
        racine.addView(coin, new FrameLayout.LayoutParams(t, t));
        coin.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { toucheCoin(); } });
        setContentView(racine);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " VespraVideobooth/1.0");
        web.setOnLongClickListener(new View.OnLongClickListener() { @Override public boolean onLongClick(View v) { return true; } });
        web.setLongClickable(false);

        /* le vidéobooth prévient l'application quand les réglages (après le code) s'ouvrent ou se ferment */
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public void admin(final boolean on) {
                runOnUiThread(new Runnable() { @Override public void run() { admin = on; plein(); } });
            }
        }, "VespraAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String h = r.getUrl().getHost();
                return !(h != null && (h.equals(HOTE) || h.endsWith("." + HOTE)));   /* seuls les pages du site s'ouvrent */
            }
            @Override public void onPageStarted(WebView v, String u, Bitmap f) { horsLigne = false; }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) {
                    horsLigne = true;
                    v.loadDataWithBaseURL(null, PAGE_HORS_LIGNE, "text/html", "utf-8", null);
                    tempo.postDelayed(reessayer, 5000);   /* nouvelle tentative toute seule */
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(final PermissionRequest r) {
                Uri o = r.getOrigin();
                String h = o == null ? null : o.getHost();
                if (h == null || !(h.equals(HOTE) || h.endsWith("." + HOTE))) { r.deny(); return; }
                if (Build.VERSION.SDK_INT >= 23 && (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
                        || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)) {
                    enAttente = r;
                    requestPermissions(new String[]{ Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO }, CODE_PERMISSIONS);
                } else r.grant(r.getResources());
            }
        });

        if (Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{ Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO }, CODE_PERMISSIONS);
        if (b != null) web.restoreState(b); else web.loadUrl(ADRESSE);
        inviterApplicationAccueil();
    }

    @Override public void onRequestPermissionsResult(int code, String[] p, int[] res) {
        if (code != CODE_PERMISSIONS || enAttente == null) return;
        boolean ok = res.length > 0;
        for (int x : res) if (x != PackageManager.PERMISSION_GRANTED) ok = false;
        if (ok) enAttente.grant(enAttente.getResources()); else enAttente.deny();
        enAttente = null;
    }

    /* première ouverture : propose de faire de Vespra Vidéobooth l'application d'accueil (démarrage automatique) */
    private void inviterApplicationAccueil() {
        final SharedPreferences p = getSharedPreferences("vb", MODE_PRIVATE);
        if (p.getBoolean("accueil_propose", false)) return;
        p.edit().putBoolean("accueil_propose", true).apply();
        tempo.postDelayed(new Runnable() { @Override public void run() {
            Toast.makeText(MainActivity.this, "Choisissez « Vespra Vidéobooth » puis « Toujours » pour qu'il s'ouvre au démarrage", Toast.LENGTH_LONG).show();
            try { Intent h = new Intent(Intent.ACTION_MAIN); h.addCategory(Intent.CATEGORY_HOME); startActivity(h); } catch (Exception e) { }
        } }, 2500);
    }

    private void toucheCoin() {
        long n = System.currentTimeMillis();
        if (n - premiereTouche > 3000) { touches = 0; premiereTouche = n; }
        if (++touches < 5) return;
        touches = 0;
        final EditText code = new EditText(this);
        code.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        code.setHint("Code");
        new AlertDialog.Builder(this).setTitle("Sortie du vidéobooth").setView(code)
            .setPositiveButton("Réglages Android", new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) {
                if (!CODE_SORTIE.equals(code.getText().toString().trim())) { Toast.makeText(MainActivity.this, "Code incorrect", Toast.LENGTH_SHORT).show(); return; }
                try { if (epingle()) stopLockTask(); } catch (Exception e) { }
                startActivity(new Intent(Settings.ACTION_SETTINGS));
            } })
            .setNeutralButton("Application d'accueil", new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) {
                if (!CODE_SORTIE.equals(code.getText().toString().trim())) { Toast.makeText(MainActivity.this, "Code incorrect", Toast.LENGTH_SHORT).show(); return; }
                try { if (epingle()) stopLockTask(); } catch (Exception e) { }
                try { startActivity(new Intent(Settings.ACTION_HOME_SETTINGS)); } catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
            } })
            .setNegativeButton("Annuler", null).show();
    }

    private boolean epingle() {
        try { return ((ActivityManager) getSystemService(ACTIVITY_SERVICE)).getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE; }
        catch (Exception e) { return false; }
    }

    /* Invités : barres masquées ET épinglage de l'application, ce qui empêche le balayage depuis le bas de faire apparaître la barre.
       Réglages (après le code) : épinglage levé, barre visible en permanence. */
    private void plein() {
        if (admin) {
            try { if (epingle()) stopLockTask(); } catch (Exception e) { }
            if (Build.VERSION.SDK_INT >= 30) {
                getWindow().setDecorFitsSystemWindows(true);
                WindowInsetsController c = getWindow().getInsetsController();
                if (c != null) { c.show(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_DEFAULT); }
            } else {
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
            }
            return;
        }
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
        try { if (!epingle()) startLockTask(); } catch (Exception e) { /* refusé : les barres restent seulement masquées */ }
    }
    @Override protected void onResume() { super.onResume(); plein(); web.onResume(); if (horsLigne) web.loadUrl(ADRESSE); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) plein(); }
    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
    /* le retour de la tablette ne quitte pas le vidéobooth (les invités ne le ferment pas par erreur) */
    @Override public void onBackPressed() { }
    @Override protected void onDestroy() { tempo.removeCallbacksAndMessages(null); web.destroy(); super.onDestroy(); }

    private static final String PAGE_HORS_LIGNE = "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><body style=\"margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;background:#fff;color:#0C0F14;text-align:center\"><h1 style='font-size:26px;margin:0 0 10px'>Pas de connexion</h1><p style='color:#646D7C;margin:0'>Vérifiez le Wi-Fi de la tablette. Nouvelle tentative automatique…</p></body>";
}
