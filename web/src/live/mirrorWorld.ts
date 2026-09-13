export const MIRROR_DELAYS = {
  first: 100,
  second: 6000,
  third: 3000,
  fourth: 500,
  clear: 1000,
  finish: 1000,
} as const;

export const MIRROR_DIALOG_SELECTOR = '.gwt-DialogBox';
export const MIRROR_HIDDEN = 'mirror-hidden';
export const MIRROR_STAR_COUNT = 5;

export interface MirrorWorldOptions {
  doc?: Document;
}

function hideDialogs(doc: Document): void {
  for (const dialog of doc.querySelectorAll(MIRROR_DIALOG_SELECTOR)) {
    dialog.classList.add(MIRROR_HIDDEN);
  }
}

function showDialogs(doc: Document): void {
  for (const dialog of doc.querySelectorAll(`.${MIRROR_HIDDEN}`)) {
    dialog.classList.remove(MIRROR_HIDDEN);
  }
}

function starField(doc: Document): Element {
  const field = doc.createElement('div');
  field.classList.add('mirror-star');
  for (let index = 0; index < MIRROR_STAR_COUNT; index += 1) {
    const star = doc.createElement('div');
    star.classList.add('mirror-stars');
    field.append(star);
  }
  return field;
}

let running = false;

export function isMirrorWorldRunning(): boolean {
  return running;
}

export function runMirrorWorld(options: MirrorWorldOptions = {}): void {
  if (running) return;
  running = true;
  const doc = options.doc ?? document;
  const body = doc.body;
  const reversed = body.classList.contains('mirror-reversed');

  hideDialogs(doc);
  if (reversed) {
    body.classList.remove('mirror-reversed');
    body.classList.add('mirror-unreversing');
  }
  body.classList.add('mirror-crop');

  const field = starField(doc);
  body.insertBefore(field, body.firstChild);

  setTimeout(() => {
    if (reversed) {
      body.classList.remove('mirror-unreversing');
      body.classList.add('mirror-first-rev');
    } else {
      body.classList.add('mirror-first');
    }

    setTimeout(() => {
      body.classList.remove('mirror-first');
      body.classList.remove('mirror-first-rev');
      body.classList.add(reversed ? 'mirror-second-rev' : 'mirror-second');

      setTimeout(() => {
        body.classList.remove('mirror-second');
        body.classList.remove('mirror-second-rev');
        body.classList.add('mirror-third');

        setTimeout(() => {
          body.classList.add(reversed ? 'mirror-fourth-rev' : 'mirror-fourth');

          setTimeout(() => {
            field.remove();
            body.classList.remove('mirror-third');
            body.classList.remove('mirror-crop');

            setTimeout(() => {
              body.classList.remove('mirror-fourth');
              body.classList.remove('mirror-fourth-rev');
              if (!reversed) body.classList.add('mirror-reversed');
              showDialogs(doc);
              running = false;
            }, MIRROR_DELAYS.finish);
          }, MIRROR_DELAYS.clear);
        }, MIRROR_DELAYS.fourth);
      }, MIRROR_DELAYS.third);
    }, MIRROR_DELAYS.second);
  }, MIRROR_DELAYS.first);
}
