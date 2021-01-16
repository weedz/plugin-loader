type Dependencies<API> = {
    [key: string]: PluginBase<API>;
}

export abstract class PluginBase<API, D = Dependencies<API>> {
    protected api: API;
    protected dependencies: D;
    constructor(api: API, dependencies: D) {
        this.api = api;
        this.dependencies = dependencies;
    }
}
