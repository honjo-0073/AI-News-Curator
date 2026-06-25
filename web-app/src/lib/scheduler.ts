export type WeeklyTriggerSettings = {
  enabled?: boolean;
  daysOfWeek?: number[];
  last_run_date?: string | null;
};

const TOKYO_TIME_ZONE = 'Asia/Tokyo';
const WEEKDAY_TO_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getTokyoDateInfo(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TOKYO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);

  const getPart = (type: string) => parts.find(part => part.type === type)?.value || '';
  const weekday = getPart('weekday');

  return {
    dateKey: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    dayOfWeek: WEEKDAY_TO_NUMBER[weekday],
  };
}

export function shouldRunWeeklyTrigger(
  settings: WeeklyTriggerSettings | null | undefined,
  now = new Date()
) {
  if (!settings?.enabled) return false;

  const daysOfWeek = Array.isArray(settings.daysOfWeek) ? settings.daysOfWeek : [];
  if (daysOfWeek.length === 0) return false;

  const { dateKey, dayOfWeek } = getTokyoDateInfo(now);
  if (!daysOfWeek.includes(dayOfWeek)) return false;
  if (settings.last_run_date === dateKey) return false;

  return true;
}

export function markWeeklyTriggerRun(
  settings: WeeklyTriggerSettings | null | undefined,
  now = new Date()
): WeeklyTriggerSettings {
  return {
    enabled: !!settings?.enabled,
    daysOfWeek: Array.isArray(settings?.daysOfWeek) ? settings.daysOfWeek : [],
    last_run_date: getTokyoDateInfo(now).dateKey,
  };
}
