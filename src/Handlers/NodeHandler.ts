import { HandlerArgument } from "..";
import { PluginBase } from "../Plugin";

export async function NodeHandler<T extends PluginBase<API>, API>({ manifest, path, api, dependencies }: HandlerArgument<T, API>) {
    const plugin = await import(`${path}/${manifest.pluginPath || manifest.name}`);
    return new plugin.default(api, dependencies) as T;
}
