# MNEMO — memoria digital local con asociación y olvido

Un motor de memoria que ingiere textos, extrae conceptos, los conecta en una red de asociaciones y recuerda **por asociación**, no solo por palabra exacta. Lo que no se usa se desvanece (olvido por decaimiento) y un modo "sueño" consolida asociaciones nuevas en tiempo idle.

## Qué es

MNEMO funciona como una memoria biológica simplificada:

- **Ingesta**: cada fragmento de texto se analiza, se reduce a raíces (stemming español) y sus términos más prominentes se convierten en conceptos con una *saliencia*.
- **Asociación**: los conceptos que aparecen juntos crean aristas ponderadas entre sí (co-ocurrencia). Cuanto más usas una memoria, más fuertes son sus conexiones.
- **Recuerdo por asociación**: buscar "casa" no devuelve "otras cosas de la casa": recorre la cadena de conceptos asociados (*casa → jardín → cerezo → fuentes*) y trae memorias que *no esperabas*. Ese es el giro.
- **Olvido**: cada tick decae toda la red; los conceptos y aristas que caen por debajo de un umbral se eliminan. Reforzar una memoria (accederla) la fija en el tiempo.
- **Sueño**: consolidación asociativa — conceptos que comparten un vecino se conectan entre sí, "sabiendo" sin evidencia directa.

## Por qué existe

Los motores de búsqueda devuelven lo que *sabes* que buscas. MNEMO explora lo que pasaría si un sistema recordara como una persona: con cadenas de asociación, refuerzo por uso y olvido. Es la base para un "asistente que tiene memoria" o una "Wikipedia personal que se recuerda a sí misma".

## Características

- Búsqueda con relevancia (TF·IDF) + bonus por recencia y frecuencia de acceso.
- Recuerdo asociativo en 3 saltos sobre el grafo de conceptos.
- Olvido por decaimiento configurable (`decayRate`, `forgetThreshold`).
- Sueño: generación de asociaciones indirectas.
- Persistencia: JSON exportable/importable (localStorage en web, archivo en CLI).
- Sin dependencias: funciona con `file://` y con Node estándar.
- CLI completo + interfaz web con grafo conceptual interactivo.

## Instalación

```bash
cd /ruta/al/proyecto
git init
```

No requiere dependencias. Requiere Node.js (`node`) para el CLI; el resto es un navegador.

## Uso

### Interfaz web

```bash
xdg-open index.html      # Linux / open index.html en macOS
```

Carga el corpus de ejemplo (30 memorias) y explora:

- **Clic en un nodo** → recuerda ese concepto.
- **Buscar** → memorias relevantes. **Asociar** → cadenas de memoria inesperadas.
- **Guardar** → nueva memoria.
- **Sueño** → consolida asociaciones. **Olvidar** → un tick de decaimiento.
- **Reforzar** → en cada resultado, fija la memoria en el tiempo.
- **Exportar/Importar** → JSON.

### CLI

```bash
# Ingestar
node cli.js agregar "la memoria episódica guarda los eventos vividos" --tags cognición
node cli.js agregar "el hipocampo es clave en la formación de memorias nuevas"

# Buscar y recordar
node cli.js buscar "eventos" 3
node cli.js recordar "hipocampo" 3

# Reforzar, olvidar y soñar
node cli.js acceder 0
node cli.js olvidar 50
node cli.js suenar 300

# Estado y datos
node cli.js estado
node cli.js grafo 40
```

El estado persiste en `store/memory.json` (configurable con `MNEMO_STORE`).

## Arquitectura

```
js/
  core/
    lexer.js       ← tokenización, stopwords, stemming español (testeable)
    memory.js      ← MemoryEngine: índice invertido, saliencia, grafo de asociaciones, olvido, sueño (testeable)
  web.js           ← interfaz web: grafo con fuerzas, búsqueda, panel resultados
index.html         ← web
cli.js             ← CLI (Node)
tests/
  memory.test.js   ← 11 pruebas (lexer, ingestión, búsqueda, asociación, olvido, sueño, serialización)
```

El núcleo es puro (sin DOM), igual que el proyecto anterior, para poder testearlo en Node y reusarlo desde CLI o navegador.

## Ejemplo real

```
$ node cli.js recordar "jardín" 4
[0] 7.36  cerezo  (vía: flore·mariposa·primavera)
      en invierno el cerezo queda desnudo sin flores
[1] 6.76  kilometros  (vía: flore·mariposa·primavera)
      las mariposas monarca migran miles de kilómetros
```

La memoria recuerda cosas que **no** contienen la palabra "jardín": las encadena a través de flores y mariposas. Esa es la diferencia con un buscador.

## Estado

- Núcleo funcional y testeado (11 pruebas).
- CLI operativo de punta a punta.
- Interfaz web con grafo interactivo.
- Conductas de asociación, refuerzo y olvido verificadas con tests.
- Pendiente: embeddings semánticos reales, deduplicación heurística, integración de ingestión de archivos.

## Licencia

MIT