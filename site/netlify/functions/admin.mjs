/* ═══════════════════════════════════════════════════════════════════
   BACK-OFFICE VESPRA EVENT — produits, blog, avis
   ───────────────────────────────────────────────────────────────────
   Un seul fichier, sans base de données externe : les contenus administrables
   (produits, articles, textes, notices, apparence, avis, réservations,
   logistique et médias) sont persistés dans des stores Netlify Blobs.
   Les trois formulaires publics reservation/devis/newsletter restent des
   Netlify Forms, car ils correspondent aux demandes envoyées par les visiteurs.

   Connexion : un identifiant (variable Netlify ADMIN_USER) et un mot de
   passe (variable Netlify ADMIN_PASSWORD) donnent un cookie de session
   signé (HMAC, variable ADMIN_SECRET), valable 12h. Aucun identifiant ni
   mot de passe n'est écrit dans ce fichier : tout vient des variables
   d'environnement Netlify.

   Routes (toutes préfixées /api/admin/... via _redirects) :
     POST   /login                          { user, password } → cookie
     GET    /session                        vérifie le cookie
     POST   /logout
     GET    /data?collection=produits|blog  liste (protégé)
     POST   /data                           { collection, item } upsert (protégé)
     DELETE /data?collection=...&id=...     supprime (protégé)
     POST   /avis                           { produit, nom, note, texte } publie direct (protégé)

   Routes publiques (lues par le site, sans authentification) :
     GET /api/produits   → JSON des produits (dernier envoi par id)
     GET /api/blog       → JSON des articles (dernier envoi par id)
     GET /api/theme      → JSON de l'apparence (couleurs, polices, taille)
     GET /api/textes?page=… → textes réécrits pour cette page
     GET /api/notices?page=… → notices masquées ou ajoutées
   ═══════════════════════════════════════════════════════════════════ */

import { readFile } from 'node:fs/promises';
import { limiteBlobs, limiteAjouter } from './_limite.mjs';
import { join } from 'node:path';
import { createHmac, timingSafeEqual, createHash, randomUUID, randomBytes, randomInt, scryptSync } from 'node:crypto';
/* La bibliothèque Netlify Blobs est incluse dans le dossier (_blobs.mjs)
   plutôt qu'installée : le site se déploie par simple dépôt du dossier,
   sans installation de paquets. Importée par son nom, elle serait
   introuvable au moment de l'exécution et TOUTE modification depuis le
   back-office échouerait. */
import { getStore, stockageActif, stats as stockStats } from './_stockage.mjs';
import * as secu from './_sauvegarde.mjs';
/* Fabrication du PDF de facture : écrite à la main, sans dépendance,
   pour la même raison que la bibliothèque Blobs est jointe au dossier. */
import { construireFacture, jourFr, periodeFr } from './_facture.mjs';
import { construireNoteFrais } from './_notefrais.mjs';
import { contratWord } from './_contrat.mjs';
import * as repAuto from './_reponse-auto.mjs';
import { htmlRelance, htmlAvis, htmlAccuse, pageProduit } from './_mails-auto.mjs';
/* La liste des codes de parrainage vient de la fonction qui les écrit :
   elle sait les retrouver même quand le parcours du préfixe est en
   retard, grâce à l'index qu'elle tient à jour. */
import { tousLesCodes, supprimerCode } from './parrainage.mjs';

const COOKIE_NAME = 'vespra_admin';
const SESSION_HOURS = 12;

const PRODUCT_FORM = 'produits-admin';
/* fiches produit créées depuis le back-office (nom, textes, configurateur) */
const CATALOGUE_FORM = 'catalogue-admin';
const BLOG_FORM = 'blog-admin';
const AVIS_FORM = 'avis-valides';
const THEME_FORM = 'theme-admin';
const TEXTE_FORM = 'textes-admin';
const GOOGLE_FORM = 'google-admin';
const NOTICE_FORM = 'notices-admin';
const FICHIER_FORM = 'fichiers-admin';
const IMAGE_FORM = 'images-admin';
/* Mise en page : l'ordre des sections d'une page, celles qui sont
   masquées et celles qui ont été dupliquées depuis l'édition visuelle.
   Un enregistrement par page du site. */
const MISEENPAGE_FORM = 'mise-en-page-admin';
const SALLE_FORM = 'salles-admin';
const PRESTA_FORM = 'prestataires-admin';
/* Réservations : le planning et sa configuration, enregistrés côté serveur
   pour être les mêmes depuis le téléphone et depuis l'ordinateur. */
const RESA_FORM = 'reservations-admin';
/* Demandes de devis : le formulaire public « reservation » contient les
   demandes elles-mêmes ; ce formulaire-ci ne stocke que leur suivi
   (nouvelle / en cours / validée) sans toucher à la demande d'origine. */
const SUIVI_FORM = 'suivi-demandes-admin';
/* Suivi logistique : où en est le matériel de chaque réservation
   (à préparer, préparé, remis au client, rendu). Enregistré à part pour
   ne jamais entrer en conflit avec la réservation elle-même. */
const LOGISTIQUE_FORM = 'logistique-admin';
/* Parrainage : un enregistrement par code (le parrain, ses filleuls et
   les avoirs de 10 € déjà déduits). Les codes sont créés par la fonction
   publique parrainage.mjs, qui écrit dans le même store ; le back-office
   les relit ici et n'y touche que pour cocher un avoir comme déduit. */
const PARRAIN_FORM = 'parrainage-admin';
const NOTES_FORM = 'notes-frais-admin';
const ENTREPRISE_FORM = 'entreprise-admin';
const ENTREPRISE_PRIVE_FORM = 'entreprise-prive-admin';
/* Le formulaire public dans lequel arrivent les demandes de devis du site. */
const DEMANDE_FORM = 'reservation';
/* Le site a deux formulaires qui produisent une demande client :
     • « reservation » : le parcours complet, avec le panier ;
     • « devis » : le formulaire court de la page d'accueil, qui ne
       propose que des catégories.
   Les deux doivent apparaître dans la liste des réservations du
   back-office. Seul « reservation » y était lu : une demande envoyée
   depuis l'accueil arrivait bien par courriel, mais restait invisible
   dans le back-office. */
const FORMULAIRES_DEMANDES = ['reservation', 'devis', 'rendez-vous'];

const DATA_STORE = 'vespra-admin-data';
const MEDIA_STORE = 'vespra-media';
const REVIEW_STORE = 'vespra-reviews';
const CLIENT_STORE = 'vespra-clients';
const AUTH_STORE = 'vespra-auth';

function hashAdminPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyAdminPassword(password, record) {
  if (!record?.hash || !record?.salt) return false;
  const hash = scryptSync(String(password), record.salt, 64).toString('hex');
  return safeEqual(hash, record.hash);
}
async function getAdminOverride() {
  try {
    return await blobStore(AUTH_STORE).get('credentials', { type: 'json', consistency: 'strong' });
  } catch { return null; }
}
async function getEffectiveCredentials() {
  const base = { username: process.env.ADMIN_USER || '', password: process.env.ADMIN_PASSWORD || '' };
  const override = await getAdminOverride();
  return override?.username && override?.passwordRecord
    ? { username: override.username, passwordRecord: override.passwordRecord, overridden: true }
    : { ...base, overridden: false };
}
const INTERNAL_FORMS = new Set([
  CATALOGUE_FORM, PRODUCT_FORM, BLOG_FORM, AVIS_FORM, THEME_FORM, TEXTE_FORM, GOOGLE_FORM,
  NOTICE_FORM, RESA_FORM, SUIVI_FORM, LOGISTIQUE_FORM, FICHIER_FORM, IMAGE_FORM,
  MISEENPAGE_FORM, SALLE_FORM, PRESTA_FORM, PARRAIN_FORM, ENTREPRISE_FORM, ENTREPRISE_PRIVE_FORM, NOTES_FORM,
]);

/* collection appelée par le back-office → formulaire Netlify correspondant */
const COLLECTIONS = {
  produits: PRODUCT_FORM,
  /* fiches produit créées depuis le back-office */
  catalogue: CATALOGUE_FORM,
  blog: BLOG_FORM,
  theme: THEME_FORM,
  textes: TEXTE_FORM,
  google: GOOGLE_FORM,
  notices: NOTICE_FORM,
  images: IMAGE_FORM,
  'mise-en-page': MISEENPAGE_FORM,
  salles: SALLE_FORM,
  prestataires: PRESTA_FORM,
  reservations: RESA_FORM,
  suivi: SUIVI_FORM,
  logistique: LOGISTIQUE_FORM,
  parrainage: PARRAIN_FORM,
  'notes-frais': NOTES_FORM,
  /* informations de l'entreprise : une part publique (affichée sur le site)
     et une part privée (RIB, conditions), jamais exposée au public */
  entreprise: ENTREPRISE_FORM,
  'entreprise-prive': ENTREPRISE_PRIVE_FORM,
};
const formDe = (c) => Object.prototype.hasOwnProperty.call(COLLECTIONS, c) ? COLLECTIONS[c] : null;

/* ───────────────────────── utilitaires signature ───────────────────────── */
function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}
function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
}
function makeSessionToken(secret) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}
function verifySessionToken(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [who, expStr, sig] = parts;
  if (who !== 'admin') return false;
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;
  const payload = `${who}.${expStr}`;
  return safeEqual(sign(payload, secret), sig);
}
function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/* ───────────────────────── réponses JSON ─────────────────────────
   Deux sortes de réponses :
   - json()        : jamais mise en cache (back-office, données privées)
   - jsonPublic()  : mise en cache par le CDN de Netlify.

   C'est ce second point qui compte pour la facture. Sans cache, chaque
   visiteur de chaque page déclenchait un appel de fonction, et chaque
   appel interrogeait l'API Netlify : c'est ce qui consomme des crédits,
   bien plus que vos modifications. Avec le cache, la réponse est servie
   directement par le CDN sans réveiller la fonction. La directive
   « durable » partage ce cache entre tous les serveurs de Netlify.

   L’API publique est volontairement en no-store afin qu’une modification
   validée dans Blobs soit relue immédiatement. Le purge Netlify reste appelé
   lorsqu’un token est disponible, mais il n’est plus nécessaire pour la
   cohérence des données. */
const CACHE_TAG = 'vespra-contenu';
const jsonPublic = (data) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      'netlify-cdn-cache-control': 'no-store',
    },
  });

/* ───────────────────────── réponses JSON ───────────────────────── */
const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders },
  });

/* ───────────────────────── accès à l'API Netlify ───────────────────────── */
async function netlifyApi(path, opts = {}) {
  const token = process.env.NETLIFY_ACCESS_TOKEN;
  if (!token) throw new Error('NETLIFY_ACCESS_TOKEN absent');
  const r = await fetch(`https://api.netlify.com/api/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`API Netlify ${r.status} sur ${path}`);
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : null;
}

let _siteId = null;
async function siteId() {
  if (_siteId) return _siteId;
  if (process.env.SITE_ID) return (_siteId = process.env.SITE_ID);
  const host = (process.env.URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (host) {
    try { const site = await netlifyApi(`/sites/${host}`); if (site?.id) return (_siteId = site.id); } catch {}
  }
  throw new Error('SITE_ID absent ou site introuvable');
}

/* Netlify ne rend les soumissions que par pages. Une seule page suffisait
   au début, mais chaque modification ajoute une soumission : au-delà de la
   première page, les enregistrements les plus anciens disparaissaient de la
   lecture — et donc du site et du planning — alors qu'ils existaient
   toujours. On parcourt maintenant toutes les pages.

   La limite de sécurité (25 pages, soit 5 000 soumissions) évite qu'une
   erreur de pagination ne fasse tourner la fonction indéfiniment. */
const PAR_PAGE = 200;
const PAGES_MAX = 25;

async function netlifyFormSubmissions(formName) {
  const forms = await netlifyApi(`/sites/${await siteId()}/forms`);
  const form = forms.find((f) => f.name === formName);
  if (!form) return { form: null, subs: [] };
  const subs = [];
  const vus = new Set();
  for (const etat of ['', 'spam']) {
    for (let page = 1; page <= PAGES_MAX; page++) {
      let lot;
      try {
        lot = await netlifyApi(`/forms/${form.id}/submissions?per_page=${PAR_PAGE}&page=${page}` +
                               (etat ? `&state=${etat}` : ''));
      } catch { break; }
      if (!Array.isArray(lot) || !lot.length) break;
      for (const sub of lot) {
        if (vus.has(sub.id)) continue;
        vus.add(sub.id);
        subs.push(sub);
      }
      if (lot.length < PAR_PAGE) break;
    }
  }
  return { form, subs };
}

async function blobStore(name = DATA_STORE) {
  return getStore(name);
}
function blobKey(collection, id) {
  return `${collection}/${encodeURIComponent(String(id))}`;
}
async function blobItems(collection) {
  const store = await blobStore();
  const { blobs } = await store.list({ prefix: `${collection}/` });
  const items = [];
  /* lecture par paquets en parallèle : une lecture après l'autre devenait
     trop lente avec quelques centaines de réservations (délai dépassé) */
  const lire = async (b) => {
    try {
      const data = await store.get(b.key, { type: 'json', consistency: 'strong' });
      if (data && typeof data === 'object') {
        return {
          id: String(data.id || decodeURIComponent(b.key.slice(collection.length + 1))),
          data,
          created_at: data._created || new Date().toISOString(),
          idKey: b.key,
        };
      }
    } catch (e) {
      console.error('Lecture Blob impossible :', b.key, e.message);
    }
    return null;
  };
  for (let i = 0; i < blobs.length; i += 25) {
    const lot = await Promise.all(blobs.slice(i, i + 25).map(lire));
    lot.forEach((x) => { if (x) items.push(x); });
  }
  return { form: { name: collection, blobs: true }, subs: items };
}

async function formSubmissions(formName) {
  if (INTERNAL_FORMS.has(formName)) {
    if (formName === AVIS_FORM) {
      const store = await blobStore(REVIEW_STORE);
      const { blobs } = await store.list({ prefix: 'published/' });
      const subs = [];
      for (const b of blobs) {
        const d = await store.get(b.key, { type: 'json', consistency: 'strong' });
        if (d) subs.push({ id: b.key, data: d, created_at: d._created || new Date().toISOString() });
      }
      return { form: { name: formName, blobs: true }, subs };
    }
    const collection = Object.keys(COLLECTIONS).find(k => COLLECTIONS[k] === formName) || formName;
    return blobItems(collection);
  }
  return netlifyFormSubmissions(formName);
}

async function saveBlobItem(collection, item, secret) {
  const store = await blobStore();
  const clean = cleanFields(item);
  clean.id = String(item.id);
  clean._created = item._created || new Date().toISOString();
  if (secret) clean.sig = item.sig || itemSignature(clean, secret);
  /* la version précédente d'une réservation est gardée avant d'être remplacée */
  if (collection === 'reservations') {
    try { await secu.garderVersion(store, collection, clean.id, JSON.stringify(clean)); }
    catch (e) { console.error('Historique impossible :', e.message); }
  }
  await store.set(blobKey(collection, clean.id), JSON.stringify(clean), {
    metadata: { updatedAt: new Date().toISOString(), collection, id: clean.id },
  });
  return clean;
}

async function deleteBlobItem(collection, id) {
  const store = await blobStore();
  await store.delete(blobKey(collection, id));
  const gone = await store.get(blobKey(collection, id), { type: 'json', consistency: 'strong' });
  if (gone !== null && gone !== undefined) throw new Error(`Suppression non confirmée pour ${collection}/${id}`);
}

async function verifyBlobItem(collection, id, secret) {
  const store = await blobStore();
  const key = blobKey(collection, id);
  const saved = await store.get(key, { type: 'json', consistency: 'strong' });
  if (!saved) throw new Error(`Enregistrement introuvable après écriture (${collection}/${id})`);
  if (String(saved.id) !== String(id)) throw new Error(`Vérification invalide : identifiant différent (${collection}/${id})`);
  if (secret && !itemSignatureValid(saved, secret)) throw new Error(`Signature invalide après écriture (${collection}/${id})`);
  return saved;
}

async function verifyStorageWrite(storeName) {
  const store = await blobStore(storeName);
  const key = `_system/health/${randomUUID()}`;
  const payload = { ok: true, store: storeName, at: new Date().toISOString() };
  await store.set(key, JSON.stringify(payload), { metadata: { healthcheck: 'true' } });
  const read = await store.get(key, { type: 'json', consistency: 'strong' });
  if (!read || read.store !== storeName || read.at !== payload.at) {
    throw new Error(`Lecture après écriture impossible dans ${storeName}`);
  }
  await store.delete(key);
  const gone = await store.get(key, { type: 'json', consistency: 'strong' });
  if (gone !== null && gone !== undefined) throw new Error(`Suppression de test non confirmée dans ${storeName}`);
  return true;
}

async function savePublishedReview(review) {
  const store = await blobStore(REVIEW_STORE);
  const base = {
    p: String(review.p || '').slice(0, 200),
    n: String(review.n || '').slice(0, 200),
    s: String(Math.max(1, Math.min(5, parseInt(review.s, 10) || 5))),
    t: String(review.t || '').slice(0, 900),
    d: String(review.d || ''),
    _created: review._created || new Date().toISOString(),
  };
  const hash = createHash('sha256').update(`${base.p}|${base.n}|${base.t}`).digest('hex').slice(0, 24);
  await store.set(`published/${hash}`, JSON.stringify(base));
  return base;
}

async function deletePublishedReview(nom, texte) {
  const store = await blobStore(REVIEW_STORE);
  const { blobs } = await store.list({ prefix: 'published/' });
  for (const b of blobs) {
    const d = await store.get(b.key, { type: 'json', consistency: 'strong' });
    if (d && d.n === nom && d.t === texte) {
      await store.delete(b.key);
      return true;
    }
  }
  return false;
}

async function savePendingReview(review) {
  const store = await blobStore(REVIEW_STORE);
  const id = randomUUID();
  const data = { ...review, id, _created: new Date().toISOString(), status: 'pending' };
  await store.set(`pending/${id}`, JSON.stringify(data));
  return data;
}

/* ── Nettoyage des versions périmées ────────────────────────────────
   Les contenus administrables sont maintenant des clés uniques dans Blobs :
   une modification remplace directement la valeur de la clé concernée.
   L'ancien système par soumissions Netlify Forms n'est conservé que pour la
   migration initiale et pour les formulaires publics.
   ─────────────────────────────────────────────────────────────────── */
const NETTOYAGE_SEUIL = 40;    /* en dessous, ça n'en vaut pas la peine */
const NETTOYAGE_MAX = 60;      /* suppressions par appel */

async function nettoyerVersionsPerimees() {
  return 0;
}

/* dernière soumission par id = version actuelle */
/* Le suivi le plus récent de chaque demande, complété par les corrections
   (c_…) des enregistrements précédents que lui seul ne porte pas : un
   changement de statut ou de note ne doit jamais faire oublier les produits,
   le nom ou la date corrigés avant. */
function suivisFusionnes(subs) {
  const parId = new Map();
  for (const s of subs) {
    const d = s.data || {};
    if (!d.id) continue;
    if (!parId.has(d.id)) parId.set(d.id, []);
    parId.get(d.id).push({ ...d, _submissionId: s.id, _created: s.created_at });
  }
  const sortie = [];
  for (const liste of parId.values()) {
    liste.sort((a, b) => new Date(b._created) - new Date(a._created));
    const merged = { ...liste[0] };
    for (const ancien of liste.slice(1)) {
      for (const [k, v] of Object.entries(ancien)) {
        if (k.startsWith('c_') && merged[k] === undefined && v !== undefined && v !== null && v !== '') merged[k] = v;
      }
    }
    sortie.push(merged);
  }
  return sortie.sort((a, b) => new Date(b._created) - new Date(a._created));
}

function latestById(subs) {
  const byId = new Map();
  for (const s of subs) {
    const d = s.data || {};
    if (!d.id) continue;
    const existing = byId.get(d.id);
    if (!existing || new Date(s.created_at) > new Date(existing._created)) {
      byId.set(d.id, { ...d, _submissionId: s.id, _created: s.created_at });
    }
  }
  return [...byId.values()].sort((a, b) => new Date(b._created) - new Date(a._created));
}

/* ── Signature du contenu ──────────────────────────────────────────────
   Les formulaires Netlify acceptent par nature n'importe quel envoi venant
   de n'importe où : sans protection, un inconnu qui devine le nom du
   formulaire pourrait publier un produit ou un article sur le site.
   Chaque enregistrement écrit par l'admin porte donc une signature HMAC
   calculée avec ADMIN_SECRET, et le site public n'affiche QUE les
   enregistrements dont la signature est valide. Un envoi non signé (ou
   signé avec la mauvaise clé) est stocké mais jamais affiché.
   ────────────────────────────────────────────────────────────────────── */
const SIG_IGNORE = new Set(['sig', 'bot-field', 'form-name']);

function canonical(fields) {
  const entries = Object.entries(fields)
    .filter(([k, v]) => !SIG_IGNORE.has(k) && !k.startsWith('_') && v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => [k, String(v)]);
  return JSON.stringify(entries);
}
function itemSignature(fields, secret) {
  return sign(canonical(fields), secret);
}
function itemSignatureValid(item, secret) {
  if (!secret || !item || !item.sig) return false;
  return safeEqual(itemSignature(item, secret), item.sig);
}

/* ne garde que les champs réellement renseignés : ce qui est signé doit
   être exactement ce que Netlify nous rendra à la relecture */
function cleanFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SIG_IGNORE.has(k) || k.startsWith('_')) continue;
    if (v === undefined || v === null) continue;
    /* Les valeurs sont enregistrées en texte. Un tableau passé tel quel
       devenait « a,b,c » et n'était plus relisible : l'ordre du catalogue
       enregistré depuis le back-office était ignoré par le site. On les
       écrit donc en JSON, qui se relit sans ambiguïté. */
    const s = (Array.isArray(v) || (typeof v === 'object' && v !== null))
      ? JSON.stringify(v)
      : String(v);
    if (s === '') continue;
    out[k] = s;
  }
  return out;
}


/* Mêmes règles que le planning : une option « une seule fois » (cadre photo,
   déguisements) enregistrée en double sur un même produit n'est comptée
   qu'une fois, sur la fiche comme sur le devis et la facture. */
function produitsNetsResa(list) {
  var out = [], vus = {}, parent = -1;
  var net = function (v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^\s*(\+|option)\s*:?\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
  (list || []).forEach(function (p, i) {
    if (!p) return;
    var n = net(p.name);
    var opt = p.estOption === true || p.variant === 'Option' ||
      (i > 0 && !/^photobooth/.test(n) && /^(cadre photo|deguisement|lot de deguisement|option|micro|eclairage|guirlande|sacs? de lestage|lestage|cabine|neon|mais a eclater|installation|canon (rose|bleu|blanc|rouge|jaune|orange|vert|violet))/.test(n));
    if (!opt) { parent = i; out.push(p); return; }
    var k = /^cadre photo/.test(n) ? 'cadre' : (/^(lot de )?deguisement/.test(n) ? 'deguis' : null);
    if (k) {
      var cle = (p.parent != null ? 'u' + p.parent : 'i' + parent) + '|' + k;
      if (vus[cle]) return; vus[cle] = 1;
    }
    out.push(p);
  });
  return out;
}

async function submitToForm(formName, fields, secret) {
  if (INTERNAL_FORMS.has(formName)) {
    if (formName === AVIS_FORM) {
      await savePublishedReview(fields);
      return;
    }
    const collection = Object.keys(COLLECTIONS).find(k => COLLECTIONS[k] === formName);
    if (!collection) throw new Error(`Collection Blobs introuvable pour ${formName}`);
    await saveBlobItem(collection, fields, secret);
    return;
  }
  const siteUrl = process.env.URL;
  if (!siteUrl) throw new Error('URL du site (process.env.URL) absente');
  const clean = cleanFields(fields);
  if (secret) clean.sig = itemSignature(clean, secret);
  const body = new URLSearchParams({ 'form-name': formName, ...clean, 'bot-field': '' });
  const r = await fetch(siteUrl + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`Envoi au formulaire ${formName} refusé (${r.status})`);
}

/* Vide le cache du CDN pour que la modification soit visible aussitôt.
   Sans cela, il faudrait attendre l'expiration du cache. */
async function viderCache() {
  try {
    const token = process.env.NETLIFY_ACCESS_TOKEN;
    /* sans jeton, le CDN garde l'ancienne version jusqu'à expiration : la
       modification est bien enregistrée, mais invisible pendant un temps.
       Le back-office le dit clairement plutôt que de laisser croire à une
       panne. */
    if (!token) return 'jeton-absent';
    const r = await fetch('https://api.netlify.com/api/v1/purge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ site_id: await siteId(), cache_tags: [CACHE_TAG] }),
    });
    return r.ok ? 'vide' : 'refus';
  } catch (e) { console.error('Vidage du cache impossible :', e.message); return 'erreur'; }
}

async function deleteAllSubmissionsWithId(formName, id) {
  if (INTERNAL_FORMS.has(formName)) {
    if (formName === AVIS_FORM) return 0;
    const collection = Object.keys(COLLECTIONS).find(k => COLLECTIONS[k] === formName);
    if (!collection) return 0;
    await deleteBlobItem(collection, id);
    return 1;
  }
  const { subs } = await netlifyFormSubmissions(formName);
  const toDelete = subs.filter((s) => (s.data || {}).id === id);
  for (const s of toDelete) {
    try { await netlifyApi(`/submissions/${s.id}`, { method: 'DELETE' }); } catch (e) { console.error('Suppression impossible :', e.message); }
  }
  return toDelete.length;
}

/* ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   FACTURATION
   ───────────────────────────────────────────────────────────────────
   Les informations ci-dessous figurent obligatoirement sur une facture
   (article 242 nonies A de l'annexe II au code général des impôts).
   Elles sont publiques — elles sont déjà sur les mentions légales du
   site — donc rien ici n'a sa place dans les variables d'environnement.
   Si l'un de ces éléments change (capital, siège, greffe), c'est ici
   qu'il faut le modifier, et nulle part ailleurs.
   ═══════════════════════════════════════════════════════════════════ */
const EMETTEUR = {
  nom: 'VESPRA EVENT',
  activite: 'Location de matériel événementiel',
  forme: 'SARL',
  capital: '16 144 €',
  /* Nouveau local à partir du 1er novembre 2026 : les devis et factures
     datés d'après portent la nouvelle adresse, les autres gardent l'ancienne. */
  get adresse() {
    return Date.now() >= Date.parse('2026-10-28T00:00:00+01:00')
      ? ['1 bis allée de la Haute Gasniais', '35500 Vitré']
      : ['1 bis allée de la Haute Gasniais', '35500 Vitré'];
  },
  siret: '130 286 842 00013',
  rcs: 'Rennes 130 286 842',
  tva: 'FR08130286842',
  tel: '06 50 83 68 28',
  email: 'contact@vespraevent.com',
  /* compte professionnel de la SARL : reporté au bas des devis et factures */
  banque: { titulaire: 'S.A.R.L. VESPRA EVENT', iban: 'FR76 1360 6000 6446 3565 1261 842', bic: 'AGRIFRPP836' },
};
/* Location de biens meubles corporels : taux normal. */
const TAUX_TVA = 20;
const MOYENS = 'Paiement par virement bancaire (coordonnées bancaires ci-dessus) ; à défaut, le jour J par carte bancaire ou en espèces. Les chèques ne sont pas acceptés.';
const CONDITIONS_PARTICULIER =
  'Conditions de règlement : paiement comptant le jour de la mise à disposition du matériel '
  + '(livraison ou retrait au dépôt). ' + MOYENS + ' Un règlement par virement doit être reçu avant le jour de l’événement.';
const CONDITIONS_PRO =
  'Conditions de règlement : paiement à 30 jours à compter de la date d’émission de la facture. ' + MOYENS;
const VALIDITE_DEVIS = 30;
const CONDITIONS_DEVIS =
  'Devis établi gratuitement et sans engagement, valable ' + VALIDITE_DEVIS + ' jours à compter de sa date d\u2019émission. '
  + 'Les prix sont fermes pendant cette durée. La réservation du matériel n\u2019est effective qu\u2019après retour '
  + 'de ce devis daté et signé. Paiement : par virement bancaire (coordonnées ci-dessus) ; à défaut, le jour J par carte bancaire ou en espèces. Les chèques ne sont pas acceptés.';
const PENALITES_PRO =
  'En cas de retard de paiement, des pénalités sont exigibles au taux d’intérêt appliqué par la Banque centrale '
  + 'européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage, ainsi qu’une '
  + 'indemnité forfaitaire pour frais de recouvrement de 40 € (articles L. 441-10 et D. 441-5 du code de commerce).';

/* ── Informations de l'entreprise modifiables depuis Paramètres ─────────
   Tout ce qui figure sur les devis et factures (adresse, SIRET, RIB,
   assurance, conditions…) se lit ici. Les valeurs ci-dessus sont les
   valeurs d'origine : elles servent tant qu'un champ n'a pas été rempli
   dans le back-office. Une valeur enregistrée prend le pas dessus. */
async function lireEntreprise() {
  const store = await blobStore();
  const lire = async (c) => {
    try { return (await store.get(blobKey(c, 'cfg'), { type: 'json', consistency: 'strong' })) || {}; }
    catch { return {}; }
  };
  const [pub, priv] = await Promise.all([lire('entreprise'), lire('entreprise-prive')]);
  const c = (v, d) => (v !== undefined && v !== null && String(v).trim() !== '') ? String(v).trim() : d;
  const validite = Math.max(1, Math.round(Number(pub.validiteDevis) || VALIDITE_DEVIS));
  const adr = EMETTEUR.adresse;
  const banqueDef = EMETTEUR.banque;
  const moyens = MOYENS;
  const conditionsDevis = (v) => 'Devis établi gratuitement et sans engagement, valable ' + v + ' jours à compter de sa date d\u2019émission. '
    + 'Les prix sont fermes pendant cette durée. La réservation du matériel n\u2019est effective qu\u2019après retour '
    + 'de ce devis daté et signé. Paiement : par virement bancaire (coordonnées ci-dessus) ; à défaut, le jour J par carte bancaire ou en espèces. Les chèques ne sont pas acceptés.';
  const effectif = {
    pub: {
      nom: c(pub.nom, EMETTEUR.nom), forme: c(pub.forme, EMETTEUR.forme), capital: c(pub.capital, EMETTEUR.capital),
      siret: c(pub.siret, EMETTEUR.siret), rcs: c(pub.rcs, EMETTEUR.rcs), tva: c(pub.tva, EMETTEUR.tva),
      adresse: c(pub.adresse, adr[0]), cpville: c(pub.cpville, adr[1]),
      tel: c(pub.tel, EMETTEUR.tel), email: c(pub.email, EMETTEUR.email),
      assureur: c(pub.assureur, ''), assureurNumero: c(pub.assureurNumero, ''), assureurAdresse: c(pub.assureurAdresse, ''),
      validiteDevis: String(validite),
    },
    priv: {
      banqueTitulaire: c(priv.banqueTitulaire, banqueDef.titulaire), iban: c(priv.iban, banqueDef.iban),
      bic: c(priv.bic, banqueDef.bic), banque: c(priv.banque, ''),
      conditionsDevis: c(priv.conditionsDevis, conditionsDevis(validite)),
      conditionsFacturePart: c(priv.conditionsFacturePart, CONDITIONS_PARTICULIER),
      conditionsFacturePro: c(priv.conditionsFacturePro, CONDITIONS_PRO),
      penalites: c(priv.penalites, PENALITES_PRO),
    },
  };
  const P = effectif.pub, V = effectif.priv;
  effectif.emetteur = {
    nom: P.nom, activite: EMETTEUR.activite, forme: P.forme, capital: P.capital,
    adresse: [P.adresse, P.cpville].filter(Boolean),
    siret: P.siret, rcs: P.rcs, tva: P.tva, tel: P.tel, email: P.email,
    banque: { titulaire: V.banqueTitulaire, iban: V.iban, bic: V.bic, nom: V.banque },
    assurance: P.assureur ? { assureur: P.assureur, numero: P.assureurNumero, adresse: P.assureurAdresse } : null,
  };
  effectif.validite = validite;
  effectif.defauts = { conditionsDevis: conditionsDevis(validite), conditionsFacturePart: CONDITIONS_PARTICULIER, conditionsFacturePro: CONDITIONS_PRO, penalites: PENALITES_PRO };
  return effectif;
}

/* Numéro de facture : une suite continue, sans trou ni doublon.
   Le numéro est attribué à la première génération et conservé : une
   facture régénérée porte le même. L'écriture est conditionnelle, donc
   deux générations simultanées ne peuvent pas prendre le même numéro. */
async function numeroDeFacture(resaId, resa, type = 'facture') {
  const store = await blobStore(DATA_STORE);
  const dossier = type === 'devis' ? 'devis' : 'factures';
  const cle = `${dossier}/${encodeURIComponent(String(resaId))}`;
  const deja = await store.get(cle, { type: 'json', consistency: 'strong' });
  if (deja && deja.numero) return deja;

  const annee = new Date().getFullYear();
  const cleCompteur = `compteurs/${dossier}/${annee}`;
  for (let essai = 0; essai < 6; essai++) {
    const actuel = await store.getWithMetadata(cleCompteur, { type: 'json', consistency: 'strong' });
    const valeur = (actuel && actuel.data && Number(actuel.data.n)) || 0;
    const suivant = valeur + 1;
    const ecrit = actuel && actuel.etag
      ? await store.setJSON(cleCompteur, { n: suivant }, { onlyIfMatch: actuel.etag })
      : await store.setJSON(cleCompteur, { n: suivant }, { onlyIfNew: true });
    if (ecrit && ecrit.modified === false) continue;       /* quelqu'un est passé avant */
    const fiche = {
      numero: (type === 'devis' ? 'D' : '') + `${annee}-${String(suivant).padStart(4, '0')}`,
      resaId: String(resaId),
      client: (resa && resa.client) || '',
      emiseLe: new Date().toISOString(),
    };
    await store.setJSON(cle, fiche);
    return fiche;
  }
  throw new Error('Numéro de facture indisponible : réessayez dans un instant.');
}

/* ── limite d'essais par adresse IP (mémoire de l'instance) ───────── */
const _essais = new Map();
function tropEssais(request, max, fenetreMs, cle) {
  const ip = (request.headers.get('x-nf-client-connection-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0] || 'inconnu').trim();
  const k = cle + '|' + ip, now = Date.now();
  const l = (_essais.get(k) || []).filter((t) => now - t < fenetreMs);
  l.push(now); _essais.set(k, l);
  if (_essais.size > 2000) for (const [kk, v] of _essais) if (!v.length || now - v[v.length - 1] > fenetreMs) _essais.delete(kk);
  return l.length > max;
}

function loginBloque(request) {
  const ip = (request.headers.get('x-nf-client-connection-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0] || 'inconnu').trim();
  const now = Date.now();
  return (_essais.get('login|' + ip) || []).filter((t) => now - t < 15 * 60 * 1000).length >= 8;
}

/* ═══════════════════════════════════════════════════════════════════
   ESPACE CLIENT
   ───────────────────────────────────────────────────────────────────
   Les comptes sont créés dans Paramètres › Espaces clients. Le mot de
   passe n'est JAMAIS conservé : seul son hachage scrypt (avec sel) est
   enregistré, dans le store privé vespra-auth. La session est un cookie
   HttpOnly + Secure + SameSite=Strict signé (HMAC) ; elle est liée à une
   « version » du compte, donc changer ou réinitialiser le mot de passe
   déconnecte aussitôt tous les appareils.

   Un client ne voit que ses dossiers : ceux dont l'adresse e-mail est
   celle de son compte. La réponse est reconstruite champ par champ
   (liste blanche) : notes internes, source, marges, etc. ne sortent jamais.
   Il ne modifie rien lui-même : il envoie une demande de modification
   que le back-office accepte ou refuse.
   ═══════════════════════════════════════════════════════════════════ */
const CLIENT_COOKIE = 'vespra_client';
const CLIENT_SESSION_H = 24 * 7;          /* session ordinaire : 7 jours glissants */
const CLIENT_RESTER_H = 24 * 60;          /* « Rester connecté » : 60 jours */
const CLIENT_COURTE_H = 12;               /* sans la case : 12 h, cookie de session */
const ESPACE_VERROU_ESSAIS = 8;
const ESPACE_VERROU_MS = 15 * 60 * 1000;

const emailCle = (e) => String(e || '').trim().toLowerCase();
const emailValide = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(e || '').trim());
const cleCompte = (e) => 'espace/compte/' + encodeURIComponent(emailCle(e));

async function lireCompte(email) {
  try { return await (await blobStore(AUTH_STORE)).get(cleCompte(email), { type: 'json', consistency: 'strong' }); }
  catch { return null; }
}
async function ecrireCompte(c) {
  await (await blobStore(AUTH_STORE)).setJSON(cleCompte(c.email), c);
}
function jetonClient(c, secret, heures) {
  const exp = Date.now() + (heures || CLIENT_SESSION_H) * 3600 * 1000;
  const corps = `${Buffer.from(emailCle(c.email)).toString('base64url')}.${exp}.${c.v || 1}`;
  return `${corps}.${sign('client.' + corps, secret)}`;
}
async function clientConnecte(request, secret) {
  const t = getCookie(request, CLIENT_COOKIE);
  if (!t || !secret) return null;
  const p = t.split('.');
  if (p.length !== 4) return null;
  const corps = p.slice(0, 3).join('.');
  if (!safeEqual(sign('client.' + corps, secret), p[3])) return null;
  if (!(Number(p[1]) > Date.now())) return null;
  let email; try { email = Buffer.from(p[0], 'base64url').toString('utf8'); } catch { return null; }
  const c = await lireCompte(email);
  if (!c || c.actif === false || String(c.v || 1) !== p[2]) return null;
  return c;
}
const MDP_LEURRE = hashAdminPassword('leurre-' + 'vespra');

const nombre = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const texte = (v, max = 300) => String(v == null ? '' : v).slice(0, max);

/* ce qu'un client a le droit de voir d'une réservation du planning */
async function dossierResa(id, r, logi) {
  const lignes = [];
  for (const p of produitsNetsResa(r.products)) {
    if (!p || !p.name) continue;
    const opts = Array.isArray(p.options) ? p.options.filter(Boolean).join(', ') : String(p.options || p.option || '').trim();
    const vr = String(p.variant || '').split(/\s+\+\s+/)[0].replace(/^(standard|option)$/i, '');
    const aff = affichageTitre(String(p.name), vr);
    lignes.push({ nom: texte(aff.matched ? aff.titre : p.name, 120), detail: texte([aff.matched ? aff.sous : vr, opts].filter(Boolean).join(' · '), 160),
      qte: Number(p.qty) || 1, prix: nombre(p.price) });
  }
  const supp = (r.supplements || []).filter(Boolean).map((s) => ({ nom: texte(s.label || s.nom || 'Supplément', 100), prix: nombre(s.price ?? s.prix) }));
  const liv = nombre(r.livraisonPrice), mon = nombre(r.montage);
  const total = nombre(lignes.reduce((t, l) => t + l.prix, 0) + supp.reduce((t, l) => t + l.prix, 0) + liv + mon);
  const fin = r.dateEnd || r.dateStart || '';
  const termine = fin && fin < new Date().toISOString().slice(0, 10);
  const etat = logi && logi.etat || '';
  let statut = 'Validée';
  if (termine) statut = 'Terminée';
  else if (etat === 'rendu') statut = 'Terminée';
  else if (etat === 'remis') statut = 'Matériel remis';
  else if (etat === 'prepare') statut = 'Matériel préparé';
  return {
    id: 'r:' + String(id), kind: 'resa', ref: String(id), statut,
    dateDebut: texte(r.dateStart, 10), dateFin: texte(r.dateEnd || r.dateStart, 10),
    lieu: texte(r.place, 200), convives: texte(r.convives, 20), typeEvenement: texte(r.typeEvenement, 60),
    lignes, supplements: supp,
    livraison: !!r.livraison, livraisonPrix: liv, livraisonRetour: r.livraisonRetour !== false, montage: mon,
    total, acompteDemande: !!r.acompte, acompte: r.acompte ? nombre(Math.round(total * 30) / 100) : 0,
    virementRecu: !!r.virementRecu,
    documents: { devis: false, facture: total > 0 },
  };
}


/* Titre d'une ligne de location : la taille se lit toujours dans le titre
   (« Barnum 3×3 m », « Tente étoile Ø 14 m »), la capacité en petit dessous
   (« 24 à 25 pers. assises »), sans jamais répéter la taille. */
function affichageTitre(nom, formule){
  let CAP = /pers\.?\s*assises|personnes?\b/i, DIM = /(^|\s)(Ø\s*\d|\d+([,.]\d+)?\s*[×x]\s*\d)/i;
  let mots = function(x){ return String(x||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); };
  let parts = String(formule || '').split(/\s+[—–]\s+/).map(function(x){return x.trim();}).filter(Boolean);
  let cap = '', size = '', reste = [];
  parts.forEach(function(x){ if(CAP.test(x) && !cap) cap = x; else if(DIM.test(x) && !size) size = x; else reste.push(x); });
  /* la taille peut déjà être dans le nom (« Barnum 4×6 m ×2 ») */
  if(!size && DIM.test(String(nom||''))) return {matched: !!cap, titre: nom, sous: cap && !redond(nom, cap) ? cap : (cap ? '' : String(formule||'')) };
  if(!size && !cap) return {matched:false, titre:nom, sous:''};
  let titre = nom;
  if(size){
    let nm = mots(nom), sm = mots(size);
    if(sm.every(function(w){return nm.indexOf(w) >= 0;})) titre = nom;
    else if(nm.every(function(w){return sm.indexOf(w) >= 0;})) titre = size;
    else titre = nom + ' ' + size;
  }
  function redond(n, v){ let a = mots(n), b = mots(v); return !!b.length && b.every(function(w){return a.indexOf(w) >= 0;}); }
  let sous = reste.concat(cap && !redond(titre, cap) ? [cap] : []).join(' · ');
  return {matched:true, titre:titre, sous:sous};
}

function dossierDemande(d, pdfOk) {
  let panier = [];
  try { const p = JSON.parse(d.panier || '[]'); if (Array.isArray(p)) panier = p; } catch {}
  /* le formulaire du site envoie { produit, formule, options, quantite, prix: « 130 € » } ; d'anciens formats utilisent name/price/qty */
  const prixNum = (v) => { if (typeof v === 'number') return v; const m = String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/); return /devis/i.test(String(v)) || !m ? 0 : Number(m[0]); };
  let ecrase = {}; try { ecrase = JSON.parse(d.prixLignes || '{}') || {}; } catch {}
  const lignes = panier.filter((p) => p && (p.produit || p.name || p.nom)).slice(0, 40).map((p) => {
    const nom = p.produit || p.name || p.nom;
    const formule = String(p.formule || p.variant || '').trim();
    const opts = Array.isArray(p.options) ? p.options.filter(Boolean).join(', ') : String(p.options || '').trim();
    const aff = affichageTitre(String(nom), /^(standard|option)$/i.test(formule) ? '' : formule);
    const detail = aff.matched ? [aff.sous, opts].filter(Boolean).join(' · ') : [/^(standard|option)$/i.test(formule) ? '' : formule, opts].filter(Boolean).join(' · ');
    const cle = nom + '|' + formule;
    const prix = ecrase[cle] !== undefined && ecrase[cle] !== '' ? Number(ecrase[cle]) : prixNum(p.prix !== undefined ? p.prix : p.price);
    return { nom: texte(aff.matched ? aff.titre : nom, 120), detail: texte(detail, 160), qte: Number(p.quantite || p.qty || p.qte) || 1, prix: nombre(prix) };
  });
  const liv = d.livraisonPrix != null ? nombre(d.livraisonPrix) : 0;
  const mon = d.montagePrix != null ? nombre(d.montagePrix) : 0;
  const total = nombre(lignes.reduce((t, l) => t + l.prix * 1, 0) + liv + mon);
  const val = d.statut === 'validee';
  return {
    id: 'd:' + d.id, kind: 'demande', ref: String(d.id),
    statut: val ? 'Validée' : (d.statut === 'en-cours' ? 'En cours d’étude' : 'Demande reçue'),
    dateDebut: texte(d.date, 10), dateFin: texte(d.dateFin, 10),
    lieu: texte(d.adresse, 200), convives: texte(d.convives, 20), typeEvenement: texte(d.type, 60),
    lignes, supplements: [], livraison: /^oui/i.test(String(d.livraison || '')), livraisonPrix: liv, livraisonRetour: d.livraisonRetour !== false, montage: mon,
    total, acompteDemande: Number(d.devisAcompte) > 0, acompte: nombre(d.devisAcompte), virementRecu: false,
    documents: { devis: !!pdfOk || devisAutoPossible(d, lignes), facture: false },
  };
}

/* Devis d'une demande : disponible dès que la livraison est chiffrée, ou tout de suite s'il n'y en a pas. */
const maintenantMs = () => Date.now();
async function lirePagesProduits() {
  for (const chemin of ['netlify/functions/_produits-pages.json', join(process.cwd(), 'netlify/functions/_produits-pages.json'), new URL('./_produits-pages.json', import.meta.url)]) {
    try { return JSON.parse(await readFile(chemin, 'utf8')); } catch { /* suivant */ }
  }
  return {};
}


/* Une option s'écrit court sur les documents comme dans le back-office : « Cabine », « Néon »… */
function nomCourtOption(x) {
  x = String(x || '').replace(/^\s*\+\s*/, '').replace(/^option\s*:?\s*/i, '');
  x = x.replace(/\(\s*\+?\s*\d+[.,]?\d*\s*\u20ac\s*\)|\+?\s*\d+[.,]?\d*\s*\u20ac/g, '').replace(/\s*\(sur devis\)/i, '').replace(/\s*\([^)]*\)/g, '');
  x = x.replace(/\bt[ée]l[ée]phonique\b/ig, '').replace(/\blumineu[xs]e?\b/ig, '').replace(/\s{2,}/g, ' ').trim();
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
}

function devisAutoPossible(d, lignes) {
  if (!lignes || !lignes.length) return false;
  if (d.statut === 'validee') return false;
  /* prestation sur devis (serveuse, chef pâtissier…) ou ligne sans prix : pas de devis automatique tant que Thomas n'a pas saisi le prix */
  if (lignes.some((l) => !(Number(l.prix) > 0))) return false;
  if (String(d.parrainage || '').trim() || d.offreMariage === true) return false;      /* remises : le devis du back-office fait foi */
  const liv = /^oui/i.test(String(d.livraison || ''));
  /* montage / démontage / installation demandés : le devis attend aussi leur prix */
  const mont = /montage|installation|lancement/i.test(String(d.panier || '')) || (Array.isArray(d.montageAjoute) && d.montageAjoute.length > 0);
  if (mont && d.montagePrix == null) return false;
  return liv ? d.livraisonPrix != null : true;
}
function envoiDevisDemande(d, lignes, fact) {
  const liv = d.livraisonPrix != null ? nombre(d.livraisonPrix) : 0, mon = d.montagePrix != null ? nombre(d.montagePrix) : 0;
  const retour = d.livraisonRetour !== false;
  const l = lignes.map((x) => ({ intitule: (/^(serveuse|p[âa]tissier|chef p[âa]tissier)|—\s*sur devis\s*$/i.test(String(x.nom || '')) ? String(x.nom).replace(/\s*—\s*sur devis\s*$/i, '') : 'Location — ' + x.nom), detail: x.detail || '', quantite: x.qte || 1, montantTTC: x.prix }));
  /* un montant à 0 € saisi exprès (livraison offerte) figure sur le devis ; un champ vide, non */
  if (d.livraisonPrix != null) l.push({ intitule: retour ? 'Livraison et reprise du matériel' : 'Livraison du matériel', detail: '', quantite: 1, montantTTC: liv });
  if (d.montagePrix != null) l.push({ intitule: 'Montage et démontage sur place', detail: '', quantite: 1, montantTTC: mon });
  const total = l.reduce((t, x) => t + x.montantTTC, 0);
  let adr = String(d.devisAdresse || d.adresse || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const aF = fact && fact.adresse && fact.adresse.length ? fact : null;
  if (aF && !String(d.devisAdresse || '').trim()) adr = aF.adresse;      /* adresse de facturation du compte, sauf si Thomas en a saisi une */
  return { ref: d.id, pro: d.devisPro === true || (!!aF && aF.pro && d.devisPro !== false), acompte: d.devisAvecAcompte ? Math.round(total * 30) / 100 : 0, dateEvenement: d.date || '', dateFinEvenement: d.dateFin || d.datefin || '',
    client: { nom: (d.clientType === 'Entreprise ou association' && String(d.societe || '').trim()) || d.nom || 'Client', adresse: adr, tel: d.telephone || '', email: d.email || '', siret: d.devisSiret || (aF && aF.siret) || '', tvaClient: d.devisTva || (aF && aF.tva) || '' }, lignes: l };
}

async function dossiersDuClient(compte, requete, secret, gestionnaire) {
  const email = emailCle(compte.email);
  const store = await blobStore(DATA_STORE);
  const vus = new Set();
  const out = [];
  let listeDem = [];
  try {
    const cookie0 = `${COOKIE_NAME}=${encodeURIComponent(makeSessionToken(secret))}`;
    const rep0 = await gestionnaire(new Request(new URL('/api/admin/demandes', requete.url), { headers: { cookie: cookie0 } }));
    listeDem = rep0.ok ? await rep0.json() : [];
  } catch {}
  try {
    const { subs } = await blobItems('reservations');
    for (const s of subs || []) {
      let r = s.data && typeof s.data.d === 'string' ? JSON.parse(s.data.d) : s.data;
      if (!r || emailCle(r.email) !== email) continue;
      let logi = null; try { logi = await store.get(blobKey('logistique', s.id), { type: 'json', consistency: 'strong' }); } catch {}
      const dr = await dossierResa(s.id, r, logi); vus.add(String(s.id));
      /* complète avec la demande d'origine si la réservation du planning n'a pas ces infos */
      const dem = listeDem.find((d) => d && (String(d.resaId || '') === String(s.id) || String(d.id) === String(r.demandeId || '')));
      if (dem) {
        if (!dr.convives) dr.convives = texte(dem.convives, 20);
        if (!dr.typeEvenement) dr.typeEvenement = texte(dem.type, 60);
        if (!dr.lieu) dr.lieu = texte(dem.adresse, 200);
      }
      out.push(dr);
    }
  } catch (e) { console.error('Espace client — réservations :', e.message); }
  try {
    const liste = listeDem;
    for (const d of liste) {
      if (emailCle(d.email) !== email) continue;
      /* le planning fait foi : une demande validée (ou liée à une réservation du planning) ne s'affiche jamais en plus */
      if (d.resaId || d.statut === 'validee') continue;
      let pdfOk = false; try { pdfOk = !!(await store.get('demande-devis/' + encodeURIComponent(String(d.id)), { type: 'json' })); } catch {}
      out.push(dossierDemande(d, pdfOk));
    }
  } catch (e) { console.error('Espace client — demandes :', e.message); }
  /* demandes toutes fraîches, pas encore listées par Netlify Forms */
  try {
    const connues = new Set(listeDem.map((d) => String(d.refEspace || '')).filter(Boolean));
    for (const r of await lireRecentes(email)) {
      if (connues.has(r.rid)) continue;
      const brut = brutRecent(email, r);
      const dd = dossierDemande(brut, false);
      /* le devis est téléchargeable aussitôt, sauf s'il attend un prix (livraison, montage, installation) */
      dd.documents = { devis: devisAutoPossible(brut, dd.lignes), facture: false };
      out.push(dd);
    }
  } catch (e) { console.error('Espace client — demandes récentes :', e.message); }
  out.sort((a, b) => String(b.dateDebut).localeCompare(String(a.dateDebut)));
  return out;
}

async function demandesModif(email) {
  const store = await blobStore(AUTH_STORE);
  const { blobs } = await store.list({ prefix: 'espace/modif/' });
  const res = [];
  for (const b of blobs) {
    const m = await store.get(b.key, { type: 'json', consistency: 'strong' }).catch(() => null);
    if (m && (!email || emailCle(m.email) === email)) res.push(m);
  }
  return res.sort((a, b) => String(b.cree).localeCompare(String(a.cree)));
}

async function envoyerCode(c, secret) {
  const email = emailCle(c.email);
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  c.codeHash = sign('code.' + email + '.' + code, secret); c.codeExp = Date.now() + 10 * 60 * 1000; c.codeEssais = 0; c.codeEnvoye = Date.now();
  await ecrireCompte(c);
  const cle = process.env.RESEND_API_KEY;
  if (!cle) { console.error('RESEND_API_KEY absente — code non envoyé'); c.mailEtat = { ok: false, t: Date.now(), err: 'Clé Resend absente (RESEND_API_KEY)' }; await ecrireCompte(c); return; }
  const html = `<div style="background:#f4f5f7;padding:24px;font-family:Inter,Arial,sans-serif"><div style="max-width:440px;margin:auto;background:#fff;border:1px solid #e3e5ea;border-radius:12px;padding:28px;color:#2b303b"><h1 style="font-size:20px;margin:0 0 16px">Votre code de connexion</h1><p style="font-size:14px;line-height:1.6;margin:0 0 18px">Bonjour,<br>Voici le code pour accéder à votre espace client Vespra Event.</p><div style="font-size:32px;font-weight:700;letter-spacing:.3em;text-align:center;background:#f6f7f9;border:1px solid #e3e5ea;border-radius:10px;padding:18px 0;margin:0 0 18px">${code}</div><p style="font-size:12px;color:#646D7C;line-height:1.6;margin:0">Il est valable 10 minutes. Si vous n'avez pas demandé ce code, ignorez ce message : personne ne peut se connecter sans lui.</p><p style="margin:18px 0 0;text-align:center"><a href="mailto:contact@vespraevent.com?subject=Ma%20r%C3%A9servation%20Vespra%20Event" style="display:inline-block;padding:9px 18px;border:1px solid #2b4a6b;border-radius:99px;color:#2b4a6b;text-decoration:none;font-size:13px">Répondre à Vespra Event</a></p></div></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>', reply_to: process.env.NOTIFY_REPLY_TO || 'vespraevent@gmail.com', to: [c.email],
        subject: 'Votre code de connexion Vespra Event', html }) });
    if (!r.ok) { const txt = await r.text(); console.error('Resend a refusé le code :', r.status, txt); c.mailEtat = { ok: false, t: Date.now(), err: r.status + ' ' + String(txt).slice(0, 220) }; }
    else c.mailEtat = { ok: true, t: Date.now(), err: '' };
    await ecrireCompte(c);
  } catch (e) { console.error('Envoi du code impossible :', e.message); c.mailEtat = { ok: false, t: Date.now(), err: String(e.message).slice(0, 200) }; try { await ecrireCompte(c); } catch {} }
}

async function envoyerMailCode(email, code, intro, validite) {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) return false;
  const html = `<div style="background:#f4f5f7;padding:24px;font-family:Inter,Arial,sans-serif"><div style="max-width:440px;margin:auto;background:#fff;border:1px solid #e3e5ea;border-radius:12px;padding:28px;color:#2b303b"><h1 style="font-size:20px;margin:0 0 16px">Votre accès à l'espace client</h1><p style="font-size:14px;line-height:1.6;margin:0 0 18px">Bonjour,<br>${intro}</p><div style="font-size:32px;font-weight:700;letter-spacing:.3em;text-align:center;background:#f6f7f9;border:1px solid #e3e5ea;border-radius:10px;padding:18px 0;margin:0 0 18px">${code}</div><p style="font-size:14px;line-height:1.6;margin:0 0 12px">Rendez-vous sur <a href="https://www.vespraevent.fr/espace-client" style="color:#2b4a6b">vespraevent.fr/espace-client</a>, cliquez sur « J'ai déjà un code », puis saisissez votre adresse e-mail et ce code.</p><p style="font-size:12px;color:#646D7C;line-height:1.6;margin:0">${validite}</p><p style="margin:18px 0 0;text-align:center"><a href="mailto:contact@vespraevent.com?subject=Ma%20r%C3%A9servation%20Vespra%20Event" style="display:inline-block;padding:9px 18px;border:1px solid #2b4a6b;border-radius:99px;color:#2b4a6b;text-decoration:none;font-size:13px">Répondre à Vespra Event</a></p></div></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>', reply_to: process.env.NOTIFY_REPLY_TO || 'vespraevent@gmail.com', to: [email],
        subject: 'Votre accès à l’espace client Vespra Event', html }) });
    if (!r.ok) console.error('Resend a refusé le code :', r.status, await r.text());
    return r.ok;
  } catch (e) { console.error('Envoi du code impossible :', e.message); return false; }
}

/* Inscription par le client : il doit saisir les mêmes e-mail et téléphone
   que sur sa réservation ou sa demande. La réponse ne dit jamais si une
   correspondance existe (pas de moyen de deviner qui est client). */
const chiffres = (t) => String(t || '').replace(/\D/g, '').slice(-9);
async function trouverIdentite(email, tel, requete, secret, gestionnaire) {
  const t = chiffres(tel);
  /* sans téléphone : l'adresse e-mail suffit, puisque le code part à cette adresse */
  const sansTel = !String(tel || '').trim();
  if (!sansTel && t.length < 9) return null;
  try {
    const { subs } = await blobItems('reservations');
    for (const s of subs || []) {
      const r = s.data && typeof s.data.d === 'string' ? JSON.parse(s.data.d) : s.data;
      if (r && emailCle(r.email) === email && (sansTel || chiffres(r.phone) === t)) return r.client || '';
    }
  } catch {}
  try {
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(makeSessionToken(secret))}`;
    const rep = await gestionnaire(new Request(new URL('/api/admin/demandes', requete.url), { headers: { cookie } }));
    for (const d of (rep.ok ? await rep.json() : [])) if (emailCle(d.email) === email && (sansTel || chiffres(d.telephone) === t)) return d.nom || '';
  } catch {}
  /* demande toute fraîche, pas encore listée par Netlify Forms */
  if (sansTel) { try { const r = (await lireRecentes(email))[0]; if (r) return r.nom || ''; } catch {} }
  return null;
}

/* nom actuel du client : pris sur ses fiches actuelles (la plus récente), jamais sur un ancien nom figé dans le compte */
async function nomActuel(email, requete, secret, gestionnaire) {
  let best = null;
  try {
    const { subs } = await blobItems('reservations');
    for (const s of subs || []) {
      const r = s.data && typeof s.data.d === 'string' ? JSON.parse(s.data.d) : s.data;
      if (!r || emailCle(r.email) !== email || !String(r.client || '').trim()) continue;
      const k = String(r.dateStart || '');
      if (!best || k > best.k) best = { k, nom: String(r.client).trim(), src: 'réservation ' + (r.dateStart || '') + ' (n°' + s.id + ')' };
    }
  } catch {}
  if (best) return best; /* le planning fait foi : une réservation prime toujours sur une demande */
  try {
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(makeSessionToken(secret))}`;
    const rep = await gestionnaire(new Request(new URL('/api/admin/demandes', requete.url), { headers: { cookie } }));
    for (const d of (rep.ok ? await rep.json() : [])) {
      if (emailCle(d.email) !== email || !String(d.nom || '').trim()) continue;
      if (d.resaId || d.statut === 'validee') continue; /* demande déjà transformée en réservation : ignorée */
      const k = String(d.cree || d.id || '');
      if (!best || k > best.k) best = { k, nom: String(d.nom).trim(), src: 'demande ' + (d.dateDebut || d.date || '') + ' (n°' + d.id + ')' };
    }
  } catch {}
  return best || null;
}

/* adresse de facturation d'un client (facultative) : champ par champ, longueurs bornées */
function factureCompte(c) {
  const f = (c && c.facturation) || {};
  return { societe: texte(f.societe, 100), adresse: texte(f.adresse, 160), cp: texte(f.cp, 10), ville: texte(f.ville, 80), siret: texte(f.siret, 20), tva: texte(f.tva, 20) };
}
function adresseFacture(c) {
  const f = factureCompte(c);
  const l = [f.societe, f.adresse, [f.cp, f.ville].filter(Boolean).join(' ')].filter(Boolean);
  return { adresse: l, siret: f.siret, tva: f.tva, pro: !!f.societe };
}
const motsNom = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
const memeNom = (a, b) => { const x = motsNom(a).sort().join(' '), y = motsNom(b).sort().join(' '); return !!x && x === y; };

/* Demandes envoyées par un client connecté : conservées tout de suite côté serveur, pour apparaître
   dans son espace sans attendre que Netlify Forms les ait listées. Elles disparaissent d'elles-mêmes
   dès que la vraie demande est là (repérée par son identifiant « ref_espace »). */
const cleRecentes = (e) => 'espace/recentes/' + encodeURIComponent(emailCle(e));
async function lireRecentes(email) {
  try {
    const l = await (await blobStore(AUTH_STORE)).get(cleRecentes(email), { type: 'json', consistency: 'strong' });
    return (Array.isArray(l) ? l : []).filter((x) => x && Date.now() - new Date(x.cree).getTime() < 24 * 3600 * 1000);
  } catch { return []; }
}

function brutRecent(email, r) {
  return { id: 'e' + r.rid, statut: 'nouvelle', email, nom: r.nom, date: r.date, convives: r.convives, type: r.type, livraison: r.livraison,
    adresse: r.adresse, panier: r.panier, message: r.message, recue: r.cree };
}

async function espace(request, url, secret, gestionnaire) {
  const path = url.pathname.replace(/^\/api\/espace/, '').replace(/\/$/, '') || '/';
  const cookieOut = (v, age) => `${CLIENT_COOKIE}=${encodeURIComponent(v)}; Path=/; HttpOnly; Secure; SameSite=Strict${age == null ? '' : '; Max-Age=' + age}`;
  /* protection contre les requêtes venues d'un autre site : toute écriture doit venir de ce site */
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const o = request.headers.get('origin');
    if (o) { let ok = false; try { ok = new URL(o).host === url.host; } catch {} if (!ok) return json({ error: 'Requête refusée' }, 403); }
  }
  if (!secret) return json({ error: 'Espace client indisponible' }, 503);

  /* devis automatique joint à l'accusé de réception (appel signé de accuse-background, jamais public) */
  if (path === '/accuse-devis' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
    const email = emailCle(b.email);
    const sig = request.headers.get('x-accuse') || '';
    const attendue = sign('accuse.' + email, secret);
    if (!emailValide(email) || sig.length !== attendue.length || !safeEqual(sig, attendue)) return json({ ok: false }, 403);
    try {
      const cookieA = `${COOKIE_NAME}=${encodeURIComponent(makeSessionToken(secret))}`;
      const rep0 = await gestionnaire(new Request(new URL('/api/admin/demandes', request.url), { headers: { cookie: cookieA } }));
      const liste = (rep0.ok ? await rep0.json() : []).filter((x) => emailCle(x.email) === email && !x.resaId && x.statut !== 'validee');
      liste.sort((x, y) => String(y.recue || '').localeCompare(String(x.recue || '')));
      const brut = liste[0];
      if (!brut || Date.now() - new Date(brut.recue || 0).getTime() > 3 * 3600 * 1000) return json({ ok: false });
      const dd = dossierDemande(brut, false);
      if (!devisAutoPossible(brut, dd.lignes)) return json({ ok: false });
      const rep = await gestionnaire(new Request(new URL('/api/admin/devis', request.url), { method: 'POST',
        headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify(envoiDevisDemande(brut, dd.lignes, adresseFacture(await lireCompte(email)))) }));
      if (!rep.ok) return json({ ok: false });
      const g = await (await blobStore(DATA_STORE)).get('demande-devis/' + encodeURIComponent(String(brut.id)), { type: 'json' }).catch(() => null);
      if (g && g.b64) return json({ ok: true, nom: g.nom || 'devis.pdf', b64: g.b64 });
      return json({ ok: true, nom: 'Devis-Vespra-Event.pdf', b64: Buffer.from(await rep.arrayBuffer()).toString('base64') });
    } catch (e) { console.error('Devis automatique :', e.message); return json({ ok: false }); }
  }

  /* Relances automatiques : appel quotidien signé de relances.mjs (jamais public).
     Une seule relance par demande, avec le devis joint quand il est chiffrable. */
  if (path === '/relances-run' && request.method === 'POST') {
    const sig = request.headers.get('x-accuse') || '';
    const attendue = sign('relances', secret);
    if (sig.length !== attendue.length || !safeEqual(sig, attendue)) return json({ ok: false }, 403);
    const cleApi = process.env.RESEND_API_KEY;
    try {
      const st = await blobStore(DATA_STORE);
      const reglage = await repAuto.lireReglage(st);
      if (!reglage.relance.actif) return json({ ok: true, envoyes: 0, raison: 'désactivée' });
      if (!cleApi) return json({ ok: false, raison: 'RESEND_API_KEY absente' });
      const cookieA = `${COOKIE_NAME}=${encodeURIComponent(makeSessionToken(secret))}`;
      const rep0 = await gestionnaire(new Request(new URL('/api/admin/demandes', request.url), { headers: { cookie: cookieA } }));
      const toutes = rep0.ok ? await rep0.json() : [];
      const delai = reglage.relance.jours * 86400000, maintenant = Date.now();
      const site = (process.env.URL || 'https://www.vespraevent.fr').replace(/\/$/, '');
      const aRelancer = toutes.filter((x) => x && !x.resaId && !x.planning && x.statut !== 'validee' && emailValide(x.email)
        && maintenant - new Date(x.recue || 0).getTime() >= delai && maintenant - new Date(x.recue || 0).getTime() < 45 * 86400000)
        .sort((x, y) => String(x.recue).localeCompare(String(y.recue))).slice(0, 25);
      let envoyes = 0; const ignores = [];
      for (const brut of aRelancer) {
        const cle = 'relance/' + encodeURIComponent(String(brut.id));
        let deja = null; try { deja = await st.get(cle, { type: 'json', consistency: 'strong' }); } catch {}
        if (deja) continue;
        const email = emailCle(brut.email);
        /* marqueur posé AVANT l'envoi : jamais deux relances, même si l'envoi échoue puis se relance */
        await st.setJSON(cle, { t: maintenant, email });
        let pj = null;
        try {
          const dd = dossierDemande(brut, false);
          if (devisAutoPossible(brut, dd.lignes)) {
            const rep = await gestionnaire(new Request(new URL('/api/admin/devis', request.url), { method: 'POST',
              headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify(envoiDevisDemande(brut, dd.lignes, adresseFacture(await lireCompte(email)))) }));
            if (rep.ok) {
              const g = await st.get('demande-devis/' + encodeURIComponent(String(brut.id)), { type: 'json' }).catch(() => null);
              pj = { filename: (g && g.nom) || 'Devis-Vespra-Event.pdf', content: (g && g.b64) || Buffer.from(await rep.arrayBuffer()).toString('base64') };
            }
          }
        } catch (e) { console.error('Relance : devis indisponible', e.message); }
        const txt = pj ? reglage.relance.avec : reglage.relance.sans;
        const html = htmlRelance({ txt, site, emetteur: EMETTEUR });
        try {
          const r = await fetch('https://api.resend.com/emails', { method: 'POST',
            headers: { Authorization: `Bearer ${cleApi}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
              reply_to: process.env.NOTIFY_REPLY_TO || 'vespraevent@gmail.com', to: [email], subject: txt.objet, html, ...(pj ? { attachments: [pj] } : {}) }) });
          if (r.ok) { envoyes++; await st.setJSON(cle, { t: maintenant, email, envoye: Date.now(), devis: !!pj }); }
          else { console.error('Resend a refusé la relance :', r.status); ignores.push(String(brut.id)); }
        } catch (e) { console.error('Relance impossible :', e.message); ignores.push(String(brut.id)); }
      }
      return json({ ok: true, envoyes, candidates: aRelancer.length, ignores });
    } catch (e) { console.error('Relances :', e.message); return json({ ok: false, error: e.message }, 500); }
  }

  /* Demandes d'avis après la location : appel quotidien signé de demandes-avis.mjs (jamais public). */
  if (path === '/avis-run' && request.method === 'POST') {
    const sig = request.headers.get('x-accuse') || '';
    const attendue = sign('avis-demandes', secret);
    if (sig.length !== attendue.length || !safeEqual(sig, attendue)) return json({ ok: false }, 403);
    const cleApi = process.env.RESEND_API_KEY;
    try {
      const st = await blobStore(DATA_STORE);
      const reglage = await repAuto.lireReglage(st);
      if (!reglage.avis.actif) return json({ ok: true, envoyes: 0, raison: 'désactivée' });
      if (!cleApi) return json({ ok: false, raison: 'RESEND_API_KEY absente' });
      const cookieA = `${COOKIE_NAME}=${encodeURIComponent(makeSessionToken(secret))}`;
      const rep0 = await gestionnaire(new Request(new URL('/api/admin/data?collection=reservations', request.url), { headers: { cookie: cookieA } }));
      const items = rep0.ok ? await rep0.json() : [];
      const site = (process.env.URL || 'https://www.vespraevent.fr').replace(/\/$/, '');
      const pages = await lirePagesProduits();
      const auj = new Date(Date.now() + 3600000).toISOString().slice(0, 10);   /* date de Paris, à une heure près */
      const jour = (n) => new Date(Date.parse(auj) - n * 86400000).toISOString().slice(0, 10);
      const limiteHaute = jour(reglage.avis.jours), limiteBasse = jour(30);
      const lues = [];
      for (const it of items) { try { const r = JSON.parse(it.d || '{}'); if (r && r.id !== undefined) lues.push(r); } catch {} }
      const aSolliciter = lues.filter((r) => emailValide(r.email) && !r.annulee && !r.cancelled
        && (r.dateEnd || r.dateStart) && (r.dateEnd || r.dateStart) <= limiteHaute && (r.dateEnd || r.dateStart) >= limiteBasse)
        .sort((x, y) => String(x.dateEnd || x.dateStart).localeCompare(String(y.dateEnd || y.dateStart))).slice(0, 25);
      /* un seul mail par client : ses locations de la période sont regroupées */
      const parClient = new Map();
      for (const r of aSolliciter) { const e = emailCle(r.email); if (!parClient.has(e)) parClient.set(e, []); parClient.get(e).push(r); }
      let envoyes = 0; const ignores = [];
      for (const [email, resas] of parClient) {
        const cles = resas.map((r) => 'avis-demande/' + encodeURIComponent(String(r.id))), cleE = 'avis-demande-mail/' + encodeURIComponent(email);
        let deja = false, dejaMail = null;
        try {
          for (const c of cles) if (await st.get(c, { type: 'json', consistency: 'strong' })) deja = true;
          dejaMail = await st.get(cleE, { type: 'json', consistency: 'strong' });
        } catch {}
        if (deja || (dejaMail && maintenantMs() - Number(dejaMail.t || 0) < 90 * 86400000)) continue;
        for (const c of cles) await st.setJSON(c, { t: maintenantMs(), email });     /* marqueurs avant l'envoi : jamais deux demandes */
        await st.setJSON(cleE, { t: maintenantMs() });
        const vus = new Set(), produits = [];
        for (const r of resas) for (const p of (r.products || [])) {
          const f = pageProduit(p && (p.name || p.nom), pages);
          if (f && !vus.has(f)) { vus.add(f); produits.push({ nom: pages[f].replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()), url: site + '/' + f + '#avis' }); }
        }
        const html = htmlAvis({ txt: reglage.avis, lienGoogle: reglage.avis.lienGoogle, produits: produits.slice(0, 4), emetteur: EMETTEUR, site });
        try {
          const rr = await fetch('https://api.resend.com/emails', { method: 'POST',
            headers: { Authorization: `Bearer ${cleApi}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
              reply_to: process.env.NOTIFY_REPLY_TO || 'vespraevent@gmail.com', to: [email], subject: reglage.avis.objet, html }) });
          if (rr.ok) { envoyes++; for (const c of cles) await st.setJSON(c, { t: maintenantMs(), email, envoye: maintenantMs() }); }
          else { console.error('Resend a refusé la demande d’avis :', rr.status); ignores.push(email); }
        } catch (e) { console.error('Demande d’avis impossible :', e.message); ignores.push(email); }
      }
      return json({ ok: true, envoyes, candidates: aSolliciter.length, ignores });
    } catch (e) { console.error('Demandes d’avis :', e.message); return json({ ok: false, error: e.message }, 500); }
  }

  /* Copie immédiate d'une demande de devis (connecté ou non) : visible dans l'espace dès que le client s'y connecte.
     Sans connexion, rien n'est montré à personne d'autre : seule la personne qui prouve son adresse e-mail (code ou mot de passe) la voit. */
  if (path === '/demande-recue' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const rid = String(b.rid || '');
    if (!/^[a-z0-9]{8,40}$/.test(rid)) return json({ error: 'Requête invalide' }, 400);
    const connecte = await clientConnecte(request, secret);
    const email = connecte ? emailCle(connecte.email) : emailCle(b.email);
    if (!emailValide(email)) return json({ ok: false }, 400);
    if (tropEssais(request, 5, 60 * 60 * 1000, connecte ? 'clirecue' : 'clirecuepub')) return json({ error: 'Trop de demandes.' }, 429);
    const c = (k, n) => String(b[k] == null ? '' : b[k]).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
    let liste = (await lireRecentes(email)).filter((x) => x.rid !== rid);
    liste.push({ rid, anonyme: !connecte, cree: new Date().toISOString(), nom: c('nom', 100), date: c('date', 20), convives: c('convives', 20), type: c('type', 80),
      livraison: c('livraison', 10), adresse: c('adresse', 200), panier: c('panier', 8000), message: c('message', 600) });
    try { await (await blobStore(AUTH_STORE)).setJSON(cleRecentes(email), liste.slice(-40)); } catch (e) { console.error('Demande récente :', e.message); return json({ ok: false }, 500); }
    return json({ ok: true });
  }

  if (path === '/inscription' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const email = emailCle(b.email);
    const reponse = json({ ok: true });
    if (!emailValide(email)) return json({ error: 'Adresse e-mail invalide' }, 400);
    if (tropEssais(request, 6, 15 * 60 * 1000, 'cliinsc') || await limiteBlobs(request, 'insc-client', 6, 15 * 60 * 1000)) return json({ error: 'Trop de demandes. Réessayez dans 15 minutes.' }, 429);
    let c = await lireCompte(email);
    if (c && c.actif === false) return reponse;
    if (!c) {
      const nom = await trouverIdentite(email, b.telephone, request, secret, gestionnaire);
      if (nom === null) { await new Promise((r) => setTimeout(r, 400)); return reponse; }
      c = { email, nom: texte(nom, 80), passwordRecord: null, actif: true, v: 1, cree: new Date().toISOString() };
      await ecrireCompte(c);
    }
    if (!(c.codeEnvoye && Date.now() - c.codeEnvoye < 60 * 1000)) await envoyerCode(c, secret);
    return reponse;
  }

  /* Connexion par code reçu par e-mail (6 chiffres, valable 10 minutes, 5 essais).
     La réponse est identique que le compte existe ou non. */
  if (path === '/code' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const email = emailCle(b.email);
    const reponse = json({ ok: true });
    if (!emailValide(email)) return reponse;
    if (tropEssais(request, 6, 15 * 60 * 1000, 'clicode') || await limiteBlobs(request, 'code-client', 6, 15 * 60 * 1000)) return json({ error: 'Trop de demandes. Réessayez dans 15 minutes.' }, 429);
    const c = await lireCompte(email);
    if (!c || c.actif === false) { await new Promise((r) => setTimeout(r, 400)); return reponse; }
    if (c.codeEnvoye && Date.now() - c.codeEnvoye < 60 * 1000) return reponse;
    await envoyerCode(c, secret);
    return reponse;
  }

  if (path === '/login' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const ip = (request.headers.get('x-nf-client-connection-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0] || 'inconnu').trim();
    const mem = (_essais.get('cli|' + ip) || []).filter((t) => Date.now() - t < ESPACE_VERROU_MS);
    if (mem.length >= 20 || await limiteBlobs(request, 'login-client', 20, 15 * 60 * 1000)) return json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, 429);
    const email = emailCle(b.email), mdp = String(b.password || ''), codeSaisi = String(b.code || '').replace(/\s+/g, '');
    const c = email ? await lireCompte(email) : null;
    const verrou = c && c.verrouJusqua && Date.now() < c.verrouJusqua;
    let ok = false;
    if (codeSaisi) {
      const actif = c && c.actif !== false && !verrou;
      const empreinte = sign('code.' + email + '.' + codeSaisi, secret);
      /* code envoyé par e-mail : 10 minutes, à usage unique */
      if (actif && c.codeHash && Date.now() < (c.codeExp || 0) && (c.codeEssais || 0) < 5) {
        ok = safeEqual(empreinte, c.codeHash);
        if (ok) { c.codeHash = ''; c.codeExp = 0; } else c.codeEssais = (c.codeEssais || 0) + 1;
      }
      /* code remis à la main par Thomas : sert de mot de passe, 7 jours */
      if (!ok && actif && c.codeManuel && Date.now() < (c.codeManuel.exp || 0)) ok = safeEqual(empreinte, c.codeManuel.hash);
      if (!ok && actif) {
        c.echecs = (c.echecs || 0) + 1;
        if (c.echecs >= ESPACE_VERROU_ESSAIS) { c.verrouJusqua = Date.now() + ESPACE_VERROU_MS; c.echecs = 0; }
        await ecrireCompte(c).catch(() => {});
      }
    } else {
      ok = !!(c && c.actif !== false && !verrou && c.passwordRecord && verifyAdminPassword(mdp, c.passwordRecord));
    }
    if ((!c || verrou) && !codeSaisi) verifyAdminPassword(mdp, MDP_LEURRE);   /* même durée dans tous les cas */
    if (!ok) {
      tropEssais(request, 20, ESPACE_VERROU_MS, 'cli');
      if (c && !verrou && !codeSaisi) {
        c.echecs = (c.echecs || 0) + 1;
        if (c.echecs >= ESPACE_VERROU_ESSAIS) { c.verrouJusqua = Date.now() + ESPACE_VERROU_MS; c.echecs = 0; }
        await ecrireCompte(c).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 700));
      return json({ error: verrou ? 'Compte temporairement bloqué après trop d’essais. Réessayez dans 15 minutes.' : 'Adresse e-mail, mot de passe ou code incorrect' }, verrou ? 429 : 401);
    }
    const rester = b.rester === true;
    c.echecs = 0; c.verrouJusqua = 0; c.dernierAcces = new Date().toISOString(); c.rester = rester;
    await ecrireCompte(c).catch(() => {});
    return json({ ok: true }, 200, { 'set-cookie': rester
      ? cookieOut(jetonClient(c, secret, CLIENT_RESTER_H), CLIENT_RESTER_H * 3600)
      : cookieOut(jetonClient(c, secret, CLIENT_COURTE_H), null) });
  }
  if (path === '/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': cookieOut('', 0) });

  /* état de connexion pour le reste du site (en-tête, formulaire de devis) : jamais d'erreur 401 */
  if (path === '/session' && request.method === 'GET') {
    const c = await clientConnecte(request, secret);
    const r = c ? { connecte: true, nom: texte(c.nom, 80), email: c.email, telephone: texte(c.telephone, 30), facturation: factureCompte(c) } : { connecte: false };
    return json(r, 200, { 'cache-control': 'private, no-store' });
  }

  const compte = await clientConnecte(request, secret);
  if (!compte) return json({ error: 'Connexion requise' }, 401);

  if (path === '/me' && request.method === 'GET') {
    if (!compte.nomManuel) {
      const nn = await nomActuel(emailCle(compte.email), request, secret, gestionnaire);
      if (nn && (nn.nom !== compte.nom || nn.src !== compte.nomSource)) { compte.nom = texte(nn.nom, 80); compte.nomSource = nn.src; try { await ecrireCompte(compte); } catch {} }
    }
    const [dossiers, modifs, ent] = await Promise.all([
      dossiersDuClient(compte, request, secret, gestionnaire),
      demandesModif(emailCle(compte.email)),
      lireEntreprise().catch(() => null),
    ]);
    const b = ent && ent.emetteur && ent.emetteur.banque || {};
    return json({
      compte: { nom: texte(compte.nom, 80), email: compte.email, motDePasse: !!compte.passwordRecord,
        telephone: texte(compte.telephone, 30), facturation: factureCompte(compte), avisDonnes: (compte.avis || []).slice(-100) },
      dossiers,
      modifications: modifs.slice(0, 100).map((m) => ({ id: m.id, dossier: m.dossier, type: m.type || '', message: m.message, etat: m.etat, reponse: m.reponse || '', cree: m.cree, montant: m.etat === 'acceptee' && m.type ? nombre(m.montant) : 0 })),
      paiement: { titulaire: texte(b.titulaire, 80), iban: texte(b.iban, 60), bic: texte(b.bic, 20), ordreCheque: 'Vespra Event' },
    });
  }

  if (path === '/modification' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const type = ['livraison', 'reprise'].includes(b.type) ? b.type : '';
    const adresse = String(b.adresse || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    let message = String(b.message || '').trim().slice(0, 1200);
    const dossiers = await dossiersDuClient(compte, request, secret, gestionnaire);
    const d = dossiers.find((x) => x.id === String(b.dossier));
    if (!d) return json({ error: 'Dossier introuvable' }, 404);
    if (type) {
      if (d.kind === 'demande' && /^d:e/.test(d.id)) return json({ error: 'Votre demande vient d’arriver : réessayez dans une minute.' }, 409);
      if (type === 'livraison') {
        if (d.livraison) return json({ error: 'Cette réservation comprend déjà une livraison.' }, 400);
        if (adresse.length < 6) return json({ error: 'Indiquez l’adresse de livraison.' }, 400);
        message = 'Je souhaite ajouter une livraison à l’adresse suivante : ' + adresse + (message ? '\n' + message : '');
      } else {
        if (!d.livraison) return json({ error: 'Ajoutez d’abord une livraison.' }, 400);
        if (d.livraisonRetour) return json({ error: 'La reprise du matériel est déjà comprise.' }, 400);
        message = 'Je souhaite que vous veniez récupérer le matériel après l’événement' + (adresse ? ' à l’adresse suivante : ' + adresse : '') + ' (reprise du matériel).' + (message ? '\n' + message : '');
      }
    } else if (message.length < 5) return json({ error: 'Décrivez la modification souhaitée.' }, 400);
    const mine = await demandesModif(emailCle(compte.email));
    if (type && mine.some((m) => m.etat === 'attente' && m.dossier === d.id && m.type === type)) return json({ error: 'Votre demande est déjà en attente de réponse.' }, 409);
    if (mine.filter((m) => m.etat === 'attente').length >= 10) return json({ error: 'Plusieurs demandes sont déjà en attente de réponse.' }, 429);
    const id = 'm' + Date.now() + randomBytes(3).toString('hex');
    await (await blobStore(AUTH_STORE)).setJSON('espace/modif/' + id, {
      id, email: emailCle(compte.email), nom: texte(compte.nom, 80), dossier: d.id, ref: d.ref, kind: d.kind,
      resume: texte((d.dateDebut || '') + ' · ' + d.lignes.map((l) => l.nom).join(', '), 200),
      message, type, adresse: type === 'livraison' ? adresse : '', etat: 'attente', reponse: '', cree: new Date().toISOString(),
    });
    /* Thomas est prévenu par e-mail (sans bloquer la réponse au client si l'envoi échoue) */
    try {
      const cle = process.env.RESEND_API_KEY;
      if (cle) {
        const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        await fetch('https://api.resend.com/emails', { method: 'POST',
          headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
            to: (process.env.NOTIFY_TO || 'vespraevent@gmail.com').split(',').map((x) => x.trim()),
            reply_to: compte.email,
            subject: `Demande de modification — ${compte.nom || compte.email}`,
            html: `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#2b303b;line-height:1.6"><p><b>${esc(compte.nom || compte.email)}</b> (${esc(compte.email)}) demande une modification depuis son espace client.</p><p style="color:#646D7C">Réservation : ${esc(d.dateDebut || '')} · ${esc(d.lignes.map((l) => l.nom).join(', '))}</p><blockquote style="margin:12px 0;padding:10px 14px;background:#f6f7f9;border-radius:8px">${esc(message).replace(/\n/g, '<br>')}</blockquote><p>À traiter dans le back-office : fiche du client ou de sa réservation.</p></div>` }) });
      }
    } catch (e) { console.error('E-mail de demande de modification impossible :', e.message); }
    return json({ ok: true, id });
  }

  if (path === '/mot-de-passe' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    if (compte.passwordRecord && !verifyAdminPassword(String(b.actuel || ''), compte.passwordRecord)) { await new Promise((r) => setTimeout(r, 700)); return json({ error: 'Mot de passe actuel incorrect' }, 401); }
    const nv = String(b.nouveau || '');
    if (nv.length < 10) return json({ error: 'Le nouveau mot de passe doit faire au moins 10 caractères.' }, 400);
    compte.passwordRecord = hashAdminPassword(nv); compte.v = (compte.v || 1) + 1; compte.codeManuel = null;
    await ecrireCompte(compte);
    return json({ ok: true }, 200, { 'set-cookie': compte.rester
      ? cookieOut(jetonClient(compte, secret, CLIENT_RESTER_H), CLIENT_RESTER_H * 3600)
      : cookieOut(jetonClient(compte, secret, CLIENT_COURTE_H), null) });
  }

  /* Coordonnées et adresse de facturation : enregistrées côté serveur, champ par champ */
  if (path === '/profil' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    if (tropEssais(request, 60, 15 * 60 * 1000, 'cliprofil')) return json({ error: 'Trop de modifications. Réessayez dans quelques minutes.' }, 429);
    const nettoie = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    if (b.nom !== undefined) {
      const nom = nettoie(b.nom, 80);
      if (nom.length < 2) return json({ error: 'Indiquez votre nom.' }, 400);
      if (nom !== compte.nom) { compte.nom = nom; compte.nomManuel = true; compte.nomSource = 'saisi par le client'; }
    }
    if (b.telephone !== undefined) {
      const t = nettoie(b.telephone, 30);
      if (t && !/^[0-9+().\s-]{6,30}$/.test(t)) return json({ error: 'Numéro de téléphone invalide.' }, 400);
      compte.telephone = t;
    }
    if (b.facturation && typeof b.facturation === 'object') {
      const f = b.facturation;
      const cp = nettoie(f.cp, 10);
      if (cp && !/^[0-9A-Za-z -]{3,10}$/.test(cp)) return json({ error: 'Code postal invalide.' }, 400);
      compte.facturation = { societe: nettoie(f.societe, 100), adresse: nettoie(f.adresse, 160), cp, ville: nettoie(f.ville, 80),
        siret: nettoie(f.siret, 20), tva: nettoie(f.tva, 20) };
    }
    compte.modifie = new Date().toISOString();
    try { await ecrireCompte(compte); } catch (e) { console.error('Profil non enregistré :', e.message); return json({ error: 'Enregistrement impossible, réessayez.' }, 500); }
    return json({ ok: true, compte: { nom: texte(compte.nom, 80), email: compte.email, telephone: texte(compte.telephone, 30), facturation: factureCompte(compte) } });
  }

  /* Avis sur un produit réellement loué : passe par la même modération que les avis du site */
  if (path === '/avis' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const note = Math.max(1, Math.min(5, parseInt(b.note, 10) || 0));
    const avis = String(b.avis || '').replace(/\s+/g, ' ').trim().slice(0, 900);
    const produit = String(b.produit || '').trim();
    if (!note || avis.length < 5) return json({ error: 'Choisissez une note et écrivez quelques mots.' }, 400);
    if (tropEssais(request, 10, 60 * 60 * 1000, 'cliavis')) return json({ error: 'Trop d’avis envoyés. Réessayez plus tard.' }, 429);
    const dossiers = await dossiersDuClient(compte, request, secret, gestionnaire);
    const loue = dossiers.some((d) => d.kind === 'resa' && d.lignes.some((l) => l.nom === produit));
    if (!loue) return json({ error: 'Vous ne pouvez noter que le matériel que vous avez loué.' }, 400);
    if ((compte.avis || []).some((a) => a.produit === produit)) return json({ error: 'Vous avez déjà donné votre avis sur ce produit.' }, 409);
    const mots = motsNom(compte.nom); 
    const brut = String(compte.nom || '').trim().split(/\s+/);
    const aff = brut.length > 1 ? (brut.find((m) => m !== m.toUpperCase()) || brut[brut.length - 1]) + ' ' + ((brut.find((m) => m === m.toUpperCase()) || brut[0])[0] || '') + '.' : brut[0] || 'Client';
    let rep;
    try {
      rep = await fetch(new URL('/api/avis/demande', request.url), { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ produit, nom: aff, avis, note, email: compte.email }) });
    } catch (e) { console.error('Avis client :', e.message); }
    if (!rep || !rep.ok) return json({ error: 'Votre avis n’a pas pu être envoyé, réessayez.' }, 502);
    compte.avis = (compte.avis || []).concat([{ produit, note, avis, date: new Date().toISOString() }]).slice(-100);
    try { await ecrireCompte(compte); } catch {}
    return json({ ok: true });
  }

  /* Parrainage : le code du client, ses filleuls, l'avoir acquis */
  if (path === '/parrainage' && (request.method === 'GET' || request.method === 'POST')) {
    const nom = compte.nom || '';
    let fiche = null;
    try { fiche = (await tousLesCodes()).find((f) => memeNom(f.parrain, nom)) || null; } catch {}
    if (!fiche && request.method === 'POST') {
      const dossiers = await dossiersDuClient(compte, request, secret, gestionnaire);
      if (!dossiers.some((d) => d.kind === 'resa')) return json({ ok: false, message: 'Votre code est créé dès votre première réservation validée.' });
      const m = String(nom).trim().split(/\s+/);
      const maj = m.filter((x) => x === x.toUpperCase() && /[A-Z]/.test(x)), min = m.filter((x) => !maj.includes(x));
      const nomF = (maj.length ? maj : [m[m.length - 1]]).join(' '), prenomF = (min.length ? min : m.slice(0, -1)).join(' ');
      try {
        const r = await fetch(new URL('/api/parrainage/creer', request.url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nom: nomF, prenom: prenomF }) });
        const j = await r.json().catch(() => ({}));
        if (!j.ok) return json({ ok: false, message: 'Impossible de créer votre code pour le moment. Contactez-nous.' });
        fiche = (await tousLesCodes()).find((f) => f.code === j.code) || null;
      } catch (e) { console.error('Parrainage client :', e.message); }
    }
    if (!fiche) return json({ ok: true, code: '', amis: [], acquis: 0, deduits: 0, remise: 10 });
    const amis = (fiche.utilisations || []).map((u) => ({ nom: texte(u.filleul, 60), statut: u.statut === 'acquis' ? 'acquis' : (u.statut === 'validee' ? 'validee' : 'attente'), montant: nombre(u.montant || fiche.remise || 10) }));
    const acquis = amis.filter((a) => a.statut === 'acquis').reduce((t, a) => t + a.montant, 0);
    return json({ ok: true, code: fiche.code, remise: Number(fiche.remise) || 10, amis, acquis, deduits: nombre((Number(fiche.deduits) || 0) * (Number(fiche.remise) || 10)) });
  }

  if (path === '/document' && request.method === 'GET') {
    const id = url.searchParams.get('id') || '';
    const type = url.searchParams.get('type') === 'facture' ? 'facture' : 'devis';
    const dossiers = await dossiersDuClient(compte, request, secret, gestionnaire);
    if (/^d:/.test(id) && type === 'devis') {
      const dd = dossiers.find((x) => x.id === id && x.kind === 'demande');
      if (!dd || !dd.documents.devis) return json({ error: 'Document indisponible' }, 404);
      const st = await blobStore(DATA_STORE);
      const cleD = 'demande-devis/' + encodeURIComponent(dd.ref);
      let g = await st.get(cleD, { type: 'json' }).catch(() => null);
      if (!g) {
        const cookieA = `${COOKIE_NAME}=${encodeURIComponent(makeSessionToken(secret))}`;
        const rep0 = await gestionnaire(new Request(new URL('/api/admin/demandes', request.url), { headers: { cookie: cookieA } }));
        let brut = (rep0.ok ? await rep0.json() : []).find((x) => String(x.id) === dd.ref && emailCle(x.email) === emailCle(compte.email));
        if (!brut) { const rr = (await lireRecentes(emailCle(compte.email))).find((x) => 'e' + x.rid === dd.ref); if (rr) brut = brutRecent(emailCle(compte.email), rr); }
        if (!brut) return json({ error: 'Document indisponible' }, 404);
        const rep = await gestionnaire(new Request(new URL('/api/admin/devis', request.url), { method: 'POST',
          headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify(envoiDevisDemande(brut, dd.lignes, adresseFacture(compte))) }));
        if (!rep.ok) return json({ error: 'Document indisponible' }, 404);
        g = await st.get(cleD, { type: 'json' }).catch(() => null);
        if (!g) return new Response(await rep.arrayBuffer(), { status: 200, headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', 'content-disposition': rep.headers.get('content-disposition') || 'attachment; filename="devis.pdf"' } });
      }
      return new Response(Buffer.from(g.b64, 'base64'), { status: 200, headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', 'content-disposition': `attachment; filename="${g.nom || 'devis.pdf'}"` } });
    }
    const d = dossiers.find((x) => x.id === id && x.kind === 'resa');
    if (!d || !d.documents[type]) return json({ error: 'Document indisponible' }, 404);
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(makeSessionToken(secret))}`;
    const q = new URLSearchParams({ id: d.ref, type });
    if (d.acompteDemande) q.set('acompte', String(d.acompte));
    const rep = await gestionnaire(new Request(new URL('/api/admin/' + type + '?' + q, request.url), { headers: { cookie } }));
    if (!rep.ok) return json({ error: 'Document indisponible' }, 404);
    return new Response(await rep.arrayBuffer(), { status: 200, headers: {
      'content-type': 'application/pdf', 'cache-control': 'private, no-store',
      'content-disposition': rep.headers.get('content-disposition') || `attachment; filename="${type}.pdf"` } });
  }
  return json({ error: 'Introuvable' }, 404);
}

/* ── Administration des comptes (appelé depuis le back-office connecté) ── */
async function espaceAdmin(request, url, path) {
  const store = await blobStore(AUTH_STORE);
  if (path === '/espace-comptes' && request.method === 'GET') {
    const { blobs } = await store.list({ prefix: 'espace/compte/' });
    const res = [];
    for (const b of blobs) {
      const c = await store.get(b.key, { type: 'json', consistency: 'strong' }).catch(() => null);
      if (c) res.push({ email: c.email, nom: c.nom || '', actif: c.actif !== false, cree: c.cree || '', dernierAcces: c.dernierAcces || '', mailEtat: c.mailEtat || null, nomSource: c.nomSource || '' });
    }
    return json(res.sort((a, b) => a.nom.localeCompare(b.nom)));
  }
  /* test d'envoi : un e-mail de contrôle vers l'adresse de notification, avec la réponse brute de Resend */
  if (path === '/espace-test-mail' && request.method === 'POST') {
    const cle = process.env.RESEND_API_KEY;
    const de = process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>';
    const a = (process.env.NOTIFY_TO || 'vespraevent@gmail.com').split(',').map((x) => x.trim())[0];
    if (!cle) return json({ ok: false, de, a, detail: 'RESEND_API_KEY absente : aucune clé Resend n’est configurée sur Netlify.' });
    try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: de, to: [a], subject: 'Test d’envoi — espace client Vespra Event', html: '<p>Si vous lisez ce message, l’envoi d’e-mails fonctionne.</p>' }) });
      const txt = await r.text();
      return json({ ok: r.ok, de, a, detail: r.ok ? 'Resend a accepté le message.' : r.status + ' ' + String(txt).slice(0, 300) });
    } catch (e) { return json({ ok: false, de, a, detail: String(e.message).slice(0, 200) }); }
  }
  if (path === '/espace-comptes' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const email = emailCle(b.email);
    if (!emailValide(email)) return json({ error: 'Adresse e-mail invalide' }, 400);
    let c = await lireCompte(email);
    const mdp = b.password == null ? '' : String(b.password);
    if (!c) {
      if (mdp && mdp.length < 10) return json({ error: 'Le mot de passe doit faire au moins 10 caractères.' }, 400);
      c = { email, nom: texte(b.nom, 80), passwordRecord: mdp ? hashAdminPassword(mdp) : null, actif: true, v: 1, cree: new Date().toISOString() };
    } else {
      if (b.nom != null) { c.nom = texte(b.nom, 80); c.nomManuel = true; }
      if (typeof b.actif === 'boolean') { c.actif = b.actif; if (!b.actif) c.v = (c.v || 1) + 1; }
      if (mdp) {
        if (mdp.length < 10) return json({ error: 'Le mot de passe doit faire au moins 10 caractères.' }, 400);
        c.passwordRecord = hashAdminPassword(mdp); c.v = (c.v || 1) + 1; c.echecs = 0; c.verrouJusqua = 0;
      }
    }
    let codeManuel = '';
    if (b.genererCode === true) {
      codeManuel = String(randomInt(0, 1000000)).padStart(6, '0');
      c.codeManuel = { hash: sign('code.' + email + '.' + codeManuel, process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || ''), exp: Date.now() + 7 * 86400000 };
      c.echecs = 0; c.verrouJusqua = 0;
    }
    await ecrireCompte(c);
    let envoye;
    if (codeManuel && b.envoyer === true) {
      envoye = await envoyerMailCode(c.email, codeManuel, 'Voici le code pour accéder à votre espace client Vespra Event, où vous suivez votre réservation, votre matériel et vos documents.', 'Il est valable 7 jours. Une fois connecté, vous pourrez choisir votre propre mot de passe.');
    }
    return json({ ok: true, code: codeManuel || undefined, envoye });
  }
  if (path === '/espace-comptes' && request.method === 'DELETE') {
    const email = emailCle(url.searchParams.get('email'));
    if (!email) return json({ error: 'e-mail manquant' }, 400);
    await store.delete(cleCompte(email));
    return json({ ok: true });
  }
  if (path === '/espace-modifs' && request.method === 'GET') return json(await demandesModif(''));
  if (path === '/espace-modifs' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const id = String(b.id || '');
    if (!/^m\d+[0-9a-f]*$/.test(id)) return json({ error: 'id invalide' }, 400);
    const m = await store.get('espace/modif/' + id, { type: 'json', consistency: 'strong' });
    if (!m) return json({ error: 'introuvable' }, 404);
    if (!['attente', 'acceptee', 'refusee'].includes(b.etat)) return json({ error: 'état invalide' }, 400);
    /* livraison / reprise acceptée : le montant s'ajoute directement à la réservation du planning */
    if (b.etat === 'acceptee' && m.etat !== 'acceptee' && (m.type === 'livraison' || m.type === 'reprise')) {
      const brutM = String(b.montant == null ? '' : b.montant).trim().replace(',', '.');
      const montant = brutM === '' ? NaN : Number(brutM);
      if (!Number.isFinite(montant) || montant < 0 || montant > 5000) return json({ error: 'Indiquez le montant à ajouter (0 si c’est offert).' }, 400);
      if (/^d:/.test(String(m.dossier || ''))) {
        /* demande pas encore validée : le suivi de la demande est mis à jour (livraison, adresse, prix) */
        const cookieA = request.headers.get('cookie') || '';
        const rep0 = await gestionnaire(new Request(new URL('/api/admin/demandes', request.url), { headers: { cookie: cookieA } }));
        const x = (rep0.ok ? await rep0.json() : []).find((y) => 'd:' + y.id === String(m.dossier));
        if (!x) return json({ error: 'Demande introuvable : modification à faire à la main.' }, 404);
        const oui = (v) => (v ? 'oui' : '');
        const corps = { id: x.id, statut: x.statut || 'nouvelle', resaId: x.resaId || '', cadre: x.cadre || '', note: x.note || '', appel: oui(x.appel), mail: oui(x.mail),
          optsRetirees: (x.optsRetirees || []).join('|'), montageRetire: (x.montageRetire || []).join('|'), montageAjoute: (x.montageAjoute || []).join('|'),
          livraisonPrix: nombre((Number(x.livraisonPrix) || 0) + montant), montagePrix: x.montagePrix, prixLignes: x.prixLignes ? JSON.stringify(x.prixLignes) : '',
          parrainageStatut: x.parrainageStatut || '', offreMariage: x.offreMariage === true ? 'oui' : (x.offreMariage === false ? 'non' : ''),
          devisAcompte: x.devisAcompte || 0, acompteRecu: oui(x.acompteRecu),
          livraisonRetour: m.type === 'reprise' ? 'oui' : (x.livraisonRetour === true ? 'oui' : (x.livraisonRetour === false ? 'non' : '')),
          devisAdresse: x.devisAdresse || '', devisPro: oui(x.devisPro), devisSiret: x.devisSiret || '', devisTva: x.devisTva || '', devisAvecAcompte: oui(x.devisAvecAcompte),
          corrections: m.type === 'livraison' ? { livraison: 'oui', adresse: m.adresse || x.adresse || '' } : {} };
        if (corps.montagePrix === null || corps.montagePrix === undefined) delete corps.montagePrix;
        const rp = await gestionnaire(new Request(new URL('/api/admin/demandes', request.url), { method: 'POST',
          headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify(corps) }));
        if (!rp.ok) return json({ error: 'Mise à jour de la demande impossible.' }, 500);
        m.montant = nombre(montant);
        m.etat = b.etat; m.reponse = texte(b.reponse, 600); m.traite = new Date().toISOString();
        await store.setJSON('espace/modif/' + id, m);
        return json({ ok: true });
      }
      const rid = String(m.dossier || '').replace(/^r:/, '');
      if (!/^r:/.test(String(m.dossier || '')) || !rid) return json({ error: 'Modification à faire à la main.' }, 400);
      const ds = await blobStore(DATA_STORE);
      const cle = blobKey('reservations', rid);
      const brut = await ds.get(cle, { type: 'json', consistency: 'strong' }).catch(() => null);
      if (!brut || typeof brut.d !== 'string') return json({ error: 'Réservation introuvable.' }, 404);
      let r; try { r = JSON.parse(brut.d); } catch { return json({ error: 'Réservation illisible.' }, 500); }
      r.livraisonPrice = nombre((Number(r.livraisonPrice) || 0) + montant);
      if (m.type === 'livraison') { r.livraison = true; if (m.adresse && !String(r.place || '').trim()) r.place = m.adresse; r.livraisonAdresse = m.adresse || r.livraisonAdresse || ''; }
      else r.livraisonRetour = true;
      await ds.setJSON(cle, { ...brut, d: JSON.stringify(r) });
      m.montant = nombre(montant);
    }
    m.etat = b.etat; m.reponse = texte(b.reponse, 600); m.traite = new Date().toISOString();
    await store.setJSON('espace/modif/' + id, m);
    return json({ ok: true });
  }
  return null;
}

const gestionnaire = async (request) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/espace/')) {
    return espace(request, url, process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '', gestionnaire);
  }
  const path = url.pathname.replace(/^\/api\/admin/, '').replace(/\/$/, '') || '/';
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USER;

  /* ---- routes publiques (pas d'auth), utilisées par le site ----
     Seuls les enregistrements correctement signés sont renvoyés : un envoi
     déposé directement sur le formulaire Netlify par un tiers ne peut pas
     apparaître sur le site. */
  /* ── Tout ce dont une page a besoin, en un seul appel ──────────────
     Chaque page appelait jusqu'à cinq adresses différentes (thème, textes,
     notices, produits, avis Google). Autant d'allers-retours pour le
     visiteur, autant de requêtes facturées, et une page plus lente.

     Cette adresse renvoie l'ensemble d'un coup, pour la page demandée. Elle
     est mise en cache par le CDN comme les autres et vidée à chaque
     modification : au-delà du premier visiteur, la fonction ne tourne même
     pas. Les anciennes adresses restent en service pour ne rien casser.
     ─────────────────────────────────────────────────────────────────── */
  if (url.pathname === '/api/site') {
    const pg = url.searchParams.get('page') || '';
    const valides = (items) => items.filter((x) => itemSignatureValid(x, secret));
    const nettoyer = (items) => items.map(({ sig, _submissionId, _created, ...rest }) => rest);

    try {
      const [theme, textes, notices, produits, google, images] = await Promise.all([
        formSubmissions(THEME_FORM).then(({ subs }) => subs),
        formSubmissions(TEXTE_FORM).then(({ subs }) => subs),
        formSubmissions(NOTICE_FORM).then(({ subs }) => subs),
        formSubmissions(PRODUCT_FORM).then(({ subs }) => subs),
        formSubmissions(GOOGLE_FORM).then(({ subs }) => subs),
        formSubmissions(IMAGE_FORM).then(({ subs }) => subs),
      ]);

      return jsonPublic({
        theme: nettoyer(valides(latestById(theme)
          .filter((x) => x.id === 'theme' && x.action !== 'supprimer')))
          .map(({ id, ...rest }) => rest)[0] || {},
        textes: nettoyer(valides(latestById(textes)
          .filter((x) => x.action !== 'supprimer')
          .filter((x) => !pg || x.page === pg))),
        notices: nettoyer(valides(latestById(notices)
          .filter((x) => !pg || x.page === pg))),
        produits: nettoyer(valides(latestById(produits)
          .filter((p) => p.action !== 'supprimer'))),
        google: nettoyer(valides(latestById(google))),
        images: nettoyer(valides(latestById(images).filter((x) => x.action !== 'supprimer'))),
      });
    } catch (e) {
      console.error(e.message);
      /* en cas de souci, la page garde son contenu d'origine */
      return jsonPublic({ theme: {}, textes: [], notices: [], produits: [], google: [] });
    }
  }

  if (url.pathname === '/api/theme') {
    try {
      const { subs } = await formSubmissions(THEME_FORM);
      const t = latestById(subs)
        .filter((x) => x.id === 'theme' && x.action !== 'supprimer')
        .filter((x) => itemSignatureValid(x, secret))
        .map(({ sig, id, _submissionId, _created, ...rest }) => rest)[0];
      return jsonPublic(t || {});
    } catch (e) { console.error(e.message); return jsonPublic({}); }
  }

  if (url.pathname === '/api/notices') {
    const pg = url.searchParams.get('page');
    try {
      const { subs } = await formSubmissions(NOTICE_FORM);
      const items = latestById(subs)
        .filter((x) => !pg || x.page === pg)
        .filter((x) => itemSignatureValid(x, secret))
        .map(({ sig, _submissionId, _created, ...rest }) => rest);
      return jsonPublic(items);
    } catch (e) { console.error(e.message); return jsonPublic([]); }
  }

  if (url.pathname === '/api/google') {
    try {
      const { subs } = await formSubmissions(GOOGLE_FORM);
      const items = latestById(subs)
        .filter((x) => itemSignatureValid(x, secret))
        .map(({ sig, _submissionId, _created, ...rest }) => rest);
      return jsonPublic(items);
    } catch (e) { console.error(e.message); return jsonPublic([]); }
  }

  if (url.pathname === '/api/textes') {
    /* filtré par page : chaque page ne reçoit que ses propres textes */
    const pg = url.searchParams.get('page');
    try {
      const { subs } = await formSubmissions(TEXTE_FORM);
      const items = latestById(subs)
        .filter((x) => x.action !== 'supprimer')
        .filter((x) => !pg || x.page === pg)
        .filter((x) => itemSignatureValid(x, secret))
        .map(({ sig, _submissionId, _created, ...rest }) => rest);
      return jsonPublic(items);
    } catch (e) { console.error(e.message); return jsonPublic([]); }
  }

  if (url.pathname === '/api/produits' || url.pathname === '/api/blog') {
    const formName = url.pathname === '/api/produits' ? PRODUCT_FORM : BLOG_FORM;
    try {
      const { subs } = await formSubmissions(formName);
      const items = latestById(subs)
        .filter((p) => p.action !== 'supprimer')
        .filter((p) => itemSignatureValid(p, secret))
        .map(({ sig, _submissionId, ...rest }) => rest);
      return jsonPublic(items);
    } catch (e) { console.error(e.message); return jsonPublic([]); }
  }

  /* ---- connexion : les identifiants Netlify servent de secours initial.
     Après modification depuis le back-office, les identifiants chiffrés dans
     Netlify Blobs deviennent prioritaires, sans exposer le mot de passe. ---- */
  const creds = await getEffectiveCredentials();
  if (!creds.username || (!creds.password && !creds.passwordRecord)) {
    return json({ error: "ADMIN_USER + ADMIN_PASSWORD doivent être configurés dans Netlify pour initialiser l'accès." }, 500);
  }

  if (path === '/login' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    if (loginBloque(request) || await limiteBlobs(request, 'login-admin', 8, 15 * 60 * 1000, false)) return json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, 429);
    const okUser = !!body.user && safeEqual(body.user, creds.username);
    const okPass = creds.overridden
      ? (!!body.password && verifyAdminPassword(body.password, creds.passwordRecord))
      : (!!body.password && safeEqual(body.password, creds.password));
    if (!okUser || !okPass) {
      /* petit délai : rend une attaque par essais successifs inexploitable,
         et le message reste volontairement identique dans les deux cas. */
      tropEssais(request, 8, 15 * 60 * 1000, 'login');
      await limiteAjouter(request, 'login-admin', 15 * 60 * 1000, 20);
      await new Promise((r) => setTimeout(r, 700));
      return json({ error: 'Identifiant ou mot de passe incorrect' }, 401);
    }
    const token = makeSessionToken(secret);
    return json({ ok: true }, 200, {
      'set-cookie': `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`,
    });
  }

  if (path === '/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, {
      'set-cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    });
  }

  /* Médias publics servis depuis Blobs. */
  if (url.pathname.startsWith('/api/media/') && request.method === 'GET') {
    const key = decodeURIComponent(url.pathname.slice('/api/media/'.length));
    if (!key.startsWith('uploads/')) return new Response('Not found', { status: 404 });
    try {
      const store = await blobStore(MEDIA_STORE);
      /* une seule lecture (données + métadonnées) au lieu de deux */
      const lu = await store.getWithMetadata(key, { type: 'arrayBuffer', consistency: 'strong' });
      if (!lu || !lu.data) return new Response('Not found', { status: 404 });
      return new Response(lu.data, {
        headers: {
          'content-type': lu.metadata?.contentType || 'application/octet-stream',
          'cache-control': 'public, max-age=31536000, immutable',
          /* le cache de Netlify garde l'image : la base n'est plus sollicitée à chaque affichage */
          'netlify-cdn-cache-control': 'public, s-maxage=86400',
          'content-disposition': 'inline',
        },
      });
    } catch (e) {
      console.error('Lecture média impossible :', e.message);
      return new Response('Not found', { status: 404 });
    }
  }

  const session = getCookie(request, COOKIE_NAME);
  const authed = verifySessionToken(session, secret);

  if (path === '/session') {
    return json({ authed });
  }

  if (!authed) {
    return json({ error: 'Connexion requise' }, 401);
  }

  if (path.startsWith('/espace-')) { const rep = await espaceAdmin(request, url, path); if (rep) return rep; }

  /* Reprise du planning Excel : le fichier contient les noms et téléphones des
     clients, il n'est donc plus un fichier public du site mais une donnée
     servie uniquement au back-office connecté (le contrôle de session est
     juste au-dessus). */
  if (path === '/historique-reservations' && request.method === 'GET') {
    for (const chemin of ['netlify/functions/_historique-reservations.json',
                          join(process.cwd(), 'netlify/functions/_historique-reservations.json'),
                          new URL('./_historique-reservations.json', import.meta.url)]) {
      try {
        const brut = await readFile(chemin, 'utf8');
        return new Response(brut, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
      } catch { /* suivant */ }
    }
    return json({ error: 'fichier de reprise introuvable' }, 404);
  }

  /* Diagnostic du stockage : le back-office et toutes les données
     administrables doivent passer par Netlify Blobs. Cette route ne lit
     aucun contenu sensible ; elle vérifie simplement que les stores
     persistants sont accessibles depuis la Function. */
  if (path === '/storage-status' && request.method === 'GET') {
    try {
      const checks = [
        ['contenu', DATA_STORE],
        ['avis', REVIEW_STORE],
        ['clients', CLIENT_STORE],
        ['auth', AUTH_STORE],
        ['medias', MEDIA_STORE],
      ];
      const stores = {};
      /* Test d'écriture → lecture → suppression : les 5 en parallèle, et le résultat
         est gardé 60 s (inutile de réécrire en base à chaque ouverture de page). */
      const maintenant = Date.now();
      if (globalThis.__etatStockage && maintenant - globalThis.__etatStockage.t < 60000) {
        return json(globalThis.__etatStockage.rep);
      }
      await Promise.all(checks.map(async ([label, name]) => {
        try {
          await verifyStorageWrite(name);
          stores[label] = { ok: true, test: 'écriture → lecture → suppression validées' };
        } catch (e) {
          stores[label] = { ok: false, error: e.message };
        }
      }));
      const ok = Object.values(stores).every(x => x.ok);
      const rep = { ok, provider: stockageActif() === 'supabase' ? 'Supabase' : 'Netlify Blobs', stores };
      if (ok) globalThis.__etatStockage = { t: Date.now(), rep };
      return json(rep);
    } catch (e) {
      return json({ ok: false, provider: 'Netlify Blobs', error: e.message }, 500);
    }
  }

  /* ── Parrainage : la liste des codes, pour l'onglet du back-office ──
     On ne passe pas par /data : la lecture ci-dessous est en cohérence
     forte et ne dépend pas du parcours d'un préfixe, qui peut ignorer
     pendant un moment un code tout juste créé. */
  if (path === '/parrainage' && request.method === 'GET') {
    try {
      const codes = await tousLesCodes();
      return json({ ok: true, codes });
    } catch (e) {
      console.error('Parrainage (back-office) :', e.message);
      return json({ ok: false, error: e.message, codes: [] }, 500);
    }
  }

  if (path === '/parrainage' && request.method === 'DELETE') {
    try {
      const code = url.searchParams.get('code');
      if (!code) return json({ error: 'code non précisé' }, 400);
      const r = await supprimerCode(code);
      return json(r);
    } catch (e) {
      console.error('Parrainage (suppression) :', e.message);
      return json({ error: e.message }, 500);
    }
  }

  /* ── Base clients persistante dans Netlify Blobs ───────────────── */
  /* ── Facture PDF d'une réservation ────────────────────────────────
     Un numéro est attribué à la première génération et conservé : une
     facture régénérée porte le même numéro, comme l'exige la suite
     continue. Le compteur est enregistré dans Blobs, pas dans le
     navigateur, pour qu'il survive aux déploiements et soit le même
     depuis le téléphone et l'ordinateur. */
  /* ---- note de frais : PDF d'une note ou récapitulatif d'un trimestre ---- */
  if (path === '/note-frais' && request.method === 'POST') {
    let corps; try { corps = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const notes = (Array.isArray(corps && corps.notes) ? corps.notes : []).slice(0, 400);
    if (!notes.length) return json({ error: 'aucune note à imprimer' }, 400);
    try {
      const ENT = await lireEntreprise();
      const pdf = construireNoteFrais({
        emetteur: ENT.emetteur,
        beneficiaire: String(corps.beneficiaire || '').slice(0, 120),
        titre: String(corps.titre || '').slice(0, 120),
        reference: String(corps.reference || '').slice(0, 60),
        notes,
      });
      const nom = String(corps.fichier || 'note-de-frais').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) + '.pdf';
      return new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', 'content-disposition': `attachment; filename="${nom}"` } });
    } catch (e) { return json({ error: e.message }, 500); }
  }

  if ((path === '/facture' || path === '/devis')
      && (request.method === 'GET' || request.method === 'POST')) {
    try {
      /* même fabrique pour les deux documents : seuls le titre, la
         numérotation et les mentions changent.

         Deux façons de l'appeler :
         • en GET, à partir d'une réservation du planning — les montants
           y sont déjà, livraison et montage compris ;
         • en POST, à partir d'une demande qui n'est pas encore au
           planning : le back-office envoie alors les lignes qu'il a
           sous les yeux, complétées des montants que vous saisissez.
           C'est ce qui permet d'établir un devis dès l'arrivée d'une
           demande. */
      const type = (path === '/devis' || url.searchParams.get('type') === 'devis') ? 'devis' : 'facture';
      const envoi = request.method === 'POST' ? await request.json().catch(() => null) : null;
      if (request.method === 'POST' && !envoi) return json({ error: 'Requête invalide' }, 400);

      const id = (envoi && envoi.ref) || url.searchParams.get('id');
      if (!id) return json({ error: 'document non rattaché à une demande' }, 400);

      let r;
      if (envoi) {
        r = {
          client: String(envoi.client && envoi.client.nom || '').trim(),
          phone: (envoi.client && envoi.client.tel) || '',
          email: (envoi.client && envoi.client.email) || '',
          place: '',
          dateStart: (envoi.dateEvenement || ''),
          dateEnd: (envoi.dateFinEvenement || ''),
          products: [], livraisonPrice: 0, montage: 0, supplements: [],
        };
        if (!r.client) return json({ error: 'nom du client manquant' }, 400);
      } else {
        const store = await blobStore(DATA_STORE);
        const brut = await store.get(blobKey('reservations', id), { type: 'json', consistency: 'strong' });
        r = brut && typeof brut.d === 'string' ? JSON.parse(brut.d) : brut;
        if (!r || !r.client) return json({ error: 'réservation introuvable' }, 404);
      }

      const pro = envoi ? envoi.pro === true : url.searchParams.get('pro') === '1';
      const adresse = (envoi
          ? ((envoi.client && envoi.client.adresse) || []).join('|')
          : (url.searchParams.has('adresse') ? url.searchParams.get('adresse') : (r.place || '')))
        .split(/\s*\|\s*|\s*\n\s*/).map((s) => s.trim()).filter(Boolean);

      const fiche = await numeroDeFacture(id, r, type);

      const emission = new Date();
      const dateEmission = `${String(emission.getDate()).padStart(2, '0')}/${String(emission.getMonth() + 1).padStart(2, '0')}/${emission.getFullYear()}`;

      /* ── les lignes : celles envoyées par le back-office, sinon
            celles de la réservation ── */
      const lignes = [];
      for (const l of (envoi && Array.isArray(envoi.lignes) ? envoi.lignes : [])) {
        if (!l || !l.intitule) continue;
        lignes.push({
          intitule: String(l.intitule).slice(0, 120),
          detail: String(l.detail || '').slice(0, 160),
          quantite: Math.max(1, Number(l.quantite) || 1),
          /* une remise (parrainage) est une ligne en négatif ; toute autre ligne reste positive */
          montantTTC: l.remise ? -Math.abs(Number(l.montantTTC) || 0) : Math.max(0, Number(l.montantTTC) || 0),
          ancienTTC: (!l.remise && Number(l.ancienTTC) > Number(l.montantTTC)) ? Number(l.ancienTTC) : 0,
        });
      }
      /* Affichage de la formule sur la facture.
         Certaines anciennes réservations ont bien le prix de la formule
         mais ont conservé `variant: Standard`. Pour les photobooths, on
         peut alors retrouver sans ambiguïté la formule correspondant au
         tarif enregistré. On n'affiche jamais « Standard » comme formule. */
      const formuleFacture = (p) => {
        let v = String(p && p.variant || '').trim().split(/\s+\+\s+/)[0];   /* « Formule 200 photos + Cadre… » : les options ont leur propre ligne */
        v = v.replace(/\btirages?\b/ig, 'photos').replace(/^formule\s+(?=\d|illimit)/i, '');
        if (v && v.toLowerCase() !== 'standard' && v.toLowerCase() !== 'option') return v;
        if (String(p && p.cat || '').toLowerCase() === 'photobooth') {
          const prix = Number(p.price);
          const correspondances = [
            [130, 'Numérique'],
            [190, '200 photos'],
            [235, '300 photos'],
            [240, '300 photos'],
            [290, '400 photos'],
            [420, 'Illimité'],
          ];
          const trouve = correspondances.find(([montant]) => Math.abs(prix - montant) < 0.01);
          if (trouve) return trouve[1];
        }
        return '';
      };
      for (const p of (envoi ? [] : produitsNetsResa(r.products))) {
        if (!p || !p.name) continue;
        let formule = formuleFacture(p);
        /* « Pack Vespra 60 personnes » + « 60 personnes » : on ne répète pas la formule */
        {
          const mots = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
          const mn = mots(p.name), mv = mots(formule);
          if (mv.length && mv.every((w) => mn.includes(w))) formule = '';
        }
        const options = (Array.isArray(p.options) ? p.options.filter(Boolean) : String(p.options || p.option || '').split(/\s*,\s*/).filter(Boolean)).map(nomCourtOption).join(', ');
        const aff = affichageTitre(String(p.name), formule);
        const estOptionLigne = p.estOption === true || String(p.variant || '') === 'Option';
        lignes.push({
          intitule: (/^(serveuse|p[âa]tissier|chef p[âa]tissier)|—\s*sur devis\s*$/i.test(String(p.name || '')) ? String(p.name).replace(/\s*—\s*sur devis\s*$/i, '') : 'Location — ') + (/^(serveuse|p[âa]tissier|chef p[âa]tissier)|—\s*sur devis\s*$/i.test(String(p.name || '')) ? '' : (estOptionLigne ? nomCourtOption(p.short || p.name) : (aff.matched ? aff.titre : p.name))),
          detail: [aff.matched ? aff.sous : formule, options].filter(Boolean).join(' · '),
          quantite: Number(p.qty) || 1,
          montantTTC: Number(p.price) || 0,
          /* prix baissé à la main (promo) : l'ancien prix figure barré */
          ancienTTC: Number(p.prixInitial) > Number(p.price) ? Number(p.prixInitial) : 0,
        });
      }
      /* livraison choisie : la ligne figure toujours, même à 0 € (livraison offerte) */
      const livreeResa = typeof r.livraison === 'string' ? /^(oui|o|yes|true|1)$/i.test(r.livraison.trim()) : !!r.livraison;
      if (livreeResa || Number(r.livraisonPrice) > 0) {
        lignes.push({ intitule: r.livraisonRetour === false ? 'Livraison du matériel' : 'Livraison et reprise du matériel',
          detail: r.place || '', quantite: 1, montantTTC: Number(r.livraisonPrice) || 0 });
      }
      if (Number(r.montage) > 0) {
        lignes.push({ intitule: 'Montage et démontage sur place',
          detail: '', quantite: 1, montantTTC: Number(r.montage) });
      }
      for (const s of (r.supplements || [])) {
        if (!s) continue;
        lignes.push({ intitule: s.label || s.nom || 'Supplément', detail: '',
          quantite: 1, montantTTC: Number(s.price ?? s.prix) || 0 });
      }
      if (!lignes.length) return json({ error: 'cette réservation ne porte aucun montant' }, 400);

      /* Les prix du site sont TTC : la facture les décompose. */
      const ENT = await lireEntreprise();
      const pdf = construireFacture({
        emetteur: ENT.emetteur,
        client: {
          /* une société : son nom figure sur le document, pas celui de la personne qui a rempli le formulaire */
          nom: String((url.searchParams.get('societe') || '')).trim().slice(0, 120) || r.client,
          adresse,
          siret: (envoi ? (envoi.client && envoi.client.siret) : url.searchParams.get('siret')) || '',
          tvaClient: (envoi ? (envoi.client && envoi.client.tvaClient) : url.searchParams.get('tvaclient')) || '',
          tel: r.phone || '',
          email: r.email || '',
        },
        facture: {
          type,
          numero: fiche.numero,
          dateEmission,
          datePrestation: periodeFr(r.dateStart, r.dateEnd) || jourFr(r.dateStart),
          /* court : la case du haut est étroite, et le détail figure
             dans les conditions de règlement au bas du document */
          echeance: type === 'devis'
            ? ENT.validite + ' jours'
            : (pro ? '30 jours' : 'comptant'),
          /* l'acompte n'est pas toujours demandé : c'est le back-office
             qui dit s'il faut le déduire, et de combien */
          acompte: envoi
            ? Math.max(0, Number(envoi.acompte) || 0)
            : (url.searchParams.has('acompte')
                ? Math.max(0, Number(url.searchParams.get('acompte')) || 0)
                : 0),
        },
        lignes,
        reglages: {
          tauxTVA: TAUX_TVA,
          conditions: type === 'devis' ? ENT.priv.conditionsDevis : (pro ? ENT.priv.conditionsFacturePro : ENT.priv.conditionsFacturePart),
          penalites: (type !== 'devis' && pro) ? ENT.priv.penalites : '',
          escompte: type === 'devis' ? '' : 'Escompte pour paiement anticipé : néant.',
        },
      });

      const nomFichier = ((type === 'devis' ? 'Devis-' : 'Facture-') + fiche.numero + '-' + String(r.client))
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').slice(0, 80) + '.pdf';

      /* devis chiffré depuis une demande : on en garde le PDF, pour que le client le retrouve dans son espace */
      if (envoi && type === 'devis' && envoi.ref) {
        try {
          const st = await blobStore(DATA_STORE);
          await st.setJSON('demande-devis/' + encodeURIComponent(String(envoi.ref)), { nom: nomFichier, b64: Buffer.from(pdf).toString('base64'), t: Date.now() });
        } catch (e) { console.error('Devis non conservé :', e.message); }
      }
      return new Response(pdf, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="${nomFichier}"`,
          'cache-control': 'no-store',
        },
      });
    } catch (e) {
      console.error('Facture :', e.message);
      return json({ error: e.message }, 500);
    }
  }

  if (path === '/clients' && request.method === 'GET') {
    try {
      const store = await blobStore(CLIENT_STORE);
      const data = await store.get('clients', { type: 'json', consistency: 'strong' });
      return json({ clients: Array.isArray(data) ? data : [] });
    } catch (e) { return json({ error: e.message }, 500); }
  }
  if (path === '/clients' && request.method === 'POST') {
    try {
      const body = await request.json();
      const incoming = Array.isArray(body?.clients) ? body.clients : [];
      const store = await blobStore(CLIENT_STORE);
      /* écriture conditionnelle : si quelqu'un d'autre enregistre au même
         instant, on relit et on refusionne au lieu d'écraser son ajout */
      for (let essai = 0; essai < 6; essai++) {
        const actuel = await store.getWithMetadata('clients', { type: 'json', consistency: 'strong' });
        const current = actuel && Array.isArray(actuel.data) ? actuel.data : [];
        const merged = current.slice();
        for (const c of incoming) {
          if (!c || !c.fullName) continue;
          const i = merged.findIndex(x => String(x.id) === String(c.id) || String(x.fullName).toLowerCase() === String(c.fullName).toLowerCase());
          if (i >= 0) merged[i] = { ...merged[i], ...c };
          else merged.push(c);
        }
        if (merged.length < current.length) return json({ error: 'Refusé : la liste des clients ne doit jamais diminuer' }, 409);
        /* copie de la liste précédente, au plus une toutes les 10 minutes, 20 gardées */
        try {
          if (current.length) {
            const { blobs } = await store.list({ prefix: 'historique/' });
            const cles = blobs.map(b => b.key).sort();
            const dernier = cles.length ? Number(cles[cles.length - 1].slice('historique/'.length)) : 0;
            if (Date.now() - dernier > 10 * 60 * 1000) {
              await store.set('historique/' + Date.now(), JSON.stringify(current));
              for (let i = 0; i < cles.length + 1 - 20; i++) await store.delete(cles[i]);
            }
          }
        } catch (e) { console.error('Historique clients impossible :', e.message); }
        const ecrit = actuel && actuel.etag
          ? await store.setJSON('clients', merged, { onlyIfMatch: actuel.etag })
          : await store.setJSON('clients', merged, { onlyIfNew: true });
        if (ecrit && ecrit.modified === false) continue;      /* quelqu'un est passé avant : on recommence */
        return json({ ok: true, clients: merged });
      }
      return json({ error: 'Enregistrement des clients en conflit, réessayez' }, 409);
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* ── Informations de l'entreprise : valeurs en vigueur (défauts + enregistrées) ── */
  if (path === '/entreprise' && request.method === 'GET') {
    try {
      const e = await lireEntreprise();
      return json({ pub: e.pub, priv: e.priv, defauts: e.defauts });
    } catch (err) { return json({ error: err.message }, 500); }
  }

  /* ── Contrat de location (Word) aux informations de l'entreprise ── */
  if (path === '/contrat' && request.method === 'GET') {
    try {
      const e = await lireEntreprise();
      const buf = await contratWord(e.pub);
      return new Response(buf, { status: 200, headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': 'attachment; filename="Contrat_de_Location_Vespra_Event.docx"',
        'cache-control': 'no-store' } });
    } catch (err) { return json({ error: err.message }, 500); }
  }

  /* ── Numéros de devis et de factures déjà attribués ────────────────
     {devis:{<id>:'D2026-0001'}, factures:{<id>:'2026-0001'}} : le back-office
     les affiche à côté du nom du client et les utilise dans la recherche. */
  if (path === '/numeros' && request.method === 'GET') {
    try {
      const store = await blobStore(DATA_STORE);
      const lire = async (dossier) => {
        const { blobs } = await store.list({ prefix: `${dossier}/` });
        const out = {};
        await Promise.all((blobs || []).map(async (b) => {
          const f = await store.get(b.key, { type: 'json' }).catch(() => null);
          if (f && f.numero) out[decodeURIComponent(b.key.slice(dossier.length + 1))] = f.numero;
        }));
        return out;
      };
      const [devis, factures] = await Promise.all([lire('devis'), lire('factures')]);
      return json({ devis, factures });
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* ── Sauvegardes et récupération ──────────────────────────────── */
  if (path === '/sauvegardes' && request.method === 'GET') {
    try {
      const [sauvegardes, corbeille] = await Promise.all([secu.listerSauvegardes(), secu.listerCorbeille()]);
      return json({ sauvegardes, corbeille });
    } catch (e) { return json({ error: e.message }, 500); }
  }
  if (path === '/sauvegardes' && request.method === 'POST') {
    try {
      let body = {}; try { body = await request.json(); } catch {}
      if (body.motif === 'auto') return json({ ok: true, ...(await secu.sauvegardeDuJour()) });
      return json({ ok: true, ...(await secu.creerSauvegarde({ motif: 'manuel' })) });
    } catch (e) { return json({ ok: false, error: e.message }, 500); }
  }
  if (path === '/sauvegarde' && request.method === 'GET') {
    try {
      const cle = url.searchParams.get('cle') || '';
      const texte = await secu.lireSauvegarde(cle);
      if (!texte) return json({ error: 'Introuvable' }, 404);
      return new Response(texte, { headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="vespra-sauvegarde-${cle}.json"`,
        'cache-control': 'no-store',
      } });
    } catch (e) { return json({ error: e.message }, 500); }
  }
  /* aperçu : ce que la sauvegarde contient et qui manque aujourd'hui */
  if (path === '/sauvegarde-manquantes' && request.method === 'GET') {
    try {
      const [dedans, actuelles] = await Promise.all([
        secu.reservationsDeLaSauvegarde(url.searchParams.get('cle') || ''), secu.reservationsActuelles()]);
      const manquantes = dedans.filter(x => !actuelles.has(String(x.id))).map(x => {
        let r = {}; try { r = JSON.parse(x.d); } catch {}
        return { id: String(x.id), client: r.client || '', dateStart: r.dateStart || '' };
      });
      return json({ total: dedans.length, manquantes });
    } catch (e) { return json({ error: e.message }, 500); }
  }
  if (path === '/restaurer' && request.method === 'POST') {
    try {
      const body = await request.json();
      const actuelles = await secu.reservationsActuelles();
      const aRemettre = [];
      if (body.source === 'corbeille') {
        aRemettre.push(await secu.lireCorbeille(String(body.cle || '')));
      } else if (body.source === 'sauvegarde') {
        const dedans = await secu.reservationsDeLaSauvegarde(String(body.cle || ''));
        for (const x of dedans) {
          if (body.id && String(x.id) !== String(body.id)) continue;
          aRemettre.push(x);
        }
      } else return json({ error: 'Source inconnue' }, 400);
      let remises = 0, ignorees = 0;
      for (const x of aRemettre) {
        if (!x || !x.id || !x.d) continue;
        /* jamais d'écrasement : seulement ce qui manque (sauf une réservation précise demandée) */
        if (actuelles.has(String(x.id)) && !(body.id && body.ecraser === true)) { ignorees++; continue; }
        await saveBlobItem('reservations', { id: String(x.id), d: x.d, _created: x._created }, secret);
        remises++;
      }
      return json({ ok: true, remises, ignorees });
    } catch (e) { return json({ ok: false, error: e.message }, 500); }
  }


  /* ── Réponse automatique (mail après une demande, délai réglable) : activer / désactiver, textes modifiables ── */
  if (path === '/reponse-auto' && request.method === 'GET') {
    try {
      const st = await blobStore(DATA_STORE);
      return json({ reglage: await repAuto.lireReglage(st), defauts: repAuto.DEFAUTS });
    } catch (e) { return json({ error: e.message }, 500); }
  }
  if (path === '/reponse-auto' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    try {
      const st = await blobStore(DATA_STORE);
      const r = repAuto.fusion(b);
      await st.setJSON(repAuto.CLE, r);
      const relu = await repAuto.lireReglage(st);
      return json({ ok: true, reglage: relu, verifie: relu.actif === r.actif && relu.devis.message === r.devis.message && relu.sans.message === r.sans.message });
    } catch (e) { return json({ ok: false, error: e.message }, 500); }
  }

  /* Envoi d'un mail d'essai à votre propre adresse : vérifie la clé d'envoi, l'expéditeur et la mise en page. */
  if (path === '/reponse-auto-test' && request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const cleApi = process.env.RESEND_API_KEY;
    if (!cleApi) return json({ ok: false, error: 'Clé d’envoi (RESEND_API_KEY) absente chez Netlify.' });
    try {
      const st = await blobStore(DATA_STORE);
      const rg = await repAuto.lireReglage(st);
      const site = (process.env.URL || 'https://www.vespraevent.fr').replace(/\/$/, '');
      const dest = process.env.NOTIFY_REPLY_TO || 'vespraevent@gmail.com';
      let objet, html;
      if (b.type === 'avis') {
        objet = '[ESSAI] ' + rg.avis.objet;
        html = htmlAvis({ txt: rg.avis, lienGoogle: rg.avis.lienGoogle, produits: [{ nom: 'Photobooth en bois', url: site + '/produit-photobooth.html#avis' }, { nom: 'Barnum 4×6 m', url: site + '/produit-barnum-4x6.html#avis' }], emetteur: EMETTEUR, site });
      } else if (b.type === 'accuse-devis' || b.type === 'accuse-sans') {
        const avecDevis = b.type === 'accuse-devis';
        const txt = avecDevis ? rg.devis : rg.sans;
        objet = '[ESSAI] ' + txt.objet;
        const items = [{ nom: 'Photobooth', detail: 'Formule Digital · Impression illimitée', prix: '150 €' }, { nom: 'Machine à fumée lourde', detail: '', prix: '60 €' }];
        html = htmlAccuse({ txt, prenom: 'Thomas', site, emetteur: EMETTEUR, avecDevis,
          recap: { date: '12/06/2027', items, livraison: !avecDevis, adresse: avecDevis ? '' : '12 rue des Lilas, 35500 Vitré', reprise: avecDevis ? '' : 'Reprise du matériel demandée', total: 210, surDevis: false } });
      } else {
        const txt = b.type === 'relance-sans' ? rg.relance.sans : rg.relance.avec;
        objet = '[ESSAI] ' + txt.objet;
        html = htmlRelance({ txt, site, emetteur: EMETTEUR });
      }
      const r = await fetch('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${cleApi}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>', to: [dest], subject: objet, html }) });
      if (!r.ok) return json({ ok: false, error: 'Resend a refusé l’envoi (code ' + r.status + ') : ' + (await r.text()).slice(0, 200) });
      return json({ ok: true, dest });
    } catch (e) { return json({ ok: false, error: e.message }, 500); }
  }

  /* ── Identifiants administrateur modifiables depuis le back-office ── */
  if (path === '/admin-settings' && request.method === 'GET') {
    try {
      const c = await getEffectiveCredentials();
      return json({ username: c.username });
    } catch (e) { return json({ error: e.message }, 500); }
  }
  if (path === '/admin-settings' && request.method === 'POST') {
    try {
      const body = await request.json();
      const newUser = String(body.username || '').trim();
      const newPassword = String(body.password || '');
      if (!newUser || newUser.length < 3) return json({ error: 'Identifiant invalide (3 caractères minimum).' }, 400);
      if (!newPassword || newPassword.length < 8) return json({ error: 'Mot de passe invalide (8 caractères minimum).' }, 400);
      const passwordRecord = hashAdminPassword(newPassword);
      const store = await blobStore(AUTH_STORE);
      await store.set('credentials', JSON.stringify({ username: newUser, passwordRecord, updatedAt: new Date().toISOString() }));
      return json({ ok: true, username: newUser, message: 'Identifiants administrateur enregistrés.' });
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* ── Migration unique Netlify Forms → Netlify Blobs ────────────────
     La migration lit les anciennes soumissions avant toute suppression.
     Elle est protégée par la session admin et peut être relancée sans
     écraser les données publiques : les clés restent stables. */
  if (path === '/migrate-blobs' && request.method === 'POST') {
    try {
      const map = {
        produits: PRODUCT_FORM, blog: BLOG_FORM, theme: THEME_FORM,
        textes: TEXTE_FORM, google: GOOGLE_FORM, notices: NOTICE_FORM, images: IMAGE_FORM,
        reservations: RESA_FORM, suivi: SUIVI_FORM, logistique: LOGISTIQUE_FORM,
      };
      const result = { collections: {}, avis: 0, avisDemandes: 0, fichiers: 0, erreurs: [] };
      const mediaMap = {};

      try {
        const { subs } = await netlifyFormSubmissions(FICHIER_FORM);
        const media = await blobStore(MEDIA_STORE);
        for (const sub of subs) {
          const d = sub.data || {};
          const f = typeof d.fichier === 'string' ? d.fichier : d.fichier?.url;
          if (!f) continue;
          try {
            const r = await fetch(f);
            if (!r.ok) continue;
            const buf = await r.arrayBuffer();
            const filename = (d.fichier?.name || f.split('/').pop() || 'fichier').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);
            const key = `uploads/migration-${sub.id}-${filename}`;
            await media.set(key, buf, {
              metadata: { contentType: r.headers.get('content-type') || 'application/octet-stream', filename },
            });
            mediaMap[f] = `/api/media/${encodeURIComponent(key)}`;
            if (d.ref) mediaMap[d.ref] = mediaMap[f];
            result.fichiers++;
          } catch (e) { result.erreurs.push(`fichier ${sub.id}: ${e.message}`); }
        }
      } catch (e) { result.erreurs.push(`fichiers-admin: ${e.message}`); }

      const replaceUrls = (value) => {
        if (typeof value === 'string') {
          let out = value;
          for (const [from, to] of Object.entries(mediaMap)) out = out.split(from).join(to);
          return out;
        }
        if (Array.isArray(value)) return value.map(replaceUrls);
        if (value && typeof value === 'object') {
          for (const k of Object.keys(value)) value[k] = replaceUrls(value[k]);
        }
        return value;
      };

      for (const [collection, formName] of Object.entries(map)) {
        try {
          const { subs } = await netlifyFormSubmissions(formName);
          const current = latestById(subs);
          let n = 0;
          for (const item of current) {
            const copy = replaceUrls(JSON.parse(JSON.stringify(item)));
            delete copy._submissionId;
            await saveBlobItem(collection, copy, secret);
            n++;
          }
          result.collections[collection] = n;
        } catch (e) { result.erreurs.push(`${collection}: ${e.message}`); }
      }

      try {
        const { subs } = await netlifyFormSubmissions(AVIS_FORM);
        for (const sub of subs) {
          const d = sub.data || {};
          if (d.p && d.t) { await savePublishedReview(d); result.avis++; }
        }
      } catch (e) { result.erreurs.push(`avis-valides: ${e.message}`); }

      /* Les avis clients encore en attente sont également conservés. */
      try {
        const { subs } = await netlifyFormSubmissions('avis-produit');
        const reviewStore = await blobStore(REVIEW_STORE);
        for (const sub of subs) {
          const d = sub.data || {};
          if (!d.produit || !d.avis) continue;
          const id = createHash('sha256').update(String(sub.id)).digest('hex').slice(0, 24);
          await reviewStore.set(`pending/migration-${id}`, JSON.stringify({
            id: `migration-${id}`,
            produit: d.produit,
            nom: d.nom || d.prenom || '',
            note: parseInt(d.note,10) || 5,
            avis: d.avis,
            email: d.email || '',
            _created: sub.created_at || new Date().toISOString(),
            status: 'pending',
          }));
          result.avisDemandes++;
        }
      } catch (e) { result.erreurs.push(`avis-produit: ${e.message}`); }

      const marker = await blobStore();
      await marker.set('_system/migration', JSON.stringify({ doneAt: new Date().toISOString(), result }));
      await viderCache();
      return json({ ok: true, ...result, message: 'Migration terminée. Vérifiez le back-office avant de supprimer les anciens formulaires Netlify.' });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  /* Suppression finale des anciens Forms internes.
     On ne l'autorise que si un marqueur de migration existe et ne signale
     aucune erreur. Les trois formulaires publics devis / reservation /
     newsletter ne sont jamais touchés. */
  if (path === '/cleanup-netlify-forms' && request.method === 'POST') {
    try {
      const marker = await blobStore().get('_system/migration', { type: 'json', consistency: 'strong' });
      if (!marker?.result) {
        return json({ error: 'Migration initiale absente : lancez la migration avant de supprimer les anciens Forms.' }, 409);
      }
      const keep = new Set(['devis', 'reservation', 'newsletter', 'rendez-vous']);
      const forms = await netlifyApi(`/sites/${await siteId()}/forms`);
      const internalNames = new Set([...INTERNAL_FORMS, 'avis-produit']);
      const deleted = [];
      for (const form of forms) {
        if (keep.has(form.name)) continue;
        if (!internalNames.has(form.name)) continue;
        try {
          await netlifyApi(`/sites/${await siteId()}/forms/${encodeURIComponent(form.id)}`, { method: 'DELETE' });
          deleted.push(form.name);
        } catch (e) {
          return json({ error: `Impossible de supprimer ${form.name}: ${e.message}`, deleted }, 500);
        }
      }
      return json({ ok: true, deleted, kept: [...keep] });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  /* ---- CRUD produits / blog ---- */
  if (path === '/data' && request.method === 'GET') {
    const collection = url.searchParams.get('collection');
    const formName = formDe(collection);
    if (!formName) return json({ error: 'collection invalide' }, 400);
    /* empreinte légère : une seule liste, aucune lecture d'enregistrement */
    if (url.searchParams.get('empreinte') && INTERNAL_FORMS.has(formName) && formName !== AVIS_FORM) {
      try {
        const store = await blobStore();
        const { blobs } = await store.list({ prefix: `${collection}/` });
        /* sans empreinte fiable de chaque enregistrement, on ne prétend pas qu'il n'a pas changé */
        if (blobs.some((b) => !b.etag)) return json({ h: null, n: blobs.length });
        const txt = blobs.map((b) => `${b.key}:${b.etag || ''}`).sort().join('|');
        /* réservations supprimées ces dernières 24 h (les plus anciens marqueurs sont effacés) */
        let sup = [];
        if (collection === 'reservations') {
          try {
            const { blobs: marques } = await store.list({ prefix: 'tombs/' });
            const maintenant = Date.now();
            for (const m of marques) {
              const mm = /^tombs\/(\d+)-(.+)$/.exec(m.key);
              if (!mm) continue;
              const age = maintenant - Number(mm[1]);
              if (age > 3 * 86400000) { try { await store.delete(m.key); } catch {} continue; }
              if (age <= 86400000) sup.push(decodeURIComponent(mm[2]));
            }
            sup = sup.slice(-300);
          } catch { sup = []; }
        }
        return json({ h: createHash('sha256').update(txt).digest('hex').slice(0, 24), n: blobs.length, sup });
      } catch (e) { return json({ error: e.message }, 500); }
    }
    try {
      const { subs } = await formSubmissions(formName);
      const courantes = latestById(subs);
      /* _valide indique si l'enregistrement s'affiche sur le site public :
         utile pour repérer un envoi non signé déposé par un tiers. */
      const items = courantes.map((it) => ({ ...it, _valide: itemSignatureValid(it, secret) }));
      /* les versions dépassées s'effacent au fil des consultations */
      try { await nettoyerVersionsPerimees(subs, courantes); } catch {}
      return json(items);
    } catch (e) { return json({ error: e.message }, 500); }
  }

  if (path === '/data' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const { collection, item } = body;
    const formName = formDe(collection);
    if (!formName || !item || !item.id) return json({ error: 'collection ou item invalide' }, 400);
    try {
      await submitToForm(formName, item, secret);
      let verified = false;
      if (INTERNAL_FORMS.has(formName) && formName !== AVIS_FORM) {
        const saved = await verifyBlobItem(collection, item.id, secret);
        verified = String(saved.id) === String(item.id);
      } else if (formName === AVIS_FORM) {
        verified = true;
      } else {
        /* Les trois formulaires publics restent gérés par Netlify Forms.
           Ils ne sont pas utilisés pour publier le contenu administrable. */
        verified = true;
      }
      /* une réservation n'apparaît pas sur le site public : inutile de vider le cache */
      const cache = collection === 'reservations' ? 'inutile' : await viderCache();
      return json({ ok: true, verified, cache, published: true, savedAt: new Date().toISOString() });
    } catch (e) { return json({ ok: false, error: e.message, verified: false }, 500); }
  }

  if (path === '/data' && request.method === 'DELETE') {
    const collection = url.searchParams.get('collection');
    const id = url.searchParams.get('id');
    const formName = formDe(collection);
    if (!formName || !id) return json({ error: 'collection ou id invalide' }, 400);
    try {
      /* corbeille : une copie est gardée avant toute suppression, pour
         pouvoir retrouver une réservation supprimée par erreur */
      if (collection === 'reservations' && id !== 'cfg') {
        try {
          const st = await blobStore();
          const avant = await st.get(blobKey(collection, id), { type: 'text', consistency: 'strong' });
          if (avant) await st.set(`corbeille/${encodeURIComponent(String(id))}-${Date.now()}`, avant, { metadata: { supprimeLe: new Date().toISOString(), id: String(id) } });
        } catch (e) { console.error('Corbeille impossible :', e.message); }
      }
      const n = await deleteAllSubmissionsWithId(formName, id);
      if (INTERNAL_FORMS.has(formName) && formName !== AVIS_FORM) {
        const store = await blobStore();
        const remaining = await store.get(blobKey(collection, id), { type: 'json', consistency: 'strong' });
        if (remaining !== null && remaining !== undefined) throw new Error(`Suppression non confirmée pour ${collection}/${id}`);
      }
      /* marqueur de suppression : les autres appareils retirent aussitôt la
         réservation de leur planning, sans attendre plusieurs relectures */
      if (collection === 'reservations' && id !== 'cfg') {
        try {
          const st = await blobStore();
          await st.set(`tombs/${Date.now()}-${encodeURIComponent(String(id))}`, '1');
        } catch (e) { console.error('Marqueur de suppression impossible :', e.message); }
      }
      const cache = await viderCache();
      return json({ ok: true, deleted: n, verified: true, cache, published: true });
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* ---- demandes de devis venues du site ----------------------------
     Les demandes arrivent dans le formulaire public « reservation » :
     elles ne sont jamais modifiées ici. Leur suivi (nouvelle, en cours,
     validée) est enregistré à part, dans « suivi-demandes-admin », et
     rapproché de la demande par l'identifiant que Netlify lui a donné.
     Une demande sans suivi est donc « nouvelle » par défaut.
     ------------------------------------------------------------------ */
  if (path === '/demandes' && request.method === 'GET') {
    try {
      /* La lecture des demandes des clients passe par l'API Netlify. Si
         elle échoue — jeton absent, panne passagère — ce n'est pas une
         raison pour vider toute la page : on renvoie ce qu'on a, et le
         planning reste visible dans la liste des réservations. */
      const lectures = await Promise.all(
        FORMULAIRES_DEMANDES.map((nom) =>
          formSubmissions(nom)
            .then((r) => (r.subs || []).map((s) => ({ ...s, _formulaire: nom })))
            .catch((e) => {
              console.error(`Demandes « ${nom} » illisibles :`, e.message);
              return [];
            })
        ).concat([
          formSubmissions(SUIVI_FORM).then(({ subs }) => suivisFusionnes(subs)).catch(() => []),
        ])
      );
      const suivis = lectures.pop();
      /* un même envoi ne doit pas ressortir deux fois */
      const vus = new Set();
      const subs = lectures.flat().filter((s) => {
        if (!s || vus.has(s.id)) return false;
        vus.add(s.id); return true;
      });
      const parId = new Map(suivis.map((x) => [x.id, x]));
      /* Une demande envoyée par un client n'est jamais réécrite : ce qu'il
         a saisi reste tel quel chez Netlify. Les corrections faites depuis
         le back-office sont enregistrées à côté et appliquées par-dessus à
         la lecture — on peut donc toujours revenir à l'original. */
      /* un champ que l'on a vidé à la main reste vide : une correction vide
         l'emporte sur la valeur d'origine pour ces champs-là */
      const VIDABLES = ['telephone', 'email', 'message', 'adresse', 'convives', 'type', 'datefin'];
      const corrige = (suivi, champ, valeur) => {
        const c = suivi['c_' + champ];
        if (c === undefined || c === null) return valeur;
        if (c === '__vide__') return '';
        if (c === '' && !VIDABLES.includes(champ)) return valeur;
        return c;
      };

      const items = subs.map((sub) => {
        const d = sub.data || {};
        const suivi = parId.get(sub.id) || {};
        return {
          id: sub.id,
          recue: sub.created_at,
          refEspace: String(d.ref_espace || ''),
          statut: suivi.statut || 'nouvelle',
          resaId: suivi.resaId || '',
          /* photobooth uniquement : où en est la création du cadre */
          cadre: suivi.cadre || '',
          /* suivi des relances et retraits faits depuis le back-office */
          appel: suivi.appel === 'oui',
          mail: suivi.mail === 'oui',
          optsRetirees: suivi.optsRetirees ? String(suivi.optsRetirees).split('|').filter(Boolean) : [],
          montageRetire: suivi.montageRetire ? String(suivi.montageRetire).split('|').filter(Boolean) : [],
          montageAjoute: suivi.montageAjoute ? String(suivi.montageAjoute).split('|').filter(Boolean) : [],
          note: suivi.note || '',
          nom: corrige(suivi, 'nom', [d.prenom, d.nom].filter(Boolean).join(' ') || d.nom || d.name || ''),
          email: corrige(suivi, 'email', d.email || ''),
          telephone: corrige(suivi, 'telephone', d.telephone || d.tel || ''),
          date: corrige(suivi, 'date', d.date || ''),
          heure: String(d.heure || ''),
          /* rendez-vous sans jour valide : probablement un message automatique */
          suspect: sub._formulaire === 'rendez-vous' && !/^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})$/.test(String(d.date || '').trim()),
          convives: corrige(suivi, 'convives', d.convives || ''),
          /* le formulaire de l'accueil nomme ce champ « type-evenement » */
          type: corrige(suivi, 'type', d.type || d['type-evenement'] || ''),
          demande: d.demande || '',
          livraison: corrige(suivi, 'livraison', d.livraison || ''),
          adresse: corrige(suivi, 'adresse', d.adresse_livraison || ''),
          message: corrige(suivi, 'message', d.message || ''),
          /* mêmes informations que sur la réservation du planning */
          dateFin: corrige(suivi, 'datefin', ''),
          source: corrige(suivi, 'source', ''),
          validePar: corrige(suivi, 'validepar', ''),
          panier: corrige(suivi, 'panier', d.cartData || ''),
          materiel: suivi.c_materiel || '',
          categories: d.catsData || '',
          origine: d.origine || d.connu || '',
          clientType: d.client_type || '', societe: d.societe || '', siret: d.siret || '', tva: d.tva || '',
          /* les catégories cochées sur le formulaire court de l'accueil :
             sans panier, c'est la seule indication de matériel */
          interets: d.interets || d.materiel || '',
          parrainageStatut: suivi.parrainageStatut === 'valide' || suivi.parrainageStatut === 'refuse' ? suivi.parrainageStatut : '',
          /* offre mariage : accordée à la main (« oui »), refusée (« non »), ou jamais tranchée ;
             la page « Pack mariage » du site la demande d'office */
          offreMariage: suivi.offreMariage === 'oui' ? true : (suivi.offreMariage === 'non' ? false : null),
          packMariage: String(d.pack_mariage || '').trim(),
          /* acompte : montant demandé sur le dernier devis, et reçu ou non */
          devisAcompte: Number(suivi.devisAcompte) > 0 ? Number(suivi.devisAcompte) : 0,
          acompteRecu: suivi.acompteRecu === 'oui',
          /* code de parrainage saisi par le client : 10 € à déduire */
          parrainage: String(d.parrainage || '').trim().toUpperCase(),
          /* montants chiffrés depuis le back-office */
          livraisonPrix: suivi.livraisonPrix !== undefined && suivi.livraisonPrix !== ''
            ? Number(suivi.livraisonPrix) || 0 : null,
          montagePrix: suivi.montagePrix !== undefined && suivi.montagePrix !== ''
            ? Number(suivi.montagePrix) || 0 : null,
          /* saisies de la fenêtre « Devis » : adresse du client, type de client, acompte prévu */
          devisAdresse: String(suivi.devisAdresse || ''),
          devisPro: suivi.devisPro === 'oui',
          devisSiret: String(suivi.devisSiret || ''),
          devisTva: String(suivi.devisTva || ''),
          devisAvecAcompte: suivi.devisAvecAcompte === 'oui',
          prixLignes: (() => { try { const o = JSON.parse(suivi.prixLignes || ''); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; } })(),
          /* « reprise du matériel comprise » : coché → true, décoché → false, jamais choisi → absent */
          livraisonRetour: suivi.livraisonRetour === 'oui' ? true : (suivi.livraisonRetour === 'non' ? false
            /* pas encore tranché par Thomas : on reprend le choix du client sur le site */
            : (/^oui/i.test(String(d.reprise_materiel || '')) ? true : (/^non/i.test(String(d.reprise_materiel || '')) ? false : null))),
          formulaire: sub._formulaire || 'reservation',
        };
      }).sort((a, b) => new Date(b.recue) - new Date(a.recue));
      /* mail automatique « bien reçu » : on ne marque que les demandes récentes de la même adresse */
      try {
        const st = getStore(DATA_STORE);
        const mails = [...new Set(items.filter((x) => x.email && Date.now() - new Date(x.recue) < 3 * 864e5).map((x) => String(x.email).trim().toLowerCase()))];
        const marques = {};
        await Promise.all(mails.map(async (m) => {
          try { const v = await st.get('accuse/' + encodeURIComponent(m), { type: 'json' }); if (v && v.envoye) marques[m] = Number(v.envoye); } catch {}
        }));
        items.forEach((x) => {
          const t = marques[String(x.email || '').trim().toLowerCase()], r = new Date(x.recue).getTime();
          if (t && r <= t + 1000 && t - r < 30 * 60 * 1000) x.accuseEnvoye = new Date(t).toISOString();
        });
      } catch {}
      return json(items);
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* changement de statut : on n'écrit que le suivi, jamais la demande */
  if (path === '/demandes' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const statuts = ['nouvelle', 'en-cours', 'validee'];
    const cadres = ['', 'a-creer', 'en-cours', 'termine'];
    if (!body.id || !statuts.includes(body.statut)) return json({ error: 'demande ou statut invalide' }, 400);
    if (body.cadre !== undefined && !cadres.includes(body.cadre)) return json({ error: 'avancement du cadre invalide' }, 400);
    try {
      const champs = {
        id: String(body.id),
        statut: body.statut,
        resaId: body.resaId ? String(body.resaId) : '',
        cadre: body.cadre || '',
        note: body.note ? String(body.note).slice(0, 1500) : '',
        /* relances passées et lignes retirées à la main : ce sont des
           notes internes, elles ne touchent jamais la demande du client */
        appel: body.appel === 'oui' ? 'oui' : '',
        mail: body.mail === 'oui' ? 'oui' : '',
        optsRetirees: body.optsRetirees ? String(body.optsRetirees).slice(0, 1200) : '',
        montageRetire: body.montageRetire ? String(body.montageRetire).slice(0, 400) : '',
        montageAjoute: body.montageAjoute ? String(body.montageAjoute).slice(0, 400) : '',
        /* Deux montants chiffrés à la main sur la demande, avant même
           qu'elle soit au planning : le déplacement, et le travail sur
           place (montage d'une structure, lancement des feux…). Ils
           servent au devis, puis suivent la réservation. */
        /* vide = pas encore chiffré ; 0 = chiffré à 0 € (livraison offerte), il reste sur le devis */
        livraisonPrix: body.livraisonPrix !== undefined && body.livraisonPrix !== null && String(body.livraisonPrix).trim() !== ''
          ? String(Math.max(0, Number(body.livraisonPrix) || 0)) : '',
        montagePrix: body.montagePrix !== undefined && body.montagePrix !== null && String(body.montagePrix).trim() !== ''
          ? String(Math.max(0, Number(body.montagePrix) || 0)) : '',
        /* prix de lignes modifiés à la main avant validation (JSON { « produit|formule » : prix }) */
        prixLignes: body.prixLignes ? String(body.prixLignes).slice(0, 1500) : '',
        /* remise de parrainage : « valide » (appliquée) ou « refuse » ; vide = pas encore tranché */
        parrainageStatut: body.parrainageStatut === 'valide' || body.parrainageStatut === 'refuse' ? body.parrainageStatut : '',
        offreMariage: body.offreMariage === 'oui' || body.offreMariage === true ? 'oui' : (body.offreMariage === 'non' || body.offreMariage === false ? 'non' : ''),
        devisAcompte: Number(body.devisAcompte) > 0 ? String(Math.round(Number(body.devisAcompte) * 100) / 100) : '',
        acompteRecu: body.acompteRecu === 'oui' || body.acompteRecu === true ? 'oui' : '',
        livraisonRetour: body.livraisonRetour === 'oui' || body.livraisonRetour === true ? 'oui'
          : (body.livraisonRetour === 'non' || body.livraisonRetour === false ? 'non' : ''),
        /* saisies de la fenêtre « Devis » : elles suivent la demande sur tous les appareils */
        devisAdresse: body.devisAdresse ? String(body.devisAdresse).slice(0, 600) : '',
        devisPro: body.devisPro === 'oui' || body.devisPro === true ? 'oui' : '',
        devisSiret: body.devisSiret ? String(body.devisSiret).slice(0, 40) : '',
        devisTva: body.devisTva ? String(body.devisTva).slice(0, 40) : '',
        devisAvecAcompte: body.devisAvecAcompte === 'oui' || body.devisAvecAcompte === true ? 'oui' : '',
      };
      /* un champ absent de l'envoi (ancienne copie du back-office) reprend la valeur enregistrée */
      const CHAMPS_DEVIS = ['devisAdresse', 'devisPro', 'devisSiret', 'devisTva', 'devisAvecAcompte'];
      /* corrections apportées depuis le back-office, préfixées c_ pour ne
         jamais se confondre avec les champs de suivi */
      const CORRIGEABLES = ['nom', 'telephone', 'email', 'date', 'convives',
                            'type', 'livraison', 'adresse', 'message', 'materiel',
                            'datefin', 'source', 'validepar'];
      if (body.corrections && typeof body.corrections === 'object') {
        for (const champ of CORRIGEABLES) {
          const v = body.corrections[champ];
          if (v !== undefined && v !== null) {
            /* un champ vidé est marqué : un envoi vide pourrait être perdu en route et l'ancienne valeur reviendrait */
            champs['c_' + champ] = (String(v) === '' && ['telephone', 'email', 'message', 'adresse', 'convives', 'type', 'datefin'].includes(champ))
              ? '__vide__' : String(v).slice(0, 1200);
          }
        }
        /* le panier corrigé est du JSON : il lui faut plus de place que
           les autres corrections, qui sont des champs de formulaire */
        const panier = body.corrections.panier;
        if (panier !== undefined && panier !== null) {
          champs.c_panier = String(panier).slice(0, 8000);
        }
      }
      /* Chaque enregistrement du suivi est une nouvelle ligne, et seule la
         dernière fait foi : sans précaution, un simple changement de statut
         ou de note effaçait les corrections déjà faites (produits, nom,
         date…). On reporte donc ici les corrections précédentes que cet
         envoi ne mentionne pas ; une correction envoyée (même vide) l'emporte. */
      let modifFond = false;
      try {
        /* au plus 3,5 s : l'enregistrement du statut ne doit jamais attendre cette relecture */
        const { subs: anciens } = await Promise.race([
          formSubmissions(SUIVI_FORM),
          new Promise((_, rej) => setTimeout(() => rej(new Error('relecture trop longue')), 3500)),
        ]);
        const precedent = latestById(anciens).find((x) => String(x.id) === String(body.id));
        /* une modification de fond rend périmé le devis déjà enregistré pour cette demande */
        const SENSIBLES = ['livraisonPrix', 'montagePrix', 'prixLignes', 'parrainageStatut', 'offreMariage', 'devisAcompte', 'livraisonRetour', 'devisAdresse', 'devisPro', 'devisSiret', 'devisTva', 'devisAvecAcompte'];
        if (precedent) {
          for (const k of Object.keys(champs)) {
            if ((k.startsWith('c_') || SENSIBLES.includes(k)) && String(champs[k] ?? '') !== String(precedent[k] ?? '')) { modifFond = true; break; }
          }
        }
        if (precedent) {
          for (const k of CHAMPS_DEVIS) {
            if (body[k] === undefined && precedent[k] !== undefined) champs[k] = precedent[k];
          }
          for (const [k, v] of Object.entries(precedent)) {
            if (!k.startsWith('c_') || champs[k] !== undefined || v === undefined || v === null) continue;
            if (v === '' && !['c_telephone', 'c_email', 'c_message', 'c_adresse', 'c_convives', 'c_type', 'c_datefin'].includes(k)) continue;
            champs[k] = v;
          }
        }
      } catch (e) { console.error('Corrections précédentes illisibles :', e.message); }
      await submitToForm(SUIVI_FORM, champs, secret);
      /* demande modifiée : l'ancien devis enregistré ne doit pas survivre à la modification */
      if (modifFond) { try { await (await blobStore(DATA_STORE)).delete('demande-devis/' + encodeURIComponent(String(body.id))); } catch {} }
      return json({ ok: true });
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* suppression d'une demande : la demande d'origine et son suivi */
  if (path === '/demandes' && request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'identifiant absent' }, 400);
    try {
      await netlifyApi(`/submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await deleteAllSubmissionsWithId(SUIVI_FORM, String(id));
      /* rien ne doit rester d'une demande supprimée : devis enregistré, demandes de modification du client */
      try { await (await blobStore(DATA_STORE)).delete('demande-devis/' + encodeURIComponent(String(id))); } catch {}
      try {
        const st = await blobStore(AUTH_STORE);
        const { blobs } = await st.list({ prefix: 'espace/modif/' });
        for (const bl of blobs) {
          const m = await st.get(bl.key, { type: 'json', consistency: 'strong' }).catch(() => null);
          if (m && String(m.dossier) === 'd:' + String(id)) await st.delete(bl.key);
        }
      } catch {}
      return json({ ok: true });
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* ---- fichiers admin : upload direct vers Netlify Blobs ----------- */
  if (path === '/fichier' && request.method === 'POST') {
    try {
      const form = await request.formData();
      const fichier = form.get('fichier');
      if (!(fichier instanceof File)) return json({ error: 'Fichier absent' }, 400);
      if (fichier.size > 20 * 1024 * 1024) return json({ error: 'Fichier trop volumineux (20 Mo maximum)' }, 400);
      const safeName = String(fichier.name || 'fichier').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);
      const key = `uploads/${Date.now().toString(36)}-${randomUUID()}-${safeName}`;
      /* l'enregistrement et sa relecture échouent parfois ponctuellement côté
         stockage : on réessaie avant de signaler une erreur */
      const store = await blobStore(MEDIA_STORE);
      const octets = await fichier.arrayBuffer();
      let meta = null, derniere = null;
      for (let essai = 1; essai <= 3 && !meta; essai++) {
        try {
          await store.set(key, octets, {
            metadata: { contentType: fichier.type || 'application/octet-stream', filename: safeName },
          });
        } catch (e) { derniere = e; }
        {
          /* le fichier est enregistré : sa relecture n'est qu'une vérification.
             Si c'est la relecture seule qui échoue, on ne bloque pas l'envoi. */
          try {
            meta = await store.getMetadata(key, { consistency: 'strong' });
            if (meta) derniere = null;
          } catch (e) {
            try { meta = await store.getMetadata(key); } catch (e2) { derniere = derniere || e2; }
          }
        }
        if (!meta && essai < 3) await new Promise((ok) => setTimeout(ok, 400 * essai));
      }
      if (!meta) {
        return json({ error: derniere ? 'Stockage momentanément indisponible : ' + derniere.message : 'Le fichier a été envoyé mais sa relecture a échoué.' }, 503);
      }
      return json({ pdf: `/api/media/${encodeURIComponent(key)}`, verified: true, savedAt: new Date().toISOString() });
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* ---- justificatifs de charges (tickets, factures photographiées) ----
     Réservés au back-office connecté : la clé commence par « justificatifs/ »,
     donc jamais servie par la route publique /api/media. */
  if (path === '/justificatif') {
    try {
      const store = await blobStore(MEDIA_STORE);
      if (request.method === 'POST') {
        const form = await request.formData();
        const fichier = form.get('fichier');
        if (!(fichier instanceof File)) return json({ error: 'Fichier absent' }, 400);
        if (fichier.size > 5 * 1024 * 1024) return json({ error: 'Fichier trop volumineux (5 Mo maximum)' }, 400);
        const safeName = String(fichier.name || 'justificatif').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100);
        const key = `justificatifs/${Date.now().toString(36)}-${randomUUID()}-${safeName}`;
        const octets = await fichier.arrayBuffer();
        let ok = false, derniere = null;
        for (let essai = 1; essai <= 3 && !ok; essai++) {
          try {
            await store.set(key, octets, { metadata: { contentType: fichier.type || 'application/octet-stream', filename: safeName } });
            ok = true;
          } catch (e) { derniere = e; if (essai < 3) await new Promise((r) => setTimeout(r, 400 * essai)); }
        }
        if (!ok) return json({ error: 'Stockage momentanément indisponible : ' + (derniere && derniere.message) }, 503);
        return json({ ok: true, key, nom: safeName, type: fichier.type || '', taille: fichier.size });
      }
      const key = url.searchParams.get('key') || '';
      if (!key.startsWith('justificatifs/') || key.includes('..')) return json({ error: 'Clé invalide' }, 400);
      if (request.method === 'GET') {
        const meta = await store.getMetadata(key, { consistency: 'strong' });
        if (!meta) return new Response('Not found', { status: 404 });
        const data = await store.get(key, { type: 'arrayBuffer', consistency: 'strong' });
        const nom = String(url.searchParams.get('nom') || meta.metadata?.filename || 'justificatif').replace(/[^a-zA-Z0-9._ -]+/g, '-');
        return new Response(data, { headers: {
          'content-type': meta.metadata?.contentType || 'application/octet-stream',
          'content-disposition': `attachment; filename="${nom}"`,
          'cache-control': 'private, no-store',
        } });
      }
      if (request.method === 'DELETE') {
        await store.delete(key);
        return json({ ok: true });
      }
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* ---- documents du back-office (contrats, attestations…) ----
     Enregistrés ici et non plus dans le navigateur : on les retrouve sur tous les appareils.
     Réservés au back-office connecté : la clé commence par « documents/ », jamais servie par /api/media. */
  if (path === '/documents') {
    try {
      const store = await blobStore(MEDIA_STORE);
      if (request.method === 'GET' && !url.searchParams.get('key')) {
        const { blobs } = await store.list({ prefix: 'documents/' });
        const liste = [];
        for (const b of blobs) {
          let m = null;
          try { m = await store.getMetadata(b.key, { consistency: 'strong' }); } catch {}
          if (!m) continue;
          liste.push({ key: b.key, name: m.metadata?.filename || b.key.split('/').pop(), type: m.metadata?.contentType || '', at: Number(m.metadata?.at) || 0 });
        }
        liste.sort((a, b) => a.at - b.at);
        return json(liste);
      }
      if (request.method === 'POST') {
        const form = await request.formData();
        const fichier = form.get('fichier');
        if (!(fichier instanceof File)) return json({ error: 'Fichier absent' }, 400);
        if (fichier.size > 5 * 1024 * 1024) return json({ error: 'Fichier trop volumineux (5 Mo maximum)' }, 400);
        const nomAffiche = String(fichier.name || 'document').slice(0, 160);
        const safeName = nomAffiche.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100);
        const key = `documents/${Date.now().toString(36)}-${randomUUID()}-${safeName}`;
        const octets = await fichier.arrayBuffer();
        let ok = false, derniere = null;
        for (let essai = 1; essai <= 3 && !ok; essai++) {
          try {
            await store.set(key, octets, { metadata: { contentType: fichier.type || 'application/octet-stream', filename: nomAffiche, at: String(Date.now()) } });
            ok = true;
          } catch (e) { derniere = e; if (essai < 3) await new Promise((r) => setTimeout(r, 400 * essai)); }
        }
        if (!ok) return json({ error: 'Stockage momentanément indisponible : ' + (derniere && derniere.message) }, 503);
        return json({ ok: true, key, name: nomAffiche, type: fichier.type || '' });
      }
      const key = url.searchParams.get('key') || '';
      if (!key.startsWith('documents/') || key.includes('..')) return json({ error: 'Clé invalide' }, 400);
      if (request.method === 'GET') {
        const meta = await store.getMetadata(key, { consistency: 'strong' });
        if (!meta) return new Response('Not found', { status: 404 });
        const data = await store.get(key, { type: 'arrayBuffer', consistency: 'strong' });
        const nom = String(meta.metadata?.filename || 'document').replace(/[\r\n"]+/g, ' ');
        return new Response(data, { headers: {
          'content-type': meta.metadata?.contentType || 'application/octet-stream',
          'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
          'cache-control': 'private, no-store',
        } });
      }
      if (request.method === 'DELETE') {
        await store.delete(key);
        return json({ ok: true });
      }
    } catch (e) { return json({ error: e.message }, 500); }
  }

  /* ---- publication directe d'un avis (admin = pas besoin du lien e-mail) ---- */
  if (path === '/avis' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    const mois = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const d = mois.charAt(0).toUpperCase() + mois.slice(1);
    try {
      await submitToForm(AVIS_FORM, {
        p: (body.produit || '').slice(0, 200),
        n: (body.nom || '').slice(0, 200),
        s: String(Math.max(1, Math.min(5, parseInt(body.note, 10) || 5))),
        t: (body.texte || '').slice(0, 900),
        d,
      });
      await viderCache();
      return json({ ok: true });
    } catch (e) { return json({ error: e.message }, 500); }
  }

  if (path === '/data-delete-avis' && request.method === 'POST') {
    // suppression d'un avis publié (par contenu, les avis n'ont pas d'id)
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
    try {
      const ok = await deletePublishedReview(body.nom, body.texte);
      if (!ok) return json({ error: 'Avis introuvable' }, 404);
      await viderCache();
      return json({ ok: true });
    } catch (e) { return json({ error: e.message }, 500); }
  }

  return json({ error: 'Route inconnue' }, 404);
};
/* En-tête de diagnostic : nombre de requêtes Supabase et temps passé pour cet appel. */
export default async (request) => {
  const n0 = stockStats.n, ms0 = stockStats.ms, t0 = Date.now();
  const rep = await gestionnaire(request);
  try {
    if (stockageActif() !== 'supabase') return rep;
    const h = new Headers(rep.headers);
    h.set('x-stockage', `${stockStats.n - n0} req, ${stockStats.ms - ms0} ms cumulés, ${Date.now() - t0} ms total`);
    return new Response(rep.body, { status: rep.status, statusText: rep.statusText, headers: h });
  } catch { return rep; }
};
