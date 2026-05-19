import { validateFeatureGating } from "../lib/feature-gating-validation";

const result = validateFeatureGating();

for (const warning of result.warnings) {
  console.warn(`WARN: ${warning}`);
}

if (!result.ok) {
  for (const error of result.errors) {
    console.error(`ERROR: ${error}`);
  }
  process.exit(1);
}

console.log("Feature gating validation passed.");
