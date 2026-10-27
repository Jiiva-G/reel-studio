# Third-party notices

Reel Studio's own code is MIT licensed (see [LICENSE](LICENSE)). It does **not** bundle third-party code or
assets in this repository: dependencies are installed by `uv sync` and `npm ci` under their own licences.

## Licences that need attention

| Component | Licence | What it means for you |
|---|---|---|
| [Remotion](https://www.remotion.dev) (`remotion`, `@remotion/*`) | Remotion License | Free for individuals and small companies; larger organisations need a paid company licence. Read <https://www.remotion.dev/license> before commercial use. |
| [edge-tts](https://github.com/rany2/edge-tts) | LGPL-3.0 | Used unmodified as a library. The Microsoft Edge TTS service it talks to is unofficial; it is opt-in only (`--voice-provider edge`). |
| soxr (via librosa) | LGPL-2.1-or-later | Used unmodified as a library. |
| mediabunny, `@mediabunny/*`, certifi | MPL-2.0 | File-level copyleft; used unmodified. |
| caniuse-lite | CC-BY-4.0 | Build-time browser data. |

## Fonts

The renderer loads Space Grotesk, Inter, JetBrains Mono and Noto Sans Tamil from Google Fonts at render time via
`@remotion/google-fonts`. All four are licensed under the SIL Open Font License 1.1.

## Sound

Music beds and sound effects are generated procedurally by Reel Studio's own code (`reelstudio/studio/sound.py`).
The optional `score` command calls the separately installed [cinetic](https://github.com/Leonxlnx/cinetic) skill
(MIT, Copyright (c) 2026 Leonxlnx); it is not included in this repository.

## AI services

Script writing, voice-over and analysis call Google Gemini, Sarvam AI and Groq only when you approve it, with your
own API keys and under those providers' terms.

## Full dependency list

Generated with `uv run python scripts/third_party.py` for this release.
### Python packages (installed with `uv sync`)

| Package | Version | Licence |
|---|---|---|
| aiohappyeyeballs | 2.7.1 | Python Software Foundation License |
| aiohttp | 3.14.5 | Apache-2.0 AND MIT |
| aiosignal | 1.4.0 | Apache Software License |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.15.1 | MIT |
| attrs | 26.1.0 | MIT |
| audioread | 3.1.0 | MIT |
| backports.tarfile | 1.2.0 | MIT License |
| certifi | 2026.10.23 | Mozilla Public License 2.0 (MPL 2.0) |
| cffi | 2.1.1 | MIT-0 |
| charset-normalizer | 3.5.2 | MIT |
| cloudpickle | 3.1.2 | BSD License |
| cryptography | 50.0.2 | Apache-2.0 OR BSD-3-Clause |
| decorator | 5.3.1 | BSD-2-Clause |
| distro | 1.9.0 | Apache Software License |
| edge-tts | 7.3.1 | GNU Lesser General Public License v3 (LGPLv3) |
| frozenlist | 1.8.0 | Apache-2.0 |
| google-auth | 2.62.0 | Apache Software License |
| google-genai | 2.33.0 | Apache-2.0 |
| groq | 1.7.0 | Apache Software License |
| h11 | 0.16.0 | MIT License |
| httpcore | 1.0.9 | BSD-3-Clause |
| httpx | 0.28.1 | BSD License |
| idna | 3.20 | BSD-3-Clause |
| importlib_metadata | 10.1.0 | Apache-2.0 |
| jaraco.classes | 3.4.0 | MIT License |
| jaraco.context | 6.1.2 | MIT |
| jaraco.functools | 4.6.0 | MIT |
| joblib | 1.6.0 | BSD-3-Clause |
| keyring | 25.7.0 | MIT |
| lazy-loader | 0.6 | BSD-3-Clause |
| librosa | 0.11.0 | ISC License (ISCL) |
| llvmlite | 0.50.0 | UNKNOWN |
| more-itertools | 11.2.1 | MIT |
| msgpack | 1.2.4 | Apache-2.0 |
| multidict | 7.2.1 | Apache-2.0 |
| narwhals | 2.27.1 | MIT |
| numba | 0.68.0 | BSD License |
| numpy | 2.4.6 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause |
| pillow | 13.0.0 | MIT-CMU |
| platformdirs | 4.13.5 | MIT |
| pooch | 1.9.0 | BSD-3-Clause |
| propcache | 0.5.4 | Apache-2.0 |
| pyasn1 | 0.6.4 | BSD-2-Clause |
| pyasn1_modules | 0.4.2 | BSD License |
| pycparser | 3.12 | BSD-3-Clause |
| pydantic | 2.14.1 | MIT |
| pydantic_core | 2.50.1 | MIT |
| pywin32-ctypes | 0.2.3 | BSD-3-Clause |
| requests | 2.34.2 | Apache Software License |
| scikit-learn | 1.9.1 | BSD-3-Clause |
| scipy | 1.17.1 | BSD License |
| sniffio | 1.3.1 | MIT License, Apache Software License |
| soundfile | 0.14.0 | BSD License |
| soxr | 1.1.0 | LGPL-2.1-or-later |
| tabulate | 0.10.0 | MIT |
| tenacity | 9.1.4 | Apache Software License |
| threadpoolctl | 3.7.0 | BSD-3-Clause |
| typing_extensions | 4.16.0 | PSF-2.0 |
| typing-inspection | 0.4.4 | MIT |
| urllib3 | 2.8.0 | MIT |
| websockets | 17.3 | BSD-3-Clause |
| yarl | 1.25.1 | Apache-2.0 |
| zipp | 4.1.2 | MIT |

### Renderer packages (npm, production dependencies)

| Package | Version | Licence |
|---|---|---|
| @babel/code-frame | 7.29.7 | MIT |
| @babel/compat-data | 7.29.7 | MIT |
| @babel/core | 7.29.7 | MIT |
| @babel/parser | 7.29.11 | MIT |
| @babel/types | 7.29.11 | MIT |
| semver | 6.3.1 | ISC |
| @babel/generator | 7.29.8 | MIT |
| @babel/parser | 7.29.11 | MIT |
| @babel/types | 7.29.11 | MIT |
| @babel/helper-compilation-targets | 7.29.7 | MIT |
| semver | 6.3.1 | ISC |
| @babel/helper-globals | 7.29.7 | MIT |
| @babel/helper-module-imports | 7.29.7 | MIT |
| @babel/types | 7.29.11 | MIT |
| @babel/helper-module-transforms | 7.29.7 | MIT |
| @babel/helper-string-parser | 7.29.11 | MIT |
| @babel/helper-validator-identifier | 7.29.7 | MIT |
| @babel/helper-validator-option | 7.29.7 | MIT |
| @babel/helpers | 7.29.10 | MIT |
| @babel/types | 7.29.11 | MIT |
| @babel/parser | 7.24.1 | MIT |
| @babel/runtime | 7.29.10 | MIT |
| @babel/template | 7.29.7 | MIT |
| @babel/parser | 7.29.11 | MIT |
| @babel/types | 7.29.11 | MIT |
| @babel/traverse | 7.29.10 | MIT |
| @babel/parser | 7.29.11 | MIT |
| @babel/types | 7.29.11 | MIT |
| @babel/types | 7.24.0 | MIT |
| @emnapi/core | 1.11.3 | MIT |
| @emnapi/runtime | 1.11.3 | MIT |
| @emnapi/wasi-threads | 1.2.3 | MIT |
| @esbuild/aix-ppc64 | 0.28.1 | MIT |
| @esbuild/android-arm | 0.28.1 | MIT |
| @esbuild/android-arm64 | 0.28.1 | MIT |
| @esbuild/android-x64 | 0.28.1 | MIT |
| @esbuild/darwin-arm64 | 0.28.1 | MIT |
| @esbuild/darwin-x64 | 0.28.1 | MIT |
| @esbuild/freebsd-arm64 | 0.28.1 | MIT |
| @esbuild/freebsd-x64 | 0.28.1 | MIT |
| @esbuild/linux-arm | 0.28.1 | MIT |
| @esbuild/linux-arm64 | 0.28.1 | MIT |
| @esbuild/linux-ia32 | 0.28.1 | MIT |
| @esbuild/linux-loong64 | 0.28.1 | MIT |
| @esbuild/linux-mips64el | 0.28.1 | MIT |
| @esbuild/linux-ppc64 | 0.28.1 | MIT |
| @esbuild/linux-riscv64 | 0.28.1 | MIT |
| @esbuild/linux-s390x | 0.28.1 | MIT |
| @esbuild/linux-x64 | 0.28.1 | MIT |
| @esbuild/netbsd-arm64 | 0.28.1 | MIT |
| @esbuild/netbsd-x64 | 0.28.1 | MIT |
| @esbuild/openbsd-arm64 | 0.28.1 | MIT |
| @esbuild/openbsd-x64 | 0.28.1 | MIT |
| @esbuild/openharmony-arm64 | 0.28.1 | MIT |
| @esbuild/sunos-x64 | 0.28.1 | MIT |
| @esbuild/win32-arm64 | 0.28.1 | MIT |
| @esbuild/win32-ia32 | 0.28.1 | MIT |
| @esbuild/win32-x64 | 0.28.1 | MIT |
| @jridgewell/gen-mapping | 0.3.13 | MIT |
| @jridgewell/remapping | 2.3.5 | MIT |
| @jridgewell/resolve-uri | 3.1.2 | MIT |
| @jridgewell/source-map | 0.3.11 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @mediabunny/aac-encoder | 1.62.0 | MPL-2.0 |
| @mediabunny/flac-encoder | 1.62.0 | MPL-2.0 |
| @mediabunny/mp3-encoder | 1.62.0 | MPL-2.0 |
| @module-federation/error-codes | 0.22.0 | MIT |
| @module-federation/runtime | 0.22.0 | MIT |
| @module-federation/runtime-core | 0.22.0 | MIT |
| @module-federation/runtime-tools | 0.22.0 | MIT |
| @module-federation/sdk | 0.22.0 | MIT |
| @module-federation/webpack-bundler-runtime | 0.22.0 | MIT |
| @napi-rs/wasm-runtime | 1.0.7 | MIT |
| @react-three/fiber | 9.8.2 | MIT |
| scheduler | 0.28.0 | MIT |
| @remotion/bundler | 4.0.538 | SEE LICENSE IN LICENSE.md |
| webpack | 5.105.0 | MIT |
| @remotion/captions | 4.0.538 | MIT |
| @remotion/cli | 4.0.538 | SEE LICENSE IN LICENSE.md |
| @remotion/codemods | 4.0.538 | MIT |
| @remotion/compositor-darwin-arm64 | 4.0.538 | see package |
| @remotion/compositor-darwin-x64 | 4.0.538 | see package |
| @remotion/compositor-linux-arm64-gnu | 4.0.538 | see package |
| @remotion/compositor-linux-arm64-musl | 4.0.538 | see package |
| @remotion/compositor-linux-x64-gnu | 4.0.538 | see package |
| @remotion/compositor-linux-x64-musl | 4.0.538 | see package |
| @remotion/compositor-win32-x64-msvc | 4.0.538 | see package |
| @remotion/elevenlabs | 4.0.538 | MIT |
| @remotion/google-fonts | 4.0.538 | SEE LICENSE IN LICENSE.md |
| @remotion/licensing | 4.0.538 | MIT |
| @remotion/media | 4.0.538 | see package |
| @remotion/media-utils | 4.0.538 | MIT |
| @remotion/noise | 4.0.538 | MIT |
| @remotion/openai-whisper | 4.0.538 | MIT |
| @remotion/paths | 4.0.538 | MIT |
| @remotion/player | 4.0.538 | SEE LICENSE IN LICENSE.md |
| @remotion/renderer | 4.0.538 | SEE LICENSE IN LICENSE.md |
| @remotion/sdk | 4.0.538 | Remotion License |
| @remotion/streaming | 4.0.538 | MIT |
| @remotion/studio | 4.0.538 | MIT |
| @remotion/studio-protocol | 4.0.538 | Remotion License |
| @remotion/studio-server | 4.0.538 | MIT |
| @remotion/studio-shared | 4.0.538 | MIT |
| @remotion/three | 4.0.538 | MIT |
| @remotion/timeline-utils | 4.0.538 | MIT |
| @remotion/web-renderer | 4.0.538 | SEE LICENSE IN LICENSE.md |
| @remotion/zod-types | 4.0.538 | MIT |
| @rspack/binding | 1.7.11 | MIT |
| @rspack/binding-darwin-arm64 | 1.7.11 | MIT |
| @rspack/binding-darwin-x64 | 1.7.11 | MIT |
| @rspack/binding-linux-arm64-gnu | 1.7.11 | MIT |
| @rspack/binding-linux-arm64-musl | 1.7.11 | MIT |
| @rspack/binding-linux-x64-gnu | 1.7.11 | MIT |
| @rspack/binding-linux-x64-musl | 1.7.11 | MIT |
| @rspack/binding-wasm32-wasi | 1.7.11 | MIT |
| @rspack/binding-win32-arm64-msvc | 1.7.11 | MIT |
| @rspack/binding-win32-ia32-msvc | 1.7.11 | MIT |
| @rspack/binding-win32-x64-msvc | 1.7.11 | MIT |
| @rspack/core | 1.7.11 | MIT |
| @rspack/lite-tapable | 1.1.0 | MIT |
| @rspack/plugin-react-refresh | 1.6.1 | MIT |
| @svgr/babel-plugin-add-jsx-attribute | 8.0.0 | MIT |
| @svgr/babel-plugin-remove-jsx-attribute | 8.0.0 | MIT |
| @svgr/babel-plugin-remove-jsx-empty-expression | 8.0.0 | MIT |
| @svgr/babel-plugin-replace-jsx-attribute-value | 8.0.0 | MIT |
| @svgr/babel-plugin-svg-dynamic-title | 8.0.0 | MIT |
| @svgr/babel-plugin-svg-em-dimensions | 8.0.0 | MIT |
| @svgr/babel-plugin-transform-react-native-svg | 8.1.0 | MIT |
| @svgr/babel-plugin-transform-svg-component | 8.0.0 | MIT |
| @svgr/babel-preset | 8.1.0 | MIT |
| @svgr/core | 8.1.0 | MIT |
| @svgr/hast-util-to-babel-ast | 8.0.0 | MIT |
| @svgr/plugin-jsx | 8.1.0 | MIT |
| @tanstack/react-virtual | 3.14.9 | MIT |
| @tanstack/virtual-core | 3.17.7 | MIT |
| @tybys/wasm-util | 0.10.4 | MIT |
| @types/dom-mediacapture-transform | 0.1.12 | MIT |
| @types/dom-webcodecs | 0.1.13 | MIT |
| @types/eslint | 9.6.1 | MIT |
| @types/eslint-scope | 3.7.7 | MIT |
| @types/estree | 1.0.9 | MIT |
| @types/json-schema | 7.0.15 | MIT |
| @types/node | 26.6.5 | MIT |
| @types/react | 19.2.2 | MIT |
| @types/react-reconciler | 0.28.9 | MIT |
| @types/webxr | 0.5.24 | MIT |
| @webassemblyjs/ast | 1.14.1 | MIT |
| @webassemblyjs/floating-point-hex-parser | 1.13.2 | MIT |
| @webassemblyjs/helper-api-error | 1.13.2 | MIT |
| @webassemblyjs/helper-buffer | 1.14.1 | MIT |
| @webassemblyjs/helper-numbers | 1.13.2 | MIT |
| @webassemblyjs/helper-wasm-bytecode | 1.13.2 | MIT |
| @webassemblyjs/helper-wasm-section | 1.14.1 | MIT |
| @webassemblyjs/ieee754 | 1.13.2 | MIT |
| @webassemblyjs/leb128 | 1.13.2 | Apache-2.0 |
| @webassemblyjs/utf8 | 1.13.2 | MIT |
| @webassemblyjs/wasm-edit | 1.14.1 | MIT |
| @webassemblyjs/wasm-gen | 1.14.1 | MIT |
| @webassemblyjs/wasm-opt | 1.14.1 | MIT |
| @webassemblyjs/wasm-parser | 1.14.1 | MIT |
| @webassemblyjs/wast-printer | 1.14.1 | MIT |
| @xtuc/ieee754 | 1.2.0 | BSD-3-Clause |
| @xtuc/long | 4.2.2 | Apache-2.0 |
| acorn | 8.19.0 | MIT |
| acorn-import-phases | 1.0.4 | MIT |
| ajv | 8.20.0 | MIT |
| ajv-formats | 3.0.1 | MIT |
| ajv-keywords | 5.1.0 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| ast-types | 0.16.1 | MIT |
| base64-js | 1.5.1 | MIT |
| baseline-browser-mapping | 2.11.32 | Apache-2.0 |
| browserslist | 4.29.4 | MIT |
| buffer | 6.0.3 | MIT |
| buffer-from | 1.1.2 | MIT |
| callsites | 3.1.0 | MIT |
| camelcase | 6.3.0 | MIT |
| caniuse-lite | 1.0.30001819 | CC-BY-4.0 |
| chrome-trace-event | 1.0.4 | MIT |
| commander | 2.20.3 | MIT |
| convert-source-map | 2.0.0 | MIT |
| cosmiconfig | 8.3.6 | MIT |
| cross-spawn | 7.0.6 | MIT |
| css-loader | 7.1.4 | MIT |
| semver | 7.8.5 | ISC |
| cssesc | 3.0.0 | MIT |
| csstype | 3.2.3 | MIT |
| debug | 4.4.3 | MIT |
| define-lazy-prop | 2.0.0 | MIT |
| dot-case | 3.0.4 | MIT |
| dotenv | 17.3.1 | BSD-2-Clause |
| electron-to-chromium | 1.5.464 | ISC |
| enhanced-resolve | 5.26.0 | MIT |
| entities | 4.5.0 | BSD-2-Clause |
| error-ex | 1.3.4 | MIT |
| error-stack-parser | 2.1.4 | MIT |
| es-module-lexer | 2.3.2 | MIT |
| esbuild | 0.28.1 | MIT |
| escalade | 3.2.0 | MIT |
| eslint-scope | 5.1.1 | BSD-2-Clause |
| esprima | 4.0.1 | BSD-2-Clause |
| esrecurse | 4.3.0 | BSD-2-Clause |
| estraverse | 5.3.0 | BSD-2-Clause |
| estraverse | 4.3.0 | BSD-2-Clause |
| events | 3.3.0 | MIT |
| execa | 5.1.1 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-uri | 3.1.9 | BSD-3-Clause |
| fs-monkey | 1.0.3 | Unlicense |
| gensync | 1.0.0-beta.2 | MIT |
| get-stream | 6.0.1 | MIT |
| glob-to-regexp | 0.4.1 | BSD-2-Clause |
| graceful-fs | 4.2.11 | ISC |
| has-flag | 4.0.0 | MIT |
| html-entities | 2.6.0 | MIT |
| human-signals | 2.1.0 | Apache-2.0 |
| icss-utils | 5.1.0 | ISC |
| ieee754 | 1.2.1 | BSD-3-Clause |
| import-fresh | 3.3.1 | MIT |
| is-arrayish | 0.2.1 | MIT |
| is-docker | 2.2.1 | MIT |
| is-stream | 2.0.1 | MIT |
| is-wsl | 2.2.0 | MIT |
| isexe | 2.0.0 | ISC |
| its-fine | 2.1.1 | MIT |
| jest-worker | 27.5.1 | MIT |
| js-tokens | 4.0.0 | MIT |
| js-yaml | 4.3.2 | MIT |
| jsesc | 3.1.0 | MIT |
| json-parse-even-better-errors | 2.3.1 | MIT |
| json-schema-traverse | 1.0.0 | MIT |
| json5 | 2.2.3 | MIT |
| kiwi-schema | 0.5.0 | MIT |
| kleur | 3.0.3 | MIT |
| lines-and-columns | 1.2.4 | MIT |
| loader-runner | 4.3.2 | MIT |
| lower-case | 2.0.2 | MIT |
| lru-cache | 5.1.1 | ISC |
| mediabunny | 1.62.0 | MPL-2.0 |
| memfs | 3.4.3 | Unlicense |
| merge-stream | 2.0.0 | MIT |
| mime-db | 1.54.0 | MIT |
| mime-types | 2.1.35 | MIT |
| mime-db | 1.52.0 | MIT |
| mimic-fn | 2.1.0 | MIT |
| minimist | 1.2.6 | MIT |
| minimizer-webpack-plugin | 5.13.1 | MIT |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.20 | MIT |
| neo-async | 2.6.2 | MIT |
| no-case | 3.0.4 | MIT |
| node-releases | 2.0.60 | MIT |
| npm-run-path | 4.0.1 | MIT |
| onetime | 5.1.2 | MIT |
| open | 8.4.2 | MIT |
| parent-module | 1.0.1 | MIT |
| parse-json | 5.2.0 | MIT |
| path-key | 3.1.1 | MIT |
| path-type | 4.0.0 | MIT |
| picocolors | 1.1.1 | ISC |
| postcss | 8.5.31 | MIT |
| postcss-modules-extract-imports | 3.1.0 | ISC |
| postcss-modules-local-by-default | 4.2.0 | MIT |
| postcss-modules-scope | 3.2.1 | ISC |
| postcss-modules-values | 4.0.0 | ISC |
| postcss-selector-parser | 7.1.7 | MIT |
| postcss-value-parser | 4.2.0 | MIT |
| prismjs | 1.30.0 | MIT |
| prompts | 2.4.2 | MIT |
| react | 19.2.0 | MIT |
| react-dom | 19.2.0 | MIT |
| react-refresh | 0.18.0 | MIT |
| react-use-measure | 2.1.7 | MIT |
| recast | 0.23.21 | MIT |
| source-map | 0.6.1 | BSD-3-Clause |
| remotion | 4.0.538 | SEE LICENSE IN LICENSE.md |
| require-from-string | 2.0.2 | MIT |
| resolve-from | 4.0.0 | MIT |
| scheduler | 0.27.0 | MIT |
| schema-utils | 4.8.1 | MIT |
| semver | 7.5.3 | ISC |
| lru-cache | 6.0.0 | ISC |
| yallist | 4.0.0 | ISC |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| signal-exit | 3.0.7 | ISC |
| simplex-noise | 4.0.1 | MIT |
| sisteransi | 1.0.5 | MIT |
| snake-case | 3.0.4 | MIT |
| source-map | 0.8.0 | BSD-3-Clause |
| source-map-js | 1.2.2 | BSD-3-Clause |
| source-map-support | 0.5.21 | MIT |
| source-map | 0.6.1 | BSD-3-Clause |
| stackframe | 1.3.4 | MIT |
| strip-final-newline | 2.0.0 | MIT |
| style-loader | 4.0.0 | MIT |
| supports-color | 8.1.1 | MIT |
| suspend-react | 0.1.3 | MIT |
| svg-parser | 2.1.0 | MIT |
| tapable | 2.3.3 | MIT |
| terser | 5.51.2 | BSD-2-Clause |
| terser-webpack-plugin | 5.6.1 | MIT |
| three | 0.186.1 | MIT |
| tiny-invariant | 1.3.3 | MIT |
| to-fast-properties | 2.0.0 | MIT |
| tslib | 2.8.1 | 0BSD |
| typescript | 5.9.3 | Apache-2.0 |
| undici-types | 8.9.0 | MIT |
| update-browserslist-db | 1.3.4 | MIT |
| use-sync-external-store | 1.7.0 | MIT |
| util-deprecate | 1.0.2 | MIT |
| watchpack | 2.6.3 | MIT |
| webpack | 5.112.2 | MIT |
| webpack-sources | 3.6.0 | MIT |
| which | 2.0.2 | ISC |
| ws | 8.21.0 | MIT |
| yallist | 3.1.1 | ISC |
| zod | 4.6.6 | MIT |
| zustand | 5.0.16 | MIT |
