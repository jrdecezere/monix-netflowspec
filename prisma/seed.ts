import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const url = new URL(process.env.DATABASE_URL!);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  }),
});

const demoUsers = [
  { name: "Administrador", email: "admin@sosisp.local", password: "Admin@123", role: "ADMIN" },
  { name: "Usuário Demo", email: "usuario@sosisp.local", password: "Usuario@123", role: "USER" },
  { name: "Convidado Demo", email: "convidado@sosisp.local", password: "Convidado@123", role: "GUEST" },
] as const;

async function main() {
  // Produção: cria o administrador inicial a partir de variáveis de ambiente.
  // Só cria se o e-mail ainda não existe (não sobrescreve senha de quem já existe).
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 8) {
      throw new Error("ADMIN_PASSWORD precisa ter ao menos 8 caracteres");
    }
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: process.env.ADMIN_NAME?.trim() || "Administrador",
        email: adminEmail,
        role: "ADMIN",
        passwordHash: await bcrypt.hash(adminPassword, 10),
      },
    });
    console.log(`Administrador garantido: ${adminEmail}`);
  }

  // Desenvolvimento: contas de demonstração (nunca em produção).
  if (process.env.SEED_DEMO === "true") {
    for (const u of demoUsers) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          name: u.name,
          email: u.email,
          role: u.role,
          passwordHash: await bcrypt.hash(u.password, 10),
        },
      });
    }
    console.log("Usuários de demonstração criados.");
  }

  if (!adminEmail && process.env.SEED_DEMO !== "true") {
    const count = await prisma.user.count();
    if (count === 0) {
      console.warn(
        "Nenhum usuário existe. Defina ADMIN_EMAIL e ADMIN_PASSWORD (ou SEED_DEMO=true em desenvolvimento).",
      );
    }
  }
}

main().finally(() => prisma.$disconnect());
