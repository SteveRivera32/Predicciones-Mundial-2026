import fs from "node:fs";
const html = fs.readFileSync(new URL("./espn-page.html", import.meta.url), "utf8");
console.log("h2 in full html", (html.match(/<h2\b/gi) || []).length);

// Try to isolate main story body between first Grupo A h2 and end
const start = html.indexOf('>Grupo A<');
const end = html.lastIndexOf('>Panamá</a>');
console.log("start", start, "end", end);
const slice = html.slice(start - 200, end + 5000);
console.log("slice h2", (slice.match(/<h2\b/gi) || []).length);
