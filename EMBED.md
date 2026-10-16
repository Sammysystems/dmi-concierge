# Embedding the DMI Studio Desk

The desk is one line of HTML. It drops onto `dmi.com.ng` exactly as the site is
today - nothing on the client's site is rebuilt or replaced.

Everything behind it (the AI, the rate card, the session capture, the email)
runs on our server. The client's site never sees the AI or email keys.

---

## Option 1 - floating chat bubble (simplest)

Paste this once, anywhere in the site's HTML (just before `</body>` works well):

```html
<script src="https://desk.dmi.com.ng/embed.js" defer></script>
```

A round chat button appears bottom-right. A visitor clicks it and the desk opens
in a small panel.

## Option 2 - wire it to their own "Talk to Support" button

If the site already has a support button or link, keep it and point it at the
desk. Load the script with the bubble turned off, then call `DmiDesk.open()`:

```html
<script src="https://desk.dmi.com.ng/embed.js" data-desk-bubble="false" defer></script>

<!-- keep the site's own button; just add the onclick -->
<button onclick="DmiDesk.open()">Talk to Support</button>
```

Any element works, not just a button:

```html
<a href="#" onclick="DmiDesk.open();return false;">Talk to Support</a>
```

## The JavaScript API

The script exposes a small global once loaded:

```js
DmiDesk.open();    // open the desk
DmiDesk.close();   // close it
DmiDesk.toggle();  // flip it
DmiDesk.isOpen();  // true / false
```

---

## Configuration (all optional)

Every setting is a `data-` attribute on the script tag:

| Attribute | Default | Meaning |
|---|---|---|
| `data-desk-slug` | `dmi` | Which studio to open |
| `data-desk-base` | the script's own origin | Where the desk is hosted |
| `data-desk-bubble` | shown | `false` hides our floating bubble |
| `data-desk-label` | `Talk to Support` | Accessible label / tooltip |
| `data-desk-position` | `right` | `right` or `left` |
| `data-desk-color` | the studio's brand colour | Accent for the bubble |

Example - a left-aligned bubble in the brand red:

```html
<script src="https://desk.dmi.com.ng/embed.js"
        data-desk-position="left"
        data-desk-color="#e40014" defer></script>
```

---

## How it works

- The panel is an **iframe** served from our domain. The client's page does not
  load the AI, the corpus, or any keys - it just shows the window.
- Styling is isolated, so the desk cannot clash with the client's CSS, and the
  client's CSS cannot break the desk.
- It works on any platform that allows a script tag: WordPress, Wix,
  Squarespace, Webflow, or hand-written HTML.
- On phones (<= 480px wide) the desk opens full-screen.

## Hosting

The desk must be reachable over HTTPS at a stable URL (e.g.
`https://desk.dmi.com.ng`) before the snippet is pasted on the live site. Until
then, use the preview URL and test with `data-desk-base` pointed at it.
