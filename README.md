# asun-format

Syntax highlighter for **ASUN** (Array-Schema Unified Notation).  
Zero dependencies · Works in browsers, Node.js, Deno, Bun · Framework-agnostic.

It follows the current ASUN syntax: field hints use `@`, complex fields keep `@{...}` / `@[...]`, and keyed collections are written as entry lists such as `[{key@str,value@str}]`.

---

## Installation

```bash
npm install asun-format
```

Or grab the pre-built files directly from `dist/`:

| File                 | Format              | Use case                            |
| -------------------- | ------------------- | ----------------------------------- |
| `asun-format.js`     | ESM                 | Bundlers (Vite, webpack, Rollup…)   |
| `asun-format.cjs`    | CJS                 | Node.js `require()`                 |
| `asun-format.min.js` | IIFE `AsunFormat.*` | `<script>` tag / CDN                |
| `asun-format.css`    | CSS                 | Styles for all four built-in themes |

---

## Quick start

### Via `<script>` tag (no build step)

```html
<link rel="stylesheet" href="asun-format.css" />

<pre><code id="output"></code></pre>

<script src="asun-format.min.js"></script>
<script>
  const src = `{name@str, age@int}:(Alice, 30)`;
  document.getElementById("output").innerHTML = AsunFormat.highlight(src);
</script>
```

### ESM / bundler

```js
import { highlight } from "asun-format";
import "asun-format/css"; // or import the CSS file from dist/

const src = `{name@str, age@int}:(Alice, 30)`;
document.getElementById("output").innerHTML = highlight(src);
```

### Node.js (CJS)

```js
const { highlight } = require("asun-format");
const html = highlight(`{id@int, name@str}:(1, "Alice")`);
console.log(html); // <code class="asun-highlight">…</code>
```

---

## API

### `highlight(src, options?)`

Converts ASUN source text to an HTML string with `<span class="asun-*">` tokens.

```ts
function highlight(src: string, options?: HighlightOptions): string;

interface HighlightOptions {
  /** Wrapper HTML tag. Default: 'code' */
  tag?: string;
  /** CSS class(es) on the wrapper. Default: 'asun-highlight' */
  class?: string;
}
```

**Example:**

```js
// Dark theme (default)
highlight(src);

// Light theme
highlight(src, { class: "asun-highlight asun-light" });

// Wrap in <pre> instead of <code>
highlight(src, { tag: "pre" });
```

---

### `tokenize(src)`

Returns a flat array of typed tokens — useful for building custom renderers or
editor integrations.

```ts
function tokenize(src: string): Token[];

interface Token {
  kind: TokenKind;
  text: string;
}
```

**Example:**

```js
import { tokenize } from "asun-format";

const tokens = tokenize(`{name@str}:(Alice)`);
console.log(tokens);
// [
//   { kind: 'schema-open',  text: '{' },
//   { kind: 'field',        text: 'name' },
//   { kind: 'at',           text: '@' },
//   { kind: 'type',         text: 'str' },
//   { kind: 'schema-close', text: '}' },
//   { kind: 'colon',        text: ':' },
//   { kind: 'tuple-open',   text: '(' },
//   { kind: 'value',        text: 'Alice' },
//   { kind: 'tuple-close',  text: ')' },
// ]
```

---

## Token kinds

Each token receives a CSS class `asun-<kind>`:

| Kind           | CSS class           | Description                                  |
| -------------- | ------------------- | -------------------------------------------- |
| `field`        | `asun-field`        | Field name inside a schema                   |
| `type`         | `asun-type`         | Type annotation (`int` `str` `float` `bool`) |
| `string`       | `asun-string`       | Quoted string `"…"`                          |
| `number`       | `asun-number`       | Integer, float, or date (`2025-06-24`)       |
| `bool`         | `asun-bool`         | `true` / `false`                             |
| `value`        | `asun-value`        | Unquoted plain data value                    |
| `comment`      | `asun-comment`      | Block comment `/* … */`                      |
| `schema-open`  | `asun-schema-open`  | `{`                                          |
| `schema-close` | `asun-schema-close` | `}`                                          |
| `tuple-open`   | `asun-tuple-open`   | `(`                                          |
| `tuple-close`  | `asun-tuple-close`  | `)`                                          |
| `array-open`   | `asun-array-open`   | `[`                                          |
| `array-close`  | `asun-array-close`  | `]`                                          |
| `at`           | `asun-at`           | `@`                                          |
| `colon`        | `asun-colon`        | `:`                                          |
| `comma`        | `asun-comma`        | `,`                                          |

---

## Themes

Include `asun-format.css` once, then add the appropriate class to the wrapper:

| Class                        | Theme                              |
| ---------------------------- | ---------------------------------- |
| `asun-highlight`             | Dark (default — One Dark-inspired) |
| `asun-highlight asun-light`  | Light (One Light)                  |
| `asun-highlight asun-github` | GitHub                             |
| `asun-highlight asun-tokyo`  | Tokyo Night                        |

```html
<!-- Dark (default) -->
<code class="asun-highlight">…</code>

<!-- Light -->
<code class="asun-highlight asun-light">…</code>

<!-- GitHub -->
<code class="asun-highlight asun-github">…</code>

<!-- Tokyo Night -->
<code class="asun-highlight asun-tokyo">…</code>
```

---

## Custom theme via CSS variables

Override any color without touching the source:

```css
.asun-highlight {
  --asun-field: hotpink;
  --asun-type: #00bcd4;
  --asun-string: #aed581;
  --asun-number: #ffb74d;
  --asun-bool: #ce93d8;
  --asun-value: #e0e0e0;
  --asun-comment: #666;
  --asun-punct: #90caf9;
  --asun-punct-dim: rgba(144, 202, 249, 0.5);
  background: #1e1e2e;
  color: #cdd6f4;
}
```

The built-in highlighter expects current ASUN forms such as:

```asun
{profile@{host@str,port@int}, tags@[str]}:
((127.0.0.1,8080), [blue, fast])
```

Keyed collections follow the same schema style:

```asun
{attrs@[{key@str,value@str}]}:
([(role,admin), (tier,gold)])
```

---

## Framework examples

### React

```tsx
import { highlight } from "asun-format";
import "asun-format/css";

function AsunBlock({ src }: { src: string }) {
  return (
    <pre>
      <code
        className="asun-highlight"
        dangerouslySetInnerHTML={{ __html: highlight(src) }}
      />
    </pre>
  );
}
```

### Vue 3

```vue
<template>
  <pre><code class="asun-highlight" v-html="html" /></pre>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { highlight } from "asun-format";
import "asun-format/css";

const props = defineProps<{ src: string }>();
const html = computed(() => highlight(props.src));
</script>
```

### Svelte

```svelte
<script lang="ts">
  import { highlight } from 'asun-format';
  import 'asun-format/css';

  export let src: string;
  $: html = highlight(src);
</script>

<pre><code class="asun-highlight">{@html html}</code></pre>
```

---

## Building from source

```bash
git clone <repo>
cd js-format

npm install
npm run build   # produces dist/
npm test        # build + node --test
```

Open `examples/demo.html` (served via any static file server) to see the
interactive live-preview with all built-in themes and example snippets.

---

## License

MIT
