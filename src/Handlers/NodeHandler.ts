import { HandlerArgument } from "..";

export async function NodeHandler<T, API>({ manifest, path, api, dependencies }: HandlerArgument<T, API>) {
    const plugin = await import(`${path}/${manifest.pluginPath || manifest.name}/index.ts`);
    return new plugin.default(api, dependencies) as T;
}
