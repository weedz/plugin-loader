import { SemVer, satisfies, Range } from "semver";
import * as chalk from "chalk";
export { NodeHandler } from "./Handlers/NodeHandler";

export interface PluginManifest {
    name: string
    version: string
    semver: SemVer
    dependencies: PluginDependencies
    pluginPath?: string
    type?: string | string[]
}

export type HandlerArgument = {
    manifest: PluginManifest
    path: string
    api?: any
    previous?: any
}

type LoaderOptions = {
    log: Function
    path: string
    api?: any
    handlers: {
        default: Function
        [type: string]: Function
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

async function load(plugin: PluginManifest, options: LoaderOptions, availablePlugins: Map<string, PluginManifest>, plugins: Map<string, any>, dependent: string | null = null, depth = 0) {
    for (const depName in plugin.dependencies) {
        options.log(`${" ".repeat(depth + 1)}-> ${chalk.cyan(depName)} [${plugin.dependencies[depName].version}]`);
        const dep = availablePlugins.get(depName);
        if (!dep) {
            throw `Error loading dependency ${depName} of ${plugin.name}`;
        }
        load(dep, options, availablePlugins, plugins, plugin.name, depth + 1);
    }

    let handler: Function

    if (Array.isArray(plugin.type)) {
        handler = plugin.type.slice(1).reduce((acc, value) => {
            if (!options.handlers[value]) {
                throw new Error(`Handler "${value}" not found`);
            }
            return options.handlers[value]({ previous: acc, manifest: plugin, path: options.path, api: options.api });
        }, options.handlers[plugin.type[0]]({ manifest: plugin, path: options.path, api: options.api }));
    } else {
        handler = plugin.type && options.handlers[plugin.type]
            ? options.handlers[plugin.type]
            : options.handlers.default;
    }

    const pluginObject = {
        plugin: await handler({ manifest: plugin, path: options.path, api: options.api }),
        manifest: plugin,
        dependent
    };

    plugins.set(plugin.name, pluginObject);
}

export default async function Loader(pluginList: string[], options: LoaderOptions) {
    if (!options.api) {
        options.api = {};
    }
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

    const plugins = new Map<string, any>();

    for (const pluginManifest of enabledPlugins.values()) {
        const loadedPlugin = plugins.get(pluginManifest.name);
        
        if (!loadedPlugin) {
            options.log(`${chalk.cyan(pluginManifest.name)} [${pluginManifest.version.toString()}]`);
            await load(pluginManifest, options, enabledPlugins, plugins);
        } else {
            options.log(`${chalk.cyan(pluginManifest.name)} [${pluginManifest.version.toString()}], loaded by ${loadedPlugin.dependent}`);
        }
    }
    options.log(`${chalk.green("Done!")}`);
    return plugins;
}
