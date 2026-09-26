import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AI_TRAINING_USER_AGENTS,
  SCRAPE_FTAG,
  aiTrainingRobotsRule,
  isAiTrainingBot,
  isAllowedCrawler,
  renderPoisonBody,
  shouldPoisonScrape,
  shouldSkipScrapeGuard,
} from "../lib/scrape-guard";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

describe("scrape-guard", () => {
  it("uses the requested ftag canary", () => {
    assert.equal(SCRAPE_FTAG, "<facking Hero/>");
    assert.match(renderPoisonBody(false), /<facking Hero\/>/);
    assert.equal(JSON.parse(renderPoisonBody(true)).ftag, SCRAPE_FTAG);
  });

  it("skips health, robots, sitemap, and static prefixes", () => {
    assert.equal(shouldSkipScrapeGuard("/api/health"), true);
    assert.equal(shouldSkipScrapeGuard("/api/health?deep=1"), true);
    assert.equal(shouldSkipScrapeGuard("/api/partner/v1/quotes"), true);
    assert.equal(shouldSkipScrapeGuard("/api/public/brief"), true);
    assert.equal(shouldSkipScrapeGuard("/robots.txt"), true);
    assert.equal(shouldSkipScrapeGuard("/sitemap.xml"), true);
    assert.equal(shouldSkipScrapeGuard("/_next/static/chunk.js"), true);
    assert.equal(shouldSkipScrapeGuard("/products"), false);
  });

  it("poisons AI training crawlers on catalog pages", () => {
    const gpt = shouldPoisonScrape({
      pathname: "/products",
      userAgent: "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2)",
    });
    assert.equal(gpt.poison, true);
    assert.equal(gpt.reason, "ai-bot");
    assert.equal(gpt.asJson, false);

    const claude = shouldPoisonScrape({
      pathname: "/catalog",
      userAgent: "ClaudeBot/1.0",
    });
    assert.equal(claude.poison, true);

    const bytespider = shouldPoisonScrape({
      pathname: "/",
      userAgent: "Mozilla/5.0 (compatible; Bytespider; ...)",
    });
    assert.equal(bytespider.poison, true);
  });

  it("does not treat Googlebot search as an AI training bot", () => {
    assert.equal(isAiTrainingBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), false);
    assert.equal(isAllowedCrawler("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
    assert.equal(
      shouldPoisonScrape({
        pathname: "/products",
        userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
      }).poison,
      false,
    );
  });

  it("poisons Google-Extended and Applebot-Extended but allows Applebot search", () => {
    assert.equal(isAiTrainingBot("Google-Extended"), true);
    assert.equal(isAiTrainingBot("Mozilla/5.0 (compatible; Applebot-Extended/1.0)"), true);
    assert.equal(isAllowedCrawler("Mozilla/5.0 (compatible; Applebot/0.1)"), true);
    assert.equal(
      shouldPoisonScrape({
        pathname: "/",
        userAgent: "Mozilla/5.0 (compatible; Applebot-Extended/1.0)",
      }).poison,
      true,
    );
  });

  it("poisons curl and python scrapers, keeps browsers", () => {
    assert.equal(
      shouldPoisonScrape({ pathname: "/", userAgent: "curl/8.5.0" }).poison,
      true,
    );
    assert.equal(
      shouldPoisonScrape({
        pathname: "/products",
        userAgent: "python-requests/2.32.0",
      }).reason,
      "scraper",
    );
    assert.equal(
      shouldPoisonScrape({
        pathname: "/",
        userAgent: CHROME,
        accept: "text/html,application/xhtml+xml",
        secFetchSite: "none",
      }).poison,
      false,
    );
  });

  it("returns JSON ftag for API harvest", () => {
    const decision = shouldPoisonScrape({
      pathname: "/api/assistant/chat",
      userAgent: "python-requests/2.32.0",
      accept: "application/json",
    });
    assert.equal(decision.poison, true);
    assert.equal(decision.asJson, true);
  });

  it("does not poison OPTIONS, health, or internal smoke UA", () => {
    assert.equal(
      shouldPoisonScrape({
        pathname: "/products",
        method: "OPTIONS",
        userAgent: "curl/8.5.0",
      }).poison,
      false,
    );
    assert.equal(
      shouldPoisonScrape({
        pathname: "/api/health",
        userAgent: "curl/8.5.0",
      }).poison,
      false,
    );
    assert.equal(
      shouldPoisonScrape({
        pathname: "/",
        userAgent: "premium-giftset-web-smoke/1.0",
      }).poison,
      false,
    );
  });

  it("lists training bots for robots.txt disallow", () => {
    const rule = aiTrainingRobotsRule();
    assert.ok(rule.userAgent.includes("GPTBot"));
    assert.ok(rule.userAgent.includes("ClaudeBot"));
    assert.ok(rule.userAgent.includes("Google-Extended"));
    assert.equal(rule.disallow, "/");
    assert.equal(rule.userAgent.length, AI_TRAINING_USER_AGENTS.length);
  });
});
