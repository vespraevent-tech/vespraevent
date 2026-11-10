/* Vespra Event — filet de sécurité des données.

   Trois protections, indépendantes les unes des autres :
   1. HISTORIQUE : chaque fois qu'une réservation (ou la configuration)
      est réécrite, la version précédente est gardée.
   2. CORBEILLE : une réservation supprimée est copiée avant effacement
      (voir admin.mjs).
   3. SAUVEGARDES : une copie complète (planning, clients, suivi) est
      prise chaque nuit, et à la demande. Les 60 dernières sont gardées.

   Rien ici ne supprime ni n'écrase une donnée courante : une restauration
   ne ré-ajoute que ce qui manque, sauf demande explicite pour une seule
   réservation (et l'ancienne version part alors dans l'historique). */
import { getStore } from './_stockage.mjs';

export const DATA_STORE = 'vespra-admin-data';
export const CLIENT_STORE = 'vespra-clients';
export const SAUVEGARDE_STORE = 'vespra-sauvegardes';
const COLLECTIONS_SAUVEGARDEES = ['reservations', 'suivi', 'logistique'];
const GARDER_AUTO = 60;
const GARDER_MANUEL = 40;

const jourParis = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
const heureParis = (d = new Date()) => d.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Paris' }).replace(/:/g, '');

/* lecture par paquets en parallèle */
async function lireParPaquets(store, blobs, taille = 25) {
  const out = [];
  for (let i = 0; i < blobs.length; i += taille) {
    const lot = await Promise.all(blobs.slice(i, i + taille).map(async (b) => {
      try {
        const texte = await store.get(b.key, { type: 'text', consistency: 'strong' });
        return texte == null ? null : { cle: b.key, texte };
      } catch (e) { return null; }
    }));
    lot.forEach((x) => { if (x) out.push(x); });
  }
  return out;
}

async function lireCollection(store, collection) {
  const { blobs } = await store.list({ prefix: `${collection}/` });
  const lus = await lireParPaquets(store, blobs);
  const items = [];
  for (const { cle, texte } of lus) {
    try { items.push(JSON.parse(texte)); } catch (e) { items.push({ _illisible: cle, brut: texte }); }
  }
  return items;
}

/* ── 1. historique des versions ─────────────────────────────────── */
export async function garderVersion(store, collection, id, nouveauTexte) {
  const cle = `${collection}/${encodeURIComponent(String(id))}`;
  const ancien = await store.get(cle, { type: 'text', consistency: 'strong' });
  if (!ancien) return;
  try {
    const a = JSON.parse(ancien), n = JSON.parse(nouveauTexte);
    if (a && n && a.d === n.d) return;                 /* rien n'a changé */
  } catch (e) { /* on garde quand même */ }
  const prefixe = `historique/${collection}/${encodeURIComponent(String(id))}/`;
  const estCfg = String(id) === 'cfg';
  const { blobs } = await store.list({ prefix: prefixe });
  const cles = blobs.map((b) => b.key).sort();
  /* la configuration change souvent : une version tous les quarts d'heure suffit */
  if (estCfg && cles.length) {
    const dernier = Number(cles[cles.length - 1].slice(prefixe.length));
    if (Date.now() - dernier < 15 * 60 * 1000) return;
  }
  await store.set(prefixe + Date.now(), ancien, { metadata: { collection, id: String(id) } });
  const max = estCfg ? 30 : 12;
  const trop = cles.length + 1 - max;
  for (let i = 0; i < trop; i++) { try { await store.delete(cles[i]); } catch (e) {} }
}

export async function versionsDe(collection, id) {
  const store = getStore(DATA_STORE);
  const prefixe = `historique/${collection}/${encodeURIComponent(String(id))}/`;
  const { blobs } = await store.list({ prefix: prefixe });
  return blobs.map((b) => ({ cle: b.key, le: new Date(Number(b.key.slice(prefixe.length))).toISOString() })).sort((a, b) => b.le.localeCompare(a.le));
}

/* ── 3. sauvegardes complètes ──────────────────────────────────── */
export async function creerSauvegarde({ motif = 'manuel' } = {}) {
  const data = getStore(DATA_STORE);
  const clientsStore = getStore(CLIENT_STORE);
  const sauv = getStore(SAUVEGARDE_STORE);

  const contenu = { version: 1, creeLe: new Date().toISOString(), motif, collections: {}, clients: [] };
  for (const c of COLLECTIONS_SAUVEGARDEES) contenu.collections[c] = await lireCollection(data, c);
  try {
    const cl = await clientsStore.get('clients', { type: 'json', consistency: 'strong' });
    contenu.clients = Array.isArray(cl) ? cl : [];
  } catch (e) { contenu.erreurClients = e.message; }

  const nbResa = contenu.collections.reservations.filter((x) => x && x.id && x.id !== 'cfg').length;
  const cle = `${jourParis()}_${heureParis()}_${motif === 'auto' ? 'auto' : 'manuel'}_n${nbResa}`;
  await sauv.set(cle, JSON.stringify(contenu), { metadata: { creeLe: contenu.creeLe, motif, reservations: nbResa, clients: contenu.clients.length } });

  /* vérification : on relit ce qui vient d'être écrit */
  const relu = await sauv.get(cle, { type: 'json', consistency: 'strong' });
  if (!relu || !relu.collections) throw new Error('Sauvegarde non vérifiée');

  await elaguer(sauv);
  return { cle, reservations: nbResa, clients: contenu.clients.length };
}

async function elaguer(sauv) {
  const { blobs } = await sauv.list();
  const cles = blobs.map((b) => b.key).sort();
  const parType = (t) => cles.filter((c) => c.includes('_' + t + '_'));
  for (const [t, max] of [['auto', GARDER_AUTO], ['manuel', GARDER_MANUEL]]) {
    const liste = parType(t);
    for (let i = 0; i < liste.length - max; i++) { try { await sauv.delete(liste[i]); } catch (e) {} }
  }
}

export async function sauvegardeDuJour() {
  const sauv = getStore(SAUVEGARDE_STORE);
  const { blobs } = await sauv.list({ prefix: jourParis() + '_' });
  if (blobs.some((b) => b.key.includes('_auto_'))) return { deja: true };
  return creerSauvegarde({ motif: 'auto' });
}

export async function listerSauvegardes() {
  const sauv = getStore(SAUVEGARDE_STORE);
  const { blobs } = await sauv.list();
  return blobs.map((b) => {
    const m = /^(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})_(auto|manuel)_n(\d+)$/.exec(b.key);
    return m ? { cle: b.key, jour: m[1], heure: `${m[2]}:${m[3]}`, motif: m[5], reservations: Number(m[6]) } : null;
  }).filter(Boolean).sort((a, b) => b.cle.localeCompare(a.cle));
}

export async function lireSauvegarde(cle) {
  if (!/^[0-9_a-z-]+$/i.test(String(cle))) throw new Error('Sauvegarde inconnue');
  return getStore(SAUVEGARDE_STORE).get(cle, { type: 'text', consistency: 'strong' });
}

/* ── restauration : jamais d'écrasement silencieux ──────────────── */
export async function reservationsDeLaSauvegarde(cle) {
  const texte = await lireSauvegarde(cle);
  if (!texte) throw new Error('Sauvegarde introuvable');
  const s = JSON.parse(texte);
  return (s.collections && s.collections.reservations || []).filter((x) => x && x.id && x.id !== 'cfg' && x.d);
}

export async function reservationsActuelles() {
  const items = await lireCollection(getStore(DATA_STORE), 'reservations');
  return new Map(items.filter((x) => x && x.id).map((x) => [String(x.id), x]));
}

export async function listerCorbeille() {
  const store = getStore(DATA_STORE);
  const { blobs } = await store.list({ prefix: 'corbeille/' });
  const lus = await lireParPaquets(store, blobs);
  const sortie = [];
  for (const { cle, texte } of lus) {
    try {
      const item = JSON.parse(texte);
      const r = item && item.d ? JSON.parse(item.d) : {};
      const ts = Number(cle.slice(cle.lastIndexOf('-') + 1));
      sortie.push({ cle, id: String(item.id || ''), client: r.client || '', dateStart: r.dateStart || '', supprimeLe: ts ? new Date(ts).toISOString() : '' });
    } catch (e) { /* illisible : ignorée */ }
  }
  return sortie.sort((a, b) => String(b.supprimeLe).localeCompare(String(a.supprimeLe)));
}

export async function lireCorbeille(cle) {
  if (!String(cle).startsWith('corbeille/')) throw new Error('Clé invalide');
  const texte = await getStore(DATA_STORE).get(cle, { type: 'text', consistency: 'strong' });
  if (!texte) throw new Error('Introuvable dans la corbeille');
  return JSON.parse(texte);
}
