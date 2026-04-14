'use client';

/**
 * RewardImageSection — shared component for executive / admin / factory settings.
 * Renders a list of all rewards with their current images and an upload/clear control per row.
 * Calls executiveApi (backend allows EXECUTIVE, ADMIN, FACTORY on these routes).
 */

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Gift, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import { executiveApi, uploadRewardImage, type FarmerRewardItem } from '@/app/_lib/apiClient';

function hasAccessToken() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function RewardThumb({ src, alt }: { src: string | null; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (src && !errored) {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          className="object-cover"
          onError={() => setErrored(true)}
          sizes="56px"
        />
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50">
      <Gift className="h-5 w-5 text-stone-300" />
    </div>
  );
}

interface RowState {
  id: string;
  name_th: string;
  image_url: string | null;
  uploading: boolean;
  saving: boolean;
}

export default function RewardImageSection() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = async (force = false) => {
    if (!hasAccessToken()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await executiveApi.listRewards(force ? { forceRefresh: true } : undefined);
      setRows(
        (res.rewards ?? []).map((r: FarmerRewardItem) => ({
          id: r.id,
          name_th: r.name_th,
          image_url: r.image_url ?? null,
          uploading: false,
          saving: false,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดรายการรางวัลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const patch = (id: string, update: Partial<RowState>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));

  const handleUpload = async (id: string, file: File) => {
    patch(id, { uploading: true });
    try {
      const url = await uploadRewardImage(file);
      patch(id, { image_url: url, uploading: false });
    } catch (e) {
      setError(e instanceof Error ? `อัปโหลดรูปไม่สำเร็จ: ${e.message}` : 'อัปโหลดรูปไม่สำเร็จ');
      patch(id, { uploading: false });
    }
  };

  const handleSave = async (row: RowState) => {
    patch(row.id, { saving: true });
    try {
      await executiveApi.updateReward(row.id, { image_url: row.image_url });
      setSuccessMsg(`บันทึกรูปของ "${row.name_th}" สำเร็จ`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      patch(row.id, { saving: false });
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-stone-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <AlertBanner tone="error" message={error} />}
      {successMsg && <AlertBanner tone="success" message={successMsg} />}

      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-400">
          คลิกไอคอนรูปเพื่ออัปโหลด จากนั้นกด "บันทึก"
        </p>
        <button
          type="button"
          onClick={() => void load(true)}
          className="flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          รีเฟรช
        </button>
      </div>

      {rows.length === 0 && (
        <p className="py-6 text-center text-sm text-stone-400">ยังไม่มีรางวัลในระบบ</p>
      )}

      <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 px-4 py-3">
            {/* Thumbnail */}
            <RewardThumb src={row.image_url} alt={row.name_th} />

            {/* Name */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-800">{row.name_th}</p>
              <p className="text-xs text-stone-400">
                {row.image_url ? 'มีรูปภาพ' : 'ยังไม่มีรูป'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Upload trigger */}
              <label
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-dashed border-stone-300 text-stone-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors ${row.uploading ? 'opacity-50 pointer-events-none' : ''}`}
                title="อัปโหลดรูปใหม่"
              >
                <ImagePlus className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    void handleUpload(row.id, f);
                    e.target.value = '';
                  }}
                />
              </label>

              {/* Clear image */}
              {row.image_url && (
                <button
                  type="button"
                  onClick={() => patch(row.id, { image_url: null })}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                  title="ลบรูป"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {/* Save */}
              <button
                type="button"
                onClick={() => void handleSave(row)}
                disabled={row.saving || row.uploading}
                className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {row.saving ? '...' : 'บันทึก'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
