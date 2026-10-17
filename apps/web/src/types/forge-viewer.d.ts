declare global {
  namespace Autodesk {
    namespace Viewing {
      interface TokenCallback {
        (accessToken: string, expiresInSeconds: number): void;
      }

      interface InitializerOptions {
        env: string;
        api?: string;
        getAccessToken?: (onToken: TokenCallback) => void;
      }

      function Initializer(
        options: InitializerOptions,
        onInitialized: () => void,
      ): void;

      const SELECTION_CHANGED_EVENT: string;
      const GEOMETRY_LOADED_EVENT: string;
      const OBJECT_TREE_CREATED_EVENT: string;

      interface SelectionChangedPayload {
        dbIdArray: number[];
      }

      interface ViewerEventListener {
        (event: SelectionChangedPayload): void;
      }

      interface PropertyValue {
        displayName: string;
        displayValue: string | number | boolean;
        displayCategory: string;
      }

      interface PropertyResult {
        dbId: number;
        name: string;
        properties: PropertyValue[];
      }

      interface ObjectTreeNodeData {
        name?: string;
        role?: string;
      }

      interface ObjectTree {
        getRootId(): number;
        getChildCount(dbId: number): number;
        enumNodeChildren(
          dbId: number,
          callback: (childId: number) => void,
          recursive?: boolean,
        ): void;
        getNodeName(dbId: number): string;
      }

      interface ViewableNode {
        guid(): string;
        name(): string;
        data?: ObjectTreeNodeData | null;
      }

      interface BubbleRoot {
        search(filter: Record<string, string>): ViewableNode[];
        getDefaultGeometry(): ViewableNode | null;
      }

      interface ForgeDocument {
        getRoot(): BubbleRoot;
      }

      interface DocumentStatic {
        load(
          urn: string,
          onSuccess: (doc: ForgeDocument) => void,
          onError: (
            errorCode: number,
            errorMessage: string,
            errors: unknown,
          ) => void,
        ): void;
      }
      const Document: DocumentStatic;

      interface ViewerNavigation {
        isPerspective: boolean;
        setRequestTransition(value: boolean): void;
        toOrthographic(): void;
        toPerspective(): void;
      }

      interface SearchSuccessCallback {
        (dbIds: number[]): void;
      }

      interface ErrorCallback {
        (error: Error): void;
      }

      interface PropertiesSuccessCallback {
        (result: PropertyResult): void;
      }

      interface ObjectTreeSuccessCallback {
        (tree: ObjectTree): void;
      }

      interface ScreenshotCallback {
        (screenshotUrl: string): void;
      }

      class GuiViewer3D {
        navigation: ViewerNavigation;
        constructor(container: HTMLElement, config?: Record<string, unknown>);
        start(): number;
        finish(): number;
        loadDocumentNode(
          document: ForgeDocument,
          viewable: ViewableNode,
          options?: Record<string, unknown>,
        ): Promise<unknown>;
        loadExtension(extensionId: string): Promise<unknown>;
        addEventListener(
          eventType: string,
          listener: ViewerEventListener,
        ): void;
        removeEventListener(
          eventType: string,
          listener: ViewerEventListener,
        ): void;
        getSelection(): number[];
        select(dbIds: number[]): void;
        clearSelection(): void;
        fitToView(dbIds?: number | number[]): void;
        isolate(dbIds: number[] | number): void;
        hide(dbIds: number[] | number): void;
        showAll(): void;
        search(
          text: string,
          onSuccess: SearchSuccessCallback,
          onError?: ErrorCallback,
          attributeNames?: string[],
        ): void;
        getProperties(
          dbId: number,
          onSuccess: PropertiesSuccessCallback,
          onError?: ErrorCallback,
        ): void;
        getObjectTree(
          onSuccess: ObjectTreeSuccessCallback,
          onError?: ErrorCallback,
        ): void;
        getScreenshot(
          width?: number,
          height?: number,
          onScreenshot?: ScreenshotCallback,
        ): string;
        setTheme(name: string): void;
        setBackgroundColor(
          red: number,
          green: number,
          blue: number,
          red2: number,
          green2: number,
          blue2: number,
        ): void;
        setEnvMapBackground(value: boolean): void;
        setDisplayEdges(show: boolean): void;
      }
    }
  }

  interface Window {
    Autodesk?: typeof Autodesk;
  }
}

export {};
