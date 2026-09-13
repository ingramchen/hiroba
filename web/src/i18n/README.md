# Messages

`generated/zh-TW.ts` and `generated/en.ts` are the message bundles. `messages`
holds the 208 UI strings and `transport` the 3 connection-state strings, keyed
identically in both locales.

## Placeholder mapping

| Form            | Meaning                                                    |
| --------------- | ---------------------------------------------------------- |
| `{0}` … `{2}`   | positional argument, stringified                            |
| `{0,number,#}`  | number, no decimals, no grouping; the one call site is integral |
| `'`             | a literal apostrophe; no message with an argument uses one  |

`formatMessage` substitutes only these two forms. Unlike `java.text.MessageFormat` it gives the
apostrophe no quoting meaning, which is what the message bundles rely on.

## Locale selection

`resolveLocale` reproduces `gwt-locale.js` plus the module's locale property: an explicit
`?locale=` wins, otherwise the browser tag is normalised (`xx-yy` → `xx_YY`, a bare two-letter tag
kept, anything else `en_US`) and used only if it is `zh_TW` or `en`. Everything else — including
`zh_CN` and `zh-Hant-TW` — falls back to `en`.
