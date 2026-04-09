/**
 * Bootstrap a Bazarr test instance:
 * 1. Wait for the container to be healthy via /api/system/ping
 * 2. Return the pre-configured API key for test use
 *
 * The docker-compose.test.yml mounts a config.yaml with a known API key,
 * so no onboarding or session auth is needed.
 */

const BASE_URL = process.env.BAZARR_TEST_URL ?? "http://localhost:16768";
const API_KEY = "d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f";

async function waitForHealthy(maxWaitMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/system/ping`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Bazarr not healthy after ${maxWaitMs}ms at ${BASE_URL}`);
}

export interface TestContext {
  baseUrl: string;
  apiKey: string;
}

let _cached: TestContext | null = null;

export async function bootstrap(): Promise<TestContext> {
  if (_cached) return _cached;

  console.log("Waiting for Bazarr to be healthy...");
  await waitForHealthy();

  // Verify the API key works
  console.log("Verifying API key...");
  const res = await fetch(`${BASE_URL}/api/system/status`, {
    headers: { "X-API-KEY": API_KEY },
  });
  if (!res.ok) {
    throw new Error(`API key verification failed: ${res.status} ${await res.text()}`);
  }

  _cached = { baseUrl: BASE_URL, apiKey: API_KEY };
  console.log("Bootstrap complete.");
  return _cached;
}
