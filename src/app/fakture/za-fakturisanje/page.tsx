import InvoicePickClient from "./ui/InvoicePickClient";

export const dynamic = "force-dynamic";

type AnySP = Record<string, any>;

async function unwrapSearchParams(sp: any): Promise<AnySP> {
  // Next 16: searchParams može biti Promise
  if (sp && typeof sp.then === "function") return await sp;
  return sp ?? {};
}

async function getBaseUrl(): Promise<string> {
  // u app routeru je najstabilnije osloniti se na env, a fallback na localhost
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

async function loadData(sp: AnySP) {
  const base = await getBaseUrl();

  const qs = new URLSearchParams();
  if (sp.narucilac_id) qs.set("narucilac_id", String(sp.narucilac_id));
  if (sp.od) qs.set("od", String(sp.od));
  if (sp.do) qs.set("do", String(sp.do));

  const res = await fetch(
    `${base}/api/fakture/za-fakturisanje?${qs.toString()}`,
    { cache: "no-store" },
  );
  if (!res.ok) return { items: [], narucioci: [] };
  const json = await res.json();
  return {
    items: Array.isArray(json?.items) ? json.items : [],
    narucioci: Array.isArray(json?.narucioci) ? json.narucioci : [],
  };
}

export default async function Page(props: { searchParams?: any }) {
  const sp = await unwrapSearchParams(props.searchParams);
  const { items, narucioci } = await loadData(sp);

  return (
    <InvoicePickClient
      rows={items}
      narucioci={narucioci}
      initial={{
        narucilac_id: sp.narucilac_id ? String(sp.narucilac_id) : "",
        od: sp.od ? String(sp.od) : "",
        do: sp.do ? String(sp.do) : "",
      }}
    />
  );
}
