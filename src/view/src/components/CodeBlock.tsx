import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as React from 'react';
// import { workspace } from 'vscode';

// const theme = workspace.getConfiguration(
//     'workbench',
//     workspace.workspaceFolders && workspace.workspaceFolders[0].uri
// ).colorTheme;
// console.log('does this work lmao', theme);
// https://www.makeuseof.com/react-syntax-highlighting-code-block/
const CodeBlock = ({
    codeString,
    style,
    highlightLogic,
    startingLineNumber,
}: {
    codeString: string;
    style?: React.CSSProperties;
    highlightLogic?: (lineNumber: number) => {
        style: React.CSSProperties;
        onClick?: () => void;
        onMouseEnter?: () => void;
        onMouseLeave?: () => void;
        className?: string;
    };
    startingLineNumber?: number;
}) => {
    console.log('highlight logic', highlightLogic);
    return highlightLogic ? (
        <SyntaxHighlighter
            language="javascript"
            style={vscDarkPlus}
            lineProps={highlightLogic}
            wrapLines={true}
            showLineNumbers={true} // https://github.com/react-syntax-highlighter/react-syntax-highlighter/issues/444
            startingLineNumber={startingLineNumber}
        >
            {codeString}
        </SyntaxHighlighter>
    ) : (
        <SyntaxHighlighter language="javascript" style={vscDarkPlus}>
            {codeString}
        </SyntaxHighlighter>
    );
};

export default CodeBlock;
