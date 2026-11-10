// Execução real da limpeza no MySQL (ver retention.ts).
import { prisma } from "../db-core";
import { FLOW_TABLES, type DeleteBatch } from "./retention";

/** Apaga até `limit` linhas com mais de `hours` horas. Tabela e horas são validadas aqui. */
export const deleteFlowBatch: DeleteBatch = async (table, hours, limit) => {
  if (!FLOW_TABLES.includes(table)) throw new Error(`tabela não permitida: ${table}`);
  const h = Math.floor(hours);
  const l = Math.floor(limit);
  if (!Number.isFinite(h) || h < 1 || !Number.isFinite(l) || l < 1) {
    throw new Error("parâmetros inválidos para a limpeza");
  }
  // Valores numéricos validados acima; o nome da tabela vem de uma lista fixa.
  return prisma.$executeRawUnsafe(
    `DELETE FROM \`${table}\` WHERE stamp_inserted < NOW() - INTERVAL ${h} HOUR LIMIT ${l}`,
  );
};
