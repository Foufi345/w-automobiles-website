#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const MESSAGES_DIR = path.join(ROOT, "messages");
const LOCALES = ["fr", "en", "ar"];
const REQUIRED_NAMESPACES = [
  "common",
  "nav",
  "home",
  "catalogue",
  "car",
  "showroom",
  "contact",
  "location",
  "footer",
  "seo",
  "whatsapp",
  "errors",
  "enums",
  "admin",
];

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Extracts top-level ICU placeholder variable names from an ICU message string.
 * Handles simple `{var}` and plural/select `{count, plural, one {...} other {...}}`.
 */
function extractPlaceholders(str) {
  if (typeof str !== "string") return [];
  const vars = new Set();
  // Match {varName} or {varName, plural|select|number|date|time, ...}
  const regex = /\{([a-zA-Z0-9_]+)(?:\s*,|\s*\})/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const name = match[1];
    // Ignore ICU plural keywords that are not placeholders
    if (!["zero", "one", "two", "few", "many", "other"].includes(name)) {
      vars.add(name);
    }
  }
  return Array.from(vars).sort();
}

const data = {};
for (const locale of LOCALES) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`[FAIL] Missing translation file: ${filePath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const ns of REQUIRED_NAMESPACES) {
    if (!raw[ns] || typeof raw[ns] !== "object") {
      console.error(`[FAIL] ${locale}.json is missing required namespace "${ns}"`);
      process.exit(1);
    }
  }
  data[locale] = flatten(raw);
}

const frKeys = Object.keys(data.fr).sort();
let errors = 0;

for (const key of frKeys) {
  const frVal = data.fr[key];
  if (typeof frVal !== "string" || frVal.trim() === "") {
    console.error(`[FAIL] fr.json has empty value for key: ${key}`);
    errors += 1;
    continue;
  }
  const frVars = extractPlaceholders(frVal);

  for (const locale of ["en", "ar"]) {
    if (!(key in data[locale])) {
      console.error(`[FAIL] ${locale}.json missing key: ${key}`);
      errors += 1;
      continue;
    }
    const val = data[locale][key];
    if (typeof val !== "string" || val.trim() === "") {
      console.error(`[FAIL] ${locale}.json has empty value for key: ${key}`);
      errors += 1;
      continue;
    }
    const vars = extractPlaceholders(val);
    if (JSON.stringify(frVars) !== JSON.stringify(vars)) {
      console.error(
        `[FAIL] Placeholder mismatch for "${key}" in ${locale}.json: expected ${JSON.stringify(frVars)}, got ${JSON.stringify(vars)}`
      );
      errors += 1;
    }
  }
}

for (const locale of ["en", "ar"]) {
  for (const key of Object.keys(data[locale])) {
    if (!(key in data.fr)) {
      console.error(`[FAIL] ${locale}.json has extra key not in fr.json: ${key}`);
      errors += 1;
    }
  }
}

// Basic scan for leftover hardcoded French JSX text in app/[locale] and public components
const SCAN_DIRS = [
  path.join(ROOT, "app", "[locale]"),
  path.join(ROOT, "components"),
];
const IGNORE_SEGMENTS = [
  `${path.sep}admin${path.sep}`,
  `${path.sep}dev${path.sep}`,
  `${path.sep}webgl${path.sep}`,
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (IGNORE_SEGMENTS.some((seg) => full.includes(seg))) continue;
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|jsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const HARDCODED_WARNING_PATTERNS = [
  />\s*[A-ZÀ-ÿ][a-zà-ÿ]{3,}\s+[a-zà-ÿ]{2,}/,
];
let hardcodedWarnings = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*") ||
        trimmed.includes("W Automobiles") ||
        trimmed.includes("W AUTOMOBILES") ||
        trimmed.includes("WhatsApp") ||
        trimmed.includes("Cheraga") ||
        trimmed.includes("t(")
      ) {
        return;
      }
      if (HARDCODED_WARNING_PATTERNS.some((re) => re.test(trimmed))) {
        console.warn(`[WARN] Possible hardcoded JSX text in ${rel}:${idx + 1}: ${trimmed.slice(0, 80)}`);
        hardcodedWarnings += 1;
      }
    });
  }
}

if (errors > 0) {
  console.error(`\ni18n:check FAILED with ${errors} error(s).`);
  process.exit(1);
}

console.log(
  `[PASS] i18n:check — ${frKeys.length} keys verified across fr/en/ar (0 missing, 0 empty, 0 placeholder mismatches, ${hardcodedWarnings} hardcoded scan warnings).`
);
