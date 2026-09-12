import { useState } from 'react';
import type { CcPrivateState, CcPublicState } from './types';
import { TUTORIAL_COPY } from './types';
import { Countdown } from './Countdown';
import { Scoreboard } from './Scoreboard';

export function PhoneConfidenceClub({
  phase,
  publicGame,
  privateState,
  isHost,
  onTutorialNext,
  onAdvance,
  onSubmitAnswer,
  onReviseAnswer,
  onStartRound,
  onPause,
  onReturnToLibrary,
}: {
  phase: string;
  publicGame: CcPublicState | null;
  privateState: CcPrivateState | null;
  isHost: boolean;
  onTutorialNext: () => void;
  onAdvance: () => void;
  onSubmitAnswer: (optionIndex: number, confidence: 1 | 2 | 3) => void;
  onReviseAnswer: (optionIndex: number) => void;
  onStartRound: () => void;
  onPause: () => void;
  onReturnToLibrary: () => void;
}) {
  const [pick, setPick] = useState<number | null>(null);
  const [conf, setConf] = useState<1 | 2 | 3 | null>(null);

  if (!publicGame) {
    return (
      <div>
        <h1>🎯 Confidence Club</h1>
        <p className="tagline">Waiting for game state…</p>
      </div>
    );
  }

  if (phase === 'TUTORIAL') {
    const step = publicGame.tutorialStep ?? 'welcome';
    const copy = TUTORIAL_COPY[step] ?? TUTORIAL_COPY.welcome!;
    const last = publicGame.tutorialStepIndex >= publicGame.tutorialTotal - 1;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p className="tagline" style={{ margin: 0 }}>
          Tutorial {publicGame.tutorialStepIndex + 1}/{publicGame.tutorialTotal}
        </p>
        <h1 style={{ margin: 0 }}>{copy.title}</h1>
        <p style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>{copy.body}</p>
        {step === 'scoring' ? (
          <ul style={{ paddingLeft: '1.2rem', fontWeight: 600 }}>
            <li>Correct & stick: ×100</li>
            <li>Correct after change: ×50</li>
            <li>Wrong: −×50</li>
            <li>Miss first submit: 0</li>
          </ul>
        ) : null}
        <button type="button" style={{ width: '100%', minHeight: 56 }} onClick={onTutorialNext}>
          {last ? 'Got it' : 'Next'}
        </button>
        {isHost && last ? (
          <button type="button" style={{ width: '100%', minHeight: 56 }} onClick={onStartRound}>
            Start round
          </button>
        ) : null}
        {isHost ? (
          <button type="button" className="secondary" onClick={onReturnToLibrary}>
            Return to library
          </button>
        ) : null}
      </div>
    );
  }

  if (phase === 'RESULTS') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h1>Results</h1>
        <Scoreboard scores={publicGame.scores} />
        {isHost ? (
          <button type="button" style={{ width: '100%', minHeight: 56 }} onClick={onReturnToLibrary}>
            Return to library
          </button>
        ) : (
          <p className="tagline">Waiting for host…</p>
        )}
      </div>
    );
  }

  // PLAYING
  const q = publicGame.question;
  const rp = publicGame.roundPhase;
  const myOpt =
    privateState?.revisionSubmitted && privateState.myRevisedOption != null
      ? privateState.myRevisedOption
      : privateState?.myInitialOption;
  const myConf = privateState?.myConfidence;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>
          Q{(publicGame.questionIndex ?? 0) + 1}/{publicGame.totalQuestions}
        </h1>
        <Countdown endsAt={publicGame.phaseEndsAt} />
      </div>
      <p className="tagline" style={{ margin: 0 }}>
        {rp === 'answering' && 'Pick answer + confidence'}
        {rp === 'locked' && 'Locked — clue incoming'}
        {rp === 'revising' && 'Clue! Keep or change answer (confidence locked)'}
        {rp === 'reveal' && 'Reveal'}
      </p>

      {q ? (
        <p style={{ fontWeight: 800, fontSize: '1.15rem', margin: '0.25rem 0' }}>{q.prompt}</p>
      ) : null}

      {rp === 'revising' && publicGame.clue ? (
        <div
          className="panel"
          style={{ borderLeft: '4px solid var(--warn)', fontWeight: 700 }}
        >
          💡 {publicGame.clue}
        </div>
      ) : null}

      {rp === 'reveal' && q && publicGame.correctIndex != null ? (
        <div className="panel" style={{ borderLeft: '4px solid var(--ok)' }}>
          <strong>
            Answer: {String.fromCharCode(65 + publicGame.correctIndex)}.{' '}
            {q.options[publicGame.correctIndex]}
          </strong>
          {publicGame.explanation ? <p style={{ margin: '0.5rem 0 0' }}>{publicGame.explanation}</p> : null}
          {privateState?.myPointsThisRound != null ? (
            <p style={{ margin: '0.5rem 0 0', fontWeight: 800 }}>
              Your points:{' '}
              <span
                style={{
                  color:
                    privateState.myPointsThisRound < 0 ? 'var(--danger)' : 'var(--ok)',
                }}
              >
                {privateState.myPointsThisRound > 0
                  ? `+${privateState.myPointsThisRound}`
                  : privateState.myPointsThisRound}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {q && (rp === 'answering' || rp === 'revising') ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {q.options.map((opt, i) => {
            const selected =
              rp === 'answering'
                ? (pick ?? privateState?.myInitialOption) === i
                : (pick ?? myOpt) === i;
            return (
              <button
                key={i}
                type="button"
                className={selected ? '' : 'secondary'}
                style={{
                  width: '100%',
                  minHeight: 56,
                  textAlign: 'left',
                  borderRadius: 16,
                  fontSize: '1.05rem',
                }}
                disabled={
                  rp === 'answering'
                    ? !privateState?.canSubmitAnswer && !!privateState?.hasInitialSubmission
                      ? false
                      : false
                    : !privateState?.canRevise
                }
                onClick={() => setPick(i)}
              >
                <strong>{String.fromCharCode(65 + i)}.</strong> {opt}
              </button>
            );
          })}
        </div>
      ) : null}

      {rp === 'answering' ? (
        <>
          <p className="tagline" style={{ margin: '0.25rem 0' }}>
            Confidence
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {([1, 2, 3] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={(conf ?? myConf) === c ? '' : 'secondary'}
                style={{ flex: 1, minHeight: 56, fontSize: '1.35rem' }}
                onClick={() => setConf(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            type="button"
            style={{ width: '100%', minHeight: 56 }}
            disabled={pick == null && privateState?.myInitialOption == null
              ? true
              : (conf == null && myConf == null)}
            onClick={() => {
              const o = pick ?? privateState?.myInitialOption;
              const c = conf ?? myConf;
              if (o == null || c == null) return;
              onSubmitAnswer(o, c);
            }}
          >
            {privateState?.hasInitialSubmission ? 'Update answer' : 'Submit'}
          </button>
        </>
      ) : null}

      {rp === 'revising' && privateState?.canRevise ? (
        <button
          type="button"
          style={{ width: '100%', minHeight: 56 }}
          disabled={pick == null && myOpt == null}
          onClick={() => {
            const o = pick ?? myOpt;
            if (o == null) return;
            onReviseAnswer(o);
          }}
        >
          {privateState.revisionSubmitted ? 'Update revision' : 'Keep / change answer'}
        </button>
      ) : null}

      {rp === 'revising' && !privateState?.hasInitialSubmission ? (
        <p className="tagline">You missed the first submit — no revision this round.</p>
      ) : null}

      {rp === 'revising' && privateState?.hasInitialSubmission ? (
        <p className="tagline">
          Confidence locked at {myConf}.{' '}
          {privateState.revisionSubmitted ? 'Revision sent.' : 'Original kept if you do nothing.'}
        </p>
      ) : null}

      <Scoreboard scores={publicGame.scores} />

      {isHost ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="button" className="secondary" style={{ minHeight: 48 }} onClick={onAdvance}>
            Skip / next phase
          </button>
          <button type="button" className="secondary" style={{ minHeight: 48 }} onClick={onPause}>
            Pause
          </button>
          <button type="button" className="secondary" style={{ minHeight: 48 }} onClick={onReturnToLibrary}>
            Return to library
          </button>
        </div>
      ) : null}
    </div>
  );
}
