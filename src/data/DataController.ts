import {
    Uri,
    Range,
    Disposable,
    window,
    workspace,
    TextDocumentContentChangeEvent,
    commands,
    TextEditor,
    TextEditorEdit,
    TextDocument,
    Selection,
    Location,
} from 'vscode';
import { ClipboardMetadata, Container } from '../container';
import {
    AbstractTreeReadableNode,
    CompareSummary,
    NodeWithChildren,
    SimplifiedTree,
    getSimplifiedTreeName,
} from '../tree/tree';
import ReadableNode, {
    NodeState,
    TypeOfChangeToNodeState,
    nodeContentChange,
} from '../tree/node';
import LocationPlus, {
    ChangeEvent,
    TypeOfChange,
} from '../document/locationApi/location';
import { ListLogLine, DefaultLogFields } from 'simple-git';
import {
    CollectionReference,
    DocumentData,
    DocumentReference,
} from 'firebase/firestore';
import TimelineEvent, { GitType } from './timeline/TimelineEvent';
import { ParsedTsNode } from '../document/languageServiceProvider/LanguageServiceProvider';
import { debounce, isLocation } from '../utils/lib';
import { patienceDiffPlus } from '../utils/PatienceDiff';
import {
    ChangeBuffer,
    CopyBuffer,
    Diff,
    Event,
    SerializedChangeBuffer,
    SerializedDataController,
    SerializedDataControllerEvent,
    SerializedLocationPlus,
    SerializedNodeDataController,
    SerializedReadableNode,
    VscodeCopyBuffer,
} from '../constants/types';
import MetaInformationExtractor from '../comments/CommentCreator';
import RangePlus from '../document/locationApi/range';
import { CodeComment, META_STATE } from '../comments/commentCreatorUtils';
import { CurrentGitState } from './git/GitController';
import * as ts from 'typescript';
import { v4 as uuidv4 } from 'uuid';
import { getProjectName, getVisiblePath } from '../document/lib';
// import { nodeToRange } from '../document/lib';
const tstraverse = require('tstraverse');
export type LegalDataType =
    | (DefaultLogFields & ListLogLine)
    | DocumentData
    | SerializedChangeBuffer
    | GitType; // not sure this is the right place for this but whatever

interface PasteData {
    uri: Uri;
    textDocumentContentChangeEvent: TextDocumentContentChangeEvent;
}

export interface FirestoreControllerInterface {
    ref: DocumentReference<DocumentData>;
    pastVersionsCollection: CollectionReference<DocumentData>;
    write: (newNode: any) => void;
    logVersion: (versionId: string, newNode: any) => void;
    readPastVersions: () => Promise<SerializedChangeBuffer[]>;
}

interface PasteDetails {
    location: Location;
    pasteContent: string;
    pasteMetadata: ChangeBuffer;
}

export class DataController {
    // extends AbstractTreeReadableNode<ReadableNode> {
    _gitData: TimelineEvent[] | undefined;
    _firestoreData: TimelineEvent[] | undefined;
    // _outputData: OutputDataController | undefined;
    _firestoreControllerInterface: FirestoreControllerInterface | undefined;
    _tree: SimplifiedTree<ReadableNode> | undefined;
    _metaInformationExtractor: MetaInformationExtractor;
    _pastVersions: SerializedChangeBuffer[] = [];
    // _readableNode: ReadableNode;
    // _chatGptData: VscodeCopyBuffer[] | undefined = [];
    _webMetaData: VscodeCopyBuffer[] = [];
    _vscNodeMetadata: ParsedTsNode | undefined;
    _disposable: Disposable | undefined;
    _debug: boolean = false;
    _emit: boolean = false;
    _seen: boolean = false;
    _didPaste: PasteDetails | null = null;
    _changeBuffer: ChangeBuffer[];
    _ownedLocations: LocationPlus[] = [];
    // _pasteDisposable: Disposable;

    constructor(
        private readonly readableNode: ReadableNode,
        private readonly container: Container,
        private readonly debug = readableNode.id ===
            'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}'
    ) {
        // super();
        // this._readableNode = readableNode;
        this._changeBuffer = [];
        this.debug && console.log('MAKING META', this.readableNode);
        this._metaInformationExtractor = new MetaInformationExtractor(
            this.readableNode.languageId,
            this.readableNode.location.content,
            this.debug
        );
        this.debug && console.log('this', this);
        // this._pasteDisposable =
        this.initListeners();
        this.debug && console.log('init complete');
    }

    compare(other: ReadableNode): CompareSummary<ReadableNode> {
        return this.readableNode.compare(other);
    }

    setTree(tree: SimplifiedTree<ReadableNode>) {
        this._tree = tree;
        this.readableNode.id === 'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}' &&
            console.log('tree set', this._tree);
    }

    initListeners() {
        this._disposable = Disposable.from(
            // this._pasteDisposable,
            // tbd how much info to copy in the copy event -- probably would need
            // to transmit back to container? put in copy buffer
            this.container.onCopy((copyEvent) => {
                if (
                    this.readableNode.location.containsPartOf(
                        copyEvent.location
                    )
                ) {
                    this.handleOnCopy(copyEvent);
                }
            }),
            // same questions as above for paste -- what to save
            // from console logs it seems like this event gets fired before the
            // on change but that's probably due to the debounce for that...?
            // tbd
            this.container.onPaste((pasteEvent) => {
                if (
                    this.readableNode.location.containsStart(
                        pasteEvent.location
                    )
                ) {
                    this.handleOnPaste(pasteEvent);
                }
            }),
            this.readableNode.location.onChanged.event(
                // debounce(async (changeEvent: ChangeEvent) => {
                (changeEvent: ChangeEvent) => this.handleOnChange(changeEvent)
            ),
            // ),
            this.readableNode.location.onSelected.event(
                async (location: Selection) => {
                    // can probably break these out into their own pages
                    this.handleOnSelected(location);
                }
            ),
            workspace.onDidSaveTextDocument((document) => {
                if (
                    document.uri.fsPath ===
                    this.readableNode.location.uri.fsPath
                    //     &&
                    // this._changeBuffer.length > 0
                ) {
                    this.handleOnSaveTextDocument(document);
                }
            }),
            window.onDidChangeActiveTextEditor((editor) => {
                // console.log('is this getting called lol', document);
                this.handleOnDidChangeActiveTextEditor(editor?.document);
            })
        );
        return () => this.dispose();
    }

    parseDiff(diff: Diff) {
        console.log('diff', diff);
        const removedLines = diff.lines.filter((l) => l.bIndex === -1);
        const removedCode = removedLines.map((l) => l.line).join('\n');
        const addedLines = diff.lines.filter((l) => l.aIndex === -1);
        const addedCode = addedLines.map((l) => l.line).join('\n');
        let diffState = {
            addedBlock: false,
            removedBlock: false,
        };
        if (addedCode.includes('{') && addedCode.includes('}')) {
            diffState.addedBlock = true;
            // if(this._tree && this._tree.isLeaf || this._tree?.root?.children.some(c => c.root?.data.lo))
        }
        if (removedCode.includes('{') && removedCode.includes('}')) {
            diffState.removedBlock = true;
        }
        return diffState;
    }

    private initReadableNode(
        readableNodeParam: ReadableNode,
        name: string,
        changeBuffer?: ChangeBuffer
    ) {
        const readableNode = readableNodeParam.copy();
        readableNode.dataController = new DataController(
            readableNode,
            this.container
        );
        readableNode.setId(name);
        readableNode.registerListeners();
        readableNode.dataController._firestoreControllerInterface =
            this.container.firestoreController!.createNodeMetadata(
                name,
                this.container.firestoreController!.getFileCollectionPath(
                    getVisiblePath(
                        workspace.name ||
                            getProjectName(
                                this.readableNode.location.uri.toString()
                            ),
                        this.readableNode.location.uri.fsPath
                    )
                )
            );

        // const tree = this._tree?.insert(readableNode, {
        //     name: readableNode.id,
        // });
        // readableNode.dataController._tree = tree;
        changeBuffer &&
            readableNode.dataController._changeBuffer.push(changeBuffer);
        return readableNode;
    }

    private addBlockToTree(
        b: ts.Block,
        name: string,
        insertedRange: Range,
        changeBuffer?: ChangeBuffer
    ) {
        const newLocation = new LocationPlus(
            this.readableNode.location.uri,
            insertedRange
        );
        newLocation.updateContent(
            window.activeTextEditor || window.visibleTextEditors[0]
        );
        const readableNode = ReadableNode.create(
            b,
            newLocation,
            this.container,
            `${name}:${uuidv4()}`
        );

        const sigh = newLocation.deriveRangeFromOffset(b.pos, b.end);
        console.log('pwease....', sigh, newLocation);

        readableNode.dataController = new DataController(
            readableNode,
            this.container
        );
        readableNode.setId(name);
        readableNode.registerListeners();
        readableNode.dataController._firestoreControllerInterface =
            this.container.firestoreController!.createNodeMetadata(
                name,
                this.container.firestoreController!.getFileCollectionPath(
                    getVisiblePath(
                        workspace.name ||
                            getProjectName(
                                this.readableNode.location.uri.toString()
                            ),
                        this.readableNode.location.uri.fsPath
                    )
                )
            );

        const tree = this._tree?.insert(readableNode, {
            name: readableNode.id,
        });
        readableNode.dataController._tree = tree;
        changeBuffer &&
            readableNode.dataController._changeBuffer.push(changeBuffer);
    }

    handleInsertBlock(
        addedContent: string,
        insertedRange: Range,
        changeBuffer?: ChangeBuffer
    ) {
        if (this.isOwnerOfRange(insertedRange)) {
            const sourceFile = ts.createSourceFile(
                this.readableNode.location.uri.fsPath,
                addedContent,
                ts.ScriptTarget.Latest,
                true
            );
            setTimeout(() => {
                this.evenSimplerTraverse(
                    sourceFile,
                    window.activeTextEditor?.document ||
                        window.visibleTextEditors[0].document,
                    changeBuffer
                );
            }, 3000);
        }
    }

    handleUpdateChangeBuffer(
        oldContent: string,
        newContent: string,
        changeEvent: ChangeEvent
    ) {
        const { addedContent, insertedRange } = changeEvent;
        if (
            addedContent &&
            insertedRange &&
            addedContent.includes('{') &&
            addedContent.includes('}') &&
            (!this._didPaste ||
                !addedContent.includes(this._didPaste.pasteContent)) && // yeesh not good
            addedContent !== this.readableNode.location.content
        ) {
            console.log(
                'this._didPaste',
                this._didPaste,
                'added',
                addedContent
            );
            this._debug = true;
            this.handleInsertBlock(addedContent, insertedRange);
        }

        const diff = patienceDiffPlus(
            oldContent.split(/\n/),
            newContent.split(/\n/)
        );
        const { addedBlock, removedBlock } = this.parseDiff(diff);
        const oldComments = this._metaInformationExtractor.foundComments;
        this._metaInformationExtractor.updateMetaInformation(newContent);
        this._metaInformationExtractor.foundComments.forEach((c) => {
            c.location = (
                this.readableNode.location.range as RangePlus
            ).translate(c.location);
        });
        let commentInfo = undefined;
        if (
            oldComments.length !==
            this._metaInformationExtractor.foundComments.length
        ) {
            commentInfo = {
                newComments:
                    this._metaInformationExtractor.foundComments.filter(
                        (c) => c.state && c.state === META_STATE.NEW
                    ),
            };
        }
        this._changeBuffer.push({
            ...(commentInfo && {
                changeInfo: commentInfo.newComments.map((n) => {
                    return {
                        ...n,
                        location: (n.location as RangePlus).serialize(),
                    };
                }),
            }),
            ...this.getBaseChangeBuffer(),
            typeOfChange: changeEvent.typeOfChange,
            changeContent: newContent,
            diff,
            addedBlock,
            removedBlock,
        });
        // this._didPaste = false;
    }

    private getBaseChangeBuffer() {
        const time = Date.now();
        return {
            time,
            uid: this.container.firestoreController?._user?.uid || 'anonymous',
            id: `${this.readableNode.id}:${time}`,
            location: this.readableNode.location.serialize(),
            changeContent: this.readableNode.location.content,
        };
    }

    async handleUpdateNodeMetadata(newContent: string, location: LocationPlus) {
        const editor = window.activeTextEditor || window.visibleTextEditors[0];
        const doc =
            editor.document.uri.fsPath === location.uri.fsPath
                ? editor.document
                : await workspace.openTextDocument(location.uri); // idk when this would ever happen??? maybe in a git pull where a whole bunch of docs are being updated

        const newNodeMetadata =
            this.container.languageServiceProvider.parseCodeBlock(
                newContent,
                doc,
                location
            );
        this._vscNodeMetadata = newNodeMetadata;
    }

    handleOnCopy(copyEvent: ClipboardMetadata) {
        if (this.readableNode.location.contains(copyEvent.location)) {
            this._changeBuffer.push({
                ...this.getBaseChangeBuffer(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: this.readableNode.location.content,
                eventData: {
                    [Event.COPY]: {
                        copyContent: copyEvent.text,
                        nodeId: this.readableNode.id,
                    },
                },
            });
            this.isOwnerOfRange(copyEvent.location) &&
                this.container.updateClipboardMetadata({
                    code: copyEvent.text,
                    id: this.readableNode.id,
                    node: this.readableNode.serialize(),
                });
        }
    }

    handleOnPaste(pasteEvent: ClipboardMetadata) {
        console.log(
            'PASTED',
            this,
            'paste',
            pasteEvent,
            this.container.copyBuffer
        );
        let eventObj: ChangeBuffer | undefined;
        if (this.container.copyBuffer) {
            const { repository, ...rest } = this.container.gitController
                ?.gitState as CurrentGitState;
            const details = {
                ...this.container.copyBuffer,
                location: pasteEvent.location,
                pasteTime: Date.now(),
                gitMetadata: rest,
            };
            this._webMetaData.push(details);
            eventObj = {
                ...this.getBaseChangeBuffer(),
                location: LocationPlus.fromLocation(
                    pasteEvent.location
                ).serialize(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: pasteEvent.text,
                eventData: {
                    [Event.WEB]: {
                        copyBuffer: this.container.copyBuffer,
                    },
                },
            };
            this._changeBuffer.push(eventObj);
            this._debug = true;
            this._emit = true;
            // console.log('posting', this.serialize());
        } else {
            const { vscodeMetadata } = pasteEvent;
            eventObj = {
                ...this.getBaseChangeBuffer(),
                location: LocationPlus.fromLocation(
                    pasteEvent.location
                ).serialize(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: pasteEvent.text,
                eventData: {
                    [Event.PASTE]: {
                        pasteContent: pasteEvent.text,
                        nodeId: this.readableNode.id, // replace with readable node id that was copiedd
                        vscodeMetadata,
                    },
                },
            };
            this._changeBuffer.push(eventObj);
        }

        this._didPaste = {
            location: pasteEvent.location,
            pasteContent: pasteEvent.text,
            pasteMetadata: eventObj,
        };
        if (pasteEvent.text.includes('{') && pasteEvent.text.includes('}')) {
            this.handleInsertBlock(
                pasteEvent.text,
                pasteEvent.location.range,
                eventObj
            );
            console.log('DID INSERT BLOCK', this);
            // return;
        }
    }

    handleOnChange(changeEvent: ChangeEvent) {
        const location = changeEvent.location;
        const newContent = location.content;
        const oldContent = changeEvent.previousRangeContent.oldContent;

        if (
            !nodeContentChange(
                TypeOfChangeToNodeState(changeEvent.typeOfChange)
            )
        ) {
            return;
        }

        if (this._didPaste) {
            const { location, pasteContent } = this._didPaste;
            const { addedContent, insertedRange } = changeEvent;
            if (
                (insertedRange && location.range.isEqual(insertedRange)) ||
                addedContent === pasteContent
            ) {
                console.log('IN HERE');
                return;
            }
        }

        // this._debug &&
        console.log('changeEvent!!!!!!!', changeEvent, 'this!!!!!', this);

        // this._emit = true;
        this.handleUpdateChangeBuffer(oldContent, newContent, changeEvent);
        this.handleUpdateNodeMetadata(newContent, location);
        this.handleUpdateTree(newContent);
        // if (this._emit) {
        //     this.container.webviewController?.postMessage({
        //         command: 'updateWebData',
        //         data: this.serialize(),
        //     });
        // }
    }

    private isOwnerOfRange(location: Range | Location) {
        const comparator = isLocation(location) ? location.range : location;
        return (
            this._tree &&
            (this._tree.isLeaf ||
                !this._tree.root?.children.some((c) =>
                    c.root?.data.location.range.contains(comparator)
                ))
        );
    }

    private async initGitData() {
        const gitRes = (await this.getGitData()) || [];
        if (gitRes.length > 0) {
            this._gitData = gitRes.map((r) => new TimelineEvent(r));
        } else {
            this._gitData = [];
        }
    }

    private getMinDate() {
        const items = this._gitData?.concat(
            this._pastVersions.map((v) => new TimelineEvent(v))
        );
        return items?.reduce(
            (min, p) => (p._formattedData.x < min ? p._formattedData.x : min),
            0
        );
    }

    private getMaxDate() {
        const items = this._gitData?.concat(
            this._pastVersions.map((v) => new TimelineEvent(v))
        );
        return items?.reduce(
            (min, p) => (p._formattedData.x > min ? p._formattedData.x : min),
            0
        );
    }

    private getMaxY() {
        const items = this._gitData?.concat(
            this._pastVersions.map((v) => new TimelineEvent(v))
        );
        return items?.reduce(
            (min, p) => (p._formattedData.y > min ? p._formattedData.y : min),
            0
        );
    }

    async handleOnSelected(location: Selection) {
        console.log('SELECTED', this);
        if (this.isOwnerOfRange(location)) {
            const allData = this.serialize();
            console.log('allData', {
                ...allData,
                pastVersions: this._pastVersions,
            });
            if (!this._gitData?.length) {
                await this.initGitData();
            }
            this.container.webviewController?.postMessage({
                command: 'updateTimeline',
                data: {
                    id: this.readableNode.id,
                    metadata: {
                        ...allData,
                        pastVersions: this._pastVersions,
                        formattedPastVersions: this._pastVersions.map(
                            (v) => new TimelineEvent(v)
                        ),
                        gitData: this._gitData,
                        items: this._gitData?.concat(
                            this._pastVersions.map((v) => new TimelineEvent(v))
                        ),
                        xDomain: [
                            new Date(this.getMinDate() || 0),
                            new Date(this.getMaxDate() || 0),
                        ],
                        yDomain: [0, this.getMaxY()],
                    },
                },
            });
        }
        // this._debug = true;

        // const fireStoreRes = (await this.getFirestoreData()) || [];
        // if (fireStoreRes.length > 0) {
        //     this._firestoreData = fireStoreRes.map((r) => new TimelineEvent(r));
        // } else {
        //     this._firestoreData = [];
        // }
        // const allData = [...this._firestoreData, ...this._gitData];
    }

    // updateChild(tree: SimplifiedTree<ReadableNode>) {
    //     const childToUpdate = this._tree?.root?.children.find((c) => {
    //         if (c.root?.data.id === tree.root?.data.id) {
    //             return true;
    //         }
    //         return false;
    //     });
    //     if (childToUpdate) {
    //         (this._tree!.root as NodeWithChildren<ReadableNode>).children =
    //             this._tree!.root!.children.map((c) =>
    //                 c.root?.data.id !== childToUpdate.root?.data.id ? c : tree
    //             );
    //         this._tree!.root!.data.dataController?.updateChild(this._tree!);
    //     }
    // }

    evenSimplerTraverse(
        sourceFile: ts.SourceFile,
        docCopy: TextDocument,
        changeBuffer?: ChangeBuffer
    ) {
        const nodes: ts.Node[] = [];
        // const blocks: { [k: string]: any }[] = [];
        let currTreeInstance: SimplifiedTree<ReadableNode>[] = [this._tree!];
        const code = docCopy.getText();
        const context = this;
        const bigLocation = new LocationPlus(
            docCopy.uri,
            new Range(0, 0, docCopy.lineCount, 1000)
        );
        bigLocation.updateContent(docCopy);
        function enter(node: ts.Node) {
            nodes.push(node);
            if (ts.isBlock(node)) {
                const readableNodeArrayCopy = nodes.map((n) => n);
                let name = `${getSimplifiedTreeName(
                    readableNodeArrayCopy.reverse()
                )}:${uuidv4()}`;
                const offsetStart = code.indexOf(node.getText());
                // console.log(
                //     'offsetStart',
                //     offsetStart,
                //     'node text',
                //     node.getText(),
                //     'code',
                //     code
                // );
                const offsetEnd = offsetStart + node.getText().length;
                // console.log('end', offsetEnd);
                const newLocation = new LocationPlus(
                    docCopy.uri,
                    bigLocation.deriveRangeFromOffset(offsetStart, offsetEnd)
                );
                newLocation.updateContent(docCopy);
                const readableNode = context.initReadableNode(
                    ReadableNode.create(
                        node,
                        newLocation,
                        context.container,
                        name
                    ),
                    name
                );
                console.log('made this', readableNode);
                const treeRef = currTreeInstance[
                    currTreeInstance.length - 1
                ].insert(readableNode, {
                    name: name,
                });
                readableNode.dataController?.setTree(treeRef);
                changeBuffer &&
                    readableNode.dataController?._changeBuffer.push(
                        changeBuffer
                    );
                currTreeInstance.push(treeRef);
                // todo: add position using node offset within inserted range because
                // inserted ranges can be a bit wonky
                // blocks.push({ node, name: `${name}` });
            }
        }

        function leave(node: ts.Node) {
            const topNode = nodes.pop();
            if (topNode && ts.isBlock(node)) {
                currTreeInstance.pop();
            }
        }

        tstraverse.traverse(sourceFile, { enter, leave });
        console.log('jesus christ', this);
        // return blocks;
    }

    async handleOnSaveTextDocument(textDocument: TextDocument) {
        // console.log('posting', this.serialize());
        // if nothing has changed, don't do anything
        // note change buffer wont update if the content is the same
        // but range is different, may be worth updating db in that case but
        // doing none of these other things
        if (!this._changeBuffer.length) {
            return;
        }

        // if the node has been deleted, notify the parent up until the parent no longer has the
        // status of deleted and update db

        if (
            this.readableNode.state &&
            this.readableNode.state === NodeState.DELETED
        ) {
            this._tree?.parent?.remove(this.readableNode);
        }

        console.log('this....', this);

        this._firestoreControllerInterface?.write({
            ...this.serialize(),
        });
        if (this.container.gitController?.gitState) {
            const { commit, branch } = this.container.gitController
                ?.gitState as CurrentGitState;
            this._changeBuffer.forEach((c) => {
                const { diff, ...rest } = c;
                const obj = {
                    ...rest,
                    commit, // tbd if we just want this as a subcollection
                    branch,
                };
                this._pastVersions.push({
                    ...obj,
                    node: this.readableNode.serialize(),
                });
                this._firestoreControllerInterface?.logVersion(c.id, obj);
            });
            this._changeBuffer = [];
        }
    }

    async handleOnDidChangeActiveTextEditor(
        textDocument: TextDocument | undefined
    ) {
        if (
            textDocument?.uri.fsPath ===
                this.readableNode.location.uri.fsPath &&
            !this._seen
        ) {
            // console.log('opening', this);
            this._seen = true;
            this._pastVersions =
                (await this._firestoreControllerInterface?.readPastVersions()) ||
                [];
            // console.log('this', this);
        }
    }

    simpleTraverse(sourceFile: ts.SourceFile, docCopy: TextDocument) {
        const context = this;
        console.log('context before', context);
        let nodes: ts.Node[] = [];
        const seenNodes = new Set<string>();
        function enter(node: ts.Node) {
            nodes.push(node);
            // probably need to add in other scopes such as object literals
            // some of the scopes do not use the block node
            // i'm not sure why
            if (ts.isBlock(node)) {
                const name = `${getSimplifiedTreeName(
                    nodes.map((n) => n).reverse()
                )}`;
                console.log('name', name, 'node', node, 'docCopy', docCopy);
                const readableNode = ReadableNode.create(
                    node,
                    docCopy,
                    context.container,
                    ''
                );
                console.log(
                    'omgggg',
                    readableNode,
                    'context node',
                    context.readableNode
                );
                readableNode.location.range = (
                    readableNode.location.range as RangePlus
                ).translate(context.readableNode.location.range);
                console.log('readableNode in if enter block', readableNode);
                if (context._tree) {
                    console.log('yes there is a tree', context._tree);
                    const hasMatch = context._tree.root?.children.find((c) => {
                        if (
                            c.root?.data.location.contains(
                                readableNode.location
                            )
                        ) {
                            return true;
                        }
                        return false;
                    });
                    console.log('hasMatch', hasMatch);
                    if (hasMatch) {
                        seenNodes.add(hasMatch.root?.data.id || '');
                        return;
                    } else {
                        readableNode.dataController = new DataController(
                            readableNode,
                            context.container
                            // debug
                        );
                        console.log('new node', readableNode);
                        const id = `${name}:${uuidv4()}`;
                        context._tree.insert(readableNode, {
                            name: id,
                        });
                        console.log('inserted', context._tree);
                        readableNode.setId(id);
                        console.log('set id', readableNode);
                        readableNode.registerListeners();
                        console.log('registered listeners', readableNode);
                        readableNode.dataController._firestoreControllerInterface =
                            context.container.firestoreController!.createNodeMetadata(
                                name,
                                context.container.firestoreController!.getFileCollectionPath(
                                    getVisiblePath(
                                        workspace.name ||
                                            getProjectName(
                                                context.readableNode.location.uri.toString()
                                            ),
                                        context.readableNode.location.uri.fsPath
                                    )
                                )
                            );
                        console.log(
                            'created node metadata',
                            readableNode.dataController
                        );
                        seenNodes.add(id);
                        console.log('finish init', readableNode);
                    }
                }
            }
        }

        function leave(node: ts.Node) {
            nodes.pop();
            // console.log('leaving', node);
        }

        tstraverse.traverse(sourceFile, { enter, leave });
        this._tree?.root?.children.forEach((c) => {
            if (seenNodes.has(c.root?.data.id || '')) {
                return;
            } else {
                c.root!.data.state = NodeState.DELETED;
                this._tree?.remove(c.root!.data);
            }
        });
        console.log('context after', context);
        return (
            this._tree ||
            new SimplifiedTree<ReadableNode>({ name: 'PROBLEM!!!!!!' })
        );
    }

    async handleUpdateTree(content: string) {
        // const editor = window.activeTextEditor || window.visibleTextEditors[0];
        // const doc =
        //     editor.document.uri.fsPath === this.readableNode.location.uri.fsPath
        //         ? editor.document
        //         : await workspace.openTextDocument(this.readableNode.location.uri); // idk when this would ever happen??? maybe in a git pull where a whole bunch of docs are being updated
        // const newTree = await this.container.treeCreator.createTree(
        //     doc,
        //     this.readableNode.location,
        //     newContent
        // );
        // this._tree = newTree;
        // compute parsed subtree when this node is marked as deleted
        // or when count of function defs or ifs or whatever changes -- heuristic
        // get parsed subtree -- how to do this though since typescript parser doesnt
        // really like parsing a snippet out of context?
        // look into this or have doc keep a reference to the parsed AST
        // and request there
        // update our instance of tree
        // set parent's children to new tree (how to avoid race condition...)
        // call parent's update
        // recurse to top of tree
        // to do this on save? or other time??
    }

    getGitData() {
        return this.container.gitController?.gitLog(this.readableNode.location);
    }

    async getFirestoreData() {
        return await this.container.firestoreController?.query(
            this.readableNode.id
        );
    }

    // serialize(): SerializedDataController {
    serialize(): SerializedNodeDataController {
        return {
            node: this.readableNode.serialize(),
            lastUpdatedTime: Date.now(),
            lastUpdatedBy:
                this.container.firestoreController?._user?.uid || 'anonymous',
            setOfEventIds: [],
            // this._changeBuffer // keep track of this since we reset change buffer on push
            //     .filter((c) => c?.eventData)
            //     .map((c) => c.id),
            // setOfEvents: this._changeBuffer.,
            // webMetadata: this.webMetaData,
            // changeBuffer: [],

            // this._changeBuffer.map((c) => {
            //     return {
            //         ...c,
            //         location: c.location.serialize(),
            //     };
            // }),
            // vscNodeMetadata: this.vscodeNodeMetadata, // need to remove ts nodes
        };
    }

    dispose() {
        this._disposable?.dispose();
    }

    set vscNodeMetadata(newNodeMetadata: ParsedTsNode) {
        this._vscNodeMetadata = newNodeMetadata;
    }

    get vscodeNodeMetadata() {
        return this._vscNodeMetadata;
    }

    get webMetaData() {
        return this._webMetaData;
    }

    set tree(newTree: SimplifiedTree<ReadableNode> | undefined) {
        this._tree = newTree;
    }

    get tree() {
        return this._tree;
    }

    get firestoreControllerInterface() {
        return this._firestoreControllerInterface;
    }

    set firestoreControllerInterface(newFirestoreControllerInterface) {
        this._firestoreControllerInterface = newFirestoreControllerInterface;
    }
}
