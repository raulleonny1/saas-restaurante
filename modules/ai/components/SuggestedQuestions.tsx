"use client";

import { SUGGESTED_QUESTIONS } from "@/modules/ai/domain/intents";
import { Button } from "@/ui";

export function SuggestedQuestions({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (q: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTED_QUESTIONS.map((q) => (
        <Button
          key={q.label}
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => onPick(q.label)}
        >
          {q.label}
        </Button>
      ))}
    </div>
  );
}
