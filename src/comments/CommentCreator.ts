import { Location, TextDocument } from 'vscode';
import { CommentConfigHandler } from './CommentManager';
import {
    CodeComment,
    LogStatement,
    MetaInformation,
    getCodeLine,
    getLegalCommentValues,
    getLegalLogValues,
    lineToPosition,
} from './commentCreatorUtils';

export class MetaInformationExtractor {
    private readonly _searchValues: Map<string, string[]>;
    private readonly _foundComments: CodeComment[];
    private readonly _foundLogStatements: LogStatement[];
    private readonly _document: TextDocument;
    private readonly _id: string;

    constructor(document: TextDocument) {
        this._document = document;
        this._id = document.uri.toString();
        this._searchValues = new Map();
        this._searchValues.set(
            'comment',
            getLegalCommentValues(this._document)
        );
        this._searchValues.set('log', getLegalLogValues(this._document));
        this._foundComments = this.getMetaInformation('comment');
        this._foundLogStatements = this.getMetaInformation('log');
    }

    get id(): string {
        return this._id;
    }

    get searchValues(): Map<string, string[]> {
        return this._searchValues;
    }

    get document(): TextDocument {
        return this._document;
    }

    getMetaInformation(type: string): MetaInformation[] {
        const searchValues = this._searchValues.get(type);
        if (!searchValues) {
            return [];
        }
        const codeLines = getCodeLine(this._document.getText());
        const metaInformation: MetaInformation[] = [];
        codeLines.forEach((l) => {
            console.log('l', l);
            if (l.code.some((c) => searchValues.includes(c.token))) {
                metaInformation.push({
                    type,
                    text: l.code.map((c) => c.token).join(' '),
                    location: lineToPosition(l, this._document),
                });
            }
        });
        console.log(`metaInformation type: ${type}`, metaInformation);
        return metaInformation;
    }
}

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
