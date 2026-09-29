import { fetchWrappedData } from "./github.js";
import {
  DAY_NAMES,
  activityFromEvents,
  daysFromCalendar,
  formatHour,
  peakIndex,
  persona,
  streaks,
  topLanguages,
  topRepo,
  weekdaysFromCalendar,
} from "./stats.js";

import { playStory } from "./story.js";
import { colorFor, countUp, escapeHtml, prefersReducedMotion } from "./ui.js";

const $ = (sel) => document.querySelector(sel);
const form = $("#wrap-form");
const status = $("#status");
const result = $("#result");
const card = $("#card");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.hidden = !message;
}

const LOADING_LINES = [
  "Counting your commits…",
  "Finding your favorite language…",
  "Checking your late-night pushes…",
  "Measuring your streaks…",
  "Wrapping it all up…",
];
let loadingTimer = null;

function setLoading(on) {
  const loader = $("#loader");
  clearInterval(loadingTimer);
  loader.hidden = !on;
  if (!on) return;
  let i = 0;
  const text = loader.querySelector(".loader-text");
  text.textContent = LOADING_LINES[0];
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_LINES.length;
    text.textContent = LOADING_LINES[i];
  }, 1200);
}

function computeWrapped({ user, repos, events, contributions, year }) {
  const activity = activityFromEvents(events);
  const fullYear = Boolean(contributions);
  const days = fullYear ? daysFromCalendar(contributions.contributionCalendar) : activity.days;
  const weekdays = fullYear ? weekdaysFromCalendar(contributions.contributionCalendar) : activity.weekdays;
  const peakHour = peakIndex(activity.hours);
  const peakDay = peakIndex(weekdays);

  return {
    user,
    year,
    fullYear,
    headline: fullYear
      ? { value: contributions.contributionCalendar.totalContributions, label: `contributions in ${year}` }
      : { value: activity.commits, label: "commits in the last 90 days" },
    languages: topLanguages(repos),
    repo: topRepo(repos),
    hours: activity.hours,
    peakHour,
    peakDay,
    streak: streaks(days),
    persona: persona(activity.hours, weekdays),
    publicRepos: user.public_repos,
  };
}

function renderCard(w) {
  const maxHour = Math.max(...w.hours, 1);
  const hourBars = w.hours
    .map((n, h) => {
      const height = Math.max(4, Math.round((n / maxHour) * 100));
      return `<span class="bar${h === w.peakHour ? " peak" : ""}" style="height:${height}%;--d:${1.1 + h * 0.025}s" title="${formatHour(h)}: ${n}"></span>`;
    })
    .join("");

  const languages = w.languages.length
    ? w.languages
        .map(
          (l, i) => `
        <li>
          <span class="lang-name"><i style="background:${colorFor(l.name)}"></i>${escapeHtml(l.name)}</span>
          <span class="lang-pct">${l.pct}%</span>
          <span class="lang-track"><span style="width:${l.pct}%;background:${colorFor(l.name)};--d:${0.9 + i * 0.1}s"></span></span>
        </li>`
        )
        .join("")
    : `<li class="muted">No languages detected yet</li>`;

  const repo = w.repo
    ? `<div class="repo">
        <span class="label">Top repo</span>
        <strong>${escapeHtml(w.repo.name)}</strong>
        <span class="stars">★ ${w.repo.stargazers_count.toLocaleString()}</span>
      </div>`
    : "";

  card.innerHTML = `
    <div class="card-glow"></div>
    <div class="card-shine"></div>
    <header class="card-head rise" style="--d:.05s">
      <img class="avatar" src="${escapeHtml(w.user.avatar_url)}&s=160" alt="" crossorigin="anonymous" />
      <div>
        <div class="name">${escapeHtml(w.user.name || w.user.login)}</div>
        <div class="login">@${escapeHtml(w.user.login)}</div>
      </div>
      <div class="edition">GitHub<br/><b>Wrapped ${w.year}</b></div>
    </header>

    <section class="hero rise" style="--d:.2s">
      <div class="hero-value">${w.headline.value.toLocaleString()}</div>
      <div class="hero-label">${escapeHtml(w.headline.label)}</div>
    </section>

    <section class="persona rise" style="--d:.35s">
      <span class="label">Your coding persona</span>
      <strong>${escapeHtml(w.persona.title)}</strong>
      <span>${escapeHtml(w.persona.blurb)}</span>
    </section>

    <section class="grid rise" style="--d:.5s">
      <div class="panel">
        <span class="label">Top languages</span>
        <ul class="langs">${languages}</ul>
      </div>
      <div class="panel stats">
        <div><b>${w.streak.longest}</b><span>day longest streak</span></div>
        <div><b>${w.streak.current}</b><span>day current streak</span></div>
        <div><b>${w.peakDay >= 0 ? DAY_NAMES[w.peakDay].slice(0, 3) : "—"}</b><span>busiest day</span></div>
      </div>
    </section>

    <section class="panel hours rise" style="--d:.65s">
      <div class="hours-head">
        <span class="label">When you code</span>
        <span class="peak-label">${w.peakHour >= 0 ? `Peak: ${formatHour(w.peakHour)}` : "No recent activity"}</span>
      </div>
      <div class="bars">${hourBars}</div>
      <div class="axis"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span></div>
    </section>

    <footer class="card-foot rise" style="--d:.8s">
      ${repo}
      <span class="brand">${w.fullYear ? "Full-year stats" : "Based on recent public activity"} · ${escapeHtml(location.host || "github-wrapped")}</span>
    </footer>
  `;
}

// The card is a fixed 540px wide so the export is always the same size;
// on narrow screens, zoom it down to fit instead.
function fitCard() {
  card.style.zoom = Math.min(1, (window.innerWidth - 32) / 540);
}
window.addEventListener("resize", fitCard);

function shareUrl(login) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("user", login);
  return url.toString();
}

let current = null;

/** Show the card with its entrance animation (re-triggered on every call). */
function revealCard() {
  result.hidden = false;
  card.classList.remove("reveal");
  void card.offsetWidth;
  card.classList.add("reveal");
  countUp(card.querySelector(".hero-value"), current.headline.value, { delay: 300 });
  result.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

async function showStoryThenCard() {
  result.hidden = true;
  if (!prefersReducedMotion()) await playStory(current);
  revealCard();
}

async function wrap(login) {
  login = login.trim().replace(/^@/, "");
  if (!login) return;
  const token = $("#token").value.trim() || undefined;
  setStatus("");
  setLoading(true);
  result.hidden = true;
  form.querySelector("button").disabled = true;
  try {
    const data = await fetchWrappedData(login, { token });
    current = computeWrapped(data);
    renderCard(current);
    fitCard();
    history.replaceState(null, "", `?user=${encodeURIComponent(current.user.login)}`);
    result.dataset.login = current.user.login;
    setLoading(false);
    await showStoryThenCard();
  } catch (err) {
    console.error(err);
    setLoading(false);
    setStatus(err.message || "Something went wrong.", true);
  } finally {
    form.querySelector("button").disabled = false;
  }
}

$("#replay").addEventListener("click", () => current && showStoryThenCard());

// Subtle 3D tilt that follows the pointer (mouse only, not touch).
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !prefersReducedMotion()) {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(1200px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
    card.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
  });
  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  wrap($("#username").value);
});

$("#download").addEventListener("click", async () => {
  const btn = $("#download");
  btn.disabled = true;
  // Freeze the card in its final state: no zoom, tilt or animations in the image.
  card.style.zoom = 1;
  card.style.transform = "";
  card.classList.add("exporting");
  card.querySelector(".hero-value").textContent = current.headline.value.toLocaleString();
  try {
    // 540x675 card rendered at 2x = 1080x1350, LinkedIn's recommended portrait size.
    const canvas = await window.html2canvas(card, { scale: 2, useCORS: true, backgroundColor: null });
    const link = document.createElement("a");
    link.download = `github-wrapped-${result.dataset.login}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error(err);
    setStatus("Couldn't export the image. Try taking a screenshot instead.", true);
  } finally {
    card.classList.remove("exporting");
    fitCard();
    btn.disabled = false;
  }
});

$("#copy-link").addEventListener("click", async () => {
  const btn = $("#copy-link");
  try {
    await navigator.clipboard.writeText(shareUrl(result.dataset.login));
    btn.textContent = "Copied!";
  } catch {
    btn.textContent = "Copy failed";
  }
  setTimeout(() => (btn.textContent = "Copy link"), 1500);
});

$("#linkedin").addEventListener("click", () => {
  const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl(result.dataset.login))}`;
  window.open(url, "_blank", "noopener");
});

const initial = new URLSearchParams(location.search).get("user");
if (initial) {
  $("#username").value = initial;
  wrap(initial);
}
