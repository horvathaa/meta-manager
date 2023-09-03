import {
    Position,
    TextDocument,
    TextDocumentChangeEvent,
    workspace,
    Range,
    WorkspaceEdit,
    Location,
} from 'vscode';
import { Container } from '../container';
import DocumentWatcher from '../document/documentWatcher';
import ReadableNode from '../tree/node';
import RangePlus from '../document/locationApi/range';
import { interval } from 'd3';
import { getRandomArbitrary } from '../document/lib';
import { WEB_INFO_SOURCE } from '../constants/types';

const getEvent = (roll: number) => {
    // copy
    if (roll <= 0.1) {
        return TypeOfChange.COPY;
    }
    // paste
    else if (roll > 0.1 && roll <= 0.26) {
        // extra roll for source of paste
        const sourceRoll = Math.random();
        if (sourceRoll >= 0.3) {
            return TypeOfChange.PASTE_VSCODE;
        } else if (sourceRoll >= 0.2) {
            return TypeOfChange.PASTE_STACKOVERFLOW;
        } else if (sourceRoll >= 0.1) {
            return TypeOfChange.PASTE_GITHUB;
        } else {
            return TypeOfChange.PASTE_CHATGPT;
        }
    }
    // regular edit
    else {
        // extra roll for type of edit
        const editRoll = Math.random();
        if (editRoll >= 0.5) {
            return TypeOfChange.ADD_LINE;
        } else if (editRoll >= 0.25) {
            return TypeOfChange.REMOVE_LINE;
        } else {
            return TypeOfChange.MODIFY_LINE;
        }
    }
};

enum TypeOfChange {
    ADD_LINE,
    REMOVE_LINE,
    MODIFY_LINE,
    COPY,
    PASTE_VSCODE,
    PASTE_STACKOVERFLOW,
    PASTE_GITHUB,
    PASTE_CHATGPT,
}

const totalNumEdits = 50;

// first init
const COMMIT_53c0d24_TIME = 1625029620000;
// hour later completed edits
const COMMIT_4b69d50_TIME = 1625033340000; // had 50 additions, 22 deletions
const COMMIT_7227853_TIME = 1625103540000; // 57 add, 0 delete
const COMMIT_D224524_TIME = 1625151660000; // 12 additions 20 deletions
const COMMIT_86c56b1_TIME = 1626295140000;
const COMMIT_986de57_TIME = 1626531900000;

const currRange = [COMMIT_86c56b1_TIME, COMMIT_986de57_TIME];

const relativePaths = [
    // 'src/utils/search.ts',
    'src/extension.ts',
    // 'src/utils/extractGoogleResults.ts',
    // 'src/utils/fetchPageContent.ts',
    // 'src/utils/extractStackOverflowResults.ts',
];

const LinesToInsert = [
    'console.log("hello world");',
    'console.log("here");',
    '//',
    'let x = 5;',
    "const name = 'John';",
    'const age = 30;',
    'const pi = 3.14159;',
    'let isTrue = true;',
    'let isFalse = false;',
    "const colors = ['red', 'green', 'blue'];",
    "const person = { name: 'Alice', age: 25 };",
    'function greet(name) { return `Hello, ${name}!`; }',
    'function add(a, b) { return a + b; }',
    'const result = add(3, 7);',
    "if (age >= 18) { console.log('You are an adult.'); }",
    'for (let i = 0; i < colors.length; i++) { console.log(colors[i]); }',
    'const doubledNumbers = numbers.map(number => number * 2);',
    'const filteredNumbers = numbers.filter(number => number > 5);',
    'const sum = numbers.reduce((acc, number) => acc + number, 0);',
    'const today = new Date();',
    'const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);',
    'console.log(Math.random());',
    'const regex = /[a-zA-Z]+/g;',
    'const matches = text.match(regex);',
    'const trimmedText = text.trim();',
    'const uppercaseText = text.toUpperCase();',
    'const lowercaseText = text.toLowerCase();',
    'const slicedText = text.slice(0, 5);',
    "const replacedText = text.replace('world', 'friend');",
    "const num = parseFloat('3.14');",
    "const integer = parseInt('42');",
    'const isEven = num % 2 === 0;',
    'const squaredNumbers = numbers.map(number => number ** 2);',
    'const sortedNumbers = numbers.sort((a, b) => a - b);',
    'const reversedNumbers = numbers.reverse();',
    'const uniqueNumbers = [...new Set(numbers)];',
    'const maxNumber = Math.max(...numbers);',
    'const minNumber = Math.min(...numbers);',
    "const isPalindrome = (str) => str === str.split('').reverse().join('');",
    'const sumOfSquares = numbers.reduce((acc, number) => acc + (number ** 2), 0);',
    'const todayFormatted = today.toISOString();',
    'const randomIndex = Math.floor(Math.random() * colors.length);',
    'const shuffledColors = [...colors].sort(() => Math.random() - 0.5);',
    'const mergedArrays = [...arr1, ...arr2];',
    'const squaredEvenNumbers = numbers.filter(number => number % 2 === 0).map(number => number ** 2);',
    'const isPrime = (num) => { for(let i = 2; i < num; i++) if(num % i === 0) return false; return num > 1; };',
    'const factorial = (n) => n === 0 ? 1 : n * factorial(n - 1);',
    "const reversedText = text.split('').reverse().join('');",
    'const roundedNumber = Math.round(num);',
    'const truncatedNumber = Math.trunc(num);',
    'const randomElement = colors[Math.floor(Math.random() * colors.length)];',
    'console.log(`The current URL is: ${window.location.href}`);',
];

const ExtensionLinesToInsert = [
    `let rs;`,
    `try {`,
    `rs = await search(textBeforeCursor)`,
    `} catch (err) {`,
    `vscode.window.showInformationMessage(err.toString());`,
    `return { items:[] }`,
    `}`,
];

const SearchLinesToInsert = [
    `if (urls === null) {`,
    `return Promise.resolve(null)`,
    `}`,
    `let results: SnippetResult[] = [];`,
    `try {`,
    `for (const i in urls.splice(0, 2)) {`,
    `const snippets = await getStackoverflowContent(urls[i]);`,
    `results = results.concat(getSnippetResults(snippets).results);`,
    `}`,
    `resolve({ results })`,
    `} catch (err) {`,
    `reject(err)`,
    `}`,
];

class Test {
    _docs: DocumentWatcher[] = [];
    _nodes: ReadableNode[] = [];
    _nodesCopy: ReadableNode[] = [];
    interval: NodeJS.Timer | null;
    constructor(private readonly container: Container) {
        this._docs = Array.from(this.container.fileParser?.docs || [])
            .map((d) => d[1])
            .filter((d) => relativePaths.includes(d.relativeFilePath));
        console.log('this docs', this._docs);
        // .filter((d) => d[1].isDirty)
        this.interval = null;

        this._nodes = this._docs.map((d) => d._nodesInFile!.toArray()).flat();
        this._nodesCopy = this._nodes.map((n) => n);
        console.log('made these docs n nodes', this);
        // on init get nodes
        // in db mark all the nodes that should be able to be changed in the db
        // simulate change (e.g., add a line)
        // // make a TextDocumentChangeEvent and call onTextDocumentChanged on location with it?
        // // this will trigger handleOnChange in datacontroller which will update change buffer
        // // for paste... we can directly call handleOnPaste with made up ClipboardMetadata interface
        // // need to make sure if we choose a node with a parent, also call the parent's event handlers
        // // OK GAME PLAN
        // // checkout NEXT git commit AFTER one we are at
        // // LAUNCH EXTENSION TO GET ALL NODES SUCH THAT... we actually GET when a new node appears (we can fudge the like "first seen" time to make it seem a little more realistic -- maybe add in "CREATION" event for things we know are new?)
        // // then we can just simulate changes to those nodes
        // // Rinse Repeat for all commits
    }

    static create(container: Container) {
        return new Test(container);
    }

    applyEdit = async (editsSinceLastSave: number, i: number) => {
        // setTimeout(async () => {
        const getDoc =
            relativePaths[Math.floor(Math.random() * relativePaths.length)];
        // const node =
        //     this._nodes[Math.floor(Math.random() * this._nodes.length)];
        const doc =
            this._docs.find((d) => d.relativeFilePath === getDoc)?.document ||
            (await workspace.openTextDocument(
                this._nodes[Math.floor(Math.random() * this._nodes.length)]
                    .location.uri
            ));
        // console.log('doc', doc, 'getDoc', getDoc);
        console.log('EDIT COUNT', editsSinceLastSave, 'i', i);
        if (editsSinceLastSave >= totalNumEdits / 10) {
            const willSave = Math.random() > 0.5;
            if (willSave) {
                // save
                this._nodes.forEach(async (n) => {
                    console.log('saving', n);
                    n.dataController?.handleOnSaveTextDocument(doc);
                });
                editsSinceLastSave = 0;
                // setOfEditedNodes = new Set<ReadableNode>();
            }
            // save
        }
        const eventTime = COMMIT_53c0d24_TIME + i * 1000;
        const typeOfChange = getEvent(Math.random());
        const change = await this.makeChange(typeOfChange, doc, eventTime);
        // console.log('change', change);

        // this._nodes.forEach((n) => {
        //     n.location.onTextDocumentChanged(change, eventTime);
        //     console.log('applying change to ', n);
        // });
        // console.log(`RUN ${i}`, this._nodes, 'change', change);
        // this.applyChange(typeOfChange, change, node, doc);
        // setOfEditedNodes.add(node);

        if (i > totalNumEdits) {
            this.interval && clearInterval(this.interval);
            // reset edits to "canon"
            this._nodesCopy.forEach((n) => {
                console.log('RESET', n);
                n.dataController?.handleOnSaveTextDocument(doc);
            });
        }
        // setTimeout(this.applyEdit, 1000);
        // }, 1000);
    };

    async run() {
        let editsSinceLastSave = 0;
        let runs = 0;
        // for (let i = 0; i < totalNumEdits; i++) {
        this.interval = setInterval(
            () => this.applyEdit(editsSinceLastSave++, runs++),
            2500
        );
        // }
    }

    async makeChange(
        typeOfChange: TypeOfChange,
        doc: TextDocument,
        eventTime: number
    ) {
        // : Promise<TextDocumentChangeEvent> {
        // return await this.makeAddLine(doc);
        switch (typeOfChange) {
            case TypeOfChange.ADD_LINE:
                return await this.makeAddLine(doc);
            case TypeOfChange.REMOVE_LINE:
                return await this.makeRemoveLine(doc);
            default:
            case TypeOfChange.MODIFY_LINE:
                return this.makeModifyLine(doc, eventTime);
            case TypeOfChange.PASTE_VSCODE:
            case TypeOfChange.COPY:
                return this.vscCopyPaste(doc, eventTime);
            case TypeOfChange.PASTE_STACKOVERFLOW:
                return this.makeWebPaste(WEB_INFO_SOURCE.STACKOVERFLOW, doc);
            case TypeOfChange.PASTE_GITHUB:
                return this.makeWebPaste(WEB_INFO_SOURCE.GITHUB, doc);
            case TypeOfChange.PASTE_CHATGPT:
                return this.makeWebPaste(WEB_INFO_SOURCE.CHAT_GPT, doc);
        }
    }

    async makeAddLine(textDocument: TextDocument) {
        const line = Math.floor(Math.random() * textDocument.lineCount);
        const text = textDocument.lineAt(line).text;
        const firstWordPosition = textDocument.lineAt(
            line + 1 < textDocument.lineCount ? line + 1 : line
        ).firstNonWhitespaceCharacterIndex;
        const spaceStr = ' '.repeat(firstWordPosition);
        const range = new Range(
            new Position(line, text.length),
            new Position(line, text.length)
        );
        const edit = this.getReasonableEdit(range, textDocument);
        edit.insert(textDocument.uri, range.start, '\n');

        // const changeEvent: TextDocumentChangeEvent = {
        //     contentChanges: [
        //         {
        //             range,
        //             rangeLength: 0,
        //             rangeOffset: textDocument.offsetAt(range.start),
        //             text: '\n' + spaceStr,
        //         },
        //     ],
        //     document: textDocument,
        //     reason: 1,
        // };
        // const edit = new WorkspaceEdit();
        // if (
        //     line > 60 &&
        //     line < 70 &&
        //     textDocument.fileName.includes('search')
        // ) {
        //     edit.insert(
        //         textDocument.uri,
        //         range.start,
        //         `\n${SearchLinesToInsert.shift()}\n${spaceStr}`
        //     );
        // } else if (
        //     line > 30 &&
        //     line < 45 &&
        //     textDocument.fileName.includes('extension')
        // ) {
        //     edit.insert(
        //         textDocument.uri,
        //         range.start,
        //         `\n${ExtensionLinesToInsert.shift()}\n${spaceStr}`
        //     );
        // } else {
        //     Math.random() > 0.5
        //         ? edit.insert(
        //               textDocument.uri,
        //               range.start,
        //               `\n${
        //                   LinesToInsert[
        //                       Math.floor(Math.random() * LinesToInsert.length)
        //                   ]
        //               }\n${spaceStr}`
        //           )
        //         : edit.insert(textDocument.uri, range.start, `\n${spaceStr}`);
        // }
        // edit.insert(textDocument.uri, range.start, '\n' + spaceStr);
        await workspace.applyEdit(edit);
        // return changeEvent;
    }

    async makeRemoveLine(textDocument: TextDocument) {
        const line = Math.floor(Math.random() * textDocument.lineCount - 1);
        const text = textDocument.lineAt(line).text;
        // don't remove "good" lines
        if (
            LinesToInsert.includes(text) ||
            ExtensionLinesToInsert.includes(text) ||
            SearchLinesToInsert.includes(text)
        ) {
            const range = new Range(
                new Position(line, 0),
                new Position(line, textDocument.lineAt(line).text.length)
            );
            const edit = new WorkspaceEdit();
            edit.replace(textDocument.uri, range, '');
            await workspace.applyEdit(edit);
            return edit;
        }
    }

    async makeModifyLine(textDocument: TextDocument, eventTime: number) {
        const line = Math.floor(Math.random() * textDocument.lineCount - 1);
        const text = textDocument.lineAt(line).text;
        // don't remove "good" lines
        if (
            LinesToInsert.includes(text) ||
            ExtensionLinesToInsert.includes(text) ||
            SearchLinesToInsert.includes(text)
        ) {
            const range = new Range(
                new Position(line, 0),
                new Position(line, textDocument.lineAt(line).text.length)
            );
            const edit = this.getReasonableEdit(range, textDocument);
            await workspace.applyEdit(edit);
            return edit;
        }
    }

    async vscCopyPaste(doc: TextDocument, eventTime: number) {
        const sourceNode =
            this._nodes[Math.floor(Math.random() * this._nodes.length)];
        const sourceDoc = this._docs.find(
            (d) => d.document.uri.fsPath === sourceNode.location.uri.fsPath
        )?.document;
        const nodesInFile = this._nodes.filter(
            (n) => n.location.uri.fsPath === doc.uri.fsPath
        );
        const destNode =
            nodesInFile[Math.floor(Math.random() * nodesInFile.length)];
        const line = Math.floor(
            getRandomArbitrary(
                sourceNode.location.range.start.line,
                sourceNode.location.range.end.line
            )
        );
        console.log(
            'line!',
            line,
            'sourceNode',
            sourceNode,
            'destNode',
            destNode
        );
        const rangeSlice = new Range(
            new Position(
                line,
                sourceDoc!.lineAt(line).firstNonWhitespaceCharacterIndex
            ),
            new Position(line, sourceDoc!.lineAt(line).text.length)
        );
        const copyEvent = {
            location: new Location(sourceDoc!.uri, rangeSlice),
            text: doc.getText(rangeSlice),
            time: eventTime,
        };
        sourceNode.dataController?.handleOnCopy(copyEvent);
        const destLine = Math.floor(
            getRandomArbitrary(
                destNode.location.range.start.line,
                destNode.location.range.end.line
            )
        );
        const destRangeSlice = new Range(
            new Position(
                destLine,
                doc.lineAt(destLine).firstNonWhitespaceCharacterIndex
            ),
            new Position(destLine, doc.lineAt(destLine).text.length)
        );
        const pasteEvent = {
            location: new Location(doc.uri, destRangeSlice),
            text: copyEvent.text,
            time: eventTime,
        };
        destNode.dataController?.handleOnPaste(pasteEvent);
        const edit = new WorkspaceEdit();
        edit.insert(doc.uri, destRangeSlice.end, '\n' + pasteEvent.text);
        await workspace.applyEdit(edit);
    }

    async makeWebPaste(webSource: WEB_INFO_SOURCE, doc: TextDocument) {
        const webEvent = await this.container.firestoreController?.getWebEvent(
            webSource
        );
        if (webEvent) {
            const node =
                this._nodes[Math.floor(Math.random() * this._nodes.length)];
            const line = Math.floor(
                getRandomArbitrary(
                    node.location.range.start.line,
                    node.location.range.end.line
                )
            );
            const rangeSlice = new Range(
                new Position(line, doc.lineAt(line).text.length),
                new Position(line, doc.lineAt(line).text.length)
            );
            this.container.setCopyBuffer(webEvent);
            const pasteEvent = {
                location: new Location(
                    node.location.uri,
                    RangePlus.fromRangeAndText(
                        rangeSlice,
                        webEvent.code
                    ).toRange()
                ),
                text: webEvent.code,
                time: Math.floor(
                    getRandomArbitrary(currRange[0], currRange[1])
                ),
            };
            node.dataController?.handleOnPaste(pasteEvent);
            const edit = new WorkspaceEdit();
            edit.insert(
                node.location.uri,
                rangeSlice.start,
                '\n' + pasteEvent.text
            );
            return edit;
        }
    }

    private getReasonableEdit(range: Range, document: TextDocument) {
        const node = this._nodes.find(
            (n) =>
                n.location.uri.fsPath === document.uri.fsPath &&
                n.dataController!.isOwnerOfRange(range)
        );
        if (node) {
            const vscMetadata =
                node.dataController?.vscodeNodeMetadata?.identifiers;
            if (vscMetadata) {
                const randomId =
                    vscMetadata[Math.floor(Math.random() * vscMetadata.length)];
                const otherId =
                    vscMetadata[Math.floor(Math.random() * vscMetadata.length)];
                if (randomId.kind === 'FunctionDeclaration') {
                    const edit = new WorkspaceEdit();
                    edit.replace(
                        document.uri,
                        range,
                        `function ${randomId.name}() {}`
                    );
                    // await workspace.applyEdit(edit);
                    return edit;
                }
                if (randomId.kind === 'VariableDeclaration') {
                    const edit = new WorkspaceEdit();
                    edit.replace(
                        document.uri,
                        range,
                        `const ${randomId.name} = ${otherId.name};`
                    );
                    // await workspace.applyEdit(edit);
                    return edit;
                }
                if (randomId.kind === 'PropertyAssignment') {
                    const edit = new WorkspaceEdit();
                    edit.replace(
                        document.uri,
                        range,
                        `{ ${randomId.name}: ${otherId.name} };`
                    );
                    // await workspace.applyEdit(edit);
                    return edit;
                }
            }
        }
        const edit = new WorkspaceEdit();
        edit.replace(
            document.uri,
            range,
            LinesToInsert[Math.floor(Math.random() * LinesToInsert.length)]
        );
        return edit;
    }
}

export default Test;
