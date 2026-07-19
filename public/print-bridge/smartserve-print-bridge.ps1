# SmartServe Print Bridge — lista impresoras instaladas en este PC.
# Solo escucha en 127.0.0.1 (no accesible desde la red).
# Uso: doble clic en start-windows.bat

$ErrorActionPreference = "Stop"
$port = 17891
$prefix = "http://127.0.0.1:$port/"

function Get-PrinterListJson {
  $defaultName = $null
  try {
    $defaultName = (
      Get-CimInstance -ClassName Win32_Printer -Filter "Default=$true" -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty Name
    )
  } catch { }

  try {
    $list = @(Get-Printer -ErrorAction Stop | ForEach-Object {
      [PSCustomObject]@{
        name       = $_.Name
        driverName = $_.DriverName
        portName   = $_.PortName
        shared     = [bool]$_.Shared
        isDefault  = ($null -ne $defaultName -and $_.Name -eq $defaultName)
      }
    })
  } catch {
    # Fallback WMI (Windows antiguos / sin módulo PrintManagement)
    $list = @(Get-CimInstance Win32_Printer | ForEach-Object {
      [PSCustomObject]@{
        name       = $_.Name
        driverName = $_.DriverName
        portName   = $_.PortName
        shared     = [bool]$_.Shared
        isDefault  = [bool]$_.Default
      }
    })
  }
  return (@{
    ok       = $true
    source   = "windows"
    printers = $list
  } | ConvertTo-Json -Compress -Depth 4)
}

function Send-Response($ctx, [int]$status, [string]$body, [string]$contentType = "application/json; charset=utf-8") {
  $origin = $ctx.Request.Headers["Origin"]
  if ($origin) {
    $ctx.Response.Headers.Add("Access-Control-Allow-Origin", $origin)
    $ctx.Response.Headers.Add("Vary", "Origin")
  } else {
    $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
  }
  $ctx.Response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS")
  $ctx.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = $contentType
  $buffer = [System.Text.Encoding]::UTF8.GetBytes($body)
  $ctx.Response.ContentLength64 = $buffer.Length
  $ctx.Response.OutputStream.Write($buffer, 0, $buffer.Length)
  $ctx.Response.OutputStream.Close()
}

# Reservar URL (puede pedir admin la primera vez)
try {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add($prefix)
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "No se pudo abrir $prefix"
  Write-Host $_.Exception.Message
  Write-Host ""
  Write-Host "Prueba ejecutar este .bat como administrador una vez,"
  Write-Host "o cierra otro programa que use el puerto $port."
  Write-Host ""
  Read-Host "Enter para salir"
  exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host " SmartServe · Asistente de impresoras"
Write-Host "========================================"
Write-Host " Escuchando: $prefix"
Write-Host " Deja esta ventana ABIERTA mientras usas la caja."
Write-Host " En la app pulsa: Buscar impresoras instaladas"
Write-Host " Cierra esta ventana para apagar el asistente."
Write-Host "========================================"
Write-Host ""

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = $ctx.Request.Url.AbsolutePath.TrimEnd("/").ToLowerInvariant()
  if (-not $path) { $path = "/" }

  if ($ctx.Request.HttpMethod -eq "OPTIONS") {
    Send-Response $ctx 204 ""
    continue
  }

  try {
    switch ($path) {
      "/" {
        Send-Response $ctx 200 (@{
          ok      = $true
          service = "smartserve-print-bridge"
          version = "1.0.0"
        } | ConvertTo-Json -Compress) 
      }
      "/health" {
        Send-Response $ctx 200 (@{ ok = $true; status = "up" } | ConvertTo-Json -Compress)
      }
      "/printers" {
        Send-Response $ctx 200 (Get-PrinterListJson)
      }
      default {
        Send-Response $ctx 404 (@{ ok = $false; error = "not_found" } | ConvertTo-Json -Compress)
      }
    }
  } catch {
    Send-Response $ctx 500 (@{
      ok    = $false
      error = $_.Exception.Message
    } | ConvertTo-Json -Compress)
  }
}
