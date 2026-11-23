/* ════════════════════════════════════════════════════
   PHOTOBOOTH — appareils, envoi des photos, QR code, galeries
   ────────────────────────────────────────────────────
   Appareils (mini-PC des photobooths) :
     POST /api/photobooth/acces      mot de passe général (le même que le vidéobooth) → liste des événements
     POST /api/photobooth/session    ouvre un événement (son mot de passe s'il en a un) → jeton de l'appareil
     GET  /api/photobooth/config     réglages à jour de l'événement
     GET  /api/photobooth/img/<id>   images de l'événement (cadres, fond, logo)
     POST /api/photobooth/envoi      photos, par morceaux de 3 Mo (photo encadrée, vignette, photos brutes)
     POST /api/photobooth/impression nombre d'impressions d'une prise
   Invités et organisateurs (rien n'est public) :
     GET|POST /api/photobooth/q/<prise>?k=   QR code : « Ouvrir mes photos » lie le téléphone (10 téléphones au plus, dans le quart d'heure)
     GET  /api/photobooth/vue/<prise>        la photo encadrée puis les photos brutes
     GET  /api/photobooth/invites/<événement> galerie des invités : seulement si « Accès des invités » est coché (mariage…)
     GET|POST /api/photobooth/galerie/<événement>?t=  galerie des organisateurs (lien + mot de passe)
     GET  /api/photobooth/f/<prise>/<nom>    une photo, si le navigateur y a droit
   ════════════════════════════════════════════════════ */
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { binEcrire } from './_r2.mjs';
import { pbStore, vuEcrire, evenementEcrire, evenementLire, evenementsLister, imageLire, priseOk, priseEvenement, priseLire, priseEcrire, prisesLister, photoLire, compteurs, NOMS_FICHIERS } from './_photobooth.mjs';
import { accesLire } from './videobooth.mjs';
import { codeLire } from './_appli.mjs';
import { getStore as blobStore } from './_blobs.mjs';

export const config = { path: '/api/photobooth/*' };

const CLE = () => process.env.PHOTOBOOTH_CLE || process.env.VIDEOBOOTH_CLE || '';
const hm = (x) => createHmac('sha256', CLE()).update(x).digest('hex');
const egal = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-appareil', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const rep = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });
const SECURITE = { 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'" };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── jetons signés (accès, appareil) ── */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const signer = (o) => { const p = b64(o); return p + '.' + createHmac('sha256', CLE()).update('pbtok:' + p).digest('base64url'); };
function lireJeton(t, type) {
  const [p, sg] = String(t || '').split('.'); if (!p || !sg || !CLE()) return null;
  if (!egal(createHmac('sha256', CLE()).update('pbtok:' + p).digest('base64url'), sg)) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); return o.exp > Date.now() && (!type || o.t === type) ? o : null; } catch { return null; }
}
export const jetonGalerie = (evt) => hm('pbgal:' + evt).slice(0, 32);
const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const visible = (e) => e && e.actif !== false && (!e.fin || e.fin >= aujourdhui());
/* ce que reçoit un photobooth : tout sauf les mots de passe */
const vueEvt = (e) => { const c = JSON.parse(JSON.stringify(e)); delete c.mdp; if (c.galerie) delete c.galerie.mdp; return c; };

/* ── cookies : un téléphone lié à une prise, une session de galerie ── */
function lireCookie(request, nom) {
  for (const c of (request.headers.get('cookie') || '').split(/;\s*/)) { const i = c.indexOf('='); if (i > 0 && c.slice(0, i) === nom) return c.slice(i + 1); }
  return '';
}
const sha = (x) => createHash('sha256').update(String(x)).digest('hex');
const ck = (nom, val, jours) => `${nom}=${val}; Path=/api/photobooth/; Max-Age=${Math.round(jours * 86400)}; HttpOnly; Secure; SameSite=Lax`;
const valInvite = (evt) => hm('pbinv:' + evt).slice(0, 40);
const valOrga = (evt, mdp) => hm('pborg:' + evt + ':' + (mdp || '')).slice(0, 40);
const telephoneLie = (request, m) => { const s = lireCookie(request, 'pbq_' + m.id); return !!s && (m.appQr || []).includes(sha(s)); };
const inviteOk = (request, e) => !!(e.galerie && e.galerie.invites && e.galerie.ouverte) && lireCookie(request, 'pbi_' + e.id) === valInvite(e.id);
const orgaOk = (request, e) => !!(e.galerie && e.galerie.ouverte && e.galerie.lien) && lireCookie(request, 'pbo_' + e.id) === valOrga(e.id, e.galerie.mdp);
/* droit de voir une prise : le téléphone qui a scanné, un invité de l'événement (si autorisé), ou l'organisateur */
const peutVoir = (request, e, m) => telephoneLie(request, m) || inviteOk(request, e) || orgaOk(request, e);

/* ── pages aux couleurs de l'événement ── */
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(String(h).substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const POLICES = { elegante: ["'Playfair VB',Georgia,serif", 700, 'playfair-700'], manuscrite: ["'GreatVibes VB',cursive", 400, 'great-vibes-400'], moderne: ["'Montserrat VB',Arial,sans-serif", 700, 'montserrat-700'], festive: ["'Mountains VB',cursive", 700, 'mountains-700'] };
function page(e, titre, corps, opts = {}) {
  const t = (e && e.galerie && e.galerie.theme) || {}, fond = t.fond || '#FFFFFF', acc = t.accent || '#B8893B', clair = lum(fond) > 0.35;
  const tx = clair ? '#231F1C' : '#FFFFFF', doux = clair ? '#6F655C' : 'rgba(255,255,255,.78)', btx = lum(acc) > 0.45 ? '#1a1612' : '#FFFFFF', pol = POLICES[t.police] || POLICES.elegante;
  const imgFond = t.image && e ? `background-image:url(/api/photobooth/fond/${e.id});background-size:cover;background-position:center;background-attachment:fixed;` : '';
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">${opts.rafraichir ? '<meta http-equiv="refresh" content="6">' : ''}<title>${esc(titre)}</title><link rel="stylesheet" href="/polices.css?v=1">
<style>@font-face{font-family:${pol[0].split(',')[0]};font-weight:${pol[1]};font-display:swap;src:url('/videobooth/polices/${pol[2]}.woff2') format('woff2')}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:${fond};${imgFond}color:${tx};font-family:Inter,system-ui,Arial,sans-serif;text-align:center}
main{width:100%;max-width:${opts.large ? 960 : 520}px;margin:0 auto;padding:30px 16px 10px;flex:1}h1{font-family:${pol[0]};font-weight:${pol[1]};font-size:${t.police === 'manuscrite' ? 44 : 32}px;line-height:1.1;margin:0}.filet{display:block;width:56px;height:2px;background:${acc};margin:12px auto 16px;border-radius:2px}p{color:${doux};line-height:1.55;font-size:15px;margin:0 0 12px}
.bt{display:block;width:100%;background:${acc};color:${btx};border:0;border-radius:12px;padding:14px;text-decoration:none;font:700 15px Inter,Arial,sans-serif;cursor:pointer;box-shadow:0 12px 24px -14px rgba(0,0,0,.5)}.bt2{display:inline-block;border:1.5px solid ${acc};color:${clair ? acc : '#fff'};border-radius:10px;padding:9px 16px;text-decoration:none;font:700 13px Inter,Arial,sans-serif}
.pied{width:100%;max-width:900px;margin:40px auto 0;padding:18px 12px 26px;border-top:1px solid ${clair ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.25)'};font-size:12px;color:${doux}}.pied b{font-weight:600}.pied a{color:${doux};text-decoration:underline;text-underline-offset:2px}
${opts.css || ''}</style></head><body><main>${corps}</main><footer class="pied"><b>Service proposé par Vespra Event</b><br>Vous aussi, vous voulez louer du matériel ? <a href="/catalogue">Vespra Event</a></footer>${opts.script ? '<script>' + opts.script + '</script>' : ''}</body></html>`, { status: opts.status || 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', ...(opts.cookies ? { 'Set-Cookie': opts.cookies } : {}) } });
}
async function listeBorne() {
  const auj = aujourdhui(), l = await evenementsLister();
  const dist = (e) => { const d = e.date || '9999-12-31'; return Math.abs(Date.parse(d) - Date.parse(auj)) + (d < auj ? 1 : 0); };
  return l.sort((a, b) => dist(a) - dist(b)).map(vueEvt);
}
const refus = (e, msg, s = 403) => page(e, 'Photos protégées', `<h1>Photos protégées</h1><i class="filet"></i><p>${msg}</p>`, { status: s });

/* galerie (grille de vignettes) commune aux invités et aux organisateurs */
function grille(e, prises, titre, sousTitre, orga) {
  const l = prises.filter((p) => p.fichiers && p.fichiers.final);
  const cases = l.map((p) => `<a class="v" href="/api/photobooth/vue/${p.id}"><img loading="lazy" alt="" src="/api/photobooth/f/${p.id}/${p.fichiers.mini ? 'mini' : 'final'}"></a>`).join('');
  /* « Tout télécharger » : toujours proposé sur le lien de l'événement ; sur la galerie des invités seulement si le réglage est coché */
  const tout = (orga || e.galerie.toutTelecharger) && l.length ? `<button class="bt" id="zip" type="button" style="max-width:360px;margin:6px auto 4px;display:flex;align-items:center;justify-content:center;gap:10px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>Tout télécharger (${l.length} photo${l.length > 1 ? 's' : ''})</button><div id="st" style="font-size:13px;min-height:18px;margin-bottom:4px"></div>` : '';
  const script = tout ? `var L=${JSON.stringify(l.map((p, i) => ({ u: '/api/photobooth/f/' + p.id + '/final?dl=1', n: 'photo-' + String(i + 1).padStart(3, '0') + '.jpg' })))};var b=document.getElementById('zip'),st=document.getElementById('st'),N=100;
function charger(){return new Promise(function(ok,ko){if(window.vbZip)return ok();var s=document.createElement('script');s.src='/videobooth/zip.js';s.onload=ok;s.onerror=ko;document.head.appendChild(s)})}
function echec(){st.textContent='Le téléchargement a échoué. Vérifiez votre connexion et réessayez.';b.disabled=false}
b.onclick=function(){b.disabled=true;st.textContent='Préparation…';charger().then(function(){var parts=Math.ceil(L.length/N),p=0;
(function partie(){if(p>=parts){st.textContent='Terminé : '+L.length+' photo'+(L.length>1?'s':'')+' enregistrée'+(L.length>1?'s':'')+'.';b.disabled=false;return}
var lot=L.slice(p*N,(p+1)*N),f=[],i=0;
(function n(){if(i>=lot.length){return vbZip(f).then(function(z){var a=document.createElement('a');a.href=URL.createObjectURL(z);a.download=parts>1?'photos-partie-'+(p+1)+'-sur-'+parts+'.zip':'photos.zip';document.body.appendChild(a);a.click();a.remove();p++;setTimeout(partie,900)}).catch(echec)}
st.textContent=(parts>1?'Partie '+(p+1)+'/'+parts+' · ':'')+'photo '+(i+1)+'/'+lot.length+'…';
fetch(lot[i].u,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(x){f.push({nom:lot[i].n,blob:x});i++;n()}).catch(echec)})()})()}).catch(echec)};` : '';
  return page(e, titre, `<h1>${esc(titre)}</h1><i class="filet"></i><p>${esc(sousTitre)}</p>${tout}<div class="g">${cases || '<p>Aucune photo pour l’instant.</p>'}</div>`, { large: true, script, css: '.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:16px}.v{display:block;border-radius:8px;overflow:hidden;box-shadow:0 10px 20px -14px rgba(0,0,0,.6);background:rgba(0,0,0,.06)}.v img{display:block;width:100%;height:auto}' });
}

export default async (request) => {
  const r = await traiter(request);
  try { for (const [k, v] of Object.entries(SECURITE)) if (!r.headers.has(k)) r.headers.set(k, v); } catch (e) {}
  return r;
};

async function traiter(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url), chemin = url.pathname.replace(/^\/api\/photobooth\//, ''), parts = chemin.split('/');
  if (!CLE()) return rep({ ok: false, erreur: 'VIDEOBOOTH_CLE n’est pas définie dans Netlify' }, 500);
  const st = pbStore();

  /* ── appareils : accès et ouverture d'un événement ── */
  if (request.method === 'POST' && (chemin === 'acces' || chemin === 'session')) {
    let d = {}; try { d = await request.json(); } catch {}
    if (chemin === 'acces') {
      const a = await accesLire((await import('./_blobs.mjs')).getStore('videobooth'));
      if (!a || (!a.h && !a.libre)) return rep({ ok: false, erreur: 'Aucun mot de passe d’accès n’est défini (back-office, onglet Vidéobooth).' }, 409);
      if (!a.libre && !egal(createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('acces:' + String(d.mdp || '').trim()).digest('hex'), a.h)) { await pause(900); return rep({ ok: false, erreur: 'Mot de passe incorrect.' }, 401); }
      /* jeton « appareil » longue durée : la borne se reconnecte seule au démarrage du PC */
      return rep({ ok: true, code: await codeLire(blobStore('videobooth')), libre: !!a.libre, appareil: signer({ t: 'pba', exp: Date.now() + 365 * 86400e3 }), evenements: await listeBorne() });
    }
    if (!lireJeton(d.acces || request.headers.get('x-borne'), 'pba')) return rep({ ok: false, erreur: 'Accès expiré : saisissez de nouveau le mot de passe.', expire: true }, 401);
    const e = await evenementLire(String(d.id || ''));
    if (!e) return rep({ ok: false, erreur: 'Événement introuvable (supprimé ?).' }, 404);
    const exp = Date.now() + 60 * 86400e3;
    return rep({ ok: true, code: await codeLire(blobStore('videobooth')), jeton: signer({ t: 'pbs', evt: e.id, exp }), exp, evenement: vueEvt(e) });
  }

  /* ── borne connectée : liste des événements (du plus proche au plus lointain) ── */
  const borne = lireJeton(request.headers.get('x-borne'), 'pba');
  if (chemin === 'evenements' && request.method === 'GET') {
    if (!borne) return rep({ ok: false, expire: true }, 401);
    return rep({ ok: true, evenements: await listeBorne() });
  }
  if (parts[0] === 'apercu' && request.method === 'GET') { /* images pour l'aperçu de la liste */
    if (!borne) return rep({ ok: false }, 403);
    const im = await imageLire(parts[1], parts[2]); if (!im) return rep({ ok: false }, 404);
    return new Response(im.octets, { headers: { 'Content-Type': im.info.mime, 'Cache-Control': 'private, max-age=86400' } });
  }

  /* ── appareil déjà connecté à un événement ── */
  const jt = lireJeton(request.headers.get('x-appareil'), 'pbs');
  if (chemin === 'config' && request.method === 'GET') {
    if (!jt) return rep({ ok: false }, 403);
    const e = await evenementLire(jt.evt); if (!e) return rep({ ok: false, erreur: 'Événement supprimé', supprime: true }, 404);
    return rep({ ok: true, evenement: vueEvt(e), stats: await compteurs(e.id), lien: e.galerie && e.galerie.lien ? (process.env.URL || '') + '/api/photobooth/galerie/' + e.id + '?t=' + jetonGalerie(e.id) : '' });
  }
  /* réglages modifiés sur la borne (menu protégé par le code PIN) : capture, mise en page, partage, impression */
  if (chemin === 'reglages' && request.method === 'POST') {
    if (!jt) return rep({ ok: false }, 403);
    let d = {}; try { d = await request.json(); } catch {}
    const e = await evenementLire(jt.evt); if (!e) return rep({ ok: false }, 404);
    const n = { ...e };
    for (const k of ['capture', 'partage', 'impression']) if (d[k] && typeof d[k] === 'object') n[k] = { ...e[k], ...d[k] };
    if (Array.isArray(d.misesEnPage)) n.misesEnPage = (e.misesEnPage || []).map((m) => { const x = d.misesEnPage.find((y) => y && y.id === m.id); return x && Array.isArray(x.cases) ? { ...m, cases: x.cases } : m; });
    const r = await evenementEcrire(n);
    return rep({ ok: true, evenement: vueEvt(r) });
  }
  if (chemin === 'maj' && request.method === 'GET') {                 /* sondage léger : seule la date de dernière modification */
    if (!jt) return rep({ ok: false }, 403);
    const e = await evenementLire(jt.evt); if (!e) return rep({ ok: false, supprime: true }, 404);
    await vuEcrire(jt.evt, url.searchParams.get('v') || '', e.maj).catch(() => {});
    return rep({ ok: true, maj: e.maj, cadres: (e.misesEnPage || []).length });
  }
  if (parts[0] === 'img' && request.method === 'GET') {
    if (!jt) return rep({ ok: false }, 403);
    const im = await imageLire(jt.evt, parts[1]); if (!im) return rep({ ok: false }, 404);
    return new Response(im.octets, { headers: { 'Content-Type': im.info.mime, 'Cache-Control': 'private, max-age=86400' } });
  }
  if (chemin === 'envoi' && request.method === 'POST') {
    if (!jt) return rep({ ok: false, erreur: 'Appareil non connecté' }, 403);
    const q = url.searchParams, prise = q.get('prise') || '', nom = q.get('nom') || '', i = Number(q.get('i')), n = Number(q.get('n'));
    if (!priseOk(prise) || !NOMS_FICHIERS.includes(nom) || !(n >= 1 && n <= 20) || !(i >= 0 && i < n)) return rep({ ok: false, erreur: 'Paramètres invalides' }, 400);
    const evt = jt.evt;
    let m = await priseLire(evt, prise);
    if (m && m.fichiers && m.fichiers[nom]) return rep({ ok: true, termine: true, deja: true });
    const donnees = await request.arrayBuffer();
    if (!donnees.byteLength || donnees.byteLength > 5.5 * 1024 * 1024) return rep({ ok: false, erreur: 'Morceau vide ou trop gros' }, 413);
    await st.set(`pchunk/${prise}/${nom}/${i}`, donnees);
    if (i < n - 1) return rep({ ok: true, recu: i });
    const morceaux = [];
    for (let k = 0; k < n; k++) { const b = await st.get(`pchunk/${prise}/${nom}/${k}`, { type: 'arrayBuffer' }).catch(() => null); if (!b) return rep({ ok: false, erreur: 'Morceau manquant : ' + k, manquant: k }, 409); morceaux.push(new Uint8Array(b)); }
    const total = morceaux.reduce((t, p) => t + p.length, 0), tout = new Uint8Array(total); let o = 0; for (const p of morceaux) { tout.set(p, o); o += p.length; }
    await binEcrire(st, `photo/${evt}/${prise}/${nom}`, tout.buffer);
    for (let k = 0; k < n; k++) await st.delete(`pchunk/${prise}/${nom}/${k}`).catch(() => {});
    m = (await priseLire(evt, prise)) || { id: prise, evt, cree: new Date().toISOString(), fichiers: {}, imprimees: 0 };
    const rk = String(q.get('rk') || '').replace(/[^a-f0-9]/g, '').slice(0, 48); if (rk.length >= 24 && !m.rk) m.rk = rk;
    if (q.get('mp')) m.mp = String(q.get('mp')).replace(/[^a-z0-9]/g, '').slice(0, 20);
    if (q.get('quand') && !isNaN(Date.parse(q.get('quand')))) m.cree = new Date(q.get('quand')).toISOString();
    m.fichiers[nom] = { octets: total };
    await priseEcrire(m);
    await st.setJSON('priseevt/' + prise, { evt });
    return rep({ ok: true, termine: true });
  }
  if (chemin === 'impression' && request.method === 'POST') {
    if (!jt) return rep({ ok: false }, 403);
    let d = {}; try { d = await request.json(); } catch {}
    const m = await priseLire(jt.evt, String(d.prise || ''));
    if (m) { m.imprimees = (Number(m.imprimees) || 0) + Math.min(20, Math.max(1, Math.round(Number(d.copies) || 1))); await priseEcrire(m); }
    return rep({ ok: true });
  }

  /* ── QR code : « Ouvrir mes photos » lie ce téléphone à la prise ── */
  if (parts[0] === 'q' && (request.method === 'GET' || request.method === 'POST')) {
    const prise = parts[1], k = String(url.searchParams.get('k') || '').replace(/[^a-f0-9]/g, '');
    if (!priseOk(prise) || k.length < 24) return refus(null, 'Lien invalide.', 404);
    const evt = await priseEvenement(prise), e = evt ? await evenementLire(evt) : null, m = evt ? await priseLire(evt, prise) : null;
    if (!m || !m.rk || !m.fichiers || !m.fichiers.final) {
      if (m && m.rk && !egal(m.rk, k)) { await pause(900); return refus(e, 'Lien invalide.', 404); }
      return page(e, 'Vos photos arrivent', '<h1>Vos photos arrivent</h1><i class="filet"></i><p>Elles sont en cours d’envoi depuis le photobooth. Cette page se met à jour toute seule.</p>', { rafraichir: true, status: 202 });
    }
    if (!egal(m.rk, k)) { await pause(900); return refus(e, 'Lien invalide.', 404); }
    if (!e) return refus(null, 'Cet événement n’existe plus.', 410);
    const vers = '/api/photobooth/vue/' + prise;
    if (telephoneLie(request, m)) return new Response(null, { status: 302, headers: { Location: vers } });
    const liste = Array.isArray(m.appQr) ? m.appQr : [];
    const plein = liste.length >= 10 || (liste.length && Date.now() - Date.parse(m.appQrLe || 0) > 15 * 60000);
    if (request.method !== 'POST') return plein ? refus(e, 'Ces photos ont déjà été récupérées. Pour protéger la vie privée des invités, elles ne s’ouvrent que sur les téléphones qui ont scanné le QR code au photobooth.') : page(e, 'Vos photos sont prêtes', `<h1>${esc((e.galerie.theme && e.galerie.theme.titre) || e.nom)}</h1><i class="filet"></i><p>Vos photos sont prêtes. Pour protéger votre vie privée, elles ne s’ouvriront que sur ce téléphone.</p><form method="post"><button class="bt" type="submit">Ouvrir mes photos</button></form>`);
    if (plein) return refus(e, 'Ces photos ont déjà été récupérées sur d’autres téléphones.');
    const sec = randomBytes(24).toString('hex');
    m.appQr = liste.concat(sha(sec)); if (!liste.length) m.appQrLe = new Date().toISOString(); if (!m.scanne) m.scanne = new Date().toISOString();
    await priseEcrire(m);
    const cookies = [ck('pbq_' + prise, sec, 60)];
    /* mariage, fête privée : ce téléphone pourra aussi voir la galerie des invités */
    if (e.galerie.invites) cookies.push(ck('pbi_' + e.id, valInvite(e.id), 30));
    const h = new Headers({ Location: vers, 'Cache-Control': 'no-store' }); cookies.forEach((c) => h.append('Set-Cookie', c));
    return new Response(null, { status: 303, headers: h });
  }

  /* ── une prise : photo encadrée puis photos brutes, en glissant ── */
  if (parts[0] === 'vue' && request.method === 'GET') {
    const prise = parts[1], evt = await priseEvenement(prise), e = evt ? await evenementLire(evt) : null, m = evt ? await priseLire(evt, prise) : null;
    if (!e || !m || !(m.fichiers && m.fichiers.final)) return refus(e, 'Ces photos ne sont plus disponibles.', 404);
    if (!peutVoir(request, e, m)) return refus(e, 'Ces photos ne s’ouvrent que sur le téléphone qui a scanné le QR code au photobooth.');
    const noms = ['final'].concat(e.partage && e.partage.bruts === false ? [] : NOMS_FICHIERS.filter((x) => /^brut-/.test(x) && m.fichiers[x]));
    const diapos = noms.map((x, i) => `<div class="d"><img alt="${i ? 'Photo ' + i : 'Photo encadrée'}" src="/api/photobooth/f/${prise}/${x}"><a class="bt" href="/api/photobooth/f/${prise}/${x}?dl=1" download>Télécharger ${i ? 'cette photo' : 'la photo encadrée'}</a></div>`).join('');
    const galerie = e.galerie.invites && e.galerie.ouverte && inviteOk(request, e) ? `<a class="x" href="/api/photobooth/invites/${e.id}" aria-label="Voir toute la galerie">✕</a>` : '';
    const t = e.galerie.theme || {};
    return page(e, (t.titre || e.nom), `${galerie}<h1>${esc(t.titre || e.nom)}</h1><i class="filet"></i>
<div class="car"><div class="pistes" id="p">${diapos}</div>${noms.length > 1 ? '<button class="fl g" type="button" id="fg" aria-label="Précédente">‹</button><button class="fl d2" type="button" id="fd" aria-label="Suivante">›</button>' : ''}</div>
${noms.length > 1 ? '<div class="pts" id="pts">' + noms.map((_, i) => '<i' + (i ? '' : ' class="on"') + '></i>').join('') + '</div><p style="font-size:13px">Glissez vers la droite pour voir les photos sans cadre.</p>' : ''}
${galerie ? '<p style="font-size:13px">Touchez la croix pour voir toute la galerie de l’événement.</p>' : ''}`, {
      css: '.car{position:relative}.pistes{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;gap:0}.pistes::-webkit-scrollbar{display:none}.d{flex:0 0 100%;scroll-snap-align:center;display:flex;flex-direction:column;gap:14px;align-items:center;padding:0 4px}.d img{max-width:100%;max-height:62vh;border-radius:6px;box-shadow:0 18px 36px -18px rgba(0,0,0,.6)}.fl{position:absolute;top:35%;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.9);color:#231F1C;font-size:24px;line-height:38px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25)}.fl.g{left:-6px}.fl.d2{right:-6px}.pts{display:flex;gap:6px;justify-content:center;margin:14px 0 6px}.pts i{width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.3}.pts i.on{opacity:1}.x{position:fixed;top:12px;right:12px;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;text-decoration:none;font-size:20px;line-height:40px;z-index:5}',
      script: noms.length > 1 ? "var p=document.getElementById('p'),pts=document.querySelectorAll('#pts i');function aller(d){var i=Math.round(p.scrollLeft/p.clientWidth)+d;p.scrollTo({left:i*p.clientWidth,behavior:'smooth'});}document.getElementById('fg').onclick=function(){aller(-1)};document.getElementById('fd').onclick=function(){aller(1)};p.addEventListener('scroll',function(){var i=Math.round(p.scrollLeft/p.clientWidth);pts.forEach(function(x,j){x.classList.toggle('on',j===i)});});" : '',
    });
  }

  /* ── galerie des invités (mariage, fête privée) ── */
  if (parts[0] === 'invites' && request.method === 'GET') {
    const e = await evenementLire(parts[1]);
    if (!e || !e.galerie.invites || !e.galerie.ouverte) return refus(e, 'La galerie de cet événement n’est pas ouverte aux invités.');
    if (!inviteOk(request, e)) return refus(e, 'Scannez le QR code de vos photos au photobooth pour ouvrir la galerie.');
    const t = e.galerie.theme || {};
    return grille(e, await prisesLister(e.id), t.titre || e.nom, 'Toutes les photos de l’événement', false);
  }

  /* ── galerie des organisateurs : lien du back-office + mot de passe s'il y en a un ── */
  if (parts[0] === 'galerie' && (request.method === 'GET' || request.method === 'POST')) {
    const e = await evenementLire(parts[1]);
    if (!e || !egal(String(url.searchParams.get('t') || ''), jetonGalerie(e.id))) return refus(null, 'Lien invalide.', 404);
    if (!e.galerie.lien || !e.galerie.ouverte) return refus(e, 'Cette galerie n’est pas ouverte pour le moment.');
    const t = e.galerie.theme || {};
    if (lireCookie(request, 'pbo_' + e.id) !== valOrga(e.id, e.galerie.mdp)) {
      if (!e.galerie.mdp) return new Response(null, { status: 303, headers: { Location: url.pathname + url.search, 'Set-Cookie': ck('pbo_' + e.id, valOrga(e.id, ''), 0.5) } });
      let erreur = '';
      const cleE = 'etat/galerie-essais/' + e.id, essais = await st.get(cleE, { type: 'json' }).catch(() => null);
      const bloque = essais && essais.n >= 8 && Date.now() - Date.parse(essais.depuis) < 15 * 60000;
      if (request.method === 'POST' && bloque) { await pause(900); erreur = 'Trop d’essais : réessayez dans un quart d’heure.'; }
      else if (request.method === 'POST') {
        let mdp = ''; try { mdp = String((await request.formData()).get('mdp') || '').trim(); } catch {}
        if (egal(sha('m:' + mdp), sha('m:' + e.galerie.mdp))) { await st.delete(cleE).catch(() => {}); return new Response(null, { status: 303, headers: { Location: url.pathname + url.search, 'Set-Cookie': ck('pbo_' + e.id, valOrga(e.id, e.galerie.mdp), 0.5) } }); }
        const neuf = !essais || Date.now() - Date.parse(essais.depuis) >= 15 * 60000;
        await st.setJSON(cleE, { n: neuf ? 1 : (essais.n || 0) + 1, depuis: neuf ? new Date().toISOString() : essais.depuis }).catch(() => {});
        await pause(900); erreur = 'Mot de passe incorrect.';
      }
      return page(e, 'Galerie protégée', `<h1>${esc(t.titre || e.nom)}</h1><i class="filet"></i><p>Cette galerie est protégée. Saisissez le mot de passe que l’on vous a communiqué.</p>${erreur ? '<p style="color:#b3392b;font-weight:600">' + esc(erreur) + '</p>' : ''}<form method="post"><input name="mdp" type="password" autocomplete="off" placeholder="Mot de passe" required style="width:100%;padding:14px;border-radius:12px;border:1.5px solid rgba(0,0,0,.18);font-size:17px;text-align:center;margin-bottom:12px"><button class="bt" type="submit">Accéder à la galerie</button></form>`, { status: erreur ? 401 : 200 });
    }
    if (request.method !== 'GET') return new Response(null, { status: 303, headers: { Location: url.pathname + url.search } });
    return grille(e, await prisesLister(e.id), t.titre || e.nom, 'Toutes les photos de l’événement', true);
  }

  /* ── une photo ── */
  if (parts[0] === 'f' && request.method === 'GET') {
    const prise = parts[1], nom = parts[2], evt = await priseEvenement(prise), e = evt ? await evenementLire(evt) : null, m = evt ? await priseLire(evt, prise) : null;
    if (!e || !m || !NOMS_FICHIERS.includes(nom) || !peutVoir(request, e, m)) return new Response('Accès refusé', { status: 403 });
    if (/^brut-/.test(nom) && e.partage && e.partage.bruts === false && !orgaOk(request, e)) return new Response('Accès refusé', { status: 403 });
    const b = await photoLire(evt, prise, nom); if (!b) return new Response('Introuvable', { status: 404 });
    const dl = url.searchParams.get('dl') === '1';
    return new Response(b, { headers: { 'Content-Type': 'image/jpeg', 'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename="${e.nom.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'photo'}-${nom}.jpg"`, 'Cache-Control': 'private, max-age=3600' } });
  }
  /* image de fond du thème de la page (décor de l'événement, sans photo d'invité) */
  if (parts[0] === 'fond' && request.method === 'GET') {
    const e = await evenementLire(parts[1]); const id = e && e.galerie && e.galerie.theme && e.galerie.theme.image;
    const im = id ? await imageLire(e.id, id) : null; if (!im) return new Response('Introuvable', { status: 404 });
    return new Response(im.octets, { headers: { 'Content-Type': im.info.mime, 'Cache-Control': 'public, max-age=86400' } });
  }
  return rep({ ok: false, erreur: 'Route inconnue' }, 404);
}
