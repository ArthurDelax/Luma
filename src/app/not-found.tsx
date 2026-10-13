import { href } from "@/lib/paths";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-display text-6xl font-semibold text-navy-800">404</p>
        <h1 className="mt-3 text-xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-muted">O endereço pode ter sido digitado incorretamente.</p>
        <div className="mt-6 flex justify-center gap-3">
          <a className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white" href={href("/")}>Ir para o início</a>
          <a className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold" href={href("/app/")}>Abrir a demonstração</a>
        </div>
      </div>
    </main>
  );
}
