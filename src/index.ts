import { SemVer, satisfies, Range } from "semver";
import * as chalk from "chalk";
export { NodeHandler } from "./Handlers/NodeHandler";
export { PluginBase } from "./Plugin";

export interface PluginManifest {
    name: string
    version: string
    semver: SemVer
    dependencies: PluginDependencies
    pluginPath?: string
    type?: string | string[]
}

export type HandlerArgument<T> = {
    manifest: PluginManifest
    path: string
    api?: any
    dependencies?: {[key: string]: T}
    previous?: any
}

export type PluginObject<T> = {
    plugin: T
    manifest: PluginManifest
    dependent: string[]
}

type LoaderOptions<API = any> = {
    log: (msg: string) => void
    path: string
    api?: API
    handlers: {
        default<T>(arg: HandlerArgument<T>): Promise<T>
        [type: string]: <T>(arg: HandlerArgument<T>) => Promise<T>
    }
}

interface PluginDependencies {
    [pluginName: string]: {
        version: Range | string,
        optional?: boolean
    }
}

async function getPluginManifest(pluginName: string, pluginPath: string) {
    const manifest: PluginManifest = await import(`${pluginPath}/${pluginName}/plugin.json`);
    manifest.semver = new SemVer(manifest.version);
    if (!validateManifest(manifest)) {
        throw new Error("Invalid manifest file");
    }
    return manifest;
}

// TODO: validate manifest file
function validateManifest(manifest: PluginManifest) {
    return true;
}

async function checkDependencies(manifest: PluginManifest, pluginPath: string, enabledPlugins: Map<string, PluginManifest>) {
    for (const dependency of Object.keys(manifest.dependencies)) {
        let dep = enabledPlugins.get(dependency);
        if (!dep) {
            dep = await getPluginManifest(dependency, pluginPath);
            enabledPlugins.set(dependency, dep);
        }
        if (!satisfies(dep.semver, manifest.dependencies[dependency].version)) {
            throw new Error(`Dependency not met for ${dependency}: expected ${manifest.dependencies[dependency].version}, got ${dep.semver.toString()}`);
        }
        if (dep.dependencies) {
            checkDependencies(dep, pluginPath, enabledPlugins);
        }
    }
}

async function load<T>(plugin: PluginManifest, options: LoaderOptions, availablePlugins: Map<string, PluginManifest>, plugins: Map<string, PluginObject<T>>, dependent: string[] = [], depth = 0) {
    const dependencies: {[key: string]: any} = {};

    for (const depName in plugin.dependencies) {
        const dep = availablePlugins.get(depName);
        if (!dep) {
            throw `Error loading dependency ${depName} of ${plugin.name}`;
        }
        if (!plugins.get(depName)) {
            options.log(`${" ".repeat(depth + 1)}-> ${chalk.cyan(depName)} [${plugin.dependencies[depName].version}]`);
            await load<T>(dep, options, availablePlugins, plugins, dependent.concat(plugin.name), depth + 1);

            const loadedDependency = plugins.get(depName);
            if (!loadedDependency) {
                throw `Unknown error while loading dependency ${depName} of ${plugin.name}`;
            }
            dependencies[depName] = loadedDependency.plugin;
        }
    }

    let handler: <T>(arg: HandlerArgument<T>) => Promise<T>;

    if (Array.isArray(plugin.type)) {
        throw "'plugin.type' as Array not supported yet..";
    } else {
        handler = plugin.type && options.handlers[plugin.type]
            ? options.handlers[plugin.type]
            : options.handlers.default;
    }

    const pluginObject: PluginObject<T> = {
        plugin: await handler<T>({ manifest: plugin, path: options.path, api: options.api, dependencies }),
        manifest: plugin,
        dependent
    };

    plugins.set(plugin.name, pluginObject);
}

export default async function Loader<T, Api = unknown>(pluginList: string[], options: LoaderOptions<Api>) {
    const enabledPlugins = new Map<string, PluginManifest>();
    options.log(`Checking enabled plugins...`);
    for (const pluginName of pluginList) {
        try {
            const manifest = await getPluginManifest(pluginName, options.path);
            if (manifest.name !== pluginName) {
                manifest.pluginPath = pluginName;
            }
            enabledPlugins.set(pluginName, manifest);
        } catch (e) {
            throw new Error(`Invalid manifest: ${pluginName}`);
        }
    }
    options.log(`Checking dependencies...`);
    for (const manifest of enabledPlugins.values()) {
        if (manifest.dependencies) {
            await checkDependencies(manifest, options.path, enabledPlugins);
        }
    }
    options.log(`Loading plugins...`);

    const plugins = new Map<string, PluginObject<T>>();

    for (const pluginManifest of enabledPlugins.values()) {
        const loadedPlugin = plugins.get(pluginManifest.name);
        
        if (!loadedPlugin) {
            options.log(`${chalk.cyan(pluginManifest.name)} [${pluginManifest.version.toString()}]`);
            await load<T>(pluginManifest, options, enabledPlugins, plugins);
        } else {
            options.log(`${chalk.cyan(pluginManifest.name)} [${pluginManifest.version.toString()}], loaded by ${loadedPlugin.dependent}`);
        }
    }
    options.log(`${chalk.green("Done!")}`);
    return plugins;
}
