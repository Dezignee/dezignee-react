# @dezignee/react

React component that embeds the Dezignee email editor in your product. It wraps the `dezignee-plugin` SDK: it mounts the editor, tears it down when your component unmounts, and keeps the editor in step with your props.

```sh
npm install @dezignee/react
```

npm 7 and later install the `dezignee-plugin` peer dependency for you. React 18 and 19 are supported.

## Usage

```tsx
'use client'

import { useEffect, useRef, useState } from 'react';
import { DezigneeEditor, type DezigneeEditorHandle } from '@dezignee/react';

export function EmailEditor() {
  const editor = useRef<DezigneeEditorHandle>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dezignee-session', { method: 'POST' })
      .then((response) => response.json())
      .then((data) => setSessionToken(data.sessionToken));
  }, []);

  if (!sessionToken) return <div>Loading...</div>;
  return (
    <>
      <button onClick={() => editor.current?.editor?.exportHTML()}>Export</button>
      <DezigneeEditor ref={editor} sessionToken={sessionToken} style={{ height: 600 }} />
    </>
  );
}
```

The session token comes from your own backend. The component renders one empty container and the editor fills it, so give it a height with `className` or `style`.

## Props

`sessionToken` is required. The rest mirror the plugin's `init()` options (see the plugin's README for what each one does): `refreshToken`, `onReady`, `onSessionRefreshFailed`, `onAgentEdit`, `onSelectionChange`, `onSaveStateChange`, `onChange`, `onRateLimited`, `onCreditsExhausted`, `onPurchaseCredits`, `editorUrl`, `collectionId`, `blockId`, `libraryEntryId`, `newCollection`, `userId`, `customerId`, `customerName`, `apiUrl`, `initialPrompt`, `assets`, `theme`, `themeMode`, `navigation`, `autoSave`, `controls`, `addData`, `toast`, `author`, `sidebar`, `fonts`, `documents`, `displayConditions`, `brandColors`, `mergeTags`, `dataSources`, plus `className`, `style` and an `id` for the container.

Two callbacks belong to the component: `onLoad(editor)` runs when the editor has started, and `onError(error)` runs when it could not (a bad token, a failed collection creation, a rate limit). Without `onError` the failure is logged with `console.error`.

What happens when a prop changes after the first render:

| | props | behaviour |
|---|---|---|
| applied live | `theme`, `themeMode` | one `setTheme` call, no remount. `theme` is compared by value, so an inline object does not resend on every render. Removing `theme` does not reset the editor's colours. |
| applied live | `navigation` | `{ post: 'rail', presentation: 'filmstrip' }`: how people move between pages and slides. The editor opens in it, and a change calls `editor.setNavigation(kind, style)`, no remount (`documents` itself is read once, so `documents.<kind>.navigation` would restart the editor). The prop wins over `documents`. Removing a kind does not reset it. |
| always current | `onReady`, `onSessionRefreshFailed`, `onSelectionChange`, `onSaveStateChange`, `onChange`, `onRateLimited`, `onCreditsExhausted`, `onLoad`, `onError`, and the functions inside `refreshToken`, `onAgentEdit`, `onPurchaseCredits` and `assets` | the latest function is used from then on, no remount |
| remount | `sessionToken`, `collectionId`, `blockId`, `libraryEntryId`, `editorUrl`, `apiUrl`, `userId`, `customerId`, `customerName`, `id`, `newCollection`, `autoSave`, `controls`, `addData`, `toast`, `author`, `sidebar`, `fonts`, `documents`, `displayConditions`, `brandColors` (by value); `refreshToken`, `onAgentEdit`, `onPurchaseCredits` or `assets` appearing, disappearing or changing shape | the editor is destroyed and a fresh one starts in the same container, because the plugin reads these once |
| ignored | `initialPrompt`, `mergeTags`, `dataSources` | `initialPrompt` is a one-shot prompt at startup; `mergeTags` and `dataSources` are sent once at start, change them later with `ref.current.editor.setMergeTags(…)` and `ref.current.editor.setDataSources(…)` |

A remount without `collectionId` creates a new collection. A host that rotates tokens should pass `refreshToken` and leave `sessionToken` alone.

## Calling the editor

`ref.current.editor` is the plugin's `DezigneeEditor` instance, so every method of the plugin is there (`exportHTML()`, `chat()`, `undo()`, `setTheme()` and the rest). It is `null` until `onLoad` has run and again while the editor remounts.

## Strict Mode and server rendering

Under `<StrictMode>` the component starts exactly one editor: one `POST /api/v1/collections` (when `collectionId` is omitted), one iframe, and no `message` listener left after unmount.

Nothing runs outside an effect, so server rendering outputs the empty container only, and the build keeps the `'use client'` directive so you can import the component from a Next.js server component.

## Types

The package re-exports every type of `dezignee-plugin`. The plugin's `DezigneeEditor` class is exported as `DezigneeEditorInstance`, because `DezigneeEditor` here is the component.
