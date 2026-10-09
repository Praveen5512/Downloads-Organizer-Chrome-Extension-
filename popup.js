/**
 * Downloads Organizer - Popup Controller
 */

import { getStorageData, setStorageData, DEFAULT_SETTINGS } from "./rules-engine.js";

let detectedDomain = "";

async function initPopup() {
    setupListeners();
    await loadPopupData();
    await detectCurrentTabDomain();
}

async function loadPopupData() {
    try {
        const data = await getStorageData();
        const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
        const rules = Array.isArray(data.rules) ? data.rules : [];

        const isEnabled = settings.extensionEnabled !== false;
        const toggle = document.getElementById("popup-toggle");
        const statusText = document.getElementById("status-text");
        const statusIndicator = document.getElementById("status-indicator");

        toggle.checked = isEnabled;
        statusText.textContent = isEnabled ? "Active" : "Paused";
        if (isEnabled) {
            statusIndicator.classList.remove("disabled");
        } else {
            statusIndicator.classList.add("disabled");
        }

        const activeRules = rules.filter((r) => r.enabled !== false);
        const badge = document.getElementById("rule-count-badge");
        badge.textContent = `${activeRules.length} Active`;

        const listContainer = document.getElementById("rules-mini-list");
        if (activeRules.length === 0) {
            listContainer.innerHTML = `<div class="mini-empty">No active rules configured</div>`;
        } else {
            listContainer.innerHTML = activeRules
                .slice(0, 5) // Display first 5 rules
                .map((r) => `
                    <div class="mini-rule-card">
                        <div class="mini-rule-header">
                            <span class="mini-rule-name">${escapeHtml(r.name || "Rule")}</span>
                        </div>
                        <span class="mini-rule-path">📁 ${escapeHtml(r.downloadPath)}</span>
                    </div>
                `)
                .join("");
        }
    } catch (err) {
        console.error("Popup load failed:", err);
    }
}

async function detectCurrentTabDomain() {
    try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0] && tabs[0].url) {
                const url = new URL(tabs[0].url);
                if (url.hostname) {
                    detectedDomain = url.hostname;
                    document.getElementById("current-tab-domain").textContent = detectedDomain;
                    return;
                }
            }
        }
    } catch {
        // Tab access not available or non-web page (e.g. chrome://)
    }

    document.getElementById("current-tab-domain").textContent = "Non-web page tab";
    document.getElementById("btn-quick-add").style.display = "none";
}

function setupListeners() {
    document.getElementById("popup-toggle").addEventListener("change", async (e) => {
        const isEnabled = e.target.checked;
        const data = await getStorageData();
        const settings = { ...(data.settings || DEFAULT_SETTINGS), extensionEnabled: isEnabled };
        await setStorageData({ settings });
        await loadPopupData();
    });

    document.getElementById("btn-open-options").addEventListener("click", () => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open("options.html");
        }
    });

    document.getElementById("btn-quick-add").addEventListener("click", () => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open("options.html");
        }
    });
}

function escapeHtml(str) {
    if (!str) return "";
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };
    return String(str).replace(/[&<>"']/g, (m) => map[m]);
}

initPopup();
