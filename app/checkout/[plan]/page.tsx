import { redirect } from "next/navigation";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ plan: string }>;
}) {
  const { plan } = await params;
  // Route deprecated: checkout now lives in the pricing modal on the landing page.
  // Redirect to home with the pricing params so the modal opens at the right step.
  redirect(`/?pricing=1&plan=${plan}`);
}
