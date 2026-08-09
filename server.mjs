import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeToIsbn13 } from "./src/lib/isbn.js";
import {
  parseGoogleBooks,
  parseOpenLibraryBooks,
  parseOpenLibrarySearch,
} from "./src/providers/liveProvider.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(__dirname, "dist");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`catalog source failed: ${res.status}`);
  return res.json();
}

async function lookupCatalog(isbn) {
  const booksParams = new URLSearchParams({
    bibkeys: `ISBN:${isbn}`,
    format: "json",
    jscmd: "data",
  });
  const books = await fetchJson(`https://openlibrary.org/api/books?${booksParams}`);
  const booksHit = parseOpenLibraryBooks(isbn, books);
  if (booksHit?.title) return { ...booksHit, source: "openlibrary" };

  const searchParams = new URLSearchParams({
    isbn,
    fields: "title,author_name,isbn",
  });
  const search = await fetchJson(`https://openlibrary.org/search.json?${searchParams}`);
  const searchHit = parseOpenLibrarySearch(search);
  if (searchHit?.title) return { ...searchHit, source: "openlibrary-search" };

  const googleParams = new URLSearchParams({
    q: `isbn:${isbn}`,
    projection: "lite",
  });
  const google = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${googleParams}`);
  const googleHit = parseGoogleBooks(google);
  if (googleHit?.title) return { ...googleHit, source: "google-books" };

  return null;
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const rawPath = decodeURIComponent(url.pathname);
  const safePath = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const requested = safePath === "/" ? "/index.html" : safePath;
  const filePath = join(distDir, requested);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    const type = contentTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
    res.end(body);
  } catch (err) {
    const body = await readFile(join(distDir, "index.html"));
    res.writeHead(200, { "content-type": contentTypes[".html"], "cache-control": "no-cache" });
    res.end(body);
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api/catalog") {
      const isbn = normalizeToIsbn13(url.searchParams.get("isbn"));
      if (!isbn) {
        sendJson(res, 400, { error: "valid ISBN required" });
        return;
      }

      const hit = await lookupCatalog(isbn);
      if (!hit) {
        sendJson(res, 404, { error: "catalog match not found" });
        return;
      }
      sendJson(res, 200, { isbn, ...hit });
      return;
    }

    await serveStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { error: "server error" });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`ShelfMargin preview listening on ${port}`);
});
