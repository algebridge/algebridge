# Chrome Web Store listing: AlgeBridge Hints

Copy each block into the matching field of the Developer Dashboard. Everything here
describes what the extension really does. Add ratings, user numbers or quotes only once
they exist, and only real ones.

`npm run extension:pack` checks this file against the manifest: the summary must match the
manifest description, and every permission and host permission must have a justification
here (and nothing extra). Change the manifest and this file together.

## Name

AlgeBridge Hints

## Summary (132 characters max, same as the manifest description)

Spots Algebra 1 and 2 problems on any web page and gives step by step hints to solve them, never the answer.

## Category

Education (listed under Productivity in the dashboard)

## Language

English

## Detailed description

```
AlgeBridge Hints helps you work through algebra homework on any website, one step at a time, while you do the solving.

When an Algebra 1 or Algebra 2 problem shows up on the page, AlgeBridge Hints notices it and offers help. Equations, inequalities, systems, quadratics, factoring, exponents, radicals, rational expressions, logarithms and more.

How it helps
- One hint at a time: what move to make next and why, ending with a question for you
- The big idea behind the problem, when you want the why
- Check my answer: tells you if you got it, or points at where the slip might be
- Ask a question about the problem, like a tutor sitting next to you

Hints, never the answer
Every reply is checked by AlgeBridge's server before you see it, and anything that would give away the answer is taken out. You still do the math, so you still learn it.

Works where your homework is
It reads math written as plain text and math shown with KaTeX, MathJax and MathML, which many homework and quiz sites use. If it misses a problem, select it, right-click, and choose "Get an AlgeBridge hint for this". Or press Alt+Shift+H.

You choose how it shows up
- Pop-up card and markers
- Markers only
- Only when I ask
Pause it on any site with one click, or turn it off from the toolbar button.

Private by design
The extension reads the page on your computer to find problems. Only the problem you ask about is sent to AlgeBridge, along with the hints you already got for it and your answer or question if you typed one. Pause a site and nothing from it is sent. No account needed and no ads.
Privacy policy: https://learn.algebridge.org/privacy

Made by AlgeBridge, a free algebra course at https://learn.algebridge.org
```

## Single purpose

```
AlgeBridge Hints helps students solve algebra problems they find on web pages by giving step by step hints that never include the final answer.
```

## Permission justifications

**storage**

```
Saves the student's settings (on or off, how problems are shown, paused sites), a random install ID used for fair-use rate limits, today's count of problems spotted and hints used, and the number of problems on each open tab for the toolbar badge (session storage, cleared when the tab closes). All of it stays in the browser; only the install ID is sent, with a hint request.
```

**contextMenus**

```
Adds "Get an AlgeBridge hint for this" to the right-click menu for selected text, so a student can ask for hints on a problem the extension did not mark on its own.
```

**activeTab**

```
When the student clicks the toolbar button, the popup reads the address of the current tab so it can show "Pause on <that site>" and tell the student whether hints can run there. The extension does not ask for the "tabs" permission, so without activeTab the popup cannot see which site is open. Access covers only that one tab and only after the click.
```

**Host permission (https://learn.algebridge.org/*)**

```
The service worker sends the problem the student asks about to the AlgeBridge hint API at learn.algebridge.org and shows the hint it returns. It sends no cookies and follows no redirects. No other hosts are contacted.
```

**Content script on all sites**

```
Algebra homework appears on many different websites (school learning systems, quiz tools, textbooks, worksheets), so the content script must be able to read the math on any page to find problems. It reads the page on the student's computer and sends nothing until the student asks for a hint. Its markers and hint panel live in a closed shadow root, and neither web pages nor other extensions can message it: the extension answers only its own popup and content scripts. It is turned off on AlgeBridge's own sites, which have a built-in helper, and the student can pause it on any site or turn it off.
```

**Remote code**

```
No, I am not using remote code. All scripts are in the package.
```

## Data usage disclosures

| Category | Collected? | What and why |
| --- | --- | --- |
| Personally identifiable information | No | |
| Health information | No | |
| Financial and payment information | No | |
| Authentication information | No | |
| Personal communications | No | |
| Location | No | The Web Store lists IP address under Location. The server sees the IP of each request, as any web request does, and holds it only in memory, to count requests over the last 10 minutes for rate limits. It is not saved to a database or used to locate anyone. If a reviewer reads that as collection, tick Location and paste this sentence. |
| Web history | No | |
| User activity | No | |
| Website content | Yes | The text of the one problem the student asks about (600 characters at most), the hints already shown for it, and the student's typed answer or question. Sent only when the student asks, used only to write the hint, and not logged or stored. |

Certify all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

Notes for the reviewer field, if asked:

- The problem text is processed by an AI service (Groq, with OpenAI as a backup) to write
  the hint, as stated in the privacy policy. That is part of the single purpose.
- Each request also carries a random install ID made with `crypto.randomUUID()`. It is not
  tied to a name, email or account. The server holds it, the request's IP address and a
  one-way hash of the problem only in memory, to count requests over the last 10 minutes for
  rate limits, and saves none of them to a database.

## Links

- Privacy policy: https://learn.algebridge.org/privacy
- Homepage: https://learn.algebridge.org
- Support email: support@algebridge.org

## Images to prepare

Take these from the real extension on real pages, no mockups of features that do not exist:

- Store icon: `extension/icons/128.png`
- Screenshots, 1280x800 or 640x400, at least one, up to five. Suggested:
  1. A homework page with markers next to problems and the corner card open
  2. The hint panel showing a first hint that ends with a question
  3. Check my answer pointing at a slip
  4. The toolbar popup with the three display choices
- Small promo tile, 440x280 (optional)
