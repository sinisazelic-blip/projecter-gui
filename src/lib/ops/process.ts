/** Enter operativa — dokumenti, inicijatori i vrata. */

export const OPS_SAAS_LINIJE = [
  { id: "ENTER", label: "Enter" },
  { id: "RENTAL", label: "Rental" },
  { id: "LOCKERS", label: "Lockers" },
  { id: "CCTV", label: "CCTV" },
  { id: "MOJTV", label: "MojTV" },
  { id: "DOORMAN", label: "DoorMan" },
  { id: "MOJRADIO", label: "MojRadio" },
  { id: "LAN_WIFI", label: "LAN + WiFi" },
  { id: "ALAT", label: "Alat (nije HaaS)" },
  { id: "OSTALO", label: "Ostalo" },
] as const;

export type OpsSaasLinija = (typeof OPS_SAAS_LINIJE)[number]["id"];

export const RN_POSAO_STATUSES = [
  "NACRT",
  "OTVOREN",
  "NA_RAMP",
  "NA_TERENU",
  "POVRAT",
  "RAZDUZEN",
  "ZATVOREN",
] as const;

export type RnPosaoStatus = (typeof RN_POSAO_STATUSES)[number];

export const RDN_VRSTE = ["SKLAPANJE", "SERVIS"] as const;
export type RdnVrsta = (typeof RDN_VRSTE)[number];

export const PRIJEM_IZVORI = ["KUF", "KES", "PROIZVODNJA"] as const;
export type PrijemIzvor = (typeof PRIJEM_IZVORI)[number];

export function isOpsSaasLinija(v: string): v is OpsSaasLinija {
  return OPS_SAAS_LINIJE.some((x) => x.id === v);
}

export function isRnPosaoOtvoren(status: string): boolean {
  return !["RAZDUZEN", "ZATVOREN"].includes(String(status || "").toUpperCase());
}

/** Terenska ekipa ne smije otpisati. Otpis samo iz radionice. */
export function assertOtpisSamoRadionica(akcija: string, povrat?: string | null) {
  if (akcija === "OTPIS" || povrat === "OTPIS") {
    throw new Error("OTPIS_SAMO_RADIONICA");
  }
}
