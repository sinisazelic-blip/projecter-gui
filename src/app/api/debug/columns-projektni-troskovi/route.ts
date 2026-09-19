import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT || "25060");

  if (!host || !user || !password || !database) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing env vars. Need DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (and optionally DB_PORT).",
        present: {
          DB_HOST: !!host,
          DB_USER: !!user,
          DB_PASSWORD: !!password,
          DB_NAME: !!database,
          DB_PORT: process.env.DB_PORT || null,
        },
      },
      { status: 500 },
    );
  }

  try {
    const conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
      // DO managed mysql često traži TLS; za debug dopuštamo ovu opciju
      ssl: { rejectUnauthorized: false },
      connectTimeout: 8000,
    });

    const [tables]: any = await conn.query("SHOW TABLES LIKE '%talent%'");
    const [pocetna]: any = await conn.query("SELECT * FROM talent_pocetno_stanje LIMIT 10").catch(() => []);
    const [pocetnaSum]: any = await conn.query("SELECT SUM(iznos_duga) AS total_dug FROM talent_pocetno_stanje WHERE COALESCE(otpisano,0) = 0").catch(() => []);
    const [troskoviTalenti]: any = await conn.query("SELECT COUNT(*) AS cnt, SUM(iznos_km) AS total FROM projektni_troskovi WHERE entity_type = 'talent' OR talent_id IS NOT NULL").catch(() => []);
    const [dugovanjaTalenti]: any = await conn.query("SELECT COUNT(*) AS cnt, SUM(iznos_km) AS total FROM projekt_dugovanja WHERE talent_id IS NOT NULL").catch(() => []);
    const [stgTalenti]: any = await conn.query("SELECT COUNT(*) AS cnt, SUM(COALESCE(iznos_km, iznos, 0)) AS total FROM stg_troskovi_talenti_old").catch(() => []);
    const [talenti]: any = await conn.query("SELECT COUNT(*) AS cnt FROM talenti").catch(() => []);
    await conn.end();

    return NextResponse.json({
      ok: true,
      tables,
      pocetnaSum,
      pocetnaSample: pocetna,
      troskoviTalenti,
      dugovanjaTalenti,
      stgTalenti,
      talenti,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || String(e),
        code: e?.code,
      },
      { status: 500 },
    );
  }
}
