import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { init, type DocumentKind, type DocumentsOptions, type EditorTheme, type InitOptions, type NavigationStyle } from 'dezignee-plugin';
import type { DezigneeEditorHandle, DezigneeEditorInstance, DezigneeEditorProps } from './types';

let nextContainerId = 0;

const noop = () => {};

function shallowEqual(a: EditorTheme | undefined, b: EditorTheme | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => key in b && a[key] === b[key]);
}

type Navigation = Partial<Record<DocumentKind, NavigationStyle>>;

/** `documents` with the `navigation` prop's styles in, so the editor opens in them. The prop wins over `documents.<kind>.navigation`. */
function withNavigation(documents: DocumentsOptions | undefined, navigation: Navigation | undefined): DocumentsOptions | undefined {
  if (!navigation) return documents;
  const merged: Record<string, unknown> = { ...documents };
  for (const [kind, style] of Object.entries(navigation)) {
    if (style === undefined) continue;
    const current = (merged[kind] ?? {}) as Record<string, unknown>;
    merged[kind] = { ...current, navigation: { ...(current.navigation as object | undefined), style } };
  }
  return merged as DocumentsOptions;
}

export const DezigneeEditor = forwardRef<DezigneeEditorHandle, DezigneeEditorProps>(
  function DezigneeEditor(props, ref) {
    const { id, className, style } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<DezigneeEditorInstance | null>(null);
    const latest = useRef(props);
    const applied = useRef<Pick<DezigneeEditorProps, 'theme' | 'themeMode'>>({});
    const appliedNavigation = useRef<Navigation>({});
    const editorReady = useRef(false);
    const settled = useRef<Promise<unknown>>(Promise.resolve());

    const syncTheme = () => {
      const editor = editorRef.current;
      if (!editor || !editorReady.current) return;
      const { theme, themeMode } = latest.current;
      const themeChanged = !shallowEqual(theme, applied.current.theme);
      const modeChanged = themeMode !== applied.current.themeMode;
      if (!themeChanged && !modeChanged) return;
      applied.current = { theme, themeMode };
      const nextTheme = themeChanged ? theme : undefined;
      const nextMode = modeChanged ? themeMode : undefined;
      if (nextTheme === undefined && nextMode === undefined) return;
      editor.setTheme(nextTheme, nextMode);
    };

    const syncNavigation = () => {
      const editor = editorRef.current;
      if (!editor || !editorReady.current) return;
      const wanted = latest.current.navigation;
      if (!wanted) return;
      for (const kind of Object.keys(wanted) as DocumentKind[]) {
        const style = wanted[kind];
        if (style === undefined || style === appliedNavigation.current[kind]) continue;
        appliedNavigation.current = { ...appliedNavigation.current, [kind]: style };
        editor.setNavigation(kind, style);
      }
    };

    useEffect(() => {
      latest.current = props;
    });
    useEffect(syncTheme);
    useEffect(syncNavigation);
    useImperativeHandle(ref, () => ({ get editor() { return editorRef.current; } }), []);

    const hasRefreshToken = props.refreshToken !== undefined;
    const hasAgentEdit = props.onAgentEdit !== undefined;
    const hasPurchase = props.onPurchaseCredits !== undefined;
    const assetsShape = props.assets
      ? `${props.assets.deleteAsset ? 'd' : '-'}${props.assets.listAssets ? 'l' : '-'}`
      : '';
    const initOnlyKey = JSON.stringify([props.newCollection, props.autoSave, props.controls, props.addData, props.toast, props.author, props.sidebar, props.fonts, props.documents, props.displayConditions, props.brandColors]);

    useEffect(() => {
      let cancelled = false;
      let created: DezigneeEditorInstance | null = null;

      const timer = setTimeout(() => {
        void (async () => {
          await settled.current;
          const container = containerRef.current;
          if (cancelled || !container) return;
          if (!container.id) container.id = `dezignee-editor-${++nextContainerId}`;

          const o = latest.current;
          const options: InitOptions = {
            id: container.id,
            sessionToken: o.sessionToken,
            refreshToken: hasRefreshToken
              ? () => latest.current.refreshToken?.() ?? Promise.reject(new Error('Dezignee: refreshToken was removed'))
              : undefined,
            ready: () => {
              editorReady.current = true;
              syncTheme();
              syncNavigation();
              latest.current.onReady?.();
            },
            onSessionRefreshFailed: () => latest.current.onSessionRefreshFailed?.(),
            onAgentEdit: hasAgentEdit ? (event) => latest.current.onAgentEdit?.(event) : undefined,
            onSelectionChange: (selection) => latest.current.onSelectionChange?.(selection),
            onSaveStateChange: (state) => latest.current.onSaveStateChange?.(state),
            onChange: (event) => latest.current.onChange?.(event),
            onRateLimited: () => latest.current.onRateLimited?.(),
            onCreditsExhausted: (credits) => latest.current.onCreditsExhausted?.(credits),
            onPurchaseCredits: hasPurchase ? (request) => latest.current.onPurchaseCredits?.(request) : undefined,
            editorUrl: o.editorUrl,
            collectionId: o.collectionId,
            blockId: o.blockId,
            libraryEntryId: o.libraryEntryId,
            newCollection: o.newCollection,
            userId: o.userId,
            customerId: o.customerId,
            customerName: o.customerName,
            apiUrl: o.apiUrl,
            initialPrompt: o.initialPrompt,
            assets: o.assets && {
              provider: 'custom',
              upload: (file) => latest.current.assets!.upload(file),
              deleteAsset: o.assets.deleteAsset
                ? (assetId, src) => latest.current.assets!.deleteAsset!(assetId, src)
                : undefined,
              listAssets: o.assets.listAssets
                ? (params) => latest.current.assets!.listAssets!(params)
                : undefined,
            },
            theme: o.theme,
            themeMode: o.themeMode,
            documents: withNavigation(o.documents, o.navigation),
            autoSave: o.autoSave,
            controls: o.controls,
            addData: o.addData,
            toast: o.toast,
            author: o.author,
            sidebar: o.sidebar,
            fonts: o.fonts,
            displayConditions: o.displayConditions,
            brandColors: o.brandColors,
            mergeTags: o.mergeTags,
            dataSources: o.dataSources,
          };
          applied.current = { theme: o.theme, themeMode: o.themeMode };
          appliedNavigation.current = { ...o.navigation };
          editorReady.current = false;

          const pending = init(options);
          settled.current = pending.then(noop, noop);
          let instance: DezigneeEditorInstance;
          try {
            instance = await pending;
          } catch (error) {
            if (cancelled) return;
            const failure = error instanceof Error ? error : new Error(String(error));
            if (latest.current.onError) latest.current.onError(failure);
            else console.error('[dezignee] the editor failed to start:', failure);
            return;
          }
          if (cancelled) {
            instance.destroy();
            container.innerHTML = '';
            return;
          }
          created = instance;
          editorRef.current = instance;
          latest.current.onLoad?.(instance);
        })();
      }, 0);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        if (created) {
          created.destroy();
          editorRef.current = null;
          editorReady.current = false;
          if (containerRef.current) containerRef.current.innerHTML = '';
        }
      };
    }, [
      props.sessionToken,
      props.collectionId,
      props.blockId,
      props.libraryEntryId,
      props.editorUrl,
      props.apiUrl,
      props.userId,
      props.customerId,
      props.customerName,
      id,
      hasRefreshToken,
      hasAgentEdit,
      hasPurchase,
      assetsShape,
      initOnlyKey,
    ]);

    return <div ref={containerRef} id={id} className={className} style={style} />;
  },
);
