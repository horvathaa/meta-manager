import * as ts from 'typescript';
import {
    DecorationRangeBehavior,
    DecorationRenderOptions,
    Location,
    OverviewRulerLane,
} from 'vscode';

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

interface ThreadPair {
    id: string;
    time: number;
    userMessage: string;
    botResponse: string;
    codeBlocks: CodeBlock[];
}

export interface CopyBuffer {
    id: string;
    code: string;
    messageCopied: ThreadPair;
    thread: any;
}
