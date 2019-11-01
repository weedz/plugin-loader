import { SemVer, satisfies, Range } from "semver";
import chalk from "chalk";

export interface PluginManifest {
    name: string,
    version: SemVer | string,
    dependencies: PluginDependencies,
    pluginPath?: string,
    type?: string | string[]
}

export type HandlerArgument = {
    manifest: PluginManifest
    path: string
    api?: any
    previous?: any
}

interface PluginDependencies {
    [pluginName: string]: {
        version: Range | string,
        optional?: boolean
    }
}

async function getPluginManifest(pluginName: string, pluginPath: string) {
    const manifest: PluginManifest = await import(`${pluginPath}/${pluginName}/plugin.json`);
    manifest.version = new SemVer(manifest.version);
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
        if (!satisfies(dep.version, manifest.dependencies[dependency].version)) {
            throw new Error(`Dependency not met for ${dependency}: expected ${manifest.dependencies[dependency].version}, got ${dep.version.toString()}`);
        }
        if (dep.dependencies) {
            checkDependencies(dep, pluginPath, enabledPlugins);
        }
    }
}

export default async function Loader(pluginList: string[], pluginPath: string, options: {
    log: Function,
    api?: any,
    handlers: {
        default: Function,
        [type: string]: Function
    }
}) {
    if (!options.api) {
        options.api = {};
    }
    const enabledPlugins = new Map<string, PluginManifest>();
    options.log(`Checking enabled plugins...`);
    for (const pluginName of pluginList) {
        try {
            const manifest = await getPluginManifest(pluginName, pluginPath);
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
            await checkDependencies(manifest, pluginPath, enabledPlugins);
        }
    }
    options.log(`Loading plugins...`);
    const plugins = new Map<string, any>();
    for (const plugin of enabledPlugins.values()) {
        options.log(`${chalk.cyan(plugin.name)} [${plugin.version.toString()}]`);

        let handler: Function

        if (Array.isArray(plugin.type)) {
            handler = plugin.type.slice(1).reduce((acc, value) => {
                if (!options.handlers[value]) {
                    throw new Error(`Handler "${value}" not found`);
                }
                return options.handlers[value]({ previous: acc, manifest: plugin, path: pluginPath, api: options.api });
            }, options.handlers[plugin.type[0]]({ manifest: plugin, path: pluginPath, api: options.api }));
        } else {
            handler = plugin.type && options.handlers[plugin.type]
                ? options.handlers[plugin.type]
                : options.handlers.default;
        }

        const pluginObject = {
            plugin: await handler({ manifest: plugin, path: pluginPath, api: options.api }),
            manifest: plugin
        };
        plugins.set(plugin.name, pluginObject);
    }
    options.log(`${chalk.green("Done!")}`);
    return plugins;
}
