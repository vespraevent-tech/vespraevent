/* Mini-générateur de fichier .zip (sans compression : les vidéos le sont déjà). Aucune bibliothèque. */
(function () {
  var T = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(v) { return [v & 255, (v >>> 8) & 255]; }
  function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
  function dos(d) { return { t: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), d: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }
  /* fichiers : [{ nom, blob }] → Promise<Blob> */
  window.vbZip = function (fichiers) {
    var parts = [], central = [], offset = 0, now = dos(new Date()), vus = {};
    var suite = Promise.resolve();
    fichiers.forEach(function (f) {
      suite = suite.then(function () { return f.blob.arrayBuffer(); }).then(function (buf) {
        var data = new Uint8Array(buf), nom = f.nom, n = 1;
        while (vus[nom]) { n++; nom = f.nom.replace(/(\.[^.]*)?$/, ' (' + n + ')$1'); }
        vus[nom] = 1;
        var nm = new TextEncoder().encode(nom), crc = crc32(data);
        var head = [0x50, 0x4b, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(now.t), u16(now.d), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0));
        parts.push(new Uint8Array(head), nm, data);
        central.push({ nm: nm, crc: crc, size: data.length, off: offset });
        offset += head.length + nm.length + data.length;
      });
    });
    return suite.then(function () {
      var cstart = offset, csize = 0;
      central.forEach(function (c) {
        var h = [0x50, 0x4b, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(now.t), u16(now.d), u32(c.crc), u32(c.size), u32(c.size), u16(c.nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.off));
        parts.push(new Uint8Array(h), c.nm); csize += h.length + c.nm.length;
      });
      parts.push(new Uint8Array([0x50, 0x4b, 5, 6].concat(u16(0), u16(0), u16(central.length), u16(central.length), u32(csize), u32(cstart), u16(0))));
      return new Blob(parts, { type: 'application/zip' });
    });
  };
})();
