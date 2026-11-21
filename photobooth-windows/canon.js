/* Pilote intégré des reflex Canon EOS (dont le 1300D) en USB, sans logiciel tiers.
   Protocole PTP + extensions Canon EOS, d'après le code libre de libgphoto2
   (https://github.com/gphoto/libgphoto2, licence LGPL) : session distante, image en direct,
   déclenchement, récupération de la photo. */
'use strict';

const CANON = 0x04a9;
const OC = { GetDeviceInfo: 0x1001, OpenSession: 0x1002, CloseSession: 0x1003, GetObject: 0x1009,
  SetDevicePropEx: 0x9110, PCHDDCapacity: 0x911a, SetRemoteMode: 0x9114, SetEventMode: 0x9115, GetEvent: 0x9116,
  TransferComplete: 0x9117, ReleaseOn: 0x9128, ReleaseOff: 0x9129, GetViewFinderData: 0x9153 };
const DP = { CaptureDestination: 0xd11c, EVFOutputDevice: 0xd1b0, EVFMode: 0xd1b1 };
const RC_OK = 0x2001, RC_BUSY = 0x2019;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── PTP : commandes, données, réponses, sur un transport USB (ou simulé pour les tests) ── */
class Ptp {
  constructor(t) { this.t = t; this.tid = 0; this.rx = Buffer.alloc(0); }
  async conteneur() {
    for (let essais = 0; ; ) {
      if (this.rx.length >= 12) { const n = this.rx.readUInt32LE(0); if (n >= 12 && this.rx.length >= n) { const c = this.rx.subarray(0, n); this.rx = this.rx.subarray(n); return { type: c.readUInt16LE(4), code: c.readUInt16LE(6), corps: c.subarray(12) }; } }
      const b = await this.t.in(262144);
      if (!b || !b.length) { if (++essais > 20) throw new Error('USB : plus de réponse'); continue; }
      this.rx = Buffer.concat([this.rx, b]);
    }
  }
  async op(code, params = [], donnees = null) {
    const tid = ++this.tid;
    const cmd = Buffer.alloc(12 + 4 * params.length);
    cmd.writeUInt32LE(cmd.length, 0); cmd.writeUInt16LE(1, 4); cmd.writeUInt16LE(code, 6); cmd.writeUInt32LE(tid, 8);
    params.forEach((p, i) => cmd.writeUInt32LE(p >>> 0, 12 + 4 * i));
    await this.t.out(cmd);
    if (donnees) { const d = Buffer.alloc(12 + donnees.length); d.writeUInt32LE(d.length, 0); d.writeUInt16LE(2, 4); d.writeUInt16LE(code, 6); d.writeUInt32LE(tid, 8); donnees.copy(d, 12); await this.t.out(d); }
    const morceaux = [];
    for (;;) {
      const c = await this.conteneur();
      if (c.type === 2) morceaux.push(c.corps);
      else if (c.type === 3) return { rc: c.code, data: Buffer.concat(morceaux) };
    }
  }
  async ok(code, params, donnees) { const r = await this.op(code, params, donnees); if (r.rc !== RC_OK) { const e = new Error('PTP 0x' + code.toString(16) + ' → 0x' + r.rc.toString(16)); e.rc = r.rc; throw e; } return r.data; }
}
const chaine = (b, o) => { const n = b[o]; return { s: n ? b.subarray(o + 1, o + 1 + 2 * (n - 1)).toString('utf16le') : '', fin: o + 1 + 2 * n }; };
function modeleDe(b) {                                   /* DeviceInfo : on ne garde que le nom du modèle */
  let o = 2 + 4 + 2; o = chaine(b, o).fin; o += 2;
  for (let i = 0; i < 5; i++) o += 4 + 4 * 0 + 2 * b.readUInt32LE(o);
  o = chaine(b, o).fin; return chaine(b, o).s.trim();
}
function propriete(prop, valeur, octets) {                /* SetDevicePropValueEx : taille, propriété, valeur */
  const d = Buffer.alloc(12); d.writeUInt32LE(12, 0); d.writeUInt32LE(prop, 4); if (octets === 2) d.writeUInt16LE(valeur, 8); else d.writeUInt32LE(valeur, 8); return d;
}
function evenements(b) {                                  /* GetEvent : suite d'enregistrements [taille, code, ...] */
  const out = []; let o = 0;
  while (o + 8 <= b.length) {
    const n = b.readUInt32LE(o), c = b.readUInt32LE(o + 4);
    if (n < 8 || o + n > b.length || (n === 8 && c === 0)) break;
    if (c === 0xc181 && n >= 0x29) { const z = b.indexOf(0, o + 0x28); out.push({ type: 'objet', handle: b.readUInt32LE(o + 8), format: b.readUInt16LE(o + 0x10), taille: b.readUInt32LE(o + 0x1c), nom: b.toString('latin1', o + 0x28, z < 0 ? o + n : z) }); }
    o += n;
  }
  return out;
}
function jpegDe(b) {                                      /* l'image de visée est un JPEG noyé dans l'enveloppe Canon */
  const d = b.indexOf(Buffer.from([0xff, 0xd8, 0xff])); const f = b.lastIndexOf(Buffer.from([0xff, 0xd9]));
  return d >= 0 && f > d ? b.subarray(d, f + 2) : null;
}

/* ── l'appareil ── */
class Canon {
  constructor(ouvrirTransport) { this.ouvrir = ouvrirTransport; this.ptp = null; this.modele = ''; this.file = Promise.resolve(); this.visee = false; this.fermer = null; }
  nom() { return this.ptp ? this.modele : ''; }
  seq(f) { const p = this.file.then(f, f); this.file = p.catch(() => {}); return p; }   /* une seule commande USB à la fois */
  async connecter() {
    if (this.ptp) return true;
    const t = await this.ouvrir(); if (!t) return false;
    const ptp = new Ptp(t.transport); this.fermer = t.fermer;
    try {
      await ptp.ok(OC.OpenSession, [1]);
      this.modele = modeleDe(await ptp.ok(OC.GetDeviceInfo)) || 'Canon EOS';
      await ptp.ok(OC.SetRemoteMode, [1]); await ptp.ok(OC.SetEventMode, [1]);
      await ptp.op(OC.GetEvent);
      await ptp.op(OC.PCHDDCapacity, [0x0fffffff, 0x1000, 1]);                       /* place disponible sur le PC */
      await ptp.ok(OC.SetDevicePropEx, [], propriete(DP.CaptureDestination, 4, 4));  /* photos envoyées au PC (pas sur la carte) */
      this.ptp = ptp; return true;
    } catch (e) { this.deconnecter(); throw e; }
  }
  deconnecter() { this.ptp = null; this.modele = ''; this.visee = false; try { this.fermer && this.fermer(); } catch {} this.fermer = null; }
  garde(f) { return this.seq(async () => { try { return await f(); } catch (e) { if (!e.rc) this.deconnecter(); throw e; } }); }

  /* image en direct : renvoie un JPEG, ou null si l'appareil n'est pas prêt */
  viseeImage() {
    return this.garde(async () => {
      if (!this.ptp) return null;
      if (!this.visee) {
        await this.ptp.op(OC.SetDevicePropEx, [], propriete(DP.EVFOutputDevice, 2, 4));
        await this.ptp.op(OC.SetDevicePropEx, [], propriete(DP.EVFMode, 1, 2));
        this.visee = true; await pause(300);
      }
      const r = await this.ptp.op(OC.GetViewFinderData, [0x00200000]);
      return r.rc === RC_OK ? jpegDe(r.data) : null;
    });
  }
  arreterVisee() { return this.garde(async () => { if (!this.ptp || !this.visee) return; this.visee = false; await this.ptp.op(OC.SetDevicePropEx, [], propriete(DP.EVFOutputDevice, 0, 4)); }); }

  /* déclenche et renvoie le JPEG en pleine définition */
  declencher(delaiMs = 15000) {
    return this.garde(async () => {
      if (!this.ptp) throw new Error('Appareil photo non connecté');
      const p = this.ptp; await p.op(OC.GetEvent);                                   /* vide les anciens événements */
      await p.op(OC.ReleaseOn, [1, 0]);                                               /* mi-course : mise au point */
      const t0 = Date.now(); while (Date.now() - t0 < 600) { await p.op(OC.GetEvent); await pause(100); }
      const r = await p.op(OC.ReleaseOn, [2, 0]);                                     /* pleine course */
      await p.op(OC.ReleaseOff, [2]); await p.op(OC.ReleaseOff, [1]);
      if (r.rc !== RC_OK) { const e = new Error('Déclenchement refusé (0x' + r.rc.toString(16) + ') : mise au point impossible ?'); e.rc = r.rc; throw e; }
      this.visee = false;                                                             /* le miroir est retombé : la visée est à relancer */
      const fin = Date.now() + delaiMs;
      while (Date.now() < fin) {
        const ev = evenements((await p.op(OC.GetEvent)).data).filter((x) => /\.jpe?g$/i.test(x.nom));
        if (ev.length) {
          let d, essais = 0;
          for (;;) { const g = await p.op(OC.GetObject, [ev[0].handle]); if (g.rc === RC_OK) { d = g.data; break; } if (g.rc !== RC_BUSY || ++essais > 20) { const e = new Error('Lecture de la photo impossible (0x' + g.rc.toString(16) + ')'); e.rc = g.rc; throw e; } await pause(250); }
          await p.op(OC.TransferComplete, [ev[0].handle]);
          return d;
        }
        await pause(150);
      }
      const e = new Error('La photo n’est pas arrivée (mise au point ? carte ?)'); e.rc = -1; throw e;
    });
  }
}

/* ── transport USB réel (module « usb ») ── */
function transportUsb() {
  let usb; try { usb = require('usb'); } catch { return null; }
  const liste = usb.getDeviceList().filter((d) => d.deviceDescriptor.idVendor === CANON);
  for (const dev of liste) {
    let ouvert = false;
    try {
      dev.open(); ouvert = true;
      const iface = dev.interfaces.find((i) => i.descriptor.bInterfaceClass === 6);   /* classe « image fixe » = PTP */
      if (!iface) { dev.close(); continue; }
      try { if (iface.isKernelDriverActive && iface.isKernelDriverActive()) iface.detachKernelDriver(); } catch {}
      iface.claim();
      const ep = (dir) => iface.endpoints.find((e) => e.direction === dir && e.transferType === 2);
      const entree = ep('in'), sortie = ep('out'); if (!entree || !sortie) { dev.close(); continue; }
      entree.timeout = 10000; sortie.timeout = 10000;
      return { transport: {
        out: (b) => new Promise((ok, ko) => sortie.transfer(b, (e) => (e ? ko(e) : ok()))),
        in: (n) => new Promise((ok, ko) => entree.transfer(n, (e, d) => (e ? ko(e) : ok(d)))),
      }, fermer: () => { try { iface.release(true, () => { try { dev.close(); } catch {} }); } catch { try { dev.close(); } catch {} } } };
    } catch (e) { if (ouvert) { try { dev.close(); } catch {} } canonErreur = e.message; }
  }
  return null;
}
let canonErreur = '';
const creer = () => new Canon(async () => transportUsb());

module.exports = { Canon, Ptp, creer, evenements, jpegDe, modeleDe, derniereErreur: () => canonErreur };
