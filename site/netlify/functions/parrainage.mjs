/* ═══════════════════════════════════════════════════════════════════
   PARRAINAGE VESPRA EVENT
   ───────────────────────────────────────────────────────────────────
   Un client qui a déjà loué chez Vespra Event peut obtenir un code
   personnel. Il le donne à ses proches ; chacun d'eux a 10 € de remise
   sur sa propre demande, et le parrain gagne 10 € d'avoir par filleul —
   acquis seulement quand la location du filleul a réellement eu lieu.

   Un seul code par personne, de la forme NOM + PRÉNOM + 10 :
     Julien Martin  →  MARTINJULIEN10

   Le code n'est créé que si le nom figure déjà dans le planning des
   réservations : personne ne peut se fabriquer un code sans avoir été
   client. Aucun identifiant, aucun mot de passe ici : la vérification
   se fait sur le planning, et la liste des codes n'est lisible que
   depuis le back-office (session administrateur).

   Routes (via _redirects, toutes en /api/parrainage/...) :
     POST /api/parrainage/creer      { nom, prenom }
                                     → { ok, code, dejaExistant }
     GET  /api/parrainage/verifier?code=…&nom=…&prenom=…
                                     → { ok, code, remise, parrain }
     POST /api/parrainage/utiliser   { code, nom, prenom, email, date }
                                     → { ok }

   Stockage : Netlify Blobs, store « vespra-admin-data », clés
   « parrainage/<CODE> ». Le contenu est rangé dans un champ « d » au
   format JSON, exactement comme le planning : le back-office relit
   donc ces enregistrements avec sa route /api/admin/data?collection=parrainage
   sans aucun traitement particulier.
   ═══════════════════════════════════════════════════════════════════ */

import { getStore } from './_stockage.mjs';
import { limiteBlobs } from './_limite.mjs';

const DATA_STORE = 'vespra-admin-data';
const PREFIXE = 'parrainage/';
/* Montant de la remise accordée au filleul, et de l'avoir gagné par le
   parrain. Une seule valeur : les deux sont identiques. */
const REMISE = 10;
/* La remise ne s'applique qu'à partir de ce montant de panier (à 30 €, le code ne joue pas). */
const PANIER_MINIMUM = 40;
/* Un code ne peut pas être offert indéfiniment à la même personne :
   deux demandes portant le même nom et la même adresse ne comptent
   qu'une fois. */

/* ── limite d'essais par adresse IP (mémoire de l'instance) ───────── */
const _essais = new Map();
function trop(request, max, fenetreMs, cle) {
  const ip = (request.headers.get('x-nf-client-connection-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0] || 'inconnu').trim();
  const k = cle + '|' + ip, now = Date.now();
  const l = (_essais.get(k) || []).filter((t) => now - t < fenetreMs);
  l.push(now); _essais.set(k, l);
  if (_essais.size > 2000) for (const [kk, v] of _essais) if (!v.length || now - v[v.length - 1] > fenetreMs) _essais.delete(kk);
  return l.length > max;
}

function store() { return getStore(DATA_STORE); }

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/* ── comparaison de noms ────────────────────────────────────────────
   « LE DRÉAN Inès », « le drean ines » et « Ines LE DREAN » désignent
   la même personne. On enlève les accents, la ponctuation et les
   espaces, et on compare l'ensemble des mots sans tenir compte de
   l'ordre : le planning écrit le nom avant le prénom, le visiteur fait
   l'inverse. */
function sansAccents(t) {
  return String(t || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}
function mots(t) {
  return sansAccents(t).replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}
/* Les particules ne sont pas toujours écrites de la même façon
   (« Le Dréan », « Ledréan ») : elles ne servent pas à distinguer
   deux clients, on les met de côté pour la comparaison. */
const PARTICULES = new Set(['LE', 'LA', 'DE', 'DU', 'DES', 'DA', 'D', 'VAN', 'VON']);
function cle(nom, prenom) {
  const l = mots(nom + ' ' + prenom).filter((m) => !PARTICULES.has(m));
  return l.sort().join('');
}
/* Les mêmes lettres, quel que soit le découpage en mots : « Le Campion »
   et « Lecampion » donnent la même empreinte. C'est ce qui permet de
   reconnaître un client dont le nom est écrit en un mot au planning et
   en deux par le visiteur — ou l'inverse. */
function empreinte(t) {
  return mots(t).join('').split('').sort().join('');
}
function memePersonne(a, b) {
  const x = cle(a, ''), y = cle(b, '');
  if (!x || !y) return false;
  if (x === y) return true;
  /* Même empreinte de lettres : on exige en plus un mot entier commun
     d'au moins quatre lettres, pour qu'une simple anagramme ne suffise
     jamais à se faire passer pour un autre client. */
  if (empreinte(a) !== empreinte(b)) return false;
  const motsA = new Set(mots(a).filter((m) => m.length >= 4));
  return mots(b).some((m) => m.length >= 4 && motsA.has(m));
}

/* ── présentation d'un nom ──────────────────────────────────────────
   Le planning écrit « MARTIN Julien » : les codes suivent la même
   convention, pour que les deux listes se lisent de la même façon,
   quelle que soit la casse tapée par le visiteur. */
function jolieCasse(t) {
  return String(t || '').trim().toLowerCase()
    .replace(/(^|[\s'’-])([a-zà-ÿ])/g, (m, avant, lettre) => avant + lettre.toUpperCase());
}
function nomAffiche(nom, prenom) {
  return (String(nom || '').trim().toUpperCase() + ' ' + jolieCasse(prenom)).replace(/\s+/g, ' ').trim();
}

/* ── forme du code ──────────────────────────────────────────────────
   NOM + PRÉNOM + 10, en majuscules, sans accent ni espace. Les codes
   restent courts et se dictent au téléphone. */
function codeDe(nom, prenom) {
  const n = sansAccents(nom).replace(/[^A-Z0-9]/g, '');
  const p = sansAccents(prenom).replace(/[^A-Z0-9]/g, '');
  return (n + p).slice(0, 24) + String(REMISE);
}

/* ── lecture et écriture des enregistrements ────────────────────── */
function decoder(brut) {
  if (!brut) return null;
  /* Les enregistrements sont écrits avec leur contenu dans « d », comme
     le planning. Un enregistrement écrit autrement (à la main, ou par
     une version antérieure) reste lisible tel quel. */
  if (typeof brut.d === 'string') {
    try { return JSON.parse(brut.d); } catch { return null; }
  }
  return brut && brut.code ? brut : null;
}

async function lire(code) {
  const s = store();
  const brut = await s.get(PREFIXE + encodeURIComponent(code), { type: 'json', consistency: 'strong' });
  return decoder(brut);
}

/* ── l'index des codes ──────────────────────────────────────────────
   Le parcours d'un préfixe (store.list) n'est pas immédiat chez Netlify :
   un code tout juste créé pouvait n'apparaître qu'avec du retard, et le
   back-office affichait « aucun code » alors que la fiche existait bel et
   bien. On tient donc à côté une liste des codes, lue par sa clé exacte
   et en cohérence forte : elle, elle est à jour tout de suite.

   Le parcours du préfixe reste utilisé en complément — si l'index venait
   à manquer ou à être incomplet, rien n'est perdu et il se reconstruit. */
const CLE_INDEX = 'parrainage/_index';

async function indexLu() {
  try {
    const d = await store().get(CLE_INDEX, { type: 'json', consistency: 'strong' });
    return Array.isArray(d && d.codes) ? d.codes.filter(Boolean).map(String) : [];
  } catch { return []; }
}

async function indexAjouter(code) {
  const s = store();
  for (let essai = 0; essai < 5; essai++) {
    const actuel = await s.getWithMetadata(CLE_INDEX, { type: 'json', consistency: 'strong' });
    const codes = Array.isArray(actuel && actuel.data && actuel.data.codes) ? actuel.data.codes.slice() : [];
    if (codes.indexOf(code) !== -1) return;
    codes.push(code);
    const ecrit = actuel && actuel.etag
      ? await s.setJSON(CLE_INDEX, { codes }, { onlyIfMatch: actuel.etag })
      : await s.setJSON(CLE_INDEX, { codes }, { onlyIfNew: true });
    if (!ecrit || ecrit.modified !== false) return;   /* écrit, ou déjà bon */
  }
  console.error('Parrainage — index non mis à jour pour', code);
}

async function ecrire(fiche) {
  const s = store();
  await s.set(
    PREFIXE + encodeURIComponent(fiche.code),
    JSON.stringify({ id: fiche.code, d: JSON.stringify(fiche), _created: fiche.cree }),
    { metadata: { updatedAt: new Date().toISOString(), collection: 'parrainage', id: fiche.code } },
  );
  await indexAjouter(fiche.code);
}

/* Suppression d'un code : la fiche et son entrée dans l'index. Un code
   supprimé n'est plus reconnu au moment d'une demande, et le client peut
   en recréer un depuis la page Parrainage — ce sera le même libellé,
   reparti de zéro. */
export async function supprimerCode(code) {
  const s = store();
  const propre = sansAccents(code || '').replace(/[^A-Z0-9]/g, '');
  if (!propre) throw new Error('code non précisé');

  await s.delete(PREFIXE + encodeURIComponent(propre));

  for (let essai = 0; essai < 5; essai++) {
    const actuel = await s.getWithMetadata(CLE_INDEX, { type: 'json', consistency: 'strong' });
    const codes = Array.isArray(actuel && actuel.data && actuel.data.codes) ? actuel.data.codes : [];
    if (codes.indexOf(propre) === -1) break;
    const restants = codes.filter((c) => c !== propre);
    const ecrit = await s.setJSON(CLE_INDEX, { codes: restants }, { onlyIfMatch: actuel.etag });
    if (!ecrit || ecrit.modified !== false) break;
  }
  return { ok: true, code: propre };
}

/* Tous les codes : ceux de l'index, plus ceux qu'un parcours du préfixe
   ferait apparaître. Les doublons sont écartés. */
export async function tousLesCodes() {
  const s = store();
  const cles = new Set();
  for (const code of await indexLu()) cles.add(PREFIXE + encodeURIComponent(code));
  try {
    const { blobs } = await s.list({ prefix: PREFIXE });
    for (const b of blobs) if (b.key !== CLE_INDEX) cles.add(b.key);
  } catch (e) { console.error('Parrainage — parcours impossible :', e.message); }

  const out = [];
  for (const cle of cles) {
    try {
      const f = decoder(await s.get(cle, { type: 'json', consistency: 'strong' }));
      if (f && f.code) out.push(f);
    } catch (e) { console.error('Parrainage — lecture impossible :', cle, e.message); }
  }
  return out;
}

/* ── le planning des réservations sert de base clients ───────────── */
async function clientsDuPlanning() {
  const s = store();
  const { blobs } = await s.list({ prefix: 'reservations/' });
  const noms = [];
  for (const b of blobs) {
    if (b.key === 'reservations/cfg') continue;
    let r = null;
    try {
      const brut = await s.get(b.key, { type: 'json', consistency: 'strong' });
      r = brut && typeof brut.d === 'string' ? JSON.parse(brut.d) : brut;
    } catch { continue; }
    if (!r) continue;
    if (r.client) noms.push({ client: String(r.client), date: r.dateStart || r.dateEnd || '' });
  }
  return noms;
}

/* ═══════════════════════════ ROUTES ═══════════════════════════════ */

export default async (request) => {
  const url = new URL(request.url);
  const action = (url.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();

  if (trop(request, 40, 10 * 60 * 1000, 'parr')) return json({ ok: false, erreur: 'Trop de tentatives, réessayez dans quelques minutes.' }, 429);
  try {
    /* Limite durable par IP (Netlify Blobs) : la limite en mémoire ci-dessus
       ne vaut que pour une instance, celle-ci vaut pour toutes. */
    if (request.method === 'POST' && await limiteBlobs(request, 'parrainage', 15, 60 * 60 * 1000)) {
      return json({ ok: false, erreur: 'Trop de tentatives, réessayez plus tard.' }, 429);
    }
    if (action === 'creer' && request.method === 'POST') return await creer(request);
    if (action === 'verifier') return await verifier(url);
    if (action === 'utiliser' && request.method === 'POST') return await utiliser(request);
    return json({ ok: false, erreur: 'Adresse inconnue' }, 404);
  } catch (e) {
    console.error('Parrainage :', e && e.message);
    return json({ ok: false, erreur: 'Service momentanément indisponible' }, 500);
  }
};

/* ── création du code d'un parrain ──────────────────────────────── */
async function creer(request) {
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, erreur: 'Requête invalide' }, 400); }

  const nom = String(body.nom || '').trim();
  const prenom = String(body.prenom || '').trim();
  if (nom.length < 2 || prenom.length < 2) {
    return json({ ok: false, raison: 'incomplet', message: 'Indiquez votre nom et votre prénom.' }, 400);
  }

  /* 1. Le nom figure-t-il dans le planning ? */
  const clients = await clientsDuPlanning();
  const trouve = clients.find((c) => memePersonne(c.client, nom + ' ' + prenom));
  if (!trouve) {
    return json({
      ok: false,
      raison: 'inconnu',
      message: 'Nous ne retrouvons aucune réservation à ce nom. '
             + 'Appelez-nous au 06 50 83 68 28 ou écrivez à contact@vespraevent.com : '
             + 'nous créerons votre code avec vous.',
    });
  }

  /* 2. Ce parrain a-t-il déjà un code ? On regarde d'abord la clé
        attendue, puis l'ensemble des codes : un homonyme peut avoir
        décalé le code d'une lettre. */
  const voulu = codeDe(nom, prenom);
  const existants = await tousLesCodes();
  const sien = existants.find((f) => memePersonne(f.parrain || '', nom + ' ' + prenom));
  if (sien) {
    return json({ ok: true, code: sien.code, dejaExistant: true, remise: REMISE, parrain: sien.parrain });
  }

  /* 3. Code déjà pris par un homonyme : une lettre est ajoutée avant
        le 10 (MARTINJULIENB10) plutôt que de renvoyer une erreur. */
  let code = voulu;
  if (existants.some((f) => f.code === code)) {
    const base = voulu.slice(0, -String(REMISE).length);
    for (const lettre of 'BCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const essai = base + lettre + String(REMISE);
      if (!existants.some((f) => f.code === essai)) { code = essai; break; }
    }
  }

  const fiche = {
    code,
    parrain: nomAffiche(nom, prenom),
    nom: String(nom).trim().toUpperCase(), prenom: jolieCasse(prenom),
    remise: REMISE,
    cree: new Date().toISOString(),
    /* dernière réservation connue : sert seulement à retrouver le
       client dans le planning depuis le back-office */
    reference: trouve.client,
    referenceDate: trouve.date || '',
    utilisations: [],
    /* avoirs de 10 € que vous avez déjà déduits sur une location du
       parrain ; le back-office les coche ici */
    deduits: 0,
  };
  await ecrire(fiche);
  return json({ ok: true, code, dejaExistant: false, remise: REMISE, parrain: fiche.parrain });
}

/* ── vérification d'un code saisi par un filleul ────────────────── */
async function verifier(url) {
  const code = sansAccents(url.searchParams.get('code') || '').replace(/[^A-Z0-9]/g, '');
  if (!code) return json({ ok: false, raison: 'vide', message: 'Saisissez votre code de parrainage.' });

  const fiche = await lire(code);
  if (!fiche) {
    return json({ ok: false, raison: 'inconnu', message: 'Ce code n’existe pas. Vérifiez l’orthographe auprès de votre parrain.' });
  }

  /* On ne se parraine pas soi-même. */
  const nom = url.searchParams.get('nom') || '';
  const prenom = url.searchParams.get('prenom') || '';
  if ((nom || prenom) && memePersonne(fiche.parrain, nom + ' ' + prenom)) {
    return json({ ok: false, raison: 'soi-meme', message: 'Ce code est le vôtre : il est destiné à vos proches, pas à vos propres locations.' });
  }

  /* Un filleul déjà passé avec ce code ne bénéficie pas deux fois de
     la remise. */
  if ((nom || prenom) && (fiche.utilisations || []).some((u) => memePersonne(u.filleul || '', nom + ' ' + prenom))) {
    return json({ ok: false, raison: 'deja-utilise', message: 'Ce code a déjà été utilisé pour une demande à votre nom.' });
  }

  /* Le prénom seul suffit à reconnaître son parrain sans exposer le
     nom complet d'un autre client. */
  const initiale = (fiche.nom || '').trim().charAt(0).toUpperCase();
  return json({
    ok: true,
    code: fiche.code,
    remise: Number(fiche.remise) || REMISE,
    minimum: PANIER_MINIMUM,
    parrain: `${jolieCasse(fiche.prenom || '')}${initiale ? ' ' + initiale + '.' : ''}`.trim(),
  });
}

/* ── enregistrement d'une utilisation ───────────────────────────── */
async function utiliser(request) {
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, erreur: 'Requête invalide' }, 400); }

  const code = sansAccents(body.code || '').replace(/[^A-Z0-9]/g, '');
  if (!code) return json({ ok: false, raison: 'vide' });
  if (body.panier !== undefined && Number(body.panier) < PANIER_MINIMUM) {
    return json({ ok: false, raison: 'minimum', message: `La remise s’applique à partir de ${PANIER_MINIMUM} € de panier.` });
  }

  const nom = String(body.nom || '').trim();
  const prenom = String(body.prenom || '').trim();

  /* Plusieurs demandes peuvent arriver en même temps : on relit la
     fiche juste avant d'écrire, et on recommence si elle a changé
     entre-temps. Sans cette précaution, deux filleuls simultanés
     s'effaceraient l'un l'autre. */
  for (let essai = 0; essai < 5; essai++) {
    const fiche = await lire(code);
    if (!fiche) return json({ ok: false, raison: 'inconnu' });
    if (memePersonne(fiche.parrain, nom + ' ' + prenom)) return json({ ok: false, raison: 'soi-meme' });

    const liste = Array.isArray(fiche.utilisations) ? fiche.utilisations.slice() : [];
    if (liste.some((u) => memePersonne(u.filleul || '', nom + ' ' + prenom))) {
      return json({ ok: true, deja: true, utilisations: liste.length });
    }
    liste.push({
      filleul: nomAffiche(nom, prenom),
      email: String(body.email || '').trim().slice(0, 120),
      tel: String(body.tel || '').trim().slice(0, 30),
      dateEvenement: String(body.date || '').trim().slice(0, 20),
      demande: new Date().toISOString(),
      /* en-attente → validee → acquis : l'avoir du parrain n'est dû
         qu'au dernier état, une fois la location passée. Le
         back-office fait avancer cet état. */
      statut: 'en-attente',
      montant: Number(fiche.remise) || REMISE,
    });
    fiche.utilisations = liste;

    try {
      await ecrire(fiche);
      return json({ ok: true, utilisations: liste.length });
    } catch (e) {
      if (essai === 4) throw e;
    }
  }
  return json({ ok: false, erreur: 'Enregistrement impossible' }, 500);
}
