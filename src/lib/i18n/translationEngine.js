// DOM-based translation engine. Scans visible text nodes and translatable
// attributes (placeholder, aria-label, title), batches unique strings, sends
// them to the translateStrings backend function (LLM), caches results, and
// applies translations in-place. A MutationObserver catches React re-renders
// and new content. Skips inputs, contenteditable, code blocks, and elements
// marked data-no-translate.

import { base44 } from "@/api/base44Client";
import { loadCache, saveCache } from "./translationCache";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "KBD", "SAMP", "PRE"]);
const TRANSLATABLE_ATTRS = ["placeholder", "aria-label", "title"];
const BATCH_SIZE = 40;
const DEBOUNCE_MS = 150;
const MAX_TEXT_LENGTH = 1000;

export function translationEngine(targetLanguage, onTranslatingChange) {
  const cache = loadCache(targetLanguage);
  let observer = null;
  let debounceTimer = null;
  let isApplying = false;
  let isProcessing = false;
  let isRunning = false;
  let activeBatchCount = 0;
  const nodeMap = new WeakMap(); // node -> { original, translated, attr? }

  function shouldSkipElement(el) {
    let current = el;
    while (current && current !== document.body) {
      if (current.hasAttribute && current.hasAttribute("data-no-translate")) return true;
      if (current.isContentEditable) return true;
      const tag = current.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return true;
      current = current.parentElement;
    }
    return false;
  }

  function isTranslatableText(text) {
    const trimmed = (text || "").trim();
    if (trimmed.length < 2 || trimmed.length > MAX_TEXT_LENGTH) return false;
    if (/^[\d\s\p{P}\p{S}]+$/u.test(trimmed)) return false;
    if (/^https?:\/\//i.test(trimmed)) return false;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
    return true;
  }

  function collectTextNodes(root) {
    const nodes = [];
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!isTranslatableText(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
    } catch {}
    return nodes;
  }

  function collectAttrNodes(root) {
    const results = [];
    try {
      const els = root.querySelectorAll(TRANSLATABLE_ATTRS.map((a) => `[${a}]`).join(","));
      for (const el of els) {
        if (shouldSkipElement(el)) continue;
        for (const attr of TRANSLATABLE_ATTRS) {
          const val = el.getAttribute(attr);
          if (val && isTranslatableText(val)) {
            results.push({ node: el, attr });
          }
        }
      }
    } catch {}
    return results;
  }

  function getCurrentText(node, attr) {
    return attr ? node.getAttribute(attr) : node.nodeValue;
  }

  function applyTranslation(node, attr, translated) {
    isApplying = true;
    try {
      if (attr) node.setAttribute(attr, translated);
      else node.nodeValue = translated;
    } catch {} finally {
      isApplying = false;
    }
  }

  function batchStart() {
    activeBatchCount++;
    if (activeBatchCount === 1) onTranslatingChange?.(true);
  }

  function batchEnd() {
    activeBatchCount = Math.max(0, activeBatchCount - 1);
    if (activeBatchCount === 0) onTranslatingChange?.(false);
  }

  async function processBatch(items) {
    if (isProcessing) return;
    isProcessing = true;
    try {
      const toTranslate = new Set();
      const pendingItems = [];

      for (const { node, attr } of items) {
        const current = getCurrentText(node, attr);
        const entry = nodeMap.get(node);
        // Already showing the translated text — skip.
        if (entry && current === entry.translated) continue;
        // Cached — apply immediately, no LLM call.
        if (cache.has(current)) {
          const translated = cache.get(current);
          applyTranslation(node, attr, translated);
          nodeMap.set(node, { original: current, translated, attr });
          continue;
        }
        toTranslate.add(current);
        pendingItems.push({ node, attr, original: current });
      }

      if (toTranslate.size === 0) return;

      const texts = [...toTranslate];
      batchStart();
      try {
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
          const batch = texts.slice(i, i + BATCH_SIZE);
          let translations = [];
          try {
            const res = await base44.functions.invoke("translateStrings", {
              texts: batch,
              targetLanguage,
            });
            translations = res?.data?.translations || [];
          } catch (err) {
            console.warn("Translation batch failed:", err);
            translations = batch; // fallback to original text
          }
          batch.forEach((text, idx) => {
            cache.set(text, translations[idx] || text);
          });
        }
        saveCache(targetLanguage, cache);

        for (const { node, attr, original } of pendingItems) {
          if (cache.has(original)) {
            const translated = cache.get(original);
            applyTranslation(node, attr, translated);
            nodeMap.set(node, { original, translated, attr });
          }
        }
      } finally {
        batchEnd();
      }
    } finally {
      isProcessing = false;
    }
  }

  function scheduleProcessing() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!isRunning || !document.body) return;
      const textNodes = collectTextNodes(document.body).map((node) => ({ node }));
      const attrNodes = collectAttrNodes(document.body);
      const all = [...textNodes, ...attrNodes];
      if (all.length === 0) return;
      processBatch(all);
    }, DEBOUNCE_MS);
  }

  function handleMutations() {
    if (isApplying) return;
    scheduleProcessing();
  }

  function start() {
    if (isRunning || !document.body) return;
    isRunning = true;
    scheduleProcessing();
    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRS,
    });
  }

  function stop() {
    isRunning = false;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    clearTimeout(debounceTimer);
    if (activeBatchCount > 0) {
      activeBatchCount = 0;
      onTranslatingChange?.(false);
    }
  }

  return { start, stop };
}