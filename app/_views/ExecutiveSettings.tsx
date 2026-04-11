'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Coins, Plus, RefreshCw, Ruler, Save, Shapes, X } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import SectionCard from '@/app/_components/SectionCard';
import {
  ApiError,
  executiveApi,
  type ExecutiveMaterialPointRuleItem,
  type ExecutiveMaterialTypeItem,
  type ExecutiveMeasurementUnitItem,
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
      const [materialResponse, unitResponse, pointRuleResponse] = await Promise.all([
        executiveApi.listMaterialTypes({ forceRefresh }),
        executiveApi.listMeasurementUnits({ forceRefresh }),
        executiveApi.listMaterialPointRules({ forceRefresh }),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">ตั้งค่าระบบ</h1>
        <button
          type="button"
          onClick={() => void loadConfiguration(true)}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}
        </button>
      </div>

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      <SectionCard
        title="ภาพรวมการตั้งค่าปัจจุบัน"
        description="ใช้ดูสถานะ master data และสูตรแต้มก่อนลงมือแก้ไข"
      >
        <div className="grid gap-4 xl:grid-cols-[0.95fr,0.95fr,1.1fr]">
          <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-primary shadow-sm">
                <Shapes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-stone-600">ประเภทวัสดุที่เปิดใช้</p>
                <p className="text-2xl font-semibold text-stone-950">{activeMaterialCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-primary shadow-sm">
                <Ruler className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-stone-600">หน่วยวัดที่เปิดใช้</p>
                <p className="text-2xl font-semibold text-stone-950">{activeUnitCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-emerald-100 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-primary">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-stone-600">สูตรแต้มที่ตั้งไว้แล้ว</p>
                <p className="text-2xl font-semibold text-stone-950">{configuredPointCount}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              {formulaDescription || 'ยังไม่มีคำอธิบายสูตรจากระบบ'}
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-[1.18fr,0.82fr]">
        <SectionCard
          title="ประเภทวัสดุและแต้มต่อกิโลกรัม"
          description="ตารางนี้รวมข้อมูล master ของวัสดุและอัตราแต้มไว้ในที่เดียว เพื่อไม่ต้องเลื่อนสลับไปอีกส่วน"
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
          {isAddingMaterial ? (
            <div className="mb-4 grid gap-3 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/45 p-4 md:grid-cols-[0.9fr,1.2fr,10rem,8.5rem,auto]">
              <input
                value={newMaterial.code}
                onChange={(event) => setNewMaterial((prev) => ({ ...prev, code: event.target.value }))}
                className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                placeholder="Code"
              />
              <input
                value={newMaterial.name_th}
                onChange={(event) => setNewMaterial((prev) => ({ ...prev, name_th: event.target.value }))}
                className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                placeholder="ชื่อวัสดุ"
              />
              <input
                value={newMaterial.points_per_kg}
                onChange={(event) => setNewMaterial((prev) => ({ ...prev, points_per_kg: event.target.value }))}
                className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                placeholder="แต้ม/กก."
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
          ) : null}

          <div className="xl:max-h-[34rem] xl:overflow-y-auto xl:pr-1">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-sm font-medium text-stone-600">
                    <th className="pb-3 pl-3">รหัส</th>
                    <th className="pb-3">ชื่อวัสดุ</th>
                    <th className="pb-3">แต้ม/กก.</th>
                    <th className="pb-3">สถานะ</th>
                    <th className="pb-3 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {materialRows.map((row, index) => {
                    const requestKey = `material:${row.originalCode}`;
                    return (
                      <tr key={row.originalCode} className="border border-line bg-surface-muted">
                        <td className="p-2 pl-3">
                          <input
                            value={row.code}
                            onChange={(event) => updateMaterialRow(index, { code: event.target.value })}
                            className="w-full min-w-[5rem] rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            value={row.name_th}
                            onChange={(event) => updateMaterialRow(index, { name_th: event.target.value })}
                            className="w-full min-w-[10rem] rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            value={row.points_per_kg}
                            onChange={(event) => updateMaterialRow(index, { points_per_kg: event.target.value })}
                            className="w-full min-w-[7rem] rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="แต้ม/กก."
                          />
                        </td>
                        <td className="p-2">
                          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-stone-700">
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(event) => updateMaterialRow(index, { active: event.target.checked })}
                              className="h-4 w-4"
                            />
                            ใช้งาน
                          </label>
                        </td>
                        <td className="p-2 pr-3">
                          <button
                            type="button"
                            onClick={() => void saveMaterialRow(row)}
                            disabled={savingKey === requestKey}
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                          >
                            <Save className="h-4 w-4" />
                            บันทึก
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
          {isAddingUnit ? (
            <div className="mb-4 grid gap-3 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/45 p-4 md:grid-cols-[0.8fr,1fr,10rem,8.5rem,auto]">
              <input
                value={newUnit.code}
                onChange={(event) => setNewUnit((prev) => ({ ...prev, code: event.target.value }))}
                className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                placeholder="Code"
              />
              <input
                value={newUnit.name_th}
                onChange={(event) => setNewUnit((prev) => ({ ...prev, name_th: event.target.value }))}
                className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                placeholder="ชื่อหน่วย"
              />
              <input
                value={newUnit.to_kg_factor}
                onChange={(event) => setNewUnit((prev) => ({ ...prev, to_kg_factor: event.target.value }))}
                className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 outline-none"
                placeholder="ตัวแปลงเป็นกก."
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
          ) : null}

          <div className="xl:max-h-[34rem] xl:overflow-y-auto xl:pr-1">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-sm font-medium text-stone-600">
                    <th className="pb-3 pl-3">รหัส</th>
                    <th className="pb-3">ชื่อหน่วย</th>
                    <th className="pb-3">ตัวแปลงเป็นกก.</th>
                    <th className="pb-3">สถานะ</th>
                    <th className="pb-3 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {unitRows.map((row, index) => {
                    const requestKey = `unit:${row.originalCode}`;
                    return (
                      <tr key={row.originalCode} className="border border-line bg-surface-muted">
                        <td className="p-2 pl-3">
                          <input
                            value={row.code}
                            onChange={(event) => updateUnitRow(index, { code: event.target.value })}
                            className="w-full min-w-[5rem] rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            value={row.name_th}
                            onChange={(event) => updateUnitRow(index, { name_th: event.target.value })}
                            className="w-full min-w-[10rem] rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            value={row.to_kg_factor}
                            onChange={(event) => updateUnitRow(index, { to_kg_factor: event.target.value })}
                            className="w-full min-w-[7rem] rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="ปล่อยว่างได้"
                          />
                        </td>
                        <td className="p-2">
                          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-stone-700">
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(event) => updateUnitRow(index, { active: event.target.checked })}
                              className="h-4 w-4"
                            />
                            ใช้งาน
                          </label>
                        </td>
                        <td className="p-2 pr-3">
                          <button
                            type="button"
                            onClick={() => void saveUnitRow(row)}
                            disabled={savingKey === requestKey}
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                          >
                            <Save className="h-4 w-4" />
                            บันทึก
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
