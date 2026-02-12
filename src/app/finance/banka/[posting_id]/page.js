import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + " KM";
};

const fmtDate = (d) => {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  if (!y || !m || !day) return String(d);
  return `${day}.${m}.${y}`;
};

const fmtDT = (d) => {
  if (!d) return "—";
  const s = String(d).replace("T", " ").slice(0, 19);
  const [date, time] = s.split(" ");
  if (!date) return String(d);
  const [y, m, day] = date.split("-");
  if (!y || !m || !day) return s;
  return `${day}.${m}.${y}${time ? " " + time : ""}`;
};

function badge(text, kind = "neutral") {
  const cls =
    kind === "ok"
      ? "badge badge-green"
      : kind === "warn"
        ? "badge badge-orange"
        : kind === "bad"
          ? "badge badge-red"
          : "badge";
  return <span className={cls}>{text}</span>;
}

function allocBadge(a) {
  const v = String(a ?? "").toUpperCase();
  if (v === "OK") return badge("OK", "ok");
  if (v === "UNLINKED") return badge("UNLINKED", "warn");
  if (v === "OVER_ALLOCATED") return badge("OVER_ALLOCATED", "bad");
  return badge(v || "—");
}

function clampNeedle(s) {
  const x = (s ?? "").toString().trim();
  if (!x) return "";
  return x.length > 40 ? x.slice(0, 40) : x;
}

/**
 * 2.25 helper: provjeri da li posting ima aktivne linkove (bilo koji tip).
 * Koristi se i u UI i u server actions.
 */
async function getPostingLinkState(postingId) {
  const [a, b, c, d] = await Promise.all([
    query(
      `SELECT COUNT(*) AS cnt
       FROM bank_tx_posting_prihod_link
       WHERE posting_id = ? AND aktivan = 1`,
      [postingId],
    ).catch(async () => [{ cnt: 0 }]),
    query(
      `SELECT COUNT(*) AS cnt
       FROM bank_tx_posting_placanje_link
       WHERE posting_id = ? AND aktivan = 1`,
      [postingId],
    ).catch(async () => [{ cnt: 0 }]),
    query(
      `SELECT COUNT(*) AS cnt
       FROM bank_tx_cost_link
       WHERE posting_id = ?`,
      [postingId],
    ).catch(async () => [{ cnt: 0 }]),
    query(
      `SELECT COUNT(*) AS cnt
       FROM bank_tx_fixed_link
       WHERE posting_id = ?`,
      [postingId],
    ).catch(async () => [{ cnt: 0 }]),
  ]);

  const incomeCnt = Number(a?.[0]?.cnt ?? 0);
  const payCnt = Number(b?.[0]?.cnt ?? 0);
  const costCnt = Number(c?.[0]?.cnt ?? 0);
  const fixedCnt = Number(d?.[0]?.cnt ?? 0);

  return {
    incomeCnt,
    payCnt,
    costCnt,
    fixedCnt,
    anyActive: incomeCnt > 0 || payCnt > 0 || costCnt > 0 || fixedCnt > 0,
  };
}

/**
 * 2.25 helper: učitaj posting + sanity (alloc/link_total) na siguran način.
 */
async function loadPosting(pid) {
  let posting = null;
  try {
    const rows = await query(
      `
      SELECT
        f.posting_id,
        f.tx_id,
        f.batch_id,
        f.value_date,
        f.amount,
        f.currency,
        f.counterparty,
        f.description,
        f.linked_income_km,
        f.linked_payment_km,
        f.linked_cost_km,
        f.linked_fixed_km,
        f.linked_total_km,
        f.alloc_status,
        f.committed_at,
        f.reversed_at,
        f.reversed_by_batch_id
      FROM v_bank_posting_feed f
      WHERE f.posting_id = ?
      LIMIT 1
      `,
      [pid],
    );
    posting = rows?.[0] ?? null;
  } catch {
    const rows = await query(
      `
      SELECT
        posting_id, tx_id, batch_id, value_date, amount, currency, counterparty, description,
        committed_at, reversed_at, reversed_by_batch_id
      FROM bank_tx_posting
      WHERE posting_id = ?
      LIMIT 1
      `,
      [pid],
    );
    posting = rows?.[0] ?? null;

    if (posting) {
      try {
        const s = await query(
          `
          SELECT
            s.posting_id,
            COALESCE(s.linked_total_km, 0) AS linked_total_km,
            COALESCE(s.alloc_status, '—') AS alloc_status
          FROM v_bank_posting_sanity s
          WHERE s.posting_id = ?
          LIMIT 1
          `,
          [pid],
        );
        if (s?.[0]) {
          posting.linked_total_km = s[0].linked_total_km;
          posting.alloc_status = s[0].alloc_status;
        } else {
          posting.linked_total_km = 0;
          posting.alloc_status = "—";
        }
      } catch {
        posting.linked_total_km = 0;
        posting.alloc_status = "—";
      }
    }
  }

  return posting;
}

/**
 * 2.24/2.25 — CREATE INCOME + LINK FROM POSTING (server action)
 * Guardrails:
 * - posting mora postojati
 * - ne smije biti reversed
 * - alloc mora biti UNLINKED
 * - ne smije već imati bilo koji aktivan link
 */
async function createIncomeAndLinkFromPosting(formData) {
  "use server";

  const postingId = Number(formData.get("posting_id"));
  const projekatId = Number(formData.get("projekat_id"));
  const amountKm = Number.parseFloat(
    String(formData.get("amountkm") ?? "").replace(",", "."),
  );
  const datum = String(formData.get("datum") || "").slice(0, 10);
  const opis = String(formData.get("opis") || "").trim();
  const napomena = String(formData.get("napomena") || "").trim();

  if (!Number.isFinite(postingId) || postingId <= 0) redirect("/finance/banka");
  if (!Number.isFinite(projekatId) || projekatId <= 0)
    redirect(`/finance/banka/${postingId}`);
  if (!Number.isFinite(amountKm) || amountKm <= 0)
    redirect(`/finance/banka/${postingId}`);
  if (!datum || !opis) redirect(`/finance/banka/${postingId}`);

  const posting = await loadPosting(postingId);
  if (!posting) redirect(`/finance/banka/${postingId}`);

  const isReversed = !!posting.reversed_at || !!posting.reversed_by_batch_id;
  if (isReversed) redirect(`/finance/banka/${postingId}?msg=reversed`);

  const alloc = String(posting.alloc_status ?? "").toUpperCase();
  if (alloc !== "UNLINKED")
    redirect(`/finance/banka/${postingId}?msg=not_unlinked`);

  const linkState = await getPostingLinkState(postingId);
  if (linkState.anyActive)
    redirect(`/finance/banka/${postingId}?msg=already_linked`);

  const rawAmount = Number(posting.amount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0)
    redirect(`/finance/banka/${postingId}?msg=wrong_sign`);

  // Create prihod (try common schemas)
  let prihodId = null;

  try {
    const res = await query(
      `
      INSERT INTO projektni_prihodi
        (projekat_id, datum, iznos_km, opis, napomena, status)
      VALUES (?, ?, ?, ?, ?, 'NASTALO')
      `,
      [projekatId, datum, amountKm, opis, napomena || null],
    );
    prihodId = res?.insertId ?? null;
  } catch {}

  if (!prihodId) {
    try {
      const res = await query(
        `
        INSERT INTO projektni_prihodi
          (projekat_id, datum, iznos_km, opis, napomena)
        VALUES (?, ?, ?, ?, ?)
        `,
        [projekatId, datum, amountKm, opis, napomena || null],
      );
      prihodId = res?.insertId ?? null;
    } catch {}
  }

  if (!prihodId) {
    const res = await query(
      `
      INSERT INTO projektni_prihodi
        (projekat_id, datum, iznos_km, opis)
      VALUES (?, ?, ?, ?)
      `,
      [projekatId, datum, amountKm, opis],
    );
    prihodId = res?.insertId ?? null;
  }

  if (!Number.isFinite(prihodId) || prihodId <= 0)
    redirect(`/finance/banka/${postingId}`);

  await query(
    `
    INSERT INTO bank_tx_posting_prihod_link
      (posting_id, prihod_id, amount_km, aktivan, created_at)
    VALUES (?, ?, ?, 1, NOW())
    `,
    [postingId, prihodId, amountKm],
  );

  revalidatePath(`/finance/banka/${postingId}`);
  revalidatePath(`/finance/banka`);
  revalidatePath(`/finance/prihodi`);
  revalidatePath(`/finance/prihodi/${prihodId}`);
  revalidatePath(`/projects/${projekatId}`);

  redirect(`/finance/banka/${postingId}?msg=created_income`);
}

/**
 * 2.24/2.25 — CREATE PAYMENT + LINK FROM POSTING (server action)
 * Guardrails:
 * - posting mora postojati
 * - ne smije biti reversed
 * - alloc mora biti UNLINKED
 * - ne smije već imati bilo koji aktivan link
 */
async function createPaymentAndLinkFromPosting(formData) {
  "use server";

  const postingId = Number(formData.get("posting_id"));
  const amountKm = Number.parseFloat(
    String(formData.get("amount_km") ?? "").replace(",", "."),
  );
  const datum = String(formData.get("datum") || "").slice(0, 10);
  const partner = String(formData.get("partner") || "").trim();
  const opis = String(formData.get("opis") || "").trim();
  const napomena = String(formData.get("napomena") || "").trim();

  if (!Number.isFinite(postingId) || postingId <= 0) redirect("/finance/banka");
  if (!Number.isFinite(amountKm) || amountKm <= 0)
    redirect(`/finance/banka/${postingId}`);
  if (!datum || !opis) redirect(`/finance/banka/${postingId}`);

  const posting = await loadPosting(postingId);
  if (!posting) redirect(`/finance/banka/${postingId}`);

  const isReversed = !!posting.reversed_at || !!posting.reversed_by_batch_id;
  if (isReversed) redirect(`/finance/banka/${postingId}?msg=reversed`);

  const alloc = String(posting.alloc_status ?? "").toUpperCase();
  if (alloc !== "UNLINKED")
    redirect(`/finance/banka/${postingId}?msg=not_unlinked`);

  const linkState = await getPostingLinkState(postingId);
  if (linkState.anyActive)
    redirect(`/finance/banka/${postingId}?msg=already_linked`);

  const rawAmount = Number(posting.amount);
  if (!Number.isFinite(rawAmount) || rawAmount >= 0)
    redirect(`/finance/banka/${postingId}?msg=wrong_sign`);

  // Create placanje (try common schemas)
  let placanjeId = null;

  try {
    const res = await query(
      `
      INSERT INTO placanja
        (datum, iznos_km, partner, opis, napomena, status)
      VALUES (?, ?, ?, ?, ?, 'NASTALO')
      `,
      [datum, amountKm, partner || null, opis, napomena || null],
    );
    placanjeId = res?.insertId ?? null;
  } catch {}

  if (!placanjeId) {
    try {
      const res = await query(
        `
        INSERT INTO placanja
          (datum, iznos_km, partner, opis, napomena)
        VALUES (?, ?, ?, ?, ?)
        `,
        [datum, amountKm, partner || null, opis, napomena || null],
      );
      placanjeId = res?.insertId ?? null;
    } catch {}
  }

  if (!placanjeId) {
    const res = await query(
      `
      INSERT INTO placanja
        (datum, iznos_km, opis)
      VALUES (?, ?, ?)
      `,
      [datum, amountKm, opis],
    );
    placanjeId = res?.insertId ?? null;
  }

  if (!Number.isFinite(placanjeId) || placanjeId <= 0)
    redirect(`/finance/banka/${postingId}`);

  await query(
    `
    INSERT INTO bank_tx_posting_placanje_link
      (posting_id, placanje_id, amount_km, aktivan, created_at)
    VALUES (?, ?, ?, 1, NOW())
    `,
    [postingId, placanjeId, amount_km ?? amountKm],
  );

  revalidatePath(`/finance/banka/${postingId}`);
  revalidatePath(`/finance/banka`);
  revalidatePath(`/finance/placanja`);
  revalidatePath(`/finance/placanja/${placanjeId}`);

  redirect(`/finance/banka/${postingId}?msg=created_payment`);
}

function msgText(code) {
  const c = String(code || "");
  if (c === "created_income")
    return { text: "Kreiran prihod i linkovan na posting.", kind: "ok" };
  if (c === "created_payment")
    return { text: "Kreirano plaćanje i linkovano na posting.", kind: "ok" };
  if (c === "already_linked")
    return {
      text: "Ovaj posting je već linkovan (ili ima cost/fixed link).",
      kind: "warn",
    };
  if (c === "not_unlinked")
    return {
      text: "Posting nije UNLINKED — quick-create nije dozvoljen.",
      kind: "warn",
    };
  if (c === "reversed")
    return {
      text: "Posting je reversed — quick-create nije dozvoljen.",
      kind: "bad",
    };
  if (c === "wrong_sign")
    return { text: "Neispravan smjer iznosa za ovu akciju.", kind: "warn" };
  return null;
}

export default async function BankPostingDetailPage({ params, searchParams }) {
  const { posting_id } = await Promise.resolve(params);
  const sp = await Promise.resolve(searchParams);

  const pid = Number(posting_id);

  if (!Number.isFinite(pid)) {
    return (
      <div className="container">
        <div className="card">
          <div className="h2">Greška</div>
          <div className="subtle">Neispravan posting_id.</div>
          <div style={{ marginTop: 12 }}>
            <Link className="btn" href="/finance/banka">
              Nazad
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const posting = await loadPosting(pid);

  if (!posting) {
    return (
      <div className="container">
        <div className="topbar glass">
          <div className="topbar-left">
            <h1 className="h1">Banka — detalj</h1>
            <div className="subtle">Posting #{pid} nije pronađen.</div>
          </div>
          <div className="topbar-right">
            <Link className="btn" href="/finance/banka">
              Nazad
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="subtle">Provjeri ID ili listu.</div>
        </div>
      </div>
    );
  }

  const needle = clampNeedle(posting.counterparty || posting.description);
  const bankFilterHref = needle
    ? `/finance/banka?q=${encodeURIComponent(needle)}`
    : "/finance/banka";

  const isReversed = !!posting.reversed_at || !!posting.reversed_by_batch_id;
  const alloc = String(posting.alloc_status ?? "").toUpperCase();
  const isUnlinked =
    alloc === "UNLINKED" || Number(posting.linked_total_km ?? 0) === 0;

  const amount = Number(posting.amount);
  const absAmount = Number.isFinite(amount) ? Math.abs(amount) : null;

  // Links (za prikaz + guardrails)
  const prihodLinks = await query(
    `
    SELECT link_id, posting_id, prihod_id, amount_km, aktivan, created_at
    FROM bank_tx_posting_prihod_link
    WHERE posting_id = ?
    ORDER BY link_id
    `,
    [pid],
  ).catch(async () => []);

  const placanjeLinks = await query(
    `
    SELECT link_id, posting_id, placanje_id, amount_km, aktivan, created_at
    FROM bank_tx_posting_placanje_link
    WHERE posting_id = ?
    ORDER BY link_id
    `,
    [pid],
  ).catch(async () => []);

  const costLinks = await query(
    `
    SELECT link_id, posting_id, tx_id, batch_id, account_id, projekat_id, trosak_row_id, created_at
    FROM bank_tx_cost_link
    WHERE posting_id = ?
    ORDER BY link_id
    `,
    [pid],
  ).catch(async () => []);

  const fixedLinks = await query(
    `
    SELECT link_id, posting_id, tx_id, batch_id, account_id, fiksni_trosak_id, created_at
    FROM bank_tx_fixed_link
    WHERE posting_id = ?
    ORDER BY link_id
    `,
    [pid],
  ).catch(async () => []);

  const linkState = {
    incomeCnt: prihodLinks.filter((x) => Number(x.aktivan) === 1).length,
    payCnt: placanjeLinks.filter((x) => Number(x.aktivan) === 1).length,
    costCnt: costLinks.length,
    fixedCnt: fixedLinks.length,
  };
  const anyActive =
    linkState.incomeCnt > 0 ||
    linkState.payCnt > 0 ||
    linkState.costCnt > 0 ||
    linkState.fixedCnt > 0;

  // ✅ 2.25 UI guardrails
  const canQuickCreate =
    !isReversed &&
    isUnlinked &&
    alloc === "UNLINKED" &&
    !anyActive &&
    Number.isFinite(absAmount) &&
    absAmount > 0;

  const defaultOpis = (posting.description || "Bank transakcija")
    .toString()
    .trim();
  const defaultPartner = (posting.counterparty || "").toString().trim();

  const msg = msgText(sp?.msg);

  return (
    <div className="container">
      <div className="topbar glass">
        <div className="topbar-left">
          <h1 className="h1">Banka — posting #{posting.posting_id}</h1>
          <div className="subtle">
            datum: <b>{fmtDate(posting.value_date)}</b> · tx_id:{" "}
            <b>{posting.tx_id}</b> · batch: <b>{posting.batch_id}</b>
          </div>
        </div>

        <div
          className="topbar-right"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <Link className="btn" href={bankFilterHref}>
            Nazad (filter)
          </Link>
          <Link className="btn" href="/finance/banka">
            Nazad
          </Link>
        </div>
      </div>

      {msg
        ? <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {badge(
                msg.kind === "ok" ? "OK" : msg.kind === "bad" ? "STOP" : "INFO",
                msg.kind,
              )}
              <div style={{ fontWeight: 800 }}>{msg.text}</div>
            </div>
          </div>
        : null}

      {/* SUMMARY */}
      <div className="card">
        <div
          className="card-row"
          style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <div className="label">Iznos</div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtKM(posting.amount)}{" "}
              <span
                className="subtle"
                style={{ fontSize: 14, fontWeight: 700 }}
              >
                {posting.currency ?? "BAM"}
              </span>
            </div>
            <div className="subtle" style={{ marginTop: 6 }}>
              alloc: {allocBadge(posting.alloc_status)} · reversed:{" "}
              {isReversed ? badge("YES", "bad") : badge("NO", "ok")}
            </div>

            <div className="subtle" style={{ marginTop: 6 }}>
              linkovi: prihod {linkState.incomeCnt}, plaćanje {linkState.payCnt}
              , cost {linkState.costCnt}, fixed {linkState.fixedCnt}
            </div>
          </div>

          <div style={{ minWidth: 320, flex: 1 }}>
            <div className="label">Partner / opis</div>
            <div style={{ fontWeight: 900 }}>
              {defaultPartner ? defaultPartner : "—"}
            </div>
            <div className="subtle" style={{ marginTop: 6 }}>
              {defaultOpis}
            </div>
          </div>

          <div>
            <div className="label">Committed</div>
            <div style={{ fontWeight: 900 }}>{fmtDT(posting.committed_at)}</div>
            {posting.reversed_at
              ? <div className="subtle">
                  reversed_at: {fmtDT(posting.reversed_at)}
                </div>
              : <div className="subtle">reversed_at: —</div>}
          </div>
        </div>

        <div className="hr" />
        <div className="subtle" style={{ lineHeight: 1.7 }}>
          <b>Read-only.</b> Banka je canonical truth. Ovo je samo mapiranje
          značenja.
        </div>
      </div>

      {/* ✅ 2.25 — Quick create panel samo kad je strogo dozvoljeno */}
      {canQuickCreate
        ? <div className="card">
            <div className="h2" style={{ marginBottom: 10 }}>
              UNLINKED — kreiraj “meaning”
            </div>
            <div className="subtle" style={{ marginBottom: 12 }}>
              Ovo pravi novi zapis (Prihod ili Plaćanje) i odmah ga linkuje na
              ovaj posting.
            </div>

            {amount > 0
              ? <div className="card" style={{ margin: 0 }}>
                  <div className="h2" style={{ marginBottom: 10 }}>
                    Kreiraj PRIHOD + link
                  </div>

                  <form
                    action={createIncomeAndLinkFromPosting}
                    className="card-row"
                    style={{ gap: 12, flexWrap: "wrap" }}
                  >
                    <input
                      type="hidden"
                      name="posting_id"
                      value={posting.posting_id}
                    />

                    <div style={{ width: 160 }}>
                      <div className="label">datum</div>
                      <input
                        className="input"
                        name="datum"
                        defaultValue={String(posting.value_date).slice(0, 10)}
                      />
                    </div>

                    <div style={{ width: 180 }}>
                      <div className="label">amount_km</div>
                      <input
                        className="input"
                        name="amount_km"
                        defaultValue={absAmount?.toFixed(2) ?? ""}
                      />
                    </div>

                    <div style={{ width: 180 }}>
                      <div className="label">projekat_id</div>
                      <input
                        className="input"
                        name="projekat_id"
                        placeholder="npr. 77"
                      />
                      <div className="subtle" style={{ marginTop: 6 }}>
                        Prihod mora imati projekat.
                      </div>
                    </div>

                    <div style={{ minWidth: 320, flex: 1 }}>
                      <div className="label">opis</div>
                      <input
                        className="input"
                        name="opis"
                        defaultValue={defaultOpis}
                      />
                    </div>

                    <div style={{ minWidth: 260, flex: 1 }}>
                      <div className="label">napomena (opcionalno)</div>
                      <input
                        className="input"
                        name="napomena"
                        defaultValue={
                          defaultPartner ? `partner: ${defaultPartner}` : ""
                        }
                      />
                    </div>

                    <div
                      style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}
                    >
                      <button className="btn btn--active" type="submit">
                        Kreiraj prihod
                      </button>
                    </div>
                  </form>
                </div>
              : null}

            {amount < 0
              ? <div className="card" style={{ marginTop: 14 }}>
                  <div className="h2" style={{ marginBottom: 10 }}>
                    Kreiraj PLAĆANJE + link
                  </div>

                  <form
                    action={createPaymentAndLinkFromPosting}
                    className="card-row"
                    style={{ gap: 12, flexWrap: "wrap" }}
                  >
                    <input
                      type="hidden"
                      name="posting_id"
                      value={posting.posting_id}
                    />

                    <div style={{ width: 160 }}>
                      <div className="label">datum</div>
                      <input
                        className="input"
                        name="datum"
                        defaultValue={String(posting.value_date).slice(0, 10)}
                      />
                    </div>

                    <div style={{ width: 180 }}>
                      <div className="label">amount_km</div>
                      <input
                        className="input"
                        name="amount_km"
                        defaultValue={absAmount?.toFixed(2) ?? ""}
                      />
                    </div>

                    <div style={{ minWidth: 320, flex: 1 }}>
                      <div className="label">partner (opcionalno)</div>
                      <input
                        className="input"
                        name="partner"
                        defaultValue={defaultPartner}
                      />
                    </div>

                    <div style={{ minWidth: 320, flex: 1 }}>
                      <div className="label">opis</div>
                      <input
                        className="input"
                        name="opis"
                        defaultValue={defaultOpis}
                      />
                    </div>

                    <div style={{ minWidth: 260, flex: 1 }}>
                      <div className="label">napomena (opcionalno)</div>
                      <input
                        className="input"
                        name="napomena"
                        defaultValue=""
                      />
                    </div>

                    <div
                      style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}
                    >
                      <button className="btn btn--active" type="submit">
                        Kreiraj plaćanje
                      </button>
                    </div>
                  </form>
                </div>
              : null}
          </div>
        : <div className="card">
            <div className="h2" style={{ marginBottom: 8 }}>
              Quick-create status
            </div>

            {isReversed
              ? <div className="subtle">
                  ⛔ Posting je <b>reversed</b> — quick-create je zabranjen.
                </div>
              : alloc !== "UNLINKED"
                ? <div className="subtle">
                    ℹ Posting nije <b>UNLINKED</b> — quick-create nije potreban.
                  </div>
                : anyActive
                  ? <div className="subtle">
                      ℹ Posting već ima linkove (prihod/plaćanje/cost/fixed) —
                      quick-create je isključen.
                    </div>
                  : <div className="subtle">
                      ℹ Quick-create nije dostupan (provjeri iznos / stanje).
                    </div>}
          </div>}

      {/* Ostatak detalja (link tabele) — zadrži kako si već imao u 2.24 */}
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>
          Linkovi (pregled)
        </div>
        <div className="subtle">
          Ovdje ostaju tvoje tabele za prihod/plaćanje/cost/fixed (kao u 2.24).
          Ako želiš, u 2.26 ćemo ih “polirati” i dodati deactivate toggle
          (aktivan=0) kao soft-unlink.
        </div>
      </div>

      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>
          Quick navigacija
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn btn--active" href={bankFilterHref}>
            Nazad (filter)
          </Link>
          <Link className="btn" href="/finance/banka">
            Nazad (lista)
          </Link>
          <Link className="btn" href="/finance">
            Finansije
          </Link>
        </div>
      </div>
    </div>
  );
}
