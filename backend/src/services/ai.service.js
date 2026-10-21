export const askAI = async function* (messages, summary = "", ragContext = "") {
const formattedRagContext = Array.isArray(ragContext)
  ? ragContext
      .map(
        (item, index) =>
          `[Document ${index + 1}]\n` +
          `Source: ${item.source ?? "Unknown"}\n` +
          `Content:\n${item.content}`
      )
      .join("\n\n")
  : ragContext;


const systemPrompt = `
    You are a strict document-grounded assistant.
    Your ONLY job is to answer the user's question using the "RETRIEVED DOCUMENT CONTEXT" provided below.

    STRICT GROUNDING RULES:
    1. Read the "RETRIEVED DOCUMENT CONTEXT" carefully.
    2. Answer the question using ONLY the facts present in the "RETRIEVED DOCUMENT CONTEXT" or earlier conversation summary.
    3. DOMAIN RESTRICTION: This assistant is exclusively designed to answer questions about Hassan's personal data, professional background, and projects. If the user's query is NOT related to Hassan, you MUST reject the prompt and reply ONLY with: "I can only provide information related to Hassan's personal data and portfolio."
    4. If the query is about Hassan but the answer is NOT explicitly stated in the "RETRIEVED DOCUMENT CONTEXT", you MUST reply with: "I am sorry, but I do not have that information"
    5. NEVER use your own outside knowledge, pre-trained memory, or assumptions to answer general questions (like coding, history, or math) unless it is explicitly written in the document context.
    6. Do not invent or guess any information.

    RETRIEVED DOCUMENT CONTEXT:
    ${formattedRagContext || "No relevant document context found for this query."}
  `;

  const apiMessages = [{ role: "system", content: systemPrompt }];

  if (summary) {
    apiMessages.push({
      role: "system",
      content: `Context from earlier in this conversation:\n${summary}`,
    });
  }

  apiMessages.push(...messages);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "minimax/minimax-m3.1-flash:free",
      messages: apiMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "OpenRouter request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === "data: [DONE]") continue;

      if (trimmedLine.startsWith("data: ")) {
        try {
          const jsonStr = trimmedLine.slice(6);
          const parsed = JSON.parse(jsonStr);
          const contentDelta = parsed.choices?.[0]?.delta?.content || "";

          if (contentDelta) {
            yield contentDelta;
          }
        } catch (error) {
          console.error("Stream parsing error on line:", trimmedLine, error);
        }
      }
    }
  }
};