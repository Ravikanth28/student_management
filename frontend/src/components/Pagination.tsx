interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
  /** Plural noun for the record count label, e.g. "students", "events". */
  noun?: string;
}

function ChevLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** Renders up to 7 page-number buttons with ellipsis collapsing. */
function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }
  return pages;
}

/**
 * Pagination controls: shows record range, previous/next arrows,
 * and numbered page buttons with ellipsis collapsing.
 */
export function Pagination({ page, totalPages, total, limit, onPage, noun = 'students' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);
  const numbers = buildPageNumbers(page, totalPages);

  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong> {noun}
      </span>
      <nav className="pagination-controls" aria-label="Pagination">
        <button
          className="page-btn"
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevLeft />
        </button>

        {numbers.map((n, i) =>
          n === '...' ? (
            <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--text-3)', fontSize: '0.85rem' }}>…</span>
          ) : (
            <button
              key={n}
              className={`page-btn${page === n ? ' active' : ''}`}
              type="button"
              aria-label={`Page ${n}`}
              aria-current={page === n ? 'page' : undefined}
              onClick={() => onPage(n as number)}
            >
              {n}
            </button>
          )
        )}

        <button
          className="page-btn"
          type="button"
          aria-label="Next page"
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevRight />
        </button>
      </nav>
    </div>
  );
}
