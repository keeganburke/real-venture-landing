// Whop user IDs allowed to see /dashboard/admin/*
// Add more IDs to this array to grant access.
export const ADMIN_WHOP_USER_IDS = [
  "user_NvRy1ntPoXhxl", // Keegan
] as const;

export function isAdmin(whopUserId: string | null | undefined): boolean {
  if (!whopUserId) return false;
  return (ADMIN_WHOP_USER_IDS as readonly string[]).includes(whopUserId);
}
