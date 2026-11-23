/* ════════════════════════════════════════════════════
   Réparation des vidéos MP4 enregistrées par le navigateur de la tablette
   ────────────────────────────────────────────────────
   Chrome enregistre en MP4 « fragmenté » : la durée n'est écrite nulle part (mvhd = 0) et aucune table d'index n'existe.
   Beaucoup de lecteurs (galerie Samsung, iPhone, e-mail, <video> après téléchargement) s'arrêtent alors après quelques secondes ou
   affichent un lien cassé. On reconstruit ici un MP4 classique : durée, tables d'échantillons et points de synchronisation.
   Le contenu (images et son) n'est pas recodé : les octets de chaque échantillon sont repris tels quels.
   Si quelque chose d'inattendu apparaît, la fonction renvoie le fichier d'origine (jamais de perte).
   ════════════════════════════════════════════════════ */

const u32 = (d, o) => ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
const i32 = (d, o) => (d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3];
const u64 = (d, o) => u32(d, o) * 4294967296 + u32(d, o + 4);
const typ = (d, o) => String.fromCharCode(d[o], d[o + 1], d[o + 2], d[o + 3]);

function boites(d, debut, fin) {
  const l = [];
  let o = debut;
  while (o + 8 <= fin) {
    let taille = u32(d, o), tete = 8;
    const t = typ(d, o + 4);
    if (taille === 1) { taille = u64(d, o + 8); tete = 16; }
    else if (taille === 0) taille = fin - o;
    if (taille < tete || o + taille > fin) throw new Error('boîte invalide ' + t);
    l.push({ t, o, fin: o + taille, corps: o + tete });
    o += taille;
  }
  return l;
}
const enfants = (d, b) => boites(d, b.corps, b.fin);
const trouver = (d, b, t) => enfants(d, b).find((x) => x.t === t);

/* construction */
class Ecr {
  constructor() { this.p = []; this.n = 0; }
  u8(...v) { this.p.push(Uint8Array.from(v)); this.n += v.length; return this; }
  u32(v) { return this.u8((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
  oct(a) { this.p.push(a); this.n += a.length; return this; }
  fin() { const r = new Uint8Array(this.n); let o = 0; for (const a of this.p) { r.set(a, o); o += a.length; } return r; }
}
const boite = (t, ...parts) => {
  const e = new Ecr(); let n = 8; for (const a of parts) n += a.length;
  e.u32(n); e.u8(t.charCodeAt(0), t.charCodeAt(1), t.charCodeAt(2), t.charCodeAt(3));
  for (const a of parts) e.oct(a);
  return e.fin();
};
const pleine = (t, version, flags, ...parts) => boite(t, Uint8Array.of(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...parts);
const tab32 = (vals) => { const e = new Ecr(); e.u32(vals.length); for (const v of vals) e.u32(v >>> 0); return e.fin(); };

export function estFragmente(octets) {
  try {
    const d = octets;
    const top = boites(d, 0, d.length);
    const moov = top.find((b) => b.t === 'moov');
    if (!moov) return false;
    return !!trouver(d, moov, 'mvex') && top.some((b) => b.t === 'moof');
  } catch { return false; }
}

export function reparerMp4(octets) {
  const d = octets;
  const top = boites(d, 0, d.length);
  const ftyp = top.find((b) => b.t === 'ftyp'), moov = top.find((b) => b.t === 'moov');
  if (!moov || !trouver(d, moov, 'mvex')) return octets;   /* déjà un MP4 classique */
  const mvex = trouver(d, moov, 'mvex');
  const trex = {};
  for (const b of enfants(d, mvex)) if (b.t === 'trex') trex[u32(d, b.corps + 4)] = { desc: u32(d, b.corps + 8), duree: u32(d, b.corps + 12), taille: u32(d, b.corps + 16), flags: u32(d, b.corps + 20) };

  /* pistes */
  const pistes = {};
  for (const trak of enfants(d, moov).filter((b) => b.t === 'trak')) {
    const tkhd = trouver(d, trak, 'tkhd'), id = u32(d, tkhd.corps + (d[tkhd.corps] === 1 ? 20 : 12));
    const mdia = trouver(d, trak, 'mdia'), mdhd = trouver(d, mdia, 'mdhd'), minf = trouver(d, mdia, 'minf'), stbl = trouver(d, minf, 'stbl');
    const v1 = d[mdhd.corps] === 1;
    pistes[id] = { trak, tkhd, mdia, mdhd, minf, stbl, echelle: u32(d, mdhd.corps + (v1 ? 20 : 12)), video: !!trouver(d, minf, 'vmhd'), chunks: [], tailles: [], durees: [], cts: [], sync: [], dts: 0 };
  }
  if (!Object.keys(pistes).length) throw new Error('aucune piste');

  /* fragments */
  const mdats = [];
  for (let i = 0; i < top.length; i++) {
    const moof = top[i];
    if (moof.t !== 'moof') continue;
    for (const traf of enfants(d, moof).filter((b) => b.t === 'traf')) {
      const tfhd = trouver(d, traf, 'tfhd'), fl = u32(d, tfhd.corps) & 0xffffff, id = u32(d, tfhd.corps + 4);
      const p = pistes[id]; if (!p) continue;
      let o = tfhd.corps + 8, base = moof.o, dDur = (trex[id] || {}).duree || 0, dTai = (trex[id] || {}).taille || 0, dFl = (trex[id] || {}).flags || 0;
      if (fl & 1) { base = u64(d, o); o += 8; }
      if (fl & 2) o += 4;
      if (fl & 8) { dDur = u32(d, o); o += 4; }
      if (fl & 0x10) { dTai = u32(d, o); o += 4; }
      if (fl & 0x20) { dFl = u32(d, o); o += 4; }
      let suite = base;
      for (const trun of enfants(d, traf).filter((b) => b.t === 'trun')) {
        const f = u32(d, trun.corps) & 0xffffff, n = u32(d, trun.corps + 4);
        let q = trun.corps + 8, debut = suite;
        if (f & 1) { debut = base + i32(d, q); q += 4; }
        let premier = null; if (f & 4) { premier = u32(d, q); q += 4; }
        let adr = debut;
        const chunk = { debut: adr, n, taille: 0 };
        for (let k = 0; k < n; k++) {
          let du = dDur, ta = dTai, fg = (k === 0 && premier != null) ? premier : dFl, cto = 0;
          if (f & 0x100) { du = u32(d, q); q += 4; }
          if (f & 0x200) { ta = u32(d, q); q += 4; }
          if (f & 0x400) { fg = u32(d, q); q += 4; }
          if (f & 0x800) { cto = (d[trun.corps] === 0) ? u32(d, q) : i32(d, q); q += 4; }
          p.tailles.push(ta); p.durees.push(du); p.cts.push(cto);
          if (!(fg & 0x10000)) p.sync.push(p.tailles.length);   /* pas « non synchro » : image clé */
          adr += ta; chunk.taille += ta;
        }
        p.chunks.push(chunk);
        suite = adr;
      }
    }
  }

  /* tables d'échantillons par piste */
  const nouvelles = {};
  let dureeFilm = 0;
  const echelleFilm = u32(d, trouver(d, moov, 'mvhd').corps + (d[trouver(d, moov, 'mvhd').corps] === 1 ? 20 : 12));
  for (const [id, p] of Object.entries(pistes)) {
    const total = p.durees.reduce((a, b) => a + b, 0);
    if (!p.tailles.length) throw new Error('piste vide ' + id);
    p.total = total;
    dureeFilm = Math.max(dureeFilm, Math.round(total * echelleFilm / p.echelle));
    const stts = []; for (let i = 0; i < p.durees.length;) { let j = i; while (j < p.durees.length && p.durees[j] === p.durees[i]) j++; stts.push([j - i, p.durees[i]]); i = j; }
    const sttsB = (() => { const e = new Ecr(); e.u32(stts.length); for (const [c, v] of stts) { e.u32(c); e.u32(v); } return pleine('stts', 0, 0, e.fin()); })();
    const stscB = (() => { const e = new Ecr(); const lignes = []; let prec = -1; p.chunks.forEach((c, i) => { if (c.n !== prec) { lignes.push([i + 1, c.n]); prec = c.n; } }); e.u32(lignes.length); for (const [a, b] of lignes) { e.u32(a); e.u32(b); e.u32(1); } return pleine('stsc', 0, 0, e.fin()); })();
    const stszB = pleine('stsz', 0, 0, Uint8Array.of(0, 0, 0, 0), tab32(p.tailles));
    const cttsB = p.cts.some((x) => x !== 0) ? (() => { const e = new Ecr(); const l = []; for (let i = 0; i < p.cts.length;) { let j = i; while (j < p.cts.length && p.cts[j] === p.cts[i]) j++; l.push([j - i, p.cts[i]]); i = j; } e.u32(l.length); for (const [c, v] of l) { e.u32(c); e.u32(v); } return pleine('ctts', 0, 0, e.fin()); })() : null;
    const stssB = p.video && p.sync.length && p.sync.length < p.tailles.length ? pleine('stss', 0, 0, tab32(p.sync)) : null;
    nouvelles[id] = { sttsB, stscB, stszB, cttsB, stssB, stsd: d.subarray(trouver(d, p.stbl, 'stsd').o, trouver(d, p.stbl, 'stsd').fin) };
  }

  const ids = Object.keys(pistes);
  /* moov complet (les offsets de chunks sont recalculés une fois la taille connue) */
  const construire = (decalageDonnees) => {
    let courant = decalageDonnees;
    const pos = {};   /* offsets des chunks par piste, dans l'ordre d'apparition dans le fichier source */
    const ordre = [];
    for (const id of ids) for (const c of pistes[id].chunks) ordre.push({ id, c });
    ordre.sort((a, b) => a.c.debut - b.c.debut);
    for (const { id, c } of ordre) { (pos[id] = pos[id] || new Map()).set(c, courant); courant += c.taille; }
    const parts = [];
    for (const b of enfants(d, moov)) {
      if (b.t === 'mvex') continue;
      if (b.t === 'mvhd') {
        const c = d.slice(b.o, b.fin), v1 = c[8] === 1, off = 8 + (v1 ? 4 + 8 + 8 + 4 : 4 + 4 + 4 + 4);
        const e = new Ecr(); e.oct(c.subarray(0, off));
        if (v1) { for (let k = 7; k >= 0; k--) e.u8(Math.floor(dureeFilm / 2 ** (8 * k)) & 255); e.oct(c.subarray(off + 8)); } else { e.u32(dureeFilm); e.oct(c.subarray(off + 4)); }
        parts.push(e.fin()); continue;
      }
      if (b.t !== 'trak') { parts.push(d.slice(b.o, b.fin)); continue; }
      const id = ids.find((x) => pistes[x].trak.o === b.o);
      const p = pistes[id], nv = nouvelles[id];
      const dureePiste = Math.round(p.total * echelleFilm / p.echelle);
      /* trak = copie des enfants avec tkhd.mdia.mdhd mis à jour et stbl reconstruit */
      const trakParts = [];
      for (const t of enfants(d, b)) {
        if (t.t === 'tkhd') { const c = d.slice(t.o, t.fin), v1 = c[8] === 1, off = 8 + (v1 ? 4 + 8 + 8 + 4 + 4 : 4 + 4 + 4 + 4 + 4); const e = new Ecr(); e.oct(c.subarray(0, off)); if (v1) { for (let k = 7; k >= 0; k--) e.u8(Math.floor(dureePiste / 2 ** (8 * k)) & 255); e.oct(c.subarray(off + 8)); } else { e.u32(dureePiste); e.oct(c.subarray(off + 4)); } trakParts.push(e.fin()); continue; }
        if (t.t !== 'mdia') { trakParts.push(d.slice(t.o, t.fin)); continue; }
        const mdiaParts = [];
        for (const m of enfants(d, t)) {
          if (m.t === 'mdhd') { const c = d.slice(m.o, m.fin), v1 = c[8] === 1, off = 8 + (v1 ? 4 + 8 + 8 + 4 : 4 + 4 + 4 + 4); const e = new Ecr(); e.oct(c.subarray(0, off)); if (v1) { for (let k = 7; k >= 0; k--) e.u8(Math.floor(p.total / 2 ** (8 * k)) & 255); e.oct(c.subarray(off + 8)); } else { e.u32(p.total); e.oct(c.subarray(off + 4)); } mdiaParts.push(e.fin()); continue; }
          if (m.t !== 'minf') { mdiaParts.push(d.slice(m.o, m.fin)); continue; }
          const minfParts = [];
          for (const x of enfants(d, m)) {
            if (x.t !== 'stbl') { minfParts.push(d.slice(x.o, x.fin)); continue; }
            const offs = p.chunks.map((c) => pos[id].get(c));
            const stco = pleine('stco', 0, 0, tab32(offs));
            const liste = [nv.stsd, nv.sttsB]; if (nv.stssB) liste.push(nv.stssB); if (nv.cttsB) liste.push(nv.cttsB); liste.push(nv.stscB, nv.stszB, stco);
            minfParts.push(boite('stbl', ...liste));
          }
          mdiaParts.push(boite('minf', ...minfParts));
        }
        trakParts.push(boite('mdia', ...mdiaParts));
      }
      parts.push(boite('trak', ...trakParts));
    }
    return { moov: boite('moov', ...parts), taillesOrdre: ordre };
  };
  const ent = ftyp ? d.slice(ftyp.o, ftyp.fin) : new Uint8Array(0);
  const essai = construire(0).moov.length;
  const debutDonnees = ent.length + essai + 8;
  const { moov: moovFinal, taillesOrdre } = construire(debutDonnees);
  if (moovFinal.length !== essai) throw new Error('taille de moov instable');
  const totalDonnees = taillesOrdre.reduce((t, x) => t + x.c.taille, 0);
  const sortie = new Uint8Array(ent.length + moovFinal.length + 8 + totalDonnees);
  let o = 0; sortie.set(ent, o); o += ent.length; sortie.set(moovFinal, o); o += moovFinal.length;
  const tailleMdat = 8 + totalDonnees;
  sortie[o] = (tailleMdat >>> 24) & 255; sortie[o + 1] = (tailleMdat >>> 16) & 255; sortie[o + 2] = (tailleMdat >>> 8) & 255; sortie[o + 3] = tailleMdat & 255;
  sortie[o + 4] = 0x6d; sortie[o + 5] = 0x64; sortie[o + 6] = 0x61; sortie[o + 7] = 0x74; o += 8;
  for (const { c } of taillesOrdre) { sortie.set(d.subarray(c.debut, c.debut + c.taille), o); o += c.taille; }
  return sortie;
}

/* à appeler à la réception : renvoie la vidéo réparée, ou l'originale si elle n'a pas besoin de l'être (ou si la réparation échoue) */
export function reparerSiBesoin(octets) {
  try { if (estFragmente(octets)) return reparerMp4(octets); } catch (e) { console.error('Vidéobooth : réparation MP4 impossible, fichier gardé tel quel :', e && e.message); }
  return octets;
}
