// src/app/api/narudzbenice/send/route.js
// Slanje mailova se obavlja putem Windows mail klijenta; ovaj endpoint samo validira payload.
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function okJson(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readPayload(request) {
  const ct = request.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const body = await request.json().catch(() => null);
    return body;
  }

  if (
    ct.includes("application/x-www-form-urlencoded") ||
    ct.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    const raw = form.get("payload");
    if (!raw) return null;
    try {
      return JSON.parse(String(raw));
    } catch {
      return null;
    }
  }

  return null;
}

export async function POST(request) {
  const payload = await readPayload(request);

  if (!payload) {
    return okJson({ ok: false, error: "Missing payload" }, 400);
  }

  const klijent_id = Number(payload.klijent_id);
  const dobavljac_id = Number(payload.dobavljac_id);
  const project_ids = Array.isArray(payload.project_ids)
    ? payload.project_ids.map((x) => Number(x)).filter(Boolean)
    : [];
  const subject = String(payload.subject || "").trim();
  const body = String(payload.body || "").trim();

  if (!klijent_id || !dobavljac_id || !subject || !body) {
    return okJson(
      {
        ok: false,
        error:
          "Invalid payload (klijent_id, dobavljac_id, subject, body are required)",
      },
      400,
    );
  }

  const suppliers = await query(
    `SELECT dobavljac_id, naziv, email FROM dobavljaci WHERE dobavljac_id = ? LIMIT 1`,
    [dobavljac_id],
  );
  const supplier = suppliers?.[0] || null;

  if (!supplier?.email) {
    return okJson(
      { ok: false, error: "Supplier has no email (dobavljaci.email is empty)" },
      400,
    );
  }

  // Slanje se obavlja putem Windows mail klijenta; ovdje samo potvrda podataka.
  return okJson({
    ok: true,
    message: "Podaci pripremljeni za slanje putem Windows mail klijenta.",
    sent_to: supplier.email,
    supplier_id: dobavljac_id,
    client_id: klijent_id,
    project_ids,
    subject,
  });
}
