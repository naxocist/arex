'use client';

import { jsPDF } from 'jspdf';
import { sarabunRegularB64, sarabunBoldB64 } from './fonts/sarabunFont';
import { type LogisticsPickupJobItem, type LogisticsRewardDeliveryJobItem } from './apiClient';

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

function addHeading(w: PdfWriter, title: string, sub: string) {
  w.doc.setFont('Sarabun', 'bold');
  w.doc.setFontSize(18);
  w.doc.text(title, w.margin, w.y);
  w.y += w.lineH * 1.1;
  w.doc.setFont('Sarabun', 'normal');
  w.doc.setFontSize(10);
  w.doc.setTextColor(120, 120, 120);
  w.doc.text(sub, w.margin, w.y);
  w.doc.setTextColor(0, 0, 0);
  w.y += w.lineH * 0.8;
}

function addDivider(w: PdfWriter) {
  w.doc.setLineWidth(0.3);
  w.doc.setDrawColor(220, 220, 220);
  w.doc.line(w.margin, w.y, w.margin + w.maxWidth, w.y);
  w.y += w.lineH * 0.8;
}

function addField(w: PdfWriter, label: string, value: string, url?: string) {
  w.doc.setFont('Sarabun', 'normal');
  w.doc.setFontSize(9);
  w.doc.setTextColor(100, 100, 100);
  w.doc.text(label, w.margin, w.y);
  w.y += w.lineH * 0.65;

  w.doc.setFontSize(12);
  w.doc.setTextColor(0, 0, 0);
  const lines = w.doc.splitTextToSize(value, w.maxWidth);
  w.doc.text(lines, w.margin, w.y);
  w.y += lines.length * w.lineH * 0.85;

  if (url) {
    w.doc.setFontSize(9);
    w.doc.setTextColor(22, 163, 74); // green-600
    const urlLines = w.doc.splitTextToSize(url, w.maxWidth);
    const textH = urlLines.length * w.lineH * 0.7;
    w.doc.text(urlLines, w.margin, w.y);
    // measure width of first line for link rect
    const linkW = w.doc.getTextWidth(urlLines[0] as string);
    w.doc.link(w.margin, w.y - w.lineH * 0.6, linkW, textH, { url });
    w.doc.setTextColor(0, 0, 0);
    w.y += textH;
  }

  w.y += w.lineH * 0.4;
}

function addFooter(w: PdfWriter) {
  addDivider(w);
  w.doc.setFont('Sarabun', 'normal');
  w.doc.setFontSize(9);
  w.doc.setTextColor(150, 150, 150);
  w.doc.text(`สร้างเมื่อ ${new Date().toLocaleString('th-TH')}`, w.margin, w.y);
}

export function generatePickupJobPdf(item: LogisticsPickupJobItem): void {
  const doc = makePdf();
  const margin = 20;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lineH = 7;
  const w: PdfWriter = { doc, y: 20, margin, maxWidth, lineH };

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const dateRange = item.planned_pickup_at
    ? `${formatDate(item.planned_pickup_at)}${item.pickup_window_end_at ? ` – ${formatDate(item.pickup_window_end_at)}` : ''}`
    : '-';

  addHeading(w, 'ใบรับวัสดุ', `Pickup Job · ${item.id.slice(0, 8).toUpperCase()}`);
  addDivider(w);

  addField(w, 'วัสดุ', `${item.material_name_th || item.material_type} ${Number(item.quantity_value).toLocaleString('th-TH')} ${item.quantity_unit}`);
  addField(
    w, 'จุดรับ', item.pickup_location_text || '-',
    hasCoords(item.pickup_lat, item.pickup_lng)
      ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)
      : undefined
  );
  addField(w, 'นัดรับ', dateRange);

  if (item.destination_factory_name_th) {
    addField(
      w, 'โรงงานปลายทาง',
      `${item.destination_factory_name_th}${item.destination_factory_location_text ? ` (${item.destination_factory_location_text})` : ''}`,
      hasCoords(item.destination_factory_lat, item.destination_factory_lng)
        ? buildGoogleMapsUrl(item.destination_factory_lat as number, item.destination_factory_lng as number)
        : undefined
    );
  }

  addFooter(w);
  doc.save(`ใบรับวัสดุ_${item.id.slice(0, 8)}.pdf`);
}

export function generateDeliveryJobPdf(item: LogisticsRewardDeliveryJobItem): void {
  const doc = makePdf();
  const margin = 20;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lineH = 7;
  const w: PdfWriter = { doc, y: 20, margin, maxWidth, lineH };

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const dateRange = item.planned_delivery_at
    ? `${formatDate(item.planned_delivery_at)}${item.delivery_window_end_at ? ` – ${formatDate(item.delivery_window_end_at)}` : ''}`
    : '-';

  addHeading(w, 'ใบส่งรางวัล', `Reward Delivery · ${item.id.slice(0, 8).toUpperCase()}`);
  addDivider(w);

  addField(w, 'รางวัล', item.reward_name_th || 'รางวัล');
  addField(w, 'จำนวน', `${Number(item.quantity).toLocaleString('th-TH')} ชิ้น`);
  if (item.farmer_display_name) addField(w, 'ผู้รับ', item.farmer_display_name);
  if (item.farmer_phone) addField(w, 'เบอร์โทร', item.farmer_phone);
  addField(
    w, 'จุดส่ง', item.pickup_location_text || '-',
    hasCoords(item.pickup_lat, item.pickup_lng)
      ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)
      : undefined
  );
  addField(w, 'นัดส่ง', dateRange);

  addFooter(w);
  doc.save(`ใบส่งรางวัล_${item.id.slice(0, 8)}.pdf`);
}
