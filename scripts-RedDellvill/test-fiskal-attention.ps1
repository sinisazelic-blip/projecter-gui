# Test GET /api/attention na fiskalnom uređaju (provjera konekcije + auth)
# Zamijeni IP i KEY vrijednostima iz Aquana/servisera.

$baseUrl = "http://192.168.70.111:3566"   # <-- IP uređaja + port
$bearerKey = "YOUR_KEY"                   # <-- 32-hex npr. 3f481176...

$url = ($baseUrl.TrimEnd("/") + "/api/attention")

$headers = @{
  "Accept" = "application/json, text/json, text/x-json, text/javascript, application/xml, text/xml"
  "Authorization" = "Bearer $bearerKey"
}

try {
  $response = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -UseBasicParsing -TimeoutSec 15
  Write-Host "Status:" $response.StatusCode
  Write-Host "Headers:" ($response.Headers | Out-String)
  Write-Host "Body:" $response.Content
} catch {
  Write-Host "Error:" $_.Exception.Message
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "Response body:" $reader.ReadToEnd()
  }
}

