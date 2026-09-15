import { createHash } from 'node:crypto';
import { AwsClient } from 'aws4fetch';

export interface BucketSetupOptions {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fetch?: typeof fetch;
}

export interface ExpiryRule {
  id: string;
  prefix: string;
  days: number;
}

export const EXPIRY_RULES: readonly ExpiryRule[] = [
  { id: 'expire-t', prefix: 't/', days: 7 },
  { id: 'expire-m', prefix: 'm/', days: 35 },
];

export function publicReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

export function lifecycleXml(rules: readonly ExpiryRule[]): string {
  const body = rules
    .map(
      (rule) =>
        `<Rule><ID>${rule.id}</ID><Status>Enabled</Status><Filter><Prefix>${rule.prefix}</Prefix></Filter>` +
        `<Expiration><Days>${rule.days}</Days></Expiration></Rule>`,
    )
    .join('');
  return `<LifecycleConfiguration>${body}</LifecycleConfiguration>`;
}

export class BucketSetupError extends Error {}

export class BucketSetup {
  private readonly client: AwsClient;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BucketSetupOptions) {
    this.client = new AwsClient({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region,
      service: 's3',
    });
    this.endpoint = options.endpoint.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch;
  }

  async waitReady(attempts: number, delayMs: number): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.request(`${this.endpoint}/`, { method: 'GET' });
        if (response.status < 500) {
          return;
        }
      } catch {
        // not listening yet
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new BucketSetupError(`storage at ${this.endpoint} did not come up`);
  }

  async ensure(bucket: string, rules: readonly ExpiryRule[] = EXPIRY_RULES): Promise<void> {
    const url = `${this.endpoint}/${bucket}`;
    const created = await this.request(url, { method: 'PUT' });
    if (!created.ok && created.status !== 409) {
      throw await failure('create', bucket, created);
    }
    const policy = await this.request(`${url}?policy`, {
      method: 'PUT',
      body: publicReadPolicy(bucket),
      headers: { 'content-type': 'application/json' },
    });
    if (!policy.ok) {
      throw await failure('policy', bucket, policy);
    }
    const xml = lifecycleXml(rules);
    const lifecycle = await this.request(`${url}?lifecycle`, {
      method: 'PUT',
      body: xml,
      headers: {
        'content-type': 'application/xml',
        'content-md5': createHash('md5').update(xml).digest('base64'),
      },
    });
    if (!lifecycle.ok) {
      throw await failure('lifecycle', bucket, lifecycle);
    }
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const signed = await this.client.sign(url, init);
    return this.fetchImpl(signed);
  }
}

async function failure(
  step: string,
  bucket: string,
  response: Response,
): Promise<BucketSetupError> {
  const detail = await response.text().catch(() => '');
  return new BucketSetupError(`${step} ${bucket}: ${response.status} ${detail}`.trim());
}
