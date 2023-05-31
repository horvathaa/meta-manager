import {
    Disposable,
    TextDocument,
    TextDocumentChangeEvent,
    workspace,
    Location,
} from 'vscode';
import { Container } from '../container';
import {
    getCleanedNodeRange,
    getProjectName,
    getVisiblePath,
    nodeToRange,
} from './lib';
import * as ts from 'typescript';
import { ReadableNode, namedDeclarations } from '../constants/types';
const tstraverse = require('tstraverse');

class DocumentWatcher extends Disposable {
    _disposable: Disposable;
    _relativeFilePath: string;
    _nodesInFile: Map<string, ReadableNode>;
    constructor(
        private readonly document: TextDocument,
        private readonly container: Container
    ) {
        super(() => this.dispose());
        this._disposable = Disposable.from(
            workspace.onDidChangeTextDocument(this.onTextDocumentChanged, this)
        );
        this._relativeFilePath = getVisiblePath(
            workspace.name || getProjectName(this.document.uri.toString()),
            this.document.uri.fsPath
        );

        this._nodesInFile = this.traverse();
    }

    onTextDocumentChanged(e: TextDocumentChangeEvent) {
        if (e.document !== this.document) {
            return;
        }
    }

    traverse() {
        // traverse the document and find the code anchors

        const sourceFile = ts.createSourceFile(
            this.document.fileName,
            this.document.getText(),
            ts.ScriptTarget.Latest,
            true // this sets the parent property on all nodes - does not extract parent-level nodes...
            // there is statements which are the top level statements which may be useful
        );

        let nodes: ts.Node[] = [];

        let isMatching = true;
        // let map = new Map<ReadableNode, ReadableNode[]>();
        let newMap = new Map<string, ReadableNode>();

        // Enter function will be executed as each node is first interacted with
        function enter(node: ts.Node) {
            nodes.push(node);
        }

        const docCopy = this.document;

        // Leave function will be executed after all children have been interacted with
        function leave(node: ts.Node) {
            const topNode = nodes.pop();

            if (topNode && ts.isIdentifier(topNode)) {
                const copy: ReadableNode[] = nodes.map((n) => {
                    return {
                        node: n,
                        humanReadableKind: ts.SyntaxKind[n.kind],
                        location: new Location(
                            docCopy.uri,
                            nodeToRange(n, sourceFile ? sourceFile.text : '')
                        ),
                    };
                });
                topNode.text === 'tabSize' &&
                    console.log('top node', topNode, 'nodes', copy);
                // look thru array to see if the previous node is a declaration.. i think?

                const foundDeclarationBool = namedDeclarations.includes(
                    copy[copy.length - 1].humanReadableKind
                );
                if (!foundDeclarationBool) {
                    return;
                }
                const foundDeclaration = copy[copy.length - 1];
                // const foundDeclaration = copy.find(
                //     // (n) => n.humanReadableKind === 'VariableDeclaration'
                //     (n) => namedDeclarations.includes(n.humanReadableKind)
                // );
                if (foundDeclaration) {
                    if (
                        ts.isClassDeclaration(foundDeclaration.node) &&
                        foundDeclaration.node.name &&
                        !newMap.has(foundDeclaration.node.name.text)
                    ) {
                        const classDeclaration =
                            foundDeclaration.node as ts.ClassDeclaration;
                        const classMembers = classDeclaration.members;
                        classMembers.forEach((member) => {
                            if (ts.isMethodDeclaration(member)) {
                                const propertyIdentifierLocation = nodeToRange(
                                    member,
                                    sourceFile ? sourceFile.text : ''
                                );

                                newMap.set(member.name.getText(), {
                                    node: member,
                                    humanReadableKind:
                                        ts.SyntaxKind[member.kind],
                                    location: new Location(
                                        docCopy.uri,
                                        propertyIdentifierLocation
                                    ),
                                });
                            }
                        });
                    }

                    newMap.set(topNode.text, foundDeclaration);

                    // newMap.set(
                    //     foundDeclaration.node,
                    //     foundDeclaration.location
                    // );
                    // console.log('setting new Map...', newMap)
                }
                const key = {
                    node: topNode,
                    humanReadableKind: ts.SyntaxKind[node.kind],
                    location: new Location(
                        docCopy.uri,
                        getCleanedNodeRange(
                            docCopy,
                            nodeToRange(
                                node,
                                sourceFile ? sourceFile.text : ''
                            ),
                            topNode.text
                        )
                    ),
                };
                // map.set(key, copy);
            }

            isMatching = isMatching && topNode === node;
        }

        sourceFile && tstraverse.traverse(sourceFile, { enter, leave });
        // console.log('map', map, 'newMap', newMap)
        console.log('lol', newMap, 'source', sourceFile);

        // this.topLevelNodes.set(document, newMap);
        // console.log('this...', this)
        // return map;
        return newMap;
    }
}

export default DocumentWatcher;
