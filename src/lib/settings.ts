import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_THEME_COLOR, isHexColor } from "@/lib/theme";

const THEME_KEY = "themeColor";

/** Cor do layout salva no banco (ou a padrão se não houver / banco indisponível). */
export async function getThemeColor() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: THEME_KEY } });
    return row && isHexColor(row.value) ? row.value : DEFAULT_THEME_COLOR;
  } catch {
    return DEFAULT_THEME_COLOR;
  }
}

export async function setThemeColor(color: string) {
  await prisma.setting.upsert({
    where: { key: THEME_KEY },
    create: { key: THEME_KEY, value: color },
    update: { value: color },
  });
}
