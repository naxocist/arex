'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, ChevronDown, Package, RefreshCw, Save, XCircle } from 'lucide-react';
import { factoryApi, type FactoryMaterialPreferenceItem, type FactoryMeasurementUnitOption } from '@/app/_lib/api';

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ tone, message, onDone }: { tone: 'success' | 'error'; message: string; onDone: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    timerRef.current = setTimeout(() => onDoneRef.current(), 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);
  const ok = tone === 'success';
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-lg backdrop-blur-sm whitespace-nowrap ${
        ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
    >
      {ok
        ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        : <XCircle className="h-5 w-5 shrink-0 text-red-400" />}
      <span className={`text-sm font-medium ${ok ? 'text-emerald-700' : 'text-red-700'}`}>{message}</span>
    </motion.div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DraftRow {
  material_type_code: string;
  material_name_th: string;
  material_active: boolean;
  accepts: boolean;
  min_value: string;
  max_value: string;
  amount_unit: string;
  _saved_accepts: boolean;
  _saved_min_value: string;
  _saved_max_value: string;
  _saved_amount_unit: string;
}

function toDraft(p: FactoryMaterialPreferenceItem): DraftRow {
  const max = p.capacity_value != null ? String(p.capacity_value) : '';
  const min = p.minimum_amount_value != null ? String(p.minimum_amount_value) : '';
  const unit = p.capacity_unit ?? p.minimum_amount_unit ?? '';
  return {
    material_type_code: p.material_type_code,
    material_name_th: p.material_name_th,
    material_active: p.material_active,
    accepts: p.accepts,
    min_value: min,
    max_value: max,
    amount_unit: unit,
    _saved_accepts: p.accepts,
    _saved_min_value: min,
    _saved_max_value: max,
    _saved_amount_unit: unit,
  };
}

function isDirty(r: DraftRow) {
  return (
    r.accepts !== r._saved_accepts ||
    r.min_value !== r._saved_min_value ||
    r.max_value !== r._saved_max_value ||
    r.amount_unit !== r._saved_amount_unit
  );
}

// ─── Material row ─────────────────────────────────────────────────────────────

interface RowProps {
  row: DraftRow;
  units: FactoryMeasurementUnitOption[];
  onChange: (patch: Partial<DraftRow>) => void;
}

function MaterialRow({ row, units, onChange }: RowProps) {
  const dirty = isDirty(row);
  const selUnit = units.find((u) => u.code === row.amount_unit);
  const f = selUnit?.to_kg_factor ?? null;
  const minKg = f != null && row.min_value !== '' && parseFloat(row.min_value) > 0 ? parseFloat(row.min_value) * f : null;
  const maxKg = f != null && row.max_value !== '' && parseFloat(row.max_value) > 0 ? parseFloat(row.max_value) * f : null;

  return (
    <div className={`rounded-xl border transition-colors ${row.accepts ? 'border-primary/20 bg-white' : 'border-outline-variant/15 bg-stone-50'} ${!row.material_active ? 'opacity-55' : ''}`}>
      {/* Top row: icon · name · toggle */}
      <div className="flex items-center gap-3 px-3.5 pt-2.5 pb-2">
        <div className="relative flex shrink-0 items-center">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${row.accepts ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-400'}`}>
            <Package className="h-3.5 w-3.5" />
          </div>
          {dirty && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-amber-400" />}
        </div>
        <p className={`flex-1 text-sm font-medium ${row.accepts ? 'text-on-surface' : 'text-stone-400'}`}>
          {row.material_name_th}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={row.accepts}
          onClick={() => onChange({ accepts: !row.accepts, ...(!row.accepts ? {} : { min_value: '', max_value: '', amount_unit: '' }) })}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${row.accepts ? 'bg-primary' : 'bg-stone-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${row.accepts ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Range input — only when accepted */}
      <AnimatePresence>
        {row.accepts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* Labels */}
            <div className="flex items-center gap-2 px-3.5 pb-0.5">
              <span className="w-24 text-[10px] font-semibold uppercase tracking-wider text-stone-400">ขั้นต่ำ</span>
              <span className="w-4 shrink-0" />
              <span className="w-24 text-[10px] font-semibold uppercase tracking-wider text-stone-400">สูงสุด/รอบ</span>
              <span className="flex-1" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">หน่วย</span>
            </div>
            {/* Inputs */}
            <div className="flex items-center gap-2 px-3.5 pb-3">
              <input
                type="number"
                min={0}
                step="any"
                placeholder="ไม่มี"
                value={row.min_value}
                onChange={(e) => onChange({ min_value: e.target.value })}
                className="w-24 rounded-lg border border-outline-variant/30 bg-stone-50 px-2.5 py-1.5 text-sm text-on-surface outline-none placeholder:text-stone-400 focus:border-primary/40 focus:bg-white transition"
              />
              <span className="w-4 shrink-0 text-center text-stone-300 text-sm">—</span>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="ไม่จำกัด"
                value={row.max_value}
                onChange={(e) => onChange({ max_value: e.target.value })}
                className="w-24 rounded-lg border border-outline-variant/30 bg-stone-50 px-2.5 py-1.5 text-sm text-on-surface outline-none placeholder:text-stone-400 focus:border-primary/40 focus:bg-white transition"
              />
              <select
                disabled={row.min_value === '' && row.max_value === ''}
                value={row.amount_unit}
                onChange={(e) => {
                  const u = e.target.value;
                  onChange({ amount_unit: u, ...(u === '' ? { min_value: '', max_value: '' } : {}) });
                }}
                className="flex-1 cursor-pointer appearance-none rounded-lg border border-outline-variant/30 bg-stone-50 px-2.5 py-1.5 text-sm text-on-surface outline-none disabled:cursor-not-allowed disabled:text-stone-400 focus:border-primary/40 transition"
              >
                <option value="">เลือกหน่วย</option>
                {units.map((u) => (
                  <option key={u.code} value={u.code}>{u.name_th}</option>
                ))}
              </select>
            </div>
            {/* kg hint */}
            {(minKg != null || maxKg != null) && (
              <p className="px-3.5 pb-2.5 text-xs text-on-surface-variant">
                {minKg != null && <>ขั้นต่ำ <span className="font-semibold text-on-surface">{minKg.toLocaleString('th-TH')} กก.</span></>}
                {minKg != null && maxKg != null && <span className="mx-1.5 text-stone-300">·</span>}
                {maxKg != null && <>สูงสุด <span className="font-semibold text-on-surface">{maxKg.toLocaleString('th-TH')} กก.</span></>}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function FactoryPreferencesView() {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [units, setUnits] = useState<FactoryMeasurementUnitOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string; id: number } | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const toastId = useRef(0);

  const load = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const res = await factoryApi.listMaterialPreferences(forceRefresh ? { forceRefresh: true } : undefined);
      setRows(res.preferences.map(toDraft));
      setUnits(res.units);
    } catch {
      setToast({ tone: 'error', message: 'โหลดข้อมูลไม่สำเร็จ', id: ++toastId.current });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const setRow = (code: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => r.material_type_code === code ? { ...r, ...patch } : r));

  const handleSave = async () => {
    const errors: string[] = [];
    for (const r of rows) {
      if (!r.accepts) continue;
      const hasMin = r.min_value !== '' && parseFloat(r.min_value) > 0;
      const hasMax = r.max_value !== '' && parseFloat(r.max_value) > 0;
      const hasUnit = !!r.amount_unit;
      if ((hasMin || hasMax) && !hasUnit) errors.push(`"${r.material_name_th}": ยังไม่ได้เลือกหน่วย`);
      if (r.min_value !== '' && parseFloat(r.min_value) <= 0) errors.push(`"${r.material_name_th}": ปริมาณขั้นต่ำต้องมากกว่า 0`);
      if (r.max_value !== '' && parseFloat(r.max_value) <= 0) errors.push(`"${r.material_name_th}": ปริมาณสูงสุดต้องมากกว่า 0`);
      if (hasMin && hasMax && parseFloat(r.min_value) > parseFloat(r.max_value))
        errors.push(`"${r.material_name_th}": ขั้นต่ำต้องไม่มากกว่าสูงสุด`);
    }
    if (errors.length) {
      setToast({ tone: 'error', message: errors[0], id: ++toastId.current });
      return;
    }
    setIsSaving(true);
    try {
      const items = rows.map((r) => {
        const unit = r.accepts && r.amount_unit ? r.amount_unit : null;
        const maxVal = r.accepts && r.max_value !== '' ? parseFloat(r.max_value) : null;
        const minVal = r.accepts && r.min_value !== '' ? parseFloat(r.min_value) : null;
        return {
          material_type_code: r.material_type_code,
          accepts: r.accepts,
          capacity_value: maxVal != null && maxVal > 0 && unit ? maxVal : null,
          capacity_unit: maxVal != null && maxVal > 0 && unit ? unit : null,
          minimum_amount_value: minVal != null && minVal > 0 && unit ? minVal : null,
          minimum_amount_unit: minVal != null && minVal > 0 && unit ? unit : null,
        };
      });
      await factoryApi.updateMaterialPreferences(items);
      await load(true);
      setToast({ tone: 'success', message: 'บันทึกความต้องการวัสดุสำเร็จ', id: ++toastId.current });
    } catch {
      setToast({ tone: 'error', message: 'บันทึกไม่สำเร็จ กรุณาลองใหม่', id: ++toastId.current });
    } finally {
      setIsSaving(false);
    }
  };

  const activeRows = rows.filter((r) => r.material_active);
  const inactiveRows = rows.filter((r) => !r.material_active);
  const dirtyCount = rows.filter(isDirty).length;
  const acceptedCount = rows.filter((r) => r.accepts).length;

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-on-surface">ความต้องการวัสดุ</h2>
            <p className="text-sm text-on-surface-variant">กำหนดวัสดุที่รับได้และปริมาณต่อรอบ</p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-sm text-on-surface-variant transition hover:bg-stone-50 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Summary + dirty indicator */}
        {!isLoading && rows.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 rounded-full bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary">
              <CheckCircle2 className="h-3 w-3" />
              รับ {acceptedCount}/{rows.length} ชนิด
            </span>
            {dirtyCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                ยังไม่บันทึก {dirtyCount} รายการ
              </span>
            )}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        ) : (
          <>
            {/* Active rows */}
            <div className="space-y-1.5">
              {activeRows.map((row) => (
                <MaterialRow key={row.material_type_code} row={row} units={units} onChange={(p) => setRow(row.material_type_code, p)} />
              ))}
            </div>

            {/* Inactive rows — collapsed */}
            {inactiveRows.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowInactive((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-stone-400 transition hover:text-on-surface-variant"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showInactive ? 'rotate-180' : ''}`} />
                  วัสดุที่ปิดใช้งานในระบบ ({inactiveRows.length})
                </button>
                <AnimatePresence>
                  {showInactive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1.5 space-y-1.5">
                        {inactiveRows.map((row) => (
                          <MaterialRow key={row.material_type_code} row={row} units={units} onChange={(p) => setRow(row.material_type_code, p)} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Save */}
            <motion.button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || dirtyCount === 0}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm shadow-primary/20 transition hover:opacity-90 disabled:opacity-40"
              whileTap={{ scale: 0.97 }}
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'กำลังบันทึก...' : dirtyCount > 0 ? `บันทึก (${dirtyCount} รายการ)` : 'บันทึก'}
            </motion.button>
          </>
        )}
      </div>

      {/* Floating toast */}
      <AnimatePresence>
        {toast && (
          <Toast key={toast.id} tone={toast.tone} message={toast.message} onDone={() => setToast(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
