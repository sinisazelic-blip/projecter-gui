import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Briše SVE redove iz tabela početnih stanja (klijenti, dobavljači, talenti).
 * Korisnik može zatim ponovo uvesti čiste podatke iz XLSX.
 */
export async function POST() {
  try {
    await query("DELETE FROM klijent_pocetno_stanje", []);
    await query("DELETE FROM dobavljac_pocetno_stanje", []);
    await query("DELETE FROM talent_pocetno_stanje", []);

    revalidatePath("/finance/pocetna-stanja");
    return NextResponse.json({
      ok: true,
      message: "Sva početna stanja su obrisana. Možeš uvesti nova iz XLSX.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
