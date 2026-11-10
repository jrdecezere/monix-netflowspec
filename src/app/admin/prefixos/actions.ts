"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { parseCidr } from "@/lib/detector/ip";

export type ActionResult = { ok: true } | { ok: false; error: string };

const optionalNumber = (max: number) =>
  z.number().min(0, "Limite inválido").max(max, "Limite alto demais").nullable();

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome (mín. 2 caracteres)").max(120),
  cidr: z.string().trim().max(18),
  ignore: z.boolean(),
  /** vazio (null) = usar o limite global */
  bpsMbps: optionalNumber(10_000_000),
  pps: optionalNumber(10_000_000_000),
  synPps: optionalNumber(10_000_000_000),
});
const updateSchema = schema.extend({ id: z.number().int().positive() });

function toData(v: z.infer<typeof schema>) {
  const range = parseCidr(v.cidr);
  if (!range) return null;
  return {
    name: v.name,
    cidr: range.cidr,
    ignore: v.ignore,
    bpsLimit: v.bpsMbps === null ? null : Math.round(v.bpsMbps * 1e6),
    ppsLimit: v.pps === null ? null : Math.round(v.pps),
    synPpsLimit: v.synPps === null ? null : Math.round(v.synPps),
  };
}

const BAD_CIDR: ActionResult = {
  ok: false,
  error: "Prefixo inválido. Use IPv4/máscara, ex.: 203.0.113.0/24 (máscara de 1 a 32)",
};
const DUP: ActionResult = { ok: false, error: "Este prefixo já está cadastrado" };

const code = (e: unknown) => (e as { code?: string })?.code;

export async function createPrefix(input: unknown): Promise<ActionResult> {
  await requireRole("ADMIN");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = toData(parsed.data);
  if (!data) return BAD_CIDR;
  try {
    await prisma.prefix.create({ data });
  } catch (e) {
    if (code(e) === "P2002") return DUP;
    throw e;
  }
  revalidatePath("/admin/prefixos");
  return { ok: true };
}

export async function updatePrefix(input: unknown): Promise<ActionResult> {
  await requireRole("ADMIN");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = toData(parsed.data);
  if (!data) return BAD_CIDR;
  try {
    await prisma.prefix.update({ where: { id: parsed.data.id }, data });
  } catch (e) {
    if (code(e) === "P2002") return DUP;
    if (code(e) === "P2025") return { ok: false, error: "Prefixo não encontrado" };
    throw e;
  }
  revalidatePath("/admin/prefixos");
  return { ok: true };
}

export async function deletePrefix(id: number): Promise<ActionResult> {
  await requireRole("ADMIN");
  if (!Number.isInteger(id)) return { ok: false, error: "Prefixo inválido" };
  try {
    await prisma.prefix.delete({ where: { id } });
  } catch (e) {
    if (code(e) === "P2025") return { ok: false, error: "Prefixo não encontrado" };
    throw e;
  }
  revalidatePath("/admin/prefixos");
  return { ok: true };
}
