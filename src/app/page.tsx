import { redirect } from "next/navigation";

// O proxy já redireciona "/" conforme a sessão; isto é só um fallback.
export default function Home() {
  redirect("/login");
}
