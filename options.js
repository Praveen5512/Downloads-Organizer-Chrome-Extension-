/**
 * Downloads Organizer - Options Page Controller
 */

import {
    getStorageData,
    setStorageData,
    DEFAULT_RULES,
    DEFAULT_SETTINGS,
    evaluateDownloadRules,
    interpolatePath,
    sanitizePath,
} from "./rules-engine.js";

// Application State
let state = {
    rules: [],
    settings: { ...DEFAULT_SETTINGS },
    searchQuery: "",
    editingRuleId: null,
};

// DOM Element References
const dom = {
    globalToggle: document.getElementById("global-toggle"),
    globalStatusPill: document.getElementById("global-status-pill"),
    globalStatusLabel: document.getElementById("global-status-label"),
    ruleSearchInput: document.getElementById("rule-search-input"),
    ruleCountTag: document.getElementById("rule-count-tag"),
    rulesContainer: document.getElementById("rules-list-container"),
    rulesLoading: document.getElementById("rules-loading"),
    emptyState: document.getElementById("empty-state"),
    btnEmptyAdd: document.getElementById("btn-empty-add"),
    btnRestoreDefaults: document.getElementById("btn-restore-defaults"),
    btnAddRule: document.getElementById("btn-add-rule"),
    btnOpenTester: document.getElementById("btn-open-tester"),
    btnOpenBackup: document.getElementById("btn-open-backup"),
    
    // Rule Modal
    ruleModalBackdrop: document.getElementById("rule-modal-backdrop"),
    ruleModal: document.getElementById("rule-modal"),
    modalTitleText: document.getElementById("modal-title-text"),
    btnCloseModal: document.getElementById("btn-close-modal"),
    btnCancelModal: document.getElementById("btn-cancel-modal"),
    ruleForm: document.getElementById("rule-form"),
    ruleIdInput: document.getElementById("rule-id-input"),
    ruleNameInput: document.getElementById("rule-name-input"),
    ruleDomainInput: document.getElementById("rule-domain-input"),
    ruleFiletypeInput: document.getElementById("rule-filetype-input"),
    ruleRegexInput: document.getElementById("rule-regex-input"),
    regexStatusBadge: document.getElementById("regex-status-badge"),
    rulePathInput: document.getElementById("rule-path-input"),
    ruleEnabledInput: document.getElementById("rule-enabled-input"),
    livePathPreview: document.getElementById("live-path-preview"),
    previewSubpath: document.getElementById("preview-subpath"),
    
    // Tester Modal
    testerModalBackdrop: document.getElementById("tester-modal-backdrop"),
    btnCloseTester: document.getElementById("btn-close-tester"),
    btnCloseTesterBtn: document.getElementById("btn-close-tester-btn"),
    testerUrl: document.getElementById("tester-url"),
    testerFilename: document.getElementById("tester-filename"),
    testResRule: document.getElementById("test-res-rule"),
    testResHostname: document.getElementById("test-res-hostname"),
    testResExt: document.getElementById("test-res-ext"),
    testResPath: document.getElementById("test-res-path"),
    
    // Backup Modal
    backupModalBackdrop: document.getElementById("backup-modal-backdrop"),
    btnCloseBackup: document.getElementById("btn-close-backup"),
    backupJsonArea: document.getElementById("backup-json-area"),
    btnCopyBackup: document.getElementById("btn-copy-backup"),
    btnDownloadBackup: document.getElementById("btn-download-backup"),
    btnApplyImport: document.getElementById("btn-apply-import"),

    // Toast Container
    toastContainer: document.getElementById("toast-container"),
};

/**
 * Initializes the Options UI
 */
async function init() {
    setupEventListeners();
    await loadState();
}

/**
 * Loads rules and settings from storage and updates the UI
 */
async function loadState() {
    try {
        const data = await getStorageData();
        state.rules = Array.isArray(data.rules) ? data.rules : [...DEFAULT_RULES];
        state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
        
        updateGlobalStatusUI();
        renderRules();
    } catch (err) {
        console.error("Failed to load options state:", err);
        showToast("Failed to load settings", "error");
    } finally {
        if (dom.rulesLoading) {
            dom.rulesLoading.classList.add("hidden");
        }
    }
}

/**
 * Persists current state back to storage
 */
async function persistState(message) {
    try {
        await setStorageData({
            rules: state.rules,
            settings: state.settings,
        });
        if (message) {
            showToast(message, "success");
        }
    } catch (err) {
        console.error("Failed to save state:", err);
        showToast("Error saving changes", "error");
    }
}

/**
 * Updates the Global Status header display
 */
function updateGlobalStatusUI() {
    const isEnabled = state.settings.extensionEnabled !== false;
    dom.globalToggle.checked = isEnabled;
    dom.globalStatusLabel.textContent = isEnabled ? "Active" : "Paused";
    
    if (isEnabled) {
        dom.globalStatusPill.classList.remove("disabled");
    } else {
        dom.globalStatusPill.classList.add("disabled");
    }
}

/**
 * Renders the rules list
 */
function renderRules() {
    const query = state.searchQuery.toLowerCase().trim();
    const filtered = state.rules.filter((rule) => {
        if (!query) return true;
        const name = (rule.name || "").toLowerCase();
        const domain = (rule.domain || "").toLowerCase();
        const type = (rule.fileType || "").toLowerCase();
        const regex = (rule.filenameRegex || "").toLowerCase();
        const path = (rule.downloadPath || "").toLowerCase();
        return name.includes(query) || domain.includes(query) || type.includes(query) || regex.includes(query) || path.includes(query);
    });

    dom.ruleCountTag.innerHTML = `<strong>${state.rules.length}</strong> Rules`;

    if (state.rules.length === 0) {
        dom.rulesContainer.innerHTML = "";
        dom.emptyState.classList.remove("hidden");
        return;
    }

    dom.emptyState.classList.add("hidden");

    if (filtered.length === 0) {
        dom.rulesContainer.innerHTML = `
            <div class="empty-state" style="padding: 40px 16px;">
                <p>No rules match your search "${escapeHtml(state.searchQuery)}".</p>
            </div>
        `;
        return;
    }

    const html = filtered.map((rule) => {
        const originalIndex = state.rules.findIndex((r) => r.id === rule.id);
        const isFirst = originalIndex === 0;
        const isLast = originalIndex === state.rules.length - 1;
        const isEnabled = rule.enabled !== false;

        return `
            <div class="rule-card ${isEnabled ? "" : "disabled"}" data-id="${rule.id}">
                <div class="rule-left">
                    <div class="priority-controls">
                        <button type="button" class="btn-priority btn-move-up" data-id="${rule.id}" ${isFirst ? "disabled" : ""} title="Increase Priority (Move Up)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <polyline points="18 15 12 9 6 15"/>
                            </svg>
                        </button>
                        <span class="rule-order-badge">#${originalIndex + 1}</span>
                        <button type="button" class="btn-priority btn-move-down" data-id="${rule.id}" ${isLast ? "disabled" : ""} title="Decrease Priority (Move Down)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </button>
                    </div>

                    <div class="rule-content">
                        <div class="rule-title-row">
                            <span class="rule-name">${escapeHtml(rule.name || "Untitled Rule")}</span>
                        </div>

                        <div class="rule-criteria-row">
                            ${rule.domain ? `
                                <span class="criterion-badge domain" title="Domain filter">
                                    🌐 ${escapeHtml(rule.domain)}
                                </span>
                            ` : `
                                <span class="criterion-badge" title="Applies to any domain">
                                    🌐 Any Domain
                                </span>
                            `}

                            ${rule.fileType ? `
                                <span class="criterion-badge type" title="File type filter">
                                    📄 ${escapeHtml(rule.fileType)}
                                </span>
                            ` : `
                                <span class="criterion-badge" title="Applies to any file type">
                                    📄 Any Type
                                </span>
                            `}

                            ${rule.filenameRegex ? `
                                <span class="criterion-badge regex" title="Filename regex">
                                    🔍 /${escapeHtml(rule.filenameRegex)}/i
                                </span>
                            ` : `
                                <span class="criterion-badge" title="Applies to any filename">
                                    🔍 Any Name
                                </span>
                            `}
                        </div>

                        <div class="rule-destination">
                            <span class="dest-label">Target:</span>
                            <span class="dest-path" title="${escapeHtml(rule.downloadPath)}">📁 ${escapeHtml(rule.downloadPath)}</span>
                        </div>
                    </div>
                </div>

                <div class="rule-right">
                    <label class="switch-toggle" title="${isEnabled ? 'Disable rule' : 'Enable rule'}">
                        <input type="checkbox" class="rule-toggle-check" data-id="${rule.id}" ${isEnabled ? "checked" : ""}>
                        <span class="slider"></span>
                    </label>

                    <div class="rule-actions">
                        <button type="button" class="btn-icon btn-edit-rule" data-id="${rule.id}" title="Edit Rule">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                            </svg>
                        </button>
                        <button type="button" class="btn-icon btn-duplicate-rule" data-id="${rule.id}" title="Duplicate Rule">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                        <button type="button" class="btn-icon btn-delete btn-delete-rule" data-id="${rule.id}" title="Delete Rule">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    dom.rulesContainer.innerHTML = html;
}

/**
 * Opens Rule Modal for Creating or Editing
 */
function openRuleModal(ruleId = null) {
    state.editingRuleId = ruleId;

    if (ruleId) {
        const rule = state.rules.find((r) => r.id === ruleId);
        if (!rule) return;
        dom.modalTitleText.textContent = "Edit Rule";
        dom.ruleIdInput.value = rule.id;
        dom.ruleNameInput.value = rule.name || "";
        dom.ruleDomainInput.value = rule.domain || "";
        dom.ruleFiletypeInput.value = rule.fileType || "";
        dom.ruleRegexInput.value = rule.filenameRegex || "";
        dom.rulePathInput.value = rule.downloadPath || "";
        dom.ruleEnabledInput.checked = rule.enabled !== false;
    } else {
        dom.modalTitleText.textContent = "Add New Rule";
        dom.ruleIdInput.value = "";
        dom.ruleNameInput.value = "";
        dom.ruleDomainInput.value = "";
        dom.ruleFiletypeInput.value = "";
        dom.ruleRegexInput.value = "";
        dom.rulePathInput.value = "";
        dom.ruleEnabledInput.checked = true;
    }

    validateRegexLive();
    updateLivePathPreview();
    dom.ruleModalBackdrop.classList.remove("hidden");
    dom.ruleNameInput.focus();
}

function closeRuleModal() {
    dom.ruleModalBackdrop.classList.add("hidden");
    state.editingRuleId = null;
}

/**
 * Handles saving rule form
 */
async function handleRuleFormSubmit(e) {
    e.preventDefault();

    const path = dom.rulePathInput.value.trim();
    if (!path) {
        dom.rulePathInput.focus();
        showToast("Download Path is required", "error");
        return;
    }

    // Validate regex if entered
    const regexVal = dom.ruleRegexInput.value.trim();
    if (regexVal) {
        try {
            new RegExp(regexVal, "i");
        } catch (err) {
            dom.ruleRegexInput.focus();
            showToast(`Invalid Regex: ${err.message}`, "error");
            return;
        }
    }

    const ruleData = {
        id: dom.ruleIdInput.value || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: dom.ruleNameInput.value.trim() || "Untitled Rule",
        domain: dom.ruleDomainInput.value.trim(),
        fileType: dom.ruleFiletypeInput.value.trim(),
        filenameRegex: regexVal,
        downloadPath: path,
        enabled: dom.ruleEnabledInput.checked,
    };

    if (state.editingRuleId) {
        const index = state.rules.findIndex((r) => r.id === state.editingRuleId);
        if (index !== -1) {
            state.rules[index] = ruleData;
        }
    } else {
        state.rules.unshift(ruleData); // Add new rule at top priority
    }

    closeRuleModal();
    renderRules();
    await persistState(state.editingRuleId ? "Rule updated" : "Rule created");
}

/**
 * Live regex validation indicator
 */
function validateRegexLive() {
    const val = dom.ruleRegexInput.value.trim();
    if (!val) {
        dom.regexStatusBadge.classList.add("hidden");
        return;
    }

    dom.regexStatusBadge.classList.remove("hidden");
    try {
        new RegExp(val, "i");
        dom.regexStatusBadge.textContent = "Valid Regex";
        dom.regexStatusBadge.className = "regex-status-badge valid";
    } catch {
        dom.regexStatusBadge.textContent = "Invalid Syntax";
        dom.regexStatusBadge.className = "regex-status-badge invalid";
    }
}

/**
 * Live path preview updater
 */
function updateLivePathPreview() {
    const rawTemplate = dom.rulePathInput.value.trim();
    const sampleContext = {
        hostname: dom.ruleDomainInput.value.trim() || "github.com",
        ext: "pdf",
        basename: "example_document",
        filename: "example_document.pdf",
    };

    if (!rawTemplate) {
        dom.previewSubpath.textContent = "(No subfolder)";
        return;
    }

    const interpolated = interpolatePath(rawTemplate, sampleContext);
    const cleaned = sanitizePath(interpolated);
    dom.previewSubpath.textContent = cleaned || "(Root Downloads)";
}

/**
 * Move rule priority up or down
 */
async function moveRule(ruleId, direction) {
    const index = state.rules.findIndex((r) => r.id === ruleId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= state.rules.length) return;

    // Swap elements
    const [moved] = state.rules.splice(index, 1);
    state.rules.splice(targetIndex, 0, moved);

    renderRules();
    await persistState("Priority updated");
}

/**
 * Duplicate a rule
 */
async function duplicateRule(ruleId) {
    const original = state.rules.find((r) => r.id === ruleId);
    if (!original) return;

    const copy = {
        ...original,
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: `${original.name || "Rule"} (Copy)`,
    };

    const originalIndex = state.rules.findIndex((r) => r.id === ruleId);
    state.rules.splice(originalIndex + 1, 0, copy);

    renderRules();
    await persistState("Rule duplicated");
}

/**
 * Delete a rule
 */
async function deleteRule(ruleId) {
    const rule = state.rules.find((r) => r.id === ruleId);
    const ruleName = rule ? rule.name : "Rule";

    if (!confirm(`Are you sure you want to delete "${ruleName}"?`)) {
        return;
    }

    state.rules = state.rules.filter((r) => r.id !== ruleId);
    renderRules();
    await persistState("Rule deleted");
}

/**
 * Toggle single rule enabled state
 */
async function toggleRule(ruleId, isEnabled) {
    const rule = state.rules.find((r) => r.id === ruleId);
    if (rule) {
        rule.enabled = isEnabled;
        renderRules();
        await persistState(isEnabled ? "Rule enabled" : "Rule disabled");
    }
}

/**
 * Rule Tester / Sandbox Evaluation
 */
function runTesterEvaluation() {
    const url = dom.testerUrl.value.trim();
    const filename = dom.testerFilename.value.trim() || "download.file";

    const item = {
        filename,
        url,
        finalUrl: url,
        referrer: url,
    };

    const result = evaluateDownloadRules(state.rules, item, state.settings);

    if (result.matchedRule) {
        dom.testResRule.textContent = result.matchedRule.name || "Untitled Rule";
        dom.testResRule.className = "result-val highlight-val";
    } else {
        dom.testResRule.textContent = "None (Saved to default Downloads folder)";
        dom.testResRule.className = "result-val";
    }

    dom.testResHostname.textContent = result.hostname || "(None / direct)";
    dom.testResExt.textContent = result.ext ? `.${result.ext}` : "(None)";
    dom.testResPath.textContent = `Downloads / ${result.targetFilename}`;
}

/**
 * Setup All Event Listeners
 */
function setupEventListeners() {
    // Global Extension Toggle
    dom.globalToggle.addEventListener("change", async (e) => {
        state.settings.extensionEnabled = e.target.checked;
        updateGlobalStatusUI();
        await persistState(e.target.checked ? "Downloads Organizer activated" : "Downloads Organizer paused");
    });

    // Rule Search
    dom.ruleSearchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        renderRules();
    });

    // Add Rule Buttons
    dom.btnAddRule.addEventListener("click", () => openRuleModal(null));
    dom.btnEmptyAdd.addEventListener("click", () => openRuleModal(null));

    // Restore Default Presets
    dom.btnRestoreDefaults.addEventListener("click", async () => {
        if (confirm("Restore standard example rules? This will append the recommended default rules.")) {
            state.rules = [...DEFAULT_RULES];
            renderRules();
            await persistState("Default rules restored");
        }
    });

    // Rules List Delegation (Move, Edit, Delete, Toggle, Duplicate)
    dom.rulesContainer.addEventListener("click", (e) => {
        const moveUpBtn = e.target.closest(".btn-move-up");
        if (moveUpBtn) {
            moveRule(moveUpBtn.dataset.id, "up");
            return;
        }

        const moveDownBtn = e.target.closest(".btn-move-down");
        if (moveDownBtn) {
            moveRule(moveDownBtn.dataset.id, "down");
            return;
        }

        const editBtn = e.target.closest(".btn-edit-rule");
        if (editBtn) {
            openRuleModal(editBtn.dataset.id);
            return;
        }

        const dupBtn = e.target.closest(".btn-duplicate-rule");
        if (dupBtn) {
            duplicateRule(dupBtn.dataset.id);
            return;
        }

        const delBtn = e.target.closest(".btn-delete-rule");
        if (delBtn) {
            deleteRule(delBtn.dataset.id);
            return;
        }
    });

    dom.rulesContainer.addEventListener("change", (e) => {
        const toggleCheck = e.target.closest(".rule-toggle-check");
        if (toggleCheck) {
            toggleRule(toggleCheck.dataset.id, toggleCheck.checked);
        }
    });

    // Modal Events
    dom.btnCloseModal.addEventListener("click", closeRuleModal);
    dom.btnCancelModal.addEventListener("click", closeRuleModal);
    dom.ruleModalBackdrop.addEventListener("click", (e) => {
        if (e.target === dom.ruleModalBackdrop) closeRuleModal();
    });

    // Modal Form Inputs
    dom.ruleForm.addEventListener("submit", handleRuleFormSubmit);
    dom.ruleRegexInput.addEventListener("input", validateRegexLive);
    dom.rulePathInput.addEventListener("input", updateLivePathPreview);
    dom.ruleDomainInput.addEventListener("input", updateLivePathPreview);

    // Preset Chips in Modal
    document.querySelectorAll(".chip-preset[data-preset]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const current = dom.ruleFiletypeInput.value.trim();
            const preset = btn.dataset.preset;
            if (current) {
                dom.ruleFiletypeInput.value = `${current}, ${preset}`;
            } else {
                dom.ruleFiletypeInput.value = preset;
            }
        });
    });

    // Dynamic Token Chips in Modal
    document.querySelectorAll(".token-chip[data-token]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const token = btn.dataset.token;
            const input = dom.rulePathInput;
            const start = input.selectionStart || input.value.length;
            const end = input.selectionEnd || input.value.length;
            const text = input.value;
            input.value = text.substring(0, start) + token + text.substring(end);
            input.selectionStart = input.selectionEnd = start + token.length;
            input.focus();
            updateLivePathPreview();
        });
    });

    // Tester Modal
    dom.btnOpenTester.addEventListener("click", () => {
        dom.testerModalBackdrop.classList.remove("hidden");
        runTesterEvaluation();
    });
    dom.btnCloseTester.addEventListener("click", () => dom.testerModalBackdrop.classList.add("hidden"));
    dom.btnCloseTesterBtn.addEventListener("click", () => dom.testerModalBackdrop.classList.add("hidden"));
    dom.testerModalBackdrop.addEventListener("click", (e) => {
        if (e.target === dom.testerModalBackdrop) dom.testerModalBackdrop.classList.add("hidden");
    });
    dom.testerUrl.addEventListener("input", runTesterEvaluation);
    dom.testerFilename.addEventListener("input", runTesterEvaluation);

    // Tester Scenario Shortcuts
    document.getElementById("test-preset-invoice")?.addEventListener("click", () => {
        dom.testerUrl.value = "https://billing.example.com/download";
        dom.testerFilename.value = "invoice_2026_march.pdf";
        runTesterEvaluation();
    });
    document.getElementById("test-preset-github")?.addEventListener("click", () => {
        dom.testerUrl.value = "https://github.com/facebook/react/archive/main.zip";
        dom.testerFilename.value = "react-main.zip";
        runTesterEvaluation();
    });
    document.getElementById("test-preset-photo")?.addEventListener("click", () => {
        dom.testerUrl.value = "https://images.unsplash.com/photo-nature.jpg";
        dom.testerFilename.value = "wallpaper-nature.jpg";
        runTesterEvaluation();
    });
    document.getElementById("test-preset-unknown")?.addEventListener("click", () => {
        dom.testerUrl.value = "https://cdn.example.org/installer";
        dom.testerFilename.value = "setup.exe";
        runTesterEvaluation();
    });

    // Backup & Restore Modal
    dom.btnOpenBackup.addEventListener("click", () => {
        dom.backupJsonArea.value = JSON.stringify({ rules: state.rules, settings: state.settings }, null, 2);
        dom.backupModalBackdrop.classList.remove("hidden");
    });
    dom.btnCloseBackup.addEventListener("click", () => dom.backupModalBackdrop.classList.add("hidden"));
    dom.backupModalBackdrop.addEventListener("click", (e) => {
        if (e.target === dom.backupModalBackdrop) dom.backupModalBackdrop.classList.add("hidden");
    });

    dom.btnCopyBackup.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(dom.backupJsonArea.value);
            showToast("Configuration copied to clipboard", "success");
        } catch {
            showToast("Failed to copy to clipboard", "error");
        }
    });

    dom.btnDownloadBackup.addEventListener("click", () => {
        try {
            const blob = new Blob([dom.backupJsonArea.value], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `downloads-organizer-rules-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast("Configuration file downloaded", "success");
        } catch (err) {
            showToast("Failed to download JSON", "error");
        }
    });

    dom.btnApplyImport.addEventListener("click", async () => {
        try {
            const parsed = JSON.parse(dom.backupJsonArea.value);
            if (!Array.isArray(parsed.rules)) {
                throw new Error("Invalid structure: 'rules' array is required");
            }
            state.rules = parsed.rules;
            if (parsed.settings) {
                state.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
            }
            renderRules();
            updateGlobalStatusUI();
            dom.backupModalBackdrop.classList.add("hidden");
            await persistState("Rules successfully imported");
        } catch (err) {
            showToast(`Import error: ${err.message}`, "error");
        }
    });
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        toast.style.transition = "all 0.2s ease";
        setTimeout(() => toast.remove(), 250);
    }, 2800);
}

/**
 * Escape HTML to prevent injection
 */
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

// Boot UI
init();
