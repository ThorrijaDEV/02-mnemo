(function () {
  'use strict';

  var Engine = window.SYYM.MemoryEngine.MemoryEngine;
  var STORE_KEY = 'mnemo:store:v1';

  var engine = new Engine();
  try {
    var saved = localStorage.getItem(STORE_KEY);
    if (saved) engine.fromJSON(saved);
  } catch (e) { /* arranque limpio */ }

  var $ = function (id) { return document.getElementById(id); };

  // ---- persistencia ----
  function persist() {
    try { localStorage.setItem(STORE_KEY, engine.toJSON()); } catch (e) {}
    renderStats();
  }

  // ---- toast ----
  var toastT;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.style.opacity = 1;
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.style.opacity = 0; }, 2600);
  }

  // ---- grafo (layout dirigido por fuerzas, sin dependencias) ----
  var canvas = $('graph');
  var ctx = canvas.getContext('2d');

  var layout = { nodes: [], edges: [], px: new Map(), py: new Map(), vx: new Map(), vy: new Map() };

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function rebuildLayout() {
    var g = engine.graphData(70);
    layout.nodes = g.nodes;
    layout.edges = g.links;
    layout.px = new Map(); layout.py = new Map();
    layout.vx = new Map(); layout.vy = new Map();
    var w = canvas.clientWidth, h = canvas.clientHeight;
    g.nodes.forEach(function (n, i) {
      var ang = i / g.nodes.length * 6.2832;
      var rad = Math.min(w, h) * 0.32;
      layout.px.set(n.id, w / 2 + Math.cos(ang) * rad * (0.5 + Math.random() * 0.5));
      layout.py.set(n.id, h / 2 + Math.sin(ang) * rad * (0.5 + Math.random() * 0.5));
      layout.vx.set(n.id, 0); layout.vy.set(n.id, 0);
    });
    simulate(90);
  }

  function simulate(iters) {
    var nodes = layout.nodes, edges = layout.edges;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var strength = 2200, link = 0.02, damp = 0.82;
    for (var it = 0; it < iters; it++) {
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i].id;
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j].id;
          var dx = layout.px.get(a) - layout.px.get(b);
          var dy = layout.py.get(a) - layout.py.get(b);
          var d2 = dx * dx + dy * dy + 0.1;
          var f = strength / d2;
          layout.vx.set(a, layout.vx.get(a) + dx * f);
          layout.vy.set(a, layout.vy.get(a) + dy * f);
          layout.vx.set(b, layout.vx.get(b) - dx * f);
          layout.vy.set(b, layout.vy.get(b) - dy * f);
        }
      }
      for (var e = 0; e < edges.length; e++) {
        var s = edges[e].s, t = edges[e].t;
        var dx = layout.px.get(t) - layout.px.get(s);
        var dy = layout.py.get(t) - layout.py.get(s);
        layout.vx.set(s, layout.vx.get(s) + dx * link * edges[e].w);
        layout.vy.set(s, layout.vy.get(s) + dy * link * edges[e].w);
        layout.vx.set(t, layout.vx.get(t) - dx * link * edges[e].w);
        layout.vy.set(t, layout.vy.get(t) - dy * link * edges[e].w);
      }
      for (var n = 0; n < nodes.length; n++) {
        var id = nodes[n].id;
        var nx = layout.px.get(id) + layout.vx.get(id);
        var ny = layout.py.get(id) + layout.vy.get(id);
        layout.vx.set(id, layout.vx.get(id) * damp);
        layout.vy.set(id, layout.vy.get(id) * damp);
        var v = nodes[n].salience;
        layout.px.set(id, Math.max(14, Math.min(w - 14, nx)));
        layout.py.set(id, Math.max(14, Math.min(h - 14, ny)));
      }
    }
  }

  var selNode = null;

  function draw() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    var maxSal = 1;
    layout.nodes.forEach(function (n) { if (n.salience > maxSal) maxSal = n.salience; });
    var maxW = 1;
    layout.edges.forEach(function (l) { if (l.w > maxW) maxW = l.w; });

    ctx.lineWidth = 1;
    for (var e = 0; e < layout.edges.length; e++) {
      var l = layout.edges[e];
      var alpha = 0.08 + 0.5 * l.w / maxW;
      ctx.strokeStyle = 'rgba(88,166,255,' + alpha + ')';
      ctx.beginPath();
      ctx.moveTo(layout.px.get(l.s), layout.py.get(l.s));
      ctx.lineTo(layout.px.get(l.t), layout.py.get(l.t));
      ctx.stroke();
    }

    for (var i = 0; i < layout.nodes.length; i++) {
      var n = layout.nodes[i];
      var x = layout.px.get(n.id), y = layout.py.get(n.id);
      var r = 4 + (n.salience / maxSal) * 14;
      var hue = 200 + (n.salience / maxSal) * 60;
      ctx.fillStyle = n.id === selNode ? '#f2b565' : 'hsl(' + hue + ',70%,58%)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      ctx.fill();
      if (r > 7) {
        ctx.font = '11px system-ui';
        ctx.fillStyle = '#c4d4e4';
        ctx.textAlign = 'center';
        ctx.fillText(n.id, x, y - r - 4);
      }
    }

    if (selNode && layout.px.has(selNode)) {
      var sx = layout.px.get(selNode), sy = layout.py.get(selNode);
      ctx.strokeStyle = '#f2b565';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 20 + (selNode.length * 2), 0, 6.2832);
      ctx.stroke();
    }
  }

  canvas.addEventListener('click', function (ev) {
    var rect = canvas.getBoundingClientRect();
    var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    var best = null, bd = 1e9;
    layout.nodes.forEach(function (n) {
      var x = layout.px.get(n.id), y = layout.py.get(n.id);
      var dd = (x - mx) * (x - mx) + (y - my) * (y - my);
      if (dd < bd) { bd = dd; best = n.id; }
    });
    if (bd < 400) {
      selNode = best;
      $('search').value = best;
      doSearch(best);
    }
  });

  // ---- acciones ----
  var resultsEl = $('results');

  function doSearch(q) {
    var res = engine.query(q, 6);
    renderResults(res.map(function (r) {
      return { kind: 'buscar', score: r.score, text: r.doc.text, idx: r.docIndex, via: r.shared.join('·') };
    }), '"' + q + '"');
  }

  function doRecall(q) {
    var res = engine.recall(q, 6);
    renderResults(res.map(function (r) {
      return { kind: 'asociar', score: r.score, text: r.doc.text, idx: r.docIndex,
               via: r.via.slice(0, 3).map(function (v) { return v.term; }).join(' → ') };
    }), 'asociaciones desde "' + q + '"');
  }

  function renderResults(items, title) {
    if (!items.length) {
      resultsEl.innerHTML = '<div class="empty">No hay recuerdos para "' + title + '".</div>';
      return;
    }
    var html = '<div class="empty" style="margin-bottom:6px;">' + escapeHtml(title) + '</div>';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<div class="m">' +
        '<div class="head"><b>' + (it.kind === 'asociar' ? 'asociación' : 'recuerdo') + '</b>' +
        '<span>relevancia ' + it.score.toFixed(2) + '</span></div>' +
        '<div class="txt">' + escapeHtml(it.text) + '</div>' +
        (it.via ? '<div class="via">vía: ' + escapeHtml(it.via) + '</div>' : '') +
        '<button data-idx="' + it.idx + '" class="btn acceder">reforzar</button>' +
        '</div>';
    }
    resultsEl.innerHTML = html;
  }

  resultsEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button.acceder');
    if (!btn) return;
    var idx = +btn.dataset.idx;
    var doc = engine.access(idx);
    persist();
    renderStats();
    rebuildLayout(); draw();
    toast('Memoria reforzada (' + doc.accesses + ' accesos) — pesa más en el recuerdo');
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  $('btn-search').addEventListener('click', function () {
    var q = $('search').value.trim();
    if (q) { doSearch(q); selNode = null; draw(); }
  });
  $('search').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { doSearch(this.value.trim()); }
  });
  $('btn-recall').addEventListener('click', function () {
    var q = $('search').value.trim();
    if (!q) { toast('Escribe un concepto primero'); return; }
    doRecall(q);
  });
  $('btn-add').addEventListener('click', function () {
    var text = $('mem-text').value.trim();
    if (text.length < 4) { toast('El texto es demasiado corto'); return; }
    var doc = engine.addText(text);
    persist();
    rebuildLayout(); draw();
    renderStats();
    $('mem-text').value = '';
    toast('Guardado: "' + doc.summary + '"');
  });
  $('btn-sueno').addEventListener('click', function () {
    var n = engine.dream(800);
    persist();
    rebuildLayout(); draw();
    renderStats();
    toast('Sueño: ' + n.length + ' asociaciones nuevas entre conceptos');
  });
  $('btn-olvido').addEventListener('click', function () {
    engine.tick();
    persist();
    rebuildLayout(); draw();
    renderStats();
    toast('Tick de olvido: lo que no se usa se desvanece');
  });

  // ---- exportar / importar ----
  $('btn-export').addEventListener('click', function () {
    var blob = new Blob([engine.toJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mnemo-memoria-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('btn-import').addEventListener('click', function () { $('file-import').click(); });
  $('file-import').addEventListener('change', function (ev) {
    var file = ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        engine.fromJSON(reader.result);
        persist();
        rebuildLayout(); draw();
        renderStats();
        toast('Memoria importada');
      } catch (e) { toast('Archivo no válido'); }
    };
    reader.readAsText(file);
  });

  // ---- corpus de ejemplo ----
  var CORPUS = [
    'la memoria episódica guarda los eventos vividos cronológicamente',
    'durante el sueño el cerebro consolida los recuerdos del día',
    'la noradrenalina modula la atención y la vigilia',
    'el lóbulo temporal medial es crucial para formar memorias nuevas',
    'el hipocampo codifica el contexto espacial de los recuerdos',
    'la amígdala da intensidad emocional a lo que recordamos',
    'el rinoceronte tiene la piel gruesa y un cuerno de queratina',
    'el acueducto de Segovia transportaba agua a la ciudad romana',
    'el tren transiberiano cruza ocho husos horarios rusos',
    'el café espresso obtiene su crema de altas presiones de extracción',
    'el hormigón romano resiste mejor bajo el agua que el moderno',
    'la dopamina se libera ante recompensas y refuerza la conducta',
    'el ajedrez tiene 64 casillas y un rey que casi nunca ataca',
    'el ajedrecista Magnus Carlsen memoriza miles de partidas',
    'la mitocondria produce ATP en la respiración celular',
    'el astillero de Gdansk revivió con el movimiento Solidaridad',
    'las ballenas jorobadas cantan canciones que evolucionan por temporadas',
    'el canto de las ballenas se transmite y copia entre poblaciones',
    'los bisontes americanos pastan en manadas de miles',
    'el granito se forma por enfriamiento lento del magma',
    'la aurora boreal aparece en latitudes altas del hemisferio norte',
    'la gran muralla china se construyó para frenar a los nómadas',
    'los nómadas mongoles siguen migrando con sus yurtas',
    'la quinoa alimenta a los andinos desde hace cinco mil años',
    'el té de hongos kombucha fermenta con una simbiosis microbiana',
    'las luciérnagas sincronizan su parpadeo para cortejar',
    'el cactus saguaro crece un metro por cada cien años',
    'el pianista Glenn Gould abandonó los conciertos por el estudio',
    'las setas de rebollón crecen bajo los pinos mediterráneos',
    'el observatorio de Atacama mapea el cielo austral'
  ];

  var seeded = false;
  $('btn-corpus').addEventListener('click', function () {
    if (seeded && engine.docs.length) { toast('El corpus ya está cargado'); return; }
    for (var i = 0; i < CORPUS.length; i++) engine.addText(CORPUS[i]);
    seeded = true;
    persist();
    rebuildLayout(); draw();
    renderStats();
    toast('Corpus de ' + CORPUS.length + ' memorias cargado');
  });

  // ---- stats ----
  function renderStats() {
    var s = engine.stats();
    $('st-mem').textContent = s.memories;
    $('st-concept').textContent = s.concepts;
    $('st-assoc').textContent = s.associations;
    $('st-ticks').textContent = s.ticks;
  }

  rebuildLayout();
  renderStats();
  draw();
})();