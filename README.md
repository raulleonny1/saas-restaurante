# SmartServe AI — Arquitectura

Base multi-tenant para cafeterías, bares y restaurantes.  
**Sin módulos de negocio implementados** — solo cimientos listos para crecer.

## Stack

Next.js 16 · React 19 · TypeScript estricto · Tailwind CSS v4 · Firebase · PWA

## Arranque

```bash
npm install
npm run dev
```

1. Abre http://localhost:3000  
2. Regístrate (crea usuario + primer restaurante)  
3. Navega el shell vacío de módulos  

Sin Firebase → auth local (`localStorage`).  
Con Firebase → copia `.env.example` → `.env.local` y despliega `firestore.rules`.

## Estructura

```text
app/                 Rutas (auth + shell + placeholders)
components/          Layout, nav, placeholders
modules/             Dominios (vacíos, listos para implementar)
hooks/               Hooks transversales
services/            Auth + restaurant (sin lógica de POS/etc.)
types/               Contratos TypeScript globales
models/              Paths Firestore, colecciones, factories
lib/                 Utils, navegación, auth local
firebase/            Config client
context/             Auth, Restaurant, Theme, Providers
store/               Zustand UI ligero
ui/                  Design system
functions/           Cloud Functions (futuro)
firestore.rules      Seguridad multi-tenant
```

## Datos (multi-tenant)

```text
users/{uid}
restaurants/{restaurantId}
  members | tables | menuCategories | menuItems | orders
  ingredients | suppliers | waste | customers
  reservations | campaigns | coupons | employees
```

Nunca mezclar datos entre `restaurantId`.

## Convención de módulos

Cada dominio vive en `modules/<name>/`.  
`app/(app)/<route>/page.tsx` solo monta la vista del módulo.  
Servicios del dominio → `services/` o `modules/<name>/services/`.

## Capas listas

| Capa | Estado |
|------|--------|
| Tipos globales | `types/` |
| Modelos / paths | `models/` |
| Firebase | `firebase/` + rules |
| Tema claro/oscuro | `globals.css` + ThemeProvider |
| UI kit | `ui/` |
| Navegación | `lib/navigation.ts` + Sidebar/Topbar |
| Auth + restaurant context | `context/` + `services/` |
| Placeholders módulos | rutas `/dashboard` … `/settings` |
