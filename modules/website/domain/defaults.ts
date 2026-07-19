import { nowIso } from "@/modules/website/domain/ids";
import {
  DEFAULT_WEBSITE_SECTIONS,
  type WebsiteSettings,
} from "@/types/website";

export function defaultWebsiteSettings(
  restaurantId: string,
  restaurantName: string,
): WebsiteSettings {
  const stamp = nowIso();
  return {
    id: "default",
    restaurantId,
    published: true,
    tagline: `Bienvenido a ${restaurantName}`,
    about: `${restaurantName}: cocina, ambiente y reserva online.`,
    sections: { ...DEFAULT_WEBSITE_SECTIONS },
    seo: {
      title: `${restaurantName} | Carta, reservas y pedidos`,
      description: `Descubre el menú de ${restaurantName}, reserva mesa, pide online y consulta promociones y eventos.`,
      keywords: [restaurantName, "restaurante", "carta", "reservas"],
    },
    orderSettings: {
      enabled: true,
      takeawayEnabled: true,
      deliveryEnabled: false,
    },
    reservationSettings: {
      enabled: true,
      defaultPartySize: 2,
    },
    customDomain: null,
    domainStatus: "none",
    createdAt: stamp,
    updatedAt: stamp,
  };
}
