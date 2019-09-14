import { resolve } from "path";
import PluginLoader from "./lib/PluginLoader";
import Handler from "./lib/Handlers/Node";

const handlers = {
    default: Handler
};

const plugins = PluginLoader([], resolve("plugins"), {
    log: console.log,
    handlers,
});
