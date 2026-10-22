import { WHOP_API_VERSION_DATE, rowOwner, rowProduct, type WhopMembershipRow } from "../app/api/whop/whop-membership";

// GET /memberships?company_id&product_id&status=paused, paged. This list is
// the flag Whop's dashboard calls "Paused" (verified 2026-10-22: 15 of 1286
// rows, every one of them paused; combined with user_id it returns exactly
// that user's paused memberships). The membership object itself only shows
// most_recent_action "paused_at", which a later action can overwrite, so the
// list is the primary signal and most_recent_action the second.
// Shared by the Discord sweep (paused = live, never kicked) and the pause
// resume cron.

const WHOP_API = "https://api.whop.com/api/v1";
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

function readHeaders(): Record<string, string> {
  const key = process.env.WHOP_API_KEY;
  if (!key) throw new Error("WHOP_API_KEY unset");
  return { Authorization: `Bearer ${key}`, Accept: "application/json", "Api-Version-Date": WHOP_API_VERSION_DATE };
}

export type PausedListResult =
  | { ok: true; rows: WhopMembershipRow[]; pages: number }
  | { ok: false; error: string };

// GET /memberships?company_id&product_id&status=paused, paged. Singular
// filters (the plural ones are ignored on the key's API version). A row for
// another product or a stuck cursor means the read cannot be trusted.
export async function listPausedMemberships(): Promise<PausedListResult> {
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID;
  if (!companyId || !productId) return { ok: false, error: "WHOP_COMPANY_ID or WHOP_PRODUCT_ID unset" };
  const rows: WhopMembershipRow[] = [];
  let after: string | null = null;
  let pages = 0;
  try {
    for (; pages < MAX_PAGES; pages++) {
      const params = new URLSearchParams({ company_id: companyId, product_id: productId, status: "paused", first: String(PAGE_LIMIT) });
      if (after) params.set("after", after);
      const res = await fetch(`${WHOP_API}/memberships?${params.toString()}`, { headers: readHeaders(), cache: "no-store" });
      if (!res.ok) return { ok: false, error: `paused list HTTP ${res.status}` };
      const page = (await res.json().catch(() => null)) as
        | { data?: unknown[]; page_info?: { has_next_page?: boolean; end_cursor?: string | null } }
        | null;
      const data = (Array.isArray(page?.data) ? page!.data : []).filter(
        (m): m is WhopMembershipRow => !!m && typeof m === "object"
      );
      for (const m of data) {
        const product = rowProduct(m);
        if (product !== null && product !== productId) {
          return { ok: false, error: "foreign product in paused list (product_id filter ignored)" };
        }
        if (rowOwner(m) === null || typeof m.id !== "string") {
          return { ok: false, error: "paused list row without owner or id" };
        }
        rows.push(m);
      }
      const hasNext = page?.page_info?.has_next_page === true;
      const next = page?.page_info?.end_cursor ?? null;
      if (!hasNext || data.length === 0) break;
      if (!next || next === after) return { ok: false, error: "paused list cursor did not advance" };
      after = next;
    }
  } catch (err) {
    return { ok: false, error: `paused list threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
  if (pages >= MAX_PAGES) return { ok: false, error: `paused list exceeded ${MAX_PAGES} pages` };
  return { ok: true, rows, pages: pages + 1 };
}
