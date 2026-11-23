/* ════════════════════════════════════════════════════
   Cloudflare R2 — stockage des photos et des vidéos
   ────────────────────────────────────────────────────
   R2 parle le protocole S3. Ce fichier signe les requêtes (AWS Signature v4) sans aucune bibliothèque,
   pour que le dossier reste déployable par simple glisser-déposer.

   Variables Netlify (jamais dans le code) :
     R2_ENDPOINT           https://<identifiant>.eu.r2.cloudflarestorage.com   (« .eu. » pour un espace européen)
     R2_BUCKET             nom du compartiment
     R2_ACCESS_KEY_ID      ID de clé d'accès
     R2_SECRET_ACCESS_KEY  clé d'accès secrète
   Tant qu'elles ne sont pas toutes définies, rien ne change : les fichiers restent dans Netlify Blobs.
   ════════════════════════════════════════════════════ */
import { createHash, createHmac } from 'node:crypto';

const env = () => ({
  ep: String(process.env.R2_ENDPOINT || '').trim().replace(/\/+$/, ''),
  bucket: String(process.env.R2_BUCKET || '').trim(),
  ak: String(process.env.R2_ACCESS_KEY_ID || '').trim(),
  sk: String(process.env.R2_SECRET_ACCESS_KEY || '').trim(),
});
export const r2Actif = () => { const e = env(); return !!(e.ep && e.bucket && e.ak && e.sk); };

const sha = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const encChemin = (cle) => String(cle).split('/').map(enc).join('/');
const VIDE = sha('');

/* Signature AWS v4. `date` et `region` sont réglables pour le test sur le vecteur officiel. */
export function signer({ method, host, path, query, headers, payloadHash, ak, sk, region = 'auto', service = 's3', date = new Date() }) {
  const amz = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const jour = amz.slice(0, 8);
  const h = Object.assign({}, headers || {}, { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amz });
  const noms = Object.keys(h).map((k) => k.toLowerCase()).sort();
  const val = (n) => String(h[Object.keys(h).find((x) => x.toLowerCase() === n)]).trim().replace(/\s+/g, ' ');
  const canonH = noms.map((n) => n + ':' + val(n) + '\n').join('');
  const signed = noms.join(';');
  const cq = Object.keys(query || {}).sort().map((k) => enc(k) + '=' + enc(query[k])).join('&');
  const canon = [method, path, cq, canonH, signed, payloadHash].join('\n');
  const portee = jour + '/' + region + '/' + service + '/aws4_request';
  const aSigner = ['AWS4-HMAC-SHA256', amz, portee, sha(canon)].join('\n');
  const cle = hmac(hmac(hmac(hmac('AWS4' + sk, jour), region), service), 'aws4_request');
  const signature = createHmac('sha256', cle).update(aSigner).digest('hex');
  return { amz, headers: h, authorization: 'AWS4-HMAC-SHA256 Credential=' + ak + '/' + portee + ', SignedHeaders=' + signed + ', Signature=' + signature };
}

async function appel(methode, cle, { query, corps } = {}) {
  const e = env();
  const u = new URL(e.ep);
  const chemin = '/' + enc(e.bucket) + (cle ? '/' + encChemin(cle) : '');
  const octets = corps == null ? null : (Buffer.isBuffer(corps) ? corps : Buffer.from(corps instanceof ArrayBuffer ? new Uint8Array(corps) : corps));
  const s = signer({ method: methode, host: u.host, path: chemin, query, headers: {}, payloadHash: octets ? sha(octets) : VIDE, ak: e.ak, sk: e.sk });
  const qs = Object.keys(query || {}).sort().map((k) => enc(k) + '=' + enc(query[k])).join('&');
  const entetes = { 'x-amz-content-sha256': s.headers['x-amz-content-sha256'], 'x-amz-date': s.amz, Authorization: s.authorization };
  if (octets) entetes['Content-Length'] = String(octets.length);
  return fetch(e.ep + chemin + (qs ? '?' + qs : ''), { method: methode, headers: entetes, body: octets || undefined });
}

/* Lien de téléchargement temporaire (signé dans l'adresse) : le fichier part directement de R2, sans passer par une fonction du site */
export function presigner({ host, path, ak, sk, region = 'auto', secondes = 600, extra = {}, date = new Date() }) {
  const amz = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const jour = amz.slice(0, 8);
  const portee = jour + '/' + region + '/s3/aws4_request';
  const q = Object.assign({ 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': ak + '/' + portee, 'X-Amz-Date': amz, 'X-Amz-Expires': String(secondes), 'X-Amz-SignedHeaders': 'host' }, extra);
  const cq = Object.keys(q).sort().map((k) => enc(k) + '=' + enc(q[k])).join('&');
  const canon = ['GET', path, cq, 'host:' + host + '\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const aSigner = ['AWS4-HMAC-SHA256', amz, portee, sha(canon)].join('\n');
  const cle = hmac(hmac(hmac(hmac('AWS4' + sk, jour), region), 's3'), 'aws4_request');
  return cq + '&X-Amz-Signature=' + createHmac('sha256', cle).update(aSigner).digest('hex');
}
export function r2LienTemporaire(cle, secondes = 600, nomFichier = '') {
  const e = env(), u = new URL(e.ep);
  const extra = nomFichier ? { 'response-content-disposition': 'attachment; filename="' + String(nomFichier).replace(/"/g, '') + '"' } : {};
  return e.ep + '/' + enc(e.bucket) + '/' + encChemin(cle) + '?' + presigner({ host: u.host, path: '/' + enc(e.bucket) + '/' + encChemin(cle), ak: e.ak, sk: e.sk, secondes, extra });
}
export async function r2Existe(cle) {
  const r = await appel('HEAD', cle);
  return r.ok;
}

export async function r2Put(cle, donnees) {
  const r = await appel('PUT', cle, { corps: donnees });
  if (!r.ok) throw new Error('R2 écriture refusée (' + r.status + ') : ' + (await r.text().catch(() => '')).slice(0, 200));
  return true;
}
export async function r2Get(cle) {
  const r = await appel('GET', cle);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('R2 lecture refusée (' + r.status + ')');
  return r.arrayBuffer();
}
export async function r2Delete(cle) {
  const r = await appel('DELETE', cle);
  if (!r.ok && r.status !== 404) throw new Error('R2 suppression refusée (' + r.status + ')');
  return true;
}
export async function r2Lister(prefixe) {
  const cles = []; let suite = '';
  for (let i = 0; i < 200; i++) {
    const q = { 'list-type': '2', prefix: prefixe };
    if (suite) q['continuation-token'] = suite;
    const r = await appel('GET', '', { query: q });
    if (!r.ok) throw new Error('R2 liste refusée (' + r.status + ')');
    const x = await r.text();
    for (const m of x.matchAll(/<Key>([^<]*)<\/Key>/g)) cles.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    const t = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(x);
    if (/<IsTruncated>true<\/IsTruncated>/.test(x) && t) suite = t[1].replace(/&amp;/g, '&'); else break;
  }
  return cles;
}
export async function r2SupprimerPrefixe(prefixe) {
  for (const k of await r2Lister(prefixe)) await r2Delete(k).catch(() => {});
}

/* ── points d'entrée utilisés par le reste du site : R2 si configuré, sinon Netlify Blobs ── */
export async function binEcrire(st, cle, donnees) {
  if (r2Actif()) { await r2Put(cle, donnees); return 'r2'; }
  await st.set(cle, donnees); return 'blobs';
}
export async function binLire(st, cle) {
  if (r2Actif()) {
    try { const b = await r2Get(cle); if (b) return b; } catch (e) { console.error('R2 lecture :', e.message); }
  }
  /* repli : fichiers anciens, enregistrés avant R2 */
  return st.get(cle, { type: 'arrayBuffer' }).catch(() => null);
}
export async function binSupprimer(st, cle) {
  if (r2Actif()) await r2Delete(cle).catch((e) => console.error('R2 suppression :', e.message));
  await st.delete(cle).catch(() => {});
}
