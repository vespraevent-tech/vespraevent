/* ════════════════════════════════════════════════════
   Applications Vespra (Android) : la tablette prouve qu'elle utilise bien l'application
   ────────────────────────────────────────────────────
   L'application Android contient une clé secrète (longue, aléatoire) qu'elle envoie à chaque appel.
   Le site ne garde que son EMPREINTE (SHA-256) : la clé ne peut pas en être déduite.
   Résultat : l'adresse du vidéobooth ouverte dans un navigateur ne sert plus à rien.
   Le fichier de l'application n'est téléchargeable qu'avec un mot de passe (voir appli.mjs).

   Secours (si une application ne passe plus) : variable Netlify APPLI_LIBRE = 1 lève cette vérification.
   ════════════════════════════════════════════════════ */
import { createHash, timingSafeEqual } from 'node:crypto';

const EMPREINTES = {
  videobooth: ['39c4ce3e76bd507dbf87a9769a53fe2468de8691f3cdc94ea9dd4f5ec9384ed9'],
};

export function appOk(request, quoi) {
  if (process.env.APPLI_LIBRE === '1') return true;
  const k = String(request.headers.get('x-vespra-app') || '').trim();
  if (k.length < 32 || k.length > 200) return false;
  const h = Buffer.from(createHash('sha256').update(k).digest('hex'));
  return (EMPREINTES[quoi] || []).some((e) => { const b = Buffer.from(e); return b.length === h.length && timingSafeEqual(b, h); });
}

/* ── code de sortie / réglages des applications (le même pour le vidéobooth et le photobooth), réglé dans le back-office › Logiciels ── */
export const CODE_DEFAUT = '0104';
export async function codeLire(st) {
  const c = await st.get('config/codesortie', { type: 'json' }).catch(() => null);
  return c && /^\d{4,12}$/.test(String(c.code)) ? String(c.code) : CODE_DEFAUT;
}
export async function codeEcrire(st, code) {
  const v = String(code || '').trim();
  if (!/^\d{4,12}$/.test(v)) throw new Error('Le code doit comporter de 4 à 12 chiffres.');
  await st.setJSON('config/codesortie', { code: v, maj: new Date().toISOString() });
  return v;
}
