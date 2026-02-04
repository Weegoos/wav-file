"use client";

import React, { useRef, useState, useEffect } from "react";

type WavHeader = {
  sampleRate: number;
  bitsPerSample: number;
  numChannels: number;
  dataOffset: number;
  dataLength: number;
};

function parseWavHeader(buffer: ArrayBuffer): WavHeader {
  const view = new DataView(buffer);

  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  if (riff !== "RIFF") throw new Error("Not a RIFF file");

  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  if (wave !== "WAVE") throw new Error("Not a WAVE file");

  let offset = 12;
  let fmtChunkOffset = -1;
  let dataChunkOffset = -1;
  let dataChunkSize = 0;

  while (offset < buffer.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const size = view.getUint32(offset + 4, true);
    const next = offset + 8 + size;

    if (id === "fmt ") {
      fmtChunkOffset = offset + 8;
    } else if (id === "data") {
      dataChunkOffset = offset + 8;
      dataChunkSize = size;
      break;
    }

    offset = next;
  }

  if (fmtChunkOffset < 0 || dataChunkOffset < 0) {
    throw new Error("Invalid WAV: fmt or data chunk not found");
  }

  const audioFormat = view.getUint16(fmtChunkOffset, true);
  const numChannels = view.getUint16(fmtChunkOffset + 2, true);
  const sampleRate = view.getUint32(fmtChunkOffset + 4, true);
  const bitsPerSample = view.getUint16(fmtChunkOffset + 14, true);

  if (audioFormat !== 1) {
    throw new Error("Only PCM WAV (audioFormat=1) is supported");
  }

  return {
    sampleRate,
    bitsPerSample,
    numChannels,
    dataOffset: dataChunkOffset,
    dataLength: dataChunkSize,
  };
}

function getPcmSamples(buffer: ArrayBuffer, header: WavHeader): Float32Array {
  const { bitsPerSample, dataOffset, dataLength } = header;

  if (bitsPerSample === 16) {
    const samples = new Int16Array(buffer, dataOffset, dataLength / 2);
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      out[i] = samples[i] / 32768;
    }
    return out;
  }

  if (bitsPerSample === 8) {
    const samples = new Uint8Array(buffer, dataOffset, dataLength);
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      out[i] = (samples[i] - 128) / 128;
    }
    return out;
  }

  throw new Error("Only 8-bit or 16-bit PCM supported in this demo");
}

function drawWaveform(canvas: HTMLCanvasElement, samples: Float32Array) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.width;
  const cssHeight = canvas.clientHeight || canvas.height;

  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);

  const width = cssWidth;
  const height = cssHeight;
  const middle = height / 2;

  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, "#050712");
  bgGradient.addColorStop(1, "#0b1020");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;

  const gridSpacingX = 40;
  const gridSpacingY = 40;
  ctx.beginPath();
  for (let x = 0; x < width; x += gridSpacingX) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = 0; y < height; y += gridSpacingY) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.moveTo(0, middle + 0.5);
  ctx.lineTo(width, middle + 0.5);
  ctx.stroke();

  if (!samples.length) return;

  const pointsCount = width;
  const step = Math.max(1, Math.floor(samples.length / pointsCount));
  const amplitudes: number[] = [];

  let globalMax = 0;
  for (let i = 0; i < pointsCount; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step && start + j < samples.length; j++) {
      const v = Math.abs(samples[start + j]);
      if (v > max) max = v;
    }
    amplitudes.push(max);
    if (max > globalMax) globalMax = max;
  }

  const normFactor = globalMax > 0 ? globalMax : 1;

  ctx.strokeStyle = "#4caf50";
  ctx.fillStyle = "rgba(76, 175, 80, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  for (let x = 0; x < pointsCount; x++) {
    const amp = amplitudes[x] / normFactor;
    const y = middle - amp * (height * 0.45); 
    const px = x;

    if (x === 0) {
      ctx.moveTo(px, middle);
      ctx.lineTo(px, y);
    } else {
      ctx.lineTo(px, y);
    }
  }

  for (let x = pointsCount - 1; x >= 0; x--) {
    const amp = amplitudes[x] / normFactor;
    const y = middle + amp * (height * 0.45);
    const px = x;
    ctx.lineTo(px, y);
  }

  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  for (let x = 0; x < pointsCount; x++) {
    const amp = amplitudes[x] / normFactor;
    const y = middle - amp * (height * 0.45);
    const px = x;

    if (x === 0) {
      ctx.moveTo(px, y);
    } else {
      ctx.lineTo(px, y);
    }
  }
  ctx.stroke();
}

const WaveformViewer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [info, setInfo] = useState<WavHeader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setInfo(null);
    setSamples(null);

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const header = parseWavHeader(arrayBuffer);
      setInfo(header);

      const pcm = getPcmSamples(arrayBuffer, header);
      setSamples(pcm);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Unknown error");
    }
  };

  useEffect(() => {
    if (canvasRef.current && samples) {
      drawWaveform(canvasRef.current, samples);
    }
  }, [samples]);

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 900,
        margin: "0 auto",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#e5e7eb",
      }}
    >
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>WAV Waveform Viewer</h2>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderRadius: 999,
          border: "1px solid rgba(148, 163, 184, 0.5)",
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        <span>Choose WAV file</span>
        <input
          type="file"
          accept=".wav,audio/wav"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </label>

      {error && (
        <p style={{ color: "#f97373", marginTop: 12, fontSize: 14 }}>{error}</p>
      )}

      {info && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 13,
            color: "#9ca3af",
          }}
        >
          <div>Sample rate: {info.sampleRate} Hz</div>
          <div>Bits: {info.bitsPerSample}</div>
          <div>Channels: {info.numChannels}</div>
        </div>
      )}

      <div
        style={{
          marginTop: 20,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(148, 163, 184, 0.4)",
          background: "black",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: 260,
          }}
        />
      </div>
    </div>
  );
};

export default WaveformViewer;
