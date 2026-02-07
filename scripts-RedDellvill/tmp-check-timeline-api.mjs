const inicijacijaId = 15; // <<< stavi problematični
const res = await fetch(`http://localhost:3000/api/inicijacije/timeline?inicijacija_id=${inicijacijaId}`, {
  cache: "no-store",
  headers: { "cache-control": "no-store" },
});
const json = await res.json().catch(() => null);
console.log(JSON.stringify(json, null, 2));
