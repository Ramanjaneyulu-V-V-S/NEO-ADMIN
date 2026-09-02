import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import { EmptyState } from './EmptyState';

/**
 * DataTable — one table treatment for the whole app.
 *
 * columns: [{
 *   key,                       // unique; also the default sort key
 *   header,                    // column title ('' allowed, e.g. actions)
 *   render?(row, i) => node,   // defaults to row[key]
 *   align?: 'left'|'center'|'right',
 *   mono?: boolean,            // tabular mono figures (IDs, counts, dates)
 *   sortable?: boolean,
 *   sortKey?: string,          // if the sort id differs from `key`
 *   width?: string,            // tailwind width class for the <th>
 *   card?: 'body'|'footer'|'hide',   // placement in the mobile folio card
 *   primary?: boolean,         // the headline field on the mobile card
 *   cardLabel?: string,        // label override on the mobile card
 * }]
 *
 * rows, rowKey(row,i), loading, skeletonRows,
 * sort: { key, dir } | null,  onSortChange(next),
 * empty: { icon, title, description, action },
 * onRowClick?(row)
 */
export function DataTable({
    columns,
    rows = [],
    rowKey = (_r, i) => i,
    loading = false,
    skeletonRows = 6,
    sort = null,
    onSortChange,
    empty,
    onRowClick,
    className = '',
}) {
    const alignCls = (a) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

    const handleSort = (col) => {
        if (!col.sortable || !onSortChange) return;
        const k = col.sortKey || col.key;
        if (sort?.key !== k) onSortChange({ key: k, dir: 'asc' });
        else if (sort.dir === 'asc') onSortChange({ key: k, dir: 'desc' });
        else onSortChange(null);
    };

    const SortGlyph = ({ col }) => {
        if (!col.sortable) return null;
        const k = col.sortKey || col.key;
        if (sort?.key !== k) return <ChevronsUpDown size={13} className="text-slate-300" />;
        return sort.dir === 'asc' ? (
            <ChevronUp size={13} className="text-canopy" />
        ) : (
            <ChevronDown size={13} className="text-canopy" />
        );
    };

    const isEmpty = !loading && rows.length === 0;

    return (
        <div className={className}>
            {/* ---- desktop / tablet: table ---- */}
            <div className="hidden overflow-x-auto scrollbar-thin md:block">
                <table className="w-full text-left text-body">
                    <thead className="border-b border-line bg-paper">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        'px-4 py-2.5 font-medium text-slate-600',
                                        alignCls(col.align),
                                        col.width,
                                        col.sortable && onSortChange && 'cursor-pointer select-none'
                                    )}
                                    onClick={() => handleSort(col)}
                                >
                                    <span
                                        className={cn(
                                            'inline-flex items-center gap-1',
                                            col.align === 'right' && 'flex-row-reverse'
                                        )}
                                    >
                                        {col.header}
                                        <SortGlyph col={col} />
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {loading
                            ? Array.from({ length: skeletonRows }).map((_, r) => (
                                  <tr key={r}>
                                      {columns.map((col) => (
                                          <td key={col.key} className="px-4 py-3">
                                              <div className="h-4 w-full max-w-[8rem] animate-pulse rounded bg-line/70" />
                                          </td>
                                      ))}
                                  </tr>
                              ))
                            : rows.map((row, i) => (
                                  <tr
                                      key={rowKey(row, i)}
                                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                                      className={cn(
                                          'group relative transition-colors hover:bg-canopy-tint/40',
                                          onRowClick && 'cursor-pointer'
                                      )}
                                  >
                                      {columns.map((col, ci) => (
                                          <td
                                              key={col.key}
                                              className={cn(
                                                  'px-4 py-3 text-ink',
                                                  alignCls(col.align),
                                                  col.mono && 'font-mono text-caption text-slate-600',
                                                  ci === 0 &&
                                                      'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-canopy before:opacity-0 before:transition-opacity group-hover:before:opacity-100'
                                              )}
                                          >
                                              {col.render ? col.render(row, i) : row[col.key] ?? '—'}
                                          </td>
                                      ))}
                                  </tr>
                              ))}
                    </tbody>
                </table>
                {isEmpty && <TableEmpty empty={empty} />}
            </div>

            {/* ---- phone: folio cards ---- */}
            <div className="space-y-3 md:hidden">
                {loading
                    ? Array.from({ length: Math.min(skeletonRows, 4) }).map((_, r) => (
                          <div key={r} className="ledger-spine rounded-card border border-line bg-white p-4 pl-5">
                              <div className="h-4 w-32 animate-pulse rounded bg-line/70" />
                              <div className="mt-3 h-3 w-full animate-pulse rounded bg-line/60" />
                              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-line/60" />
                          </div>
                      ))
                    : isEmpty
                    ? <TableEmpty empty={empty} />
                    : rows.map((row, i) => {
                          const primaryCol = columns.find((c) => c.primary) || columns[0];
                          const bodyCols = columns.filter(
                              (c) => c !== primaryCol && c.card !== 'hide' && c.card !== 'footer' && c.header
                          );
                          const footerCols = columns.filter((c) => c.card === 'footer');
                          return (
                              <div
                                  key={rowKey(row, i)}
                                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                                  className={cn(
                                      'ledger-spine rounded-card border border-line bg-white p-4 pl-5 shadow-card',
                                      onRowClick && 'cursor-pointer'
                                  )}
                              >
                                  <div className="font-medium text-ink">
                                      {primaryCol.render ? primaryCol.render(row, i) : row[primaryCol.key] ?? '—'}
                                  </div>
                                  {bodyCols.length > 0 && (
                                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                                          {bodyCols.map((col) => (
                                              <div key={col.key} className="min-w-0">
                                                  <dt className="text-[0.7rem] uppercase tracking-wide text-slate-400">
                                                      {col.cardLabel || col.header}
                                                  </dt>
                                                  <dd
                                                      className={cn(
                                                          'truncate text-caption text-ink',
                                                          col.mono && 'font-mono text-slate-600'
                                                      )}
                                                  >
                                                      {col.render ? col.render(row, i) : row[col.key] ?? '—'}
                                                  </dd>
                                              </div>
                                          ))}
                                      </dl>
                                  )}
                                  {footerCols.length > 0 && (
                                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                                          {footerCols.map((col) => (
                                              <div key={col.key}>{col.render ? col.render(row, i) : row[col.key]}</div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          );
                      })}
            </div>
        </div>
    );
}

function TableEmpty({ empty }) {
    if (!empty) {
        return <div className="px-4 py-12 text-center text-body text-slate-500">No records found.</div>;
    }
    return (
        <EmptyState
            icon={empty.icon}
            title={empty.title || 'Nothing here yet'}
            description={empty.description}
            action={empty.action}
        />
    );
}

export default DataTable;
