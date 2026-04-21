'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Coins, Gift, X } from 'lucide-react';
import Image from 'next/image';
import ConfirmDialog from '@/app/_components/ConfirmDialog';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import { type FarmerRewardItem } from '@/app/_lib/api';

function RewardImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [errored, setErrored] = useState(false);
  if (src && !errored) {
    return (
      <div className={`relative overflow-hidden bg-stone-50 ${className ?? ''}`}>
        <Image src={src} alt={alt} fill unoptimized className="object-contain p-3" onError={() => setErrored(true)} sizes="(max-width: 768px) 50vw, 200px" />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-emerald-50 to-stone-100 ${className ?? ''}`}>
      <Gift className="h-8 w-8 text-emerald-200" />
    </div>
  );
}

interface Props {
  rewards: FarmerRewardItem[];
  availablePoints: number;
  requestingRewardId: string | null;
  isLoading: boolean;
  onSubmitRequest: (reward: FarmerRewardItem, qty: number, locationText: string, lat: number | null, lng: number | null) => void;
}

export default function RewardCatalog({ rewards, availablePoints, requestingRewardId, isLoading, onSubmitRequest }: Props) {
  const reduceMotion = useReducedMotion();

  const [selectedReward, setSelectedReward] = useState<FarmerRewardItem | null>(null);
  const [rewardQty, setRewardQty] = useState(1);
  const [locationPicker, setLocationPicker] = useState<{
    open: boolean; reward: FarmerRewardItem | null; locationText: string; lat: number | null; lng: number | null;
  }>({ open: false, reward: null, locationText: '', lat: null, lng: null });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; fields?: { label: string; value: string }[]; onConfirm: () => void;
    _back?: { reward: FarmerRewardItem; locationText: string; lat: number | null; lng: number | null };
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const handleRequestClick = (reward: FarmerRewardItem, qty: number) => {
    const pts = Number(reward.points_cost) || 0;
    if (availablePoints < pts * qty) return;
    setLocationPicker({ open: true, reward, locationText: '', lat: null, lng: null });
  };

  const handleLocationConfirmed = (locationText: string, lat: number | null, lng: number | null) => {
    const reward = locationPicker.reward;
    if (!reward) return;
    setLocationPicker((prev) => ({ ...prev, open: false }));
    const pts = Number(reward.points_cost) || 0;
    const totalCost = pts * rewardQty;
    const after = availablePoints - totalCost;
    setConfirmDialog({
      open: true,
      title: 'ยืนยันการขอแลกรางวัล',
      message: '',
      fields: [
        { label: 'ของรางวัล', value: reward.name_th },
        { label: 'จำนวน', value: `${rewardQty} ชิ้น` },
        { label: 'แต้มที่ใช้', value: `${totalCost.toLocaleString('th-TH')} PMUC Coin` },
        { label: 'แต้มคงเหลือหลังแลก', value: `${after.toLocaleString('th-TH')} PMUC Coin` },
        { label: 'สถานที่รับ', value: locationText },
      ],
      _back: { reward, locationText, lat, lng },
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        onSubmitRequest(reward, rewardQty, locationText, lat, lng);
      },
    });
  };

  return (
    <>
      <section>
        <h2 className="mb-3 text-base font-bold text-stone-800">เลือกของรางวัล</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-stone-100" style={{ height: 200 }} />
            ))}
          </div>
        ) : rewards.length === 0 ? (
          <div className="rounded-2xl border border-stone-100 bg-stone-50 px-6 py-10 text-center text-sm text-stone-400">ยังไม่มีรางวัลในระบบ</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rewards.map((reward) => {
              const pts = Number(reward.points_cost) || 0;
              const stock = Number(reward.stock_qty) || 0;
              const outOfStock = stock <= 0;
              const unavailable = !reward.active || outOfStock;
              const insufficient = availablePoints < pts;
              const canApply = !insufficient && !unavailable;
              const lowStock = stock <= 10 && stock > 0;
              return (
                <motion.button
                  key={reward.id}
                  type="button"
                  onClick={() => { setSelectedReward(reward); setRewardQty(1); }}
                  whileTap={reduceMotion ? {} : { scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`group flex flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-shadow ${
                    unavailable ? 'border-stone-100 opacity-60' : canApply ? 'border-stone-200 hover:shadow-md' : 'border-stone-100'
                  }`}
                >
                  <RewardImage src={reward.image_url} alt={reward.name_th} className="aspect-[4/3] w-full" />
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <p className={`text-sm font-bold leading-snug ${unavailable ? 'text-stone-400' : 'text-stone-900'}`}>{reward.name_th}</p>
                    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${canApply ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-400'}`}>
                      <Coins className="h-3 w-3" />{pts.toLocaleString('th-TH')} แต้ม
                    </span>
                    <p className={`text-[11px] leading-tight ${outOfStock ? 'text-stone-400' : lowStock ? 'font-semibold text-amber-500' : insufficient ? 'font-semibold text-red-400' : 'text-stone-400'}`}>
                      {outOfStock ? 'หมดสต็อก' : insufficient ? `ขาดอีก ${(pts - availablePoints).toLocaleString('th-TH')} แต้ม` : `เหลือ ${stock} ชิ้น${lowStock ? ' ⚠' : ''}`}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>

      {/* Reward detail sheet — portalled to body to escape overflow-hidden parent */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedReward && (() => {
            const reward = selectedReward;
            const pts = Number(reward.points_cost) || 0;
            const stock = Number(reward.stock_qty) || 0;
            const outOfStock = stock <= 0;
            const unavailable = !reward.active || outOfStock;
            const totalCost = pts * rewardQty;
            const afterBalance = availablePoints - totalCost;
            const insufficientQty = afterBalance < 0;
            const maxQty = outOfStock ? 0 : Math.min(10, stock, pts > 0 && availablePoints > 0 ? Math.floor(availablePoints / pts) : 0);
            return (
              <>
                <motion.div key="detail-backdrop" className="fixed inset-0 z-40 bg-black/50"
                  initial={reduceMotion ? {} : { opacity: 0 }} animate={reduceMotion ? {} : { opacity: 1 }} exit={reduceMotion ? {} : { opacity: 0 }}
                  onClick={() => setSelectedReward(null)} />
                <motion.div key="detail-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  initial={reduceMotion ? {} : { opacity: 0, scale: 0.95 }} animate={reduceMotion ? {} : { opacity: 1, scale: 1 }} exit={reduceMotion ? {} : { opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <div className="relative flex w-full max-w-2xl flex-col sm:flex-row overflow-hidden rounded-3xl bg-white shadow-2xl">
                    <div className="relative h-72 w-full shrink-0 sm:h-auto sm:w-80 sm:self-stretch bg-stone-50">
                      {reward.image_url ? (
                        <Image src={reward.image_url} alt={reward.name_th} fill unoptimized className="object-contain p-5" sizes="256px" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><Gift className="h-16 w-16 text-emerald-200" /></div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xl font-bold leading-snug text-stone-900">{reward.name_th}</p>
                          {reward.description_th && <p className="mt-1 text-base text-stone-400 leading-snug">{reward.description_th}</p>}
                        </div>
                        <button type="button" onClick={() => setSelectedReward(null)} className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-400 transition hover:bg-stone-200">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      {reward.instruction_notes && (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-500">หมายเหตุ / เงื่อนไขการรับของ</p>
                          <p className="whitespace-pre-wrap text-sm text-amber-800 leading-relaxed">{reward.instruction_notes}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
                        <span className="text-lg font-semibold text-stone-600">จำนวน</span>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setRewardQty((q) => Math.max(1, q - 1))} disabled={rewardQty <= 1}
                            className="flex h-14 w-14 items-center justify-center rounded-xl border border-stone-200 bg-white text-3xl font-bold text-stone-600 transition disabled:opacity-30 active:scale-90">−</button>
                          <span className="w-10 text-center text-3xl font-bold text-stone-900">{rewardQty}</span>
                          <button type="button" onClick={() => setRewardQty((q) => Math.min(maxQty, q + 1))} disabled={rewardQty >= maxQty}
                            className="flex h-14 w-14 items-center justify-center rounded-xl border border-stone-200 bg-white text-3xl font-bold text-stone-600 transition disabled:opacity-30 active:scale-90">+</button>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-stone-100 overflow-hidden text-base">
                        <div className="flex justify-between px-4 py-3">
                          <span className="text-stone-400">ราคา/ชิ้น</span>
                          <span className="font-semibold text-stone-700">{pts.toLocaleString('th-TH')} แต้ม</span>
                        </div>
                        <div className="flex justify-between border-t border-stone-100 bg-stone-50 px-4 py-3">
                          <span className="text-stone-400">รวม</span>
                          <span className={`font-bold text-base ${insufficientQty ? 'text-red-500' : 'text-stone-800'}`}>{totalCost.toLocaleString('th-TH')} แต้ม</span>
                        </div>
                        <div className="flex justify-between border-t border-stone-100 px-4 py-3">
                          <span className="text-stone-400">คงเหลือ</span>
                          <span className={`font-bold text-base ${insufficientQty ? 'text-red-500' : 'text-emerald-600'}`}>{afterBalance.toLocaleString('th-TH')}</span>
                        </div>
                      </div>
                      {insufficientQty && <p className="text-center text-sm font-semibold text-red-500">ขาดอีก {(totalCost - availablePoints).toLocaleString('th-TH')} แต้ม</p>}
                      {outOfStock && <p className="text-center text-sm font-semibold text-stone-400">หมดสต็อก</p>}
                      <button
                        type="button"
                        onClick={() => { setSelectedReward(null); handleRequestClick(reward, rewardQty); }}
                        disabled={unavailable || availablePoints < pts * rewardQty || requestingRewardId === reward.id}
                        className="flex w-full min-h-[64px] items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-md shadow-primary/20 transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                      >
                        <Gift className="h-5 w-5" />
                        {requestingRewardId === reward.id ? 'กำลังส่งคำขอ...' : 'ขอแลกรางวัลนี้'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            );
          })()}
        </AnimatePresence>,
        document.body
      )}

      {/* Location picker — portalled to body */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {locationPicker.open && (
            <>
              <motion.div key="backdrop" className="fixed inset-0 z-50 bg-black/40"
                initial={reduceMotion ? {} : { opacity: 0 }} animate={reduceMotion ? {} : { opacity: 1 }} exit={reduceMotion ? {} : { opacity: 0 }}
                onClick={() => setLocationPicker({ open: false, reward: null, locationText: '', lat: null, lng: null })} />
              <motion.div key="location-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial={reduceMotion ? {} : { opacity: 0, scale: 0.95 }} animate={reduceMotion ? {} : { opacity: 1, scale: 1 }} exit={reduceMotion ? {} : { opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[90dvh]">
                  <div className="flex items-center justify-between border-b border-stone-100 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <button type="button"
                        onClick={() => { setLocationPicker({ open: false, reward: null, locationText: '', lat: null, lng: null }); setSelectedReward(locationPicker.reward); }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition hover:bg-stone-200">
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <div>
                        <p className="text-xl font-bold text-stone-900">ระบุสถานที่รับของรางวัล</p>
                        <p className="text-base text-stone-400">{locationPicker.reward?.name_th} · {rewardQty} ชิ้น</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setLocationPicker({ open: false, reward: null, locationText: '', lat: null, lng: null })}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-400 transition hover:bg-stone-200">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-6 pt-5">
                    <div className="space-y-2">
                      <label className="block text-base font-semibold text-stone-700">สถานที่รับของ</label>
                      <input type="text" value={locationPicker.locationText}
                        onChange={(e) => setLocationPicker((prev) => ({ ...prev, locationText: e.target.value }))}
                        placeholder="เช่น หน้าบ้าน / หน้าวัด"
                        className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-lg text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10" />
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-4 py-3 text-base text-emerald-700">ปักหมุดบนแผนที่เพื่อให้ขนส่งนำทางได้ถูกต้อง</div>
                    <PickupLocationMapPicker
                      lat={locationPicker.lat} lng={locationPicker.lng}
                      onChange={({ lat, lng }) => setLocationPicker((prev) => ({ ...prev, lat, lng }))}
                      onAddressResolved={(address) => setLocationPicker((prev) => ({ ...prev, locationText: address }))}
                      mapHeightClassName="h-[300px] w-full overflow-hidden rounded-2xl"
                    />
                    {!locationPicker.locationText.trim() && <p className="text-center text-base font-semibold text-red-500">กรุณาระบุสถานที่รับของก่อน</p>}
                    <button type="button"
                      onClick={() => handleLocationConfirmed(locationPicker.locationText, locationPicker.lat, locationPicker.lng)}
                      disabled={!locationPicker.locationText.trim()}
                      className="flex w-full min-h-[64px] items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-md shadow-primary/20 transition hover:opacity-90 active:scale-95 disabled:opacity-40">
                      <Gift className="h-5 w-5" />ยืนยันสถานที่และขอแลกรางวัล
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        fields={confirmDialog.fields}
        confirmLabel="ยืนยัน"
        cancelLabel="ยกเลิก"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => {
          const back = confirmDialog._back;
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          if (back) setLocationPicker({ open: true, reward: back.reward, locationText: back.locationText, lat: back.lat, lng: back.lng });
        }}
      />
    </>
  );
}
