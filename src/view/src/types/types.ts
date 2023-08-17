export enum WEB_INFO_SOURCE {
    CHAT_GPT = 'CHAT_GPT',
    GITHUB = 'GITHUB',
    STACKOVERFLOW = 'STACKOVERFLOW',
    VSCODE = 'VSCODE',
    OTHER = 'OTHER',
}

export interface CopyBuffer {
    code: string;
    url: string;
    user: string;
    type: WEB_INFO_SOURCE;
    timeCopied: number;
    id: string;
    additionalMetadata: AdditionalMetadata;
}

interface Code {
    language: string;
    code: string;
    filename: string;
    url?: string;
    startLine?: number;
    endLine?: number;
}

interface Repo {
    name: string;
    owner: string;
    branch: string;
    commit: string;
    stars?: number;
    version?: string;
    readme?: string;
}

export interface GitHubCopyBuffer {
    codeMetadata: Code;
    repo: Repo;
}

interface CodeBlock {
    code: string;
    // codeRef: HTMLElement;
    copied: boolean;
    surroundingText: string;
    language: string;
    parentId: string;
}

export interface ThreadPair {
    id: string;
    time: number;
    userMessage: string;
    botResponse: string;
    codeBlocks: CodeBlock[];
}

type AdditionalMetadata = ChatGptCopyBuffer | GitHubCopyBuffer | null;

export interface ChatGptCopyBuffer {
    // id: string;
    // code: string;
    messageCopied: ThreadPair;
    thread: ChatGptThread;
}

export interface ChatGptThread {
    // _observer: MutationObserver | null;
    _threadItems: ThreadPair[];
    // _botRef: HTMLElement | null;
    // _userRef: HTMLElement | null;
    _tempUserMessage: string | null;
    _tempPair: ThreadPair | null;
    _lastEditedTime: null;
    // _botObserver: MutationObserver | null;
    readonly _id: string;
    readonly _title: string;
}

interface SerializedPosition {
    line: number;
    character: number;
}
export interface SerializedRangePlus {
    start: SerializedPosition;
    end: SerializedPosition;
}

export interface SerializedLocationPlus {
    fsPath: string;
    range: SerializedRangePlus;
    content: string;
    id?: string;
}

export interface SerializedReadableNode {
    humanReadableKind: string;
    location: SerializedLocationPlus;
    id: string;
}

export interface SerializedDataController {
    // changeBuffer: VscodeCopyBuffer[];
    node: SerializedReadableNode;
    webMetadata: CopyBuffer[];
}

export interface SerializedNodeDataController {
    node: SerializedReadableNode;
    lastUpdatedTime: number;
    lastUpdatedBy: string;
    // setOfEvents: Event[];
    setOfEventIds: string[];
    pastVersions?: SerializedDataControllerEvent[];
}

export interface SerializedDataControllerEvent {
    id: string;
    uid: string;
    time: number;
    type: string;
    // thingsThatHappened: WEB | CHANGE | NODE;
    typeOfChange: TypeOfChange;
    changeContent: string;
    eventData: { [k in Event]: any };
}

export enum Event {
    WEB = 'WEB',
    COPY = 'COPY',
    PASTE = 'PASTE',
    COMMENT = 'COMMENT',
}

export enum TypeOfChange {
    RANGE_ONLY = 'RANGE_ONLY',
    CONTENT_ONLY = 'CONTENT_ONLY',
    RANGE_AND_CONTENT = 'RANGE_AND_CONTENT',
    NO_CHANGE = 'NO_CHANGE',
}
