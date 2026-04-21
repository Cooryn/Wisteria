import { useEffect, useState } from "react";
import type { IssueType, UserProfile } from "../domain/types";

interface ProfileFormProps {
  value: UserProfile;
  onSave: (profile: UserProfile) => Promise<void> | void;
  busy?: boolean;
}

const ISSUE_TYPES: IssueType[] = ["bug", "docs", "feature", "tests", "refactor"];

function joinList(values: string[]): string {
  return values.join(", ");
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProfileForm({ value, onSave, busy = false }: ProfileFormProps) {
  const [draft, setDraft] = useState<UserProfile>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <form
      className="profile-form"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSave(draft);
      }}
    >
      <div className="field-grid">
        <label>
          <span>Display name</span>
          <input
            value={draft.displayName}
            onChange={(event) =>
              setDraft((current) => ({ ...current, displayName: event.target.value }))
            }
            placeholder="Your contributor alias"
          />
        </label>
        <label>
          <span>Weekly hours</span>
          <input
            type="number"
            min={1}
            max={30}
            value={draft.weeklyHours}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                weeklyHours: Number(event.target.value) || 1
              }))
            }
          />
        </label>
        <label>
          <span>Languages</span>
          <input
            value={joinList(draft.languages)}
            onChange={(event) =>
              setDraft((current) => ({ ...current, languages: parseList(event.target.value) }))
            }
            placeholder="TypeScript, Rust"
          />
        </label>
        <label>
          <span>Frameworks</span>
          <input
            value={joinList(draft.frameworks)}
            onChange={(event) =>
              setDraft((current) => ({ ...current, frameworks: parseList(event.target.value) }))
            }
            placeholder="React, Tauri"
          />
        </label>
        <label>
          <span>Interest domains</span>
          <input
            value={joinList(draft.interestDomains)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                interestDomains: parseList(event.target.value)
              }))
            }
            placeholder="developer-tooling, productivity"
          />
        </label>
        <label>
          <span>Exclude keywords</span>
          <input
            value={joinList(draft.excludeKeywords)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                excludeKeywords: parseList(event.target.value)
              }))
            }
            placeholder="security, rewrite"
          />
        </label>
        <label>
          <span>Exclude licenses</span>
          <input
            value={joinList(draft.excludeLicenses)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                excludeLicenses: parseList(event.target.value)
              }))
            }
            placeholder="AGPL-3.0"
          />
        </label>
        <label>
          <span>Difficulty</span>
          <select
            value={draft.difficultyPreference}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                difficultyPreference: event.target.value as UserProfile["difficultyPreference"]
              }))
            }
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label>
          <span>Repository size preference</span>
          <select
            value={draft.repoSizePreference}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                repoSizePreference: event.target.value as UserProfile["repoSizePreference"]
              }))
            }
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
      </div>

      <fieldset className="issue-type-fieldset">
        <legend>Preferred issue types</legend>
        <div className="issue-type-grid">
          {ISSUE_TYPES.map((type) => {
            const checked = draft.preferredIssueTypes.includes(type);
            return (
              <label key={type} className="checkbox-chip">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      preferredIssueTypes: checked
                        ? current.preferredIssueTypes.filter((item) => item !== type)
                        : [...current.preferredIssueTypes, type]
                    }))
                  }
                />
                <span>{type}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "Saving profile..." : "Save contributor profile"}
      </button>
    </form>
  );
}

