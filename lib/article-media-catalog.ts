/**
 * Local cover photos for factual blog drafts (Wikimedia Commons / NASA).
 * Files live under public/images/articles/.
 */

export const ARTICLE_TOPICS = ["gift", "travel", "it", "ai", "earth"] as const;
export type ArticleTopic = (typeof ARTICLE_TOPICS)[number];

export const ARTICLE_TOPIC_LABELS: Record<ArticleTopic, string> = {
  gift: "ของขวัญองค์กร",
  travel: "ท่องเที่ยว",
  it: "ไอที",
  ai: "เอไอ",
  earth: "อนุรักษ์โลก",
};

export type ArticleMediaEntry = {
  coverUrl: string;
  creditLine: string;
  commonsUrl: string;
  license: string;
};

const CATALOG: Record<ArticleTopic, ArticleMediaEntry> = {
  gift: {
    coverUrl: "/images/article-cover.svg",
    creditLine: "ภาพปกมาตรฐาน SmartGift",
    commonsUrl: "",
    license: "internal",
  },
  travel: {
    coverUrl: "/images/articles/travel-khao-yai.jpg",
    creditLine:
      "รูปปก: Wild Asian elephants at Khao Yai NP — Mammalwatcher (CC0)",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Wild_Asian_elephants_at_Khao_Yai_NP.JPG",
    license: "CC0",
  },
  it: {
    coverUrl: "/images/articles/it-https-servers.jpg",
    creditLine: "รูปปก: Servers in a Rack — Abigor (CC BY-SA 3.0)",
    commonsUrl: "https://commons.wikimedia.org/wiki/File:Servers_in_a_Rack.jpg",
    license: "CC BY-SA 3.0",
  },
  ai: {
    coverUrl: "/images/articles/ai-neural.jpg",
    creditLine:
      "รูปปก: Artificial Intelligence & AI & Machine Learning — via vpnsrus.com (CC BY 2.0)",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Artificial_Intelligence_%26_AI_%26_Machine_Learning_-_30212411048.jpg",
    license: "CC BY 2.0",
  },
  earth: {
    coverUrl: "/images/articles/earth-biodiversity.jpg",
    creditLine:
      "รูปปก: The Blue Marble (Earth from Apollo 17) — NASA/Apollo 17 crew (Public domain)",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg",
    license: "Public domain",
  },
};

export function isArticleTopic(value: string | null | undefined): value is ArticleTopic {
  return (ARTICLE_TOPICS as readonly string[]).includes(String(value || ""));
}

export function resolveArticleTopic(value: string | null | undefined): ArticleTopic {
  return isArticleTopic(value) ? value : "gift";
}

export function mediaForTopic(topic: ArticleTopic): ArticleMediaEntry {
  return CATALOG[topic];
}

export function creditLinesForBody(topic: ArticleTopic): string[] {
  const media = mediaForTopic(topic);
  if (topic === "gift" || !media.commonsUrl) return [];
  return [
    media.creditLine,
    `หน้าไฟล์ภาพ: ${media.commonsUrl}`,
    `ใบอนุญาต: ${media.license}`,
  ];
}
