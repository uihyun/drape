import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from 'lucide-react';
import { WeatherService } from '../services/weather-service.js';

const ICONS = {
  sun: Sun, partly: CloudSun, cloud: Cloud, fog: CloudFog,
  drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning,
};

export function WeatherIcon({ code, size = 12, strokeWidth = 1.8 }) {
  const Icon = ICONS[WeatherService.skyOf(code)] || Cloud;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}

// Icon + the day's mean temperature. One number on purpose (owner,
// 2026-10-08): high/low is for the stylist, not the calendar.
export function WeatherBadge({ day, unit, size = 12, className = 'wx-badge' }) {
  if (!day) return null;
  return (
    <span className={className}>
      <WeatherIcon code={day.code} size={size} />
      {WeatherService.formatTemp(day.meanC, unit)}
    </span>
  );
}

export default WeatherIcon;
