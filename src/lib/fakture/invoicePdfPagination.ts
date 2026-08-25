/**
 * Priprema fakture za html2pdf: lomi tabelu po stranicama A4 i ponavlja thead.
 * html2canvas ne poštuje @media print — zato se redovi inače režu na pola.
 */

const MM_TO_PX = 96 / 25.4;
/** Printable visina (A4 297mm − ~20mm margine/padding) */
const PAGE_CONTENT_HEIGHT_PX = 277 * MM_TO_PX;

type SplitState = {
  breakEl: HTMLDivElement;
  continuedWrap: HTMLDivElement;
  movedRows: HTMLTableRowElement[];
  sourceTbody: HTMLTableSectionElement;
};

function relTop(paper: HTMLElement, el: Element): number {
  return el.getBoundingClientRect().top - paper.getBoundingClientRect().top;
}

function measureTail(paper: HTMLElement): number {
  const totals = paper.querySelector<HTMLElement>(".totalsRow");
  const footer = paper.querySelector<HTMLElement>(".footer");
  return (totals?.offsetHeight ?? 0) + (footer?.offsetHeight ?? 0) + 16;
}

function cloneTableHead(
  sourceTable: HTMLTableElement,
): HTMLTableSectionElement | null {
  const thead = sourceTable.querySelector("thead");
  if (!thead) return null;
  return thead.cloneNode(true) as HTMLTableSectionElement;
}

function getAllRows(paper: HTMLElement): HTMLTableRowElement[] {
  return Array.from(
    paper.querySelectorAll<HTMLTableRowElement>(".tblWrap tbody tr"),
  );
}

function findOverflowSplitIndex(
  paper: HTMLElement,
  rows: HTMLTableRowElement[],
  tailHeight: number,
): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowTop = relTop(paper, row);
    const rowBottom = rowTop + row.offsetHeight;
    const pageStart =
      Math.floor(rowTop / PAGE_CONTENT_HEIGHT_PX) * PAGE_CONTENT_HEIGHT_PX;
    const pageEnd = pageStart + PAGE_CONTENT_HEIGHT_PX;
    const isLastRow = i === rows.length - 1;
    const reserve = isLastRow ? tailHeight : 0;

    if (rowBottom + reserve > pageEnd + 0.5) {
      return i === 0 ? 1 : i;
    }
  }
  return -1;
}

/**
 * Ubaci page-break i nastavak tabele prije prvog reda koji ne stane na trenutnu stranicu.
 * Vraća cleanup za vraćanje originalnog DOM-a.
 */
export function applyInvoicePdfPagination(paper: HTMLElement): () => void {
  const splits: SplitState[] = [];
  const primaryTable = paper.querySelector<HTMLTableElement>(".tblWrap table");
  if (!primaryTable) return () => {};

  let guard = 0;
  while (guard++ < 20) {
    const rows = getAllRows(paper);
    if (rows.length < 2) break;

    void paper.offsetHeight;

    const tailHeight = measureTail(paper);
    const splitAt = findOverflowSplitIndex(paper, rows, tailHeight);
    if (splitAt < 0) break;

    const moving = rows.slice(splitAt);
    const sourceRow = rows[splitAt];
    const sourceTbody = sourceRow.closest("tbody") as HTMLTableSectionElement;
    const sourceTable = sourceTbody?.closest("table") as HTMLTableElement;
    const sourceWrap = sourceTable?.closest(".tblWrap") as HTMLElement;
    if (!sourceTbody || !sourceTable || !sourceWrap) break;

    const breakEl = document.createElement("div");
    breakEl.className = "invoice-pdf-page-break";
    breakEl.setAttribute("style", "page-break-before: always; break-before: page;");

    const continuedWrap = document.createElement("div");
    continuedWrap.className = "tblWrap table-wrap invoice-table-continued";

    const continuedTable = document.createElement("table");
    continuedTable.className = sourceTable.className || "table";

    const clonedHead = cloneTableHead(primaryTable);
    if (clonedHead) continuedTable.appendChild(clonedHead);

    const continuedBody = document.createElement("tbody");
    for (const row of moving) continuedBody.appendChild(row);
    continuedTable.appendChild(continuedBody);
    continuedWrap.appendChild(continuedTable);

    sourceWrap.insertAdjacentElement("afterend", breakEl);
    breakEl.insertAdjacentElement("afterend", continuedWrap);

    splits.push({ breakEl, continuedWrap, movedRows: moving, sourceTbody });
    void paper.offsetHeight;
  }

  return () => {
    for (let i = splits.length - 1; i >= 0; i--) {
      const { breakEl, continuedWrap, movedRows, sourceTbody } = splits[i];
      for (const row of movedRows) sourceTbody.appendChild(row);
      continuedWrap.remove();
      breakEl.remove();
    }
  };
}

export const INVOICE_PDF_EXPORT_CSS = `
  .paper.is-pdf-export {
    min-height: 277mm !important;
    width: 210mm !important;
    padding: 10mm 8mm !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    display: flex !important;
    flex-direction: column !important;
  }
  .paper.is-pdf-export .cols2 {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 14px !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .paper.is-pdf-export .totalsBox {
    width: 100% !important;
    max-width: 320px !important;
    padding: 10px 12px !important;
    box-sizing: border-box !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .paper.is-pdf-export .footer {
    margin-top: auto !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .paper.is-pdf-export .invRow,
  .paper.is-pdf-export .cols2,
  .paper.is-pdf-export .footer,
  .paper.is-pdf-export .totalsBox {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .paper.is-pdf-export tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .paper.is-pdf-export .invoice-pdf-page-break {
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
  }
  .paper.is-pdf-export .invoice-table-continued {
    margin-top: 0 !important;
  }
`;
