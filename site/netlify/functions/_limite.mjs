/* Limite de demandes par adresse IP, conservée dans Netlify Blobs :
   elle survit aux redémarrages et vaut pour toutes les instances.
   Si le stockage est indisponible, on laisse passer (jamais de blocage à tort). */
import { createHash } from 'node:crypto';
import { getStore } from './_stockage.mjs';

export function ipDe(request) {
  return (request.headers.get('x-nf-client-connection-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0] || 'inconnu').trim();
}

/* true = trop de demandes. compter:false = lire sans ajouter (voir limiteAjouter). */
export async function limiteBlobs(request, cle, max, fenetreMs, compter = true) {
  try {
    const st = getStore('vespra-limites');
    const k = cle + '/' + createHash('sha256').update(ipDe(request)).digest('hex').slice(0, 24);
    const now = Date.now();
    const l = ((await st.get(k, { type: 'json' }).catch(() => null)) || []).filter((t) => now - t < fenetreMs);
    if (compter) { l.push(now); await st.setJSON(k, l.slice(-(max + 5))); }
    return l.length > (compter ? max : max - 1);
  } catch (e) { return false; }
}
export async function limiteAjouter(request, cle, fenetreMs, max = 50) {
  try {
    const st = getStore('vespra-limites');
    const k = cle + '/' + createHash('sha256').update(ipDe(request)).digest('hex').slice(0, 24);
    const now = Date.now();
    const l = ((await st.get(k, { type: 'json' }).catch(() => null)) || []).filter((t) => now - t < fenetreMs);
    l.push(now); await st.setJSON(k, l.slice(-max));
  } catch (e) {}
}
