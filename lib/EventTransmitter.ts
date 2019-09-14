class EventTransmitter{
    listeners: {};

    constructor() {
        this.listeners = {};
    }

    subscribe(type, listener: Function) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
        return function() {
            this.unsubscribe(type, listener);
        }
    }
    unsubscribe(type, listener){
        this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }

    dispatchEvent(type, data) {
        if (!this.listeners[type]) {
            return false;
        }
        for (const listener of this.listeners[type]) {
            listener(data);
        }
    }
}

let transmitter = new EventTransmitter();

export default transmitter;

// type : EventType
// this.listerners[type] = this.EventTransmitter.subscribe(type, (message) => {this.messages.push(message)})
