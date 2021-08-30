# plugin-loader

[![npm](https://img.shields.io/npm/v/@weedzcokie/plugin-loader?style=flat-square)](https://www.npmjs.com/package/@weedzcokie/plugin-loader)

## Usage

### Define a base class and api for plugins:
```typescript
// Plugin.ts
import { PluginBase } from "@weedzcokie/plugin-loader";

// this could be anything.
export type PluginApi = {
    x: number
    y: number
}

export default abstract class Plugin extends PluginBase<PluginApi> {
    x: number;
    y: number;
    
    init?(): void;

    constructor(api: PluginApi) {
        super(api);
        // `api` is also available from `this.api`.
        this.x = api.x;
        this.y = api.y;
    }
}
```

### Plugin manifest (plugin.json)
```json
{
    "name": "test-plugin",
    "version": "1.0.0"
}
```
`version` must be a semver compatible version string.

And with dependencies, similar to how `package.json` defines dependencies:
```json
{
    "name": "plugin-2",
    "version": "1.0.0",
    "dependencies": {
        "test-plugin": "^1.0.0"
    }
}
```

### Load plugins:

Assuming the following directory tree:
```
├─ plugins
│  ├─ test-plugin
│  │  ├── index.ts
│  │  └── plugin.json
│  └─ plugin-2
│     ├── index.ts
│     └── plugin.json
├─ index.ts
└─ Plugin.ts
```

```typescript
// index.ts
import Loader, { PluginObject } from "@weedzcokie/plugin-loader";
import Plugin, { PluginApi } from "./Plugin.ts":

const plugins = await Loader<Plugin, PluginApi>(["test-plugin"], {
    api: {
        x: 1,
        y: 2,
    },

    // Path to where plugins are located
    path: path.resolve('./plugins'),
    log: (msg: string) => console.log('[PluginLoader]', msg),
    handlers: {
        default: NodeHandler
    }
});
```
