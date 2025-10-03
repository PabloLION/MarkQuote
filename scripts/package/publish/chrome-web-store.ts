import fs from "node:fs";
import path from "node:path";

type RequiredEnvKey = "EXTENSION_ID" | "CLIENT_ID" | "CLIENT_SECRET" | "REFRESH_TOKEN";

type ChromeWebStoreConfig = {
  extensionId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type UploadResponse = {
  uploadState?: string;
};

type StatusResponse = {
  uploadState?: string;
};

type PublishResponse = {
  status?: string[];
};

const apiVersionHeader = "x-goog-api-version";
const apiVersionValue = "2";
const envFile = path.resolve(".dev/secrets/chrome-web-store.env");

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const exportStripped = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length)
      : trimmed;
    const separatorIndex = exportStripped.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = exportStripped.slice(0, separatorIndex).trim();
    let value = exportStripped.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireEnv(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing ${key}. Set it in the environment or ${envFile}.`);
  }
  return value;
}

function resolveConfig(): ChromeWebStoreConfig {
  loadEnvFile(envFile);
  return {
    extensionId: requireEnv("EXTENSION_ID"),
    clientId: requireEnv("CLIENT_ID"),
    clientSecret: requireEnv("CLIENT_SECRET"),
    refreshToken: requireEnv("REFRESH_TOKEN"),
  };
}

async function fetchToken(config: ChromeWebStoreConfig): Promise<string> {
  const payload = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://accounts.google.com/o/oauth2/token", {
    method: "POST",
    body: payload,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch token (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Access token missing from OAuth response.");
  }

  return data.access_token;
}

async function uploadPackage(args: {
  token: string;
  extensionId: string;
  zipPath: string;
  zipBuffer: Buffer;
}): Promise<void> {
  const { token, extensionId, zipPath, zipBuffer } = args;
  console.log(`Uploading ${zipPath} to Chrome Web Store...`);

  const uploadUrl = `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extensionId}`;
  const uploadBody = new Uint8Array(zipBuffer);

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      [apiVersionHeader]: apiVersionValue,
    },
    body: uploadBody,
  });

  const payload = (await response.json()) as UploadResponse;
  if (payload.uploadState === "SUCCESS") {
    return;
  }

  console.log(`Upload returned state ${payload.uploadState ?? "UNKNOWN"}. Checking status...`);
  await ensureSuccessfulStatus({ token, extensionId });
}

async function ensureSuccessfulStatus(args: { token: string; extensionId: string }): Promise<void> {
  const { token, extensionId } = args;
  const statusUrl = `https://www.googleapis.com/chromewebstore/v1.1/items/${extensionId}`;
  const statusResponse = await fetch(statusUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      [apiVersionHeader]: apiVersionValue,
    },
  });

  if (!statusResponse.ok) {
    const errorBody = await statusResponse.text();
    throw new Error(`Status check failed (${statusResponse.status}): ${errorBody}`);
  }

  const statusPayload = (await statusResponse.json()) as StatusResponse;
  if (statusPayload.uploadState !== "SUCCESS") {
    throw new Error(`Upload failed: ${JSON.stringify(statusPayload)}`);
  }
}

async function publishLatest(args: {
  token: string;
  extensionId: string;
}): Promise<PublishResponse> {
  const { token, extensionId } = args;
  console.log("Publishing latest upload...");
  const publishUrl = `https://www.googleapis.com/chromewebstore/v1.1/items/${extensionId}/publish?publishTarget=default`;

  const response = await fetch(publishUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      [apiVersionHeader]: apiVersionValue,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Publish failed (${response.status}): ${errorBody}`);
  }

  return (await response.json()) as PublishResponse;
}

function ensurePublishSucceeded(payload: PublishResponse): void {
  const status = payload.status ?? [];
  if (!status.includes("OK")) {
    throw new Error(`Publish response not OK: ${JSON.stringify(payload)}`);
  }
  console.log(`Publish complete. Response: ${JSON.stringify(payload)}`);
}

async function run(): Promise<void> {
  const zipPath = process.argv[2] ?? "dist/markquote.zip";
  const zipBuffer = await fs.promises.readFile(zipPath).catch(() => {
    throw new Error(`Zip file not found: ${zipPath}`);
  });

  const config = resolveConfig();
  const token = await fetchToken(config);
  await uploadPackage({
    token,
    extensionId: config.extensionId,
    zipPath,
    zipBuffer,
  });
  const publishPayload = await publishLatest({ token, extensionId: config.extensionId });
  ensurePublishSucceeded(publishPayload);
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
