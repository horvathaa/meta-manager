/*
 *
 * debugAdapter.ts
 * Handles listening for debug events that we can interpret and support with annotations
 *
 */

import {
    DebugAdapterTracker,
    // DebugConsole,
    DebugSession,
    window,
    debug,
    SourceBreakpoint,
    Location,
} from 'vscode';

import { MessagingService } from './messagingService';
import {
    DebugProtocol,
    // DebuggerCommunicationService,
} from '@vscode/debugprotocol';
// import { annotationList, gitInfo, user } from '../extension'
// import { getAllAnnotationsWithAnchorInFile } from '../utils/utils'
// import {
//     getAnchorsInCurrentFile,
//     createRangeFromAnchorObject,
// } from '../anchorFunctions/anchor'
// import { Annotation, Reply } from '../constants/constants'
// import { handleUpdateAnnotation } from '../viewHelper/viewHelper'
import { v4 as uuidv4 } from 'uuid';
// import { formatTimestamp } from '../view/app/utils/viewUtils'

export class DebugAdapter implements DebugAdapterTracker {
    private readonly messagingService: MessagingService;
    private debugSession: DebugSession;
    // private debugCommunicationService: DebuggerCommunicationService
    constructor(
        debugSession: DebugSession,
        messagingService: MessagingService
        // debugCommunicationService: DebuggerCommunicationService
    ) {
        this.messagingService = messagingService;
        // this.annoBreakpoints = [];
        this.debugSession = debugSession;
        // this.debugCommunicationService = debugCommunicationService;
    }
    onWillStartSession() {
        console.log('starting this session', this.debugSession);
        if (!window.activeTextEditor) {
            return;
        }
    }

    // @override
    onWillReceiveMessage(message: any): void {
        console.log('will receive message', message);
        if (message.command) {
            // Only send pertinent debug messages
            switch ((message as DebugProtocol.Request).command as string) {
                case 'continue':
                    this.messagingService.sendStartMessage(message);
                    break;
                case 'stackTrace':
                    this.messagingService.sendPauseMessage(message);
                    break;
                case 'variables':
                    this.onVariablesRequest(message);
                    break;
            }
        }
    }

    // @override
    onDidSendMessage(message: any) {
        if (message.command) {
            // Only send pertinent debug messages
            switch ((message as DebugProtocol.Request).command as string) {
                case 'stackTrace':
                    break;
                case 'variables':
                    break;
            }
        }
    }

    private onVariablesRequest(r: DebugProtocol.VariablesRequest) {
        return;
    }
    // A debugger error should unlock the webview
    onError() {
        this.messagingService.sendStartMessage('error');
    }
    // Device is always running when exiting debugging mode
    onExit() {
        this.messagingService.sendStartMessage('exit');
    }

    cleanPath(path: string) {
        return path.toLowerCase().replace(/\\/g, '').replace(/\//g, '');
    }
}
