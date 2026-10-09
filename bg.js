"use strict";

import {
    evaluateDownloadRules,
    getStorageData,
    setStorageData,
    DEFAULT_RULES,
    DEFAULT_SETTINGS,
} from "./rules-engine.js";

/**
 * In-memory cache for fast, synchronous rule evaluation.
 */
let rulesCache = null;
let settingsCache = { ...DEFAULT_SETTINGS };

/**
 * Initializes or refreshes the in-memory rules and settings cache.
 */
async function refreshCache() {
    try {
        const data = await getStorageData();
        rulesCache = data.rules;
        settingsCache = data.settings;
    } catch (err) {
        console.error("Failed to load rules from storage:", err);
        if (!rulesCache) {
            rulesCache = [...DEFAULT_RULES];
        }
    }
}

// Immediately initiate cache load
refreshCache();

// Keep cache synchronized when settings or rules change in options/popup
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "sync" || areaName === "local") {
            if (changes.rules) {
                rulesCache = changes.rules.newValue || [];
            }
            if (changes.settings) {
                settingsCache = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue || {}) };
            }
        }
    });
}

// Seed default rules on extension installation if none exist
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(async (details) => {
        if (details.reason === "install") {
            const data = await getStorageData();
            if (!data.rules || data.rules.length === 0) {
                await setStorageData({ rules: DEFAULT_RULES, settings: DEFAULT_SETTINGS });
                rulesCache = DEFAULT_RULES;
                settingsCache = DEFAULT_SETTINGS;
            }
        }
    });
}

/**
 * Listens for new downloads and routes them based on configured rules.
 */
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    // If cache is ready, evaluate synchronously
    if (rulesCache !== null) {
        try {
            const result = evaluateDownloadRules(rulesCache, item, settingsCache);
            suggest({
                conflictAction: settingsCache.conflictAction || "uniquify",
                filename: result.targetFilename,
            });
        } catch (err) {
            console.error("Error evaluating download rules synchronously:", err);
            suggest({
                conflictAction: "uniquify",
                filename: item.filename,
            });
        }
        return;
    }

    // Otherwise, evaluate asynchronously (returns true so Chrome waits for suggest())
    (async () => {
        try {
            await refreshCache();
            const result = evaluateDownloadRules(rulesCache || DEFAULT_RULES, item, settingsCache);
            suggest({
                conflictAction: settingsCache.conflictAction || "uniquify",
                filename: result.targetFilename,
            });
        } catch (err) {
            console.error("Error evaluating download rules asynchronously:", err);
            suggest({
                conflictAction: "uniquify",
                filename: item.filename,
            });
        }
    })();

    return true; // Indicates asynchronous response
});
