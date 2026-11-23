/* ════════════════════════════════════════════════════
   TÉLÉCHARGEMENT DES APPLICATIONS — protégé par un mot de passe
   ────────────────────────────────────────────────────
   GET  /api/appli/etat          dit seulement si un mot de passe existe et quelles applications sont proposées
   POST /api/appli/telecharger   { mdp, quoi } → le fichier (Android) ou un lien temporaire de 10 minutes (Windows, via R2)

   Le mot de passe est créé dans le back-office (onglet Vidéobooth) : généré au hasard (100 bits), jamais choisi à la main,
   et seule son empreinte (scrypt + sel) est conservée. Les essais sont limités : 8 erreurs, puis 15 minutes d'attente.
   Le fichier Android est rangé dans _appli/ (non public). Le logiciel Windows, trop gros pour une fonction, est déposé
   dans l'espace Cloudflare R2 sous « Application/photobooth-windows.zip ».
   ════════════════════════════════════════════════════ */
import { scryptSync, randomBytes, randomInt, timingSafeEqual, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStore } from './_blobs.mjs';
import { r2Actif, r2Existe, r2LienTemporaire } from './_r2.mjs';
/* le fichier peut avoir été déposé dans un dossier nommé autrement (R2 distingue majuscules et minuscules) : on cherche aux emplacements usuels */
async function cleR2(f) { for (const c of [f.r2].concat(f.r2alt || [])) { if (await r2Existe(c).catch(() => false)) return c; } return ''; }

export const config = { path: '/api/appli/*' };

const FICHIERS = {
  'videobooth-android': { nom: 'vespra-videobooth.apk', type: 'application/vnd.android.package-archive', local: '_appli/vespra-videobooth.apk' },
  'photobooth-windows': { nom: 'Vespra-Event-Photobooth-Windows.zip', type: 'application/zip', r2: 'Application/photobooth-windows.zip', r2alt: ['appli/photobooth-windows.zip', 'application/photobooth-windows.zip', 'Appli/photobooth-windows.zip', 'photobooth-windows.zip'] },
};
const ESSAIS_MAX = 8, FENETRE = 15 * 60e3;
const SECURITE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const rep = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...SECURITE } });
const store = () => getStore('videobooth');
const normaliser = (m) => String(m || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hache = (mdp, sel) => scryptSync(normaliser(mdp), Buffer.from(sel, 'hex'), 32).toString('hex');
const egal = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── utilisé par le back-office ── */
export async function appliEtat() {
  const c = await store().get('config/appli', { type: 'json' }).catch(() => null);
  return { defini: !!(c && c.h), maj: (c && c.maj) || '', r2: r2Actif() };
}
export async function appliNouveauMdp() {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';           /* sans 0 O 1 I : faciles à relire, 32 symboles = 5 bits chacun */
  let m = ''; for (let i = 0; i < 20; i++) m += alpha[randomInt(alpha.length)];
  const sel = randomBytes(16).toString('hex'), maj = new Date().toISOString();
  await store().setJSON('config/appli', { h: hache(m, sel), s: sel, maj });
  await store().delete('etat/appli-essais-tous').catch(() => {});
  return { mdp: m.match(/.{5}/g).join('-'), maj };
}

async function lireFichierLocal(chemin) {
  for (const c of ['netlify/functions/' + chemin, join(process.cwd(), 'netlify/functions/' + chemin), new URL('./' + chemin, import.meta.url)]) {
    try { return await readFile(c); } catch { /* suivant */ }
  }
  return null;
}
const ipDe = (request) => String(request.headers.get('x-nf-client-connection-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0] || 'inconnue').trim();

export default async (request) => {
  const url = new URL(request.url), route = url.pathname.replace(/^\/api\/appli\//, '');
  const st = store();

  if (request.method === 'GET' && route === 'etat') {
    const e = await appliEtat();
    const dispo = {};
    for (const [id, f] of Object.entries(FICHIERS)) {
      dispo[id] = f.local ? !!(await lireFichierLocal(f.local)) : (r2Actif() ? !!(await cleR2(f)) : false);
    }
    return rep({ ok: true, defini: e.defini, dispo });
  }

  if (request.method === 'POST' && route === 'telecharger') {
    let d = {}; try { d = await request.json(); } catch {}
    const f = FICHIERS[String(d.quoi || 'videobooth-android')];
    if (!f) return rep({ ok: false, erreur: 'Application inconnue.' }, 404);
    const c = await st.get('config/appli', { type: 'json' }).catch(() => null);
    if (!c || !c.h) return rep({ ok: false, erreur: 'Aucun mot de passe de téléchargement n’est défini : créez-le dans le back-office (onglet Vidéobooth).' }, 409);

    const cleE = 'etat/appli-essais/' + createHash('sha256').update(ipDe(request)).digest('hex').slice(0, 24);
    const e = await st.get(cleE, { type: 'json' }).catch(() => null);
    const maintenant = Date.now();
    let n = e && maintenant - e.t < FENETRE ? e.n : 0;
    if (n >= ESSAIS_MAX) return rep({ ok: false, erreur: 'Trop d’essais. Réessayez dans un quart d’heure.' }, 429);

    if (!normaliser(d.mdp) || !egal(hache(d.mdp, c.s), c.h)) {
      await st.setJSON(cleE, { n: n + 1, t: e && maintenant - e.t < FENETRE ? e.t : maintenant }).catch(() => {});
      await pause(1200);
      return rep({ ok: false, erreur: 'Mot de passe incorrect.' }, 401);
    }
    await st.delete(cleE).catch(() => {});

    if (f.local) {
      const buf = await lireFichierLocal(f.local);
      if (!buf) return rep({ ok: false, erreur: 'Le fichier n’est pas disponible pour le moment.' }, 404);
      return new Response(buf, { headers: { 'Content-Type': f.type, 'Content-Disposition': 'attachment; filename="' + f.nom + '"', 'Content-Length': String(buf.length), ...SECURITE } });
    }
    const cleF = r2Actif() ? await cleR2(f) : '';
    if (!cleF) return rep({ ok: false, erreur: 'Ce logiciel n’a pas encore été déposé (Cloudflare R2, dossier « Application »).' }, 404);
    return rep({ ok: true, url: r2LienTemporaire(cleF, 600, f.nom), valide: '10 minutes' });
  }
  return rep({ ok: false, erreur: 'Introuvable' }, 404);
};
