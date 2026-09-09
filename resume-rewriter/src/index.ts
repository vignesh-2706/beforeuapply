export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST") {
      return new Response("Use POST", { status: 405, headers });
    }

    const { latex, jobDescription, missingTerms } = await request.json() as {
      latex: string;
      jobDescription: string;
      missingTerms: string[];
    };

    const prompt = `You are evaluating and improving a resume against a job description.

Job description:
${jobDescription}

Current resume (LaTeX source):
${latex}

Keyword gaps a simple text scan already found (for reference, not exhaustive):
${missingTerms.join(", ")}

Do two things:
1. Judge how well the resume genuinely matches this job, 0-100, based on real skill/experience overlap -- not just keyword presence.
2. Rewrite the resume's LaTeX to authentically emphasize truthful overlap with the job description. Do NOT fabricate experience, skills, or tools the person doesn't have. Preserve all LaTeX commands and structure exactly -- every \\resumeItem{...} and other command must have its closing brace.

Return ONLY valid JSON in this exact shape, nothing else -- no markdown fences, no explanation:
{"score": <number 0-100>, "missingSkills": [<up to 8 strings, real gaps only>], "revisedLatex": "<the full revised LaTeX as a single string>"}`;

    const aiResponse: any = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      max_completion_tokens: 4000,
      reasoning_effort: "low",
      chat_template_kwargs: { enable_thinking: false },
    });

    // This model returns an OpenAI-style chat completion object
    // (choices[0].message.content), not the simpler {response: "..."}
    // shape other Workers AI models use. Handle both, since Cloudflare's
    // catalog isn't consistent across models.
    const rawText: string =
      aiResponse?.choices?.[0]?.message?.content ??
      aiResponse?.response ??
      "";

    let parsed;
    try {
      let text = rawText.trim();
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        text = text.slice(firstBrace, lastBrace + 1);
      }
      parsed = JSON.parse(text);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Model returned unparseable output", rawShape: aiResponse }),
        { status: 502, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  },
};