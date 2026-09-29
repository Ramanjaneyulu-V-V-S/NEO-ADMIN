// ─── Shared CSV / XLSX export helpers (Blob download, no backend involvement) ──

const csvEscape = (val) => {
    const s = String(val ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function downloadCsv(headers, rows, filename) {
    const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, filename);
}

/**
 * @param {Array<{name: string, columns: Array<{header: string, key: string, width?: number}>, rows: Array<Object>}>} sheets
 * @param {string} filename
 */
export async function downloadXlsx(sheets, filename) {
    // Loaded on demand so the library is not part of the initial bundle
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    const thin  = { style: 'thin', color: { argb: 'FF808080' } };
    const boxed = { top: thin, left: thin, bottom: thin, right: thin };

    for (const sheet of sheets) {
        const ws = wb.addWorksheet(sheet.name);
        ws.columns = sheet.columns;

        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle' };
        headerRow.height = 20;
        headerRow.eachCell(cell => { cell.border = boxed; });

        for (const row of sheet.rows) ws.addRow(row);

        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            row.alignment = { vertical: 'top', wrapText: true };
            row.eachCell(cell => { cell.border = boxed; });
        });

        ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerDownload(blob, filename);
}

/**
 * Roster-style workbook: leading "group" columns (e.g. Department, Vertical) are true
 * merged Excel cells, with one row per user in the trailing (non-merged) columns. Merging is
 * hierarchical — column 0 spans every consecutive row sharing its value (e.g. Department spans
 * all of its Vertical sub-groups), column 1 spans consecutive rows sharing columns 0 AND 1, and
 * so on. `rows` must already be sorted by the group key columns (outermost first).
 * @param {Array<{
 *   name: string,
 *   groupColumns: Array<{header: string, width?: number}>,
 *   trailingColumns: Array<{header: string, width?: number}>,
 *   rows: Array<{keyVals: string[], trailing: string[]}>,
 * }>} sheets
 * @param {string} filename
 */
export async function downloadRosterXlsx(sheets, filename) {
    // Loaded on demand so the library is not part of the initial bundle
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    const thin  = { style: 'thin', color: { argb: 'FF808080' } };
    const boxed = { top: thin, left: thin, bottom: thin, right: thin };

    for (const sheet of sheets) {
        const ws = wb.addWorksheet(sheet.name);
        const nGroupCols = sheet.groupColumns.length;
        ws.columns = [...sheet.groupColumns, ...sheet.trailingColumns].map(c => ({ header: c.header, width: c.width }));

        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle' };
        headerRow.height = 20;
        headerRow.eachCell(cell => { cell.border = boxed; });

        const colRunStart = new Array(nGroupCols).fill(2);
        let prevKeyVals = null;
        let excelRow = 2;
        for (const row of sheet.rows) {
            ws.addRow([...row.keyVals, ...row.trailing]);
            if (prevKeyVals) {
                for (let c = 0; c < nGroupCols; c++) {
                    const samePrefix = row.keyVals.slice(0, c + 1).every((v, i) => v === prevKeyVals[i]);
                    if (!samePrefix) {
                        if (excelRow - 1 > colRunStart[c]) ws.mergeCells(colRunStart[c], c + 1, excelRow - 1, c + 1);
                        colRunStart[c] = excelRow;
                    }
                }
            }
            prevKeyVals = row.keyVals;
            excelRow++;
        }
        for (let c = 0; c < nGroupCols; c++) {
            if (excelRow - 1 > colRunStart[c]) ws.mergeCells(colRunStart[c], c + 1, excelRow - 1, c + 1);
        }

        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            row.alignment = { vertical: 'top', wrapText: true };
            row.eachCell(cell => { cell.border = boxed; });
        });

        ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerDownload(blob, filename);
}

// ─── Generic result-grid export (column list + array of row objects) ──────────

/** CSV from a flat `{ columns: string[], rows: Object[] }` result set. */
export function downloadGridCsv(columns, rows, filename) {
    const body = rows.map((row) => columns.map((col) => row[col] ?? ''));
    downloadCsv(columns, body, filename);
}

/** Single-sheet XLSX from a flat `{ columns: string[], rows: Object[] }` result set. */
export function downloadGridXlsx(columns, rows, filename, sheetName = 'Results') {
    return downloadXlsx(
        [{
            name: sheetName.slice(0, 31) || 'Results',
            columns: columns.map((col) => ({ header: col, key: col, width: Math.min(60, Math.max(12, col.length + 2)) })),
            rows: rows.map((row) => {
                const out = {};
                for (const col of columns) out[col] = row[col] ?? '';
                return out;
            }),
        }],
        filename,
    );
}

/**
 * Runs `fn` over `items` with at most `limit` in flight at once.
 * Failures are swallowed to `null` so one bad request doesn't abort the batch.
 */
export async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let idx = 0;
    async function worker() {
        while (idx < items.length) {
            const current = idx++;
            try {
                results[current] = await fn(items[current], current);
            } catch {
                results[current] = null;
            }
        }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
}
