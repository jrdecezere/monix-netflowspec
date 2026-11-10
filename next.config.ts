import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone: imagem Docker enxuta (node server.js).
  output: "standalone",
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
