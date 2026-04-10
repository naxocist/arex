import React, { useEffect, useState } from "react";
import { MapPinned, RefreshCw, Save } from "lucide-react";
import AlertBanner from "@/src/components/AlertBanner";
import PageHeader from "@/src/components/PageHeader";
import PickupLocationMapPicker from "@/src/components/PickupLocationMapPicker";
import SectionCard from "@/src/components/SectionCard";
import { ApiError, factoryApi } from "@/src/lib/apiClient";

function hasAccessToken(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(localStorage.getItem("AREX_ACCESS_TOKEN"));
}

function inferMessageTone(
  message: string | null,
): "info" | "success" | "error" {
  if (!message) {
    return "info";
  }
  if (
    message.includes("ไม่สำเร็จ") ||
    message.includes("กรุณา") ||
    message.includes("ยังไม่")
  ) {
    return "error";
  }
  if (message.includes("สำเร็จ")) {
    return "success";
  }
  return "info";
}

export default function FactorySettings() {
  const [factoryForm, setFactoryForm] = useState({
    name_th: "",
    location_text: "",
    lat: null as number | null,
    lng: null as number | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadFactory = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage(
        "ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน",
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await factoryApi.getMyFactory({ forceRefresh });
      setFactoryForm({
        name_th: response.name_th ?? "",
        location_text: response.location_text ?? "",
        lat: typeof response.lat === "number" ? response.lat : null,
        lng: typeof response.lng === "number" ? response.lng : null,
      });
      setMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`โหลดข้อมูลโรงงานไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage("โหลดข้อมูลโรงงานไม่สำเร็จ");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadFactory();
  }, []);

  const handleSave = async () => {
    const name = factoryForm.name_th.trim();
    if (!name) {
      setMessage("กรุณาระบุชื่อโรงงาน");
      return;
    }

    if ((factoryForm.lat === null) !== (factoryForm.lng === null)) {
      setMessage("กรุณาเลือกพิกัดจากแผนที่ให้ครบทั้งคู่ หรือไม่เลือกทั้งคู่");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await factoryApi.updateMyFactory({
        name_th: name,
        location_text: factoryForm.location_text.trim() || null,
        lat: factoryForm.lat,
        lng: factoryForm.lng,
      });

      setFactoryForm({
        name_th: updated.name_th ?? "",
        location_text: updated.location_text ?? "",
        lat: typeof updated.lat === "number" ? updated.lat : null,
        lng: typeof updated.lng === "number" ? updated.lng : null,
      });
      setMessage("บันทึกข้อมูลโรงงานสำเร็จแล้ว");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`บันทึกข้อมูลโรงงานไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage("บันทึกข้อมูลโรงงานไม่สำเร็จ");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Factory Settings"
        title="อัปเดตข้อมูลโรงงานให้ทีมขนส่งและระบบเห็นตรงกัน"
        description="หน้าตั้งค่านี้แยกจากคิวตรวจรับ เพื่อให้ฝ่ายโรงงานแก้ชื่อ ที่อยู่ และพิกัดได้โดยไม่รบกวนงานรับเข้าประจำวัน"
        actions={[
          {
            label: isLoading ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล",
            onClick: () => void loadFactory(true),
          },
        ]}
      />

      {message ? (
        <AlertBanner message={message} tone={inferMessageTone(message)} />
      ) : null}

      <SectionCard
        title="ข้อมูลโรงงาน"
        description="ระบุชื่อและที่อยู่ที่ใช้สื่อสารกับระบบขนส่ง ส่วนพิกัดช่วยให้เลือกปลายทางและเปิดดูบนแผนที่ได้ง่ายขึ้น"
      >
        <div className="grid gap-6 xl:grid-cols-[0.88fr,1.12fr]">
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">
                ชื่อโรงงาน
              </span>
              <input
                type="text"
                value={factoryForm.name_th}
                onChange={(event) =>
                  setFactoryForm((prev) => ({
                    ...prev,
                    name_th: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 outline-none"
                placeholder="เช่น โรงงานแปรรูปชีวมวลลำพูน"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">
                ที่อยู่ (ข้อความ)
              </span>
              <input
                type="text"
                value={factoryForm.location_text}
                onChange={(event) =>
                  setFactoryForm((prev) => ({
                    ...prev,
                    location_text: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 outline-none"
                placeholder="เช่น อ.เมือง จ.ลำพูน"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-stone-700">
                Latitude:{" "}
                {typeof factoryForm.lat === "number"
                  ? factoryForm.lat.toFixed(6)
                  : "-"}
              </div>
              <div className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-stone-700">
                Longitude:{" "}
                {typeof factoryForm.lng === "number"
                  ? factoryForm.lng.toFixed(6)
                  : "-"}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>
                  {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูลโรงงาน"}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFactoryForm((prev) => ({ ...prev, lat: null, lng: null }))
                }
                className="rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-surface-muted"
              >
                ล้างพิกัด
              </button>
              {factoryForm.lat !== null && factoryForm.lng !== null ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${factoryForm.lat}&mlon=${factoryForm.lng}#map=15/${factoryForm.lat}/${factoryForm.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-surface-muted"
                >
                  <MapPinned className="h-4 w-4" />
                  เปิดแผนที่ตำแหน่งโรงงาน
                </a>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[1.6rem] border border-line bg-surface-muted p-4">
              <p className="text-sm font-semibold text-stone-900">
                ตำแหน่งโรงงานบนแผนที่
              </p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                คลิกบนแผนที่เพื่อปักหมุดใหม่
                หรือใช้ตำแหน่งปัจจุบันเพื่อดึงที่อยู่มาช่วยกรอกอัตโนมัติ
              </p>
              <div className="mt-4">
                <PickupLocationMapPicker
                  lat={factoryForm.lat}
                  lng={factoryForm.lng}
                  onChange={({ lat, lng }) =>
                    setFactoryForm((prev) => ({ ...prev, lat, lng }))
                  }
                  onAddressResolved={(address) => {
                    setFactoryForm((prev) => ({
                      ...prev,
                      location_text: address,
                    }));
                  }}
                  mapHeightClassName="h-[280px] w-full overflow-hidden rounded-[1.5rem] sm:h-[340px]"
                />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
