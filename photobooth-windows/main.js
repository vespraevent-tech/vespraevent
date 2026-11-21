/* Vespra Event Photobooth — application Windows des bornes.
   Ouvre l'appli des bornes du site en plein écran, se lance au démarrage de Windows,
   pilote le reflex Canon via digiCamControl (webserver, port 5513), enregistre les photos
   dans un dossier par événement et imprime sans fenêtre sur la DNP. */
const { app, BrowserWindow, ipcMain, shell, powerSaveBlocker, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const URL_BORNE = 'https://www.vespraevent.fr/photobooth/app/';
const DCC = 'http://localhost:5513';

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const fichierReglages = () => path.join(app.getPath('userData'), 'reglages.json');
let R = { url: URL_BORNE, dossier: 'C:\\VespraEvent\\Photobooth', demarrageAuto: true, imprimante: '', imprimanteBandes: '', pleinEcran: true };
try { R = { ...R, ...JSON.parse(fs.readFileSync(fichierReglages(), 'utf8')) }; } catch {}
const sauver = () => { try { fs.mkdirSync(path.dirname(fichierReglages()), { recursive: true }); fs.writeFileSync(fichierReglages(), JSON.stringify(R, null, 2)); } catch {} };

let fen = null, appareil = '', imprimantes = [];
const propre = (s) => String(s || 'Evenement').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Evenement';
const etat = () => ({ version: app.getVersion(), appareil, imprimante: R.imprimante, imprimanteBandes: R.imprimanteBandes, dossier: R.dossier, demarrageAuto: R.demarrageAuto });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function dcc(q, type = 'text', ms = 4000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(DCC + q, { signal: c.signal, cache: 'no-store' }); if (!r.ok) return null; return type === 'bin' ? Buffer.from(await r.arrayBuffer()) : (await r.text()).trim(); }
  catch { return null; } finally { clearTimeout(t); }
}

/* ── démarrage automatique de Windows ── */
function appliquerDemarrage() {
  if (process.platform !== 'win32') return;
  app.setLoginItemSettings({ openAtLogin: !!R.demarrageAuto, path: process.execPath });
}

/* ── fenêtre plein écran, sans barre, qui revient seule si le réseau manque ── */
function creerFenetre() {
  fen = new BrowserWindow({
    width: 1920, height: 1080, kiosk: R.pleinEcran !== false, fullscreen: R.pleinEcran !== false, autoHideMenuBar: true, backgroundColor: '#F6F5F2', title: 'Vespra Event Photobooth',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, backgroundThrottling: false },
  });
  fen.removeMenu();
  const charger = () => fen.loadURL(R.url).catch(() => {});
  fen.webContents.on('did-fail-load', (_e, code, _d, url, principal) => {
    if (!principal || code === -3) return;
    fen.loadFile(path.join(__dirname, 'hors-ligne.html')).catch(() => {});
    setTimeout(charger, 5000);
  });
  fen.webContents.on('render-process-gone', () => setTimeout(charger, 1000));       /* plantage de la page : rechargée seule */
  fen.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  fen.webContents.session.setPermissionRequestHandler((_wc, perm, ok) => ok(['media', 'fullscreen', 'clipboard-sanitized-write'].includes(perm)));
  charger();
}

/* ── appareil photo (digiCamControl) ── */
async function detecter() {
  const r = await dcc('/?slc=get&param1=camera&param2=', 'text', 2500);
  const avant = appareil;
  appareil = r == null ? '' : (r && r !== '-' && !/^</.test(r) ? r : 'Reflex Canon (digiCamControl)');
  if (avant !== appareil && fen) fen.webContents.send('etat', etat());
}
setInterval(detecter, 5000);

ipcMain.on('etat', (e) => { e.returnValue = etat(); });
ipcMain.handle('visee', async (_e, on) => { await dcc(on ? '/?CMD=LiveViewWnd_Show' : '/?CMD=LiveViewWnd_Hide'); return true; });
ipcMain.handle('image-visee', async () => {
  const b = await dcc('/liveview.jpg?t=' + Date.now(), 'bin', 1500);
  return b && b.length > 500 ? 'data:image/jpeg;base64,' + b.toString('base64') : null;
});
ipcMain.handle('declencher', async () => {
  const dossierCapture = path.join(R.dossier, '_capture');
  fs.mkdirSync(dossierCapture, { recursive: true });
  await dcc('/?slc=set&param1=session.folder&param2=' + encodeURIComponent(dossierCapture));
  const avant = await dcc('/?slc=get&param1=lastcaptured&param2=');
  const t0 = Date.now();
  const r = await dcc('/?slc=capture&param1=&param2=', 'text', 15000);
  if (r == null) return { ok: false, erreur: 'digiCamControl ne répond pas (ouvert ? webserver activé ?)' };
  for (let i = 0; i < 100; i++) {                                    /* jusqu'à 15 s */
    await pause(150);
    const der = await dcc('/?slc=get&param1=lastcaptured&param2=');
    const candidats = [];
    if (der && der !== '-' && der !== avant) candidats.push(path.isAbsolute(der) ? der : path.join(dossierCapture, der));
    try { /* secours : la photo la plus récente du dossier de capture */
      const l = fs.readdirSync(dossierCapture).filter((n) => /\.jpe?g$/i.test(n)).map((n) => ({ f: path.join(dossierCapture, n), t: fs.statSync(path.join(dossierCapture, n)).mtimeMs })).filter((x) => x.t >= t0 - 500).sort((a, b) => b.t - a.t);
      if (l[0]) candidats.push(l[0].f);
    } catch {}
    for (const f of candidats) {
      try {
        const a = fs.statSync(f).size; await pause(250); const b = fs.statSync(f).size;     /* fichier fini d'écrire */
        if (a > 0 && a === b) { const octets = fs.readFileSync(f); try { fs.unlinkSync(f); } catch {} return { ok: true, octets }; }
      } catch {}
    }
  }
  return { ok: false, erreur: 'La photo n’est pas arrivée (carte, mise au point ?)' };
});

/* ── dossier de l'événement ── */
ipcMain.handle('enregistrer', async (_e, evt, nom, octets) => {
  const d = path.join(R.dossier, propre(evt)); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, propre(nom).replace(/[^\w.-]/g, '_')), Buffer.from(octets)); return true;
});
ipcMain.handle('ouvrir-dossier', async (_e, evt) => { const d = path.join(R.dossier, propre(evt)); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); });
ipcMain.handle('reglage', async (_e, k, v) => {
  if (!['dossier', 'demarrageAuto', 'imprimante', 'imprimanteBandes', 'pleinEcran'].includes(k)) return false;
  R[k] = v; sauver(); if (k === 'demarrageAuto') appliquerDemarrage(); return true;
});
ipcMain.handle('plein-ecran', async (_e, v) => { if (fen) { fen.setKiosk(!!v); fen.setFullScreen(!!v); } return true; });

/* ── impression silencieuse (DNP) : la feuille 10×15 entière, les bandelettes sont déjà doublées ── */
ipcMain.handle('imprimantes', async () => {
  try { imprimantes = (await fen.webContents.getPrintersAsync()).map((p) => p.name); } catch { imprimantes = []; }
  if (!R.imprimante) { R.imprimante = imprimantes.find((n) => /dnp|ds620|rx1|ds-rx1/i.test(n)) || ''; sauver(); }
  return imprimantes;
});
ipcMain.handle('imprimer', async (_e, octets, o) => {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  const url = 'data:image/jpeg;base64,' + Buffer.from(octets).toString('base64');
  const html = `<!doctype html><style>@page{margin:0}html,body{margin:0;height:100%}img{width:100%;height:100%;object-fit:cover;display:block}</style><img src="${url}">`;
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const paysage = o && o.format === '4x6l';
  return new Promise((ok) => {
    w.webContents.print({ silent: true, printBackground: true, deviceName: ((o && o.format === '2x6' && R.imprimanteBandes) || R.imprimante) || undefined, copies: Math.max(1, Math.min(10, Number(o && o.copies) || 1)),
      landscape: paysage, margins: { marginType: 'none' }, pageSize: { width: 101600, height: 152400 } },
    (reussi, raison) => { w.destroy(); ok({ ok: reussi, erreur: reussi ? '' : raison }); });
  });
});

app.whenReady().then(() => {
  appliquerDemarrage();
  powerSaveBlocker.start('prevent-display-sleep');                     /* l'écran ne se met jamais en veille */
  /* sortie de secours pour le personnel : Ctrl+Maj+Q quitte, Ctrl+Maj+K bascule le plein écran */
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  globalShortcut.register('CommandOrControl+Shift+K', () => { if (fen) { const v = !fen.isKiosk(); fen.setKiosk(v); fen.setFullScreen(v); } });
  creerFenetre(); detecter();
  fen.webContents.once('did-finish-load', async () => {          /* imprimante DNP choisie d'office */
    try { const l = (await fen.webContents.getPrintersAsync()).map((p) => p.name); if (!R.imprimante) { R.imprimante = l.find((n) => /dnp|ds620|rx1/i.test(n)) || ''; sauver(); fen.webContents.send('etat', etat()); } } catch {}
  });
});
app.on('second-instance', () => { if (fen) { fen.show(); fen.focus(); } });
app.on('window-all-closed', () => app.quit());
