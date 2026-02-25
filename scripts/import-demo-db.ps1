# Skripta za import dump fajlova (samo struktura) u bazu preko command line.
# Koristi se za demo bazu ili za prazne baze novih Fluxa klijenata.
#
# ========== ZA NOVOG KLIJENTA (NOVA PRAZNA BAZA) ==========
# 1. Na DigitalOcean (ili gdje hostuješ MySQL) kreiraj novu praznu bazu:
#    npr. studio_db_imeklijenta (istim userom/privilegijama kao ostale baze).
# 2. Ispod promijeni samo $database na ime te baze.
# 3. Pokreni skriptu i unesi password kad zatraži.
# Ostalo (dump folder, host, port, user, SSL) ostaje isto ako sve držiš na istom serveru.

$dumpFolder = "C:\Users\Studio\OneDrive\mysql tools\Stukture_NEW\Fluxa_FULL20022026"
$mysqlExe = "mysql.exe"
$dbHost = "db-mysql-nyc3-63902-do-user-31436457-0.e.db.ondigitalocean.com"
$dbPort = "25060"
$dbUser = "doadmin"
$database = "studio_db_demo"   # Za novog klijenta: npr. studio_db_imeklijenta
$sslCa = "C:\Users\Studio\OneDrive\mysql tools\DO Studio TAF\ca-certificate.crt"

# Traži mysql.exe u PATH ili uobičajenim lokacijama
$mysqlPath = Get-Command mysql.exe -ErrorAction SilentlyContinue
if (-not $mysqlPath) {
    $commonPaths = @(
        "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe",
        "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe",
        "C:\xampp\mysql\bin\mysql.exe"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $mysqlExe = $path
            break
        }
    }
}

Write-Host "MySQL executable: $mysqlExe" -ForegroundColor Cyan
Write-Host "Target database: $database" -ForegroundColor Cyan
Write-Host "Dump folder: $dumpFolder" -ForegroundColor Cyan
Write-Host ""

# Traži password
$password = Read-Host "Unesi MySQL password za $dbUser" -AsSecureString
$passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
)

# Kreiraj privremeni config fajl za mysql (bez password-a u command line)
$configFile = [System.IO.Path]::GetTempFileName()
$configContent = @"
[client]
host=$dbHost
port=$dbPort
user=$dbUser
password=$passwordPlain
ssl-ca=$sslCa
ssl-mode=VERIFY_CA
default-character-set=utf8mb4
"@
Set-Content -Path $configFile -Value $configContent

try {
    Write-Host "Povezivanje sa bazom..." -ForegroundColor Yellow
    
    # Test konekcije
    $testResult = & $mysqlExe --defaults-file=$configFile --database=$database -e "SELECT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Greška pri povezivanju: $testResult" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Konekcija uspješna!" -ForegroundColor Green
    Write-Host ""
    
    # Privremeno onemogući foreign key checks za cijeli import
    Write-Host "Onemogućavanje foreign key checks..." -ForegroundColor Yellow
    $disableFK = "SET FOREIGN_KEY_CHECKS=0; SET UNIQUE_CHECKS=0;"
    $fkResult = $disableFK | & $mysqlExe --defaults-file=$configFile --database=$database 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Upozorenje: Nije moguće onemogućiti foreign key checks: $fkResult" -ForegroundColor Yellow
    }
    
    Write-Host "Importovanje SQL fajlova..." -ForegroundColor Yellow
    Write-Host ""
    
    # Routines.sql mora biti na kraju jer sadrži VIEW-ove koji zavise od tabela
    $allFiles = Get-ChildItem -Path $dumpFolder -Filter "*.sql" | Sort-Object Name
    $routinesFile = $allFiles | Where-Object { $_.Name -like "*routines*" }
    $tableFiles = $allFiles | Where-Object { $_.Name -notlike "*routines*" }
    
    # Prvo importuj sve tabele, pa routines na kraju
    $sqlFiles = $tableFiles
    if ($routinesFile) {
        $sqlFiles += $routinesFile
        Write-Host "Napomena: routines.sql će biti importovan na kraju (nakon svih tabela)" -ForegroundColor Cyan
        Write-Host ""
    }
    
    $total = $sqlFiles.Count
    Write-Host "Pronađeno $total SQL fajlova za import" -ForegroundColor Cyan
    Write-Host "(Napomena: MySQL može prikazivati drugačiji broj ako broji objekte umjesto fajlova)" -ForegroundColor Gray
    Write-Host ""
    $current = 0
    $errors = @()
    
    foreach ($file in $sqlFiles) {
        $current++
        $percent = [math]::Round(($current / $total) * 100, 1)
        Write-Host "[$current/$total] ($percent%) Importing: $($file.Name)" -ForegroundColor Gray
        
        # Učitaj SQL fajl i ukloni problematične SET komande koje zahtijevaju SUPER privilegije
        $sqlContent = Get-Content $file.FullName -Raw -Encoding UTF8
        
        # Zamijeni USE studio_db sa ciljnom bazom (varijabla $database)
        $sqlContent = $sqlContent -replace 'USE\s+`?studio_db`?\s*;', "USE ``$database``;"
        $sqlContent = $sqlContent -replace 'USE\s+studio_db\s*;', "USE ``$database``;"
        
        # Ukloni GTID blok PRVO (pre bilo kojeg SET @@GLOBAL), inače ostane drugi red stringa
        $sqlContent = $sqlContent -replace '(?m)^--\s*GTID.*$', ''
        $sqlContent = $sqlContent -replace "(?s)SET\s+@@GLOBAL\.GTID_PURGED=.*?';\r?\n?", ''
        
        # Ukloni MySQL conditional comments sa SET komandama (/*!40101 SET ... */)
        $sqlContent = $sqlContent -replace '/\*!\d+\s+SET\s+.*?\*/;?\s*', ''
        
        # Ukloni SET komande sa @@SESSION. i @@GLOBAL. (zahtijevaju SUPER)
        $sqlContent = $sqlContent -replace '(?m)^SET\s+@@SESSION\.[A-Z_]+\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+@@GLOBAL\.[A-Z_]+\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+@@[A-Z_]+\s*=.*?;?\s*$', ''
        
        # Ukloni SET komande sa @OLD_ varijablama
        $sqlContent = $sqlContent -replace '(?m)^SET\s+@OLD_[A-Z_]+\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+@MYSQLDUMP_TEMP_[A-Z_]+\s*=.*?;?\s*$', ''
        
        # Ukloni standardne SET komande koje zahtijevaju SUPER privilegije
        $sqlContent = $sqlContent -replace '(?m)^SET\s+sql_mode\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+character_set_client\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+character_set_results\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+collation_connection\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+time_zone\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+autocommit\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+NAMES\s+.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+foreign_key_checks\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+unique_checks\s*=.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^SET\s+sql_big_selects\s*=.*?;?\s*$', ''
        
        # Ukloni LOCK/UNLOCK TABLES
        $sqlContent = $sqlContent -replace '(?m)^LOCK\s+TABLES.*?;?\s*$', ''
        $sqlContent = $sqlContent -replace '(?m)^UNLOCK\s+TABLES\s*;?\s*$', ''
        
        # Ukloni MySQL conditional comments sa SET komandama (/*!...SET...*/)
        $sqlContent = $sqlContent -replace '(?s)/\*!\d+\s+SET\s+[^*]*\*/;?\s*', ''
        
        # Svaki fajl ide u novu mysql sesiju – uključi checks=0 na početak da DROP/CREATE rade bez FK grešaka
        $sqlContent = "SET FOREIGN_KEY_CHECKS=0; SET UNIQUE_CHECKS=0;`n" + $sqlContent
        $sqlContent = $sqlContent + "`nSET FOREIGN_KEY_CHECKS=1; SET UNIQUE_CHECKS=1;"
        
        # Koristi --database parametar koji override-uje USE statemente u fajlu
        $result = $sqlContent | & $mysqlExe --defaults-file=$configFile --database=$database 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            $errorMsg = "Greška u $($file.Name): $result"
            Write-Host "  ✗ $errorMsg" -ForegroundColor Red
            $errors += $errorMsg
        } else {
            Write-Host "  ✓ OK" -ForegroundColor Green
        }
    }
    
    Write-Host ""
    
    # Ponovo omogući foreign key checks nakon importa
    Write-Host "Omogućavanje foreign key checks..." -ForegroundColor Yellow
    $enableFK = "SET FOREIGN_KEY_CHECKS=1; SET UNIQUE_CHECKS=1;"
    $fkResult = $enableFK | & $mysqlExe --defaults-file=$configFile --database=$database 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Upozorenje: Nije moguće omogućiti foreign key checks: $fkResult" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Import završen!" -ForegroundColor Green
    
    if ($errors.Count -gt 0) {
        Write-Host ""
        Write-Host "Greške ($($errors.Count)):" -ForegroundColor Yellow
        foreach ($err in $errors) {
            Write-Host "  - $err" -ForegroundColor Red
        }
    } else {
        Write-Host "Svi fajlovi su uspješno importovani!" -ForegroundColor Green
    }
    
} finally {
    # Obriši config fajl sa password-om
    Remove-Item $configFile -Force -ErrorAction SilentlyContinue
    # Obriši password iz memorije
    $passwordPlain = $null
    $password = $null
}
