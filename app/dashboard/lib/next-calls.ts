import type { WeeklyCall } from "../hub-copy";

// All schedule times are Pacific wall-clock times. Every "what time is it"
// question is answered in America/Los_Angeles, never the server's zone.
const TZ = "America/Los_Angeles";

const DAY_INDEX: Record<WeeklyCall["day"], number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type UpcomingCall = {
  call: WeeklyCall;
  occursAt: Date;
};

function parseTimeToMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!match) return 0;
  let hours = parseInt(match[1], 10) % 12;
  if (match[3] === "PM") hours += 12;
  return hours * 60 + parseInt(match[2], 10);
}

function laParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // Some engines format midnight as "24" with hour12: false.
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

// Absolute instant for an LA wall-clock time. Start from a UTC-8 guess, then
// correct by the difference between the wall time we wanted and the wall time
// the guess actually lands on (handles PDT). The schedule has no calls inside
// the 1-2 AM DST transition window, so one correction pass is exact.
function laWallTimeToDate(year: number, month: number, day: number, minutes: number): Date {
  let ts = Date.UTC(year, month - 1, day, 0, minutes + 8 * 60);
  const got = laParts(new Date(ts));
  const wantWall = Date.UTC(year, month - 1, day) + minutes * 60000;
  const gotWall = Date.UTC(got.year, got.month - 1, got.day) + (got.hour * 60 + got.minute) * 60000;
  ts += wantWall - gotWall;
  return new Date(ts);
}

// Next occurrence >= now for every call in the schedule, sorted ascending,
// sliced to `count`. A call whose start time has passed today projects to
// next week.
export function getNextCalls(
  schedule: WeeklyCall[],
  now: Date = new Date(),
  count = 4
): UpcomingCall[] {
  const nowLA = laParts(now);
  const nowDay = DAY_INDEX[nowLA.weekday as WeeklyCall["day"]] ?? 0;
  const nowMinutes = nowLA.hour * 60 + nowLA.minute;

  const projected = schedule.map((call) => {
    const startMinutes = parseTimeToMinutes(call.startTime);
    let deltaDays = (DAY_INDEX[call.day] - nowDay + 7) % 7;
    if (deltaDays === 0 && startMinutes <= nowMinutes) deltaDays = 7;
    return {
      call,
      // Date.UTC handles month/year rollover when day + deltaDays overflows.
      occursAt: laWallTimeToDate(nowLA.year, nowLA.month, nowLA.day + deltaDays, startMinutes),
      sortKey: deltaDays * 1440 + startMinutes,
    };
  });

  projected.sort((a, b) => a.sortKey - b.sortKey);
  return projected.slice(0, count).map(({ call, occursAt }) => ({ call, occursAt }));
}
