"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { GeoPoint } from "./types";
import dynamic from "next/dynamic";

const MapWrapper = dynamic(() => import("./MapWrapper"), { 
  ssr: false, 
  loading: () => (
    <div className="h-[550px] bg-[#121824] flex items-center justify-center rounded-2xl border border-slate-800 shadow-2xl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-medium text-slate-400 tracking-wide">Инициализация карты...</div>
      </div>
    </div>
  ) 
});

interface Props {
  initialPoints: GeoPoint[];
}

export default function AudioGeoMap({ initialPoints }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const [loadMode, setLoadMode] = useState<"real" | "100k" | "1m">("real");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [position, setPosition] = useState<[number, number]>([55.7558, 37.6176]);

  const DEFAULT_AUDIO_PATH = "/audio/test_30min.wav";

  const activePoints = useMemo(() => {
    if (loadMode === "real") return initialPoints;

    const count = loadMode === "100k" ? 100000 : 1000000;
    const generated: GeoPoint[] = [];
    const maxTime = duration > 0 ? duration : 600;
    
    let lat = 55.7558;
    let lng = 37.6176;

    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1);
      const angle = progress * 50 * Math.PI; 
      const radius = 0.02 * progress; 
      
      generated.push({
        time: progress * maxTime,
        lat: lat + Math.sin(angle) * radius,
        lng: lng + Math.cos(angle) * radius
      });
    }
    return generated;
  }, [loadMode, initialPoints, duration]);

  const getInterpolatedPosition = useCallback((time: number): [number, number] => {
    if (activePoints.length === 0) return [55.7558, 37.6176];
    if (time <= activePoints[0].time) return [activePoints[0].lat, activePoints[0].lng];
    if (time >= activePoints[activePoints.length - 1].time) {
      return [activePoints[activePoints.length - 1].lat, activePoints[activePoints.length - 1].lng];
    }

    let low = 0;
    let high = activePoints.length - 2;
    let index = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (time >= activePoints[mid].time && time < activePoints[mid + 1].time) {
        index = mid;
        break;
      } else if (time < activePoints[mid].time) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    const current = activePoints[index];
    const next = activePoints[index + 1];
    
    const progress = (time - current.time) / (next.time - current.time);
    const smoothProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    return [
      current.lat + (next.lat - current.lat) * smoothProgress,
      current.lng + (next.lng - current.lng) * smoothProgress
    ];
  }, [activePoints]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTick = () => {
      const newTime = audio.currentTime;
      setCurrentTime(newTime);
      setPosition(getInterpolatedPosition(newTime));
    };

    const handleMetadata = () => {
      setDuration(audio.duration || 0);
      setPosition(getInterpolatedPosition(audio.currentTime));
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    audio.addEventListener("timeupdate", updateTick);
    audio.addEventListener("loadedmetadata", handleMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("play", () => setIsPlaying(true));

    if (audio.readyState >= 1) handleMetadata();

    return () => {
      audio.removeEventListener("timeupdate", updateTick);
      audio.removeEventListener("loadedmetadata", handleMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [getInterpolatedPosition]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
    setPosition(getInterpolatedPosition(newTime));
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      if (playPromiseRef.current) {
        playPromiseRef.current.then(() => audio.pause()).catch(() => audio.pause());
      } else {
        audio.pause();
      }
    } else {
      playPromiseRef.current = audio.play();
      playPromiseRef.current
        .then(() => { playPromiseRef.current = null; })
        .catch((err) => {
          playPromiseRef.current = null;
          if (err.name !== "AbortError") console.error(err);
        });
    }
  };

  const totalDistance = useMemo(() => {
    let distance = 0;
    const R = 6371;
    const step = loadMode === "real" ? 1 : 100; 
    
    for (let i = 0; i < activePoints.length - step; i += step) {
      const lat1 = activePoints[i].lat * Math.PI / 180;
      const lng1 = activePoints[i].lng * Math.PI / 180;
      const lat2 = activePoints[i + step].lat * Math.PI / 180;
      const lng2 = activePoints[i + step].lng * Math.PI / 180;
      const c = 2 * Math.atan2(
        Math.sqrt(Math.sin((lat2 - lat1)/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1)/2) ** 2),
        Math.sqrt(1 - (Math.sin((lat2 - lat1)/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1)/2) ** 2))
      );
      distance += R * c;
    }
    return distance;
  }, [activePoints, loadMode]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0A0E17] font-sans text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200 py-16 px-6 sm:px-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-[#111724]/60 rounded-2xl border border-slate-800/80 backdrop-blur-xl gap-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-200">Режим гео-прореживания</h1>
            <p className="text-xs text-slate-400 mt-1">Оптимизация рендеринга экстремальных массивов векторов</p>
          </div>
          <div className="flex flex-wrap gap-2.5 p-1 bg-[#1A2333]/60 border border-slate-800 rounded-xl">
            {(["real", "100k", "1m"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLoadMode(mode)}
                className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all duration-200 ${
                  loadMode === mode
                    ? "bg-slate-800 text-indigo-400 border border-slate-700/50 shadow-md shadow-black/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode === "real" && "Реальный трек"}
                {mode === "100k" && "100K точек"}
                {mode === "1m" && "1M точек"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-[#111724]/40 border border-slate-800/60 rounded-2xl p-6 transition-all duration-300 hover:border-slate-800">
            <div className="text-xs font-medium uppercase tracking-widest text-slate-500">Точки телеметрии</div>
            <div className="text-2xl font-semibold tracking-tight text-indigo-400 mt-2">{activePoints.length.toLocaleString()}</div>
          </div>
          <div className="bg-[#111724]/40 border border-slate-800/60 rounded-2xl p-6 transition-all duration-300 hover:border-slate-800">
            <div className="text-xs font-medium uppercase tracking-widest text-slate-500">Протяженность</div>
            <div className="text-2xl font-semibold tracking-tight text-emerald-400 mt-2">{totalDistance.toFixed(2)} км</div>
          </div>
          <div className="bg-[#111724]/40 border border-slate-800/60 rounded-2xl p-6 transition-all duration-300 hover:border-slate-800">
            <div className="text-xs font-medium uppercase tracking-widest text-slate-500">Ядро оптимизации</div>
            <div className="text-2xl font-semibold tracking-tight text-slate-300 mt-2">
              {loadMode === "real" ? "Прямой поток" : "Downsampling"}
            </div>
          </div>
        </div>

        <div className="bg-[#111724]/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex flex-col sm:flex-row items-center gap-6">
          <button
            onClick={togglePlay}
            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-300 border ${
              isPlaying
                ? "bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 shadow-lg shadow-red-500/5"
                : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 hover:border-indigo-400 shadow-lg shadow-indigo-600/20"
            }`}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          <div className="flex-1 w-full group">
            <div className="relative w-full flex items-center h-2">
              <div className="absolute left-0 right-0 top-0 bottom-0 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-100 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max={duration || 1}
                value={currentTime}
                step="0.01"
                onChange={handleProgressChange}
                className="absolute left-0 right-0 w-full h-2 opacity-0 cursor-pointer z-10"
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono tracking-wider text-slate-500 mt-2.5">
              <span>{Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, "0")}</span>
              <span>{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, "0")}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#1A2333]/40 border border-slate-800/80 px-4 py-2.5 rounded-xl group">
            <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">Vol</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (audioRef.current) audioRef.current.volume = v;
                setVolume(v);
              }}
              className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        <MapWrapper position={position} points={activePoints} />
      </div>

      <audio ref={audioRef} src={DEFAULT_AUDIO_PATH} preload="metadata" />
    </div>
  );
}