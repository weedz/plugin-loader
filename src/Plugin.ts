type Dependencies<Api> = {
    [key: string]: PluginBase<Api>;
}

export abstract class PluginBase<Api> {
    protected api: Api;
    protected dependencies: Dependencies<Api>;
    constructor(api: Api, dependencies?: Dependencies<Api>) {
        this.api = api;
        this.dependencies = dependencies || {};
    }
}
