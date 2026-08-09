function csvCell(value) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export const FIELD_TEST_HEADERS = [
  "scanned_at",
  "isbn",
  "title",
  "author",
  "copies",
  "cost_per_book",
  "buy_threshold",
  "app_status_est",
  "app_recommended_channel_est",
  "app_amazon_price_est",
  "app_ebay_price_est",
  "app_amazon_net_est",
  "app_ebay_net_est",
  "app_velocity_est",
  "app_restricted_est",
  "actual_source_checked",
  "amazon_eligible",
  "amazon_actual_price",
  "amazon_actual_rank",
  "ebay_sold_comp",
  "actual_shipping",
  "actual_fees",
  "actual_net",
  "real_decision",
  "notes",
];

export const ACTUAL_FIELD_DEFAULTS = {
  actual_source_checked: "",
  amazon_eligible: "",
  amazon_actual_price: "",
  amazon_actual_rank: "",
  ebay_sold_comp: "",
  actual_shipping: "",
  actual_fees: "",
  actual_net: "",
  real_decision: "",
  notes: "",
};

function verificationForEntry(entry, verification = {}) {
  return verification[entry.id] || verification[entry.isbn] || {};
}

export function fieldTestRows(entries, { cost, threshold, verification = {} }) {
  return entries.map((entry) => {
    const bestNet = Math.max(entry.amazonNet, entry.ebayNet ?? -Infinity);
    const appStatus = entry.restricted ? "check" : bestNet >= threshold ? "buy" : "pass";
    const actual = {
      ...ACTUAL_FIELD_DEFAULTS,
      ...verificationForEntry(entry, verification),
    };

    return {
      scanned_at: entry.at ? new Date(entry.at).toISOString() : "",
      isbn: entry.isbn,
      title: entry.title,
      author: entry.author,
      copies: entry.count ?? 1,
      cost_per_book: cost,
      buy_threshold: threshold,
      app_status_est: appStatus,
      app_recommended_channel_est: entry.winner,
      app_amazon_price_est: entry.amazonPrice?.toFixed?.(2) ?? entry.amazonPrice,
      app_ebay_price_est: entry.ebayPrice?.toFixed?.(2) ?? entry.ebayPrice,
      app_amazon_net_est: entry.amazonNet?.toFixed?.(2) ?? entry.amazonNet,
      app_ebay_net_est: entry.ebayNet?.toFixed?.(2) ?? entry.ebayNet,
      app_velocity_est: entry.velocity?.tier ?? "",
      app_restricted_est: entry.restricted ? "yes" : "no",
      ...actual,
    };
  });
}

export function toCsv(rows, headers = FIELD_TEST_HEADERS) {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
}

export function fieldTestCsv(entries, options) {
  return toCsv(fieldTestRows(entries, options));
}
