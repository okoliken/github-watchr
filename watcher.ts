import "dotenv/config";
import * as fs from "fs";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const GITHUB_REPO = (process.env.GITHUB_REPO || "testfiesta/testfiesta-frontend").trim();
const WEBHOOK_URL = (process.env.WEBHOOK_URL || "https://us-central1-goalmatics.cloudfunctions.net/webhook/j5z2447v").trim();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
const POLL_INTERVAL_MS = 60_000; // 60 seconds
const STATE_FILE = "./seen_issues.json";
// ───────────────────────────────────────────────────────────────────────────

interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  user: { login: string; avatar_url: string };
  created_at: string;
  labels: { name: string; color: string }[];
}

interface WebhookPayload {
  text: string;
  issue_number: number;
  title: string;
  url: string;
  author: string;
  body: string;
  labels: string[];
  created_at: string;
}

function loadSeenIssues(): Set<number> {
  try {
    const data = fs.readFileSync(STATE_FILE, "utf-8");
    return new Set<number>(JSON.parse(data));
  } catch {
    return new Set<number>();
  }
}

function saveSeenIssues(seen: Set<number>): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify([...seen]), "utf-8");
}

async function fetchIssues(): Promise<GitHubIssue[]> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/issues?state=open&sort=created&direction=desc&per_page=20`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-watchr",
  };

  if (GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const bodyText = await res.text();
    const details = bodyText ? ` - ${bodyText.slice(0, 300)}` : "";
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}${details}`);
  }

  return res.json() as Promise<GitHubIssue[]>;
}

async function sendToWebhook(issue: GitHubIssue): Promise<void> {
  const payload: WebhookPayload = {
    text: `🆕 New Issue on ${GITHUB_REPO}: #${issue.number} — ${issue.title}`,
    issue_number: issue.number,
    title: issue.title,
    url: issue.html_url,
    author: issue.user.login,
    body: issue.body?.slice(0, 500) ?? "(no description)",
    labels: issue.labels.map((l) => l.name),
    created_at: issue.created_at,
  };

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`❌ Webhook delivery failed: ${res.status} ${res.statusText}`);
  } else {
    console.log(`✅ Webhook sent for issue #${issue.number}: "${issue.title}"`);
  }
}

async function poll(seen: Set<number>): Promise<void> {
  console.log(`🔍 [${new Date().toISOString()}] Checking for new issues...`);

  try {
    const issues = await fetchIssues();

    for (const issue of issues) {
      if (!seen.has(issue.number)) {
        seen.add(issue.number);
        await sendToWebhook(issue);
      }
    }

    saveSeenIssues(seen);
  } catch (err) {
    console.error("❌ Error during poll:", err);
  }
}

async function main(): Promise<void> {
  if (!/^[^/\s]+\/[^/\s]+$/.test(GITHUB_REPO)) {
    throw new Error(`Invalid GITHUB_REPO value "${GITHUB_REPO}". Expected format: owner/repo`);
  }

  console.log(`🚀 Watching ${GITHUB_REPO} for new issues...`);
  console.log(`📡 Webhook: ${WEBHOOK_URL}`);
  console.log(`⏱  Polling every ${POLL_INTERVAL_MS / 1000}s\n`);

  const seen = loadSeenIssues();

  // Seed with existing issues on first run so we don't spam the webhook
  if (seen.size === 0) {
    console.log("🌱 Seeding existing issues (no notifications for these)...");
    const existing = await fetchIssues();
    for (const issue of existing) seen.add(issue.number);
    saveSeenIssues(seen);
    console.log(`   ${seen.size} existing issues recorded.\n`);
  }

  // Start polling
  setInterval(() => poll(seen), POLL_INTERVAL_MS);
}

main().catch(console.error);