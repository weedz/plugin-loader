# plugin-loader

[![npm](https://img.shields.io/npm/v/@weedzcokie/plugin-loader?style=flat-square)](https://www.npmjs.com/package/@weedzcokie/plugin-loader)

## Usage

Define a base class and api for plugins:
```typescript
// Plugin.ts
import { PluginBase } from "@weedzcokie/plugin-loader";
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

Load plugins:
```typescript
// index.ts
import Loader from "@weedzcokie/plugin-loader";
import Plugin from "./Plugin.ts":

// not needed, just to show return type of `Loader`
const loadedPlugins: Map<string, PluginObject<Plugin>> = new Map();

Loader<Plugin>(config.plugins, {
    api: {
        x: 1,
        y: 2,
    },
    // Path to where plugins are located
    path: path.resolve('./plugins'),
    log: (str:string) => (Log(str, 'PluginLoader', 3)),
    handlers: {
        default: NodeHandler
    }
}).then(plugins => {
    loadedPlugins = plugins;
});
```
