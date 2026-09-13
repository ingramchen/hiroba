export const SPRAY_TARGET_FPS = 33;
export const SPRAY_MAX_VELOCITY = 7;
export const SPRAY_Z_INDEX = 10_000;

export function particleCount(noOfCrowd: number): number {
  return Math.min(500, Math.max(Math.floor(noOfCrowd / 5), 30));
}

export function durationSeconds(particles: number): number {
  return Math.min(25, Math.max(particles / 20, 5));
}

export function alphaStep(durationInSeconds: number): number {
  return 1 / SPRAY_TARGET_FPS / durationInSeconds;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SprayOptions {
  colorHex: string;
  noOfCrowd: number;
  smokeUrl: string;
  container?: HTMLElement;
  random?: () => number;
}

function tint(image: HTMLImageElement, colorHex: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.fillStyle = `#${colorHex}`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-atop';
  context.drawImage(image, 0, 0);
  return canvas;
}

export function euroSpray(options: SprayOptions): Promise<void> {
  const container = options.container ?? document.body;
  const random = options.random ?? Math.random;
  const count = particleCount(options.noOfCrowd);
  const duration = durationSeconds(count);

  const canvas = document.createElement('canvas');
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = String(SPRAY_Z_INDEX);
  canvas.style.pointerEvents = 'none';

  return new Promise((done) => {
    const image = new Image();
    image.addEventListener('error', () => {
      done();
    });
    image.addEventListener('load', () => {
      container.append(canvas);
      const context = canvas.getContext('2d');
      if (context === null) {
        canvas.remove();
        done();
        return;
      }
      const tinted = tint(image, options.colorHex);
      const particles: Particle[] = [];
      let alpha = 1;
      let step = 0;
      const velocity = (): number => random() * 2 * SPRAY_MAX_VELOCITY - SPRAY_MAX_VELOCITY;
      const timer = setInterval(() => {
        for (const particle of particles) {
          particle.x += particle.vx;
          particle.y += particle.vy;
        }
        context.globalAlpha = alpha;
        context.clearRect(0, 0, width, height);
        if (step % 2 === 0 && particles.length < count) {
          particles.push({ x: width / 2, y: height / 2, vx: velocity(), vy: velocity() });
        }
        for (const particle of particles) {
          context.drawImage(tinted, particle.x - image.width / 2, particle.y - image.height / 2);
        }
        alpha -= alphaStep(duration);
        step++;
        if (alpha < 0) {
          clearInterval(timer);
          canvas.remove();
          done();
        }
      }, 1000 / SPRAY_TARGET_FPS);
    });
    image.src = options.smokeUrl;
  });
}
