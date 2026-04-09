import React, { useEffect, useMemo, useState } from 'react';
import L, { type LatLngExpression } from 'leaflet';
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
}

const DEFAULT_CENTER = { lat: 15.870032, lng: 100.992541 };

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
  const { lat, lng, onChange, onAddressResolved } = props;
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
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

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await handleSelect(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setGeoErrorMessage('ไม่สามารถอ่านตำแหน่งปัจจุบันได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-sm"
        >
          ใช้ตำแหน่งปัจจุบัน
        </button>
        <span>คลิกบนแผนที่เพื่อปักหมุดจุดนัดรับ</span>
      </div>

      {geoErrorMessage ? <p className="text-xs text-rose-700">{geoErrorMessage}</p> : null}

      <MapContainer
        style={{ width: '100%', height: '420px' }}
        center={center}
        zoom={typeof lat === 'number' && typeof lng === 'number' ? 15 : 6}
        scrollWheelZoom
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
            draggable
            onDragEnd={async (event) => {
              const position = event.target.getLatLng();
              await handleSelect(position.lat, position.lng);
            }}
          />
        ) : null}
      </MapContainer>

      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
        {isResolvingAddress ? <span>กำลังดึงที่อยู่...</span> : null}
      </div>
    </div>
  );
}
