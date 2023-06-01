import {
    WorkspaceFolder,
    workspace,
    window,
    Position,
    Range,
    TextDocument,
    Location,
} from 'vscode';
import * as ts from 'typescript';
import { ReadableNode } from '../constants/types';

export const getVisiblePath = (
    projectName: string,
    workspacePath: string | undefined
): string => {
    if (projectName && workspacePath) {
        // console.log('projectName', projectName, 'workspacePath', workspacePath)
        const path: string = workspacePath.substring(
            workspacePath.indexOf(projectName) + projectName.length + 1 // indexOf will return beginning of path so add path length and 1 so we get to the next folder YES this is stupid
        );
        if (path) {
            return path;
        }
    } else if (workspacePath) {
        return workspacePath;
    }
    return projectName;
};

export const getProjectName = (filename?: string | undefined): string => {
    if (workspace.workspaceFolders) {
        if (workspace.workspaceFolders.length > 1 && filename) {
            const slash: string = filename.includes('\\') ? '\\' : '/';
            const candidateProjects: string[] = workspace.workspaceFolders.map(
                (f: WorkspaceFolder) => f.name
            );
            return candidateProjects.filter((name: string) =>
                filename.includes(name)
            )[0]
                ? candidateProjects.filter((name: string) =>
                      filename.includes(name)
                  )[0]
                : filename.split(slash)[filename.split(slash).length - 1]
                ? filename.split(slash)[filename.split(slash).length - 1]
                : filename;
        } else if (workspace.workspaceFolders.length === 1) {
            return workspace.workspaceFolders[0].name;
        } else if (!filename) {
            const fsPath: string = window.activeTextEditor
                ? window.activeTextEditor.document.uri.fsPath
                : window.visibleTextEditors[0].document.uri.fsPath;
            const candidateProjects: string[] = workspace.workspaceFolders.map(
                (f: WorkspaceFolder) => f.name
            );
            const match = candidateProjects.find((project) =>
                fsPath.includes(project)
            );
            return match ? match : '';
        }
    }
    return '';
};

function posToLine(scode: string, pos: number) {
    const code = scode.slice(0, pos).split('\n');
    return new Position(code.length - 1, code[code.length - 1].length);
}

export function nodeToRange(node: ts.Node, code: string): Range {
    return new Range(posToLine(code, node.pos), posToLine(code, node.end));
}

export const getCleanedNodeRange = (
    editorOrDoc: TextDocument,
    r: ReadableNode | Range,
    identifierName: string
) => {
    const document = editorOrDoc;
    const location = r instanceof Range ? r : r.location.range;
    const text = document.getText(location).split('\n');
    const lineIndex =
        text.findIndex((t) => t.includes(identifierName)) >= 0
            ? text.findIndex((t) => t.includes(identifierName))
            : 0;
    const substrIndex =
        text.find((t) => t.includes(identifierName))?.indexOf(identifierName) ||
        0;
    const cleanedRange =
        text.length > 1
            ? new Range(
                  location.start.line + lineIndex,
                  substrIndex,
                  location.end.line,
                  location.end.character
              )
            : new Range(
                  location.start.line,
                  location.start.character + substrIndex,
                  location.end.line,
                  location.end.character
              );
    return cleanedRange;
};

export function makeReadableNode(node: ts.Node, doc: TextDocument) {
    return {
        node: node,
        humanReadableKind: ts.SyntaxKind[node.kind],
        location: new Location(doc.uri, nodeToRange(node, doc.getText())),
    };
}

export interface NamedReadableNode extends ReadableNode {
    name: string;
}

interface TreeReadableNode<T> extends TreeReadableRootNode<T> {
    data: T;
    // children: SimplifiedTree<T>[];
}

interface TreeReadableRootNode<T> {
    children: SimplifiedTree<T>[];
}

// https://dtjv.io/the-generic-tree-data-structure/
// i haven't implemented a tree in eons lmao
export class SimplifiedTree<T> {
    root: TreeReadableRootNode<T> | undefined;
    name: string;
    constructor(name: string, root?: TreeReadableRootNode<T>) {
        this.root = root || undefined;
        this.name = name;
    }

    public insert(data: T, name: string): SimplifiedTree<T> {
        // scenario 1
        if (!this.root) {
            this.root = { children: [] };
            this.root.children.push(
                new SimplifiedTree<T>(name, { ...data, children: [] })
            );
            return this;
        }

        // scenario 2
        const child = new SimplifiedTree<T>(name);

        this.root.children.push(child.insert({ ...data, children: [] }, name));
        return child;
    }
}

export function getSimplifiedTreeName(nodes: ReadableNode[]): string {
    const copy = [...nodes];
    const first = copy.shift();
    if (!first) {
        return '';
    }
    if (ts.isIfStatement(first.node)) {
        return 'If';
    }
    if (ts.isForStatement(first.node)) {
        return 'For';
    }
    if (ts.isWhileStatement(first.node)) {
        return 'While';
    }
    if (ts.isDoStatement(first.node)) {
        return 'Do';
    }
    if (ts.isSwitchStatement(first.node)) {
        return 'Switch';
    }
    if (ts.isTryStatement(first.node)) {
        return 'Try';
    }
    if (ts.isCatchClause(first.node)) {
        return 'Catch';
    }
    if (ts.isConstructorDeclaration(first.node)) {
        return 'Constructor';
    }
    if (first.node.hasOwnProperty('name')) {
        return (first.node as ts.FunctionDeclaration).name?.getText() || '';
    }
    if (ts.isArrowFunction(first.node)) {
        if (
            copy.length > 1 &&
            copy[0].humanReadableKind === 'VariableDeclaration'
        ) {
            return (copy[0].node as ts.VariableDeclaration).name.getText();
        }
        return 'Arrow Function'; // could do something fancier to try and get the name of the function but this is fine for now
        // but this is fine for now
    }
    return getSimplifiedTreeName(copy);
}