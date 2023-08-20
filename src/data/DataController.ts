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
import TimelineEvent from './timeline/TimelineEvent';
import { ParsedTsNode } from '../document/languageServiceProvider/LanguageServiceProvider';
import { debounce } from '../utils/lib';
import { patienceDiffPlus } from '../utils/PatienceDiff';
import {
    CopyBuffer,
    Event,
    SerializedDataController,
    SerializedLocationPlus,
    SerializedNodeDataController,
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
export type LegalDataType = (DefaultLogFields & ListLogLine) | DocumentData; // not sure this is the right place for this but whatever

interface PasteData {
    uri: Uri;
    textDocumentContentChangeEvent: TextDocumentContentChangeEvent;
}

type DiffLine = {
    aIndex: number;
    bIndex: number;
    line: string;
};
type Diff =
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

interface ChangeBuffer {
    location: LocationPlus | SerializedLocationPlus;
    typeOfChange: TypeOfChange;
    changeContent: string;
    time: number;
    diff?: Diff;
    addedBlock?: boolean;
    removedBlock?: boolean;
    uid: string;
    id: string;
    eventData?: {
        [Event.COMMENT]?: {
            newComments?: CodeComment[];
            removedComments?: CodeComment[];
            changedComments?: CodeComment[];
        };
        [Event.COPY]?: {
            copyContent: string;
        };
        [Event.PASTE]?: {
            pasteContent: string;
            nodeId?: string;
        };
        [Event.WEB]?: {
            copyBuffer: CopyBuffer;
        };
    };
}

export interface FirestoreControllerInterface {
    ref: DocumentReference<DocumentData>;
    pastVersionsCollection: CollectionReference<DocumentData>;
    write: (newNode: any) => void;
    logVersion: (versionId: string, newNode: any) => void;
    readPastVersions: () => Promise<SerializedDataController[]>;
}

export class DataController {
    // extends AbstractTreeReadableNode<ReadableNode> {
    _gitData: TimelineEvent[] | undefined;
    _firestoreData: TimelineEvent[] | undefined;
    _outputData: OutputDataController | undefined;
    _firestoreControllerInterface: FirestoreControllerInterface | undefined;
    _tree: SimplifiedTree<ReadableNode> | undefined;
    _metaInformationExtractor: MetaInformationExtractor;
    _pastVersions: SerializedDataController[] = [];
    // _readableNode: ReadableNode;
    // _chatGptData: VscodeCopyBuffer[] | undefined = [];
    _webMetaData: VscodeCopyBuffer[] = [];
    _vscNodeMetadata: ParsedTsNode | undefined;
    _disposable: Disposable | undefined;
    _debug: boolean = false;
    _emit: boolean = false;
    _seen: boolean = false;
    _changeBuffer: ChangeBuffer[];
    _ownedLocations: LocationPlus[] = [];
    // _pasteDisposable: Disposable;

    constructor(
        private readonly readableNode: ReadableNode,
        private readonly container: Container,
        private readonly debug = false
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

    private addBlockToTree(
        b: ts.Block,
        name: string,
        insertedRange: RangePlus
    ) {
        // const name = `test:${uuidv4()}`;
        const readableNode = ReadableNode.create(
            b,
            new LocationPlus(this.readableNode.location.uri, insertedRange),
            this.container,
            `${name}:${uuidv4()}`
        );
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
            addedContent.includes('}')
        ) {
            this._debug = true;
            if (
                this._tree &&
                (this._tree.isLeaf ||
                    !this._tree?.root?.children.some((c) =>
                        c.root?.data.location.range.contains(insertedRange)
                    ))
            ) {
                const sourceFile = ts.createSourceFile(
                    this.readableNode.location.uri.fsPath,
                    addedContent,
                    ts.ScriptTarget.Latest,
                    true
                );
                const blocks = this.evenSimplerTraverse(sourceFile);
                // sourceFile.statements.filter((t) =>
                //     ts.isBlock(t)
                // );
                console.log(
                    'tree before',
                    this._tree,
                    'blocks',
                    blocks,
                    'sf',
                    sourceFile
                );
                blocks.forEach((b) => {
                    this.addBlockToTree(b.node, b.name, insertedRange);
                });
                console.log('tree after', this._tree);
            }
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
                    },
                },
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
            this._changeBuffer.push({
                ...this.getBaseChangeBuffer(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: pasteEvent.location.content,
                eventData: {
                    [Event.WEB]: {
                        copyBuffer: this.container.copyBuffer,
                    },
                },
            });
            this._debug = true;
            this._emit = true;
            console.log('posting', this.serialize());
        } else {
            this._changeBuffer.push({
                ...this.getBaseChangeBuffer(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: pasteEvent.location.content,
                eventData: {
                    [Event.PASTE]: {
                        pasteContent: pasteEvent.location.content,
                        nodeId: this.readableNode.id, // replace with readable node id that was copiedd
                    },
                },
            });
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

    async handleOnSelected(location: Selection) {
        if (
            this._tree &&
            (this._tree.isLeaf ||
                !this._tree.root?.children.some((c) =>
                    c.root?.data.location.range.contains(location)
                ))
        ) {
            const allData = this.serialize();
            console.log('allData', {
                ...allData,
                pastVersions: this._pastVersions,
            });
            this.container.webviewController?.postMessage({
                command: 'updateTimeline',
                data: {
                    id: this.readableNode.id,
                    data: { ...allData, pastVersions: this._pastVersions },
                },
            });
        }
        // this._debug = true;
        // const gitRes = (await this.getGitData())?.all || [];
        // if (gitRes.length > 0) {
        //     this._gitData = gitRes.map((r) => new TimelineEvent(r));
        // } else {
        //     this._gitData = [];
        // }
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

    evenSimplerTraverse(sourceFile: ts.SourceFile) {
        const nodes: ts.Node[] = [];
        const blocks: { [k: string]: any }[] = [];
        function enter(node: ts.Node) {
            nodes.push(node);
            if (ts.isBlock(node)) {
                const readableNodeArrayCopy = nodes.map((n) => n);
                let name = `${getSimplifiedTreeName(
                    readableNodeArrayCopy.reverse()
                )}`;
                // todo: add position using node offset within inserted range because
                // inserted ranges can be a bit wonky
                blocks.push({ node, name: `${name}:${uuidv4()}` });
            }
        }

        function leave(node: ts.Node) {
            nodes.pop();
        }

        tstraverse.traverse(sourceFile, { enter, leave });
        return blocks;
    }

    handleOnSaveTextDocument(textDocument: TextDocument) {
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
            // this._tree?.root?.children.forEach((c) => {
            //     if (c.root?.data.id === this.readableNode.id) {
            //         c.root.data.state = NodeState.DELETED;
            //         c.root.data.update();
            //     }
            // });
            // this.readableNode.parent?.children = this.readableNode.parent?.children.filter((c) => c.id !== this.readableNode.id);
            // this.readableNode.parent?.update();
            // this._firestoreControllerInterface?.write({
            //     ...this.serialize(),
            // });
            // return;
        }

        console.log('this....', this);
        // if the node's content has changed, check for change in block and update db
        // if (
        //     this.readableNode.state &&
        //     nodeContentChange(this.readableNode.state) &&
        //     this._changeBuffer.some((s) => s.addedBlock || s.removedBlock) &&
        //     this._tree?.isLeaf
        // ) {
        //     const sourceFile = ts.createSourceFile(
        //         textDocument.fileName,
        //         textDocument.getText(this.readableNode.location.range),
        //         ts.ScriptTarget.Latest,
        //         true
        //     );

        //     // this._tree?.root?.children.forEach((c) => {
        //     //     c = c.root!.data.dataController!.simpleTraverse(
        //     //         sourceFile,
        //     //         textDocument
        //     //     );
        //     // });

        //     this._tree = this.simpleTraverse(sourceFile, textDocument);
        //     this._tree?.parent?.root?.data.dataController?.updateChild(
        //         this._tree
        //     );
        //     // const blocks = (
        //     //     sourceFile.statements[0] as ts.Block
        //     // ).statements.filter((t) => ts.isBlock(t));
        //     // console.log(
        //     //     'sourceFile',
        //     //     sourceFile,
        //     //     'blocks',
        //     //     blocks,
        //     //     'this',
        //     //     this
        //     // );
        //     // if (
        //     //     blocks.length === this._tree?.root?.children.length
        //     //     // ||
        //     //     // (blocks.length === 1 && this._tree?.root?.children.length === 0)
        //     // ) {
        //     //     console.log('no need to update');
        //     //     return;
        //     // } else {
        //     //     console.log('UPADTING!!!!!!');
        //     //     return;
        //     // }
        // }

        this._firestoreControllerInterface?.write({
            ...this.serialize(),
        });
        if (this.container.gitController?.gitState) {
            const { commit, branch } = this.container.gitController
                ?.gitState as CurrentGitState;
            this._changeBuffer.forEach((c) => {
                this._firestoreControllerInterface?.logVersion(c.id, {
                    ...c,
                    commit, // tbd if we just want this as a subcollection
                    branch,
                });
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
            console.log('opening', this);
            this._seen = true;
            this._pastVersions =
                (await this._firestoreControllerInterface?.readPastVersions()) ||
                [];
            console.log('this', this);
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
            setOfEventIds: this._changeBuffer // keep track of this since we reset change buffer on push
                .filter((c) => c.eventData)
                .map((c) => c.id),
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
