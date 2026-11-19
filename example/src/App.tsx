import { useEffect, useRef, useState } from 'react';
import { DezigneeBuilder, type DezigneeBuilderHandle } from '../../src';

export function App() {
  const editor = useRef<DezigneeBuilderHandle>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dezignee-session', { method: 'POST' })
      .then((response) => response.json())
      .then((data: { sessionToken: string }) => setSessionToken(data.sessionToken));
  }, []);

  if (!sessionToken) return <p>Loading...</p>;
  return (
    <>
      <button onClick={() => editor.current?.editor?.exportHTML()}>Export</button>
      <DezigneeBuilder ref={editor} sessionToken={sessionToken} style={{ height: 600 }} />
    </>
  );
}
