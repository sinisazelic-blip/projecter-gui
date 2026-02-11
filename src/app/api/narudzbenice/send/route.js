// src/app/api/narudzbenice/send/route.js
import { query } from "@/lib/db";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

function okJson(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// prima payload ili kao JSON (fetch) ili kao form field "payload"
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

function requireEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
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

  // ✅ dobavljač email
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

  // ✅ minimal SMTP config (env)
  const SMTP_HOST = requireEnv("FLUXA_SMTP_HOST");
  const SMTP_PORT = Number(requireEnv("FLUXA_SMTP_PORT") || "587");
  const SMTP_USER = requireEnv("FLUXA_SMTP_USER");
  const SMTP_PASS = requireEnv("FLUXA_SMTP_PASS");
  const SMTP_FROM = requireEnv("FLUXA_SMTP_FROM");

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return okJson(
      {
        ok: false,
        error:
          "SMTP not configured. Set env: FLUXA_SMTP_HOST, FLUXA_SMTP_PORT, FLUXA_SMTP_USER, FLUXA_SMTP_PASS, FLUXA_SMTP_FROM",
      },
      500,
    );
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 = true, 587 = false
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  // ✅ send
  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: supplier.email,
      subject,
      text: body,
    });

    // (Opcionalno) ovdje kasnije možemo logovati u DB (ako odlučimo tabelu)
    return okJson({
      ok: true,
      sent_to: supplier.email,
      supplier_id: dobavljac_id,
      client_id: klijent_id,
      project_ids,
      message_id: info?.messageId || null,
    });
  } catch (err) {
    return okJson(
      {
        ok: false,
        error: "Send failed",
        details: String(err?.message || err),
      },
      500,
    );
  }
}
