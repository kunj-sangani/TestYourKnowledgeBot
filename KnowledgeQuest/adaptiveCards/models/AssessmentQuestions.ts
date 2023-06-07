export interface AssessmentQuestions {
    questions: Question[];
}

export interface Question {
    question: string;
    options: string[];
    answer: string;
    referenceLink: string;
}