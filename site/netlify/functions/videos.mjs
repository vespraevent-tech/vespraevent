/* Vidéos et images du site stockées dans Cloudflare R2 : https://www.vespraevent.fr/videos/<nom>
   Lecture par plages (Range) pour que la vidéo démarre tout de suite et que l'on puisse avancer dedans. */
import { r2Actif, r2Plage } from './_r2.mjs';

export const config = { path: '/videos/*' };
const TYPES = { mp4: 'video/mp4', webm: 'video/webm', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Méthode non autorisée', { status: 405 });
  const nom = decodeURIComponent(new URL(request.url).pathname.replace(/^\/videos\//, ''));
  const ext = (nom.split('.').pop() || '').toLowerCase();
  if (!/^[a-z0-9._-]{1,90}$/.test(nom) || !TYPES[ext] || !r2Actif()) return new Response('Introuvable', { status: 404 });
  return r2Plage('site-medias/' + nom, request.headers.get('range'), TYPES[ext], { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800', 'Access-Control-Allow-Origin': '*' });
};
