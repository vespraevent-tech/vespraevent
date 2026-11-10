/* ═══════════════════════════════════════════════════════════════════
   NOTE DE FRAIS — PDF sans bibliothèque, dans le même style que la facture.
   Une note (carburant d'une livraison avec le véhicule personnel du gérant)
   ou un récapitulatif de plusieurs notes (un trimestre).
   ═══════════════════════════════════════════════════════════════════ */
import { Page, assembler, largeur, couper, euros, jourFr, NAVY, NOIR, GRIS, GRIS_CLAIR } from './_facture.mjs';

const nb = (n, d = 2) => (Math.round(Number(n || 0) * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
const A4H = 841.89, G = 48, D = 595.28 - 48;

export function construireNoteFrais({ emetteur, beneficiaire, titre, reference, notes }) {
  const e = emetteur || {};
  const lignes = notes.map((n) => {
    const km = Number(n.km) || 0, conso = Number(n.conso) || 0, prix = Number(n.prix) || 0;
    const litres = Number(n.litres) || (km && conso ? km * conso / 100 : 0);
    const montant = Number(n.montant) || litres * prix;
    return { numero: String(n.numero || ''), date: jourFr(n.date) || String(n.date || ''), motif: String(n.motif || ''), km, conso, litres, prix, montant };
  });
  const total = Math.round(lignes.reduce((t, l) => t + l.montant, 0) * 100) / 100;
  const totalKm = lignes.reduce((t, l) => t + l.km, 0);
  const pages = [];
  const nouvelle = () => { const p = new Page(); pages.push(p); return p; };
  let p = nouvelle();
  let y = A4H - 56;

  /* en-tête : deux colonnes calées sur les mêmes lignes de base */
  const hui = new Date();
  const dateEmission = String(hui.getDate()).padStart(2, '0') + '/' + String(hui.getMonth() + 1).padStart(2, '0') + '/' + hui.getFullYear();
  p.texte(G, y, 'VESPRA EVENT', { taille: 22, gras: true, couleur: NAVY });
  p.texte(D, y + 1, 'NOTE DE FRAIS', { taille: 14, gras: true, couleur: NOIR, align: 'droite' });
  y -= 19;
  p.texte(G, y, [e.forme, e.capital ? 'capital ' + e.capital : ''].filter(Boolean).join(' — '), { taille: 8.5, couleur: GRIS });
  if (reference) p.texte(D, y, reference, { taille: 9, gras: true, couleur: GRIS, align: 'droite' });
  y -= 12;
  const adr = e.adresse || [];
  adr.forEach((l, i) => {
    p.texte(G, y, l, { taille: 8.5, couleur: GRIS });
    if (i === 0) p.texte(D, y, 'Émise le ' + dateEmission, { taille: 8.5, couleur: GRIS, align: 'droite' });
    y -= 12;
  });
  if (!adr.length) { p.texte(D, y, 'Émise le ' + dateEmission, { taille: 8.5, couleur: GRIS, align: 'droite' }); y -= 12; }
  y -= 10;
  p.pave(G, y + 8, D - G, 1.6, NAVY);
  y -= 16;

  /* bénéficiaire : bloc compact, texte aligné sur la marge */
  const hBen = 56;
  p.rond(G, y - hBen, D - G, hBen, 5, { fond: GRIS_CLAIR });
  p.texte(G + 14, y - 17, 'BÉNÉFICIAIRE', { taille: 7.5, gras: true, couleur: GRIS });
  p.texte(G + 14, y - 33, beneficiaire || '', { taille: 11.5, gras: true, couleur: NOIR });
  p.texte(G + 14, y - 47, (lignes.every(l => l.km > 0) ? 'Frais de carburant avancés avec un véhicule personnel' : 'Frais avancés à titre personnel') + ', pour le compte de ' + (e.nom || 'Vespra Event') + '.', { taille: 8.5, couleur: GRIS });
  y -= hBen + 26;
  if (titre) { p.texte(G, y, titre, { taille: 12, gras: true, couleur: NOIR }); y -= 26; }

  /* tableau */
  const X = { num: G + 14, date: G + 90, motif: G + 154, km: D - 184, conso: D - 130, prix: D - 78, mont: D - 14 };
  const entete = (pg, yy) => {
    pg.pave(G, yy - 8, D - G, 24, GRIS_CLAIR);
    const o = { taille: 7.5, gras: true, couleur: GRIS };
    pg.texte(X.num, yy, 'N°', o); pg.texte(X.date, yy, 'DATE', o); pg.texte(X.motif, yy, 'DESTINATION / MOTIF', o);
    pg.texte(X.km, yy, 'KM', { ...o, align: 'droite' }); pg.texte(X.conso, yy, 'L/100', { ...o, align: 'droite' });
    pg.texte(X.prix, yy, '€ / L', { ...o, align: 'droite' }); pg.texte(X.mont, yy, 'MONTANT', { ...o, align: 'droite' });
    return yy - 26;
  };
  y = entete(p, y);
  const largeurMotif = X.km - X.motif - 30;
  for (const l of lignes) {
    const mot = couper(l.motif || '—', 9, false, largeurMotif);
    const h = Math.max(1, mot.length) * 11 + (l.litres ? 11 : 0) + 14;
    if (y - h < 120) { p = nouvelle(); y = A4H - 70; y = entete(p, y); }
    p.texte(X.num, y, l.numero, { taille: 8.5, couleur: GRIS });
    p.texte(X.date, y, l.date, { taille: 9, couleur: NOIR });
    mot.forEach((t, i) => p.texte(X.motif, y - i * 11, t, { taille: 9, couleur: NOIR }));
    p.texte(X.km, y, l.km ? nb(l.km, l.km % 1 ? 1 : 0) : '', { taille: 9, couleur: NOIR, align: 'droite' });
    p.texte(X.conso, y, l.conso ? nb(l.conso, 1) : '', { taille: 9, couleur: NOIR, align: 'droite' });
    p.texte(X.prix, y, l.prix ? nb(l.prix, 3) : '', { taille: 9, couleur: NOIR, align: 'droite' });
    p.texte(X.mont, y, euros(l.montant), { taille: 9, gras: true, couleur: NOIR, align: 'droite' });
    let yy = y - mot.length * 11;
    if (l.litres) { p.texte(X.motif, yy, nb(l.litres, 2) + ' L de carburant', { taille: 8, couleur: GRIS }); yy -= 11; }
    y = yy - 9;
    p.filet(G, y + 3, D, y + 3, { couleur: [0.88, 0.89, 0.92], epaisseur: 0.5 });
    y -= 11;
  }

  /* total : résumé à gauche, montant à droite, sur la même ligne centrale */
  if (y < 190) { p = nouvelle(); y = A4H - 90; }
  y -= 8;
  const hT = 44, haut = y;
  p.rond(D - 210, haut - hT, 210, hT, 6, { fond: NAVY });
  p.texte(D - 210 + 14, haut - 26, 'TOTAL À REMBOURSER', { taille: 8, gras: true, couleur: [1, 1, 1] });
  p.texte(D - 14, haut - 28, euros(total), { taille: 16, gras: true, couleur: [1, 1, 1], align: 'droite' });
  y = haut - hT - 10;

  /* pied de page, sur chaque page */
  const mentions = `${e.nom || 'Vespra Event'} — ${e.forme || ''} — SIRET ${e.siret || ''} — RCS ${e.rcs || ''} — TVA ${e.tva || ''}`;
  pages.forEach((pg, i) => {
    pg.filet(G, 46, D, 46, { couleur: NAVY, epaisseur: 0.9 });
    pg.texte(G, 32, mentions, { taille: 6.4, couleur: GRIS });
    pg.texte(D, 32, (reference || 'Note de frais') + (pages.length > 1 ? ' — page ' + (i + 1) + '/' + pages.length : ''), { taille: 6.4, couleur: GRIS, align: 'droite' });
  });
  return assembler(pages);
}
