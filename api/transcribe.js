export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    response.status(500).json({ error: "OPENAI_API_KEY is not configured." });
    return;
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": request.headers["content-type"],
    },
    body: Buffer.concat(chunks),
  });

  const body = await openaiResponse.text();
  response.status(openaiResponse.status);
  response.setHeader("Content-Type", openaiResponse.headers.get("content-type") || "application/json");
  response.send(body);
}
