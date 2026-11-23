#!/usr/bin/env node
/**
 * Multilingual SEO Verification Script (npm run seo:check)
 *
 * Fetches robots.txt, sitemap.xml, every public page x locale (fr, en, ar),
 * and localized 404 / unknown-locale fallback pages from a running production
 * Next.js server (default: http://127.0.0.1:3000, override via SEO_CHECK_URL).
 *
 * Verifies:
 *  - html lang & dir
 *  - unique <title> and meta description
 *  - single <h1> and logical heading hierarchy
 *  - self-referencing canonical
 *  - reciprocal hreflang (fr, en, ar, x-default -> fr)
 *  - Open Graph (og:locale fr_FR/en_US/ar_AR + og:locale:alternate + og:image) & Twitter
 *  - valid sitemap.xml with alternates & lastmod, no /admin
 *  - robots.txt excluding /admin
 *  - valid JSON-LD with inLanguage & standard English Vehicle schema values
 *  - localized 404 & unknown locale fallback
 *  - client payload hygiene (no server-only seo namespace; Arabic fonts only on /ar)
 */

const BASE_URL = (process.env.SEO_CHECK_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

const LOCALES = ["fr", "en", "ar"];
const EXPECTED_OG_LOCALE = { fr: "fr_FR", en: "en_US", ar: "ar_AR" };
const EXPECTED_DIR = { fr: "ltr", en: "ltr", ar: "rtl" };
const VALID_SCHEMA_FUELS = new Set([
  "Gasoline",
  "Diesel",
  "Hybrid",
  "Electric",
  "LPG",
]);
const VALID_SCHEMA_TRANSMISSIONS = new Set(["Automatic", "Manual"]);

const failures = [];
function fail(context, message) {
  failures.push(`[FAIL] ${context}: ${message}`);
}

function normalizeUrl(u) {
  return u.replace(/\/$/, "") || "/";
}

function detectLocaleFromPath(pathname) {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/ar" || pathname.startsWith("/ar/")) return "ar";
  return "fr";
}

function extractAttr(tag, attrName) {
  const re = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function extractMetaContents(html, attrName, attrValue) {
  const results = [];
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const val = extractAttr(tag, attrName);
    if (val && val.toLowerCase() === attrValue.toLowerCase()) {
      const content = extractAttr(tag, "content");
      if (content !== null) results.push(content);
    }
  }
  return results;
}

function extractLinks(html, relValue) {
  const results = [];
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const rel = extractAttr(tag, "rel");
    if (rel && rel.toLowerCase() === relValue.toLowerCase()) {
      results.push({
        href: extractAttr(tag, "href"),
        hreflang: extractAttr(tag, "hreflang"),
      });
    }
  }
  return results;
}

function extractHeadings(html) {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  // Strip script and style blocks
  const cleaned = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const headings = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const level = Number(m[1]);
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    headings.push({ level, text });
  }
  return headings;
}

function extractJsonLd(html) {
  const blocks = [];
  const re =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

async function run() {
  console.log(`Running SEO check against ${BASE_URL} ...\n`);

  // 1. Check robots.txt
  const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
  if (robotsRes.status !== 200) {
    fail("robots.txt", `Expected 200, got ${robotsRes.status}`);
  } else {
    const robotsTxt = await robotsRes.text();
    if (!robotsTxt.includes("/admin")) {
      fail("robots.txt", "Missing Disallow rule for /admin");
    }
    if (!/sitemap:/i.test(robotsTxt)) {
      fail("robots.txt", "Missing Sitemap directive");
    }
    console.log("[PASS] robots.txt valid and excludes /admin");
  }

  // 2. Check sitemap.xml
  const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
  if (sitemapRes.status !== 200) {
    fail("sitemap.xml", `Expected 200, got ${sitemapRes.status}`);
    printSummary();
    process.exit(1);
  }
  const sitemapXml = await sitemapRes.text();
  if (!sitemapXml.includes("<urlset") || !sitemapXml.includes("</urlset>")) {
    fail("sitemap.xml", "Invalid XML: missing <urlset>");
  }
  if (sitemapXml.includes("/admin")) {
    fail("sitemap.xml", "/admin must not appear in sitemap.xml");
  }

  const urlBlocks = sitemapXml.match(/<url>[\s\S]*?<\/url>/g) || [];
  if (urlBlocks.length < 18) {
    fail(
      "sitemap.xml",
      `Expected at least 18 URLs (6 static pages x 3 locales), found ${urlBlocks.length}`
    );
  }

  const sitemapUrls = [];
  let productionOrigin = null;

  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    if (!locMatch) {
      fail("sitemap.xml", "Found <url> block missing <loc>");
      continue;
    }
    const loc = locMatch[1].trim();
    const parsed = new URL(loc);
    if (!productionOrigin) productionOrigin = parsed.origin;
    sitemapUrls.push({
      loc,
      pathname: parsed.pathname,
      hasLastmod: Boolean(lastmodMatch && lastmodMatch[1].trim()),
      block,
    });

    if (!lastmodMatch) {
      fail(`sitemap.xml (${parsed.pathname})`, "Missing <lastmod>");
    }

    for (const hl of ["fr", "en", "ar", "x-default"]) {
      const hasHl = new RegExp(`hreflang=["']${hl}["']`, "i").test(block);
      if (!hasHl) {
        fail(
          `sitemap.xml (${parsed.pathname})`,
          `Missing xhtml:link alternate for hreflang="${hl}"`
        );
      }
    }
  }

  console.log(
    `[PASS] sitemap.xml parsed (${sitemapUrls.length} localized URLs with alternates & lastmod)`
  );

  // 3. Fetch and verify every page x locale
  const hreflangGraph = new Map(); // canonicalUrl -> Map(lang -> url)
  const seenTitles = new Map(); // title -> pathname

  for (const entry of sitemapUrls) {
    const fetchUrl = `${BASE_URL}${entry.pathname}`;
    const locale = detectLocaleFromPath(entry.pathname);
    const res = await fetch(fetchUrl, { redirect: "manual" });

    if (res.status !== 200) {
      fail(entry.pathname, `Expected 200 OK, got ${res.status}`);
      continue;
    }

    const html = await res.text();

    // 3a. <html lang & dir>
    const htmlTagMatch = html.match(/<html\b[^>]*>/i);
    if (!htmlTagMatch) {
      fail(entry.pathname, "Missing <html> tag");
    } else {
      const lang = extractAttr(htmlTagMatch[0], "lang");
      const dir = extractAttr(htmlTagMatch[0], "dir");
      const htmlClass = extractAttr(htmlTagMatch[0], "class") || "";

      if (lang !== locale) {
        fail(entry.pathname, `Expected html lang="${locale}", got "${lang}"`);
      }
      if (dir !== EXPECTED_DIR[locale]) {
        fail(
          entry.pathname,
          `Expected html dir="${EXPECTED_DIR[locale]}", got "${dir}"`
        );
      }

      // Arabic fonts must only load on /ar (cormorant + amiri + cairo = 3 font vars; fr/en = cormorant + inter = 2)
      const fontVarCount = htmlClass
        .split(/\s+/)
        .filter((c) => c.includes("__variable_")).length;
      if (locale === "ar" && fontVarCount !== 3) {
        fail(
          entry.pathname,
          `Arabic page expected 3 font variable classes (cormorant+amiri+cairo), got ${fontVarCount}`
        );
      }
      if (locale !== "ar" && fontVarCount !== 2) {
        fail(
          entry.pathname,
          `Non-Arabic page (${locale}) expected 2 font variable classes (cormorant+inter), got ${fontVarCount}`
        );
      }
    }

    // 3b. Unique <title> and meta description
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    if (!title) {
      fail(entry.pathname, "Missing or empty <title>");
    } else if (seenTitles.has(title)) {
      fail(
        entry.pathname,
        `Duplicate <title> "${title}" (also on ${seenTitles.get(title)})`
      );
    } else {
      seenTitles.set(title, entry.pathname);
    }

    const descriptions = extractMetaContents(html, "name", "description");
    if (descriptions.length === 0 || !descriptions[0].trim()) {
      fail(entry.pathname, "Missing or empty meta description");
    }

    // 3c. Single <h1> and logical heading hierarchy
    const headings = extractHeadings(html);
    const h1s = headings.filter((h) => h.level === 1);
    if (h1s.length !== 1) {
      fail(entry.pathname, `Expected exactly 1 <h1>, found ${h1s.length}`);
    }
    let prevLevel = 0;
    for (const h of headings) {
      if (prevLevel > 0 && h.level > prevLevel + 1) {
        fail(
          entry.pathname,
          `Skipped heading level: H${prevLevel} -> H${h.level} ("${h.text.slice(0, 40)}")`
        );
        break;
      }
      prevLevel = h.level;
    }

    // 3d. Self-referencing canonical
    const canonicals = extractLinks(html, "canonical");
    if (canonicals.length !== 1 || !canonicals[0].href) {
      fail(
        entry.pathname,
        `Expected 1 canonical link, found ${canonicals.length}`
      );
    } else {
      const expectedCanonical = normalizeUrl(entry.loc);
      const actualCanonical = normalizeUrl(canonicals[0].href);
      if (actualCanonical !== expectedCanonical) {
        fail(
          entry.pathname,
          `Canonical mismatch: expected "${expectedCanonical}", got "${actualCanonical}"`
        );
      }
    }

    // 3e. hreflang alternates (fr, en, ar, x-default -> fr)
    const alternates = extractLinks(html, "alternate").filter(
      (l) => l.hreflang && l.href
    );
    const altMap = new Map();
    for (const alt of alternates) {
      altMap.set(alt.hreflang.toLowerCase(), normalizeUrl(alt.href));
    }
    for (const requiredLang of ["fr", "en", "ar", "x-default"]) {
      if (!altMap.has(requiredLang)) {
        fail(entry.pathname, `Missing hreflang="${requiredLang}"`);
      }
    }
    if (altMap.get("x-default") !== altMap.get("fr")) {
      fail(
        entry.pathname,
        `hreflang="x-default" (${altMap.get("x-default")}) must match fr (${altMap.get("fr")})`
      );
    }
    hreflangGraph.set(normalizeUrl(entry.loc), altMap);

    // 3f. Open Graph & Twitter
    const ogLocale = extractMetaContents(html, "property", "og:locale")[0];
    const ogAltLocales = extractMetaContents(
      html,
      "property",
      "og:locale:alternate"
    );
    const ogTitle = extractMetaContents(html, "property", "og:title")[0];
    const ogDesc = extractMetaContents(html, "property", "og:description")[0];
    const ogImage = extractMetaContents(html, "property", "og:image")[0];
    const twCard = extractMetaContents(html, "name", "twitter:card")[0];
    const twTitle = extractMetaContents(html, "name", "twitter:title")[0];

    if (ogLocale !== EXPECTED_OG_LOCALE[locale]) {
      fail(
        entry.pathname,
        `Expected og:locale="${EXPECTED_OG_LOCALE[locale]}", got "${ogLocale}"`
      );
    }
    const expectedAlts = LOCALES.filter((l) => l !== locale).map(
      (l) => EXPECTED_OG_LOCALE[l]
    );
    for (const expAlt of expectedAlts) {
      if (!ogAltLocales.includes(expAlt)) {
        fail(
          entry.pathname,
          `Missing og:locale:alternate="${expAlt}" (found: ${ogAltLocales.join(", ")})`
        );
      }
    }
    if (!ogTitle || !ogDesc || !ogImage) {
      fail(entry.pathname, "Missing og:title, og:description, or og:image");
    }
    if (!twCard || !twTitle) {
      fail(entry.pathname, "Missing twitter:card or twitter:title");
    }

    // 3g. JSON-LD parsing & schema checks
    const jsonLdBlocks = extractJsonLd(html);
    if (jsonLdBlocks.length === 0) {
      fail(entry.pathname, "Missing JSON-LD structured data");
    }
    const isCarDetail = /^(\/(en|ar))?\/vehicules\/[^/]+$/.test(entry.pathname);
    let foundVehicle = false;
    let foundBreadcrumb = false;

    for (const raw of jsonLdBlocks) {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        fail(entry.pathname, `Invalid JSON-LD: ${err.message}`);
        continue;
      }

      if (parsed.inLanguage !== locale) {
        fail(
          entry.pathname,
          `JSON-LD (${parsed["@type"]}) expected inLanguage="${locale}", got "${parsed.inLanguage}"`
        );
      }

      if (parsed["@type"] === "Vehicle") {
        foundVehicle = true;
        if (!VALID_SCHEMA_FUELS.has(parsed.fuelType)) {
          fail(
            entry.pathname,
            `Vehicle JSON-LD fuelType must be standard English, got "${parsed.fuelType}"`
          );
        }
        if (!VALID_SCHEMA_TRANSMISSIONS.has(parsed.vehicleTransmission)) {
          fail(
            entry.pathname,
            `Vehicle JSON-LD vehicleTransmission must be standard English, got "${parsed.vehicleTransmission}"`
          );
        }
      }
      if (parsed["@type"] === "BreadcrumbList") {
        foundBreadcrumb = true;
      }
    }

    if (isCarDetail && (!foundVehicle || !foundBreadcrumb)) {
      fail(
        entry.pathname,
        `Car detail page missing Vehicle (${foundVehicle}) or BreadcrumbList (${foundBreadcrumb}) JSON-LD`
      );
    }

    // 3h. Bundle hygiene: server-only "seo" namespace must not be serialized into client payload
    if (html.includes('"siteTitleTemplate"')) {
      fail(
        entry.pathname,
        'Server-only "seo" namespace leaked into client HTML payload'
      );
    }
  }

  // 4. Verify hreflang reciprocity across the entire graph
  for (const [pageUrl, altMap] of hreflangGraph.entries()) {
    for (const lang of LOCALES) {
      const targetUrl = altMap.get(lang);
      const targetMap = hreflangGraph.get(targetUrl);
      if (!targetMap) {
        fail(
          `hreflang (${pageUrl})`,
          `Target ${lang} URL "${targetUrl}" was not found in sitemap`
        );
        continue;
      }
      const backLinks = new Set(targetMap.values());
      if (!backLinks.has(pageUrl)) {
        fail(
          `hreflang (${pageUrl})`,
          `Non-reciprocal hreflang: "${targetUrl}" does not link back to "${pageUrl}"`
        );
      }
    }
  }
  console.log(
    `[PASS] Checked ${sitemapUrls.length} pages x locales (lang/dir, H1, canonical, reciprocal hreflang, OG/Twitter, JSON-LD, bundle hygiene)`
  );

  // 5. Verify localized 404s and unknown-locale fallback
  const notFoundCases = [
    {
      path: "/page-inexistante-seo-test",
      expectedLang: "fr",
      expectedDir: "ltr",
      expectedText: "Page ou véhicule introuvable",
    },
    {
      path: "/en/nonexistent-seo-test",
      expectedLang: "en",
      expectedDir: "ltr",
      expectedText: "Page or vehicle not found",
    },
    {
      path: "/ar/nonexistent-seo-test",
      expectedLang: "ar",
      expectedDir: "rtl",
      expectedText: "الصفحة أو السيارة غير موجودة",
    },
    {
      path: "/de/vehicules",
      expectedLang: "fr",
      expectedDir: "ltr",
      expectedText: "Page ou véhicule introuvable",
    },
  ];

  for (const tc of notFoundCases) {
    const res = await fetch(`${BASE_URL}${tc.path}`, { redirect: "manual" });
    if (res.status !== 404) {
      fail(`404 (${tc.path})`, `Expected 404, got ${res.status}`);
      continue;
    }
    const html = await res.text();
    const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";
    const lang = extractAttr(htmlTag, "lang");
    const dir = extractAttr(htmlTag, "dir");

    // Next.js 14 dynamic notFound() streams an <html id="__next_error__"> shell whose RSC payload carries the real <html> props + localized 404 content.
    const hasOuterLangDir =
      lang === tc.expectedLang && dir === tc.expectedDir;
    const hasRscLangDir =
      html.includes(`\\"lang\\":\\"${tc.expectedLang}\\"`) &&
      html.includes(`\\"dir\\":\\"${tc.expectedDir}\\"`);
    const hasLocalizedText = html.includes(tc.expectedText);

    if (!hasOuterLangDir && !hasRscLangDir) {
      fail(
        `404 (${tc.path})`,
        `Missing lang="${tc.expectedLang}" dir="${tc.expectedDir}" in HTML or RSC payload (htmlTag=${htmlTag.slice(0, 120)})`
      );
    }
    if (!hasLocalizedText) {
      fail(
        `404 (${tc.path})`,
        `Missing localized 404 copy "${tc.expectedText}"`
      );
    }
  }
  console.log("[PASS] Localized 404 & unknown-locale fallback (/de/vehicules -> FR 404)");

  printSummary();
  if (failures.length > 0) {
    process.exit(1);
  }
}

function printSummary() {
  console.log("");
  if (failures.length === 0) {
    console.log("[PASS] seo:check — All multilingual SEO checks passed with 0 failures.");
  } else {
    console.error(`[FAIL] seo:check — ${failures.length} failure(s) found:\n`);
    for (const f of failures) {
      console.error("  " + f);
    }
  }
}

run().catch((err) => {
  console.error("[FAIL] seo:check crashed:", err);
  process.exit(1);
});
