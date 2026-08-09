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
    expect(hit.author).toBe("Catalog Author");
    expect(hit.catalogSource).toBe("openlibrary");
    expect(hit.priceSource).toBe("estimated");
    expect(hit.amazonPrice).toEqual(expect.any(Number));
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
