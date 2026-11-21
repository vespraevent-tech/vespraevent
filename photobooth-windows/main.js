/* Lanceur de « Vespra Event Photobooth ».
   Charge le code le plus récent : celui d'une mise à jour installée depuis les paramètres de l'appli
   (dossier de données de l'appli), sinon celui livré avec l'installation. Les photos et les réglages ne sont jamais dans ces dossiers. */
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
let dossier = __dirname;
try {
  const emb = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8')).version, base = path.join(app.getPath('userData'), 'code');
  const bons = fs.readdirSync(base).filter((d) => /^\d+\.\d+\.\d+$/.test(d) && fs.existsSync(path.join(base, d, 'OK')) && fs.existsSync(path.join(base, d, 'core.js'))).sort(cmp);
  const dernier = bons[bons.length - 1]; if (dernier && cmp(dernier, emb) > 0) dossier = path.join(base, dernier);
} catch {}
process.env.NODE_PATH = path.join(__dirname, 'node_modules'); require('node:module').Module._initPaths();   /* le code mis à jour retrouve le module USB de l'installation */
try { require(path.join(dossier, 'core.js')); }
catch (e) { console.error('Code mis à jour illisible, retour au code installé :', e.message); if (dossier !== __dirname) require(path.join(__dirname, 'core.js')); else throw e; }
