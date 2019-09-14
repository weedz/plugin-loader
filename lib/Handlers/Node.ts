import { PluginManifest } from "../PluginLoader";

export default async function(manifest: PluginManifest, pluginPath: any, pluginAPI: any) {
    const plugin = await import(`${pluginPath}/${manifest.pluginPath || manifest.name}/index.ts`);
    return new plugin.default(pluginAPI);
}
