// Copie les données de Netlify Blobs vers Supabase (à lancer depuis /migration-supabase.html).
// Protégée par la variable MIGRATION_KEY. Sans danger : par défaut, ne remplace jamais
// une donnée déjà présente dans Supabase (ajoute ?ecraser=1 pour forcer).
import { getStore as getBlobs } from './_blobs.mjs';
import { _interne, stockageActif } from './_stockage.mjs';
import crypto from 'node:crypto';

const STORES = ['vespra-admin-data', 'vespra-auth', 'vespra-clients', 'vespra-media', 'vespra-reviews', 'vespra-sauvegardes', 'vespra-limites', 'vespra-surveillance'];
const BUDGET_MS = 7000;
const dec = new TextDecoder('utf-8', { fatal: true });
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function cleOk(req, url) {
  const attendu = String(process.env.MIGRATION_KEY || '');
  const recu = String(req.headers.get('x-migration-key') || url.searchParams.get('cle') || '');
  if (!attendu || attendu.length < 12) return false;
  const a = crypto.createHash('sha256').update(attendu).digest();
  const b = crypto.createHash('sha256').update(recu).digest();
  return crypto.timingSafeEqual(a, b);
}

async function lireBlobs(st, key) {
  const r = await st.getWithMetadata(key, { type: 'arrayBuffer', consistency: 'strong' });
  if (!r) return null;
  const meta = r.metadata || {};
  const ct = String(meta.contentType || '');
  const binaire = ct && !/^(text\/|application\/json)/.test(ct);
  let texte = null;
  if (!binaire) { try { texte = dec.decode(r.data); } catch { texte = null; } }
  return { texte, octets: texte === null ? Buffer.from(r.data).toString('base64') : null, metadata: meta };
}

async function compter(nom) {
  const rep = await _interne.rest(`kv?store=eq.${encodeURIComponent(nom)}&select=key`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
  const cr = rep.headers.get('content-range') || '';
  return Number(cr.split('/')[1]) || 0;
}

export default async (req) => {
  const url = new URL(req.url);
  if (!cleOk(req, url)) return json({ erreur: 'Clé de migration absente ou incorrecte.' }, 401);
  const action = url.searchParams.get('action') || 'copier';
  const stores = (url.searchParams.get('stores') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const liste = stores.length ? stores : STORES;

  try {
    if (action === 'etat') {
      const out = [];
      for (const nom of liste) {
        const { blobs } = await getBlobs(nom).list();
        out.push({ store: nom, blobs: blobs.length, supabase: await compter(nom) });
      }
      return json({ stockage_actif: stockageActif(), stores: out, identique: out.every((x) => x.blobs === x.supabase) });
    }

    if (action === 'bench') {
      // Mesure la vitesse réelle Netlify -> Supabase (lecture seule).
      const t = async (f) => { const a = Date.now(); const r = await f(); return [Date.now() - a, r]; };
      const st = new _interne.StoreSupabase('vespra-admin-data');
      const pings = [];
      for (let i = 0; i < 5; i++) pings.push((await t(() => _interne.rest('kv?select=key&limit=1')))[0]);
      _interne.cache.clear();
      const [msListe, liste] = await t(() => st.list({ prefix: 'reservations/' }));
      const [msGets] = await t(async () => { for (const b of liste.blobs) await st.get(b.key, { type: 'json' }); });
      _interne.cache.clear();
      const echant = liste.blobs.slice(0, 10);
      const [msSansCache] = await t(async () => { for (const b of echant) await st.get(b.key, { type: 'json' }); });
      return json({ aller_retour_ms: pings, liste_ms: msListe, fiches: liste.blobs.length, lecture_de_toutes_les_fiches_ms: msGets, dix_lectures_sans_cache_ms: msSansCache, region_netlify: process.env.AWS_REGION || process.env.AWS_LAMBDA_FUNCTION_REGION || null });
    }

    // action = copier : reprend à (store n°i, clé n°depart)
    const i = Math.max(0, parseInt(url.searchParams.get('i') || '0', 10));
    let depart = Math.max(0, parseInt(url.searchParams.get('depart') || '0', 10));
    const ecraser = url.searchParams.get('ecraser') === '1';
    const t0 = Date.now();
    if (i >= liste.length) return json({ fini: true });
    const nom = liste[i];
    const src = getBlobs(nom);
    const { blobs } = await src.list();
    const cles = blobs.map((b) => b.key).sort();
    let copiees = 0, ignorees = 0, erreurs = [];
    while (depart < cles.length && Date.now() - t0 < BUDGET_MS) {
      const lot = cles.slice(depart, depart + 5);
      await Promise.all(lot.map(async (key) => {
        try {
          const l = await lireBlobs(src, key);
          if (!l) { ignorees++; return; }
          const ligne = { store: nom, key, texte: l.texte, octets: l.octets, metadata: l.metadata, etag: crypto.randomUUID(), maj: new Date().toISOString() };
          const prefer = ecraser ? 'resolution=merge-duplicates,return=representation' : 'resolution=ignore-duplicates,return=representation';
          const rep = await _interne.rest('kv?on_conflict=store,key&select=key', { method: 'POST', body: ligne, headers: { Prefer: prefer } });
          const r = await rep.json();
          if (r.length) copiees++; else ignorees++;
        } catch (e) { erreurs.push(`${key} : ${e.message}`.slice(0, 200)); }
      }));
      depart += lot.length;
    }
    const finiStore = depart >= cles.length;
    return json({
      store: nom, i, total: cles.length, depart, copiees, ignorees_deja_presentes: ignorees, erreurs,
      suite: finiStore ? (i + 1 < liste.length ? { i: i + 1, depart: 0 } : null) : { i, depart },
      fini: finiStore && i + 1 >= liste.length,
    });
  } catch (e) {
    return json({ erreur: e.message }, 500);
  }
};
