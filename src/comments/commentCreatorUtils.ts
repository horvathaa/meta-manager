import { Location, Range, TextDocument } from 'vscode';
import { CommentConfigHandler } from './CommentManager';
import RangePlus from '../document/locationApi/range';
import { SerializedLocationPlus } from '../constants/types';
import LocationPlus from '../document/locationApi/location';

const DEFAULT_COMMENT_TYPES = {
    lineComment: '//',
    blockComment: ['/*', '*/'],
};

const LOG_FUNCTIONS: { [key: string]: string } = {
    javascript: 'console.log',
    python: 'print',
    java: 'System.out.println',
    csharp: 'Console.WriteLine',
    cplusplus: 'std::cout',
    ruby: 'puts',
    php: 'echo',
    swift: 'print',
    go: 'fmt.Println',
    rust: 'println!',
    kotlin: 'println',
    typescript: 'console.log',
    dart: 'print',
    r: 'print',
};

export enum META_STATE {
    NEW = 'NEW',
    CHANGED = 'CHANGED',
}
export interface MetaInformation {
    type: string;
    text: string;
    // location: Location;
    location: LocationPlus | SerializedLocationPlus; // ??
    state?: META_STATE;
}

export interface CodeComment extends MetaInformation {
    associatedCode?: LocationPlus | SerializedLocationPlus;
    splitter?: string;
}

export interface LogStatement extends MetaInformation {
    identifers?: string[];
}

export interface CodeLine {
    code: CodeToken[];
    line: number;
    isEmptyLine: boolean;
    isOnlySymbols: boolean;
}

export interface CodeToken {
    token: string;
    offset: number;
    line?: number; // sometimes we need to know what line the token is on *shrug*
}

interface StartPosition {
    startLine: number;
    startOffset: number;
}

export const codeLineToString = (c: CodeLine) => {
    return `${' '.repeat(c.code[0].offset)}${c.code
        .map((c) => c.token)
        .join(' ')}`;
};

export const compareLines = (a: CodeLine, b: CodeLine) => {
    return similarity(
        a.code.map((c) => c.token).join(''),
        b.code.map((c) => c.token).join('')
    );
};

export const getCodeLine = (
    text: string,
    start?: StartPosition
): CodeLine[] => {
    return text.split('\n').map((t, i) => {
        let n: number[] = [];
        let sum = 0;
        const splitText = t.split(' ');
        const lengths = splitText.map((t) => t.length);
        lengths.reduce((runningTotal, currentValue, currIndex) => {
            if (currentValue !== 0) {
                n.push(runningTotal + currIndex);
            }
            return runningTotal + currentValue;
        }, sum);
        const code: CodeToken[] = t
            .split(' ')
            .filter((c) => c.length)
            .map((c, idx) => {
                return {
                    token: c
                        .replace(/(?:\r\n|\n|\r)/g, '')
                        .replace(/^\s+|\s+$|\s+(?=\s)/g, ''),
                    offset:
                        i === 0 && start ? n[idx] + start.startOffset : n[idx],
                };
            });

        return {
            code,
            line: start ? start.startLine + i : i,
            isEmptyLine:
                (code.length === 1 && code[0].token === '') || !code.length,
            isOnlySymbols: !code.some((c) => c.token.match(/[a-z]/i)),
        };
    });
};

export const getLegalCommentValues = (languageId: string) => {
    const config = new CommentConfigHandler().getCommentConfig(languageId);
    if (config) {
        const { lineComment, blockComment } = config;
        if (lineComment && blockComment) {
            return [lineComment, blockComment[0], blockComment[1]];
        } else if (lineComment) {
            return [
                lineComment,
                DEFAULT_COMMENT_TYPES.blockComment[0],
                DEFAULT_COMMENT_TYPES.blockComment[1],
            ];
        } else if (blockComment) {
            return [
                DEFAULT_COMMENT_TYPES.lineComment,
                blockComment[0],
                blockComment[1],
            ];
        }
    }
    return [];
};

export const getLegalLogValues = (languageId: string) => {
    const logFunction = LOG_FUNCTIONS[languageId];
    if (!logFunction) {
        return [];
    } else {
        return [logFunction];
    }
};

const lineToRange = (l: CodeLine): Range => {
    if (l.code.length === 0) {
        return new Range(l.line, 0, l.line, 0);
    }
    return new Range(
        l.line,
        l.code[0].offset,
        l.line,
        l.code[l.code.length - 1].offset +
            l.code[l.code.length - 1].token.length
    );
};

// export const lineToPosition = (l: CodeLine, document: TextDocument) => {
export const lineToPosition = (l: CodeLine) => {
    // return document.positionAt(l.code[0].offset); // consider adding total offset value to token and/or line
    // return new Location(document.uri, lineToRange(l));
    return lineToRange(l);
};

function editDistance(s1: string, s2: string) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i;
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue =
                            Math.min(Math.min(newValue, lastValue), costs[j]) +
                            1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

export function similarity(s1: string, s2: string) {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (
        (longerLength - editDistance(longer, shorter)) /
        // @ts-ignore
        parseFloat(longerLength)
    );
}
