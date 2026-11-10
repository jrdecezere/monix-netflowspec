"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { setThemeColor } from "@/lib/settings";
import { isHexColor } from "@/lib/theme";

export type ActionResult = { ok: true } | { ok: false; error: string };

const base = {
  name: z.string().trim().min(2, "Informe o nome (mín. 2 caracteres)").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido")
    .max(190),
  role: z.enum(["ADMIN", "USER", "GUEST"], { message: "Nível inválido" }),
  active: z.boolean(),
};

const passwordRule = z
  .string()
  .min(8, "A senha deve ter ao menos 8 caracteres")
  .max(72, "A senha deve ter no máximo 72 caracteres");

const createSchema = z.object({ ...base, password: passwordRule });
const updateSchema = z.object({
  ...base,
  id: z.number().int().positive(),
  // vazio = manter a senha atual
  password: z.union([z.literal(""), passwordRule]),
});

function isUniqueViolation(e: unknown) {
  return (
    typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002"
  );
}

const EMAIL_IN_USE: ActionResult = {
  ok: false,
  error: "Já existe um usuário com este e-mail",
};

export async function createUser(input: unknown): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { password, ...data } = parsed.data;

  try {
    await prisma.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return EMAIL_IN_USE;
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUser(input: unknown): Promise<ActionResult> {
  const me = await requireRole("ADMIN");

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { id, password, ...data } = parsed.data;

  if (id === me.id && (data.role !== "ADMIN" || !data.active)) {
    return {
      ok: false,
      error: "Você não pode remover seu próprio acesso de administrador",
    };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return EMAIL_IN_USE;
    if ((e as { code?: string }).code === "P2025") {
      return { ok: false, error: "Usuário não encontrado" };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateThemeColor(color: unknown): Promise<ActionResult> {
  await requireRole("ADMIN");

  if (!isHexColor(color)) {
    return { ok: false, error: "Cor inválida. Use o formato #RRGGBB" };
  }

  await setThemeColor(color.toLowerCase());

  // a cor vale para o sistema todo (inclusive a tela de login)
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteUser(id: number): Promise<ActionResult> {
  const me = await requireRole("ADMIN");

  if (!Number.isInteger(id)) return { ok: false, error: "Usuário inválido" };
  if (id === me.id) {
    return { ok: false, error: "Você não pode excluir a sua própria conta" };
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return { ok: false, error: "Usuário não encontrado" };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}
