import { HandlerArgument } from "../PluginLoader";

export default async function({ manifest, path, api }: HandlerArgument) {
    const plugin = await import(`${path}/${manifest.pluginPath || manifest.name}/index.ts`);
    return new plugin.default(api);
}
