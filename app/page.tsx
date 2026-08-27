import HomeClient from "./home-client";
import { getReviews } from "./lib/whop-reviews";

// Server component: fetches Whop reviews (6h ISR in lib) and hands the whole
// interactive landing page to the client component.
export default async function Home() {
  const reviewsData = await getReviews();
  return <HomeClient reviewsData={reviewsData} />;
}
