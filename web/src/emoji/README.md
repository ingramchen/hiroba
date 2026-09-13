# Emoji

`source/smiley-table.json` is the emoji table: the categories, the excluded categories and the
symbols in picker order. `generated/emoji-data.ts` is produced from it by
`web/scripts/gen-emoji.ts`, which adds the derived fields (`ordinal`, `file`, `file2x`,
`pattern`, `lineBreak`), and must not be edited by hand.

Edit `source/smiley-table.json`, then run `node scripts/gen-emoji.ts` from `web/`. The script
resolves every file against `web/public/-/emoji/`, fails when a referenced file is missing and
reports every shipped file it does not reference. `emoji.test.ts` fails if `generated/` and
`source/` disagree.

## Generations

| Generation | Files                  | Entries | Densities        |
| ---------- | ---------------------- | ------- | ---------------- |
| pidgin     | `pidgin/<NAME>.png`    | 35      | 24 px only       |
| Emojitwo   | `emoji_one/<code>.png` | 178     | 24 px and `_2x`  |
| category   | `category/<icon>.png`  | 5 icons | 16 px and `_2x`  |

A third generation (`ios93`) was never rendered and is no longer in the tree.

`highDensity` selects the `_2x` file for the codepoint set and the category icons; the pidgin set
has no `_2x` file and stays at 24 px, as in the old renderer.

## Categories

`RECENT`, `SMILE`, `NATURE`, `THING`, `LEGACY`. `SYMBOL` and `FOOD` sit in the table's
`excludedCategories` and are deliberately absent here; no entry is assigned to them and their
icons are not shipped.

## Loading

Individual PNGs, no sprite sheet: 401 files addressed by
`EMOJI_BASE_PATH + file`. The picker renders one `<img>` per cell and the inline renderer one per
occurrence, so the browser cache is the whole strategy; `EMOJI_BASE_PATH` is overridable per call
for a different static mount.

## Licensing

The art keeps its notices in `web/public/-/emoji/LICENSE` next to the PNGs. The Emojitwo attribution has to stay
visible under the picker.
