import { render, screen } from "@testing-library/react";
import { DraftWorkspace } from "./DraftWorkspace";

describe("DraftWorkspace", () => {
  it("renders an empty state when no artifact exists", () => {
    render(<DraftWorkspace artifact={null} />);
    expect(screen.getByText(/select an issue and generate a draft/i)).toBeInTheDocument();
  });

  it("renders a generated draft packet", () => {
    render(
      <DraftWorkspace
        artifact={{
          createdAt: "2026-04-21T00:00:00.000Z",
          branchName: "issue/1-fix-focus",
          title: "Draft PR",
          summary: "Summary",
          problemStatement: "Problem",
          implementationPlan: ["Step 1"],
          validationChecklist: ["Check 1"],
          commitPlan: ["Commit 1"],
          prBody: "Body",
          assistantPrompt: "Prompt",
          providerUsed: "template-fallback",
          warnings: []
        }}
      />
    );

    expect(screen.getByText("Draft PR")).toBeInTheDocument();
    expect(screen.getByText("template-fallback")).toBeInTheDocument();
  });
});
