import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const body = await req.json();
  const { messages } = body;
  const authorization = req.headers.get("authorization") ?? "";
  const apiKey = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!apiKey) {
    return new Response("Missing OpenAI API key", { status: 401 });
  }

  const openai = createOpenAI({ apiKey });

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
