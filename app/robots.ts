import type { MetadataRoute } from "next";
import { aiTrainingRobotsRule } from "@/lib/scrape-guard";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const sitemap = `${site.url.replace(/\/$/, "")}/sitemap.xml`;
  const aiRule = aiTrainingRobotsRule();

  if (!site.allowIndexing) {
    return {
      rules: [aiRule, { userAgent: "*", disallow: "/" }],
      sitemap,
    };
  }

  return {
    rules: [
      aiRule,
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/ops/", "/orders/", "/account", "/issues"],
      },
    ],
    sitemap,
    host: site.url.replace(/\/$/, ""),
  };
}
