import type { PermissionDefinition, PermissionId } from "@/types/rbac";

function p(
  id: PermissionId,
  label: string,
  description: string,
  group: string,
  scope: PermissionDefinition["scope"] = "tenant",
  dangerous = false,
): PermissionDefinition {
  const [module, ...rest] = id.split(".");
  return {
    id,
    module: module as PermissionDefinition["module"],
    action: rest.join("."),
    label,
    description,
    group,
    scope,
    dangerous,
  };
}

/** Canonical permission catalog — each entry is an independent on/off switch. */
export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Platform
  p("platform.tenants.read", "Ver tenants", "Listar restaurantes de la plataforma", "Plataforma", "platform"),
  p("platform.tenants.manage", "Gestionar tenants", "Suspender o editar cualquier restaurante", "Plataforma", "platform", true),
  p("platform.billing.manage", "Billing plataforma", "Planes y cobros globales", "Plataforma", "platform", true),
  p("platform.users.impersonate", "Impersonar usuarios", "Entrar como otro usuario (soporte)", "Plataforma", "platform", true),
  p("platform.feature_flags.manage", "Feature flags", "Activar flags globales", "Plataforma", "platform"),
  p("platform.audit.read_all", "Auditoría global", "Leer audit logs de todos los tenants", "Plataforma", "platform"),

  // Restaurant / billing / settings
  p("restaurant.read", "Ver restaurante", "Ver datos del restaurante", "Restaurante"),
  p("restaurant.update", "Editar restaurante", "Editar perfil del restaurante", "Restaurante"),
  p("billing.read", "Ver facturación SaaS", "Ver plan y facturas SmartServe", "Facturación"),
  p("billing.manage", "Gestionar facturación", "Cambiar plan, métodos de pago, cancelar", "Facturación", "tenant", true),
  p("settings.read", "Ver ajustes", "Ver configuración", "Ajustes"),
  p("settings.manage", "Gestionar ajustes", "Cambiar configuración del sistema", "Ajustes"),

  // Branches
  p("branches.read", "Ver sucursales", "Listar sucursales", "Sucursales"),
  p("branches.create", "Crear sucursales", "Añadir nuevas sucursales", "Sucursales"),
  p("branches.update", "Editar sucursales", "Editar datos de sucursal", "Sucursales"),
  p("branches.delete", "Eliminar sucursales", "Archivar o borrar sucursales", "Sucursales", "tenant", true),

  // Members / roles
  p("members.read", "Ver equipo", "Ver miembros del restaurante", "Equipo"),
  p("members.invite", "Invitar miembros", "Invitar usuarios al restaurante", "Equipo"),
  p("members.update", "Editar miembros", "Cambiar datos de miembros", "Equipo"),
  p("members.remove", "Eliminar miembros", "Revocar acceso", "Equipo", "tenant", true),
  p("roles.read", "Ver roles", "Ver roles y permisos", "Roles"),
  p("roles.manage", "Editar permisos de roles", "Activar/desactivar permisos por rol", "Roles", "tenant", true),
  p("roles.assign", "Asignar roles", "Asignar rol a un miembro", "Roles"),

  // Employees
  p("employees.read", "Ver empleados", "Listar empleados", "Empleados"),
  p("employees.manage", "Gestionar empleados", "Alta/baja y ficha de empleados", "Empleados"),
  p("employees.shifts.manage", "Gestionar turnos", "Crear y editar turnos", "Empleados"),

  // Catalog
  p("catalog.read", "Ver catálogo", "Ver productos e ingredientes", "Catálogo"),
  p("catalog.products.manage", "Gestionar productos", "CRUD productos", "Catálogo"),
  p("catalog.categories.manage", "Gestionar categorías", "CRUD categorías", "Catálogo"),
  p("catalog.ingredients.manage", "Gestionar ingredientes", "CRUD ingredientes", "Catálogo"),

  // Inventory
  p("inventory.read", "Ver inventario", "Ver stock por sucursal", "Inventario", "branch"),
  p("inventory.adjust", "Ajustar stock", "Corregir cantidades de inventario", "Inventario", "branch", true),
  p("inventory.purchases.manage", "Gestionar compras", "Órdenes de compra", "Inventario", "branch"),
  p("inventory.waste.manage", "Registrar merma", "Altas de merma", "Inventario", "branch"),
  p("inventory.suppliers.manage", "Gestionar proveedores", "CRUD proveedores", "Inventario"),

  // Tables / POS / Orders
  p("tables.read", "Ver mesas", "Ver plano de mesas", "POS", "branch"),
  p("tables.manage", "Gestionar mesas", "Crear/editar mesas", "POS", "branch"),
  p("pos.access", "Acceso POS", "Entrar al punto de venta", "POS", "branch"),
  p("pos.discount", "Aplicar descuentos", "Descuentos en POS", "POS", "branch"),
  p("pos.tip", "Gestionar propinas", "Propinas en cobro", "POS", "branch"),
  p("pos.split", "Dividir cuenta", "Split de cuenta", "POS", "branch"),
  p("pos.move_merge", "Mover/unir mesas", "Mover pedidos y unir mesas", "POS", "branch"),
  p("orders.read", "Ver pedidos", "Ver pedidos", "Pedidos", "branch"),
  p("orders.create", "Crear pedidos", "Abrir y añadir ítems", "Pedidos", "branch"),
  p("orders.update", "Editar pedidos", "Modificar pedidos abiertos", "Pedidos", "branch"),
  p("orders.cancel", "Cancelar pedidos", "Cancelar pedidos", "Pedidos", "branch", true),
  p("orders.refund", "Reembolsar pedidos", "Reembolsos totales/parciales", "Pedidos", "branch", true),
  p("payments.charge", "Cobrar", "Registrar cobros", "Pagos", "branch"),
  p("payments.refund", "Reembolsar pagos", "Devolver cobros", "Pagos", "branch", true),
  p("payments.cash_drawer", "Caja", "Apertura/cierre de caja", "Pagos", "branch"),
  p("invoices.read", "Ver facturas", "Facturas de consumo", "Facturas", "branch"),
  p("invoices.issue", "Emitir facturas", "Emitir factura fiscal", "Facturas", "branch"),
  p("invoices.void", "Anular facturas", "Anular facturas emitidas", "Facturas", "branch", true),

  // Kitchen / bar / delivery
  p("kitchen.access", "Acceso cocina", "Pantalla KDS cocina", "Cocina", "branch"),
  p("kitchen.update_status", "Estados cocina", "Cambiar estado de preparación", "Cocina", "branch"),
  p("bar.access", "Acceso barra", "Pantalla KDS barra", "Barra", "branch"),
  p("bar.update_status", "Estados barra", "Cambiar estado de bebidas", "Barra", "branch"),
  p("delivery.access", "Acceso repartos", "Ver pedidos delivery", "Delivery", "branch"),
  p("delivery.update_status", "Estados delivery", "Actualizar entrega", "Delivery", "branch"),
  p("delivery.assign", "Asignar repartos", "Asignar pedidos a repartidor", "Delivery", "branch"),

  // CRM
  p("customers.read", "Ver clientes", "Listar fichas de cliente", "Clientes"),
  p("customers.manage", "Gestionar clientes", "Crear/editar clientes", "Clientes"),
  p("loyalty.read", "Ver fidelización", "Ver puntos y tiers", "Fidelización"),
  p("loyalty.adjust", "Ajustar puntos", "Sumar/restar puntos manualmente", "Fidelización", "tenant", true),

  // Reservations
  p("reservations.read", "Ver reservas", "Ver calendario de reservas", "Reservas", "branch"),
  p("reservations.manage", "Gestionar reservas", "Crear/editar cualquier reserva", "Reservas", "branch"),
  p("reservations.manage_own", "Mis reservas", "Gestionar solo reservas propias", "Reservas"),

  // Marketing
  p("marketing.read", "Ver marketing", "Ver campañas y cupones", "Marketing"),
  p("marketing.campaigns.manage", "Gestionar campañas", "Crear/enviar campañas", "Marketing"),
  p("marketing.coupons.manage", "Gestionar cupones", "CRUD cupones", "Marketing"),

  // Reports / history / audit
  p("reports.read", "Ver reportes", "Informes y dashboard avanzado", "Reportes"),
  p("history.read", "Ver historial", "Historial operativo", "Historial"),
  p("audit.read", "Ver auditoría", "Logs de seguridad", "Auditoría"),

  // AI
  p("ai.assistant", "Asistente IA", "Usar chat IA", "IA"),
  p("ai.insights", "Ver insights IA", "Ver alertas predictivas", "IA"),
  p("ai.manage", "Configurar IA", "Ajustes y límites de IA", "IA"),

  // Notifications
  p("notifications.read", "Ver notificaciones", "Bandeja de notificaciones", "Notificaciones"),
  p("notifications.manage", "Gestionar notificaciones", "Preferencias y envíos", "Notificaciones"),

  // Website
  p("website.read", "Ver sitio web", "Ver configuración del sitio público", "Sitio web"),
  p("website.manage", "Gestionar sitio web", "Publicar, SEO, dominio, blog y eventos", "Sitio web"),
];

export const PERMISSION_IDS: PermissionId[] = PERMISSION_DEFINITIONS.map((d) => d.id);

export const PERMISSION_BY_ID: Record<PermissionId, PermissionDefinition> =
  PERMISSION_DEFINITIONS.reduce(
    (acc, def) => {
      acc[def.id] = def;
      return acc;
    },
    {} as Record<PermissionId, PermissionDefinition>,
  );

export const PLATFORM_PERMISSION_IDS: PermissionId[] = PERMISSION_DEFINITIONS.filter(
  (d) => d.scope === "platform",
).map((d) => d.id);
