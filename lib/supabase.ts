// Headers for Supabase's REST API, shared by every database store.
//
// Supabase has two kinds of server key, and SUPABASE_SERVICE_ROLE_KEY can hold either:
//   - the older `service_role` key, a JWT starting "eyJ". Supabase is phasing these out.
//   - the newer secret key, starting "sb_secret_". It isn't a JWT, and Supabase's docs say it goes
//     in the `apikey` header only, never in Authorization.
// Both kinds go in `apikey`. Only the older kind also goes in Authorization, as it always has.

export function supabaseHeaders(serviceKey: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: serviceKey, "Content-Type": "application/json" };
  if (serviceKey.startsWith("eyJ")) headers.Authorization = `Bearer ${serviceKey}`;
  return headers;
}
