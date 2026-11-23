package com.vespraevent.videobooth;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Au démarrage de la tablette, ouvre le vidéobooth (selon la version d'Android, l'application d'accueil prend le relais). */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        try {
            Intent l = new Intent(c, MainActivity.class);
            l.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(l);
        } catch (Exception e) { /* refusé par Android : l'application d'accueil s'en charge */ }
    }
}
