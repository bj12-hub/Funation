// Runs inside a page. Returns every visible inline <svg> keyed by the walker signature (width:first-path-d-40),
// with currentColor resolved to the computed color, plus a short label from the nearest text.
(() => {
  const out = {};
  for (const el of document.querySelectorAll("svg")) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const d = el.querySelector("path")?.getAttribute("d");
    if (!d) continue;
    const sig = el.getAttribute("width") + ":" + d.replace(/\s+/g, "").slice(0, 40);
    if (out[sig]) continue;
    const color = getComputedStyle(el).color;
    const clone = el.cloneNode(true);
    clone.removeAttribute("class");
    clone.removeAttribute("aria-hidden");
    clone.removeAttribute("style");
    if (!clone.getAttribute("width")) clone.setAttribute("width", String(Math.round(r.width)));
    if (!clone.getAttribute("height")) clone.setAttribute("height", String(Math.round(r.height)));
    let svg = clone.outerHTML.split("currentColor").join("#9CA3AF");
    let host = el.parentElement, label = "";
    for (let i = 0; i < 4 && host && !label; i++, host = host.parentElement) label = (host.getAttribute("aria-label") || host.innerText || "").replace(/\s+/g, " ").trim().slice(0, 16);
    out[sig] = { svg, cc: el.outerHTML.includes("currentColor"), color, label, w: Math.round(r.width), h: Math.round(r.height) };
  }
  return JSON.stringify(out);
})()
