'use client';

/**
 * RewardImageSection — shared component for executive / admin / factory settings.
 * Renders a card grid of all rewards with large image drop zones and contextual save.
 */

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Coins, ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import { executiveApi, uploadRewardImage, type FarmerRewardItem } from '@/app/_lib/apiClient';

function hasAccessToken() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

interface RowState {
  id: string;
  name_th: string;
  description_th: string | null;
  points_cost: number;
  image_url: string | null;
  saved_image_url: string | null; // what's on the server
  uploading: boolean;
  saving: boolean;
  justSaved: boolean;
}

function RewardCard({
  row,
  onUpload,
  onClear,
  onSave,
}: {
  row: RowState;
  onUpload: (id: string, file: File) => void;
  onClear: (id: string) => void;
  onSave: (row: RowState) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isDirty = row.image_url !== row.saved_image_url;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) onUpload(row.id, file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onUpload(row.id, f);
    e.target.value = '';
  };

  const hasImage = row.image_url && !imgError;

  return (
    <motion.div
      layout
      className={`group relative rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        isDirty ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-stone-200'
      }`}
    >
      {/* Image zone */}
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl cursor-pointer ${
          dragging ? 'ring-2 ring-emerald-400 ring-offset-2' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !row.uploading && inputRef.current?.click()}
      >
        {hasImage ? (
          <>
            <Image
              src={row.image_url!}
              alt={row.name_th}
              fill
              unoptimized
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              onError={() => setImgError(true)}
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
              <ImagePlus className="h-6 w-6 text-white drop-shadow" />
              <span className="text-xs font-semibold text-white drop-shadow">เปลี่ยนรูป</span>
            </div>
          </>
        ) : (
          /* Empty drop zone */
          <div className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-stone-50 transition-colors ${dragging ? 'bg-emerald-50' : ''}`}>
            <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed transition-colors ${dragging ? 'border-emerald-400 bg-emerald-50' : 'border-stone-300 bg-white'}`}>
              <UploadCloud className={`h-5 w-5 transition-colors ${dragging ? 'text-emerald-500' : 'text-stone-400'}`} />
            </div>
            <div className="text-center">
              <p className={`text-sm font-medium transition-colors ${dragging ? 'text-emerald-600' : 'text-stone-500'}`}>
                {dragging ? 'วางรูปที่นี่' : 'คลิกหรือลากรูปมาวาง'}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-400">JPG · PNG · WebP · สูงสุด 5 MB</p>
            </div>
          </div>
        )}

        {/* Uploading overlay */}
        <AnimatePresence>
          {row.uploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                <p className="text-xs font-medium text-emerald-700">กำลังอัปโหลด...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Just-saved flash */}
        <AnimatePresence>
          {row.justSaved && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-emerald-500/80 backdrop-blur-sm"
            >
              <CheckCircle2 className="h-10 w-10 text-white drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFile}
        />
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-800">{row.name_th}</p>
            {row.description_th && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-stone-400">{row.description_th}</p>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-600 ring-1 ring-amber-200">
            <Coins className="h-3 w-3" />
            {row.points_cost.toLocaleString('th-TH')}
          </span>
        </div>

        {/* Actions — shown when dirty or has image */}
        <AnimatePresence initial={false}>
          {(isDirty || hasImage) && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2">
                {hasImage && (
                  <button
                    type="button"
                    onClick={() => { onClear(row.id); setImgError(false); }}
                    disabled={row.uploading || row.saving}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 text-xs font-medium text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    ลบรูป
                  </button>
                )}
                {isDirty && (
                  <button
                    type="button"
                    onClick={() => onSave(row)}
                    disabled={row.saving || row.uploading}
                    className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {row.saving ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />กำลังบันทึก</>
                    ) : (
                      'บันทึก'
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function RewardImageSection() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          description_th: r.description_th ?? null,
          points_cost: r.points_cost,
          image_url: r.image_url ?? null,
          saved_image_url: r.image_url ?? null,
          uploading: false,
          saving: false,
          justSaved: false,
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

  const handleClear = (id: string) => patch(id, { image_url: null });

  const handleSave = async (row: RowState) => {
    patch(row.id, { saving: true });
    try {
      await executiveApi.updateReward(row.id, { image_url: row.image_url });
      patch(row.id, { saving: false, saved_image_url: row.image_url, justSaved: true });
      setTimeout(() => patch(row.id, { justSaved: false }), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
      patch(row.id, { saving: false });
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <div className="aspect-[4/3] w-full animate-pulse bg-stone-100" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-3/4 animate-pulse rounded-full bg-stone-100" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <AlertBanner tone="error" message={error} />}

      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-400">คลิกที่รูปหรือลากรูปมาวาง จากนั้นกด "บันทึก"</p>
        <button
          type="button"
          onClick={() => void load(true)}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          รีเฟรช
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-400">ยังไม่มีรางวัลในระบบ</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {rows.map((row) => (
            <RewardCard
              key={row.id}
              row={row}
              onUpload={handleUpload}
              onClear={handleClear}
              onSave={handleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
