import { SemVer, satisfies, Range } from "semver";
import * as chalk from "chalk";
export { NodeHandler } from "./Handlers/NodeHandler";
export { PluginBase } from "./Plugin";

export interface PluginManifest {
    name: string
    version: string
    semver: SemVer
    dependencies: PluginDependencies
    optionalDependencies: PluginDependencies
    pluginPath?: string
    type?: string | string[]
}

export type HandlerArgument<T, API = unknown> = {
    manifest: PluginManifest
    path: string
    api?: API
    dependencies: {[key: string]: T}
    previous?: any
}

export type PluginObject<T> = {
    plugin: T
    manifest: PluginManifest
    dependent: string[]
}

type LoaderOptions<T, API> = {
    log: (msg: string) => void
    path: string
    api?: API
    handlers: {
        default(arg: HandlerArgument<T, API>): Promise<T>
        [type: string]: (arg: HandlerArgument<T, API>) => Promise<T>
    }
}

type Plugins<T> = {
    [name: string]: PluginObject<T>
}

interface PluginDependencies {
    [pluginName: string]: Range | string
}


class Loader<T, API = unknown> {
    private plugins: Plugins<T> = {};
    private availablePlugins = new Map<string, PluginManifest>();
    options: LoaderOptions<T, API>

    constructor(options: LoaderOptions<T, API>) {
        this.options = options;
    }

    async loadPlugins(pluginList: string[]) {
        this.options.log(`Checking enabled plugins...`);
        for (const pluginName of pluginList) {
            try {
                const manifest = await this.getPluginManifest(pluginName);
                if (manifest.name !== pluginName) {
                    manifest.pluginPath = pluginName;
                }
                this.availablePlugins.set(pluginName, manifest);
            } catch (e) {
                throw new Error(`Invalid manifest: ${pluginName}. ${e}`);
            }
        }

        this.options.log(`Checking dependencies...`);
        for (const manifest of this.availablePlugins.values()) {
            if (manifest.dependencies) {
                await this.checkDependencies(manifest, manifest.dependencies, false);
            }
            if (manifest.optionalDependencies) {
                await this.checkDependencies(manifest, manifest.optionalDependencies, true);
            }
        }

        this.options.log(`Loading plugins...`);
        for (const pluginManifest of this.availablePlugins.values()) {
            const loadedPlugin = this.plugins[pluginManifest.name];

            if (!loadedPlugin) {
                this.options.log(`${chalk.cyan(pluginManifest.name)} [${pluginManifest.version.toString()}]`);
                await this.load(pluginManifest);
            } else {
                this.options.log(`${chalk.cyan(pluginManifest.name)} [${pluginManifest.version.toString()}], loaded by ${loadedPlugin.dependent}`);
            }
        }
        this.options.log(`${chalk.green("Done!")}`);
        return this.plugins;
    }

    async checkDependencies(manifest: PluginManifest, dependencies: PluginDependencies, optional: boolean) {
        for (const dependency in dependencies) {
            let dep = this.availablePlugins.get(dependency) || await this.loadDependency(dependency, optional);
            if (!dep) {
                continue;
            }
            if (!satisfies(dep.semver, dependencies[dependency])) {
                this.availablePlugins.delete(dependency);
                if (optional) {
                    this.options.log(chalk.yellow`Optional dependency not met for '${manifest.name}': expected ${dependency}@${dependencies[dependency]}, got ${dep.semver.toString()}`);
                    continue;
                } else {
                    throw `Dependency not met for '${dependency}': expected ${dependencies[dependency]}, got ${dep.semver.toString()}`;
                }
            }
            if (dep.dependencies) {
                try {
                    await this.checkDependencies(dep, dep.dependencies, false);
                } catch (err) {
                    this.availablePlugins.delete(dependency);
                    throw err;
                }
            }
            if (dep.optionalDependencies) {
                await this.checkDependencies(dep, dep.optionalDependencies, true);
            }
        }
    }

    async loadDependency(dependency: string, optional = false) {
        try {
            const dep = await this.getPluginManifest(dependency);
            this.availablePlugins.set(dependency, dep);
            return dep;
        } catch (err) {
            if (optional) {
                this.options.log(chalk.yellow`Missing optional dependency '${dependency}'`);
                return;
            } else {
                throw `Dependency '${dependency}' not found`;
            }
        }
    }

    async getPluginManifest(pluginName: string) {
        const manifest: PluginManifest = await import(`${this.options.path}/${pluginName}/plugin.json`);
        manifest.semver = new SemVer(manifest.version);
        if (!validateManifest(manifest)) {
            throw "Invalid manifest file";
        }
        if (!manifest.dependencies) {
            manifest.dependencies = {};
        }
        if (!manifest.optionalDependencies) {
            manifest.optionalDependencies = {};
        }
        return manifest;
    }

    async load(plugin: PluginManifest, dependent: string[] = [], depth = 0) {
        const dependencies: {[key: string]: T} = {};
    
        for (const depName in Object.assign({}, plugin.dependencies, plugin.optionalDependencies)) {
            if (!this.plugins[depName]) {
                const dep = this.availablePlugins.get(depName);
                // should only be undefined for missing optional plugins
                if (!dep) {
                    continue;
                }

                this.options.log(`${" ".repeat(depth + 1)}-> ${chalk.cyan(depName)} [${plugin.dependencies[depName]}]`);

                await this.load(dep, dependent.concat(plugin.name), depth + 1);

                const loadedDependency = this.plugins[depName];
                if (!loadedDependency) {
                    throw `Unknown error while loading dependency '${depName}' of '${plugin.name}'`;
                }
            }
            dependencies[depName] = this.plugins[depName].plugin;
        }

        let handler: (arg: HandlerArgument<T, API>) => Promise<T>;
    
        if (Array.isArray(plugin.type)) {
            throw "'plugin.type' as Array not supported yet..";
        } else {
            handler = plugin.type && this.options.handlers[plugin.type]
                ? this.options.handlers[plugin.type]
                : this.options.handlers.default;
        }
    
        const pluginObject: PluginObject<T> = {
            plugin: await handler({ manifest: plugin, path: this.options.path, api: this.options.api, dependencies }),
            manifest: plugin,
            dependent
        };
    
        this.plugins[plugin.name] = pluginObject;
    }
}

// TODO: validate manifest file
function validateManifest(manifest: PluginManifest) {
    return true;
}

export default function PluginLoader<T, API = unknown>(pluginList: string[], options: LoaderOptions<T, API>) {
    const loader = new Loader<T, API>(options);
    return loader.loadPlugins(pluginList);
}
