// Roda o detector fora do Next (desenvolvimento ou container separado):
//   npm run detector
// No servidor Next (instrumentation) defina DETECTOR_IN_PROCESS=false para não duplicar.
import "dotenv/config";
import { startDetector } from "../src/lib/detector/runner";

startDetector();
// os timers do detector são "unref": este mantém o processo vivo
setInterval(() => undefined, 1 << 30);
