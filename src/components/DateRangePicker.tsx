import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { createPortal } from 'react-dom';
import 'react-day-picker/style.css';

export interface DateRangeValue {
  from: string | null;
  to: string | null;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  minDate?: Date;
  placeholder?: string;
  disabled?: boolean;
}

function toDateOnlyKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateOnly(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

function formatThaiDate(value: string | null): string {
  const date = parseDateOnly(value);
  if (!date) {
    return '';
  }
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DateRangePicker({
  value,
  onChange,
  minDate,
  placeholder = 'เลือกช่วงวัน',
  disabled = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const selectedRange = useMemo<DateRange | undefined>(
    () => ({
      from: parseDateOnly(value.from),
      to: parseDateOnly(value.to),
    }),
    [value.from, value.to],
  );

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) {
        return;
      }
      if (popupRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !wrapperRef.current) {
      return;
    }

    const updatePopupPosition = () => {
      if (!wrapperRef.current) {
        return;
      }

      const rect = wrapperRef.current.getBoundingClientRect();
      const popupWidth = 340;
      const popupHeight = 380;
      const viewportPadding = 8;

      let left = rect.left;
      if (left + popupWidth > window.innerWidth - viewportPadding) {
        left = window.innerWidth - popupWidth - viewportPadding;
      }
      if (left < viewportPadding) {
        left = viewportPadding;
      }

      let top = rect.bottom + 8;
      if (top + popupHeight > window.innerHeight - viewportPadding) {
        top = rect.top - popupHeight - 8;
      }
      if (top < viewportPadding) {
        top = viewportPadding;
      }

      setPopupPosition({ top, left });
    };

    updatePopupPosition();
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);

    return () => {
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
    };
  }, [isOpen]);

  const handleSelect = (range: DateRange | undefined) => {
    onChange({
      from: range?.from ? toDateOnlyKey(range.from) : null,
      to: range?.to ? toDateOnlyKey(range.to) : null,
    });
  };

  const canConfirm = Boolean(value.from && value.to);

  const label =
    value.from && value.to
      ? `${formatThaiDate(value.from)} - ${formatThaiDate(value.to)}`
      : value.from
        ? `${formatThaiDate(value.from)} - ...`
        : placeholder;

  const popup = (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: `${popupPosition.top}px`,
        left: `${popupPosition.left}px`,
        zIndex: 1200,
      }}
      className="w-[min(340px,calc(100vw-16px))] rounded-3xl border border-line bg-white p-3 shadow-2xl"
    >
      <DayPicker
        mode="range"
        selected={selectedRange}
        onSelect={handleSelect}
        weekStartsOn={1}
        disabled={minDate ? { before: minDate } : undefined}
        classNames={{
          months: 'rdp-months',
          month: 'rdp-month',
          caption: 'rdp-caption',
          table: 'rdp-table text-xs',
          day: 'rdp-day',
        }}
      />

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-outline-variant/15 pt-2">
        <button
          type="button"
          onClick={() => onChange({ from: null, to: null })}
          className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-stone-700"
        >
          ล้างค่า
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          disabled={!canConfirm}
          className="rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          ยืนยันช่วงวัน
        </button>
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative min-w-[14rem]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-line bg-surface-muted px-3 py-2.5 text-left text-sm outline-none transition hover:border-stone-300 disabled:opacity-60"
      >
        <span className="truncate">{label}</span>
        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
      </button>

      {isOpen && typeof document !== 'undefined' ? createPortal(popup, document.body) : null}
    </div>
  );
}
