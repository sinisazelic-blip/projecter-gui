// src/app/projects/[id]/page.js
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";

//export const metadata = {
//  title: "Lista projekata",
//};
//export async function generateMetadata({ params }) {
//  return { title: `Projekat #${params.id}` };
//}

import ProjectHeader from "./_components/ProjectHeader";
import ProjectSummaryCard from "./_components/ProjectSummaryCard";
import CostsPanel from "./_components/CostsPanel";

import FinalOkButtonClient from "./_components/FinalOkButtonClient";
import { ReadOnlyGuard } from "@/components/ReadOnlyGuard";

// ✅ NEW: Timeline indikator (read-only)
import {
  FluxaTimeline,
  phaseFromProjectStatusId,
} from "@/lib/ui/fluxaTimeline";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["PLANIRANO", "NASTALO", "PLACENO", "STORNIRANO"]);
const VALID_ENTITY_TYPES = new Set(["talent", "vendor"]);

// ✅ fiksni kurs za EUR->BAM (dok ne uvedemo dinamički FX po datumu)
const EUR_TO_BAM = 1.95583;

/**
 * Siguran upsert kursa direktno u DB (umjesto fetch("/api/fx/upsert") u server action).
 * ✅ FIX: fx_rates ima kolonu rate_date (ne "date")
 */
async function upsertFxRate({ date, ccy, rate_to_bam, source = "manual" }) {
  try {
    await query(
      `
      INSERT INTO fx_rates (rate_date, ccy, rate_to_bam, source)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rate_to_bam = VALUES(rate_to_bam),
        source = VALUES(source)
      `,
      [date, ccy, rate_to_bam, source],
    );
  } catch {}
}

/**
 * ✅ NORMALIZACIJA requires_entity iz baze:
 * DB: TALENT | DOBAVLJAC | NONE
 * App: talent | vendor | none
 */
async function getTipRequiresEntity(tipId) {
  const rows = await query(
    `SELECT COALESCE(requires_entity,'NONE') AS requires_entity
     FROM tip_troska
     WHERE tip_id = ?
     LIMIT 1`,
    [tipId],
  );

  const raw = String(rows?.[0]?.requires_entity ?? "NONE")
    .trim()
    .toUpperCase();

  if (raw === "TALENT") return "talent";
  if (raw === "DOBAVLJAC") return "vendor";
  return "none";
}

async function addCost(formData) {
  "use server";

  const projekatId = Number(formData.get("projekat_id"));
  const returnTo = String(
    formData.get("return_to") ||
      (Number.isFinite(projekatId) ? `/projects/${projekatId}` : "/projects"),
  );

  const datum = String(formData.get("datum_troska") || "");
  const opis = String(formData.get("opis") || "").trim();

  const iznosRaw = String(formData.get("iznos_km") ?? "").trim();
  const iznosOriginal = Number.parseFloat(iznosRaw.replace(",", "."));

  const valuta = String(formData.get("valuta") || "BAM")
    .trim()
    .toUpperCase();

  let kurs = Number.parseFloat(
    String(formData.get("kurs") || "1").replace(",", "."),
  );
  if (valuta === "BAM") kurs = 1;

  const status = String(formData.get("status") || "NASTALO");
  const tipId = Number(formData.get("tip_id")) || 1;

  const entityTypeRaw = String(formData.get("entity_type") ?? "").trim();
  const entityIdRaw = String(formData.get("entity_id") ?? "").trim();
  const entityType = entityTypeRaw ? entityTypeRaw : null;
  const entityId = entityIdRaw ? Number(entityIdRaw) : null;

  if (!Number.isFinite(projekatId)) redirect("/projects");
  if (!datum || !opis || !Number.isFinite(iznosOriginal)) redirect(returnTo);
  if (!Number.isFinite(kurs) || kurs <= 0) redirect(returnTo);
  if (!VALID_STATUS.has(status) || status === "STORNIRANO") redirect(returnTo);

  if (entityType !== null && !VALID_ENTITY_TYPES.has(entityType))
    redirect(returnTo);
  if (entityType === null && entityId !== null) redirect(returnTo);
  if (entityType !== null && (!Number.isFinite(entityId) || entityId <= 0))
    redirect(returnTo);

  const req = await getTipRequiresEntity(tipId);

  if (req === "none") {
    if (entityType !== null || entityId !== null) redirect(returnTo);
  } else {
    if (entityType !== req || !Number.isFinite(entityId) || entityId <= 0)
      redirect(returnTo);
  }

  const iznosKM = iznosOriginal * kurs;

  if (valuta !== "BAM" && Number.isFinite(kurs)) {
    await upsertFxRate({
      date: datum,
      ccy: valuta,
      rate_to_bam: kurs,
      source: "manual",
    });
  }

  await query(
    `
    INSERT INTO projektni_troskovi
      (projekat_id, tip_id, datum_troska, opis,
       iznos_original, valuta_original, kurs_u_km,
       iznos_km, status,
       entity_type, entity_id)
    VALUES (?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?)
    `,
    [
      projekatId,
      tipId,
      datum,
      opis,
      iznosOriginal,
      valuta,
      kurs,
      iznosKM,
      status,
      entityType,
      entityId,
    ],
  );

  revalidatePath(`/projects/${projekatId}`);
  redirect(returnTo);
}

async function editCost(formData) {
  "use server";

  const projekatId = Number(formData.get("projekat_id"));
  const trosakId = Number(formData.get("trosak_id"));

  const returnTo = String(
    formData.get("return_to") ||
      (Number.isFinite(projekatId) ? `/projects/${projekatId}` : "/projects"),
  );

  const datum = String(formData.get("datum_troska") || "");
  const opis = String(formData.get("opis") || "").trim();

  const iznosRaw = String(
    formData.get("iznos_km") ?? formData.get("iznos_original") ?? "",
  ).trim();
  const iznosOriginal = Number.parseFloat(iznosRaw.replace(",", "."));

  const valuta = String(
    formData.get("valuta") || formData.get("valuta_original") || "BAM",
  )
    .trim()
    .toUpperCase();

  let kurs = Number.parseFloat(
    String(formData.get("kurs") ?? formData.get("kurs_u_km") ?? "1").replace(
      ",",
      ".",
    ),
  );
  if (valuta === "BAM") kurs = 1;

  const tipId = Number(formData.get("tip_id")) || 1;

  const entityTypeRaw = String(formData.get("entity_type") ?? "").trim();
  const entityIdRaw = String(formData.get("entity_id") ?? "").trim();
  const entityType = entityTypeRaw ? entityTypeRaw : null;
  const entityId = entityIdRaw ? Number(entityIdRaw) : null;

  if (!Number.isFinite(projekatId)) redirect("/projects");
  if (!Number.isFinite(trosakId)) redirect(returnTo);
  if (!datum || !opis || !Number.isFinite(iznosOriginal)) redirect(returnTo);
  if (!Number.isFinite(kurs) || kurs <= 0) redirect(returnTo);

  const req = await getTipRequiresEntity(tipId);

  let finalEntityType = entityType;
  let finalEntityId = entityId;

  if (req === "none") {
    finalEntityType = null;
    finalEntityId = null;
  } else {
    if (
      finalEntityType !== req ||
      !Number.isFinite(finalEntityId) ||
      finalEntityId <= 0
    ) {
      finalEntityType = null;
      finalEntityId = null;
    }
  }

  const iznosKM = iznosOriginal * kurs;

  if (valuta !== "BAM" && Number.isFinite(kurs)) {
    await upsertFxRate({
      date: datum,
      ccy: valuta,
      rate_to_bam: kurs,
      source: "manual",
    });
  }

  await query(
    `
    UPDATE projektni_troskovi
    SET tip_id = ?,
        datum_troska = ?,
        opis = ?,
        iznos_original = ?,
        valuta_original = ?,
        kurs_u_km = ?,
        iznos_km = ?,
        entity_type = ?,
        entity_id = ?
    WHERE trosak_id = ? AND projekat_id = ?
    LIMIT 1
    `,
    [
      tipId,
      datum,
      opis,
      iznosOriginal,
      valuta,
      kurs,
      iznosKM,
      finalEntityType,
      finalEntityId,
      trosakId,
      projekatId,
    ],
  );

  revalidatePath(`/projects/${projekatId}`);
  redirect(returnTo);
}

async function loadCostTypes() {
  const candidates = [
    { table: "tipovi_troskova", id: "tip_id", name: "naziv" },
    { table: "sif_tipovi_troskova", id: "tip_id", name: "naziv" },
    { table: "trosak_tipovi", id: "tip_id", name: "naziv" },
    { table: "tip_troska", id: "tip_id", name: "naziv" },
  ];

  for (const c of candidates) {
    try {
      const rows = await query(
        `SELECT ${c.id} AS tip_id, ${c.name} AS naziv FROM ${c.table} ORDER BY ${c.name} ASC`,
      );
      return { source: c.table, rows: rows ?? [] };
    } catch {}
  }

  return { source: null, rows: [{ tip_id: 1, naziv: "Default" }] };
}

async function setCostStatus(formData) {
  "use server";

  const projekatId = Number(formData.get("projekat_id"));
  const trosakId = Number(formData.get("trosak_id"));
  const status = String(formData.get("status") || "");

  if (!Number.isFinite(projekatId)) redirect("/projects");
  if (!Number.isFinite(trosakId)) redirect(`/projects/${projekatId}`);

  await query(
    `
    UPDATE projektni_troskovi
    SET status = ?
    WHERE trosak_id = ? AND projekat_id = ?
    LIMIT 1
    `,
    [status, trosakId, projekatId],
  );

  revalidatePath(`/projects/${projekatId}`);
  redirect(`/projects/${projekatId}`);
}

/**
 * ✅ OWNER: promjena operativnog signala + audit log (snapshot)
 * - projekti.operativni_signal je current state
 * - projekat_operativni_signal_log čuva istoriju
 */
async function setOperativniSignal(formData) {
  "use server";

  const projekatId = Number(formData.get("projekat_id"));
  const returnTo = String(
    formData.get("return_to") ||
      (Number.isFinite(projekatId) ? `/projects/${projekatId}` : "/projects"),
  );

  const sigRaw = String(formData.get("operativni_signal") || "")
    .trim()
    .toUpperCase();
  const noteRaw = formData.get("note");
  const note =
    noteRaw && String(noteRaw).trim()
      ? String(noteRaw).trim().slice(0, 500)
      : null;

  if (!Number.isFinite(projekatId)) redirect("/projects");
  if (!["NORMALNO", "PAZNJA", "STOP"].includes(sigRaw)) redirect(returnTo);

  // 1) upiši current state
  await query(
    `
    UPDATE projekti
    SET operativni_signal = ?
    WHERE projekat_id = ?
    LIMIT 1
    `,
    [sigRaw, projekatId],
  );

  // 2) audit snapshot u log (changed_by_user_id za sada NULL dok ne uvedemo login/roles)
  await query(
    `
    INSERT INTO projekat_operativni_signal_log
      (projekat_id, operativni_signal, note, changed_by_user_id)
    VALUES (?, ?, ?, NULL)
    `,
    [projekatId, sigRaw, note],
  );

  // 3) revalidate i detalj i lista projekata
  revalidatePath(`/projects/${projekatId}`);
  revalidatePath(`/projects`);

  redirect(returnTo);
}

/** ✅ Signal badge helpers */
function signalMeta(sigRaw) {
  const sig = String(sigRaw || "NORMALNO")
    .trim()
    .toUpperCase();
  if (sig === "STOP") {
    return {
      label: "STOP",
      bg: "rgba(255, 80, 80, .16)",
      border: "rgba(255, 80, 80, .40)",
      dot: "rgba(255, 80, 80, .95)",
      title: "STOP — zaustavi / eskaliraj",
    };
  }
  if (sig === "PAZNJA") {
    return {
      label: "PAŽNJA",
      bg: "rgba(255, 165, 0, .16)",
      border: "rgba(255, 165, 0, .40)",
      dot: "rgba(255, 165, 0, .95)",
      title: "PAŽNJA — pripremi se",
    };
  }
  return {
    label: "NORMALNO",
    bg: "rgba(80, 220, 140, .14)",
    border: "rgba(80, 220, 140, .38)",
    dot: "rgba(80, 220, 140, .95)",
    title: "NORMALNO — sve ide po planu",
  };
}

export default async function ProjectDetailsPage({ params, searchParams }) {
  const p = await params;

  const idStr = String(p?.id ?? p?.projekat_id ?? "");
  const projekatId = Number(idStr);

  if (!Number.isFinite(projekatId)) redirect("/projects");

  const sp = await Promise.resolve(searchParams);
  const showStornirano = String(sp?.stornirano || "0") === "1";

  const returnTo = `/projects/${projekatId}${showStornirano ? "?stornirano=1" : ""}`;

  const projRows = await query(
    `
    SELECT
      p.projekat_id,
      p.status_id,
      s.naziv_statusa,

      -- ✅ NOVO: operativni signal (owner -> tim)
      p.operativni_signal,

      -- ✅ FIX: view nema radni_naziv
      p.radni_naziv AS radni_naziv,

      -- ✅ Deal -> Project ključne stvari
      p.rok_glavni,
      p.tip_roka,
      p.napomena,

      -- ✅ BUDŽET (KANONSKI U KM):
      COALESCE(v.budzet_planirani, ps.budzet_km, 0) AS budzet_planirani,

      -- (opciono) pomoćna polja
      COALESCE(ps.budzet_bam, 0) AS budzet_bam,
      COALESCE(ps.budzet_eur, 0) AS budzet_eur,
      COALESCE(ps.budzet_eur_u_bam, 0) AS budzet_eur_u_bam,

      -- troškovi
      COALESCE(v.troskovi_ukupno, ct.troskovi_ukupno, 0) AS troskovi_ukupno,
      COALESCE(v.troskovi_novi,   ct.troskovi_novi,   0) AS troskovi_novi,
      COALESCE(v.troskovi_legacy, 0) AS troskovi_legacy,

      COALESCE(v.legacy_flag, 0) AS legacy_flag,

      -- zarada (kanonski: view prvo)
      COALESCE(
        v.planirana_zarada,
        (COALESCE(v.budzet_planirani, ps.budzet_km, 0) - COALESCE(v.troskovi_ukupno, ct.troskovi_ukupno, 0))
      ) AS planirana_zarada,

      COALESCE(v.finansijski_status, NULL) AS finansijski_status
    FROM projekti p
    LEFT JOIN statusi_projekta s
      ON s.status_id = p.status_id

    LEFT JOIN vw_projekti_finansije v
      ON v.projekat_id = p.projekat_id

    LEFT JOIN (
      SELECT
        ps1.projekat_id,

        ROUND(SUM(
          CASE
            WHEN UPPER(COALESCE(ps1.valuta, 'BAM')) IN ('BAM','KM') THEN COALESCE(ps1.line_total,0)
            ELSE 0
          END
        ), 2) AS budzet_bam,

        ROUND(SUM(
          CASE
            WHEN UPPER(COALESCE(ps1.valuta, '')) = 'EUR' THEN COALESCE(ps1.line_total,0)
            ELSE 0
          END
        ), 2) AS budzet_eur,

        ROUND(SUM(
          CASE
            WHEN UPPER(COALESCE(ps1.valuta, '')) = 'EUR' THEN COALESCE(ps1.line_total,0) * ${EUR_TO_BAM}
            ELSE 0
          END
        ), 2) AS budzet_eur_u_bam,

        ROUND(SUM(
          CASE
            WHEN UPPER(COALESCE(ps1.valuta, 'BAM')) IN ('BAM','KM') THEN COALESCE(ps1.line_total,0)
            WHEN UPPER(COALESCE(ps1.valuta, '')) = 'EUR' THEN COALESCE(ps1.line_total,0) * ${EUR_TO_BAM}
            ELSE 0
          END
        ), 2) AS budzet_km

      FROM projekat_stavke ps1
      LEFT JOIN (
        SELECT
          projekat_id,
          MAX(IFNULL(snapshot_id,0)) AS snapshot_id
        FROM projekat_stavke
        GROUP BY projekat_id
      ) ls
        ON ls.projekat_id = ps1.projekat_id
      WHERE IFNULL(ps1.snapshot_id,0) = COALESCE(ls.snapshot_id,0)
      GROUP BY ps1.projekat_id
    ) ps
      ON ps.projekat_id = p.projekat_id

    LEFT JOIN (
      SELECT
        projekat_id,
        ROUND(SUM(CASE WHEN status <> 'STORNIRANO' THEN iznos_km ELSE 0 END), 2) AS troskovi_ukupno,
        ROUND(SUM(CASE WHEN status <> 'STORNIRANO' THEN iznos_km ELSE 0 END), 2) AS troskovi_novi
      FROM projektni_troskovi
      GROUP BY projekat_id
    ) ct
      ON ct.projekat_id = p.projekat_id

    WHERE p.projekat_id = ?
    LIMIT 1
    `,
    [projekatId],
  );

  const project = projRows?.[0];

  const costs = await query(
    `
    SELECT
      c.trosak_id,
      c.projekat_id,
      c.tip_id,
      c.opis,
      c.datum_troska,
      c.iznos_km,
      c.status,
      c.iznos_original,
      c.valuta_original,
      c.kurs_u_km,
      c.entity_type,
      c.entity_id,
      CASE
        WHEN c.entity_type='talent' THEN t.ime_prezime
        WHEN c.entity_type='vendor' THEN d.naziv
        ELSE NULL
      END AS entity_name
    FROM projektni_troskovi c
    LEFT JOIN talenti t
      ON c.entity_type='talent' AND t.talent_id = c.entity_id
    LEFT JOIN dobavljaci d
      ON c.entity_type='vendor' AND d.dobavljac_id = c.entity_id
    WHERE c.projekat_id = ?
      ${showStornirano ? "" : "AND c.status <> 'STORNIRANO'"}
    ORDER BY c.datum_troska DESC, c.trosak_id DESC
    LIMIT 200
    `,
    [projekatId],
  );

  const costTypesRes = await loadCostTypes();
  const costTypes = costTypesRes.rows;

  if (!project) {
    return (
      <div className="container">
        <h1 style={{ fontSize: 22, marginBottom: 14 }}>Projekat</h1>
        <p>Projekat nije pronađen.</p>
        <p>
          <Link href="/projects">← Nazad na projekte</Link>
        </p>
      </div>
    );
  }

  const sig = signalMeta(project?.operativni_signal);

  const statusIdNum = Number(project?.status_id ?? 0);
  const statusName = String(project?.naziv_statusa ?? `Status ${statusIdNum}`);

  // ✅ SEF: read-only tek kad je fakturisan
  const isReadOnly = statusIdNum === 9;

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .glassbtn {
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          box-shadow: 0 10px 30px rgba(0,0,0,.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: transform .12s ease, background .12s ease, border-color .12s ease;
          text-decoration: none;
          cursor: pointer;
          user-select: none;
        }
        .glassbtn:hover {
          background: rgba(255,255,255,.09);
          border-color: rgba(255,255,255,.26);
        }
        .glassbtn:active {
          transform: scale(.985);
        }
        .backCluster {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .backIcon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .backText {
          line-height: 1.15;
        }
        .backText .mutedLine {
          font-size: 12px;
          opacity: .82;
        }
        .backText .strongLine {
          font-size: 13px;
          font-weight: 650;
        }

        /* ✅ FLUXA BRAND (sa mjerom) */
        .brandWrap {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 10px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.03);
          box-shadow: 0 10px 30px rgba(0,0,0,.12);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .brandLogo {
          height: 28px;
          width: auto;
          display: block;
          opacity: .95;
        }
        .brandTitle {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .6px;
          line-height: 1.05;
        }
        .brandSub {
          font-size: 11px;
          opacity: .72;
          line-height: 1.05;
          margin-top: 2px;
          white-space: nowrap;
        }

        .payBtn {
          padding: 10px 12px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 650;
          white-space: nowrap;
        }
        .noteBox {
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.05);
          white-space: pre-wrap;
        }
        .signalBadge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          font-weight: 750;
          letter-spacing: .3px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
        }
        .signalDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          display: inline-block;
          box-shadow: 0 0 0 3px rgba(255,255,255,.06);
        }
        .sigSelect {
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: inherit;
          outline: none;
        }
        .sigNote {
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: inherit;
          outline: none;
          width: 220px;
          max-width: 40vw;
        }
        .statusBadge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          font-weight: 750;
          letter-spacing: .2px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          opacity: .95;
        }
      `}</style>

      {/* ✅ Topbar uvijek vidljiv; scroll je isključivo u donjem sadržaju */}
      <div style={{ flex: "0 0 auto", position: "sticky", top: 0, zIndex: 20 }}>
        <div className="container">
          <div className="topbar">
            <div className="backCluster">
              <Link
                href="/projects"
                aria-label="Povratak na sve projekte"
                title="Povratak na sve projekte"
                className="glassbtn backIcon"
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>←</span>
              </Link>

              <div className="backText">
                <div className="mutedLine">Povratak</div>
                <div className="strongLine">na sve projekte</div>
              </div>
            </div>

            {/* ✅ FLUXA BRAND */}
            <div className="brandWrap" title="FLUXA — Project & Finance Engine">
              <img
                src="/fluxa/logo-light.png"
                alt="FLUXA"
                className="brandLogo"
              />
              <div>
                <div className="brandTitle">DETALJI PROJEKTA</div>
                <div className="brandSub">Project & Finance Engine</div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {/* ✅ Status (informativno) */}
              <span className="statusBadge" title={`Status ID: ${statusIdNum}`}>
                {statusName}
              </span>

              {/* ✅ Operativni signal (vidljiv timu) */}
              <span
                className="signalBadge"
                title={sig.title}
                style={{ background: sig.bg, borderColor: sig.border }}
              >
                <span className="signalDot" style={{ background: sig.dot }} />
                {sig.label}
              </span>

              {/* ✅ FINAL OK (produkcija završena; ne zaključava) */}
              <FinalOkButtonClient
                projekatId={project.projekat_id}
                disabled={isReadOnly}
              />

              {/* ✅ OWNER KONTROLA SIGNALA */}
              <form
                action={setOperativniSignal}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  opacity: isReadOnly ? 0.55 : 1,
                  pointerEvents: isReadOnly ? "none" : "auto",
                }}
                title={
                  isReadOnly
                    ? "Projekat je fakturisan (read-only)."
                    : "Owner: operativni signal"
                }
              >
                <input
                  type="hidden"
                  name="projekat_id"
                  value={project.projekat_id}
                />
                <input type="hidden" name="return_to" value={returnTo} />

                <select
                  name="operativni_signal"
                  defaultValue={String(
                    project?.operativni_signal ?? "NORMALNO",
                  )}
                  className="sigSelect"
                >
                  <option value="NORMALNO">NORMALNO</option>
                  <option value="PAZNJA">PAŽNJA</option>
                  <option value="STOP">STOP</option>
                </select>

                <input
                  name="note"
                  placeholder="bilješka (opciono)…"
                  className="sigNote"
                  maxLength={500}
                  title="Bilješka (ide u log)"
                />

                <button
                  type="submit"
                  className="glassbtn payBtn"
                  title="Snimi signal (upiši u log)"
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>✅</span>
                  Snimi
                </button>
              </form>

              <Link
                href={`/finance/banka?projekat_id=${project.projekat_id}`}
                title="Banka (projekat)"
                className="glassbtn payBtn"
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>🦦</span>
                Banka
              </Link>

              <Link
                href={`/naplate?projekat_id=${project.projekat_id}`}
                title="Naplate"
                className="glassbtn payBtn"
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>💳</span>
                Naplate
              </Link>
            </div>
          </div>

          {/* ✅ NEW: Timeline ispod naslova/topbar-a */}
          <FluxaTimeline
            phase={phaseFromProjectStatusId(project?.status_id)}
            title="Faza"
          />
        </div>
      </div>

      {/* ✅ Scroll samo donji sadržaj */}
      <div style={{ flex: "1 1 auto", overflowY: "auto" }}>
        <div className="container" style={{ paddingBottom: 24 }}>
          {isReadOnly && (
            <div
              className="card"
              style={{
                marginBottom: 12,
                borderLeft: "6px solid #ef4444",
                background: "rgba(239,68,68,0.08)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                🔒 Read-only
              </div>
              <div style={{ opacity: 0.9 }}>
                Projekat je <b>fakturisan</b> (status: Fakturisan). Izmjene više
                nisu dozvoljene.
              </div>
            </div>
          )}

          <ProjectHeader project={project} />
          <ProjectSummaryCard project={project} />

          {!!project?.napomena && (
            <div className="noteBox">
              <div className="muted" style={{ marginBottom: 6 }}>
                Napomena (Deal)
              </div>
              {project.napomena}
            </div>
          )}

          <ReadOnlyGuard
            isReadOnly={isReadOnly}
            reason="Projekat je fakturisan (read-only). Akcije su onemogućene."
          >
            <CostsPanel
              project={project}
              costs={costs ?? []}
              costTypes={costTypes ?? []}
              showStornirano={showStornirano}
              returnTo={returnTo}
              actions={{ addCost, editCost, setCostStatus }}
            />
          </ReadOnlyGuard>
        </div>
      </div>
    </div>
  );
}
