import type {FlightProfile, FlightProfileId, LaunchpadLocation} from '../types/drone';

export const EARTH_CIRCUMFERENCE_KM = 40075.017;

export const FLIGHT_PROFILES: Record<FlightProfileId, FlightProfile> = {
  cine: {
    id: 'cine',
    nameAr: 'تصوير سينمائي',
    subtitleAr: '٢٥ كم/س · فحص قريب',
    maxSpeedKmh: 25,
    maxVerticalSpeedMs: 5,
    horizontalAccelMs2: 6,
    yawRateDegS: 40,
    maxBankDeg: 8,
    maxPitchDeg: 10,
  },
  sport: {
    id: 'sport',
    nameAr: 'درون قياسي',
    subtitleAr: '٦٨ كم/س · سرعة واقعية',
    maxSpeedKmh: 68,
    maxVerticalSpeedMs: 8,
    horizontalAccelMs2: 14,
    yawRateDegS: 62,
    maxBankDeg: 16,
    maxPitchDeg: 18,
  },
  fpv: {
    id: 'fpv',
    nameAr: 'سباق FPV',
    subtitleAr: '١٤٠ كم/س · مناورة سريعة',
    maxSpeedKmh: 140,
    maxVerticalSpeedMs: 14,
    horizontalAccelMs2: 28,
    yawRateDegS: 92,
    maxBankDeg: 26,
    maxPitchDeg: 26,
  },
  wing: {
    id: 'wing',
    nameAr: 'طائرة استطلاع',
    subtitleAr: '٢٤٠ كم/س · مدى إقليمي',
    maxSpeedKmh: 240,
    maxVerticalSpeedMs: 18,
    horizontalAccelMs2: 32,
    yawRateDegS: 55,
    maxBankDeg: 22,
    maxPitchDeg: 18,
  },
};

export const LAUNCHPADS: LaunchpadLocation[] = [
  {
    id: 'dubai',
    nameAr: 'برج خليفة ووسط المدينة',
    countryAr: 'دبي، الإمارات',
    lat: 25.1932,
    lng: 55.2712,
    groundElevationM: 6,
    startAglM: 280,
    headingDeg: 34,
    tiltDeg: 75,
  },
  {
    id: 'giza',
    nameAr: 'أهرامات الجيزة',
    countryAr: 'الجيزة، مصر',
    lat: 29.9735,
    lng: 31.1408,
    groundElevationM: 65,
    startAglM: 160,
    headingDeg: 315,
    tiltDeg: 74,
  },
  {
    id: 'riyadh',
    nameAr: 'الحي المالي وبرج المملكة',
    countryAr: 'الرياض، السعودية',
    lat: 24.7114,
    lng: 46.6744,
    groundElevationM: 612,
    startAglM: 210,
    headingDeg: 20,
    tiltDeg: 74,
  },
  {
    id: 'paris',
    nameAr: 'برج إيفل ونهر السين',
    countryAr: 'باريس، فرنسا',
    lat: 48.8548,
    lng: 2.2995,
    groundElevationM: 35,
    startAglM: 190,
    headingDeg: 320,
    tiltDeg: 74,
  },
  {
    id: 'nyc',
    nameAr: 'مانهاتن وإمباير ستيت',
    countryAr: 'نيويورك، أمريكا',
    lat: 40.7421,
    lng: -73.9885,
    groundElevationM: 14,
    startAglM: 260,
    headingDeg: 18,
    tiltDeg: 75,
  },
  {
    id: 'tokyo',
    nameAr: 'شيبويا وبرج طوكيو',
    countryAr: 'طوكيو، اليابان',
    lat: 35.6562,
    lng: 139.6982,
    groundElevationM: 25,
    startAglM: 170,
    headingDeg: 68,
    tiltDeg: 74,
  },
  {
    id: 'alps',
    nameAr: 'قمة ماترهورن — جبال الألب',
    countryAr: 'زيرمات، سويسرا',
    lat: 45.9912,
    lng: 7.6745,
    groundElevationM: 2950,
    startAglM: 480,
    headingDeg: 215,
    tiltDeg: 76,
  },
  {
    id: 'grandcanyon',
    nameAr: 'جراند كانيون',
    countryAr: 'أريزونا، أمريكا',
    lat: 36.0645,
    lng: -112.1185,
    groundElevationM: 2100,
    startAglM: 380,
    headingDeg: 5,
    tiltDeg: 75,
  },
];

export interface GlobalReferenceHub {
  nameAr: string;
  lat: number;
  lng: number;
}

export const GLOBAL_REFERENCE_HUBS: GlobalReferenceHub[] = [
  {nameAr: 'دبي', lat: 25.1972, lng: 55.2744},
  {nameAr: 'الرياض', lat: 24.7136, lng: 46.6753},
  {nameAr: 'القاهرة', lat: 30.0444, lng: 31.2357},
  {nameAr: 'إسطنبول', lat: 41.0082, lng: 28.9784},
  {nameAr: 'لندن', lat: 51.5072, lng: -0.1276},
  {nameAr: 'باريس', lat: 48.8566, lng: 2.3522},
  {nameAr: 'نيويورك', lat: 40.7128, lng: -74.006},
  {nameAr: 'طوكيو', lat: 35.6762, lng: 139.6503},
  {nameAr: 'سنغافورة', lat: 1.3521, lng: 103.8198},
  {nameAr: 'سيدني', lat: -33.8688, lng: 151.2093},
  {nameAr: 'زيورخ', lat: 47.3769, lng: 8.5417},
  {nameAr: 'ساو باولو', lat: -23.5505, lng: -46.6333},
];

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371.0088;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestReferenceHub(
  lat: number,
  lng: number,
): {nameAr: string; distanceKm: number} {
  let bestName = GLOBAL_REFERENCE_HUBS[0].nameAr;
  let bestDist = Infinity;
  for (let i = 0; i < GLOBAL_REFERENCE_HUBS.length; i++) {
    const hub = GLOBAL_REFERENCE_HUBS[i];
    const d = haversineDistanceKm(lat, lng, hub.lat, hub.lng);
    // Prefer a distant reference hub (> 15 km) so user sees true world-scale ETA, fallback to closest
    if (d > 15 && d < bestDist) {
      bestDist = d;
      bestName = hub.nameAr;
    }
  }
  if (!Number.isFinite(bestDist)) {
    for (let i = 0; i < GLOBAL_REFERENCE_HUBS.length; i++) {
      const hub = GLOBAL_REFERENCE_HUBS[i];
      const d = haversineDistanceKm(lat, lng, hub.lat, hub.lng);
      if (d < bestDist) {
        bestDist = d;
        bestName = hub.nameAr;
      }
    }
  }
  return {nameAr: bestName, distanceKm: bestDist};
}

export function formatTravelEtaAr(distanceKm: number, speedKmh: number): string {
  const effectiveSpeed = Math.max(speedKmh, 1);
  const totalMinutes = Math.round((distanceKm / effectiveSpeed) * 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} دقيقة`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours} س ${mins} د` : `${hours} ساعة`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days} يوم و ${remHours} س` : `${days} يوم`;
}
