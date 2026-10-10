/**
 * Rules Engine for Downloads Organizer
 * Handles URL parsing, rule matching, placeholder interpolation, and path sanitization.
 */

export const DEFAULT_RULES = [
    {
        id: "rule_invoices",
        name: "Invoices & Receipts",
        enabled: true,
        domain: "",
        filenameOp: "regex",
        filenameValue: "(invoice|receipt|statement|bill|tax)",
        filenameRegex: "(invoice|receipt|statement|bill|tax)",
        fileType: "pdf",
        downloadPath: "Invoices/{year}",
    },
    {
        id: "rule_images",
        name: "Images & Media",
        enabled: false,
        domain: "",
        filenameOp: "contains",
        filenameValue: "",
        filenameRegex: "",
        fileType: "jpg, jpeg, png, gif, webp, svg, avif",
        downloadPath: "Images/{hostname}",
    },
    {
        id: "rule_documents",
        name: "Office Documents",
        enabled: false,
        domain: "",
        filenameOp: "contains",
        filenameValue: "",
        filenameRegex: "",
        fileType: "pdf, doc, docx, xls, xlsx, ppt, pptx, csv",
        downloadPath: "Documents/{ext}/{year}",
    },
    {
        id: "rule_github",
        name: "GitHub Archives",
        enabled: false,
        domain: "github.com",
        filenameOp: "contains",
        filenameValue: "",
        filenameRegex: "",
        fileType: "zip, tar, gz",
        downloadPath: "Code/GitHub",
    },
];

export const DEFAULT_SETTINGS = {
    extensionEnabled: true,
    conflictAction: "uniquify", // "uniquify" | "overwrite" | "prompt"
};

/**
 * Extracts a clean hostname from a download item.
 * Checks referrer first, then finalUrl (handling blob:), then url.
 * @param {{ referrer?: string, finalUrl?: string, url?: string }} item
 * @returns {string} Hostname or empty string
 */
export function extractHostname(item) {
    if (!item) return "";

    const candidates = [item.referrer, item.finalUrl, item.url];

    for (let rawUrl of candidates) {
        if (!rawUrl || typeof rawUrl !== "string") continue;
        rawUrl = rawUrl.trim();
        if (!rawUrl) continue;

        // Strip blob: prefix if present (e.g. blob:https://example.com/uuid)
        if (rawUrl.startsWith("blob:")) {
            rawUrl = rawUrl.replace(/^blob:/, "");
        }

        try {
            const parsed = new URL(rawUrl);
            if (parsed.hostname && parsed.hostname !== "") {
                return parsed.hostname.toLowerCase();
            }
        } catch {
            // Not a valid URL, check next candidate
        }
    }

    return "";
}

/**
 * Extracts file extension and base name from a filename.
 * @param {string} filename
 * @returns {{ ext: string, basename: string }}
 */
export function parseFilename(filename) {
    if (!filename) return { ext: "", basename: "" };

    // Strip leading path components if any
    const cleanName = filename.replace(/^[\\/]+/, "").split(/[\\/]/).pop() || filename;
    const lastDotIndex = cleanName.lastIndexOf(".");

    if (lastDotIndex > 0) {
        return {
            ext: cleanName.slice(lastDotIndex + 1).toLowerCase(),
            basename: cleanName.slice(0, lastDotIndex),
        };
    }

    return {
        ext: "",
        basename: cleanName,
    };
}

/**
 * Checks whether a filename matches a condition operator and string value or pattern.
 * Supported operators:
 * - "contains": filename contains the string (case-insensitive)
 * - "not_contains": filename does not contain the string (case-insensitive)
 * - "starts_with": filename starts with the string (case-insensitive)
 * - "ends_with": filename ends with the string (case-insensitive)
 * - "equals": filename exactly matches the string (case-insensitive)
 * - "regex": regular expression tested against the filename
 *
 * @param {string} filename Downloaded filename
 * @param {string} op Match operator
 * @param {string} value Search string or regex pattern
 * @returns {boolean}
 */
export function matchFilename(filename, op = "contains", value = "") {
    if (value === undefined || value === null) {
        return true;
    }

    const trimmedValue = String(value).trim();
    if (!trimmedValue) {
        return true; // Empty value matches any filename
    }

    const raw = filename || "";
    const cleanName = raw.replace(/^[\\/]+/, "").split(/[\\/]/).pop() || raw;
    const lowerClean = cleanName.toLowerCase();
    const lowerVal = trimmedValue.toLowerCase();

    switch (op) {
        case "not_contains": {
            return !lowerClean.includes(lowerVal);
        }
        case "starts_with": {
            return lowerClean.startsWith(lowerVal);
        }
        case "ends_with": {
            return lowerClean.endsWith(lowerVal);
        }
        case "equals": {
            return lowerClean === lowerVal;
        }
        case "regex": {
            try {
                let pattern = trimmedValue;
                let flags = "i";

                if (pattern.startsWith("(?i)")) {
                    pattern = pattern.slice(4);
                }

                const slashMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
                if (slashMatch) {
                    pattern = slashMatch[1];
                    flags = slashMatch[2] || "i";
                }

                const regex = new RegExp(pattern, flags);
                return regex.test(cleanName) || regex.test(raw);
            } catch {
                return false;
            }
        }
        case "contains":
        default: {
            return lowerClean.includes(lowerVal);
        }
    }
}

/**
 * Checks whether a download item matches a single rule.
 * @param {object} rule
 * @param {object} item { filename, referrer, finalUrl, url }
 * @param {string} [hostname] Precomputed hostname
 * @returns {boolean}
 */
export function matchRule(rule, item, hostname) {
    if (!rule || rule.enabled === false) {
        return false;
    }

    const itemHostname = (hostname !== undefined ? hostname : extractHostname(item)).toLowerCase();
    const { filename } = item;
    const { ext } = parseFilename(filename);

    // 1. Domain Check (Optional)
    if (rule.domain && rule.domain.trim()) {
        const cleanRuleDomain = rule.domain
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "");

        if (!itemHostname) {
            return false;
        }

        if (cleanRuleDomain.startsWith("*.")) {
            // Wildcard matching: *.domain.com matches sub.domain.com and domain.com
            const rootDomain = cleanRuleDomain.slice(2);
            if (itemHostname !== rootDomain && !itemHostname.endsWith("." + rootDomain)) {
                return false;
            }
        } else {
            // Matches exact domain or subdomains (e.g. "github.com" matches "gist.github.com")
            if (itemHostname !== cleanRuleDomain && !itemHostname.endsWith("." + cleanRuleDomain)) {
                return false;
            }
        }
    }

    // 2. Filename Condition Check (Optional)
    const filenameOp = rule.filenameOp || (rule.filenameRegex ? "regex" : "contains");
    const filenameVal = (rule.filenameValue !== undefined && rule.filenameValue !== null)
        ? rule.filenameValue
        : (rule.filenameRegex || "");

    if (filenameVal && String(filenameVal).trim()) {
        if (!matchFilename(filename, filenameOp, filenameVal)) {
            return false;
        }
    }

    // 3. File Type Check (Optional)
    if (rule.fileType && rule.fileType.trim()) {
        const allowedTypes = rule.fileType
            .split(/[,|\s]+/)
            .map((t) => t.replace(/^\./, "").toLowerCase().trim())
            .filter(Boolean);

        if (allowedTypes.length > 0 && (!ext || !allowedTypes.includes(ext))) {
            return false;
        }
    }

    // 4. Download Path is mandatory for a valid rule
    if (!rule.downloadPath || !rule.downloadPath.trim()) {
        return false;
    }

    return true;
}

/**
 * Replaces placeholders in the download path template with actual context values.
 * Supported placeholders:
 * - {hostname}
 * - {ext}
 * - {basename}
 * - {filename}
 * - {year}
 * - {month}
 * - {day}
 * - {date}
 * - {time}
 * @param {string} template
 * @param {object} context
 * @returns {string} Interpolated path string
 */
export function interpolatePath(template, context) {
    if (!template) return "";

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    const tokens = {
        hostname: context.hostname || "unknown",
        ext: context.ext || "unknown",
        basename: context.basename || "download",
        filename: context.filename || "download",
        year: String(now.getFullYear()),
        month: pad(now.getMonth() + 1),
        day: pad(now.getDate()),
        date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        time: `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`,
    };

    return template.replace(/\{(\w+)\}/g, (match, key) => {
        const lowerKey = key.toLowerCase();
        return tokens[lowerKey] !== undefined ? tokens[lowerKey] : match;
    });
}

/**
 * Sanitizes a directory path to conform to Chrome Download API rules and OS file system constraints.
 * Ensures forward slashes, prevents directory traversal (".."), and strips illegal characters.
 * @param {string} rawPath
 * @returns {string} Sanitized directory path (no leading or trailing slashes)
 */
export function sanitizePath(rawPath) {
    if (!rawPath) return "";

    // Normalize backslashes to forward slashes
    let path = rawPath.replace(/\\+/g, "/").trim();

    // Remove drive letters like C: or leading protocol
    path = path.replace(/^[a-zA-Z]:/, "");

    // Split segments and clean each one
    const segments = path
        .split("/")
        .map((segment) => {
            let s = segment.trim();
            // Prevent directory traversal
            if (s === "." || s === "..") return "";
            // Remove illegal Windows filename characters: < > : " / \ | ? *
            s = s.replace(/[<>:"|?*]/g, "_");
            // Remove leading/trailing dots and spaces from folder names (Windows requirement)
            s = s.replace(/^[. ]+|[. ]+$/g, "");
            return s;
        })
        .filter(Boolean);

    return segments.join("/");
}

/**
 * Evaluates all rules against a download item in order of priority.
 * Returns the matching rule and computed target filename.
 * If no rule matches, returns targetFilename equal to original item.filename.
 * @param {Array<object>} rules
 * @param {object} item { filename, referrer, finalUrl, url }
 * @param {object} [settings]
 * @returns {{ matchedRule: object|null, targetFilename: string, hostname: string, ext: string }}
 */
export function evaluateDownloadRules(rules, item, settings = DEFAULT_SETTINGS) {
    const originalFilename = (item && item.filename) ? item.filename.replace(/^[\\/]+/, "") : "download";
    const hostname = extractHostname(item);
    const { ext, basename } = parseFilename(originalFilename);

    if (settings && settings.extensionEnabled === false) {
        return {
            matchedRule: null,
            targetFilename: originalFilename,
            hostname,
            ext,
        };
    }

    if (Array.isArray(rules)) {
        for (const rule of rules) {
            if (matchRule(rule, item, hostname)) {
                const interpolated = interpolatePath(rule.downloadPath, {
                    hostname,
                    ext,
                    basename,
                    filename: originalFilename,
                });
                const cleanSubdir = sanitizePath(interpolated);

                const targetFilename = cleanSubdir ? `${cleanSubdir}/${originalFilename}` : originalFilename;

                return {
                    matchedRule: rule,
                    targetFilename,
                    hostname,
                    ext,
                };
            }
        }
    }

    // Fallback: Save directly to root Downloads folder (no subfolder)
    return {
        matchedRule: null,
        targetFilename: originalFilename,
        hostname,
        ext,
    };
}

/**
 * Storage helpers for Chrome storage sync/local.
 */
export async function getStorageData() {
    return new Promise((resolve) => {
        const storageArea = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync)
            ? chrome.storage.sync
            : (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local ? chrome.storage.local : null);

        if (!storageArea) {
            resolve({ rules: DEFAULT_RULES, settings: DEFAULT_SETTINGS });
            return;
        }

        storageArea.get(["rules", "settings"], (res) => {
            if (chrome.runtime.lastError) {
                console.warn("Storage get warning:", chrome.runtime.lastError);
            }
            resolve({
                rules: Array.isArray(res?.rules) ? res.rules : DEFAULT_RULES,
                settings: res?.settings ? { ...DEFAULT_SETTINGS, ...res.settings } : DEFAULT_SETTINGS,
            });
        });
    });
}

export async function setStorageData(data) {
    return new Promise((resolve, reject) => {
        const storageArea = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync)
            ? chrome.storage.sync
            : (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local ? chrome.storage.local : null);

        if (!storageArea) {
            resolve();
            return;
        }

        storageArea.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}
