(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SYYM = root.SYYM || {};
    root.SYYM.Lexer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STOPWORDS = new Set([
    'de','la','el','los','las','un','una','unos','unas','y','o','u','e','a','al','del',
    'en','para','por','con','sin','sobre','entre','hasta','desde','se','su','sus','lo',
    'que','como','cuando','donde','cual','cuales','quien','quienes','si','no','es','son',
    'era','eran','ser','estar','estoy','estas','esta','estariamos','hay','ha','han','he',
    'habia','habian','puede','pueden','pudo','podia','poder','tiene','tienen','tuvo',
    'tendria','seria','serian','fue','fueron','hacer','hace','hacemos','hice','haran',
    'muy','mas','menos','tambien','tan','todo','toda','todos','todas','este','esta2',
    'estos','estas2','ese','esa','esos','esas','aquel','aquella','aquellos','aquellas',
    'mi','mis','tu','tus','su','sus','nuestro','nuestra','vuestro','vuestra','the','a',
    'an','and','of','to','in','on','for','with','from','i','you','he','she','it','we',
    'they','is','are','was','were','be','have','has','had','do','does','did','will',
    'would','can','could','should','my','your','his','her','our','their','this','that',
    'these','those'
  ]);
var SUFFIXES = [
    ['mente',''], ['ales',''], ['ciones','cion'], ['ción','cion'],
    ['sidad',''], ['idad',''], ['ibilidad','ible'],
    ['aría','e'], ['ías','e'], ['íamos','e'], ['iste','e'],
    ['án',''], ['ón',''], ['es','e'], ['os','o'], ['as','a'], ['ando',''],
    ['ado','e'], ['ido','e'], ['ed','e'], ['ing','e'], ['s','']
  ];

  function lowercase(text) {
    return text.toLowerCase();
  }

  // Elimina diacríticos (descomposición NFC).
  function stripAccents(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function stem(word) {
    if (word.length <= 4) return word;
    var w = word;
    for (var i = 0; i < SUFFIXES.length; i++) {
      if (w.length > 5 && w.endsWith(SUFFIXES[i][0])) {
        w = w.slice(0, w.length - SUFFIXES[i][0].length) + SUFFIXES[i][1];
        break;
      }
    }
    return w;
  }

  // Separa texto en palabras limpias y con raíz.
  function tokenize(text) {
    if (!text) return [];
    var out = [];
    var words = lowercase(stripAccents(String(text))).match(/[a-z0-9ñ]+/g) || [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length < 3) continue;
      if (STOPWORDS.has(w)) continue;
      var root = stem(w);
      if (STOPWORDS.has(root)) continue;
      out.push(root);
    }
    return out;
  }

  // Términos significativos de un texto con su frecuencia normalizada.
  function terms(text, dedupe) {
    var toks = tokenize(text);
    var map = {};
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (Object.prototype.hasOwnProperty.call(map, t)) map[t]++;
      else map[t] = 1;
    }
    var keys = Object.keys(map);
    var max = 1;
    for (var k = 0; k < keys.length; k++) if (map[keys[k]] > max) max = map[keys[k]];
    var arr = [];
    for (var k2 = 0; k2 < keys.length; k2++) {
      arr.push({ term: keys[k2], tf: map[keys[k2]], norm: map[keys[k2]] / max });
    }
    arr.sort(function (a, b) { return b.tf - a.tf || (a.term < b.term ? -1 : 1); });
    if (dedupe) {
      var seen = new Set(), uniq = [];
      for (var k3 = 0; k3 < arr.length; k3++) {
        if (seen.has(arr[k3].term)) continue;
        seen.add(arr[k3].term);
        uniq.push(arr[k3]);
      }
      arr = uniq;
    }
    return arr;
  }

  return {
    STOPWORDS: STOPWORDS,
    tokenize: tokenize,
    terms: terms,
    stem: stem,
    stripAccents: stripAccents
  };
}));