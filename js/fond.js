/* ==========================================================================
   fond.js — le fond de l'appli.
   Six paysages DESSINÉS par l'appli (aucune image à télécharger, tout marche
   hors ligne), teintés par ta couleur : montagnes, dunes, lac de nuit, ciel
   étoilé, aurore boréale, ville la nuit. Deux modes en plus :
   « Selon l'heure » (montagnes à l'aube, en journée, au coucher du soleil, la nuit)
   et « Un nouveau chaque jour ».
   Animation lente (brume, étoiles, reflets…) : partout, en mode focus seulement,
   ou jamais. En mode focus, la lumière se lève avec l'objectif du jour.
   Option : ta propre photo, gardée seulement sur cet appareil (jamais exportée
   ni synchronisée).
   Réglages propres à l'appareil (prepa.appareil) : fondScene, fondAnime.
   ========================================================================== */
(function (P) {
  "use strict";

  const CLE_PHOTO = "prepa.fond-photo";
  const F = {};

  F.SCENES = [["montagnes", "Montagnes"], ["dunes", "Dunes"], ["lac", "Lac de nuit"], ["etoiles", "Ciel étoilé"], ["aurore", "Aurore"], ["ville", "Ville la nuit"]];
  F.MODES = [["heure", "Selon l'heure"], ["jour", "Chaque jour"]];

  const zone = () => document.getElementById("fond");
  F.photo = () => { try { return localStorage.getItem(CLE_PHOTO); } catch (e) { return null; } };
  const reglages = () => (P.store ? P.store.appareil() : {});
  const calme = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function themeClair() {
    const cs = getComputedStyle(document.documentElement).colorScheme;
    return cs.indexOf("light") !== -1 && cs.indexOf("dark") === -1;
  }
  function accentActuel() {
    const a = (getComputedStyle(document.documentElement).getPropertyValue("--accent") || "").trim();
    return /^#[0-9a-f]{6}$/i.test(a) ? a : "#ff7a3d";
  }

  /* ---------- Outils de dessin ---------- */

  function rvb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgba(h, a) { const c = rvb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function melange(h1, h2, k) {
    const a = rvb(h1), b = rvb(h2);
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
  }
  function hasard(graine) { let g = graine; return () => (g = (g * 16807) % 2147483647) / 2147483647; }
  function ciel(c, w, h, arrets) {
    const g = c.createLinearGradient(0, 0, 0, h);
    arrets.forEach(([o, col]) => g.addColorStop(o, col));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  function halo(c, x, y, r, couleur, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(couleur, a));
    g.addColorStop(1, rgba(couleur, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  }
  // Crête dentelée (montagnes).
  function creteDentelee(c, w, h, base, amp, couleur, a) {
    c.beginPath();
    c.moveTo(0, h);
    let y = h * base;
    const pas = w / 70;
    for (let x = 0; x <= w + pas; x += pas) {
      y += (a() - .5) * h * amp * .32;
      y = Math.min(h * (base + amp), Math.max(h * (base - amp), y));
      c.lineTo(x, y);
    }
    c.lineTo(w, h);
    c.closePath();
    c.fillStyle = couleur;
    c.fill();
  }
  // Crête douce (dunes, collines) ; renvoie les points pour tracer un liseré.
  function creteDouce(c, w, h, base, amp, couleur, graine, bas) {
    const a = hasard(graine);
    const ph = [a() * 6.28, a() * 6.28, a() * 6.28], fr = [.8 + a() * 1.2, 2 + a() * 2, 5 + a() * 3];
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      pts.push([u * w, h * (base - amp * (.6 * Math.sin(u * fr[0] * 6.28 + ph[0]) + .3 * Math.sin(u * fr[1] * 6.28 + ph[1]) + .1 * Math.sin(u * fr[2] * 6.28 + ph[2])))]);
    }
    c.beginPath();
    c.moveTo(0, bas === undefined ? h : bas);
    pts.forEach(p => c.lineTo(p[0], p[1]));
    c.lineTo(w, bas === undefined ? h : bas);
    c.closePath();
    c.fillStyle = couleur;
    c.fill();
    return pts;
  }
  function brume(c, w, h, base, clair) {
    const g = c.createLinearGradient(0, h * (base - .02), 0, h * (base + .14));
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, clair ? "rgba(255,255,255,.22)" : "rgba(210,215,225,.05)");
    c.fillStyle = g;
    c.fillRect(0, h * (base - .02), w, h * .16);
  }
  function creerEtoiles(n, graine, yMax, rMax) {
    const a = hasard(graine), l = [];
    for (let i = 0; i < n; i++) l.push({ x: a(), y: Math.pow(a(), 1.3) * yMax, r: .4 + a() * rMax, ph: a() * 6.28, v: .6 + a() * 1.8, b: .35 + a() * .65 });
    return l;
  }
  function dessinerEtoiles(c, w, h, s, liste, t, clair) {
    liste.forEach(e => {
      const scint = .55 + .45 * Math.sin(t * e.v + e.ph);
      c.globalAlpha = e.b * scint * (clair ? .7 : 1);
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(e.x * w, e.y * h, e.r * s, 0, 6.283);
      c.fill();
    });
    c.globalAlpha = 1;
  }

  /* ---------- Les paysages ----------
     Chaque paysage a :
     - base(c, w, h, s, o)      : ce qui ne bouge pas (dessiné une seule fois) ;
     - prep(w, h, s, o)         : données de l'animation (positions des étoiles…) ;
     - anim(c, w, h, s, t, e, o): ce qui bouge, redessiné à chaque image.
     o = { accent, clair, moment } ; s = pixels réels par pixel CSS. */
  const SC = {};

  // Montagnes. moment : null (par défaut), "aube", "jour", "soir" ou "nuit".
  const CIELS_MONTAGNE = {
    sombre: {
      defaut: a => [[0, "#08090c"], [.42, "#15171d"], [.62, "#1b1d24"], [1, "#07080a"]],
      aube: a => [[0, "#0c0f1c"], [.33, "#211d31"], [.52, melange("#3a2a35", a, .4)], [.62, melange("#4a3030", a, .45)], [1, "#07080a"]],
      jour: a => [[0, "#131a26"], [.45, "#222b38"], [.62, "#2c333f"], [1, "#090a0d"]],
      soir: a => [[0, "#0b0a14"], [.33, "#2a1626"], [.52, melange("#4a2020", a, .55)], [.62, melange("#5a2a20", a, .5)], [1, "#070708"]],
      nuit: a => [[0, "#04050a"], [.5, "#0b0d16"], [1, "#050507"]]
    },
    clair: {
      defaut: a => [[0, "#cfd6df"], [.5, "#e9ecf0"], [1, "#dfe3e9"]],
      aube: a => [[0, "#c9cfe0"], [.45, "#ead9d8"], [.6, melange("#ffe1cc", a, .25)], [1, "#dfe3e9"]],
      jour: a => [[0, "#b7cce4"], [.55, "#e4edf5"], [1, "#dfe5ec"]],
      soir: a => [[0, "#c4bfdb"], [.45, "#ebcfc6"], [.6, melange("#f5d0b8", a, .3)], [1, "#e9dfe0"]],
      nuit: a => [[0, "#aab3c7"], [.6, "#cdd3e0"], [1, "#d6dae3"]]
    }
  };
  const HALOS_MONTAGNE = { defaut: [.7, .36, .55], aube: [.5, .56, .8], jour: [.78, .16, .3], soir: [.32, .54, .85], nuit: [.75, .2, .18] };
  SC.montagnes = {
    base: function (c, w, h, s, o) {
      const m = o.moment || "defaut";
      ciel(c, w, h, CIELS_MONTAGNE[o.clair ? "clair" : "sombre"][m](o.accent));
      const hl = HALOS_MONTAGNE[m];
      halo(c, w * hl[0], h * hl[1], Math.max(w, h) * .75, o.accent, hl[2] * (o.clair ? .75 : 1));
    },
    prep: function (w, h, s, o) {
      // Les montagnes sont sur un calque à part : les étoiles de la nuit passent derrière.
      const m = document.createElement("canvas");
      m.width = w; m.height = h;
      const mc = m.getContext("2d");
      const a = hasard(11);
      const couches = o.clair
        ? [[.46, "#aeb6c2", .2], [.56, "#959eac", .15], [.67, "#7d8796", .11], [.8, "#68717f", .07]]
        : [[.46, "#2a2a31", .2], [.56, "#1c1d23", .15], [.67, "#121318", .11], [.8, "#090a0d", .07]];
      couches.forEach(([b, col, amp]) => { creteDentelee(mc, w, h, b, amp, col, a); brume(mc, w, h, b, o.clair); });
      return { montagnes: m, etoiles: o.moment === "nuit" ? creerEtoiles(140, 5, .42, 1) : [] };
    },
    anim: function (c, w, h, s, t, e, o) {
      if (e.etoiles.length) dessinerEtoiles(c, w, h, s, e.etoiles, t, o.clair);
      c.drawImage(e.montagnes, 0, 0);
      // Bancs de brume qui glissent lentement
      [[.52, 9, .0], [.63, 6, .45], [.75, 12, .8]].forEach(([y, v, d]) => {
        const larg = w * 1.8;
        const x = ((t * v * s + d * larg) % larg) - w * .4;
        c.save();
        c.translate(x, h * y);
        c.scale(1, .12);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, w * .55);
        g.addColorStop(0, o.clair ? "rgba(255,255,255,.35)" : "rgba(215,220,232,.07)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(-w * .6, -w * .6, w * 1.2, w * 1.2);
        c.restore();
      });
    }
  };

  // Dunes au coucher du soleil.
  SC.dunes = {
    base: function (c, w, h, s, o) {
      const a = o.accent;
      ciel(c, w, h, o.clair
        ? [[0, "#e6d5e2"], [.45, "#f3d9cb"], [.6, melange("#f6d2b4", a, .3)], [1, "#efe2d6"]]
        : [[0, "#0d0a14"], [.38, "#26152c"], [.56, melange("#55281e", a, .45)], [.64, melange("#8a4628", a, .5)], [1, "#0a0806"]]);
      const r = Math.min(w * .13, 110 * s);
      halo(c, w * .62, h * .6, Math.max(w, h) * .6, a, o.clair ? .45 : .6);
      c.fillStyle = rgba(melange(a, "#ffe2b0", .35), o.clair ? .8 : .92);
      c.beginPath(); c.arc(w * .62, h * .6, r, 0, 6.283); c.fill();
      const couches = o.clair
        ? [[.64, .035, "#e3c2a4"], [.72, .045, "#d6ab88"], [.82, .05, "#c79673"], [.92, .04, "#b78562"]]
        : [[.64, .035, melange("#3d2519", a, .18)], [.72, .045, "#2b1a12"], [.82, .05, "#1c120c"], [.92, .04, "#100a07"]];
      couches.forEach(([b, amp, col], i) => {
        const pts = creteDouce(c, w, h, b, amp, col, 31 + i * 7);
        c.beginPath();
        pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
        c.strokeStyle = rgba(a, o.clair ? .35 : .28 - i * .05);
        c.lineWidth = 1.4 * s;
        c.stroke();
      });
    },
    prep: function (w, h, s, o) {
      const a = hasard(77), grains = [];
      for (let i = 0; i < 70; i++) grains.push({ x: a(), y: .6 + a() * .4, v: 8 + a() * 22, ph: a() * 6.28, r: .6 + a() * 1.1 });
      return { grains: grains };
    },
    anim: function (c, w, h, s, t, e, o) {
      c.fillStyle = o.clair ? "rgba(120,80,50,.28)" : "rgba(243,217,184,.28)";
      e.grains.forEach(g => {
        const x = ((g.x * w + t * g.v * s) % (w + 20 * s)) - 10 * s;
        const y = g.y * h + Math.sin(t * 1.3 + g.ph) * 5 * s;
        c.beginPath(); c.arc(x, y, g.r * s, 0, 6.283); c.fill();
      });
    }
  };

  // Lac de nuit : lune, collines au loin, reflets sur l'eau.
  SC.lac = {
    base: function (c, w, h, s, o) {
      const a = o.accent, hz = .56;
      ciel(c, w, h, o.clair
        ? [[0, "#b6c1da"], [hz, "#dde3ef"], [hz, "#c6cfe0"], [1, "#a9b4c8"]]
        : [[0, "#04060d"], [.45, "#0c1324"], [hz, "#16213b"], [hz, "#0a1020"], [1, "#03050a"]]);
      halo(c, w * .7, h * .22, Math.max(w, h) * .45, a, o.clair ? .25 : .3);
      const r = Math.min(w * .055, 46 * s);
      c.fillStyle = o.clair ? "#ffffff" : "#f2efe6";
      c.beginPath(); c.arc(w * .7, h * .22, r, 0, 6.283); c.fill();
      creteDouce(c, w, h, hz - .015, .025, o.clair ? "#97a2b8" : "#070b15", 53, h * hz);
      creteDouce(c, w, h, hz - .005, .012, o.clair ? "#8995ad" : "#050810", 59, h * hz);
    },
    prep: (w, h, s, o) => ({ etoiles: creerEtoiles(110, 9, .5, .9) }),
    anim: function (c, w, h, s, t, e, o) {
      c.save();
      c.beginPath(); c.rect(0, 0, w, h * .53); c.clip();
      dessinerEtoiles(c, w, h, s, e.etoiles, t, o.clair);
      c.restore();
      // Reflet de la lune qui ondule
      const x = w * .7, y0 = h * .575, y1 = h * .97, n = 30;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        const larg = (12 + k * 70) * s * (.65 + .35 * Math.sin(t * 1.6 + i * .9));
        const dec = Math.sin(t * .9 + i * 1.7) * 6 * s * k;
        c.fillStyle = o.clair ? "rgba(255,255,255," + (.75 - k * .5) * (.6 + .4 * Math.sin(t * 2.1 + i)) + ")"
          : rgba(melange("#f2efe6", o.accent, .25), (.5 - k * .35) * (.6 + .4 * Math.sin(t * 2.1 + i)));
        c.fillRect(x - larg / 2 + dec, y0 + k * (y1 - y0), larg, 1.6 * s);
      }
    }
  };

  // Ciel étoilé avec la Voie lactée.
  SC.etoiles = {
    base: function (c, w, h, s, o) {
      ciel(c, w, h, o.clair ? [[0, "#9ea8c3"], [.6, "#c3c9db"], [1, "#d5d9e3"]] : [[0, "#030409"], [.6, "#0a0d18"], [1, "#11131c"]]);
      // Voie lactée : une bande diagonale de lumière et de poussière d'étoiles
      c.save();
      c.translate(w * .5, h * .38);
      c.rotate(-.55);
      c.scale(1, .2);
      const R = Math.max(w, h) * .9;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, o.clair ? "rgba(255,255,255,.45)" : rgba(melange("#c8c0ff", o.accent, .3), .3));
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(-R, -R, 2 * R, 2 * R);
      c.restore();
      const a = hasard(23);
      c.fillStyle = "#ffffff";
      for (let i = 0; i < 520; i++) {
        const u = a() * 2 - 1, v = (a() + a() + a() - 1.5) * .09;
        const x = w * .5 + Math.cos(-.55) * u * Math.max(w, h) * .8 - Math.sin(-.55) * v * h;
        const y = h * .38 + Math.sin(-.55) * u * Math.max(w, h) * .8 + Math.cos(-.55) * v * h;
        c.globalAlpha = (.15 + a() * .45) * (o.clair ? .6 : 1);
        c.fillRect(x, y, s * (.6 + a() * .7), s * (.6 + a() * .7));
      }
      c.globalAlpha = 1;
      halo(c, w * .5, h * 1.05, Math.max(w, h) * .55, o.accent, o.clair ? .25 : .22);
      creteDouce(c, w, h, .86, .03, o.clair ? "#8a93a9" : "#040507", 41);
    },
    prep: (w, h, s, o) => ({ etoiles: creerEtoiles(190, 13, .84, 1.1) }),
    anim: function (c, w, h, s, t, e, o) {
      c.save();
      c.beginPath(); c.rect(0, 0, w, h * .82); c.clip();
      dessinerEtoiles(c, w, h, s, e.etoiles, t, o.clair);
      // Étoile filante toutes les 11 secondes environ
      const periode = 11, n = Math.floor(t / periode), ph = t - n * periode;
      if (ph < .9) {
        const a = hasard(1000 + n), k = ph / .9;
        const x0 = w * (.15 + a() * .55), y0 = h * (.05 + a() * .25), L = w * .3, ang = .45 + a() * .3;
        const xt = x0 + Math.cos(ang) * L * k, yt = y0 + Math.sin(ang) * L * k;
        const g = c.createLinearGradient(xt, yt, xt - Math.cos(ang) * L * .5, yt - Math.sin(ang) * L * .5);
        g.addColorStop(0, "rgba(255,255,255," + (1 - k) * .9 + ")");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.strokeStyle = g;
        c.lineWidth = 1.5 * s;
        c.beginPath(); c.moveTo(xt, yt); c.lineTo(xt - Math.cos(ang) * L * .5, yt - Math.sin(ang) * L * .5); c.stroke();
      }
      c.restore();
    }
  };

  // Aurore boréale au-dessus des montagnes.
  SC.aurore = {
    base: function (c, w, h, s, o) {
      ciel(c, w, h, o.clair ? [[0, "#a6b1c7"], [.6, "#cdd4e1"], [1, "#d6dbe4"]] : [[0, "#02040a"], [.6, "#071019"], [1, "#0a1119"]]);
    },
    prep: function (w, h, s, o) {
      // Bandes de dégradé prêtes à l'emploi (moins de calcul à chaque image)
      const couleurs = [o.accent, melange(o.accent, "#5fd39b", .65), melange(o.accent, "#b58cff", .55)];
      const bandes = couleurs.map(col => {
        const b = document.createElement("canvas");
        b.width = 2; b.height = 128;
        const bc = b.getContext("2d");
        const g = bc.createLinearGradient(0, 0, 0, 128);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(.25, rgba(col, o.clair ? .3 : .42));
        g.addColorStop(1, rgba(col, 0));
        bc.fillStyle = g;
        bc.fillRect(0, 0, 2, 128);
        return b;
      });
      // Montagnes au premier plan, dessinées à part pour passer devant l'aurore
      const m = document.createElement("canvas");
      m.width = w; m.height = h;
      const mc = m.getContext("2d");
      const a = hasard(17);
      creteDentelee(mc, w, h, .66, .12, o.clair ? "#8c96aa" : "#1a2230", a);
      brume(mc, w, h, .66, o.clair);
      creteDentelee(mc, w, h, .78, .07, o.clair ? "#6a7387" : "#0b1018", a);
      return { bandes: bandes, montagnes: m, etoiles: creerEtoiles(150, 19, .7, .9) };
    },
    anim: function (c, w, h, s, t, e, o) {
      dessinerEtoiles(c, w, h, s, e.etoiles, t, o.clair);
      c.save();
      c.globalCompositeOperation = o.clair ? "source-over" : "lighter";
      // Colonnes jointives au pixel près : pas de chevauchement, donc pas de rayures.
      const n = 90;
      e.bandes.forEach((b, i) => {
        for (let k = 0; k < n; k++) {
          const x0 = Math.round(k * w / n), x1 = Math.round((k + 1) * w / n);
          const u = (k + .5) / n;
          const y = h * (.12 + .07 * i + .06 * Math.sin(u * 4 + t * .22 + i * 2) + .025 * Math.sin(u * 11 - t * .35 + i));
          const haut = h * (.2 + .06 * Math.sin(u * 6 + t * .27 + i * 1.3));
          c.globalAlpha = .55 + .45 * Math.sin(u * 3 + t * .4 + i);
          c.drawImage(b, x0, y, x1 - x0, haut);
        }
      });
      c.restore();
      c.drawImage(e.montagnes, 0, 0);
    }
  };

  // Ville la nuit : immeubles en trois rangées, fenêtres qui s'allument.
  SC.ville = {
    base: function (c, w, h, s, o) {
      const a = o.accent;
      ciel(c, w, h, o.clair
        ? [[0, "#c1c7da"], [.6, "#e2dfe7"], [.8, melange("#f0dcd4", a, .2)], [1, "#e6e2e6"]]
        : [[0, "#05060d"], [.5, "#111428"], [.74, melange("#2a1a2a", a, .35)], [1, "#0b0b10"]]);
      halo(c, w * .5, h * .82, Math.max(w, h) * .55, a, o.clair ? .2 : .3);
      SC.ville.immeubles(w, h, s, o).forEach(r => {
        c.fillStyle = r.col;
        r.l.forEach(b => c.fillRect(b.x, b.y, b.w, h - b.y));
      });
    },
    immeubles: function (w, h, s, o) {
      const rangs = o.clair
        ? [[.22, .4, "#aab0c2"], [.14, .32, "#959bae"], [.08, .22, "#7f8599"]]
        : [[.22, .4, "#15182b"], [.14, .32, "#0d0f1d"], [.08, .22, "#07080f"]];
      return rangs.map(([hMin, hMax, col], i) => {
        const a = hasard(101 + i * 13), l = [];
        let x = -a() * 20 * s;
        while (x < w) {
          const bw = w * (.05 + a() * .08);
          const bh = h * (hMin + a() * (hMax - hMin));
          l.push({ x: x, y: h - bh, w: bw });
          x += bw + a() * 3 * s;
        }
        return { col: col, l: l };
      });
    },
    prep: function (w, h, s, o) {
      const fen = [], a = hasard(303);
      SC.ville.immeubles(w, h, s, o).slice(1).forEach(r => r.l.forEach(b => {
        for (let fy = b.y + 8 * s; fy < h - 6 * s; fy += 9 * s) {
          for (let fx = b.x + 5 * s; fx < b.x + b.w - 6 * s; fx += 7 * s) {
            if (a() < .3) fen.push({ x: fx, y: fy, p: 6 + a() * 30, ph: a() * 100 });
          }
        }
      }));
      return { fenetres: fen, couleur: o.clair ? rgba(o.accent, .55) : rgba(melange("#ffd9a0", o.accent, .35), .85), etoiles: creerEtoiles(55, 29, .5, .7) };
    },
    anim: function (c, w, h, s, t, e, o) {
      if (!o.clair) dessinerEtoiles(c, w, h, s, e.etoiles, t, o.clair);
      c.fillStyle = e.couleur;
      e.fenetres.forEach(f => {
        // De temps en temps, une fenêtre s'éteint quelques secondes
        if (Math.floor((t + f.ph) / f.p) % 5 === 0) return;
        c.fillRect(f.x, f.y, 3 * s, 4 * s);
      });
    }
  };

  /* ---------- Choix du paysage ---------- */

  function momentDeLaJournee(d) {
    const hr = d.getHours();
    return hr >= 5 && hr < 11 ? "aube" : hr >= 11 && hr < 17 ? "jour" : hr >= 17 && hr < 21 ? "soir" : "nuit";
  }
  // Paysage à afficher maintenant : { id, moment }.
  F.resoudre = function (choix, d) {
    d = d || new Date();
    if (choix === "heure") return { id: "montagnes", moment: momentDeLaJournee(d) };
    if (choix === "jour") {
      const n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
      return { id: F.SCENES[n % F.SCENES.length][0], moment: null };
    }
    return { id: SC[choix] ? choix : "montagnes", moment: null };
  };
  F.choix = () => reglages().fondScene || "montagnes";
  F.modeAnimation = () => reglages().fondAnime || "focus";

  /* ---------- Rendu ---------- */

  const R = { scene: null, cle: "", base: null, etat: null, o: null, w: 0, h: 0, s: 1, progres: null, progresVise: null };

  function preparer() {
    const z = zone();
    if (!z) return false;
    const canvas = z.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    const sc = F.resoudre(F.choix());
    const o = { accent: accentActuel(), clair: themeClair(), moment: sc.moment };
    const cle = [sc.id, sc.moment, o.accent, o.clair, w, h].join("|");
    if (cle === R.cle) return true;
    canvas.width = w; canvas.height = h;
    const base = document.createElement("canvas");
    base.width = w; base.height = h;
    SC[sc.id].base(base.getContext("2d"), w, h, dpr, o);
    Object.assign(R, { scene: SC[sc.id], cle: cle, base: base, etat: SC[sc.id].prep(w, h, dpr, o), o: o, w: w, h: h, s: dpr });
    return true;
  }

  // Lumière qui se lève avec l'objectif du jour (mode focus seulement).
  function lumiere(c, p) {
    const w = R.w, h = R.h;
    const y = h * (.95 - .6 * p);
    const g = c.createRadialGradient(w * .5, y, 0, w * .5, y, Math.max(w, h) * .75);
    g.addColorStop(0, rgba(R.o.accent, .1 + .3 * p));
    g.addColorStop(1, rgba(R.o.accent, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    if (!R.o.clair) { c.fillStyle = "rgba(0,0,0," + (.3 * (1 - p)).toFixed(3) + ")"; c.fillRect(0, 0, w, h); }
  }

  function peindre(t) {
    const canvas = zone().querySelector("canvas");
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, R.w, R.h);
    c.drawImage(R.base, 0, 0);
    R.scene.anim(c, R.w, R.h, R.s, t, R.etat, R.o);
    if (R.progres !== null) lumiere(c, R.progres);
  }

  F.dessiner = function () {
    const z = zone();
    if (!z) return;
    const canvas = z.querySelector("canvas"), photo = z.querySelector(".photo");
    const donnees = F.photo();
    if (donnees) {
      photo.style.backgroundImage = "url(" + donnees + ")";
      photo.hidden = false;
      canvas.hidden = true;
      F.majAnimation();
      return;
    }
    photo.hidden = true;
    canvas.hidden = false;
    R.cle = "";
    preparer();
    F.majAnimation();
    if (!anime) peindre(5);
  };

  /* ---------- Animation ---------- */

  let anime = false, raf = null, dernier = 0, dernierCalcul = 0;

  function enFocus() { return document.body.classList.contains("mode-focus"); }
  function doitAnimer() {
    if (F.photo() || calme() || document.hidden) return false;
    const m = F.modeAnimation();
    return m === "partout" || (m === "focus" && enFocus());
  }
  // Objectif du jour en mode focus (0 à 1), ou null.
  function progresVise() {
    const T = P.timer;
    if (!enFocus() || !T || !T.e || !P.stats) return null;
    const obj = P.stats.objectifDuJour(T.e.examen, T.calcul(T.e).compte / 1000);
    return obj ? Math.min(1, obj.pct / 100) : null;
  }

  function boucle(ms) {
    raf = requestAnimationFrame(boucle);
    if (ms - dernier < 33) return; // 30 images par seconde au plus
    dernier = ms;
    if (ms - dernierCalcul > 2000) { dernierCalcul = ms; R.progresVise = progresVise(); }
    if (R.progresVise === null) R.progres = null;
    else R.progres = R.progres === null ? R.progresVise : R.progres + (R.progresVise - R.progres) * .05;
    if (!preparer()) return;
    peindre(ms / 1000);
  }

  F.majAnimation = function () {
    const oui = doitAnimer();
    if (oui && !anime) {
      anime = true;
      dernierCalcul = 0;
      raf = requestAnimationFrame(boucle);
    } else if (!oui && anime) {
      anime = false;
      cancelAnimationFrame(raf);
      R.progres = null;
      if (!F.photo() && preparer()) peindre(5);
    }
  };

  // Petite image d'un paysage, pour le choix dans les Paramètres.
  F.vignette = function (canvas, choix) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = canvas.width = Math.max(1, Math.round((r.width || 72) * dpr));
    const h = canvas.height = Math.max(1, Math.round((r.height || 96) * dpr));
    const sc = F.resoudre(choix);
    const o = { accent: accentActuel(), clair: themeClair(), moment: sc.moment };
    const c = canvas.getContext("2d");
    SC[sc.id].base(c, w, h, dpr * .5, o);
    SC[sc.id].anim(c, w, h, dpr * .5, 2, SC[sc.id].prep(w, h, dpr * .5, o), o);
  };

  /* ---------- Photo perso ---------- */

  // Réduit la photo (1600 px max) et la garde sur l'appareil. Renvoie une promesse.
  F.definirPhoto = function (fichier) {
    return new Promise((ok, ko) => {
      const lecteur = new FileReader();
      lecteur.onerror = () => ko(new Error("Photo illisible."));
      lecteur.onload = () => {
        const img = new Image();
        img.onerror = () => ko(new Error("Ce fichier n'est pas une image."));
        img.onload = () => {
          const echelle = Math.min(1, 1600 / Math.max(img.width, img.height));
          const cv = document.createElement("canvas");
          cv.width = Math.round(img.width * echelle);
          cv.height = Math.round(img.height * echelle);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          try {
            localStorage.setItem(CLE_PHOTO, cv.toDataURL("image/jpeg", .82));
          } catch (e) { ko(new Error("Photo trop lourde pour être gardée sur l'appareil.")); return; }
          F.dessiner();
          ok();
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  };
  F.retirerPhoto = function () {
    try { localStorage.removeItem(CLE_PHOTO); } catch (e) { /* rien */ }
    F.dessiner();
  };

  /* ---------- Événements ---------- */

  let attente = null;
  window.addEventListener("resize", () => { clearTimeout(attente); attente = setTimeout(F.dessiner, 200); });
  if (window.matchMedia) {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    if (m.addEventListener) m.addEventListener("change", () => F.dessiner());
    const r = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (r.addEventListener) r.addEventListener("change", () => F.majAnimation());
  }
  document.addEventListener("visibilitychange", () => F.majAnimation());
  // Entrée et sortie du mode focus
  new MutationObserver(() => F.majAnimation()).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  // « Selon l'heure » et « Chaque jour » : on vérifie chaque minute si le paysage doit changer.
  setInterval(() => {
    const ch = F.choix();
    if ((ch === "heure" || ch === "jour") && !F.photo()) {
      const avant = R.cle;
      preparer();
      if (R.cle !== avant && !anime) peindre(5);
    }
  }, 60000);

  P.fond = F;
})(window.Prepa = window.Prepa || {});
