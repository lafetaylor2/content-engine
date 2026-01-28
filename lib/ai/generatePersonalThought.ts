import "server-only";

export type AIMode = "placeholder" | "ai";

export type PersonalThoughtBasisInput = {
  id: string;
  reference: string;
  source_text: string;
  theme: string;
  notes?: string;
};

export type PersonalThoughtGenerationInput = {
  basis: PersonalThoughtBasisInput;
};

export function getAIMode(): AIMode {
  const raw = process.env.CONTENT_ENGINE_AI_MODE;
  if (raw === "ai") {
    return "ai";
  }
  return "placeholder";
}

function extractSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return [];
  }
  const matches = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!matches) {
    return [cleaned];
  }
  return matches.map((sentence) => sentence.trim());
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.`;
}

function buildBody(sourceText: string, notes: string | null): string {
  const sourceSentences = extractSentences(sourceText);
  const notesSentences = notes ? extractSentences(notes) : [];
  const sentences: string[] = [];

  if (sourceSentences.length > 0) {
    sentences.push(ensureSentence(sourceSentences[0]));
  }

  if (notesSentences.length > 0) {
    sentences.push(ensureSentence(notesSentences[0]));
  } else if (sourceSentences.length > 1) {
    sentences.push(ensureSentence(sourceSentences[1]));
  } else if (sourceSentences.length > 0) {
    sentences.push(
      ensureSentence(
        `Source highlights: ${sourceSentences[0].replace(/[.!?]+$/, "")}`
      )
    );
  }

  return sentences.filter(Boolean).join(" ");
}

export function generatePersonalThought(
  input: PersonalThoughtGenerationInput
): { title: string; body: string } {
  const mode = getAIMode();
  if (mode === "ai") {
    const placeholder = "AI_GENERATION_NOT_ENABLED";
    return { title: placeholder, body: placeholder };
  }

  return {
    title: `Draft thought from ${input.basis.reference}`,
    body: buildBody(input.basis.source_text, input.basis.notes ?? null),
  };
}
