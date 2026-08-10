export function signupsEnabled() {
  return process.env.NEXT_PUBLIC_SIGNUPS_ENABLED !== "false";
}
