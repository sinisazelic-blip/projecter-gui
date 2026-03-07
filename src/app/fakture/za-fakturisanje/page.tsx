import InvoicePickClient from "./ui/InvoicePickClient";

export const dynamic = "force-dynamic";

type AnySP = Record<string, any>;

async function unwrapSearchParams(sp: any): Promise<AnySP> {
  if (sp && typeof sp.then === "function") return await sp;
  return sp ?? {};
}

export default async function Page(props: { searchParams?: any }) {
  const sp = await unwrapSearchParams(props.searchParams);
  return (
    <InvoicePickClient
      rows={[]}
      narucioci={[]}
      initial={{
        narucilac_id: sp.narucilac_id ? String(sp.narucilac_id) : "",
        od: sp.od ? String(sp.od) : "",
        do: sp.do ? String(sp.do) : "",
      }}
    />
  );
}
