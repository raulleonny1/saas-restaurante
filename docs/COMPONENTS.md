# SmartServe — Librería de componentes (Atomic Design)

> Fuente de verdad del catálogo UI.  
> Código: `ui/atoms`, `ui/molecules`, `ui/organisms` · API pública: `@/ui`  
> Tokens: `app/globals.css` · Principios: `docs/DESIGN_SYSTEM.md`  
> Stack: **Tailwind CSS v4** · Light / Dark vía `next-themes` (`class="dark"`)

---

## Convenciones

| Regla | Detalle |
|-------|---------|
| Capas | Atoms → Molecules → Organisms. Un componente no importa de una capa superior. |
| Import | Preferir `import { Button } from "@/ui"`. Capas: `@/ui/atoms`, etc. |
| Theming | Solo tokens semánticos (`bg-bg`, `text-fg`, `border-border`, `bg-accent`…). Nunca hex hardcodeados en componentes. |
| Docs en código | Cada archivo exportado lleva JSDoc de capa + propósito. |
| Sin features | Esta librería no contiene lógica de negocio, rutas ni pantallas. |

### Light & Dark

Todos los componentes leen variables CSS definidas en `:root` y `.dark`. Al cambiar tema, superficies, texto, bordes y estados semánticos se actualizan sin props extra.

---

## Árbol

```
ui/
├── atoms/       # Primitivos indivisibles
├── molecules/   # Composiciones pequeñas
├── organisms/   # Bloques de UI complejos
└── index.ts     # Re-export público
```

---

## Atoms

### `Avatar`
Foto o iniciales de usuario/restaurante.

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `name` | `string` | — | Texto para iniciales / `aria-label` |
| `src` | `string` | — | URL de imagen |
| `size` | `sm \| md \| lg` | `md` | Tamaño |

**Theming:** `bg-accent-soft` + `text-accent`.

---

### `Badge`
Chip de estado o meta.

| Prop | Tipo | Default |
|------|------|---------|
| `tone` | `neutral \| success \| warning \| danger \| accent \| info` | `neutral` |

**Theming:** soft backgrounds (`--*-soft`) + color semántico.

---

### `Button`
CTA / acción.

| Prop | Tipo | Default |
|------|------|---------|
| `variant` | `primary \| secondary \| ghost \| danger` | `primary` |
| `size` | `sm \| md \| lg` | `md` |

**Theming:** `primary` → `accent` / `accent-fg`; focus ring `--ring`.

---

### `Checkbox`
Checkbox nativo con label opcional.

| Prop | Tipo |
|------|------|
| `label` | `string` |
| `description` | `string` |
| … | `InputHTMLAttributes` (sin `type`) |

---

### `Divider`
Separador horizontal (con label opcional) o vertical.

| Prop | Tipo | Default |
|------|------|---------|
| `label` | `string` | — |
| `orientation` | `horizontal \| vertical` | `horizontal` |

---

### `Icon`
Wrapper Lucide con tamaños del sistema.

| Prop | Tipo | Default |
|------|------|---------|
| `icon` | `LucideIcon` | — |
| `size` | `sm \| md \| lg \| xl` | `md` |

---

### `Input`
Campo de texto.

| Prop | Tipo |
|------|------|
| `label` | `string` |
| `error` | `string` |
| `hint` | `string` |

**Theming:** `bg-bg-elevated`, borde `border`, focus `accent` + ring.

---

### `Kbd`
Badge de atajo de teclado (`<kbd>`).

---

### `Label`
Etiqueta de formulario (`required` / `optional`).

---

### `Radio`
Radio nativo con label opcional (misma API que `Checkbox`).

---

### `Select`
`<select>` nativo estilizado (`label`, `error`).

---

### `Skeleton`
Placeholder de carga (`animate-pulse-soft`, `bg-bg-muted`).

---

### `Spinner`
Indicador de carga circular.

| Prop | Tipo | Default |
|------|------|---------|
| `size` | `sm \| md \| lg` | `md` |
| `label` | `string` | `"Cargando"` |

---

### `Switch`
Toggle accesible (`role="switch"`).

| Prop | Tipo |
|------|------|
| `checked` | `boolean` |
| `onCheckedChange` | `(checked: boolean) => void` |
| `label` | `string` |

**Theming:** on → `bg-accent`; off → `bg-bg-muted` + borde.

---

### `Text`
Tipografía tokenizada.

| Prop | Tipo | Default |
|------|------|---------|
| `variant` | `body \| muted \| caption \| title \| display \| display-xl` | `body` |
| `as` | `p \| span \| div \| h1 \| h2 \| h3` | `p` |

---

### `Textarea`
Área de texto multilínea (`label`, `error`).

---

## Molecules

### `Alert`
Banner de feedback inline.

| Prop | Tipo | Default |
|------|------|---------|
| `tone` | `info \| success \| warning \| danger` | `info` |
| `title` | `string` | — |

---

### `ButtonGroup`
Agrupa `Button`s.

| Prop | Tipo | Default |
|------|------|---------|
| `variant` | `attached \| spaced` | `spaced` |

---

### `EmptyState`
Estado vacío con CTA opcional.

| Prop | Tipo |
|------|------|
| `title` | `string` |
| `description` | `string` |
| `action` | `ReactNode` |

---

### `FieldHint`
Caption bajo un control (`tone`: `muted` \| `danger`).

---

### `FormField`
Label + children + hint/error (composición recomendada para controles custom).

| Prop | Tipo |
|------|------|
| `label` | `string` |
| `htmlFor` | `string` |
| `required` / `optional` | `boolean` |
| `error` / `hint` | `string` |
| `children` | `ReactNode` |

---

### `IconButton`
Botón cuadrado solo-icono. Requiere `aria-label`.

| Prop | Tipo | Default |
|------|------|---------|
| `variant` | `ghost \| secondary \| danger` | `ghost` |
| `size` | `sm \| md \| lg` | `md` |

---

### `SearchInput`
Búsqueda con icono y clear opcional (`onClear`).

---

### `ThemeToggle`
Botón icono que alterna light/dark (`next-themes`). Seguro ante hidratación.

---

### `Tabs` (+ `TabsList`, `TabsTrigger`, `TabsContent`)
Tabs controladas.

```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="a">A</TabsTrigger>
    <TabsTrigger value="b">B</TabsTrigger>
  </TabsList>
  <TabsContent value="a">…</TabsContent>
</Tabs>
```

---

## Organisms

### `Card` (+ `CardHeader`, `CardTitle`, `CardDescription`)
Superficie elevada.

| Prop | Tipo | Default |
|------|------|---------|
| `interactive` | `boolean` | `false` |
| `padding` | `none \| sm \| md \| lg` | `md` |

Usar solo cuando el bloque es unidad interactiva o editable (ver design system).

---

### `Modal`
Diálogo modal (Escape cierra).

| Prop | Tipo | Default |
|------|------|---------|
| `open` | `boolean` | — |
| `onClose` | `() => void` | — |
| `title` | `string` | — |
| `description` | `string` | — |
| `footer` | `ReactNode` | — |
| `size` | `sm \| md \| lg` | `md` |

---

### `PageHeader`
Cabecera de página: título, descripción, actions, breadcrumbs.

---

### `Section`
Sección de contenido con título/acciones opcionales.

---

### `Table` (+ `THead`, `TBody`, `TR`, `TH`, `TD`)
Tabla de datos con scroll horizontal y hover de fila.

---

### `Toast` / `ToastViewport` / `toast()`
Notificaciones imperativas. Montar `<ToastViewport />` en providers.

```tsx
toast("Guardado", "success");
```

Tones: `info` \| `success` \| `error`.

---

## Ejemplos de uso

```tsx
import {
  Button,
  FormField,
  Input,
  PageHeader,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/ui";

export function Example() {
  return (
    <>
      <PageHeader
        title="Inventario"
        description="Stock por sucursal"
        actions={<Button>Nuevo ítem</Button>}
      />
      <FormField label="Nombre" required htmlFor="name">
        <Input id="name" />
      </FormField>
      <Switch checked={false} onCheckedChange={() => {}} label="Activo" />
    </>
  );
}
```

---

## Checklist al añadir un componente

1. Colocar en la capa correcta (`atoms` / `molecules` / `organisms`).
2. Usar solo tokens Tailwind del design system (no hex).
3. Verificar contraste en light y dark.
4. Exportar en el `index.ts` de la capa (y queda en `@/ui`).
5. Añadir JSDoc en el archivo.
6. Documentar aquí (props + theming).
