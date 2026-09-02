# UI primitives — "Field ledger" design system

Import from the barrel:

```jsx
import { PageHeader, DataTable, Pagination, Button, Modal, useToast } from '../components/ui';
```

## Design tokens (Tailwind — see `tailwind.config.js`)

| Token | Class examples | Role |
|---|---|---|
| `canopy` / `canopy-dark` / `canopy-tint` | `bg-canopy`, `text-canopy`, `bg-canopy-tint` | primary green — buttons, active nav, links, focus ring, row band |
| `harvest` | `text-harvest`, `bg-harvest/10` | single warm accent — secondary CTA, warnings |
| `ink` | `text-ink` | body text (warm near-black) |
| `paper` | `bg-paper` | app background |
| `line` | `border-line`, `divide-line` | hairlines / borders |
| `danger` / `danger-tint`, `info` / `info-tint` | `text-danger`, `bg-info-tint` | status only |

Fonts: `font-display` (Fraunces — **mastheads / login / empty states only**), `font-sans`
(IBM Plex Sans — everything), `font-mono` (IBM Plex Mono — **all identifiers, codes, counts,
dates, DQL**; carries `tabular-nums`).

Type scale: `text-display-lg`, `text-display`, `text-title`, `text-body`, `text-caption`.
Radius: `rounded-card`. Shadow: `shadow-card`, `shadow-pop`. Extra breakpoint: `xs` (480px).

The **ledger spine** — the signature 3px canopy rule — is the `.ledger-spine` utility
(`index.css`) or, on table rows, the built-in hover rule in `DataTable`.

## Page shell

Every routed page uses the same outer wrapper — no per-page `max-w-*`, no `mx-auto`, no
`min-h-full`:

```jsx
return (
  <div className="flex flex-1 flex-col">
    <PageHeader … />
    {/* body fills the full content width */}
  </div>
);
```

`MainLayout`'s content wrapper is `flex min-h-[calc(100dvh-3.5rem)] w-full flex-col p-4` —
**full-bleed** with tight uniform ~16px padding at every breakpoint, no centred `max-w` cap,
so tables and filter grids use the whole page like the production Case Management System.
`flex-1` on the page root fills the viewport (no artificial blank band) and any inner
`flex-1 overflow-y-auto` region gets a bounded parent. Data-entry forms are **full width**
too — no form-column `max-w-*` cap; single-column forms reflow into multi-column grids
(`md:grid-cols-2`, `lg:grid-cols-3`, `xl:grid-cols-4`) so fields fill a wide screen instead
of one stretched column, and semantically-paired inputs stay adjacent. Never centred with
`flex justify-center`. Filter/search bars fill the width in a `flex-wrap` row or `FormGrid`.
Only true dialogs (`Modal`), `LoginPage`, and paragraph text measure (`max-w-2xl` on
`PageHeader`'s description) keep a width cap. `WorkflowsPage` (master–detail) and `LoginPage`
are the only shell exceptions.

## Components

| Component | Purpose | Key props |
|---|---|---|
| `PageHeader` | Page masthead (spine + Fraunces title + description + actions). One per page. | `title`, `description`, `actions`, `icon` |
| `DataTable` | The one table treatment. Reflows to "folio cards" below `md`. | `columns`, `rows`, `rowKey`, `loading`, `sort`, `onSortChange`, `empty`, `onRowClick` |
| `Pagination` | Pager — works with `total` or `hasNext`. Stacks on phones. | `page`, `pageSize`, `total`/`hasNext`, `onPageChange`, `onPageSizeChange` |
| `Modal` | Centred dialog on desktop, full bottom-sheet on phones. Esc / backdrop close. | `isOpen`, `onClose`, `title`, `footer`, `size` |
| `Button` | `variant`: primary \| secondary \| ghost \| danger \| accent. `size`: sm \| md \| icon. | `loading`, native button props |
| `Input` / `Textarea` | Text inputs, one focus-ring recipe. | `invalid` |
| `CustomSelect` | The one dropdown treatment — portal panel that escapes `overflow:hidden`, auto-flips up, keyboard nav, auto filter input above ~12 options. Value-based `onChange(value)`. | `value`, `onChange`, `options`, `placeholder`, `invalid`, `searchable`, `disabled` |
| `Field` / `Label` | Label + control slot + help/error line. | `label`, `required`, `error`, `help` |
| `FormGrid` | `grid-cols-1` → `cols` at `md`. `FormGrid.Full` for a spanning child. | `cols` (2\|3\|4) |
| `Card` | Surface. `spine` adds the ledger spine; `pad={false}` for tables. | `spine`, `pad` |
| `Badge` | Status pill. `tone`: neutral \| canopy \| harvest \| danger \| info. | `tone` |
| `Tabs` | Scrollable horizontal tab bar. Filter tabs for role before passing. | `tabs`, `value`, `onChange` |
| `EmptyState` | No-data state with an optional `action`. | `icon`, `title`, `description`, `action` |
| `Skeleton` / `Spinner` | Loading placeholders. | — |
| `ToastProvider` / `useToast` | App-wide toasts, mounted once in `MainLayout`. | `toast.success/error/info(msg)`, `toast.show({ type, message })` |

## `DataTable` column shape

```js
{
  key,                       // unique; default sort id
  header,                    // '' allowed (e.g. an actions column)
  render?(row, i) => node,   // defaults to row[key]
  align?: 'left' | 'center' | 'right',
  mono?: boolean,            // tabular mono figures
  sortable?: boolean,
  sortKey?: string,          // when the sort id ≠ key
  width?: string,            // tailwind width class for the <th>
  card?: 'body' | 'footer' | 'hide',   // placement in the mobile folio card
  primary?: boolean,         // headline field on the mobile card
  cardLabel?: string,        // label override on the mobile card
}
```

`sort` is `{ key, dir: 'asc' | 'desc' } | null`; `onSortChange` receives the next value
(cycles asc → desc → null). The page still owns the actual sorting of `rows`.
