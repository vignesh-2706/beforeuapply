// export interface Env {
//   AI: Ai;
// }
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

    const prompt = `You are revising a resume's LaTeX source to better match a job description.
Do not fabricate experience or skills the person doesn't have. Only rephrase and
emphasize existing bullet points to naturally surface these relevant, truthful terms
where genuinely applicable: ${missingTerms.join(", ")}.
Preserve all LaTeX commands and structure exactly. Return ONLY the revised LaTeX
source, nothing else -- no explanation, no markdown fences.

Job description:
${jobDescription}

Current resume LaTeX:
${latex}`;

  const response = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
  messages: [{ role: "user", content: prompt }],
  max_tokens: 2048,
});

    return new Response(JSON.stringify({ latex: (response as any).response }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  },
};