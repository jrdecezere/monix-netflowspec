import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Dockerfile define NEXT_STANDALONE=true para gerar .next/standalone
  // (imagem enxuta, node server.js). Nos demais casos (npm run dev, Nixpacks
  // do Dokploy com `next start`) o build e normal.
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined,
  // As paginas dependem de sessao (cookies) em toda requisicao, entao nao
  // usamos Cache Components/prefetch parcial aqui.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
