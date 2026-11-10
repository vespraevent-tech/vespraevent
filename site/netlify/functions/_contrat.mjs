/* Contrat de location (Word) rempli avec les informations de Paramètres › Entreprise.
   Le modèle .docx est un zip : on remplace deux phrases dans word/document.xml
   (identité du loueur, assurance) et on reconstruit l'archive. Aucune dépendance. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateRawSync, deflateRawSync } from 'node:zlib';

const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function lireZip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('modèle de contrat illisible');
  const n = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const out = [];
  for (let i = 0; i < n; i++) {
    const methode = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16);
    const tc = buf.readUInt32LE(p + 20), tu = buf.readUInt32LE(p + 24);
    const ln = buf.readUInt16LE(p + 28), le = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32);
    const loc = buf.readUInt32LE(p + 42), nom = buf.toString('utf8', p + 46, p + 46 + ln);
    const lnL = buf.readUInt16LE(loc + 26), leL = buf.readUInt16LE(loc + 28);
    const debut = loc + 30 + lnL + leL;
    out.push({ nom, methode, crc, tc, tu, donnees: buf.subarray(debut, debut + tc) });
    p += 46 + ln + le + lc;
  }
  return out;
}

function ecrireZip(entrees) {
  const locaux = [], centraux = []; let pos = 0;
  for (const f of entrees) {
    const nom = Buffer.from(f.nom, 'utf8');
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(0x0800, 6);
    l.writeUInt16LE(f.methode, 8); l.writeUInt16LE(0, 10); l.writeUInt16LE(0x21, 12);
    l.writeUInt32LE(f.crc, 14); l.writeUInt32LE(f.tc, 18); l.writeUInt32LE(f.tu, 22); l.writeUInt16LE(nom.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(f.methode, 10); c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14);
    c.writeUInt32LE(f.crc, 16); c.writeUInt32LE(f.tc, 20); c.writeUInt32LE(f.tu, 24); c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(f.nom.endsWith('/') ? 0x10 : 0, 38); c.writeUInt32LE(pos, 42);
    locaux.push(l, nom, f.donnees); centraux.push(c, nom);
    pos += 30 + nom.length + f.donnees.length;
  }
  const dir = Buffer.concat(centraux);
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8); fin.writeUInt16LE(entrees.length, 10); fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(pos, 16);
  return Buffer.concat([...locaux, dir, fin]);
}

const xml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MODELE_IDENTITE = ', SARL au capital de 16 144 €, 1 bis allée de la Haute Gasniais, 35500 Vitré. RCS Rennes 130 286 842 · SIRET 130 286 842 00013 · TVA FR08130286842. Tél. 06.50.83.68.28 · vespraevent@gmail.com.';
const MODELE_NOM = '>VESPRA EVENT</w:t>';
const MODELE_ASSURANCE = 'Assurance responsabilité civile professionnelle : Crédit Agricole';

export async function contratWord(p) {
  let modele;
  for (const c of [join(process.cwd(), 'netlify/functions/_contrat-modele.docx'), '_contrat-modele.docx', new URL('./_contrat-modele.docx', import.meta.url).pathname]) {
    try { modele = await readFile(c); break; } catch { /* suivant */ }
  }
  if (!modele) throw new Error('modèle de contrat introuvable');
  const entrees = lireZip(modele);
  const doc = entrees.find((e) => e.nom === 'word/document.xml');
  let x = (doc.methode === 8 ? inflateRawSync(doc.donnees) : doc.donnees).toString('utf8');

  const identite = ', ' + p.forme + ' au capital de ' + p.capital + ', ' + p.adresse + ', ' + p.cpville + '. RCS ' + p.rcs
    + ' · SIRET ' + p.siret + ' · TVA ' + p.tva + '. Tél. ' + p.tel + ' · ' + p.email + '.';
  const ass = 'Assurance responsabilité civile professionnelle : ' + (p.assureur || 'Crédit Agricole')
    + (p.assureurNumero ? ' — contrat n° ' + p.assureurNumero : '') + (p.assureurAdresse ? ' — ' + p.assureurAdresse : '');
  /* repères tolérants : l'adresse ou l'assureur du modèle peuvent changer sans casser le contrat */
  const reId = /, (SARL|SAS|EURL)? ?au capital de [^<]*(?=<\/w:t>)/;
  const reAss = /Assurance responsabilité civile professionnelle :[^<]*(?=<\/w:t>)/;
  if (!reId.test(x) || !reAss.test(x) || !x.includes(MODELE_NOM)) throw new Error('modèle de contrat modifié : repères introuvables');
  x = x.replace(reId, () => xml(identite)).replace(reAss, () => xml(ass)).replace(MODELE_NOM, () => '>' + xml(String(p.nom).toUpperCase()) + '</w:t>');

  const neuf = Buffer.from(x, 'utf8');
  doc.donnees = deflateRawSync(neuf); doc.methode = 8; doc.tc = doc.donnees.length; doc.tu = neuf.length; doc.crc = crc32(neuf);
  return ecrireZip(entrees);
}
