// Pure functions that turn raw GitHub API data into "wrapped" stats.
// No DOM or network access here, so everything is unit-testable in Node.

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Local YYYY-MM-DD key for a Date. */
export function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Top languages across the user's own (non-fork) repos, by repo count. */
export function topLanguages(repos, limit = 5) {
  const counts = new Map();
  for (const repo of repos) {
    if (repo.fork || !repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, pct: total ? Math.round((count / total) * 100) : 0 }));
}

/** The user's most-starred own repo, or null. */
export function topRepo(repos) {
  const own = repos.filter((r) => !r.fork);
  if (!own.length) return null;
  return own.reduce((best, r) => (r.stargazers_count > best.stargazers_count ? r : best));
}

/** Weight of one public event: pushes count once per commit, everything else once. */
function eventWeight(event) {
  if (event.type === "PushEvent") {
    const size = event.payload?.size ?? event.payload?.commits?.length;
    return Math.max(1, size || 1);
  }
  return 1;
}

/**
 * Activity by hour of day and day of week (in the viewer's local timezone),
 * plus a per-day activity map, from the public events feed.
 */
export function activityFromEvents(events) {
  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  const days = new Map();
  let commits = 0;
  for (const event of events) {
    const at = new Date(event.created_at);
    if (Number.isNaN(at.getTime())) continue;
    const w = eventWeight(event);
    hours[at.getHours()] += w;
    weekdays[at.getDay()] += w;
    const key = dayKey(at);
    days.set(key, (days.get(key) || 0) + w);
    if (event.type === "PushEvent") commits += w;
  }
  return { hours, weekdays, days, commits };
}

/** Per-day contribution map from a GraphQL contributionCalendar. */
export function daysFromCalendar(calendar) {
  const days = new Map();
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      if (day.contributionCount > 0) days.set(day.date, day.contributionCount);
    }
  }
  return days;
}

/** Weekday totals from a GraphQL contributionCalendar. */
export function weekdaysFromCalendar(calendar) {
  const weekdays = new Array(7).fill(0);
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) weekdays[day.weekday] += day.contributionCount;
  }
  return weekdays;
}

/**
 * Longest and current streak of consecutive active days.
 * `days` is a Map of YYYY-MM-DD -> count; `today` is a Date.
 * The current streak survives if today has no activity yet but yesterday did.
 */
export function streaks(days, today = new Date()) {
  const active = [...days.entries()].filter(([, n]) => n > 0).map(([k]) => k).sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const key of active) {
    run = prev && nextDay(prev) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = key;
  }

  const set = new Set(active);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (set.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { longest, current, activeDays: set.size };
}

function nextDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + 1));
}

/** Index of the largest value (first one wins ties), or -1 if all zero. */
export function peakIndex(values) {
  let best = -1;
  let max = 0;
  values.forEach((v, i) => {
    if (v > max) {
      max = v;
      best = i;
    }
  });
  return best;
}

export function formatHour(h) {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** A fun coding persona based on when the user is active. */
export function persona(hours, weekdays) {
  const total = hours.reduce((a, b) => a + b, 0);
  if (!total) return { title: "The Mystery Coder", blurb: "Your commits are a closely guarded secret." };

  const share = (from, to) => {
    let sum = 0;
    for (let h = from; h !== to; h = (h + 1) % 24) sum += hours[h];
    return sum / total;
  };
  const weekTotal = weekdays.reduce((a, b) => a + b, 0) || 1;
  const weekend = (weekdays[0] + weekdays[6]) / weekTotal;

  if (weekend >= 0.4) return { title: "Weekend Warrior", blurb: "Saturdays are for shipping." };
  if (share(22, 4) >= 0.35) return { title: "Night Owl", blurb: "Your best code happens after dark." };
  if (share(5, 9) >= 0.3) return { title: "Early Bird", blurb: "Committing before the coffee's done." };
  if (share(9, 18) >= 0.6) return { title: "9-to-5 Pro", blurb: "Consistent, focused, and home for dinner." };
  return { title: "Code Nomad", blurb: "Any hour is a good hour to ship." };
}
