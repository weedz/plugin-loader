interface Dependencies<API> {
    [dependency: string]: PluginBase<API>
}

export abstract class PluginBase<API = unknown, D = unknown | Dependencies<API>> {
    constructor(protected api: API, protected dependencies: D) {}
}
