import ko from "./ko";
import en from "./en";

const dict = { ko, en};

export function t(lang, key) {
    const table = dict[lang] ?? dict.ko;
    return key.split(".").reduce((acc,cur) => (acc ? acc[cur] : undefined), table) ?? key;
}