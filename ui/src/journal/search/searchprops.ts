import { ContentState, JournalsState } from "../../hooks";

export type SearchProps = Pick<ContentState, "loading" | "query" | "setQuery"> &
  Pick<JournalsState, "journals">;
