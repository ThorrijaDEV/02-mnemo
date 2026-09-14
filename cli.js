#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { MemoryEngine } = require('./js/core/memory.js');

const STORE_FILE = process.env.MNEMO_STORE || path.join(__dirname, 'store', 'memory.json');

let engine = new MemoryEngine();
if (fs.existsSync(STORE_FILE)) {
  engine.fromJSON(fs.readFileSync(STORE_FILE, 'utf8'));
}

function save() {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, engine.toJSON());
}

const [cmd, ...args] = process.argv.slice(2);

function printHelp() {
  console.log(`
MNEMO — memoria digital local con asociación y olvido.

Uso:
  mnemo agregar "texto" [--tags a,b]   ingiere un texto
  mnemo buscar "querys" [n]            busca memorias relevantes
  mnemo recordar "concepto" [n]        recuerda por asociación
  mnemo acceder <indice>               refuerza una memoria (la fija)
  mnemo olvidar                        decae todo un tick
  mnemo suenar [pasos]                 consolidación asociativa
  mnemo grafo [n]                      datos del grafo conceptual (JSON)
  mnemo estado                         estadísticas
  mnemo limpiar                        borra la memoria completa
`);
}

function run() {
  if (!cmd) { printHelp(); return; }
  switch (cmd) {
    case 'agregar': {
      const text = args[0];
      let tags = [];
      const ti = args.indexOf('--tags');
      if (ti >= 0 && args[ti + 1]) tags = args[ti + 1].split(',');
      if (!text) { console.error('falta el texto'); process.exit(1); }
      const doc = engine.addText(text, { tags });
      save();
      const nMem = engine.docs.length - 1;
      console.log('√ memoria #' + nMem + ' (' + doc.summary + ')');
      break;
    }
    case 'buscar': {
      if (!args[0]) { console.error('falta la consulta'); process.exit(1); }
      const res = engine.query(args[0], +(args[1] || 5));
      if (!res.length) { console.log('no hay recuerdos sobre "' + args[0] + '"'); break; }
      res.forEach((r, i) => {
        console.log(`[${i}] ${r.score.toFixed(2)}  ${r.doc.summary}  (términos: ${r.shared.join(', ')})`);
        console.log(`      ${r.doc.text.slice(0, 140).replace(/\n/g, ' ')}`);
      });
      break;
    }
    case 'recordar': {
      if (!args[0]) { console.error('falta el concepto'); process.exit(1); }
      const res = engine.recall(args[0], +(args[1] || 5));
      if (!res.length) { console.log('no hay asociaciones con "' + args[0] + '"'); break; }
      res.forEach((r, i) => {
        const via = r.via.map(v => v.term).slice(0, 3).join('·');
        console.log(`[${i}] ${r.score.toFixed(2)}  ${r.doc.summary}  (vía: ${via})`);
        console.log(`      ${r.doc.text.slice(0, 140).replace(/\n/g, ' ')}`);
      });
      break;
    }
    case 'acceder': {
      const idx = +(args[0]);
      const doc = engine.access(idx);
      if (!doc) { console.error('índice inválido'); process.exit(1); }
      save();
      console.log('√ memoria #' + idx + ' reforzada (accesos: ' + doc.accesses + ')');
      break;
    }
    case 'olvidar': {
      const n = +(args[0] || 1);
      for (let i = 0; i < n; i++) engine.tick();
      save();
      const s = engine.stats();
      console.log('√ decaimiento ×' + n + ' → ' + s.concepts + ' conceptos, ' + s.associations + ' asociaciones');
      break;
    }
    case 'suenar': {
      const steps = +(args[0] || 200);
      const out = engine.dream(steps);
      save();
      console.log('√ consolidado: ' + out.length + ' asociaciones nuevas (ej.: ' + out.slice(0, 5).join(', ') + ')');
      break;
    }
    case 'grafo': {
      const n = +(args[0] || 60);
      console.log(JSON.stringify(engine.graphData(n)));
      break;
    }
    case 'estado': {
      const s = engine.stats();
      console.log(`memorias: ${s.memories}`);
      console.log(`conceptos: ${s.concepts}`);
      console.log(`asociaciones: ${s.associations}`);
      console.log(`ticks: ${s.ticks}`);
      break;
    }
    case 'limpiar': {
      fs.rmSync(STORE_FILE, { force: true });
      console.log('√ memoria borrada');
      break;
    }
    default:
      printHelp();
  }
}

run();