// Full-screen, Spotify Wrapped-style story slides shown before the final card.
// Tap right / → to advance, tap left / ← to go back, Esc or "Skip" to jump to the card.

import { DAY_NAMES, formatHour } from "./stats.js";
import { colorFor, countUp, escapeHtml } from "./ui.js";

const SLIDE_MS = 5000;

function headlineQuip(n) {
  if (n >= 1000) return "That's a whole lot of green squares.";
  if (n >= 200) return "Consistent. Impressive. Keep going.";
  if (n > 0) return "Every commit counts.";
  return "A quiet stretch. The best is yet to come.";
}

function buildSlides(w) {
  const first = escapeHtml((w.user.name || w.user.login).split(" ")[0]);
  const period = w.fullYear ? `${w.year}` : "last 90 days";
  const slides = [];

  slides.push({
    theme: "violet",
    html: `
      <div class="s-kicker a-fade">GitHub Wrapped ${w.year}</div>
      <img class="s-avatar a-pop" style="--d:.2s" src="${escapeHtml(w.user.avatar_url)}&s=240" alt="" />
      <h2 class="s-title a-rise" style="--d:.5s">Hey ${first}.</h2>
      <p class="s-sub a-rise" style="--d:.9s">Let's look back at your ${period} in code.</p>`,
  });

  slides.push({
    theme: "green",
    html: `
      <p class="s-lead a-rise">You made</p>
      <div class="s-big a-pop" style="--d:.3s" data-count="${w.headline.value}">0</div>
      <p class="s-lead a-rise" style="--d:.5s">${escapeHtml(w.headline.label)}</p>
      <p class="s-sub a-rise" style="--d:1.6s">${headlineQuip(w.headline.value)}</p>`,
  });

  if (w.languages.length) {
    const top = w.languages[0];
    const bars = w.languages
      .map(
        (l, i) => `
        <li class="a-rise" style="--d:${1.1 + i * 0.15}s">
          <span>${escapeHtml(l.name)}</span><b>${l.pct}%</b>
          <i><em style="--w:${l.pct}%;--c:${colorFor(l.name)};--d:${1.3 + i * 0.15}s"></em></i>
        </li>`
      )
      .join("");
    slides.push({
      theme: "blue",
      html: `
        <p class="s-lead a-rise">Your top language was</p>
        <div class="s-word a-pop" style="--d:.35s;color:${colorFor(top.name)}">${escapeHtml(top.name)}</div>
        <ul class="s-langs">${bars}</ul>`,
    });
  }

  if (w.peakHour >= 0) {
    const max = Math.max(...w.hours, 1);
    const bars = w.hours
      .map(
        (n, h) =>
          `<span class="${h === w.peakHour ? "peak" : ""}" style="--h:${Math.max(4, (n / max) * 100)}%;--d:${0.9 + h * 0.03}s"></span>`
      )
      .join("");
    const day = w.peakDay >= 0 ? `<p class="s-sub a-rise" style="--d:1.9s">And your busiest day? <b>${DAY_NAMES[w.peakDay]}</b>.</p>` : "";
    slides.push({
      theme: "night",
      html: `
        <p class="s-lead a-rise">You were most active at</p>
        <div class="s-word a-pop" style="--d:.35s">${formatHour(w.peakHour)}</div>
        <div class="s-hours">${bars}</div>
        ${day}`,
    });
  }

  slides.push({
    theme: "fire",
    html: `
      <p class="s-lead a-rise">Your longest streak</p>
      <div class="s-flame a-pop" style="--d:.3s">🔥</div>
      <div class="s-big a-pop" style="--d:.5s" data-count="${w.streak.longest}">0</div>
      <p class="s-lead a-rise" style="--d:.7s">${w.streak.longest === 1 ? "day" : "days"} in a row</p>
      <p class="s-sub a-rise" style="--d:1.6s">${
        w.streak.current > 0 ? `You're on a ${w.streak.current}-day streak right now. Don't break it!` : "Time to start a new one."
      }</p>`,
  });

  slides.push({
    theme: "persona",
    html: `
      <p class="s-lead a-rise">Your coding persona is…</p>
      <div class="s-persona a-reveal" style="--d:1s">${escapeHtml(w.persona.title)}</div>
      <p class="s-sub a-rise" style="--d:1.8s">${escapeHtml(w.persona.blurb)}</p>
      <button class="s-cta a-rise" style="--d:2.4s" data-action="finish">See my card →</button>`,
  });

  return slides;
}

/** Plays the story; resolves when the user finishes or skips it. */
export function playStory(w) {
  return new Promise((resolve) => {
    const slides = buildSlides(w);
    const root = document.createElement("div");
    root.className = "story";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Your GitHub Wrapped story");
    root.innerHTML = `
      <div class="story-progress">${slides.map(() => "<span><i></i></span>").join("")}</div>
      <button class="story-skip" data-action="finish">Skip ✕</button>
      ${slides
        .map(
          (s) => `
        <section class="story-slide theme-${s.theme}">
          <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
          <div class="story-content">${s.html}</div>
        </section>`
        )
        .join("")}
    `;
    document.body.appendChild(root);
    document.body.classList.add("story-open");

    const sections = [...root.querySelectorAll(".story-slide")];
    const bars = [...root.querySelectorAll(".story-progress > span")];
    let index = -1;
    let timer = null;

    function show(i) {
      if (i < 0) i = 0;
      if (i >= sections.length) return finish();
      index = i;
      sections.forEach((s, j) => s.classList.toggle("active", j === i));
      bars.forEach((b, j) => {
        b.className = j < i ? "done" : "";
        // Restart the fill animation on the current bar.
        if (j === i) {
          void b.offsetWidth;
          b.className = "current";
        }
      });
      root.style.setProperty("--slide-ms", `${SLIDE_MS}ms`);
      sections[i].querySelectorAll("[data-count]").forEach((el) => countUp(el, Number(el.dataset.count), { delay: 400 }));
      clearTimeout(timer);
      // The last slide waits for the user to tap "See my card".
      if (i < sections.length - 1) timer = setTimeout(() => show(index + 1), SLIDE_MS);
    }

    function finish() {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      root.classList.add("closing");
      document.body.classList.remove("story-open");
      setTimeout(() => {
        root.remove();
        resolve();
      }, 450);
    }

    function onKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") show(index + 1);
      else if (e.key === "ArrowLeft") show(index - 1);
      else if (e.key === "Escape") finish();
      else return;
      e.preventDefault();
    }

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-action=finish]")) return finish();
      const leftSide = e.clientX < window.innerWidth / 3;
      show(leftSide ? index - 1 : index + 1);
    });
    document.addEventListener("keydown", onKey);
    show(0);
  });
}
