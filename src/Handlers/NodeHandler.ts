import { HandlerArgument } from "..";

export async function NodeHandler<T>({ manifest, path, api, dependencies }: HandlerArgument<T>) {
    const plugin = await import(`${path}/${manifest.pluginPath || manifest.name}/index.ts`);
    return new plugin.default(api, dependencies) as T;
}
