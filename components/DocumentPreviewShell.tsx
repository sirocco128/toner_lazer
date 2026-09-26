import type { ReactNode } from "react";
import { DocumentToolbar } from "@/components/DocumentToolbar";

export function DocumentPreviewShell({
  backHref,
  backLabel,
  fileName,
  emphasizePrint = false,
  children,
}: {
  backHref: string;
  backLabel: string;
  fileName: string;
  emphasizePrint?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <DocumentToolbar
        backHref={backHref}
        backLabel={backLabel}
        fileName={fileName}
        emphasizePrint={emphasizePrint}
      />
      <div className="mt-4 overflow-x-auto print:mt-0 print:overflow-visible">
        <div className="flex justify-center bg-ink/[0.06] py-6 print:bg-transparent print:py-0">
          <div className="shadow-xl print:shadow-none">
            <div
              id="document-sheet"
              className="document-sheet box-border w-[210mm] max-w-[210mm] min-h-[297mm] overflow-hidden bg-white px-[12mm] py-[12mm] print:max-w-none print:min-h-0 print:w-auto print:overflow-visible print:px-0 print:py-0"
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
