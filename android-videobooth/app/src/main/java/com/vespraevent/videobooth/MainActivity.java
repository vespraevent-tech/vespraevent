package com.vespraevent.videobooth;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
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

    private WebView web;
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
        setContentView(web);

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
    }

    @Override public void onRequestPermissionsResult(int code, String[] p, int[] res) {
        if (code != CODE_PERMISSIONS || enAttente == null) return;
        boolean ok = res.length > 0;
        for (int x : res) if (x != PackageManager.PERMISSION_GRANTED) ok = false;
        if (ok) enAttente.grant(enAttente.getResources()); else enAttente.deny();
        enAttente = null;
    }

    private void plein() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
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
