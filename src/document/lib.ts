import {
    WorkspaceFolder,
    workspace,
    window,
    Position,
    Range,
    TextDocument,
    Location,
    Uri,
} from 'vscode';
import * as ts from 'typescript';
import { ReadableNode } from '../constants/types';
import LocationPlus from './locationApi/location';

export const getVisiblePath = (
    projectName: string,
    workspacePath: string | undefined,
    extensionUri: Uri
): string => {
    if (projectName && workspacePath) {
        // console.log('projectName', projectName, 'workspacePath', workspacePath)
        if (workspacePath.includes(projectName)) {
            const path: string = workspacePath.substring(
                workspacePath.indexOf(projectName) + projectName.length + 1 // indexOf will return beginning of path so add path length and 1 so we get to the next folder YES this is stupid
            );
            if (path) {
                return path;
            }
        } else {
            const path = workspacePath.substring(
                extensionUri.fsPath.length + 1
            );
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

export function getRandomArbitrary(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

// export function isCodeValid(input: string): boolean {
//     input = input.toLowerCase();

//     const openAngle = input.split('<').length - 1;
//     const closedAngle = input.split('>').length - 1;

//     const openBrackets = input.split('[').length - 1;
//     const closedBrackets = input.split(']').length - 1;

//     const openCurly = input.split('{').length - 1;
//     const closedCurly = input.split('}').length - 1;

//     const openParen = input.split('(').length - 1;
//     const closedParen = input.split(')').length - 1;

//     const bracketTotal =
//         openAngle +
//         closedAngle +
//         openBrackets +
//         closedBrackets +
//         openCurly +
//         closedCurly +
//         openParen +
//         closedParen;
//     // calculate the inequality of brackets. the lower the number the more unequal
//     const inequality =
//         -Math.abs(openAngle - closedAngle) -
//         Math.abs(openBrackets - closedBrackets) -
//         Math.abs(openCurly - closedCurly) -
//         Math.abs(openParen - closedParen);

//     const semicolons = input.split(';').length - 1;
//     const colons = input.split(':').length - 1;

//     const quotes = input.split('"').length - 1;
//     const singleQuotes = input.split("'").length - 1;

//     let keywordsFound = 0;
//     let highKeywordsFound = 0;
//     let lowKeywordsFound = 0;
//     let symbolsFound = 0;

//     // test keywords
//     input
//         .split(' ')
//         .map((n) => n.replace('\n', ''))
//         .filter((n) => n != '')
//         .forEach((word) => {
//             if (keywords.includes(word)) {
//                 keywordsFound++;
//             }
//         });
//     high_confidence_keywords.forEach((word) => {
//         if (input.includes(word)) {
//             highKeywordsFound++;
//         }
//     });
//     low_confidence_keywords.forEach((word) => {
//         if (input.includes(word)) {
//             lowKeywordsFound++;
//         }
//     });
//     symbol_keywords.forEach((symbol) => {
//         if (input.includes(symbol)) {
//             symbolsFound++;
//         }
//     });

//     let confidence = 0;
//     confidence += bracketTotal > 0 ? 0.5 : -0.5;
//     confidence += input.length > 8 ? 0.5 : -0.3;
//     confidence +=
//         (inequality < 0
//             ? inequality / 10
//             : bracketTotal == 0
//             ? 0
//             : 0.3 * bracketTotal) *
//         (20 / input.length);
//     confidence += semicolons > 0 ? 1 : -0.5;
//     confidence += colons > 0 ? 0.2 : -0.2;
//     confidence += keywordsFound * 0.7;
//     confidence += 3 * highKeywordsFound;
//     confidence += -2 * lowKeywordsFound;
//     confidence += symbolsFound;
//     confidence += input.endsWith(';') ? 0.7 : 0;
//     confidence += quotes > 0 ? 0.5 : 0;
//     confidence += singleQuotes > 0 ? 0.5 : 0;

//     return confidence >= 1;
// }

// sort array ascending
const asc = (arr) => arr.sort((a, b) => a - b);

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

const mean = (arr) => sum(arr) / arr.length;

// sample standard deviation
const std = (arr) => {
    const mu = mean(arr);
    const diffArr = arr.map((a) => (a - mu) ** 2);
    return Math.sqrt(sum(diffArr) / (arr.length - 1));
};

export const quantile = (arr, q) => {
    const sorted = asc(arr);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
};

export function filterOutliers(someArray) {
    if (someArray.length < 4) {
        return someArray;
    }

    let values = someArray.slice().sort((a, b) => a - b); // copy array fast and sort

    let q1 = quantile(values, 0.25);
    let q3 = quantile(values, 0.75);

    let iqr, maxValue, minValue;
    iqr = q3 - q1;
    maxValue = q3 + iqr * 1.5;
    minValue = q1 - iqr * 1.5;

    return {
        in: values.filter((x) => x >= minValue && x <= maxValue),
        out: values.filter((x) => x < minValue || x > maxValue),
    };
}
