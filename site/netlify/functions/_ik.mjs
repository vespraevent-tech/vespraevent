/* ═══════════════════════════════════════════════════════
   ÉTAT DES INDEMNITÉS KILOMÉTRIQUES — PDF justificatif, même style que la facture.
   Barème fiscal des voitures (inchangé depuis 2023, gelé en 2026). Le calcul est refait ici
   à partir des kilomètres : on ne fait pas confiance aux montants envoyés par le navigateur.
   ═══════════════════════════════════════════════════════ */
import { Page, assembler, couper, euros, jourFr, NAVY, NOIR, GRIS, GRIS_CLAIR } from './_facture.mjs';

export const BAREME = {
  '3': { nom: '3 CV et moins', a: 0.529, b: 0.316, c: 1065, e: 0.370 },
  '4': { nom: '4 CV', a: 0.606, b: 0.340, c: 1330, e: 0.407 },
  '5': { nom: '5 CV', a: 0.636, b: 0.357, c: 1395, e: 0.427 },
  '6': { nom: '6 CV', a: 0.665, b: 0.374, c: 1457, e: 0.447 },
  '7': { nom: '7 CV et plus', a: 0.697, b: 0.394, c: 1515, e: 0.470 },
};
export const ik = (d, cv, elec) => { const b = BAREME[cv] || BAREME['5']; const r = d <= 5000 ? d * b.a : d <= 20000 ? d * b.b + b.c : d * b.e; return r * (elec ? 1.2 : 1); };
const nb = (n, d = 2) => (Math.round(Number(n || 0) * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
const A4H = 841.89, G = 48, D = 595.28 - 48;

export function construireEtatIK({ emetteur, beneficiaire, annee, vehicule, trajets, reference }) {
  const e = emetteur || {}, v = vehicule || {};
  const cv = BAREME[v.cv] ? v.cv : '5', elec = v.elec === true;
  /* cumul annuel : le taux dépend du total de l'année, pas du trajet */
  const tri = (trajets || []).filter((t) => Number(t.km) > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let cumul = 0;
  const lignes = tri.map((t) => {
    const km = Number(t.km), avant = cumul; cumul += km;
    return { date: jourFr(t.date) || String(t.date || ''), motif: String(t.motif || ''), depart: String(t.depart || ''), arrivee: String(t.arrivee || ''), etapes: String(t.etapes || ''), client: String(t.client || ''), km, cumul,
      ind: Math.round((ik(cumul, cv, elec) - ik(avant, cv, elec)) * 100) / 100 };
  });
  const totalKm = cumul, total = Math.round(lignes.reduce((t, l) => t + l.ind, 0) * 100) / 100;
  const b = BAREME[cv];
  const pages = []; const nouvelle = () => { const p = new Page(); pages.push(p); return p; };
  let p = nouvelle(), y = A4H - 56;
  const hui = new Date(), dateEm = String(hui.getDate()).padStart(2, '0') + '/' + String(hui.getMonth() + 1).padStart(2, '0') + '/' + hui.getFullYear();

  p.texte(G, y, 'VESPRA EVENT', { taille: 22, gras: true, couleur: NAVY });
  p.texte(D, y + 1, 'ÉTAT DES FRAIS KILOMÉTRIQUES', { taille: 12.5, gras: true, couleur: NOIR, align: 'droite' });
  y -= 19;
  p.texte(G, y, [e.forme, e.capital ? 'capital ' + e.capital : ''].filter(Boolean).join(' — '), { taille: 8.5, couleur: GRIS });
  p.texte(D, y, 'Année ' + annee + (reference ? ' — ' + reference : ''), { taille: 9, gras: true, couleur: GRIS, align: 'droite' });
  y -= 12;
  (e.adresse || []).forEach((l, i) => { p.texte(G, y, l, { taille: 8.5, couleur: GRIS }); if (i === 0) p.texte(D, y, 'Établi le ' + dateEm, { taille: 8.5, couleur: GRIS, align: 'droite' }); y -= 12; });
  y -= 10; p.pave(G, y + 8, D - G, 1.6, NAVY); y -= 16;

  /* bénéficiaire et véhicule */
  const h = 80;
  p.rond(G, y - h, D - G, h, 5, { fond: GRIS_CLAIR });
  p.texte(G + 14, y - 17, 'BÉNÉFICIAIRE', { taille: 7.5, gras: true, couleur: GRIS });
  p.texte(G + 14, y - 33, beneficiaire || '', { taille: 11.5, gras: true, couleur: NOIR });
  p.texte((G + D) / 2 + 10, y - 17, 'VÉHICULE PERSONNEL UTILISÉ', { taille: 7.5, gras: true, couleur: GRIS });
  p.texte((G + D) / 2 + 10, y - 33, [b.nom, elec ? 'électrique (+20 %)' : ''].filter(Boolean).join(' — '), { taille: 10, gras: true, couleur: NOIR });
  p.texte((G + D) / 2 + 10, y - 47, 'Immatriculation : ' + (v.immat || '—'), { taille: 9, couleur: NOIR });
  p.texte(G + 14, y - 68, 'Déplacements professionnels effectués pour le compte de la société.', { taille: 8.5, couleur: GRIS });
  y -= h + 24;

  const X = { date: G + 12, motif: G + 68, km: D - 118, cum: D - 62, ind: D - 10 };
  const entete = (pg, yy) => {
    pg.pave(G, yy - 8, D - G, 24, GRIS_CLAIR);
    const o = { taille: 7.5, gras: true, couleur: GRIS };
    pg.texte(X.date, yy, 'DATE', o); pg.texte(X.motif, yy, 'MOTIF · ITINÉRAIRE', o);
    pg.texte(X.km, yy, 'KM', { ...o, align: 'droite' }); pg.texte(X.cum, yy, 'CUMUL', { ...o, align: 'droite' }); pg.texte(X.ind, yy, 'INDEMNITÉ', { ...o, align: 'droite' });
    return yy - 26;
  };
  y = entete(p, y);
  const lg = X.km - X.motif - 40;
  for (const l of lignes) {
    const iti = [l.depart && l.arrivee ? `De ${l.depart} à ${l.arrivee}` : (l.depart ? 'Départ : ' + l.depart : 'Arrivée : ' + l.arrivee), l.etapes ? 'étapes : ' + l.etapes : ''].filter(Boolean).join(' — ');
    const m1 = couper([l.motif || 'Déplacement professionnel', l.client ? '(' + l.client + ')' : ''].filter(Boolean).join(' '), 9, true, lg);
    const m2 = iti ? couper(iti, 8, false, lg) : [];
    const hh = (m1.length + m2.length) * 11 + 12;
    if (y - hh < 150) { p = nouvelle(); y = A4H - 70; y = entete(p, y); }
    p.texte(X.date, y, l.date, { taille: 9, couleur: NOIR });
    m1.forEach((t, i) => p.texte(X.motif, y - i * 11, t, { taille: 9, gras: true, couleur: NOIR }));
    p.texte(X.km, y, nb(l.km, l.km % 1 ? 1 : 0), { taille: 9, couleur: NOIR, align: 'droite' });
    p.texte(X.cum, y, nb(l.cumul, l.cumul % 1 ? 1 : 0), { taille: 9, couleur: GRIS, align: 'droite' });
    p.texte(X.ind, y, euros(l.ind), { taille: 9, gras: true, couleur: NOIR, align: 'droite' });
    let yy = y - m1.length * 11;
    m2.forEach((t) => { p.texte(X.motif, yy, t, { taille: 8, couleur: GRIS }); yy -= 11; });
    y = yy - 6; p.filet(G, y + 3, D, y + 3, { couleur: [0.88, 0.89, 0.92], epaisseur: 0.5 }); y -= 11;
  }

  if (y < 250) { p = nouvelle(); y = A4H - 90; }
  y -= 6;
  p.rond(D - 220, y - 44, 220, 44, 6, { fond: NAVY });
  p.texte(D - 220 + 14, y - 20, nb(totalKm, totalKm % 1 ? 1 : 0) + ' km sur l’année', { taille: 8, gras: true, couleur: [1, 1, 1] });
  p.texte(D - 220 + 14, y - 34, 'TOTAL À REMBOURSER', { taille: 7.5, gras: true, couleur: [1, 1, 1] });
  p.texte(D - 14, y - 30, euros(total), { taille: 16, gras: true, couleur: [1, 1, 1], align: 'droite' });
  const y0 = y - 52;
  p.texte(G, y0 - 12, 'Calcul : barème kilométrique fiscal des voitures, ' + b.nom + (elec ? ', majoré de 20 % (véhicule électrique)' : '') + '.', { taille: 7.8, couleur: GRIS });
  p.texte(G, y0 - 23, `jusqu’à 5 000 km : d × ${nb(b.a, 3)}  ·  de 5 001 à 20 000 km : d × ${nb(b.b, 3)} + ${b.c}  ·  au-delà de 20 000 km : d × ${nb(b.e, 3)}  (d = total annuel de km professionnels)`, { taille: 7.8, couleur: GRIS });
  p.texte(G, y0 - 34, 'Indemnité d’un trajet = indemnité du cumul annuel après le trajet, moins celle du cumul avant.', { taille: 7.8, couleur: GRIS });
  p.texte(G, y0 - 45, 'Elle couvre le carburant, l’usure, l’entretien et l’assurance du véhicule.', { taille: 7.8, couleur: GRIS });
  y = y0 - 82;

  /* attestation et signatures */
  p.texte(G, y, 'Je certifie sur l’honneur l’exactitude de cet état : les trajets ci-dessus sont des déplacements professionnels effectués avec le véhicule indiqué.', { taille: 8.5, couleur: NOIR });
  y -= 30;
  p.texte(G, y, 'Le bénéficiaire (date et signature)', { taille: 8.5, gras: true, couleur: GRIS });
  p.texte(D, y, 'Pour la société — approuvé (date et signature)', { taille: 8.5, gras: true, couleur: GRIS, align: 'droite' });
  p.filet(G, y - 52, G + 200, y - 52); p.filet(D - 200, y - 52, D, y - 52);

  const mentions = `${e.nom || 'Vespra Event'} — ${e.forme || ''} — SIRET ${e.siret || ''} — RCS ${e.rcs || ''}`;
  pages.forEach((pg, i) => {
    pg.filet(G, 46, D, 46, { couleur: NAVY, epaisseur: 0.9 });
    pg.texte(G, 32, mentions, { taille: 6.4, couleur: GRIS });
    pg.texte(D, 32, 'À conserver avec la copie de la carte grise · état des frais kilométriques ' + annee + (pages.length > 1 ? ' — page ' + (i + 1) + '/' + pages.length : ''), { taille: 6.4, couleur: GRIS, align: 'droite' });
  });
  return assembler(pages);
}
