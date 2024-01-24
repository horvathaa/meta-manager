import { Location, TextDocument, Uri } from 'vscode';
import { CommentConfigHandler } from './CommentManager';
import {
    CodeComment,
    CodeLine,
    LogStatement,
    META_STATE,
    MetaInformation,
    getCodeLine,
    getLegalCommentValues,
    getLegalLogValues,
    lineToPosition,
} from './commentCreatorUtils';
import RangePlus from '../document/locationApi/range';
import LocationPlus from '../document/locationApi/location';

enum SEARCH_VALUES {
    COMMENT = 'comment',
    LOG = 'log',
}

export class MetaInformationExtractor {
    private readonly _searchValues: Map<SEARCH_VALUES, string[]>;
    private _foundComments: CodeComment[];
    private _foundLogStatements: LogStatement[];
    // private readonly _document: TextDocument;
    // private readonly _id: string;

    constructor(
        private readonly languageId: string,
        private readonly content: string,
        private readonly debug = false,
        private readonly uri: Uri
    ) {
        // this._document = document;
        // this._id = document.uri.toString();
        this._searchValues = new Map();
        this._searchValues.set(
            SEARCH_VALUES.COMMENT,
            getLegalCommentValues(this.languageId)
        );
        this.debug &&
            console.log('MADE COMMENT SEARCH VALUE', this._searchValues);
        this._searchValues.set(
            SEARCH_VALUES.LOG,
            getLegalLogValues(this.languageId)
        );
        this.debug && console.log('MADE LOG SEARCH VALUE', this._searchValues);
        this._foundComments = this.getMetaInformation(
            SEARCH_VALUES.COMMENT,
            this.content
        );
        this.debug && console.log('MADE FOUND COMMENTS', this._foundComments);
        this._foundLogStatements = this.getMetaInformation(
            SEARCH_VALUES.LOG,
            this.content
        );
        this.debug && console.log('MADE LOGS', this._foundLogStatements);
    }

    // get id(): string {
    //     return this._id;
    // }

    get searchValues(): Map<SEARCH_VALUES, string[]> {
        return this._searchValues;
    }

    get foundComments(): CodeComment[] {
        return this._foundComments;
    }

    get foundLogStatements(): LogStatement[] {
        return this._foundLogStatements;
    }

    updateMetaInformation(content: string) {
        this._foundComments = this.getMetaInformation(
            SEARCH_VALUES.COMMENT,
            content
        );
        this._foundLogStatements = this.getMetaInformation(
            SEARCH_VALUES.LOG,
            content
        );
    }

    getCommentedLines(): number[] {
        return this.foundComments.map((c) => {
            this.debug && console.log('c', c);
            return c.location.range.start.line;
        });
    }

    // get document(): TextDocument {
    //     return this._document;
    // }

    getMetaInformation(
        type: SEARCH_VALUES,
        content: string
    ): MetaInformation[] {
        const searchValues = this._searchValues.get(type);
        if (!searchValues) {
            return [];
        }
        const oldVals =
            type === SEARCH_VALUES.COMMENT && this.foundComments
                ? this.foundComments
                : type === SEARCH_VALUES.LOG && this.foundLogStatements
                ? this.foundLogStatements
                : [];
        this.debug && console.log('OLD VALUES', oldVals);
        const codeLines = getCodeLine(content);
        this.debug && console.log('CODE LINES', codeLines);
        const metaInformation: MetaInformation[] = [];
        codeLines.forEach((l, i) => {
            const splitToken = l.code.find((c) =>
                searchValues.includes(c.token)
            );
            if (splitToken) {
                let associatedCode: LocationPlus | undefined = undefined; //
                if (type === SEARCH_VALUES.COMMENT) {
                    if (
                        l.code[0].token === splitToken.token &&
                        i + 1 < codeLines.length
                    ) {
                        associatedCode = new LocationPlus(
                            this.uri,
                            RangePlus.fromRange(
                                lineToPosition(codeLines[i + 1])
                            )
                        );
                    } else {
                        const splitIndex = l.code.findIndex(
                            (c) => c.token === splitToken.token
                        );
                        associatedCode = new LocationPlus(
                            this.uri,
                            RangePlus.fromRange(
                                lineToPosition({
                                    ...l,
                                    code: l.code.slice(splitIndex + 1),
                                })
                            )
                        );
                    }
                }
                metaInformation.push({
                    ...(type === SEARCH_VALUES.COMMENT && {
                        splitter: splitToken.token,
                        associatedCode: associatedCode,
                    }),
                    ...{
                        type,
                        text: l.code.map((c) => c.token).join(' '),
                        location: new LocationPlus(
                            this.uri,
                            RangePlus.fromRange(lineToPosition(l))
                        ),
                        state: this.getMetaInformationState(oldVals, l),
                    },
                });
            }
        });
        this.debug && console.log('META INFORMATION', metaInformation);
        // console.log(`metaInformation type: ${type}`, metaInformation);
        return metaInformation;
    }

    getMetaInformationState(
        oldVals: MetaInformation[],
        line: CodeLine
    ): META_STATE {
        // const knownComments = oldVals.
        const oldVal = oldVals.find(
            (v) => v.location.range.start.line === line.line
        );
        if (!oldVal) {
            return META_STATE.NEW;
        }
        return META_STATE.CHANGED;
    }
}

export default MetaInformationExtractor;

// export const getCommentMetadata = (
//     document: TextDocument,
//     codeComments?: any[]
// ): SimpleCodeComment[] => {
//     // const codeLines = getCodeLine(document.getText());

//     const commentConfigHandler = new CommentConfigHandler();
//     // console.log('handler', commentConfigHandler, 'wtf', document.languageId)
//     const commentCfg = commentConfigHandler.getCommentConfig(
//         document.languageId
//     );
//     // console.log('commentCfg', commentCfg)

//     function escapeRegex(string: string) {
//         return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
//     }

//     const commentLineDelimiter = commentCfg?.lineComment ?? '//';
//     // console.log('commentLineDelimeter', commentLineDelimiter)

//     const regex = new RegExp(
//         `\s*${escapeRegex(commentLineDelimiter ?? '//')}.*`,
//         'ig'
//     );
//     const blockRegexOpen = new RegExp(
//         `\s*${escapeRegex(
//             commentCfg && commentCfg.blockComment
//                 ? commentCfg.blockComment[0]
//                 : '/*'
//         )}.*`,
//         'ig'
//     );

//     const blockRegexClose = new RegExp(
//         `\s*${escapeRegex(
//             commentCfg && commentCfg.blockComment
//                 ? commentCfg.blockComment[1]
//                 : '*/'
//         )}.*`,
//         'ig'
//     );
//     const comments: any[] = [];
//     const blockCommentQueue: any[] = [];
//     // console.log('codeLines', codeLines)
//     codeLines.forEach((l) => {
//         const lineText = l.code.map((c) => c.token).join(' ');
//         // const followingComments: CodeLine[] = [];
//         // // console.log('lineText', lineText)
//         // const isLineComment = regex.test(lineText);
//         // const isAlreadyUsed =
//         //     comments.length &&
//         //     document
//         //         .validateRange(
//         //             createRangeFromTokenData(comments[comments.length - 1])
//         //         )
//         //         .contains(createRangeFromCodeLine(l));
//         // ||
//         // blockRegexOpen.test(lineText) ||
//         // blockRegexClose.test(lineText)

//         // if (isLineComment && !isAlreadyUsed) {
//         //     const type =
//         //         l.code[0].token === commentCfg?.lineComment
//         //             ? 'wholeLine'
//         //             : 'trailing';
//         //     const match = l.code.find(
//         //         (c) => c.token === commentCfg?.lineComment
//         //     );
//         //     let newRange = undefined;
//         //     const text = l.code.map((c) => c.token).join(' ');
//         // }
//     });
//     return comments;
// };
