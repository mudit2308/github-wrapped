// Thin GitHub API client. Works without a token (60 requests/hour, last ~90 days
// of activity); a token unlocks the full-year contribution calendar via GraphQL.

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, token, init = {}) {
  const headers = { Accept: "application/vnd.github+json", ...init.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (res.status === 404) throw new GitHubError("User not found.", 404);
  if (res.status === 401) throw new GitHubError("That token was rejected. Check it and try again.", 401);
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const when = reset ? ` Try again after ${new Date(reset * 1000).toLocaleTimeString()}.` : "";
    throw new GitHubError(`GitHub rate limit reached.${when} Adding a token raises the limit.`, res.status);
  }
  if (!res.ok) throw new GitHubError(`GitHub returned ${res.status}.`, res.status);
  return res.json();
}

async function paginate(path, token, maxPages) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await request(`${path}${sep}per_page=100&page=${page}`, token);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

const CALENDAR_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date weekday contributionCount } }
      }
    }
  }
}`;

async function fetchCalendar(login, token, year) {
  const from = new Date(Date.UTC(year, 0, 1)).toISOString();
  const to = new Date().toISOString();
  const body = await request("/graphql", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: CALENDAR_QUERY, variables: { login, from, to } }),
  });
  if (body.errors?.length) throw new GitHubError(body.errors[0].message, 400);
  return body.data.user.contributionsCollection;
}

export async function fetchWrappedData(login, { token, year = new Date().getFullYear() } = {}) {
  const user = await request(`/users/${encodeURIComponent(login)}`, token);
  const [repos, events, contributions] = await Promise.all([
    paginate(`/users/${user.login}/repos?type=owner&sort=pushed`, token, 3),
    paginate(`/users/${user.login}/events/public`, token, 3),
    token ? fetchCalendar(user.login, token, year) : Promise.resolve(null),
  ]);
  return { user, repos, events, contributions, year };
}
