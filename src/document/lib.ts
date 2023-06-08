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
import LocationPlus from './locationApi/location';

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
    let location: Location | LocationPlus = new Location(
        doc.uri,
        nodeToRange(node, doc.getText())
    );
    return {
        node: node,
        humanReadableKind: ts.SyntaxKind[node.kind],
        location,
    };
}

export function isTextDocument(doc: any): doc is TextDocument {
    return (
        doc !== undefined &&
        doc.hasOwnProperty('uri') &&
        doc.hasOwnProperty('fileName')
    );
}
