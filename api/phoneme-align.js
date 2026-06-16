export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const alignerUrl = process.env.ALIGNER_API_URL;
  if (!alignerUrl) {
    response.status(501).json({
      error: "ALIGNER_API_URL is not configured.",
      detail: "Deploy aligner-server.mjs on a separate backend and set ALIGNER_API_URL in Vercel.",
    });
    return;
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const headers = {
    "Content-Type": request.headers["content-type"] || "application/octet-stream",
  };

  if (process.env.ALIGNER_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.ALIGNER_API_TOKEN}`;
  }

  try {
    const targetUrl = new URL("/api/phoneme-align", alignerUrl).toString();
    const alignerResponse = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: Buffer.concat(chunks),
    });

    const body = await alignerResponse.text();
    response.status(alignerResponse.status);
    response.setHeader(
      "Content-Type",
      alignerResponse.headers.get("content-type") || "application/json",
    );
    response.send(body);
  } catch (error) {
    response.status(502).json({
      error: "Aligner backend is unavailable.",
      detail: error instanceof Error ? error.message : "Unknown aligner proxy error.",
    });
  }
}
