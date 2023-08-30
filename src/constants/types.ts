import * as ts from 'typescript';
import {
    DecorationRangeBehavior,
    DecorationRenderOptions,
    Location,
    OverviewRulerLane,
} from 'vscode';
import LocationPlus, { TypeOfChange } from '../document/locationApi/location';
import { CodeComment, META_STATE } from '../comments/commentCreatorUtils';
import TimelineEvent from '../data/timeline/TimelineEvent';

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

interface StackOverflowPost {
    body: string;
    votes: number;
    postDate: Date;
}

export interface StackOverflowQuestion extends StackOverflowPost {
    title: string;
    // body: string;
    // votes: number;
    tags: string[];
    answers: StackOverflowAnswer[];
    // askDate: Date;
    lastEditDate?: Date;
    views: number;
    programmingLanguage: string;
    id: string;
    copied?: boolean;
    replies?: StackOverflowPost[];
    warning?: any[];
}

export interface StackOverflowAnswer extends StackOverflowPost {
    // body: string;
    // votes: number;
    isAccepted: boolean;
    // answerDate: Date;
    lastEditDate?: Date;
    url: string;
    id: string;

    copied?: boolean;
    replies?: StackOverflowPost[];
    warning?: any[];
}

export function isStackOverflowAnswer(
    post: StackOverflowPost
): post is StackOverflowAnswer {
    return (post as StackOverflowAnswer).isAccepted !== undefined;
}

export interface StackOverflowCopyBuffer {
    title: string;
    question: StackOverflowQuestion;
    surroundingCode: string;
    copiedMessage: StackOverflowQuestion | StackOverflowAnswer | null;
}

export type AdditionalMetadata =
    | ChatGptCopyBuffer
    | GitHubCopyBuffer
    | StackOverflowCopyBuffer
    | null;

export interface VscodeCopyBuffer extends CopyBuffer {
    location: Location;
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

export interface SearchData {
    query: string;
    url: string;
    selectedPages: string[];
    searhTime: Date;
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
    // id: string;
    webMetadata?: CopyBuffer[];
    changeBuffer?: any[];
}

export enum Event {
    WEB = 'WEB',
    COPY = 'COPY',
    PASTE = 'PASTE',
    COMMENT = 'COMMENT',
}

export interface SerializedDataControllerEvent {
    id: string;
    uid: string;
    time: number;
    // type: string;
    // thingsThatHappened: WEB | CHANGE | NODE;
    node: SerializedReadableNode;
    typeOfChange: TypeOfChange;
    changeContent: string;
    eventData?: { [k in Event]: any };
}

export interface PasteDetails {
    location: Location;
    pasteContent: string;
    pasteMetadata: ChangeBuffer;
}

export interface TrackedPasteDetails extends PasteDetails {
    location: LocationPlus;
    originalLocation: SerializedLocationPlus;
    // changeBuffer: ChangeBuffer[];
    currContent: string;
    id: string;
    style: string;
}

export interface SerializedTrackedPasteDetails {
    location: SerializedLocationPlus;
    pasteContent: string;
    pasteMetadata: ChangeBuffer;
    currContent: string;
    id: string;
    style: string;
}

export interface SerializedNodeDataController {
    node: SerializedReadableNode;
    lastUpdatedTime: number;
    lastUpdatedBy: string;
    // setOfEvents: Event[];
    setOfEventIds: string[];
    pasteLocations: SerializedTrackedPasteDetails[];
}

type DiffLine = {
    aIndex: number;
    bIndex: number;
    line: string;
};

export type Diff =
    | {
          lines: DiffLine[];
          lineCountDeleted: number;
          lineCountInserted: number;
          lineCountMoved: number;
          aMove: any[];
          aMoveIndex: any[];
          bMove: any[];
          bMoveIndex: any[];
      }
    | {
          lines: DiffLine[];
          lineCountDeleted: number;
          lineCountInserted: number;
          lineCountMoved: number;
          aMove?: undefined;
          aMoveIndex?: undefined;
          bMove?: undefined;
          bMoveIndex?: undefined;
      };

export interface ChangeBuffer {
    location: LocationPlus | SerializedLocationPlus;
    typeOfChange: TypeOfChange;
    changeContent: string;
    time: number;
    diff?: Diff;
    addedBlock?: boolean;
    removedBlock?: boolean;
    uid: string;
    id: string;
    changeInfo?: {
        location: SerializedRangePlus;
        associatedCode?: Location | undefined;
        type: string;
        text: string;
        state?: META_STATE | undefined;
    }[];
    eventData?: {
        [Event.COMMENT]?: {
            commentedOut?: boolean;
            uncommented?: boolean;
            // newComments?: CodeComment[];
            // removedComments?: CodeComment[];
            // changedComments?: CodeComment[];
        };
        [Event.COPY]?: {
            copyContent: string;
            nodeId: string;
        };
        [Event.PASTE]?: {
            pasteContent: string;
            nodeId?: string;
            vscodeMetadata?: {
                code: string;
                id: string;
                node: SerializedReadableNode;
            };
        };
        [Event.WEB]?: {
            copyBuffer: CopyBuffer;
        };
    };
}

export interface SerializedChangeBuffer extends ChangeBuffer {
    node: SerializedReadableNode;
    commit: string;
    branch: string;
}

export interface UserMap {
    firestoreUid: string;
    firestoreEmail: string;
    firestoreDisplayName: string;
    githubUid: string;
    githubLogin: string;
    gitName: string;
    gitEmail: string;
}

export interface WebviewData extends SerializedNodeDataController {
    userMap: UserMap;
    pastVersions: SerializedChangeBuffer[];
    formattedPastVersions: TimelineEvent[];
    gitData: TimelineEvent[];
    items: TimelineEvent[];
    firstInstance: number | TimelineEvent;
    parent: SerializedNodeDataController | undefined;
    children: (SerializedNodeDataController | undefined)[] | undefined;
    displayName: string;
    events: (
        | {
              [Event.COMMENT]?: {
                  commentedOut?: boolean;
                  uncommented?: boolean;
                  //   newComments?: CodeComment[];
                  //   removedComments?: CodeComment[];
                  //   changedComments?: CodeComment[];
              };
              [Event.COPY]?: {
                  copyContent: string;
                  nodeId: string;
              };
              [Event.PASTE]?: {
                  pasteContent: string;
                  nodeId?: string;
                  vscodeMetadata?: {
                      code: string;
                      id: string;
                      node: SerializedReadableNode;
                  };
              };
              [Event.WEB]?: {
                  copyBuffer: CopyBuffer;
              };
          }
        | undefined
    )[];
    eventsMap: { [k: string]: any };
    recentChanges: TimelineEvent[];
    // prMap: Map<number, string[]>;
    prMap: { [k: number]: { [commit: string]: TimelineEvent[] } };
    pasteLocations: SerializedTrackedPasteDetails[];
}
// ['git', 'vscode', 'CHAT_GPT', 'STACKOVERFLOW', 'GITHUB', 'pasted-code']
export const META_MANAGER_COLOR = '#519aba80';
export const THEME_COLORS = [
    '#4e79a761',
    META_MANAGER_COLOR,
    '#CCCCFF61',
    '#7575CF61',
    '#5453A661',
    '#9EA9ED61',
];
export const getColorTheme = (copyBuffer: CopyBuffer | null) => {
    if (!copyBuffer) {
        return THEME_COLORS[5];
    }
    switch (copyBuffer.type) {
        case WEB_INFO_SOURCE.CHAT_GPT:
            return THEME_COLORS[2];
        case WEB_INFO_SOURCE.GITHUB:
            return THEME_COLORS[4];
        case WEB_INFO_SOURCE.STACKOVERFLOW:
            return THEME_COLORS[3];
        default:
            return THEME_COLORS[5];
    }
};
