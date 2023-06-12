export interface Question {
    question: string;
    options: string[];
    optionSet: OptionSet[];
    answer: string;
    referenceLink: string;
}

export interface OptionSet {
    title: string;
    value: string;
}