const RUBRIC = {
  test_helpers: { description: "Test Helpers Usage", weight: 0.2 },
  mocks_and_stubs: { description: "Mocks and Stubs Usage", weight: 0.2 },
  readability: { description: "Test Readability", weight: 0.2 },
  maintainability: { description: "Test Maintainability", weight: 0.2 },
  effectiveness: { description: "Test Effectiveness", weight: 0.2 },
};

const call = () => {
  const reportTitle = `========== TEST GRADE REPORT ==========
    Test file: ${workflow.file}`;
  appendToFinalOutput(reportTitle + "\n");
  formatResults();
  appendToFinalOutput("\n\n");
};

const formatResults = () => {
  gradeData = workflow.output["calculate_final_grade"];

  if (!gradeData) {
    appendToFinalOutput("Error: Grading data not available.");
    return;
  }

  formatGrade(gradeData);

  if (!gradeData.rubricScores) {
    appendToFinalOutput(
      "Error: Rubric scores data not available in the workflow output.",
    );
    return;
  }

  appendToFinalOutput("RUBRIC SCORES:");
  for (const [category, data] of Object.entries(gradeData.rubricScores)) {
    const rubricItem = RUBRIC[category] || {
      description: "Unknown Category",
      weight: 0,
    };

    appendToFinalOutput(
      `  ${rubricItem.description} (${Math.round(
        rubricItem.weight * 100,
      )}% of grade):`,
    );
    appendToFinalOutput(
      `    Value: ${data.rawValue !== undefined ? data.rawValue : "N/A"}`,
    );
    appendToFinalOutput(
      `    Score: ${
        data.score !== undefined ? Math.round(data.score * 10) : "N/A"
      }/10 - "${data.description || "No description available"}"`,
    );
  }
};

// def format_results
//     # With HashWithIndifferentAccess, we can simply access with either syntax
//     grade_data = workflow.output["calculate_final_grade"]

//     unless grade_data
//       return append_to_final_output("Error: Grading data not available. This may be because you're replaying the workflow from this step, but the previous step data is missing or not found in the selected session.")
//     end

//     format_grade(grade_data)

//     # Make sure rubric_scores exists before trying to iterate over it
//     unless grade_data[:rubric_scores]
//       return append_to_final_output("Error: Rubric scores data not available in the workflow output.")
//     end

//     append_to_final_output("RUBRIC SCORES:")
//     grade_data[:rubric_scores].each do |category, data|
//       # Safely access RUBRIC with a fallback for potentially missing categories
//       rubric_item = RUBRIC[category.to_sym] || { description: "Unknown Category", weight: 0 }

//       append_to_final_output("  #{rubric_item[:description]} (#{(rubric_item[:weight] * 100).round}% of grade):")
//       append_to_final_output("    Value: #{data[:raw_value] || "N/A"}")
//       append_to_final_output("    Score: #{data[:score] ? (data[:score] * 10).round : "N/A"}/10 - \"#{data[:description] || "No description available"}\"")
//     end
//   end

call();
