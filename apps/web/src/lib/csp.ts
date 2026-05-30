const maxSensitiveDigitRun = 7;
const nonceByteLength = 18;

export function createCspNonce() {
  const bytes = new Uint8Array(nonceByteLength);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    crypto.getRandomValues(bytes);
    const nonce = base64UrlEncode(bytes);
    if (!hasSensitiveDigitRun(nonce)) {
      return nonce;
    }
  }

  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).replace(/\d{8,}/g, "A");
}

export function hasSensitiveDigitRun(value: string) {
  return new RegExp(`\\d{${maxSensitiveDigitRun + 1},}`).test(value);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
