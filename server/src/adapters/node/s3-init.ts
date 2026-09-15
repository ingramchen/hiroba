import { BucketSetup } from './bucketSetup.js';

function env(key: string, fallback?: string): string {
  const value = process.env[key]?.trim();
  if (value !== undefined && value.length > 0) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  console.error(`${key} is not set`);
  process.exit(2);
}

const setup = new BucketSetup({
  endpoint: env('S3_ENDPOINT'),
  region: env('S3_REGION', 'us-east-1'),
  accessKeyId: env('S3_ACCESS_KEY'),
  secretAccessKey: env('S3_SECRET_KEY'),
});

const buckets = [
  env('S3_BUCKET_IMG', 'hiroba-img'),
  env('S3_BUCKET_C', 'hiroba-c'),
  env('S3_BUCKET_V', 'hiroba-v'),
];

await setup.waitReady(60, 2000);
for (const bucket of buckets) {
  await setup.ensure(bucket);
  console.log(JSON.stringify({ level: 'info', msg: 'bucket ready', bucket }));
}
