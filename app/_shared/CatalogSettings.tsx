'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Gift, ImagePlus, Plus, RefreshCw, Ruler, Save, Shapes, Trash2, X } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import SectionCard from '@/app/_components/SectionCard';
import { SkeletonBadge, SkeletonCard } from '@/app/_components/Skeleton';
import {
  ApiError,
  executiveApi,
  uploadRewardImage,
  deleteRewardImage,
  type ExecutiveMaterialTypeItem,
  type ExecutiveMeasurementUnitItem,
  type FarmerRewardItem,
} from '@/app/_lib/api';

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
  name_th: string;
  active: boolean;
  points_per_kg: string;
}

interface NewUnitDraft {
  name_th: string;
  to_kg_factor: string;
  active: boolean;
}

const defaultNewMaterial: NewMaterialDraft = {
  name_th: '',
  active: true,
  points_per_kg: '',
};

const defaultNewUnit: NewUnitDraft = {
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
  image_url: string | null;
  instruction_notes: string;
  uploadingImage?: boolean;
}

interface NewRewardDraft {
  name_th: string;
  description_th: string;
  points_cost: string;
  stock_qty: string;
  active: boolean;
  image_url: string | null;
  instruction_notes: string;
  uploadingImage?: boolean;
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

function mergeMaterialRows(materials: ExecutiveMaterialTypeItem[]): MaterialDraftRow[] {
  return materials.map((item) => ({
    originalCode: item.code,
    code: item.code,
    name_th: item.name_th,
    active: item.active,
    points_per_kg: item.points_per_kg === null ? '' : String(item.points_per_kg),
  }));
}

// ────────────────────────────────────────────────────────────────────────────

export default function CatalogSettings({ mode = 'executive' }: { mode?: 'executive' | 'factory' }) {
  const [isLoading, setIsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [materialRows, setMaterialRows] = useState<MaterialDraftRow[]>([]);
  const [savedMaterialRows, setSavedMaterialRows] = useState<MaterialDraftRow[]>([]);
  const [unitRows, setUnitRows] = useState<UnitDraftRow[]>([]);
  const [savedUnitRows, setSavedUnitRows] = useState<UnitDraftRow[]>([]);

  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState<NewMaterialDraft>(defaultNewMaterial);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnit, setNewUnit] = useState<NewUnitDraft>(defaultNewUnit);

  const [rewardRows, setRewardRows] = useState<RewardDraftRow[]>([]);
  const [savedRewardRows, setSavedRewardRows] = useState<RewardDraftRow[]>([]);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newReward, setNewReward] = useState<NewRewardDraft>({ name_th: '', description_th: '', points_cost: '', stock_qty: '', active: true, image_url: null, instruction_notes: '' });

  const activeMaterialCount = useMemo(
    () => materialRows.filter((row) => row.active).length,
    [materialRows],
  );
  const activeUnitCount = useMemo(() => unitRows.filter((row) => row.active).length, [unitRows]);
  const loadConfiguration = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const [materialResponse, unitResponse, rewardResponse] = await Promise.all([
        executiveApi.listMaterialTypes({ forceRefresh }),
        executiveApi.listMeasurementUnits({ forceRefresh }),
        executiveApi.listRewards({ forceRefresh }),
      ]);

      const mergedMaterials = mergeMaterialRows(materialResponse.material_types);
      const mergedUnits = unitResponse.units.map((item: ExecutiveMeasurementUnitItem) => ({
        originalCode: item.code,
        code: item.code,
        name_th: item.name_th,
        to_kg_factor: item.to_kg_factor === null ? '' : String(item.to_kg_factor),
        active: item.active,
      }));
      setMaterialRows(mergedMaterials);
      setSavedMaterialRows(mergedMaterials);
      setUnitRows(mergedUnits);
      setSavedUnitRows(mergedUnits);
      if (rewardResponse?.rewards) {
        const mergedRewards = rewardResponse.rewards.map((item: FarmerRewardItem) => ({
          id: item.id,
          name_th: item.name_th,
          description_th: item.description_th || '',
          points_cost: String(item.points_cost),
          stock_qty: String(item.stock_qty),
          active: item.active,
          image_url: item.image_url ?? null,
          instruction_notes: item.instruction_notes || '',
        }));
        setRewardRows(mergedRewards);
        setSavedRewardRows(mergedRewards);
      }

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
    const name = newMaterial.name_th.trim();
    if (!name) {
      setMessage('กรุณาระบุชื่อประเภทวัสดุ');
      return;
    }

    try {
      const pointsPerKg = parsePositiveNumber(newMaterial.points_per_kg, 'กรุณาระบุแต้มต่อกิโลกรัมให้เป็นตัวเลขมากกว่า 0');
      setSavingKey('material:new');
      await executiveApi.createMaterialType({
        name_th: name,
        active: newMaterial.active,
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
    const name = newUnit.name_th.trim();
    if (!name) {
      setMessage('กรุณาระบุชื่อหน่วย');
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
    const name = row.name_th.trim();
    if (!name) {
      setMessage('กรุณาระบุชื่อประเภทวัสดุ');
      return;
    }

    try {
      const pointsPerKg = parsePositiveNumber(row.points_per_kg, 'กรุณาระบุแต้มต่อกิโลกรัมให้เป็นตัวเลขมากกว่า 0');
      const requestKey = `material:${row.originalCode}`;
      setSavingKey(requestKey);
      await executiveApi.updateMaterialType(row.originalCode, {
        name_th: name,
        active: row.active,
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
    const name = row.name_th.trim();
    if (!name) {
      setMessage('กรุณาระบุชื่อหน่วย');
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

  const handleImageUpload = async (
    file: File,
    onUploading: (v: boolean) => void,
    onDone: (url: string) => void,
    oldUrl?: string | null,
    rewardId?: string, // if provided, auto-saves to DB after upload
  ) => {
    onUploading(true);
    try {
      if (oldUrl) await deleteRewardImage(oldUrl);
      const url = await uploadRewardImage(file);
      if (rewardId) await executiveApi.updateReward(rewardId, { image_url: url });
      onDone(url);
    } catch (e) {
      setMessage(e instanceof Error ? `อัปโหลดรูปไม่สำเร็จ: ${e.message}` : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      onUploading(false);
    }
  };

  // Delete image from storage + save null to DB immediately
  const handleDeleteImage = async (index: number) => {
    const row = rewardRows[index];
    if (!row.image_url) return;
    const oldUrl = row.image_url;
    // Optimistic clear
    updateRewardRow(index, { image_url: null, uploadingImage: true });
    try {
      await deleteRewardImage(oldUrl);
      await executiveApi.updateReward(row.id, { image_url: null });
      setMessage('ลบรูปภาพสำเร็จ');
    } catch (e) {
      // Rollback
      updateRewardRow(index, { image_url: oldUrl });
      setMessage(e instanceof Error ? `ลบรูปไม่สำเร็จ: ${e.message}` : 'ลบรูปไม่สำเร็จ');
    } finally {
      updateRewardRow(index, { uploadingImage: false });
    }
  };

  const cancelAddReward = async () => {
    const url = newReward.image_url;
    setIsAddingReward(false);
    setNewReward({ name_th: '', description_th: '', points_cost: '', stock_qty: '', active: true, image_url: null, instruction_notes: '' });
    if (url) {
      try { await deleteRewardImage(url); } catch { /* best-effort */ }
    }
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
        image_url: newReward.image_url ?? undefined,
        instruction_notes: newReward.instruction_notes.trim() || null,
      });
      setMessage('สร้างรางวัลสำเร็จ');
      setIsAddingReward(false);
      setNewReward({ name_th: '', description_th: '', points_cost: '', stock_qty: '', active: true, image_url: null, instruction_notes: '' });
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
        image_url: row.image_url,
        instruction_notes: row.instruction_notes.trim() || null,
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

  const isMaterialDirty = (row: MaterialDraftRow, index: number) => {
    const s = savedMaterialRows[index];
    if (!s) return false;
    return row.name_th !== s.name_th || row.active !== s.active || row.points_per_kg !== s.points_per_kg;
  };
  const isUnitDirty = (row: UnitDraftRow, index: number) => {
    const s = savedUnitRows[index];
    if (!s) return false;
    return row.name_th !== s.name_th || row.active !== s.active || row.to_kg_factor !== s.to_kg_factor;
  };
  const isRewardDirty = (row: RewardDraftRow, index: number) => {
    const s = savedRewardRows[index];
    if (!s) return false;
    return row.name_th !== s.name_th || row.description_th !== s.description_th ||
      row.points_cost !== s.points_cost || row.stock_qty !== s.stock_qty ||
      row.active !== s.active || row.instruction_notes !== s.instruction_notes;
  };

  const reduceMotion = useReducedMotion();

  // Image modal state
  const [imageModal, setImageModal] = useState<{ index: number } | null>(null);
  const imgModalRow = imageModal !== null ? rewardRows[imageModal.index] : null;


  return (
    <ErrorBoundary>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            {mode === 'factory' ? 'โรงงาน' : 'ผู้บริหาร'}
          </p>
          <h1 className="mt-0.5 text-3xl font-light tracking-tight text-on-surface sm:text-4xl">ตั้งค่าวัสดุ / รางวัล</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            จัดการประเภทวัสดุ อัตราแต้ม หน่วยวัด และรางวัลในระบบ
          </p>
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
        {isLoading ? (
          <><SkeletonBadge className="w-32" /><SkeletonBadge className="w-28" /><SkeletonBadge className="w-24" /></>
        ) : (
          <>
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
          </>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
            <div className="h-5 w-48 animate-pulse rounded-full bg-surface-container" />
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
            <div className="h-5 w-32 animate-pulse rounded-full bg-surface-container" />
            {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      ) : (
      <>
      <div className="grid gap-5">
        <SectionCard
          title="ประเภทวัสดุและอัตราแต้ม"
          description={<>วัสดุแต่ละชนิดได้แต้มต่างกัน — ยิ่งน้ำหนักมาก ยิ่งได้แต้มมาก ตัวเลขในช่อง &quot;แต้ม/กก.&quot; คือแต้มที่เกษตรกรได้ต่อวัสดุ 1 กิโลกรัม{' '}<span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">แนะนำ: 1 แต้ม ≈ 1 บาท</span></>}
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
            <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-emerald-700">เพิ่มประเภทวัสดุใหม่</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">ชื่อวัสดุ</label>
                  <input
                    value={newMaterial.name_th}
                    onChange={(event) => setNewMaterial((prev) => ({ ...prev, name_th: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    placeholder="เช่น ฟางข้าว"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">แต้มต่อกิโลกรัม</label>
                  <input
                    value={newMaterial.points_per_kg}
                    onChange={(event) => setNewMaterial((prev) => ({ ...prev, points_per_kg: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    placeholder="เช่น 1.0"
                    type="number"
                  />
                  <p className="text-[11px] text-stone-400">วัสดุ 1 กก. จะได้กี่แต้ม</p>
                </div>
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-transparent select-none">-</span>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-700 w-full">
                    <input
                      type="checkbox"
                      checked={newMaterial.active}
                      onChange={(event) => setNewMaterial((prev) => ({ ...prev, active: event.target.checked }))}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="font-medium">เปิดใช้งาน</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-emerald-100 pt-4">
                <button
                  type="button"
                  onClick={() => void handleCreateMaterial()}
                  disabled={savingKey === 'material:new'}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingMaterial(false); setNewMaterial(defaultNewMaterial); }}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                >
                  <X className="h-4 w-4" />
                  ยกเลิก
                </button>
              </div>
            </div>
            </motion.div>
          ) : null}
          </AnimatePresence>

          <div>
            <div className="hidden md:flex md:items-center md:gap-3 px-2 pb-2 border-b border-stone-100">
              <span className="flex-1 text-xs font-semibold text-stone-600">ชื่อวัสดุ</span>
              <span className="w-24 shrink-0 flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-stone-600">แต้ม / กก.</span>
                <span className="text-[11px] text-stone-400">วัสดุ 1 กก. ได้กี่แต้ม</span>
              </span>
              <span className="w-14 shrink-0 text-xs font-semibold text-stone-600">เปิดใช้</span>
              <span className="w-14 shrink-0" />
            </div>
            {materialRows.map((row, index) => {
              const requestKey = `material:${row.originalCode}`;
              const dirty = isMaterialDirty(row, index);
              return (
                <div key={row.originalCode} className="group flex flex-col gap-2 border-b border-stone-100 py-2.5 last:border-0 md:flex-row md:items-center md:gap-3 md:px-2">
                  <input
                    value={row.name_th}
                    onChange={(event) => updateMaterialRow(index, { name_th: event.target.value })}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 md:flex-1"
                    placeholder="ชื่อวัสดุ"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      value={row.points_per_kg}
                      onChange={(event) => updateMaterialRow(index, { points_per_kg: event.target.value })}
                      className="w-28 shrink-0 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 md:w-24"
                      placeholder="แต้ม/กก."
                      type="number"
                    />
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm text-stone-500">
                      <input type="checkbox" checked={row.active} onChange={(event) => updateMaterialRow(index, { active: event.target.checked })} className="h-4 w-4 accent-primary" />
                      <span className="text-xs">ใช้</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveMaterialRow(row)}
                      disabled={savingKey === requestKey}
                      className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 md:w-14 ${dirty ? 'bg-amber-500 shadow-sm shadow-amber-200 ring-2 ring-amber-300 hover:bg-amber-600' : 'bg-stone-300 hover:bg-stone-400'}`}
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
      <SectionCard
          title="จัดการรางวัล"
          description={<>เพิ่ม แก้ไข และเปิด/ปิดใช้งานรางวัลที่เกษตรกรเห็น{' '}<span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">แนะนำ: 1 แต้ม ≈ 1 บาท</span></>}
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
            ) : null
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
            <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">เพิ่มรางวัลใหม่</p>
                <button type="button" onClick={() => { void cancelAddReward(); }} className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">ชื่อรางวัล</label>
                  <input
                    value={newReward.name_th}
                    onChange={(event) => setNewReward((prev) => ({ ...prev, name_th: event.target.value }))}
                    placeholder="เช่น ปุ๋ยอินทรีย์ 25 กก."
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">รายละเอียด</label>
                  <input
                    value={newReward.description_th}
                    onChange={(event) => setNewReward((prev) => ({ ...prev, description_th: event.target.value }))}
                    placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">หมายเหตุ/เงื่อนไขการรับสินค้า</label>
                  <textarea
                    value={newReward.instruction_notes}
                    onChange={(e) => setNewReward((prev) => ({ ...prev, instruction_notes: e.target.value }))}
                    rows={3}
                    placeholder="เช่น เจ้าหน้าที่จะเข้าติดตั้งให้ภายหลัง (ไม่บังคับ)"
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">แต้มที่ใช้แลก</label>
                  <input
                    value={newReward.points_cost}
                    onChange={(event) => setNewReward((prev) => ({ ...prev, points_cost: event.target.value }))}
                    placeholder="เช่น 500"
                    type="number"
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  <p className="text-[11px] text-stone-400">จำนวนแต้มที่เกษตรกรต้องใช้เพื่อรับรางวัลนี้</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">จำนวนในสต็อก</label>
                  <input
                    value={newReward.stock_qty}
                    onChange={(event) => setNewReward((prev) => ({ ...prev, stock_qty: event.target.value }))}
                    placeholder="เช่น 100"
                    type="number"
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                {/* Image upload — new reward */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">รูปภาพรางวัล (ไม่บังคับ)</label>
                  {newReward.image_url ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={newReward.image_url} alt="" className="w-full rounded-2xl object-contain" style={{ maxHeight: '40vh' }} />
                      <div className="absolute right-2 top-2 flex gap-1.5">
                        <label className={`flex cursor-pointer items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/80 ${newReward.uploadingImage ? 'pointer-events-none opacity-60' : ''}`}>
                          <ImagePlus className="h-3.5 w-3.5" />
                          เปลี่ยนรูป
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              void handleImageUpload(
                                f,
                                (v) => setNewReward((prev) => ({ ...prev, uploadingImage: v })),
                                (url) => setNewReward((prev) => ({ ...prev, image_url: url })),
                                newReward.image_url,
                              );
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const url = newReward.image_url;
                            setNewReward((prev) => ({ ...prev, image_url: null }));
                            if (url) { void deleteRewardImage(url).catch(() => {}); }
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {newReward.uploadingImage && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <label className={`group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 py-10 transition-colors hover:border-primary hover:bg-primary/5 ${newReward.uploadingImage ? 'pointer-events-none' : ''}`}>
                      {newReward.uploadingImage ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-stone-300 bg-white transition-colors group-hover:border-primary">
                            <ImagePlus className="h-4 w-4 text-stone-400 transition-colors group-hover:text-primary" />
                          </div>
                          <p className="text-xs font-medium text-stone-500 transition-colors group-hover:text-primary">คลิกเพื่ออัปโหลดรูป</p>
                          <p className="text-[10px] text-stone-400">JPG · PNG · WebP · สูงสุด 5 MB</p>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          void handleImageUpload(
                            f,
                            (v) => setNewReward((prev) => ({ ...prev, uploadingImage: v })),
                            (url) => setNewReward((prev) => ({ ...prev, image_url: url })),
                            newReward.image_url,
                          );
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>

                <div className="flex items-end pb-0.5 sm:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={newReward.active}
                      onChange={(event) => setNewReward((prev) => ({ ...prev, active: event.target.checked }))}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="font-medium">เปิดให้เกษตรกรเห็นและแลก</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-emerald-100 pt-4">
                <button
                  type="button"
                  onClick={() => void handleCreateReward()}
                  disabled={savingKey === 'new-reward'}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => { void cancelAddReward(); }}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                >
                  <X className="h-4 w-4" />
                  ยกเลิก
                </button>
              </div>
            </div>
            </motion.div>
          ) : null}
          </AnimatePresence>

          <div>
            <div className="hidden md:grid px-2 pb-2 border-b border-stone-100 items-center gap-3" style={{ gridTemplateColumns: '36px 1fr 1fr 80px 80px 56px 56px' }}>
              <span />
              <span className="text-xs font-semibold text-stone-600">ชื่อรางวัล</span>
              <span className="text-xs font-semibold text-stone-600">รายละเอียดรางวัล</span>
              <span className="text-xs font-semibold text-stone-600">แต้มที่ใช้</span>
              <span className="text-xs font-semibold text-stone-600">สต็อก</span>
              <span className="text-xs font-semibold text-stone-600">เปิดใช้งาน</span>
              <span />
            </div>
            {rewardRows.map((row, index) => {
              const requestKey = `reward:${row.id}`;
              const dirty = isRewardDirty(row, index);
              return (
                <div key={row.id} className="border-b border-stone-100 last:border-0 py-2.5 md:px-2 flex flex-col gap-2">
                  <div className="flex flex-col gap-2 md:grid md:items-center md:gap-3" style={{ gridTemplateColumns: '36px 1fr 1fr 80px 80px 56px 56px' }}>
                    <button
                      type="button"
                      onClick={() => setImageModal({ index })}
                      className={`relative h-9 w-9 overflow-hidden rounded-lg border transition-all ${
                        row.image_url
                          ? 'border-stone-200 hover:ring-2 hover:ring-primary/30'
                          : 'border-dashed border-stone-300 hover:border-primary/60'
                      }`}
                      title={row.image_url ? 'ดู/เปลี่ยนรูปภาพ' : 'เพิ่มรูปภาพ'}
                    >
                      {row.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImagePlus className="h-3.5 w-3.5 text-stone-400 mx-auto" />
                      )}
                    </button>
                    <input
                      value={row.name_th}
                      onChange={(event) => updateRewardRow(index, { name_th: event.target.value })}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                      placeholder="ชื่อรางวัล"
                    />
                    <input
                      value={row.description_th}
                      onChange={(event) => updateRewardRow(index, { description_th: event.target.value })}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                      placeholder="รายละเอียด"
                    />
                    <input
                      value={row.points_cost}
                      onChange={(event) => updateRewardRow(index, { points_cost: event.target.value })}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                      type="number"
                      placeholder="แต้ม"
                    />
                    <input
                      value={row.stock_qty}
                      onChange={(event) => updateRewardRow(index, { stock_qty: event.target.value })}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                      type="number"
                      placeholder="สต็อก"
                    />
                    <label className="flex cursor-pointer items-center gap-1.5 text-stone-500">
                      <input type="checkbox" checked={row.active} onChange={(event) => updateRewardRow(index, { active: event.target.checked })} className="h-4 w-4 accent-primary" />
                      <span className="text-xs">ใช้</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveRewardRow(row)}
                      disabled={savingKey === requestKey}
                      className={`w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 ${dirty ? 'bg-amber-500 shadow-sm shadow-amber-200 ring-2 ring-amber-300 hover:bg-amber-600' : 'bg-stone-300 hover:bg-stone-400'}`}
                    >
                      {savingKey === requestKey ? '...' : 'บันทึก'}
                    </button>
                  </div>
                  <textarea
                    value={row.instruction_notes}
                    onChange={(e) => updateRewardRow(index, { instruction_notes: e.target.value })}
                    rows={2}
                    placeholder="หมายเหตุ/เงื่อนไขการรับสินค้า (ไม่บังคับ)"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 resize-none"
                  />
                </div>
              );
            })}
          </div>
        </SectionCard>

      <SectionCard
          title="หน่วยวัด"
          description="หน่วยที่เกษตรกรใช้แจ้งปริมาณ เช่น กิโลกรัม ตัน หรือก้อน — ระบบแปลงเป็นกิโลกรัมอัตโนมัติเพื่อคำนวณแต้ม"
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
            <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-emerald-700">เพิ่มหน่วยวัดใหม่</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">ชื่อหน่วย</label>
                  <input
                    value={newUnit.name_th}
                    onChange={(event) => setNewUnit((prev) => ({ ...prev, name_th: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    placeholder="เช่น กิโลกรัม"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">เท่ากับกี่ กก.</label>
                  <input
                    value={newUnit.to_kg_factor}
                    onChange={(event) => setNewUnit((prev) => ({ ...prev, to_kg_factor: event.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    placeholder="เช่น 1000 (สำหรับตัน)"
                    type="number"
                  />
                  <p className="text-[11px] text-stone-400">1 หน่วยนี้ = กี่กิโลกรัม (เว้นว่างได้)</p>
                </div>
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-transparent select-none">-</span>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-700 w-full">
                    <input
                      type="checkbox"
                      checked={newUnit.active}
                      onChange={(event) => setNewUnit((prev) => ({ ...prev, active: event.target.checked }))}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="font-medium">เปิดใช้งาน</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-emerald-100 pt-4">
                <button
                  type="button"
                  onClick={() => void handleCreateUnit()}
                  disabled={savingKey === 'unit:new'}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingUnit(false); setNewUnit(defaultNewUnit); }}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                >
                  <X className="h-4 w-4" />
                  ยกเลิก
                </button>
              </div>
            </div>
            </motion.div>
          ) : null}
          </AnimatePresence>

          <div>
            <div className="hidden md:flex md:items-center md:gap-3 px-2 pb-2 border-b border-stone-100">
              <span className="flex-1 text-xs font-semibold text-stone-600">ชื่อหน่วย</span>
              <span className="w-24 shrink-0 flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-stone-600">เท่ากับกี่ กก.</span>
                <span className="text-[11px] text-stone-400">1 หน่วย = ? กก.</span>
              </span>
              <span className="w-14 shrink-0 text-xs font-semibold text-stone-600">เปิดใช้</span>
              <span className="w-14 shrink-0" />
            </div>
            {unitRows.map((row, index) => {
              const requestKey = `unit:${row.originalCode}`;
              const dirty = isUnitDirty(row, index);
              return (
                <div key={row.originalCode} className="group flex flex-col gap-2 border-b border-stone-100 py-2.5 last:border-0 md:flex-row md:items-center md:gap-3 md:px-2">
                  <input
                    value={row.name_th}
                    onChange={(event) => updateUnitRow(index, { name_th: event.target.value })}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 md:flex-1"
                    placeholder="ชื่อหน่วย"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      value={row.to_kg_factor}
                      onChange={(event) => updateUnitRow(index, { to_kg_factor: event.target.value })}
                      className="w-28 shrink-0 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 md:w-24"
                      placeholder="กก."
                      type="number"
                    />
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm text-stone-500">
                      <input type="checkbox" checked={row.active} onChange={(event) => updateUnitRow(index, { active: event.target.checked })} className="h-4 w-4 accent-primary" />
                      <span className="text-xs">ใช้</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveUnitRow(row)}
                      disabled={savingKey === requestKey}
                      className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 md:w-14 ${dirty ? 'bg-amber-500 shadow-sm shadow-amber-200 ring-2 ring-amber-300 hover:bg-amber-600' : 'bg-stone-300 hover:bg-stone-400'}`}
                    >
                      {savingKey === requestKey ? '...' : 'บันทึก'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </>
      )}
    </div>

    {/* ── Reward image modal ── */}
    <AnimatePresence>
      {imageModal !== null && imgModalRow && (
        <>
          {/* Backdrop */}
          <motion.div
            key="img-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setImageModal(null)}
          />
          {/* Panel */}
          <motion.div
            key="img-modal-panel"
            initial={reduceMotion ? {} : { opacity: 0, scale: 0.95, y: 12 }}
            animate={reduceMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? {} : { opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-stone-800">รูปภาพรางวัล</p>
                <p className="text-xs text-stone-400 truncate max-w-[220px]">{imgModalRow.name_th}</p>
              </div>
              <button
                type="button"
                onClick={() => setImageModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Image area — natural dimensions, no crop */}
            <div className="px-5 pt-4">
              {imgModalRow.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgModalRow.image_url}
                  alt={imgModalRow.name_th}
                  className="w-full rounded-2xl object-contain"
                  style={{ maxHeight: '60vh' }}
                />
              ) : (
                <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50">
                  <Gift className="h-8 w-8 text-stone-300" />
                  <p className="text-xs text-stone-400">ยังไม่มีรูปภาพ</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 px-5 py-4">
              {imgModalRow.uploadingImage ? (
                <div className="flex flex-1 items-center justify-center gap-2 py-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs text-stone-500">กำลังอัปโหลด...</span>
                </div>
              ) : (
                <>
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
                    <ImagePlus className="h-4 w-4" />
                    {imgModalRow.image_url ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const idx = imageModal.index;
                        void handleImageUpload(
                          f,
                          (v) => updateRewardRow(idx, { uploadingImage: v }),
                          (url) => updateRewardRow(idx, { image_url: url }),
                          imgModalRow.image_url,
                          imgModalRow.id,
                        );
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {imgModalRow.image_url && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteImage(imageModal.index);
                        setImageModal(null);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="px-5 pb-4 text-center text-[10px] text-stone-400">JPG · PNG · WebP · สูงสุด 5 MB</p>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    </ErrorBoundary>
  );
}
