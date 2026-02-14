# Backup baze

## Jednostavna komanda (ručno)

```bash
mysqldump -u USER -p -h DO_HOST DATABASE > backup_20260211.sql
```

Zamijeni:
- `USER` — MySQL korisnik
- `DO_HOST` — host DigitalOcean baze (npr. `db-mysql-xxx.db.ondigitalocean.com`)
- `DATABASE` — ime baze (npr. `studio_db`)

## Za DO (s portom)

```bash
mysqldump -u USER -p -h DO_HOST -P 25060 DATABASE > backup_$(date +%Y%m%d).sql
```

## Skripte

- **Linux/Mac:** `./scripts/backup-db.sh`
- **Windows PowerShell:** `.\scripts/backup-db.ps1`

Varijable okruženja (opciono):
- `DB_USER`, `DB_HOST`, `DB_NAME`, `BACKUP_DIR`

Backup se snima u `backups/` (ili `$BackupDir`).
