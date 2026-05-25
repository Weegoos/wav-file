"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { GeoPoint } from "./types";

interface Props {
  position: [number, number];
  points: GeoPoint[];
}

function downsamplePoints(points: GeoPoint[], sampleRate: number): [number, number][] {
  const result: [number, number][] = [];
  const len = points.length;
  for (let i = 0; i < len; i += sampleRate) {
    result.push([points[i].lat, points[i].lng]);
  }
  if ((len - 1) % sampleRate !== 0) {
    result.push([points[len - 1].lat, points[len - 1].lng]);
  }
  return result;
}

export default function MapWrapper({ position, points }: Props) {
  const mapRef = useRef<L.Map>(null);
  const markerRef = useRef<L.Marker>(null);

  const routePositions = useMemo(() => {
    if (points.length > 500000) {
      return downsamplePoints(points, 50);
    } else if (points.length > 10000) {
      return downsamplePoints(points, 5);
    }
    return points.map(p => [p.lat, p.lng] as [number, number]);
  }, [points]);

  const cssPulseIcon = useMemo(() => {
    return L.divIcon({
      className: "leaflet-gpu-marker",
      html: `
        <div style="
          position: relative;
          width: 12px;
          height: 12px;
          background-color: #6366f1;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 12px rgba(99,102,241,0.6);
        ">
          <div style="
            position: absolute;
            top: -2px; left: -2px;
            width: 12px; height: 12px;
            background-color: #6366f1;
            border-radius: 50%;
            z-index: -1;
            animation: pointPulse 1.6s infinite cubic-bezier(0.16, 1, 0.3, 1);
          "></div>
        </div>
        <style>
          @keyframes pointPulse {
            0% { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(3.5); opacity: 0; }
          }
        </style>
      `,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (!markerRef.current) {
      markerRef.current = L.marker(position, { icon: cssPulseIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng(position);
    }

    map.panTo(position, { animate: true, duration: 0.15 });
  }, [position, cssPulseIcon]);

  if (!points.length) return null;

  return (
    <div className="w-full h-[550px] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-[#0C101A]">
      <MapContainer
        center={position}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
        preferCanvas={true}
      >
        <TileLayer 
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: "#6366f1",
            weight: 3.5,
            opacity: 0.75,
            lineJoin: "round"
          }}
        />
      </MapContainer>
    </div>
  );
}