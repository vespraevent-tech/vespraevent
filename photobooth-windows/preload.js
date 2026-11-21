/* Pont entre la page /photobooth/app et Windows : exposé à la page sous window.vespraBorne */
const { contextBridge, ipcRenderer } = require('electron');
let etat = ipcRenderer.sendSync('etat');
let visee = null;
contextBridge.exposeInMainWorld('vespraBorne', {
  version: etat.version,
  nomAppareil: () => etat.appareil,
  imprimante: () => etat.imprimante,
  /* visée en direct : images de digiCamControl affichées dans l'élément <img> fourni */
  demarrerVisee: async (img) => {
    await ipcRenderer.invoke('visee', true);
    clearInterval(visee);
    const tour = async () => { const u = await ipcRenderer.invoke('image-visee'); if (u) { const ancien = img.src; img.src = u; if (ancien && ancien.startsWith('blob:')) URL.revokeObjectURL(ancien); } };
    visee = setInterval(tour, 90); tour();
  },
  arreterVisee: () => { clearInterval(visee); visee = null; ipcRenderer.invoke('visee', false); },
  /* déclenche le reflex et renvoie la photo en pleine définition (Blob JPEG) */
  declencher: async () => { const r = await ipcRenderer.invoke('declencher'); if (!r || !r.ok) throw new Error((r && r.erreur) || 'Appareil photo indisponible'); return new Blob([r.octets], { type: 'image/jpeg' }); },
  enregistrer: async (evt, nom, blob) => ipcRenderer.invoke('enregistrer', evt, nom, new Uint8Array(await blob.arrayBuffer())),
  erreurAppareil: () => etat.erreurCanon || '',
  ouvrirDossier: (evt) => ipcRenderer.invoke('ouvrir-dossier', evt),
  dossier: (d) => { etat.dossier = d; ipcRenderer.invoke('reglage', 'dossier', d); },
  demarrageAuto: (v) => { if (v === undefined) return etat.demarrageAuto; etat.demarrageAuto = !!v; ipcRenderer.invoke('reglage', 'demarrageAuto', !!v); return !!v; },
  imprimer: async (blob, o) => ipcRenderer.invoke('imprimer', new Uint8Array(await blob.arrayBuffer()), o || {}),
  pleinEcran: (v) => ipcRenderer.invoke('plein-ecran', v !== false),
  reglagesAppareil: (boite) => {
    const p = etat;
    boite.innerHTML = '<p class="aide">' + (p.appareil ? 'Reflex connecté en USB.' : 'Reflex <b>non détecté</b>. Vérifiez : câble USB, boîtier allumé, batterie factice. Première fois sur ce PC ? Cliquez sur « Préparer l’appareil photo » et suivez la notice (une seule fois), puis rallumez le boîtier.') + '</p>'
      + (p.appareil ? '' : '<p><button class="btn" id="vb-prep">Préparer l’appareil photo (une seule fois)</button></p>' + (p.erreurCanon ? '<p class="aide petit">Détail : ' + String(p.erreurCanon).replace(/</g, '&lt;') + '</p>' : ''))
      + '<p class="aide">Ouverture, vitesse, ISO, balance des blancs : réglez-les sur le Canon en mode M (ils restent mémorisés).</p>'
      + '<label class="champ">Imprimante des photos 10×15</label><select id="vb-impr"></select>'
      + '<label class="champ">Imprimante des bandelettes 5×15 (la DNP ajoutée une 2e fois, réglée en coupe 2 pouces)</label><select id="vb-bandes"></select>';
    const pr = boite.querySelector('#vb-prep'); if (pr) pr.onclick = () => ipcRenderer.invoke('preparer-appareil');
    ipcRenderer.invoke('imprimantes').then((l) => {
      for (const [id, cle] of [['#vb-impr', 'imprimante'], ['#vb-bandes', 'imprimanteBandes']]) {
        const s = boite.querySelector(id);
        s.innerHTML = (cle === 'imprimanteBandes' ? '<option value="">(la même)</option>' : '') + l.map((n) => '<option' + (n === p[cle] ? ' selected' : '') + '>' + n.replace(/</g, '&lt;') + '</option>').join('');
        s.onchange = () => { p[cle] = s.value; ipcRenderer.invoke('reglage', cle, s.value); };
      }
    });
  },
});
ipcRenderer.on('etat', (_e, n) => { etat = n; });
