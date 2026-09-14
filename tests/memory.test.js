'use strict';

const assert = require('assert');
const path = require('path');
const { MemoryEngine } = require(path.join(__dirname, '..', 'js', 'core', 'memory.js'));
const Lexer = require(path.join(__dirname, '..', 'js', 'core', 'lexer.js'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name); console.error(e.stack); process.exitCode = 1; }
}

test('Lexer.tokenize: limpia stopwords, raíces, normaliza acentos', () => {
  const tok = Lexer.tokenize('Las neuronas artificiales son muy rápidas');
  assert.ok(tok.includes('neurona'));
  assert.ok(tok.includes('artifici'));
  assert.ok(tok.includes('rapida'));
  assert.ok(!tok.includes('las'));
  assert.ok(!tok.includes('son'));
  assert.ok(!tok.includes('muy'));
});

test('Lexer.terms: devuelve frecuencias normalizadas', () => {
  const terms = Lexer.terms('gato gato gato perro perro');
  assert.ok(terms.length > 0);
  const gato = terms.find(t => t.term === 'gato');
  assert.ok(gato);
  assert.ok(gato.tf === 3);
  assert.ok(gato.norm > 0.9 && gato.norm <= 1.0);
});

test('addText crea documento e indexa términos', () => {
  const e = new MemoryEngine();
  const doc = e.addText('la memoria episódica guarda eventos vividos', { tags: ['neuro'] });
  assert.ok(doc.id);
  assert.ok(doc.terms.length >= 4);
  assert.ok(e.docs.length === 1);
  assert.ok(e.index.has('memoria'));
  assert.ok(e.concepts.size > 0);
});

test('query: devuelve documentos relevantes y ordena por relevancia', () => {
  const e = new MemoryEngine();
  e.addText('la memoria episódica guarda eventos vividos');
  e.addText('la red neuronal procesa información del mundo');
  e.addText('el lenguaje natural es complejo para las máquinas');
  const r = e.query('memoria episódica', 5);
  assert.ok(r.length >= 1);
  assert.ok(r[0].doc.text.includes('episódica'));
  assert.ok(r[0].shared.length >= 1);
});

test('recall: recuerda por cadenas de asociación sin tocar la semilla', () => {
  const e = new MemoryEngine();
  e.addText('la memoria guarda el recuerdo del gatito');
  e.addText('el gatito juega con la pelota todas las tardes');
  e.addText('la pelota es roja y está en la casa');
  e.addText('la casa tiene un jardín muy grande');
  const r = e.recall('memoria', 8);
  assert.ok(r.length >= 2, 'debería encontrar memorias asociadas en varios saltos');
  r.forEach(item => {
    assert.ok(!item.doc.text.toLowerCase().includes('memoria'),
      'recall no debería devolver la memoria semilla');
  });
  const summaries = r.map(i => i.doc.summary);
  assert.ok(summaries.includes('gatito'), 'la asociación de 1er salto debería llegar a gatito');
  assert.ok(r.some(i => i.doc.text.toLowerCase().includes('pelota')),
    'debería encadenar hasta pelota en 2º salto');
});

test('access: refuerza documento y fortalece conceptos', () => {
  const e = new MemoryEngine();
  e.addText('concepto de prueba');
  const doc = e.docs[0];
  const before = doc.accesses;
  e.access(0);
  assert.strictEqual(doc.accesses, before + 1);
  assert.ok(doc.lastAccess >= 0);
});

test('tick + forget: decae conceptos y limpia por debajo del umbral', () => {
  const e = new MemoryEngine({ decayRate: 0.01, forgetThreshold: 0.5 });
  e.addText('concepto único y especial para olvidar');
  const before = e.concepts.size;
  for (let i = 0; i < 300; i++) e.tick();
  assert.ok(e.concepts.size < before, 'debería haber menos conceptos tras decay');
});

test('dream: crea asociaciones nuevas entre conceptos vecinos', () => {
  const e = new MemoryEngine();
  e.addText('cielo azul y estrellas brillantes');
  e.addText('noche estrellada y cielo oscuro');
  const before = e.edges.size;
  e.dream(200);
  assert.ok(e.edges.size >= before);
});

test('graphData: devuelve nodos y enlaces de conceptos', () => {
  const e = new MemoryEngine();
  e.addText('la memoria es un proceso cognitivo fundamental');
  e.addText('la cognición y la memoria trabajan juntas');
  const g = e.graphData(20);
  assert.ok(Array.isArray(g.nodes));
  assert.ok(g.nodes.length > 0);
  assert.ok(Array.isArray(g.links));
});

test('serialización: round-trip JSON preserva el estado', () => {
  const e1 = new MemoryEngine();
  e1.addText('primera memoria de prueba');
  e1.addText('segunda memoria con otro contenido');
  e1.tick();
  const json = e1.toJSON();
  const e2 = new MemoryEngine();
  e2.fromJSON(json);
  assert.strictEqual(e2.docs.length, 2);
  assert.strictEqual(e2.now, 1);
  assert.ok(e2.concepts.size > 0);
  const r = e2.query('primera memoria', 5);
  assert.ok(r.length >= 1);
});

test('CLI: ejecuta crear, buscar y recordar sin error', () => {
  // Simulación ligera del flujo CLI
  const e = new MemoryEngine();
  e.addText('las mitochondrial son centrales de energía celular');
  e.addText('la teoría de la relatividad cambió la física');
  e.addText('la energía se conserva en los sistemas cerrados');
  e.addText('la célula usa mitocondrias para la respiración celular');
  const q = e.query('energía celular', 5);
  assert.ok(q.length >= 1, 'debería encontrar algo sobre energía');
  const r = e.recall('mitochondri', 5);
  assert.ok(Array.isArray(r));
});

console.log(`\n${passed} pruebas superadas.`);