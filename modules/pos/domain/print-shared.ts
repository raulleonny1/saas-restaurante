import type { ThermalPaperWidth } from "@/types/restaurant";

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Abre el diálogo de impresión del sistema (impresoras USB/red ya instaladas). */
export function openPrintHtml(html: string, title: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.title = title;
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        iframe.remove();
      }, 60_000);
    };
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function thermalPageCss(paperWidthMm: ThermalPaperWidth = 80): string {
  const content = paperWidthMm === 58 ? 50 : 72;
  return `
    @page{margin:0;size:${paperWidthMm}mm auto}
    *{box-sizing:border-box}
    body{
      font-family:"Courier New",ui-monospace,Consolas,monospace;
      font-size:${paperWidthMm === 58 ? 11 : 13}px;
      line-height:1.28;color:#111;
      width:${content}mm;margin:0 auto;padding:3mm 2.5mm;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;
    }
    .hint{
      background:#111;color:#fff;padding:8px 10px;margin:0 0 10px;
      font-size:11px;line-height:1.35;border-radius:4px;
      font-family:system-ui,sans-serif;
    }
    .hint strong{display:block;font-size:12px;margin-bottom:2px}
    .rule{border:none;border-top:1px dashed #222;margin:8px 0}
    .rule-d{border:none;border-top:2px dashed #111;margin:10px 0}
    @media print{
      .hint{display:none!important}
      body{padding:2mm 1.5mm}
    }
  `;
}

export function printerHintHtml(opts: {
  roleLabel: string;
  systemName?: string;
}): string {
  const name = opts.systemName?.trim();
  const pick = name
    ? `Elige <strong>${escapeHtml(name)}</strong> en el diálogo de Windows.`
    : `Elige la impresora de <strong>${escapeHtml(opts.roleLabel)}</strong> en el diálogo.`;
  return `<div class="hint"><strong>Impresión · ${escapeHtml(opts.roleLabel)}</strong>${pick}
    La primera vez, marca «Establecer como predeterminada» si siempre usas esta.</div>`;
}
