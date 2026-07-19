export type ManagerIntent =
  | "purchase"
  | "top_product"
  | "sales_drop"
  | "promotions"
  | "employee_training"
  | "churn_customers"
  | "briefing"
  | "general";

const RULES: Array<{ intent: ManagerIntent; patterns: RegExp[] }> = [
  {
    intent: "purchase",
    patterns: [
      /comprar/,
      /pedido\s+a\s+proveedor/,
      /qu[eé]\s+debo\s+comprar/,
      /reponer/,
      /stock\s+bajo/,
      /inventario/,
      /falta\s+de\s+insumo/,
    ],
  },
  {
    intent: "top_product",
    patterns: [
      /vender[aá]\s+m[aá]s/,
      /producto\s+m[aá]s/,
      /best\s*seller/,
      /tendencia/,
      /pron[oó]stico\s+de\s+venta/,
      /qu[eé]\s+producto/,
    ],
  },
  {
    intent: "sales_drop",
    patterns: [
      /bajaron\s+las\s+ventas/,
      /ca[ií]da\s+de\s+ventas/,
      /por\s+qu[eé].*ventas/,
      /ventas\s+bajan/,
      /menos\s+ingresos/,
      /anomal[ií]a/,
    ],
  },
  {
    intent: "promotions",
    patterns: [
      /promoci[oó]n/,
      /promo/,
      /cup[oó]n/,
      /oferta/,
      /campa[nñ]a/,
      /descuento/,
    ],
  },
  {
    intent: "employee_training",
    patterns: [
      /capacitaci[oó]n/,
      /formar/,
      /entrenar/,
      /empleado/,
      /personal/,
      /rendimiento/,
      /staff/,
    ],
  },
  {
    intent: "churn_customers",
    patterns: [
      /dejaron\s+de\s+venir/,
      /clientes?\s+inactiv/,
      /churn/,
      /no\s+vuelven/,
      /perdiendo\s+clientes/,
      /dormant/,
      /en\s+riesgo/,
    ],
  },
  {
    intent: "briefing",
    patterns: [
      /resumen/,
      /briefing/,
      /c[oó]mo\s+vamos/,
      /estado\s+del\s+negocio/,
      /qu[eé]\s+debo\s+hacer/,
      /prioridad/,
      /hoy/,
    ],
  },
];

export function classifyIntent(message: string): ManagerIntent {
  const text = message.toLowerCase().normalize("NFC");
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent;
  }
  return "general";
}

export const SUGGESTED_QUESTIONS: Array<{
  intent: ManagerIntent;
  label: string;
}> = [
  { intent: "purchase", label: "¿Qué debo comprar mañana?" },
  { intent: "top_product", label: "¿Qué producto venderá más?" },
  { intent: "sales_drop", label: "¿Por qué bajaron las ventas?" },
  { intent: "promotions", label: "¿Qué promociones debo lanzar?" },
  { intent: "employee_training", label: "¿Qué empleado necesita capacitación?" },
  { intent: "churn_customers", label: "¿Qué clientes dejaron de venir?" },
  { intent: "briefing", label: "Dame un briefing de gerente para hoy" },
];
