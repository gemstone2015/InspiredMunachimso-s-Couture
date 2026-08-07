const baseUrl = String(process.argv[2] || process.env.SMOKE_TEST_URL || "http://localhost:4000").replace(/\/$/, "");

const tests = [
  { name: "root", path: "/", validate: (data) => data?.success === true },
  { name: "health", path: "/api/health", validate: (data) => data?.status === "ok" },
  { name: "site settings", path: "/api/site-settings/public", validate: (data) => Boolean(data) },
  { name: "products", path: "/api/products", validate: (data) => Array.isArray(data) || Array.isArray(data?.products) },
  { name: "collections", path: "/api/collections/public", validate: (data) => Array.isArray(data) || Array.isArray(data?.collections) },
];

async function run() {
  let failures = 0;
  for (const test of tests) {
    try {
      const response = await fetch(`${baseUrl}${test.path}`, {
        headers: { Accept: "application/json", "User-Agent": "IMC-Smoke-Test/1.0" },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !test.validate(data)) {
        failures += 1;
        console.error(`FAIL ${test.name}: HTTP ${response.status}`);
      } else {
        console.log(`PASS ${test.name}: HTTP ${response.status}`);
      }
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${test.name}: ${error.message}`);
    }
  }
  if (failures) process.exit(1);
  console.log(`Smoke test passed: ${tests.length} checks against ${baseUrl}`);
}

run();
