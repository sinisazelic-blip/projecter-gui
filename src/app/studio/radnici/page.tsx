import RadniciClient from "./RadniciClient";
import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export type RadnikRow = {
  radnik_id: number;
  ime: string;
  prezime: string;
  adresa: string | null;
  broj_telefona: string | null;
  email: string | null;
  datum_rodjenja: string | null;
  jib: string | null;
  aktivan: number;
  opis: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export default async function RadniciPage() {
  const existingCols: any[] = await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'radnici'
        AND COLUMN_NAME IN ('broj_telefona','telefon','adresa','email','datum_rodjenja','jib','aktivan','opis','created_at','updated_at')`,
  );
  const colSet = new Set(
    (existingCols ?? []).map((r) => String(r.COLUMN_NAME).toLowerCase()),
  );

  const hasBrojTelefona = colSet.has("broj_telefona");
  const hasTelefon = colSet.has("telefon");
  const hasAdresa = colSet.has("adresa");
  const hasEmail = colSet.has("email");
  const hasDatumRodjenja = colSet.has("datum_rodjenja");
  const hasJib = colSet.has("jib");
  const hasAktivan = colSet.has("aktivan");
  const hasOpis = colSet.has("opis");
  const hasCreatedAt = colSet.has("created_at");
  const hasUpdatedAt = colSet.has("updated_at");

  const sel = [
    "radnik_id",
    "ime",
    "prezime",
    hasAdresa ? "adresa" : "NULL AS adresa",
    hasBrojTelefona
      ? "broj_telefona"
      : hasTelefon
        ? "telefon AS broj_telefona"
        : "NULL AS broj_telefona",
    hasEmail ? "email" : "NULL AS email",
    hasDatumRodjenja ? "datum_rodjenja" : "NULL AS datum_rodjenja",
    hasJib ? "jib" : "NULL AS jib",
    hasAktivan ? "aktivan" : "1 AS aktivan",
    hasOpis ? "opis" : "NULL AS opis",
    hasCreatedAt ? "created_at" : "NULL AS created_at",
    hasUpdatedAt ? "updated_at" : "NULL AS updated_at",
  ].join(", ");

  const orderBy = hasAktivan
    ? "aktivan DESC, prezime ASC, ime ASC"
    : "prezime ASC, ime ASC";

  const rows = await query(
    `SELECT ${sel}
       FROM radnici
       ORDER BY ${orderBy}
       LIMIT 1500`,
  );

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img
                  src="/fluxa/logo-light.png"
                  alt="FLUXA"
                  className="brandLogo"
                />
                <div>
                  <div className="brandTitle">Radnici</div>
                  <div className="brandSub">Studio / Šifarnici</div>
                </div>
              </div>

              <Link href="/dashboard" className="btn" title="Dashboard">
                🏠 Dashboard
              </Link>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <RadniciClient initialItems={(rows ?? []) as RadnikRow[]} />
        </div>
      </div>
    </div>
  );
}
