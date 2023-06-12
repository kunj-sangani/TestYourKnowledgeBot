export interface Question {
    question: string;
    options: string[];
    optionSet: OptionSet[];
    answer: string;
    referenceLink: string;
    currentIndex:number;
    totalQuestionsCount:number;
}

export interface OptionSet {
    title: string;
    value: string;
}