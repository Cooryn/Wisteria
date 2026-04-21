import { fireEvent, render, screen } from "@testing-library/react";
import { ProfileForm } from "./ProfileForm";
import { defaultProfile } from "../domain/types";

describe("ProfileForm", () => {
  it("parses comma-separated fields before saving", async () => {
    const onSave = vi.fn();
    render(<ProfileForm value={defaultProfile} onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("TypeScript, Rust"), {
      target: { value: "TypeScript, Rust, Python" }
    });

    fireEvent.click(screen.getByRole("button", { name: /save contributor profile/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].languages).toEqual(["TypeScript", "Rust", "Python"]);
  });
});

