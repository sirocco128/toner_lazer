export default ({ env }) => {
  const minio = String(env("MINIO_ENDPOINT", "http://127.0.0.1:9000")).replace(
    /\/+$/,
    "",
  );
  const publicBase = String(env("MINIO_PUBLIC_BASE_URL", "")).replace(/\/+$/, "");
  const mediaHosts = [
    minio,
    publicBase,
    "http://minio:9000",
    "http://127.0.0.1:9000",
    "http://localhost:9000",
    "http://127.0.0.1:9020",
    "http://127.0.0.1:33920",
    "http://192.168.1.30:33920",
    "https://smartgift.next-dev.net",
    "https://tarabiz.next-dev.net",
  ].filter(Boolean);

  return [
    "strapi::logger",
    "strapi::errors",
    {
      name: "strapi::security",
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            "connect-src": ["'self'", "https:", "http:"],
            "img-src": [
              "'self'",
              "data:",
              "blob:",
              "market-assets.strapi.io",
              ...mediaHosts,
            ],
            "media-src": [
              "'self'",
              "data:",
              "blob:",
              "market-assets.strapi.io",
              ...mediaHosts,
            ],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    "strapi::cors",
    "strapi::poweredBy",
    "strapi::query",
    "strapi::body",
    "strapi::session",
    "strapi::favicon",
    "strapi::public",
  ];
};
