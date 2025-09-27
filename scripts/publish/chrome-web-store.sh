#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".dev/secrets/chrome-web-store.env"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
fi

: "${EXTENSION_ID:?Missing EXTENSION_ID (set or place in ${ENV_FILE})}"
: "${CLIENT_ID:?Missing CLIENT_ID (set or place in ${ENV_FILE})}"
: "${CLIENT_SECRET:?Missing CLIENT_SECRET (set or place in ${ENV_FILE})}"
: "${REFRESH_TOKEN:?Missing REFRESH_TOKEN (set or place in ${ENV_FILE})}"

ZIP_PATH=${1:-dist/markquote.zip}
API_VERSION_HEADER="x-goog-api-version: 2"
UPLOAD_URL="https://www.googleapis.com/upload/chromewebstore/v1.1/items/${EXTENSION_ID}"
STATUS_URL="https://www.googleapis.com/chromewebstore/v1.1/items/${EXTENSION_ID}"
PUBLISH_URL="https://www.googleapis.com/chromewebstore/v1.1/items/${EXTENSION_ID}/publish"

fetch_token() {
  curl -s "https://accounts.google.com/o/oauth2/token" \
    -d "client_id=${CLIENT_ID}" \
    -d "client_secret=${CLIENT_SECRET}" \
    -d "refresh_token=${REFRESH_TOKEN}" \
    -d "grant_type=refresh_token" | jq -r '.access_token'
}

TOKEN=$(fetch_token)

if [[ ! -f "${ZIP_PATH}" ]]; then
  echo "error: zip file ${ZIP_PATH} not found" >&2
  exit 1
fi

echo "Uploading ${ZIP_PATH} to Chrome Web Store..."
UPLOAD_RESPONSE=$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H "${API_VERSION_HEADER}" \
  -X PUT -T "${ZIP_PATH}" "${UPLOAD_URL}")

UPLOAD_STATE=$(echo "${UPLOAD_RESPONSE}" | jq -r '.uploadState // ""')
if [[ "${UPLOAD_STATE}" != "SUCCESS" ]]; then
  echo "Upload returned state ${UPLOAD_STATE}. Checking status..."
  STATUS_RESPONSE=$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H "${API_VERSION_HEADER}" "${STATUS_URL}")
  FINAL_STATE=$(echo "${STATUS_RESPONSE}" | jq -r '.uploadState // ""')
  if [[ "${FINAL_STATE}" != "SUCCESS" ]]; then
    echo "Upload failed: ${STATUS_RESPONSE}" >&2
    exit 1
  fi
fi

echo "Publishing latest upload..."
PUBLISH_RESPONSE=$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H "${API_VERSION_HEADER}" -X POST "${PUBLISH_URL}?publishTarget=default")
PUBLISH_STATUS=$(echo "${PUBLISH_RESPONSE}" | jq -r '.status[]? // ""')

if [[ "${PUBLISH_STATUS}" != "OK" ]]; then
  echo "Publish response: ${PUBLISH_RESPONSE}" >&2
  exit 1
fi

echo "Publish complete. Response: ${PUBLISH_RESPONSE}"
