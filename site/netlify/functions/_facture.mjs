/* ═══════════════════════════════════════════════════════════════════
   FACTURE — fabrication du PDF, sans aucune bibliothèque

   Un PDF est un format simple quand on s'en tient au texte et aux
   filets : quelques objets, une police standard, des coordonnées en
   points. C'est ce que fait ce fichier. Aucune dépendance à installer,
   donc rien qui puisse casser au déploiement.

   Les polices utilisées (Helvetica et Helvetica-Bold) sont intégrées à
   tous les lecteurs PDF : le fichier reste léger et s'ouvre partout.
   Le texte est encodé en WinAnsi, qui couvre les accents français et
   le signe euro.
   ═══════════════════════════════════════════════════════════════════ */

/* ── encodage WinAnsi ───────────────────────────────────────────────
   Les caractères au-delà de l'ASCII n'ont pas le même code dans un PDF
   que dans un fichier texte : é vaut 233, € vaut 128. Ce qui n'existe
   pas dans cette table est remplacé par son équivalent sans accent
   plutôt que par un carré vide. */
const WINANSI = {
  '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135,
  'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142,
  '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151,
  '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159,
};
const REPLI = {
  ' ': ' ', ' ': ' ', ' ': ' ',
  /* le signe moins mathématique n'existe pas en WinAnsi : il sortait
     en point d'interrogation devant le montant de l'acompte */
  '−': '-', '‐': '-', '‑': '-',
};

function octetsWinAnsi(texte) {
  const out = [];
  for (const c of String(texte == null ? '' : texte)) {
    const r = REPLI[c] !== undefined ? REPLI[c] : c;
    if (WINANSI[r] !== undefined) { out.push(WINANSI[r]); continue; }
    const p = r.codePointAt(0);
    if (p <= 0xff) { out.push(p); continue; }
    /* dernier recours : on enlève l'accent ou on met un point */
    const nu = r.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = nu.codePointAt(0);
    out.push(q <= 0xff ? q : 63);
  }
  return out;
}

function chaînePdf(texte) {
  let s = '';
  for (const o of octetsWinAnsi(texte)) {
    if (o === 40 || o === 41 || o === 92) s += '\\' + String.fromCharCode(o);
    else if (o < 32 || o > 126) s += '\\' + o.toString(8).padStart(3, '0');
    else s += String.fromCharCode(o);
  }
  return '(' + s + ')';
}

/* ── largeur du texte, pour centrer et aligner à droite ─────────────
   Les largeurs des caractères d'Helvetica sont fixes et connues ; on
   ne garde que ce dont une facture a besoin. */
const L_NORMALE = { ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556,
  M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667,
  Y: 667, Z: 611, '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222,
  m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500,
  y: 500, z: 500, '{': 334, '|': 260, '}': 334, '~': 584, '€': 556 };
const L_GRASSE = { ...L_NORMALE, ' ': 278, A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778,
  H: 722, I: 278, J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667,
  T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278,
  m: 889, n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556,
  y: 556, z: 500, '.': 278, ',': 278, ':': 333, '-': 333, '/': 278 };

function largeur(texte, taille, gras) {
  const table = gras ? L_GRASSE : L_NORMALE;
  let t = 0;
  for (const c of String(texte || '')) t += (table[c] !== undefined ? table[c] : 556);
  return (t / 1000) * taille;
}

/* ── coupe un texte à la largeur voulue ─────────────────────────── */
function couper(texte, taille, gras, largeurMax) {
  const mots = String(texte || '').split(/\s+/).filter(Boolean);
  const lignes = [];
  let ligne = '';
  for (const m of mots) {
    const essai = ligne ? ligne + ' ' + m : m;
    if (largeur(essai, taille, gras) > largeurMax && ligne) { lignes.push(ligne); ligne = m; }
    else ligne = essai;
  }
  if (ligne) lignes.push(ligne);
  return lignes.length ? lignes : [''];
}

/* ── la page ────────────────────────────────────────────────────── */
class Page {
  constructor() { this.flux = []; this.champs = []; }
  /* champ de formulaire que le client remplit dans son lecteur PDF */
  champ(type, nom, x, y, l, h) { this.champs.push({ type, nom, x, y, l, h }); }
  texte(x, y, s, { taille = 10, gras = false, couleur = [0, 0, 0], align = 'gauche', largeurZone = 0, justifie = 0, aere = false } = {}) {
    if (s === '' || s === null || s === undefined) return;
    let px = x;
    if (align === 'droite') px = x - largeur(s, taille, gras);
    else if (align === 'centre') px = x + (largeurZone - largeur(s, taille, gras)) / 2;
    /* justification : on répartit l'écart entre les mots (opérateur Tw) */
    let tw = '';
    if (justifie) {
      const nb = (String(s).match(/ /g) || []).length;
      const ecart = justifie - largeur(s, taille, gras);
      if (nb > 0 && ecart > 0) tw = `${(ecart / nb).toFixed(3)} Tw `;
    }
    this.flux.push(
      `BT /${gras ? 'F2' : 'F1'} ${taille} Tf ${tw}` +
      `${couleur.map((c) => c.toFixed(3)).join(' ')} rg ` +
      `1 0 0 1 ${px.toFixed(2)} ${y.toFixed(2)} Tm ${aere ? '[' + String(s).split('/').map(chaînePdf).join(' -140 (/) -140 ') + '] TJ' : chaînePdf(s) + ' Tj'} ET`);
  }
  filet(x1, y1, x2, y2, { epaisseur = 0.6, couleur = [0.78, 0.8, 0.84] } = {}) {
    this.flux.push(`${couleur.map((c) => c.toFixed(3)).join(' ')} RG ${epaisseur} w ` +
      `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }
  pave(x, y, l, h, couleur) {
    this.flux.push(`${couleur.map((c) => c.toFixed(3)).join(' ')} rg ` +
      `${x.toFixed(2)} ${y.toFixed(2)} ${l.toFixed(2)} ${h.toFixed(2)} re f`);
  }
  /* rectangle à coins arrondis, plein et/ou cerclé */
  rond(x, y, l, h, r, { fond = null, trait = null, epaisseur = 0.8 } = {}) {
    const k = 0.5523 * r, f = (n) => n.toFixed(2);
    const chemin = `${f(x + r)} ${f(y)} m ${f(x + l - r)} ${f(y)} l ` +
      `${f(x + l - r + k)} ${f(y)} ${f(x + l)} ${f(y + r - k)} ${f(x + l)} ${f(y + r)} c ${f(x + l)} ${f(y + h - r)} l ` +
      `${f(x + l)} ${f(y + h - r + k)} ${f(x + l - r + k)} ${f(y + h)} ${f(x + l - r)} ${f(y + h)} c ${f(x + r)} ${f(y + h)} l ` +
      `${f(x + r - k)} ${f(y + h)} ${f(x)} ${f(y + h - r + k)} ${f(x)} ${f(y + h - r)} c ${f(x)} ${f(y + r)} l ` +
      `${f(x)} ${f(y + r - k)} ${f(x + r - k)} ${f(y)} ${f(x + r)} ${f(y)} c h`;
    const c3 = (c) => c.map((v) => v.toFixed(3)).join(' ');
    this.flux.push(`${fond ? c3(fond) + ' rg ' : ''}${trait ? c3(trait) + ' RG ' + epaisseur + ' w ' : ''}${chemin} ${fond && trait ? 'B' : fond ? 'f' : 'S'}`);
  }
  contenu() { return this.flux.join('\n'); }
}


/* Présentation d'une ligne : la taille fait partie du produit (« Barnum 3×3 m »,
   « Tente étoile Ø 14 m »), la capacité s'écrit en gris dessous avec les vraies
   options ; l'installation et le montage ont leur propre ligne en bas du devis,
   on ne les répète pas ici. */
const CAPACITES = { '3x3': '8 à 12 pers. assises', '4x6': '24 à 25 pers. assises', '4x8': '30 à 40 pers. assises',
  '6x10': '60 à 80 pers. assises', 'o10': '50 à 60 pers. assises', 'o14': 'environ 80 pers. assises', 'o22': "jusqu'à 150 pers. assises" };
function presenter(intitule, detail) {
  const CAP = /pers\.?\s*assises|personnes?\b/i;
  const TAILLE = /Ø\s*\d+(?:[,.]\d+)?\s*m|\d+(?:[,.]\d+)?\s*[×x]\s*\d+(?:[,.]\d+)?\s*m?/i;
  const mots = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let titre = String(intitule || '').trim();
  let capTitre = '';
  const pt = titre.split(/\s+[—–]\s+/);
  if (pt.length > 1) { const c = pt.find((x) => CAP.test(x)); if (c) { capTitre = c.trim(); titre = pt.filter((x) => x !== c).join(' — '); } }
  const morceaux = String(detail || '').replace(/^\s*options?\s*:\s*/i, '').split(/\s*[·,;]\s*|\s+[—–]\s+/).map((x) => x.trim()).filter(Boolean)
    .filter((x) => !/installation|montage|d[ée]montage|lancement/i.test(x));
  let taille = '', cap = capTitre;
  const reste = [];
  for (const m of morceaux) {
    const t = TAILLE.exec(m);
    if (t && !taille && !CAP.test(m) && m.replace(t[0], '').replace(/barnum|tente|[ée]toile/gi, '').trim() === '') taille = t[0].replace(/\s+/g, ' ').trim();
    else if (CAP.test(m) && !cap) cap = m;
    else reste.push(m);
  }
  if (!taille) { const t = TAILLE.exec(titre); if (t) taille = t[0]; }
  if (taille) {
    const dedans = mots(titre).join('').includes(mots(taille).join(''));
    if (!dedans) titre = titre + ' ' + taille.replace(/x/i, '×').replace(/(\d)\s*m?$/, (a, d) => (/m$/i.test(taille) ? a : d + ' m'));
    if (!cap) {
      const cle = /Ø\s*(\d+)/i.exec(taille) ? 'o' + /Ø\s*(\d+)/i.exec(taille)[1] : taille.replace(/\s*m$/i, '').replace(/\s/g, '').replace(/[×x]/i, 'x');
      if (CAPACITES[cle] && /barnum|tente/i.test(titre)) cap = CAPACITES[cle];
    }
  }
  return { titre, detail: [cap].concat(reste).filter(Boolean).join(' · ') };
}

/* ── assemblage du fichier ──────────────────────────────────────── */
function assembler(pages) {
  const objets = [];
  const ajouter = (corps) => { objets.push(corps); return objets.length; };

  const idsPages = [];
  const idContenus = [];
  for (const p of pages) {
    const c = p.contenu();
    idContenus.push(ajouter(`<< /Length ${octetsWinAnsi(c).length} >>\nstream\n${c}\nendstream`));
  }
  const idFont1 = ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const idZaDb = ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /ZapfDingbats >>');
  const idFont2 = ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  /* ── champs de formulaire (AcroForm) : case à cocher + texte ──────
     Le client les remplit dans son lecteur PDF (Chrome, Aperçu, Acrobat…),
     enregistre le fichier et le renvoie : plus besoin d'imprimer. */
  const nbObjChamps = pages.reduce((t, p) => t + p.champs.reduce((u, c) => u + (c.type === 'case' ? 3 : 2), 0), 0);
  const baseWidgets = objets.length;
  const idPageDe = (i) => baseWidgets + nbObjChamps + 1 + i;
  const idsChamps = [];
  const annotsDePage = [];
  pages.forEach((p, i) => {
    const annots = [];
    for (const c of p.champs) {
      const rect = `[${c.x.toFixed(2)} ${c.y.toFixed(2)} ${(c.x + c.l).toFixed(2)} ${(c.y + c.h).toFixed(2)}]`;
      if (c.type === 'case') {
        const bord = `0.40 0.43 0.49 RG 0.8 w 0.4 0.4 ${(c.l - 0.8).toFixed(2)} ${(c.h - 0.8).toFixed(2)} re S`;
        const coche = `0.169 0.290 0.420 RG 1.7 w 1 J 1 j ${(c.l * 0.2).toFixed(2)} ${(c.h * 0.5).toFixed(2)} m ${(c.l * 0.42).toFixed(2)} ${(c.h * 0.24).toFixed(2)} l ${(c.l * 0.82).toFixed(2)} ${(c.h * 0.78).toFixed(2)} l S`;
        const bbox = `/BBox [0 0 ${c.l.toFixed(2)} ${c.h.toFixed(2)}]`;
        const idOui = ajouter(`<< /Type /XObject /Subtype /Form ${bbox} /Length ${(bord + '\n' + coche).length} >>\nstream\n${bord}\n${coche}\nendstream`);
        const idNon = ajouter(`<< /Type /XObject /Subtype /Form ${bbox} /Length ${bord.length} >>\nstream\n${bord}\nendstream`);
        const id = ajouter(`<< /Type /Annot /Subtype /Widget /FT /Btn /T (${c.nom}) /Rect ${rect} /F 4 ` +
          `/P ${idPageDe(i)} 0 R /V /Off /AS /Off /DA (/ZaDb 0 Tf 0.169 0.290 0.420 rg) ` +
          `/AP << /N << /Yes ${idOui} 0 R /Off ${idNon} 0 R >> /D << /Yes ${idOui} 0 R /Off ${idNon} 0 R >> >> ` +
          `/MK << /BC [0.40 0.43 0.49] /BG [1 1 1] /CA (4) >> >>`);
        annots.push(id); idsChamps.push(id);
      } else {
        const fond = `1 g 0 0 ${c.l.toFixed(2)} ${c.h.toFixed(2)} re f 0.62 0.65 0.70 RG 0.7 w 0.35 0.35 ${(c.l - 0.7).toFixed(2)} ${(c.h - 0.7).toFixed(2)} re S`;
        const idAp = ajouter(`<< /Type /XObject /Subtype /Form /BBox [0 0 ${c.l.toFixed(2)} ${c.h.toFixed(2)}] /Length ${fond.length} >>\nstream\n${fond}\nendstream`);
        const id = ajouter(`<< /Type /Annot /Subtype /Widget /FT /Tx /T (${c.nom}) /Rect ${rect} /F 4 ` +
          `/P ${idPageDe(i)} 0 R /DA (/Helv 9 Tf 0.05 0.06 0.08 rg) /Q 0 /V () /AP << /N ${idAp} 0 R >> ` +
          `/MK << /BC [0.62 0.65 0.70] /BG [1 1 1] >> >>`);
        annots.push(id); idsChamps.push(id);
      }
    }
    annotsDePage.push(annots);
  });

  const idPages = objets.length + pages.length + 1;
  pages.forEach((p, i) => {
    idsPages.push(ajouter(
      `<< /Type /Page /Parent ${idPages} 0 R /MediaBox [0 0 595.28 841.89] ` +
      `/Resources << /Font << /F1 ${idFont1} 0 R /F2 ${idFont2} 0 R >> >> ` +
      (annotsDePage[i].length ? `/Annots [${annotsDePage[i].map((a) => a + ' 0 R').join(' ')}] ` : '') +
      `/Contents ${idContenus[i]} 0 R >>`));
  });
  ajouter(`<< /Type /Pages /Kids [${idsPages.map((i) => i + ' 0 R').join(' ')}] /Count ${idsPages.length} >>`);
  const formulaire = idsChamps.length
    ? ` /AcroForm << /Fields [${idsChamps.map((a) => a + ' 0 R').join(' ')}]` +
      `/DA (/Helv 9 Tf 0 g) /NeedAppearances false /DR << /Font << /Helv ${idFont1} 0 R /ZaDb ${idZaDb} 0 R >> >> >>`
    : '';
  const idCatalogue = ajouter(`<< /Type /Catalog /Pages ${idPages} 0 R${formulaire} >>`);

  let pdf = '%PDF-1.4\n';
  const positions = [0];
  objets.forEach((corps, i) => {
    positions.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${corps}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objets.length; i++) {
    pdf += String(positions[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root ${idCatalogue} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Uint8Array.from(octetsWinAnsi(pdf));
}

/* ── mise en forme des montants et des dates ────────────────────── */
const euros = (n) => (Math.round(Number(n) * 100) / 100)
  .toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';

function jourFr(v) {
  const s = String(v || '').trim();
  let a = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (a) return `${a[3]}/${a[2]}/${a[1]}`;
  a = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return a ? s : '';
}

/* « du 11/09/2026 au 14/09/2026 » : la location court sur tout le week-end,
   le document doit le dire pour que le client ne croie pas à une date erronée. */
function periodeFr(debut, fin) {
  const a = jourFr(debut), b = jourFr(fin);
  if (!a) return '';
  /* les barres obliques sont aérées à l'écriture (option « aere » du texte), d'un demi-espace */
  const aere = (t) => t;
  if (!b || b === a) return aere(a);
  const cle = (t) => t.split('/').reverse().join('');
  return cle(b) < cle(a) ? aere(a) : `du ${aere(a)} au ${aere(b)}`;
}

/* ═══════════════════════════════════════════════════════════════════
   LA FACTURE
   ═══════════════════════════════════════════════════════════════════ */
const NAVY = [0.169, 0.290, 0.420];
const NOIR = [0.047, 0.059, 0.078];
const GRIS = [0.392, 0.427, 0.486];
const GRIS_CLAIR = [0.94, 0.95, 0.96];

export function construireFacture({ emetteur, client, facture, lignes, reglages }) {
  let p = new Page();
  const G = 48;                 /* marge gauche */
  const D = 595.28 - 48;        /* marge droite */
  let y = 841.89 - 56;

  /* ── en-tête ── */
  const estDevis = facture.type === 'devis';
  p.texte(G, y, 'VESPRA EVENT', { taille: 22, gras: true, couleur: NAVY });
  p.texte(G, y - 15, emetteur.activite, { taille: 8.5, couleur: GRIS });
  p.texte(D, y + 2, estDevis ? 'DEVIS' : 'FACTURE', { taille: 26, gras: true, couleur: NAVY, align: 'droite' });
  p.texte(D, y - 16, 'N° ' + facture.numero, { taille: 10, gras: true, couleur: NOIR, align: 'droite' });
  p.texte(D, y - 29, 'Date : ' + facture.dateEmission, { taille: 9, couleur: GRIS, align: 'droite' });
  p.texte(D, y - 41, (estDevis ? 'Validité : ' : 'Échéance : ') + facture.echeance, { taille: 9, couleur: GRIS, align: 'droite' });
  y -= 56;
  p.pave(G, y, D - G, 2.2, NAVY);
  y -= 28;

  /* ── émetteur à gauche, client dans un encadré clair à droite ── */
  const hautBlocs = y;
  p.texte(G, y, 'ÉMETTEUR', { taille: 7.5, gras: true, couleur: GRIS });
  let yg = y - 14;
  const lignesEmetteur = [
    [emetteur.nom, true],
    [`${emetteur.forme} au capital de ${emetteur.capital}`, false],
    ...emetteur.adresse.map((l) => [l, false]),
    [`SIRET ${emetteur.siret}`, false],
    [`RCS ${emetteur.rcs}`, false],
    [`TVA intracommunautaire ${emetteur.tva}`, false],
    [emetteur.tel, false],
    [emetteur.email, false],
  ];
  for (const [t, gras] of lignesEmetteur) {
    if (!t) continue;
    p.texte(G, yg, t, { taille: 9, gras, couleur: gras ? NOIR : GRIS });
    yg -= 12;
  }

  const XC = 322;
  const lignesClient = [[client.nom, true]];
  (client.adresse || []).forEach((l) => lignesClient.push([l, false]));
  if (client.siret) lignesClient.push(['SIRET ' + client.siret, false]);
  if (client.tvaClient) lignesClient.push(['TVA ' + client.tvaClient, false]);
  if (client.tel) lignesClient.push([client.tel, false]);
  if (client.email) lignesClient.push([client.email, false]);
  const cl = [];
  for (const [t, gras] of lignesClient) {
    if (!t) continue;
    for (const l of couper(t, 9, gras, D - XC - 12)) cl.push([l, gras]);
  }
  const hClient = 36 + 12 * cl.length;
  p.rond(XC - 14, hautBlocs + 16 - hClient + 4, D - XC + 14, hClient, 7, { fond: GRIS_CLAIR });
  p.texte(XC, hautBlocs, estDevis ? 'CLIENT' : 'FACTURÉ À', { taille: 7.5, gras: true, couleur: GRIS });
  let yd = hautBlocs - 14;
  for (const [l, gras] of cl) {
    p.texte(XC, yd, l, { taille: 9, gras, couleur: gras ? NOIR : GRIS });
    yd -= 12;
  }

  y = Math.min(yg, yd + 4) - 10;

  /* ── date de l'événement ── */
  p.texte(G, y, estDevis ? 'Date de l\u2019événement :' : 'Date de la prestation :', { taille: 9.5, gras: true, couleur: NAVY });
  p.texte(G + largeur(estDevis ? 'Date de l\u2019événement :' : 'Date de la prestation :', 9.5, true) + 8, y, facture.datePrestation || facture.dateEmission, { taille: 9.5, couleur: NOIR, aere: true });
  y -= 30;

  /* ── pages ──────────────────────────────────────────────────────
     Un gros devis passe sur plusieurs pages : on change de page avant
     que les lignes n'arrivent sur le pied de page, et les totaux, le
     « bon pour accord » et le virement restent groupés sur la dernière. */
  const pages = [p];
  const XQ = 322, XPU = 384, XTVA = 450, XHT = D - 10;
  const enteteTableau = () => {
    p.rond(G, y - 6, D - G, 20, 4, { fond: NAVY });
    const BL = [1, 1, 1];
    p.texte(G + 10, y, 'Désignation', { taille: 8.5, gras: true, couleur: BL });
    p.texte(XQ, y, 'Qté', { taille: 8.5, gras: true, couleur: BL, align: 'droite' });
    p.texte(XPU, y, 'P.U. HT', { taille: 8.5, gras: true, couleur: BL, align: 'droite' });
    p.texte(XTVA, y, 'TVA', { taille: 8.5, gras: true, couleur: BL, align: 'droite' });
    p.texte(XHT, y, 'Total TTC', { taille: 8.5, gras: true, couleur: BL, align: 'droite' });
    y -= 26;
  };
  const nouvellePage = (avecTableau = true) => {
    p = new Page(); pages.push(p);
    y = 841.89 - 56;
    zebre = 0;
    p.texte(G, y, 'VESPRA EVENT', { taille: 13, gras: true, couleur: NAVY });
    p.texte(D, y, (estDevis ? 'DEVIS' : 'FACTURE') + ' N° ' + facture.numero + ' (suite)', { taille: 9, gras: true, couleur: GRIS, align: 'droite' });
    y -= 36;
    if (avecTableau) enteteTableau();
  };
  enteteTableau();

  let brutHT = 0, brutTTC = 0, tiersTTC = 0;
  var zebre = 0;
  const remises = [];
  /* intitulé simple : sans « Location — », sans le nom du produit répété,
     et « photos » plutôt que « tirages papier » */
  const simple = (t) => {
    let x = String(t || '').replace(/^Location\s*[—-]\s*/i, '').trim();
    const parts = x.split(/\s+—\s+/);
    while (parts.length > 1 && parts[1].toLowerCase().startsWith(parts[0].toLowerCase())) parts.shift();
    x = parts.join(' — ').replace(/tirages\s+papier/gi, 'photos').replace(/tirages/gi, 'photos');
    return x;
  };
  for (const l of lignes) {
    const qte = Number(l.quantite) || 1;
    const ttc = Number(l.montantTTC) || 0;
    /* une remise n'est pas une prestation : elle se retire dans les totaux */
    if (ttc < 0) {
      remises.push({ lib: String(l.intitule || 'Remise').replace(/\s+sur le matériel/i, ''), ttc: -ttc });
      continue;
    }
    /* prestation d'un prestataire partenaire (fonds de tiers) : ni HT ni TVA de Vespra, le montant s'ajoute au total TTC */
    const estTiers = l.tiers === true;
    const ht = estTiers ? ttc : Math.round((ttc / (1 + reglages.tauxTVA / 100)) * 100) / 100;
    if (estTiers) tiersTTC += ttc; else brutHT += ht;
    brutTTC += ttc;
    const pres = presenter(simple(l.intitule), l.detail);
    const intitules = couper(pres.titre, 9.5, false, XQ - G - 30);
    const details = pres.detail ? couper(pres.detail, 8.5, false, XQ - G - 30) : [];
    const hauteur = 12 * (intitules.length - 1) + 12.5 * details.length;
    if (y - hauteur - 11 < 72) nouvellePage();
    let dernier = y;
    const derniereLigne = details.length ? y - 12 * intitules.length - 12.5 * (details.length - 1) : y - 12 * (intitules.length - 1);
    const bas = derniereLigne - 9;
    if (zebre++ % 2 === 1) p.pave(G, bas, D - G, y + 13 - bas, GRIS_CLAIR);
    p.texte(G + 10, y, intitules[0], { taille: 9.5, couleur: NOIR });
    p.texte(XQ, y, String(qte), { taille: 9.5, couleur: NOIR, align: 'droite' });
    p.texte(XPU, y, estTiers ? '—' : euros(ht / qte), { taille: 9.5, couleur: NOIR, align: 'droite' });
    p.texte(XTVA, y, estTiers ? '—' : reglages.tauxTVA + ' %', { taille: 9.5, couleur: NOIR, align: 'droite' });
    p.texte(XHT, y, euros(ttc), { taille: 9.5, couleur: NOIR, align: 'droite' });
    /* devis et facture : un prix baissé à la main (promo) laisse voir l'ancien prix, barré, à gauche du nouveau
       (une hausse, elle, ne se signale pas) */
    const ancien = Number(l.ancienTTC) || 0;
    if (ancien > ttc + 0.005) {
      const t = euros(ancien), w = largeur(t, 8.5, false), xr = XHT - largeur(euros(ttc), 9.5, false) - 9;
      p.texte(xr, y, t, { taille: 8.5, couleur: GRIS, align: 'droite' });
      p.filet(xr - w - 1, y + 3, xr + 1, y + 3, { couleur: GRIS, epaisseur: 0.6 });
    }
    y -= 12;
    for (let i = 1; i < intitules.length; i++) { dernier = y; p.texte(G + 10, y, intitules[i], { taille: 9.5, couleur: NOIR }); y -= 12; }
    for (const d of details) { dernier = y; p.texte(G + 10, y, d, { taille: 8.5, couleur: GRIS }); y -= 12.5; }
    /* la ligne de séparation est à égale distance du texte au-dessus et
       au-dessous : les chiffres ne sont plus collés au trait */
    y = bas - 14;
  }
  p.filet(G, y + 14, D, y + 14, { couleur: [0.86, 0.88, 0.91], epaisseur: 0.6 });
  y += 8;

  /* ── totaux ──────────────────────────────────────────────────────
     Total HT, réduction(s) (une réduction n'est pas une prestation : elle
     se retire ici, la TVA se calcule sur le montant réduit), TVA, Total TTC
     et, sur un devis, l'acompte à verser. */
  /* La réduction se lit en TTC, comme le client la perçoit : HT et TVA
     portent sur le matériel, puis on retire la réduction du Total TTC. */
  const remiseTTC = Math.round(remises.reduce((t, r) => t + r.ttc, 0) * 100) / 100;
  /* Une réduction diminue le prix HT : la TVA se calcule sur le montant réduit (la réduction est
     traitée comme une ligne négative, avec son propre HT arrondi). Sans réduction, rien ne change. */
  const remisesHT = remises.map((r) => ({ ...r, ht: Math.round((r.ttc / (1 + reglages.tauxTVA / 100)) * 100) / 100 }));
  const remiseHT = remisesHT.reduce((t, r) => t + r.ht, 0);
  const netHT = Math.round((brutHT - remiseHT) * 100) / 100;
  const netTTC = Math.round((brutTTC - remiseTTC) * 100) / 100;
  const totalHT = Math.round(brutHT * 100) / 100;
  const tva = Math.round((netTTC - netHT - tiersTTC) * 100) / 100;
  const acompte = Number(facture.acompte) || 0;
  const aRem = remises.length > 0;
  const factAc = !estDevis && acompte > 0;

  const INTER = 18;               /* hauteur d'une ligne de total */
  const nbLignesTotaux = aRem
    ? 7 + remises.length + (factAc ? 2 : 0) + (estDevis && acompte > 0 ? 1 : 0) + (tiersTTC > 0 ? 1 : 0)
    : 4 + (tiersTTC > 0 ? 1 : 0) + remises.length + (aRem || factAc ? 1 : 0) + (acompte > 0 ? 1 : 0);
  const hTotaux = nbLignesTotaux * INTER + 30;
  const hBon = 82;
  /* tout le bas (totaux + accord + virement + pied) doit tenir sous les lignes :
     sinon les totaux passent sur une page de suite */
  if (y - 14 - hTotaux - (estDevis ? 22 + hBon : 0) < 124) nouvellePage(false);
  y -= 14;
  const yHaut = y;
  const XL = 402;                 /* les libellés finissent ici */
  const total = (libelle, valeur, { fort = false, taille = 9, couleur = GRIS, barre = false, gauche = false } = {}) => {
    if (barre) {
      p.rond(XL - 96, y - 8, D - XL + 96, 24, 5, { fond: NAVY });
      p.texte(XL - 84, y, libelle, { taille: 10, gras: true, couleur: [1, 1, 1] });
      p.texte(D - 12, y, valeur, { taille: 11, gras: true, couleur: [1, 1, 1], align: 'droite' });
      y -= INTER + 8;
      return;
    }
    if (gauche) p.texte(XL - 84, y, libelle, { taille, gras: fort, couleur: NOIR });
    else p.texte(XL, y, libelle, { taille, gras: fort, couleur: fort ? NOIR : couleur, align: 'droite' });
    p.texte(D - 12, y, valeur, { taille, gras: fort, couleur: NOIR, align: 'droite' });
    y -= INTER;
  };
  const trait = () => { p.filet(XL - 96, y + 12, D, y + 12); y -= 10; };
  if (aRem) {
    /* La réduction se lit en TTC, comme le client la perçoit (moins 10 €, pas moins 8,33 € HT).
       Le HT et la TVA du montant réduit restent indiqués, en petit, sous le total. */
    total('Total HT', euros(totalHT));
    total(`TVA ${reglages.tauxTVA} %`, euros(Math.round((brutTTC - totalHT - tiersTTC) * 100) / 100));
    if (tiersTTC > 0) total('Prestation partenaire (hors TVA)', euros(tiersTTC));
    trait();
    total('Total TTC avant réduction', euros(brutTTC));
    for (const r of remises) total(r.lib, '- ' + euros(r.ttc));
    trait();
    if (factAc) {
      total('Total TTC', euros(netTTC));
      total('Acompte déjà versé (30 %)', '- ' + euros(acompte));
      trait();
    }
    total(factAc ? 'Solde restant à payer' : 'Net à payer', euros(factAc ? netTTC - acompte : netTTC), { fort: true, taille: 10, barre: true });
  } else {
  total('Total HT', euros(totalHT));
  total(`TVA ${reglages.tauxTVA} %`, euros(tva));
  if (tiersTTC > 0) total('Prestation partenaire (hors TVA)', euros(tiersTTC));
  trait();
  if (aRem || factAc) {
    total('Total TTC', euros(brutTTC));
    for (const r of remises) total(r.lib, '- ' + euros(r.ttc));
    if (factAc) total('Acompte déjà versé (30 %)', '- ' + euros(acompte));
    trait();
    total(factAc ? 'Solde restant à payer' : 'Net à payer', euros(factAc ? netTTC - acompte : netTTC), { fort: true, taille: 10, barre: true });
  } else {
    total('Net à payer', euros(netTTC), { fort: true, taille: acompte > 0 ? 10 : 11, barre: true });
  }
  }
  if (estDevis && acompte > 0) total('Acompte à verser (30 %)', euros(acompte), { fort: true, taille: 10, gauche: true });

  /* ── bon pour accord : sous les totaux, sur toute la largeur ───── */
  if (estDevis) {
    const x0 = G;
    const yBon = y - 6;
    p.rond(x0, yBon - hBon, D - G, hBon, 7, { trait: NAVY, epaisseur: 1.1 });
    p.champ('case', 'accord', x0 + 14, yBon - 21, 11, 11);
    p.texte(x0 + 33, yBon - 18, 'Bon pour accord', { taille: 10, gras: true, couleur: NAVY });
    p.texte(x0 + 33 + largeur('Bon pour accord', 10, true) + 10, yBon - 18, 'Lu et approuvé · Acceptation du présent devis', { taille: 8, couleur: GRIS });
    p.texte(x0 + 14, yBon - 40, 'Prénom', { taille: 6.8, couleur: GRIS });
    p.texte(x0 + 188, yBon - 40, 'Nom', { taille: 6.8, couleur: GRIS });
    p.texte(x0 + 362, yBon - 40, 'Date', { taille: 6.8, couleur: GRIS });
    p.champ('texte', 'prenom', x0 + 14, yBon - 60, 164, 16);
    p.champ('texte', 'nom', x0 + 188, yBon - 60, 164, 16);
    p.champ('texte', 'date', x0 + 362, yBon - 60, 120, 16);
    p.texte(x0 + 14, yBon - 72, 'Cochez la case, saisissez vos nom, prénom et la date, enregistrez puis renvoyez ce PDF.', { taille: 6.8, couleur: GRIS });
  }

  /* ── règlement par virement : bandeau propre et compact ───────── */
  if (emetteur.banque) {
    const H = 50;
    const yb = 136;
    p.rond(G, yb - H, D - G, H, 6, { fond: GRIS_CLAIR });
    p.texte(G + 14, yb - 14, 'RÈGLEMENT PAR VIREMENT BANCAIRE' + (emetteur.banque.nom ? ' — ' + emetteur.banque.nom.toUpperCase() : ''), { taille: 7.4, gras: true, couleur: NAVY });
    const col = (x, lib, val, gras = false) => {
      p.texte(x, yb - 28, lib, { taille: 6.5, couleur: GRIS });
      p.texte(x, yb - 41, val, { taille: 8.1, gras, couleur: NOIR });
    };
    col(G + 14, 'Bénéficiaire', emetteur.banque.titulaire);
    col(G + 150, 'IBAN', emetteur.banque.iban);
    col(G + 316, 'BIC', emetteur.banque.bic);
    col(G + 404, 'Référence à indiquer', facture.numero, true);
  }

  /* ── mentions : une bande lisible entre banque et pied ────────── */
  const mentions = [
    reglages.conditions,
    reglages.penalites,
    reglages.escompte,
  ].filter(Boolean);
  let ym = 70;
  for (const m of mentions) {
    const lignes = couper(m, 6.4, false, D - G);
    for (const ligne of lignes) {
      if (ym < 53) break;
      /* toutes les lignes sont justifiées sauf la dernière du paragraphe */
      p.texte(G, ym, ligne, { taille: 6.4, couleur: GRIS, justifie: ligne === lignes[lignes.length - 1] ? 0 : D - G });
      ym -= 6.6;
    }
    ym -= 1.5;
    if (ym < 53) break;
  }

  pages.forEach((pg, ni) => {
  /* ── pied de page : une seule ligne, comme sur le modèle validé ──
     Pas de colonnes ni de coordonnées empilées : une ligne fine en
     haut, toutes les mentions légales à gauche et la référence du
     document à droite. C'est volontairement sobre pour que le bas du
     devis et de la facture reste identique et parfaitement lisible. */
  const bas = 19;
  const hautPied = bas + 27;
  pg.filet(G, hautPied, D, hautPied, { couleur: NAVY, epaisseur: 0.9 });

  const mentionsLegales = `${emetteur.nom} — ${emetteur.forme} au capital de ${emetteur.capital} — SIRET ${emetteur.siret} — RCS ${emetteur.rcs} — TVA ${emetteur.tva}`;
  const reference = (estDevis ? 'Devis ' : 'Facture ') + facture.numero + (pages.length > 1 ? ' — page ' + (ni + 1) + '/' + pages.length : '');

  /* La ligne légale doit rester sur une seule ligne. On réduit
     légèrement le corps si nécessaire afin qu'elle ne rencontre jamais
     la référence placée à droite. */
  const zoneRef = largeur(reference, 6.4, false) + 30;
  const largeurMax = (D - G) - zoneRef;
  let taillePied = 6.4;
  while (taillePied > 5.2 && largeur(mentionsLegales, taillePied, false) > largeurMax) taillePied -= 0.2;

  pg.texte(G, bas + 13, mentionsLegales, { taille: taillePied, couleur: GRIS });
  pg.texte(D, bas + 13, reference, { taille: 6.4, gras: false, couleur: GRIS, align: 'droite' });

  });

  return assembler(pages);
}

export { euros, jourFr, periodeFr, Page, assembler, largeur, couper, NAVY, NOIR, GRIS, GRIS_CLAIR };
