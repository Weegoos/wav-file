export interface GeoPoint {
  time: number;  // секунда от начала аудио
  lat: number;
  lng: number;
}

export interface WavMetadata {
  duration: number;  // из анализа аудио
  // ... твой прошлый header если нужно
}
