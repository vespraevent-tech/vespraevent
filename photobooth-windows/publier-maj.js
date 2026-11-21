/* Publie une mise à jour de l'appli Windows sur le site : node publier-maj.js "Notes de version"
   Copie core.js, preload.js, canon.js, hors-ligne.html et version.json dans site/photobooth/app/maj/<version>/ et met à jour manifest.json.
   Ensuite : déposer le site sur Netlify, puis, sur chaque PC : menu > Général > Mettre à jour l'application. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const FICHIERS = ['core.js', 'preload.js', 'canon.js', 'hors-ligne.html', 'version.json'];
const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8')).version;
const dest = path.join(__dirname, '..', 'site', 'photobooth', 'app', 'maj');
const dossier = path.join(dest, version); fs.rmSync(dossier, { recursive: true, force: true }); fs.mkdirSync(dossier, { recursive: true });
const fichiers = FICHIERS.map((nom) => { const b = fs.readFileSync(path.join(__dirname, nom)); fs.writeFileSync(path.join(dossier, nom), b); return { nom, sha256: crypto.createHash('sha256').update(b).digest('hex') }; });
fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({ version, notes: process.argv[2] || '', fichiers }, null, 2));
console.log('Mise à jour', version, 'publiée dans', dossier);
