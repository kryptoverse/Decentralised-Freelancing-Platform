import { retrieveKnowledge } from "@/lib/worqs-knowledge";

export const maxDuration = 30; // 30 seconds max duration

export async function POST(req: Request) {
  try {
    const { messages, systemContext } = await req.json();

    // Pull in ONLY the platform-knowledge slice relevant to the latest user
    // question. Data-only questions match nothing → zero extra tokens; FAQ
    // questions pull in just the matching section(s). The full knowledge base
    // lives server-side and is never sent on every request.
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const knowledge = retrieveKnowledge(lastUserMessage);

    const systemContent = [
      systemContext || "You are the WORQS AI Assistant. Be concise, helpful, and use markdown.",
      knowledge && `--- WORQS PLATFORM KNOWLEDGE (use this to answer platform/FAQ questions) ---\n${knowledge}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const formattedMessages = [
      { role: "system", content: systemContent },
      ...messages.map((m: any) => ({ role: m.role, content: m.content }))
    ];

    const groqKeys = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY2,
      process.env.GROQ_API_KEY3,
      process.env.GROQ_API_KEY4
    ];
    
    const groqModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768'
    ];

    const providers: { url: string, key: string | undefined, model: string }[] = [];
    
    for (const key of groqKeys) {
      if (key) {
        for (const model of groqModels) {
          providers.push({
            url: 'https://api.groq.com/openai/v1/chat/completions',
            key,
            model
          });
        }
      }
    }

    providers.push({ 
      url: 'https://text.pollinations.ai/openai/v1/chat/completions', 
      key: 'pollinations', 
      model: 'openai' 
    });

    let response: Response | null = null;
    let lastError: any = null;

    for (const provider of providers) {
      // Skip if it requires a key but the key is not in .env.local
      if (!provider.key) continue;

      try {
        const res = await fetch(provider.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.key}`
          },
          body: JSON.stringify({
            model: provider.model,
            messages: formattedMessages,
            stream: true
          })
        });

        if (res.ok) {
          console.log(`[AI Success] Using provider: ${provider.url} (${provider.model})`);
          response = res;
          break; // Successfully connected to an API, break the fallback loop
        } else {
           console.warn(`[AI Fallback] ${provider.url} failed with status: ${res.status}`);
           lastError = new Error(`API error: ${res.status}`);
        }
      } catch (err) {
         console.warn(`[AI Fallback] ${provider.url} fetch threw error:`, err);
         lastError = err;
      }
    }

    if (!response) {
        const errorMessage = lastError?.message || "Unknown error occurred";
        const fallbackMessage = `⚠️ System Notice: All AI providers (including 4 Groq API keys) have failed to respond. Please check your API keys and try again later.\n\nError details: ${errorMessage}`;
        
        return new Response(fallbackMessage, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8'
            }
        });
    }

    // Pass through the SSE stream, extracting only the text to match our frontend's raw text reader
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
            controller.close();
            return;
        }
        
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'data: [DONE]') {
                controller.close();
                return;
            }
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                const content = data.choices[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch (e) {
                // Ignore parse errors on incomplete chunks
              }
            }
          }
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      }
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

