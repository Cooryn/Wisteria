import type { IssueCandidate, SortMode } from "../domain/types";

interface RecommendationsPanelProps {
  issues: IssueCandidate[];
  selectedIssueId: number | null;
  sortMode: SortMode;
  filterText: string;
  onSortChange: (mode: SortMode) => void;
  onFilterTextChange: (value: string) => void;
  onSelectIssue: (issue: IssueCandidate) => void;
}

export function sortIssues(issues: IssueCandidate[], mode: SortMode): IssueCandidate[] {
  return [...issues].sort((left, right) => {
    if (mode === "difficulty") {
      return right.scoreBreakdown.difficultyScore - left.scoreBreakdown.difficultyScore;
    }

    if (mode === "updated") {
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    }

    return right.scoreBreakdown.total - left.scoreBreakdown.total;
  });
}

export function RecommendationsPanel({
  issues,
  selectedIssueId,
  sortMode,
  filterText,
  onSortChange,
  onFilterTextChange,
  onSelectIssue
}: RecommendationsPanelProps) {
  const filtered = sortIssues(
    issues.filter((issue) => {
      const haystack = `${issue.title} ${issue.bodyExcerpt} ${issue.labels.join(" ")}`.toLowerCase();
      return haystack.includes(filterText.toLowerCase());
    }),
    sortMode
  );

  return (
    <section className="panel recommendations-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Recommendations</p>
          <h2>Issue shortlist</h2>
        </div>
        <div className="toolbar">
          <input
            value={filterText}
            onChange={(event) => onFilterTextChange(event.target.value)}
            placeholder="Filter by label, title, or keyword"
          />
          <select
            aria-label="Sort issues"
            value={sortMode}
            onChange={(event) => onSortChange(event.target.value as SortMode)}
          >
            <option value="score">Best fit</option>
            <option value="difficulty">Easier first</option>
            <option value="updated">Recently active</option>
          </select>
        </div>
      </div>

      <div className="issue-list">
        {filtered.map((issue) => (
          <button
            key={issue.issueId}
            type="button"
            className={`issue-card ${selectedIssueId === issue.issueId ? "selected" : ""}`}
            onClick={() => onSelectIssue(issue)}
          >
            <div className="issue-card-topline">
              <span className="score-pill">{issue.scoreBreakdown.total}</span>
              <span>{issue.repo.fullName}</span>
              <span>{new Date(issue.updatedAt).toLocaleDateString()}</span>
            </div>
            <h3>{issue.title}</h3>
            <p>{issue.recommendationSummary}</p>
            <div className="tag-row">
              {issue.labels.slice(0, 5).map((label) => (
                <span key={label} className="tag">
                  {label}
                </span>
              ))}
            </div>
          </button>
        ))}

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No issues match the current filter</h3>
            <p>Try broadening your query, trimming excluded keywords, or scanning again.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

