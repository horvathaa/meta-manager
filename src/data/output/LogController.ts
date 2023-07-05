interface OutputEvent {
    time: number;
    value: any;
}

class LogController {
    _logContent?: string;
    _variableReferences?: string[];
    _values: OutputEvent[];
    constructor(logContent?: string, variableReferences?: string[]) {
        if (logContent) {
            this._logContent = logContent;
        }
        if (variableReferences) {
            this._variableReferences = variableReferences;
        }
        this._values = [];
    }

    addEvent(value: any) {
        this._values.push({
            time: new Date().getTime(),
            value,
        });
    }
}
