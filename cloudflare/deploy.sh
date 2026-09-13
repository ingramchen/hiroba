#!/bin/sh
# Deploy the TypeScript stack to Cloudflare Workers. Read cloudflare/README.md first;
# the secrets have to be in place before the first run.
#
# Buckets and their lifecycle rules are part of the deploy, not of the application: nothing
# in the code deletes an expired upload, so a missing rule means uploads are kept forever
# and nothing reports it.
set -eu

cd "$(dirname "$0")/.."
WRANGLER="./node_modules/.bin/wrangler"

buckets() {
  node -e '
    const { vars } = require("./wrangler.json");
    for (const key of ["S3_BUCKET_IMG", "S3_BUCKET_C", "S3_BUCKET_V", "S3_BUCKET_CACHE"]) {
      process.stdout.write(`${key}=${vars[key]}\n`);
    }
  '
}

eval "$(buckets)"

pnpm -r build

for bucket in "$S3_BUCKET_IMG" "$S3_BUCKET_C" "$S3_BUCKET_V" "$S3_BUCKET_CACHE"; do
  "$WRANGLER" r2 bucket create "$bucket" 2>/dev/null || echo "bucket $bucket already exists"
done

# `lifecycle set` REPLACES the bucket's whole configuration, so re-running this is idempotent.
# `lifecycle add` would accumulate a duplicate rule on every deploy.
for bucket in "$S3_BUCKET_IMG" "$S3_BUCKET_C" "$S3_BUCKET_V"; do
  "$WRANGLER" r2 bucket lifecycle set "$bucket" --file cloudflare/r2-lifecycle.json --force
done
"$WRANGLER" r2 bucket lifecycle set "$S3_BUCKET_CACHE" \
  --file cloudflare/r2-lifecycle-cache.json --force

for bucket in "$S3_BUCKET_IMG" "$S3_BUCKET_C" "$S3_BUCKET_V" "$S3_BUCKET_CACHE"; do
  echo "=== $bucket"
  "$WRANGLER" r2 bucket lifecycle list "$bucket"
done

"$WRANGLER" deploy
