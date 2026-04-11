'use client';

import React, { useEffect, useMemo, useState } from 'react';
import L, { type LatLngExpression } from 'leaflet';
import { LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

interface PickupLocationMapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  onAddressResolved?: (address: string) => void;
  currentLocationButtonLabel?: string;
  mapHintText?: string;
  mapHeightClassName?: string;
}

const DEFAULT_CENTER = { lat: 15.870032, lng: 100.992541 };

const MARKER_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41],
});

// Fix default marker icon URLs for bundlers like Vite.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapClickHandler(props: { onPick: (lat: number, lng: number) => void }) {
  const { onPick } = props;
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapRecenter(props: { center: LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.setView(props.center);
  }, [map, props.center]);
  return null;
}

export default function PickupLocationMapPicker(props: PickupLocationMapPickerProps) {
  const {
    lat,
    lng,
    onChange,
    onAddressResolved,
    currentLocationButtonLabel,
    mapHintText,
    mapHeightClassName,
  } = props;
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);
  const [geoErrorMessage, setGeoErrorMessage] = useState<string | null>(null);

  const center = useMemo(() => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      return { lat, lng };
    }
    return DEFAULT_CENTER;
  }, [lat, lng]);

  const resolveAddress = async (nextLat: number, nextLng: number) => {
    if (!onAddressResolved) {
      return;
    }

    setIsResolvingAddress(true);
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(nextLat),
        lon: String(nextLng),
        'accept-language': 'th',
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { display_name?: string };
      if (data.display_name) {
        onAddressResolved(data.display_name);
      }
    } finally {
      setIsResolvingAddress(false);
    }
  };

  const handleSelect = async (nextLat: number, nextLng: number) => {
    onChange({ lat: nextLat, lng: nextLng });
    await resolveAddress(nextLat, nextLng);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoErrorMessage('เบราว์เซอร์นี้ไม่รองรับการอ่านตำแหน่งปัจจุบัน');
      return;
    }

    setGeoErrorMessage(null);
    setIsUsingCurrentLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await handleSelect(position.coords.latitude, position.coords.longitude);
        } finally {
          setIsUsingCurrentLocation(false);
        }
      },
      () => {
        setIsUsingCurrentLocation(false);
        setGeoErrorMessage('ไม่สามารถอ่านตำแหน่งปัจจุบันได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const isBusy = isUsingCurrentLocation || isResolvingAddress;
  const busyMessage = isUsingCurrentLocation
    ? 'กำลังดึงข้อมูลที่อยู่จากตำแหน่งปัจจุบัน...'
    : 'กำลังดึงข้อมูลที่อยู่...';

  return (
    <>
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isBusy}
          className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800"
        >
          {currentLocationButtonLabel ?? 'ใช้ตำแหน่งปัจจุบัน'}
        </button>
        <span>{mapHintText ?? 'คลิกบนแผนที่เพื่อปักหมุดจุดนัดรับ'}</span>
      </div>

      {geoErrorMessage ? <p className="text-xs text-rose-700">{geoErrorMessage}</p> : null}

      <MapContainer
        className={mapHeightClassName ?? 'h-[280px] w-full overflow-hidden rounded-[1.5rem] sm:h-[340px] lg:h-[420px]'}
        center={center}
        zoom={typeof lat === 'number' && typeof lng === 'number' ? 15 : 6}
        scrollWheelZoom
        style={{ zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPick={(nextLat, nextLng) => void handleSelect(nextLat, nextLng)} />
        <MapRecenter center={center} />
        {typeof lat === 'number' && typeof lng === 'number' ? (
          <Marker
            position={{ lat, lng }}
            icon={MARKER_ICON}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target as L.Marker;
                const position = marker.getLatLng();
                void handleSelect(position.lat, position.lng);
              },
            }}
          />
        ) : null}
      </MapContainer>

      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
        {isResolvingAddress ? <span>กำลังดึงที่อยู่...</span> : null}
      </div>
    </div>
    <AnimatePresence>
      {isBusy ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-[2200] flex items-center justify-center bg-white/70 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="mx-4 flex max-w-sm items-center gap-4 rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-xl"
          >
            <LoaderCircle className="h-6 w-6 animate-spin text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-on-surface">กำลังดึงข้อมูลที่อยู่</p>
              <p className="mt-1 text-sm text-on-surface-variant">{busyMessage}</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
    </>
  );
}
