# SmartServe AI — ROADMAP V2

**Documento:** Informe CTO + plan de desarrollo comercial  
**Producto:** SaaS multi-tenant para cafeterías, bares y restaurantes  
**Stack:** Next.js 16 · React 19 · Firebase Auth/Firestore · PWA  
**Versión del producto:** 0.1.0 (prototipo avanzado)  
**Fecha:** 19 julio 2026  
**Audiencia:** fundadores, producto, ingeniería  
**Alcance:** análisis del código existente; **sin implementación** en este documento

---

## Resumen ejecutivo

SmartServe tiene una **amplitud funcional inusual** para una fase temprana: POS, cocina, inventario, CRM, reservas, marketing, reportes, web pública, app de cliente, app de camareros, IA local y esqueleto multi-tenant con membresías y facturación documental.

Eso **no** equivale a un producto comercialmente vendible.

| Dimensión | Evaluación |
|-----------|------------|
| Demostración a inversores / early design partners | **Alta** |
| Beta privada con locales de confianza (efectivo + registro de tarjeta) | **Media** |
| Cobrar suscripción SaaS con garantías | **Baja** |
| Sustituir TPV/PSP reales en producción | **No listo** |

**Veredicto CTO:** el proyecto es un *late-stage product prototype* con dominio bien modelado. El gap principal no es “faltan pantallas”, sino **enforcement servidor, monetización real, operaciones (CI/observabilidad) y cierre de superficies stub/simuladas**.

**Objetivo V2:** pasar de “demo impresionante” a **MVP comercial cobrable** (SaaS subscription + ops core fiable), y después a **producto de crecimiento**.

---

## 1. Qué está bien

### 1.1 Arquitectura de dominio y multi-tenancy (base sólida)

- Modelo claro `restaurants/{restaurantId}/…` con aislamiento por tenant; escala horizontal en Firestore **sin forks de código por cliente**.
- Fábricas de documentos, paths canónicos (`models/paths.ts`, `models/schemas.ts`, `models/collections.ts`) y documentación de arquitectura Firestore/RBAC.
- Membresía por restaurante (`members/{uid}`), sucursales, invitaciones (`memberInvites`) y `TenantProvider` que alinea permisos efectivos al restaurante activo.
- Selector de restaurante en topbar: cambio de tenant sin redeploy.

### 1.2 Módulos operativos con profundidad real

| Módulo | Por qué importa |
|--------|-----------------|
| **POS** | Pedidos, mesas, cobro documental, tip/descuento/split, move/merge, historial |
| **Cocina (KDS)** | Flujo en tiempo real alineado con estados de pedido |
| **Inventario** | Stock, compras, merma, sync de ventas |
| **CRM / fidelización** | Clientes, puntos, historial, promos personalizadas |
| **Reservas** | Persistencia + utilidades de calendario |
| **Reportes** | Agregación live + exportación (PDF/XLSX) |
| **Website** | Sitio `/r/[slug]` + admin + índice de slugs/dominios |
| **App cliente** `/c/[slug]` | Pedidos, seguimiento, reservas, puntos, favoritos, chat, avisos |
| **App camareros** `/waiter` | Flujo móvil sobre el mismo POS (QR, offline banner) |
| **IA** | Arquitectura con puertos/adapters; análisis locales + polish opcional OpenAI |

### 1.3 Producto y UX

- Superficies diferenciadas por rol (backoffice, sala, cliente, web pública).
- Design system / UI kit reutilizable.
- PWA básica (manifest + service worker) y manifiesto específico de sala.
- Onboarding de restaurante y registro con rol propietario/cliente.

### 1.4 Seguridad (parcialmente bien encaminada)

- Reglas Firestore no son un “open world”: hay `isMember`, `canManage`, ACL por `branchIds`, flujos públicos acotados (carta, pedidos online, reseñas).
- Auth Firebase Email/Password cuando está configurado.
- Catálogo RBAC amplio y versionado (`lib/rbac`), pensado para overlays por tenant.

### 1.5 Velocidad de iteración

- Un solo monorepo Next + Firebase permite entregar valor de demo rápido.
- Sincronizaciones entre módulos (p. ej. venta → inventario / CRM) demuestran visión de plataforma, no de app aislada.

**Conclusión parcial:** la **apuesta de producto** es correcta y el **esqueleto técnico** permite crecer a miles de restaurantes *si* se cierran enforcement, billing y ops.

---

## 2. Qué está mal

### 2.1 Confianza de seguridad desplazada al cliente

- El guard de sesión del backoffice es **redirect en cliente** (`AppShell`); no hay sesión servidor ni protección de middleware para rutas autenticadas.
- RBAC efectivo en UI; las reglas Firestore suelen autorizar a **cualquier miembro activo** en el catch-all, no al permiso fino (`pos.discount`, `payments.charge`, etc.).
- `users/{uid}` permite self-update: un flag `isSuperAdmin` (o manipulación de `restaurantIds`/`role`) es un vector de escalada si no se endurece con custom claims / Admin SDK.
- Modo local (`lib/local-auth.ts`) con contraseñas en `localStorage` es útil para demos y **inaceptable** en producción.

### 2.2 Monetización y pagos no son reales

- Planes e invoices en Firestore se pueden **cambiar y marcar pagados desde el cliente** (`billing.service` + UI de Ajustes). No hay Stripe Checkout, webhooks ni entitlement server-side.
- Métodos “Stripe / SumUp” en POS/waiter son **etiquetas**; `chargeOrder` escribe un pago `completed` sin adquirente.
- No hay hard-limits de plan (asientos, sucursales, features) en los flujos de producto.

### 2.3 Superficies engañosas o incompletas

| Superficie | Problema |
|------------|----------|
| **Dashboard** | UI con mocks; existe agregador Firestore no cableado |
| **Empleados** | Placeholder; tipos/colecciones esperados por reportes/IA sin CRUD |
| **Marketing** | Persistencia real; envío de campañas **simulado** |
| **Offline POS** | Cola local + banner; flush de mutaciones incompleto / dependencia de caché Firestore |
| **README** | Desactualizado respecto al código (riesgo operativo y de onboarding) |

### 2.4 Backend casi inexistente

- Sin Cloud Functions (`functions/` vacío).
- Sin `firebase-admin` en el proyecto.
- APIs Next mínimas: IA chat **sin auth** (quema de cuota/API key si se configura OpenAI); resolve-domain para middleware.
- `firebase.json` despliega reglas, **no índices** de forma explícita/completa según configuración actual.

### 2.5 Calidad de ingeniería pre-comercial

- Cero tests automatizados, cero CI/CD, sin Sentry/APM, sin analytics de producto.
- Listeners `onSnapshot` / `getDocs` de colecciones enteras sin paginación en varios módulos (coste y latencia).
- Nav lateral muestra todos los módulos sin filtrar por permiso (UX confusa + falsa sensación de acceso).

### 2.6 Messaging de producto vs realidad

Prometer “Stripe/SumUp”, “marketing omnichannel”, “dashboard en tiempo real” o “offline-first” **sin asteriscos** genera riesgo legal/reputacional en venta comercial.

---

## 3. Qué falta

### 3.1 Capacidad comercial mínima (must-have para cobrar)

1. **Billing real** — Stripe Billing (o equivalente): Checkout/Portal, webhooks, estado de suscripción solo writable por backend, trials reales, dunning.
2. **Entitlements** — Gate de features y límites por plan (sucursales, usuarios, módulos) en servidor + UX de upgrade.
3. **Platform admin** — Consola `super_admin` (tenants, soporte, impersonation controlada, suspender cuentas).
4. **Legal / trust** — Términos, privacidad, DPA, cookies, subprocessors, página de estado.
5. **Onboarding comercial** — Activación guiada, checklist “primer pedido / primera mesa / primera reserva”, emails transaccionales.

### 3.2 Capacidad operativa del restaurante (para retener)

6. **Módulo Empleados** — CRUD, vínculo a `members`, turnos, permisos por sucursal.
7. **Dashboard real** — Cablear servicio existente; KPIs accionables; no mocks.
8. **Pagos en sala** — Integración SumUp/Stripe Terminal (o partner local) *o* messaging honesto “registro de cobro”.
9. **Marketing deliverability** — Resend/WhatsApp/providers reales + opt-in/opt-out + auditoría.
10. **Notificaciones push** — FCM para camareros/cocina/cliente (hoy inbox Firestore).
11. **Impresión / fiscal** — Tickets, cocina, y requisitos fiscales por país (España: Verifactu / SIF a medio plazo según mercado).

### 3.3 Plataforma técnica

12. Cloud Functions (o backend dedicado) para: invites, billing, loyalty mutations sensibles, AI proxy, jobs.
13. Firebase App Check + rate limiting en APIs públicas.
14. Storage rules + uploads seguros (logos, fotos menú).
15. CI (lint, typecheck, tests smoke, deploy rules/indexes).
16. Observabilidad (Sentry), logging estructurado, alertas de error/coste Firestore.
17. Entornos `dev` / `staging` / `prod` con proyectos Firebase separados.
18. Backup/export y runbook de incidentes.

### 3.4 Producto / GTM

19. Landing de pricing real + trial controlado.
20. Soporte (Intercom/Crisp) y base de conocimiento.
21. Migración/import (carta CSV, clientes).
22. Roles de venta: demo tenant seed + script de reset.

---

## 4. Problemas de escalabilidad

### 4.1 Cliente como motor analítico

Reportes, IA y (potencialmente) dashboard agregan en el navegador escuchando colecciones completas. Con un tenant grande (meses de pedidos) esto implica:

- Coste de lecturas Firestore desproporcionado  
- UI lenta / memoria alta en tablets de sala  
- Imposibilidad de SLA de reportes históricos  

**Dirección V2:** agregados precomputados (scheduled functions / BigQuery export / colección `dailyStats/{date}`).

### 4.2 Listeners sin límite

Patrón recurrente: `onSnapshot(collection)` sin `limit`/`startAfter`. Escala mal en:

- CRM con muchos clientes  
- Inventario con muchos movimientos  
- Web pública que hidrata blog + eventos + productos de golpe  

**Dirección V2:** paginación, queries acotadas por sucursal/fecha, SSR/ISR para web pública donde tenga sentido.

### 4.3 N+1 en reglas y aceptación de invites

`get()` encadenados en rules (loyalty, chat) aumentan latencia y coste. Invites por email requieren índices compuestos; listados de tenants del usuario hacen N lecturas (mitigado parcialmente con `Promise.all`, sigue siendo O(n) por membership).

**Dirección V2:** denormalizar índices de membership; claims JWT con `restaurantIds` activos; collection-group queries controladas.

### 4.4 Bundle y superficie PWA

Una sola app Next carga Firebase + charts + PDF + XLSX. Camareros y clientes no deberían pagar ese peso.

**Dirección V2:** route-based splitting agresivo; apps/entrypoints separados o packages (`apps/web`, `apps/waiter`, `apps/customer`) si el bundle lo exige.

### 4.5 Offline incompleto

Confiar en persistence de Firestore + cola stub no basta para un TPV en sótanos con Wi‑Fi inestable. Faltan:

- Cola durable con replay idempotente  
- Política de cobros offline (nunca marcar pagado sin adquirente)  
- Resolución de conflictos en mesas concurrentes  

### 4.6 Multi-región / compliance

Hoy asume un proyecto Firebase único. Clientes enterprise pedirán residencia de datos UE, backups y retención.

### 4.7 Lo que *sí* escala bien

- Particionado por `restaurantId` (diseño correcto para miles de tenants).  
- Sin schema migrations globales por cliente.  
- Canales (POS / web / app) escribiendo al mismo modelo de pedidos.

---

## 5. Riesgos de seguridad

| Severidad | Riesgo | Impacto |
|-----------|--------|---------|
| **P0** | Billing/plan writable por `canManage` sin pago | Fraude de suscripción / churn falso |
| **P0** | `/api/ai/chat` sin autenticación ni cuota | Abuso económico de API keys |
| **P0** | Self-update de `users` puede elevar privilegios si hay campos sensibles | Escalada a super_admin / hijack de tenants |
| **P1** | Catch-all rules: cualquier miembro escribe casi todo | Mesero altera inventario, facturación interna, etc. |
| **P1** | Pedidos `web_guest` creados sin auth | Spam de cocina / DoS operativo |
| **P1** | Auth solo en cliente | Scraping de rutas “protegidas”; no es seguridad real |
| **P1** | Local-auth en producción si faltan env vars | Credenciales triviales |
| **P2** | Slugs/dominios — reglas mejoradas pero race en claim de slug | Hijack de marca pública |
| **P2** | Sin App Check | Abuso de APIs y reglas desde scripts |
| **P2** | Sin Storage rules | Uploads inseguros si se activan |
| **P2** | Secrets de marketing/OpenAI en servidor Next sin WAF/rate limit | Coste y exfiltración |
| **P3** | Datos PII de clientes en cliente con listeners amplios | GDPR: minimización y retención |

**Principio V2:** *never trust the client for money, roles, or irreversible ops.* Todo lo que mueva dinero, puntos, planes o roles críticos debe pasar por Admin SDK + Functions con auditoría.

---

## 6. Qué código debe refactorizarse

Priorizado por valor/riesgo (no por “pureza”).

### 6.1 Crítico (hacer antes de cobrar)

1. **Authz end-to-end** — Custom claims o token de membership; rules por permiso/rol fino; eliminar confianza en `users.role` / `isSuperAdmin` documental.
2. **Billing** — Extraer mutaciones de plan/invoice del cliente; solo Functions + Stripe webhooks escriben `billing/current`.
3. **API routes** — Auth session (cookie) + rate limit + App Check en `/api/*`.
4. **Dashboard** — Eliminar mocks; unificar con `subscribeDashboard` o capa de stats.
5. **Nav RBAC** — Filtrar `APP_NAV` / mobile nav por `can()`.
6. **Desactivar o aislar `local-auth`** — Solo `NODE_ENV=development` con warning fuerte.

### 6.2 Alto (estabilidad operativa)

7. **POS offline queue** — Replay idempotente real; separar “ops offline” de “cobro online-only”.
8. **Reports data layer** — Sustituir full listeners por queries fechadas + agregados.
9. **Public website data load** — Caché/ISR; no hidratar todo el tenant en el cliente.
10. **Duplicación de provisioning** — Unificar `auth.service` provision vs `restaurant.service` create (una sola ruta de bootstrap tenant).
11. **Payments naming** — Renombrar UI “Stripe/SumUp” a “Tarjeta (registro)” hasta integración real, o feature-flag.

### 6.3 Medio (mantenibilidad)

12. Split de paquetes / boundaries claros `modules/*` → contratos públicos estables.
13. Validación runtime (`zod`) en writes críticos.
14. Error boundaries + toasts consistentes; menos `alert()`.
15. Actualizar README + runbooks alineados al código.
16. Índices: incluir `firestore.indexes.json` en pipeline de deploy.
17. Deprecar APIs Firebase obsoletas (`enableIndexedDbPersistence` → modelo recomendado actual).

### 6.4 Bajo (deuda aceptable temporalmente)

18. Unificar shells visuales (customer/waiter/backoffice) bajo tokens compartidos.  
19. Extraer hooks compartidos de formateo/dinero/estado de pedido.  
20. Reducir acoplamiento sync CRM/Inventory vía event bus interno (Functions).

---

## 7. Módulos faltantes para una versión comercial

### 7.1 Debe existir en “Commercial MVP” (v2.0)

| Módulo / capacidad | Estado hoy | Necesidad comercial |
|--------------------|------------|---------------------|
| Billing & entitlements (Stripe) | Docs locales | Imprescindible |
| Platform admin | Stub conceptual | Imprescindible |
| Empleados + turnos | Placeholder | Imprescindible para pitch “equipo” |
| Dashboard real | Mock | Imprescindible para retención |
| Authz servidor + App Check | Parcial | Imprescindible |
| Email transaccional | Env only | Imprescindible (invites, recibos, reset) |
| Legal / trust center | Ausente | Imprescindible |
| CI + monitoring | Ausente | Imprescindible |
| Soporte in-app | Ausente | Muy recomendable |

### 7.2 Debe existir en “Growth” (v2.x)

| Módulo | Notas |
|--------|-------|
| PSP real en POS (SumUp/Stripe Terminal) | Diferenciador vs “solo registro” |
| Marketing delivery real | Email/WhatsApp/push con compliance |
| Push notifications (FCM) | Sala + cliente |
| Importadores CSV | Acelera onboarding |
| Multi-idioma i18n completo | Si mercado ES+LATAM/EU |
| Fiscal / facturación cliente final | Según país |
| App stores / TWA endurecida | Si se vende “app nativa” |
| Marketplace de integraciones | Delivery (Glovo/Uber), contabilidad |

### 7.3 Nice-to-have / más adelante

- White-label extremo por cadena  
- Franquicias (org → muchos restaurants)  
- BI embebido (Metabase/BigQuery)  
- Offline-first certificado para flotas  

---

## 8. Prioridad de cada tarea

Escala de prioridad:

- **P0 — Bloqueante comercial / seguridad**  
- **P1 — Necesario para MVP cobrable estable**  
- **P2 — Importante para retención y escala**  
- **P3 — Mejora / diferenciación**

### 8.1 Tabla maestra (roadmap ejecutable)

| ID | Tarea | Prioridad | Esfuerzo est. | Dependencias | Resultado medible |
|----|-------|-----------|---------------|--------------|-------------------|
| T01 | Endurecer rules: quitar self-escalada; billing solo backend | **P0** | M | Admin SDK | Pen-test básico OK |
| T02 | Auth en `/api/*` + rate limit + App Check | **P0** | M | Firebase App Check | API AI no abusada |
| T03 | Stripe Billing + webhooks + Portal | **P0** | L | T01 | Primer cobro real |
| T04 | Entitlements por plan (gate módulos/límites) | **P0** | M | T03 | Plan trial no desbloquea Enterprise |
| T05 | Desactivar local-auth en prod | **P0** | S | — | Sin passwords en localStorage |
| T06 | Filtrar navegación por permisos | **P1** | S | RBAC | UX coherente por rol |
| T07 | Rules finas por rol/permiso en writes sensibles | **P1** | L | T01 | Mesero ≠ inventario |
| T08 | Dashboard real (quitar mocks) | **P1** | M | Stats query | KPIs live |
| T09 | Módulo Empleados + vínculo members | **P1** | L | T07 | HR usable |
| T10 | Unificar bootstrap tenant + billing trial server-side | **P1** | M | T03 | Signup fiable |
| T11 | Email transaccional (invites, welcome) | **P1** | M | Resend | Invites llegan |
| T12 | CI: lint, typecheck, smoke e2e login/POS | **P1** | M | — | PRs verdes |
| T13 | Sentry + alertas coste Firebase | **P1** | S | — | MTTR ↓ |
| T14 | Deploy indexes + Storage rules | **P1** | S | — | Sin errores missing index |
| T15 | Legal pages + consentimientos marketing | **P1** | S | — | Checklist venta B2B |
| T16 | Platform admin (tenants, suspend) | **P1** | L | T01 | Soporte operable |
| T17 | Paginar CRM/inventory/reports | **P2** | L | — | Tenants grandes usables |
| T18 | Agregados diarios (Functions scheduled) | **P2** | L | T17 | Reportes baratos |
| T19 | Offline POS: cola idempotente | **P2** | L | — | Sala estable sin red |
| T20 | Marketing providers reales | **P2** | L | T15 | Campañas entregadas |
| T21 | Push FCM camareros/cliente | **P2** | M | — | “Plato listo” real |
| T22 | PSP POS (SumUp o Stripe Terminal) | **P2** | XL | Hardware partner | Cobro real en mesa |
| T23 | Import CSV carta/clientes | **P2** | M | — | Time-to-value ↓ |
| T24 | i18n / multi-currency hardening | **P3** | M | — | Expansión |
| T25 | Fiscal e-invoicing | **P3** | XL | Legal | Cumplimiento ES |
| T26 | Split apps waiter/customer | **P3** | L | Bundle metrics | Performance móvil |
| T27 | Org multi-restaurant (franquicias) | **P3** | XL | T16 | Enterprise |

**Leyenda esfuerzo:** S ≤ 3 días · M 1–2 semanas · L 2–4 semanas · XL > 1 mes (1–2 ingenieros).

---

## Plan de desarrollo detallado (fases)

### Fase 0 — Freeze de narrativa (3–5 días)

**Objetivo:** dejar de vender lo que no existe.

- Inventario público de features: *Live / Beta / Simulated / Planned*.  
- UI: renombrar o feature-flag Stripe/SumUp, marketing “simulado”, dashboard mock.  
- Actualizar README y one-pager comercial.  
- Decisión de mercado inicial (España HORECA SMB) y precio (Starter/Growth).

**Exit:** mensaje comercial alineado con el binario.

---

### Fase 1 — Security & Trust Foundation (2–3 semanas) — **P0**

1. Proyecto Firebase **staging** separado.  
2. Custom claims / Admin para roles; bloquear escalada vía `users` update.  
3. Rules v2: billing/invoices solo service account; writes sensibles por rol.  
4. Proteger APIs; App Check enforced en staging.  
5. Matar local-auth fuera de desarrollo.  
6. Checklist OWASP API + revisión rules.  

**Exit:** informe de seguridad interno “apto para datos reales de beta”.

---

### Fase 2 — Commercial MVP (4–6 semanas) — **P0/P1**

1. Stripe Billing (trial 14 días ya modelado → conectarlo de verdad).  
2. Customer Portal + webhooks (`invoice.paid`, `customer.subscription.updated`).  
3. Entitlements middleware/hook `useEntitlement(feature)`.  
4. Dashboard real + empleados MVP (alta, rol, sucursal, activo).  
5. Emails: invite, welcome, trial ending.  
6. Legal mínimo + flujo de borrado de cuenta (GDPR).  
7. CI + Sentry + deploy rules/indexes.  

**Exit:** 5–10 restaurantes de diseño pagan o están en trial medido; soporte puede suspender un tenant.

---

### Fase 3 — Operations Hardening (3–4 semanas) — **P1/P2**

1. Paginación y límites en listeners costosos.  
2. Job nocturno de `dailyStats`.  
3. Offline POS: cola con idempotency keys en orders/payments.  
4. Platform admin básico.  
5. Runbooks: incidente Firestore, rotación de keys, restore.  
6. Seeds de demo + script de reset.  

**Exit:** un tenant con 12 meses de datos históricos no tumba reportes; sala degrada graceful offline.

---

### Fase 4 — Growth differentiators (6–10 semanas) — **P2**

1. Provider email/WhatsApp real en marketing.  
2. FCM notificaciones.  
3. Integración adquirente POS (elegir **uno**).  
4. Importadores y onboarding asistido.  
5. Mejoras app cliente/camareros (perf, UX QR printing).  

**Exit:** retención neta positiva en cohorte beta; NPS interno > umbral definido.

---

### Fase 5 — Scale & Enterprise (trimestre+) — **P3**

1. Data warehouse / exports.  
2. Org hierarchies (cadenas).  
3. Fiscal.  
4. SLA, SSO, contratos enterprise.  

---

## Organización recomendada

| Rol | Foco |
|-----|------|
| Tech lead / CTO | Authz, billing, arquitectura de agregados |
| Full-stack #1 | POS/offline + entitlements UX |
| Full-stack #2 | Empleados, dashboard, admin platform |
| Part-time DevOps | Firebase projects, CI, Sentry, budgets |
| Product | Narrativa Live/Beta, pricing, design partners |

Si el equipo es **1 persona**: secuencia estricta **Fase 0 → T01–T05 → T03–T04 → T08 → T12**. No abrir PSP POS ni fiscal hasta tener 10 clientes de pago.

---

## Criterios de “lanzamiento comercial” (Definition of Done)

Se puede anunciar cobro público cuando **todos** sean verdaderos:

1. [ ] Suscripción Stripe activa con webhook y plan no manipulable desde cliente  
2. [ ] Features gated por entitlement  
3. [ ] Rules + App Check + APIs autenticadas revisadas  
4. [ ] Dashboard y empleados no son mock/placeholder  
5. [ ] CI verde + Sentry en producción  
6. [ ] Términos, privacidad y proceso de soporte publicados  
7. [ ] Al menos un entorno staging con datos seed  
8. [ ] Runbook de incidente y backup verificado  
9. [ ] Messaging de pagos/marketing/offline es honesto  
10. [ ] 3 design partners usando el producto en servicio real ≥ 2 semanas  

---

## Mapa de riesgos residuales aceptables en MVP

Aceptable en v2.0 **con comunicación clara**:

- Cobro en mesa como **registro** (efectivo/tarjeta manual) sin Terminal SDK  
- Marketing con email only (sin WhatsApp)  
- Offline “best effort” (no certificación TPV)  
- IA como asistente, no como decisión autónoma  
- Un solo país / timezone por defecto  

No aceptable en v2.0:

- Planes auto-asignables  
- APIs abiertas con secretos  
- Escalada de privilegios por documento de usuario  
- Dashboard falso en demos de venta  

---

## Apéndice A — Matriz de madurez por módulo (estado actual)

| Módulo | Madurez | Notas |
|--------|---------|-------|
| Auth | Parcial | Firebase OK; local-auth peligroso; claims ausentes |
| Tenant / Settings | Parcial | UI útil; billing local |
| POS | Alto (ops) / Bajo (pagos) | Core sólido |
| Waiter | Alto | Depende de POS |
| Kitchen | Alto | |
| Inventory | Alto | |
| Customers / Loyalty | Alto | Mutaciones sensibles deberían ser server-side |
| Reservations | Medio-Alto | |
| Marketing | Medio | Dispatch simulado |
| Reports | Medio | Escala mal |
| Website | Alto | |
| Customer app | Medio-Alto | |
| AI | Medio | Proxy inseguro si se activa |
| Dashboard | Bajo | Mock |
| Employees | Nulo | Placeholder |
| Platform admin | Nulo | |
| Billing SaaS | Bajo | Sin PSP |

---

## Apéndice B — Principios de ingeniería V2

1. **Money and roles on the server.**  
2. **One tenant ID on every query; never collection-group without index + ACL.**  
3. **Feature flags > mentiras de UI.**  
4. **Measure Firestore reads like AWS bill.**  
5. **Demo data ≠ production architecture.**  
6. **Ship the boring layers (CI, authz, billing) before the next shiny module.**  

---

## Apéndice C — Próximo paso inmediato (sin código en este doc)

1. Aprobar este ROADMAP con founders (scope Fase 0–2).  
2. Congelar features nuevas fuera del camino crítico P0/P1.  
3. Abrir épicas en el tracker: `SEC`, `BILL`, `OPS`, `EMP`, `DASH`.  
4. Solo entonces iniciar implementación por T01 → T05 → T03.

---

*Fin del documento ROADMAP_V2.md — SmartServe AI CTO Review*
