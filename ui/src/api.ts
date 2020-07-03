import ky from "ky";

export interface SearchResult {
  count: number;
  journal: string;
  results: string[];
}

interface DocResult {
  html: string;
  raw: string;
  date: string;
}

export interface SaveDocRequest {
  journal: string;
  date: string;
  content: string;
}

export class API {
  search = async (journal: string): Promise<SearchResult> => {
    const docs = await ky.get(
      `http://localhost:8001/search?journal=${encodeURIComponent(journal)}`
    );
    return (await docs.json()) as SearchResult;
  };

  fetchNote = async (journal: string, dateStr: string): Promise<DocResult> => {
    return ky
      .get(
        `http://localhost:8001/findByDate/${dateStr}?journal=${encodeURIComponent(
          journal
        )}`
      )
      .json();
  };

  save = async (doc: SaveDocRequest): Promise<DocResult> => {
    const res = await ky.post(
      // todo: add journal and date to URL
      `http://localhost:8001/save`,
      {
        // TODO: pick out properties for safety
        json: doc,
      }
    );
    return await res.json();
  };
}

export default new API();
