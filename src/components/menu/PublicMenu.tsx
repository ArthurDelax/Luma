"use client";

import { Bricolage_Grotesque } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatBRL } from "@/lib/format";
import {
  allItems,
  buildOrderMessage,
  cartCount,
  cartSubtotal,
  couponDiscount,
  deliveryFee,
  findCoupon,
  isValidWhatsapp,
  lineSignature,
  minZoneFee,
  missingRequired,
  openStatus,
  orderTotal,
  parseChange,
  unitPrice,
  WEEKDAYS,
  whatsappOrderUrl,
  type CartLine,
  type ChosenOption,
  type Customer,
  type OrderMode,
} from "@/lib/menu/logic";
import type { MenuData, MenuItem, OptionGroup } from "@/lib/menu/types";
import { href } from "@/lib/paths";
import "./public-menu.css";

const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], weight: ["500", "700", "800"], variable: "--font-bricolage", display: "swap" });

const brl = (v: number) => formatBRL(v);

/* ------------------------------------------------------------------ */
/* Ícones                                                               */
/* ------------------------------------------------------------------ */

const P: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  bag: (
    <>
      <path d="M6 7h12l-1 13H7z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  share: (
    <>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  moto: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M9 17h6l-2-7H9" />
      <path d="M15 10h3l3 5" />
      <path d="M5 10h4" />
    </>
  ),
  shop: (
    <>
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M4 9v11h16V9" />
      <path d="M3 9h18" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  back: <path d="M15 18l-6-6 6-6" />,
  check: <path d="M20 6L9 17l-5-5" />,
  pix: (
    <>
      <path d="M12 3l9 9-9 9-9-9z" />
      <path d="M8 12l4-4 4 4-4 4z" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
};

function I({ n, className, style }: { n: keyof typeof P; className?: string; style?: CSSProperties }) {
  return (
    <svg className={className ?? "i"} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {P[n]}
    </svg>
  );
}

const Star = () => (
  <svg className="i star" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z" />
  </svg>
);

const WaIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2s.2-1.1.1-1.2-.2-.1-.4-.2z" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Utilitários                                                          */
/* ------------------------------------------------------------------ */

const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = window.localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      window.localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* sem armazenamento: segue sem lembrar */
    }
  },
};

const initials = (s: string) =>
  s
    .replace(/&/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "•";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function maskPhone(v: string) {
  v = v.replace(/\D/g, "").slice(0, 11);
  if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
  if (v.length > 6) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  if (v.length > 2) return v.replace(/(\d{2})(\d{0,5})/, "($1) $2");
  return v ? `(${v}` : v;
}

function Img({ src, alt, name, className }: { src?: string; alt: string; name: string; className?: string }) {
  const [ok, setOk] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="noimg">{initials(name)}</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`lz ${ok ? "ok" : ""} ${className ?? ""}`}
      onLoad={(e) => {
        setOk(true);
        e.currentTarget.parentElement?.classList.add("loaded");
      }}
      onError={() => setFailed(true)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Componente                                                           */
/* ------------------------------------------------------------------ */

interface Draft {
  item: MenuItem;
  qty: number;
  sel: Record<string, number[]>;
  note: string;
  editKey: string | null;
}

type View = "cart" | "checkout" | "done";

export function PublicMenu({ menu, slug, notice }: { menu: MenuData; slug: string; notice?: ReactNode }) {
  const s = menu.store;
  const groupsById = useMemo(() => new Map(menu.groups.map((g) => [g.id, g])), [menu.groups]);
  const items = useMemo(() => allItems(menu), [menu]);
  const byId = useCallback((id: string) => items.find((i) => i.id === id), [items]);
  const sections = useMemo(() => menu.categories.filter((c) => c.items.length > 0), [menu.categories]);
  const featured = useMemo(() => items.filter((i) => i.featured && i.available).slice(0, 6), [items]);

  const defaultMode: OrderMode = s.delivery.enabled ? "delivery" : "pickup";
  const cartKey = `luma:cart:${slug}`;
  const [mode, setModeState] = useState<OrderMode>(defaultMode);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer>({ name: "", phone: "" });
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const saved = store.get<{ mode?: OrderMode; cart?: CartLine[]; coupon?: string | null }>(cartKey, {});
    const valid = (saved.cart ?? []).filter((l) => items.some((i) => i.id === l.itemId && i.available));
    setCart(valid);
    if (saved.mode && (saved.mode === "delivery" ? s.delivery.enabled : s.pickup.enabled)) setModeState(saved.mode);
    setCouponCode(saved.coupon ?? null);
    setCustomer(store.get<Customer>("luma:customer", { name: "", phone: "" }));
    setNow(new Date());
    setHydrated(true);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [cartKey, items, s.delivery.enabled, s.pickup.enabled]);

  useEffect(() => {
    if (hydrated) store.set(cartKey, { mode, cart, coupon: couponCode });
  }, [hydrated, cartKey, mode, cart, couponCode]);

  const status = useMemo(() => (now ? openStatus(s.hours, now) : { open: true, label: "" }), [now, s.hours]);
  const coupon = findCoupon(menu.coupons, couponCode);
  const sub = cartSubtotal(cart);
  const disc = couponDiscount(coupon, sub);
  const fee = deliveryFee(s, mode, customer.zoneId, sub);
  const total = orderTotal(sub, disc, fee);
  const count = cartCount(cart);

  /* ---------- toast ---------- */
  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((m: string) => {
    setToastMsg(m);
    setToastOn(true);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastOn(false), 2200);
  }, []);

  const setMode = (m: OrderMode, silent = false) => {
    if (m === mode) return;
    setModeState(m);
    if (!silent) toast(m === "delivery" ? "Modo entrega selecionado" : "Modo retirada selecionado");
  };

  /* ---------- rolagem: topo, barra de categorias, revelar, scrollspy ---------- */
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [solid, setSolid] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(featured.length ? "dest" : (sections[0]?.id ?? ""));
  const spyLock = useRef(false);

  useEffect(() => {
    const on = () => {
      setSolid(window.scrollY > (heroRef.current?.offsetHeight ?? 400) - 80);
      setStuck((navRef.current?.getBoundingClientRect().top ?? 999) <= 66);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const nq = norm(q.trim());
  const visible = useCallback((i: MenuItem) => !nq || norm(`${i.name} ${i.description}`).includes(nq), [nq]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("vis");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    root.querySelectorAll(".rv:not(.vis)").forEach((el) => io.observe(el));
    const spy = new IntersectionObserver(
      (es) => {
        if (spyLock.current) return;
        es.forEach((e) => e.isIntersecting && setActiveCat((e.target as HTMLElement).dataset.cat ?? ""));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    root.querySelectorAll(".sec").forEach((el) => spy.observe(el));
    return () => {
      io.disconnect();
      spy.disconnect();
    };
  }, [nq, sections.length, featured.length]);

  useEffect(() => {
    const box = chipsRef.current;
    const on = box?.querySelector<HTMLElement>(`[data-go="${activeCat}"]`);
    if (box && on) box.scrollTo({ left: on.offsetLeft - box.clientWidth / 2 + on.clientWidth / 2, behavior: "smooth" });
  }, [activeCat]);

  const goCat = (id: string) => {
    setActiveCat(id);
    spyLock.current = true;
    const sec = document.getElementById(`sec-${id}`);
    if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 136, behavior: "smooth" });
    setTimeout(() => (spyLock.current = false), 900);
  };

  /* ---------- vídeos do topo ---------- */
  const vidA = useRef<HTMLVideoElement>(null);
  const vidB = useRef<HTMLVideoElement>(null);
  const [reel, setReel] = useState<{ k: number; shown: boolean }>({ k: 0, shown: false });
  const clips = s.heroClips;
  useEffect(() => {
    if (!clips.length) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const vids = [vidA.current!, vidB.current!];
    const n = clips.length;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visibleHero = true;
    let pending: number | null = null;
    let started = false;
    let alive = true;
    const prep = (v: HTMLVideoElement, k: number) => {
      const c = clips[k % n];
      v.preload = "auto";
      v.src = `${c.url}#t=${c.start}`;
      v.load();
    };
    const show = (k: number) => {
      const c = clips[k % n];
      const v = vids[k % 2];
      const o = vids[(k + 1) % 2];
      if (!v.getAttribute("src")) prep(v, k);
      v.play()
        .then(() => {
          if (!alive) return;
          started = true;
          v.classList.add("on");
          o.classList.remove("on");
          setReel({ k: k % n, shown: true });
          setTimeout(() => {
            o.pause();
            if (n > 1) prep(o, k + 1);
          }, 1500);
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (n === 1) {
              v.currentTime = c.start;
              return show(k);
            }
            if (visibleHero) show(k + 1);
            else pending = k + 1;
          }, c.len * 1000);
        })
        .catch(() => {}); // autoplay bloqueado: fica a foto
    };
    const io = new IntersectionObserver(([e]) => {
      visibleHero = e.isIntersecting;
      const cur = vids.find((v) => v.classList.contains("on"));
      if (!visibleHero) cur?.pause();
      else if (started) {
        if (pending !== null) {
          const k = pending;
          pending = null;
          show(k);
        } else cur?.play().catch(() => {});
      }
    });
    if (heroRef.current) io.observe(heroRef.current);
    prep(vids[0], 0);
    const onCan = () => !started && show(0);
    vids[0].addEventListener("canplay", onCan, { once: true });
    return () => {
      alive = false;
      clearTimeout(timer);
      io.disconnect();
      vids.forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.classList.remove("on");
      });
    };
  }, [clips]);

  /* ---------- janelas ---------- */
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pmOpen, setPmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<View>("cart");
  const overlay = pmOpen || drawerOpen;

  useEffect(() => {
    document.body.style.overflow = overlay ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [overlay]);

  const closeAll = useCallback(() => {
    setPmOpen(false);
    setDrawerOpen(false);
    setView((v) => (v === "done" ? "cart" : v));
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [closeAll]);

  const openProduct = (item: MenuItem, line?: CartLine) => {
    if (!item.available) return;
    const sel: Record<string, number[]> = {};
    item.groupIds.forEach((g) => (sel[g] = []));
    if (line)
      line.opts.forEach((o) => {
        const g = groupsById.get(o.groupId);
        const gi = g?.options.findIndex((x) => x.name === o.name) ?? -1;
        if (gi > -1) sel[o.groupId] = [...(sel[o.groupId] ?? []), gi];
      });
    setDraft({ item, qty: line ? line.qty : 1, sel, note: line ? line.note : "", editKey: line ? line.key : null });
    setDrawerOpen(false);
    setPmOpen(true);
    requestAnimationFrame(() => pmBodyRef.current?.scrollTo({ top: 0 }));
  };

  /* ---------- produto ---------- */
  const pmBodyRef = useRef<HTMLDivElement>(null);
  const pmImgWrap = useRef<HTMLDivElement>(null);
  const cartTopRef = useRef<HTMLButtonElement>(null);
  const fabIcRef = useRef<HTMLSpanElement>(null);
  const [shakeGroup, setShakeGroup] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  const itemGroups = (item: MenuItem): OptionGroup[] => item.groupIds.map((g) => groupsById.get(g)).filter((g): g is OptionGroup => !!g);

  const draftOpts = (d: Draft): ChosenOption[] => {
    const out: ChosenOption[] = [];
    for (const g of itemGroups(d.item)) {
      for (const i of [...(d.sel[g.id] ?? [])].sort((a, b) => a - b)) {
        const o = g.options[i];
        if (o) out.push({ groupId: g.id, name: o.name, price: o.price });
      }
    }
    return out;
  };

  const toggleOpt = (g: OptionGroup, i: number, checked: boolean) => {
    setDraft((d) => {
      if (!d) return d;
      const cur = d.sel[g.id] ?? [];
      const next = g.type === "single" ? [i] : checked ? (g.max && cur.length >= g.max ? cur : [...cur, i]) : cur.filter((x) => x !== i);
      return { ...d, sel: { ...d.sel, [g.id]: next } };
    });
  };

  const fly = () => {
    const img = pmImgWrap.current?.querySelector("img");
    const target = window.innerWidth >= 768 ? cartTopRef.current : fabIcRef.current;
    if (!img || !target) return;
    const a = img.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const f = document.createElement("img");
    f.src = img.currentSrc || img.src;
    f.className = "cm-flyer";
    const sz = 90;
    Object.assign(f.style, { width: `${sz}px`, height: `${sz}px`, left: `${a.left + a.width / 2 - sz / 2}px`, top: `${a.top + a.height / 2 - sz / 2}px` });
    document.body.appendChild(f);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    f.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 120}px) scale(.7)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px,${dy}px) scale(.18)`, opacity: 0.6 },
      ],
      { duration: 750, easing: "cubic-bezier(.5,0,.3,1)" },
    ).onfinish = () => f.remove();
  };

  const addDraft = () => {
    if (!draft) return;
    const groups = itemGroups(draft.item);
    const miss = missingRequired(groups, draft.sel);
    if (miss) {
      setShakeGroup(null);
      requestAnimationFrame(() => setShakeGroup(miss));
      const box = pmBodyRef.current?.querySelector<HTMLElement>(`[data-g="${miss}"]`);
      const body = pmBodyRef.current;
      if (box && body) body.scrollTo({ top: box.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - body.clientHeight / 3, behavior: "smooth" });
      return;
    }
    const opts = draftOpts(draft);
    const note = draft.note.trim();
    const unit = unitPrice(draft.item, opts);
    const sig = lineSignature(draft.item.id, opts, note);
    if (draft.editKey) {
      setCart((c) => c.map((l) => (l.key === draft.editKey ? { ...l, qty: draft.qty, opts, note, unit } : l)));
      setPmOpen(false);
      setView("cart");
      setDrawerOpen(true);
      return;
    }
    setCart((c) => {
      const ex = c.find((l) => lineSignature(l.itemId, l.opts, l.note) === sig);
      if (ex) return c.map((l) => (l === ex ? { ...l, qty: l.qty + draft.qty } : l));
      return [...c, { key: Math.random().toString(36).slice(2, 10), itemId: draft.item.id, qty: draft.qty, opts, note, unit }];
    });
    fly();
    const n = draft.qty;
    const nm = draft.item.name;
    setPmOpen(false);
    setTimeout(() => {
      setBump((b) => b + 1);
      toast(`${n}x ${nm} na sacola`);
    }, 520);
  };

  const changeQty = (key: string, d: number) => setCart((c) => c.flatMap((l) => (l.key !== key ? [l] : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])));

  /* ---------- checkout ---------- */
  const [errs, setErrs] = useState<string[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ code: string; url: string; total: number; sent: boolean } | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponShake, setCouponShake] = useState(false);
  const drBodyRef = useRef<HTMLDivElement>(null);

  const setCust = (patch: Partial<Customer>) => {
    setCustomer((c) => {
      const next = { ...c, ...patch };
      store.set("luma:customer", next);
      return next;
    });
    setErrs((e) => e.filter((k) => !Object.keys(patch).includes(k)));
  };

  const lookupCep = async (cep: string) => {
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep.replace("-", "")}/json/`);
      const d = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string };
      if (!d.erro) {
        const z = s.delivery.zones.find((x) => norm(x.name) === norm(d.bairro ?? ""));
        setCust({ ...(d.logradouro ? { street: d.logradouro } : {}), ...(z ? { zoneId: z.id } : {}) });
      }
    } catch {
      /* sem internet ou bloqueado: o cliente digita */
    }
    setCepLoading(false);
  };

  const applyCoupon = () => {
    if (findCoupon(menu.coupons, couponInput)) {
      setCouponCode(couponInput.trim().toUpperCase());
      setCouponInput("");
      toast("Cupom aplicado");
    } else {
      setCouponShake(false);
      requestAnimationFrame(() => setCouponShake(true));
      toast("Cupom inválido");
    }
  };

  const canOrderNow = status.open || s.acceptWhenClosed;
  const storeReady = isValidWhatsapp(s.whatsapp);

  const submit = () => {
    const c = customer;
    const e: string[] = [];
    if (!c.name || c.name.trim().length < 2) e.push("name");
    if (!c.phone || c.phone.replace(/\D/g, "").length < 10) e.push("phone");
    if (mode === "delivery") {
      if (s.delivery.zones.length && !c.zoneId) e.push("zoneId");
      if (!c.street?.trim()) e.push("street");
      if (!c.number?.trim()) e.push("number");
    }
    const pays = payOptions();
    if (!c.pay || !pays.some((p) => p[0] === c.pay)) e.push("pay");
    const ch = parseChange(c.change);
    if (c.pay === "Dinheiro" && ch && ch < total) e.push("change");
    setErrs(e);
    if (e.length) {
      const first = drBodyRef.current?.querySelector<HTMLElement>(`[data-f="${e[0]}"]`);
      const body = drBodyRef.current;
      if (first && body) body.scrollTo({ top: first.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - body.clientHeight / 3, behavior: "smooth" });
      toast("Confira os campos destacados");
      return;
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const msg = buildOrderMessage(menu, { code, mode, customer: c, lines: cart, coupon });
    setLastOrder({ code, url: whatsappOrderUrl(s.whatsapp, msg), total, sent: false });
    setView("done");
  };

  const payOptions = (): [NonNullable<Customer["pay"]>, ReactNode][] =>
    [
      ["Pix", <I key="p" n="pix" />, s.payments.pix],
      ["Cartão", <I key="c" n="card" />, s.payments.card],
      ["Dinheiro", <I key="d" n="cash" />, s.payments.cash],
    ]
      .filter((p) => p[2])
      .map((p) => [p[0] as NonNullable<Customer["pay"]>, p[1] as ReactNode]);

  const share = async () => {
    const data = { title: s.name, text: `Cardápio da ${s.name}`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast("Link copiado");
      }
    } catch {
      /* cancelado */
    }
  };

  const qtyByItem = useMemo(() => {
    const m: Record<string, number> = {};
    cart.forEach((l) => (m[l.itemId] = (m[l.itemId] ?? 0) + l.qty));
    return m;
  }, [cart]);

  const minFee = minZoneFee(s);
  const below = s.minOrder > 0 && sub < s.minOrder;
  const today = now?.getDay() ?? -1;
  const anyVisible = sections.some((c) => c.items.some(visible));
  const accentStyle = { "--accent": /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : "#de3f1c" } as CSSProperties;
  const bothModes = s.delivery.enabled && s.pickup.enabled;

  /* ---------- render ---------- */
  return (
    <div ref={rootRef} className={`cm ${display.variable}`} style={accentStyle}>
      <header className={`topbar ${solid ? "solid" : ""}`}>
        <div className="wrap">
          <a className="brand" href="#top">
            <span className="brand-mark">{s.logoUrl ? <img src={s.logoUrl} alt="" /> : initials(s.name)}</span>
            <span>{s.name}</span>
          </a>
          <div className="sp" />
          <button className="icon-btn" onClick={share} aria-label="Compartilhar cardápio">
            <I n="share" />
          </button>
          <button
            ref={cartTopRef}
            className="cart-top"
            onClick={() => {
              setView("cart");
              setDrawerOpen(true);
            }}
          >
            <I n="bag" />
            Sacola{" "}
            <span key={bump} className={`badge ${bump ? "bump" : ""}`}>
              {count}
            </span>
          </button>
        </div>
      </header>

      <section className="hero" id="top" ref={heroRef}>
        {s.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.coverUrl} alt="" />
        ) : (
          <div className="noimg" />
        )}
        {clips.length > 0 && (
          <>
            <video ref={vidA} muted playsInline preload="auto" aria-hidden="true" />
            <video ref={vidB} muted playsInline preload="none" aria-hidden="true" />
            <div className={`reel ${reel.shown ? "show" : ""}`} aria-hidden="true">
              <div className="reel-bars">
                {clips.map((c, i) => (
                  <i key={`${i}-${reel.k}`} className={i < reel.k ? "done" : i === reel.k && reel.shown ? "run" : ""} style={{ "--d": `${c.len}s` } as CSSProperties} />
                ))}
              </div>
              <div className="reel-lbl">
                <span>{String(reel.k + 1).padStart(2, "0")}</span>
                <b key={reel.k} className="in-up">
                  {clips[reel.k]?.label}
                </b>
              </div>
            </div>
          </>
        )}
        <div className="hero-copy wrap">
          {s.tagline && <div className="eyebrow in-up">{s.tagline}</div>}
          <h1 className="in-up" style={{ animationDelay: ".12s" }}>
            {s.headline || s.name}
          </h1>
          {s.description && (
            <p className="in-up" style={{ animationDelay: ".24s" }}>
              {s.description}
            </p>
          )}
        </div>
      </section>

      <section className="store wrap">
        <div className="store-card in-up" style={{ animationDelay: ".35s" }}>
          <div className="store-head">
            <div className="logo">{s.logoUrl ? <img src={s.logoUrl} alt={`Logo ${s.name}`} /> : initials(s.name)}</div>
            <div style={{ minWidth: 0 }}>
              <h2>{s.name}</h2>
              <div className="meta">
                {s.rating && s.rating.value > 0 && (
                  <span>
                    <Star />
                    <b>{s.rating.value.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}</b>
                    {s.rating.count > 0 && ` (${s.rating.count.toLocaleString("pt-BR")})`}
                  </span>
                )}
                {now && (
                  <span className={`status ${status.open ? "open" : "closed"}`}>
                    {status.open ? (
                      <>
                        <i /> Aberto agora
                      </>
                    ) : (
                      "Fechado no momento"
                    )}
                  </span>
                )}
                {now && status.label && <span>{status.label}</span>}
              </div>
            </div>
          </div>
          <div className="store-right">
            {bothModes && (
              <div className="seg" data-mode={mode}>
                <span className="pill" />
                <button className={mode === "delivery" ? "on" : ""} onClick={() => setMode("delivery")}>
                  <I n="moto" />
                  Entrega
                </button>
                <button className={mode === "pickup" ? "on" : ""} onClick={() => setMode("pickup")}>
                  <I n="shop" />
                  Retirada
                </button>
              </div>
            )}
            <div className="facts">
              <div className="fact">
                <small>Tempo</small>
                <b>{mode === "delivery" ? s.delivery.time : s.pickup.time}</b>
              </div>
              <div className="fact">
                <small>{mode === "delivery" ? "Entrega" : "Retirada"}</small>
                <b>{mode === "delivery" ? (minFee === null ? "a combinar" : minFee === 0 ? "Grátis" : `a partir de ${brl(minFee)}`) : "Grátis"}</b>
              </div>
              <div className="fact">
                <small>Pedido mín.</small>
                <b>{s.minOrder > 0 ? brl(s.minOrder) : "Sem mínimo"}</b>
              </div>
            </div>
          </div>
          {mode === "pickup" && s.address && (
            <div className="pickup-note">
              <I n="pin" />
              <span>
                Retire em <b>{s.address}</b>. Avisamos quando estiver pronto.
              </span>
            </div>
          )}
        </div>

        {s.promos.length > 0 && (
          <div className="marquee rv" aria-label="Promoções">
            <div className="marquee-track">
              {[...s.promos, ...s.promos, ...(s.promos.length < 3 ? [...s.promos, ...s.promos] : [])].map((p, i) => (
                <span key={i} aria-hidden={i >= s.promos.length}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <nav ref={navRef} className={`catnav ${stuck ? "stuck" : ""}`} aria-label="Categorias">
        <div className="wrap">
          <div className={`search ${searchOpen ? "open" : ""}`}>
            <button
              aria-label="Buscar no cardápio"
              onClick={() => {
                setSearchOpen((o) => !o);
                if (searchOpen) setQ("");
                else setTimeout(() => document.getElementById("cm-q")?.focus(), 50);
              }}
            >
              <I n="search" />
            </button>
            <input id="cm-q" type="search" placeholder="Buscar no cardápio" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="chips" ref={chipsRef}>
            {featured.length > 0 && !nq && (
              <button className={`chip ${activeCat === "dest" ? "on" : ""}`} data-go="dest" onClick={() => goCat("dest")}>
                Destaques
              </button>
            )}
            {sections.map((c) => (
              <button key={c.id} className={`chip ${activeCat === c.id ? "on" : ""}`} data-go={c.id} onClick={() => goCat(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="wrap">
        {sections.length === 0 && (
          <div className="empty" style={{ display: "block" }}>
            <b>Cardápio em montagem</b>
            Os produtos aparecem aqui assim que a loja cadastrar.
          </div>
        )}

        {featured.length > 0 && !nq && (
          <section className="sec" id="sec-dest" data-cat="dest">
            <div className="sec-head rv">
              <div>
                <h3>Destaques da casa</h3>
                <p>Os que mais saem por aqui.</p>
              </div>
            </div>
            <div className="feat">
              {featured.map((p, i) => (
                <button key={p.id} className="fcard rv ph" style={{ transitionDelay: `${i * 70}ms` }} onClick={() => openProduct(p)}>
                  <Img src={p.image} alt={p.name} name={p.name} />
                  <span className="tag">{p.tag || "Favorito"}</span>
                  <div className="ft">
                    <h4>{p.name}</h4>
                    <p>{p.description}</p>
                    <div className="row">
                      <span className="price">{brl(p.price)}</span>
                      <span className="plus">
                        <I n="plus" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {sections.map((c) => {
          const list = c.items.filter(visible);
          if (!list.length) return null;
          return (
            <section key={c.id} className="sec" id={`sec-${c.id}`} data-cat={c.id}>
              <div className="sec-head rv">
                <div>
                  <h3>{c.name}</h3>
                  {c.description && <p>{c.description}</p>}
                </div>
                <span className="count">
                  {list.length} {list.length > 1 ? "itens" : "item"}
                </span>
              </div>
              <div className="grid">
                {list.map((p, i) => (
                  <button key={p.id} className={`pcard rv ${nq ? "vis" : ""} ${p.available ? "" : "off"}`} style={{ transitionDelay: `${(i % 2) * 60}ms` }} onClick={() => openProduct(p)} disabled={!p.available}>
                    <div className="info">
                      <h4>
                        {p.name}
                        {!p.available && <span className="pill-tag x">Esgotado</span>}
                        {p.available && p.tag && <span className="pill-tag">{p.tag}</span>}
                        {p.veg && <span className="pill-tag g">Veg</span>}
                      </h4>
                      <p className="desc">{p.description}</p>
                      <div className="bottom">
                        <span className="price">{brl(p.price)}</span>
                        {p.oldPrice && p.oldPrice > p.price ? <span className="old">{brl(p.oldPrice)}</span> : null}
                      </div>
                    </div>
                    <div className="thumb ph">
                      <Img src={p.image} alt={p.name} name={p.name} />
                      {p.available && (
                        <span className="add">
                          <I n="plus" />
                        </span>
                      )}
                      {qtyByItem[p.id] ? (
                        <span key={qtyByItem[p.id]} className="qtyb">
                          {qtyByItem[p.id]}x
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {nq && !anyVisible && (
          <div className="empty">
            <b>Nada por aqui</b>
            Tente buscar por outro nome.
          </div>
        )}

        <div className="infos">
          <div className="ibox dark rv">
            <h5>Sobre a casa</h5>
            <div className="big">{s.name}</div>
            <p>{s.description || s.tagline || "Peça pelo cardápio e finalize no WhatsApp."}</p>
          </div>
          <div className="ibox rv">
            <h5>Horários</h5>
            <ul>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <li key={d} className={d === today ? "today" : ""}>
                  <span>{WEEKDAYS[d]}</span>
                  <span>{s.hours[d] ? `${s.hours[d]![0]} – ${s.hours[d]![1]}` : "Fechado"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ibox rv">
            <h5>Endereço e contato</h5>
            {s.address ? (
              <p>
                {s.address}
                {s.city && (
                  <>
                    <br />
                    {s.city}
                  </>
                )}
              </p>
            ) : (
              <p>Somente entrega.</p>
            )}
            <p style={{ marginTop: 10 }}>Pagamento: {payOptions().map((p) => (p[0] === "Cartão" ? "cartão na entrega" : p[0].toLowerCase())).join(", ") || "a combinar"}.</p>
            {s.instagram && <p style={{ marginTop: 10 }}>@{s.instagram.replace(/^@/, "")}</p>}
          </div>
        </div>
        <footer>
          <span>
            © {new Date().getFullYear()} {s.name}
          </span>
          <span>
            Cardápio digital por <a href={href("/")}>Luma</a>
          </span>
        </footer>
      </main>

      <button
        className={`fab ${count > 0 && !drawerOpen ? "show" : ""}`}
        onClick={() => {
          setView("cart");
          setDrawerOpen(true);
        }}
      >
        <span className="ic" ref={fabIcRef}>
          <I n="bag" style={{ width: 22, height: 22 }} />
          <span key={bump} className={`badge ${bump ? "bump" : ""}`}>
            {count}
          </span>
        </span>
        <span className="lbl">Ver sacola</span>
        <span className="tot">{brl(sub)}</span>
      </button>

      {notice && <div className="preview-bar">{notice}</div>}

      <div className={`scrim ${overlay ? "show" : ""}`} onClick={closeAll} />

      {/* ---------------- produto ---------------- */}
      <div className={`sheet ${pmOpen ? "show" : ""}`} role="dialog" aria-modal="true" aria-label={draft?.item.name ?? "Produto"} aria-hidden={!pmOpen}>
        <span className="grab" />
        <button className="close" onClick={closeAll} aria-label="Fechar">
          <I n="x" />
        </button>
        {draft && (
          <>
            <div className="pm-body" ref={pmBodyRef}>
              <div className="pm-inner">
                <div className="pm-media ph" ref={pmImgWrap}>
                  <Img key={draft.item.id} src={draft.item.image} alt={draft.item.name} name={draft.item.name} />
                </div>
                <div className="pm-content">
                  <h3>{draft.item.name}</h3>
                  <p className="desc">{draft.item.description}</p>
                  <div className="pr">
                    {brl(draft.item.price)}
                    {draft.item.oldPrice && draft.item.oldPrice > draft.item.price ? <s>{brl(draft.item.oldPrice)}</s> : null}
                  </div>
                  {itemGroups(draft.item).map((g) => {
                    const sel = draft.sel[g.id] ?? [];
                    const full = g.type === "multi" && !!g.max && sel.length >= g.max;
                    return (
                      <div key={g.id} className={`group ${shakeGroup === g.id ? "shake" : ""}`} data-g={g.id} onAnimationEnd={() => setShakeGroup(null)}>
                        <div className="group-h">
                          <div>
                            <b>{g.title}</b>
                            <small>{g.type === "single" ? "Escolha 1 opção" : g.max ? `Escolha até ${g.max}` : "Opcional"}</small>
                          </div>
                          {g.required && <span className={`req ${sel.length ? "ok" : ""}`}>{sel.length ? "Ok" : "Obrigatório"}</span>}
                        </div>
                        {g.options.map((o, i) => {
                          const checked = sel.includes(i);
                          return (
                            <label key={i} className={`opt ${full && !checked ? "dis" : ""}`}>
                              <span className="on">{o.name}</span>
                              <span className="op">{o.price ? `+ ${brl(o.price)}` : ""}</span>
                              <input type={g.type === "single" ? "radio" : "checkbox"} name={`g-${g.id}`} checked={checked} onChange={(e) => toggleOpt(g, i, e.target.checked)} />
                              <span className={`box ${g.type === "single" ? "rd" : ""}`}>
                                <svg viewBox="0 0 24 24">
                                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                                </svg>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div className="note">
                    <label htmlFor="cm-note">Alguma observação?</label>
                    <textarea id="cm-note" rows={2} maxLength={140} placeholder="Ex.: sem cebola, molho à parte…" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <div className="pm-foot">
              <div className="stepper">
                <button aria-label="Diminuir" disabled={draft.qty <= 1} onClick={() => setDraft({ ...draft, qty: Math.max(1, draft.qty - 1) })}>
                  <I n="minus" />
                </button>
                <span>{draft.qty}</span>
                <button aria-label="Aumentar" onClick={() => setDraft({ ...draft, qty: Math.min(30, draft.qty + 1) })}>
                  <I n="plus" />
                </button>
              </div>
              <button className="btn" onClick={addDraft}>
                <span>{draft.editKey ? "Atualizar" : "Adicionar"}</span>
                <span>{brl(unitPrice(draft.item, draftOpts(draft)) * draft.qty)}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ---------------- sacola ---------------- */}
      <aside className={`drawer ${drawerOpen ? "show" : ""}`} role="dialog" aria-modal="true" aria-label="Sacola" aria-hidden={!drawerOpen}>
        <div className="dr-head">
          {view === "checkout" && (
            <button className="sq" onClick={() => setView("cart")} aria-label="Voltar">
              <I n="back" />
            </button>
          )}
          <h3>{view === "cart" ? "Sua sacola" : view === "checkout" ? "Finalizar pedido" : "Pedido pronto"}</h3>
          <button className="sq" onClick={closeAll} aria-label="Fechar">
            <I n="x" />
          </button>
        </div>
        {view !== "done" && cart.length > 0 && (
          <div className="steps">
            <i className="on" />
            <i className={view === "checkout" ? "on" : ""} />
            <i />
          </div>
        )}

        <div className="dr-body" ref={drBodyRef}>
          {view === "done" && lastOrder ? (
            <div className="view done">
              <div className="check">
                <svg viewBox="0 0 24 24">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </div>
              <h4>{lastOrder.sent ? "Pedido enviado!" : "Pedido pronto!"}</h4>
              <p>{lastOrder.sent ? "Agora é só tocar em enviar no WhatsApp para a loja receber." : "Toque no botão abaixo: o WhatsApp abre com o pedido já escrito para a loja."}</p>
              <span className="code">#{lastOrder.code}</span>
            </div>
          ) : cart.length === 0 ? (
            <div className="view cart-empty">
              <div className="bag">
                <I n="bag" />
              </div>
              <b>Sua sacola está vazia</b>
              <p>Escolha algo no cardápio para começar.</p>
            </div>
          ) : view === "cart" ? (
            <div className="view">
              <div className="mode-strip">
                <I n={mode === "delivery" ? "moto" : "shop"} />
                <span>
                  <b>{mode === "delivery" ? "Entrega" : "Retirada"}</b> · {mode === "delivery" ? s.delivery.time : s.pickup.time}
                </span>
                {bothModes && <button onClick={() => setMode(mode === "delivery" ? "pickup" : "delivery")}>Trocar</button>}
              </div>
              {!status.open && now && <div className="closed-strip">A loja está fechada agora{status.label ? ` (${status.label})` : ""}.{s.acceptWhenClosed ? " Você pode deixar o pedido: ele será preparado quando a loja abrir." : ""}</div>}
              {cart.map((l) => {
                const p = byId(l.itemId);
                if (!p) return null;
                return (
                  <div key={l.key} className="citem">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" />
                    ) : (
                      <div className="noimg" />
                    )}
                    <div className="ci">
                      <div className="cn">{p.name}</div>
                      {l.opts.length > 0 && <div className="co">{l.opts.map((o) => o.name).join(" · ")}</div>}
                      {l.note && <div className="co">Obs.: {l.note}</div>}
                      {p.groupIds.length > 0 && (
                        <button className="edit" onClick={() => openProduct(p, l)}>
                          Editar
                        </button>
                      )}
                      <div className="cr">
                        <span className="cp">{brl(l.unit * l.qty)}</span>
                        <div className="stepper sm">
                          <button aria-label={l.qty === 1 ? "Remover" : "Diminuir"} onClick={() => changeQty(l.key, -1)}>
                            <I n={l.qty === 1 ? "trash" : "minus"} />
                          </button>
                          <span>{l.qty}</span>
                          <button aria-label="Aumentar" onClick={() => changeQty(l.key, 1)}>
                            <I n="plus" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Upsell items={items} cart={cart} onPick={openProduct} />
              {menu.coupons.some((c) => c.active) &&
                (coupon ? (
                  <div className="coupon-ok">
                    <I n="check" />
                    {coupon.code.toUpperCase()} · {coupon.type === "pct" ? `${coupon.value}% de desconto` : `${brl(coupon.value)} de desconto`}
                    <button onClick={() => setCouponCode(null)}>remover</button>
                  </div>
                ) : (
                  <div className={`coupon ${couponShake ? "shake" : ""}`} onAnimationEnd={() => setCouponShake(false)}>
                    <input id="cm-coupon" placeholder="Cupom de desconto" maxLength={20} value={couponInput} onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyCoupon()} aria-label="Cupom de desconto" />
                    <button onClick={applyCoupon}>Aplicar</button>
                  </div>
                ))}
              <div className="totals">
                <div className="muted">
                  <span>Subtotal</span>
                  <span>{brl(sub)}</span>
                </div>
                {disc > 0 && (
                  <div className="disc">
                    <span>Desconto</span>
                    <span>– {brl(disc)}</span>
                  </div>
                )}
                <div className="muted">
                  <span>{mode === "delivery" ? "Taxa de entrega" : "Retirada"}</span>
                  <span>{mode === "delivery" ? (fee === null ? "calculada no próximo passo" : fee === 0 ? "Grátis" : brl(fee)) : "Grátis"}</span>
                </div>
                <div className="grand">
                  <span>Total</span>
                  <span>{brl(total)}</span>
                </div>
              </div>
              {below && (
                <div className="warn">
                  Pedido mínimo de {brl(s.minOrder)}. Faltam {brl(s.minOrder - sub)}.
                </div>
              )}
              {s.delivery.freeFrom && mode === "delivery" && sub < s.delivery.freeFrom ? <p className="hint">Frete grátis a partir de {brl(s.delivery.freeFrom)}.</p> : null}
            </div>
          ) : (
            <div className="view">
              {bothModes && (
                <div className="fs">
                  <b>Como você quer receber?</b>
                  <div className="seg" data-mode={mode}>
                    <span className="pill" />
                    <button type="button" className={mode === "delivery" ? "on" : ""} onClick={() => setMode("delivery", true)}>
                      Entrega
                    </button>
                    <button type="button" className={mode === "pickup" ? "on" : ""} onClick={() => setMode("pickup", true)}>
                      Retirada
                    </button>
                  </div>
                </div>
              )}
              <div className="fs">
                <b>Seus dados</b>
                <label className={`fld ${errs.includes("name") ? "err" : ""}`} data-f="name">
                  <span>Nome</span>
                  <input id="cm-name" autoComplete="name" value={customer.name} onChange={(e) => setCust({ name: e.target.value })} placeholder="Como podemos te chamar?" />
                  <em className="msg">Informe seu nome</em>
                </label>
                <label className={`fld ${errs.includes("phone") ? "err" : ""}`} data-f="phone">
                  <span>WhatsApp</span>
                  <input id="cm-phone" type="tel" inputMode="numeric" autoComplete="tel" value={customer.phone} onChange={(e) => setCust({ phone: maskPhone(e.target.value) })} placeholder="(11) 90000-0000" />
                  <em className="msg">Informe um telefone válido</em>
                </label>
              </div>
              {mode === "delivery" ? (
                <div className="fs">
                  <b>Endereço de entrega</b>
                  <div className="row2">
                    <label className="fld" data-f="cep">
                      <span>CEP</span>
                      <input
                        id="cm-cep"
                        inputMode="numeric"
                        value={customer.cep ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
                          setCust({ cep: v });
                          if (v.length === 9) void lookupCep(v);
                        }}
                        placeholder="00000-000"
                      />
                      {cepLoading && <i className="spin" />}
                    </label>
                    {s.delivery.zones.length > 0 ? (
                      <label className={`fld ${errs.includes("zoneId") ? "err" : ""}`} data-f="zoneId">
                        <span>Bairro</span>
                        <select id="cm-zone" value={customer.zoneId ?? ""} onChange={(e) => setCust({ zoneId: e.target.value || undefined })}>
                          <option value="">Selecione</option>
                          {s.delivery.zones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                        <em className="msg">Escolha o bairro</em>
                      </label>
                    ) : (
                      <div />
                    )}
                  </div>
                  <div className="row3">
                    <label className={`fld ${errs.includes("street") ? "err" : ""}`} data-f="street">
                      <span>Rua</span>
                      <input id="cm-street" autoComplete="address-line1" value={customer.street ?? ""} onChange={(e) => setCust({ street: e.target.value })} placeholder="Rua / Avenida" />
                      <em className="msg">Informe a rua</em>
                    </label>
                    <label className={`fld ${errs.includes("number") ? "err" : ""}`} data-f="number">
                      <span>Número</span>
                      <input id="cm-num" value={customer.number ?? ""} onChange={(e) => setCust({ number: e.target.value })} placeholder="Nº" />
                      <em className="msg">Nº</em>
                    </label>
                  </div>
                  <label className="fld">
                    <span>Complemento / referência</span>
                    <input id="cm-comp" value={customer.complement ?? ""} onChange={(e) => setCust({ complement: e.target.value })} placeholder="Apto, bloco, ponto de referência" />
                  </label>
                  {s.delivery.zones.length > 0 && <p className="hint">Entregamos nos bairros da lista. Se o seu não aparece, fale com a loja.</p>}
                </div>
              ) : (
                <div className="fs">
                  <b>Retirada</b>
                  <div className="pickup-box">
                    <I n="pin" />
                    <div>
                      <b>{s.name}</b>
                      <br />
                      {s.address || "Endereço informado pela loja no WhatsApp"}
                      <br />
                      <span style={{ color: "var(--muted)" }}>Fica pronto em {s.pickup.time}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="fs">
                <b>Pagamento</b>
                <div className="pays">
                  {payOptions().map(([n, ic]) => (
                    <label key={n} className={`pay ${customer.pay === n ? "on" : ""}`}>
                      <input type="radio" name="cm-pay" value={n} checked={customer.pay === n} onChange={() => setCust({ pay: n })} />
                      {ic}
                      {n}
                    </label>
                  ))}
                </div>
                <div className={`fld ${errs.includes("pay") ? "err" : ""}`} data-f="pay" style={{ margin: 0 }}>
                  <em className="msg">Escolha a forma de pagamento</em>
                </div>
                {customer.pay === "Dinheiro" && (
                  <label className={`fld ${errs.includes("change") ? "err" : ""}`} style={{ marginTop: 12 }} data-f="change">
                    <span>Troco para quanto?</span>
                    <input id="cm-change" inputMode="decimal" value={customer.change ?? ""} onChange={(e) => setCust({ change: e.target.value })} placeholder="Deixe vazio se não precisar" />
                    <em className="msg">Valor menor que o total</em>
                  </label>
                )}
                {customer.pay === "Cartão" && <p className="hint">A maquininha vai até você{mode === "delivery" ? "" : " no balcão"}. Crédito, débito e vale-refeição.</p>}
                {customer.pay === "Pix" && <p className="hint">A chave Pix é enviada pela loja no WhatsApp junto da confirmação.</p>}
              </div>
              <div className="mini-sum">
                <div>
                  <span>
                    Subtotal ({count} {count > 1 ? "itens" : "item"})
                  </span>
                  <span>{brl(sub)}</span>
                </div>
                {disc > 0 && (
                  <div style={{ color: "var(--green)" }}>
                    <span>Desconto {coupon?.code.toUpperCase()}</span>
                    <span>– {brl(disc)}</span>
                  </div>
                )}
                <div>
                  <span>{mode === "delivery" ? "Entrega" : "Retirada"}</span>
                  <span>{mode === "delivery" ? (fee === null ? "—" : fee === 0 ? "Grátis" : brl(fee)) : "Grátis"}</span>
                </div>
                <div className="grand">
                  <span>Total</span>
                  <span>{brl(total)}</span>
                </div>
              </div>
              {!canOrderNow && <div className="warn">A loja está fechada agora e não está recebendo pedidos{status.label ? ` (${status.label})` : ""}.</div>}
              {!storeReady && <div className="warn">Esta loja ainda não configurou o WhatsApp que recebe os pedidos.</div>}
            </div>
          )}
        </div>

        <div className="dr-foot">
          {view === "done" && lastOrder ? (
            lastOrder.sent ? (
              <button className="btn ghost center" onClick={closeAll}>
                Fazer novo pedido
              </button>
            ) : (
              <a
                className="btn wa"
                href={lastOrder.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  setTimeout(() => {
                    setLastOrder((o) => (o ? { ...o, sent: true } : o));
                    setCart([]);
                    setCouponCode(null);
                  }, 300)
                }
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <WaIcon /> Abrir no WhatsApp
                </span>
                <span>{brl(lastOrder.total)}</span>
                <span className="shine" />
              </a>
            )
          ) : cart.length === 0 ? (
            <button className="btn dark center" onClick={closeAll}>
              Ver cardápio
            </button>
          ) : view === "cart" ? (
            <button className="btn" disabled={below} onClick={() => setView("checkout")}>
              <span>Continuar</span>
              <span>{brl(total)}</span>
            </button>
          ) : (
            <button className="btn wa" disabled={!canOrderNow || !storeReady} onClick={submit}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <WaIcon /> Enviar pedido
              </span>
              <span>{brl(total)}</span>
              <span className="shine" />
            </button>
          )}
        </div>
      </aside>

      <div className={`toast ${toastOn ? "show" : ""}`} role="status" aria-live="polite">
        <I n="check" />
        <span>{toastMsg}</span>
      </div>
    </div>
  );
}

function Upsell({ items, cart, onPick }: { items: MenuItem[]; cart: CartLine[]; onPick: (i: MenuItem) => void }) {
  const inCart = new Set(cart.map((l) => l.itemId));
  // sugere os mais baratos que ainda não estão na sacola (acompanhamentos, bebidas, sobremesas)
  const ups = items
    .filter((i) => i.available && !inCart.has(i.id))
    .sort((a, b) => a.price - b.price)
    .slice(0, 4);
  if (!ups.length) return null;
  return (
    <div className="upsell">
      <h6>Peça também</h6>
      <div className="ups">
        {ups.map((p) => (
          <button key={p.id} className="up" onClick={() => onPick(p)}>
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" />
            ) : (
              <div className="noimg" />
            )}
            <b>{p.name}</b>
            <span>{formatBRL(p.price)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
