import { Button, Callout, ChoiceGroup, ScreenPanel } from '@credit-runner/ui';
import { useState } from 'react';
import { QUIZ_QUESTIONS, findQuestion, questionNumber } from '../content/quiz';
import type { QuizQuestion } from '../content/quiz';
import { nextQuizQuestion, quizAnswerFor } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';

interface QuestionCardProps {
  session: Session;
  question: QuizQuestion;
  onNext: () => void;
}

function QuestionCard({ session, question, onNext }: QuestionCardProps) {
  const answerQuiz = useGameStore((store) => store.answerQuiz);
  const completeQuiz = useGameStore((store) => store.completeQuiz);
  const [selected, setSelected] = useState<string | null>(null);
  const answer = quizAnswerFor(session, question.id);
  const following = nextQuizQuestion(session);

  return (
    <ScreenPanel
      badge={`Question ${String(questionNumber(question.id))} of ${String(QUIZ_QUESTIONS.length)}`}
      title={question.prompt}
    >
      <ChoiceGroup<string>
        legend="Choose one answer"
        selected={selected}
        onChange={setSelected}
        disabled={answer !== undefined}
        options={question.options.map((option) => ({ value: option.id, title: option.text }))}
      />
      {answer !== undefined && (
        <Callout
          tone={answer.correct ? 'success' : 'warning'}
          title={answer.correct ? 'Correct.' : 'Not quite.'}
          live
        >
          {question.explanation}
        </Callout>
      )}
      {answer === undefined && (
        <Button
          disabled={selected === null}
          onClick={() => {
            if (selected !== null) answerQuiz(question.id, selected);
          }}
        >
          Check answer
        </Button>
      )}
      {answer !== undefined && following !== undefined && (
        <Button onClick={onNext}>Next question</Button>
      )}
      {answer !== undefined && following === undefined && (
        <Button onClick={completeQuiz}>See my results</Button>
      )}
    </ScreenPanel>
  );
}

export function QuizScreen({ session }: { session: Session }) {
  const [activeId, setActiveId] = useState(() => nextQuizQuestion(session)?.id);
  const completeQuiz = useGameStore((store) => store.completeQuiz);

  if (activeId === undefined) {
    return (
      <ScreenPanel title="Quiz complete.">
        <Button onClick={completeQuiz}>See my results</Button>
      </ScreenPanel>
    );
  }

  return (
    <QuestionCard
      key={activeId}
      session={session}
      question={findQuestion(activeId)}
      onNext={() => {
        setActiveId(nextQuizQuestion(session)?.id);
      }}
    />
  );
}
