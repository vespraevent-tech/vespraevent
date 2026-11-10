/* ─────────────────────────────────────────────────────────────
   FICHES PRODUIT CRÉÉES DEPUIS LE BACK-OFFICE

   Les vingt fiches historiques sont des fichiers HTML : Netlify les
   sert directement et cette fonction ne les voit jamais. Elle ne
   reçoit que les adresses qui ne correspondent à aucun fichier.
   Si cette adresse est celle d'un produit enregistré et publié,
   la page est construite à partir du gabarit « modele-produit.html »
   et des données du produit ; sinon on rend la page 404 du site.

   Conséquence voulue : un produit ajouté depuis le back-office
   sort en /mon-produit, exactement comme s'il avait son fichier.
   ───────────────────────────────────────────────────────────── */
import { getStore } from './_stockage.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DATA_STORE = 'vespra-admin-data';
const COLLECTION = 'catalogue';

/* ── lecture du produit ─────────────────────────────────────── */

async function produitPour(slug) {
  const store = getStore(DATA_STORE);
  const { blobs } = await store.list({ prefix: `${COLLECTION}/` });
  let trouve = null;
  for (const b of blobs) {
    let item;
    try {
      item = await store.get(b.key, { type: 'json', consistency: 'strong' });
    } catch { continue; }
    if (!item || item.action === 'supprimer') continue;
    if (String(item.id) !== slug) continue;
    /* plusieurs enregistrements pour un même identifiant : on garde le plus récent */
    if (!trouve || new Date(item._created || 0) > new Date(trouve._created || 0)) trouve = item;
  }
  return trouve && trouve.statut === 'publie' ? trouve : null;
}

/* ── échappements ───────────────────────────────────────────── */

const ech = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* le texte rédigé peut contenir <strong> et <em>, rien d'autre */
function texteRiche(t) {
  return ech(t)
    .replace(/&lt;(\/?)(strong|em)&gt;/g, '<$1$2>');
}

/* ── construction du corps de page ──────────────────────────── */

function corps(p) {
  const images = Array.isArray(p.images) && p.images.length ? p.images : (p.img ? [p.img] : []);
  const principale = images[0] || '';
  const cats = Array.isArray(p.cats) && p.cats.length ? p.cats : [p.cat].filter(Boolean);

  const points = (p.points || []).map(x => `<li>${texteRiche(x)}</li>`).join('');

  const sections = (p.sections || []).map(s =>
    `<h2>${ech(s.titre)}</h2>` +
    (s.paragraphes || []).map(x => `<p>${texteRiche(x)}</p>`).join('')
  ).join('');

  const faq = (p.faq || []).map(f =>
    `<div class="faq-item"><button class="faq-q" onclick="toggleFaq(this)">${ech(f.q)}` +
    `<span class="faq-icon">+</span></button><div class="faq-a"><div class="faq-a-inner">` +
    `${texteRiche(f.r)}</div></div></div>`
  ).join('');

  return `<div class="prod-page">
<p class="prod-breadcrumb"><a href="index.html">Accueil</a> › <a href="catalogue.html">Catalogue</a> › ${ech(p.nom)}</p>
<div class="prod-split">
  <div class="prod-img-col">
    <div class="prod-img-main" onclick="pgOpen()" title="Agrandir">
      <img src="${ech(principale)}" alt="${ech(p.nom)}" loading="eager" id="prodMainImg" width="1200" height="1200" decoding="async">
      <span class="pg-zoom" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/></svg></span>
    </div>
    <div class="prod-img-thumbs" id="prodThumbs"></div>
  </div>
  <div class="prod-info-col">
    <div class="prod-cat-tag">${cats.map(ech).join(' · ')}</div>
    <h1 class="prod-title">${ech(p.nom).toUpperCase()}</h1>
    <a href="#avis" class="prod-rating"><span class="prod-stars">★★★★★</span><span class="prod-rating-count">Avis vérifiés</span></a>
    <hr class="prod-divider">
    <div class="prod-from-label" style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--g2)">Location événement</div>
    <div class="prod-price-main" id="prodPriceDisplay">${Number(p.prix) || 0} € <small>/ événement</small></div>
    <div class="prod-duree" style="font-size:12px;color:var(--g2);margin-top:4px">L'événement comprend 5 jours maximum.</div>
    <div class="prod-description-fold"><p class="prod-short-desc">${texteRiche(p.descCourte)}</p></div>
    <div id="configurateur"></div>
    <ul class="prod-features">${points}</ul>
    <div class="prod-ctas"><button class="btn-add-cart" id="addToCartBtn" data-product-id="${ech(p.id)}" onclick="addToCartProduct()">Ajouter au devis</button></div>
    <div class="prod-trust">
      <div class="prod-trust-item"><span class="prod-trust-icon">🚚</span> Livraison gratuite à Vitré</div>
      <div class="prod-trust-item"><span class="prod-trust-icon">📞</span> Service client 7j/7</div>
      <div class="prod-trust-item"><span class="prod-trust-icon">✅</span> Devis gratuit</div>
    </div>
  </div>
</div>
</div>
<section class="prod-article"><div class="prod-article-inner">
${sections}
${faq ? `<div class="art-faq"><h2>Questions fréquentes</h2>${faq}</div>` : ''}
</div></section>
<link rel="stylesheet" href="/configurateur.css">
<script src="/configurateur.js"></script>
<script>
(function () {
  var PRODUIT = ${JSON.stringify({ id: p.id, nom: p.nom, prix: Number(p.prix) || 0, img: principale, config: p.config || [] })};
  function poser() {
    var hote = document.getElementById('configurateur');
    if (!hote || typeof window.VESPRA_CONFIGURATEUR !== 'function') return;
    if (!PRODUIT.config.length) { hote.remove(); return; }
    window.VESPRA_CONFIGURATEUR(hote, PRODUIT);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
})();
</script>`;
}

function donneesGoogle(p, principale) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness', '@id': 'https://www.vespraevent.fr/#business',
        name: 'Vespra Event', url: 'https://www.vespraevent.fr/',
        telephone: '+33650836828',
        address: { '@type': 'PostalAddress', addressLocality: 'Vitré', addressRegion: 'Ille-et-Vilaine', postalCode: '35500', addressCountry: 'FR' },
      },
      {
        '@type': 'Product',
        '@id': `https://www.vespraevent.fr/${p.id}#product`,
        name: p.nom,
        description: p.seo && p.seo.description ? p.seo.description : p.descCourte,
        image: principale ? [`https://www.vespraevent.fr/${principale}`] : undefined,
        brand: { '@type': 'Brand', name: 'Vespra Event' },
        offers: {
          '@type': 'Offer', priceCurrency: 'EUR', price: String(Number(p.prix) || 0),
          availability: 'https://schema.org/InStock',
          url: `https://www.vespraevent.fr/${p.id}`,
          businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
          seller: { '@id': 'https://www.vespraevent.fr/#business' },
        },
      },
      (p.faq || []).length ? {
        '@type': 'FAQPage',
        mainEntity: p.faq.map(f => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: String(f.r).replace(/<[^>]+>/g, '') },
        })),
      } : undefined,
    ].filter(Boolean),
  });
}

/* ── la page ────────────────────────────────────────────────── */

let gabarit = null;
async function modele() {
  if (gabarit) return gabarit;
  /* le gabarit est joint à la fonction par netlify.toml (included_files) */
  for (const chemin of ['modele-produit.html', join(process.cwd(), 'modele-produit.html')]) {
    try { gabarit = await readFile(chemin, 'utf8'); return gabarit; } catch { /* suivant */ }
  }
  throw new Error('modele-produit.html introuvable');
}

const html = (contenu, status = 200) => new Response(contenu, {
  status,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
    'netlify-cdn-cache-control': 'public, max-age=60, stale-while-revalidate=600',
  },
});

export default async (request) => {
  const url = new URL(request.url);
  const slug = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ''));

  let p = null;
  try {
    if (slug && !slug.includes('/')) p = await produitPour(slug);
  } catch (e) {
    console.error('Fiche produit:', e.message);
  }

  if (!p) {
    try {
      const page404 = await readFile('404.html', 'utf8');
      return html(page404, 404);
    } catch {
      return html('<!doctype html><meta charset="utf-8"><title>Page introuvable</title><p>Page introuvable.', 404);
    }
  }

  const images = Array.isArray(p.images) && p.images.length ? p.images : (p.img ? [p.img] : []);
  const principale = images[0] || '';
  const seo = p.seo || {};

  let page = await modele();
  page = page
    .split('{{TITRE}}').join(ech(seo.titre || `Location de ${p.nom} à Vitré | Vespra Event`))
    .split('{{META}}').join(ech(seo.description || String(p.descCourte || '').replace(/<[^>]+>/g, '')))
    .split('{{SLUG}}').join(ech(p.id))
    .split('{{IMAGE}}').join(ech(principale))
    .split('{{JSONLD}}').join(donneesGoogle(p, principale))
    .split('{{GALERIE}}').join(JSON.stringify(images.map(s => ({ s, a: p.nom }))))
    .split('{{REF}}').join(ech(p.id))
    .split('{{NOM_JS}}').join(JSON.stringify(p.nom))
    .split('{{PRIX}}').join(String(Number(p.prix) || 0))
    .split('{{IMAGE_JS}}').join(JSON.stringify(principale))
    .split('{{CORPS}}').join(corps(p));

  return html(page);
};
