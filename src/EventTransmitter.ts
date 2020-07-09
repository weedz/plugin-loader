class EventTransmitter{
    listeners: {
        [type: string]: Function[]
    };

    constructor() {
        this.listeners = {};
    }

    subscribe(type: string, listener: Function) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
        return () => {
            this.unsubscribe(type, listener);
        }
    }
    unsubscribe(type: string, listener: Function) {
        this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }

    dispatchEvent(type: string, data: any) {
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
