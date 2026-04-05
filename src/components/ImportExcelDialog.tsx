import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  columns: { key: string; label: string; required?: boolean }[];
  templateData: Record<string, string | number>[];
  templateFileName: string;
  onImport: (rows: Record<string, any>[]) => Promise<void>;
  validateRow?: (row: Record<string, any>) => boolean;
  summaryRender?: (rows: Record<string, any>[]) => React.ReactNode;
}

const ImportExcelDialog = ({
  open, onOpenChange, title, columns, templateData, templateFileName,
  onImport, validateRow, summaryRender,
}: ImportExcelDialogProps) => {
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setParsedRows([]); setFileName(""); };

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
        setParsedRows(json);
      } catch {
        toast.error("Gagal membaca file");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const validRows = parsedRows.filter((r) => validateRow ? validateRow(r) : true);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateFileName);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImport(validRows);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          {/* Upload area */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            {fileName ? (
              <p className="text-sm font-medium"><FileSpreadsheet className="inline h-4 w-4 mr-1" />{fileName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Drag & drop file .xlsx/.csv atau klik untuk upload</p>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Unduh Template Excel
          </Button>

          {parsedRows.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {validRows.length} dari {parsedRows.length} baris valid untuk diimport
              </p>

              {summaryRender && summaryRender(validRows)}

              {/* Preview first 5 rows */}
              <div className="border rounded-lg overflow-auto max-h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((c) => (
                        <TableHead key={c.key} className="text-xs whitespace-nowrap">
                          {c.label} {c.required && <span className="text-destructive">*</span>}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((c) => (
                          <TableCell key={c.key} className="text-xs py-1">
                            {String(row[c.key] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedRows.length > 5 && (
                <p className="text-xs text-muted-foreground">...dan {parsedRows.length - 5} baris lainnya</p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Batal</Button>
          <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
            {importing ? "Mengimport..." : `Import ${validRows.length} Data`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportExcelDialog;
