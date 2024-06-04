import { styleText } from "node:util";
import { SemVer, Range as SemVerRange, parse, satisfies } from "semver";

export { NodeHandler } from "./Handlers/NodeHandler";

import { PluginBase } from "./Plugin";
export { PluginBase };

export interface PluginManifest {
    name: string
    version: string
    semver: SemVer
    dependencies: PluginDependencies
    optionalDependencies: PluginDependencies
    pluginPath?: string
    type?: string | string[]
}

export type HandlerArgument<T extends PluginBase<API>, API = unknown> = {
    manifest: PluginManifest
    path: string
    api?: API
    dependencies: { [key: string]: T }
    previous?: any
}

export type PluginObject<T extends PluginBase> = {
    plugin: T
    manifest: PluginManifest
    dependent: string[]
}

type LoaderOptions<T extends PluginBase<API>, API> = {
    log: (msg: string) => void
    path: string
    api?: API
    handlers: {
        default(arg: HandlerArgument<T, API>): Promise<T>
        [type: string]: (arg: HandlerArgument<T, API>) => Promise<T>
    }
}

interface Plugins<T extends PluginBase> {
    [pluginName: string]: PluginObject<T>
}

interface PluginDependencies {
    [pluginName: string]: SemVerRange | string
}


class Loader<T extends PluginBase<API>, API = unknown> {
    private plugins: Plugins<T> = {};
    private availablePlugins = new Map<string, PluginManifest>();
    options: LoaderOptions<T, API>

    constructor(options: LoaderOptions<T, API>) {
        this.options = options;
    }

    async loadPlugins(pluginList: string[]) {
        this.options.log(`Checking enabled plugins...`);
        for (const pluginName of pluginList) {
            const manifest = await this.getPluginManifest(pluginName);
            if (manifest.name !== pluginName) {
                manifest.pluginPath = pluginName;
            }
            this.availablePlugins.set(pluginName, manifest);
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
                this.options.log(`${styleText("cyan", pluginManifest.name)} [${pluginManifest.version.toString()}]`);
                await this.load(pluginManifest);
            } else {
                this.options.log(`${styleText("cyan", pluginManifest.name)} [${pluginManifest.version.toString()}], loaded by ${loadedPlugin.dependent} `);
            }
        }
        this.options.log(`${styleText("green", "Done!")} `);
        return this.plugins;
    }

    async checkDependencies(manifest: PluginManifest, dependencies: PluginDependencies, optional: boolean) {
        for (const dependency in dependencies) {
            let dep = this.availablePlugins.get(dependency) || await this.loadDependency(dependency, optional);
            if (!dep) {
                if (optional) {
                    this.options.log(`${styleText("cyan", manifest.name)}: ${styleText("yellow", `Missing optional dependency '${dependency}'`)} `);
                } else {
                    throw `${manifest.name}: Dependency '${dependency}' not found]`;
                }
                continue;
            }
            if (!satisfies(dep.semver, dependencies[dependency])) {
                this.availablePlugins.delete(dependency);
                if (optional) {
                    this.options.log(styleText("yellow", `Optional dependency not met for '${manifest.name}': expected ${dependency} @${dependencies[dependency]}, got ${dep.semver.toString()} `));
                    continue;
                } else {
                    throw `${manifest.name}: Dependency not met for '${dependency}': expected ${dependencies[dependency]}, got ${dep.semver.toString()} `;
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

    async loadDependency(dependency: string, _optional = false) {
        try {
            const dep = await this.getPluginManifest(dependency);
            this.availablePlugins.set(dependency, dep);
            return dep;
        } catch (err) {
            return false;
        }
    }

    async getPluginManifest(pluginName: string) {
        const pluginsPath = this.options.path;
        const manifest: PluginManifest = (await import(`${pluginsPath} /${pluginName}/plugin.json`, {
            assert: { type: 'json' }
        })).default;
        try {
            validateManifest(manifest);
        } catch (err) {
            throw `Failed in plugin '${pluginName}': ${err} `;
        }
        manifest.semver = new SemVer(manifest.version);
        if (!manifest.dependencies) {
            manifest.dependencies = {};
        }
        if (!manifest.optionalDependencies) {
            manifest.optionalDependencies = {};
        }
        return manifest;
    }

    async load(plugin: PluginManifest, dependent: string[] = [], depth = 0) {
        const dependencies: { [key: string]: T } = {};

        for (const depName in Object.assign({}, plugin.dependencies, plugin.optionalDependencies)) {
            if (!this.plugins[depName]) {
                const dep = this.availablePlugins.get(depName);
                // should only be undefined for missing optional plugins
                if (!dep) {
                    continue;
                }

                this.options.log(`${" ".repeat(depth + 1)} -> ${styleText("cyan", depName)} [${plugin.dependencies[depName]}]`);

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
    const errors: string[] = [];
    if (!manifest.name) {
        errors.push("missing 'name'");
    }
    if (!manifest.version) {
        errors.push("missing 'version'");
    } else if (!parse(manifest.version)) {
        errors.push(`malformed version '${manifest.version}'. Make sure the version field is a valid SemVer string.`)
    }

    if (errors.length) {
        throw styleText("red", `Invalid fields in manifest: \n${errors.join("\n")} `);
    }
    return true;
}

export default function PluginLoader<T extends PluginBase<API, unknown>, API = unknown>(pluginList: string[], options: LoaderOptions<T, API>) {
    const loader = new Loader<T, API>(options);
    return loader.loadPlugins(pluginList);
}
