import { buildRepositoryQuery } from "./queries";
import { defaultProfile } from "../domain/types";

describe("buildRepositoryQuery", () => {
  it("builds a stable repository query from the contributor profile", () => {
    const query = buildRepositoryQuery({
      ...defaultProfile,
      languages: ["TypeScript", "Rust"],
      frameworks: ["React", "Tauri"],
      interestDomains: ["developer-tooling", "desktop"]
    });

    expect(query.repositoryQuery).toContain("is:public");
    expect(query.repositoryQuery).toContain("archived:false");
    expect(query.requestedLanguages).toEqual(["TypeScript", "Rust"]);
    expect(query.requestedFrameworks).toEqual(["React", "Tauri"]);
  });
});

