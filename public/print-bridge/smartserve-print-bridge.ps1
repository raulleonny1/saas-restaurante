# SmartServe Print Bridge v1.3.0
# Lista impresoras + abre cajón portamonedas (ESC/POS) vía impresora TPV.
# Uso: doble clic en start-windows.bat  —  deja esta ventana ABIERTA.

$ErrorActionPreference = "Stop"
$port = 17891
$version = "1.3.0"

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

  $payload = [ordered]@{
    ok       = $true
    source   = "windows"
    version  = $version
    printers = @($items.ToArray())
  }
  return ($payload | ConvertTo-Json -Compress -Depth 6)
}

function Ensure-RawPrinterType {
  if (-not ("SmartServeRawPrinter" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class SmartServeRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

  public static string SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter = IntPtr.Zero;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      return "open_failed:" + Marshal.GetLastWin32Error();
    }
    try {
      DOCINFOA di = new DOCINFOA();
      di.pDocName = "SmartServe Cash Drawer";
      di.pDataType = "RAW";
      if (!StartDocPrinter(hPrinter, 1, di)) {
        return "startdoc_failed:" + Marshal.GetLastWin32Error();
      }
      try {
        if (!StartPagePrinter(hPrinter)) {
          return "startpage_failed:" + Marshal.GetLastWin32Error();
        }
        try {
          IntPtr pUnmanaged = Marshal.AllocCoTaskMem(bytes.Length);
          try {
            Marshal.Copy(bytes, 0, pUnmanaged, bytes.Length);
            int written;
            if (!WritePrinter(hPrinter, pUnmanaged, bytes.Length, out written)) {
              return "write_failed:" + Marshal.GetLastWin32Error();
            }
          } finally {
            Marshal.FreeCoTaskMem(pUnmanaged);
          }
        } finally {
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
    return "ok";
  }
}
"@
  }
}

function Open-CashDrawer {
  param(
    [Parameter(Mandatory = $true)][string]$PrinterName,
    [int]$Pin = 0
  )
  $name = $PrinterName.Trim()
  if (-not $name) {
    return (@{ ok = $false; error = "missing_printer"; version = $version } | ConvertTo-Json -Compress)
  }

  # ESC/POS: ESC p m t1 t2  →  impulsos al cajón (RJ11 en impresora térmica)
  $m = if ($Pin -eq 1) { [byte]1 } else { [byte]0 }
  $bytes = [byte[]](0x1B, 0x70, $m, 0x19, 0xFA)

  try {
    Ensure-RawPrinterType
    $result = [SmartServeRawPrinter]::SendBytes($name, $bytes)
    if ($result -eq "ok") {
      return (@{
        ok = $true
        kicked = $true
        printer = $name
        pin = [int]$m
        version = $version
      } | ConvertTo-Json -Compress)
    }
    return (@{
      ok = $false
      error = "print_failed"
      detail = $result
      printer = $name
      version = $version
    } | ConvertTo-Json -Compress)
  } catch {
    return (@{
      ok = $false
      error = "exception"
      detail = $_.Exception.Message
      printer = $name
      version = $version
    } | ConvertTo-Json -Compress)
  }
}

function Get-CorsHeaders([string]$origin) {
  $allowOrigin = if ($origin) { $origin } else { "*" }
  return @(
    "Access-Control-Allow-Origin: $allowOrigin",
    "Vary: Origin",
    "Access-Control-Allow-Methods: GET, POST, OPTIONS",
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
        version: data.version || "1.3.0"
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

function Get-DrawerKickHtml {
  return @'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>SmartServe · Cajón</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0e1410;color:#e7efe4;margin:0;padding:24px;text-align:center}
    h1{font-size:18px;margin:0 0 8px}
    p{color:#a8b5a4;font-size:13px}
    .ok{color:#6ee7a8;font-weight:600;margin-top:16px}
    .err{color:#fca5a5;margin-top:16px}
  </style>
</head>
<body>
  <h1>Abriendo cajón…</h1>
  <p id="msg"></p>
  <script>
  (async function () {
    var params = new URLSearchParams(location.search);
    var targetOrigin = params.get("origin") || "*";
    var printer = params.get("printer") || "";
    var pin = params.get("pin") || "0";
    var msg = document.getElementById("msg");
    function send(payload) {
      try {
        if (window.opener) window.opener.postMessage(payload, targetOrigin);
      } catch (e) {}
      setTimeout(function () { window.close(); }, 500);
    }
    try {
      var url = "/drawer/kick?printer=" + encodeURIComponent(printer) + "&pin=" + encodeURIComponent(pin);
      var res = await fetch(url, { cache: "no-store" });
      var data = await res.json();
      if (data.ok) {
        msg.className = "ok";
        msg.textContent = "Cajón abierto";
        send({ type: "smartserve-drawer", ok: true, version: data.version });
      } else {
        msg.className = "err";
        msg.textContent = data.detail || data.error || "Error";
        send({ type: "smartserve-drawer", ok: false, error: data.detail || data.error || "error" });
      }
    } catch (e) {
      msg.className = "err";
      msg.textContent = "Fallo al abrir cajón";
      send({ type: "smartserve-drawer", ok: false, error: String(e && e.message || e) });
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
      if ($text -match "`r`n`r`n") {
        $headerEnd = $text.IndexOf("`r`n`r`n")
        $headerPart = $text.Substring(0, $headerEnd)
        $contentLength = 0
        foreach ($line in ($headerPart -split "`r`n")) {
          if ($line -match '^[Cc]ontent-[Ll]ength:\s*(\d+)$') {
            $contentLength = [int]$Matches[1]
            break
          }
        }
        $bodyStart = $headerEnd + 4
        $bodyBytesSoFar = $ms.Length - $bodyStart
        while ($bodyBytesSoFar -lt $contentLength) {
          $n2 = $Stream.Read($buffer, 0, $buffer.Length)
          if ($n2 -le 0) { break }
          $ms.Write($buffer, 0, $n2)
          $bodyBytesSoFar = $ms.Length - $bodyStart
        }
        break
      }
      if ($ms.Length -gt 262144) { break }
    }
  } catch {}
  return [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
}

function Get-QueryValue([string]$Query, [string]$Key) {
  if (-not $Query) { return "" }
  foreach ($pair in ($Query -split "&")) {
    $kv = $pair.Split("=", 2)
    if ($kv.Count -lt 1) { continue }
    $k = [System.Uri]::UnescapeDataString($kv[0])
    if ($k -ne $Key) { continue }
    if ($kv.Count -lt 2) { return "" }
    return [System.Uri]::UnescapeDataString($kv[1])
  }
  return ""
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
Write-Host "  3) Cajon: cable RJ11 en impresora de ventas"
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

    $headerEndIdx = $raw.IndexOf("`r`n`r`n")
    $headerText = if ($headerEndIdx -ge 0) { $raw.Substring(0, $headerEndIdx) } else { $raw }
    $bodyText = if ($headerEndIdx -ge 0) { $raw.Substring($headerEndIdx + 4) } else { "" }

    $lines = $headerText -split "`r`n"
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

    $wantsDiscover = ($query -match 'origin=') -or ($path -eq "/discover") -or ($path -eq "/picker")

    if ($wantsDiscover -and $path -ne "/printers" -and $path -ne "/health" -and $path -ne "/drawer/kick" -and $path -ne "/drawer/ui") {
      Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -Body (Get-DiscoverHtml) -Origin $origin -ContentType "text/html; charset=utf-8"
      $client.Close()
      continue
    }

    switch ($path) {
      "/" {
        $body = (@{
          ok = $true; service = "smartserve-print-bridge"; version = $version
          status = "ENCENDIDO"
          features = @("printers", "drawer")
        } | ConvertTo-Json -Compress)
        Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -Body $body -Origin $origin
      }
      "/health" {
        $body = (@{ ok = $true; status = "up"; version = $version; features = @("printers", "drawer") } | ConvertTo-Json -Compress)
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
      "/drawer/ui" {
        Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -Body (Get-DrawerKickHtml) -Origin $origin -ContentType "text/html; charset=utf-8"
      }
      "/drawer/kick" {
        $printer = Get-QueryValue $query "printer"
        $pinStr = Get-QueryValue $query "pin"
        if ($method -eq "POST" -and $bodyText) {
          try {
            $json = $bodyText | ConvertFrom-Json
            if ($json.printer) { $printer = [string]$json.printer }
            if ($null -ne $json.pin) { $pinStr = [string]$json.pin }
          } catch {}
        }
        $pin = 0
        if ($pinStr -eq "1") { $pin = 1 }
        if (-not $printer) {
          $body = (@{ ok = $false; error = "missing_printer"; version = $version } | ConvertTo-Json -Compress)
          Send-HttpResponse -Stream $stream -StatusCode 400 -StatusText "Bad Request" -Body $body -Origin $origin
        } else {
          $body = Open-CashDrawer -PrinterName $printer -Pin $pin
          $ok = $body -match '"ok":true'
          $code = if ($ok) { 200 } else { 500 }
          $text = if ($ok) { "OK" } else { "Error" }
          Send-HttpResponse -Stream $stream -StatusCode $code -StatusText $text -Body $body -Origin $origin
        }
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
