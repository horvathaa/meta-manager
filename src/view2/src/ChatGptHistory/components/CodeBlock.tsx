import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as React from 'react';

// https://www.makeuseof.com/react-syntax-highlighting-code-block/
const CodeBlock = ({ codeString }: { codeString: string }) => {
    return (
        <SyntaxHighlighter language="javascript" style={vscDarkPlus}>
            {codeString}
        </SyntaxHighlighter>
    );
};

export default CodeBlock;
