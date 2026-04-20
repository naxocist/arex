'use client';

export default function DistModeChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-lg bg-stone-100 p-0.5" onClick={(e) => e.stopPropagation()}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            value === opt.value ? 'bg-white text-primary shadow-sm' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </span>
  );
}
