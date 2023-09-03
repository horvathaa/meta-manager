// may make sense to also strip keywords but not 100% sure
export function stripNonAlphanumeric(str: string): string[] {
    const regex = /[^a-zA-Z0-9]+/g;
    const strippedString = str.replace(regex, ' ');
    const strippedArray = strippedString.split(' ').filter(Boolean);
    return strippedArray;
}

export function intersectionBetweenStrings(
    str1: string | string[],
    str2: string | string[]
) {
    const arr1 = Array.isArray(str1) ? str1 : stripNonAlphanumeric(str1);
    const arr2 = Array.isArray(str2) ? str2 : stripNonAlphanumeric(str2);

    const intersection = arr1.filter((x) => arr2.includes(x));

    return intersection.length;
}

export function stringSimilarity(s1: string, s2: string) {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (
        (longerLength - editDistance(longer, shorter)) /
        // @ts-ignore
        parseFloat(longerLength)
    );
}

function editDistance(s1: string, s2: string) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i;
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue =
                            Math.min(Math.min(newValue, lastValue), costs[j]) +
                            1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}
