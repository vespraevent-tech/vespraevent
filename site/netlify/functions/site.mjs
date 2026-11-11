/* Vespra Event — API publique du site.
   Les contenus administrables sont lus directement depuis Netlify Blobs.
   Cette fonction est volontairement séparée de admin.mjs : aucune session
   admin, aucun formulaire Netlify et aucune signature ne sont nécessaires
   pour afficher du contenu déjà enregistré dans le store public.
*/
/* La bibliothèque Netlify Blobs est incluse dans le dossier (_blobs.mjs)
   plutôt qu'installée : le site se déploie par simple dépôt du dossier,
   sans installation de paquets. Importée par son nom, elle serait
   introuvable au moment de l'exécution et TOUTE modification depuis le
   back-office échouerait. */
import { getStore } from './_stockage.mjs';

const DATA_STORE = 'vespra-admin-data';

/* Une réponse réussie est gardée dix secondes par le réseau de diffusion de
   Netlify (puis servie le temps d'être renouvelée) : le site n'interroge
   plus le stockage à chaque visite. Le back-office vide ce cache à chaque
   enregistrement (étiquette « vespra-contenu »). Une erreur n'est jamais gardée. */
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: status === 200 ? {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
    'netlify-cdn-cache-control': 'public, s-maxage=10',
    'cache-tag': 'vespra-contenu',
  } : {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    'netlify-cdn-cache-control': 'no-store',
  },
});

async function readCollection(name) {
  const store = getStore(DATA_STORE);
  const { blobs } = await store.list({ prefix: `${name}/` });
  const items = [];
  /* lecture par paquets en parallèle (et non une par une) */
  const lire = async (b) => {
    try {
      const item = await store.get(b.key, { type: 'json', consistency: 'strong' });
      return item && typeof item === 'object' ? item : null;
    } catch (e) {
      console.error(`Blob ${b.key}: ${e.message}`);
      return null;
    }
  };
  for (let i = 0; i < blobs.length; i += 25) {
    const lot = await Promise.all(blobs.slice(i, i + 25).map(lire));
    lot.forEach((x) => { if (x) items.push(x); });
  }
  return items;
}

function latest(items) {
  const byId = new Map();
  for (const item of items) {
    if (!item || !item.id) continue;
    const id = String(item.id);
    const old = byId.get(id);
    if (!old || new Date(item._created || 0) > new Date(old._created || 0)) {
      byId.set(id, item);
    }
  }
  return [...byId.values()];
}

function expose(items) {
  return latest(items)
    .filter(item => item.action !== 'supprimer')
    .map(({ sig, _created, _submissionId, email, mail, contact, emailEnvoye, recuLe, telephone, tel, ...item }) => item);
}

/* Les images ont besoin d'un traitement légèrement différent : une image
   supprimée doit rester connue du navigateur pour qu'il puisse masquer
   l'image d'origine écrite dans les fichiers HTML. Les autres collections
   continuent, elles, à masquer leurs enregistrements « supprimer ». */
function exposeImages(items) {
  return latest(items)
    .map(({ sig, _created, _submissionId, ...item }) => item)
    .filter(item => item && item.id);
}

export default async (request) => {
  const url = new URL(request.url);
  const page = url.searchParams.get('page') || '';

  try {
    const [theme, textes, notices, produits, google, images, miseEnPage, salles, prestataires, catalogue, entreprise] = await Promise.all([
      readCollection('theme'),
      readCollection('textes'),
      readCollection('notices'),
      readCollection('produits'),
      readCollection('google'),
      readCollection('images'),
      readCollection('mise-en-page'),
      readCollection('salles'),
      readCollection('prestataires'),
      readCollection('catalogue'),
      readCollection('entreprise'),
    ]);

    return json({
      theme: expose(theme).find(x => x.id === 'theme') || {},
      /* ambiance du site (Halloween, Noël…) : réglée depuis le back-office */
      ambiance: expose(theme).find(x => x.id === 'ambiance') || {},
      /* bandeau défilant du haut : messages, liens, affichage (page « Bandeau » du back-office) */
      bandeau: expose(theme).find(x => x.id === 'bandeau') || {},
      textes: expose(textes).filter(x => !page || x.page === page),
      notices: expose(notices).filter(x => !page || x.page === page),
      produits: expose(produits),
      google: expose(google),
      images: exposeImages(images),
      miseEnPage: expose(miseEnPage).filter(x => !page || x.page === page),
      /* les salles recommandées sont les mêmes pour tout le site :
         la page d'accueil, la page de recommandations et les pages
         villes trient elles-mêmes ce qui les concerne */
      /* une demande reçue par le formulaire attend une validation :
         tant que son statut est « attente », elle n'apparaît nulle part */
      salles: expose(salles).filter(x => x.statut !== 'attente'),
      /* même règle pour les prestataires proposés par le formulaire */
      prestataires: expose(prestataires).filter(x => x.statut !== 'attente'),
      /* produits créés depuis le back-office : seuls les publiés
         apparaissent au catalogue et sur la page d'accueil */
      catalogue: expose(catalogue).filter(x => x.statut === 'publie'),
      prestations: (() => {
        const x = expose(produits).find(p => p && p.type === 'prestations' && p.id === '__prestations');
        let s = x && x.items;
        if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = []; } }
        return Array.isArray(s) ? s : [];
      })(),
      categoriesConnus: (() => {
        const x = expose(produits).find(p => p && p.type === 'categories-catalogue' && p.id === '__categories_catalogue');
        let s = x && x.connus;
        if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = []; } }
        return Array.isArray(s) ? s : [];
      })(),
      categoriesSupprimees: (() => {
        const x = expose(produits).find(p => p && p.type === 'categories-catalogue' && p.id === '__categories_catalogue');
        let s = x && x.supprimees;
        if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = []; } }
        return Array.isArray(s) ? s : [];
      })(),
      categoriesCatalogue: (() => {
        const x = expose(produits).find(p => p && p.type === 'categories-catalogue' && p.id === '__categories_catalogue');
        if (!x) return [];
        /* Les champs complexes sont sérialisés en JSON dans Netlify Blobs.
           On les retransforme ici avant de les exposer à catalogue.html. */
        let categories = x.categories;
        if (typeof categories === 'string') { try { categories = JSON.parse(categories); } catch { categories = []; } }
        if (!Array.isArray(categories)) return [];
        return categories.map((c, i) => ({
          ...c,
          ordre: Number.isFinite(Number(c?.ordre)) ? Number(c.ordre) : i,
          produits: Array.isArray(c?.produits) ? c.produits : (typeof c?.produits === 'string' ? (() => { try { const v = JSON.parse(c.produits); return Array.isArray(v) ? v : []; } catch { return []; } })() : []),
        }));
      })(),
      /* informations légales de l'entreprise (jamais le RIB : il est dans une autre collection, privée) */
      entreprise: expose(entreprise).find(x => x.id === 'cfg') || {},
    });
  } catch (e) {
    console.error('API publique Vespra:', e.message);
    return json({
      theme: {}, ambiance: {}, bandeau: {}, textes: [], notices: [], produits: [], google: [], images: [], miseEnPage: [], salles: [], prestataires: [], catalogue: [], categoriesCatalogue: [], categoriesSupprimees: [], categoriesConnus: [], entreprise: {},
      error: 'Lecture Netlify Blobs impossible',
    }, 500);
  }
};
