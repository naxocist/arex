'use client';

import { jsPDF } from 'jspdf';
import { sarabunRegularB64, sarabunBoldB64 } from './fonts/sarabunFont';
import { type LogisticsPickupJobItem, type LogisticsRewardDeliveryJobItem } from './api';

function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function hasCoords(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
}

function makePdf(): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Sarabun-Regular.ttf', sarabunRegularB64);
  doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
  doc.addFileToVFS('Sarabun-Bold.ttf', sarabunBoldB64);
  doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
  doc.setFont('Sarabun', 'normal');
  return doc;
}

interface PdfWriter {
  doc: jsPDF;
  y: number;
  margin: number;
  maxWidth: number;
  lineH: number;
}

function addHeaderBlock(w: PdfWriter, title: string, refId: string, status: string, statusColor: [number, number, number]) {
  const pageW = w.doc.internal.pageSize.getWidth();

  // Green header bar
  w.doc.setFillColor(45, 106, 79);
  w.doc.rect(0, 0, pageW, 28, 'F');

  // Title
  w.doc.setFont('Sarabun', 'bold');
  w.doc.setFontSize(20);
  w.doc.setTextColor(255, 255, 255);
  w.doc.text(title, w.margin, 13);

  // AREX branding right side
  w.doc.setFont('Sarabun', 'normal');
  w.doc.setFontSize(9);
  w.doc.setTextColor(180, 220, 180);
  w.doc.text('AREX Platform · บพข. (อว.)', pageW - w.margin, 10, { align: 'right' });

  // Ref number
  w.doc.setFontSize(10);
  w.doc.setTextColor(200, 240, 200);
  w.doc.text(`เลขที่อ้างอิง: ${refId}`, pageW - w.margin, 21, { align: 'right' });

  w.doc.setTextColor(0, 0, 0);
  w.y = 36;

  // Status pill
  w.doc.setFillColor(...statusColor);
  w.doc.roundedRect(w.margin, w.y - 4, 50, 8, 2, 2, 'F');
  w.doc.setFont('Sarabun', 'bold');
  w.doc.setFontSize(9);
  w.doc.setTextColor(255, 255, 255);
  w.doc.text(status, w.margin + 25, w.y + 0.5, { align: 'center' });
  w.doc.setTextColor(0, 0, 0);
  w.y += 10;
}

function addSectionLabel(w: PdfWriter, label: string) {
  w.y += 4;
  w.doc.setFont('Sarabun', 'bold');
  w.doc.setFontSize(7.5);
  w.doc.setTextColor(100, 100, 100);
  const text = label.toUpperCase();
  w.doc.text(text, w.margin, w.y);
  const tw = w.doc.getTextWidth(text);
  w.doc.setDrawColor(200, 200, 200);
  w.doc.setLineWidth(0.2);
  w.doc.line(w.margin, w.y + 0.7, w.margin + tw + 2, w.y + 0.7);
  w.doc.setTextColor(0, 0, 0);
  w.y += 4;
}

function addDivider(w: PdfWriter) {
  w.doc.setLineWidth(0.25);
  w.doc.setDrawColor(220, 220, 220);
  w.doc.line(w.margin, w.y, w.margin + w.maxWidth, w.y);
  w.y += w.lineH * 0.8;
}

function addField(w: PdfWriter, label: string, value: string, url?: string) {
  w.doc.setFont('Sarabun', 'normal');
  w.doc.setFontSize(8);
  w.doc.setTextColor(130, 130, 130);
  w.doc.text(label, w.margin, w.y);
  w.y += w.lineH * 0.45;

  w.doc.setFontSize(10.5);
  w.doc.setTextColor(20, 20, 20);
  const lines = w.doc.splitTextToSize(value, w.maxWidth);
  w.doc.text(lines, w.margin, w.y);
  w.y += lines.length * w.lineH * 0.72;

  if (url) {
    w.doc.setFontSize(8.5);
    w.doc.setTextColor(22, 163, 74);
    const urlLines = w.doc.splitTextToSize(url, w.maxWidth);
    const textH = urlLines.length * w.lineH * 0.6;
    w.doc.text(urlLines, w.margin, w.y);
    const linkW = w.doc.getTextWidth(urlLines[0] as string);
    w.doc.link(w.margin, w.y - w.lineH * 0.5, linkW, textH, { url });
    w.doc.setTextColor(0, 0, 0);
    w.y += textH;
  }

  w.y += w.lineH * 0.35;
}

function addFooter(w: PdfWriter) {
  const pageW = w.doc.internal.pageSize.getWidth();
  const pageH = w.doc.internal.pageSize.getHeight();
  w.doc.setFillColor(245, 245, 245);
  w.doc.rect(0, pageH - 14, pageW, 14, 'F');
  w.doc.setFont('Sarabun', 'normal');
  w.doc.setFontSize(8);
  w.doc.setTextColor(150, 150, 150);
  w.doc.text(`สร้างเมื่อ ${new Date().toLocaleString('th-TH')}`, w.margin, pageH - 5);
  w.doc.text('AREX Platform · ระบบบริหารจัดการวัสดุเหลือใช้', pageW - w.margin, pageH - 5, { align: 'right' });
}

export interface RouteSegment {
  label: string; // e.g. "ฉัน → เกษตรกร"
  distanceKm: number | null;
}

function addRouteSection(w: PdfWriter, segments: RouteSegment[]) {
  addSectionLabel(w, 'ระยะทาง (ทางถนน)');
  const valid = segments.filter((s) => s.distanceKm !== null);
  for (const seg of segments) {
    const val = seg.distanceKm !== null ? `${seg.distanceKm.toFixed(1)} กม.` : 'ไม่สามารถคำนวณได้';
    addField(w, seg.label, val);
  }
  if (valid.length > 1) {
    const total = valid.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0);
    addField(w, 'รวมระยะทาง', `${total.toFixed(1)} กม.`);
  }
}

export function generatePickupJobPdf(item: LogisticsPickupJobItem, route?: RouteSegment[]): void {
  const doc = makePdf();
  const margin = 18;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lineH = 7;
  const w: PdfWriter = { doc, y: 20, margin, maxWidth, lineH };

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

  const statusMap: Record<string, string> = {
    pickup_scheduled: 'กำลังไปรับวัสดุ',
    picked_up: 'รับวัสดุแล้ว',
    delivered_to_factory: 'ส่งถึงโรงงานแล้ว',
  };
  const statusColorMap: Record<string, [number, number, number]> = {
    pickup_scheduled: [59, 130, 246],
    picked_up: [234, 179, 8],
    delivered_to_factory: [22, 163, 74],
  };

  const statusLabel = statusMap[item.status] ?? item.status;
  const statusColor = statusColorMap[item.status] ?? [100, 100, 100];
  const dateRange = item.planned_pickup_at
    ? `${formatDate(item.planned_pickup_at)}${item.pickup_window_end_at ? ` ถึง ${formatDate(item.pickup_window_end_at)}` : ''}`
    : '-';

  addHeaderBlock(w, 'ใบรับวัสดุ', item.id.slice(0, 8).toUpperCase(), statusLabel, statusColor);

  addSectionLabel(w, 'ข้อมูลวัสดุ');
  addField(w, 'ชนิดวัสดุ', item.material_name_th || item.material_type);
  addField(w, 'ปริมาณ', `${Number(item.quantity_value).toLocaleString('th-TH')} ${item.quantity_unit}`);

  if (item.farmer_display_name || item.farmer_phone) {
    addSectionLabel(w, 'ข้อมูลเกษตรกร');
    if (item.farmer_display_name) addField(w, 'ชื่อเกษตรกร', item.farmer_display_name);
    if (item.farmer_phone) addField(w, 'เบอร์โทรศัพท์', item.farmer_phone);
  }

  addSectionLabel(w, 'จุดรับวัสดุ');
  addField(
    w, 'สถานที่นัดรับ', item.pickup_location_text || '-',
    hasCoords(item.pickup_lat, item.pickup_lng)
      ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)
      : undefined
  );
  addField(w, 'วันและเวลานัดรับ', dateRange);

  if (item.destination_factory_name_th) {
    addSectionLabel(w, 'โรงงานปลายทาง');
    addField(
      w, 'ชื่อโรงงาน',
      item.destination_factory_name_th,
      hasCoords(item.destination_factory_lat, item.destination_factory_lng)
        ? buildGoogleMapsUrl(item.destination_factory_lat as number, item.destination_factory_lng as number)
        : undefined
    );
    if (item.destination_factory_location_text) {
      addField(w, 'ที่อยู่โรงงาน', item.destination_factory_location_text);
    }
    if (item.destination_factory_is_focal_point) {
      addField(w, 'หมายเหตุ', 'โรงงาน Focal Point (จุดรวมวัสดุหลัก)');
    }
  }

  if (route && route.length > 0) addRouteSection(w, route);

  addFooter(w);
  doc.save(`ใบรับวัสดุ_${item.id.slice(0, 8)}.pdf`);
}

export function generateDeliveryJobPdf(item: LogisticsRewardDeliveryJobItem, route?: RouteSegment[]): void {
  const doc = makePdf();
  const margin = 18;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lineH = 7;
  const w: PdfWriter = { doc, y: 20, margin, maxWidth, lineH };

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

  const statusMap: Record<string, string> = {
    reward_delivery_scheduled: 'จัดรอบส่งแล้ว',
    out_for_delivery: 'กำลังนำส่ง',
    reward_delivered: 'ส่งมอบสำเร็จ',
  };
  const statusColorMap: Record<string, [number, number, number]> = {
    reward_delivery_scheduled: [139, 92, 246],
    out_for_delivery: [234, 179, 8],
    reward_delivered: [22, 163, 74],
  };

  const statusLabel = statusMap[item.status] ?? item.status;
  const statusColor = statusColorMap[item.status] ?? [100, 100, 100];
  const dateRange = item.planned_delivery_at
    ? `${formatDate(item.planned_delivery_at)}${item.delivery_window_end_at ? ` ถึง ${formatDate(item.delivery_window_end_at)}` : ''}`
    : '-';

  addHeaderBlock(w, 'ใบส่งรางวัล', item.id.slice(0, 8).toUpperCase(), statusLabel, statusColor);

  addSectionLabel(w, 'รายละเอียดรางวัล');
  addField(w, 'ชื่อรางวัล', item.reward_name_th || 'รางวัล');
  addField(w, 'จำนวน', `${Number(item.quantity).toLocaleString('th-TH')} ชิ้น`);

  addSectionLabel(w, 'ข้อมูลผู้รับ');
  if (item.farmer_display_name) addField(w, 'ชื่อผู้รับ', item.farmer_display_name);
  if (item.farmer_phone) addField(w, 'เบอร์โทรศัพท์', item.farmer_phone);

  addSectionLabel(w, 'จุดส่งมอบ');
  addField(
    w, 'สถานที่ส่งมอบ', item.pickup_location_text || '-',
    hasCoords(item.pickup_lat, item.pickup_lng)
      ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)
      : undefined
  );
  addField(w, 'วันและเวลานัดส่ง', dateRange);

  if (route && route.length > 0) addRouteSection(w, route);

  addFooter(w);
  doc.save(`ใบส่งรางวัล_${item.id.slice(0, 8)}.pdf`);
}
