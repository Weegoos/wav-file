"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { GeoPoint } from "./types";
import dynamic from "next/dynamic";

const MapWrapper = dynamic(() => import("./MapWrapper"), { 
  ssr: false, 
  loading: () => (
    <div className="h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[600px] bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center rounded-3xl shadow-2xl">
      <div className="text-center animate-pulse">
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 shadow-xl"></div>
        <div className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
          GPS-трек
        </div>
      </div>
    </div>
  ) 
});

interface Props {
  initialPoints: GeoPoint[];
}

export default function AudioGeoMap({ initialPoints }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState<[number, number]>([55.7558, 37.6176]);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const getInterpolatedPosition = useCallback((time: number): [number, number] => {
    if (initialPoints.length === 0) return [55.7558, 37.6176];

    if (time >= initialPoints[initialPoints.length - 1].time) {
      const lastPoint = initialPoints[initialPoints.length - 1];
      return [lastPoint.lat, lastPoint.lng];
    }

    if (time <= initialPoints[0].time) return [initialPoints[0].lat, initialPoints[0].lng];
    
    for (let i = 0; i < initialPoints.length - 1; i++) {
      const current = initialPoints[i];
      const next = initialPoints[i + 1];
      
      if (time >= current.time && time < next.time) {
        const progress = (time - current.time) / (next.time - current.time);
        const smoothProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const lat = current.lat + (next.lat - current.lat) * smoothProgress;
        const lng = current.lng + (next.lng - current.lng) * smoothProgress;
        return [lat, lng];
      }
    }
    return position;
  }, [initialPoints, position]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isDragging) return;

    const updateTime = () => {
      const newTime = audio.currentTime;
      setCurrentTime(newTime);
      const newPos = getInterpolatedPosition(newTime);
      setPosition(newPos);
    };

    const handleTimeUpdate = () => {
      if (Math.abs(audio.currentTime - currentTime) > 0.1) {
        requestAnimationFrame(updateTime);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration || 0);
      setPosition(getInterpolatedPosition(0));
    });
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("play", () => setIsPlaying(true));

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", () => {});
      audio.removeEventListener("ended", () => {});
    };
  }, [getInterpolatedPosition, currentTime, isDragging]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setPosition(getInterpolatedPosition(newTime));
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  };

  const totalDistance = useMemo(() => {
    let distance = 0;
    for (let i = 0; i < initialPoints.length - 1; i++) {
      const lat1 = initialPoints[i].lat * Math.PI / 180;
      const lng1 = initialPoints[i].lng * Math.PI / 180;
      const lat2 = initialPoints[i + 1].lat * Math.PI / 180;
      const lng2 = initialPoints[i + 1].lng * Math.PI / 180;
      
      const dLat = lat2 - lat1;
      const dLng = lng2 - lng1;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distance += 6371 * c;
    }
    return distance;
  }, [initialPoints]);

  const currentDistance = useMemo(() => {
    if (!initialPoints.length || currentTime <= 0) return 0;

    let targetIndex = 0;
    for (let i = 0; i < initialPoints.length; i++) {
      if (initialPoints[i].time <= currentTime) {
        targetIndex = i;
      } else {
        break;
      }
    }

    let distance = 0;
    for (let i = 1; i <= targetIndex; i++) {
      const lat1 = initialPoints[i-1].lat * Math.PI / 180;
      const lng1 = initialPoints[i-1].lng * Math.PI / 180;
      const lat2 = initialPoints[i].lat * Math.PI / 180;
      const lng2 = initialPoints[i].lng * Math.PI / 180;
      
      const dLat = lat2 - lat1;
      const dLng = lng2 - lng1;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distance += 6371 * c;
    }

    if (targetIndex < initialPoints.length - 1) {
      const current = initialPoints[targetIndex];
      const next = initialPoints[targetIndex + 1];
      if (currentTime >= current.time && currentTime <= next.time) {
        const progress = (currentTime - current.time) / (next.time - current.time);
        const lat1 = current.lat * Math.PI / 180;
        const lng1 = current.lng * Math.PI / 180;
        const lat2 = next.lat * Math.PI / 180;
        const lng2 = next.lng * Math.PI / 180;
        
        const dLat = lat2 - lat1;
        const dLng = lng2 - lng1;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance += (6371 * c) * progress;
      }
    }

    return distance;
  }, [initialPoints, currentTime]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-4 sm:py-6 lg:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8 lg:mb-12 auto-rows-fr">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl sm:shadow-2xl border border-white/50 col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
              {initialPoints.length}
            </div>
            <div className="text-xs sm:text-sm lg:text-base font-semibold text-gray-600 mt-1 sm:mt-2">GPS точек</div>
          </div>
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl sm:shadow-2xl border border-white/50 col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-emerald-600">{totalDistance.toFixed(1)} км</div>
            <div className="text-xs sm:text-sm lg:text-base font-semibold text-gray-600 mt-1 sm:mt-2">Общий путь</div>
          </div>
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl sm:shadow-2xl border border-white/50 col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-orange-600">{currentDistance.toFixed(1)} км</div>
            <div className="text-xs sm:text-sm lg:text-base font-semibold text-gray-600 mt-1 sm:mt-2">Пройдено</div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-3xl sm:backdrop-blur-xl rounded-3xl shadow-2xl border border-white/70 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 lg:mb-12">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
            <label className="group flex-1 sm:flex-none relative">
              <input
                type="file"
                accept="audio/wav,audio/wave,audio/mp3"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && audioRef.current) {
                    audioRef.current.src = URL.createObjectURL(file);
                    setCurrentTime(0);
                    setIsPlaying(false);
                    setPosition([initialPoints[0]?.lat || 55.7558, initialPoints[0]?.lng || 37.6176]);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 peer"
              />
              <div className="px-6 py-4 sm:px-8 sm:py-4 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-2xl font-semibold text-gray-700 shadow-lg border-2 border-dashed border-gray-300 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer text-center text-sm sm:text-base">
                📁 Загрузить WAV
              </div>
            </label>

            <button
              onClick={togglePlay}
              className={`relative p-4 sm:p-6 lg:p-7 rounded-2xl font-bold text-lg sm:text-xl shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 min-w-[120px] sm:min-w-[160px] ${
                isPlaying
                  ? "bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white shadow-red-500/50"
                  : "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-emerald-500/50"
              }`}
            >
              <span className="relative z-10">{isPlaying ? "⏸️" : "▶️"}</span>
              <div className={`absolute inset-0 rounded-2xl blur opacity-50 ${
                isPlaying ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
              }`}></div>
            </button>

            <div className="flex-1 min-w-0">
              <input
                type="range"
                min="0"
                max={duration || 1}
                value={currentTime}
                step="0.1"
                onChange={handleProgressChange}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                className="w-full h-3 bg-gray-200 rounded-2xl appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600 transition-all shadow-inner hover:shadow-lg"
              />
              <div className="flex justify-between text-xs sm:text-sm font-mono text-gray-500 mt-2">
                <span>{currentTime.toFixed(1)}s</span>
                <span>{duration.toFixed(1)}s</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl flex-shrink-0">
              <div className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500">🔊</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => {
                  if (audioRef.current) audioRef.current.volume = parseFloat(e.target.value);
                  setVolume(parseFloat(e.target.value));
                }}
                className="w-16 sm:w-20 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500 flex-shrink-0"
              />
              <span className="text-xs font-mono text-gray-600 whitespace-nowrap">{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>

        <MapWrapper position={position} points={initialPoints} />
      </div>

      <audio ref={audioRef} preload="metadata" />
    </div>
  );
}
