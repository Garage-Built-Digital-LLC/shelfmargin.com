import { describe, expect, it } from "vitest";
import {
  createLiveProvider,
  parseGoogleBooks,
  parseOpenLibraryBooks,
  parseOpenLibrarySearch,
} from "../providers/liveProvider.js";

const ISBN = "9780306406157";

describe("live catalog provider", () => {
  it("parses Open Library Books API data", () => {
    expect(parseOpenLibraryBooks(ISBN, {
      [`ISBN:${ISBN}`]: {
        title: "Error-correction coding for digital communications",
        authors: [{ name: "George C. Clark Jr." }, { name: "J. Bibb Cain" }],
      },
    })).toEqual({
      title: "Error-correction coding for digital communications",
      author: "George C. Clark Jr., J. Bibb Cain",
    });
  });

  it("parses Open Library Search API data", () => {
    expect(parseOpenLibrarySearch({
      docs: [{ title: "Clean Code", author_name: ["Robert C. Martin"] }],
    })).toEqual({ title: "Clean Code", author: "Robert C. Martin" });
  });

  it("parses Google Books volume data", () => {
    expect(parseGoogleBooks({
      items: [{ volumeInfo: { title: "Title", subtitle: "Subtitle", authors: ["A. Writer"] } }],
    })).toEqual({ title: "Title: Subtitle", author: "A. Writer" });
  });

  it("returns live catalog metadata with estimated resale pricing", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        [`ISBN:${ISBN}`]: {
          title: "Real Catalog Title",
          authors: [{ name: "Catalog Author" }],
        },
      }),
    });
    const provider = createLiveProvider({ fetchImpl });
    const hit = await provider.lookup(ISBN);

    expect(hit.title).toBe("Real Catalog Title");
    expect(hit.isbn).toBe(ISBN);
    expect(hit.author).toBe("Catalog Author");
    expect(hit.catalogSource).toBe("openlibrary");
    expect(hit.priceSource).toBe("estimated");
    expect(hit.amazonPrice).toEqual(expect.any(Number));
  });

  it("preserves Amazon catalog metadata while keeping resale pricing estimated", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        title: "Clean Code",
        author: "Robert C. Martin",
        asin: "B001234567",
        source: "amazon-sp-api-sandbox",
        catalogSource: "amazon-sp-api-sandbox",
        amazonMode: "sandbox",
        marketplaceId: "ATVPDKIKX0DER",
      }),
    });
    const provider = createLiveProvider({ fetchImpl });
    const hit = await provider.lookup(ISBN);

    expect(hit.title).toBe("Clean Code");
    expect(hit.isbn).toBe(ISBN);
    expect(hit.asin).toBe("B001234567");
    expect(hit.catalogSource).toBe("amazon-sp-api-sandbox");
    expect(hit.amazonMode).toBe("sandbox");
    expect(hit.marketplaceId).toBe("ATVPDKIKX0DER");
    expect(hit.priceSource).toBe("estimated");
  });

  it("falls back to estimated catalog data when public APIs miss", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const provider = createLiveProvider({ fetchImpl });
    const hit = await provider.lookup(ISBN);

    expect(hit.source).toBe("estimated");
    expect(hit.priceSource).toBe("estimated");
    expect(hit.title).toBeTruthy();
  });
});
