import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const wb = XLSX.utils.book_new();

  // List "Klijenti" – naziv mora odgovarati šifarniku (Studio → Klijenti)
  const klijentiData = [
    { naziv_klijenta: "Naziv klijenta (tačno kao u šifarniku)", iznos_potrazuje: 0, napomena: "Opciono" },
    { naziv_klijenta: "Primjer doo", iznos_potrazuje: 1500.5, napomena: "" },
  ];
  const wsKlijenti = XLSX.utils.json_to_sheet(klijentiData);
  XLSX.utils.book_append_sheet(wb, wsKlijenti, "Klijenti");

  // List "Dobavljači"
  const dobavljaciData = [
    { naziv: "Naziv dobavljača (tačno kao u šifarniku)", iznos_duga: 0, napomena: "Opciono" },
    { naziv: "Primjer dobavljač", iznos_duga: 800, napomena: "" },
  ];
  const wsDobavljaci = XLSX.utils.json_to_sheet(dobavljaciData);
  XLSX.utils.book_append_sheet(wb, wsDobavljaci, "Dobavljači");

  // List "Talenti"
  const talentiData = [
    { ime_prezime: "Ime i prezime (tačno kao u šifarniku)", iznos_duga: 0, napomena: "Opciono" },
    { ime_prezime: "Ana Anić", iznos_duga: 500, napomena: "" },
  ];
  const wsTalenti = XLSX.utils.json_to_sheet(talentiData);
  XLSX.utils.book_append_sheet(wb, wsTalenti, "Talenti");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pocetna-stanja.xlsx"',
    },
  });
}
