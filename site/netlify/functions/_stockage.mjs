// Couche de stockage unique du back-office.
//
// Par défaut (variable STOCKAGE absente) : Netlify Blobs, comme avant.
// STOCKAGE=supabase : tout passe par la table public.kv de Supabase
// (voir supabase/schema.sql). Même interface que getStore() de Netlify Blobs :
// get / getWithMetadata / getMetadata / set / setJSON / delete / list,
// y compris les écritures conditionnelles onlyIfMatch / onlyIfNew
// utilisées pour les compteurs et le fichier clients.
import { getStore as getStoreBlobs } from './_blobs.mjs';

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

export function stockageActif() {
  return String(process.env.STOCKAGE || '').toLowerCase() === 'supabase' ? 'supabase' : 'blobs';
}

function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const cle = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!url || !cle) throw new Error('Supabase : SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans Netlify.');
  return { url, cle };
}

export const stats = { n: 0, ms: 0 };
async function rest(chemin, { method = 'GET', body, headers = {}, essais = 3 } = {}) {
  const { url, cle } = config();
  const h = { apikey: cle, ...headers };
  // Anciennes clés (JWT « eyJ… ») : aussi en Bearer. Nouvelles clés (sb_secret_…) : apikey seule.
  if (!cle.startsWith('sb_')) h.Authorization = 'Bearer ' + cle;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = Date.now();
  stats.n++;
  let derniere;
  try {
    for (let i = 0; i < essais; i++) {
      try {
        const rep = await fetch(url + '/rest/v1/' + chemin, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
        if (rep.status >= 500 && i < essais - 1) { await new Promise((r) => setTimeout(r, 300 * (i + 1))); continue; }
        if (!rep.ok) {
          const t = await rep.text().catch(() => '');
          throw new Error(`Supabase ${method} ${chemin.split('?')[0]} : ${rep.status} ${t.slice(0, 300)}`);
        }
        return rep;
      } catch (e) {
        derniere = e;
        if (/^Supabase /.test(e.message) && !/ 5\d\d /.test(e.message)) throw e;
        if (i < essais - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
      }
    }
    throw derniere;
  } finally {
    stats.ms += Date.now() - t0;
  }
}

// Petit cache de quelques secondes : list() ramène aussi le contenu des fiches en une seule
// requête, et les get() qui suivent (un par fiche dans le back-office) n'ont plus à
// refaire un aller-retour réseau chacun. Jamais utilisé pour les écritures conditionnelles.
const CACHE_MS = 3000;
const cache = new Map();
const listes = new Map(); // dernière liste demandée par stockage
const cleC = (store, key) => store + '\u0000' + key;
function cachePut(store, key, l) {
  if (cache.size > 3000) cache.clear();
  cache.set(cleC(store, key), { t: Date.now(), l });
}
function cacheGet(store, key) {
  const e = cache.get(cleC(store, key));
  if (!e) return null;
  if (Date.now() - e.t > CACHE_MS) { cache.delete(cleC(store, key)); return null; }
  return e.l;
}

const q = (v) => encodeURIComponent(String(v));
const filtre = (store, key) => `store=eq.${q(store)}&key=eq.${q(key)}`;

function versOctets(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}

async function ligneDepuis(data) {
  if (typeof data === 'string') return { texte: data, octets: null };
  if (typeof Blob !== 'undefined' && data instanceof Blob) data = await data.arrayBuffer();
  const o = versOctets(data);
  if (!o) throw new Error('Stockage : type de donnée non pris en charge.');
  return { texte: null, octets: Buffer.from(o).toString('base64') };
}

function octetsDeLigne(l) {
  return l.octets != null ? new Uint8Array(Buffer.from(l.octets, 'base64')) : enc.encode(l.texte ?? '');
}
function texteDeLigne(l) {
  if (l.texte != null) return l.texte;
  try { return dec.decode(octetsDeLigne(l)); } catch { return Buffer.from(octetsDeLigne(l)).toString('utf8'); }
}
function convertir(l, type) {
  if (type === undefined || type === 'text') return texteDeLigne(l);
  if (type === 'json') return JSON.parse(texteDeLigne(l));
  const o = octetsDeLigne(l);
  const ab = o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);
  if (type === 'arrayBuffer') return ab;
  if (type === 'blob') return new Blob([ab]);
  if (type === 'stream') return new Blob([ab]).stream();
  throw new Error(`Stockage : type « ${type} » inconnu.`);
}

class StoreSupabase {
  constructor(nom) { this.name = nom; }

  async _ligne(key, colonnes) {
    const rep = await rest(`kv?${filtre(this.name, key)}&select=${colonnes}`);
    const l = await rep.json();
    return l[0] || null;
  }
  async get(key, options) {
    const c = cacheGet(this.name, key);
    if (c) return convertir(c, options && options.type);
    const rec = listes.get(this.name);
    if (rec && Date.now() - rec.t < CACHE_MS && rec.cles.has(key)) {
      // un seul préchargement par liste, partagé par toutes les lectures simultanées
      if (!rec.attente) rec.attente = this._precharger(rec.prefix).catch(() => {});
      await rec.attente;
      const c2 = cacheGet(this.name, key);
      if (c2) return convertir(c2, options && options.type);
    }
    const l = await this._ligne(key, 'texte,octets');
    return l ? convertir(l, options && options.type) : null;
  }
  async getWithMetadata(key, options) {
    const l = await this._ligne(key, 'texte,octets,etag,metadata');
    return l ? { data: convertir(l, options && options.type), etag: l.etag, metadata: l.metadata || {} } : null;
  }
  async getMetadata(key) {
    const l = await this._ligne(key, 'etag,metadata');
    return l ? { etag: l.etag, metadata: l.metadata || {} } : null;
  }
  async _ecrire(key, data, options = {}) {
    cache.delete(cleC(this.name, key));
    const { texte, octets } = await ligneDepuis(data);
    const etag = globalThis.crypto.randomUUID();
    const ligne = { store: this.name, key, texte, octets, metadata: options.metadata || {}, etag, maj: new Date().toISOString() };
    const rep_ = 'return=representation';
    if (options.onlyIfNew) {
      const rep = await rest('kv?select=etag', { method: 'POST', body: ligne, headers: { Prefer: `resolution=ignore-duplicates,${rep_}` } });
      const l = await rep.json();
      return l.length ? { etag, modified: true } : { modified: false };
    }
    if (options.onlyIfMatch) {
      const { store, key: k, ...champs } = ligne;
      const rep = await rest(`kv?${filtre(this.name, key)}&etag=eq.${q(options.onlyIfMatch)}&select=etag`, { method: 'PATCH', body: champs, headers: { Prefer: rep_ } });
      const l = await rep.json();
      return l.length ? { etag, modified: true } : { modified: false };
    }
    await rest('kv?on_conflict=store,key', { method: 'POST', body: ligne, headers: { Prefer: `resolution=merge-duplicates,return=minimal` } });
    return { etag, modified: true };
  }
  set(key, data, options) { return this._ecrire(key, data, options); }
  setJSON(key, data, options) { return this._ecrire(key, JSON.stringify(data), options); }
  async delete(key) { cache.delete(cleC(this.name, key)); await rest(`kv?${filtre(this.name, key)}`, { method: 'DELETE' }); }
  async list(options = {}) {
    // Liste légère (clés + etag seulement) : peu de données échangées, utile aux simples
    // contrôles. Si on lit ensuite une de ces fiches, get() ramène TOUT le dossier en une
    // seule requête (voir _precharger) au lieu d'une requête par fiche.
    const prefix = options.prefix || '';
    const blobs = [];
    const LOT = 1000;
    for (let depart = 0; ; depart += LOT) {
      const rep = await rest('rpc/kv_liste', { method: 'POST', body: { p_store: this.name, p_prefix: prefix, p_depart: depart, p_lot: LOT } });
      const l = await rep.json();
      for (const x of l) blobs.push({ key: x.key, etag: x.etag });
      if (l.length < LOT) break;
    }
    listes.set(this.name, { t: Date.now(), prefix, cles: new Set(blobs.map((b) => b.key)) });
    return { blobs, directories: [] };
  }

  async _precharger(prefix) {
    const motif = /[*,()]/.test(prefix) ? '' : `&key=like.${q(prefix.replace(/\\/g, '\\\\'))}*`;
    const LOT = 1000;
    for (let depart = 0; ; depart += LOT) {
      const rep = await rest(`kv?store=eq.${q(this.name)}${motif}&select=key,texte&order=key&limit=${LOT}&offset=${depart}`);
      const l = await rep.json();
      for (const x of l) if (x.key.startsWith(prefix) && x.texte != null) cachePut(this.name, x.key, { texte: x.texte, octets: null });
      if (l.length < LOT) break;
    }
  }
}

export function getStore(entree, options) {
  if (stockageActif() !== 'supabase') return getStoreBlobs(entree, options);
  const nom = typeof entree === 'string' ? entree : entree && entree.name;
  if (!nom) throw new Error('getStore : nom de stockage manquant.');
  return new StoreSupabase(nom);
}

// Utilitaires pour la migration / vérification.
export const _interne = { StoreSupabase, rest, cache };
