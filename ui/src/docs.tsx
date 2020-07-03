import React, { useEffect, useState } from "react";
import Store from "./store";
import Editor from "./editor";

interface DocResult {
  html: string;
  raw: string;
  date: string;
}

function useStore() {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<DocResult[] | null>(null);
  useEffect(() => {
    async function loadit() {
      const store = new Store(localStorage);
      await store.load();
      const notes = await store.search(10);
      setData(notes);
      setLoading(false);
    }
    loadit();
  }, []);

  return { loading, data };
}

interface DocsLoaderProps {
  edit: (c: string) => any;
}

export default function DocsLoader(props: DocsLoaderProps) {
  const { loading, data } = useStore();
  if (loading) {
    return <h1>Loading...</h1>;
  }

  if (!data) {
    return <h1>No documents found for this journal</h1>;
  }

  return <Docs docs={data} edit={props.edit} />;
}

function Docs(props: { docs: DocResult[]; edit: (s: string) => any }) {
  const dblClick = (doc: DocResult) => {
    props.edit(doc.raw);
  };

  const [isEditing, setEditing] = useState(false);

  const Docs = props.docs.map((doc) => {
    return <DocDisplay doc={doc} />;
  });

  return <div>{Docs}</div>;
}

function DocDisplay(props: { doc: DocResult }) {
  const [isEditing, setEditing] = useState(false);
  const toggleEdit = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(!isEditing);
  };

  if (isEditing) {
    return (
      <div>
        <div>
          <h5 className="doc-date">{props.doc.date}</h5>
          <a href="#" onClick={toggleEdit}>
            Save
          </a>
          &nbsp;
          <a href="#" onClick={toggleEdit}>
            Cancel
          </a>
        </div>
        <Editor initial={[{ children: [{ text: props.doc.raw }] }]} />
      </div>
    );
  } else {
    return (
      <div>
        <div>
          <h5 className="doc-date">{props.doc.date}</h5>
          <a href="#" onClick={toggleEdit}>
            Toggle Edit
          </a>
        </div>

        <div dangerouslySetInnerHTML={{ __html: props.doc.html }}></div>
      </div>
    );
  }
}
