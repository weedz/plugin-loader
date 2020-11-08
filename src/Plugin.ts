type Dependencies<API> = {
    [key: string]: PluginBase<API>;
}

export abstract class PluginBase<API> {
    protected api: API;
    protected dependencies: Dependencies<API>;
    constructor(api: API, dependencies?: Dependencies<API>) {
        this.api = api;
        this.dependencies = dependencies || {};
    }
}
