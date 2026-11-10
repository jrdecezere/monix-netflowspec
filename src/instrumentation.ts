// Roda uma vez quando o servidor Next sobe: inicia o detector DDoS no mesmo
// processo do painel. Para rodar o detector em outro processo/container,
// defina DETECTOR_IN_PROCESS=false aqui e use `npm run detector` no outro.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DETECTOR_IN_PROCESS === "false") return;
  const { startDetector } = await import("./lib/detector/runner");
  startDetector();
}
