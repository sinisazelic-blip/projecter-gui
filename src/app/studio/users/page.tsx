import UsersClient from "./UsersClient";
import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export type UserRow = {
  user_id: number;
  username: string;
  role_id: number;
  role_naziv: string | null;
  aktivan: number; // 1/0
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  radnik_id: number | null;
  radnik_ime_prezime: string | null;
};

export type RoleOption = {
  role_id: number;
  naziv: string;
};

export type RadnikOption = {
  radnik_id: number;
  ime: string;
  prezime: string;
};

export default async function UsersPage() {
  const [rows, roles, radnici] = await Promise.all([
    query<UserRow>(`
      SELECT
        u.user_id,
        u.username,
        u.role_id,
        r.naziv AS role_naziv,
        u.aktivan,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        u.radnik_id,
        CONCAT(rad.ime, ' ', rad.prezime) AS radnik_ime_prezime
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN radnici rad ON rad.radnik_id = u.radnik_id
      ORDER BY u.aktivan DESC, u.username ASC
      LIMIT 2000
    `),
    query<RoleOption>(`SELECT role_id, naziv FROM roles ORDER BY naziv ASC LIMIT 500`),
    query<RadnikOption>(`SELECT radnik_id, ime, prezime FROM radnici WHERE aktivan = 1 ORDER BY prezime ASC, ime ASC LIMIT 1000`),
  ]);

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <img
                    src="/fluxa/logo-light.png"
                    alt="FLUXA"
                    className="brandLogo"
                  />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">Korisnici</div>
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
          <UsersClient
            initialItems={(rows ?? []) as UserRow[]}
            roles={(roles ?? []) as RoleOption[]}
            radnici={(radnici ?? []) as RadnikOption[]}
          />
        </div>
      </div>
    </div>
  );
}
