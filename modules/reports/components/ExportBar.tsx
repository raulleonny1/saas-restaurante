"use client";

import type { ExportFormat } from "@/modules/reports/services/export.service";
import { Button } from "@/ui";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

export function ExportBar({
  busy,
  onExport,
}: {
  busy: boolean;
  onExport: (format: ExportFormat) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => onExport("pdf")}
      >
        <FileText className="h-3.5 w-3.5" /> PDF
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => onExport("excel")}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => onExport("csv")}
      >
        <Download className="h-3.5 w-3.5" /> CSV
      </Button>
    </div>
  );
}
