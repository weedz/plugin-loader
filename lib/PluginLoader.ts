import { SemVer, satisfies, Range } from "semver";
import chalk from "chalk";

export interface PluginManifest {
    name: string,
    version: SemVer | string,
    dependencies: PluginDependencies,
    pluginPath?: string,
    type?: string
}

interface PluginDependencies {
    [pluginName: string]: {
        version: Range | string,
        optional?: boolean
    }
}

async function getPluginManifest(pluginName: string, pluginPath: string) {
    const manifest = await import(`${pluginPath}/${pluginName}/plugin.json`);
    manifest.version = new SemVer(manifest.version);
    if (!validateManifest(manifest)) {
        throw "Invalid manifest file";
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
        if (!satisfies(dep.version, manifest.dependencies[dependency])) {
            throw new Error(`Dependency not met for ${dependency}: expected ${manifest.dependencies[dependency]}, got ${dep.version.toString()}`);
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

        let handler = plugin.type && options.handlers[plugin.type]
            ? options.handlers[plugin.type]
            : options.handlers.default;

        const pluginObject = {
            plugin: await handler(plugin, pluginPath, options.api),
            manifest: plugin
        };
        plugins.set(plugin.name, pluginObject);
    }
    options.log(`${chalk.green("Done!")}`);
    return plugins;
}
