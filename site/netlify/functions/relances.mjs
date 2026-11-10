/* Relances automatiques : passe une fois par jour (9 h / 10 h, heure de Paris).
   Elle ne fait qu'appeler la route signée du back-office, qui applique le réglage
   « Réponse automatique › Relance » (désactivée par défaut). */
import { createHmac } from 'node:crypto';

export const config = { schedule: '0 8 * * *' };

export default async () => {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
  if (!secret) { console.error('Relances : secret absent'); return; }
  const site = (process.env.URL || 'https://www.vespraevent.fr').replace(/\/$/, '');
  const sig = createHmac('sha256', secret).update('relances').digest('hex');
  try {
    const r = await fetch(site + '/api/espace/relances-run', { method: 'POST', headers: { 'x-accuse': sig, 'content-type': 'application/json' }, body: '{}' });
    console.log('Relances :', r.status, await r.text());
  } catch (e) { console.error('Relances impossibles :', e.message); }
};
