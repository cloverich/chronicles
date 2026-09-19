import React from "react";
import { useNavigate } from "react-router-dom";
import changelogSource from "../../../CHANGELOG.md?raw";
import { parseChangelog, type ChangelogPart } from "../../changelog";
import { IconButton } from "../../components/IconButton";
import Titlebar from "../../titlebar/macos";
import * as Base from "../layout";

const releases = parseChangelog(changelogSource);

function InlineEntry({ parts }: { parts: ChangelogPart[] }) {
  return parts.map((part, index) =>
    part.kind === "link" ? (
      <a
        className="text-link hover:text-link-hover"
        href={part.href}
        key={`${part.href}-${index}`}
      >
        {part.label}
      </a>
    ) : (
      <React.Fragment key={`text-${index}`}>{part.value}</React.Fragment>
    ),
  );
}

function BuildFingerprint() {
  const build = __CHRONICLES_BUILD__;
  const details = [
    build.version,
    build.shortCommit,
    `built ${build.buildDate}`,
    build.lastTag && build.commitsAfterTag > 0
      ? `${build.commitsAfterTag} commits after ${build.lastTag}`
      : null,
    build.dirty ? "dirty" : null,
  ].filter(Boolean);

  return (
    <p
      className="text-muted-foreground mb-10 font-mono text-xs"
      title={build.commit}
    >
      {details.join(" · ")}
    </p>
  );
}

export default function Changelog() {
  const navigate = useNavigate();

  return (
    <Base.Container>
      <Titlebar className="pr-16">
        <IconButton
          variant="minimal"
          className="drag-none"
          icon="chevron-left"
          onClick={() => navigate("/documents")}
          aria-label="Back"
        />
      </Titlebar>
      <Base.TitlebarSpacer />
      <Base.ScrollContainer>
        <main className="mx-auto w-full max-w-5xl px-8 py-10">
          <h1 className="text-foreground-strong mb-2 text-3xl font-semibold">
            Changelog
          </h1>
          <BuildFingerprint />
          {releases.map((release, releaseIndex) => (
            <section className="mb-10" key={release.title}>
              <h2 className="text-foreground-strong mb-3 text-lg font-medium">
                {releaseIndex === 0 && release.title === "Unreleased"
                  ? "Unreleased in this build"
                  : release.title}
              </h2>
              {release.entries.length === 0 ? (
                <p className="text-muted-foreground font-mono text-sm">
                  No changes recorded.
                </p>
              ) : (
                <ul className="m-0 list-none space-y-0 p-0 font-mono text-sm leading-6">
                  {release.entries.map((entry, index) => (
                    <li
                      className="m-0 min-w-0 p-0"
                      key={`${entry.sha}-${index}`}
                    >
                      <time
                        className="text-muted-foreground"
                        dateTime={entry.date}
                      >
                        {entry.date}
                      </time>{" "}
                      <code className="text-muted-foreground bg-transparent p-0">
                        {entry.sha}
                      </code>{" "}
                      <span className="min-w-0">
                        <InlineEntry parts={entry.parts} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </main>
      </Base.ScrollContainer>
    </Base.Container>
  );
}
