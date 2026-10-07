const apiUrl = process.env.VITE_API_URL;
if (!apiUrl) {
  throw new Error("VITE_API_URL must be set before building the frontend.");
}

let parsedApiUrl;
try {
  parsedApiUrl = new URL(apiUrl);
} catch {
  throw new Error("VITE_API_URL must be an absolute HTTP(S) URL.");
}

if (!["http:", "https:"].includes(parsedApiUrl.protocol)) {
  throw new Error("VITE_API_URL must use HTTP or HTTPS.");
}

if (process.env.APP_ENV === "production" && parsedApiUrl.protocol !== "https:") {
  throw new Error("Production VITE_API_URL must use HTTPS.");
}
