# Backup studio_db iz MySQL Workbench (DigitalOcean)

Da backup bude **konzistentan** i da **nestanu upozorenja** iz loga, u Workbenchu pri exportu dodaj ove opcije.

## Kako u Workbenchu

1. **Server** → **Data Export** (ili Database → Manage Connections → izaberi konekciju, pa Export).
2. Izaberi **studio_db** (ili samo tabele koje trebaš).
3. U **Advanced Options** / **Dump Options** (ili **Export Options**) dodaj u polje **"Other"** ili **"Command Line Options"**:

   ```
   --single-transaction --set-gtid-purged=OFF
   ```

   Ako imaš zasebna polja:
   - **--single-transaction** – konzistentan dump bez zaključavanja (važno za upozorenje o GTID).
   - **--set-gtid-purged=OFF** – isključi GTID u dumpu (uklanja ona dva GTID upozorenja).

4. Pokreni export.

## Šta ove opcije rade

- **--single-transaction** – InnoDB dump u jednoj konzistentnoj “slikovnici”, bez `LOCK TABLES`.
- **--set-gtid-purged=OFF** – u dump se ne pišu GTID transakcije, pa nema upozorenja o “partial dump” i “inconsistent data”.

Nakon toga log za svaku stavku ne bi trebalo da prikazuje ta GTID upozorenja, a backup će biti konzistentan.
