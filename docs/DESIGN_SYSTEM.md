# SmartServe Design System

> Premium product UI — Stripe × Notion × Linear.  
> Tokens en `app/globals.css` · componentes en `ui/` (Atomic Design) · catálogo en `docs/COMPONENTS.md` · charts en `lib/chart-theme.ts`.  
> Versión: **1.0.0**

---

## 1. Principios

1. **Quiet luxury** — poco ruido visual; el contenido manda.
2. **One accent** — un solo color de marca (esmeralda tinta).
3. **Space as structure** — el aire organiza, no las cajas.
4. **Cards are interactive** — si no se puede clickar/editar, no es card.
5. **Motion with purpose** — entrada, feedback, nunca decoración infinita.
6. **Light & dark equal** — mismos tokens, contraste AA+.

---

## 2. Color

### Light
| Token | Hex | Uso |
|-------|-----|-----|
| `--bg` | `#F7F7F5` | Lienzo |
| `--bg-elevated` | `#FFFFFF` | Superficies |
| `--bg-muted` | `#EEEFEC` | Hover / zebra |
| `--fg` | `#0F1115` | Texto primario |
| `--fg-muted` | `#5C6370` | Secundario |
| `--border` | `#E2E4E1` | Bordes |
| `--accent` | `#0F6E56` | CTA / links |
| `--accent-fg` | `#F4FBF7` | Texto sobre accent |
| `--accent-soft` | `#E1F5EE` | Chips accent |
| `--danger` | `#C81E1E` | Error / destructive |
| `--warning` | `#B54708` | Warning |
| `--success` | `#0F6E56` | Success (alineado accent) |
| `--info` | `#175CD3` | Info |

### Dark
| Token | Hex |
|-------|-----|
| `--bg` | `#0B0D10` |
| `--bg-elevated` | `#12151A` |
| `--bg-muted` | `#1A1F27` |
| `--fg` | `#F3F4F2` |
| `--fg-muted` | `#9AA3B2` |
| `--border` | `#2A313C` |
| `--accent` | `#3DDC97` |
| `--accent-fg` | `#04140E` |
| `--accent-soft` | `#123528` |

### Charts
`--chart-1` … `--chart-5` (secuencia armónica, no arcoíris).

---

## 3. Tipografía

| Rol | Familia | Peso | Uso |
|-----|---------|------|-----|
| Display | Fraunces | 500–600 | Títulos de página |
| Body / UI | Geist | 400–500 | UI, tablas, inputs |
| Mono | Geist Mono | 400 | IDs, códigos |

### Escala
| Token | Size | Line | Tracking |
|-------|------|------|----------|
| `display-xl` | 36–40px | 1.15 | -0.02em |
| `display` | 28–32px | 1.2 | -0.02em |
| `title` | 20px | 1.3 | -0.01em |
| `body` | 14–15px | 1.5 | 0 |
| `caption` | 12–13px | 1.4 | 0.01em |

---

## 4. Spacing

Escala 4px: `0 1 2 3 4 5 6 8 10 12 16 20 24`  
Tokens: `--space-1` (4) … `--space-24` (96).

| Contexto | Valor |
|----------|-------|
| Page padding | 24–32px |
| Section gap | 24–32px |
| Stack denso | 8–12px |
| Stack cómodo | 16–20px |
| Inline gap | 8px |

---

## 5. Radii & shadows

| Token | Valor |
|-------|-------|
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 16px |
| `--radius-xl` | 20px |
| `--shadow-sm` | 0 1px 2px rgba(15,17,21,.06) |
| `--shadow-md` | 0 8px 24px rgba(15,17,21,.08) |
| `--shadow-lg` | 0 18px 50px rgba(15,17,21,.10) |

---

## 6. Componentes

### Botones
- `primary` — accent filled  
- `secondary` — elevated + border  
- `ghost` — transparent  
- `danger` — destructive  
- Sizes: `sm` 32 · `md` 40 · `lg` 44  
- Focus: ring 4px `--ring`

### Inputs / Select / Textarea
- Altura 40px (md), radio md, border, focus accent ring  
- Label arriba muted · error danger caption

### Cards
- Solo contenedores interactivos o paneles de trabajo  
- `border + bg-elevated + radius-xl` · hover border accent/40

### Tablas
- Header muted · filas hover muted · sin zebra fuerte  
- Densidad comfortable (py-3)

### Modales
- Overlay 40% + blur 2px · panel elevated · fade-up  
- Max-width `lg` default · footer acciones alineadas derecha

### Alertas
- `info | success | warning | danger`  
- Borde + soft fill · icono Lucide 16px

### Badges
- Soft pill · tones: neutral, accent, success, warning, danger  
- Nunca más de un badge “loud” por fila

### Gráficas
- Stroke accent · fill gradient soft · grid border  
- Tooltip elevated · sin leyendas ruidosas

---

## 7. Animaciones

| Nombre | Uso | Duración |
|--------|-----|----------|
| `fade-up` | Entrada de bloques | 400ms ease |
| `fade-in` | Overlay | 250ms |
| `scale-in` | Popovers | 200ms |
| `pulse-soft` | Skeletons | 1.6s loop |
| `stagger` | Listas KPI | delay 40ms |

`prefers-reduced-motion: reduce` → desactivar transforms.

---

## 8. Iconografía

- Librería: **Lucide React**
- Tamaños: 14 / 16 / 20 / 24  
- Stroke: 1.75–2  
- Color: `currentColor`  
- Alineados al texto con gap 8px en botones

---

## 9. Z-index

| Capa | z |
|------|---|
| Base | 0 |
| Sticky header | 30 |
| Dropdown | 40 |
| Modal | 50 |
| Toast | 60 |

---

*Fuente de verdad visual del producto.*
