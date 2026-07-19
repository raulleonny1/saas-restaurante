# SmartServe Print Bridge v1.1
# Lista impresoras de Windows para la web (solo 127.0.0.1).
# Uso: doble clic en start-windows.bat  —  deja esta ventana ABIERTA.

$ErrorActionPreference = "Stop"
$port = 17891
$version = "1.2.1"

function Get-PrinterListJson {
  $defaultName = $null
  try {
    $defaultName = (
      Get-CimInstance -ClassName Win32_Printer -Filter "Default=$true" -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty Name
    )
  } catch {}

  $items = New-Object System.Collections.ArrayList
  try {
    foreach ($p in @(Get-Printer -ErrorAction Stop)) {
      [void]$items.Add([PSCustomObject]@{
        name       = [string]$p.Name
        driverName = [string]$p.DriverName
        portName   = [string]$p.PortName
        shared     = [bool]$p.Shared
        isDefault  = ($null -ne $defaultName -and $p.Name -eq $defaultName)
      })
    }
  } catch {
    foreach ($p in @(Get-CimInstance Win32_Printer)) {
      [void]$items.Add([PSCustomObject]@{
        name       = [string]$p.Name
        driverName = [string]$p.DriverName
        portName   = [string]$p.PortName
        shared     = [bool]$p.Shared
        isDefault  = [bool]$p.Default
      })
    }
  }

  # Forzar array JSON aunque haya 0 o 1 impresora
  $payload = [ordered]@{
    ok       = $true
    source   = "windows"
    version  = $version
    printers = @($items.ToArray())
  }
  return ($payload | ConvertTo-Json -Compress -Depth 6)
}

function Get-CorsHeaders([string]$origin) {
  $allowOrigin = if ($origin) { $origin } else { "*" }
  return @(
    "Access-Control-Allow-Origin: $allowOrigin",
    "Vary: Origin",
    "Access-Control-Allow-Methods: GET, OPTIONS",
    "Access-Control-Allow-Headers: Content-Type, Access-Control-Request-Private-Network",
    "Access-Control-Allow-Private-Network: true",
    "Cache-Control: no-store"
  )
}

function Send-HttpResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$Body,
    [string]$Origin,
    [string]$ContentType = "application/json; charset=utf-8"
  )
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $headers = New-Object System.Collections.Generic.List[string]
  [void]$headers.Add("HTTP/1.1 $StatusCode $StatusText")
  [void]$headers.Add("Content-Type: $ContentType")
  [void]$headers.Add("Content-Length: $($bytes.Length)")
  [void]$headers.Add("Connection: close")
  foreach ($h in (Get-CorsHeaders $Origin)) { [void]$headers.Add($h) }
  $head = ($headers -join "`r`n") + "`r`n`r`n"
  $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
  $Stream.Write($headBytes, 0, $headBytes.Length)
  if ($bytes.Length -gt 0) { $Stream.Write($bytes, 0, $bytes.Length) }
  $Stream.Flush()
}

function Get-DiscoverHtml {
  # Pagina local: lee /printers (mismo origen) y envia la lista a SmartServe por postMessage.
  return @'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>SmartServe · Impresoras</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0e1410;color:#e7efe4;margin:0;padding:24px;text-align:center}
    h1{font-size:18px;margin:0 0 8px}
    p{color:#a8b5a4;font-size:13px;line-height:1.4}
    .ok{color:#6ee7a8;font-weight:600;margin-top:16px}
    .err{color:#fca5a5;margin-top:16px}
  </style>
</head>
<body>
  <h1>Buscando impresoras…</h1>
  <p>Asistente local SmartServe. Esta ventana se cierra sola.</p>
  <p id="msg"></p>
  <script>
  (async function () {
    var params = new URLSearchParams(location.search);
    var targetOrigin = params.get("origin") || "*";
    var msg = document.getElementById("msg");
    function send(payload) {
      try {
        if (window.opener) {
          window.opener.postMessage(payload, targetOrigin);
        }
      } catch (e) {}
      setTimeout(function () { window.close(); }, 600);
    }
    try {
      var res = await fetch("/printers", { cache: "no-store" });
      var data = await res.json();
      if (!data.ok && data.ok !== undefined) {
        msg.className = "err";
        msg.textContent = data.error || "Error";
        send({ type: "smartserve-printers", ok: false, error: data.error || "error" });
        return;
      }
      var printers = data.printers || [];
      msg.className = "ok";
      msg.textContent = printers.length + " impresora(s) · volviendo a SmartServe…";
      send({
        type: "smartserve-printers",
        ok: true,
        printers: printers,
        version: data.version || "1.1.0"
      });
    } catch (e) {
      msg.className = "err";
      msg.textContent = "No se pudo leer. Reinicia start-windows.bat";
      send({ type: "smartserve-printers", ok: false, error: String(e && e.message || e) });
    }
  })();
  </script>
</body>
</html>
'@
}

function Read-HttpRequest([System.Net.Sockets.NetworkStream]$Stream) {
  $buffer = New-Object byte[] 8192
  $ms = New-Object System.IO.MemoryStream
  $Stream.ReadTimeout = 5000
  try {
    while ($true) {
      $n = $Stream.Read($buffer, 0, $buffer.Length)
      if ($n -le 0) { break }
      $ms.Write($buffer, 0, $n)
      $text = [System.Text.Encoding]::ASCII.GetString($ms.ToArray())
      if ($text -match "`r`n`r`n") { break }
      if ($ms.Length -gt 65536) { break }
    }
  } catch {}
  return [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
}

# --- Arranque (TcpListener = no necesita admin / URL ACL) ---
try {
  $endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Loopback, $port)
  $listener = New-Object System.Net.Sockets.TcpListener $endpoint
  $listener.Server.SetSocketOption(
    [System.Net.Sockets.SocketOptionLevel]::Socket,
    [System.Net.Sockets.SocketOptionName]::ReuseAddress,
    $true
  )
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "ERROR: no se pudo abrir el puerto $port en este PC."
  Write-Host $_.Exception.Message
  Write-Host ""
  Write-Host "Cierra otra ventana del asistente si ya estaba abierta,"
  Write-Host "o reinicia el PC e intentalo de nuevo."
  Write-Host ""
  Read-Host "Pulsa Enter para salir"
  exit 1
}

# Contar impresoras al inicio (feedback)
try {
  $count = @(Get-Printer -ErrorAction SilentlyContinue).Count
  if ($count -eq 0) { $count = @(Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue).Count }
} catch { $count = "?" }

Write-Host ""
Write-Host "=============================================="
Write-Host "  SmartServe · Asistente de impresoras  v$version"
Write-Host "=============================================="
Write-Host "  ESTADO: ENCENDIDO"
Write-Host "  Direccion: http://127.0.0.1:$port/"
Write-Host "  Impresoras vistas por Windows: $count"
Write-Host "=============================================="
Write-Host "  1) Deja ESTA ventana abierta"
Write-Host "  2) Vuelve a SmartServe en el navegador"
Write-Host "  3) Pulsa Buscar en ventas y en cocina"
Write-Host "=============================================="
Write-Host ""

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $raw = Read-HttpRequest $stream
    if (-not $raw) {
      $client.Close()
      continue
    }

    $lines = $raw -split "`r`n"
    $requestLine = $lines[0]
    $origin = ""
    foreach ($line in $lines) {
      if ($line -match '^[Oo]rigin:\s*(.+)$') {
        $origin = $Matches[1].Trim()
        break
      }
    }

    $method = "GET"
    $path = "/"
    $query = ""
    if ($requestLine -match '^([A-Z]+)\s+(\S+)') {
      $method = $Matches[1].ToUpperInvariant()
      $uri = $Matches[2]
      $parts = $uri.Split("?")
      $path = $parts[0].TrimEnd("/").ToLowerInvariant()
      if (-not $path) { $path = "/" }
      if ($parts.Count -gt 1) { $query = $parts[1] }
    }

    if ($method -eq "OPTIONS") {
      Send-HttpResponse -Stream $stream -StatusCode 204 -StatusText "No Content" -Body "" -Origin $origin
      $client.Close()
      continue
    }

    # Si SmartServe pide listar impresoras (origin=...), servir HTML de descubrimiento
    $wantsDiscover = ($query -match 'origin=') -or ($path -eq "/discover") -or ($path -eq "/picker")

    if ($wantsDiscover -and $path -ne "/printers" -and $path -ne "/health") {
      Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -Body (Get-DiscoverHtml) -Origin $origin -ContentType "text/html; charset=utf-8"
      $client.Close()
      continue
    }

    switch ($path) {
      "/" {
        $body = (@{
          ok = $true; service = "smartserve-print-bridge"; version = $version
          status = "ENCENDIDO"
        } | ConvertTo-Json -Compress)
        Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -Body $body -Origin $origin
      }
      "/health" {
        $body = (@{ ok = $true; status = "up"; version = $version } | ConvertTo-Json -Compress)
        Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -Body $body -Origin $origin
      }
      "/printers" {
        Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -Body (Get-PrinterListJson) -Origin $origin
      }
      "/discover" {
        Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -Body (Get-DiscoverHtml) -Origin $origin -ContentType "text/html; charset=utf-8"
      }
      "/picker" {
        Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -Body (Get-DiscoverHtml) -Origin $origin -ContentType "text/html; charset=utf-8"
      }
      default {
        $body = (@{ ok = $false; error = "not_found"; version = $version } | ConvertTo-Json -Compress)
        Send-HttpResponse -Stream $stream -StatusCode 404 -StatusText "Not Found" -Body $body -Origin $origin
      }
    }
  } catch {
    Write-Host ("Aviso: " + $_.Exception.Message)
  } finally {
    if ($client) { try { $client.Close() } catch {} }
  }
}
