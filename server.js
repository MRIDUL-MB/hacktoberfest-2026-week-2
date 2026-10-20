const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5vl:3b";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 12 * 1024 * 1024;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;

    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error("Request is too large. Use an image smaller than 8 MB."));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function validateInput(input) {
  if (!input || typeof input !== "object") return "Add product details before generating.";
  if (typeof input.notes !== "string" || !input.notes.trim()) {
    return "Tell us a little about the item before generating.";
  }
  if (input.notes.length > 2000) return "Product notes must be 2,000 characters or fewer.";
  if (typeof input.marketplace !== "string" || !["Etsy", "eBay", "Shopify"].includes(input.marketplace)) {
    return "Choose Etsy, eBay, or Shopify as the marketplace.";
  }
  if (typeof input.tone !== "string" || !["Warm & personal", "Clean & modern", "Playful"].includes(input.tone)) {
    return "Choose a listing tone.";
  }
  if (input.image !== undefined) {
    if (typeof input.image !== "string" || !/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/]+=*$/.test(input.image)) {
      return "Upload a JPEG, PNG, or WebP product photo.";
    }
    if (input.image.length > 11 * 1024 * 1024) return "Image is too large. Choose an image smaller than 8 MB.";
  }
  return null;
}

async function generateListing(request, response) {
  let input;
  try {
    input = await readJson(request);
  } catch (error) {
    if (!response.destroyed) sendJson(response, 400, { error: error.message });
    return;
  }

  const validationError = validateInput(input);
  if (validationError) {
    sendJson(response, 400, { error: validationError });
    return;
  }

  const facts = [
    `Marketplace: ${input.marketplace}`,
    `Tone: ${input.tone}`,
    `Seller's product notes: ${input.notes.trim()}`,
    input.price ? `Seller's target price: ${input.price}` : "",
  ].filter(Boolean).join("\n");

  const userMessage = {
    role: "user",
    content: `Create a marketplace listing using the seller's facts. Do not invent materials, dimensions, origin, age, or condition. If a detail is unknown, omit it or mark it as something the seller should confirm.\n\n${facts}`,
  };
  if (input.image) {
    userMessage.images = [input.image.slice(input.image.indexOf(",") + 1)];
  }

  let ollamaResponse;
  try {
    ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            category: { type: "string" },
            price_guidance: { type: "string" },
            seller_checklist: { type: "array", items: { type: "string" } },
          },
          required: ["title", "description", "tags", "category", "price_guidance", "seller_checklist"],
        },
        messages: [
          {
            role: "system",
            content: "You are Open Shelf, a careful marketplace copywriter for independent sellers. Return only valid JSON matching the requested schema. Write an accurate, appealing listing; never make up product facts. Make the title searchable and concise, the description easy to scan, and tags useful for the chosen marketplace. Keep pricing guidance cautious and explain that it is a starting point, not an appraisal. If a photo is provided, describe only clearly visible details. Include any important unknowns in seller_checklist.",
          },
          userMessage,
        ],
        options: { temperature: 0.65 },
      }),
    });
  } catch (error) {
    sendJson(response, 502, {
      error: `Can't reach Ollama at ${OLLAMA_URL}. Start Ollama and make sure the ${MODEL} model is installed.`,
    });
    return;
  }

  if (!ollamaResponse.ok) {
    const detail = await ollamaResponse.text();
    const message = ollamaResponse.status === 404
      ? `The ${MODEL} model isn't installed. Run "ollama pull ${MODEL}" and try again.`
      : `Ollama returned an error (${ollamaResponse.status}): ${detail.slice(0, 300)}`;
    sendJson(response, 502, { error: message });
    return;
  }

  let result;
  try {
    const data = await ollamaResponse.json();
    result = JSON.parse(data.message.content);
  } catch {
    sendJson(response, 502, { error: "The local model returned an unreadable listing. Please try again." });
    return;
  }

  sendJson(response, 200, { listing: result, model: MODEL });
}

function serveStatic(request, response) {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const requestedFile = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = path.resolve(PUBLIC_DIR, requestedFile);

  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(contents);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/listing") {
    generateListing(request, response);
    return;
  }

  if (request.method === "GET") {
    serveStatic(request, response);
    return;
  }

  response.writeHead(405, { Allow: "GET, POST" });
  response.end("Method not allowed");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Open Shelf is running at http://localhost:${PORT}`);
  console.log(`Local model: ${MODEL} (Ollama at ${OLLAMA_URL})`);
});
