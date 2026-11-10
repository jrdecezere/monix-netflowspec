"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ROLE_HOME } from "@/lib/roles";
import { encrypt, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export type LoginState = { error?: string; email?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe a senha"),
});

// Limitador simples em memória: 5 falhas por e-mail a cada 15 minutos.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isBlocked(key: string) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < Date.now()) {
    attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

// Hash descartável para manter o tempo de resposta quando o e-mail não existe.
const DUMMY_HASH = bcrypt.hashSync("senha-descartavel", 10);

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const rawEmail = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email: rawEmail };
  }
  const { email, password } = parsed.data;

  if (isBlocked(email)) {
    return {
      error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      email,
    };
  }

  if (!process.env.SESSION_SECRET) {
    console.error("[login] SESSION_SECRET não está definido no ambiente");
    return {
      error: "Servidor mal configurado: defina SESSION_SECRET (veja /api/health).",
      email,
    };
  }

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email } });
  } catch (e) {
    console.error("[login] falha ao consultar o banco:", e);
    return {
      error: "Não foi possível acessar o banco de dados (veja /api/health).",
      email,
    };
  }
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    registerFailure(email);
    return { error: "E-mail ou senha incorretos", email };
  }
  if (!user.active) {
    return { error: "Este usuário está desativado", email };
  }

  attempts.delete(email);

  const token = await encrypt({ userId: user.id, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Em produção o cookie exige HTTPS. Para testar por HTTP puro (IP:porta),
    // defina SESSION_COOKIE_SECURE=false.
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.SESSION_COOKIE_SECURE !== "false",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect(ROLE_HOME[user.role]);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
