/** Funções puras de tema (podem ser usadas no servidor e no cliente). */

export const DEFAULT_THEME_COLOR = "#474787";

export const THEME_PRESETS = [
  { label: "Roxo", value: "#474787" },
  { label: "Azul", value: "#1d4ed8" },
  { label: "Verde", value: "#15803d" },
  { label: "Vermelho", value: "#b91c1c" },
  { label: "Laranja", value: "#c2410c" },
  { label: "Grafite", value: "#334155" },
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

/** Cor do texto (branco ou quase preto) com melhor contraste sobre `hex`. */
export function readableForeground(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? "#111827" : "#ffffff";
}

/** Variáveis CSS que o layout raiz aplica no <html>. */
export function themeVars(hex: string): Record<string, string> {
  const color = isHexColor(hex) ? hex.toLowerCase() : DEFAULT_THEME_COLOR;
  const foreground = readableForeground(color);
  return {
    "--primary": color,
    "--primary-foreground": foreground,
    "--ring": color,
    "--sidebar-primary": color,
    "--sidebar-primary-foreground": foreground,
    "--sidebar-ring": color,
  };
}
