import { HandlerArgument } from "..";

export async function NodeHandler({ manifest, path, api }: HandlerArgument) {
    const plugin = await import(`${path}/${manifest.pluginPath || manifest.name}/index.ts`);
    return new plugin.default(api);
}
