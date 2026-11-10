import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · SOSISP" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">SOSISP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre com sua conta para continuar
          </p>
        </div>

        <div className="rounded-2xl border border-border border-t-4 border-t-primary bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
