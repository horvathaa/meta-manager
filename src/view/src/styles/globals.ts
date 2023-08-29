export const META_MANAGER_COLOR = '#519aba80';
export const THEME_COLORS = [
    '#5453A661',
    '#7575CF61',
    '#CCCCFF61',
    '#9EA9ED61',
];

// plain text color
export const vscodeTextColor: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-foreground');

// disabled text color
export const vscodeDisableTextColor: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-disabledForeground');

export const editorForeground: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-editor-foreground');

export const editorDescForeground: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-descriptionForeground');

export const editorBackground: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-editor-background');

export const hoverBackground: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-button-secondaryHoverBackground');

export const iconColor: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-icon-foreground');

export const vscodeBorderColor: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-focusBorder');

export const hoverText: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-input-foreground');

export const codeColor: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-input-foreground');

export const textBoxBackground: string = lightenDarkenColor(
    getComputedStyle(document.body).getPropertyValue(
        '--vscode-editor-background'
    ),
    10
);

export function lightenDarkenColor(col: string, amt: number) {
    var usePound = false;

    if (col[0] == '#') {
        col = col.slice(1);
        usePound = true;
    }

    var num = parseInt(col, 16);

    var r = (num >> 16) + amt;

    if (r > 255) r = 255;
    else if (r < 0) r = 0;

    var b = ((num >> 8) & 0x00ff) + amt;

    if (b > 255) b = 255;
    else if (b < 0) b = 0;

    var g = (num & 0x0000ff) + amt;

    if (g > 255) g = 255;
    else if (g < 0) g = 0;

    return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16);
}

export const pSBC = (p: any, c0: any, c1: any, l: any) => {
    let r: any,
        g: any,
        b: any,
        P: any,
        f: any,
        t: any,
        h: any,
        m = Math.round,
        a: any = typeof c1 == 'string';
    if (
        typeof p != 'number' ||
        p < -1 ||
        p > 1 ||
        typeof c0 != 'string' ||
        (c0[0] != 'r' && c0[0] != '#') ||
        (c1 && !a)
    )
        return null;
    (h = c0.length > 9),
        (h = a ? (c1.length > 9 ? true : c1 == 'c' ? !h : false) : h),
        (f = pSBC.pSBCr(c0)),
        (P = p < 0),
        (t =
            c1 && c1 != 'c'
                ? pSBC.pSBCr(c1)
                : P
                ? { r: 0, g: 0, b: 0, a: -1 }
                : { r: 255, g: 255, b: 255, a: -1 }),
        (p = P ? p * -1 : p),
        (P = 1 - p);
    if (!f || !t) return null;
    if (l)
        (r = m(P * f.r + p * t.r)),
            (g = m(P * f.g + p * t.g)),
            (b = m(P * f.b + p * t.b));
    else
        (r = m((P * f.r ** 2 + p * t.r ** 2) ** 0.5)),
            (g = m((P * f.g ** 2 + p * t.g ** 2) ** 0.5)),
            (b = m((P * f.b ** 2 + p * t.b ** 2) ** 0.5));
    (a = f.a),
        (t = t.a),
        (f = a >= 0 || t >= 0),
        (a = f ? (a < 0 ? t : t < 0 ? a : a * P + t * p) : 0);
    if (h)
        return (
            'rgb' +
            (f ? 'a(' : '(') +
            r +
            ',' +
            g +
            ',' +
            b +
            (f ? ',' + m(a * 1000) / 1000 : '') +
            ')'
        );
    else
        return (
            '#' +
            (
                4294967296 +
                r * 16777216 +
                g * 65536 +
                b * 256 +
                (f ? m(a * 255) : 0)
            )
                .toString(16)
                .slice(1, f ? undefined : -2)
        );
};

pSBC.pSBCr = (d: any) => {
    const i = parseInt;
    let n: number = d.length,
        x: any = {};
    if (n > 9) {
        const [r, g, b, a] = (d = d.split(','));
        n = d.length;
        if (n < 3 || n > 4) return null;
        (x.r = i(r[3] == 'a' ? r.slice(5) : r.slice(4))),
            (x.g = i(g)),
            (x.b = i(b)),
            (x.a = a ? parseFloat(a) : -1);
    } else {
        if (n == 8 || n == 6 || n < 4) return null;
        if (n < 6)
            d =
                '#' +
                d[1] +
                d[1] +
                d[2] +
                d[2] +
                d[3] +
                d[3] +
                (n > 4 ? d[4] + d[4] : '');
        d = i(d.slice(1), 16);
        if (n == 9 || n == 5)
            (x.r = (d >> 24) & 255),
                (x.g = (d >> 16) & 255),
                (x.b = (d >> 8) & 255),
                (x.a = Math.round((d & 255) / 0.255) / 1000);
        else
            (x.r = d >> 16),
                (x.g = (d >> 8) & 255),
                (x.b = d & 255),
                (x.a = -1);
    }
    return x;
};

export const disabledIcon: string = getComputedStyle(
    document.body
).getPropertyValue('--vscode-disabledForeground');

export const cardStyle = {
    backgroundColor: `${pSBC(0.1, editorBackground, false, true)}`,
    // backgroundColor: tryingSomethingNew,
    color: vscodeTextColor,
    margin: 4,
    // border: '1.5px',
    // borderColor: iconColor,
    borderRadius: '4px',
    // borderStyle: 'solid',
    padding: '1rem',
    flexGrow: 1,
};
