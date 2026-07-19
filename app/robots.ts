import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/r/"],
      disallow: [
        "/dashboard",
        "/pos",
        "/api/",
        "/settings",
        "/onboarding",
      ],
    },
  };
}
