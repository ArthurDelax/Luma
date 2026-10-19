import type { ReactNode } from "react";
import { href } from "@/lib/paths";

export const LEGAL_UPDATED = "18 de outubro de 2026";

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
      <p className="text-sm text-muted">Atualizado em {LEGAL_UPDATED}</p>
      <h1 className="mt-2 font-display text-[2.4rem] font-bold leading-tight tracking-[-0.03em] sm:text-[3.2rem]">{title}</h1>
      <div className="mt-5 text-lg leading-relaxed text-ink/75">{intro}</div>
      <div className="legal mt-10 space-y-9 text-[15.5px] leading-relaxed text-ink/80 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
      <p className="mt-14 rounded-2xl bg-white p-5 text-sm text-muted ring-1 ring-line">
        Dúvidas sobre este documento? Fale com a gente pelo WhatsApp informado no site. Veja também os{" "}
        <a className="font-semibold text-ink underline" href={href("/termos/")}>Termos de uso</a> e a{" "}
        <a className="font-semibold text-ink underline" href={href("/privacidade/")}>Política de privacidade</a>.
      </p>
    </article>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2>
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
