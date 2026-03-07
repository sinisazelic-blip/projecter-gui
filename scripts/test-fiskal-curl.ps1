# Test POST na fiskalni uređaj – Aquana stil (Bearer + /api/invoices)
$baseUrl = "http://192.168.70.156:3566"  # <-- IP uređaja + port
$apiPath = "/api/invoices"               # <-- path koji Aquana koristi
$bearerKey = "YOUR_KEY"                  # <-- 32-hex npr. 3f481176...
$url = ($baseUrl.TrimEnd("/") + $apiPath)
$body = @{
  invoiceType = 0
  transactionType = 0
  payment = @( @{ amount = 1; paymentType = 4 } )
  items = @( @{ name = "Test"; quantity = 1; unitPrice = 1; totalAmount = 1; labels = @("N"); gtin = "00000000" } )
} | ConvertTo-Json -Depth 5

$headers = @{
  "Content-Type" = "application/json"
  "Accept"       = "application/json, text/json, text/x-json, text/javascript, application/xml, text/xml"
  "Authorization" = "Bearer $bearerKey"
}

try {
  $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 30
  Write-Host "Status:" $response.StatusCode
  Write-Host "Body:" $response.Content
} catch {
  Write-Host "Error:" $_.Exception.Message
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "Response body:" $reader.ReadToEnd()
  }
}
