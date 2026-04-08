import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, X } from 'lucide-react';
import {
  ApiError,
  executiveApi,
  type ExecutiveMaterialPointRuleItem,
  type ExecutiveMaterialTypeItem,
  type ExecutiveMeasurementUnitItem,
} from '@/src/lib/apiClient';

interface MaterialDraftRow {
  originalCode: string;
  code: string;
  name_th: string;
  sort_order: number;
  active: boolean;
}

interface UnitDraftRow {
  originalCode: string;
  code: string;
  name_th: string;
  to_kg_factor: string;
  sort_order: number;
  active: boolean;
}

interface NewMaterialDraft {
  code: string;
  name_th: string;
  sort_order: number;
  active: boolean;
}

interface NewUnitDraft {
  code: string;
  name_th: string;
  to_kg_factor: string;
  sort_order: number;
  active: boolean;
}

const defaultNewMaterial: NewMaterialDraft = {
  code: '',
  name_th: '',
  sort_order: 100,
  active: true,
};

const defaultNewUnit: NewUnitDraft = {
  code: '',
  name_th: '',
  to_kg_factor: '',
  sort_order: 100,
  active: true,
};

function parseSortOrder(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export default function ExecutiveSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [formulaDescription, setFormulaDescription] = useState('');
  const [materialRows, setMaterialRows] = useState<MaterialDraftRow[]>([]);
  const [unitRows, setUnitRows] = useState<UnitDraftRow[]>([]);
  const [pointRules, setPointRules] = useState<ExecutiveMaterialPointRuleItem[]>([]);
  const [pointDrafts, setPointDrafts] = useState<Record<string, string>>({});

  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState<NewMaterialDraft>(defaultNewMaterial);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnit, setNewUnit] = useState<NewUnitDraft>(defaultNewUnit);

  const loadConfiguration = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const [materialResponse, unitResponse, pointRuleResponse] = await Promise.all([
        executiveApi.listMaterialTypes({ forceRefresh }),
        executiveApi.listMeasurementUnits({ forceRefresh }),
        executiveApi.listMaterialPointRules({ forceRefresh }),
      ]);

      setMaterialRows(
        materialResponse.material_types.map((item: ExecutiveMaterialTypeItem) => ({
          originalCode: item.code,
          code: item.code,
          name_th: item.name_th,
          sort_order: item.sort_order,
          active: item.active,
        })),
      );

      setUnitRows(
        unitResponse.units.map((item: ExecutiveMeasurementUnitItem) => ({
          originalCode: item.code,
          code: item.code,
          name_th: item.name_th,
          to_kg_factor: item.to_kg_factor === null ? '' : String(item.to_kg_factor),
          sort_order: item.sort_order,
          active: item.active,
        })),
      );

      setPointRules(pointRuleResponse.rules);
      setFormulaDescription(pointRuleResponse.formula);
      const nextPointDrafts: Record<string, string> = {};
      pointRuleResponse.rules.forEach((rule) => {
        nextPointDrafts[rule.material_type] = rule.points_per_kg === null ? '' : String(rule.points_per_kg);
      });
      setPointDrafts(nextPointDrafts);
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
      setMessage('กรุณาระบุรหัสและชื่อ material ให้ครบ');
      return;
    }

    setSavingKey('material:new');
    try {
      await executiveApi.createMaterialType({
        code,
        name_th: name,
        sort_order: newMaterial.sort_order,
        active: newMaterial.active,
      });
      setIsAddingMaterial(false);
      setNewMaterial(defaultNewMaterial);
      await loadConfiguration(true);
      setMessage('เพิ่ม material สำเร็จ');
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`เพิ่ม material ไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('เพิ่ม material ไม่สำเร็จ');
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
        sort_order: newUnit.sort_order,
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
      setMessage('กรุณาระบุรหัสและชื่อ material ให้ครบ');
      return;
    }

    const requestKey = `material:${row.originalCode}`;
    setSavingKey(requestKey);
    try {
      await executiveApi.updateMaterialType(row.originalCode, {
        code,
        name_th: name,
        sort_order: row.sort_order,
        active: row.active,
      });
      await loadConfiguration(true);
      setMessage('บันทึก material สำเร็จ');
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`บันทึก material ไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('บันทึก material ไม่สำเร็จ');
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
        sort_order: row.sort_order,
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

  const savePointRule = async (materialCode: string) => {
    const rawValue = (pointDrafts[materialCode] || '').trim();
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setMessage('อัตราแต้มต่อกก. ต้องเป็นตัวเลขมากกว่า 0');
      return;
    }

    const requestKey = `point:${materialCode}`;
    setSavingKey(requestKey);
    try {
      await executiveApi.upsertMaterialPointRule(materialCode, {
        points_per_kg: parsedValue,
      });
      await loadConfiguration(true);
      setMessage(`บันทึกสูตรแต้มของ ${materialCode} สำเร็จ`);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`บันทึกสูตรแต้มไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('บันทึกสูตรแต้มไม่สำเร็จ');
      }
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-gradient-to-r from-stone-50 to-emerald-50/50 p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-stone-900">ตั้งค่าระบบสำหรับ Executive</h1>
            <p className="text-sm text-stone-600 mt-2">จัดการ material, หน่วยแสดงผล และสูตรคำนวณแต้มต่อกิโลกรัม</p>
          </div>
          <button
            type="button"
            onClick={() => void loadConfiguration(true)}
            disabled={isLoading}
            className="px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> รีเฟรชข้อมูล
          </button>
        </div>
        {message && (
          <p className="mt-3 text-sm text-stone-700 bg-white border border-stone-200 rounded-lg px-3 py-2 inline-block">{message}</p>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Material Types</h2>
          {!isAddingMaterial ? (
            <button
              type="button"
              onClick={() => setIsAddingMaterial(true)}
              className="px-3 py-1.5 rounded-full bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่ม Material
            </button>
          ) : null}
        </div>

        {isAddingMaterial ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            <div>
              <p className="text-xs text-stone-600 mb-1">Code</p>
              <input
                value={newMaterial.code}
                onChange={(event) => setNewMaterial((prev) => ({ ...prev, code: event.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-2 py-1.5"
              />
            </div>
            <div>
              <p className="text-xs text-stone-600 mb-1">ชื่อ</p>
              <input
                value={newMaterial.name_th}
                onChange={(event) => setNewMaterial((prev) => ({ ...prev, name_th: event.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-2 py-1.5"
              />
            </div>
            <div>
              <p className="text-xs text-stone-600 mb-1">ลำดับ</p>
              <input
                type="number"
                value={newMaterial.sort_order}
                onChange={(event) =>
                  setNewMaterial((prev) => ({ ...prev, sort_order: parseSortOrder(event.target.valueAsNumber) }))
                }
                className="w-full border border-stone-300 rounded-lg px-2 py-1.5"
              />
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={newMaterial.active}
                onChange={(event) => setNewMaterial((prev) => ({ ...prev, active: event.target.checked }))}
              />
              <span className="text-sm">เปิดใช้งาน</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => void handleCreateMaterial()}
                disabled={savingKey === 'material:new'}
                className="px-3 py-1.5 rounded-full bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" /> บันทึกเพิ่ม
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingMaterial(false);
                  setNewMaterial(defaultNewMaterial);
                }}
                className="px-3 py-1.5 rounded-full border border-stone-300 text-xs font-semibold text-stone-700 inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> ยกเลิก
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-stone-600 border-b border-stone-200">
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 px-2">ชื่อ</th>
                <th className="py-2 px-2">ลำดับ</th>
                <th className="py-2 px-2">สถานะ</th>
                <th className="py-2 pl-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {materialRows.map((row, index) => {
                const requestKey = `material:${row.originalCode}`;
                return (
                  <tr key={row.originalCode} className="border-b border-stone-100">
                    <td className="py-2 pr-2 align-top">
                      <input
                        value={row.code}
                        onChange={(event) => updateMaterialRow(index, { code: event.target.value })}
                        className="w-full border border-stone-300 rounded-lg px-2 py-1"
                      />
                    </td>
                    <td className="py-2 px-2 align-top">
                      <input
                        value={row.name_th}
                        onChange={(event) => updateMaterialRow(index, { name_th: event.target.value })}
                        className="w-full border border-stone-300 rounded-lg px-2 py-1"
                      />
                    </td>
                    <td className="py-2 px-2 align-top w-28">
                      <input
                        type="number"
                        value={row.sort_order}
                        onChange={(event) =>
                          updateMaterialRow(index, { sort_order: parseSortOrder(event.target.valueAsNumber) })
                        }
                        className="w-full border border-stone-300 rounded-lg px-2 py-1"
                      />
                    </td>
                    <td className="py-2 px-2 align-top w-28">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.active}
                          onChange={(event) => updateMaterialRow(index, { active: event.target.checked })}
                        />
                        <span>{row.active ? 'เปิด' : 'ปิด'}</span>
                      </label>
                    </td>
                    <td className="py-2 pl-2 align-top text-right w-32">
                      <button
                        type="button"
                        onClick={() => void saveMaterialRow(row)}
                        disabled={savingKey === requestKey}
                        className="px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" /> บันทึก
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">สูตรแต้มราย Material</h2>
        <p className="text-sm text-stone-600">
          สูตรคำนวณปัจจุบัน: <span className="font-mono">{formulaDescription || 'max(floor(weight_kg * points_per_kg), 1)'}</span>
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-stone-600 border-b border-stone-200">
                <th className="py-2 pr-2">Material</th>
                <th className="py-2 px-2">สถานะ</th>
                <th className="py-2 px-2">Points / kg</th>
                <th className="py-2 pl-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pointRules.map((rule) => {
                const requestKey = `point:${rule.material_type}`;
                return (
                  <tr key={rule.material_type} className="border-b border-stone-100">
                    <td className="py-2 pr-2 align-top">
                      <p className="font-medium">{rule.material_name_th}</p>
                      <p className="text-xs text-stone-500">{rule.material_type}</p>
                    </td>
                    <td className="py-2 px-2 align-top w-28">
                      <span className={rule.material_active ? 'text-emerald-700' : 'text-rose-700'}>
                        {rule.material_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                    </td>
                    <td className="py-2 px-2 align-top w-44">
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={pointDrafts[rule.material_type] ?? ''}
                        onChange={(event) => setPointDrafts((prev) => ({ ...prev, [rule.material_type]: event.target.value }))}
                        className="w-full border border-stone-300 rounded-lg px-2 py-1"
                      />
                    </td>
                    <td className="py-2 pl-2 align-top text-right w-32">
                      <button
                        type="button"
                        onClick={() => void savePointRule(rule.material_type)}
                        disabled={savingKey === requestKey}
                        className="px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" /> บันทึก
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Measurement Units</h2>
          {!isAddingUnit ? (
            <button
              type="button"
              onClick={() => setIsAddingUnit(true)}
              className="px-3 py-1.5 rounded-full bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มหน่วย
            </button>
          ) : null}
        </div>

        {isAddingUnit ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
            <div>
              <p className="text-xs text-stone-600 mb-1">Code</p>
              <input
                value={newUnit.code}
                onChange={(event) => setNewUnit((prev) => ({ ...prev, code: event.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-2 py-1.5"
              />
            </div>
            <div>
              <p className="text-xs text-stone-600 mb-1">ชื่อแสดงผล</p>
              <input
                value={newUnit.name_th}
                onChange={(event) => setNewUnit((prev) => ({ ...prev, name_th: event.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-2 py-1.5"
              />
            </div>
            <div>
              <p className="text-xs text-stone-600 mb-1">ค่าแปลงเป็นกก.</p>
              <input
                value={newUnit.to_kg_factor}
                onChange={(event) => setNewUnit((prev) => ({ ...prev, to_kg_factor: event.target.value }))}
                placeholder="เว้นว่างได้"
                className="w-full border border-stone-300 rounded-lg px-2 py-1.5"
              />
            </div>
            <div>
              <p className="text-xs text-stone-600 mb-1">ลำดับ</p>
              <input
                type="number"
                value={newUnit.sort_order}
                onChange={(event) => setNewUnit((prev) => ({ ...prev, sort_order: parseSortOrder(event.target.valueAsNumber) }))}
                className="w-full border border-stone-300 rounded-lg px-2 py-1.5"
              />
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={newUnit.active}
                onChange={(event) => setNewUnit((prev) => ({ ...prev, active: event.target.checked }))}
              />
              <span className="text-sm">เปิดใช้งาน</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => void handleCreateUnit()}
                disabled={savingKey === 'unit:new'}
                className="px-3 py-1.5 rounded-full bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" /> บันทึกเพิ่ม
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingUnit(false);
                  setNewUnit(defaultNewUnit);
                }}
                className="px-3 py-1.5 rounded-full border border-stone-300 text-xs font-semibold text-stone-700 inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> ยกเลิก
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-stone-600 border-b border-stone-200">
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 px-2">ชื่อ</th>
                <th className="py-2 px-2">ค่าแปลงเป็นกก.</th>
                <th className="py-2 px-2">ลำดับ</th>
                <th className="py-2 px-2">สถานะ</th>
                <th className="py-2 pl-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {unitRows.map((row, index) => {
                const requestKey = `unit:${row.originalCode}`;
                return (
                  <tr key={row.originalCode} className="border-b border-stone-100">
                    <td className="py-2 pr-2 align-top">
                      <input
                        value={row.code}
                        onChange={(event) => updateUnitRow(index, { code: event.target.value })}
                        className="w-full border border-stone-300 rounded-lg px-2 py-1"
                      />
                    </td>
                    <td className="py-2 px-2 align-top">
                      <input
                        value={row.name_th}
                        onChange={(event) => updateUnitRow(index, { name_th: event.target.value })}
                        className="w-full border border-stone-300 rounded-lg px-2 py-1"
                      />
                    </td>
                    <td className="py-2 px-2 align-top w-44">
                      <input
                        value={row.to_kg_factor}
                        onChange={(event) => updateUnitRow(index, { to_kg_factor: event.target.value })}
                        placeholder="เว้นว่างได้"
                        className="w-full border border-stone-300 rounded-lg px-2 py-1"
                      />
                    </td>
                    <td className="py-2 px-2 align-top w-28">
                      <input
                        type="number"
                        value={row.sort_order}
                        onChange={(event) => updateUnitRow(index, { sort_order: parseSortOrder(event.target.valueAsNumber) })}
                        className="w-full border border-stone-300 rounded-lg px-2 py-1"
                      />
                    </td>
                    <td className="py-2 px-2 align-top w-28">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.active}
                          onChange={(event) => updateUnitRow(index, { active: event.target.checked })}
                        />
                        <span>{row.active ? 'เปิด' : 'ปิด'}</span>
                      </label>
                    </td>
                    <td className="py-2 pl-2 align-top text-right w-32">
                      <button
                        type="button"
                        onClick={() => void saveUnitRow(row)}
                        disabled={savingKey === requestKey}
                        className="px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" /> บันทึก
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isLoading ? <p className="text-sm text-stone-500">กำลังโหลดข้อมูล...</p> : null}
    </div>
  );
}
