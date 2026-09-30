import type { SemVer, Range as SemVerRange } from "semver";
import type { PluginBase } from "./Plugin.js";

export type LoaderOptions<T extends PluginBase<API>, API> = {
  log: (msg: string) => void;
  path: string;
  api?: API;
  handlers: {
    default(arg: HandlerArgument<T, API>): Promise<T>;
    [type: string]: (arg: HandlerArgument<T, API>) => Promise<T>;
  };
};

export interface Plugins<T extends PluginBase> {
  [pluginName: string]: PluginObject<T>;
}

export interface PluginDependencies {
  [pluginName: string]: SemVerRange | string;
}

export interface PluginManifest {
  name: string;
  version: string;
  semver: SemVer;
  dependencies: PluginDependencies;
  optionalDependencies: PluginDependencies;
  pluginPath?: string;
  type?: string | string[];
}

export type HandlerArgument<T extends PluginBase<API>, API> = {
  manifest: PluginManifest;
  path: string;
  api?: API;
  dependencies: { [key: string]: T };
  previous?: any;
};

export type PluginObject<T extends PluginBase> = {
  plugin: T;
  manifest: PluginManifest;
  dependent: string[];
};
