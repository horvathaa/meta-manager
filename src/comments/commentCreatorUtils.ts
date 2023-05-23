import { Location, Range, TextDocument } from 'vscode';
import { CommentConfigHandler } from './CommentManager';

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

export interface MetaInformation {
    type: string;
    text: string;
    location: Location;
}

export interface CodeComment extends MetaInformation {
    associatedCode?: Location;
}

export interface LogStatement extends MetaInformation {
    identifers?: string[];
}

export interface CodeLine {
    code: CodeToken[];
    line: number;
    isEmptyLine: boolean;
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
        };
    });
};

export const getLegalCommentValues = (document: TextDocument) => {
    const config = new CommentConfigHandler().getCommentConfig(
        document.languageId
    );
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

export const getLegalLogValues = (document: TextDocument) => {
    const logFunction = LOG_FUNCTIONS[document.languageId];
    if (!logFunction) {
        return [];
    } else {
        return [logFunction];
    }
};

const lineToRange = (l: CodeLine): Range => {
    return new Range(
        l.line,
        l.code[0].offset,
        l.line,
        l.code[l.code.length - 1].offset +
            l.code[l.code.length - 1].token.length
    );
};

export const lineToPosition = (l: CodeLine, document: TextDocument) => {
    // return document.positionAt(l.code[0].offset); // consider adding total offset value to token and/or line
    return new Location(document.uri, lineToRange(l));
};
