import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import type { CSSProperties } from "react";
import { Toaster } from "@/components/ui/sonner";
import { getThemeColor } from "@/lib/settings";
import { themeVars } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SOSISP",
  description: "Sistema com controle de acesso por nível",
};

// A cor do tema vem do banco e toda página depende de sessão: nada é
// pré-renderizado no build (que roda sem banco, por exemplo no Docker).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const themeColor = await getThemeColor();

  return (
    <html
      lang="pt-BR"
      style={themeVars(themeColor) as CSSProperties}
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-foreground">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
