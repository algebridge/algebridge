# AlgeBridge Hints (Chrome extension)

## Try it in 2 minutes

1. In Chrome, open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this `extension` folder (the one with `manifest.json`).
3. Open a page with an algebra problem, for example
   https://tutorial.math.lamar.edu/Problems/Alg/SolveLinearEqns.aspx, a Google Form quiz
   with an equation in it, or a Khan Academy algebra exercise.
4. Archie's card slides in at the top right of the page. Click **Get a hint**.

Hints come from `https://learn.algebridge.org/api/extension/hint`. That route is not deployed
yet (on October 1, 2026 a POST there got the site's 404 page), so until it ships the card
shows "Something went wrong on our side" after **Get a hint**. For now, run the site on
your machine and point the extension at it:

1. In the repo: `npm run dev -- -p 3216` (it needs `GROQ_API_KEY` in `.env.local`).
2. In `chrome://extensions`, on the AlgeBridge Hints card, click **service worker**, and in
   the console that opens run `setApiBase("http://localhost:3216")`.

`setApiBase()` switches back to the live site. Leave Developer mode on while the unpacked
build is installed (see [Load it unpacked](#load-it-unpacked)).

AlgeBridge Hints notices Algebra 1 and Algebra 2 problems on any web page and offers
step by step hints from the AlgeBridge API. It never gives the answer: the server
checks every reply in code and removes anything that would give it away.

A student can:

- open a hint card when a problem shows up (or click a small marker next to it)
- get one hint at a time, see the idea behind the problem, check an answer, or ask a question
- select any problem, right-click, and choose **Get an AlgeBridge hint for this**
- press **Alt+Shift+H** to open hints on the current page
- pick how problems are shown, pause the extension on a site, or turn it off from the toolbar button

## What is in this folder

| Path | What it does |
| --- | --- |
| `manifest.json` | Manifest V3. Content scripts on all pages except AlgeBridge's own sites. |
| `src/detect.js` | Finds algebra problems in page text, KaTeX, MathJax and MathML. Runs only in the browser. |
| `src/mascot.js` | Archie, the mascot, drawn as inline SVG. Used by the page UI and the popup. |
| `src/content.js`, `src/ui.css` | Markers, the corner card and the hint panel, drawn inside a closed shadow root. |
| `src/background.js` | Service worker: settings, the hint API call, the toolbar badge, right-click menu, shortcut. |
| `popup/` | The toolbar popup: on/off, how problems are shown, pause on this site, open hints, today's counts. |
| `icons/` | 16, 32, 48 and 128 px icons: Archie's face from `src/mascot.js`, the same drawing as the page's round button. |
| `scripts/build-icons.mjs` | Redraws the icons from `AlgeBridgeMascot.face()` with `@resvg/resvg-js`. |
| `scripts/pack.mjs` | Builds and checks the Chrome Web Store zip. |
| `test/` | Detector, background, page UI and real-Chrome tests, plus test pages. |

## Load it unpacked

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension` folder (the one with `manifest.json`).
4. Pin AlgeBridge Hints from the puzzle piece menu so the toolbar button is easy to reach.

Keep **Developer mode** on for as long as an unpacked build is installed. Chrome expects
unpacked extensions only in Developer mode; with it off, Chrome's Safety Check lists
AlgeBridge Hints as an extension to review. Turning Developer mode back on clears that.

Tabs that were already open before you loaded it need a reload before hints show up there.

Local `file://` pages work right away: Chrome 154 turns on **Allow access to file URLs**
for unpacked extensions when they are loaded (it is in the extension's **Details**). If you
switch it off or on, quit and reopen Chrome before testing again, because open pages keep
the old setting until then.

After you change a file, click the reload arrow on the extension's card in
`chrome://extensions`, then reload the page you are testing. A clean card has no
**Errors** or **Warnings** button; `node extension/test/e2e.mjs` checks that with Developer
mode on, which is the only time Chrome reports them.

## Point it at a local dev server

By default the extension talks to `https://learn.algebridge.org`. To use your local
Next.js server instead:

1. Run `npm run dev` in the repo (it serves `http://localhost:3000`).
2. In `chrome://extensions`, on the AlgeBridge Hints card, click **service worker** to open
   its DevTools.
3. In that console, run:

```js
setApiBase("http://localhost:3000")
```

Switch back to the live site with:

```js
setApiBase()
```

`setApiBase` only accepts an address that one of the running manifest's
`host_permissions` covers: `https://learn.algebridge.org`, and in this development
manifest `http://localhost` and `http://127.0.0.1` (any port). Anything else falls back to
the live site. The value is saved in `chrome.storage.sync`, so it survives a reload. Web
pages, content scripts and the popup can never change it.

The local server needs a model key (`GROQ_API_KEY`, or `OPENAI_API_KEY`) to write hints.
`EXTENSION_SEAL_KEY` is optional; without it the server derives the seal key from the
model key.

The `http://localhost/*` and `http://127.0.0.1/*` host permissions in `manifest.json`
exist only for this. `npm run extension:pack` removes them from the store build, and
because the worker checks the API base against the manifest it is running with, the
store build sends hints only to `https://learn.algebridge.org` even if a localhost value
is still saved in sync storage.

## Settings and storage

| Where | Key | What |
| --- | --- | --- |
| `chrome.storage.sync` | `settings` | `{ enabled, mode, pausedSites, apiBase }`. Defaults: on, `"popup"`, none paused, the live site. |
| `chrome.storage.local` | `install` | A random ID made with `crypto.randomUUID()` when the extension is installed. |
| `chrome.storage.local` | `stats` | `{ day, problemsSeen, hints }` for today. Resets on a new day. |
| `chrome.storage.session` | `counts:<tabId>` | Problems found per frame on each tab, for the toolbar badge. Cleared when the tab closes. |

`mode` is one of:

- `"popup"`: **Pop-up card and markers**. A card slides in once for each new problem, plus markers.
- `"badge"`: **Markers only**.
- `"off"`: **Only when I ask**. Nothing shows until the student opens hints from the popup,
  the right-click menu or the shortcut. The toolbar badge stays empty in this mode.

## Permissions and why each one is needed

| Permission | Why |
| --- | --- |
| `storage` | Saves the student's settings, the random install ID, today's counts and the per-tab problem count for the badge. |
| `contextMenus` | Adds **Get an AlgeBridge hint for this** to the right-click menu for selected text, so a student can ask about a problem the extension did not mark. |
| `activeTab` | When the student clicks the toolbar button, the popup reads the address of the tab they are on, so it can offer **Pause on (this site)** and say whether hints can run there. The extension does not ask for `tabs`, and content-script matches do not expose tab addresses, so without `activeTab` the store build could not see the site (the `--store` run of `test/e2e.mjs` shows this). Access covers that one tab, only after a click. |
| Host `https://learn.algebridge.org/*` | The service worker sends the hint request to the AlgeBridge API there. |
| Hosts `http://localhost/*`, `http://127.0.0.1/*` | Local development only. Removed from the store build. |
| Content scripts on `<all_urls>` | Homework lives on many different sites, so the detector has to be able to read the math on any page. It runs in Chrome's isolated world, reads the page on the student's computer, and sends nothing until the student asks for a hint. It is excluded on `learn.algebridge.org`, `algebridge.org` and `www.algebridge.org`, which have the built-in helper. |
| `web_accessible_resources: src/ui.css` | The panel's styles, loaded into its shadow root. `use_dynamic_url` gives the file a per-session address, so a web page cannot use it to tell whether the extension is installed. |
| `content_security_policy` | Extension pages run only scripts from the package: `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. |

No remote code is loaded. Everything the extension runs ships in the zip.

## Security model

- **Web pages cannot reach the extension.** The manifest has no `externally_connectable`
  key, so no web page can message it. The content scripts run in Chrome's isolated world;
  the UI lives in a closed shadow root and is built with `textContent`, never HTML strings.
- **Other extensions get nothing.** Without `externally_connectable`, Chrome lets other
  extensions address this one, but only through `runtime.onMessageExternal` and
  `runtime.onConnectExternal`, and nothing here listens to either. Their messages fail with
  "Receiving end does not exist" (the e2e test sends one from a probe extension to prove
  it), and `npm run extension:pack` fails if any shipped script ever adds such a listener.
  (An empty `"externally_connectable": { "ids": [] }` would say the same thing, but Chrome
  shows it as a manifest warning, so it is left out.)
- **The worker checks every sender.** A message must come from this extension
  (`sender.id`), even on `runtime.onMessage`. The popup may do everything. A content script reads an untrusted page, so it
  may only ask for hints, read settings, report its problem count, bump today's counts, and
  change the display mode, the on switch or the pause for the site it runs on. Only content
  scripts in a tab may report counts. Unknown message types get no answer.
- **Message shapes are cleaned.** Sizes are clamped to the API limits, the sealed solution
  must be server-made base64url, and only the HintResponse fields (with the right types) are
  passed back to the page.
- **Storage is locked.** `chrome.storage.local` and `.sync` are set to `TRUSTED_CONTEXTS` when
  the worker starts, so a content script cannot read the install ID or write settings around
  the worker. Session storage (badge counts) is trusted-only by default.
- **The API base is pinned** to the manifest's host permissions (see above). Requests send no
  cookies, no referrer, and treat any redirect as an error, so a problem can never be
  forwarded to another server.
- **Off and paused mean silent.** The worker refuses hint requests from a content script on a
  paused site, or while hints are off, even if the page has not caught up yet.

## Privacy model

- Detection happens on the student's computer. Page text is never sent anywhere just
  because a page was opened.
- When the student asks for a hint, checks an answer or asks a question, the service worker
  sends `POST /api/extension/hint` with: the text of that one problem (600 characters max),
  the hints already shown for it, the student's answer or question if they typed one,
  the opaque `sealed` value from the previous reply, `v: 1`, and the random install ID.
  Nothing is sent from a paused site or while hints are off.
- No cookies go with the request (`credentials: "omit"`), so it is not tied to an
  AlgeBridge login. No browsing history, page addresses or names are sent.
- The server keeps no copy of the problem text and never logs it. The install ID, the IP
  address and a one-way hash of the problem are held only in server memory, to count
  requests over the last 10 minutes for rate limits. They are not saved to a database.
- The worked solution stays sealed (AES-256-GCM) on the wire. The extension cannot read it.
- Removing the extension clears its settings and counts.

The public privacy policy section lives at
https://learn.algebridge.org/privacy#extension (`src/app/privacy/page.tsx`).

## Tests

```sh
npm run test:extension             # server: hint route, leak filter, answer checking
npm run test:detect                # detector precision and recall on the test corpus
npm run test:detect:dom            # detector on real pages in headless Chrome
npm run test:ui                    # page UI in headless Chrome with a chrome.* stand-in
node extension/test/background.test.mjs   # service worker logic, Node only
node extension/test/e2e.mjs        # the whole extension in real Chrome, mock hint API
node extension/test/e2e.mjs --live # same, against the real API at http://localhost:3216
node extension/test/e2e.mjs --store  # the packed store build (run extension:pack first)
```

`e2e.mjs` turns on Developer mode, loads the extension into real Google Chrome over the
DevTools protocol (`Extensions.loadUnpacked`, since branded Chrome ignores
`--load-extension`), serves its own test page over `http://127.0.0.1`, and checks what a web
page and another extension can and cannot reach, the toolbar badge, the popup at 320 px,
pausing, the hint round trip, and that `chrome://extensions` reports no warnings or errors
(a probe extension with a known warning shows the check can see one). With `--live` it also
checks that the real hints never state the answer to `3x - 5 = 16`. Screenshots go to
`$TMPDIR/algebridge-e2e-shots` (or `--shots=<dir>`).

## Build the store zip

```sh
npm run extension:icons  # only when Archie's face in src/mascot.js changes
npm run extension:pack
```

`pack` copies the extension into `extension/dist/build` (leaving out `test/`, `scripts/`,
`dist/`, this README and `STORE_LISTING.md`), writes the store manifest without the localhost
host permissions, and zips it to `extension/dist/algebridge-hints-<version>.zip`. Then it
checks the build and exits with an error if any check fails:

- the manifest parses, is MV3, and its description fits in 132 characters
- permissions are on the allowed list, host permissions are exactly
  `https://learn.algebridge.org/*`, there is no `externally_connectable` key, the
  extension-page CSP is `script-src 'self'`, and `web_accessible_resources` holds no pages or
  scripts
- no shipped script uses `onMessageExternal` or `onConnectExternal` (read from the code, and
  checked again by running the worker)
- `STORE_LISTING.md` justifies every permission and host the manifest asks for, nothing more,
  and its summary matches the manifest description
- the shipped service worker, run in Node with the store manifest, sends hints only to
  `https://learn.algebridge.org` even with a localhost API base saved, ignores messages
  from other extensions, and registers no external listener
- every content script has real code (not a placeholder)
- every file the manifest and the popup reference is in the build
- each icon has the pixel size its name says
- no shipped script sets `innerHTML`, `outerHTML` or `insertAdjacentHTML` to anything but
  a plain string literal
- no em dash characters in any shipped text file
- every shipped script parses (`node --check`)
- no `eval(`, `new Function`, string timers or remote scripts
- the background's default API base is still `https://learn.algebridge.org`
- the zip holds exactly the build files

`extension/dist/` has its own `.gitignore`, so build output stays out of git.

Bump `version` in `manifest.json` before each store upload. Chrome needs every upload to
have a higher version than the last one.

## Publish to the Chrome Web Store

1. Sign in at the Chrome Web Store Developer Dashboard
   (https://chrome.google.com/webstore/devconsole) with the Google account that should own
   the listing, and register as a developer. Registration has a one-time fee; the current
   amount is shown on the sign-up page.
2. Click **New item** and upload `extension/dist/algebridge-hints-<version>.zip`.
3. **Store listing**: copy the name, summary, description and category from
   `STORE_LISTING.md`. Add at least one screenshot (1280x800 or 640x400) taken from the
   real extension, and the 128 px icon from `icons/128.png`.
4. **Privacy practices**:
   - Single purpose: paste the single-purpose statement from `STORE_LISTING.md`.
   - Permission justifications: paste the text for `storage`, `contextMenus`, `activeTab`,
     the host permission and the content script.
   - Remote code: **No, I am not using remote code**.
   - Data usage: tick **Website content** (the problem text the student chooses to send).
     Leave the other categories unticked. Tick the three certifications (not sold, not used
     for unrelated purposes, not used for creditworthiness).
   - Privacy policy URL: `https://learn.algebridge.org/privacy`
5. **Distribution**: choose Public (or Unlisted while testing with a class), and the regions.
6. Submit for review. Review time varies; extensions that read every page can take longer.

Because the content script runs on every site, Chrome shows the install warning "Read and
change all your data on all websites". The single-purpose statement and the content script
justification are what the reviewer reads to decide that this access fits the purpose.

Schools on Google Workspace for Education can also push the extension to student
Chromebooks from the Admin console once it is published, using its Web Store item ID.
