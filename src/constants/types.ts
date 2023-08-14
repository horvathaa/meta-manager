import * as ts from 'typescript';
import {
    DecorationRangeBehavior,
    DecorationRenderOptions,
    Location,
    OverviewRulerLane,
} from 'vscode';
import LocationPlus from '../document/locationApi/location';

export type LegalDataSource = 'github' | 'firestore' | 'git' | 'code' | 'web';

export interface ReadableNode {
    node: ts.Node;
    humanReadableKind: string;
    location: Location;
    id?: string;
}

export const isReadableNode = (node: any): node is ReadableNode => {
    return node.humanReadableKind !== undefined && node.location !== undefined;
};

export const namedDeclarations = [
    'VariableDeclaration',
    'PropertyAssignment',
    'EnumDeclaration',
    'MethodDeclaration',
    'InterfaceDeclaration',
    'ClassDeclaration',
    'ImportDeclaration',
    'NamespaceImport',
    'ImportSpecifier',
    'Parameter',
    'BindingElement', //  ??
    'EnumMember',
    'FunctionDeclaration',
];

export const LocationPlusTextEditorDecorationTypeOptions: DecorationRenderOptions =
    {
        overviewRulerLane: OverviewRulerLane.Right,
        light: {
            // this color will be used in light color themes
            // borderColor: 'darkblue',
            border: '0.2px solid rgba(0, 0, 0, .25)',
            overviewRulerColor: 'darkgreen',
        },
        dark: {
            // this color will be used in dark color themes
            // borderColor: ,
            border: '0.2px solid rgba(217, 234, 247, .25)',
            overviewRulerColor: 'lightgreen',
        },
        backgroundColor: '#93c0ff1c',
        rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    };

interface CodeBlock {
    code: string;
    codeRef: HTMLElement;
    copied: boolean;
    surroundingText: string;
    language: string;
    parentId: string;
}

export interface ChatGptThread {
    _observer: MutationObserver | null;
    _threadItems: ThreadPair[];
    _botRef: HTMLElement | null;
    _userRef: HTMLElement | null;
    _tempUserMessage: string | null;
    _tempPair: ThreadPair | null;
    _lastEditedTime: NodeJS.Timeout | null;
    _botObserver: MutationObserver | null;
    readonly _id: string;
    readonly _title: string;
}

export interface ThreadPair {
    id: string;
    time: number;
    userMessage: string;
    botResponse: string;
    codeBlocks: CodeBlock[];
}

export enum WEB_INFO_SOURCE {
    CHAT_GPT = 'CHAT_GPT',
    GITHUB = 'GITHUB',
    STACKOVERFLOW = 'STACKOVERFLOW',
    VSCODE = 'VSCODE',
    OTHER = 'OTHER',
}

export interface SearchData {
    searchTime: Date;
    query: string;
    url: string;
    selectedPages: string[];
}

export interface CopyBuffer {
    code: string;
    url: string;
    user: string;
    type: WEB_INFO_SOURCE;
    timeCopied: number;
    id: string;
    additionalMetadata: AdditionalMetadata;
    searchData: null | SearchData;
}

type AdditionalMetadata = ChatGptCopyBuffer | GitHubCopyBuffer | null;

export interface VscodeCopyBuffer extends CopyBuffer {
    location: LocationPlus;
    pasteTime: number;
    gitMetadata: any;
}

export interface ChatGptCopyBuffer {
    // id: string;
    // code: string;
    messageCopied: ThreadPair;
    thread: ChatGptThread;
}

interface Code {
    language: string;
    code: string;
    filename: string;
    url?: string;
    startLine?: number;
    endLine?: number;
}

// TODO: add stars, version, readme
// Would be nice to also isten for copy-paste from within VS Code
// pull in "local changes" from source in which code was copied
// like this code is from the chrome extension part of this repo
// would be nice to get any changes i make to that interface over here
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
    changeBuffer?: any[];
}
