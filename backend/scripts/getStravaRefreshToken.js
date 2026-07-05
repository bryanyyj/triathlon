import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

dotenv.config({ path: envPath });

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const CALLBACK_PORT = 3043;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/exchange_token`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in backend/.env before running this script.");
  process.exit(1);
}

const authorizeUrl =
  `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}` +
  `&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&approval_prompt=force&scope=activity:read_all`;

console.log("\nOpen this URL in your browser and authorize the app:\n");
console.log(authorizeUrl);
console.log(`\nWaiting for the redirect back to ${REDIRECT_URI} ...\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);

  if (url.pathname !== "/exchange_token") {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end(`Strava authorization failed: ${error}`);
    console.error(`Strava authorization failed: ${error}`);
    server.close();
    process.exit(1);
    return;
  }

  try {
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      throw new Error(`Token exchange failed (${tokenResponse.status}): ${text}`);
    }

    const data = await tokenResponse.json();

    writeRefreshTokenToEnv(data.refresh_token);

    res
      .writeHead(200, { "Content-Type": "text/plain" })
      .end("Success! Refresh token saved to backend/.env. You can close this tab.");

    console.log("Refresh token obtained and saved to backend/.env as STRAVA_REFRESH_TOKEN.");
    console.log(`Athlete: ${data.athlete?.firstname || ""} ${data.athlete?.lastname || ""}`.trim());
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" }).end(err.message);
    console.error(err.message);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(CALLBACK_PORT);

function writeRefreshTokenToEnv(refreshToken) {
  let contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  if (/^STRAVA_REFRESH_TOKEN=.*$/m.test(contents)) {
    contents = contents.replace(/^STRAVA_REFRESH_TOKEN=.*$/m, `STRAVA_REFRESH_TOKEN=${refreshToken}`);
  } else {
    contents += `${contents.endsWith("\n") || contents === "" ? "" : "\n"}STRAVA_REFRESH_TOKEN=${refreshToken}\n`;
  }

  fs.writeFileSync(envPath, contents);
}
