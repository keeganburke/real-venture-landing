// Server-side Whop reviews fetch with hardcoded fallback. Runs from the
// app/page.tsx server component only; WHOP_API_KEY never reaches the client.

export interface WhopReview {
  id: string;
  rating: number;
  content: string;
  author: {
    username: string;
    avatar_url?: string;
  };
  created_at: string;
}

export interface ReviewsData {
  reviews: WhopReview[];
  average: number;
  total: number;
  source: "whop" | "fallback";
}

const FALLBACK_REVIEWS: WhopReview[] = [
  { id: "fb-01", rating: 5, content: "The buyer network is the whole game. Analyzed a deal Monday, had a buyer Wednesday, closed $16k Friday.", author: { username: "jordan_l" }, created_at: "2025-06-15T00:00:00Z" },
  { id: "fb-02", rating: 5, content: "I've bought 3 other wholesaling courses. This is the only one where the founders actually respond and the tools actually work.", author: { username: "alex_m" }, created_at: "2025-06-20T00:00:00Z" },
  { id: "fb-03", rating: 5, content: "Live calls with William are worth the $50 alone. Bring a deal, leave with a plan.", author: { username: "devon_k" }, created_at: "2025-07-01T00:00:00Z" },
  { id: "fb-04", rating: 5, content: "Closed my first assignment 12 days after joining. $8k. The deal analyzer is a cheat code.", author: { username: "marcus_t" }, created_at: "2025-07-05T00:00:00Z" },
  { id: "fb-05", rating: 5, content: "The Discord is active 24/7. Asked a question at 2am, had 3 answers by morning.", author: { username: "sara_r" }, created_at: "2025-07-10T00:00:00Z" },
  { id: "fb-06", rating: 5, content: "Went from zero to first wire in 3 weeks. The 14-day sprint actually works if you do the work.", author: { username: "casey_p" }, created_at: "2025-07-15T00:00:00Z" },
  { id: "fb-07", rating: 5, content: "Keegan replies to DMs within hours. William reviews every deal on the live calls. Insane value.", author: { username: "riley_b" }, created_at: "2025-07-20T00:00:00Z" },
  { id: "fb-08", rating: 5, content: "The contract templates saved me from spending $500 on a lawyer. Everything I needed was already built in.", author: { username: "taylor_f" }, created_at: "2025-07-25T00:00:00Z" },
  { id: "fb-09", rating: 5, content: "This community is different. Everyone actually helps each other, no one is gatekeeping.", author: { username: "morgan_s" }, created_at: "2025-08-01T00:00:00Z" },
  { id: "fb-10", rating: 5, content: "I was analysis paralysis for months. Real Venture forced me into action. $12k assignment three weeks later.", author: { username: "jamie_w" }, created_at: "2025-08-05T00:00:00Z" },
  { id: "fb-11", rating: 5, content: "The buyer directory alone is worth 10x the monthly cost. Real cash buyers, real markets, real deals.", author: { username: "blake_h" }, created_at: "2025-08-10T00:00:00Z" },
  { id: "fb-12", rating: 5, content: "Best decision I made this year. The step by step is dummy proof and the community keeps you accountable.", author: { username: "quinn_a" }, created_at: "2025-08-12T00:00:00Z" },
  { id: "fb-13", rating: 5, content: "William's live seller calls changed everything for me. Watched how he handles objections and copied it. Works.", author: { username: "reese_o" }, created_at: "2025-08-15T00:00:00Z" },
  { id: "fb-14", rating: 5, content: "For $20/month you get more than most $2000 courses. Not even close. This is the real deal.", author: { username: "avery_c" }, created_at: "2025-08-18T00:00:00Z" },
  { id: "fb-15", rating: 5, content: "Just closed my second deal this month. $22k combined. Six months ago I didn't even know what wholesaling was.", author: { username: "chris_d" }, created_at: "2025-08-20T00:00:00Z" },
];

export async function getReviews(): Promise<ReviewsData> {
  const productId = process.env.WHOP_PRODUCT_ID || "prod_eLIKs90t1mwlU";
  const apiKey = process.env.WHOP_API_KEY;

  const fallback: ReviewsData = {
    reviews: FALLBACK_REVIEWS,
    average: 5.0,
    total: FALLBACK_REVIEWS.length,
    source: "fallback",
  };

  if (!apiKey) {
    return fallback;
  }

  try {
    const res = await fetch(
      `https://api.whop.com/api/v1/reviews?product_id=${productId}&first=50`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 21600 }, // 6 hours
      }
    );

    if (!res.ok) return fallback;

    const data = await res.json();
    // Adapt to Whop's actual response shape: rows arrive under data or reviews.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews: WhopReview[] = (data.data || data.reviews || []).map((r: any) => ({
      id: r.id,
      rating: r.stars || r.rating || 5,
      content: r.content || r.body || "",
      author: {
        username: r.user?.username || r.author?.username || "member",
        avatar_url: r.user?.image_url || r.author?.avatar_url,
      },
      created_at: r.created_at,
    }));

    if (reviews.length === 0) return fallback;

    const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    return {
      reviews,
      average: Math.round(average * 10) / 10,
      total: reviews.length,
      source: "whop",
    };
  } catch {
    return fallback;
  }
}
