# @dezignee/react

React component that embeds the Dezignee document editor in your product. It wraps the `dezignee-plugin` SDK: it mounts the editor, tears it down when your component unmounts, and keeps the editor in step with your props.

```sh
npm install @dezignee/react
```

npm 7 and later install the `dezignee-plugin` peer dependency for you. React 18 and 19 are supported.

## Usage

```tsx
'use client'

import { useEffect, useRef, useState } from 'react';
import { DezigneeBuilder, type DezigneeBuilderHandle } from '@dezignee/react';

export function DocumentEditor() {
  const editor = useRef<DezigneeBuilderHandle>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/dezignee-session', { method: 'POST' })
      .then((response) => response.json())
      .then((data) => setSessionToken(data.sessionToken));
  }, []);

  if (!sessionToken) return <div>Loading...</div>;
  return (
    <>
      <button disabled={!ready} onClick={() => editor.current?.editor?.exportHTML()}>Export</button>
      <DezigneeBuilder ref={editor} sessionToken={sessionToken} onReady={() => setReady(true)} style={{ height: 600 }} />
    </>
  );
}
```

The session token comes from your own backend. The component renders one empty container and the editor fills it, so give it a height with `className` or `style`.

## Props

`sessionToken` is required. The rest mirror the plugin's `init()` options (see the plugin's README for what each one does): `refreshToken`, `onReady`, `onCollectionCreated`, `onSessionRefreshFailed`, `onAgentEdit`, `onSelectionChange`, `onSaveStateChange`, `onChange`, `onRateLimited`, `onUpdateAvailable`, `onCreditsExhausted`, `onPurchaseCredits`, `editorUrl`, `collectionId`, `blockId`, `libraryEntryId`, `newCollection`, `userId`, `customerId`, `customerName`, `apiUrl`, `initialPrompt`, `assets`, `theme`, `navigation`, `autoSave`, `controls`, `data.show`, `data.links`, `toast`, `author`, `sidebar`, `fonts`, `documents`, `displayConditions`, `variables`, plus `className`, `style` and an `id` for the container.

`data` is `{ lists, links, show }`: the editor remounts when `show` or `links` change; `lists` is sent once at start, change it later with `editor.setLists()`.

Two callbacks belong to the component: `onLoad(editor)` runs when the editor has started (not that it is ready: enable your Export button from `onReady`), and `onError(error)` runs when it could not (a bad token, a failed collection creation, a rate limit). Without `onError` the failure is logged with `console.error`.

### Callbacks and what they receive

| Callback | Receives | When it is called |
|---|---|---|
| `onReady` | nothing | the editor has loaded and can answer; enable your Export button from here. Until then calls that ask the editor something answer at once |
| `onCollectionCreated` | the new `collectionId` | the component made a new email (no `collectionId` was given), once per started editor |
| `onSessionRefreshFailed` | nothing | the session ended and `refreshToken` could not get a new one: show your sign-in |
| `onAgentEdit` | `{ templateId, patch, collectionVersionId }` | an outside AI agent's edit reached this collection (not edits made in the editor, the dashboard or `chat()`) |
| `onSelectionChange` | `{ templateId, type, id, description }`, or `null` | the selection changed; `null` when nothing is selected |
| `onSaveStateChange` | `'saving'`, `'saved'` or `'not-saved'` | the editor starts or finishes holding unsent edits; `'not-saved'` means edits were dropped after the server kept failing |
| `onChange` | `{ collectionId, documentType, platform, templateIds, source }` | the design changed, whoever changed it; `source` says who (`'editor'`, `'ai'`, `'undo'`, `'redo'`, `'restore'`, `'host'`, `'agent'` or `'other'`) |
| `onRateLimited` | nothing | the editor's request was refused for sending too many; it retries on its own |
| `onUpdateAvailable` | nothing | the editor found that this page was updated while it stayed open; passing it turns the editor's own notice off, so show yours |
| `onCreditsExhausted` | `{ limit, used, remaining }` | the customer's AI credits reached 0, once each time |
| `onPurchaseCredits` | `{ reason: 'low' \| 'exhausted', credits }` | the person pressed "Get more credits"; resolve the promise you return when the credits are added |
| `onLoad` | the editor instance | the editor has started (the component's own) |
| `onError` | an `Error` | the editor could not start: a bad token, a failed collection creation, a rate limit (the component's own) |

What happens when a prop changes after the first render:

| | props | behaviour |
|---|---|---|
| applied live | `theme` | one `setTheme` call, no remount. `theme` is compared by value all the way down, so an inline object does not resend on every render and a changed colour does. Removing `theme` sends an empty one, which clears what the page had set. |
| applied live | `navigation` | `{ post: 'rail', presentation: 'filmstrip' }`: how people move between pages and slides. The editor opens in it, and a change calls `editor.setNavigation(kind, style)`, no remount (`documents` itself is read once, so `documents.<kind>.navigation` would restart the editor). The prop wins over `documents`. Removing a kind does not reset it. |
| always current | `onReady`, `onCollectionCreated`, `onSessionRefreshFailed`, `onSelectionChange`, `onSaveStateChange`, `onChange`, `onRateLimited`, `onCreditsExhausted`, `onLoad`, `onError`, and the functions inside `refreshToken`, `onAgentEdit`, `onPurchaseCredits`, `onUpdateAvailable` and `assets` | the latest function is used from then on, no remount |
| remount | `sessionToken`, `collectionId`, `blockId`, `libraryEntryId`, `editorUrl`, `apiUrl`, `userId`, `customerId`, `customerName`, `id`, `newCollection`, `autoSave`, `controls`, `data.show`, `data.links`, `toast`, `author`, `sidebar`, `fonts`, `documents`, `displayConditions` (by value); `refreshToken`, `onAgentEdit`, `onPurchaseCredits`, `onUpdateAvailable` or `assets` appearing, disappearing or changing shape | the editor is destroyed and a fresh one starts in the same container, because the plugin reads these once |
| ignored | `initialPrompt`, `variables`, `data.lists`, `brand` | `initialPrompt` is a one-shot prompt at startup; `variables`, `data.lists` and `brand` are sent once at start, change them later with `ref.current.editor.setVariables(…)`, `ref.current.editor.setLists(…)` and `ref.current.editor.setBrand(…)` |

A remount without `collectionId` creates a new collection. A host that rotates tokens should pass `refreshToken` and leave `sessionToken` alone.

## Reopen a customer's email

```tsx
function Editor() {
  const [session, setSession] = useState<{ sessionToken: string; collectionId: string; customerId: string } | null>(null);
  useEffect(() => {
    fetch('/api/editor-session', { method: 'POST' }).then((r) => r.json()).then(setSession);
  }, []);
  if (!session) return null;
  return <DezigneeBuilder sessionToken={session.sessionToken} collectionId={session.collectionId} customerId={session.customerId} />;
}
```

The server half (look up the saved id, else create one and save it) is in the `dezignee-plugin` README, under "Reopen a customer's email"; it answers `{ sessionToken, collectionId, customerId }`, so pass back the `customerId` the server used. Two things to know:

- Changing `collectionId` or `customerId` after the editor has mounted restarts it. Render the editor only once the id is known, and never feed an id back from the editor's own events.
- `onChange` fires only when the design changes, so it is not where to learn the id. If you let the component make the email, keep the id from `onCollectionCreated` (send it to your server and save it), and do not pass it back as `collectionId` to the same component: a changed `collectionId` restarts the editor.

```tsx
<DezigneeBuilder
  sessionToken={sessionToken}
  customerId={customerId}
  onCollectionCreated={(id) => fetch('/api/editor-email', { method: 'POST', body: JSON.stringify({ collectionId: id }) })}
/>
```

## Calling the editor

`ref.current.editor` is the plugin's `DezigneeBuilder` instance, so every method of the plugin is there (`exportHTML()`, `chat()`, `undo()`, `setTheme()` and the rest). It is `null` until `onLoad` has run and again while the editor remounts.

## Strict Mode and server rendering

Under `<StrictMode>` the component starts exactly one editor: one `POST /api/v1/collections` (when `collectionId` is omitted), one iframe, and no `message` listener left after unmount.

Nothing runs outside an effect, so server rendering outputs the empty container only, and the build keeps the `'use client'` directive so you can import the component from a Next.js server component.

## Types

The package re-exports every type of `dezignee-plugin`. The plugin's `DezigneeBuilder` class is exported as `DezigneeBuilderInstance`, because `DezigneeBuilder` here is the component.

## Upgrading from 0.1

0.2.0 is a breaking change. The component `DezigneeEditor` is renamed `DezigneeBuilder`, and its types `DezigneeEditorHandle`, `DezigneeEditorInstance` and `DezigneeEditorProps` are renamed `DezigneeBuilderHandle`, `DezigneeBuilderInstance` and `DezigneeBuilderProps`. The old names are gone, so rename them in your code when you upgrade. Nothing else changes, and `@dezignee/react` now needs `dezignee-plugin` 0.2.0.
