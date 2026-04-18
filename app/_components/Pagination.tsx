'use client';

interface PaginationProps {
  total: number;
  page: number;
  limit: number;
  onChange: (page: number) => void;
}

export function Pagination({ total, page, limit, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  const getPages = (): (number | '…')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-xs text-stone-400">
        แสดง {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} จาก {total} รายการ
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← ก่อน
        </button>
        {getPages().map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-stone-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`min-w-[28px] rounded px-2 py-1 text-xs font-medium ${
                p === page
                  ? 'bg-primary text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ถัดไป →
        </button>
      </div>
    </div>
  );
}
