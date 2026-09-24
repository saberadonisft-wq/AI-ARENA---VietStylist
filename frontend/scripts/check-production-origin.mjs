const value = process.env.NEXT_PUBLIC_API_ORIGIN;
let origin;
try {
  origin = new URL(value || "");
} catch {
  console.error("Set NEXT_PUBLIC_API_ORIGIN to the public HTTPS API origin before deployment.");
  process.exit(1);
}

if (
  origin.protocol !== "https:" ||
  ["localhost", "127.0.0.1", "::1"].includes(origin.hostname) ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  origin.username ||
  origin.password
) {
  console.error("NEXT_PUBLIC_API_ORIGIN must be a public HTTPS origin without a path or credentials.");
  process.exit(1);
}

console.log("Production API origin is configured.");
