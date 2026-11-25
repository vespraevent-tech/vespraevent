/* Numéro du zip publié : sert à vérifier que le site (pages) ET les fonctions (serveur) sont bien de la même version.
   GET /api/version  →  { zip: 1526 }      et      /version.json (page) → { zip: 1526 } */
export const config = { path: '/api/version' };
export const ZIP = 1565;
export default async () => new Response(JSON.stringify({ zip: ZIP }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
