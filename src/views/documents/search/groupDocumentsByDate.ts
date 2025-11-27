// Sub-set of Document, we only need createdAt
type DateGroup<Doc extends { createdAt: string }> = {
  key: string;
  label: string;
  docs: Doc[];
};

/**
 * Groups documents by recent months, then years, to support:
 *
 * ```
 * November
 * My journal Entry....
 * My Other entry...
 *
 * October
 * My journal Entry....
 * My Other entry...
 *
 * September
 * My journal Entry....
 * My Other entry...
 *
 * 2025
 * My journal Entry....
 * My Other entry...
 *
 * 2024
 * My journal Entry....
 * My Other entry...
 *
 * 2023
 * My journal Entry....
 * My Other entry...
 * ```
 */
export function groupDocumentsByDate<Doc extends { createdAt: string }>(
  docs: Doc[],
  // NOTE: Default to current date to support last three months, but allows for testing.
  now: Date = new Date(),
): DateGroup<Doc>[] {
  if (docs.length === 0) return [];
  const output: DateGroup<Doc>[] = [];

  // For month groupings, generate candidates for the last 3 months;
  // we only use them if notes are found in those months.
  const candidates: string[] = [];
  now.setHours(0, 0, 0, 0);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  candidates.push(now.toISOString().slice(0, 7));

  // todo: Make months configurable
  for (let i = 1; i < 3; i++) {
    // NOTE: Negative months correctly shift the year back, neat
    const date = new Date(currentYear, currentMonth - i, 1, 0, 0, 0, 0);
    candidates.push(date.toISOString().slice(0, 7));
  }

  // Helper consumes candidate month strings (closure), then relies on year in current document,
  // to generate the next Date(Documents)Group.
  function createNextGroup(doc: Doc): DateGroup<Doc> {
    let currentGroup: DateGroup<Doc> | null = null;

    while (candidates.length > 0 && currentGroup === null) {
      const candidate = candidates.shift()!; // while candidates.length > 0 ensures this

      if (candidate <= doc.createdAt.slice(0, 7)) {
        currentGroup = {
          key: candidate,
          label: getLabelFromISOString(candidate),
          docs: [doc],
        };
      }
    }

    // no candidates, first doc makes first group.
    if (currentGroup === null) {
      currentGroup = {
        key: doc.createdAt.slice(0, 4),
        // Once we're down to year grouping, display year (ex 2025) as-is
        label: doc.createdAt.slice(0, 4),
        docs: [doc],
      };
    }

    return currentGroup;
  }

  // Generate initial documents grouping from first document.
  let currentGroup: DateGroup<Doc> = createNextGroup(docs.shift()!);

  // Fill the rest
  while (docs.length > 0) {
    const doc = docs.shift()!;
    const size = currentGroup!.key.length; // 4 or 7

    // Append to current group
    if (doc.createdAt.slice(0, size) >= currentGroup!.key) {
      currentGroup!.docs.push(doc);
    } else {
      // Collect and make a new one.
      output.push(currentGroup!);
      currentGroup = createNextGroup(doc);
    }
  }

  output.push(currentGroup!);
  return output;
}

/**
 * For ISO8601 Month strings like 2025-11, return the month name like "November"
 * correcting for hour-offsets at start of month.
 */
function getLabelFromISOString(dateString: string) {
  if (dateString.length < 7)
    throw new Error(`Expected ISO string like 2025-11, got ${dateString}`);

  const [year, month] = dateString.slice(0, 7).split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
  });
}
