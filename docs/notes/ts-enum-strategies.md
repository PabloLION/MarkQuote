# TypeScript Enum Strategies

## Value vs. Type Namespaces

TypeScript keeps value exports and type exports in separate namespaces. That is why these two declarations can share the name `CopySource` without colliding:

```ts
export const CopySource = {
  Popup: "popup",
  Hotkey: "hotkey",
  ContextMenu: "context-menu",
  E2E: "e2e",
  Unknown: "unknown",
} as const;

export type CopySource = (typeof CopySource)[keyof typeof CopySource];
```

- `CopySource` (value) is the runtime object (`CopySource.Popup`).
- `CopySource` (type) is the compile-time union of all object values.

This pattern provides a central literal definition and type safety without emitting extra runtime code.

Note that the **value** and the **type** do not share the exact same shape: the value is still an object with literal properties, while the type alias is the union of those property values. Because TypeScript keeps value- and type-namespaces separate, both exports can share the name `CopySource`, and importing `{ CopySource }` brings in the object for runtime use and the derived type for static checking. Writing `const source: CopySource = CopySource.Popup;` works because `CopySource.Popup` is typed as the literal `'popup'`, which fits the union alias.

## Comparing the Options

| Pattern                                          | Runtime object?      | Example usage        | Notes                                                                                                  |
| ------------------------------------------------ | -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| String literal union (`'popup' \| 'hotkey' ...`) | No                   | `source === 'popup'` | Smallest bundle; relies on literals everywhere.                                                        |
| `as const` object + derived type                 | Yes (tree-shakable)  | `CopySource.Popup`   | Centralizes literals, easy to iterate if needed; keeps value/type exports separate but sharing a name. |
| `const enum`                                     | No (values inlined)  | `CopySource.Popup`   | TypeScript substitutes the literal; zero runtime cost but requires TS-aware tooling.                   |
| Regular `enum`                                   | Yes (always emitted) | `CopySource.Popup`   | Generates a runtime object with both names and values; useful for consumers without TypeScript.        |

## `const enum` Explained

`const enum` is TypeScript sugar over regular enums. The compiler erases the enum object and replaces each `CopySource.Popup` with `'popup'` in the emitted JavaScript. Without `const`, TypeScript would emit the enum object at runtime:

```ts
enum CopySource {
  Popup = "popup",
  Hotkey = "hotkey",
}
```

⇣ emits ⇣

```js
var CopySource;
(function (CopySource) {
  CopySource["Popup"] = "popup";
  CopySource["Hotkey"] = "hotkey";
})(CopySource || (CopySource = {}));
```

So `const enum` keeps the enum syntax but avoids that object. Tooling must transpile the enum (pure type stripping will fail), which is why some projects avoid it in favor of the `as const` object.

## When a Real Enum Helps

A regular enum is handy when you need the runtime object for iteration, serialization, or interop with non-TypeScript consumers. For example, powering an options UI dropdown:

```ts
enum CopySource {
  Popup = "popup",
  Hotkey = "hotkey",
  ContextMenu = "context-menu",
  E2E = "e2e",
  Unknown = "unknown",
}

const copySourceLabels: Record<CopySource, string> = {
  [CopySource.Popup]: "Popup action",
  [CopySource.Hotkey]: "Keyboard shortcut",
  [CopySource.ContextMenu]: "Context menu",
  [CopySource.E2E]: "E2E test",
  [CopySource.Unknown]: "Unknown",
};

for (const source of Object.values(CopySource)) {
  renderOption(source, copySourceLabels[source]);
}
```

Here the emitted enum object provides a canonical list of values for UI code without maintaining a parallel array.

## Recommendation for MarkQuote

Our current string union (`type CopySource = 'popup' | ...`) is sufficient because we only compare against literals. If we want named references, consider the `as const` object pattern. Only reach for `const enum` when every consumer understands TypeScript’s emit, and prefer a regular enum when runtime iteration is required.

For quick reference:

- **Literal union**: zero runtime code; use when string comparisons are simple and duplication is minimal.
- **`as const` object**: adds a tiny object but gives `CopySource.Popup` references and safe iteration; tooling-friendly default when you want named constants.
- **`const enum`**: syntax sugar that inlines values; works only when the build pipeline performs TypeScript transforms.
- **Regular enum**: emits an object unconditionally; useful when you must expose the constants to non-TypeScript consumers or depend on runtime iteration without maintaining a parallel list.
