// Re-export from admin.ts to keep a single source of truth for the
// service-role Supabase client. Previous implementation lived here;
// callers were not migrated to avoid churn.
export { createAdminClient } from "./admin";
