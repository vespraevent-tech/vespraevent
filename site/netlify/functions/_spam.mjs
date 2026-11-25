/* ════════════════════════════════════════════════════
   Demandes indésirables (robots) : reconnues ici, elles ne s'affichent pas dans le back-office
   et ne déclenchent ni notification ni accusé de réception.
   Règles volontairement prudentes : un vrai client ne doit jamais être écarté.
   ════════════════════════════════════════════════════ */
const VOYELLES = 'aeiouyàâäéèêëîïôöùûüÿœæ';

/* suites d'au moins 5 consonnes : « wfhqw », « qwhfq »… quasi inexistantes en français (adresses et liens retirés avant) */
function suitesConsonnes(t) {
  const propre = String(t || '').toLowerCase().replace(/https?:\/\/\S+|\S+@\S+|www\.\S+|\S+\.(fr|com|net|org)\b/g, ' ');
  const re = new RegExp('[b-df-hj-np-tv-xz]{5,}', 'g');
  return (propre.match(re) || []).filter((m) => ![...m].some((c) => VOYELLES.includes(c))).length;
}
/* mots de 12 lettres ou plus, sans tiret */
function motsLongs(t) {
  return (String(t || '').replace(/https?:\/\/\S+|\S+@\S+/g, ' ').match(/[A-Za-zÀ-ÿ]{12,}/g) || []).length;
}

export function estSpam(data) {
  const d = data || {};
  const val = (k) => String(d[k] == null ? '' : d[k]).trim();
  const noms = [val('nom'), val('prenom'), val('name'), val('client')].filter(Boolean);
  /* signature d'un robot très répandu : un prénom anglais collé à « sap » (Jasonsap, Robertsap…) */
  if (noms.some((n) => /^[A-Z][a-z]{2,}sap$/.test(n))) return 'nom de robot';
  /* formulaire envoyé en moins de 3 secondes après l'ouverture de la page */
  const tps = Number(val('tps'));
  if (val('tps') !== '' && Number.isFinite(tps) && tps < 3) return 'envoi trop rapide';
  /* message en lettres tapées au hasard */
  const texte = [val('message'), val('precisions'), val('details'), val('commentaire')].join(' ');
  const suites = suitesConsonnes(texte);
  if (suites >= 2 || (suites >= 1 && motsLongs(texte) >= 2)) return 'message incohérent';
  return '';
}
