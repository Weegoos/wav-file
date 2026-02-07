"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { GeoPoint } from "./types";

interface Props {
  position: [number, number];
  points: GeoPoint[];
}

export default function MapWrapper({ position, points }: Props) {
  const mapRef = useRef<L.Map>(null);
  const markerRef = useRef<L.CircleMarker>(null);
  const trailRef = useRef<L.Polyline>(null);
  const pulseRef = useRef<number>();

  const updateMarker = useCallback(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const renderer = L.canvas({ padding: 0.5, tolerance: 10 });

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(position, {
        renderer,
        radius: 12,
        fillColor: "#10b981",
        color: "#059669",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.95,
        bubblingMouseEvents: false,
        className: "gps-marker"
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(position);
    }

    if (trailRef.current) {
      trailRef.current.setLatLngs([position]);
    } else {
      trailRef.current = L.polyline([position], {
        renderer,
        color: "#f59e0b",
        weight: 6,
        opacity: 0.9,
        dashArray: "12, 8"
      }).addTo(map);
    }

    const pulse = () => {
      if (markerRef.current) {
        const currentRadius = markerRef.current.getRadius();
        markerRef.current.setRadius(currentRadius > 12 ? 16 : 12);
        markerRef.current.setStyle({
          fillColor: currentRadius > 12 ? "#34d399" : "#10b981"
        });
      }
    };

    if (pulseRef.current) clearInterval(pulseRef.current as any);
    pulseRef.current = setInterval(pulse, 350) as any;

    map.flyTo(position, 17, { 
      duration: 0.6, 
      animate: true,
      paddingTopLeft: [20, 20],
      paddingBottomRight: [20, 20]
    });
  }, [position]);

  useEffect(() => {
    updateMarker();
    return () => {
      if (pulseRef.current) clearInterval(pulseRef.current as any);
    };
  }, [updateMarker]);

  const routePositions = React.useMemo(() => 
    points.map(p => [p.lat, p.lng] as [number, number]), 
    [points]
  );

  if (!points.length) {
    return (
      <div className="h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[600px] bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl shadow-2xl flex items-center justify-center border-4 border-dashed border-orange-200">
        <div className="text-center animate-bounce px-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-r from-orange-400 to-red-500 rounded-2xl mx-auto mb-6 shadow-xl"></div>
          <div className="text-xl sm:text-2xl md:text-3xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            GPS точки
          </div>
          <div className="text-xs sm:text-sm text-gray-500 mt-2 px-2">JSON: lat, lng, time</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white/50 bg-white/70 backdrop-blur-xl h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[600px]">
      <style jsx global>{`
        .gps-marker {
          filter: drop-shadow(0 4px 12px rgba(16, 185, 129, 0.6));
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
      
      <MapContainer
        center={position}
        zoom={16}
        style={{ height: "100%", width: "100%", minHeight: "300px" }}
        ref={mapRef}
        preferCanvas={true}
        renderer={L.canvas()}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: "#3b82f6",
            weight: 6,
            opacity: 0.95
          }}
          dashArray="[15, 12]"
        />
      </MapContainer>
    </div>
  );
}
