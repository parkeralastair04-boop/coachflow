#!/usr/bin/env node
/**
 * Scans Next.js client bundles for Supabase service-role / secret key leakage.
 * Invoked by scripts/check-bundle-secrets.sh after production build.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const STATIC_DIR = join(ROOT_DIR, ".next", "static");

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(join(ROOT_DIR, ".env.local"));

const ALLOWED_LITERALS = new Set(
  [
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  ].filter((value) => typeof value === "string" && value.length > 0),
);

const FORBIDDEN_LITERALS = [
  process.env.SUPABASE_SERVICE_ROLE_KEY,
].filter((value) => typeof value === "string" && value.length > 0);

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const SUPABASE_SECRET_KEY_PATTERN = /sb_secret_[A-Za-z0-9_-]+/g;
const SERVICE_ROLE_PAYLOAD_PREFIX = "eyJyb2xlIjoic2VydmljZV9yb2xl";
const SERVICE_ROLE_BASE64_FRAGMENT = "c2VydmljZV9yb2xl";

function walkFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    if (/\.(js|mjs|cjs|json|txt|map)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function decodeJwtPayload(segment) {
  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function scanContent(content, filePath, findings) {
  for (const literal of FORBIDDEN_LITERALS) {
    if (content.includes(literal)) {
      findings.push({
        type: "forbidden-literal",
        filePath,
        detail: "SUPABASE_SERVICE_ROLE_KEY literal found in client bundle",
      });
    }
  }

  if (content.includes(SERVICE_ROLE_BASE64_FRAGMENT)) {
    findings.push({
      type: "service-role-base64-fragment",
      filePath,
      detail: 'Found base64 fragment for "service_role"',
    });
  }

  if (content.includes(SERVICE_ROLE_PAYLOAD_PREFIX)) {
    findings.push({
      type: "service-role-jwt-prefix",
      filePath,
      detail: 'Found JWT payload prefix for {"role":"service_role"}',
    });
  }

  const secretKeys = content.match(SUPABASE_SECRET_KEY_PATTERN) ?? [];
  for (const secretKey of secretKeys) {
    if (!ALLOWED_LITERALS.has(secretKey)) {
      findings.push({
        type: "supabase-secret-key",
        filePath,
        detail: `Found Supabase secret key pattern: ${secretKey.slice(0, 16)}...`,
      });
    }
  }

  const jwtMatches = content.match(JWT_PATTERN) ?? [];
  for (const token of jwtMatches) {
    if (ALLOWED_LITERALS.has(token)) {
      continue;
    }

    const parts = token.split(".");
    if (parts.length < 2) {
      continue;
    }

    const payload = decodeJwtPayload(parts[1]);
    if (payload && payload.role === "service_role") {
      findings.push({
        type: "service-role-jwt",
        filePath,
        detail: "JWT payload declares role=service_role",
      });
    }
  }

  if (/"role"\s*:\s*"service_role"/.test(content)) {
    findings.push({
      type: "service-role-json-claim",
      filePath,
      detail: 'Found JSON role claim "service_role"',
    });
  }
}

function main() {
  if (!statSync(STATIC_DIR, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`ERROR: ${STATIC_DIR} not found. Run 'npm run build' first.`);
    process.exit(1);
  }

  const files = walkFiles(STATIC_DIR);
  const findings = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf8");
    scanContent(content, filePath, findings);
  }

  if (findings.length === 0) {
    console.log(`JWT/service-role scan passed (${files.length} files).`);
    return;
  }

  console.error("JWT/service-role scan failed:");
  for (const finding of findings) {
    console.error(`- [${finding.type}] ${finding.filePath}: ${finding.detail}`);
  }
  process.exit(1);
}

main();
