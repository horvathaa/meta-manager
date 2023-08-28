import * as Diff from 'diff';
import * as React from 'react';
import CodeBlock from './CodeBlock';
export const DiffBlock = (props: { str1: string; str2: string }) => {
    const { str1, str2 } = props;
    const diff = Diff.diffLines(str1, str2);
    const codeStr = diff.map((p) => p.value).join('');
    const lineNumbers: any[] = [];
    let currDiffIndex = 0;
    let currCount = diff[0]?.count || 0;
    codeStr.split('\n').forEach((l, i) => {
        if (i === currCount) {
            currDiffIndex++;
            currCount = currCount + (diff[currDiffIndex]?.count || 0);
        }
        if (diff[currDiffIndex].added) {
            lineNumbers.push({ i: i + 1, added: true });
        }
        if (diff[currDiffIndex].removed) {
            lineNumbers.push({ i: i + 1, removed: true });
        }
    });
    console.log('lineNumbers', lineNumbers);
    console.log('diff', diff);
    const highlightLogic = (lineNumber: number) => {
        const match = lineNumbers.find((l) => l.i === lineNumber);
        let style: React.CSSProperties = {};
        if (match) {
            if (match.added) {
                style.backgroundColor = '#00ff5a47';
            }
            if (match.removed) {
                style.backgroundColor = '#ff000080';
            }
        }
        return { style };
    };
    return <CodeBlock codeString={codeStr} highlightLogic={highlightLogic} />;
};
