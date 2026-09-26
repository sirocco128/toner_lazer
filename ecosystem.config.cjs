/**
 * PM2 ecosystem — runbook §29
 * Prefer WEB_CONCURRENCY=1 with SQLite; do not multi-host share SQLite.
 */
module.exports = {
  apps: [
    {
      name: "premium-giftset-web",
      script: ".next/standalone/server.js",
      instances: Number(process.env.WEB_CONCURRENCY || 1),
      exec_mode: "cluster",
      autorestart: true,
      max_memory_restart: "750M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
        HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
      },
    },
  ],
};
