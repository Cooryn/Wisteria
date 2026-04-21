import type { DraftPrArtifact } from "../domain/types";

interface DraftWorkspaceProps {
  artifact: DraftPrArtifact | null;
}

function renderList(items: string[]) {
  return (
    <ul className="plain-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function DraftWorkspace({ artifact }: DraftWorkspaceProps) {
  if (!artifact) {
    return (
      <section className="panel">
        <div className="empty-state">
          <h2>Draft PR workspace</h2>
          <p>Select an issue and generate a draft to populate this workspace.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel draft-workspace">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Draft PR Workspace</p>
          <h2>{artifact.title}</h2>
        </div>
        <span className="provider-pill">{artifact.providerUsed}</span>
      </div>

      {artifact.warnings?.length ? (
        <div className="warning-box">
          {artifact.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <div className="detail-grid">
        <article>
          <h3>Branch name</h3>
          <code>{artifact.branchName}</code>
        </article>
        <article>
          <h3>Summary</h3>
          <p>{artifact.summary}</p>
        </article>
        <article>
          <h3>Problem statement</h3>
          <p>{artifact.problemStatement}</p>
        </article>
        <article>
          <h3>Implementation plan</h3>
          {renderList(artifact.implementationPlan)}
        </article>
        <article>
          <h3>Validation checklist</h3>
          {renderList(artifact.validationChecklist)}
        </article>
        <article>
          <h3>Commit plan</h3>
          {renderList(artifact.commitPlan)}
        </article>
      </div>

      <article className="text-block">
        <h3>PR body</h3>
        <pre>{artifact.prBody}</pre>
      </article>

      <article className="text-block">
        <h3>Assistant prompt</h3>
        <pre>{artifact.assistantPrompt}</pre>
      </article>
    </section>
  );
}
