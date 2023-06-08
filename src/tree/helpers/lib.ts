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
