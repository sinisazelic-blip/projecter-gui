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
};

export type RoleOption = {
  role_id: number;
  naziv: string;
};

export default async function UsersPage() {
  const [rows, roles] = await Promise.all([
    query<UserRow>(`
      SELECT
        u.user_id,
        u.username,
        u.role_id,
        r.naziv AS role_naziv,
        u.aktivan,
        u.last_login_at,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id
      ORDER BY u.aktivan DESC, u.username ASC
      LIMIT 2000
    `),
    query<RoleOption>(`SELECT role_id, naziv FROM roles ORDER BY naziv ASC LIMIT 500`),
  ]);

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
          />
        </div>
      </div>
    </div>
  );
}
