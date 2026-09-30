import { type HandlerArgument } from "../types.js";
import { type PluginBase } from "../Plugin.js";

export async function NodeHandler<T extends PluginBase<API>, API>({
  manifest,
  path,
  api,
  dependencies,
}: HandlerArgument<T, API>): Promise<T> {
  const plugin = await import(
    `${path}/${manifest.pluginPath || manifest.name}/index.js`
  );
  return new plugin.default(api, dependencies) as T;
}
