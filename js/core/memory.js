(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SYYM = root.SYYM || {};
    root.SYYM.MemoryEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var Lexer = (typeof module !== 'undefined' && module.exports)
    ? require('./lexer.js')
    : (root.SYYM.Lexer);

  function MemoryEngine(opts) {
    opts = opts || {};
    this.cfg = {
      decayRate: opts.decayRate || 0.9995,     // decaimiento por `tick` de todo
      forgetThreshold: opts.forgetThreshold || 0.3,
      conceptBirth: opts.conceptBirth || 1.5,  // saliencia mínima para ser concepto
      recencyBeta: opts.recencyBeta || 3000,
      topTermsPerDoc: opts.topTermsPerDoc || 8
    };
    this.now = 0;              // reloj interno (avanza con ticks/access)
    this.docs = [];
    this.index = new Map();    // term -> Map(docIndex -> tf)
    this.concepts = new Map(); // term -> saliencia
    this.edges = new Map();    // term -> Map(term -> peso)
    this.appliedTick = false;
    this.seed = opts.seed || 7;
  }

  // ---- utilidades ----
  function addEdge(edges, a, b, w) {
    if (a === b) return;
    var m = edges.get(a);
    if (!m) { m = new Map(); edges.set(a, m); }
    var cur = m.get(b) || 0;
    m.set(b, cur + w);
    var m2 = edges.get(b);
    if (!m2) { m2 = new Map(); edges.set(b, m2); }
    m2.set(a, (m2.get(a) || 0) + w);
  }

  function topTerms(docTerms, n) {
    var arr = docTerms.slice().sort(function (a, b) { return b.tf - a.tf; });
    return arr.slice(0, n).map(function (t) { return t.term; });
  }

  // ---- ingestión ----
  MemoryEngine.prototype.addText = function (text, opts) {
    opts = opts || {};
    var terms = Lexer.terms(text).slice(0, 40);
    var doc = {
      id: opts.id || ('m' + (this.now) + '_' + this.docs.length),
      text: String(text || ''),
      tags: opts.tags || [],
      createdAt: this.now,
      lastAccess: this.now,
      accesses: 0,
      terms: terms,
      summary: opts.summary || (terms.length ? terms[0].term : '')
    };
    var idx = this.docs.length;
    this.docs.push(doc);

    var tt = topTerms(terms, this.cfg.topTermsPerDoc);
    var seen = {};
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var termStr = t.term;
      var map = this.index.get(termStr);
      if (!map) { map = new Map(); this.index.set(termStr, map); }
      map.set(idx, t.tf);
      // saliencia más fuerte para los términos más prominentes
      var boost = 0.5 + t.norm * 1.0;
      if (t.norm > 0.9) boost += 0.8;
      this.concepts.set(termStr, (this.concepts.get(termStr) || 0) + boost);
      if (t.norm > 0.45 && !seen[termStr]) {
        seen[termStr] = true;
        for (var j = 0; j < tt.length; j++) {
          if (tt[j] === termStr) continue;
          addEdge(this.edges, termStr, tt[j], t.norm * 1);
        }
      }
    }
    return doc;
  };

  // Acceso a una memoria: refuerza y fija el recuerdo.
  MemoryEngine.prototype.access = function (docIndex) {
    var doc = this.docs[docIndex];
    if (!doc) return null;
    doc.accesses++;
    doc.lastAccess = this.now;
    for (var i = 0; i < doc.terms.length; i++) {
      var t = doc.terms[i];
      this.concepts.set(t, (this.concepts.get(t) || 0) + 0.6 + t.norm);
    }
    var tt = topTerms(doc.terms, this.cfg.topTermsPerDoc);
    for (var a = 0; a < tt.length; a++) {
      for (var b = a + 1; b < tt.length; b++) {
        addEdge(this.edges, tt[a], tt[b], 0.5);
      }
    }
    return doc;
  };

  MemoryEngine.prototype.tick = function () {
    this.now += 1;
    this._decay();
  };

  MemoryEngine.prototype._decay = function () {
    var r = this.cfg.decayRate;
    var toDrop = [];
    this.concepts.forEach(function (s, term) {
      var ns = s * r;
      if (ns < this.cfg.forgetThreshold) toDrop.push(term);
      else this.concepts.set(term, ns);
    }, this);
    this.edges.forEach(function (m, t) {
      m.forEach(function (w, o) {
        var nw = w * r;
        if (nw < this.cfg.forgetThreshold) m.delete(o);
        else m.set(o, nw);
      }, this);
    }, this);
    for (var i = 0; i < toDrop.length; i++) {
      this.concepts.delete(toDrop[i]);
      this.edges.delete(toDrop[i]);
      this.index.delete(toDrop[i]);
    }
  };

  // ---- consulta directa ----
  MemoryEngine.prototype._idf = function (term) {
    var ndocs = this.index.get(term) ? this.index.get(term).size : 0;
    return Math.log(1 + this.docs.length / (1 + ndocs));
  };

  MemoryEngine.prototype.query = function (query, k) {
    var qterms = Lexer.tokenize(query);
    var results = [];
    var now = this.now;
    for (var i = 0; i < this.docs.length; i++) {
      var doc = this.docs[i];
      var score = 0;
      var shared = [];
      for (var j = 0; j < qterms.length; j++) {
        var qt = qterms[j];
        var map = this.index.get(qt);
        if (!map || !map.has(i)) continue;
        score += this._idf(qt) * map.get(i);
        shared.push(qt);
      }
      if (shared.length === 0) continue;
      var recency = Math.exp(-(now - doc.lastAccess) / this.cfg.recencyBeta);
      score = score * (0.7 + 0.3 * recency) * (0.6 + 0.4 * Math.log(1 + doc.accesses) / Math.log(10));
      results.push({ docIndex: i, doc: doc, score: score, shared: shared });
    }
    results.sort(function (a, b) { return b.score - a.score; });
    return results.slice(0, k === undefined ? 5 : k);
  };

  // ---- recordar por asociación ----
  MemoryEngine.prototype.recall = function (seedConcepts, k) {
    var queryText = typeof seedConcepts === 'string' ? seedConcepts.toLowerCase() : '';
    if (typeof seedConcepts === 'string') seedConcepts = Lexer.tokenize(seedConcepts);
    var frontier = [];
    var seen = new Set();
    for (var i = 0; i < seedConcepts.length; i++) {
      seen.add(seedConcepts[i]);
    }
    // Expansión asociativa en 3 saltos: recuerda por cadena de asociación.
    var current = seedConcepts.slice();
    for (var hop = 0; hop < 3 && current.length; hop++) {
      var next = [];
      for (var h = 0; h < current.length; h++) {
        var c = current[h];
        if (!this.edges.has(c)) continue;
        var neigh = Array.from(this.edges.get(c).entries());
        neigh.sort(function (a, b) { return b[1] - a[1]; });
        for (var j = 0; j < Math.min(6, neigh.length); j++) {
          var n = neigh[j][0];
          if (seen.has(n)) continue;
          seen.add(n);
          frontier.push({ term: n, weight: neigh[j][1], hop: hop + 1 });
          next.push(n);
        }
      }
      current = next;
    }
    var scored = new Map();
    for (var f = 0; f < frontier.length; f++) {
      var term = frontier[f].term;
      var map = this.index.get(term);
      if (!map) continue;
      var decay = Math.pow(0.7, frontier[f].hop - 1);
      map.forEach(function (tf, docIdx) {
        var doc = this.docs[docIdx];
        if (queryText && doc.text.toLowerCase().indexOf(queryText) >= 0) return;
        var s = (scored.get(docIdx) || 0) + tf * frontier[f].weight * decay;
        scored.set(docIdx, s);
      }, this);
    }
    var out = [];
    var sorted = Array.from(scored.entries()).sort(function (a, b) { return b[1] - a[1]; });
    for (var s = 0; s < sorted.length; s++) {
      var di = sorted[s][0];
      out.push({ docIndex: di, doc: this.docs[di], score: sorted[s][1], via: frontier });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, k === undefined ? 5 : k);
  };

  // ---- sueño: consolidación associativa en tiempo idle ----
  MemoryEngine.prototype.dream = function (steps) {
    steps = steps || 200;
    var strengthened = [];
    var it = this.edges.entries();
    for (var s = 0; s < steps; s++) {
      var next = it.next();
      if (next.done) it = this.edges.entries(), next = it.next();
      var pair = next.value;
      if (!pair) break;
      var t = pair[0], m = pair[1];
      var nb = Array.from(m.entries());
      if (nb.length < 2) continue;
      // Asocia vecinos entre sí: los conceptos que comparten un vecino se relacionan.
      for (var i = 0; i < Math.min(2, nb.length); i++) {
        var o = nb[i][0];
        for (var j = i + 1; j < Math.min(3, nb.length); j++) {
          var p = nb[j][0];
          var w = Math.min(nb[i][1], nb[j][1]) * 0.15;
          addEdge(this.edges, o, p, w);
          strengthened.push(o + '↔' + p);
        }
      }
    }
    return strengthened.slice(0, 20);
  };

  // ---- exportación para visualización ----
  MemoryEngine.prototype.graphData = function (topN) {
    var concepts = Array.from(this.concepts.entries())
      .filter(function (e) {
        return e[1] >= this.cfg.conceptBirth && e[1] > (this.cfg.forgetThreshold * 2);
      }, this)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, topN || 60);
    var nodeSet = new Set(concepts.map(function (c) { return c[0]; }));
    var nodes = concepts.map(function (c) {
      return { id: c[0], salience: c[1] };
    });
    var links = [];
    var linkSeen = new Set();
    for (var i = 0; i < concepts.length; i++) {
      var m = this.edges.get(concepts[i][0]);
      if (!m) continue;
      m.forEach(function (w, other) {
        if (!nodeSet.has(other)) return;
        var key = concepts[i][0] < other ? concepts[i][0] + '\u0000' + other : other + '\u0000' + concepts[i][0];
        if (linkSeen.has(key)) return;
        linkSeen.add(key);
        if (w > this.cfg.forgetThreshold * 2) links.push({ s: concepts[i][0], t: other, w: w });
      }, this);
    }
    return { nodes: nodes, links: links };
  };

  MemoryEngine.prototype.stats = function () {
    var concepts = 0;
    this.concepts.forEach(function (s, t) {
      if (s >= this.cfg.conceptBirth) concepts++;
    }, this);
    var edges = 0;
    this.edges.forEach(function (m, t) {
      edges += m.size;
    });
    return {
      memories: this.docs.length,
      concepts: concepts,
      associations: edges / 2,
      ticks: this.now
    };
  };

  // ---- persistencia ----
  MemoryEngine.prototype.toJSON = function () {
    var docs = this.docs.map(function (d) {
      return {
        id: d.id, text: d.text, tags: d.tags,
        createdAt: d.createdAt, lastAccess: d.lastAccess, accesses: d.accesses,
        terms: d.terms, summary: d.summary
      };
    });
    var concepts = {};
    this.concepts.forEach(function (s, t) { concepts[t] = s; });
    var edgeObj = {};
    this.edges.forEach(function (m, t) {
      var o = {};
      m.forEach(function (w, k) { o[k] = w; });
      edgeObj[t] = o;
    });
    return JSON.stringify({
      v: 1,
      now: this.now,
      docs: docs,
      concepts: concepts,
      edges: edgeObj
    });
  };

  MemoryEngine.prototype.fromJSON = function (data) {
    var d = (typeof data === 'string') ? JSON.parse(data) : data;
    this.now = d.now || 0;
    this.docs = d.docs.map(function (doc) {
      return {
        id: doc.id, text: doc.text, tags: doc.tags || [],
        createdAt: doc.createdAt, lastAccess: doc.lastAccess, accesses: doc.accesses || 0,
        terms: doc.terms, summary: doc.summary || ''
      };
    });
    this.index = new Map();
    for (var i = 0; i < this.docs.length; i++) {
      for (var j = 0; j < this.docs[i].terms.length; j++) {
        var t = this.docs[i].terms[j];
        var key = typeof t === 'string' ? t : t.term;
        var m = this.index.get(key);
        if (!m) { m = new Map(); this.index.set(key, m); }
        m.set(i, typeof t === 'string' ? 1 : t.tf);
      }
    }
    this.concepts = new Map();
    Object.keys(d.concepts || {}).forEach(function (k) { this.concepts.set(k, d.concepts[k]); }, this);
    this.edges = new Map();
    Object.keys(d.edges || {}).forEach(function (t) {
      var m = new Map();
      Object.keys(d.edges[t]).forEach(function (o) {
        m.set(o, d.edges[t][o]);
      });
      this.edges.set(t, m);
    }, this);
    return this;
  };

  return { MemoryEngine: MemoryEngine };
}));