/**
 * Cerebro Topics Utilities
 */

const fs = require("fs");
const path = require("path");
const { CONFIG } = require("../config");
const { formatTimeAgo } = require("./memory");

const CEREBRO_DIR = CONFIG.paths.cerebro;

function getCerebroTopics(options = {}) {
  const { offset = 0, limit = 20, status: filterStatus = "all" } = options;

  const result = {
    initialized: false,
    cerebroPath: CEREBRO_DIR,
    topics: { active: 0, resolved: 0, parked: 0, total: 0 },
    threads: 0,
    orphans: 0,
    recentTopics: [],
    lastUpdated: null,
  };

  try {
    if (!fs.existsSync(CEREBRO_DIR)) {
      return result;
    }

    result.initialized = true;
    const topicsDir = path.join(CEREBRO_DIR, "topics");
    const orphansDir = path.join(CEREBRO_DIR, "orphans");

    if (!fs.existsSync(topicsDir)) {
      return result;
    }

    const topics = [];
    let latestModified = null;

    const topicNames = fs.readdirSync(topicsDir).filter((name) => {
      const topicPath = path.join(topicsDir, name);
      return fs.statSync(topicPath).isDirectory() && !name.startsWith("_");
    });

    topicNames.forEach((name) => {
      const topicMdPath = path.join(topicsDir, name, "topic.md");
      const topicDirPath = path.join(topicsDir, name);

      let stat;
      let content = "";
      if (fs.existsSync(topicMdPath)) {
        stat = fs.statSync(topicMdPath);
        content = fs.readFileSync(topicMdPath, "utf8");
      } else {
        stat = fs.statSync(topicDirPath);
      }

      try {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        let title = name;
        let topicStatus = "active";
        let category = "general";

        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          const titleMatch = frontmatter.match(/title:\s*(.+)/);
          const statusMatch = frontmatter.match(/status:\s*(.+)/);
          const categoryMatch = frontmatter.match(/category:\s*(.+)/);

          if (titleMatch) title = titleMatch[1].trim();
          if (statusMatch) topicStatus = statusMatch[1].trim().toLowerCase();
          if (categoryMatch) category = categoryMatch[1].trim();
        }

        const threadsDir = path.join(topicsDir, name, "threads");
        let threadCount = 0;
        if (fs.existsSync(threadsDir)) {
          threadCount = fs.readdirSync(threadsDir).filter((f) => f.endsWith(".md") || f.endsWith(".json")).length;
        }

        result.threads += threadCount;

        if (topicStatus === "active") result.topics.active++;
        else if (topicStatus === "resolved") result.topics.resolved++;
        else if (topicStatus === "parked") result.topics.parked++;

        if (!latestModified || stat.mtime > latestModified) {
          latestModified = stat.mtime;
        }

        topics.push({
          name,
          title,
          status: topicStatus,
          category,
          threads: threadCount,
          lastModified: stat.mtimeMs,
        });
      } catch (e) {
        console.error(`Failed to parse topic ${name}:`, e.message);
      }
    });

    result.topics.total = topics.length;

    // Sort: active first, then by most recently modified
    const statusPriority = { active: 0, resolved: 1, parked: 2 };
    topics.sort((a, b) => {
      const statusDiff = (statusPriority[a.status] || 3) - (statusPriority[b.status] || 3);
      if (statusDiff !== 0) return statusDiff;
      return b.lastModified - a.lastModified;
    });

    // Filter by status
    let filtered = topics;
    if (filterStatus !== "all") {
      filtered = topics.filter((t) => t.status === filterStatus);
    }

    // Paginate
    const paginated = filtered.slice(offset, offset + limit);
    result.recentTopics = paginated.map((t) => ({
      name: t.name,
      title: t.title,
      status: t.status,
      threads: t.threads,
      age: formatTimeAgo(new Date(t.lastModified)),
    }));

    // Count orphans
    if (fs.existsSync(orphansDir)) {
      try {
        result.orphans = fs.readdirSync(orphansDir).filter((f) => f.endsWith(".md")).length;
      } catch (e) {}
    }

    result.lastUpdated = latestModified ? latestModified.toISOString() : null;
  } catch (e) {
    console.error("Failed to get Cerebro topics:", e.message);
  }

  return result;
}

function updateTopicStatus(topicId, newStatus) {
  const topicDir = path.join(CEREBRO_DIR, "topics", topicId);
  const topicFile = path.join(topicDir, "topic.md");

  if (!fs.existsSync(topicDir)) {
    return { error: `Topic '${topicId}' not found`, code: 404 };
  }

  // Create topic.md if it doesn't exist
  if (!fs.existsSync(topicFile)) {
    const content = `---
title: ${topicId}
status: ${newStatus}
category: general
created: ${new Date().toISOString().split("T")[0]}
---

# ${topicId}

## Overview
*Topic tracking file.*

## Notes
`;
    fs.writeFileSync(topicFile, content, "utf8");
    return {
      topic: {
        id: topicId,
        name: topicId,
        title: topicId,
        status: newStatus,
      },
    };
  }

  // Read and update existing topic.md
  let content = fs.readFileSync(topicFile, "utf8");
  let title = topicId;

  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (frontmatterMatch) {
    let frontmatter = frontmatterMatch[1];
    const titleMatch = frontmatter.match(/title:\s*["']?([^"'\n]+)["']?/i);
    if (titleMatch) title = titleMatch[1];

    if (frontmatter.includes("status:")) {
      frontmatter = frontmatter.replace(/status:\s*(active|resolved|parked)/i, `status: ${newStatus}`);
    } else {
      frontmatter = frontmatter.trim() + `\nstatus: ${newStatus}`;
    }

    content = content.replace(/^---\n[\s\S]*?\n---/, `---\n${frontmatter}\n---`);
  } else {
    const headerMatch = content.match(/^#\s*(.+)/m);
    if (headerMatch) title = headerMatch[1];

    const frontmatter = `---
title: ${title}
status: ${newStatus}
category: general
created: ${new Date().toISOString().split("T")[0]}
---

`;
    content = frontmatter + content;
  }

  fs.writeFileSync(topicFile, content, "utf8");

  return {
    topic: {
      id: topicId,
      name: topicId,
      title: title,
      status: newStatus,
    },
  };
}

module.exports = { getCerebroTopics, updateTopicStatus };
