'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Gift, Plus, RefreshCw, Ruler, Save, Shapes, X } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import SectionCard from '@/app/_components/SectionCard';
import {
  ApiError,
  executiveApi,
  type ExecutiveMaterialPointRuleItem,
  type ExecutiveMaterialTypeItem,
  type ExecutiveMeasurementUnitItem,
  type FarmerRewardItem,
} from '@/app/_lib/apiClient';

interface MaterialDraftRow {
  originalCode: string;
  code: string;
  name_th: string;
  active: boolean;
  points_per_kg: string;
}

interface UnitDraftRow {
  originalCode: string;
  code: string;
  name_th: string;
  to_kg_factor: string;
  active: boolean;
}

interface NewMaterialDraft {
  code: string;
  name_th: string;
  active: boolean;
  points_per_kg: string;
}

interface NewUnitDraft {
  code: string;
  name_th: string;
  to_kg_factor: string;
  active: boolean;
}

const defaultNewMaterial: NewMaterialDraft = {
  code: '',
  name_th: '',
  active: true,
  points_per_kg: '',
};

const defaultNewUnit: NewUnitDraft = {
  code: '',
  name_th: '',
  to_kg_factor: '',
  active: true,
};

interface RewardDraftRow {
  id: string;
  name_th: string;
  description_th: string;
  points_cost: string;
  stock_qty: string;
  active: boolean;
}

interface NewRewardDraft {
  name_th: string;
  description_th: string;
  points_cost: string;
  stock_qty: string;
  active: boolean;
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) {
    return 'info';
  }
  if (message.includes('ไม่สำเร็จ') || message.includes('กรุณา')) {
    return 'error';
  }
  if (message.includes('สำเร็จ')) {
    return 'success';
  }
  return 'info';
}

function parsePositiveNumber(value: string, errorMessage: string): number {
  const parsedValue = Number(value.trim());
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(errorMessage);
  }
  return parsedValue;
}

function mergeMaterialRows(
  materials: ExecutiveMaterialTypeItem[],
  pointRules: ExecutiveMaterialPointRuleItem[],
): MaterialDraftRow[] {
  const pointsByMaterial = new Map(
    pointRules.map((rule) => [rule.material_type, rule.points_per_kg === null ? '' : String(rule.points_per_kg)]),
  );

  return materials.map((item) => ({
    originalCode: item.code,
    code: item.code,
    name_th: item.name_th,
    active: item.active,
    points_per_kg: pointsByMaterial.get(item.code) ?? '',
  }));
}

export default function ExecutiveSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [formulaDescription, setFormulaDescription] = useState('');
  const [materialRows, setMaterialRows] = useState<MaterialDraftRow[]>([]);
  const [unitRows, setUnitRows] = useState<UnitDraftRow[]>([]);

  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState<NewMaterialDraft>(defaultNewMaterial);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnit, setNewUnit] = useState<NewUnitDraft>(defaultNewUnit);

  const [rewardRows, setRewardRows] = useState<RewardDraftRow[]>([]);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newReward, setNewReward] = useState<NewRewardDraft>({ name_th: '', description_th: '', points_cost: '', stock_qty: '', active: true });

  const activeMaterialCount = useMemo(
    () => materialRows.filter((row) => row.active).length,
    [materialRows],
  );
  const activeUnitCount = useMemo(() => unitRows.filter((row) => row.active).length, [unitRows]);
  const configuredPointCount = useMemo(
    () => materialRows.filter((row) => row.points_per_kg.trim()).length,
    [materialRows],
  );

  const loadConfiguration = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const [materialResponse, unitResponse, pointRuleResponse, rewardResponse] = await Promise.all([
        executiveApi.listMaterialTypes({ forceRefresh }),
        executiveApi.listMeasurementUnits({ forceRefresh }),
        executiveApi.listMaterialPointRules({ forceRefresh }),
        executiveApi.listRewards({ forceRefresh }),
      ]);

      setMaterialRows(mergeMaterialRows(materialResponse.material_types, pointRuleResponse.rules));
      setUnitRows(
        unitResponse.units.map((item: ExecutiveMeasurementUnitItem) => ({
          originalCode: item.code,
          code: item.code,
          name_th: item.name_th,
          to_kg_factor: item.to_kg_factor === null ? '' : String(item.to_kg_factor),
          active: item.active,
        })),
      );
      setRewardRows(
        rewardResponse.rewards.map((item: FarmerRewardItem) => ({
          id: item.id,
          name_th: item.name_th,
          description_th: item.description_th || '',
          points_cost: String(item.points_cost),
          stock_qty: String(item.stock_qty),
          active: item.active,
        })),
      );
      setFormulaDescription(pointRuleResponse.formula);
      setMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`โหลดข้อมูลการตั้งค่าไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('โหลดข้อมูลการตั้งค่าไม่สำเร็จ');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadConfiguration();
  }, []);

  const updateMaterialRow = (index: number, patch: Partial<MaterialDraftRow>) => {
    setMaterialRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const updateUnitRow = (index: number, patch: Partial<UnitDraftRow>) => {
    setUnitRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const handleCreateMaterial = async () => {
    const code = newMaterial.code.trim();
    const name = newMaterial.name_th.trim();
    if (!code || !name) {
      setMessage('กรุณาระบุรหัสและชื่อประเภทวัสดุให้ครบ');
      return;
    }

    try {
      const pointsPerKg = parsePositiveNumber(newMaterial.points_per_kg, 'กรุณาระบุแต้มต่อกิโลกรัมให้เป็นตัวเลขมากกว่า 0');
      setSavingKey('material:new');
      await executiveApi.createMaterialType({
        code,
        name_th: name,
        active: newMaterial.active,
      });
      await executiveApi.upsertMaterialPointRule(code, {
        points_per_kg: pointsPerKg,
      });
      setIsAddingMaterial(false);
      setNewMaterial(defaultNewMaterial);
      await loadConfiguration(true);
      setMessage('เพิ่มประเภทวัสดุสำเร็จ');
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message.includes('กรุณา') ? error.message : `เพิ่มประเภทวัสดุไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('เพิ่มประเภทวัสดุไม่สำเร็จ');
      }
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateUnit = async () => {
    const code = newUnit.code.trim();
    const name = newUnit.name_th.trim();
    if (!code || !name) {
      setMessage('กรุณาระบุรหัสและชื่อหน่วยให้ครบ');
      return;
    }

    const factorText = newUnit.to_kg_factor.trim();
    const factorValue = factorText ? Number(factorText) : null;
    if (factorValue !== null && (!Number.isFinite(factorValue) || factorValue <= 0)) {
      setMessage('ค่าแปลงเป็นกิโลกรัมต้องมากกว่า 0 หรือเว้นว่างได้');
      return;
    }

    setSavingKey('unit:new');
    try {
      await executiveApi.createMeasurementUnit({
        code,
        name_th: name,
        to_kg_factor: factorValue,
        active: newUnit.active,
      });
      setIsAddingUnit(false);
      setNewUnit(defaultNewUnit);
      await loadConfiguration(true);
      setMessage('เพิ่มหน่วยสำเร็จ');
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`เพิ่มหน่วยไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('เพิ่มหน่วยไม่สำเร็จ');
      }
    } finally {
      setSavingKey(null);
    }
  };

  const saveMaterialRow = async (row: MaterialDraftRow) => {
    const code = row.code.trim();
    const name = row.name_th.trim();
    if (!code || !name) {
      setMessage('กรุณาระบุรหัสและชื่อประเภทวัสดุให้ครบ');
      return;
    }

    try {
      const pointsPerKg = parsePositiveNumber(row.points_per_kg, 'กรุณาระบุแต้มต่อกิโลกรัมให้เป็นตัวเลขมากกว่า 0');
      const requestKey = `material:${row.originalCode}`;
      setSavingKey(requestKey);
      await executiveApi.updateMaterialType(row.originalCode, {
        code,
        name_th: name,
        active: row.active,
      });
      await executiveApi.upsertMaterialPointRule(code, {
        points_per_kg: pointsPerKg,
      });
      await loadConfiguration(true);
      setMessage('บันทึกการตั้งค่าวัสดุสำเร็จ');
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message.includes('กรุณา') ? error.message : `บันทึกการตั้งค่าวัสดุไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('บันทึกการตั้งค่าวัสดุไม่สำเร็จ');
      }
    } finally {
      setSavingKey(null);
    }
  };

  const saveUnitRow = async (row: UnitDraftRow) => {
    const code = row.code.trim();
    const name = row.name_th.trim();
    if (!code || !name) {
      setMessage('กรุณาระบุรหัสและชื่อหน่วยให้ครบ');
      return;
    }

    const factorText = row.to_kg_factor.trim();
    const factorValue = factorText ? Number(factorText) : null;
    if (factorValue !== null && (!Number.isFinite(factorValue) || factorValue <= 0)) {
      setMessage('ค่าแปลงเป็นกิโลกรัมต้องมากกว่า 0 หรือเว้นว่างได้');
      return;
    }

    const requestKey = `unit:${row.originalCode}`;
    setSavingKey(requestKey);
    try {
      await executiveApi.updateMeasurementUnit(row.originalCode, {
        code,
        name_th: name,
        to_kg_factor: factorValue,
        active: row.active,
      });
      await loadConfiguration(true);
      setMessage('บันทึกหน่วยสำเร็จ');
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`บันทึกหน่วยไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('บันทึกหน่วยไม่สำเร็จ');
      }
    } finally {
      setSavingKey(null);
    }
  };

  const updateRewardRow = (index: number, patch: Partial<RewardDraftRow>) => {
    setRewardRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const handleCreateReward = async () => {
    const name = newReward.name_th.trim();
    const pointsText = newReward.points_cost.trim();
    const stockText = newReward.stock_qty.trim();

    if (!name) {
      setMessage('กรุณาระบุชื่อรางวัล');
      return;
    }

    const points = parseInt(pointsText, 10);
    if (isNaN(points) || points <= 0) {
      setMessage('กรุณาระบุแต้มที่ใช้เป็นตัวเลขมากกว่า 0');
      return;
    }

    const stock = stockText ? parseInt(stockText, 10) : 0;
    if (isNaN(stock) || stock < 0) {
      setMessage('กรุณาระบุจำนวนสต็อกเป็นตัวเลขไม่ติดลบ');
      return;
    }

    setSavingKey('new-reward');
    try {
      await executiveApi.createReward({
        name_th: name,
        description_th: newReward.description_th.trim() || undefined,
        points_cost: points,
        stock_qty: stock,
        active: newReward.active,
      });
      setMessage('สร้างรางวัลสำเร็จ');
      setIsAddingReward(false);
      setNewReward({ name_th: '', description_th: '', points_cost: '', stock_qty: '', active: true });
      await loadConfiguration(true);
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`สร้างรางวัลไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('สร้างรางวัลไม่สำเร็จ');
      }
    } finally {
      setSavingKey(null);
    }
  };

  const saveRewardRow = async (row: RewardDraftRow) => {
    const name = row.name_th.trim();
    const pointsText = row.points_cost.trim();
    const stockText = row.stock_qty.trim();

    if (!name) {
      setMessage('กรุณาระบุชื่อรางวัล');
      return;
    }

    const points = pointsText ? parseInt(pointsText, 10) : null;
    if (points !== null && (isNaN(points) || points <= 0)) {
      setMessage('แต้มที่ใช้ต้องเป็นตัวเลขมากกว่า 0');
      return;
    }

    const stock = stockText ? parseInt(stockText, 10) : null;
    if (stock !== null && (isNaN(stock) || stock < 0)) {
      setMessage('จำนวนสต็อกต้องเป็นตัวเลขไม่ติดลบ');
      return;
    }

    const requestKey = `reward:${row.id}`;
    setSavingKey(requestKey);
    try {
      await executiveApi.updateReward(row.id, {
        name_th: name,
        description_th: row.description_th.trim() || undefined,
        points_cost: points,
        stock_qty: stock,
        active: row.active,
      });
      await loadConfiguration(true);
      setMessage('บันทึกรางวัลสำเร็จ');
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`บันทึกรางวัลไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('บันทึกรางวัลไม่สำเร็จ');
      }
    } finally {
      setSavingKey(null);
    }
  };

  const reduceMotion = useReducedMotion();

  return (
    <ErrorBoundary>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">ผู้บริหาร</p>
          <h1 className="mt-0.5 text-4xl font-light tracking-tight text-on-surface">ตั้งค่าระบบ</h1>
          <p className="mt-1 text-sm text-on-surface-variant">จัดการข้อมูลหลัก กฎแต้ม และแคตตาล็อกรางวัล</p>
        </div>
        <button
          type="button"
          onClick={() => void loadConfiguration(true)}
          disabled={isLoading}
          aria-label="รีเฟรชข้อมูล"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
          <Shapes className="h-4 w-4 text-emerald-600" />
          <span className="text-lg font-semibold text-stone-950">{activeMaterialCount}</span>
          <span className="text-sm text-stone-600">ประเภทวัสดุ</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
          <Ruler className="h-4 w-4 text-emerald-600" />
          <span className="text-lg font-semibold text-stone-950">{activeUnitCount}</span>
          <span className="text-sm text-stone-600">หน่วยวัด</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
          <Gift className="h-4 w-4 text-amber-600" />
          <span className="text-lg font-semibold text-stone-950">{rewardRows.filter((r) => r.active).length}</span>
          <span className="text-sm text-stone-600">รางวัล</span>
        </div>
      </div>

      {/* Materials + Units 2-col grid */}
      <div className="grid gap-5 xl:grid-cols-[1.18fr,0.82fr]">
        <SectionCard
          title="ประเภทวัสดุและแต้มต่อกิโลกรัม"
          description={formulaDescription ? `สูตรคำนวณ: ${formulaDescription}` : 'ตารางนี้รวมข้อมูล master ของวัสดุและอัตราแต้มไว้ในที่เดียว'}
          className="h-full"
          actions={
            !isAddingMaterial ? (
              <button
                type="button"
                onClick={() => setIsAddingMaterial(true)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-container"
              >
                <Plus className="h-4 w-4" />
                เพิ่มประเภทวัสดุ
              </button>
            ) : null
          }
        >
          <AnimatePresence initial={false}>
          {isAddingMaterial ? (
            <motion.div
              key="add-material-form"
              initial={reduceMotion ? undefined : { opacity: 0, height: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1, height: 'auto' }}
              exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
            <div className="mb-4 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/45 p-4">
              <p className="mb-2 text-xs text-stone-500">รหัสระบบ (ภาษาอังกฤษ/ตัวเลข ไม่มีช่องว่าง เช่น rice_straw)</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.9fr,1.2fr,10rem,8.5rem,auto]">
                <input
                  value={newMaterial.code}
                  onChange={(event) => setNewMaterial((prev) => ({ ...prev, code: event.target.value }))}
                  className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none font-mono text-sm"
                  placeholder="รหัสระบบ (en)"
                />
                <input
                  value={newMaterial.name_th}
                  onChange={(event) => setNewMaterial((prev) => ({ ...prev, name_th: event.target.value }))}
                  className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                  placeholder="ชื่อวัสดุ (ภาษาไทย)"
                />
                <input
                  value={newMaterial.points_per_kg}
                  onChange={(event) => setNewMaterial((prev) => ({ ...prev, points_per_kg: event.target.value }))}
                  className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                  placeholder="แต้ม/กก."
                  type="number"
                />
                <label className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={newMaterial.active}
                    onChange={(event) => setNewMaterial((prev) => ({ ...prev, active: event.target.checked }))}
                  />
                  เปิดใช้งาน
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreateMaterial()}
                    disabled={savingKey === 'material:new'}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingMaterial(false);
                      setNewMaterial(defaultNewMaterial);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700"
                  >
                    <X className="h-4 w-4" />
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
            </motion.div>
          ) : null}
          </AnimatePresence>

          <div className="space-y-2">
            <div className="hidden md:flex md:items-center md:gap-2 px-3 pb-1 text-xs font-medium text-stone-400 uppercase tracking-wide">
              <span className="w-20 shrink-0">รหัส</span>
              <span className="flex-1">ชื่อวัสดุ</span>
              <span className="w-24 shrink-0 flex flex-col gap-0.5">
                <span>แต้ม/กก.</span>
                <span className="text-[10px] font-normal normal-case text-stone-300">1 กก. ได้กี่แต้ม</span>
              </span>
              <span className="w-16 shrink-0">สถานะ</span>
              <span className="w-16 shrink-0" />
            </div>
            {materialRows.map((row, index) => {
              const requestKey = `material:${row.originalCode}`;
              return (
                <div key={row.originalCode} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3 md:flex-row md:items-center">
                  <div className="flex flex-1 items-center gap-2">
                    <span className="w-full sm:w-20 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-400 font-mono truncate" title={row.code}>
                      {row.code}
                    </span>
                    <input
                      value={row.name_th}
                      onChange={(event) => updateMaterialRow(index, { name_th: event.target.value })}
                      className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="ชื่อวัสดุ"
                    />
                    <input
                      value={row.points_per_kg}
                      onChange={(event) => updateMaterialRow(index, { points_per_kg: event.target.value })}
                      className="w-full sm:w-24 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="แต้ม/กก."
                      type="number"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        checked={row.active}
                        onChange={(event) => updateMaterialRow(index, { active: event.target.checked })}
                        className="h-4 w-4"
                      />
                      ใช้งาน
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveMaterialRow(row)}
                      disabled={savingKey === requestKey}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    >
                      {savingKey === requestKey ? '...' : 'บันทึก'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="หน่วยวัดและตัวแปลงเป็นกิโลกรัม"
          description="ส่วนนี้รวมหน่วยที่เปิดใช้จริงและตัวแปลงน้ำหนักไว้ในกรอบเดียว"
          className="h-full"
          actions={
            !isAddingUnit ? (
              <button
                type="button"
                onClick={() => setIsAddingUnit(true)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-container"
              >
                <Plus className="h-4 w-4" />
                เพิ่มหน่วย
              </button>
            ) : null
          }
        >
          <AnimatePresence initial={false}>
          {isAddingUnit ? (
            <motion.div
              key="add-unit-form"
              initial={reduceMotion ? undefined : { opacity: 0, height: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1, height: 'auto' }}
              exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
            <div className="mb-4 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/45 p-4">
              <p className="mb-2 text-xs text-stone-500">รหัสระบบ (ภาษาอังกฤษ/ตัวเลข ไม่มีช่องว่าง เช่น kilogram)</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.8fr,1fr,10rem,8.5rem,auto]">
                <input
                  value={newUnit.code}
                  onChange={(event) => setNewUnit((prev) => ({ ...prev, code: event.target.value }))}
                  className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none font-mono text-sm"
                  placeholder="รหัสระบบ (en)"
                />
                <input
                  value={newUnit.name_th}
                  onChange={(event) => setNewUnit((prev) => ({ ...prev, name_th: event.target.value }))}
                  className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                  placeholder="ชื่อหน่วย (ภาษาไทย)"
                />
                <input
                  value={newUnit.to_kg_factor}
                  onChange={(event) => setNewUnit((prev) => ({ ...prev, to_kg_factor: event.target.value }))}
                  className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                  placeholder="ตัวแปลงเป็นกก."
                  type="number"
                />
                <label className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={newUnit.active}
                    onChange={(event) => setNewUnit((prev) => ({ ...prev, active: event.target.checked }))}
                  />
                  เปิดใช้งาน
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreateUnit()}
                    disabled={savingKey === 'unit:new'}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingUnit(false);
                      setNewUnit(defaultNewUnit);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700"
                  >
                    <X className="h-4 w-4" />
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
            </motion.div>
          ) : null}
          </AnimatePresence>

          <div className="space-y-2">
            <div className="hidden md:flex md:items-center md:gap-2 px-3 pb-1 text-xs font-medium text-stone-400 uppercase tracking-wide">
              <span className="w-20 shrink-0">รหัส</span>
              <span className="flex-1">ชื่อหน่วย</span>
              <span className="w-24 shrink-0">ตัวแปลงกก.</span>
              <span className="w-16 shrink-0">สถานะ</span>
              <span className="w-16 shrink-0" />
            </div>
            {unitRows.map((row, index) => {
              const requestKey = `unit:${row.originalCode}`;
              return (
                <div key={row.originalCode} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3 md:flex-row md:items-center">
                  <div className="flex flex-1 items-center gap-2">
                    <span className="w-full sm:w-20 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-400 font-mono truncate" title={row.code}>
                      {row.code}
                    </span>
                    <input
                      value={row.name_th}
                      onChange={(event) => updateUnitRow(index, { name_th: event.target.value })}
                      className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="ชื่อหน่วย"
                    />
                    <input
                      value={row.to_kg_factor}
                      onChange={(event) => updateUnitRow(index, { to_kg_factor: event.target.value })}
                      className="w-full sm:w-24 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="ตัวแปลง"
                      type="number"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        checked={row.active}
                        onChange={(event) => updateUnitRow(index, { active: event.target.checked })}
                        className="h-4 w-4"
                      />
                      ใช้งาน
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveUnitRow(row)}
                      disabled={savingKey === requestKey}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    >
                      {savingKey === requestKey ? '...' : 'บันทึก'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Rewards — full width */}
      <SectionCard
          title="จัดการรางวัล"
          description="เพิ่ม แก้ไข และเปิด/ปิดใช้งานรางวัลที่เกษตรกรเห็น"
          actions={
            !isAddingReward ? (
              <button
                type="button"
                onClick={() => setIsAddingReward(true)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-container"
              >
                <Plus className="h-4 w-4" />
                เพิ่มรางวัล
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingReward(false);
                  setNewReward({ name_th: '', description_th: '', points_cost: '', stock_qty: '', active: true });
                }}
                className="flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                <X className="h-4 w-4" />
                ยกเลิก
              </button>
            )
          }
        >
          <AnimatePresence initial={false}>
          {isAddingReward ? (
            <motion.div
              key="add-reward-form"
              initial={reduceMotion ? undefined : { opacity: 0, height: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1, height: 'auto' }}
              exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <input
                  value={newReward.name_th}
                  onChange={(event) => setNewReward((prev) => ({ ...prev, name_th: event.target.value }))}
                  placeholder="ชื่อรางวัล"
                  className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={newReward.description_th}
                  onChange={(event) => setNewReward((prev) => ({ ...prev, description_th: event.target.value }))}
                  placeholder="รายละเอียด"
                  className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={newReward.points_cost}
                  onChange={(event) => setNewReward((prev) => ({ ...prev, points_cost: event.target.value }))}
                  placeholder="แต้มที่ใช้"
                  type="number"
                  className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={newReward.stock_qty}
                  onChange={(event) => setNewReward((prev) => ({ ...prev, stock_qty: event.target.value }))}
                  placeholder="จำนวนในสต็อก"
                  type="number"
                  className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={newReward.active}
                      onChange={(event) => setNewReward((prev) => ({ ...prev, active: event.target.checked }))}
                      className="h-4 w-4"
                    />
                    ใช้งาน
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleCreateReward()}
                    disabled={savingKey === 'new-reward'}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
            </motion.div>
          ) : null}
          </AnimatePresence>

          <div className="space-y-2">
            <div className="hidden md:flex md:items-center md:gap-2 px-3 pb-1 text-xs font-medium text-stone-400 uppercase tracking-wide">
              <span className="flex-1">ชื่อรางวัล</span>
              <span className="flex-1">รายละเอียด</span>
              <span className="w-20 shrink-0">แต้มที่ใช้</span>
              <span className="w-20 shrink-0">สต็อก</span>
              <span className="w-14 shrink-0">สถานะ</span>
              <span className="w-16 shrink-0" />
            </div>
            {rewardRows.map((row, index) => {
              const requestKey = `reward:${row.id}`;
              return (
                <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3 md:flex-row md:items-center">
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      value={row.name_th}
                      onChange={(event) => updateRewardRow(index, { name_th: event.target.value })}
                      className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="ชื่อรางวัล"
                    />
                    <input
                      value={row.description_th}
                      onChange={(event) => updateRewardRow(index, { description_th: event.target.value })}
                      className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="รายละเอียด"
                    />
                    <input
                      value={row.points_cost}
                      onChange={(event) => updateRewardRow(index, { points_cost: event.target.value })}
                      className="w-20 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      type="number"
                      placeholder="แต้ม"
                    />
                    <input
                      value={row.stock_qty}
                      onChange={(event) => updateRewardRow(index, { stock_qty: event.target.value })}
                      className="w-20 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      type="number"
                      placeholder="สต็อก"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        checked={row.active}
                        onChange={(event) => updateRewardRow(index, { active: event.target.checked })}
                        className="h-4 w-4"
                      />
                      ใช้งาน
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveRewardRow(row)}
                      disabled={savingKey === requestKey}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    >
                      {savingKey === requestKey ? '...' : 'บันทึก'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
    </div>
    </ErrorBoundary>
  );
}
