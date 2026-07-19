import type { NamedValue, SeriesPoint } from "@/modules/reports/domain/aggregates";

export type ExportFormat = "csv" | "excel" | "pdf";

export interface ExportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ExportBundle {
  filename: string;
  subtitle: string;
  tables: ExportTable[];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCsv(bundle: ExportBundle) {
  const parts: string[] = [];
  for (const table of bundle.tables) {
    parts.push(table.title);
    parts.push(table.columns.map(escapeCsv).join(";"));
    for (const row of table.rows) {
      parts.push(row.map(escapeCsv).join(";"));
    }
    parts.push("");
  }
  const blob = new Blob(["\uFEFF" + parts.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, `${bundle.filename}.csv`);
}

export async function exportExcel(bundle: ExportBundle) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const table of bundle.tables) {
    const aoa = [table.columns, ...table.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const name = table.title.slice(0, 31) || "Hoja";
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `${bundle.filename}.xlsx`);
}

export async function exportPdf(bundle: ExportBundle) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.text("SmartServe · Reportes", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(bundle.subtitle, 14, 22);
  doc.setTextColor(0);

  let y = 28;
  for (const table of bundle.tables) {
    if (y > 250) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(12);
    doc.text(table.title, 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [table.columns],
      body: table.rows.map((r) => r.map(String)),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 101, 52] },
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error lastAutoTable injected by plugin
    y = (doc.lastAutoTable?.finalY ?? y + 40) + 12;
  }

  doc.save(`${bundle.filename}.pdf`);
}

export async function exportBundle(
  format: ExportFormat,
  bundle: ExportBundle,
) {
  if (format === "csv") exportCsv(bundle);
  else if (format === "excel") await exportExcel(bundle);
  else await exportPdf(bundle);
}

export function seriesTable(
  title: string,
  series: SeriesPoint[],
  valueLabel = "Valor",
  secondaryLabel?: string,
): ExportTable {
  return {
    title,
    columns: secondaryLabel
      ? ["Periodo", valueLabel, secondaryLabel]
      : ["Periodo", valueLabel],
    rows: series.map((p) =>
      secondaryLabel
        ? [p.label, round(p.value), round(p.secondary ?? 0)]
        : [p.label, round(p.value)],
    ),
  };
}

export function namedTable(
  title: string,
  rows: NamedValue[],
  valueLabel = "Valor",
): ExportTable {
  return {
    title,
    columns: ["Nombre", valueLabel, "Meta"],
    rows: rows.map((r) => [r.name, round(r.value), r.meta ?? ""]),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
