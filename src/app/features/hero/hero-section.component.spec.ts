import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("HeroSectionComponent", () => {
  it("exposes +1.9 as hero-only metric copy in template", () => {
    const templatePath = resolve("src/app/features/hero/hero-section.component.html");
    const template = readFileSync(templatePath, "utf8");

    expect(template).toContain("<div class=\"stat-number\">+1.9</div>");
    expect(template).toContain("<div class=\"stat-label\">mIoU Improvement</div>");
  });

  it("defines View Demo output and transition contract", () => {
    const componentPath = resolve("src/app/features/hero/hero-section.component.ts");
    const source = readFileSync(componentPath, "utf8");

    expect(source).toContain("@Output() readonly viewDemo = new EventEmitter<void>();");
    expect(source).toContain("onViewDemoClick(): void");
    expect(source).toContain("this.viewDemo.emit();");
    expect(source).toContain("document.getElementById(\"demo-section\")");
    expect(source).toContain("scrollIntoView({ behavior: \"smooth\", block: \"start\" })");
    expect(source).toContain("demoSection?.focus();");
  });
});
