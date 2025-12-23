import React from "react";
import { TagWithCount } from "../preload/client/tags";
import useClient from "./useClient";

/**
 * Hook for loading tags.
 */
export function useTags() {
  const [loading, setLoading] = React.useState(true);
  const [tags, setTags] = React.useState<string[]>([]);
  const [error, setError] = React.useState(null);
  const client = useClient();

  React.useEffect(() => {
    let isEffectMounted = true;
    setLoading(true);

    async function load() {
      try {
        const tags = await client.tags.all();
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
  const [tags, setTags] = React.useState<TagWithCount[]>([]);
  const [error, setError] = React.useState(null);
  const client = useClient();

  React.useEffect(() => {
    let isEffectMounted = true;
    setLoading(true);

    async function load() {
      try {
        const tags = await client.tags.allWithCounts();
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
