package com.vespraevent.videobooth;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

/* Résultat de la mise à jour : demande la confirmation d'Android, ou affiche l'erreur. */
public class InstallReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        int etat = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (etat == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent conf = i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (conf != null) { conf.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(conf); }
        } else if (etat != PackageInstaller.STATUS_SUCCESS) {
            Toast.makeText(c, "Mise à jour impossible : " + i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE), Toast.LENGTH_LONG).show();
        }
    }
}
