import { redirect } from "next/navigation";

// /manage-membership/cancel has no content of its own; the flow starts at
// the reason page.
export default function CancelIndexPage() {
  redirect("/manage-membership/cancel/reason");
}
