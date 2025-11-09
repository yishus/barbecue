const WEIGHTS = {
  test_helpers: 0.2,
  mocks_and_stubs: 0.2,
  readability: 0.2,
  maintainability: 0.2,
  effectiveness: 0.2,
};

const call = () => {
  llmAnalysis = workflow.output["generate_grades"];
  let weightedSum = 0.0;
  for (const criterion in WEIGHTS) {
    const score = parseFloat(llmAnalysis[criterion]["score"]) / 10.0;
    weightedSum += score * WEIGHTS[criterion];
  }
  return {
    final_score: {
      weighted_score: weightedSum,
      letter_grade: calculateLetterGrade(weightedSum),
    },
    rubric_scores: calculateRubricScores(llmAnalysis),
  };
};

const calculateLetterGrade = (score) => {
  switch (true) {
    case score > 0.9:
      return "A";
    case score > 0.8:
      return "B";
    case score > 0.7:
      return "C";
    case score > 0.6:
      return "D";
    default:
      return "F";
  }
};

const calculateRubricScores = (llmAnalysis) => {
  const scores = {};

  for (const criterion in WEIGHTS) {
    if (!llmAnalysis[criterion]) continue;
    const rawScore = parseFloat(llmAnalysis[criterion]["score"]);
    const normalizedScore = rawScore / 10.0;

    scores[criterion] = {
      raw_value: rawScore,
      score: normalizedScore,
      description: llmAnalysis[criterion]["justification"],
      weighted_score: normalizedScore * WEIGHTS[criterion],
    };
  }
  return scores;
};

call();
