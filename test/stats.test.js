import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityFromEvents,
  daysFromCalendar,
  formatHour,
  peakIndex,
  persona,
  streaks,
  topLanguages,
  topRepo,
  weekdaysFromCalendar,
} from "../src/stats.js";

// Pin the timezone so local-time math is deterministic on every OS (including Windows).
process.env.TZ = "UTC";

test("topLanguages counts own repos, skips forks and nulls, sorts by count", () => {
  const repos = [
    { language: "Python" }, { language: "Python" }, { language: "JavaScript" },
    { language: "Go", fork: true }, { language: null },
  ];
  assert.deepEqual(topLanguages(repos), [
    { name: "Python", count: 2, pct: 67 },
    { name: "JavaScript", count: 1, pct: 33 },
  ]);
  assert.deepEqual(topLanguages([]), []);
});

test("topRepo picks the most-starred non-fork", () => {
  const repos = [
    { name: "a", stargazers_count: 3 },
    { name: "b", stargazers_count: 99, fork: true },
    { name: "c", stargazers_count: 10 },
  ];
  assert.equal(topRepo(repos).name, "c");
  assert.equal(topRepo([]), null);
});

test("activityFromEvents weights pushes by commit count", () => {
  const events = [
    { type: "PushEvent", created_at: "2026-09-28T23:10:00Z", payload: { size: 3 } },
    { type: "PushEvent", created_at: "2026-09-27T23:40:00Z", payload: { size: 0 } },
    { type: "IssuesEvent", created_at: "2026-09-27T09:00:00Z", payload: {} },
    { type: "PushEvent", created_at: "not a date", payload: { size: 5 } },
  ];
  const a = activityFromEvents(events);
  assert.equal(a.hours[23], 4);
  assert.equal(a.hours[9], 1);
  assert.equal(a.commits, 4);
  assert.equal(a.weekdays[1], 3); // 2026-09-28 is a Monday
  assert.equal(a.days.get("2026-09-27"), 2);
});

test("streaks finds longest run and current run ending today or yesterday", () => {
  const days = new Map([
    ["2026-01-30", 1], ["2026-01-31", 2], ["2026-02-01", 1], // crosses a month boundary
    ["2026-02-10", 1],
    ["2026-09-27", 1], ["2026-09-28", 4],
  ]);
  const today = new Date(2026, 8, 29); // Sep 29, no activity yet today
  assert.deepEqual(streaks(days, today), { longest: 3, current: 2, activeDays: 6 });
  assert.equal(streaks(days, new Date(2026, 8, 30)).current, 0);
  assert.deepEqual(streaks(new Map(), today), { longest: 0, current: 0, activeDays: 0 });
});

test("calendar helpers read GraphQL contribution weeks", () => {
  const calendar = {
    weeks: [
      { contributionDays: [
        { date: "2026-01-04", weekday: 0, contributionCount: 0 },
        { date: "2026-01-05", weekday: 1, contributionCount: 5 },
      ] },
      { contributionDays: [{ date: "2026-01-12", weekday: 1, contributionCount: 2 }] },
    ],
  };
  assert.deepEqual([...daysFromCalendar(calendar)], [["2026-01-05", 5], ["2026-01-12", 2]]);
  assert.deepEqual(weekdaysFromCalendar(calendar), [0, 7, 0, 0, 0, 0, 0]);
});

test("peakIndex and formatHour", () => {
  assert.equal(peakIndex([0, 3, 3, 1]), 1);
  assert.equal(peakIndex([0, 0]), -1);
  assert.deepEqual([0, 9, 12, 23].map(formatHour), ["12 AM", "9 AM", "12 PM", "11 PM"]);
});

test("persona classifies by time of activity", () => {
  const hours = (spec) => Array.from({ length: 24 }, (_, h) => spec[h] || 0);
  const weekdays = [0, 10, 10, 10, 10, 10, 0];
  assert.equal(persona(hours({ 23: 5, 1: 5, 14: 2 }), weekdays).title, "Night Owl");
  assert.equal(persona(hours({ 6: 5, 7: 5, 14: 5 }), weekdays).title, "Early Bird");
  assert.equal(persona(hours({ 10: 5, 14: 5 }), weekdays).title, "9-to-5 Pro");
  assert.equal(persona(hours({ 10: 5 }), [10, 2, 2, 2, 2, 2, 10]).title, "Weekend Warrior");
  assert.equal(persona(hours({}), weekdays).title, "The Mystery Coder");
});
