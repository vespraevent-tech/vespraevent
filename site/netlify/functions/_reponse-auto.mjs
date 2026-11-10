/* Réponse automatique : textes par défaut et lecture du réglage (partagés entre
   le back-office, la fonction d'envoi et la notification). Le réglage est
   enregistré côté serveur (Netlify Blobs), clé « reponse-auto ». */
export const CLE = 'reponse-auto';

const T_RES = 'Une question, un changement ? Répondez simplement à ce mail ou appelez-nous.';
const DISPO = 'Votre demande est faite sous réserve de disponibilité du matériel : d\u2019autres clients peuvent réserver entre-temps. Nous vous répondons au plus vite afin de valider votre réservation rapidement.';
export const DEFAUTS = {
  actif: true,
  delai: 30,   /* secondes entre la demande du client et l'envoi du mail */
  devis: {
    objet: 'Votre demande est bien reçue — Vespra Event',
    titre: 'Votre demande est bien reçue',
    message: 'Merci de nous avoir contactés ! Votre devis est joint à ce mail. Pour confirmer, complétez le cadre prévu sur le devis et retournez-le-nous signé par e-mail.\n\n' + T_RES,
    dispo: DISPO,
  },
  sans: {
    objet: 'Votre demande est bien reçue — Vespra Event',
    titre: 'Votre demande est bien reçue',
    message: 'Merci de nous avoir contactés ! Notre équipe prépare votre devis et vous l\u2019envoie sous 24 h.\n\n' + T_RES,
    dispo: DISPO,
  },
};

/* Relance automatique d'une demande restée sans suite (envoyée une seule fois par demande) */
DEFAUTS.relance = {
  actif: false,
  jours: 3,
  avec: {
    objet: 'Votre devis Vespra Event',
    titre: 'Avez-vous bien reçu notre devis ?',
    message: 'Nous revenons vers vous au sujet de votre demande de location. Vous avez dû recevoir notre devis il y a quelques jours (si ce n\u2019est pas le cas, merci de nous l\u2019indiquer).\n\n'
      + 'Si vous avez la moindre question, ou si vous souhaitez ajuster quelque chose (matériel, date, livraison), répondez simplement à ce mail : nous nous ferons un plaisir de vous aider.\n\n'
      + 'Et si vous préférez voir le matériel de vos propres yeux, vous pouvez venir le découvrir dans nos locaux.',
  },
  sans: {
    objet: 'Votre demande — Vespra Event',
    titre: 'Où en est votre projet ?',
    message: 'Nous revenons vers vous au sujet de votre demande de location. Où en est votre projet ?\n\n'
      + 'Nous restons à votre disposition pour préciser un point, ajuster le matériel ou répondre à vos questions : répondez simplement à ce mail.\n\n'
      + 'Et si vous préférez voir le matériel de vos propres yeux, vous pouvez venir le découvrir dans nos locaux.',
  },
};

/* Demande d'avis après la location (Google Maps en priorité, puis avis des produits sur le site) */
DEFAUTS.avis = {
  actif: true,
  jours: 2,
  lienGoogle: 'https://maps.app.goo.gl/Xx467HsxADjk95Tw8',
  objet: 'Votre avis compte pour nous — Vespra Event',
  titre: 'Votre location s\u2019est bien passée ?',
  parrainage: 'Vous pouvez désormais parrainer vos proches : ils ont 10 € de remise (dès 40 € de panier) et vous gagnez 10 € sur votre prochaine location, une fois la leur passée.',
  message: 'Merci d\u2019avoir fait confiance à Vespra Event. Nous espérons que votre événement s\u2019est bien passé !\n\n'
    + 'Si vous ne l\u2019avez pas encore fait, vous pouvez nous laisser un avis Google : cela nous aide beaucoup. Et si c\u2019est déjà fait, nous vous en remercions chaleureusement.',
};

const borne = (v, n, repli) => { const s = String(v == null ? '' : v).replace(/\r/g, '').slice(0, n); return s.trim() ? s : repli; };

/* assemble réglage enregistré + valeurs par défaut (un champ vide revient au texte d'origine) */
export function fusion(saisi) {
  const s = saisi && typeof saisi === 'object' ? saisi : {};
  const un = (k) => {
    const x = s[k] && typeof s[k] === 'object' ? s[k] : {};
    return { objet: borne(x.objet, 150, DEFAUTS[k].objet), titre: borne(x.titre, 150, DEFAUTS[k].titre), message: borne(x.message, 4000, DEFAUTS[k].message), dispo: borne(x.dispo, 1000, DEFAUTS[k].dispo) };
  };
  const rl = s.relance && typeof s.relance === 'object' ? s.relance : {};
  const dr = DEFAUTS.relance;
  const ur = (k) => {
    const x = rl[k] && typeof rl[k] === 'object' ? rl[k] : {};
    return { objet: borne(x.objet, 150, dr[k].objet), titre: borne(x.titre, 150, dr[k].titre), message: borne(x.message, 4000, dr[k].message) };
  };
  const jours = Math.min(30, Math.max(1, Math.round(Number(rl.jours)) || dr.jours));
  const av = s.avis && typeof s.avis === 'object' ? s.avis : {};
  const da = DEFAUTS.avis;
  const lien = /^https:\/\/[^\s"<>]{6,300}$/.test(String(av.lienGoogle || '').trim()) ? String(av.lienGoogle).trim() : da.lienGoogle;
  const avis = { actif: av.actif === undefined ? da.actif : av.actif === true, jours: Math.min(30, Math.max(1, Math.round(Number(av.jours)) || da.jours)), lienGoogle: lien,
    objet: borne(av.objet, 150, da.objet), titre: borne(av.titre, 150, da.titre), message: borne(av.message, 4000, da.message),
    parrainage: borne(av.parrainage, 1500, da.parrainage) };
  const dl = Number(s.delai);
  const delai = Number.isFinite(dl) && s.delai !== '' && s.delai !== null && s.delai !== undefined ? Math.min(900, Math.max(10, Math.round(dl))) : DEFAUTS.delai;
  return { actif: s.actif === undefined ? DEFAUTS.actif : s.actif === true, delai, devis: un('devis'), sans: un('sans'), avis,
    relance: { actif: rl.actif === true, jours, avec: ur('avec'), sans: ur('sans') } };
}

export async function lireReglage(store) {
  try { return fusion(await store.get(CLE, { type: 'json', consistency: 'strong' })); }
  catch { return fusion(null); }
}
