/* Sauvegarde automatique de nuit : planning, clients et suivi. */
import { sauvegardeDuJour } from './_sauvegarde.mjs';

export default async () => {
  try {
    const r = await sauvegardeDuJour();
    return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    console.error('Sauvegarde quotidienne impossible :', e.message);
    return new Response('erreur', { status: 500 });
  }
};

export const config = { schedule: '0 2 * * *' };
