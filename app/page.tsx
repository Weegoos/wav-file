import AudioGeoMap from "./components/AudioGeoMap";
import sampleLocations from "./data/sample-locations.json";  // Твои точки

export default function Home() {
  return <AudioGeoMap initialPoints={sampleLocations} />;
}
