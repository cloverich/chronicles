import React from "react";
import type { TagCount } from "../contract/notes";
import { useNotes } from "./useNotes";

/**
 * Hook for loading tags.
 */
export function useTags() {
  const [loading, setLoading] = React.useState(true);
  const [tags, setTags] = React.useState<string[]>([]);
  const [error, setError] = React.useState(null);
  const notes = useNotes();

  React.useEffect(() => {
    let isEffectMounted = true;
    setLoading(true);

    async function load() {
      try {
        const tags = (await notes.listTags()).tags.map((t) => t.tag);
        if (!isEffectMounted) return;

        setTags(tags);
        setLoading(false);
      } catch (err: any) {
        if (!isEffectMounted) return;

        setError(err);
        setLoading(false);
      }
    }

    load();
    return () => {
      isEffectMounted = false;
    };
  }, []);

  return { loading, tags, error };
}

/**
 * Hook for loading tags with document counts.
 */
export function useTagsWithCounts() {
  const [loading, setLoading] = React.useState(true);
  const [tags, setTags] = React.useState<TagCount[]>([]);
  const [error, setError] = React.useState(null);
  const notes = useNotes();

  React.useEffect(() => {
    let isEffectMounted = true;
    setLoading(true);

    async function load() {
      try {
        const { tags } = await notes.listTags();
        if (!isEffectMounted) return;

        setTags(tags);
        setLoading(false);
      } catch (err: any) {
        if (!isEffectMounted) return;

        setError(err);
        setLoading(false);
      }
    }

    load();
    return () => {
      isEffectMounted = false;
    };
  }, []);

  return { loading, tags, error };
}
