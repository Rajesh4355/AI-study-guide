import type {
  CardStatus,
  DifficultyLevel,
  QuizQuestion,
  StudyDeckData,
  StudySession,
} from '../types/study';

export interface SessionStats {
  totalCards: number;
  masteredCount: number;
  reviewCount: number;
  unseenCount: number;
  totalQuiz: number;
  answeredCount: number;
  correctCount: number;
  wrongQuestionIds: string[];
  accuracyPercent: number;
}

export function computeSessionStats(session: StudySession): SessionStats {
  const { flashcards, quiz } = session.deck;

  let masteredCount = 0;
  let reviewCount = 0;
  let unseenCount = 0;

  for (const card of flashcards) {
    const status: CardStatus = session.cardStatuses[card.id] ?? 'unseen';
    if (status === 'mastered') masteredCount += 1;
    else if (status === 'review') reviewCount += 1;
    else unseenCount += 1;
  }

  let answeredCount = 0;
  let correctCount = 0;
  const wrongQuestionIds: string[] = [];

  for (const q of quiz) {
    const selected = session.quizAnswers[q.id];
    if (selected === undefined) continue;
    answeredCount += 1;
    if (selected === q.correctIndex) {
      correctCount += 1;
    } else {
      wrongQuestionIds.push(q.id);
    }
  }

  const accuracyPercent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  return {
    totalCards: flashcards.length,
    masteredCount,
    reviewCount,
    unseenCount,
    totalQuiz: quiz.length,
    answeredCount,
    correctCount,
    wrongQuestionIds,
    accuracyPercent,
  };
}

export function getActiveQuizQuestions(session: StudySession): QuizQuestion[] {
  if (session.retestQuestionIds.length === 0) {
    return session.deck.quiz;
  }
  const idSet = new Set(session.retestQuestionIds);
  const filtered = session.deck.quiz.filter((q) => idSet.has(q.id));
  return filtered.length > 0 ? filtered : session.deck.quiz;
}

/**
 * Transitions a session into a targeted re-test round containing only the
 * questions the learner previously answered incorrectly.
 */
export function startWrongAnswerRetest(session: StudySession): StudySession {
  const stats = computeSessionStats(session);
  if (stats.wrongQuestionIds.length === 0) {
    return session;
  }

  const nextAnswers = { ...session.quizAnswers };
  for (const wrongId of stats.wrongQuestionIds) {
    delete nextAnswers[wrongId];
  }

  return {
    ...session,
    updatedAt: new Date().toISOString(),
    quizAnswers: nextAnswers,
    retestQuestionIds: stats.wrongQuestionIds,
    retestRound: session.retestRound + 1,
  };
}

export function resetFullQuiz(session: StudySession): StudySession {
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    quizAnswers: {},
    retestQuestionIds: [],
    retestRound: 0,
  };
}

export function createStudySession(params: {
  id: string;
  sourceText: string;
  difficulty: DifficultyLevel;
  deck: StudyDeckData;
}): StudySession {
  const now = new Date().toISOString();
  return {
    id: params.id,
    sourceText: params.sourceText,
    difficulty: params.difficulty,
    createdAt: now,
    updatedAt: now,
    deck: params.deck,
    cardStatuses: {},
    quizAnswers: {},
    retestQuestionIds: [],
    retestRound: 0,
  };
}

/**
 * Updates an existing session with a refined AI deck while preserving card
 * mastery statuses and quiz answers for unchanged items.
 */
export function applyDeckRefinement(
  session: StudySession,
  refinedDeck: StudyDeckData
): StudySession {
  const validCardIds = new Set(refinedDeck.flashcards.map((c) => c.id));
  const preservedCardStatuses: Record<string, CardStatus> = {};
  for (const [id, status] of Object.entries(session.cardStatuses)) {
    if (validCardIds.has(id)) {
      preservedCardStatuses[id] = status;
    }
  }

  const validQuestionMap = new Map(refinedDeck.quiz.map((q) => [q.id, q]));
  const preservedQuizAnswers: Record<string, number> = {};
  for (const [id, answerIdx] of Object.entries(session.quizAnswers)) {
    const q = validQuestionMap.get(id);
    if (q && answerIdx >= 0 && answerIdx < q.options.length) {
      preservedQuizAnswers[id] = answerIdx;
    }
  }

  return {
    ...session,
    updatedAt: new Date().toISOString(),
    deck: refinedDeck,
    cardStatuses: preservedCardStatuses,
    quizAnswers: preservedQuizAnswers,
    retestQuestionIds: [],
  };
}

/**
 * Pure guard to ensure an asynchronous response from an older request cannot
 * overwrite the state of a newer or cancelled request.
 */
export function shouldAcceptAsyncResponse(
  activeRequestId: number,
  responseRequestId: number,
  aborted: boolean
): boolean {
  return !aborted && activeRequestId === responseRequestId;
}

export interface SampleStudyPrompt {
  id: string;
  label: string;
  subject: string;
  difficulty: DifficultyLevel;
  notes: string;
}

export const SAMPLE_STUDY_PROMPTS: SampleStudyPrompt[] = [
  {
    id: 'cellular-respiration',
    label: 'Cellular Respiration & ATP',
    subject: 'Biology',
    difficulty: 'intermediate',
    notes: `Cellular respiration converts glucose and oxygen into ATP, carbon dioxide, and water across three main stages:
1. Glycolysis (cytosol): Breaks 6-carbon glucose into two 3-carbon pyruvate molecules. Produces a net gain of 2 ATP and 2 NADH without requiring oxygen.
2. Citric Acid Cycle / Krebs Cycle (mitochondrial matrix): Pyruvate is oxidized to Acetyl-CoA, which enters the cycle. Each glucose yields 2 ATP, 6 NADH, 2 FADH2, and releases CO2.
3. Oxidative Phosphorylation (inner mitochondrial membrane): NADH and FADH2 donate electrons to the Electron Transport Chain (ETC). Oxygen serves as the final electron acceptor, forming H2O. The proton gradient powers ATP synthase via chemiosmosis to produce ~26-28 ATP.`,
  },
  {
    id: 'http-networking',
    label: 'HTTP, TLS & TCP Handshakes',
    subject: 'Computer Networks',
    difficulty: 'intermediate',
    notes: `When a browser loads an HTTPS URL:
- DNS resolution translates the domain name into an IP address using recursive resolvers and authoritative nameservers.
- TCP establishes a reliable connection via the 3-way handshake: SYN -> SYN-ACK -> ACK. TCP guarantees ordered, lossless byte delivery using sequence numbers and acknowledgments.
- TLS 1.3 negotiates encryption in 1 round trip (1-RTT), verifying server identity with X.509 certificates and establishing symmetric session keys via ephemeral Diffie-Hellman (ECDHE) for forward secrecy.
- HTTP/2 multiplexes multiple request/response streams over a single TCP connection, avoiding head-of-line blocking at the HTTP layer (though TCP packet loss still stalls all streams). HTTP/3 uses QUIC over UDP to eliminate TCP head-of-line blocking.`,
  },
  {
    id: 'behavioral-econ',
    label: 'Cognitive Biases in Decisions',
    subject: 'Behavioral Economics',
    difficulty: 'introductory',
    notes: `Key heuristics and biases from Prospect Theory and behavioral decision-making:
- Loss Aversion: Losses hurt roughly twice as much psychologically as equivalent gains feel good, making people risk-seeking to avoid sure losses and risk-averse for sure gains.
- Anchoring Effect: Initial numerical cues disproportionately skew subsequent estimates, even when the anchor is arbitrary.
- Sunk Cost Fallacy: Continuing an investment solely because of already-spent resources that cannot be recovered, rather than evaluating marginal future costs and benefits.
- Availability Heuristic: Judging the probability of an event by how easily vivid examples come to mind rather than base-rate statistics.`,
  },
];

export const DEMO_STUDY_SESSION: StudySession = createStudySession({
  id: 'demo-cellular-respiration',
  sourceText: SAMPLE_STUDY_PROMPTS[0].notes,
  difficulty: 'intermediate',
  deck: {
    title: 'Cellular Respiration & ATP Synthesis',
    subject: 'Biology',
    summary:
      'A three-stage metabolic pathway that harvests chemical energy from glucose into usable ATP across the cytosol and mitochondria.',
    keyConcepts: [
      'Glycolysis (Cytosol)',
      'Citric Acid Cycle (Matrix)',
      'Electron Transport Chain',
      'Chemiosmosis & ATP Synthase',
    ],
    flashcards: [
      {
        id: 'demo-c1',
        front: 'Where does glycolysis take place, and does it require oxygen?',
        back: 'Glycolysis occurs in the cytosol and is anaerobic — it does not require oxygen.',
        hint: 'Think outside the mitochondrion.',
        conceptTag: 'Glycolysis',
      },
      {
        id: 'demo-c2',
        front: 'What is the net ATP and NADH yield of glycolysis per molecule of glucose?',
        back: '2 net ATP (4 produced minus 2 invested) and 2 NADH, along with 2 pyruvate molecules.',
        hint: '2 ATP are consumed in the energy-investment phase.',
        conceptTag: 'Glycolysis',
      },
      {
        id: 'demo-c3',
        front: 'What role does oxygen play at the end of the Electron Transport Chain?',
        back: 'Oxygen acts as the final electron acceptor, combining with electrons and protons (H+) to form water (H2O).',
        hint: 'Without it, electron flow backs up and halts oxidative phosphorylation.',
        conceptTag: 'Oxidative Phosphorylation',
      },
      {
        id: 'demo-c4',
        front: 'How does ATP synthase generate ATP during chemiosmosis?',
        back: 'Protons (H+) flow down their electrochemical gradient across the inner mitochondrial membrane through ATP synthase, driving the phosphorylation of ADP + Pi into ATP.',
        conceptTag: 'Chemiosmosis',
      },
      {
        id: 'demo-c5',
        front: 'Which stage produces the most CO2 per glucose molecule?',
        back: 'Pyruvate oxidation and the Citric Acid (Krebs) Cycle in the mitochondrial matrix release all 6 carbons of glucose as CO2.',
        conceptTag: 'Citric Acid Cycle',
      },
    ],
    quiz: [
      {
        id: 'demo-q1',
        question:
          'If oxygen is suddenly removed from a cell, which molecule directly stops accepting electrons at the end of the ETC?',
        options: ['NAD+', 'Pyruvate', 'Oxygen (O2)', 'Acetyl-CoA'],
        correctIndex: 2,
        explanation:
          'Molecular oxygen (O2) is the terminal electron acceptor of Complex IV in the Electron Transport Chain; without it, NADH and FADH2 cannot be re-oxidized there.',
        conceptTag: 'Electron Transport Chain',
      },
      {
        id: 'demo-q2',
        question:
          'Which stage of cellular respiration takes place in the cytosol rather than the mitochondrion?',
        options: [
          'Citric Acid Cycle',
          'Glycolysis',
          'Oxidative Phosphorylation',
          'Pyruvate Oxidation',
        ],
        correctIndex: 1,
        explanation:
          'Glycolysis occurs in the cytosol and splits glucose into two pyruvate molecules before pyruvate enters the mitochondria.',
        conceptTag: 'Glycolysis',
      },
      {
        id: 'demo-q3',
        question:
          'What directly powers the rotor of ATP synthase to synthesize ATP from ADP?',
        options: [
          'Direct breakdown of glucose inside the enzyme',
          'A proton (H+) electrochemical gradient across the inner membrane',
          'Release of CO2 gas from the matrix',
          'Hydrolysis of GTP in the cytosol',
        ],
        correctIndex: 1,
        explanation:
          'The proton-motive force created by Complexes I, III, and IV pumping H+ into the intermembrane space drives ATP synthase.',
        conceptTag: 'Chemiosmosis',
      },
      {
        id: 'demo-q4',
        question:
          'Per glucose molecule, roughly how much ATP is produced by oxidative phosphorylation compared to glycolysis?',
        options: [
          'About 2 ATP vs. 28 ATP in glycolysis',
          'Equal amounts (2 ATP each)',
          'About 26–28 ATP vs. 2 net ATP in glycolysis',
          '0 ATP; it only generates NADH',
        ],
        correctIndex: 2,
        explanation:
          'Oxidative phosphorylation generates the vast majority (~26–28 ATP), whereas glycolysis yields only 2 net ATP directly.',
        conceptTag: 'Energy Yield',
      },
    ],
  },
});
