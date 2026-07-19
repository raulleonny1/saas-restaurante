export interface LlmRewriteInput {
  question: string;
  briefJson: string;
  draftAnswer: string;
}

export interface LlmPort {
  rewriteManagerAnswer(input: LlmRewriteInput): Promise<string | null>;
}
