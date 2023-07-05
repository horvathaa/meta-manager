/*
 *
 * debug.ts
 * Allows for hooking into VS Code's debugging infrastructure
 *
 */

// import { IPty, spawn } from 'node-pty';
import { Container } from '../container';
// import { DebugAdapterFactory } from './debugAdapterFactory';
// import { MessagingService } from './messagingService';
import {
    DebugSession,
    Disposable,
    debug,
    window,
    Pseudoterminal,
    EventEmitter,
    Terminal,
    workspace,
    DebugAdapterTracker,
} from 'vscode';
import { DebugAdapterFactory } from './debugAdapterFactory';
import { MessagingService } from './messagingService';
// https://github.com/microsoft/vscode-python-devicesimulator/blob/274869a67677b4038a6686cdb86123fc7b3094da/src/debugger/debugAdapterFactory.ts

// interface ProcessPseudoterminal extends Pseudoterminal {
//     ptyProcess: IPty;
// }

class DebugController extends Disposable {
    // _terminal: Terminal;
    // _debugAdapter: DebugAdapterTracker
    constructor(private readonly container: Container) {
        // super(() => this.initListeners());
        super(() => this.dispose());
        // this._terminal = window.createTerminal({
        //     name: 'Meta Manager',
        //     // pty: this.createPty(),
        // });
        this.initListeners();
    }

    // get terminal() {
    //     // return this._terminal;
    // }

    static create(container: Container) {
        return new DebugController(container);
    }

    // createPty() {
    //     const eventEmitter = new EventEmitter<string>();
    //     // try {
    //     const pseudoTerminal: ProcessPseudoterminal = {
    //         onDidWrite: eventEmitter.event,
    //         open: () => {
    //             console.log('open');
    //         },
    //         close: () => {
    //             console.log('close');
    //         },
    //         handleInput: (data: string) => {
    //             console.log('handleInput', data);
    //         },
    //         ptyProcess: spawn('powershell.exe', [], {
    //             name: 'xterm-color',
    //             cols: 80,
    //             rows: 30,
    //             cwd: process.cwd(),
    //             env: process.env,
    //         }),
    //     };
    //     console.log('ptyProcess', pseudoTerminal);
    //     pseudoTerminal.ptyProcess.onData((data: any) => {
    //         const message = data.toString();
    //         console.log('message', message);
    //         eventEmitter.fire(message);
    //     });
    //     return pseudoTerminal;
    //     // } catch (e) {
    //     //     console.error('e', e);
    //     // }
    // }

    initListeners() {
        console.log('init listeners');

        // const onChange = debug.onDidC

        const onStart = debug.onDidStartDebugSession((e) => {
            // const debugConsole = debug.activeDebugConsole;
            // debugConsole.getTerminal();
            // Override the write function of the debug console
            // const originalWrite = debugConsole.write;
            // debugConsole.write = function (value) {
            //     // Perform actions with the logged value
            //     console.log(value);

            //     // Call the original write function
            //     originalWrite.call(debugConsole, value);
            // };
            // handleOnDidStartDebugSession(e);
            console.log('e', e);
            this.handleOnDidStartDebugSession(e);
        });
        // const onOutput = debug.onDidWriteDebugConsole((e) => { });
        return () => {
            onStart.dispose();
        };
    }

    handleOnDidStartDebugSession(e: DebugSession) {
        const debugAdapterFactory = new DebugAdapterFactory(
            e,
            new MessagingService(undefined)
        );
        debug.registerDebugAdapterTrackerFactory('*', debugAdapterFactory);
        return;
    }
}

export default DebugController;
