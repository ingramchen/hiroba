declare module 'cloudflare:workers' {
  export class DurableObject<E = unknown> {
    constructor(ctx: import('./platform.js').DurableObjectStateLike, env: E);
    protected ctx: import('./platform.js').DurableObjectStateLike;
    protected env: E;
  }
}
